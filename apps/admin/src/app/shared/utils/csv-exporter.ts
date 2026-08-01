/** Client-side CSV export helper with proper escaping and download. */
export class CsvExporter {
  static export(
    filename: string,
    headers: string[],
    rows: Array<Array<string | number | null | undefined>>
  ): void {
    const escape = (value: string | number | null | undefined): string => {
      const str = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const lines = [headers.map(escape).join(',')];
    for (const row of rows) {
      lines.push(row.map(escape).join(','));
    }

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
