import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { isHexColor } from '../../../shared/utils/brand-palette';

interface EyeDropperResult {
  sRGBHex: string;
}
type EyeDropperCtor = new () => { open(): Promise<EyeDropperResult> };

let nextId = 0;

/**
 * Colour input: native picker as the swatch, an editable hex field and, where the browser
 * supports it, the EyeDropper to sample any colour on screen.
 */
@Component({
  selector: 'app-color-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-field.component.html',
  styleUrl: './color-field.component.scss',
})
export class ColorFieldComponent {
  public readonly label = input.required<string>();
  public readonly value = model.required<string>();
  public readonly error = input<string | undefined>(undefined);
  public readonly disabled = input(false);
  /** `field`: large input row; `tile`: compact swatch card for the extended palette. */
  public readonly variant = input<'field' | 'tile'>('field');

  protected readonly id = `cf-${nextId++}`;
  protected readonly canSample = typeof window !== 'undefined' && 'EyeDropper' in window;

  protected swatch(): string {
    return isHexColor(this.value()) ? this.value() : '#000000';
  }

  protected onPick(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value.toUpperCase());
  }

  protected onType(event: Event): void {
    let v = (event.target as HTMLInputElement).value.trim();
    if (v && !v.startsWith('#')) v = `#${v}`;
    this.value.set(v.slice(0, 7).toUpperCase());
  }

  protected async sample(): Promise<void> {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return;
    try {
      const { sRGBHex } = await new Ctor().open();
      this.value.set(sRGBHex.toUpperCase());
    } catch {
      // Cancelled with Esc: keep the current colour.
    }
  }
}
