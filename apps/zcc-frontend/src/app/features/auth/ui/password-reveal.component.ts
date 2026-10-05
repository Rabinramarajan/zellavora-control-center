import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, model } from '@angular/core';

/**
 * Show / hide toggle for a projected password `app-form-input-control`.
 *
 * The input control comes from `@zellavoras/ui` and has no reveal option, so
 * this wraps it and overlays the button on the field's right edge. The page
 * flips the control's `type` from a template reference:
 *
 *   <app-password-reveal #pw label="password">
 *     <app-form-input-control [type]="pw.visible() ? 'text' : 'password'" … />
 *   </app-password-reveal>
 *
 * Unencapsulated because the layout has to reach into the library's own
 * markup (`.fic-input`, `.fic-tooltip-host`); every selector is scoped under
 * the `zcc-password-reveal` host class.
 */
@Component({
  selector: 'app-password-reveal',
  standalone: true,
  host: { class: 'zcc-password-reveal' },
  template: `
    <ng-content />
    <button
      type="button"
      class="zcc-password-reveal__toggle"
      [attr.aria-label]="(visible() ? 'Hide ' : 'Show ') + label()"
      [attr.aria-pressed]="visible()"
      (click)="visible.set(!visible())"
    >
      @if (visible()) {
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path
            d="M3 3l14 14M8.6 8.7a2 2 0 0 0 2.7 2.7M6.2 5.9C4.5 7 3.2 8.6 2.5 10c1.3 2.7 4.2 5.25 7.5 5.25 1.4 0 2.7-.45 3.8-1.15M9 4.8c.33-.03.67-.05 1-.05 3.3 0 6.2 2.55 7.5 5.25-.45.95-1.1 1.85-1.9 2.65"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      } @else {
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path
            d="M2.5 10C3.8 7.3 6.7 4.75 10 4.75S16.2 7.3 17.5 10c-1.3 2.7-4.2 5.25-7.5 5.25S3.8 12.7 2.5 10Z"
            stroke-linejoin="round"
          />
          <circle cx="10" cy="10" r="2.25" />
        </svg>
      }
    </button>
  `,
  styles: `
    .zcc-password-reveal {
      display: block;
      position: relative;
    }

    /* Keep typed characters clear of the button. */
    .zcc-password-reveal .fic-field .fic-input {
      padding-right: 30px;
    }

    .zcc-password-reveal__toggle {
      position: absolute;
      /* The field is the control's last visible box, so anchor to the bottom
         and match its height: the larger of the token and the input's own
         45px, plus the 1px border top and bottom. */
      bottom: 0;
      right: 3px;
      height: calc(max(var(--zv-control-height, 0px), 45px) + 2px);
      width: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--zv-text-placeholder);
      cursor: pointer;
      border-radius: var(--zv-radius-control, 10px);
      transition: color 0.15s ease;
    }

    .zcc-password-reveal__toggle:hover {
      color: var(--zv-text-muted);
    }

    .zcc-password-reveal__toggle:focus-visible {
      outline: 2px solid var(--zv-accent);
      outline-offset: -4px;
    }

    .zcc-password-reveal__toggle svg {
      width: 18px;
      height: 18px;
    }

    /* The library shows its error/help icon at the far right; sit beside it. */
    .zcc-password-reveal:has(.fic-tooltip-host) .zcc-password-reveal__toggle {
      right: 31px;
    }

    @media (prefers-reduced-motion: reduce) {
      .zcc-password-reveal__toggle {
        transition: none;
      }
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordRevealComponent {
  /** Whether the password is shown as plain text. */
  public readonly visible = model(false);
  /** What the field holds, for the button's accessible name. */
  public readonly label = input('password');
}
