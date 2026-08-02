import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeBuilderRepository } from '@core/repositories/theme-builder.repository';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-theme-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './theme-builder.component.html',
  styleUrl: './theme-builder.component.css',
})
export class ThemeBuilderComponent {
  private readonly repository = inject(ThemeBuilderRepository);

  primaryColor = '#3b82f6';
  secondaryColor = '#1e293b';
  fontFamily = 'Inter';
  borderRadius = 8;
  spacing = 4;

  constructor() {
    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    const config = await firstValueFrom(this.repository.loadThemeConfig());
    this.primaryColor = config.primaryColor;
    this.secondaryColor = config.secondaryColor;
    this.fontFamily = config.fontFamily;
    this.borderRadius = config.borderRadius;
    this.spacing = config.spacing;
  }

  async applyChange() {
    await firstValueFrom(this.repository.saveThemeConfig({
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      fontFamily: this.fontFamily,
      borderRadius: Number(this.borderRadius),
      spacing: Number(this.spacing),
      isDarkMode: false,
      logoUrl: null,
      faviconUrl: null,
    }));
  }

  saveTheme() {
    this.applyChange();
    alert('Theme branding saved successfully!');
  }
}
