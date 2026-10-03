import { parseContent, slugify } from './blog-editor.component';

describe('blog editor helpers', () => {
  it('slugifies titles', () => {
    expect(slugify('Angular 22 Signals: The Future!')).toBe('angular-22-signals-the-future');
    expect(slugify('Café & Crème')).toBe('cafe-creme');
  });

  it('parses headings, lists, quotes and paragraphs', () => {
    const blocks = parseContent(
      '## Intro\nFirst line\nsecond line\n\n- one\n- two\n\n> quoted\n### Sub'
    );
    expect(blocks).toEqual([
      { kind: 'h2', text: 'Intro' },
      { kind: 'p', text: 'First line second line' },
      { kind: 'list', items: ['one', 'two'] },
      { kind: 'quote', text: 'quoted' },
      { kind: 'h3', text: 'Sub' },
    ]);
  });

  it('keeps markup as plain text', () => {
    expect(parseContent('<script>alert(1)</script>')).toEqual([
      { kind: 'p', text: '<script>alert(1)</script>' },
    ]);
  });
});
