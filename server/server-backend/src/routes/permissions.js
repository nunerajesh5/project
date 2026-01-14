const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_PERMISSIONS = [
  { name: 'clients.add', description: 'Add Client Button' },
  { name: 'projects.add', description: 'Add Project Button' },
  { name: 'tasks.add', description: 'Add Task Button' },
  { name: 'employees.add', description: 'Add Employee Button' },
  { name: 'clients.delete', description: 'Delete Client Button' },
  { name: 'projects.delete', description: 'Delete Project Button' },
  { name: 'tasks.delete', description: 'Delete Task Button' },
];

async function ensureRbacInitialized() {
  // Ensure types and tables exist (idempotent)
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin', 'manager', 'employee');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name user_role UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      role_name user_role NOT NULL,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      has_access BOOLEAN NOT NULL DEFAULT false,
      UNIQUE(role_name, permission_id)
    );
  `);

  // Upsert roles
  const roles = ['admin', 'manager', 'employee'];
  for (const name of roles) {
    await pool.query(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
      [name, `${name} role`]
    );
  }

  // Delete old dummy permissions that are not in DEFAULT_PERMISSIONS
  const allowedNames = DEFAULT_PERMISSIONS.map(p => p.name);
  await pool.query(
    `DELETE FROM permissions WHERE name NOT IN (${allowedNames.map((_, i) => `$${i + 1}`).join(',')})`,
    allowedNames
  );

  // Upsert permissions
  for (const p of DEFAULT_PERMISSIONS) {
    await pool.query(
      `INSERT INTO permissions (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
      [p.name, p.description]
    );
  }

  // Ensure mappings exist
  const { rows: perms } = await pool.query('SELECT id, name FROM permissions');
  for (const perm of perms) {
    // Admin full
    await pool.query(
      `INSERT INTO role_permissions (role_name, permission_id, has_access)
       VALUES ('admin', $1, true)
       ON CONFLICT (role_name, permission_id) DO NOTHING`,
      [perm.id]
    );

    // Manager has most permissions by default (can be changed by admin)
    const managerHas = [
      'clients.add', 'projects.add', 'tasks.add', 'clients.delete', 'projects.delete', 'tasks.delete'
    ].includes(perm.name);
    await pool.query(
      `INSERT INTO role_permissions (role_name, permission_id, has_access)
       VALUES ('manager', $1, $2)
       ON CONFLICT (role_name, permission_id) DO NOTHING`,
      [perm.id, managerHas]
    );

    // Employee has no special permissions by default
    const employeeHas = false;
    await pool.query(
      `INSERT INTO role_permissions (role_name, permission_id, has_access)
       VALUES ('employee', $1, $2)
       ON CONFLICT (role_name, permission_id) DO NOTHING`,
      [perm.id, employeeHas]
    );
  }
}

// GET /api/permissions
router.get('/', authenticateToken, async (req, res) => {
  // Allow all authenticated users to view permissions (they can only see their role's permissions anyway)
  try {
    await ensureRbacInitialized();
    const { rows: permissions } = await pool.query('SELECT id, name, description FROM permissions ORDER BY name');

    // Build access matrix per role
    const roles = ['admin', 'manager', 'employee'];
    const { rows: mappings } = await pool.query(
      'SELECT role_name, permission_id, has_access FROM role_permissions'
    );

    const accessByPerm = new Map();
    for (const p of permissions) {
      accessByPerm.set(p.project_id, { admin: false, manager: false, employee: false });
    }
    for (const m of mappings) {
      if (accessByPerm.has(m.permission_id)) {
        accessByPerm.get(m.permission_id)[m.role_name] = m.has_access;
      }
    }

    const result = permissions.map(p => ({
      id: p.project_id,
      name: p.project_name,
      description: p.description,
      access: accessByPerm.get(p.project_id)
    }));

    res.json({ roles, permissions: result });
  } catch (err) {
    console.error('GET /api/permissions failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch permissions', details: err.message });
  }
});

// POST /api/permissions/update
router.post('/update', authenticateToken, requireRole(['admin']), async (req, res) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
  if (updates.length === 0) return res.json({ message: 'No changes' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      const role = u.role;
      const permissionId = u.permissionId;
      const has = !!u.hasAccess;
      await client.query(
        `INSERT INTO role_permissions (role_name, permission_id, has_access)
         VALUES ($1, $2, $3)
         ON CONFLICT (role_name, permission_id)
         DO UPDATE SET has_access = EXCLUDED.has_access`,
        [role, permissionId, has]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Permissions updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update permissions' });
  } finally {
    client.release();
  }
});

module.exports = router;


