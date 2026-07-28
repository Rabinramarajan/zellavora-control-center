import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationRepository } from '@core/repositories/notification.repository';
import { NotificationTemplate } from '@shared/models';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent {
  readonly repository = inject(NotificationRepository);

  broadcastTitle = '';
  broadcastBody = '';
  channels = {
    in_app: true,
    email: false,
    push: false,
  };

  constructor() {
    this.repository.loadNotifications().subscribe();
    this.repository.loadTemplates().subscribe();
  }

  sendBroadcast() {
    if (!this.broadcastBody.trim()) {
      alert('Broadcast message body cannot be empty.');
      return;
    }

    const selectedChannels: string[] = [];
    if (this.channels.in_app) selectedChannels.push('in_app');
    if (this.channels.email) selectedChannels.push('email');
    if (this.channels.push) selectedChannels.push('push');

    this.repository.sendBroadcast({
      title: this.broadcastTitle || 'Global Announcement',
      body: this.broadcastBody,
      channels: selectedChannels,
    }).subscribe(() => {
      this.broadcastTitle = '';
      this.broadcastBody = '';
      alert('Broadcast dispatched successfully!');
    });
  }
}
