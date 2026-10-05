/*
# Add HR Employee Info and Manager-Team Link

## Summary
Adds an `hr_employees` table that stores HR information for each user (department, job title, hire date, contract type, manager link). This lets managers see their team members with SI RH data and manage profile associations.

## New Tables

### hr_employees
- `id` (uuid PK)
- `user_id` (uuid FK -> users, unique): the user this HR record belongs to
- `employee_id` (text): internal HR/SI employee number
- `department` (text): department name
- `job_title` (text): current job title
- `hire_date` (date): date of hire
- `contract_type` (text): CDI, CDD, Consultant, etc.
- `manager_id` (uuid FK -> users, nullable): the manager this employee reports to
- `location` (text, nullable): office/location
- `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled, open policies (TO anon, authenticated) matching the existing pattern (simulated auth, no real Supabase sessions)

## Seed Data
- Creates HR records for all existing 'user' persona users, assigned to the first manager
*/

CREATE TABLE IF NOT EXISTS hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  department TEXT NOT NULL,
  job_title TEXT NOT NULL,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contract_type TEXT NOT NULL DEFAULT 'CDI',
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_hr_employees" ON hr_employees;
CREATE POLICY "read_hr_employees" ON hr_employees FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_hr_employees" ON hr_employees;
CREATE POLICY "insert_hr_employees" ON hr_employees FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_hr_employees" ON hr_employees;
CREATE POLICY "update_hr_employees" ON hr_employees FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_hr_employees" ON hr_employees;
CREATE POLICY "delete_hr_employees" ON hr_employees FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_hr_employees_manager ON hr_employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_user ON hr_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_dept ON hr_employees(department);

INSERT INTO hr_employees (user_id, employee_id, department, job_title, hire_date, contract_type, manager_id, location)
SELECT
  u.id,
  'EMP-' || lpad(row_number() OVER (ORDER BY u.created_at)::text, 4, '0'),
  CASE (row_number() OVER (ORDER BY u.created_at) % 4)
    WHEN 0 THEN 'Engineering'
    WHEN 1 THEN 'Finance'
    WHEN 2 THEN 'Marketing'
    ELSE 'Operations'
  END,
  CASE (row_number() OVER (ORDER BY u.created_at) % 5)
    WHEN 0 THEN 'Software Engineer'
    WHEN 1 THEN 'Financial Analyst'
    WHEN 2 THEN 'Marketing Specialist'
    WHEN 3 THEN 'Operations Coordinator'
    ELSE 'Data Analyst'
  END,
  (CURRENT_DATE - (row_number() OVER (ORDER BY u.created_at) * 37 || ' days')::interval)::date,
  CASE (row_number() OVER (ORDER BY u.created_at) % 3)
    WHEN 0 THEN 'CDI'
    WHEN 1 THEN 'CDD'
    ELSE 'Consultant'
  END,
  'a1b2c3d4-0001-4000-8000-000000000001',
  CASE (row_number() OVER (ORDER BY u.created_at) % 3)
    WHEN 0 THEN 'Paris'
    WHEN 1 THEN 'Lyon'
    ELSE 'Remote'
  END
FROM users u
WHERE u.persona = 'user'
ORDER BY u.created_at;
