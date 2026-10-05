import { Routes } from '@angular/router';

// Static segments come before `:id` so "new", "settings" and "clients" are not read as ids.
export const invoiceRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/invoice-list/invoice-list.component').then((m) => m.InvoiceListComponent),
    title: 'Invoices',
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/invoice-form/invoice-form.component').then((m) => m.InvoiceFormComponent),
    title: 'New Invoice',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/invoice-settings/invoice-settings.component').then(
        (m) => m.InvoiceSettingsComponent
      ),
    title: 'Invoice Settings',
  },
  {
    path: 'clients',
    loadComponent: () =>
      import('./pages/invoice-clients/invoice-clients.component').then(
        (m) => m.InvoiceClientsComponent
      ),
    title: 'Invoice Clients',
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/invoice-form/invoice-form.component').then((m) => m.InvoiceFormComponent),
    title: 'Edit Invoice',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/invoice-preview/invoice-preview.component').then(
        (m) => m.InvoicePreviewComponent
      ),
    title: 'Invoice',
  },
];
