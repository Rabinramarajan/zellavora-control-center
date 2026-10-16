import { cleanFileName, detectFile } from './pm.files';

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(8),
]);

describe('detectFile', () => {
  it('trusts the bytes, not the name', () => {
    expect(detectFile(png, 'photo.exe')).toEqual({ mime: 'image/png', inline: true });
    expect(detectFile(Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 'report.pdf')).toBeNull();
  });

  it('detects a pdf and keeps it inline', () => {
    expect(detectFile(Buffer.from('%PDF-1.7 x'), 'a.pdf')?.inline).toBe(true);
  });

  it('refuses scriptable formats', () => {
    expect(detectFile(Buffer.from('<svg onload="x()"/>'), 'a.svg')).toBeNull();
    expect(detectFile(Buffer.from('<script>1</script>'), 'a.html')).toBeNull();
  });

  it('serves text as a download, never inline', () => {
    expect(detectFile(Buffer.from('<script>1</script>'), 'a.txt')?.inline).toBe(false);
  });

  it('accepts office files by header and extension, as download only', () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
    expect(detectFile(zip, 'a.docx')?.inline).toBe(false);
    expect(detectFile(zip, 'a.exe')).toBeNull();
  });

  it('refuses binary data named as text', () => {
    expect(detectFile(Buffer.from([0, 1, 2, 3]), 'a.txt')).toBeNull();
    expect(detectFile(Buffer.from([0xff, 0xfe, 0xfd]), 'a.csv')).toBeNull();
  });
});

describe('cleanFileName', () => {
  it('drops paths, control characters and leading dots', () => {
    expect(cleanFileName('..\\..\\evil/.hidden\u0000.txt')).toBe('hidden.txt');
    expect(cleanFileName('a"<b>.pdf')).toBe('ab.pdf');
  });

  it('limits the length', () => {
    expect(cleanFileName('x'.repeat(300)).length).toBe(200);
  });
});
