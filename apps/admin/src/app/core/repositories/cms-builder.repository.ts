import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CmsBuilderApiService } from '@core/api/cms-builder.api';
import { CmsPage } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class CmsBuilderRepository {
  private readonly api = inject(CmsBuilderApiService);

  private readonly _pages = signal<CmsPage[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly pages = computed(() => this._pages());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  loadPages(): Observable<CmsPage[]> {
    this._loading.set(true);
    return this.api.getPages().pipe(
      tap((data) => {
        this._pages.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        // Dev fallback
        const mockPages: CmsPage[] = [
          {
            id: '1',
            title: 'Landing Page',
            slug: 'landing',
            metaTitle: 'Welcome to Zellavora',
            metaDescription: 'Multi-Product Portal',
            sections: [
              { id: '101', type: 'header', title: 'Site Header', content: { logo: 'Zellavora', links: 'Home, Products' }, orderIndex: 0 },
              { id: '102', type: 'hero', title: 'Main Banner', content: { headline: 'Innovating Future Products', subheadline: 'ZellCredit and Galaxy Sofas custom builders.' }, orderIndex: 1 },
              { id: '103', type: 'cta', title: 'Contact Action', content: { actionText: 'Join the Beta' }, orderIndex: 2 }
            ],
            createdAt: new Date().toISOString()
          }
        ];
        this._pages.set(mockPages);
        return of(mockPages);
      })
    );
  }

  savePage(page: Partial<CmsPage>): Observable<CmsPage> {
    this._loading.set(true);
    return this.api.savePage(page).pipe(
      tap((updated) => {
        this._pages.update((current) => {
          const index = current.findIndex((p) => p.id === updated.id);
          if (index !== -1) {
            return current.map((p) => (p.id === updated.id ? updated : p));
          }
          return [...current, updated];
        });
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        const mockSaved: CmsPage = {
          id: page.id || crypto.randomUUID(),
          title: page.title || 'New Page',
          slug: page.slug || 'new-page',
          metaTitle: page.metaTitle || null,
          metaDescription: page.metaDescription || null,
          sections: page.sections || [],
          createdAt: new Date().toISOString(),
        };
        this._pages.update((current) => {
          const index = current.findIndex((p) => p.id === mockSaved.id);
          if (index !== -1) {
            return current.map((p) => (p.id === mockSaved.id ? mockSaved : p));
          }
          return [...current, mockSaved];
        });
        return of(mockSaved);
      })
    );
  }

  deletePage(id: string): Observable<void> {
    this._loading.set(true);
    return this.api.deletePage(id).pipe(
      tap(() => {
        this._pages.update((current) => current.filter((p) => p.id !== id));
        this._loading.set(false);
      }),
      catchError((err) => {
        this._pages.update((current) => current.filter((p) => p.id !== id));
        this._loading.set(false);
        return of(void 0);
      })
    );
  }
}
