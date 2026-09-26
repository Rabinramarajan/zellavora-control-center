import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, form, maxLength, pattern, required } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { firstValueFrom } from 'rxjs';
import { Project, ProjectStatus } from '@shared/models';
import { FORM_PATTERNS } from '@shared/utils/form-patterns';
import { stringsToOptions } from '@shared/utils/select-options';
import { ProjectsService } from '../../services/projects.service';

const URL_FIELDS = [
  'githubUrl',
  'liveDemoUrl',
  'websiteUrl',
  'coverImageUrl',
  'ogImageUrl',
] as const;

function emptyProject() {
  return {
    title: '',
    slug: '',
    description: '',
    content: '',
    status: ProjectStatus.DRAFT as string,
    category: '',
    githubUrl: '',
    liveDemoUrl: '',
    websiteUrl: '',
    coverImageUrl: '',
    thumbnailUrl: '',
    metaDescription: '',
    metaKeywords: '',
    ogImageUrl: '',
    isFeatured: false,
  };
}

type ProjectDraft = ReturnType<typeof emptyProject>;

@Component({
  selector: 'app-project-editor',
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, FormInputControl, SelectControl, RouterLink],
  templateUrl: './project-editor.component.html',
  styleUrl: './project-editor.component.css',
})
export class ProjectEditorComponent implements OnInit {
  readonly projects = inject(ProjectsService);
  private readonly route = inject(ActivatedRoute);

  readonly isNew = signal(true);
  readonly savedSuccessfully = signal(false);
  private projectId: string | null = null;

  readonly categoryOptions: SelectControlOption[] = stringsToOptions([
    'Web Development',
    'Mobile Development',
    'Full Stack',
    'Frontend',
    'Backend',
    'DevOps',
  ]);

  readonly statusOptions: SelectControlOption[] = [
    { value: ProjectStatus.DRAFT, label: 'Draft' },
    { value: ProjectStatus.PUBLISHED, label: 'Published' },
    { value: ProjectStatus.ARCHIVED, label: 'Archived' },
  ];

  private readonly model = signal<ProjectDraft>(emptyProject());

  readonly form = form(
    this.model,
    (path) => {
      required(path.title, { message: 'Project title is required.' });
      required(path.slug, { message: 'Slug is required.' });
      required(path.description, { message: 'Short description is required.' });
      required(path.status);
      maxLength(path.metaDescription, 160, { message: 'Keep it to 160 characters.' });
      for (const field of URL_FIELDS) {
        pattern(path[field], FORM_PATTERNS.url, {
          message: 'Enter a full URL starting with https://',
        });
      }
    },
    { submission: { action: async () => this.save() } }
  );

  async ngOnInit(): Promise<void> {
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (!this.projectId) return;

    this.isNew.set(false);
    const project = await firstValueFrom(this.projects.getProject(this.projectId));
    this.model.set(this.toDraft(project));
  }

  /** The API omits unset optional fields; the form needs a string for each. */
  private toDraft(project: Project): ProjectDraft {
    const draft = emptyProject();
    const source = project as unknown as Record<string, unknown>;
    for (const key of Object.keys(draft) as (keyof ProjectDraft)[]) {
      const value = source[key];
      if (value !== null && value !== undefined) {
        (draft as Record<string, unknown>)[key] = value;
      }
    }
    return draft;
  }

  private async save(): Promise<undefined> {
    const payload = { ...this.model(), status: this.model().status as ProjectStatus };
    if (this.isNew()) {
      await firstValueFrom(this.projects.createProject(payload));
    } else if (this.projectId) {
      await firstValueFrom(this.projects.updateProject(this.projectId, payload));
    }
    this.showSuccess();
    return undefined;
  }

  private showSuccess(): void {
    this.savedSuccessfully.set(true);
    setTimeout(() => this.savedSuccessfully.set(false), 3000);
  }
}
