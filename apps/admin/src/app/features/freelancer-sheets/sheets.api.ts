import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import {
  DailySheet,
  DailySheetInput,
  DailySheetQuery,
  MonthlyDocument,
  MonthlySheet,
  MonthlySheetQuery,
  Paged,
  ProjectOption,
  SheetRequestError,
} from './sheets.models';

interface Envelope<T> {
  success: boolean;
  data: T;
}

const toParams = (query: object): HttpParams => {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
};

/** Keys of the server's error body that are not extra detail. */
const ENVELOPE_KEYS = new Set(['message', 'code', 'status', 'fields']);

/**
 * Reduce whatever a failed request threw to something a page can show.
 * The global error interceptor hands back `{ status, code, message, original }`;
 * the server's field-level validation messages live on the original response.
 */
export const toSheetError = (error: unknown): SheetRequestError => {
  const normalized = error as {
    status?: number;
    code?: string;
    message?: string;
    original?: { error?: { error?: Record<string, unknown> } };
  };
  const body = normalized?.original?.error?.error ?? {};
  const fieldList = Array.isArray(body['fields'])
    ? (body['fields'] as Array<{ path: string; message: string }>)
    : [];

  const details = Object.fromEntries(
    Object.entries(body).filter(([key]) => !ENVELOPE_KEYS.has(key))
  );

  return {
    status: normalized?.status ?? 0,
    code: normalized?.code ?? 'UNKNOWN',
    message: normalized?.message || 'Something went wrong. Please try again.',
    fields: Object.fromEntries(fieldList.map((field) => [field.path, field.message])),
    details,
  };
};

/** Typed access to the daily and monthly sheet endpoints. */
@Injectable({ providedIn: 'root' })
export class SheetsApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  public listDaily(query: DailySheetQuery): Promise<Paged<DailySheet>> {
    return this.unwrap(
      this.http.get<Envelope<Paged<DailySheet>>>(`${this.base}/daily-sheets`, {
        params: toParams(query),
      })
    );
  }

  public getDaily(id: string): Promise<DailySheet> {
    return this.unwrap(this.http.get<Envelope<DailySheet>>(`${this.base}/daily-sheets/${id}`));
  }

  public createDaily(input: DailySheetInput): Promise<DailySheet> {
    return this.unwrap(this.http.post<Envelope<DailySheet>>(`${this.base}/daily-sheets`, input));
  }

  public updateDaily(id: string, input: Partial<DailySheetInput>): Promise<DailySheet> {
    return this.unwrap(
      this.http.put<Envelope<DailySheet>>(`${this.base}/daily-sheets/${id}`, input)
    );
  }

  public submitDaily(id: string): Promise<DailySheet> {
    return this.unwrap(
      this.http.post<Envelope<DailySheet>>(`${this.base}/daily-sheets/${id}/submit`, {})
    );
  }

  public reviewDaily(id: string, approved: boolean, rejectionReason?: string): Promise<DailySheet> {
    return this.unwrap(
      this.http.post<Envelope<DailySheet>>(`${this.base}/daily-sheets/${id}/approve`, {
        approved,
        rejectionReason,
      })
    );
  }

  public deleteDaily(id: string): Promise<{ id: string }> {
    return this.unwrap(
      this.http.delete<Envelope<{ id: string }>>(`${this.base}/daily-sheets/${id}`)
    );
  }

  public projectOptions(): Promise<ProjectOption[]> {
    return this.unwrap(
      this.http.get<Envelope<ProjectOption[]>>(`${this.base}/daily-sheets/projects`)
    );
  }

  public listMonthly(query: MonthlySheetQuery): Promise<Paged<MonthlySheet>> {
    return this.unwrap(
      this.http.get<Envelope<Paged<MonthlySheet>>>(`${this.base}/monthly-sheets`, {
        params: toParams(query),
      })
    );
  }

  /** The printable timesheet for a month; `userId` is for reviewers. */
  public monthlyDocument(month: number, year: number, userId?: string): Promise<MonthlyDocument> {
    return this.unwrap(
      this.http.get<Envelope<MonthlyDocument>>(`${this.base}/monthly-sheets/document`, {
        params: toParams({ month, year, userId }),
      })
    );
  }

  public generateMonthly(month: number, year: number): Promise<MonthlySheet> {
    return this.unwrap(
      this.http.post<Envelope<MonthlySheet>>(`${this.base}/monthly-sheets`, { month, year })
    );
  }

  public regenerateMonthly(id: string): Promise<MonthlySheet> {
    return this.unwrap(
      this.http.put<Envelope<MonthlySheet>>(`${this.base}/monthly-sheets/${id}`, {})
    );
  }

  public submitMonthly(id: string): Promise<MonthlySheet> {
    return this.unwrap(
      this.http.post<Envelope<MonthlySheet>>(`${this.base}/monthly-sheets/${id}/submit`, {})
    );
  }

  public reviewMonthly(
    id: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<MonthlySheet> {
    return this.unwrap(
      this.http.post<Envelope<MonthlySheet>>(`${this.base}/monthly-sheets/${id}/approve`, {
        approved,
        rejectionReason,
      })
    );
  }

  public markMonthlyPaid(id: string): Promise<MonthlySheet> {
    return this.unwrap(
      this.http.post<Envelope<MonthlySheet>>(`${this.base}/monthly-sheets/${id}/mark-paid`, {})
    );
  }

  public deleteMonthly(id: string): Promise<{ id: string }> {
    return this.unwrap(
      this.http.delete<Envelope<{ id: string }>>(`${this.base}/monthly-sheets/${id}`)
    );
  }

  private async unwrap<T>(request: Observable<Envelope<T>>): Promise<T> {
    try {
      return await firstValueFrom(request.pipe(map((response) => response.data)));
    } catch (error) {
      throw toSheetError(error);
    }
  }
}
