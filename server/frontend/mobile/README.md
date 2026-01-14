# Project Manager Mobile App

React Native (Expo) mobile app for organization and project time management.

## Application Flow

### First App Installation  OnboardingChoiceScreen

When a user installs the app, they see the **OnboardingChoiceScreen** with two options:

1. **Create Organization**  For new organization setup (Admin)
2. **Scan QR to Join Organization**  For employees to join an existing organization

*(Login button is for development only and is hidden in production)*

### Flow A: Create New Organization (Admin)

1. Click "Create Organization" button
2. Enter Organization Details (name, logo)
3. Enter Admin Details + WhatsApp OTP + Email OTP verification
4. Select License (Trial/Pro)
5. Click "Create Organization"  Entry stored in `project_registry` database
6. Redirect to `NewLoginScreen.tsx` (with organization logo at top)
7. Admin logs in  Admin Dashboard (with unique QR code for employees)

### Flow B: Employee Joins via QR Scan

1. Click "Scan QR to Join Organization"
2. Scan the QR code shown by Admin
3. Fill out Signup Form
4. Admin approves and adds employee via "Add Employee" screen
5. Employee receives credentials
6. Login via `NewLoginScreen.tsx` (with organization logo)
7. Employee Dashboard (personalized)

---

## Prerequisites

- Node 18+
- Expo Go app on your phone, or Android Studio/iOS Simulator
- Backend running locally at http://localhost:5000

Note: On Android emulator, the backend URL is `http://10.0.2.2:5000` (configured in `app.json > extra.apiBaseUrl`).

## Quick Start

1. Start your backend server:
   ```bash
   cd ../../server-backend
   npm start
   ```

2. Start the mobile app:
   ```bash
   npm start
   ```

3. Scan the QR code with Expo Go app, or press `a` for Android emulator.

## Scripts

- `npm start`  start Expo dev server
- `npm run android`  start app on Android
- `npm run ios`  start app on iOS (macOS required)
- `npm run web`  start web build

## Screen Structure

```
src/screens/
 onboarding/
    OnboardingChoiceScreen.tsx    # First screen (2 buttons)

 auth/
    NewLoginScreen.tsx            # Login with org logo at top
    SignupScreen.tsx              # Employee signup after QR scan

 admin/
    AdminDashboardScreen.tsx      # Admin home with QR code
    EmployeesScreen.tsx           # Add/manage employees
    ClientsScreen.tsx             # Manage clients
    ProjectsScreen.tsx            # Manage projects

 manager/
    ManagerDashboardScreen.tsx    # Manager home
    ...

 employee/
     EmployeeDashboardScreen.tsx   # Employee home
     TimeTrackingScreen.tsx        # Time tracking
     ...
```

## User Roles

| Role | How Created | Dashboard |
|------|-------------|-----------|
| **Admin** | Creates organization | Shows QR code, full access |
| **Manager** | Added by Admin | Team management, projects |
| **Employee** | Joins via QR + Admin approval | Personal tasks, time tracking |

## Key Features

- **Onboarding**: Organization creation or QR-based joining
- **OTP Verification**: WhatsApp and Email OTP during signup
- **Multi-tenant**: Each organization has isolated data
- **Organization QR**: Unique QR code per organization for employee onboarding
- **Role-based Dashboards**: Different views for Admin/Manager/Employee
- **Time Tracking**: Start/stop timers for tasks
- **Proof of Work**: Upload attachments for task completion
