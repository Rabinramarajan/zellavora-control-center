/** What an uploaded file really is, judged from its bytes and never from what the client claims. */
export interface DetectedFile {
  mime: string;
  /** Safe to show inside the page (images, PDF); everything else is download-only. */
  inline: boolean;
}

export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TASK = 20;

const startsWith = (b: Buffer, sig: number[], offset = 0): boolean =>
  b.length >= offset + sig.length && sig.every((v, i) => b[offset + i] === v);

/** Plain text: valid UTF-8 with no control characters other than tab, newline and return. */
const looksLikeText = (b: Buffer): boolean => {
  const head = b.subarray(0, 64 * 1024);
  for (const byte of head) {
    if (byte < 9 || (byte > 13 && byte < 32) || byte === 127) return false;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head);
    return true;
  } catch {
    // A multi-byte character may be cut at the 64 KB edge; only a short file proves invalid UTF-8.
    return b.length > head.length;
  }
};

const OFFICE_BY_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
};

const TEXT_BY_EXTENSION: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/plain',
  log: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
};

const extensionOf = (name: string): string => name.split('.').pop()?.toLowerCase() ?? '';

/**
 * Returns the detected type, or null when the file is not on the allow-list. Scriptable formats
 * (SVG, HTML, executables) are never accepted, whatever the extension says.
 */
export function detectFile(bytes: Buffer, fileName: string): DetectedFile | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: 'image/png', inline: true };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', inline: true };
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return { mime: 'image/gif', inline: true };
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { mime: 'image/webp', inline: true };
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { mime: 'application/pdf', inline: true };

  const extension = extensionOf(fileName);
  // Office files and zips share the PK header; the extension picks which of them it is.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && OFFICE_BY_EXTENSION[extension]) {
    return { mime: OFFICE_BY_EXTENSION[extension], inline: false };
  }
  if (TEXT_BY_EXTENSION[extension] && looksLikeText(bytes)) {
    return { mime: TEXT_BY_EXTENSION[extension], inline: false };
  }
  return null;
}

/** A name that is safe to store and to put in a header: no paths, no control characters. */
export function cleanFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u001f\u007f"<>:*?|]/g, '')
    .trim()
    .replace(/^\.+/, '');
  return cleaned.slice(0, 200);
}
