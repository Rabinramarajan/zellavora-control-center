import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import {
  Profile,
  Skill,
  Experience,
  Education,
  Service,
  Testimonial,
} from '@shared/models';

interface PortfolioState {
  profile: Profile | null;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  services: Service[];
  testimonials: Testimonial[];
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class PortfolioService {
  private state = signal<PortfolioState>({
    profile: null,
    skills: [],
    experience: [],
    education: [],
    services: [],
    testimonials: [],
    isLoading: false,
    error: null,
  });

  // Public computed signals
  profile = computed(() => this.state().profile);
  skills = computed(() => this.state().skills);
  experience = computed(() => this.state().experience);
  education = computed(() => this.state().education);
  services = computed(() => this.state().services);
  testimonials = computed(() => this.state().testimonials);
  isLoading = computed(() => this.state().isLoading);
  error = computed(() => this.state().error);

  constructor(private http: HttpClient) {
    this.loadAllData();
  }

  // ========== PROFILE ==========

  getProfile(): Observable<Profile> {
    return this.http.get<Profile>('/api/v1/portfolio/profile').pipe(
      tap((profile) => {
        this.state.update((s) => ({ ...s, profile }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateProfile(data: Partial<Profile>): Observable<Profile> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    return this.http.put<Profile>('/api/v1/portfolio/profile', data).pipe(
      tap((profile) => {
        this.state.update((s) => ({
          ...s,
          profile,
          isLoading: false,
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== SKILLS ==========

  getSkills(): Observable<Skill[]> {
    return this.http.get<Skill[]>('/api/v1/portfolio/skills').pipe(
      tap((skills) => {
        this.state.update((s) => ({ ...s, skills }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  createSkill(skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>): Observable<Skill> {
    return this.http.post<Skill>('/api/v1/portfolio/skills', skill).pipe(
      tap((newSkill) => {
        this.state.update((s) => ({
          ...s,
          skills: [...s.skills, newSkill],
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateSkill(id: string, data: Partial<Skill>): Observable<Skill> {
    return this.http.put<Skill>(`/api/v1/portfolio/skills/${id}`, data).pipe(
      tap((updated) => {
        this.state.update((s) => ({
          ...s,
          skills: s.skills.map((skill) => (skill.id === id ? updated : skill)),
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteSkill(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/portfolio/skills/${id}`).pipe(
      tap(() => {
        this.state.update((s) => ({
          ...s,
          skills: s.skills.filter((skill) => skill.id !== id),
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== EXPERIENCE ==========

  getExperience(): Observable<Experience[]> {
    return this.http.get<Experience[]>('/api/v1/portfolio/experience').pipe(
      tap((experience) => {
        this.state.update((s) => ({ ...s, experience }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  createExperience(
    exp: Omit<Experience, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<Experience> {
    return this.http.post<Experience>('/api/v1/portfolio/experience', exp).pipe(
      tap((newExp) => {
        this.state.update((s) => ({
          ...s,
          experience: [...s.experience, newExp],
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateExperience(id: string, data: Partial<Experience>): Observable<Experience> {
    return this.http.put<Experience>(`/api/v1/portfolio/experience/${id}`, data).pipe(
      tap((updated) => {
        this.state.update((s) => ({
          ...s,
          experience: s.experience.map((exp) => (exp.id === id ? updated : exp)),
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteExperience(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/portfolio/experience/${id}`).pipe(
      tap(() => {
        this.state.update((s) => ({
          ...s,
          experience: s.experience.filter((exp) => exp.id !== id),
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== EDUCATION ==========

  getEducation(): Observable<Education[]> {
    return this.http.get<Education[]>('/api/v1/portfolio/education').pipe(
      tap((education) => {
        this.state.update((s) => ({ ...s, education }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  createEducation(
    edu: Omit<Education, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<Education> {
    return this.http.post<Education>('/api/v1/portfolio/education', edu).pipe(
      tap((newEdu) => {
        this.state.update((s) => ({
          ...s,
          education: [...s.education, newEdu],
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateEducation(id: string, data: Partial<Education>): Observable<Education> {
    return this.http.put<Education>(`/api/v1/portfolio/education/${id}`, data).pipe(
      tap((updated) => {
        this.state.update((s) => ({
          ...s,
          education: s.education.map((edu) => (edu.id === id ? updated : edu)),
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteEducation(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/portfolio/education/${id}`).pipe(
      tap(() => {
        this.state.update((s) => ({
          ...s,
          education: s.education.filter((edu) => edu.id !== id),
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== SERVICES ==========

  getServices(): Observable<Service[]> {
    return this.http.get<Service[]>('/api/v1/portfolio/services').pipe(
      tap((services) => {
        this.state.update((s) => ({ ...s, services }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  createService(
    service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<Service> {
    return this.http.post<Service>('/api/v1/portfolio/services', service).pipe(
      tap((newService) => {
        this.state.update((s) => ({
          ...s,
          services: [...s.services, newService],
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateService(id: string, data: Partial<Service>): Observable<Service> {
    return this.http.put<Service>(`/api/v1/portfolio/services/${id}`, data).pipe(
      tap((updated) => {
        this.state.update((s) => ({
          ...s,
          services: s.services.map((service) => (service.id === id ? updated : service)),
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteService(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/portfolio/services/${id}`).pipe(
      tap(() => {
        this.state.update((s) => ({
          ...s,
          services: s.services.filter((service) => service.id !== id),
        }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== TESTIMONIALS ==========

  getTestimonials(): Observable<Testimonial[]> {
    return this.http.get<Testimonial[]>('/api/v1/portfolio/testimonials').pipe(
      tap((testimonials) => {
        this.state.update((s) => ({ ...s, testimonials }));
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // ========== UTILITY ==========

  private loadAllData(): void {
    this.state.update((s) => ({ ...s, isLoading: true }));

    this.getProfile().subscribe();
    this.getSkills().subscribe();
    this.getExperience().subscribe();
    this.getEducation().subscribe();
    this.getServices().subscribe();
    this.getTestimonials().subscribe();

    this.state.update((s) => ({ ...s, isLoading: false }));
  }

  private handleError(error: any): Observable<never> {
    const message = error.error?.error?.message || 'An error occurred';
    this.state.update((s) => ({ ...s, error: message, isLoading: false }));
    console.error('Portfolio error:', error);
    return throwError(() => error);
  }
}
