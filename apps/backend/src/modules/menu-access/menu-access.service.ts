/**
 * Menu Access: which sidebar entries a role sees.
 *
 * Visibility is stored as ordinary permissions (`navigation:restricted` and
 * `navigation:<menu key>`), so the sidebar, the Roles screen and this screen
 * all read the same rows. This module only ever rewrites a role's
 * `navigation:*` grants; its other permissions are never touched.
 */
import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { cacheDelPattern } from '../../infrastructure/cache';
import {
  MenuDefinitionNode,
  MenuService,
  menuDefinition,
  navigationPermissionDefs,
} from '../../services/auth/menu.service';
import { MenuAccessRepository } from './menu-access.repository';
import { UpdateMenuAccessDTO } from './menu-access.dto';

const RESTRICTED_KEY = 'navigation:restricted';
const NAVIGATION_PREFIX = 'navigation:';
/** Same prefix the roles module caches its lists under. */
const ROLE_CACHE_PREFIX = 'iam:roles:';

export interface MenuAccessView {
  role: { id: string; name: string; isSystem: boolean };
  restricted: boolean;
  /** Menu keys granted to the role. */
  keys: string[];
  /** The role's other allowed permissions, for "also needs …" hints. */
  permissions: string[];
}

export class MenuAccessService {
  constructor(private readonly repo = new MenuAccessRepository()) {}

  public tree(): MenuDefinitionNode[] {
    return menuDefinition();
  }

  public async get(roleId: string, organizationId: string): Promise<MenuAccessView> {
    const role = await this.findRole(roleId, organizationId);
    const allowed = await this.repo.allowedKeys(roleId, organizationId);
    return this.toView(role, allowed);
  }

  public async update(
    roleId: string,
    dto: UpdateMenuAccessDTO,
    organizationId: string,
    actorId: string
  ): Promise<MenuAccessView> {
    const role = await this.findRole(roleId, organizationId);

    const known = new Set(
      navigationPermissionDefs()
        .map((def) => def.key)
        .filter((key) => key !== RESTRICTED_KEY)
        .map((key) => key.slice(NAVIGATION_PREFIX.length))
    );
    const unknown = dto.keys.filter((key) => !known.has(key));
    if (unknown.length) {
      throw new AppError(`Unknown menu entries: ${unknown.join(', ')}`, 400, 'UNKNOWN_MENU_KEY');
    }

    const before = this.toView(role, await this.repo.allowedKeys(roleId, organizationId));
    const nextKeys = [...new Set(dto.keys)].sort();

    // Same rule as the Roles screen: system roles may gain access, never lose it.
    if (role.isSystem) {
      const removed = before.keys.filter((key) => !nextKeys.includes(key));
      if (removed.length || (before.restricted && !dto.restricted)) {
        throw new AppError('System roles can gain menu access but not lose it', 403, 'SYSTEM_ROLE');
      }
    }

    // A new menu entry may not be in the catalog yet on a fresh process.
    await MenuService.ensureNavigationPermissions();

    const wanted = [
      ...(dto.restricted ? [RESTRICTED_KEY] : []),
      ...nextKeys.map((key) => `${NAVIGATION_PREFIX}${key}`),
    ];

    await this.repo.transaction(async (tx) => {
      const permissions = await this.repo.permissionsByKey(wanted, tx);
      if (permissions.length !== wanted.length) {
        throw new AppError('Menu permissions are not available yet; try again', 503, 'MENU_SYNC');
      }
      await this.repo.replaceNavigation(
        roleId,
        organizationId,
        permissions.map((permission) => permission.id),
        tx
      );
      await this.repo.touchRole(roleId, actorId, tx);
    });

    const after = await this.get(roleId, organizationId);
    await AuditService.log({
      action: 'role.menu_access.set',
      resource: 'role',
      resourceId: roleId,
      organizationId,
      actorId,
      before: { restricted: before.restricted, keys: before.keys },
      after: { restricted: after.restricted, keys: after.keys },
      metadata: { role: role.key },
    });
    void cacheDelPattern(`${ROLE_CACHE_PREFIX}*`);
    return after;
  }

  private async findRole(roleId: string, organizationId: string) {
    const role = await this.repo.findRole(roleId);
    // Platform roles (no organization) are shared; another tenant's role is invisible.
    if (!role || (role.organizationId && role.organizationId !== organizationId)) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    return role;
  }

  private toView(
    role: { id: string; name: string; isSystem: boolean },
    allowed: readonly string[]
  ): MenuAccessView {
    return {
      role: { id: role.id, name: role.name, isSystem: role.isSystem },
      restricted: allowed.includes(RESTRICTED_KEY),
      keys: allowed
        .filter((key) => key.startsWith(NAVIGATION_PREFIX) && key !== RESTRICTED_KEY)
        .map((key) => key.slice(NAVIGATION_PREFIX.length))
        .sort(),
      permissions: allowed.filter((key) => !key.startsWith(NAVIGATION_PREFIX)).sort(),
    };
  }
}
