/**
 * Shapes returned by /api/v1/daily-sheets and /api/v1/monthly-sheets.
 * The API sends Decimals as numbers and sheet dates as "YYYY-MM-DD".
 */

export type DailySheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type MonthlySheetStatus = DailySheetStatus | 'paid';

/** Leave and holiday days record the absence only: no times, hours or amount. */
export type EntryType = 'work' | 'leave' | 'holiday';

export interface SheetPerson {
  id: string;
  fullName: string;
  email?: string;
}

export interface DailySheetLineItem {
  id: string;
  taskName: string;
  description: string | null;
  hours: number;
  rate: number | null;
  amount: number;
}

export interface DailySheet {
  id: string;
  userId: string;
  user: SheetPerson | null;
  projectId: string | null;
  projectName: string | null;
  entryType: EntryType;
  /** "YYYY-MM-DD" */
  sheetDate: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  hoursWorked: number;
  billableHours: number;
  hourlyRate: number;
  totalAmount: number;
  isBillable: boolean;
  description: string | null;
  tasksCompleted: string | null;
  taskName: string | null;
  notes: string | null;
  status: DailySheetStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  approver: SheetPerson | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: DailySheetLineItem[];
}

export interface MonthlySheet {
  id: string;
  userId: string;
  user: SheetPerson | null;
  month: number;
  year: number;
  totalHours: number;
  billableHours: number;
  totalAmount: number;
  averageHourlyRate: number;
  workingDays: number;
  totalSheets: number;
  status: MonthlySheetStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  approver: SheetPerson | null;
  paidAt: string | null;
  rejectionReason: string | null;
  dailySheetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProjectOption {
  id: string;
  name: string;
}

export interface LineItemInput {
  taskName: string;
  description?: string;
  hours: number;
  rate?: number;
}

/** Body for creating or updating a daily sheet. */
export interface DailySheetInput {
  entryType: EntryType;
  sheetDate: string;
  projectId: string | null;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  hoursWorked?: number;
  hourlyRate: number;
  isBillable: boolean;
  description: string | null;
  tasksCompleted: string | null;
  notes: string | null;
  lineItems: LineItemInput[];
}

/** `team` needs the timesheet:approve permission. */
export type SheetScope = 'mine' | 'team';

export interface DailySheetQuery {
  scope?: SheetScope;
  userId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  status?: DailySheetStatus;
  page?: number;
  pageSize?: number;
}

export interface MonthlySheetQuery {
  scope?: SheetScope;
  userId?: string;
  month?: number;
  year?: number;
  status?: MonthlySheetStatus;
  page?: number;
  pageSize?: number;
}

/** A failed request, reduced to what a page shows the user. */
export interface SheetRequestError {
  status: number;
  code: string;
  message: string;
  /** Server-side validation messages keyed by field path. */
  fields: Record<string, string>;
  /** Extra detail the server attached, e.g. the id of a conflicting sheet. */
  details: Record<string, unknown>;
}

export type DocumentRowKind =
  'blank' | 'working' | 'extended' | 'weekend_work' | 'leave' | 'holiday';

/** One calendar day on the printable timesheet. */
export interface DocumentRow {
  date: string;
  /** "Aug 1" */
  dateLabel: string;
  /** "Sat" */
  day: string;
  isWeekend: boolean;
  kind: DocumentRowKind;
  /** "11:00 AM" */
  startTime: string | null;
  endTime: string | null;
  hours: number | null;
  statusLabel: string;
  notes: string | null;
}

/** The printable monthly timesheet, as /monthly-sheets/document returns it. */
export interface MonthlyDocument {
  month: number;
  year: number;
  /** "Aug 1 - Aug 31, 2026" */
  periodLabel: string;
  employee: { id: string; name: string; department: string | null; jobTitle: string | null };
  /** `preview` until a monthly sheet has been submitted. */
  status: 'preview' | MonthlySheetStatus;
  monthlySheetId: string | null;
  totalHours: number;
  rows: DocumentRow[];
  summary: {
    workingDays: number;
    leaveDays: number;
    leaveDates: string[];
    holidayDays: number;
    holidayDates: string[];
    extendedDates: string[];
    weekendWorkDates: string[];
    totalHours: number;
  };
  schedule: { startTime: string; endTime: string; hours: number } | null;
  approvals: {
    submittedAt: string | null;
    approvedAt: string | null;
    approverName: string | null;
    paidAt: string | null;
  };
  pendingDailyCount: number;
}
