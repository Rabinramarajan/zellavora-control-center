-- Ensure sessions table RLS is properly configured for service_role

-- Enable RLS on sessions table
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "sessions_service_role_access" ON sessions;
DROP POLICY IF EXISTS "sessions_user_access" ON sessions;

-- Create permissive policy for service_role (backend API)
CREATE POLICY "sessions_service_role_access" ON sessions
  FOR ALL
  USING (current_role = 'service_role')
  WITH CHECK (current_role = 'service_role');

-- Create policy for authenticated users to read their own sessions
CREATE POLICY "sessions_user_access" ON sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- Ensure service_role has proper grants
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO service_role;
