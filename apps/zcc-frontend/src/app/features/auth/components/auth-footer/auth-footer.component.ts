import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Low-emphasis legal row closing the auth workspace. */
@Component({
  selector: 'app-auth-footer',
  standalone: true,
  template: `
    <span class="nx-footer__copy">&copy; {{ year }} Zelavora</span>
    <nav class="nx-footer__links" aria-label="Legal">
      <a href="https://zelavora.com/privacy" target="_blank" rel="noopener">Privacy</a>
      <a href="https://zelavora.com/terms" target="_blank" rel="noopener">Terms</a>
      <a href="mailto:support@zelavora.com">Support</a>
    </nav>
  `,
  styleUrl: './auth-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthFooterComponent {
  protected readonly year = new Date().getFullYear();
}
