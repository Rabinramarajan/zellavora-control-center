/**
 * Every search screen's endpoints, relative to the API root. Each entry exposes
 * `criteria` (GET, default search request) and `search` (POST, run a search).
 */
const endpoint = (base: string) =>
  ({ criteria: `${base}/search/criteria`, search: `${base}/search` }) as const;

export const SEARCH_ENDPOINTS = {
  users: endpoint('/iam/users'),
  userRequests: endpoint('/iam/user-requests'),
  branches: endpoint('/branches'),
  groups: endpoint('/iam/groups'),
  roles: endpoint('/iam/roles'),
  resources: endpoint('/iam/resources'),
  configurations: endpoint('/iam/configurations'),
  messages: endpoint('/iam/communications/messages'),
  emails: endpoint('/iam/communications/emails'),
  auditLogs: endpoint('/operations/audit-logs'),
} as const;

export type SearchEndpoint = (typeof SEARCH_ENDPOINTS)[keyof typeof SEARCH_ENDPOINTS];
