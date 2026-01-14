# Project Time Manager

A multi-tenant mobile application for managing organizations, employees, and project time tracking. Built with React Native (Expo) for the mobile app and Node.js/PostgreSQL for the backend.

## Application Flow

### First App Installation - OnboardingChoiceScreen

When a user installs the app for the first time, they see the **OnboardingChoiceScreen** with only two options:

1. **Create Organization** - For new organization setup
2. **Scan QR to Join Organization** - For employees to join

*(Login button = Dev only, hidden in production)*

---

### Flow A: Create New Organization (Admin)

1. Click Create Organization button
2. Enter Organization Details (Name, Logo)
3. Enter Admin Details + WhatsApp OTP + Email OTP verification
4. Select License (Trial/Pro)
5. Click Create Organization button
   - Entry stored in organizations_registry table (project_registry database)
   - NEW DATABASE CREATED: project_time_manager{N} (e.g., project_time_manager1)
6. NewLoginScreen.tsx (Company logo at top center)
7. Admin Dashboard (Shows unique QR Code, can add Employees/Managers)

---

### Flow B: Employee Joins via QR Scan

1. Employee installs app - OnboardingChoiceScreen
2. Click Scan QR to Join Organization
3. Admin shows QR code from their dashboard
4. Employee scans QR code
5. Employee gets Signup Form - Enters details
6. Admin approves and adds employee via Add Employee screen
7. Employee receives credentials
8. Employee logs in via NewLoginScreen.tsx (with org logo)
9. Employee Dashboard (personalized)

---

## Multi-Tenant Database Architecture

### Two Types of Databases

| Database | Count | Controlled By | Purpose |
|----------|-------|---------------|---------|
| **project_registry** | 1 (Single) | App Creator | Master database storing all organization records |
| **project_time_manager{N}** | Many (Per Org) | Each Org Admin | Individual organization business data |

### How It Works

- **project_registry** (Master): Contains organizations_registry and employees_registry tables
- **project_time_manager1**: First organization's database
- **project_time_manager2**: Second organization's database
- **project_time_manager3**: Third organization's database
- ...and so on

Each organization gets complete data isolation in its own database.

---

## User Roles

| Role | How Created | Capabilities |
|------|-------------|--------------|
| **Admin** | Creates organization | Full access, view QR code, add users |
| **Manager** | Added by Admin | Team management, projects, monitoring |
| **Employee** | Joins via QR + Admin approval | Time tracking, tasks, proof of work |

---

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Expo CLI for React Native development

## Installation

### Backend Setup
```bash
cd server/server-backend
npm install
```

### Create Master Database
```sql
CREATE DATABASE project_registry;
```

### Run Schema
```bash
psql -U postgres -d project_registry -f database/secondary-schema.sql
```

### Start Server
```bash
npm run dev
```

### Frontend Setup
```bash
cd server/frontend/mobile
npm install
npm start
```

---

## Documentation

- [Architecture Guide](ARCHITECTURE.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Development Guide](DEVELOPMENT_GUIDE.md)

---

**Project Time Manager** - Multi-tenant organization management with isolated databases!
