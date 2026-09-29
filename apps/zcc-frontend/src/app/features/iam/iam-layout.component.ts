import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterOutlet } from '@angular/router';

/**
 * IAM shell — navigation lives in the app sidebar (the permission-filtered
 * `iam` menu node), so this layout only hosts the page content.
 */
@Component({
  selector: 'zcc-iam-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <main class="min-w-0 p-6">
      <router-outlet />
    </main>
  `,
})
export class IamLayoutComponent {}
