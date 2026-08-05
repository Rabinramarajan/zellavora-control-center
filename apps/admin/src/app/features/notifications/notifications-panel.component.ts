import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationsStore, Notification } from './notifications.store';
import { WebSocketService } from '@core/services/websocket.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { NotificationSoundService } from './services/notification-sound.service';
import { DesktopNotificationService } from './services/desktop-notification.service';

@Component({
  selector: 'app-notifications-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatMenuModule,
    MatTabsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  template: `
    <!-- Notification Bell with Badge -->
    <button
      mat-icon-button
      [matMenuTriggerFor]="notificationMenu"
      class="relative"
      matTooltip="Notifications"
    >
      <mat-icon matBadge="{{ store.unreadCount() }}" matBadgeColor="warn">
        notifications
      </mat-icon>
    </button>

    <!-- Notifications Dropdown Menu -->
    <mat-menu #notificationMenu="matMenu" class="notification-panel">
      <div class="w-full max-w-md">
        <!-- Header Section -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold">Notifications</h3>
            <p class="text-xs text-gray-500">
              {{ store.unreadCount() }} unread
            </p>
          </div>
          <div class="flex gap-1">
            <button
              mat-icon-button
              matTooltip="Mark all as read"
              (click)="markAllAsRead()"
              *ngIf="store.unreadCount() > 0"
              class="text-sm"
            >
              <mat-icon>done_all</mat-icon>
            </button>
            <button
              mat-icon-button
              matTooltip="Clear all"
              (click)="clearAll()"
              class="text-sm"
            >
              <mat-icon>delete_sweep</mat-icon>
            </button>
          </div>
        </div>

        <!-- Tab Navigation -->
        <mat-tab-group (selectedIndexChange)="onTabChange($event)">
          <mat-tab>
            <ng-template mat-tab-label>
              <span class="flex items-center gap-2">
                <mat-icon class="text-sm">inbox</mat-icon>
                All ({{ store.items().length }})
              </span>
            </ng-template>
          </mat-tab>
          <mat-tab>
            <ng-template mat-tab-label>
              <span class="flex items-center gap-2">
                <mat-icon class="text-sm">mail</mat-icon>
                Unread
                <mat-chip class="bg-blue-100 text-blue-800 text-xs h-6">
                  {{ store.unreadCount() }}
                </mat-chip>
              </span>
            </ng-template>
          </mat-tab>
        </mat-tab-group>

        <!-- Notifications List -->
        <div class="max-h-96 overflow-y-auto bg-gray-50 dark:bg-slate-900/50">
          <!-- Loading State -->
          <div
            *ngIf="store.isLoading()"
            class="flex justify-center items-center py-12"
          >
            <mat-spinner diameter="32"></mat-spinner>
          </div>

          <!-- Error State -->
          <div
            *ngIf="store.error() && !store.isLoading()"
            class="p-4 mx-2 my-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-200 text-sm"
          >
            <mat-icon class="inline text-sm mr-1">error</mat-icon>
            {{ store.error() }}
          </div>

          <!-- Empty State -->
          <div
            *ngIf="!store.isLoading() && !store.error() && store.filteredItems().length === 0"
            class="text-center py-12 text-gray-500"
          >
            <mat-icon class="text-5xl mb-2 opacity-30">notifications_none</mat-icon>
            <p class="text-sm">No notifications</p>
          </div>

          <!-- Notification Items -->
          <ng-container *ngFor="let notif of store.filteredItems()">
            <div
              class="px-4 py-3 border-b border-gray-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              [class.bg-blue-50]="!notif.read"
              [class.dark:bg-blue-900/20]="!notif.read"
            >
              <div class="flex gap-3">
                <!-- Icon Badge -->
                <div
                  class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  [class]="getSeverityClass(notif.severity)"
                >
                  <mat-icon class="text-sm">
                    {{ notif.icon || getCategoryIcon(notif.category) }}
                  </mat-icon>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1">
                      <h4
                        class="font-medium text-sm truncate"
                        [class.font-semibold]="!notif.read"
                      >
                        {{ notif.title }}
                      </h4>
                      <p class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {{ notif.message }}
                      </p>
                      <div class="flex items-center gap-2 mt-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                          {{ formatTime(notif.createdAt) }}
                        </span>
                        <mat-chip
                          class="text-xs h-auto py-0.5"
                          [class]="getCategoryClass(notif.category)"
                        >
                          {{ notif.category }}
                        </mat-chip>
                      </div>
                    </div>

                    <!-- Actions Menu -->
                    <div class="flex gap-0.5 flex-shrink-0">
                      <button
                        mat-icon-button
                        [matTooltip]="notif.read ? 'Mark as unread' : 'Mark as read'"
                        (click)="toggleRead(notif)"
                        class="text-sm"
                      >
                        <mat-icon class="text-sm">
                          {{ notif.read ? 'mail_outline' : 'mail' }}
                        </mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        matTooltip="Delete"
                        (click)="deleteNotification(notif)"
                        class="text-sm"
                      >
                        <mat-icon class="text-sm">close</mat-icon>
                      </button>
                    </div>
                  </div>

                  <!-- Action Link -->
                  <button
                    *ngIf="notif.link"
                    mat-button
                    color="primary"
                    size="small"
                    class="text-xs mt-2 h-auto py-0"
                    (click)="openLink(notif.link)"
                  >
                    View
                    <mat-icon class="text-sm">arrow_forward</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </ng-container>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <button mat-button color="primary" class="w-full text-sm">
            <mat-icon class="mr-2">history</mat-icon>
            View All Notifications
          </button>
        </div>
      </div>
    </mat-menu>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }

      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      ::ng-deep {
        .notification-panel {
          .mdc-menu__content {
            padding: 0 !important;
            max-width: none !important;
          }
        }
      }
    `,
  ],
})
export class NotificationsPanelComponent implements OnInit, OnDestroy {
  readonly store = inject(NotificationsStore);
  private wsService = inject(WebSocketService);
  private soundService = inject(NotificationSoundService);
  private desktopService = inject(DesktopNotificationService);

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.store.loadNotifications();
    this.subscribeToWebSocket();
    this.requestDesktopPermission();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private subscribeToWebSocket(): void {
    const notificationSub = this.wsService.notifications$.subscribe((message) => {
      const data = message.data;
      this.store.addNotification({
        title: data.title,
        message: data.message,
        category: data.category,
        severity: data.severity || 'info',
        link: data.link,
        icon: data.icon,
        read: false,
      });

      // Play sound notification
      this.soundService.play(data.severity || 'info');

      // Show desktop notification
      this.desktopService.show({
        title: data.title,
        message: data.message,
        icon: data.icon,
      });
    });

    this.subscriptions.push(notificationSub);
  }

