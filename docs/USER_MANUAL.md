# MediFlow — Comprehensive User Manual & Technical Guide
*Hospital Operations & Request Management System*

---

## Table of Contents
1. [Document Overview & Context](#1-document-overview--context)
2. [System Overview & Architecture](#2-system-overview--architecture)
3. [User Roles & Access Control Matrix](#3-user-roles--access-control-matrix)
4. [Master Demo Credentials Directory](#4-master-demo-credentials-directory)
5. [Getting Started & Authentication](#5-getting-started--authentication)
6. [Core Operations & Workflows](#6-core-operations--workflows)
   - [6.1 Maintenance & Facility Repair Workflow](#61-maintenance--facility-repair-workflow)
   - [6.2 Purchase Request & High-Value Escalation Workflow](#62-purchase-request--high-value-escalation-workflow)
   - [6.3 Leave Application Workflow](#63-leave-application-workflow)
7. [User Guide: Requesters & Staff](#7-user-guide-requesters--staff)
8. [User Guide: Department Heads (HODs) & Approvers](#8-user-guide-department-heads-hods--approvers)
9. [User Guide: Specialized Processing Officers (HR, Purchase, Maintenance)](#9-user-guide-specialized-processing-officers-hr-purchase-maintenance)
10. [User Guide: System Administrator](#10-user-guide-system-administrator)
11. [Notifications & Audit Trail](#11-notifications--audit-trail)
12. [IT Team Technical Setup & Deployment Guide](#12-it-team-technical-setup--deployment-guide)
13. [Troubleshooting & Frequently Asked Questions](#13-troubleshooting--frequently-asked-questions)

---

## 1. Document Overview & Context

This document serves as the official **User Manual and Technical Reference** for **MediFlow**, custom-built for **Jubilee Hospital**. It is tailored for both operational end-users (medical staff, department heads, officers, administrative directors) and the internal IT Team responsible for platform deployment, management, and upkeep.

MediFlow replaces legacy paper-based requisition processes with an automated, trackable, role-based workflow engine ensuring transparency, accountability, and seamless inter-departmental collaboration across Jubilee Hospital.

---

## 2. System Overview & Architecture

### Key Objectives
* **Digital Transformation**: Replaces physical paperwork, manual sign-offs, and email threads with unified digital requests.
* **Automated Escalation**: Intelligently routes requisitions through department HODs, financial directors (for high-value purchases), and specialized fulfillment officers.
* **Auditability**: Records an immutable audit log and visual progress timeline for every action taken.
* **Role Segregation**: Enforces strict privilege boundaries to guarantee data confidentiality and compliance.

### High-Level Technical Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    React 19 Client                      │
│     (Vite + TypeScript + Tailwind CSS + Router v7)      │
└────────────────────────────┬────────────────────────────┘
                             │ REST API (Bearer JWT)
┌────────────────────────────▼────────────────────────────┐
│                    Express 5 Server                     │
│                  (Node.js + TypeScript)                 │
└────────────────────────────┬────────────────────────────┘
                             │ Prisma ORM
┌────────────────────────────▼────────────────────────────┐
│                  PostgreSQL Database                    │
│             (Neon Hosted / Local Engine)                │
└─────────────────────────────────────────────────────────┘
```

---

## 3. User Roles & Access Control Matrix

MediFlow incorporates 8 distinct user roles across 4 functional tiers:

| Tier | Role Name | System Code | Scope & Responsibilities | Primary Interface |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Staff** | Employee / Doctor | `EMPLOYEE` | Create, draft, submit, and track personal/departmental requests. | Employee Dashboard (`/dashboard`) |
| **Tier 2: Dept Management** | Head of Department | `HOD` | Review and endorse/reject/return requests initiated by staff within their specific department. | Approver Dashboard (`/approver`) |
| **Tier 3: Executive** | Hospital Director | `DIRECTOR` | Executive financial approval for high-value equipment/purchases exceeding ₹1,00,000. | Approver Dashboard (`/approver`) |
| **Tier 3: Executive** | Medical Superintendent | `MEDICAL_SUPERINTENDENT` | Executive clinical overview and approval for medical department operations. | Approver Dashboard (`/approver`) |
| **Tier 4: Operations** | HR Officer | `HR` | Final verification, processing, and closure of staff leave applications. | Approver Dashboard (`/approver`) |
| **Tier 4: Operations** | Procurement Officer | `PURCHASE_OFFICER` | Vendor assignment, budget code verification, and procurement fulfillment. | Approver Dashboard (`/approver`) |
| **Tier 4: Operations** | Maintenance Officer | `MAINTENANCE_OFFICER` | Equipment repair processing, technician dispatch, and repair ticket completion. | Approver Dashboard (`/approver`) |
| **System** | System Administrator | `ADMIN` | System-wide analytics, user lifecycle management, department setup, and global audit oversight. | Admin Dashboard (`/admin`) |

---

## 4. Master Demo Credentials Directory

For review, demonstration, and system testing, all accounts are configured with the universal password: **`password123`**.

### 4.1 System Administration & Executives
| Email Address | Password | Role | Department | Purpose in System |
| :--- | :--- | :--- | :--- | :--- |
| `admin@mediflow.com` | `password123` | System Admin (`ADMIN`) | Information Technology | User creation, department routing, global metrics. |
| `director@mediflow.com` | `password123` | Hospital Director (`DIRECTOR`) | Administration | Review high-value purchases (> ₹1,00,000). |
| `medsupt@mediflow.com` | `password123` | Medical Superintendent (`MEDICAL_SUPERINTENDENT`) | Administration | Clinical operational review. |

### 4.2 Department Heads (HODs)
| Email Address | Password | Department | Department Code |
| :--- | :--- | :--- | :--- |
| `hod.cardio@mediflow.com` | `password123` | Cardiology | `CARDIO` |
| `hod.hr@mediflow.com` | `password123` | Human Resources | `HR` |
| `hod.proc@mediflow.com` | `password123` | Procurement | `PROC` |
| `hod.it@mediflow.com` | `password123` | Information Technology | `IT` |
| `hod.fac@mediflow.com` | `password123` | Facilities | `FAC` |
| `hod.admin@mediflow.com` | `password123` | Administration | `ADMIN` |

### 4.3 Specialized Processing Officers
| Email Address | Password | Role | Department | Operational Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| `hr@mediflow.com` | `password123` | HR Officer (`HR`) | Human Resources | Final processing of leave applications. |
| `purchase@mediflow.com` | `password123` | Purchase Officer (`PURCHASE_OFFICER`) | Procurement | Sourcing & completing purchase requisitions. |
| `maintenance@mediflow.com` | `password123` | Maintenance Officer (`MAINTENANCE_OFFICER`) | Facilities | Ticket resolution for facility & equipment repairs. |

### 4.4 Staff & Requesters
| Email Address | Password | Name | Department | Purpose in Demo |
| :--- | :--- | :--- | :--- | :--- |
| `dr.employee@mediflow.com` | `password123` | Staff Doctor | Cardiology | Primary account for initiating requisitions. |
| `employee1@mediflow.com` | `password123` | Vimal Francis | Cardiology | Multi-user workflow testing. |
| `employee2@mediflow.com` | `password123` | Aashna Babu | Human Resources | HR department staff member. |
| `employee3@mediflow.com` | `password123` | Bestin Byju | Procurement | Procurement staff member. |
| `employee4@mediflow.com` | `password123` | Adhityan Kr | Cardiology | Cardiology staff member. |

---

## 5. Getting Started & Authentication

### 5.1 Accessing the Application
1. Launch any modern Web Browser (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).
2. Navigate to the MediFlow URL (e.g., `http://localhost:5173` or assigned hospital domain).
3. The system will present the secure **MediFlow Sign In** page.

```
┌─────────────────────────────────────────────────────────────┐
│                    MediFlow Sign In                         │
│                                                             │
│   Email Address:  [ user@mediflow.com                 ]    │
│   Password:       [ •••••••••••••••••                 ]    │
│                                                             │
│                   [  Sign In  ➔  ]                          │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Logging In & Automated Role Routing
* Enter your assigned **Hospital Email** and **Password**.
* Click **Sign In**.
* Upon successful authentication, MediFlow issues an encrypted JSON Web Token (JWT) and automatically directs you to your role-tailored dashboard:
  * **System Admins** $\rightarrow$ `/admin` (Admin Overview & Analytics)
  * **HODs & Approvers** $\rightarrow$ `/approver` (Pending Action Queue)
  * **Staff Members** $\rightarrow$ `/dashboard` (My Requests & Stats)

### 5.3 Session & Security Policy
* Tokens expire after **24 hours**, requiring re-authentication.
* Logging out immediately invalidates client-side session tokens.

---

## 6. Core Operations & Workflows

MediFlow manages three standard hospital request categories. Each follows a structured, multi-step progression model.

### 6.1 Maintenance & Facility Repair Workflow
Designed for broken equipment, plumbing/electrical fixes, bio-medical device maintenance, and facility repairs.

```text
[ Staff Member ] ──Creates Ticket──> [ Status: IN_REVIEW ]
                                           │
                                    (Step 1: Department HOD Review)
                                           │
                                      Approved?
                                      ├── YES ──> (Step 2: Facilities Processing)
                                      │                   │
                                      │             Maintenance Officer Marks Complete
                                      │                   │
                                      │             [ Status: APPROVED / COMPLETED ]
                                      │
                                      └── NO ───> [ Status: REJECTED / RETURNED ]
```

1. **Initiation**: Staff submits equipment details, location, issue description, and priority (Low, Normal, High, Emergency).
2. **HOD Verification**: Department HOD evaluates necessity and approves.
3. **Facilities Fulfillment**: Maintenance Officer (`maintenance@mediflow.com`) receives the ticket, dispatches technical personnel, performs repair, and completes the workflow.

---

### 6.2 Purchase Request & High-Value Escalation Workflow
Used for medical supplies, diagnostic tools, office consumables, and capital equipment.

```text
[ Staff Member ] ──Submits Purchase Request (Est. Cost)──> [ HOD Approval ]
                                                                  │
                                                      Cost > ₹1,00,000?
                                                      ├── YES ──> [ Hospital Director Approval ]
                                                      │                      │
                                                      │                  Approved
                                                      │                      │
                                                      └─── NO ───────────────┴──> [ Procurement Officer Fulfillment ]
                                                                                                 │
                                                                                           Status: COMPLETED
```

* **Standard Purchase ($\le$ ₹1,00,000)**: Requisitioner $\rightarrow$ Department HOD Approval $\rightarrow$ Purchase Officer Processing.
* **High-Value Escalation (> ₹1,00,000)**: Requisitioner $\rightarrow$ Department HOD Approval $\rightarrow$ **Hospital Director Approval** $\rightarrow$ Purchase Officer Processing.

---

### 6.3 Leave Application Workflow
Handles leave applications for doctors, nurses, administrative personnel, and technical staff.

```text
[ Staff Member ] ──Submits Leave Details──> [ Department HOD Endorsement ]
                                                   │
                                              Approved?
                                                   │
                                           [ HR Officer Final Processing ]
                                                   │
                                           [ Status: APPROVED ]
```

1. **Submission**: Staff selects Leave Type (Annual, Casual, Sick, Maternity/Paternity), Start Date, End Date, Reason, and Emergency/Covering Staff.
2. **HOD Approval**: HOD validates staff coverage and approves leave dates.
3. **HR Processing**: HR Officer validates leave balances and records approval in HR records.

---

## 7. User Guide: Requesters & Staff

### 7.1 Requesters Dashboard Overview (`/dashboard`)
The Staff Dashboard provides a consolidated view of all submitted requests:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  TOTAL REQUESTS: 12  │  PENDING: 3  │  APPROVED: 8  │  REJECTED: 1     │
├────────────────────────────────────────────────────────────────────────┤
│ Search & Filters: [ Search Reference/Title... ] [ Status ▾ ] [ Type ▾ ]│
├────────────────────────────────────────────────────────────────────────┤
│ Reference # │ Title               │ Type        │ Priority │ Status    │
├─────────────┼─────────────────────┼─────────────┼──────────┼───────────┤
│ REQ-10024   │ Cardiac Monitor     │ Purchase    │ High     │ IN_REVIEW │
│ REQ-10018   │ AC Repair Room 302  │ Maintenance │ Normal   │ APPROVED  │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Creating a New Request (`/new-request`)
1. Click **+ New Request** from the top header or dashboard.
2. **General Information**:
   * **Request Title**: Short descriptive title (e.g., *Defibrillator Servicing - ICU*).
   * **Request Type**: Select `Maintenance`, `Purchase`, or `Leave`.
   * **Priority**: Select `Low`, `Normal`, `High`, or `Emergency`.
3. **Fill Category Specific Details**:
   * **For Maintenance**: Equipment Name, Location, Issue Description, Additional Notes.
   * **For Purchase**: Item Description, Quantity, Estimated Unit/Total Cost (₹), Vendor Name (optional), Budget Code (optional), Justification.
   * **For Leave**: Leave Type, Start Date, End Date (Total days calculated automatically), Reason, Emergency Contact / Covering Staff.
4. **Submission Options**:
   * **Save as Draft**: Saves request state as `DRAFT` without sending it into the approval pipeline. You can modify and submit it later.
   * **Submit Request**: Transitions status to `IN_REVIEW` and routes it to your Department HOD immediately.

### 7.3 Editing Returned Requests (`/edit-request/:id`)
If an approver requests corrections, the request status becomes `RETURNED`:
1. Navigate to the request from your dashboard.
2. Click **Edit Request**.
3. Review the approver's feedback notes in the **Audit Log / Comments** section.
4. Make necessary adjustments to form fields and click **Resubmit Request**.

---

## 8. User Guide: Department Heads (HODs) & Approvers

### 8.1 Approver Dashboard (`/approver`)
When logged in as an HOD (`hod.cardio@mediflow.com`), Medical Superintendent, or Hospital Director, your landing page is the **Approver Dashboard**.

* **Action Required Queue**: Displays all active requests currently waiting for *your specific role and department*.
* **Quick Stats**: Shows Total Pending, Action Required, Approved, and Returned counts.

### 8.2 Reviewing & Executing Approval Actions
1. Click **Review Request** on any item in your pending queue.
2. **Review Details**:
   * **Workflow Step Tracker**: Visual indicator showing current stage (e.g., *Step 1 of 2: HOD Approval*).
   * **Requisition Details**: Comprehensive display of cost, priority, justification, and requester info.
   * **Audit Log & History**: Complete timestamped event log of previous approvals/comments.
3. **Select Action**:
   * **Approve** (Green): Enters optional comment $\rightarrow$ Passes request to the next workflow step or final fulfillment.
   * **Return for Revision** (Yellow): Enters *mandatory feedback explanation* $\rightarrow$ Returns ticket to requester for correction.
   * **Reject** (Red): Enters *mandatory rejection reason* $\rightarrow$ Permanently halts the request.

---

## 9. User Guide: Specialized Processing Officers (HR, Purchase, Maintenance)

Specialized officers fulfill approved requests at the final stage of the workflow pipeline.

### 9.1 Maintenance Officer (`maintenance@mediflow.com`)
* Receives tickets once HOD approves facility/equipment repairs.
* Views equipment location, urgency, and reported malfunction.
* Dispatches technical repair personnel.
* Upon completion, clicks **Approve / Complete Ticket** to archive the request as `APPROVED / COMPLETED`.

### 9.2 Purchase Officer (`purchase@mediflow.com`)
* Receives purchase requisitions approved by HOD (and Director if > ₹1,00,000).
* Verifies vendor details, budget codes, and price quotes.
* Completes procurement process and logs final resolution in MediFlow.

### 9.3 HR Officer (`hr@mediflow.com`)
* Receives staff leave applications endorsed by department HODs.
* Verifies leave accrual and departmental coverage.
* Confirms final HR approval to update attendance records.

---

## 10. User Guide: System Administrator

System Administrators access the **Admin Console** (`/admin`), providing system-wide administration, operational monitoring, and user management.

### 10.1 Real-Time Analytics & Key Performance Indicators (KPIs)
* **Total Requisitions**: Total request count across all departments.
* **Pending Approvals**: System-wide active tickets in review.
* **Approval Rate**: Percentage ratio of approved vs rejected requisitions.
* **Average Processing Time**: Average duration from submission to completion.
* **Visual Charts**: Request distribution breakdown by Status (`DRAFT`, `IN_REVIEW`, `APPROVED`, `REJECTED`) and Type (`MAINTENANCE`, `PURCHASE`, `LEAVE`).

### 10.2 User Lifecycle Management (`/admin/users`)
* **View Users**: Search, filter, and inspect user profile data, assigned roles, and department ties.
* **Create New User**: Register staff members by providing Employee ID, Email, First Name, Last Name, User Role, and Department.
* **Activate / Deactivate User**: Instantly toggle account status (`isActive`) to revoke or grant system access without breaking historic audit logs.

### 10.3 Department Management (`/admin/departments`)
* **View Departments**: Monitor active departments (Cardiology, HR, Procurement, Facilities, IT, Administration).
* **Assign HOD**: Select and pair a qualified Head of Department (`HOD`) user to each operational unit to ensure approval routing works seamlessly.

---

## 11. Notifications & Audit Trail

### 11.1 Notification Center
* Located in the top header navbar (Bell Icon 🔔).
* Features a real-time notification badge indicating unread alerts.
* Triggers automatic notifications when:
  * A new request is assigned to an approver.
  * A requester's ticket is approved, returned, or rejected.
* Clicking any notification immediately opens the target request details page.

### 11.2 Audit Timeline & Visual Tracking
Every request contains an immutable, chronologically ordered **Audit Timeline**:
* Records actor identity (Name & Role), exact timestamp, action performed (`SUBMITTED`, `APPROVED`, `RETURNED`, `REJECTED`), and associated comments.
* Guarantees institutional accountability for medical compliance and financial audits.

---

## 12. IT Team Technical Setup & Deployment Guide

This section provides technical instructions for Jubilee Hospital's IT engineering team.

### 12.1 Prerequisites
* **Node.js**: v18.x or v20.x LTS installed.
* **Database**: PostgreSQL database instance (v14+ recommended or Neon PostgreSQL).
* **Package Manager**: `npm` (v9+) or `yarn`.

### 12.2 Repository Directory Structure
```text
mediflow-core/
├── client/              # React 19 Single Page Application
│   ├── src/
│   │   ├── components/  # Shared UI components (Layouts, Tables, Modals)
│   │   ├── pages/       # Route pages (Admin, Approver, Dashboard, Forms)
│   │   ├── services/    # Axios/Fetch API client wrapper
│   │   └── context/     # AuthContext session provider
│   └── vite.config.ts
├── server/              # Express 5 REST API Server
│   ├── prisma/          # Schema definition & seed scripts
│   ├── src/
│   │   ├── controllers/ # Request, Auth, User, Analytics handlers
│   │   ├── middleware/  # Auth JWT & RBAC guards
│   │   ├── routes/      # REST API route definitions
│   │   └── services/    # Workflow engine & DB queries
│   └── .env.example
└── docs/                # Project documentation & reference specs
```

### 12.3 Environment Configuration
Create a `.env` file inside the `server/` directory:

```env
# Database connection string (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/mediflow_db?sslmode=disable"

# Server Port
PORT=5000

# Node Environment
NODE_ENV=development

# JWT Security Secrets
JWT_SECRET="your-production-high-entropy-secret-key-here"
JWT_EXPIRES_IN="1d"
```

For the `client/` directory, create `.env` if custom API URL is required:
```env
VITE_API_URL="http://localhost:5000/api/v1"
```

### 12.4 Database Setup & Seeding
Navigate to the `server/` directory and execute:

```bash
# 1. Install dependencies
npm install

# 2. Run Prisma Database Migrations
npx prisma migrate dev --name init

# 3. Seed Database with Templates, Roles, and Demo Accounts
npm run db:seed
```

> **Note on Workflow Templates**: The seed script automatically generates database entries for `WorkflowTemplate` and `WorkflowStep` tables for Maintenance, Purchase, and Leave workflows.

### 12.5 Running Development Servers

```bash
# Start Backend Express Server (from server directory)
cd server
npm run dev

# Start Frontend Client Server (from client directory in a separate shell)
cd client
npm run dev
```
* Client will be accessible at: `http://localhost:5173`
* Backend API will run at: `http://localhost:5000/api/v1`

### 12.6 Production Build Instructions

```bash
# Build Server TypeScript & Prisma Client
cd server
npm run build
npm start

# Build Client Web Bundle
cd client
npm run build
npm run preview
```

---

## 13. Troubleshooting & Frequently Asked Questions

### Q1: An approver cannot see a request in their Pending Queue.
* **Cause 1**: The user's role does not match the required step approver role (e.g., an HOD logged in trying to view a step requiring `PURCHASE_OFFICER`).
* **Cause 2**: For HODs, the request department must match the HOD's assigned department code (`departmentCode`). Ensure the user is properly linked in Department settings (`/admin/departments`).

### Q2: Why did a Purchase Request get routed to the Hospital Director?
* **Answer**: MediFlow features automated financial escalation rules. Any Purchase Request with an estimated cost exceeding **₹1,00,000** automatically injects an executive approval step for the `DIRECTOR` role following HOD endorsement.

### Q3: How can a staff member unlock a returned request?
* **Answer**: When an approver returns a request for changes, its status switches to `RETURNED`. The requisitioner should open the request details from their dashboard, click **Edit Request**, update the necessary information, and click **Resubmit**.

### Q4: How do I reset user passwords?
* **Answer**: Passwords use `bcrypt` password hashing. Admins can update passwords via user management or database administrative tools. In demo mode, all seeded users utilize `password123`.

---

*Document generated for Jubilee Hospital MediFlow Deployment.*
