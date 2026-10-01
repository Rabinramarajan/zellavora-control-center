import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormInputControl } from '@zellavoras/ui';
import { AppDialogService } from '../../shared/components/dialog';
import { NotificationRepository } from '../../core/repositories/notification.repository';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, FormInputControl],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent {
  readonly repository = inject(NotificationRepository);
  private readonly dialog = inject(AppDialogService);

  readonly broadcastTitle = signal('');
  readonly broadcastBody = signal('');
  readonly inAppChannel = signal(true);
  readonly emailChannel = signal(false);
  readonly pushChannel = signal(false);

  constructor() {
    void firstValueFrom(this.repository.loadNotifications());
    void firstValueFrom(this.repository.loadTemplates());
  }

  async sendBroadcast() {
    if (!this.broadcastBody().trim()) {
      this.dialog.alert({
        title: 'Message required',
        message: 'Broadcast message body cannot be empty.',
        variant: 'warning',
      });
      return;
    }

    const selectedChannels: string[] = [];
    if (this.inAppChannel()) selectedChannels.push('in_app');
    if (this.emailChannel()) selectedChannels.push('email');
    if (this.pushChannel()) selectedChannels.push('push');

    await firstValueFrom(
      this.repository.sendBroadcast({
        title: this.broadcastTitle() || 'Global Announcement',
        body: this.broadcastBody(),
        channels: selectedChannels,
      })
    );
    this.broadcastTitle.set('');
    this.broadcastBody.set('');
    this.dialog.alert({ title: 'Broadcast sent', message: 'Broadcast dispatched successfully.' });
  }
}
