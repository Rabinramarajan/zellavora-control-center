import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectsService } from '../../services/projects.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './projects-list.component.html',
  styleUrl: './projects-list.component.css',
})
export class ProjectsListComponent {
  projects = inject(ProjectsService);
  filterStatus: 'published' | 'draft' | 'archived' | null = null;

  filteredProjects() {
    if (!this.filterStatus) {
      return this.projects.projects();
    }
    return this.projects.projects().filter((p) => p.status === this.filterStatus);
  }

  async deleteProject(id: string): Promise<void> {
    if (confirm('Are you sure you want to delete this project?')) {
      await firstValueFrom(this.projects.deleteProject(id));
    }
  }
}
