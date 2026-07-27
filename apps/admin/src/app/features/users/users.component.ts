import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: 'Online' | 'Offline';
  joinedDate: string;
  lastLogin: string;
  branch?: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    DropdownModule,
    PaginatorModule,
    ToastModule,
  ],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white">User Management</h1>
          <p class="text-slate-400 mt-1">Manage system users, roles, permissions and branch access.</p>
        </div>
        <button
          pButton
          pRipple
          label="Add New User"
          icon="pi pi-plus"
          class="p-button-primary"
          (click)="showAddUserModal = true">
        </button>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
        <!-- Total Users -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Total Users</span>
              <span class="text-3xl font-bold text-white block mt-2">128</span>
              <span class="text-xs text-emerald-400 font-semibold mt-1">↑ 12 this month</span>
            </div>
            <div class="text-3xl">👥</div>
          </div>
        </div>

        <!-- Active Users -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Active Users</span>
              <span class="text-3xl font-bold text-white block mt-2">98</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">76.6% of total</span>
            </div>
            <div class="text-3xl">🟢</div>
          </div>
        </div>

        <!-- Admins -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Super Admins</span>
              <span class="text-3xl font-bold text-white block mt-2">5</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">3.9% of total</span>
            </div>
            <div class="text-3xl">👑</div>
          </div>
        </div>

        <!-- Editors -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Editors</span>
              <span class="text-3xl font-bold text-white block mt-2">26</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">20.3% of total</span>
            </div>
            <div class="text-3xl">✏️</div>
          </div>
        </div>

        <!-- Viewers -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Viewers</span>
              <span class="text-3xl font-bold text-white block mt-2">90</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">70.3% of total</span>
            </div>
            <div class="text-3xl">👁️</div>
          </div>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Search by name, email or role</label>
            <input
              pInputText
              type="text"
              placeholder="Search users..."
              class="w-full"
              [(ngModel)]="searchTerm"
              (ngModelChange)="filterUsers()"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Role</label>
            <p-dropdown
              [options]="roleOptions"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="selectedRole"
              (ngModelChange)="filterUsers()"
              placeholder="All Roles"
              [showClear]="true">
            </p-dropdown>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Status</label>
            <p-dropdown
              [options]="statusOptions"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="selectedStatus"
              (ngModelChange)="filterUsers()"
              placeholder="All Status"
              [showClear]="true">
            </p-dropdown>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Branch</label>
            <p-dropdown
              [options]="branchOptions"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="selectedBranch"
              (ngModelChange)="filterUsers()"
              placeholder="All Branches"
              [showClear]="true">
            </p-dropdown>
          </div>

          <div class="flex items-end">
            <button
              pButton
              pRipple
              label="Clear Filters"
              icon="pi pi-filter-slash"
              class="p-button-text w-full"
              (click)="clearFilters()">
            </button>
          </div>
        </div>
      </div>

      <!-- Users Table -->
      <div class="bg-[#07051a] border border-white/10 rounded-2xl overflow-hidden">
        <p-table
          [value]="filteredUsers"
          [paginator]="true"
          [rows]="10"
          [pageLinks]="5"
          [rowsPerPageOptions]="[10, 20, 50]"
          responsiveLayout="scroll"
          class="p-datatable-dark">

          <ng-template pTemplate="header">
            <tr class="bg-white/5 border-b border-white/10">
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">User</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Role</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Branch</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Last Login</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Joined</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Actions</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-user>
            <tr class="border-b border-white/5 hover:bg-white/5 transition">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-purple-600/30 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
                    {{ user.name.charAt(0) }}
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-white">{{ user.name }}</p>
                    <p class="text-xs text-slate-400">{{ user.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold" [ngClass]="{
                  'bg-purple-500/10 border border-purple-500/30 text-purple-400': user.role === 'Super Admin',
                  'bg-blue-500/10 border border-blue-500/30 text-blue-400': user.role === 'Admin',
                  'bg-amber-500/10 border border-amber-500/30 text-amber-400': user.role === 'Manager',
                  'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400': user.role === 'Editor',
                  'bg-orange-500/10 border border-orange-500/30 text-orange-400': user.role === 'Viewer'
                }">
                  {{ user.role }}
                </span>
              </td>
              <td class="px-6 py-4">
                <p class="text-sm text-slate-300">{{ user.branch || 'Head Office' }}</p>
              </td>
              <td class="px-6 py-4">
                <span class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full" [ngClass]="{'bg-emerald-500': user.status === 'Online', 'bg-slate-500': user.status === 'Offline'}"></span>
                  <span class="text-sm text-slate-300">{{ user.status }}</span>
                </span>
              </td>
              <td class="px-6 py-4">
                <p class="text-sm text-slate-400">{{ user.lastLogin }}</p>
              </td>
              <td class="px-6 py-4">
                <p class="text-sm text-slate-400">{{ user.joinedDate }}</p>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <button
                    pButton
                    pRipple
                    icon="pi pi-eye"
                    class="p-button-rounded p-button-text p-button-sm"
                    title="View"
                    (click)="viewUser(user)">
                  </button>
                  <button
                    pButton
                    pRipple
                    icon="pi pi-pencil"
                    class="p-button-rounded p-button-text p-button-sm"
                    title="Edit"
                    (click)="editUser(user)">
                  </button>
                  <button
                    pButton
                    pRipple
                    icon="pi pi-trash"
                    class="p-button-rounded p-button-danger p-button-text p-button-sm"
                    title="Delete"
                    (click)="deleteUser(user)">
                  </button>
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `,
  styles: [],
})
export class UsersComponent implements OnInit {
  private messageService = inject(MessageService);

  showAddUserModal = false;
  searchTerm = '';
  selectedRole: string | null = null;
  selectedStatus: string | null = null;
  selectedBranch: string | null = null;

  roleOptions = [
    { label: 'Super Admin', value: 'Super Admin' },
    { label: 'Admin', value: 'Admin' },
    { label: 'Manager', value: 'Manager' },
    { label: 'Editor', value: 'Editor' },
    { label: 'Viewer', value: 'Viewer' },
  ];

  statusOptions = [
    { label: 'Online', value: 'Online' },
    { label: 'Offline', value: 'Offline' },
  ];

  branchOptions = [
    { label: 'Head Office', value: 'Head Office' },
    { label: 'Chennai Branch', value: 'Chennai Branch' },
    { label: 'Bangalore Branch', value: 'Bangalore Branch' },
    { label: 'Hyderabad Branch', value: 'Hyderabad Branch' },
  ];

  users: User[] = [
    { id: '1', name: 'Rabin R', email: 'rabin@zellavora.com', role: 'Super Admin', status: 'Online', joinedDate: 'Jan 10, 2025', lastLogin: 'May 24, 2025 10:30 AM', branch: 'Head Office' },
    { id: '2', name: 'Ananya S', email: 'ananya@zellavora.com', role: 'Admin', status: 'Online', joinedDate: 'Feb 18, 2025', lastLogin: 'May 24, 2025 09:15 AM', branch: 'Head Office' },
    { id: '3', name: 'Karthik P', email: 'karthik@zellavora.com', role: 'Manager', status: 'Online', joinedDate: 'Mar 02, 2025', lastLogin: 'May 23, 2025 06:45 PM', branch: 'Chennai Branch' },
    { id: '4', name: 'Meera R', email: 'meera@zellavora.com', role: 'Editor', status: 'Online', joinedDate: 'Apr 11, 2025', lastLogin: 'May 24, 2025 12:10 PM', branch: 'Bangalore Branch' },
    { id: '5', name: 'Vikram T', email: 'vikram@zellavora.com', role: 'Viewer', status: 'Offline', joinedDate: 'Apr 30, 2025', lastLogin: 'May 19, 2025 11:20 AM', branch: 'Hyderabad Branch' },
    { id: '6', name: 'Divya L', email: 'divya@zellavora.com', role: 'Editor', status: 'Online', joinedDate: 'May 05, 2025', lastLogin: 'May 24, 2025 08:40 AM', branch: 'Coimbatore Branch' },
    { id: '7', name: 'Arun Kumar', email: 'arun@zellavora.com', role: 'Manager', status: 'Offline', joinedDate: 'Jan 25, 2025', lastLogin: 'May 19, 2025 03:30 PM', branch: 'Pune Branch' },
    { id: '8', name: 'Sneha M', email: 'sneha@zellavora.com', role: 'Viewer', status: 'Offline', joinedDate: 'Feb 15, 2025', lastLogin: 'May 17, 2025 10:00 AM', branch: 'Head Office' },
  ];

  filteredUsers: User[] = [];

  ngOnInit() {
    this.filterUsers();
  }

  filterUsers() {
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = !this.searchTerm ||
        user.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesRole = !this.selectedRole || user.role === this.selectedRole;
      const matchesStatus = !this.selectedStatus || user.status === this.selectedStatus;
      const matchesBranch = !this.selectedBranch || user.branch === this.selectedBranch;

      return matchesSearch && matchesRole && matchesStatus && matchesBranch;
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedRole = null;
    this.selectedStatus = null;
    this.selectedBranch = null;
    this.filterUsers();
  }

  viewUser(user: User) {
    this.messageService.add({
      severity: 'info',
      summary: 'View User',
      detail: `Viewing ${user.name}'s profile`,
    });
  }

  editUser(user: User) {
    this.messageService.add({
      severity: 'info',
      summary: 'Edit User',
      detail: `Editing ${user.name}'s profile`,
    });
  }

  deleteUser(user: User) {
    this.messageService.add({
      severity: 'warn',
      summary: 'Delete User',
      detail: `Deleting ${user.name}...`,
    });
  }
}
