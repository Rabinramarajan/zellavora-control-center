import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { loginDecryptMiddleware } from './login-decrypt';

describe('loginDecryptMiddleware', () => {
  it('maps the field-based encrypted payload to the auth login contract', () => {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const encrypt = (value: string) => {
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      return Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString('base64');
    };
    const req = {
      path: '/api/v1/auth/login',
      method: 'POST',
      body: {
        clientCode: 'DB',
        userLoginId: encrypt('admin@example.com'),
        password: encrypt('secret'),
        tokenkeys: [key.toString('binary'), iv.toString('binary')],
      },
    } as Request;
    const next = jest.fn() as NextFunction;

    loginDecryptMiddleware(req, {} as Response, next);

    expect(req.body).toEqual({
      clientCode: 'DB',
      email: 'admin@example.com',
      password: 'secret',
      rememberMe: false,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
