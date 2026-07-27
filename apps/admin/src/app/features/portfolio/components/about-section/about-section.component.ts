import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FileUploadModule } from 'primeng/fileupload';

@Component({
  selector: 'app-about-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    ToastModule,
    FileUploadModule,
  ],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white">About Section Placeholder</h1>
          <p class="text-slate-400 mt-1">Manage your about section content and appearance on your portfolio.</p>
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
          <!-- Image Section -->
          <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <span class="text-xl">🖼️</span> Image / Avatar
            </h3>

            <div class="space-y-4">
              <div class="aspect-square rounded-2xl bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-white/10 flex items-center justify-center overflow-hidden">
                <img *ngIf="aboutData.imageUrl" [src]="aboutData.imageUrl" alt="Profile" class="w-full h-full object-cover" />
                <span *ngIf="!aboutData.imageUrl" class="text-4xl">👤</span>
              </div>

              <div class="text-center">
                <button pButton pRipple label="Change Image" icon="pi pi-upload" class="p-button-outlined"></button>
                <p class="text-xs text-slate-400 mt-2">Recommended: 600x600px, JPG or PNG</p>
              </div>

              <div class="flex gap-2">
                <button pButton pRipple label="Center" class="p-button-text flex-1" [icon]="'pi pi-arrow-up'" title="Center position"></button>
                <button pButton pRipple label="Left" class="p-button-text flex-1" [icon]="'pi pi-arrow-left'" title="Left position"></button>
                <button pButton pRipple label="Right" class="p-button-text flex-1" [icon]="'pi pi-arrow-right'" title="Right position"></button>
              </div>
            </div>
          </div>

          <!-- Content Section -->
          <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6 space-y-6">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2">
              <span class="text-xl">✏️</span> Content
            </h3>

            <!-- Section Title -->
            <div>
              <label class="block text-sm font-semibold text-white mb-2">Section Title <span class="text-red-400">*</span></label>
              <input
                pInputText
                type="text"
                placeholder="e.g., About Me"
                class="w-full"
                [(ngModel)]="aboutData.sectionTitle"
              />
              <span class="text-xs text-slate-400 mt-1 block">{{ aboutData.sectionTitle.length || 0 }}/50</span>
            </div>

            <!-- Subtitle -->
            <div>
              <label class="block text-sm font-semibold text-white mb-2">Subtitle</label>
              <input
                pInputText
                type="text"
                placeholder="e.g., Get to know more about me"
                class="w-full"
                [(ngModel)]="aboutData.subtitle"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-semibold text-white mb-2">Description <span class="text-red-400">*</span></label>
              <textarea
                pInputTextarea
                rows="6"
                placeholder="Write a compelling description about yourself..."
                class="w-full"
                [(ngModel)]="aboutData.description">
              </textarea>
              <span class="text-xs text-slate-400 mt-1 block">{{ aboutData.description.length || 0 }}/500</span>
            </div>

            <!-- Highlights -->
            <div>
              <label class="block text-sm font-semibold text-white mb-2">Key Highlights</label>
              <div class="space-y-2">
                <input
                  *ngFor="let highlight of aboutData.highlights; let i = index"
                  pInputText
                  type="text"
                  [value]="highlight"
                  (ngModelChange)="updateHighlight(i, $event)"
                  placeholder="e.g., Clean Code & Best Practices"
                  class="w-full"
                />
              </div>
              <button pButton pRipple label="+ Add Highlight" class="p-button-text mt-3" (click)="addHighlight()"></button>
            </div>
          </div>

          <!-- Layout Options -->
          <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <span class="text-xl">📐</span> Layout Style
            </h3>

            <div class="grid grid-cols-2 gap-4">
              <button
                *ngFor="let layout of layoutOptions"
                (click)="aboutData.layoutStyle = layout.value"
                [ngClass]="{
                  'border-2 border-purple-500': aboutData.layoutStyle === layout.value,
                  'border-2 border-white/10': aboutData.layoutStyle !== layout.value
                }"
                class="p-4 rounded-lg text-center transition hover:border-purple-500 cursor-pointer">
                <div class="text-3xl mb-2">{{ layout.icon }}</div>
                <p class="text-sm font-semibold text-white">{{ layout.label }}</p>
              </button>
            </div>
          </div>
        </div>

        <!-- Live Preview -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6 sticky top-6">
          <h3 class="text-lg font-semibold text-white flex items-center gap-2 mb-6">
            <span class="text-xl">👁️</span> Live Preview
          </h3>

          <div class="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-2xl p-4 border border-white/10">
            <div class="bg-[#03020c] rounded-lg overflow-hidden">
              <!-- Preview Content -->
              <div class="p-6 space-y-4">
                <h2 class="text-2xl font-bold text-white">{{ aboutData.sectionTitle || 'About Me' }}</h2>
                <p class="text-sm text-purple-400">{{ aboutData.subtitle || 'Subtitle' }}</p>

                <!-- Preview Image -->
                <div class="aspect-square rounded-lg bg-white/5 flex items-center justify-center">
                  <span class="text-4xl">👤</span>
                </div>

                <!-- Preview Description -->
                <p class="text-xs text-slate-300 line-clamp-4">{{ aboutData.description || 'Your description will appear here...' }}</p>

                <!-- Preview Highlights -->
                <div class="pt-2 space-y-2">
                  <div *ngFor="let h of aboutData.highlights.slice(0, 3)" class="text-[10px] text-slate-400 flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span> {{ h }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Status -->
          <div class="mt-6 pt-6 border-t border-white/10 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">Status</span>
              <span class="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded">
                Draft
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class AboutSectionComponent implements OnInit {
  private messageService = inject(MessageService);

  showPreview = false;

  layoutOptions = [
    { label: 'Classic', value: 'classic', icon: '📄' },
    { label: 'Card', value: 'card', icon: '🎴' },
    { label: 'Split', value: 'split', icon: '↔️' },
    { label: 'Minimal', value: 'minimal', icon: '⚙️' },
  ];

  aboutData = {
    sectionTitle: 'About Me',
    subtitle: 'Get to know more about me',
    description: 'I\'m a passionate frontend developer who loves building modern, responsive and user-friendly web applications. I specialize in Angular, TypeScript and creating exceptional digital experiences.',
    imageUrl: '',
    layoutStyle: 'classic',
    highlights: [
      'Clean Code & Best Practices',
      'Performance Focused',
      'User Experience Driven',
    ],
  };

  ngOnInit() {
    // Load from service if needed
  }

  addHighlight() {
    this.aboutData.highlights.push('');
  }

  updateHighlight(index: number, value: any) {
    this.aboutData.highlights[index] = value;
  }

  saveChanges() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'About section changes saved successfully',
      life: 3000,
    });
  }
}
