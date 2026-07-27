import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    ToastModule,
    CheckboxModule,
  ],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-3xl font-bold text-white">Settings</h1>
        <p class="text-slate-400 mt-1">Manage your application preferences and account settings.</p>
      </div>

      <!-- Settings Tabs -->
      <div class="flex gap-2 border-b border-white/10 overflow-x-auto pb-4">
        <button
          *ngFor="let tab of settingsTabs"
          (click)="activeTab = tab.id"
          [ngClass]="{
            'border-b-2 border-purple-500 text-purple-400': activeTab === tab.id,
            'text-slate-400 hover:text-slate-300': activeTab !== tab.id
          }"
          class="px-4 py-2 font-semibold text-sm transition whitespace-nowrap">
          {{ tab.icon }} {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div *ngIf="activeTab === 'general'" class="space-y-6">
        <!-- General Settings -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
          <h3 class="text-lg font-semibold text-white mb-6">General Settings</h3>

          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-semibold text-white mb-2">Site Title</label>
                <input pInputText type="text" placeholder="e.g., Zellavora Control Center" class="w-full" [(ngModel)]="generalSettings.siteTitle" />
              </div>

              <div>
                <label class="block text-sm font-semibold text-white mb-2">Site Description</label>
                <input pInputText type="text" placeholder="Your site description" class="w-full" [(ngModel)]="generalSettings.siteDescription" />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-semibold text-white mb-2">Timezone</label>
                <p-dropdown
                  [options]="timezoneOptions"
                  [(ngModel)]="generalSettings.timezone"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full">
                </p-dropdown>
              </div>

              <div>
                <label class="block text-sm font-semibold text-white mb-2">Date Format</label>
                <p-dropdown
                  [options]="dateFormatOptions"
                  [(ngModel)]="generalSettings.dateFormat"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full">
                </p-dropdown>
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold text-white mb-2">Maintenance Mode</label>
              <div class="flex items-center gap-3">
                <p-checkbox
                  [binary]="true"
                  [(ngModel)]="generalSettings.maintenanceMode">
                </p-checkbox>
                <span class="text-sm text-slate-400">{{ generalSettings.maintenanceMode ? 'Enabled' : 'Disabled' }}</span>
              </div>
              <p class="text-xs text-slate-500 mt-2">Temporarily disable access to your application</p>
            </div>

            <div class="flex justify-end">
              <button pButton pRipple label="Save Changes" class="p-button-primary" (click)="saveGeneralSettings()"></button>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="activeTab === 'profile'" class="space-y-6">
        <!-- Profile Settings -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
          <h3 class="text-lg font-semibold text-white mb-6">Profile Information</h3>

          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-semibold text-white mb-2">Full Name</label>
                <input pInputText type="text" placeholder="Your full name" class="w-full" [(ngModel)]="profileSettings.fullName" />
              </div>

              <div>
                <label class="block text-sm font-semibold text-white mb-2">Email Address</label>
                <input pInputText type="email" placeholder="your@email.com" class="w-full" [(ngModel)]="profileSettings.email" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold text-white mb-2">Bio</label>
              <textarea pInputTextarea rows="4" placeholder="Write a short bio..." class="w-full" [(ngModel)]="profileSettings.bio"></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-semibold text-white mb-2">Location</label>
                <input pInputText type="text" placeholder="City, Country" class="w-full" [(ngModel)]="profileSettings.location" />
              </div>

              <div>
                <label class="block text-sm font-semibold text-white mb-2">Phone Number</label>
                <input pInputText type="tel" placeholder="+1 (555) 000-0000" class="w-full" [(ngModel)]="profileSettings.phone" />
              </div>
            </div>

            <div class="flex justify-end">
              <button pButton pRipple label="Save Profile" class="p-button-primary" (click)="saveProfileSettings()"></button>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="activeTab === 'security'" class="space-y-6">
        <!-- Security Settings -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
          <h3 class="text-lg font-semibold text-white mb-6">Security Settings</h3>

          <div class="space-y-6">
            <!-- Password Section -->
            <div class="pb-6 border-b border-white/10">
              <h4 class="text-sm font-semibold text-white mb-4">Change Password</h4>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-semibold text-white mb-2">Current Password</label>
                  <input pInputText type="password" placeholder="Enter current password" class="w-full" />
                </div>
                <div>
                  <label class="block text-sm font-semibold text-white mb-2">New Password</label>
                  <input pInputText type="password" placeholder="Enter new password" class="w-full" />
                </div>
                <div>
                  <label class="block text-sm font-semibold text-white mb-2">Confirm Password</label>
                  <input pInputText type="password" placeholder="Confirm new password" class="w-full" />
                </div>
                <button pButton pRipple label="Update Password" class="p-button-primary"></button>
              </div>
            </div>

            <!-- Two-Factor Authentication -->
            <div class="pb-6 border-b border-white/10">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-semibold text-white">Two-Factor Authentication</h4>
                  <p class="text-xs text-slate-400 mt-1">Add an extra layer of security to your account</p>
                </div>
                <button pButton pRipple label="Enable 2FA" class="p-button-primary p-button-sm"></button>
              </div>
            </div>

            <!-- Active Sessions -->
            <div>
              <h4 class="text-sm font-semibold text-white mb-4">Active Sessions</h4>
              <div class="space-y-3">
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <p class="text-sm text-white font-medium">Chrome on Windows</p>
                    <p class="text-xs text-slate-400">Last active: 2 minutes ago</p>
                  </div>
                  <span class="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded">Current</span>
                </div>
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <p class="text-sm text-white font-medium">Safari on MacOS</p>
                    <p class="text-xs text-slate-400">Last active: 3 hours ago</p>
                  </div>
                  <button pButton pRipple icon="pi pi-times" class="p-button-rounded p-button-danger p-button-text p-button-sm"></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="activeTab === 'preferences'" class="space-y-6">
        <!-- User Preferences -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
          <h3 class="text-lg font-semibold text-white mb-6">Preferences</h3>

          <div class="space-y-6">
            <!-- Theme -->
            <div class="pb-6 border-b border-white/10">
              <h4 class="text-sm font-semibold text-white mb-4">Theme</h4>
              <div class="flex gap-4">
                <button
                  (click)="preferenceSettings.theme = 'dark'"
                  [ngClass]="{
                    'border-2 border-purple-500': preferenceSettings.theme === 'dark',
                    'border-2 border-white/10': preferenceSettings.theme !== 'dark'
                  }"
                  class="flex-1 p-4 rounded-lg transition">
                  <span class="text-lg mb-2 block">🌙</span>
                  <p class="text-sm font-semibold text-white">Dark</p>
                </button>
                <button
                  (click)="preferenceSettings.theme = 'light'"
                  [ngClass]="{
                    'border-2 border-purple-500': preferenceSettings.theme === 'light',
                    'border-2 border-white/10': preferenceSettings.theme !== 'light'
                  }"
                  class="flex-1 p-4 rounded-lg transition">
                  <span class="text-lg mb-2 block">☀️</span>
                  <p class="text-sm font-semibold text-white">Light</p>
                </button>
                <button
                  (click)="preferenceSettings.theme = 'auto'"
                  [ngClass]="{
                    'border-2 border-purple-500': preferenceSettings.theme === 'auto',
                    'border-2 border-white/10': preferenceSettings.theme !== 'auto'
                  }"
                  class="flex-1 p-4 rounded-lg transition">
                  <span class="text-lg mb-2 block">⚙️</span>
                  <p class="text-sm font-semibold text-white">Auto</p>
                </button>
              </div>
            </div>

            <!-- Notifications -->
            <div class="pb-6 border-b border-white/10">
              <h4 class="text-sm font-semibold text-white mb-4">Notifications</h4>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="text-sm text-slate-300">Email notifications</label>
                  <p-checkbox
                    [binary]="true"
                    [(ngModel)]="preferenceSettings.emailNotifications">
                  </p-checkbox>
                </div>
                <div class="flex items-center justify-between">
                  <label class="text-sm text-slate-300">Push notifications</label>
                  <p-checkbox
                    [binary]="true"
                    [(ngModel)]="preferenceSettings.pushNotifications">
                  </p-checkbox>
                </div>
                <div class="flex items-center justify-between">
                  <label class="text-sm text-slate-300">Weekly digest</label>
                  <p-checkbox
                    [binary]="true"
                    [(ngModel)]="preferenceSettings.weeklyDigest">
                  </p-checkbox>
                </div>
              </div>
            </div>

            <!-- Language -->
            <div>
              <label class="block text-sm font-semibold text-white mb-2">Language</label>
              <p-dropdown
                [options]="languageOptions"
                [(ngModel)]="preferenceSettings.language"
                optionLabel="label"
                optionValue="value"
                class="w-full md:w-48">
              </p-dropdown>
            </div>

            <div class="flex justify-end">
              <button pButton pRipple label="Save Preferences" class="p-button-primary" (click)="savePreferences()"></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class SettingsComponent implements OnInit {
  private messageService = inject(MessageService);

  activeTab = 'general';

  settingsTabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'preferences', label: 'Preferences', icon: '✨' },
  ];

  generalSettings = {
    siteTitle: 'Zellavora Control Center',
    siteDescription: 'Centralized platform to manage portfolio, projects, content, users and analytics.',
    timezone: 'GMT+5:30 Asia/Kolkata',
    dateFormat: 'MMM DD, YYYY',
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
    { label: 'GMT+5:30 Asia/Kolkata', value: 'GMT+5:30' },
    { label: 'GMT+0 UTC', value: 'GMT+0' },
    { label: 'GMT-5 EST', value: 'GMT-5' },
    { label: 'GMT+1 CET', value: 'GMT+1' },
  ];

  dateFormatOptions = [
    { label: 'MMM DD, YYYY', value: 'MMM DD, YYYY' },
    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  ];

  languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Tamil', value: 'ta' },
    { label: 'Spanish', value: 'es' },
  ];

  ngOnInit() {
    // Load settings
  }

  saveGeneralSettings() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'General settings saved successfully',
      life: 3000,
    });
  }

  saveProfileSettings() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'Profile settings saved successfully',
      life: 3000,
    });
  }

  savePreferences() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'Preferences saved successfully',
      life: 3000,
    });
  }
}
