import { HttpErrorResponse } from '@angular/common/http';
import { toSheetError } from './sheets.api';

describe('toSheetError', () => {
  it('lifts the server validation fields out of a normalized error', () => {
    const original = new HttpErrorResponse({
      status: 400,
      error: {
        error: {
          message: 'hourlyRate: hourly rate is required for a work day',
          code: 'VALIDATION_ERROR',
          status: 400,
          fields: [{ path: 'hourlyRate', message: 'hourly rate is required for a work day' }],
        },
      },
    });

    const result = toSheetError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'hourlyRate: hourly rate is required for a work day',
      original,
    });

    expect(result.status).toBe(400);
    expect(result.fields).toEqual({ hourlyRate: 'hourly rate is required for a work day' });
    expect(result.details).toEqual({});
  });

  it('keeps extra detail such as the id of a conflicting sheet', () => {
    const original = new HttpErrorResponse({
      status: 409,
      error: { error: { message: 'exists', code: 'MONTHLY_SHEET_EXISTS', status: 409, id: 'm-1' } },
    });

    const result = toSheetError({
      status: 409,
      code: 'MONTHLY_SHEET_EXISTS',
      message: 'exists',
      original,
    });

    expect(result.details).toEqual({ id: 'm-1' });
  });

  it('falls back to a friendly message for anything else', () => {
    const result = toSheetError(undefined);
    expect(result.status).toBe(0);
    expect(result.message).toContain('try again');
    expect(result.fields).toEqual({});
  });
});
