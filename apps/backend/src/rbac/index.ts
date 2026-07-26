/**
 * RBAC module bootstrap.
 *
 * Wires the engine, cache, services, and controller together.
 * Mount under /api/v1/rbac.
 */
import { Router } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

import { PermissionEngine } from './engine/permission-engine';
import { PolicyCache } from './cache/policy-cache';
import { startInvalidationListener } from './cache/invalidator';
import { RoleService } from './services/role.service';
import { UserRoleService } from './services/user-role.service';
import { AuditService } from './services/audit.service';
import { buildRbacRouter } from './controllers/rbac.controller';

export interface RbacDeps {
  db: SupabaseClient;
  redis: Redis;
}

export interface RbacHandle {
  engine: PermissionEngine;
  cache: PolicyCache;
  roleService: RoleService;
  userRoleService: UserRoleService;
  audit: AuditService;
  router: Router;
}

export async function buildRbac(deps: RbacDeps): Promise<RbacHandle> {
  const { db, redis } = deps;

  const cache = new PolicyCache(redis);
  const engine = new PermissionEngine(db, cache);
  const audit = new AuditService(db);
  const roleService = new RoleService(db, audit, engine);
  const userRoleService = new UserRoleService(db, audit, engine);

  const router = buildRbacRouter({ engine, roleService, userRoleService, audit });

  await startInvalidationListener(redis, cache);

  return { engine, cache, roleService, userRoleService, audit, router };
}
