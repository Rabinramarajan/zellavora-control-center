import { Routes } from '@angular/router';
import { ChangeDetectionStrategy, Component } from '@angular/core';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [],
  templateUrl: './portfolio.routes.html',
  styleUrl: './portfolio.routes.scss',
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
        data: { breadcrumb: 'Profile' },
      },
      {
        path: 'hero',
        component: HeroSectionComponent,
        data: { breadcrumb: 'Hero Section' },
      },
      {
        path: 'about',
        component: AboutSectionComponent,
        data: { breadcrumb: 'About Section' },
      },
      {
        path: 'skills',
        component: SkillsManagerComponent,
        data: { breadcrumb: 'Skills' },
      },
      {
        path: 'experience',
        component: ExperienceSectionComponent,
        data: { breadcrumb: 'Experience' },
      },
      {
        path: 'education',
        component: EducationSectionComponent,
        data: { breadcrumb: 'Education' },
      },
      {
        path: 'services',
        component: ServicesSectionComponent,
        data: { breadcrumb: 'Services' },
      },
      {
        path: 'testimonials',
        component: TestimonialsSectionComponent,
        data: { breadcrumb: 'Testimonials' },
      },
      {
        path: '',
        redirectTo: 'profile',
        pathMatch: 'full',
      },
    ],
  },
];
