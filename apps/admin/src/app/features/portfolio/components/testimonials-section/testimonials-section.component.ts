import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
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
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
  ],
  templateUrl: './testimonials-section.component.html',
  styleUrl: './testimonials-section.component.css',
})
export class TestimonialsSectionComponent implements OnInit {
  private messageService = inject(MessageService);

  sectionTitle = 'What Clients Say';
  sectionDescription = 'Trusted by amazing people and leading companies.';

  testimonials: Testimonial[] = [
    {
      id: '1',
      clientName: 'Alex Morgan',
      position: 'CEO',
      company: 'TechNova Solutions',
      message: 'Rabin is an exceptional developer! He delivered a high-quality web application that exceeded our expectations. His attention to detail, problem-solving skills, and commitment to deadlines are truly impressive.',
      rating: 5,
    },
    {
      id: '2',
      clientName: 'Priya Sharma',
      position: 'Product Manager',
      company: 'InnovateLabs',
      message: 'Working with Rabin was a great experience. He understood our requirements perfectly and delivered solutions that were both functional and visually appealing.',
      rating: 5,
    },
    {
      id: '3',
      clientName: 'James Carter',
      position: 'Founder',
      company: 'DevCraft Studio',
      message: 'Rabin brought our vision to life with clean code and modern technologies. A true professional who goes above and beyond.',
      rating: 4,
    },
    {
      id: '4',
      clientName: 'Neha Verma',
      position: 'Marketing Head',
      company: 'BrandifyMe',
      message: 'Excellent work! Rabin created a stunning portfolio website that perfectly showcases our brand and services.',
      rating: 5,
    },
  ];

  ngOnInit() {
    // Load from service if needed
  }

  addTestimonial() {
    this.testimonials.push({
      id: Date.now().toString(),
      clientName: '',
      position: '',
      company: '',
      message: '',
      rating: 5,
    });
  }

  removeTestimonial(index: number) {
    this.testimonials.splice(index, 1);
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
