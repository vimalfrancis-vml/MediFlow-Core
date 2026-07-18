# AI Context - MediFlow

*Last Updated: 2026-07-18*

## Project Overview and Objectives
MediFlow is a hospital workflow and internal request management system designed to digitize operational processes like maintenance, purchase, and leave requests. It aims to replace manual paperwork with a tracked, dynamic, role-based approval system ensuring accountability and transparency for Jubilee Hospital.

## Project Philosophy
- **MVP-First Development**: Focus on delivering a solid core engine before adding peripheral features.
- **Stability over Feature Count**: A robust, tested foundation is always prioritized over a larger feature set.
- **Reusable Components**: Build UI components once in `client/src/components/` and reuse them universally.
- **Accessibility-First UI**: Prioritize contrast, focus states, keyboard navigation, and ARIA labels.
- **Incremental Development**: Implement features in small, easily verifiable steps.
- **Maintainable, Minimal Code**: Avoid unnecessary abstractions and over-engineering. Simplicity is key.
- **Preserve Existing Architecture**: Prefer extending existing systems instead of introducing parallel implementations or unnecessary rewrites.

## Current Architecture
The project is a monorepo structured as follows:

```text
React Client
      │
 REST API
      │
Express Server
      │
 Prisma ORM
      │
 PostgreSQL (Neon)
```

- **Frontend (Client)**: React 19, TypeScript, Vite, Tailwind CSS, React Router v7.
- **Backend (Server)**: Node.js, Express 5, TypeScript, Prisma ORM, PostgreSQL (Neon Database).
- **Security**: JWT-based authentication, bcrypt password hashing, and custom Express error handling to prevent sensitive data leaks.

## Protected Architecture
The following core systems form the foundation of MediFlow and **must not be significantly refactored without explicit approval**:
- Authentication flow (JWT, bcrypt, protected routes)
- Role-Based Access Control (RBAC middleware and frontend `RoleRoute`)
- Workflow Engine (Dynamic templates and steps)
- `DashboardLayout` and `DashboardHeader` structure
- Notification Event System (`NOTIFICATIONS_REFRESH_EVENT`)
- Prisma schema (unless a schema migration is explicitly planned and approved)
- Shared reusable UI components (LoadingState, EmptyState, ActionModal, DataFilterBar, etc.) should be extended rather than duplicated.

## Important Architectural Decisions
1. **Dashboard UI/UX Architecture**: A unified `DashboardLayout` and `DashboardHeader` wrap all authenticated pages.
2. **Notification Event System**: Uses a custom window event (`NOTIFICATIONS_REFRESH_EVENT`) for cross-component communication to trigger notification fetches.
3. **Role-Based Access Control (RBAC)**: Managed via an `enum UserRole`.
4. **Dynamic Workflow Architecture**: Workflows are data-driven via `WorkflowTemplate` and `WorkflowStep` database tables.

## Core Workflows (MVP)
- **Standard Maintenance Request**: HOD Approval -> Facilities Processing (Maintenance Officer).
- **Standard Purchase Request**: HOD Approval -> Procurement Review (Purchase Officer). (Director approval injected for high-value purchases).
- **Standard Leave Request**: HOD Approval -> HR Processing.

## Current Development Status
| System | Status | Description |
|---|---|---|
| **Authentication** | ✅ Completed | Secure JWT login flow operational. |
| **RBAC** | ✅ Completed | Full segregation of Admin, Approver, and Employee roles. |
| **Workflow Engine** | ✅ Completed | Dynamic request progression and auditing implemented. |
| **Dashboard System** | ✅ Completed | Polished layouts, route guarding, unified wrapper. |
| **Notification System**| ✅ Completed | Event-driven, polling-based Notification Center. |
| **Shared UI** | ✅ Completed | Library of reusable Tailwind components in place. |
| **Accessibility** | ✅ Completed | ARIA attributes and semantic HTML standards applied. |
| **Documentation** | 🔄 Active | Context, Rules, and Decisions being actively maintained. |
| **Deployment** | ⏳ Pending | Not yet configured for production hosting. |

## Demo Accounts and Seed Data
The database is fully seeded (`npm run db:seed`) with testable data.
**Default password for all accounts:** `password123`.
- Admin: `admin@mediflow.com`
- Director: `director@mediflow.com`
- Med Supt: `medsupt@mediflow.com`
- HOD (Cardiology): `hod.cardio@mediflow.com`
- HR: `hr@mediflow.com`
- Purchase: `purchase@mediflow.com`
- Maintenance: `maintenance@mediflow.com`
- Employee: `employee1@mediflow.com`
