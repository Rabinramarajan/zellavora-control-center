import { Injectable, signal } from '@angular/core';

export interface DesktopNotificationOptions {
  title: string;
  message: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  badge?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DesktopNotificationService {
  private notificationsEnabled = signal(false);
  private activeNotifications = new Map<string, Notification>();

  constructor() {
    this.checkPermission();
  }

  private checkPermission(): void {
    if (!this.isSupported()) {
      console.warn('Notifications API not supported');
      return;
    }

    if (Notification.permission === 'granted') {
      this.notificationsEnabled.set(true);
    } else if (Notification.permission !== 'denied') {
      this.notificationsEnabled.set(false);
    }
  }

  requestPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isSupported()) {
        console.warn('Notifications API not supported');
        resolve(false);
        return;
      }

      if (Notification.permission === 'granted') {
        this.notificationsEnabled.set(true);
        resolve(true);
        return;
      }

      if (Notification.permission !== 'denied') {
        Notification.requestPermission()
          .then((permission) => {
            const granted = permission === 'granted';
            this.notificationsEnabled.set(granted);
            resolve(granted);
          })
          .catch(() => {
            this.notificationsEnabled.set(false);
            resolve(false);
          });
      } else {
        this.notificationsEnabled.set(false);
        resolve(false);
      }
    });
  }

  show(options: DesktopNotificationOptions): void {
    if (!this.notificationsEnabled() || !this.isSupported()) {
      return;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.message,
        icon: options.icon || this.getDefaultIcon(),
        badge: options.badge || this.getDefaultBadge(),
        tag: options.tag || 'default',
        requireInteraction: options.requireInteraction || false,
      });

      const notificationId = options.tag || Date.now().toString();
      this.activeNotifications.set(notificationId, notification);

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
        this.activeNotifications.delete(notificationId);
      }, 5000);

      // Handle click
      notification.onclick = () => {
        window.focus();
        notification.close();
        this.activeNotifications.delete(notificationId);
      };

      // Handle close
      notification.onclose = () => {
        this.activeNotifications.delete(notificationId);
      };

      // Handle error
      notification.onerror = () => {
        console.error('Desktop notification error');
        this.activeNotifications.delete(notificationId);
      };
    } catch (error) {
      console.error('Failed to show desktop notification', error);
    }
  }

  showSuccess(title: string, message: string): void {
    this.show({
      title,
      message,
      icon: '✅',
    });
  }

  showError(title: string, message: string): void {
    this.show({
      title,
      message,
      icon: '❌',
    });
  }

  showWarning(title: string, message: string): void {
    this.show({
      title,
      message,
      icon: '⚠️',
    });
  }

  showInfo(title: string, message: string): void {
    this.show({
      title,
      message,
      icon: 'ℹ️',
    });
  }

  closeAll(): void {
    this.activeNotifications.forEach((notification) => {
      notification.close();
    });
    this.activeNotifications.clear();
  }

  closeNotification(tag: string): void {
    const notification = this.activeNotifications.get(tag);
    if (notification) {
      notification.close();
      this.activeNotifications.delete(tag);
    }
  }

  isEnabled(): boolean {
    return this.notificationsEnabled();
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }

  hasPermission(): boolean {
    if (!this.isSupported()) return false;
    return Notification.permission === 'granted';
  }

  private getDefaultIcon(): string {
    return '/assets/logo.png';
  }

  private getDefaultBadge(): string {
    return '/assets/badge.png';
  }

  getNotificationCount(): number {
    return this.activeNotifications.size;
  }
}
