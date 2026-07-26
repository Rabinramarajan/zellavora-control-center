/**
 * Result of a permission check — single or batched.
 */

export type CheckSource = 'role' | 'inherited' | 'override' | 'deny' | null;

export interface CheckResult {
  permission: string;
  allowed: boolean;
  source: CheckSource;
}

export interface CheckResponse {
  results: CheckResult[];
  version: number;
}
