/*
# Add user space, role requests, and multi-step validation flow

1. New Tables
- `user_profiles`: links users to their assigned profiles (many-to-many)
- `role_requests`: individual role requests by users with two-step approval

2. Modified Tables
- `users`: extended persona check constraint to include 'user'

3. New Columns
- `users` persona now allows 'user' in addition to 'manager' and 'owner'

4. Security
- RLS enabled on `user_profiles` and `role_requests`
- Policies for anon read/write (MVP pattern matching existing tables)

5. Important Notes
1. `user_profiles` connects users to profiles they belong to. A profile can have many users and a user can belong to many profiles.
2. `role_requests` tracks the full lifecycle of an individual role request:
   - `pending_manager`: user submitted, waiting for any manager
   - `manager_approved`: manager approved, waiting for role owner
   - `approved`: both manager and owner approved
   - `rejected`: either manager or owner rejected
3. The `manager_id` and `owner_id` fields are optional at creation and populated when each validator acts.
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, profile_id)
);

CREATE TABLE IF NOT EXISTS role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_manager' CHECK (status IN ('pending_manager', 'manager_approved', 'approved', 'rejected')),
  manager_comment TEXT,
  manager_decided_at TIMESTAMPTZ,
  owner_comment TEXT,
  owner_decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile ON user_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_user ON role_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_role ON role_requests(role_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_status ON role_requests(status);
CREATE INDEX IF NOT EXISTS idx_role_requests_profile ON role_requests(profile_id);

-- Extend users persona to allow 'user'
DO $$
BEGIN
  -- We need to drop and recreate the check constraint to add 'user'
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_persona_check;
  ALTER TABLE users ADD CONSTRAINT users_persona_check CHECK (persona IN ('manager', 'owner', 'user'));
EXCEPTION WHEN OTHERS THEN
  -- If the constraint doesn't exist, just add it
  ALTER TABLE users ADD CONSTRAINT users_persona_check CHECK (persona IN ('manager', 'owner', 'user'));
END $$;

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_requests ENABLE ROW LEVEL SECURITY;

-- user_profiles policies
DROP POLICY IF EXISTS "read_user_profiles" ON user_profiles;
CREATE POLICY "read_user_profiles" ON user_profiles FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "insert_user_profiles" ON user_profiles;
CREATE POLICY "insert_user_profiles" ON user_profiles FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "update_user_profiles" ON user_profiles;
CREATE POLICY "update_user_profiles" ON user_profiles FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "delete_user_profiles" ON user_profiles;
CREATE POLICY "delete_user_profiles" ON user_profiles FOR DELETE TO anon USING (true);

-- role_requests policies
DROP POLICY IF EXISTS "read_role_requests" ON role_requests;
CREATE POLICY "read_role_requests" ON role_requests FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "insert_role_requests" ON role_requests;
CREATE POLICY "insert_role_requests" ON role_requests FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "update_role_requests" ON role_requests;
CREATE POLICY "update_role_requests" ON role_requests FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "delete_role_requests" ON role_requests;
CREATE POLICY "delete_role_requests" ON role_requests FOR DELETE TO anon USING (true);
