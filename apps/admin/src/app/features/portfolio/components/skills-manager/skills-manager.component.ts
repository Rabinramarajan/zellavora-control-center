import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, form, pattern, required } from '@angular/forms/signals';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { stringsToOptions } from '@shared/utils/select-options';
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
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, FormInputControl, SelectControl],
  templateUrl: './skills-manager.component.html',
  styleUrl: './skills-manager.component.css',
})
export class SkillsManagerComponent {
  readonly portfolio = inject(PortfolioService);

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
    if (confirm('Are you sure you want to delete this skill?')) {
      await firstValueFrom(this.portfolio.deleteSkill(id));
    }
  }

  resetForm(): void {
    this.form().reset(emptySkill());
  }
}
