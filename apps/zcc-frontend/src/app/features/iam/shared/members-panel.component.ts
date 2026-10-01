import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrgMember } from '../../../shared/models/iam-admin.model';
import { StatusChipComponent } from '../../../shared/components/iam';
import { IAM_BTN, IAM_CARD, IAM_INPUT } from './iam-page-header.component';
import { initials } from './iam-format';

/** Member list with local filtering, used by department and team detail pages. */
@Component({
  selector: 'zcc-members-panel',
  standalone: true,
  imports: [RouterLink, StatusChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './members-panel.component.html',
  styleUrl: './members-panel.component.scss',
})
export class MembersPanelComponent {
  readonly members = input.required<OrgMember[]>();
  readonly canManage = input(false);
  readonly busyUserId = input<string | null>(null);
  readonly emptyMessage = input('No members yet.');
  readonly add = output<void>();
  readonly remove = output<OrgMember>();

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly inputClass = IAM_INPUT;
  protected readonly initialsOf = initials;
  protected readonly filter = signal('');
  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.members();
    return this.members().filter(
      (m) => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  });
}
