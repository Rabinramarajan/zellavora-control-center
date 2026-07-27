# API Integration & File Upload Guide

This guide shows how to integrate the backend APIs and file upload functionality into your components.

## Table of Contents

1. [File Upload Service](#file-upload-service)
2. [API Integration Service](#api-integration-service)
3. [Component Examples](#component-examples)
4. [Error Handling](#error-handling)
5. [Best Practices](#best-practices)

## File Upload Service

The `FileUploadService` provides methods for uploading files to your backend storage.

### Basic Usage

```typescript
import { Component, inject } from '@angular/core';
import { FileUploadService, UploadResponse } from '@core/services';

@Component({
  selector: 'app-upload-example',
  template: `
    <input type="file" #fileInput (change)="onFileSelected($event)" />
    <button (click)="uploadFile()">Upload</button>
    <div *ngIf="uploading">Uploading: {{ uploadProgress }}%</div>
  `
})
export class UploadExampleComponent {
  private fileUploadService = inject(FileUploadService);
  
  selectedFile: File | null = null;
  uploading = false;
  uploadProgress = 0;

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files?.[0]) {
      this.selectedFile = target.files[0];
    }
  }

  uploadFile(): void {
    if (!this.selectedFile) return;

    // Validate file before upload
    const validation = this.fileUploadService.validateFile(this.selectedFile, {
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
    });

    if (!validation.valid) {
      console.error(validation.error);
      return;
    }

    this.uploading = true;
    this.fileUploadService.uploadFile(this.selectedFile, 'portfolio')
      .subscribe({
        next: (response: UploadResponse) => {
          console.log('File uploaded:', response);
          this.uploading = false;
        },
        error: (error) => {
          console.error('Upload failed:', error);
          this.uploading = false;
        }
      });
  }
}
```

### Multiple File Upload

```typescript
uploadMultipleFiles(files: File[]): void {
  this.fileUploadService.uploadMultipleFiles(files, 'gallery')
    .subscribe({
      next: (responses: UploadResponse[]) => {
        console.log('All files uploaded:', responses);
        // Handle uploaded files
        responses.forEach(response => {
          console.log(`${response.data?.filename}: ${response.data?.url}`);
        });
      },
      error: (error) => {
        console.error('Upload failed:', error);
      }
    });
}
```

### Track Upload Progress

```typescript
uploadWithProgress(): void {
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  if (fileInput.files?.[0]) {
    const file = fileInput.files[0];
    
    // Upload file
    this.fileUploadService.uploadFile(file, 'media')
      .subscribe({
        next: (response) => {
          console.log('Upload complete:', response);
        }
      });

    // Track progress
    this.fileUploadService.getUploadProgress()
      .subscribe((progress) => {
        this.uploadProgress = Math.round((progress.loaded / progress.total) * 100);
      });
  }
}
```

### Get Presigned URL for Direct S3 Upload

```typescript
getPresignedUrl(): void {
  this.fileUploadService.getPresignedUrl('my-file.jpg', 'image/jpeg')
    .subscribe({
      next: (response) => {
        console.log('Presigned URL:', response.url);
        // Use URL to upload directly to S3
      }
    });
}
```

## API Integration Service

The `ApiIntegrationService` provides methods for all backend API endpoints.

### Users Management

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { ApiIntegrationService, ApiListResponse } from '@core/services';

@Component({
  selector: 'app-users-list',
  template: `
    <div *ngFor="let user of users">
      <h3>{{ user.name }}</h3>
      <p>{{ user.email }}</p>
    </div>
  `
})
export class UsersListComponent implements OnInit {
  private apiService = inject(ApiIntegrationService);
  
  users: any[] = [];

  ngOnInit(): void {
    // Fetch users with filters
    this.apiService.getUsers({
      role: 'Admin',
      status: 'Active',
      page: 1,
      limit: 20
    }).subscribe({
      next: (response: ApiListResponse<any>) => {
        this.users = response.data;
        console.log(`Loaded ${response.total} users`);
      },
      error: (error) => {
        console.error('Failed to fetch users:', error);
      }
    });
  }

  createUser(user: any): void {
    this.apiService.createUser(user).subscribe({
      next: (response) => {
        console.log('User created:', response.data);
        // Add to list
        this.users.push(response.data);
      }
    });
  }

  updateUser(id: string, user: any): void {
    this.apiService.updateUser(id, user).subscribe({
      next: (response) => {
        console.log('User updated:', response.data);
        // Update in list
        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
          this.users[index] = response.data;
        }
      }
    });
  }

  deleteUser(id: string): void {
    this.apiService.deleteUser(id).subscribe({
      next: () => {
        console.log('User deleted');
        // Remove from list
        this.users = this.users.filter(u => u.id !== id);
      }
    });
  }
}
```

### Blog Management

```typescript
export class BlogComponent {
  private apiService = inject(ApiIntegrationService);
  
  posts: any[] = [];

  loadBlogPosts(): void {
    this.apiService.getBlogPosts({
      category: 'Tutorial',
      status: 'Published',
      limit: 10
    }).subscribe({
      next: (response) => {
        this.posts = response.data;
      }
    });
  }

  createPost(post: any): void {
    this.apiService.createBlogPost(post).subscribe({
      next: (response) => {
        console.log('Post created:', response.data);
        this.posts.push(response.data);
      }
    });
  }

  publishPost(postId: string): void {
    this.apiService.publishBlogPost(postId).subscribe({
      next: (response) => {
        console.log('Post published');
        // Update post in list
      }
    });
  }
}
```

### Media Files

```typescript
export class MediaGalleryComponent {
  private apiService = inject(ApiIntegrationService);
  private fileUploadService = inject(FileUploadService);
  
  mediaFiles: any[] = [];

  loadMediaFiles(): void {
    this.apiService.getMediaFiles({
      type: 'image',
      category: 'Portfolio',
      limit: 50
    }).subscribe({
      next: (response) => {
        this.mediaFiles = response.data;
      }
    });
  }

  uploadMediaFile(file: File): void {
    // Upload file first
    this.fileUploadService.uploadFile(file, 'portfolio')
      .subscribe({
        next: (uploadResponse) => {
          // File is now on server, update metadata if needed
          this.apiService.updateMediaMetadata(uploadResponse.data!.id, {
            description: 'Portfolio image'
          }).subscribe({
            next: () => {
              console.log('Media metadata updated');
              this.loadMediaFiles(); // Reload list
            }
          });
        }
      });
  }

  deleteMediaFile(fileId: string): void {
    this.apiService.deleteMediaFile(fileId).subscribe({
      next: () => {
        console.log('File deleted');
        this.mediaFiles = this.mediaFiles.filter(f => f.id !== fileId);
      }
    });
  }
}
```

### Analytics

```typescript
export class AnalyticsComponent implements OnInit {
  private apiService = inject(ApiIntegrationService);
  
  stats: any;
  trafficData: any;

  ngOnInit(): void {
    // Get analytics stats
    this.apiService.getAnalytics({
      dateRange: '7d'
    }).subscribe({
      next: (response) => {
        this.stats = response.data;
      }
    });

    // Get traffic data
    this.apiService.getTrafficData('7d').subscribe({
      next: (response) => {
        this.trafficData = response.data;
      }
    });
  }

  loadDeviceBreakdown(): void {
    this.apiService.getDeviceBreakdown().subscribe({
      next: (response) => {
        console.log('Device breakdown:', response.data);
      }
    });
  }

  loadTopPages(): void {
    this.apiService.getTopPages().subscribe({
      next: (response) => {
        console.log('Top pages:', response.data);
      }
    });
  }
}
```

### Portfolio Sections

```typescript
export class PortfolioEditorComponent {
  private apiService = inject(ApiIntegrationService);
  
  heroData: any;

  loadHeroSection(): void {
    this.apiService.getPortfolioSection('hero').subscribe({
      next: (response) => {
        this.heroData = response.data;
      }
    });
  }

  saveHeroSection(): void {
    this.apiService.updatePortfolioSection('hero', this.heroData)
      .subscribe({
        next: (response) => {
          console.log('Hero section updated');
        }
      });
  }

  loadAboutSection(): void {
    this.apiService.getPortfolioSection('about').subscribe({
      next: (response) => {
        console.log('About section:', response.data);
      }
    });
  }
}
```

## Component Examples

### Complete Media Upload Component

```typescript
@Component({
  selector: 'app-media-uploader',
  template: `
    <div class="upload-container">
      <input type="file" multiple #fileInput hidden />
      <button (click)="fileInput.click()">Select Files</button>
      
      <div *ngIf="uploadingFiles.length > 0" class="upload-progress">
        <div *ngFor="let file of uploadingFiles">
          <span>{{ file.name }}</span>
          <div class="progress-bar">
            <div [style.width.%]="file.progress"></div>
          </div>
        </div>
      </div>

      <div *ngIf="uploadedFiles.length > 0" class="uploaded-files">
        <h3>Uploaded Files</h3>
        <div *ngFor="let file of uploadedFiles">
          <img [src]="file.thumbnail" [alt]="file.filename" />
          <p>{{ file.filename }}</p>
          <button (click)="deleteFile(file.id)">Delete</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .upload-container {
      padding: 2rem;
    }
    .progress-bar {
      height: 4px;
      background: #e0e0e0;
      margin: 0.5rem 0;
    }
    .progress-bar div {
      height: 100%;
      background: #4f46e5;
      transition: width 0.3s;
    }
    .uploaded-files {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
  `]
})
export class MediaUploaderComponent {
  private fileUploadService = inject(FileUploadService);
  private apiService = inject(ApiIntegrationService);

  uploadingFiles: { name: string; progress: number }[] = [];
  uploadedFiles: any[] = [];

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      Array.from(input.files).forEach(file => {
        this.uploadFile(file);
      });
    }
  }

  private uploadFile(file: File): void {
    // Add to uploading list
    const uploadingFile = { name: file.name, progress: 0 };
    this.uploadingFiles.push(uploadingFile);

    // Upload file
    this.fileUploadService.uploadFile(file, 'portfolio')
      .subscribe({
        next: (response) => {
          // Add to uploaded files
          this.uploadedFiles.push(response.data);
          
          // Remove from uploading
          this.uploadingFiles = this.uploadingFiles.filter(
            f => f.name !== file.name
          );
        },
        error: (error) => {
          console.error('Upload failed:', error);
          this.uploadingFiles = this.uploadingFiles.filter(
            f => f.name !== file.name
          );
        }
      });

    // Track progress
    this.fileUploadService.getUploadProgress()
      .subscribe((progress) => {
        const currentFile = this.uploadingFiles.find(f => f.name === file.name);
        if (currentFile) {
          currentFile.progress = Math.round(
            (progress.loaded / progress.total) * 100
          );
        }
      });
  }

  deleteFile(fileId: string): void {
    this.apiService.deleteMediaFile(fileId).subscribe({
      next: () => {
        this.uploadedFiles = this.uploadedFiles.filter(f => f.id !== fileId);
      }
    });
  }
}
```

## Error Handling

Implement comprehensive error handling:

```typescript
private handleApiError(error: any): void {
  if (error.status === 401) {
    // Unauthorized - redirect to login
    this.router.navigate(['/auth/login']);
  } else if (error.status === 403) {
    // Forbidden - show permission error
    this.messageService.add({
      severity: 'error',
      summary: 'Access Denied',
      detail: 'You do not have permission to perform this action'
    });
  } else if (error.status === 404) {
    // Not found
    this.messageService.add({
      severity: 'error',
      summary: 'Not Found',
      detail: 'The requested resource was not found'
    });
  } else if (error.status === 500) {
    // Server error
    this.messageService.add({
      severity: 'error',
      summary: 'Server Error',
      detail: 'An unexpected server error occurred'
    });
  } else {
    // Other errors
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: error.error?.message || 'An error occurred'
    });
  }
}
```

## Best Practices

1. **Always validate files before upload**
   ```typescript
   const validation = this.fileUploadService.validateFile(file, {
     maxSize: 50 * 1024 * 1024,
     allowedTypes: ['image/jpeg', 'image/png']
   });
   ```

2. **Use proper error handling and user feedback**
   ```typescript
   .subscribe({
     next: (response) => { /* Handle success */ },
     error: (error) => { /* Handle error */ },
     complete: () => { /* Cleanup */ }
   });
   ```

3. **Cache API responses when appropriate**
   ```typescript
   private cache = new Map<string, any>();
   
   getUsers(): Observable<any> {
     if (this.cache.has('users')) {
       return of(this.cache.get('users'));
     }
     return this.apiService.getUsers().pipe(
       tap(response => this.cache.set('users', response))
     );
   }
   ```

4. **Use RxJS operators for better control**
   ```typescript
   this.apiService.getUsers()
     .pipe(
       debounceTime(300),
       distinctUntilChanged(),
       tap(data => console.log('Data loaded:', data)),
       catchError(error => {
         console.error('Error:', error);
         return of([]);
       })
     )
     .subscribe(users => this.users = users);
   ```

5. **Unsubscribe from observables to prevent memory leaks**
   ```typescript
   private destroy$ = new Subject<void>();

   ngOnInit(): void {
     this.apiService.getUsers()
       .pipe(takeUntil(this.destroy$))
       .subscribe(users => this.users = users);
   }

   ngOnDestroy(): void {
     this.destroy$.next();
     this.destroy$.complete();
   }
   ```

---

For more information, see the [DEPLOYMENT.md](DEPLOYMENT.md) guide.
