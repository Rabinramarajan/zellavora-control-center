import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormInputControl } from '@zellavoras/ui';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FileUploadModule } from 'primeng/fileupload';

@Component({
  selector: 'app-about-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TextareaModule,
    ToastModule,
    FileUploadModule,
    FormInputControl,
  ],
  templateUrl: './about-section.component.html',
  styleUrl: './about-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutSectionComponent {
  private messageService = inject(MessageService);

  readonly showPreview = signal(false);

  layoutOptions = [
    { label: 'Classic', value: 'classic', icon: '📄' },
    { label: 'Card', value: 'card', icon: '🎴' },
    { label: 'Split', value: 'split', icon: '↔️' },
    { label: 'Minimal', value: 'minimal', icon: '⚙️' },
  ];

  readonly aboutData = signal({
    sectionTitle: 'About Me',
    subtitle: 'Get to know more about me',
    description:
      "I'm a passionate frontend developer who loves building modern, responsive and user-friendly web applications. I specialize in Angular, TypeScript and creating exceptional digital experiences.",
    imageUrl: '',
    layoutStyle: 'classic',
    highlights: ['Clean Code & Best Practices', 'Performance Focused', 'User Experience Driven'],
  });

  patch(changes: Partial<ReturnType<typeof this.aboutData>>) {
    this.aboutData.update((data) => ({ ...data, ...changes }));
  }

  addHighlight() {
    this.patch({ highlights: [...this.aboutData().highlights, ''] });
  }

  updateHighlight(index: number, value: string) {
    this.patch({
      highlights: this.aboutData().highlights.map((h, i) => (i === index ? value : h)),
    });
  }

  saveChanges() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'About section changes saved successfully',
      life: 3000,
    });
  }
}
