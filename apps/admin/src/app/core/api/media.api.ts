import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { MediaFile } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class MediaApiService {
  private readonly apiData = inject(ApiDataService);

  getMediaFiles(params?: any): Observable<MediaFile[]> {
    return this.apiData.getData<MediaFile[]>('/media', params);
  }

  uploadFile(file: File, options?: any): Observable<MediaFile> {
    const formData = new FormData();
    formData.append('file', file);
    return this.apiData.postData<MediaFile>('/media/upload', formData, options);
  }

  deleteFile(id: string): Observable<void> {
    return this.apiData.deleteData<void>(`/media/${id}`);
  }
}
