import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { ApiIntegrationService } from '@core/services/api-integration.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    ToastModule,
    CheckboxModule,
  ],
  providers: [MessageService],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  private messageService = inject(MessageService);
  private apiService = inject(ApiIntegrationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  activeTab = 'general';

  settingsTabs = [
    { id: 'general', label: 'General', desc: 'Basic application settings', icon: '⚙️' },
    { id: 'profile', label: 'Profile', desc: 'Personal information', icon: '👤' },
    { id: 'security', label: 'Security', desc: 'Password & authentication', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', desc: 'Email & system alerts', icon: '🔔' },
    { id: 'appearance', label: 'Appearance', desc: 'Theme & display settings', icon: '🎨' },
    { id: 'localization', label: 'Localization', desc: 'Language & timezone', icon: '🌐' },
    { id: 'integrations', label: 'Integrations', desc: 'Third-party services', icon: '🔌' },
    { id: 'storage', label: 'Storage', desc: 'Media & file settings', icon: '📁' },
    { id: 'backup', label: 'Backup & Restore', desc: 'Data backup preferences', icon: '💾' },
    { id: 'advanced', label: 'Advanced', desc: 'Developer & system settings', icon: '🛠️' },
  ];

  generalSettings = {
    siteTitle: 'Zellavora Control Center',
    siteDescription: 'Centralized platform to manage portfolio, projects, content, and analytics.',
    timezone: 'GMT+5:30',
    dateFormat: 'MMM DD, YYYY',
    itemsPerPage: 10,
    maintenanceMode: false,
  };

  profileSettings = {
    fullName: 'Rabin R',
    email: 'rabin@zellavora.com',
    bio: 'Frontend Angular Consultant with 4+ years of experience building scalable, accessible and high-performance web applications.',
    location: 'Chennai, Tamil Nadu, India',
    phone: '+91 8765432109',
  };

  preferenceSettings = {
    theme: 'dark',
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: true,
    language: 'en',
  };

  timezoneOptions = [
    { label: '(GMT+05:30) Asia/Kolkata', value: 'GMT+5:30' },
    { label: '(GMT+00:00) UTC', value: 'GMT+0' },
    { label: '(GMT-05:00) EST', value: 'GMT-5' },
    { label: '(GMT+01:00) CET', value: 'GMT+1' },
  ];

  dateFormatOptions = [
    { label: 'May 24, 2025 (MMM DD, YYYY)', value: 'MMM DD, YYYY' },
    { label: '24/05/2025 (DD/MM/YYYY)', value: 'DD/MM/YYYY' },
    { label: '2025-05-24 (YYYY-MM-DD)', value: 'YYYY-MM-DD' },
  ];

  itemsPerPageOptions = [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
  ];

  languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Tamil', value: 'ta' },
    { label: 'Spanish', value: 'es' },
  ];

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const tab = params.get('tab');
      if (tab) {
        this.activeTab = tab;
      }
    });
    this.loadAllSettings();
  }

  selectTab(tabId: string) {
    this.router.navigate(['/settings', tabId]);
  }

  loadAllSettings() {
    this.apiService.getSettings().subscribe({
      next: (response) => {
        if (response && response.data) {
          const data = response.data;
          if (data.general) {
            this.generalSettings = { ...this.generalSettings, ...data.general };
          }
          if (data.profile) {
            this.profileSettings = { ...this.profileSettings, ...data.profile };
          }
          if (data.preferences) {
            this.preferenceSettings = { ...this.preferenceSettings, ...data.preferences };
          }
        }
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load settings',
          life: 3000
        });
      }
    });
  }

  saveGeneralSettings() {
    this.apiService.updateSettings('general', this.generalSettings).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'General settings saved successfully',
          life: 3000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save general settings',
          life: 3000,
        });
      }
    });
  }

  saveProfileSettings() {
    this.apiService.updateSettings('profile', this.profileSettings).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Profile settings saved successfully',
          life: 3000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save profile settings',
          life: 3000,
        });
      }
    });
  }

  savePreferences() {
    this.apiService.updateSettings('preferences', this.preferenceSettings).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Preferences saved successfully',
          life: 3000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save preferences',
          life: 3000,
        });
      }
    });
  }
}
