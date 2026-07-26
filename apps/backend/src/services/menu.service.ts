import { Database } from '../types/supabase';
import { createClient } from '@supabase/supabase-js';
import { RedisClient } from '../infrastructure/redis';
import { FeatureFlagService } from './feature-flag.service';
import { PermissionService } from './permission.service';

export interface MenuNode {
  id: string;
  key: string;
  label: string;
  title?: string;
  description?: string;
  icon?: string | null;
  route?: string | null;
  externalUrl?: string | null;
  parentId?: string | null;
  children: MenuNode[];
  orderIndex: number;
  nestingLevel: number;
  breadcrumbPath?: string[];
  category?: string;
  featureFlag?: string;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requiresAllPermissions?: boolean;
  visible: boolean;
  visibilityType: string;
  visibilityCondition?: Record<string, any>;
  badge?: {
    icon?: string;
    value?: number | string;
    style: string;
    animated?: boolean;
  };
  isFavorite?: boolean;
  isRecent?: boolean;
  viewCount?: number;
  lastAccessedAt?: string;
  accessCount?: number;
  metadata?: Record<string, any>;
}

export interface MenuTree {
  items: MenuNode[];
  timestamp: Date;
  version: number;
  categories: MenuCategory[];
}

export interface MenuCategory {
  id: string;
  key: string;
  label: string;
  icon?: string;
  color?: string;
  orderIndex: number;
  description?: string;
}

export class MenuService {
  private supabase: any;
  private redis: RedisClient;
  private featureFlagService: FeatureFlagService;
  private permissionService: PermissionService;
  private readonly CACHE_TTL = 30 * 60; // 30 minutes
  private readonly CACHE_KEY_PREFIX = 'menu:';

  constructor(
    supabase: ReturnType<typeof createClient>,
    redis: RedisClient,
    featureFlagService: FeatureFlagService,
    permissionService: PermissionService
  ) {
    this.supabase = supabase;
    this.redis = redis;
    this.featureFlagService = featureFlagService;
    this.permissionService = permissionService;
  }

