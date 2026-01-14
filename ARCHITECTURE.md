# System Architecture - Project Time Manager

## Architecture Overview

The Project Time Manager is a **multi-tenant organization-based system** with dynamic database provisioning. Each organization gets its own isolated database.

---

## Application Flow

### First App Installation - OnboardingChoiceScreen

Two options only:
1. **Create Organization** - For new organization setup (Admin)
2. **Scan QR to Join Organization** - For employees to join

*(Login button = Dev only, hidden in production)*

### Flow A: Create New Organization (Admin)

1. Click Create Organization button
2. Enter Organization Details (Name, Logo)
3. Enter Admin Details + WhatsApp OTP + Email OTP verification
4. Select License (Trial/Pro)
5. Click Create Organization - TWO THINGS HAPPEN:
   - Entry stored in organizations_registry (project_registry database)
   - NEW DATABASE CREATED: project_time_manager{N}
6. NewLoginScreen.tsx (with org logo at top)
7. Admin Dashboard (with unique QR code)

### Flow B: Employee Joins via QR Scan

1. Employee installs app
2. Click Scan QR to Join Organization
3. Scan QR from Admin's dashboard
4. Fill Signup Form
5. Admin approves via Add Employee screen
6. Employee receives credentials
7. Login via NewLoginScreen.tsx
8. Employee Dashboard (personalized)

---

## Multi-Tenant Database Architecture

### Database Overview

| Database | Count | Controlled By | Purpose |
|----------|-------|---------------|---------|
| **project_registry** | 1 (Single) | App Creator | Master registry of all organizations |
| **project_time_manager{N}** | Many | Each Org Admin | Per-organization business data |

### Master Database: project_registry

Contains two main tables:
- **organizations_registry**: All organization records with database_name field
- **employees_registry**: All employees across organizations (for auth lookup)

### Per-Organization Databases: project_time_manager{N}

Each organization gets its own database with tables:
- users, employees, clients, projects, tasks
- time_entries, salaries, attachments, etc.

### Database Creation Flow

When Admin clicks Create Organization:

1. Generate unique organization_id (ORG-YYYYMMDD-XXXXX)
2. Get next database number (1, 2, 3...)
3. CREATE DATABASE project_time_manager{N}
4. Run schema.sql to create all tables
5. Create admin user in new database
6. INSERT into organizations_registry with database_name
7. INSERT into employees_registry with database_name

### Visual Diagram

project_registry (Master)
 organizations_registry
    Org 1  database_name: project_time_manager1
    Org 2  database_name: project_time_manager2
    Org 3  database_name: project_time_manager3

 employees_registry
     All employees with their organization and database

project_time_manager1 (Org 1)
 users, employees, clients
 projects, tasks, time_entries
 salaries, attachments

project_time_manager2 (Org 2)
 users, employees, clients
 projects, tasks, time_entries
 salaries, attachments

project_time_manager3 (Org 3)
 ... and so on

---

## User Roles and Hierarchy

Admin (Creates Organization)
 Has organization QR code
 Full access to everything

 Manager (Added by Admin)
    Team management, projects, monitoring

 Employee (Joins via QR + Admin approval)
     Time tracking, tasks, proof of work

---

## Backend Architecture

### API Routes

- /api/auth - Login, register, JWT
- /api/organizations - Org registration, QR generation, database creation
- /api/otp - WhatsApp and Email OTP verification
- /api/employees - Employee management
- /api/clients - Client management
- /api/projects - Project management
- /api/tasks - Task management
- /api/time-entries - Time tracking
- /api/proof-of-work - Attachments and approvals
- /api/dashboard - Analytics

### Database Service

Location: src/services/databaseService.js

Functions:
- createOrganizationDatabase() - Creates new database for organization
- getNextDatabaseNumber() - Gets next available number
- initializeSchema() - Runs schema.sql on new database
- createAdminInOrgDatabase() - Creates admin user in org database
- getOrganizationPool() - Gets connection pool for specific org
- listOrganizationDatabases() - Lists all org databases

---

## Key Files

### Schema Files
- database/secondary-schema.sql - project_registry schema
- database/schema.sql - project_time_manager{N} schema

### Configuration
- src/config/databases.js - Multi-database pool manager
- src/services/databaseService.js - Dynamic database creation

### Routes
- src/routes/organizations.js - Organization registration with DB creation

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **project_registry** | Master database (only one) |
| **project_time_manager{N}** | Per-org databases (many) |
| **Dynamic DB Creation** | New database created on org registration |
| **Organization QR** | Unique QR per org for employee onboarding |
| **Data Isolation** | Complete separation between organizations |

---

**Last Updated**: January 2026
**Architecture Version**: 3.0.0

*This is the official application architecture documentation.*
