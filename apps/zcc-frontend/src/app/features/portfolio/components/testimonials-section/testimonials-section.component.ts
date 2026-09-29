import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { FormInputControl } from '@zellavoras/ui';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

interface Testimonial {
  id: string;
  clientName: string;
  position: string;
  company: string;
  message: string;
  rating: number;
  avatar?: string;
}

@Component({
  selector: 'app-testimonials-section',
  standalone: true,
  imports: [FormsModule, ButtonModule, TextareaModule, ToastModule, FormInputControl],
  templateUrl: './testimonials-section.component.html',
  styleUrl: './testimonials-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestimonialsSectionComponent {
  private messageService = inject(MessageService);

  readonly sectionTitle = signal('What Clients Say');
  readonly sectionDescription = signal('Trusted by amazing people and leading companies.');

  readonly testimonials = signal<Testimonial[]>([
    {
      id: '1',
      clientName: 'Alex Morgan',
      position: 'CEO',
      company: 'TechNova Solutions',
      message:
        'Rabin is an exceptional developer! He delivered a high-quality web application that exceeded our expectations. His attention to detail, problem-solving skills, and commitment to deadlines are truly impressive.',
      rating: 5,
    },
    {
      id: '2',
      clientName: 'Priya Sharma',
      position: 'Product Manager',
      company: 'InnovateLabs',
      message:
        'Working with Rabin was a great experience. He understood our requirements perfectly and delivered solutions that were both functional and visually appealing.',
      rating: 5,
    },
    {
      id: '3',
      clientName: 'James Carter',
      position: 'Founder',
      company: 'DevCraft Studio',
      message:
        'Rabin brought our vision to life with clean code and modern technologies. A true professional who goes above and beyond.',
      rating: 4,
    },
    {
      id: '4',
      clientName: 'Neha Verma',
      position: 'Marketing Head',
      company: 'BrandifyMe',
      message:
        'Excellent work! Rabin created a stunning portfolio website that perfectly showcases our brand and services.',
      rating: 5,
    },
  ]);

  addTestimonial() {
    this.testimonials.update((testimonials) => [
      ...testimonials,
      { id: Date.now().toString(), clientName: '', position: '', company: '', message: '', rating: 5 },
    ]);
  }

  removeTestimonial(index: number) {
    this.testimonials.update((testimonials) => testimonials.filter((_, i) => i !== index));
  }

  updateTestimonial(index: number, patch: Partial<Testimonial>) {
    this.testimonials.update((testimonials) =>
      testimonials.map((t, i) => (i === index ? { ...t, ...patch } : t))
    );
  }

  saveChanges() {
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'Testimonials section changes saved successfully',
      life: 3000,
    });
  }
}
