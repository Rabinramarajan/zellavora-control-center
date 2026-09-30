import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';

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
    ButtonModule,
    TableModule,
    ToastModule,
    FormInputControl,
    SelectControl,
    PaginationComponent,
  ],
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogComponent {
  private messageService = inject(MessageService);

  readonly searchTerm = signal('');
  readonly selectedCategory = signal<string | null>(null);
  readonly selectedStatus = signal<string | null>(null);

  categoryOptions: SelectControlOption[] = [
    { label: 'All Categories', value: '' },
    { label: 'Web Development', value: 'Web Development' },
    { label: 'Tutorial', value: 'Tutorial' },
    { label: 'AI / Machine Learning', value: 'AI / Machine Learning' },
    { label: 'Backend', value: 'Backend' },
    { label: 'Performance', value: 'Performance' },
  ];

  statusOptions: SelectControlOption[] = [
    { label: 'All Status', value: '' },
    { label: 'Published', value: 'Published' },
    { label: 'Draft', value: 'Draft' },
    { label: 'Scheduled', value: 'Scheduled' },
  ];

  readonly blogs = signal<BlogPost[]>([
    {
      id: '1',
      title: 'Angular 22 Signals: The Future of Reactive Development',
      slug: 'angular-22-signals',
      category: 'Web Development',
      author: 'Rabin R',
      status: 'Published',
      views: 1240,
      createdDate: 'May 24, 2025',
      updatedDate: 'May 24, 2025',
    },
    {
      id: '2',
      title: 'Building a Portfolio with Angular & Tailwind CSS',
      slug: 'portfolio-angular-tailwind',
      category: 'Tutorial',
      author: 'Rabin R',
      status: 'Published',
      views: 980,
      createdDate: 'May 22, 2025',
      updatedDate: 'May 22, 2025',
    },
    {
      id: '3',
      title: 'Integrating AI in Web Applications',
      slug: 'ai-web-apps',
      category: 'AI / Machine Learning',
      author: 'Rabin R',
      status: 'Draft',
      views: 0,
      createdDate: 'May 20, 2025',
      updatedDate: 'May 20, 2025',
    },
    {
      id: '4',
      title: 'Why I Chose Supabase for My Projects',
      slug: 'supabase-choice',
      category: 'Backend',
      author: 'Rabin R',
      status: 'Published',
      views: 2400,
      createdDate: 'May 18, 2025',
      updatedDate: 'May 18, 2025',
    },
    {
      id: '5',
      title: 'TypeScript Tips Every Developer Should Know',
      slug: 'typescript-tips',
      category: 'Tutorial',
      author: 'Rabin R',
      status: 'Scheduled',
      views: 0,
      createdDate: 'May 28, 2025',
      updatedDate: 'May 28, 2025',
    },
    {
      id: '6',
      title: 'Web Performance Optimization Guide',
      slug: 'performance-guide',
      category: 'Performance',
      author: 'Rabin R',
      status: 'Published',
      views: 3140,
      createdDate: 'May 15, 2025',
      updatedDate: 'May 15, 2025',
    },
  ]);

  readonly filteredBlogs = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const category = this.selectedCategory();
    const status = this.selectedStatus();
    return this.blogs().filter((post) => {
      const matchesSearch =
        !term || post.title.toLowerCase().includes(term) || post.slug.toLowerCase().includes(term);
      const matchesCategory = !category || post.category === category;
      const matchesStatus = !status || post.status === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  });

  readonly pageSizeOptions = [10, 20, 50];
  readonly pageSize = signal(10);
  // Any filter change jumps back to the first page.
  readonly page = linkedSignal({ source: this.filteredBlogs, computation: () => 1 });

  readonly pagedBlogs = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredBlogs().slice(start, start + this.pageSize());
  });

  clearFilters() {
    this.searchTerm.set('');
    this.selectedCategory.set(null);
    this.selectedStatus.set(null);
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
