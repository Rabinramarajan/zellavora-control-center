import { Component, inject, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectsService } from '../../services/projects.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-project-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './project-editor.component.html',
  styleUrl: './project-editor.component.css',
})
export class ProjectEditorComponent implements OnInit {
  projects = inject(ProjectsService);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);

  form: FormGroup;
  isNew = true;
  savedSuccessfully = false;
  projectId: string | null = null;

  constructor() {
    this.form = this.fb.group({
      title: ['', Validators.required],
      slug: ['', Validators.required],
      description: ['', Validators.required],
      content: [''],
      status: ['draft'],
      category: [''],
      githubUrl: [''],
      liveDemoUrl: [''],
      websiteUrl: [''],
      coverImageUrl: [''],
      thumbnailUrl: [''],
      metaDescription: [''],
      metaKeywords: [''],
      ogImageUrl: [''],
      isFeatured: [false],
    });
  }

  async ngOnInit(): Promise<void> {
    this.projectId = this.route.snapshot.paramMap.get('id');

    if (this.projectId) {
      this.isNew = false;
      const project = await firstValueFrom(this.projects.getProject(this.projectId));
      this.form.patchValue(project);
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.form.valid) return;

    if (this.isNew) {
      await firstValueFrom(this.projects.createProject(this.form.value));
      this.showSuccess();
    } else if (this.projectId) {
      await firstValueFrom(this.projects.updateProject(this.projectId, this.form.value));
      this.showSuccess();
    }
  }

  private showSuccess(): void {
    this.savedSuccessfully = true;
    setTimeout(() => {
      this.savedSuccessfully = false;
    }, 3000);
  }
}
