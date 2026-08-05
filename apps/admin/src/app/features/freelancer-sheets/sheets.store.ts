import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiIntegrationService } from '../../core/services/api-integration.service';

export interface DailySheet {
  id: string;
  userId: string;
  projectId?: string;
  sheetDate: string;
  hoursWorked: number;
  hourlyRate: number;
  totalAmount: number;
  description?: string;
  tasksCompleted?: string;
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  lineItems?: DailySheetLineItem[];
}

export interface DailySheetLineItem {
  id: string;
  taskName: string;
  description?: string;
  hours: number;
  rate?: number;
  amount: number;
}

export interface MonthlySheet {
  id: string;
  userId: string;
  projectId?: string;
  month: number;
  year: number;
  totalHours: number;
  totalAmount: number;
  averageHourlyRate: number;
  workingDays: number;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

interface SheetsState {
  dailySheets: DailySheet[];
  monthlySheets: MonthlySheet[];
  selectedDailySheet: DailySheet | null;
  selectedMonthlySheet: MonthlySheet | null;
  isLoading: boolean;
  error: string | null;
  totalDailySheets: number;
  totalMonthlySheets: number;
}

@Injectable({ providedIn: 'root' })
export class SheetsStore {
  private api = inject(ApiIntegrationService);

  private state = signal<SheetsState>({
    dailySheets: [],
    monthlySheets: [],
    selectedDailySheet: null,
    selectedMonthlySheet: null,
    isLoading: false,
    error: null,
    totalDailySheets: 0,
    totalMonthlySheets: 0,
  });

  // Signals
  dailySheets = computed(() => this.state().dailySheets);
  monthlySheets = computed(() => this.state().monthlySheets);
  selectedDailySheet = computed(() => this.state().selectedDailySheet);
  selectedMonthlySheet = computed(() => this.state().selectedMonthlySheet);
  isLoading = computed(() => this.state().isLoading);
  error = computed(() => this.state().error);

  // Daily Sheets Methods
  loadDailySheets(filters?: Record<string, any>) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.getDailySheets(filters).subscribe({
      next: (response: any) => {
        this.state.update(s => ({
          ...s,
          dailySheets: response.data || [],
          totalDailySheets: response.total || 0,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to load daily sheets',
          isLoading: false,
        }));
      },
    });
  }

  createDailySheet(data: any) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.createDailySheet(data).subscribe({
      next: (response: any) => {
        const newSheet = response.data;
        this.state.update(s => ({
          ...s,
          dailySheets: [newSheet, ...s.dailySheets],
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to create daily sheet',
          isLoading: false,
        }));
      },
    });
  }

  updateDailySheet(id: string, data: any) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.updateDailySheet(id, data).subscribe({
      next: (response: any) => {
        const updated = response.data;
        this.state.update(s => ({
          ...s,
          dailySheets: s.dailySheets.map(sheet => sheet.id === id ? updated : sheet),
          selectedDailySheet: s.selectedDailySheet?.id === id ? updated : s.selectedDailySheet,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to update daily sheet',
          isLoading: false,
        }));
      },
    });
  }

  submitDailySheet(id: string) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.submitDailySheet(id).subscribe({
      next: (response: any) => {
        const updated = response.data;
        this.state.update(s => ({
          ...s,
          dailySheets: s.dailySheets.map(sheet => sheet.id === id ? updated : sheet),
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to submit daily sheet',
          isLoading: false,
        }));
      },
    });
  }

  approveDailySheet(id: string, approved: boolean, rejectionReason?: string) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.approveDailySheet(id, { approved, rejectionReason }).subscribe({
      next: (response: any) => {
        const updated = response.data;
        this.state.update(s => ({
          ...s,
          dailySheets: s.dailySheets.map(sheet => sheet.id === id ? updated : sheet),
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to approve daily sheet',
          isLoading: false,
        }));
      },
    });
  }

  deleteDailySheet(id: string) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.deleteDailySheet(id).subscribe({
      next: () => {
        this.state.update(s => ({
          ...s,
          dailySheets: s.dailySheets.filter(sheet => sheet.id !== id),
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to delete daily sheet',
          isLoading: false,
        }));
      },
    });
  }

  // Monthly Sheets Methods
  loadMonthlySheets(filters?: Record<string, any>) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.getMonthlySheets(filters).subscribe({
      next: (response: any) => {
        this.state.update(s => ({
          ...s,
          monthlySheets: response.data || [],
          totalMonthlySheets: response.total || 0,
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to load monthly sheets',
          isLoading: false,
        }));
      },
    });
  }

  createMonthlySheet(data: any) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.createMonthlySheet(data).subscribe({
      next: (response: any) => {
        const newSheet = response.data;
        this.state.update(s => ({
          ...s,
          monthlySheets: [newSheet, ...s.monthlySheets],
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to create monthly sheet',
          isLoading: false,
        }));
      },
    });
  }

  approveMonthlySheet(id: string, approved: boolean, rejectionReason?: string) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.approveMonthlySheet(id, { approved, rejectionReason }).subscribe({
      next: (response: any) => {
        const updated = response.data;
        this.state.update(s => ({
          ...s,
          monthlySheets: s.monthlySheets.map(sheet => sheet.id === id ? updated : sheet),
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to approve monthly sheet',
          isLoading: false,
        }));
      },
    });
  }

  markMonthlySheetAsPaid(id: string) {
    this.state.update(s => ({ ...s, isLoading: true, error: null }));
    this.api.markMonthlySheetAsPaid(id).subscribe({
      next: (response: any) => {
        const updated = response.data;
        this.state.update(s => ({
          ...s,
          monthlySheets: s.monthlySheets.map(sheet => sheet.id === id ? updated : sheet),
          isLoading: false,
        }));
      },
      error: (err) => {
        this.state.update(s => ({
          ...s,
          error: err.message || 'Failed to mark sheet as paid',
          isLoading: false,
        }));
      },
    });
  }

  clearError() {
    this.state.update(s => ({ ...s, error: null }));
  }
}
