import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Title row shared by IAM screens; actions are projected on the right. */
@Component({
  selector: 'zcc-iam-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iam-page-header.component.html',
  styleUrl: './iam-page-header.component.scss',
})
export class IamPageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly icon = input('');
}

/** Tailwind classes reused by IAM action buttons. */
export const IAM_BTN = {
  primary:
    'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10',
  danger:
    'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50',
  icon: 'inline-flex size-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white',
} as const;

/** Shared card surface. */
export const IAM_CARD =
  'rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]';

/** Shared text input styling. */
export const IAM_INPUT =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-white';
