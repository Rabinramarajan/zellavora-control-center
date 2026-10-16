// Tests must not depend on a developer's .env.local: give them valid signing secrets up front.
process.env.JWT_SECRET ??= 'jest-access-secret-at-least-32-bytes-long';
process.env.REFRESH_TOKEN_SECRET ??= 'jest-refresh-secret-at-least-32-bytes-long';
