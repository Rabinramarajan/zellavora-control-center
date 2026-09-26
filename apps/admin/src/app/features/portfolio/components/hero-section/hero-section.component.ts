import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    TextareaModule,
    SelectControl,
    ToastModule,
    FormInputControl,
  ],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.css',
})
export class HeroSectionComponent implements OnInit {
  private messageService = inject(MessageService);

  showPreview = false;
  statusOptions: SelectControlOption[] = [
    { label: 'Available for work', value: 'Available for work', color: '#22c55e' },
    { label: 'Available for freelance', value: 'Available for freelance', color: '#eab308' },
    { label: 'Not available', value: 'Not available', color: '#ef4444' },
  ];

  heroData = {
    mainHeading: "Hi, I'm Rabin R",
    subHeading: 'Frontend Angular Consultant',
    description:
      'I build modern web applications with Angular, TypeScript and cutting-edge technologies. Focused on performance, accessibility and exceptional user experiences.',
    availabilityStatus: 'Available for work',
    primaryButtonText: 'View My Work',
    primaryButtonLink: '/projects',
    secondaryButtonText: 'Download CV',
    secondaryButtonLink: '/resume.pdf',
  };

  ngOnInit() {
    // Load from service if needed
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
