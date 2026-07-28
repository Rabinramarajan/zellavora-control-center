import { Routes } from '@angular/router';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioComponent } from './portfolio.component';
import { ProfileEditorComponent } from './components/profile-editor/profile-editor.component';
import { SkillsManagerComponent } from './components/skills-manager/skills-manager.component';
import { HeroSectionComponent } from './components/hero-section/hero-section.component';
import { AboutSectionComponent } from './components/about-section/about-section.component';
import { ServicesSectionComponent } from './components/services-section/services-section.component';
import { TestimonialsSectionComponent } from './components/testimonials-section/testimonials-section.component';

import { EducationSectionComponent } from './components/education-section/education-section.component';

// Placeholder components for sections not yet implemented
@Component({
  selector: 'app-experience-section',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-6"><p class="text-slate-600">Experience Section coming soon...</p></div>`,
})
class ExperienceSectionComponent {}

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
