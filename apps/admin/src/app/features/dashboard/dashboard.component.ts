import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressBarModule } from 'primeng/progressbar';
import { RippleModule } from 'primeng/ripple';

interface Task {
  id: number;
  title: string;
  category: string;
  categoryClass: string;
  completed: boolean;
}

interface Activity {
  id: number;
  message: string;
  time: string;
  iconBg: string;
  iconColor: string;
  type: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ButtonModule, 
    CheckboxModule, 
    ProgressBarModule, 
    RippleModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  tasks: Task[] = [
    { id: 1, title: 'Review wireframes', category: 'Design', categoryClass: 'bg-purple-500/10 border border-purple-500/20 text-purple-400', completed: true },
    { id: 2, title: 'Client meeting', category: 'Meeting', categoryClass: 'bg-blue-500/10 border border-blue-500/20 text-blue-400', completed: true },
    { id: 3, title: 'API integration', category: 'Development', categoryClass: 'bg-amber-500/10 border border-amber-500/20 text-amber-400', completed: false },
    { id: 4, title: 'Testing & QA', category: 'Testing', categoryClass: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400', completed: false },
  ];

  activities: Activity[] = [
    { id: 1, message: 'Project <strong>Apollo</strong> was completed', time: '2 minutes ago', iconBg: 'bg-emerald-500/10 text-emerald-400', iconColor: 'emerald', type: 'project' },
    { id: 2, message: 'New client <strong>TechNova Inc.</strong> added', time: '15 minutes ago', iconBg: 'bg-purple-500/10 text-purple-400', iconColor: 'purple', type: 'client' },
    { id: 3, message: 'Invoice <strong>#INV-2025-0042</strong> paid', time: '1 hour ago', iconBg: 'bg-blue-500/10 text-blue-400', iconColor: 'blue', type: 'invoice' },
    { id: 4, message: 'Deployment <strong>v2.4.1</strong> successful', time: '3 hours ago', iconBg: 'bg-amber-500/10 text-amber-400', iconColor: 'amber', type: 'deployment' },
    { id: 5, message: 'New user <strong>John Doe</strong> joined', time: '5 hours ago', iconBg: 'bg-pink-500/10 text-pink-400', iconColor: 'pink', type: 'user' },
  ];
}
