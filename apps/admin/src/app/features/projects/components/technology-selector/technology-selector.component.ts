import { Component, input, output, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TechnologyService } from '../../services/technology.service';

@Component({
  selector: 'app-technology-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './technology-selector.component.html',
  styleUrl: './technology-selector.component.css',
})
export class TechnologySelectorComponent {
  readonly projectId = input<string | null>(null);
  readonly technologiesChanged = output<string[]>();

  technology = inject(TechnologyService);

  searchQuery = '';
  filterCategory: string | null = null;

  constructor() {
    effect(() => {
      const projId = this.projectId();
      if (projId) {
        this.technology.getProjectTechnologies(projId).subscribe();
      }
    });
  }

  categories() {
    const cats = new Set(
      this.technology
        .allTechnologies()
        .map((t) => t.category)
        .filter((c) => c)
    );
    return Array.from(cats).sort();
  }

  filteredTechnologies() {
    return this.technology.allTechnologies().filter((tech) => {
      const matchesSearch =
        !this.searchQuery ||
        tech.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        tech.description?.toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchesCategory =
        !this.filterCategory || tech.category === this.filterCategory;

      return matchesSearch && matchesCategory;
    });
  }

  selectedTechnologies() {
    const ids = new Set(
      this.technology.projectTechnologies().map((pt) => pt.technologyId)
    );
    return this.technology
      .allTechnologies()
      .filter((t) => ids.has(t.id))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }

  isSelected(id: string): boolean {
    return this.technology.selectedTechIds().includes(id);
  }

  toggleTechnology(id: string): void {
    const projId = this.projectId();
    if (!projId) return;

    if (this.isSelected(id)) {
      this.technology
        .removeTechnologyFromProject(projId, id)
        .subscribe(() => {
          this.emitChanges();
        });
    } else {
      this.technology
        .addTechnologyToProject(projId, id)
        .subscribe(() => {
          this.emitChanges();
        });
    }
  }

  removeTechnology(id: string): void {
    const projId = this.projectId();
    if (!projId) return;

    this.technology
      .removeTechnologyFromProject(projId, id)
      .subscribe(() => {
        this.emitChanges();
      });
  }

  private emitChanges(): void {
    this.technologiesChanged.emit(
      this.technology.selectedTechIds()
    );
  }
}
