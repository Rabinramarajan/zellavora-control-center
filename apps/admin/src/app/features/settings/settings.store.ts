import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type FontSize = 'small' | 'normal' | 'large';
export type NotificationChannel = 'email' | 'push' | 'in-app';

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  channels: NotificationChannel[];
  digestFrequency: 'instant' | 'daily' | 'weekly';
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface ThemeSettings {
  mode: ThemeMode;
  accentColor: string;
  fontSize: FontSize;
  compactMode: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number; // in minutes
  rememberDevice: boolean;
}

export interface OrganizationSettings {
  name: string;
  logo: string;
  timezone: string;
  language: string;
  dateFormat: string;
  currency: string;
}

export interface Settings {
  organization: OrganizationSettings;
  notifications: NotificationSettings;
  theme: ThemeSettings;
  security: SecuritySettings;
  updatedAt: Date;
}

const DEFAULT_SETTINGS: Settings = {
  organization: {
    name: 'Organization',
    logo: '',
    timezone: 'UTC',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    channels: ['email', 'push', 'in-app'],
    digestFrequency: 'instant',
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  },
  theme: {
    mode: 'auto',
    accentColor: '#2563EB',
    fontSize: 'normal',
    compactMode: false,
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeout: 30,
    rememberDevice: false,
  },
  updatedAt: new Date(),
};

@Injectable({
  providedIn: 'root',
})
export class SettingsStore {
  private settings = signal<Settings>(DEFAULT_SETTINGS);
  private isLoading = signal(false);
  private error = signal<string | null>(null);

  // Public signals
  readonly organizationSettings = computed(() => this.settings().organization);
  readonly notificationSettings = computed(() => this.settings().notifications);
  readonly themeSettings = computed(() => this.settings().theme);
  readonly securitySettings = computed(() => this.settings().security);
  readonly allSettings = computed(() => this.settings());
  readonly isLoading$ = computed(() => this.isLoading());
  readonly error$ = computed(() => this.error());

  // Theme helpers
  readonly currentTheme = computed(() => {
    const mode = this.themeSettings().mode;
    if (mode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return mode;
  });

  readonly isDarkMode = computed(() => this.currentTheme() === 'dark');

  constructor() {
    this.loadSettingsFromStorage();
  }

  // Organization Settings
  updateOrganization(data: Partial<OrganizationSettings>): void {
    this.settings.update((s) => ({
      ...s,
      organization: { ...s.organization, ...data },
      updatedAt: new Date(),
    }));
    this.saveSettings();
  }

  // Notification Settings
  updateNotificationSettings(data: Partial<NotificationSettings>): void {
    this.settings.update((s) => ({
      ...s,
      notifications: { ...s.notifications, ...data },
      updatedAt: new Date(),
    }));
    this.saveSettings();
  }

  setEmailNotifications(enabled: boolean): void {
    this.updateNotificationSettings({ emailNotifications: enabled });
  }

  setPushNotifications(enabled: boolean): void {
    this.updateNotificationSettings({ pushNotifications: enabled });
  }

  setInAppNotifications(enabled: boolean): void {
    this.updateNotificationSettings({ inAppNotifications: enabled });
  }

  setNotificationChannels(channels: NotificationChannel[]): void {
    this.updateNotificationSettings({ channels });
  }

  setDigestFrequency(frequency: 'instant' | 'daily' | 'weekly'): void {
    this.updateNotificationSettings({ digestFrequency: frequency });
  }

  setQuietHours(enabled: boolean, start?: string, end?: string): void {
    this.updateNotificationSettings({
      quietHours: {
        enabled,
        start: start || this.notificationSettings().quietHours.start,
        end: end || this.notificationSettings().quietHours.end,
      },
    });
  }

  // Theme Settings
  updateTheme(data: Partial<ThemeSettings>): void {
    this.settings.update((s) => ({
      ...s,
      theme: { ...s.theme, ...data },
      updatedAt: new Date(),
    }));
    this.applyTheme();
    this.saveSettings();
  }

  setThemeMode(mode: ThemeMode): void {
    this.updateTheme({ mode });
  }

  setAccentColor(color: string): void {
    this.updateTheme({ accentColor: color });
  }

  setFontSize(size: FontSize): void {
    this.updateTheme({ fontSize: size });
  }

  setCompactMode(enabled: boolean): void {
    this.updateTheme({ compactMode: enabled });
  }

  // Security Settings
  updateSecurity(data: Partial<SecuritySettings>): void {
    this.settings.update((s) => ({
      ...s,
      security: { ...s.security, ...data },
      updatedAt: new Date(),
    }));
    this.saveSettings();
  }

  setSessionTimeout(minutes: number): void {
    this.updateSecurity({ sessionTimeout: minutes });
  }

  setTwoFactorEnabled(enabled: boolean): void {
    this.updateSecurity({ twoFactorEnabled: enabled });
  }

  // Persistence
  private saveSettings(): void {
    localStorage.setItem('zcc-settings', JSON.stringify(this.settings()));
  }

  private loadSettingsFromStorage(): void {
    const stored = localStorage.getItem('zcc-settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Settings;
        this.settings.set(parsed);
        this.applyTheme();
      } catch {
        // Use default settings if storage is corrupted
      }
    }
  }

  private applyTheme(): void {
    const theme = this.themeSettings();
    const currentTheme = this.currentTheme();

    // Apply theme to DOM
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.documentElement.style.setProperty(
      '--accent-color',
      theme.accentColor
    );

    // Apply font size
    document.documentElement.style.setProperty(
      '--font-size-base',
      this.getFontSizeValue(theme.fontSize)
    );

    // Apply compact mode
    if (theme.compactMode) {
      document.documentElement.classList.add('compact-mode');
    } else {
      document.documentElement.classList.remove('compact-mode');
    }
  }

  private getFontSizeValue(size: FontSize): string {
    const sizes: Record<FontSize, string> = {
      small: '14px',
      normal: '16px',
      large: '18px',
    };
    return sizes[size];
  }

  resetToDefaults(): void {
    this.settings.set(DEFAULT_SETTINGS);
    this.applyTheme();
    this.saveSettings();
  }
}
