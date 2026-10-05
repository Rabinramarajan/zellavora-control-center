import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BreadcrumbService } from './breadcrumb.service';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('BreadcrumbService', () => {
  let service: BreadcrumbService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'dashboard', component: BlankComponent, data: { breadcrumb: 'Dashboard' } },
          {
            path: 'iam',
            children: [
              {
                path: 'users',
                children: [
                  { path: '', component: BlankComponent, data: { title: 'Users' } },
                  { path: ':id', component: BlankComponent, data: { title: 'User Details' } },
                ],
              },
              {
                path: 'organization/teams',
                component: BlankComponent,
                data: { breadcrumb: 'Teams' },
              },
            ],
          },
          {
            path: 'invoices',
            children: [
              { path: '', component: BlankComponent, title: 'Invoices · ZCC' },
              { path: ':id/edit', component: BlankComponent, data: { title: 'Edit Invoice' } },
            ],
          },
          { path: 'settings/:tab', component: BlankComponent },
        ]),
      ],
    });
    service = TestBed.inject(BreadcrumbService);
    router = TestBed.inject(Router);
  });

  const labels = (): string[] => service.items().map((item) => item.label);

  it('labels a single-level route and leaves it unlinked', async () => {
    await router.navigateByUrl('/dashboard');
    expect(labels()).toEqual(['Dashboard']);
    expect(service.items()[0].url).toBeNull();
  });

  it('builds a nested trail with links on every parent', async () => {
    await router.navigateByUrl('/iam/users');
    expect(labels()).toEqual(['Identity & Access', 'Users']);
    expect(service.items()[0].url).toBe('/iam');
    expect(service.items()[1].url).toBeNull();
  });

  it('names a detail route from route data and keeps the parent clickable', async () => {
    await router.navigateByUrl('/iam/users/42');
    expect(labels()).toEqual(['Identity & Access', 'Users', 'User Details']);
    expect(service.items()[1].url).toBe('/iam/users');
  });

  it('replaces the last crumb with a label the page resolves', async () => {
    await router.navigateByUrl('/iam/users/42');
    service.setCurrentLabel('Ada Lovelace');
    expect(labels()).toEqual(['Identity & Access', 'Users', 'Ada Lovelace']);
  });

  it('drops a resolved label when the user navigates on', async () => {
    await router.navigateByUrl('/iam/users/42');
    service.setCurrentLabel('Ada Lovelace');
    await router.navigateByUrl('/dashboard');
    expect(labels()).toEqual(['Dashboard']);
  });

  it('skips an id that sits in the middle of a path', async () => {
    await router.navigateByUrl('/invoices/7/edit');
    expect(labels()).toEqual(['Invoices', 'Edit Invoice']);
    expect(service.items()[0].url).toBe('/invoices');
  });

  it('falls back to the page title without its browser-tab suffix', async () => {
    await router.navigateByUrl('/invoices');
    expect(labels()).toEqual(['Invoices']);
  });

  it('crumbs every static segment of a multi-segment route', async () => {
    await router.navigateByUrl('/iam/organization/teams');
    expect(labels()).toEqual(['Identity & Access', 'Organization', 'Teams']);
  });

  it('humanises a parameter value when no label is configured', async () => {
    await router.navigateByUrl('/settings/email-templates');
    expect(labels()).toEqual(['Settings', 'Email Templates']);
  });
});
