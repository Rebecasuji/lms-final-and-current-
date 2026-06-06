-- WARNING: This script DROPS tables and recreates schema. BACKUP first if needed.

-- 1) DROP existing tables (safe order)
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS leaves CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2) Create users table
CREATE TABLE users (
  id serial PRIMARY KEY,
  user_id text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'Employee',
  password text
);

-- 3) Create enums (permission_type, leave_type) if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_type') THEN
    CREATE TYPE permission_type AS ENUM ('late_entry','early_exit','personal_work','emergency');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type') THEN
    CREATE TYPE leave_type AS ENUM ('Casual','Sick','LWP','Earned','OD','Comp Off');
  END IF;
END$$;

-- 4) Create permissions table
CREATE TABLE permissions (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  permission_type permission_type NOT NULL,
  from_time time NOT NULL,
  to_time time NOT NULL,
  permission_date date,
  reason text,
  additional_info text,
  status text DEFAULT 'Pending',
  is_lop_applicable boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 5) Create leaves table
CREATE TABLE leaves (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  leave_duration_type text DEFAULT 'Full Day',
  reason text,
  attachment text,
  status text DEFAULT 'Pending',
  od_from_time time,
  od_to_time time,
  created_at timestamptz DEFAULT now()
);

-- 6) Approvals table
CREATE TABLE approvals (
  id serial PRIMARY KEY,
  request_type text NOT NULL,
  request_id integer NOT NULL,
  admin_status text NOT NULL,
  admin_approved_by text,
  admin_approved_at timestamptz,
  comments text,
  created_at timestamptz DEFAULT now()
);

-- 7) Seed minimal users (adjust or replace as needed)
INSERT INTO users (user_id, username, name, role, password) VALUES
('1', 'A0001', 'SAM PARKESH', 'Admin', 'test'),
('2', 'A0002', 'LEO CLESTINE', 'Admin', 'test'),
('3', 'A0003', 'SUJI', 'Admin', 'test'),
('4', 'E0041', 'MOHAN RAJ C', 'Employee', 'test'),
('5', 'E0042', 'YUVARAJ S', 'Employee', 'test');

-- 8) (DEV ONLY) Temporarily disable RLS so anon key can read/write
-- Uncomment and run only for development/testing. Do NOT keep disabled in production.
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE leaves DISABLE ROW LEVEL SECURITY;

-- Or create a permissive policy for permissions (safer than disabling RLS globally)
-- Uncomment and run only if you use RLS and need quick dev access.
-- CREATE POLICY anon_all_permissions ON permissions FOR ALL USING (true) WITH CHECK (true);

-- 9) Verify counts
-- SELECT count(*) FROM users;
-- SELECT count(*) FROM permissions;
-- SELECT count(*) FROM leaves;

-- End of script
