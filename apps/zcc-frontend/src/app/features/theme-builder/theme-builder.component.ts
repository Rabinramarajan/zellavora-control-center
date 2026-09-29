import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { stringsToOptions } from '@shared/utils/select-options';
import { ThemeBuilderRepository } from '@core/repositories/theme-builder.repository';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-theme-builder',
  standalone: true,
  imports: [FormsModule, FormInputControl, SelectControl],
  templateUrl: './theme-builder.component.html',
  styleUrl: './theme-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeBuilderComponent {
  private readonly repository = inject(ThemeBuilderRepository);

  readonly primaryColor = signal('#3b82f6');
  readonly secondaryColor = signal('#1e293b');
  readonly fontFamily = signal('Inter');
  readonly fontOptions: SelectControlOption[] = stringsToOptions([
    'Inter',
    'Roboto',
    'Outfit',
    'Montserrat',
  ]);
  readonly borderRadius = signal(8);
  readonly spacing = signal(4);

  constructor() {
    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    const config = await firstValueFrom(this.repository.loadThemeConfig());
    this.primaryColor.set(config.primaryColor);
    this.secondaryColor.set(config.secondaryColor);
    this.fontFamily.set(config.fontFamily);
    this.borderRadius.set(config.borderRadius);
    this.spacing.set(config.spacing);
  }

  async applyChange() {
    await firstValueFrom(
      this.repository.saveThemeConfig({
        primaryColor: this.primaryColor(),
        secondaryColor: this.secondaryColor(),
        fontFamily: this.fontFamily(),
        borderRadius: Number(this.borderRadius()),
        spacing: Number(this.spacing()),
        isDarkMode: false,
        logoUrl: null,
        faviconUrl: null,
      })
    );
  }

  saveTheme() {
    this.applyChange();
    alert('Theme branding saved successfully!');
  }
}
