import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { toSheetError } from '../freelancer-sheets/sheets.api';
import { Paged } from '../freelancer-sheets/sheets.models';
import {
  FromMonthlySheetInput,
  ImportInvoiceInput,
  Invoice,
  InvoiceClient,
  InvoiceClientInput,
  InvoiceInput,
  InvoiceProfile,
  InvoiceProfileInput,
  InvoiceQuery,
} from './invoices.models';

interface Envelope<T> {
  success: boolean;
  data: T;
}

export type DownloadFormat = 'pdf' | 'docx';

const toParams = (query: object): HttpParams => {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
};

/** Save a blob response under the server's file name, or the fallback. */
export const saveBlob = (response: HttpResponse<Blob>, fallback: string): void => {
  const match = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') ?? '');
  if (!response.body) return;
  const url = URL.createObjectURL(response.body);
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: match?.[1] ?? fallback,
  });
  link.click();
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Typed access to /api/v1/invoices. Failures reject with a `SheetRequestError`. */
@Injectable({ providedIn: 'root' })
export class InvoicesApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/invoices';

  public getProfile(): Promise<InvoiceProfile | null> {
    return this.unwrap(this.http.get<Envelope<InvoiceProfile | null>>(`${this.base}/profile`));
  }

  public saveProfile(input: InvoiceProfileInput): Promise<InvoiceProfile> {
    return this.unwrap(this.http.put<Envelope<InvoiceProfile>>(`${this.base}/profile`, input));
  }

  public listClients(): Promise<InvoiceClient[]> {
    return this.unwrap(this.http.get<Envelope<InvoiceClient[]>>(`${this.base}/clients`));
  }

  public createClient(input: InvoiceClientInput): Promise<InvoiceClient> {
    return this.unwrap(this.http.post<Envelope<InvoiceClient>>(`${this.base}/clients`, input));
  }

  public updateClient(id: string, input: InvoiceClientInput): Promise<InvoiceClient> {
    return this.unwrap(this.http.put<Envelope<InvoiceClient>>(`${this.base}/clients/${id}`, input));
  }

  public deleteClient(id: string): Promise<{ id: string }> {
    return this.unwrap(this.http.delete<Envelope<{ id: string }>>(`${this.base}/clients/${id}`));
  }

  public list(query: InvoiceQuery): Promise<Paged<Invoice>> {
    return this.unwrap(
      this.http.get<Envelope<Paged<Invoice>>>(this.base, { params: toParams(query) })
    );
  }

  public get(id: string): Promise<Invoice> {
    return this.unwrap(this.http.get<Envelope<Invoice>>(`${this.base}/${id}`));
  }

  public create(input: InvoiceInput): Promise<Invoice> {
    return this.unwrap(this.http.post<Envelope<Invoice>>(this.base, input));
  }

  public update(id: string, input: InvoiceInput): Promise<Invoice> {
    return this.unwrap(this.http.put<Envelope<Invoice>>(`${this.base}/${id}`, input));
  }

  public delete(id: string): Promise<{ id: string }> {
    return this.unwrap(this.http.delete<Envelope<{ id: string }>>(`${this.base}/${id}`));
  }

  public fromMonthlySheet(sheetId: string, input: FromMonthlySheetInput): Promise<Invoice> {
    return this.unwrap(
      this.http.post<Envelope<Invoice>>(`${this.base}/from-monthly-sheet/${sheetId}`, input)
    );
  }

  public issue(id: string): Promise<Invoice> {
    return this.unwrap(this.http.post<Envelope<Invoice>>(`${this.base}/${id}/issue`, {}));
  }

  public importInvoice(input: ImportInvoiceInput): Promise<Invoice> {
    return this.unwrap(this.http.post<Envelope<Invoice>>(`${this.base}/import`, input));
  }

  public markPaid(id: string): Promise<Invoice> {
    return this.unwrap(this.http.post<Envelope<Invoice>>(`${this.base}/${id}/mark-paid`, {}));
  }

  public cancel(id: string, reason: string): Promise<Invoice> {
    return this.unwrap(this.http.post<Envelope<Invoice>>(`${this.base}/${id}/cancel`, { reason }));
  }

  public previewHtml(id: string): Promise<string> {
    return this.unwrap(
      this.http.get(`${this.base}/${id}/export`, {
        params: { format: 'html' },
        responseType: 'text',
      })
    );
  }

  public download(id: string, format: DownloadFormat): Promise<HttpResponse<Blob>> {
    return this.unwrap(
      this.http.get(`${this.base}/${id}/export`, {
        params: { format },
        responseType: 'blob',
        observe: 'response',
      })
    );
  }

  /** ZIP of PDFs; the server accepts up to 50 ids. */
  public bulkPdf(ids: string[]): Promise<HttpResponse<Blob>> {
    return this.unwrap(
      this.http.post(
        `${this.base}/export/bulk`,
        { ids },
        { responseType: 'blob', observe: 'response' }
      )
    );
  }

  public register(query: InvoiceQuery): Promise<HttpResponse<Blob>> {
    const filters: InvoiceQuery = { ...query, page: undefined, pageSize: undefined };
    return this.unwrap(
      this.http.get(`${this.base}/export/register`, {
        params: toParams({ ...filters, format: 'csv' }),
        responseType: 'blob',
        observe: 'response',
      })
    );
  }

  private async unwrap<T>(source: Observable<Envelope<T> | T>): Promise<T> {
    try {
      return await firstValueFrom(
        source.pipe(
          map((body) =>
            body !== null && typeof body === 'object' && 'success' in body && 'data' in body
              ? (body as Envelope<T>).data
              : (body as T)
          )
        )
      );
    } catch (error) {
      throw toSheetError(error);
    }
  }
}
