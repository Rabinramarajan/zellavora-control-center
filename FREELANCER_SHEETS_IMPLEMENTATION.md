# Freelancer Sheets Module - Complete Implementation Guide

## Overview
The Freelancer Sheets module enables freelancers to track their work through:
- **Daily Sheets**: Daily timesheet entries with hourly tracking, tasks, and notes
- **Monthly Sheets**: Monthly aggregation of daily sheets for billing and approval

## Backend Architecture

### Database Schema (Prisma)

```prisma
// Daily Sheets
model DailySheet {
  - id, organizationId, userId, projectId
  - sheetDate, hoursWorked, hourlyRate, totalAmount
  - description, tasksCompleted, notes
  - status: draft | submitted | approved | rejected
  - approvalWorkflow: approvedBy, approvedAt, rejectionReason
  - Relationships: lineItems[], user, organization
}

model DailySheetLineItem {
  - taskName, description, hours, rate, amount
  - Tracks individual tasks within a daily sheet
}

// Monthly Sheets  
model MonthlySheet {
  - id, organizationId, userId, projectId
  - month, year
  - totalHours, totalAmount, averageHourlyRate
  - workingDays: count of working days
  - status: draft | submitted | approved | paid | rejected
  - dailySheetIds[]: Array of linked daily sheets
  - Relationships: user, organization
}
```

### Backend Modules

#### 1. Daily Sheets Module
**Location**: `apps/backend/src/modules/daily-sheets/`

**Files**:
- `daily-sheets.dto.ts` - Zod schemas for validation
  - CreateDailySheetSchema
  - UpdateDailySheetSchema
  - ApproveDailySheetSchema
  - DailySheetQuerySchema

- `daily-sheets.service.ts` - Business logic
  - create(): Create draft daily sheet
  - update(): Edit draft sheets only
  - submitForApproval(): Change status to submitted
  - approve(): Approve/reject with feedback
  - getById(), list(), delete()

- `daily-sheets.controller.ts` - REST endpoints
- `daily-sheets.routes.ts` - Express routing

**API Endpoints**:
```
POST   /api/v1/daily-sheets                 - Create sheet
GET    /api/v1/daily-sheets                 - List sheets (with filters)
GET    /api/v1/daily-sheets/:id             - Get specific sheet
PUT    /api/v1/daily-sheets/:id             - Update sheet
POST   /api/v1/daily-sheets/:id/submit      - Submit for approval
POST   /api/v1/daily-sheets/:id/approve     - Approve/reject
DELETE /api/v1/daily-sheets/:id             - Delete sheet
```

#### 2. Monthly Sheets Module
**Location**: `apps/backend/src/modules/monthly-sheets/`

**Files**:
- `monthly-sheets.dto.ts` - Zod schemas
  - CreateMonthlySheetSchema
  - ApproveMonthlySheetSchema
  - MarkAsPaidSchema

- `monthly-sheets.service.ts` - Business logic
  - create(): Auto-calculate totals from daily sheets
  - submitForApproval()
  - approve()
  - markAsPaid(): Track payment status
  - Automatic recalculation of totals on daily sheet changes

- `monthly-sheets.controller.ts` - REST endpoints
- `monthly-sheets.routes.ts` - Express routing

**API Endpoints**:
```
POST   /api/v1/monthly-sheets             - Create sheet
GET    /api/v1/monthly-sheets             - List sheets
GET    /api/v1/monthly-sheets/:id         - Get specific sheet
PUT    /api/v1/monthly-sheets/:id         - Update sheet
POST   /api/v1/monthly-sheets/:id/submit  - Submit for approval
POST   /api/v1/monthly-sheets/:id/approve - Approve/reject
POST   /api/v1/monthly-sheets/:id/mark-paid - Mark as paid
DELETE /api/v1/monthly-sheets/:id         - Delete sheet
```

### Key Features
- **Workflow Management**: draft → submitted → approved → paid/rejected
- **Automatic Calculations**: Monthly totals calculated from daily sheets
- **Approval Tracking**: Who approved, when, and rejection feedback
- **Audit Trail**: createdBy, updatedBy, timestamps
- **Status Validation**: Can only update draft sheets, submit once

