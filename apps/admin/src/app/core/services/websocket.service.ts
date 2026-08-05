import { Injectable, inject, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { environment } from '@shared/environments/environment';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: Date;
  id?: string;
}

export interface Notification extends WebSocketMessage {
  type: 'notification';
  data: {
    id: string;
    title: string;
    message: string;
    category: 'system' | 'user' | 'project' | 'team';
    severity?: 'info' | 'warning' | 'error' | 'success';
    link?: string;
    icon?: string;
    read: boolean;
    createdAt: Date;
  };
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  private isConnected = signal(false);
  private isConnecting = signal(false);

  private messageSubject = new Subject<WebSocketMessage>();
  private notificationSubject = new Subject<Notification>();
  private connectionSubject = new BehaviorSubject<boolean>(false);

  messages$ = this.messageSubject.asObservable();
  notifications$ = this.notificationSubject.asObservable();
  connected$ = this.connectionSubject.asObservable();

  readonly isConnected$ = this.isConnected.asReadonly();
  readonly isConnecting$ = this.isConnecting.asReadonly();

  constructor() {
    effect(() => {
      const token = this.authService.token();
      if (token && !this.isConnected()) {
        this.connect();
      }
    });
  }

  connect(): void {
    if (this.isConnected() || this.isConnecting()) {
      return;
    }

    this.isConnecting.set(true);
    const token = this.authService.token();

    if (!token) {
      this.isConnecting.set(false);
      return;
    }

    const wsUrl = this.getWebSocketUrl();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected.set(true);
        this.isConnecting.set(false);
        this.reconnectAttempts = 0;
        this.connectionSubject.next(true);
        this.sendMessage({ type: 'ping', data: {} });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;

          if (message.type === 'notification') {
            this.notificationSubject.next(message as Notification);
          }

          this.messageSubject.next(message);
        } catch {
          // Silently ignore parse errors
        }
      };

      this.ws.onerror = () => {
        this.isConnecting.set(false);
      };

      this.ws.onclose = () => {
        this.isConnected.set(false);
        this.connectionSubject.next(false);
        this.attemptReconnect();
      };
    } catch {
      this.isConnecting.set(false);
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected.set(false);
    this.connectionSubject.next(false);
  }

  sendMessage(message: WebSocketMessage): void {
    if (!this.isConnected() || !this.ws) {
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch {
      // Silently handle send errors
    }
  }

  acknowledge(notificationId: string): void {
    this.sendMessage({
      type: 'ack',
      data: { id: notificationId },
    });
  }

  subscribe(channel: string): void {
    this.sendMessage({
      type: 'subscribe',
      data: { channel },
    });
  }

  unsubscribe(channel: string): void {
    this.sendMessage({
      type: 'unsubscribe',
      data: { channel },
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    setTimeout(() => this.connect(), delay);
  }

  private getWebSocketUrl(): string {
    const token = this.authService.token();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = environment.apiUrl.replace(/^https?:\/\//, '');
    return `${protocol}//${host}/ws/notifications?token=${token}`;
  }

  // Notification helpers
  markAsRead(notificationId: string): void {
    this.sendMessage({
      type: 'mark-read',
      data: { id: notificationId },
    });
  }

  deleteNotification(notificationId: string): void {
    this.sendMessage({
      type: 'delete',
      data: { id: notificationId },
    });
  }

  clearAll(): void {
    this.sendMessage({
      type: 'clear-all',
      data: {},
    });
  }
}
