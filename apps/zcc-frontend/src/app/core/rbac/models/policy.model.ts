/**
 * Effective policy — the materialized set of permissions for a user
 * within a tenant. The client keeps this in memory and uses it for
 * all UI permission decisions.
 */

export interface EffectivePolicy {
  userId: string;
  orgId: string;
  version: number;                              // monotonic; bumps on any change
  allowed: string[];                            // permission keys
  denied: string[];
  roles: { id: string; key: string; label: string; level: number }[];
  resolvedAt: number;                           // epoch ms
  source?: 'l1' | 'l2' | 'fresh';
}
