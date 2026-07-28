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

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  status: 'Published' | 'Draft' | 'Scheduled';
  views: number;
  createdDate: string;
  updatedDate: string;
  image?: string;
}

@Component({
  selector: 'app-blog',
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
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.css',
})
export class BlogComponent implements OnInit {
  private messageService = inject(MessageService);

  searchTerm = '';
  selectedCategory: string | null = null;
  selectedStatus: string | null = null;

  categoryOptions = [
    { label: 'Web Development', value: 'Web Development' },
    { label: 'Tutorial', value: 'Tutorial' },
    { label: 'AI / Machine Learning', value: 'AI / Machine Learning' },
    { label: 'Backend', value: 'Backend' },
    { label: 'Performance', value: 'Performance' },
  ];

  statusOptions = [
    { label: 'Published', value: 'Published' },
    { label: 'Draft', value: 'Draft' },
    { label: 'Scheduled', value: 'Scheduled' },
  ];

  blogs: BlogPost[] = [
    { id: '1', title: 'Angular 22 Signals: The Future of Reactive Development', slug: 'angular-22-signals', category: 'Web Development', author: 'Rabin R', status: 'Published', views: 1240, createdDate: 'May 24, 2025', updatedDate: 'May 24, 2025' },
    { id: '2', title: 'Building a Portfolio with Angular & Tailwind CSS', slug: 'portfolio-angular-tailwind', category: 'Tutorial', author: 'Rabin R', status: 'Published', views: 980, createdDate: 'May 22, 2025', updatedDate: 'May 22, 2025' },
    { id: '3', title: 'Integrating AI in Web Applications', slug: 'ai-web-apps', category: 'AI / Machine Learning', author: 'Rabin R', status: 'Draft', views: 0, createdDate: 'May 20, 2025', updatedDate: 'May 20, 2025' },
    { id: '4', title: 'Why I Chose Supabase for My Projects', slug: 'supabase-choice', category: 'Backend', author: 'Rabin R', status: 'Published', views: 2400, createdDate: 'May 18, 2025', updatedDate: 'May 18, 2025' },
    { id: '5', title: 'TypeScript Tips Every Developer Should Know', slug: 'typescript-tips', category: 'Tutorial', author: 'Rabin R', status: 'Scheduled', views: 0, createdDate: 'May 28, 2025', updatedDate: 'May 28, 2025' },
    { id: '6', title: 'Web Performance Optimization Guide', slug: 'performance-guide', category: 'Performance', author: 'Rabin R', status: 'Published', views: 3140, createdDate: 'May 15, 2025', updatedDate: 'May 15, 2025' },
  ];

  filteredBlogs: BlogPost[] = [];

  ngOnInit() {
    this.filterBlogs();
  }

  filterBlogs() {
    this.filteredBlogs = this.blogs.filter(post => {
      const matchesSearch = !this.searchTerm ||
        post.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        post.slug.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesCategory = !this.selectedCategory || post.category === this.selectedCategory;
      const matchesStatus = !this.selectedStatus || post.status === this.selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedCategory = null;
    this.selectedStatus = null;
    this.filterBlogs();
  }

  createBlog() {
    this.messageService.add({
      severity: 'info',
      summary: 'Create Blog',
      detail: 'Opening blog creation form...',
    });
  }

  viewBlog(post: BlogPost) {
    this.messageService.add({
      severity: 'info',
      summary: 'View Blog',
      detail: `Viewing "${post.title}"`,
    });
  }

  editBlog(post: BlogPost) {
    this.messageService.add({
      severity: 'info',
      summary: 'Edit Blog',
      detail: `Editing "${post.title}"`,
    });
  }

  deleteBlog(post: BlogPost) {
    this.messageService.add({
      severity: 'warn',
      summary: 'Delete Blog',
      detail: `Deleting "${post.title}"...`,
    });
  }
}
