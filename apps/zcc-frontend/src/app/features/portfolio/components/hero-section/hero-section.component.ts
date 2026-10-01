import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    TextareaModule,
    SelectControl,
    ToastModule,
    FormInputControl,
  ],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSectionComponent {
  private messageService = inject(MessageService);

  readonly showPreview = signal(false);
  statusOptions: SelectControlOption[] = [
    { label: 'Available for work', value: 'Available for work', color: '#22c55e' },
    { label: 'Available for freelance', value: 'Available for freelance', color: '#eab308' },
    { label: 'Not available', value: 'Not available', color: '#ef4444' },
  ];

  readonly heroData = signal({
    mainHeading: "Hi, I'm Rabin R",
    subHeading: 'Frontend Angular Consultant',
    description:
      'I build modern web applications with Angular, TypeScript and cutting-edge technologies. Focused on performance, accessibility and exceptional user experiences.',
    availabilityStatus: 'Available for work',
    primaryButtonText: 'View My Work',
    primaryButtonLink: '/projects',
    secondaryButtonText: 'Download CV',
    secondaryButtonLink: '/resume.pdf',
  });

  patch(changes: Partial<ReturnType<typeof this.heroData>>) {
    this.heroData.update((data) => ({ ...data, ...changes }));
  }

  saveChanges() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'Hero section changes saved successfully',
      life: 3000,
    });
  }
}
