-- Session oversight permissions. The organization owner (super admin) already holds `*:*`;
-- these let the owner delegate scoped session access to manager / team-lead roles.
INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'view:sessions', 'sessions:view', 'sessions', 'view',
   'View live sign-in sessions of the people you manage or lead'),
  (gen_random_uuid(), 'revoke:sessions', 'sessions:revoke', 'sessions', 'revoke',
   'Sign out sessions of the people you manage or lead')
ON CONFLICT DO NOTHING;
