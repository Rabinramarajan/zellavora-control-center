import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PortfolioService } from '../../services/portfolio.service';
import { Skill } from '@shared/models';

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

  addSkill(): void {
    if (!this.form.valid) return;

    this.portfolio.createSkill(this.form.value).subscribe({
      next: () => {
        this.resetForm();
      },
      error: (error) => {
        console.error('Error adding skill:', error);
      },
    });
  }

  deleteSkill(id: string): void {
    if (confirm('Are you sure you want to delete this skill?')) {
      this.portfolio.deleteSkill(id).subscribe();
    }
  }

  resetForm(): void {
    this.form.reset();
  }
}
