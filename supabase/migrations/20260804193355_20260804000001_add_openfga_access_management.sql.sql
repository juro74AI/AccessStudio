/*
# Add OpenFGA Access Management Tables

## Summary
Adds three new tables to support the unified RBAC/ReBAC access management feature:
- `fga_resources`: Catalog of resources (folders, documents) that can have access granted
- `access_requests`: Workflow for manager requests to grant access, with owner approval
- `access_audit`: Audit trail of all OpenFGA tuple writes (who requested, who approved, when)

## New Tables

### fga_resources
- `id` (uuid PK): unique resource identifier
- `name` (text): display name of the resource
- `resource_type` (text): type of resource (e.g. 'folder', 'document')
- `parent_id` (uuid, nullable): parent resource for hierarchical resources (e.g. document -> folder)
- `owner_id` (uuid FK -> users): the owner of this resource who must approve sensitive access
- `metadata` (jsonb, nullable): additional resource metadata
- `created_at` (timestamptz)

### access_requests
- `id` (uuid PK): unique request identifier
- `profile_id` (uuid FK -> profiles): the team/profile requesting access
- `resource_id` (uuid FK -> fga_resources): the resource being accessed
- `resource_type` (text): type of resource (denormalized for quick filtering)
- `relation` (text): the OpenFGA relation being requested (e.g. 'editor', 'viewer')
- `relation_label` (text): human-readable label for the relation
- `status` (text): 'pending' | 'approved' | 'rejected'
- `requested_by` (uuid FK -> users): the manager who made the request
- `owner_id` (uuid FK -> users): the resource owner who must approve
- `manager_comment` (text, nullable): comment from the manager
- `owner_comment` (text, nullable): comment from the owner
- `decided_at` (timestamptz, nullable): when the owner decided
- `requires_approval` (boolean, default false): whether this relation needs owner approval
- `tuple_written` (boolean, default false): whether the OpenFGA tuple was actually written
- `created_at`, `updated_at` (timestamptz)

### access_audit
- `id` (uuid PK): unique audit entry
- `tuple_user` (text): the user/userset in the tuple (e.g. 'team:xxx#member')
- `tuple_relation` (text): the relation in the tuple (e.g. 'editor')
- `tuple_object` (text): the object in the tuple (e.g. 'folder:yyy')
- `action` (text): 'write' | 'delete'
- `requester_id` (uuid FK -> users): who requested the access
- `approver_id` (uuid, nullable FK -> users): who approved it
- `profile_id` (uuid FK -> profiles): the team/profile
- `resource_id` (uuid FK -> fga_resources): the resource
- `resource_type` (text): type of resource
- `created_at` (timestamptz)

## Security
- RLS enabled on all three tables
- All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` since the app uses simulated auth (no real Supabase Auth sessions)
- This matches the existing pattern in the schema

## Seed Data
- Seeds 6 fga_resources: 2 folders and 4 documents with parent relationships
- Uses existing users as owners (managers/owners from the seed data)
*/

-- ============================================================
-- fga_resources
-- ============================================================
CREATE TABLE IF NOT EXISTS fga_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  parent_id UUID REFERENCES fga_resources(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fga_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_fga_resources" ON fga_resources;
CREATE POLICY "read_fga_resources" ON fga_resources FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_fga_resources" ON fga_resources;
CREATE POLICY "insert_fga_resources" ON fga_resources FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_fga_resources" ON fga_resources;
CREATE POLICY "update_fga_resources" ON fga_resources FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_fga_resources" ON fga_resources;
CREATE POLICY "delete_fga_resources" ON fga_resources FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- access_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES fga_resources(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  relation TEXT NOT NULL,
  relation_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_comment TEXT,
  owner_comment TEXT,
  decided_at TIMESTAMPTZ,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  tuple_written BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_access_requests" ON access_requests;
CREATE POLICY "read_access_requests" ON access_requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_access_requests" ON access_requests;
CREATE POLICY "insert_access_requests" ON access_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_access_requests" ON access_requests;
CREATE POLICY "update_access_requests" ON access_requests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_access_requests" ON access_requests;
CREATE POLICY "delete_access_requests" ON access_requests FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- access_audit
-- ============================================================
CREATE TABLE IF NOT EXISTS access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tuple_user TEXT NOT NULL,
  tuple_relation TEXT NOT NULL,
  tuple_object TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'write' CHECK (action IN ('write', 'delete')),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES fga_resources(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE access_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_access_audit" ON access_audit;
CREATE POLICY "read_access_audit" ON access_audit FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_access_audit" ON access_audit;
CREATE POLICY "insert_access_audit" ON access_audit FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_access_audit" ON access_audit;
CREATE POLICY "delete_access_audit" ON access_audit FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fga_resources_type ON fga_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_fga_resources_owner ON fga_resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_fga_resources_parent ON fga_resources(parent_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_profile ON access_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_owner ON access_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_resource ON access_requests(resource_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_profile ON access_audit(profile_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_resource ON access_audit(resource_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_tuple ON access_audit(tuple_user, tuple_relation, tuple_object);

-- ============================================================
-- Seed data: FGA Resources
-- ============================================================
-- We need owner-type users for resource ownership. Let's use existing users.
-- First, get some user IDs to use as owners.

INSERT INTO fga_resources (name, resource_type, owner_id, metadata)
SELECT
  'Q4 Financial Reports',
  'folder',
  u.id,
  jsonb_build_object('department', 'Finance', 'classification', 'confidential')
FROM users u
WHERE u.persona = 'owner'
ORDER BY u.created_at
LIMIT 1;

INSERT INTO fga_resources (name, resource_type, owner_id, metadata)
SELECT
  'Engineering Design Docs',
  'folder',
  u.id,
  jsonb_build_object('department', 'Engineering', 'classification', 'internal')
FROM users u
WHERE u.persona = 'owner'
ORDER BY u.created_at
OFFSET 1 LIMIT 1;

-- Documents under "Q4 Financial Reports" folder
INSERT INTO fga_resources (name, resource_type, parent_id, owner_id, metadata)
SELECT
  'Balance Sheet 2024',
  'document',
  f.id,
  f.owner_id,
  jsonb_build_object('type', 'spreadsheet', 'classification', 'confidential')
FROM fga_resources f
WHERE f.name = 'Q4 Financial Reports';

INSERT INTO fga_resources (name, resource_type, parent_id, owner_id, metadata)
SELECT
  'Revenue Forecast Q4',
  'document',
  f.id,
  f.owner_id,
  jsonb_build_object('type', 'spreadsheet', 'classification', 'confidential')
FROM fga_resources f
WHERE f.name = 'Q4 Financial Reports';

-- Documents under "Engineering Design Docs" folder
INSERT INTO fga_resources (name, resource_type, parent_id, owner_id, metadata)
SELECT
  'API Architecture Spec',
  'document',
  f.id,
  f.owner_id,
  jsonb_build_object('type', 'markdown', 'classification', 'internal')
FROM fga_resources f
WHERE f.name = 'Engineering Design Docs';

INSERT INTO fga_resources (name, resource_type, parent_id, owner_id, metadata)
SELECT
  'Database Schema v2',
  'document',
  f.id,
  f.owner_id,
  jsonb_build_object('type', 'diagram', 'classification', 'internal')
FROM fga_resources f
WHERE f.name = 'Engineering Design Docs';
