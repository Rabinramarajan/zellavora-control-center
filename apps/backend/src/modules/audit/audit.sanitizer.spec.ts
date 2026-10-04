import { AuditSanitizer } from './audit.sanitizer';

describe('AuditSanitizer', () => {
  it('should deeply redact sensitive keys like passwords, tokens, and keys', () => {
    const raw = {
      username: 'john_doe',
      password: 'SuperSecretPassword123!',
      nested: {
        accessToken: 'eyJhbGciOi...',
        apiKey: 'sk-123456789',
        validField: 'AllowedValue',
      },
      list: [{ mfaSecret: 'XYZ123', name: 'Item 1' }],
    };

    const sanitized = AuditSanitizer.sanitize(raw);

    expect(sanitized.username).toBe('john_doe');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.nested.accessToken).toBe('[REDACTED]');
    expect(sanitized.nested.apiKey).toBe('[REDACTED]');
    expect(sanitized.nested.validField).toBe('AllowedValue');
    expect(sanitized.list[0].mfaSecret).toBe('[REDACTED]');
    expect(sanitized.list[0].name).toBe('Item 1');
  });

  it('should compute safe diff between before and after objects', () => {
    const before = {
      firstName: 'John',
      status: 'INACTIVE',
      password: 'oldPassword',
    };
    const after = {
      firstName: 'Jonathan',
      status: 'ACTIVE',
      password: 'newPassword',
    };

    const changes = AuditSanitizer.computeChanges(before, after);

    expect(changes.length).toBe(2);
    const firstNameChange = changes.find((c) => c.field === 'firstName');
    expect(firstNameChange).toEqual({
      field: 'firstName',
      previousValue: 'John',
      newValue: 'Jonathan',
    });

    const statusChange = changes.find((c) => c.field === 'status');
    expect(statusChange).toEqual({
      field: 'status',
      previousValue: 'INACTIVE',
      newValue: 'ACTIVE',
    });
  });

  it('should sanitize raw stack traces from safe error messages', () => {
    const rawErr = new Error('Database error connecting to postgres://user:secret@db.host:5432/main\n at Object.<anonymous>');
    const safe = AuditSanitizer.safeErrorMessage(rawErr);
    expect(safe.message).not.toContain('postgres://');
    expect(safe.message).not.toContain('secret@db.host');
    expect(safe.message).not.toContain('at Object');
  });
});
