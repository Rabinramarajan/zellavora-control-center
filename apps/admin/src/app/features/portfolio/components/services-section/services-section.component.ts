import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-services-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
  ],
  templateUrl: './services-section.component.html',
  styleUrl: './services-section.component.css',
})
export class ServicesSectionComponent implements OnInit {
  private messageService = inject(MessageService);

  sectionTitle = 'What I Do';
  sectionDescription = 'Delivering solutions that help businesses grow and succeed.';
  showIconSelector = false;
  selectedServiceIndex = -1;

  iconOptions = [
    '💻', '🎨', '📱', '🔧', '⚡', '🚀', '📊', '🔒',
    '🌐', '📈', '🎯', '💡', '🛠️', '🎭', '📚', '✨',
  ];

  services: Service[] = [
    {
      id: '1',
      title: 'Web Development',
      description: 'Building modern, responsive and high-performance web applications.',
      icon: '💻',
    },
    {
      id: '2',
      title: 'UI/UX Design',
      description: 'Crafting user-centered designs that are intuitive and engaging.',
      icon: '🎨',
    },
    {
      id: '3',
      title: 'Frontend Development',
      description: 'Creating fast, scalable and interactive frontend solutions.',
      icon: '⚡',
    },
    {
      id: '4',
      title: 'Performance Optimization',
      description: 'Improving speed, SEO and overall performance for better results.',
      icon: '🚀',
    },
    {
      id: '5',
      title: 'Maintenance & Support',
      description: 'Providing ongoing support and maintenance for your projects.',
      icon: '🔧',
    },
  ];

  ngOnInit() {
    // Load from service if needed
  }

  addService() {
    this.services.push({
      id: Date.now().toString(),
      title: '',
      description: '',
      icon: '💡',
    });
  }

  removeService(index: number) {
    this.services.splice(index, 1);
  }

  selectIcon(index: number) {
    this.selectedServiceIndex = index;
    this.showIconSelector = true;
  }

  selectIconEmoji(emoji: string) {
    if (this.selectedServiceIndex >= 0) {
      this.services[this.selectedServiceIndex].icon = emoji;
    }
    this.showIconSelector = false;
    this.selectedServiceIndex = -1;
  }

  saveChanges() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'Services section changes saved successfully',
      life: 3000,
    });
  }
}
