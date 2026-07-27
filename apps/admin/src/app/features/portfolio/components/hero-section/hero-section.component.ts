import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    ToastModule,
  ],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white">Hero Section Placeholder</h1>
          <p class="text-slate-400 mt-1">Manage your hero section content and appearance. This is the first thing visitors see.</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            pButton
            pRipple
            label="Preview"
            icon="pi pi-eye"
            class="p-button-outlined p-button-secondary"
            (click)="showPreview = !showPreview">
          </button>
          <button
            pButton
            pRipple
            label="Save Changes"
            icon="pi pi-save"
            class="p-button-primary"
            (click)="saveChanges()">
          </button>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Content Editor -->
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6 space-y-6">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2">
              <span class="text-xl">✏️</span> Content
            </h3>

            <!-- Main Heading -->
            <div>
              <label class="block text-sm font-semibold text-white mb-2">Main Heading <span class="text-red-400">*</span></label>
              <input
                pInputText
                type="text"
                placeholder="e.g., Hi, I'm Rabin R"
                class="w-full"
                [(ngModel)]="heroData.mainHeading"
              />
              <span class="text-xs text-slate-400 mt-1 block">{{ heroData.mainHeading.length || 0 }}/50</span>
            </div>

            <!-- Sub Heading -->
            <div>
              <label class="block text-sm font-semibold text-white mb-2">Title / Role <span class="text-red-400">*</span></label>
              <input
                pInputText
                type="text"
                placeholder="e.g., Frontend Angular Consultant"
                class="w-full"
                [(ngModel)]="heroData.subHeading"
              />
              <span class="text-xs text-slate-400 mt-1 block">{{ heroData.subHeading.length || 0 }}/80</span>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-semibold text-white mb-2">Description</label>
              <textarea
                pInputTextarea
                rows="4"
                placeholder="I build modern web applications with Angular, TypeScript and cutting-edge technologies. Focused on performance, accessibility and exceptional user experiences."
                class="w-full"
                [(ngModel)]="heroData.description">
              </textarea>
              <span class="text-xs text-slate-400 mt-1 block">{{ heroData.description.length || 0 }}/500</span>
            </div>

            <!-- Availability Status -->
            <div>
              <label class="block text-sm font-semibold text-white mb-2">Availability Status</label>
              <p-dropdown
                [options]="statusOptions"
                optionLabel="label"
                optionValue="value"
                [(ngModel)]="heroData.availabilityStatus"
                placeholder="Select status"
                class="w-full">
              </p-dropdown>
            </div>
          </div>

          <!-- Buttons/CTA -->
          <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <span class="text-xl">🔘</span> Buttons
            </h3>

            <div class="space-y-4">
              <!-- Primary Button -->
              <div>
                <label class="block text-sm font-semibold text-white mb-2">Primary Button Text</label>
                <input
                  pInputText
                  type="text"
                  placeholder="e.g., View My Work"
                  class="w-full"
                  [(ngModel)]="heroData.primaryButtonText"
                />
                <input
                  pInputText
                  type="text"
                  placeholder="Link URL"
                  class="w-full mt-2"
                  [(ngModel)]="heroData.primaryButtonLink"
                />
              </div>

              <!-- Secondary Button -->
              <div>
                <label class="block text-sm font-semibold text-white mb-2">Secondary Button Text</label>
                <input
                  pInputText
                  type="text"
                  placeholder="e.g., Download CV"
                  class="w-full"
                  [(ngModel)]="heroData.secondaryButtonText"
                />
                <input
                  pInputText
                  type="text"
                  placeholder="Link URL"
                  class="w-full mt-2"
                  [(ngModel)]="heroData.secondaryButtonLink"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Live Preview -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6 sticky top-6">
          <h3 class="text-lg font-semibold text-white flex items-center gap-2 mb-6">
            <span class="text-xl">👁️</span> Live Preview
          </h3>

          <!-- Mobile Preview Frame -->
          <div class="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-2xl p-4 border border-white/10">
            <div class="bg-[#03020c] rounded-lg overflow-hidden aspect-video flex flex-col items-center justify-center text-center p-4">
              <div class="space-y-3">
                <p class="text-xs text-slate-400">{{ heroData.availabilityStatus }}</p>
                <h2 class="text-xl font-bold text-white break-words">{{ heroData.mainHeading || 'Your Main Heading' }}</h2>
                <p class="text-sm text-slate-300">{{ heroData.subHeading || 'Your Role' }}</p>
                <p class="text-xs text-slate-400 line-clamp-3">{{ heroData.description || 'Your description...' }}</p>
                <div class="flex gap-2 justify-center pt-2">
                  <button class="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded">
                    {{ heroData.primaryButtonText || 'View Work' }}
                  </button>
                  <button class="px-3 py-1.5 border border-white/20 text-white text-xs font-semibold rounded">
                    {{ heroData.secondaryButtonText || 'Download' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="mt-6 pt-6 border-t border-white/10 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">Status</span>
              <span class="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded">
                Draft
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">Last saved</span>
              <span class="text-xs text-white">2 mins ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class HeroSectionComponent implements OnInit {
  private messageService = inject(MessageService);

  showPreview = false;
  statusOptions = [
    { label: '🟢 Available for work', value: 'Available for work' },
    { label: '🟡 Available for freelance', value: 'Available for freelance' },
    { label: '🔴 Not available', value: 'Not available' },
  ];

  heroData = {
    mainHeading: 'Hi, I\'m Rabin R',
    subHeading: 'Frontend Angular Consultant',
    description: 'I build modern web applications with Angular, TypeScript and cutting-edge technologies. Focused on performance, accessibility and exceptional user experiences.',
    availabilityStatus: 'Available for work',
    primaryButtonText: 'View My Work',
    primaryButtonLink: '/projects',
    secondaryButtonText: 'Download CV',
    secondaryButtonLink: '/resume.pdf',
  };

  ngOnInit() {
    // Load from service if needed
  }

  saveChanges() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'Hero section changes saved successfully',
      life: 3000,
    });
  }
}