  /**
   * Load complete menu tree for organization with permission filtering
   */
  async getMenuTree(
    organizationId: string,
    userId: string,
    options?: {
      includeHidden?: boolean;
      category?: string;
      forceRefresh?: boolean;
    }
  ): Promise<MenuTree> {
    const cacheKey = this.getCacheKey(organizationId, userId, options?.category);

    // Try cache first
    if (!options?.forceRefresh) {
      const cached = await this.redis.get<MenuTree>(cacheKey);
      if (cached) return cached;
    }

    // Fetch from database
    const { data: rawMenus, error } = await this.supabase
      .from('menus')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('visible', true)
      .order('order_index', { ascending: true });

    if (error) throw new Error(`Failed to fetch menus: ${error.message}`);

    // Fetch categories
    const { data: categories, error: catError } = await this.supabase
      .from('menu_categories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('order_index', { ascending: true });

    if (catError) throw new Error(`Failed to fetch categories: ${catError.message}`);

    // Fetch user's favorite menus
    const { data: favorites } = await this.supabase
      .from('menu_usage')
      .select('menu_id, is_favorite, last_accessed_at, access_count')
      .eq('user_id', userId)
      .eq('is_favorite', true);

    const favoriteIds = new Set<string>(favorites?.map((f: any) => f.menu_id) || []);
    const usageMap = new Map<string, any>(
      (favorites || []).map((f: any) => [f.menu_id, { last_accessed_at: f.last_accessed_at, access_count: f.access_count }])
    );

    // Filter and transform menus
    const menuNodes = await Promise.all(
      rawMenus!.map((menu, index) =>
        this.transformMenuNode(
          menu,
          userId,
          organizationId,
          favoriteIds,
          usageMap,
          rawMenus!
        )
      )
    );

    // Build tree structure
    const tree = this.buildMenuTree(menuNodes);

    // Filter by category if specified
    const filteredTree = options?.category
      ? tree.filter(m => m.category === options.category)
      : tree;

    const result: MenuTree = {
      items: filteredTree,
      timestamp: new Date(),
      version: 1,
      categories: (categories || []).map(c => ({
        id: c.id,
        key: c.key,
        label: c.label,
        icon: c.icon,
        color: c.color,
        orderIndex: c.order_index,
        description: c.description,
      })),
    };

    // Cache result
    await this.redis.set(cacheKey, result, this.CACHE_TTL);

    return result;
  }

  /**
   * Get single menu item with full hierarchy
   */
  async getMenuById(
    menuId: string,
    organizationId: string,
    userId: string
  ): Promise<MenuNode | null> {
    const { data: menu, error } = await this.supabase
      .from('menus')
      .select('*')
      .eq('id', menuId)
      .eq('organization_id', organizationId)
      .single();

    if (error || !menu) return null;

    // Get all menus for context (needed for permissions check)
    const { data: allMenus } = await this.supabase
      .from('menus')
      .select('*')
      .eq('organization_id', organizationId);

    const { data: usage } = await this.supabase
      .from('menu_usage')
      .select('*')
      .eq('menu_id', menuId)
      .eq('user_id', userId)
      .single();

    return this.transformMenuNode(
      menu,
      userId,
      organizationId,
      new Set([menuId]),
      new Map<string, any>([[menuId, { last_accessed_at: usage?.last_accessed_at, access_count: usage?.access_count }]]),
      allMenus || []
    );
  }

  /**
   * Get menu children
   */
  async getMenuChildren(
    parentId: string,
    organizationId: string,
    userId: string
  ): Promise<MenuNode[]> {
    const { data: menus, error } = await this.supabase
      .from('menus')
      .select('*')
      .eq('parent_id', parentId)
      .eq('organization_id', organizationId)
      .eq('visible', true)
      .order('order_index', { ascending: true });

    if (error) return [];

    const { data: allMenus } = await this.supabase
      .from('menus')
      .select('*')
      .eq('organization_id', organizationId);

    const { data: favorites } = await this.supabase
      .from('menu_usage')
      .select('menu_id')
      .eq('user_id', userId)
      .eq('is_favorite', true);

    const favoriteIds = new Set<string>(favorites?.map((f: any) => f.menu_id) || []);

    return Promise.all(
      (menus || []).map(menu =>
        this.transformMenuNode(menu, userId, organizationId, favoriteIds, new Map<string, any>(), allMenus || [])
      )
    );
  }

  /**
   * Get user's favorite menus
   */
  async getFavoriteMenus(
    organizationId: string,
    userId: string
  ): Promise<MenuNode[]> {
    const { data: usage, error } = await this.supabase
      .from('menu_usage')
      .select('menu_id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('is_favorite', true);

    if (error || !usage) return [];

    const menuIds = usage.map(u => u.menu_id);
    if (!menuIds.length) return [];

    const { data: menus } = await this.supabase
      .from('menus')
      .select('*')
      .in('id', menuIds)
      .eq('organization_id', organizationId)
      .order('order_index', { ascending: true });

    if (!menus) return [];

    const { data: allMenus } = await this.supabase
      .from('menus')
      .select('*')
      .eq('organization_id', organizationId);

    return Promise.all(
      menus.map(menu =>
        this.transformMenuNode(menu, userId, organizationId, new Set(menuIds), new Map<string, any>(), allMenus || [])
      )
    );
  }

  /**
   * Get user's recently accessed menus
   */
  async getRecentMenus(
    organizationId: string,
    userId: string,
    limit = 5
  ): Promise<MenuNode[]> {
    const { data: usage, error } = await this.supabase
      .from('menu_usage')
      .select('menu_id, last_accessed_at')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .order('last_accessed_at', { ascending: false })
      .limit(limit);

    if (error || !usage) return [];

    const menuIds = usage.map(u => u.menu_id);
    if (!menuIds.length) return [];

    const { data: menus } = await this.supabase
      .from('menus')
      .select('*')
      .in('id', menuIds)
      .eq('organization_id', organizationId);

    if (!menus) return [];

    const { data: allMenus } = await this.supabase
      .from('menus')
      .select('*')
      .eq('organization_id', organizationId);

    const usageMap = new Map<string, any>(usage.map((u: any) => [u.menu_id, u]));

    return Promise.all(
      menus.map(menu =>
        this.transformMenuNode(menu, userId, organizationId, new Set<string>(), usageMap, allMenus || [])
      )
    );
  }

  /**
   * Track menu access (for recent/favorites)
   */
  async trackMenuAccess(
    menuId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .from('menu_usage')
      .select('*')
      .eq('menu_id', menuId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      await this.supabase
        .from('menu_usage')
        .update({
          last_accessed_at: new Date().toISOString(),
          access_count: existing.access_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('menu_id', menuId)
        .eq('user_id', userId);
    } else {
      await this.supabase
        .from('menu_usage')
        .insert({
          menu_id: menuId,
          user_id: userId,
          organization_id: organizationId,
          access_count: 1,
        });
    }

    // Invalidate cache
    await this.invalidateCache(organizationId, userId);
  }

  /**
   * Toggle menu favorite status
   */
  async toggleFavorite(
    menuId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .from('menu_usage')
      .select('is_favorite')
      .eq('menu_id', menuId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      await this.supabase
        .from('menu_usage')
        .update({
          is_favorite: !existing.is_favorite,
          updated_at: new Date().toISOString(),
        })
        .eq('menu_id', menuId)
        .eq('user_id', userId);
    } else {
      await this.supabase
        .from('menu_usage')
        .insert({
          menu_id: menuId,
          user_id: userId,
          organization_id: organizationId,
          is_favorite: true,
        });
    }

    // Invalidate cache
    await this.invalidateCache(organizationId, userId);
  }

  /**
   * Create new menu item
   */
  async createMenu(
    organizationId: string,
    userId: string,
    menuData: Partial<MenuNode>
  ): Promise<MenuNode> {
    const parentId = menuData.parentId;
    const nestingLevel = parentId ? await this.getNestingLevel(parentId, organizationId) + 1 : 0;

    const { data: newMenu, error } = await this.supabase
      .from('menus')
      .insert({
        organization_id: organizationId,
        key: menuData.key,
        label: menuData.label,
        title: menuData.title,
        description: menuData.description,
        icon: menuData.icon,
        route: menuData.route,
        externalUrl: menuData.externalUrl,
        parent_id: parentId,
        order_index: menuData.orderIndex || 0,
        nesting_level: nestingLevel,
        visible: menuData.visible ?? true,
        visibility_type: menuData.visibilityType || 'all',
        visibility_condition: menuData.visibilityCondition,
        feature_flag: menuData.featureFlag,
        required_permission: menuData.requiredPermission,
        required_permissions: menuData.requiredPermissions,
        requires_all_permissions: menuData.requiresAllPermissions || false,
        category: menuData.category,
        badge_icon: menuData.badge?.icon,
        badge_style: menuData.badge?.style || 'default',
        metadata: menuData.metadata,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Record version
    await this.recordMenuVersion(newMenu, 'created', userId, organizationId);

    // Invalidate cache
    await this.invalidateOrgCache(organizationId);

    return this.transformMenuNode(newMenu, userId, organizationId, new Set(), new Map(), [newMenu]);
  }

  /**
   * Update menu item
   */
  async updateMenu(
    menuId: string,
    organizationId: string,
    userId: string,
    updates: Partial<MenuNode>
  ): Promise<MenuNode> {
    const { data: menu, error: fetchError } = await this.supabase
      .from('menus')
      .select('*')
      .eq('id', menuId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !menu) throw new Error('Menu not found');

    const updateData: any = {};
    const changedFields: string[] = [];

    if (updates.label !== undefined && updates.label !== menu.label) {
      updateData.label = updates.label;
      changedFields.push('label');
    }
    if (updates.title !== undefined && updates.title !== menu.title) {
      updateData.title = updates.title;
      changedFields.push('title');
    }
    if (updates.description !== undefined && updates.description !== menu.description) {
      updateData.description = updates.description;
      changedFields.push('description');
    }
    if (updates.icon !== undefined && updates.icon !== menu.icon) {
      updateData.icon = updates.icon;
      changedFields.push('icon');
    }
    if (updates.route !== undefined && updates.route !== menu.route) {
      updateData.route = updates.route;
      changedFields.push('route');
    }
    if (updates.externalUrl !== undefined && updates.externalUrl !== menu.external_url) {
      updateData.external_url = updates.externalUrl;
      changedFields.push('external_url');
    }
    if (updates.visible !== undefined && updates.visible !== menu.visible) {
      updateData.visible = updates.visible;
      changedFields.push('visible');
    }
    if (updates.visibilityType !== undefined && updates.visibilityType !== menu.visibility_type) {
      updateData.visibility_type = updates.visibilityType;
      changedFields.push('visibility_type');
    }
    if (updates.featureFlag !== undefined && updates.featureFlag !== menu.feature_flag) {
      updateData.feature_flag = updates.featureFlag;
      changedFields.push('feature_flag');
    }
    if (updates.category !== undefined && updates.category !== menu.category) {
      updateData.category = updates.category;
      changedFields.push('category');
    }

    updateData.updated_by = userId;
    updateData.updated_at = new Date().toISOString();

    const { data: updatedMenu, error } = await this.supabase
      .from('menus')
      .update(updateData)
      .eq('id', menuId)
      .select()
      .single();

    if (error) throw error;

    // Record version
    await this.recordMenuVersion(updatedMenu, 'updated', userId, organizationId, changedFields);

    // Invalidate cache
    await this.invalidateOrgCache(organizationId);

    return this.transformMenuNode(updatedMenu, userId, organizationId, new Set(), new Map(), [updatedMenu]);
  }

  /**
   * Delete menu item (soft delete by setting visible=false)
   */
  async deleteMenu(
    menuId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const { data: menu } = await this.supabase
      .from('menus')
      .select('*')
      .eq('id', menuId)
      .eq('organization_id', organizationId)
      .single();

    if (!menu) throw new Error('Menu not found');

    const { error } = await this.supabase
      .from('menus')
      .update({
        visible: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', menuId);

    if (error) throw error;

    // Record version
    await this.recordMenuVersion(menu, 'deleted', userId, organizationId);

    // Invalidate cache
    await this.invalidateOrgCache(organizationId);
  }

  /**
   * Get menu categories
   */
  async getCategories(organizationId: string): Promise<MenuCategory[]> {
    const { data: categories, error } = await this.supabase
      .from('menu_categories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('order_index', { ascending: true });

    if (error) return [];

    return categories.map(c => ({
      id: c.id,
      key: c.key,
      label: c.label,
      icon: c.icon,
      color: c.color,
      orderIndex: c.order_index,
      description: c.description,
    }));
  }

  /**
   * Private helper methods
   */

  private async transformMenuNode(
    menu: any,
    userId: string,
    organizationId: string,
    favoriteIds: Set<string>,
    usageMap: Map<string, any>,
    allMenus: any[]
  ): Promise<MenuNode> {
    // Check permissions
    if (!await this.checkMenuPermissions(menu, userId, organizationId)) {
      return null as any;
    }

    // Check feature flags
    if (menu.feature_flag && !await this.featureFlagService.isEnabled(menu.feature_flag, organizationId, { userId })) {
      return null as any;
    }

    const breadcrumb = menu.breadcrumb_path ? JSON.parse(menu.breadcrumb_path) : [];
    const usage = usageMap.get(menu.id);

    return {
      id: menu.id,
      key: menu.key,
      label: menu.label,
      title: menu.title,
      description: menu.description,
      icon: menu.icon,
      route: menu.route,
      externalUrl: menu.external_url,
      parentId: menu.parent_id,
      children: [],
      orderIndex: menu.order_index,
      nestingLevel: menu.nesting_level,
      breadcrumbPath: breadcrumb,
      category: menu.category,
      featureFlag: menu.feature_flag,
      requiredPermission: menu.required_permission,
      requiredPermissions: menu.required_permissions,
      requiresAllPermissions: menu.requires_all_permissions,
      visible: menu.visible,
      visibilityType: menu.visibility_type,
      visibilityCondition: menu.visibility_condition,
      badge: menu.badge_icon ? {
        icon: menu.badge_icon,
        value: menu.badge_counter_value,
        style: menu.badge_style || 'default',
      } : undefined,
      isFavorite: favoriteIds.has(menu.id),
      isRecent: !!usage,
      viewCount: menu.view_count,
      lastAccessedAt: usage?.last_accessed_at,
      accessCount: usage?.access_count,
      metadata: menu.metadata,
    };
  }

  private buildMenuTree(nodes: (MenuNode | null)[]): MenuNode[] {
    const validNodes = nodes.filter((n): n is MenuNode => n !== null);
    const map = new Map(validNodes.map(n => [n.id, { ...n, children: [] }]));
    const tree: MenuNode[] = [];

    for (const node of map.values()) {
      if (node.parentId) {
        const parent = map.get(node.parentId);
        if (parent) parent.children.push(node);
      } else {
        tree.push(node);
      }
    }

    tree.sort((a, b) => a.orderIndex - b.orderIndex);
    return tree;
  }

  private async checkMenuPermissions(
    menu: any,
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    if (!menu.visible) return false;

    if (menu.required_permission) {
      const hasPermission = await this.permissionService.hasPermission(
        userId,
        menu.required_permission,
        organizationId
      );
      if (!hasPermission) return false;
    }

    if (menu.required_permissions && menu.required_permissions.length > 0) {
      if (menu.requires_all_permissions) {
        const allHave = await Promise.all(
          menu.required_permissions.map(p =>
            this.permissionService.hasPermission(p, userId, organizationId)
          )
        );
        if (!allHave.every(h => h)) return false;
      } else {
        const anyHave = await Promise.all(
          menu.required_permissions.map(p =>
            this.permissionService.hasPermission(p, userId, organizationId)
          )
        );
        if (!anyHave.some(h => h)) return false;
      }
    }

    return true;
  }

  private async getNestingLevel(parentId: string, organizationId: string): Promise<number> {
    const { data: parent } = await this.supabase
      .from('menus')
      .select('nesting_level')
      .eq('id', parentId)
      .eq('organization_id', organizationId)
      .single();

    return parent?.nesting_level || 0;
  }

  private async recordMenuVersion(
    menu: any,
    changeType: string,
    userId: string,
    organizationId: string,
    changedFields: string[] = []
  ): Promise<void> {
    const { data: latestVersion } = await this.supabase
      .from('menu_versions')
      .select('version_number')
      .eq('menu_id', menu.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (latestVersion?.version_number || 0) + 1;

    await this.supabase
      .from('menu_versions')
      .insert({
        organization_id: organizationId,
        menu_id: menu.id,
        version_number: nextVersion,
        snapshot: menu,
        change_type: changeType,
        changed_fields: changedFields,
        changed_by: userId,
      });
  }

  private getCacheKey(organizationId: string, userId: string, category?: string): string {
    let key = `${this.CACHE_KEY_PREFIX}${organizationId}:${userId}`;
    if (category) key += `:${category}`;
    return key;
  }

  private async invalidateCache(organizationId: string, userId: string): Promise<void> {
    const pattern = `${this.CACHE_KEY_PREFIX}${organizationId}:${userId}:*`;
    await this.redis.deletePattern(pattern);
  }

  private async invalidateOrgCache(organizationId: string): Promise<void> {
    const pattern = `${this.CACHE_KEY_PREFIX}${organizationId}:*`;
    await this.redis.deletePattern(pattern);
  }
}
