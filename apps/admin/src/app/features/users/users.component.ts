import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
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
    SelectModule,
    PaginatorModule,
    ToastModule,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
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
