import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';

export interface DdlItem {
  type: string;
  key: string;
  value: string;
  label?: string | null;
  phoneCode?: string | null;
  extra?: Record<string, unknown> | null;
  sortOrder: number;
}

export interface DdlResponse {
  success: boolean;
  data: Record<string, DdlItem[]>;
}

@Injectable({ providedIn: 'root' })
export class DdlApiService {
  private readonly apiData = inject(ApiDataService);

  getAll(): Observable<DdlResponse> {
    return this.apiData.getData<DdlResponse>('/clean/ddls');
  }
}
