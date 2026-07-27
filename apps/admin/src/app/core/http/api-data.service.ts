import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiOptions {
  hideErrorMethod?: boolean;
  hideFullSpinner?: boolean;
  hideJwt?: boolean;
  responseType?: 'json' | 'blob' | 'text' | 'arraybuffer';
  headers?: Record<string, string>;
}

@Injectable({
  providedIn: 'root',
})
export class ApiDataService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/v1';

  readonly defaultOptions: ApiOptions = {
    hideErrorMethod: false,
    hideFullSpinner: false,
    hideJwt: false,
    responseType: 'json',
  };

  private request(method: string, path: string, body?: any, params?: any, options?: ApiOptions): Observable<any> {
    const opts = this.setOptions(options || {});
    let headers = new HttpHeaders();
    
    if (opts.hideFullSpinner) {
      headers = headers.set('hideFullSpinner', 'true');
    }
    if (opts.hideJwt) {
      headers = headers.set('hideJwt', 'true');
    }
    if (opts.hideErrorMethod) {
      headers = headers.set('hideErrorMethod', 'true');
    }
    if (opts.headers) {
      Object.keys(opts.headers).forEach((key) => {
        headers = headers.set(key, opts.headers![key]);
      });
    }

    const responseType = opts.responseType ?? 'json';
    const observe = responseType === 'blob' ? 'response' : undefined;

    return this.http.request(method, this.url + (path.startsWith('/') ? path : '/' + path), {
      body,
      params,
      headers,
      responseType: responseType as any,
      observe: observe as any
    });
  }

  getData<T = any>(path: string, params?: any, options?: ApiOptions): Observable<T> {
    return this.request('GET', path, undefined, params, options);
  }

  postData<T = any>(path: string, body: any, options?: ApiOptions): Observable<T> {
    return this.request('POST', path, body, undefined, options);
  }

  putData<T = any>(path: string, body: any, options?: ApiOptions): Observable<T> {
    return this.request('PUT', path, body, undefined, options);
  }

  deleteData<T = any>(path: string, options?: ApiOptions): Observable<T> {
    return this.request('DELETE', path, undefined, undefined, options);
  }

  private setOptions(options: ApiOptions): ApiOptions {
    const merged = { ...options };
    for (const key of Object.keys(this.defaultOptions) as Array<keyof ApiOptions>) {
      if (merged[key] === undefined) {
        (merged as any)[key] = this.defaultOptions[key];
      }
    }
    return merged;
  }
}
