import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { WebSocketService } from '../../core/services/websocket.service';

export interface Notification {
  id: string;
  title: string;
  message: string;
  category: 'system' | 'user' | 'project' | 'team';
  severity: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  link?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationsState {
  items: Notification[];
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  filter: 'all' | 'unread';
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsStore {
  private ws = inject(WebSocketService);

  private state = signal<NotificationsState>({
    items: [],
    isLoading: false,
    error: null,
    unreadCount: 0,
    filter: 'all',
  });

  constructor() {
    this.setupWebSocketListener();
  }

  private setupWebSocketListener(): void {
    this.ws.notifications$.subscribe((wsNotification) => {
      const notification: Notification = {
        id: wsNotification.data.id,
        title: wsNotification.data.title,
        message: wsNotification.data.message,
        category: wsNotification.data.category,
        severity: wsNotification.data.severity || 'info',
        read: wsNotification.data.read,
        link: wsNotification.data.link,
        icon: wsNotification.data.icon,
        createdAt: new Date(wsNotification.data.createdAt),
        updatedAt: new Date(wsNotification.data.createdAt),
      };
      this.addNotification(notification);
    });
  }

  // Public signals
  items = computed(() => this.state().items);
  isLoading = computed(() => this.state().isLoading);
  error = computed(() => this.state().error);
  filter = computed(() => this.state().filter);

  // Computed derived values
  filteredItems = computed(() => {
    const allItems = this.items();
    if (this.filter() === 'unread') {
      return allItems.filter((n) => !n.read);
    }
    return allItems;
  });

  unreadCount = computed(() =>
    this.items().filter((n) => !n.read).length
  );

  categoryCounts = computed(() => ({
    system: this.items().filter((n) => n.category === 'system').length,
    user: this.items().filter((n) => n.category === 'user').length,
    project: this.items().filter((n) => n.category === 'project').length,
    team: this.items().filter((n) => n.category === 'team').length,
  }));

  loadNotifications(): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.state.update((s) => ({ ...s, isLoading: false }));
  }

  addNotification(notification: Notification | Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): void {
    const newNotification: Notification = 'id' in notification
      ? notification
      : {
          ...notification,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
    this.state.update((s) => ({
      ...s,
      items: [newNotification, ...s.items],
    }));
  }

  markAsRead(id: string): void {
    this.state.update((s) => ({
      ...s,
      items: s.items.map((n) =>
        n.id === id ? { ...n, read: true, updatedAt: new Date() } : n
      ),
    }));
  }

  markAllAsRead(): void {
    this.state.update((s) => ({
      ...s,
      items: s.items.map((n) => ({ ...n, read: true, updatedAt: new Date() })),
    }));
  }

  deleteNotification(id: string): void {
    this.state.update((s) => ({
      ...s,
      items: s.items.filter((n) => n.id !== id),
    }));
  }

  clearAll(): void {
    this.state.update((s) => ({
      ...s,
      items: [],
    }));
  }

  setFilter(filter: 'all' | 'unread'): void {
    this.state.update((s) => ({ ...s, filter }));
  }

  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }
}
