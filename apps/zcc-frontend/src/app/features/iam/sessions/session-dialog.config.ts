import { FormDialogConfig } from '../../../shared/components/form-dialog';
import { SessionItem } from '../../../shared/models/iam-admin.model';
import { formatDateTime, relativeTime } from '../shared/iam-format';

const when = (iso: string) => `${formatDateTime(iso)} (${relativeTime(iso)})`;

/** Read-only session details shown in the common form dialog. */
export const sessionDialogConfig = (s: SessionItem): FormDialogConfig<never> => ({
  mode: 'view',
  title: { view: 'Session Details' },
  subtitle: { view: `${s.userName}${s.isCurrent ? ' · this device' : ''}` },
  value: {
    userName: s.userName,
    userEmail: s.userEmail ?? '',
    organizationName: s.organizationName ?? '',
    status: s.status,
    device: s.isMobile ? 'Mobile' : 'Desktop',
    browser: s.browser ?? 'Unknown browser',
    platform: s.platform ?? 'Unknown OS',
    ipAddress: s.ipAddress ?? '',
    createdAt: when(s.createdAt),
    lastActivityAt: when(s.lastActivityAt),
    expiresAt: formatDateTime(s.expiresAt),
    userAgent: s.userAgent ?? '',
  },
  sections: [
    {
      title: 'User',
      fields: [
        { key: 'userName', label: 'Name', type: 'text' },
        { key: 'userEmail', label: 'Email Address', type: 'email' },
        { key: 'organizationName', label: 'Organization', type: 'text' },
      ],
    },
    {
      title: 'Device',
      fields: [
        { key: 'device', label: 'Device Type', type: 'text' },
        { key: 'ipAddress', label: 'IP Address', type: 'text' },
        { key: 'browser', label: 'Browser', type: 'text' },
        { key: 'platform', label: 'Operating System', type: 'text' },
        { key: 'userAgent', label: 'User Agent', type: 'textarea', rows: 2 },
      ],
    },
    {
      title: 'Activity',
      fields: [
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          displayAs: 'status',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Signed out', value: 'signed_out' },
            { label: 'Expired', value: 'expired' },
          ],
        },
        { key: 'createdAt', label: 'Signed In', type: 'text' },
        { key: 'lastActivityAt', label: 'Last Active', type: 'text' },
        { key: 'expiresAt', label: 'Expires', type: 'text' },
      ],
    },
  ],
  // View-only: there is nothing to save.
  save: () => Promise.reject(new Error('Sessions are read-only.')),
});