  private requestDesktopPermission(): void {
    this.desktopService.requestPermission();
  }

  onTabChange(index: number): void {
    this.store.setFilter(index === 0 ? 'all' : 'unread');
  }

  toggleRead(notif: Notification): void {
    this.store.markAsRead(notif.id);
  }

  markAllAsRead(): void {
    this.store.markAllAsRead();
  }

  deleteNotification(notif: Notification): void {
    this.store.deleteNotification(notif.id);
  }

  clearAll(): void {
    if (confirm('Clear all notifications?')) {
      this.store.clearAll();
    }
  }

  openLink(link: string): void {
    window.open(link, '_blank');
  }

  getSeverityClass(severity: string): string {
    const classes: Record<string, string> = {
      success: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200',
      warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-200',
      error: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200',
      info: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200',
    };
    return classes[severity] || classes['info'];
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      system: 'settings',
      user: 'person',
      project: 'folder',
      team: 'group',
    };
    return icons[category] || 'notifications';
  }

  getCategoryClass(category: string): string {
    const classes: Record<string, string> = {
      system: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      user: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      project: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      team: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return classes[category] || classes['system'];
  }

  formatTime(date: Date): string {
    const now = new Date();
    const notifDate = new Date(date);
    const diff = now.getTime() - notifDate.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return notifDate.toLocaleDateString();
  }
}
