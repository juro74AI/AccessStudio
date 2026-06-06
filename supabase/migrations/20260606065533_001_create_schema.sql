-- Users table (simulated auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  persona TEXT NOT NULL CHECK (persona IN ('manager', 'owner')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'partially_approved', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profile-Roles junction table
CREATE TABLE profile_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, role_id)
);

-- Validations table
CREATE TABLE validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, role_id)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE validations ENABLE ROW LEVEL SECURITY;

-- Users: public read for simulated auth
CREATE POLICY "read_users" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "insert_users" ON users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_users" ON users FOR UPDATE TO anon USING (true);

-- Roles: public read/write for MVP
CREATE POLICY "read_roles" ON roles FOR SELECT TO anon USING (true);
CREATE POLICY "insert_roles" ON roles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_roles" ON roles FOR UPDATE TO anon USING (true);
CREATE POLICY "delete_roles" ON roles FOR DELETE TO anon USING (true);

-- Profiles: public read/write for MVP
CREATE POLICY "read_profiles" ON profiles FOR SELECT TO anon USING (true);
CREATE POLICY "insert_profiles" ON profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_profiles" ON profiles FOR UPDATE TO anon USING (true);
CREATE POLICY "delete_profiles" ON profiles FOR DELETE TO anon USING (true);

-- Profile roles: public read/write for MVP
CREATE POLICY "read_profile_roles" ON profile_roles FOR SELECT TO anon USING (true);
CREATE POLICY "insert_profile_roles" ON profile_roles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "delete_profile_roles" ON profile_roles FOR DELETE TO anon USING (true);

-- Validations: public read/write for MVP
CREATE POLICY "read_validations" ON validations FOR SELECT TO anon USING (true);
CREATE POLICY "insert_validations" ON validations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_validations" ON validations FOR UPDATE TO anon USING (true);
CREATE POLICY "delete_validations" ON validations FOR DELETE TO anon USING (true);

-- Indexes
CREATE INDEX idx_roles_owner ON roles(owner_id);
CREATE INDEX idx_profiles_creator ON profiles(creator_id);
CREATE INDEX idx_profile_roles_profile ON profile_roles(profile_id);
CREATE INDEX idx_validations_profile ON validations(profile_id);
CREATE INDEX idx_validations_owner ON validations(owner_id);
CREATE INDEX idx_validations_status ON validations(status);
