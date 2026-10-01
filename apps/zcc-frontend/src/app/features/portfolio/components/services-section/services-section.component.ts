import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { FormInputControl } from '@zellavoras/ui';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
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
  imports: [FormsModule, ButtonModule, TextareaModule, ToastModule, FormInputControl],
  templateUrl: './services-section.component.html',
  styleUrl: './services-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesSectionComponent {
  private messageService = inject(MessageService);

  readonly sectionTitle = signal('What I Do');
  readonly sectionDescription = signal(
    'Delivering solutions that help businesses grow and succeed.'
  );
  readonly showIconSelector = signal(false);
  private readonly selectedServiceIndex = signal(-1);

  iconOptions = [
    '💻',
    '🎨',
    '📱',
    '🔧',
    '⚡',
    '🚀',
    '📊',
    '🔒',
    '🌐',
    '📈',
    '🎯',
    '💡',
    '🛠️',
    '🎭',
    '📚',
    '✨',
  ];

  readonly services = signal<Service[]>([
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
  ]);

  addService() {
    this.services.update((services) => [
      ...services,
      { id: Date.now().toString(), title: '', description: '', icon: '💡' },
    ]);
  }

  removeService(index: number) {
    this.services.update((services) => services.filter((_, i) => i !== index));
  }

  updateService(index: number, patch: Partial<Service>) {
    this.services.update((services) =>
      services.map((service, i) => (i === index ? { ...service, ...patch } : service))
    );
  }

  selectIcon(index: number) {
    this.selectedServiceIndex.set(index);
    this.showIconSelector.set(true);
  }

  selectIconEmoji(emoji: string) {
    const index = this.selectedServiceIndex();
    if (index >= 0) this.updateService(index, { icon: emoji });
    this.closeIconSelector();
  }

  closeIconSelector() {
    this.showIconSelector.set(false);
    this.selectedServiceIndex.set(-1);
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
