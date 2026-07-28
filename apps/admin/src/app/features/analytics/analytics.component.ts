import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SelectModule,
    CardModule,
    ToastModule,
  ],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
})
export class AnalyticsComponent implements OnInit {
  private messageService = inject(MessageService);

  selectedDateRange = 'week';

  dateRangeOptions = [
    { label: 'Last 7 days', value: 'week' },
    { label: 'Last 30 days', value: 'month' },
    { label: 'Last 3 months', value: 'quarter' },
    { label: 'Last year', value: 'year' },
  ];

  topPages = [
    { name: '/', views: 4200 },
    { name: '/projects', views: 2100 },
    { name: '/blog', views: 1800 },
    { name: '/about', views: 980 },
    { name: '/contact', views: 620 },
  ];

  trafficSources = [
    { name: 'Direct', icon: '🔗', count: 1500, percentage: 48 },
    { name: 'Organic Search', icon: '🔍', count: 896, percentage: 28 },
    { name: 'Social Media', icon: '📱', count: 448, percentage: 14 },
    { name: 'Referral', icon: '👥', count: 224, percentage: 7 },
    { name: 'Others', icon: '📊', count: 96, percentage: 3 },
  ];

  topCountries = [
    { name: 'India', flag: '🇮🇳', count: '1.8K' },
    { name: 'United States', flag: '🇺🇸', count: '620' },
    { name: 'United Kingdom', flag: '🇬🇧', count: '310' },
    { name: 'Canada', flag: '🇨🇦', count: '210' },
    { name: 'Australia', flag: '🇦🇺', count: '150' },
  ];

  topBrowsers = [
    { name: 'Chrome', icon: '🌐', count: '2.2K' },
    { name: 'Firefox', icon: '🦊', count: '620' },
    { name: 'Safari', icon: '🧭', count: '310' },
    { name: 'Edge', icon: '📘', count: '180' },
  ];

  ngOnInit() {
    // Initialize analytics
  }
}
