import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeBuilderRepository } from '@core/repositories/theme-builder.repository';

@Component({
  selector: 'app-theme-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Theme Builder</h2>
        <p class="text-slate-600 dark:text-slate-400 mt-1">Configure global branding styles, logos, and typography live.</p>
      </div>

      <div class="grid lg:grid-cols-12 gap-8">
        <!-- Control Panel (6 cols) -->
        <div class="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-6 shadow-sm">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">Style Settings</h3>

          <!-- Color Customizer -->
          <div class="space-y-4">
            <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Color Palette</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Primary Color</label>
                <div class="flex gap-2 items-center">
                  <input type="color" [(ngModel)]="primaryColor" (change)="applyChange()" class="w-10 h-10 rounded border border-slate-200 cursor-pointer" />
                  <input type="text" [(ngModel)]="primaryColor" (change)="applyChange()" class="flex-1 min-w-0 px-3 py-2 border rounded-lg dark:bg-slate-700 text-sm text-slate-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Secondary Color</label>
                <div class="flex gap-2 items-center">
                  <input type="color" [(ngModel)]="secondaryColor" (change)="applyChange()" class="w-10 h-10 rounded border border-slate-200 cursor-pointer" />
                  <input type="text" [(ngModel)]="secondaryColor" (change)="applyChange()" class="flex-1 min-w-0 px-3 py-2 border rounded-lg dark:bg-slate-700 text-sm text-slate-900 dark:text-white" />
                </div>
              </div>
            </div>
          </div>

          <!-- Typography -->
          <div class="space-y-4">
            <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Typography</h4>
            <div>
              <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Font Family</label>
              <select [(ngModel)]="fontFamily" (change)="applyChange()" class="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 text-sm text-slate-900 dark:text-white">
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Outfit">Outfit</option>
                <option value="Montserrat">Montserrat</option>
              </select>
            </div>
          </div>

          <!-- Layout Settings -->
          <div class="space-y-4">
            <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Layout Options</h4>
            <div>
              <label class="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-1">
                <span>Border Radius</span>
                <span class="font-mono text-xs">{{ borderRadius }}px</span>
              </label>
              <input type="range" min="0" max="24" [(ngModel)]="borderRadius" (input)="applyChange()" class="w-full" />
            </div>

            <div>
              <label class="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-1">
                <span>Spacing Multiplier</span>
                <span class="font-mono text-xs">{{ spacing }}px</span>
              </label>
              <input type="range" min="2" max="12" [(ngModel)]="spacing" (input)="applyChange()" class="w-full" />
            </div>
          </div>

          <!-- Save Button -->
          <div class="pt-4 border-t border-slate-200 dark:border-slate-700">
            <button (click)="saveTheme()" class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Save Branding Configuration
            </button>
          </div>
        </div>

        <!-- Live Design System Preview (7 cols) -->
        <div class="lg:col-span-7 bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-6">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">Branding Live Preview</h3>

          <!-- Theme Variables Testbed -->
          <div class="space-y-6 p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" [style.--primary]="primaryColor" [style.--secondary]="secondaryColor" [style.font-family]="fontFamily" [style.border-radius.px]="borderRadius">
            
            <!-- Cards & Spacing -->
            <div class="p-6 border border-slate-100 dark:border-slate-700 shadow-sm" [style.padding.px]="spacing * 4" [style.border-radius.px]="borderRadius">
              <h4 class="text-lg font-bold mb-2">Interactive Components</h4>
              <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">
                This preview element dynamically changes styling based on the active border-radius, spacing multipliers, and primary/secondary colors.
              </p>

              <!-- Buttons -->
              <div class="flex gap-4">
                <button class="px-4 py-2 text-white font-medium text-sm transition-all" [style.background-color]="primaryColor">
                  Primary Action
                </button>
                <button class="px-4 py-2 text-white font-medium text-sm transition-all" [style.background-color]="secondaryColor">
                  Secondary Action
                </button>
              </div>
            </div>

            <!-- Progress Badges -->
            <div class="space-y-2">
              <span class="inline-block px-2.5 py-1 text-xs font-semibold text-white uppercase" [style.background-color]="primaryColor">
                Featured Badge
              </span>
              <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div class="h-full rounded-full" [style.background-color]="primaryColor" [style.width.%]="65"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class ThemeBuilderComponent {
  private readonly repository = inject(ThemeBuilderRepository);

  primaryColor = '#3b82f6';
  secondaryColor = '#1e293b';
  fontFamily = 'Inter';
  borderRadius = 8;
  spacing = 4;

  constructor() {
    this.repository.loadThemeConfig().subscribe((config) => {
      this.primaryColor = config.primaryColor;
      this.secondaryColor = config.secondaryColor;
      this.fontFamily = config.fontFamily;
      this.borderRadius = config.borderRadius;
      this.spacing = config.spacing;
    });
  }

  applyChange() {
    this.repository.saveThemeConfig({
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      fontFamily: this.fontFamily,
      borderRadius: Number(this.borderRadius),
      spacing: Number(this.spacing),
      isDarkMode: false,
      logoUrl: null,
      faviconUrl: null,
    }).subscribe();
  }

  saveTheme() {
    this.applyChange();
    alert('Theme branding saved successfully!');
  }
}
