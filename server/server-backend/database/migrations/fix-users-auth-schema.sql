-- Migration: Fix users table to match expected auth schema
-- This adds the missing columns needed for authentication

-- First, let's see what we have and what we need:
-- Current columns: user_id (uuid), email_id (varchar), first_name, last_name, is_active, etc.
-- Expected columns: id (uuid), email (varchar), password_hash (varchar), role (user_role)

-- Step 1: Add password_hash column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
  END IF;
END $$;

-- Step 2: Add role column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role user_role DEFAULT 'employee';
  END IF;
END $$;

-- Step 3: Create a view to provide backward-compatible column names
-- This allows the auth routes to use 'id' and 'email' while the underlying table uses 'user_id' and 'email_id'
CREATE OR REPLACE VIEW users_auth_view AS
SELECT 
  user_id as id,
  email_id as email,
  password_hash,
  first_name,
  last_name,
  role,
  is_active,
  created_at,
  updated_at
FROM users;

-- Step 4: Set default passwords for existing users (bcrypt hash of 'password123')
-- This hash was generated using bcrypt with 10 rounds
UPDATE users 
SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
WHERE password_hash IS NULL;

-- Step 5: Set admin role for admin users
UPDATE users SET role = 'admin' WHERE email_id = 'admin@company.com';
UPDATE users SET role = 'manager' WHERE email_id IN ('rajesh@company.com');
UPDATE users SET role = 'employee' WHERE role IS NULL;

-- Verify the changes
SELECT email_id, first_name, last_name, role, password_hash IS NOT NULL as has_password 
FROM users;
