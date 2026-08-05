import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { PortfolioService } from '../../services/portfolio.service';
import { Education } from '@shared/models';
import { firstValueFrom } from 'rxjs';

interface RichEducation {
  id?: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string; // Year e.g. "2018"
  endDate: string;   // Year e.g. "2021"
  isCurrent: boolean;
  descriptionText: string;
  location: string;
  grade: string;
  highlights: string[];
  status: string; // 'Active' or 'Draft' or 'Hidden'
}

@Component({
  selector: 'app-education-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
    SelectModule,
  ],
  providers: [MessageService],
  templateUrl: './education-section.component.html',
  styleUrl: './education-section.component.css',
})
export class EducationSectionComponent implements OnInit {
  private portfolioService = inject(PortfolioService);
  private messageService = inject(MessageService);

  // List of parsed education entries
  parsedEntries = signal<RichEducation[]>([]);

  // Selection state
  selectedId = signal<string | null>(null);

  // Current editing form state
  editingForm = signal<RichEducation>({
    institution: '',
    degree: '',
    field: '',
    startDate: new Date().getFullYear().toString(),
    endDate: (new Date().getFullYear() + 3).toString(),
    isCurrent: false,
    descriptionText: '',
    location: '',
    grade: '',
    highlights: [],
    status: 'Active',
  });

  // Settings
  layoutStyle = signal<string>('timeline');
  showSettings = {
    showHeader: true,
    showDescription: true,
    showLocation: true,
    showYearRange: true,
  };
  maxItems = 6;
  animationStyle = 'fade-in-up';

  // Preview device mode
  deviceMode = signal<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Dropdown options
  yearsOptions: { label: string; value: string }[] = [];

  // computed metrics
  totalItems = computed(() => this.parsedEntries().length);
  activeItemsCount = computed(() => this.parsedEntries().filter(e => e.status === 'Active').length);
  completionPercentage = computed(() => {
    const list = this.parsedEntries();
    if (list.length === 0) return 0;
    const completed = list.filter(e => e.institution && e.degree && e.field && e.descriptionText);
    return Math.round((completed.length / list.length) * 100);
  });

  async ngOnInit() {
    // Generate years from 1980 to next 10 years
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 5; y >= 1980; y--) {
      this.yearsOptions.push({ label: y.toString(), value: y.toString() });
    }

    // Load initial data
    const eduList = await firstValueFrom(this.portfolioService.getEducation());
    this.parseDatabaseEntries(eduList);
  }

  parseDatabaseEntries(eduList: Education[]) {
    const parsed = eduList.map((edu) => {
      let descriptionText = '';
      let location = '';
      let grade = '';
      let highlights: string[] = [];

      try {
        if (edu.description && edu.description.trim().startsWith('{')) {
          const parsedDesc = JSON.parse(edu.description);
          descriptionText = parsedDesc.description || '';
          location = parsedDesc.location || '';
          grade = parsedDesc.grade || '';
          highlights = parsedDesc.highlights || [];
        } else {
          descriptionText = edu.description || '';
        }
      } catch (e) {
        descriptionText = edu.description || '';
      }

      // Convert date to year string
      const startYear = edu.startDate ? new Date(edu.startDate).getFullYear().toString() : new Date().getFullYear().toString();
      const endYear = edu.endDate ? new Date(edu.endDate).getFullYear().toString() : '';

      return {
        id: edu.id,
        institution: edu.institution,
        degree: edu.degree,
        field: edu.field || '',
        startDate: startYear,
        endDate: endYear,
        isCurrent: edu.isCurrent,
        descriptionText,
        location,
        grade,
        highlights,
        status: edu.isCurrent ? 'Active' : 'Active', // Mock value or based on isCurrent
      };
    });

    this.parsedEntries.set(parsed);

    // Default select first item
    if (parsed.length > 0) {
      this.selectEntry(parsed[0].id!);
    } else {
      this.addEmptyEntry();
    }
  }

  selectEntry(id: string) {
    this.selectedId.set(id);
    const found = this.parsedEntries().find((e) => e.id === id);
    if (found) {
      this.editingForm.set({ ...found, highlights: [...found.highlights] });
    }
  }

  addEmptyEntry() {
    this.selectedId.set(null);
    this.editingForm.set({
      institution: '',
      degree: '',
      field: '',
      startDate: new Date().getFullYear().toString(),
      endDate: (new Date().getFullYear() + 2).toString(),
      isCurrent: false,
      descriptionText: '',
      location: '',
      grade: '',
      highlights: [],
      status: 'Active',
    });
  }

  addHighlight() {
    const current = this.editingForm();
    this.editingForm.set({
      ...current,
      highlights: [...current.highlights, ''],
    });
  }

  updateHighlight(index: number, val: string) {
    const current = this.editingForm();
    const updated = [...current.highlights];
    updated[index] = val;
    this.editingForm.set({
      ...current,
      highlights: updated,
    });
  }

  removeHighlight(index: number) {
    const current = this.editingForm();
    this.editingForm.set({
      ...current,
      highlights: current.highlights.filter((_, i) => i !== index),
    });
  }

  async saveForm() {
    const form = this.editingForm();
    if (!form.institution || !form.degree) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Institution and Degree/Certification are required',
      });
      return;
    }

    // Serialize location, grade, highlights into description
    const serializedDesc = JSON.stringify({
      description: form.descriptionText,
      location: form.location,
      grade: form.grade,
      highlights: form.highlights,
    });

    const startYearInt = parseInt(form.startDate);
    const endYearInt = form.endDate ? parseInt(form.endDate) : null;

    const dbPayload = {
      institution: form.institution,
      degree: form.degree,
      field: form.field,
      startDate: new Date(startYearInt, 0, 1),
      endDate: endYearInt ? new Date(endYearInt, 0, 1) : undefined,
      isCurrent: form.isCurrent,
      description: serializedDesc,
    };

    const id = this.selectedId();
    if (id) {
      // Update
      await firstValueFrom(this.portfolioService.updateEducation(id, dbPayload));
      this.messageService.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Education entry updated successfully',
      });
      await this.refreshData();
    } else {
      // Create
      await firstValueFrom(this.portfolioService.createEducation(dbPayload));
      this.messageService.add({
        severity: 'success',
        summary: 'Created',
        detail: 'Education entry created successfully',
      });
      await this.refreshData();
    }
  }

  async deleteEntry() {
    const id = this.selectedId();
    if (!id) return;

    await firstValueFrom(this.portfolioService.deleteEducation(id));
    this.messageService.add({
      severity: 'info',
      summary: 'Deleted',
      detail: 'Education entry deleted successfully',
    });
    await this.refreshData();
  }

  async refreshData() {
    const eduList = await firstValueFrom(this.portfolioService.getEducation());
    this.parseDatabaseEntries(eduList);
  }
}
