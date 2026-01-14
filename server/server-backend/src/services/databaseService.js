/**
 * Database Service for Dynamic Database Creation
 * 
 * This service handles the creation of per-organization databases.
 * When a new organization is created, a new database (project_time_manager{N})
 * is automatically provisioned with the full schema.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Master connection (connects to postgres database for admin operations)
const masterConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: 'postgres', // Connect to default postgres database for admin operations
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
};

/**
 * Get the next available database number for project_time_manager
 * @returns {Promise<number>} Next database number
 */
async function getNextDatabaseNumber() {
  const pool = new Pool(masterConfig);
  
  try {
    // Query all databases that match the pattern project_time_manager{N}
    const result = await pool.query(`
      SELECT datname FROM pg_database 
      WHERE datname LIKE 'project_time_manager%'
      ORDER BY datname
    `);
    
    let maxNumber = 0;
    
    for (const row of result.rows) {
      const dbName = row.datname;
      // Extract number from database name (e.g., project_time_manager5 -> 5)
      const match = dbName.match(/^project_time_manager(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
    
    return maxNumber + 1;
  } finally {
    await pool.end();
  }
}

/**
 * Create a new database for an organization
 * @param {string} databaseName - Name of the database to create
 * @returns {Promise<boolean>} True if successful
 */
async function createDatabase(databaseName) {
  const pool = new Pool(masterConfig);
  
  try {
    // Check if database already exists
    const existing = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [databaseName]
    );
    
    if (existing.rows.length > 0) {
      console.log(`Database ${databaseName} already exists`);
      return true;
    }
    
    // Create the database
    // Note: CREATE DATABASE cannot be run inside a transaction
    await pool.query(`CREATE DATABASE ${databaseName}`);
    console.log(`✅ Created database: ${databaseName}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to create database ${databaseName}:`, error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Initialize the schema in a newly created database
 * @param {string} databaseName - Name of the database to initialize
 * @returns {Promise<boolean>} True if successful
 */
async function initializeSchema(databaseName) {
  const dbPool = new Pool({
    ...masterConfig,
    database: databaseName,
  });
  
  try {
    // Read the schema file
    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await dbPool.query(schemaSQL);
    console.log(`✅ Schema initialized for database: ${databaseName}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize schema for ${databaseName}:`, error.message);
    throw error;
  } finally {
    await dbPool.end();
  }
}

/**
 * Create an admin user in the organization's database
 * @param {string} databaseName - Name of the organization's database
 * @param {object} adminData - Admin user data
 * @returns {Promise<object>} Created admin user
 */
async function createAdminInOrgDatabase(databaseName, adminData) {
  const dbPool = new Pool({
    ...masterConfig,
    database: databaseName,
  });
  
  try {
    const { email, passwordHash, firstName, lastName, phone } = adminData;
    
    // Create admin user in users table
    const userResult = await dbPool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'admin', true)
       RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, firstName, lastName]
    );
    
    // Also create an employee record for the admin
    const employeeId = `EMP-ADMIN-${Date.now()}`;
    await dbPool.query(
      `INSERT INTO employees (employee_id, first_name, last_name, email, phone, salary_type, salary_amount, is_active)
       VALUES ($1, $2, $3, $4, $5, 'monthly', 0, true)`,
      [employeeId, firstName, lastName, email, phone || null]
    );
    
    console.log(`✅ Admin user created in database: ${databaseName}`);
    return userResult.rows[0];
  } catch (error) {
    console.error(`❌ Failed to create admin in ${databaseName}:`, error.message);
    throw error;
  } finally {
    await dbPool.end();
  }
}

/**
 * Create a complete organization database
 * This is the main function called when a new organization is created.
 * 
 * @param {object} orgData - Organization data
 * @param {string} orgData.organizationId - Organization ID (e.g., ORG-20260107-ABC12)
 * @param {string} orgData.name - Organization name
 * @param {string} orgData.adminEmail - Admin email
 * @param {string} orgData.adminPasswordHash - Hashed admin password
 * @param {string} orgData.adminPhone - Admin phone
 * @returns {Promise<object>} Result with database name
 */
async function createOrganizationDatabase(orgData) {
  try {
    // Get next database number
    const dbNumber = await getNextDatabaseNumber();
    const databaseName = `project_time_manager${dbNumber}`;
    
    console.log(`\n📦 Creating organization database: ${databaseName}`);
    console.log(`   Organization: ${orgData.name}`);
    console.log(`   Organization ID: ${orgData.organizationId}`);
    
    // Step 1: Create the database
    await createDatabase(databaseName);
    
    // Step 2: Initialize schema
    await initializeSchema(databaseName);
    
    // Step 3: Create admin user in the new database
    const emailParts = orgData.adminEmail.split('@')[0].split(/[._-]/);
    const firstName = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Admin';
    const lastName = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : orgData.name.split(' ')[0];
    
    await createAdminInOrgDatabase(databaseName, {
      email: orgData.adminEmail,
      passwordHash: orgData.adminPasswordHash,
      firstName,
      lastName,
      phone: orgData.adminPhone,
    });
    
    console.log(`✅ Organization database setup complete: ${databaseName}\n`);
    
    return {
      success: true,
      databaseName,
      databaseNumber: dbNumber,
    };
  } catch (error) {
    console.error('❌ Failed to create organization database:', error.message);
    throw error;
  }
}

/**
 * Get a connection pool for a specific organization's database
 * @param {string} databaseName - Name of the organization's database
 * @returns {Pool} PostgreSQL connection pool
 */
function getOrganizationPool(databaseName) {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: databaseName,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

/**
 * List all organization databases
 * @returns {Promise<string[]>} List of database names
 */
async function listOrganizationDatabases() {
  const pool = new Pool(masterConfig);
  
  try {
    const result = await pool.query(`
      SELECT datname FROM pg_database 
      WHERE datname LIKE 'project_time_manager%'
      ORDER BY datname
    `);
    
    return result.rows.map(row => row.datname);
  } finally {
    await pool.end();
  }
}

/**
 * Delete an organization's database (use with caution!)
 * @param {string} databaseName - Name of the database to delete
 * @returns {Promise<boolean>} True if successful
 */
async function deleteOrganizationDatabase(databaseName) {
  // Safety check - only allow deletion of project_time_manager{N} databases
  if (!databaseName.match(/^project_time_manager\d+$/)) {
    throw new Error('Can only delete project_time_manager{N} databases');
  }
  
  const pool = new Pool(masterConfig);
  
  try {
    // Terminate all connections to the database
    await pool.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
      AND pid <> pg_backend_pid()
    `, [databaseName]);
    
    // Drop the database
    await pool.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    console.log(`✅ Deleted database: ${databaseName}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete database ${databaseName}:`, error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

module.exports = {
  getNextDatabaseNumber,
  createDatabase,
  initializeSchema,
  createAdminInOrgDatabase,
  createOrganizationDatabase,
  getOrganizationPool,
  listOrganizationDatabases,
  deleteOrganizationDatabase,
};