## Frontend Architecture

### Store Architecture (Angular Signals)

**Location**: `apps/admin/src/app/features/freelancer-sheets/sheets.store.ts`

```typescript
interface DailySheet {
  id, userId, projectId, sheetDate
  hoursWorked, hourlyRate, totalAmount
  description, tasksCompleted, notes
  status, createdAt, updatedAt
  lineItems[]
}

interface MonthlySheet {
  id, userId, projectId, month, year
  totalHours, totalAmount, averageHourlyRate
  workingDays, status, createdAt, updatedAt
}
```

**Store Methods**:
- Daily Sheets:
  - loadDailySheets(filters)
  - createDailySheet(data)
  - updateDailySheet(id, data)
  - submitDailySheet(id)
  - approveDailySheet(id, approved, rejectionReason)
  - deleteDailySheet(id)

- Monthly Sheets:
  - loadMonthlySheets(filters)
  - createMonthlySheet(data)
  - approveMonthlySheet(id, approved, rejectionReason)
  - markMonthlySheetAsPaid(id)

### API Integration Service

**Location**: `apps/admin/src/app/core/services/api-integration.service.ts`

Added methods:
- getDailySheets(), createDailySheet(), updateDailySheet()
- submitDailySheet(), approveDailySheet(), deleteDailySheet()
- getMonthlySheets(), createMonthlySheet()
- approveMonthlySheet(), markMonthlySheetAsPaid()

### Frontend Components (To Be Created)

#### 1. Daily Sheets List Component
**Path**: `apps/admin/src/app/features/freelancer-sheets/components/daily-sheets-list/`

**Features**:
- Display table of daily sheets with filters
- Date range filtering
- Status filtering (draft, submitted, approved, rejected)
- Inline quick-actions (edit, submit, delete)
- Pagination

**Template Elements**:
- Search and date filters
- Status badges with colors
- Hours and amount display
- Action buttons (Edit, View, Submit, Delete)

#### 2. Daily Sheet Form Component
**Path**: `apps/admin/src/app/features/freelancer-sheets/components/daily-sheet-form/`

**Features**:
- Create/edit forms with reactive forms
- Date picker for sheet date
- Hours and rate inputs (auto-calculate total)
- Dynamic line items (add/remove tasks)
- Submit for approval button
- Discard changes option

**Form Fields**:
- Date (required)
- Hours Worked (required, max 24)
- Hourly Rate (required)
- Description
- Tasks Completed
- Line Items (dynamic array)
  - Task Name
  - Hours
  - Optional Rate

#### 3. Monthly Sheets List Component
**Path**: `apps/admin/src/app/features/freelancer-sheets/components/monthly-sheets-list/`

**Features**:
- Display monthly summary
- Status badges
- Month/year display
- Total hours and amount
- Approval and payment status tracking

#### 4. Approval Component
**Path**: `apps/admin/src/app/features/freelancer-sheets/components/sheet-approval/`

**Features**:
- Manager/approver view
- Approve/reject buttons
- Rejection reason textarea
- View linked daily sheets
- Mark as paid (for monthly sheets)

### Routing

Add to `apps/admin/src/app/app.routes.ts`:
```typescript
{
  path: 'freelancer-sheets',
  component: FreelancerSheetsComponent,
  children: [
    { path: 'daily', component: DailySheetsListComponent },
    { path: 'daily/new', component: DailySheetFormComponent },
    { path: 'daily/:id/edit', component: DailySheetFormComponent },
    { path: 'daily/:id/view', component: DailySheetViewComponent },
    { path: 'monthly', component: MonthlySheetsListComponent },
    { path: 'monthly/new', component: MonthlySheetFormComponent },
    { path: 'monthly/:id/view', component: MonthlySheetViewComponent },
    { path: 'approval', component: ApprovalDashboardComponent },
  ]
}
```

## Database Migration

Create Prisma migration:
```bash
cd apps/backend
npx prisma migrate dev --name add_freelancer_sheets
```

