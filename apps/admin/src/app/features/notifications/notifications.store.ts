import { Injectable, signal, computed } from '@angular/core';

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
  private state = signal<NotificationsState>({
    items: [],
    isLoading: false,
    error: null,
    unreadCount: 0,
    filter: 'all',
  });

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

  // Methods
  loadNotifications(): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    // TODO: Connect to WebSocket service
    // Stub data for now
    setTimeout(() => {
      this.state.update((s) => ({
        ...s,
        items: [
          {
            id: '1',
            title: 'Project Created',
            message: 'Your project "Website Redesign" has been created',
            category: 'project',
            severity: 'success',
            read: false,
            icon: 'check_circle',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '2',
            title: 'Team Invitation',
            message: 'You were invited to join "Marketing Team"',
            category: 'team',
            severity: 'info',
            read: false,
            icon: 'people',
            createdAt: new Date(Date.now() - 3600000),
            updatedAt: new Date(Date.now() - 3600000),
          },
        ],
        unreadCount: 2,
        isLoading: false,
      }));
    }, 500);
  }

  addNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): void {
    const newNotification: Notification = {
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
