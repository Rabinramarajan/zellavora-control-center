import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserListComponent } from './user-list.component';
import { AdminStoreService } from '../../../services';
import { User } from '../../../models';
import { signal } from '@angular/core';

describe('UserListComponent', () => {
  let component: UserListComponent;
  let fixture: ComponentFixture<UserListComponent>;
  let storeService: jasmine.SpyObj<AdminStoreService>;

  const mockUsers: User[] = [
    {
      userSerialId: 1,
      userLoginId: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      emailId: 'john@example.com',
      statusValue: 'Active',
      statusDescription: 'Active',
    },
    {
      userSerialId: 2,
      userLoginId: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      emailId: 'jane@example.com',
      statusValue: 'Inactive',
      statusDescription: 'Inactive',
    },
  ];

  beforeEach(async () => {
    const storeServiceSpy = jasmine.createSpyObj(
      'AdminStoreService',
      ['loadUsers'],
      {
        users: signal(mockUsers),
        loading: signal(false),
        error: signal(null),
      }
    );

    await TestBed.configureTestingModule({
      imports: [UserListComponent],
      providers: [{ provide: AdminStoreService, useValue: storeServiceSpy }]
    }).compileComponents();

    storeService = TestBed.inject(AdminStoreService) as jasmine.SpyObj<AdminStoreService>;
    storeService.loadUsers.and.returnValue(Promise.resolve(mockUsers));

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load users on init', () => {
    expect(storeService.loadUsers).toHaveBeenCalled();
  });

  it('should filter users by search term', () => {
    component.searchTerm.set('john');
    fixture.detectChanges();

    const filtered = component.filteredUsers();
    expect(filtered.length).toBe(1);
    expect(filtered[0].firstName).toBe('John');
  });

  it('should filter users by status', () => {
    component.statusFilter.set('Active');
    fixture.detectChanges();

    const filtered = component.filteredUsers();
    expect(filtered.length).toBe(1);
    expect(filtered[0].statusValue).toBe('Active');
  });

  it('should reset filters', () => {
    component.searchTerm.set('john');
    component.statusFilter.set('Active');

    component.onReset();

    expect(component.searchTerm()).toBe('');
    expect(component.statusFilter()).toBe('');
  });

  it('should handle pagination', () => {
    component.pageSize.set(1);
    fixture.detectChanges();

    expect(component.totalPages()).toBe(2);
    expect(component.canNextPage()).toBe(true);
    expect(component.canPreviousPage()).toBe(false);

    component.onNextPage();
    expect(component.currentPage()).toBe(2);
    expect(component.canPreviousPage()).toBe(true);
  });
});
