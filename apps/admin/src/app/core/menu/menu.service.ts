import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  MenuNode,
  MenuTree,
  MenuCategory,
  MenuTreeResponse,
  MenusResponse,
  CreateMenuRequest,
  UpdateMenuRequest,
} from '../../shared/models/menu.model';

/**
 * Menu Service
 * Manages dynamic menu state with caching, permissions, and usage tracking
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly apiBaseUrl = '/api/v1/menus';

  // State signals
  private readonly menuTree = signal<MenuNode[]>([]);
  private readonly menuMap = signal<Map<string, MenuNode>>(new Map());
  private readonly favorites = signal<Set<string>>(new Set());
  private readonly recent = signal<MenuNode[]>([]);
  private readonly categories = signal<MenuCategory[]>([]);
  private readonly isLoading = signal(false);
  private readonly error = signal<string | null>(null);
  private readonly cacheTimestamp = signal<number>(0);

  // Computed selectors
  readonly menu = this.menuTree.asReadonly();
  readonly allMenusFlat = computed(() => this.flattenTree(this.menuTree()));
  readonly favoriteMenus = computed(() =>
    this.menuTree().filter(m => this.favorites().has(m.id))
  );
  readonly recentMenus = this.recent.asReadonly();
  readonly menuCategories = this.categories.asReadonly();
  readonly loading = this.isLoading.asReadonly();
  readonly errorMessage = this.error.asReadonly();

  constructor(private httpClient: HttpClient) {
    // Auto-load menu tree on service initialization
    effect(() => {
      if (this.isLoading()) {
        // Track loading state
      }
    });
  }

  /**
   * Load complete menu tree with permission filtering
   */
  async loadMenuTree(forceRefresh = false): Promise<MenuNode[]> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const params = new HttpParams().set('forceRefresh', forceRefresh.toString());
      const response = await firstValueFrom(
        this.httpClient.get<MenuTreeResponse>(`${this.apiBaseUrl}`, { params })
      );

      // Update state
      const nodes = response.items || [];
      this.menuTree.set(nodes);
      this.rebuildMaps(nodes);
      this.categories.set(response.categories || []);
      this.cacheTimestamp.set(Date.now());

      return nodes;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load menu';
      this.error.set(message);
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Get menu by ID
   */
  getMenuById(id: string): MenuNode | null {
    return this.menuMap().get(id) ?? null;
  }

  /**
   * Find menu by key/identifier
   */
  findMenuByKey(key: string): MenuNode | null {
    return Array.from(this.menuMap().values()).find(m => m.key === key) ?? null;
  }

  /**
   * Get immediate children of a menu
   */
  getMenuChildren(parentId: string): MenuNode[] {
    const parent = this.getMenuById(parentId);
    return parent?.children ?? [];
  }

  /**
   * Get menus by category
   */
  getMenusByCategory(category: string): MenuNode[] {
    return this.allMenusFlat().filter(m => m.category === category);
  }

  /**
   * Get breadcrumb navigation for a menu
   */
  getBreadcrumbs(menuId: string): MenuNode[] {
    const menu = this.getMenuById(menuId);
    if (!menu?.breadcrumbPath?.length) {
      return menu ? [menu] : [];
    }

    const breadcrumbs: MenuNode[] = [];
    for (const id of menu.breadcrumbPath) {
      const node = this.getMenuById(id);
      if (node) breadcrumbs.push(node);
    }
    if (menu) breadcrumbs.push(menu);
    return breadcrumbs;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(menuId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpClient.post(`${this.apiBaseUrl}/${menuId}/favorite`, {})
      );

      const isFav = this.favorites().has(menuId);
      this.favorites.update(set => {
        const newSet = new Set(set);
        if (isFav) {
          newSet.delete(menuId);
        } else {
          newSet.add(menuId);
        }
        return newSet;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update favorite';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Track menu access for recently used tracking
   */
  trackMenuAccess(menuId: string): void {
    this.httpClient
      .post(`${this.apiBaseUrl}/${menuId}/access`, {})
      .subscribe({
        error: (err) => console.error('Failed to track menu access', err),
      });
  }

  /**
   * Search menus by label or key
   */
  searchMenus(query: string): MenuNode[] {
    const q = query.toLowerCase();
    return this.allMenusFlat().filter(
      m =>
        m.label.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
    );
  }

  /**
   * Check if user can view a menu item
   */
  canViewMenu(menu: MenuNode): boolean {
    if (!menu.visible) return false;

    // Additional checks can be added here based on:
    // - feature flags
    // - permissions
    // - visibility conditions
    // - roles

    return true;
  }

  /**
   * Load favorites
   */
  async loadFavorites(): Promise<MenuNode[]> {
    try {
      const response = await firstValueFrom(
        this.httpClient.get<MenusResponse>(`${this.apiBaseUrl}/user/favorites`)
      );

      const favs = response.items || [];
      this.favorites.set(new Set(favs.map(f => f.id)));
      return favs;
    } catch (err) {
      console.error('Failed to load favorites', err);
      return [];
    }
  }

  /**
   * Load recently used menus
   */
  async loadRecent(limit = 5): Promise<MenuNode[]> {
    try {
      const params = new HttpParams().set('limit', Math.min(limit, 20).toString());
      const response = await firstValueFrom(
        this.httpClient.get<MenusResponse>(`${this.apiBaseUrl}/user/recent`, {
          params,
        })
      );

      const recentMenus = response.items || [];
      this.recent.set(recentMenus);
      return recentMenus;
    } catch (err) {
      console.error('Failed to load recent menus', err);
      return [];
    }
  }

  /**
   * Load menu categories
   */
  async loadCategories(): Promise<MenuCategory[]> {
    try {
      const response = await firstValueFrom(
        this.httpClient.get<{ items: MenuCategory[] }>(
          `${this.apiBaseUrl}/categories`
        )
      );

      const cats = response.items || [];
      this.categories.set(cats);
      return cats;
    } catch (err) {
      console.error('Failed to load categories', err);
      return [];
    }
  }

  /**
   * Create new menu (admin)
   */
  async createMenu(menuData: CreateMenuRequest): Promise<MenuNode> {
    try {
      return await firstValueFrom(
        this.httpClient.post<MenuNode>(`${this.apiBaseUrl}`, menuData)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create menu';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Update menu (admin)
   */
  async updateMenu(menuId: string, updates: UpdateMenuRequest): Promise<MenuNode> {
    try {
      return await firstValueFrom(
        this.httpClient.put<MenuNode>(`${this.apiBaseUrl}/${menuId}`, updates)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update menu';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Delete menu (admin)
   */
  async deleteMenu(menuId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpClient.delete(`${this.apiBaseUrl}/${menuId}`)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete menu';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Toggle menu visibility (admin)
   */
  async toggleVisibility(menuId: string, visible: boolean): Promise<MenuNode> {
    try {
      return await firstValueFrom(
        this.httpClient.patch<MenuNode>(`${this.apiBaseUrl}/${menuId}/visibility`, {
          visible,
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update visibility';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Reorder menu items (admin)
   */
  async reorderMenus(
    menuId: string,
    newParentId: string | undefined,
    orderIndex: number
  ): Promise<MenuNode> {
    try {
      return await firstValueFrom(
        this.httpClient.patch<MenuNode>(`${this.apiBaseUrl}/${menuId}/order`, {
          menuId,
          newParentId,
          orderIndex,
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reorder menus';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Rebuild cache (admin)
   */
  async rebuildCache(): Promise<void> {
    try {
      await firstValueFrom(
        this.httpClient.post(`${this.apiBaseUrl}/rebuild-cache`, {})
      );
      // Force reload
      await this.loadMenuTree(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rebuild cache';
      this.error.set(message);
      throw err;
    }
  }

  /**
   * Check if cache is stale
   */
  isCacheStale(maxAge = 5 * 60 * 1000): boolean {
    return Date.now() - this.cacheTimestamp() > maxAge;
  }

  /**
   * Clear all state
   */
  clearCache(): void {
    this.menuTree.set([]);
    this.menuMap.set(new Map());
    this.favorites.set(new Set());
    this.recent.set([]);
    this.categories.set([]);
    this.error.set(null);
    this.cacheTimestamp.set(0);
  }

  /**
   * Private helper methods
   */

  private rebuildMaps(tree: MenuNode[]): void {
    const map = new Map<string, MenuNode>();
    this.flattenTree(tree).forEach(node => map.set(node.id, node));
    this.menuMap.set(map);
  }

  private flattenTree(tree: MenuNode[]): MenuNode[] {
    return tree.flatMap(node => [node, ...this.flattenTree(node.children)]);
  }
}
