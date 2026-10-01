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
  host: { class: 'flex flex-1 flex-col md:min-h-0' },
  templateUrl: './iam-layout.component.html',
  styleUrl: './iam-layout.component.scss',
})
export class IamLayoutComponent {}
