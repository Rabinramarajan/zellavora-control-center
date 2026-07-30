-- Grant service_role necessary permissions for API access

-- Grant permissions on organizations table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO service_role;

-- Grant permissions on related tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_role_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.common_configurations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.otps TO service_role;

-- Grant permissions on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Enable RLS on organizations if not already enabled
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and recreate it
DROP POLICY IF EXISTS "service_role_access" ON organizations;

-- Create permissive policy for service_role to bypass RLS
CREATE POLICY "service_role_access" ON organizations
  FOR ALL
  USING (current_role = 'service_role')
  WITH CHECK (current_role = 'service_role');
