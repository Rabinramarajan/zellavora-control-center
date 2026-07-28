import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
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
    InputTextModule,
    TextareaModule,
    ToastModule,
    FileUploadModule,
  ],
  templateUrl: './about-section.component.html',
  styleUrl: './about-section.component.css',
})
export class AboutSectionComponent implements OnInit {
  private messageService = inject(MessageService);

  showPreview = false;

  layoutOptions = [
    { label: 'Classic', value: 'classic', icon: '📄' },
    { label: 'Card', value: 'card', icon: '🎴' },
    { label: 'Split', value: 'split', icon: '↔️' },
    { label: 'Minimal', value: 'minimal', icon: '⚙️' },
  ];

  aboutData = {
    sectionTitle: 'About Me',
    subtitle: 'Get to know more about me',
    description: 'I\'m a passionate frontend developer who loves building modern, responsive and user-friendly web applications. I specialize in Angular, TypeScript and creating exceptional digital experiences.',
    imageUrl: '',
    layoutStyle: 'classic',
    highlights: [
      'Clean Code & Best Practices',
      'Performance Focused',
      'User Experience Driven',
    ],
  };

  ngOnInit() {
    // Load from service if needed
  }

  addHighlight() {
    this.aboutData.highlights.push('');
  }

  updateHighlight(index: number, value: any) {
    this.aboutData.highlights[index] = value;
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
