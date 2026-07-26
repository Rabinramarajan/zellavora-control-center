import { Routes } from '@angular/router';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioComponent } from './portfolio.component';
import { ProfileEditorComponent } from './components/profile-editor/profile-editor.component';
import { SkillsManagerComponent } from './components/skills-manager/skills-manager.component';

// Placeholder components for other sections
@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-6"><p class="text-slate-600">Hero Section coming soon...</p></div>`,
})
class HeroSectionComponent {}

@Component({
  selector: 'app-about-section',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-6"><p class="text-slate-600">About Section coming soon...</p></div>`,
})
class AboutSectionComponent {}

@Component({
  selector: 'app-experience-section',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-6"><p class="text-slate-600">Experience Section coming soon...</p></div>`,
})
class ExperienceSectionComponent {}

@Component({
  selector: 'app-education-section',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-6"><p class="text-slate-600">Education Section coming soon...</p></div>`,
})
class EducationSectionComponent {}

@Component({
  selector: 'app-services-section',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-6"><p class="text-slate-600">Services Section coming soon...</p></div>`,
})
class ServicesSectionComponent {}

@Component({
  selector: 'app-testimonials-section',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-6"><p class="text-slate-600">Testimonials Section coming soon...</p></div>`,
})
class TestimonialsSectionComponent {}

export const portfolioRoutes: Routes = [
  {
    path: '',
    component: PortfolioComponent,
    children: [
      {
        path: 'profile',
        component: ProfileEditorComponent,
      },
      {
        path: 'hero',
        component: HeroSectionComponent,
      },
      {
        path: 'about',
        component: AboutSectionComponent,
      },
      {
        path: 'skills',
        component: SkillsManagerComponent,
      },
      {
        path: 'experience',
        component: ExperienceSectionComponent,
      },
      {
        path: 'education',
        component: EducationSectionComponent,
      },
      {
        path: 'services',
        component: ServicesSectionComponent,
      },
      {
        path: 'testimonials',
        component: TestimonialsSectionComponent,
      },
      {
        path: '',
        redirectTo: 'profile',
        pathMatch: 'full',
      },
    ],
  },
];
