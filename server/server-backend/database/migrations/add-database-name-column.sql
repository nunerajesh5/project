-- Migration: Add database_name column to organizations_registry and employees_registry tables
-- Run this on the project_registry database to add support for per-organization databases

-- Add database_name column to organizations_registry if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations_registry' 
        AND column_name = 'database_name'
    ) THEN
        ALTER TABLE organizations_registry ADD COLUMN database_name VARCHAR(100);
        COMMENT ON COLUMN organizations_registry.database_name IS 'The organization''s database name (e.g., project_time_manager1)';
    END IF;
END $$;

-- Add database_name column to employees_registry if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees_registry' 
        AND column_name = 'database_name'
    ) THEN
        ALTER TABLE employees_registry ADD COLUMN database_name VARCHAR(100);
        COMMENT ON COLUMN employees_registry.database_name IS 'The organization''s database name for this employee';
    END IF;
END $$;

-- Create index for faster lookups by database_name
CREATE INDEX IF NOT EXISTS idx_org_database_name ON organizations_registry(database_name);
CREATE INDEX IF NOT EXISTS idx_emp_database_name ON employees_registry(database_name);

-- Verify the migration
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('organizations_registry', 'employees_registry') 
AND column_name = 'database_name';
