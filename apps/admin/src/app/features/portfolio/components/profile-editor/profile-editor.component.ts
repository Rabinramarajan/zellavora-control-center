import { Component, inject, effect, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, email, form, pattern, required } from '@angular/forms/signals';
import { FormInputControl } from '@zellavoras/ui';
import { Profile } from '@shared/models';
import { PortfolioService } from '../../services/portfolio.service';
import { firstValueFrom } from 'rxjs';

function emptyProfile() {
  return {
    title: '',
    bio: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    githubUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    metaDescription: '',
    metaKeywords: '',
  };
}

type ProfileDraft = ReturnType<typeof emptyProfile>;

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, FormInputControl],
  templateUrl: './profile-editor.component.html',
  styleUrl: './profile-editor.component.css',
})
export class ProfileEditorComponent {
  readonly portfolio = inject(PortfolioService);

  readonly savedSuccessfully = signal(false);

  private readonly model = signal<ProfileDraft>(emptyProfile());

  readonly form = form(
    this.model,
    (path) => {
      required(path.title, { message: 'Title is required.' });
      email(path.email, { message: 'Enter a valid email address.' });
      pattern(path.website, /^https?:\/\/.+/, {
        message: 'Enter a URL starting with http:// or https://',
      });
    },
    { submission: { action: async () => this.save() } }
  );

  constructor() {
    effect(() => {
      const profile = this.portfolio.profile();
      if (profile) untracked(() => this.model.set(this.toDraft(profile)));
    });
  }

  /** The API omits unset optional fields; the form needs a string for each. */
  private toDraft(profile: Profile): ProfileDraft {
    const draft = emptyProfile();
    const source = profile as unknown as Record<string, unknown>;
    for (const key of Object.keys(draft) as (keyof ProfileDraft)[]) {
      const value = source[key];
      if (typeof value === 'string') draft[key] = value;
    }
    return draft;
  }

  private async save(): Promise<undefined> {
    try {
      await firstValueFrom(this.portfolio.updateProfile(this.model()));
      this.savedSuccessfully.set(true);
      setTimeout(() => this.savedSuccessfully.set(false), 3000);
    } catch {
      // Error handling is done by the service
    }
    return undefined;
  }

  resetForm(): void {
    const profile = this.portfolio.profile();
    this.form().reset(profile ? this.toDraft(profile) : emptyProfile());
  }
}
