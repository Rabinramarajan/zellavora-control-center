import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-services-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    ToastModule,
  ],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white">Services Section</h1>
          <p class="text-slate-400 mt-1">Manage the services you offer on your portfolio.</p>
        </div>
        <div class="flex items-center gap-3">
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
        <!-- Services List -->
        <div class="lg:col-span-2">
          <!-- Section Header -->
          <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6 mb-6">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <span class="text-xl">⚙️</span> Section Settings
            </h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-semibold text-white mb-2">Section Title <span class="text-red-400">*</span></label>
                <input
                  pInputText
                  type="text"
                  placeholder="e.g., What I Do"
                  class="w-full"
                  [(ngModel)]="sectionTitle"
                />
              </div>

              <div>
                <label class="block text-sm font-semibold text-white mb-2">Section Description</label>
                <textarea
                  pInputTextarea
                  rows="3"
                  placeholder="Describe the services you offer..."
                  class="w-full"
                  [(ngModel)]="sectionDescription">
                </textarea>
              </div>
            </div>
          </div>

          <!-- Services List -->
          <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                <span class="text-xl">📋</span> Services ({{ services.length }})
              </h3>
              <button
                pButton
                pRipple
                icon="pi pi-plus"
                class="p-button-rounded p-button-primary"
                (click)="addService()">
              </button>
            </div>

            <div class="space-y-4">
              <div *ngFor="let service of services; let i = index" class="border border-white/10 rounded-xl p-4 space-y-4">
                <div class="flex items-start justify-between">
                  <div class="text-2xl cursor-pointer" (click)="selectIcon(i)">{{ service.icon }}</div>
                  <button
                    pButton
                    pRipple
                    icon="pi pi-trash"
                    class="p-button-rounded p-button-danger p-button-text"
                    (click)="removeService(i)">
                  </button>
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">Service Title</label>
                    <input
                      pInputText
                      type="text"
                      placeholder="e.g., Web Development"
                      class="w-full"
                      [(ngModel)]="service.title"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                    <textarea
                      pInputTextarea
                      rows="2"
                      placeholder="Describe this service..."
                      class="w-full"
                      [(ngModel)]="service.description">
                    </textarea>
                  </div>
                </div>
              </div>
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
              <div class="p-6 space-y-6">
                <div>
                  <h2 class="text-2xl font-bold text-white mb-2">{{ sectionTitle || 'What I Do' }}</h2>
                  <p class="text-xs text-slate-400">{{ sectionDescription || 'Section description...' }}</p>
                </div>

                <!-- Services Grid Preview -->
                <div class="grid grid-cols-2 gap-3">
                  <div *ngFor="let service of services.slice(0, 4)" class="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div class="text-2xl mb-2">{{ service.icon }}</div>
                    <p class="text-xs font-semibold text-white truncate">{{ service.title || 'Service' }}</p>
                  </div>
                </div>

                <!-- Stats -->
                <div class="pt-4 border-t border-white/10 text-center">
                  <p class="text-[10px] text-slate-400">
                    {{ services.length }} services listed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Icon Selector Modal (simulated) -->
      <div *ngIf="showIconSelector" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4">
          <h3 class="text-lg font-semibold text-white mb-4">Select Icon</h3>
          <div class="grid grid-cols-4 gap-3">
            <button
              *ngFor="let icon of iconOptions"
              (click)="selectIconEmoji(icon)"
              class="p-3 rounded-lg border border-white/10 hover:border-purple-500 transition text-2xl">
              {{ icon }}
            </button>
          </div>
          <button
            pButton
            pRipple
            label="Cancel"
            class="p-button-text w-full mt-4"
            (click)="showIconSelector = false">
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class ServicesSectionComponent implements OnInit {
  private messageService = inject(MessageService);

  sectionTitle = 'What I Do';
  sectionDescription = 'Delivering solutions that help businesses grow and succeed.';
  showIconSelector = false;
  selectedServiceIndex = -1;

  iconOptions = [
    '💻', '🎨', '📱', '🔧', '⚡', '🚀', '📊', '🔒',
    '🌐', '📈', '🎯', '💡', '🛠️', '🎭', '📚', '✨',
  ];

  services: Service[] = [
    {
      id: '1',
      title: 'Web Development',
      description: 'Building modern, responsive and high-performance web applications.',
      icon: '💻',
    },
    {
      id: '2',
      title: 'UI/UX Design',
      description: 'Crafting user-centered designs that are intuitive and engaging.',
      icon: '🎨',
    },
    {
      id: '3',
      title: 'Frontend Development',
      description: 'Creating fast, scalable and interactive frontend solutions.',
      icon: '⚡',
    },
    {
      id: '4',
      title: 'Performance Optimization',
      description: 'Improving speed, SEO and overall performance for better results.',
      icon: '🚀',
    },
    {
      id: '5',
      title: 'Maintenance & Support',
      description: 'Providing ongoing support and maintenance for your projects.',
      icon: '🔧',
    },
  ];

  ngOnInit() {
    // Load from service if needed
  }

  addService() {
    this.services.push({
      id: Date.now().toString(),
      title: '',
      description: '',
      icon: '💡',
    });
  }

  removeService(index: number) {
    this.services.splice(index, 1);
  }

  selectIcon(index: number) {
    this.selectedServiceIndex = index;
    this.showIconSelector = true;
  }

  selectIconEmoji(emoji: string) {
    if (this.selectedServiceIndex >= 0) {
      this.services[this.selectedServiceIndex].icon = emoji;
    }
    this.showIconSelector = false;
    this.selectedServiceIndex = -1;
  }

  saveChanges() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'Services section changes saved successfully',
      life: 3000,
    });
  }
}
