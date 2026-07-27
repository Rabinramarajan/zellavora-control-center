/**
 * Message API Service - Handles message and email communication endpoints
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

import {
  MessageSendRequest,
  MessageSendResult,
  EmailSendRequest,
  EmailSendResult,
} from '../models/admin.models';

@Injectable({
  providedIn: 'root',
})
export class MessageApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/admin';

  async sendMessage(request: MessageSendRequest): Promise<MessageSendResult> {
    return lastValueFrom(
      this.http.post<MessageSendResult>(`${this.baseUrl}/message/send`, request)
    );
  }

  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    return lastValueFrom(
      this.http.post<EmailSendResult>(`${this.baseUrl}/email/send`, request)
    );
  }
}
