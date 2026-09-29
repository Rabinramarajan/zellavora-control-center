export interface NotificationMessage {
  id: string;
  title: string | null;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  key: string;
  name: string;
  subject: string | null;
  body: string;
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  createdAt: string;
}
