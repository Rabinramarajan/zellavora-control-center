import { SelectControlOption } from '@zellavoras/ui';

export type SettingsIconName =
  | 'cog'
  | 'user'
  | 'lock'
  | 'bell'
  | 'palette'
  | 'globe'
  | 'plug'
  | 'folder'
  | 'database'
  | 'wrench'
  | 'document'
  | 'image'
  | 'clock'
  | 'calendar'
  | 'list'
  | 'bolt'
  | 'shield'
  | 'check'
  | 'arrow-right'
  | 'mail'
  | 'map-pin'
  | 'phone';

export type SettingsTabId =
  | 'general'
  | 'profile'
  | 'notifications'
  | 'email'
  | 'registration'
  | 'appearance'
  | 'localization'
  | 'integrations'
  | 'storage'
  | 'backup'
  | 'advanced';

export interface SettingsTab {
  id: SettingsTabId;
  label: string;
  description: string;
  icon: SettingsIconName;
}

export interface GeneralSettings {
  siteTitle: string;
  siteDescription: string;
  timezone: string;
  dateFormat: string;
  itemsPerPage: number;
  maintenanceMode: boolean;
}

export interface ProfileSettings {
  fullName: string;
  email: string;
  bio: string;
  location: string;
  phone: string;
}

export interface SystemInfoItem {
  label: string;
  value: string;
}

export const SETTINGS_TABS: readonly SettingsTab[] = [
  { id: 'general', label: 'General', description: 'Basic application settings', icon: 'cog' },
  { id: 'profile', label: 'Profile', description: 'Personal information', icon: 'user' },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email & system alerts',
    icon: 'bell',
  },
  {
    id: 'email',
    label: 'Email delivery',
    description: 'SMTP & provider settings',
    icon: 'mail',
  },
  {
    id: 'registration',
    label: 'Registration',
    description: 'Self-registration and approval policy',
    icon: 'shield',
  },
  { id: 'appearance', label: 'Appearance', description: 'Theme & display', icon: 'palette' },
  { id: 'localization', label: 'Localization', description: 'Language & timezone', icon: 'globe' },
  { id: 'integrations', label: 'Integrations', description: 'Third-party services', icon: 'plug' },
  { id: 'storage', label: 'Storage', description: 'Media & file settings', icon: 'folder' },
  {
    id: 'backup',
    label: 'Backup & Restore',
    description: 'Data backup preferences',
    icon: 'database',
  },
  { id: 'advanced', label: 'Advanced', description: 'Developer & system', icon: 'wrench' },
];

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  siteTitle: 'Zellavora Control Center',
  siteDescription: 'Centralized platform to manage portfolio, projects, content, and analytics.',
  timezone: 'GMT+5:30',
  dateFormat: 'MMM DD, YYYY',
  itemsPerPage: 10,
  maintenanceMode: false,
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  fullName: '',
  email: '',
  bio: '',
  location: '',
  phone: '',
};

export const SITE_DESCRIPTION_MAX_LENGTH = 160;

export const AVATAR_ACCEPTED_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];
export const AVATAR_MAX_UPLOAD_MB = 5;
export const AVATAR_OUTPUT_SIZE_PX = 256;

export const TIMEZONE_OPTIONS: SelectControlOption[] = [
  { label: '(GMT+05:30) Asia/Kolkata', value: 'GMT+5:30' },
  { label: '(GMT+00:00) UTC', value: 'GMT+0' },
  { label: '(GMT-05:00) EST', value: 'GMT-5' },
  { label: '(GMT+01:00) CET', value: 'GMT+1' },
];

export const DATE_FORMAT_OPTIONS: SelectControlOption[] = [
  { label: 'May 24, 2025 (MMM DD, YYYY)', value: 'MMM DD, YYYY' },
  { label: '24/05/2025 (DD/MM/YYYY)', value: 'DD/MM/YYYY' },
  { label: '2025-05-24 (YYYY-MM-DD)', value: 'YYYY-MM-DD' },
];

export const ITEMS_PER_PAGE_OPTIONS: SelectControlOption[] = [
  { label: '10', value: '10' },
  { label: '25', value: '25' },
  { label: '50', value: '50' },
];
