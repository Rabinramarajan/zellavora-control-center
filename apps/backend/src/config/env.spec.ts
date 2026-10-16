import { collectConfigErrors } from './env';

describe('collectConfigErrors signing secrets', () => {
  const saved = { jwt: process.env.JWT_SECRET, refresh: process.env.REFRESH_TOKEN_SECRET };
  const good = 'x'.repeat(40);

  afterEach(() => {
    process.env.JWT_SECRET = saved.jwt;
    process.env.REFRESH_TOKEN_SECRET = saved.refresh;
    if (saved.jwt === undefined) delete process.env.JWT_SECRET;
    if (saved.refresh === undefined) delete process.env.REFRESH_TOKEN_SECRET;
  });

  it('is quiet about secrets that are long enough', () => {
    process.env.JWT_SECRET = good;
    process.env.REFRESH_TOKEN_SECRET = good + 'y';
    expect(collectConfigErrors().filter((e) => /SECRET/.test(e))).toEqual([]);
  });

  it('flags a missing secret', () => {
    delete process.env.JWT_SECRET;
    process.env.REFRESH_TOKEN_SECRET = good;
    expect(collectConfigErrors()).toContain('Missing required environment variable: JWT_SECRET');
  });

  it.each(['short', 'dev-secret-change-in-production', 'dev-refresh-secret'])(
    'flags the weak secret %p',
    (weak) => {
      process.env.JWT_SECRET = good;
      process.env.REFRESH_TOKEN_SECRET = weak;
      expect(collectConfigErrors().join('\n')).toMatch(
        /REFRESH_TOKEN_SECRET must be at least 32 bytes/
      );
    }
  );
});