This will:
1. Create `daily_sheets` table
2. Create `daily_sheet_line_items` table
3. Create `monthly_sheets` table
4. Add foreign key relationships
5. Create indexes for performance

## Implementation Checklist

### Backend
- [x] Database schema (DailySheet, DailySheetLineItem, MonthlySheet)
- [x] DTOs with Zod validation
- [x] Services (business logic)
- [x] Controllers (HTTP handlers)
- [x] Routes
- [ ] Integrate routes into main app.ts
- [ ] Add middleware for authorization
- [ ] Create database migration
- [ ] Add audit logging

### Frontend
- [ ] Create sheets store (✓ done)
- [ ] Add API integration methods (✓ done)
- [ ] Daily Sheets List Component
- [ ] Daily Sheet Form Component (Create/Edit)
- [ ] Daily Sheet View Component
- [ ] Monthly Sheets List Component
- [ ] Monthly Sheet Form Component
- [ ] Monthly Sheet View Component
- [ ] Approval Dashboard Component
- [ ] Add routing
- [ ] Add navigation menu items

### Testing
- [ ] Backend unit tests for services
- [ ] Backend API endpoint tests
- [ ] Frontend unit tests for store
- [ ] Frontend component tests
- [ ] E2E tests for workflows

### Features
- [ ] Email notifications on submission
- [ ] Email notifications on approval/rejection
- [ ] PDF export for monthly sheets
- [ ] Bulk approval for managers
- [ ] Analytics/reporting dashboard
- [ ] Payment tracking
- [ ] Invoice generation from sheets

## Usage Examples

### Creating a Daily Sheet
```typescript
// Frontend
this.sheetsStore.createDailySheet({
  userId: 'user-123',
  projectId: 'project-456',
  sheetDate: '2026-08-06',
  hoursWorked: 8,
  hourlyRate: 50,
  description: 'Frontend development',
  lineItems: [
    { taskName: 'Component creation', hours: 3, rate: 50 },
    { taskName: 'Bug fixes', hours: 2, rate: 50 },
    { taskName: 'Documentation', hours: 3, rate: 50 }
  ]
});
```

### Submitting for Approval
```typescript
this.sheetsStore.submitDailySheet('sheet-id');
```

### Approving a Sheet
```typescript
// Manager approves
this.sheetsStore.approveDailySheet('sheet-id', true);

// Manager rejects
this.sheetsStore.approveDailySheet('sheet-id', false, 'Hours exceed limit');
```

### Creating Monthly Sheet
```typescript
this.sheetsStore.createMonthlySheet({
  userId: 'user-123',
  month: 8,
  year: 2026,
  dailySheetIds: ['sheet-1', 'sheet-2', 'sheet-3', ...]
});
// Automatically calculates:
// - totalHours: sum of all daily sheet hours
// - totalAmount: sum of all daily sheet amounts
// - averageHourlyRate: totalAmount / totalHours
// - workingDays: count of unique working days
```

## Security Considerations

1. **Authorization**: Check user owns the sheet or is manager/approver
2. **Status Validation**: Prevent invalid state transitions
3. **Rate Limiting**: Limit sheet submissions per day
4. **Audit Logging**: Log all approvals and status changes
5. **Data Isolation**: Filter sheets by organization

## Performance Optimizations

1. **Indexes**:
   - userId + sheetDate for daily sheets
   - userId + month + year for monthly sheets
   - status for quick filtering

2. **Caching**:
   - Cache user's current month sheets in store
   - Invalidate on changes

3. **Pagination**: Default 20 items per page

## Future Enhancements

1. **Timesheet Clock-In/Out**: Real-time tracking
2. **Mobile App**: Native mobile timesheet tracking
3. **Integrations**: Sync with Slack, email notifications
4. **Advanced Reporting**: Charts, trends, analytics
5. **Project Billing**: Automatic invoice generation
6. **Multi-currency**: Support multiple currencies
7. **Overtime Tracking**: Track overtime separately
8. **Expense Tracking**: Add expense items to sheets
