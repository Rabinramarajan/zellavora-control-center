import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { FormField, FormRoot, form, pattern, required } from '@angular/forms/signals';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { AppDialogService } from '../../../../shared/components/dialog';
import { stringsToOptions } from '../../../../shared/utils/select-options';
import { PortfolioService } from '../../services/portfolio.service';
import { firstValueFrom } from 'rxjs';

const emptySkill = () => ({
  name: '',
  category: '',
  proficiencyLevel: '',
  // The number control is string-valued; it becomes a number on save.
  yearsOfExperience: '',
  isFeatured: false,
});

@Component({
  selector: 'app-skills-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormField, FormRoot, FormInputControl, SelectControl],
  templateUrl: './skills-manager.component.html',
  styleUrl: './skills-manager.component.scss',
})
export class SkillsManagerComponent {
  readonly portfolio = inject(PortfolioService);
  private readonly dialog = inject(AppDialogService);

  readonly categoryOptions: SelectControlOption[] = stringsToOptions([
    'Frontend',
    'Backend',
    'Database',
    'DevOps',
    'Tools',
    'Soft Skills',
  ]);

  readonly proficiencyOptions: SelectControlOption[] = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'expert', label: 'Expert' },
  ];

  private readonly model = signal(emptySkill());

  readonly form = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Skill name is required.' });
      pattern(path.yearsOfExperience, /^\d+(\.\d+)?$/, {
        message: 'Enter a number of years, e.g. 2.5',
      });
    },
    { submission: { action: async () => this.addSkill() } }
  );

  private async addSkill(): Promise<undefined> {
    const { yearsOfExperience, category, proficiencyLevel, ...rest } = this.model();
    try {
      await firstValueFrom(
        this.portfolio.createSkill({
          ...rest,
          category: category || undefined,
          proficiencyLevel: proficiencyLevel || undefined,
          yearsOfExperience: yearsOfExperience ? Number(yearsOfExperience) : undefined,
        })
      );
      this.resetForm();
    } catch {
      // Error handling is done by the service
    }
    return undefined;
  }

  async deleteSkill(id: string): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Delete skill?',
        message: 'This skill will be removed from your portfolio.',
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (confirmed) {
      await firstValueFrom(this.portfolio.deleteSkill(id));
    }
  }

  resetForm(): void {
    this.form().reset(emptySkill());
  }
}
