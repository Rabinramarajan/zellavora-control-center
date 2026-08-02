import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PortfolioService } from '../../services/portfolio.service';
import { Skill } from '@shared/models';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-skills-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './skills-manager.component.html',
  styleUrl: './skills-manager.component.css',
})
export class SkillsManagerComponent {
  portfolio = inject(PortfolioService);
  fb = inject(FormBuilder);

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      category: [''],
      proficiencyLevel: [''],
      yearsOfExperience: [null],
      isFeatured: [false],
    });
  }

  async addSkill(): Promise<void> {
    if (!this.form.valid) return;

    try {
      await firstValueFrom(this.portfolio.createSkill(this.form.value));
      this.resetForm();
    } catch (error) {
      console.error('Error adding skill:', error);
    }
  }

  async deleteSkill(id: string): Promise<void> {
    if (confirm('Are you sure you want to delete this skill?')) {
      await firstValueFrom(this.portfolio.deleteSkill(id));
    }
  }

  resetForm(): void {
    this.form.reset();
  }
}
