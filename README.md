# MediFlow — Enterprise Hospital Approval Workflow Platform

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Frontend](https://img.shields.io/badge/frontend-React%2018%20%2B%20TypeScript%20%2B%20Vite-blue.svg)]()
[![Backend](https://img.shields.io/badge/backend-Node.js%20%2B%20Express%205-green.svg)]()
[![Database](https://img.shields.io/badge/database-PostgreSQL%20%2B%20Prisma%207-indigo.svg)]()
[![Security](https://img.shields.io/badge/security-JWT%20%7C%20RBAC%20%7C%20Audit%20Ledger-red.svg)]()

**MediFlow** is an enterprise-grade hospital operations and approval workflow management system designed to streamline, govern, and audit hospital requisitions across clinical, engineering, procurement, and administrative departments.

---

## 🏥 System Purpose & Core Capabilities

MediFlow digitizes and automates three primary hospital operational workflows:
1. **Procurement & Purchase Requisitions**: From everyday clinical consumables (sterile electrodes, syringes) to multi-lakh capital medical equipment (ultrasound systems, MRI sub-components).
2. **Facilities & Biomedical Maintenance Work Orders**: Work order creation, priority escalation, engineering dispatch, and specialized peer delegation.
3. **Staff Leave & Absence Applications**: Comprehensive leave scheduling with HOD duty cover verification and HR processing.

---

## 🛡️ Key Business Invariants & Workflow Rules

- 💰 **Finance-First Invariant (> ₹1,00,000)**: Any requisition exceeding **₹1,00,000 (INR One Lakh)** is automatically prepended with **Step 1: Finance Department Review** before departmental or procurement stages. This cannot be bypassed by custom admin templates or administrative overrides.
- 🚫 **No-Self-Approval Rule**: Requesters are strictly prohibited from approving, rejecting, or forwarding their own requisitions. When a Head of Department (`HOD`) initiates a request, the system automatically auto-escalates approval authority to the **Hospital Director** (for maintenance) or **Medical Superintendent** (for leave).
- 🔄 **Dynamic Peer Forwarding**: Reviewers can reassign pending approval tasks to qualified departmental peers without completing or advancing the step, maintaining full audit logging.
- 📦 **Workflow Versioning & In-Flight Stability**: Admin template modifications automatically publish a new version (`v1` $\rightarrow$ `v2`), while all in-flight active requests remain safely pinned to their creation schema.
- 📜 **Immutable Audit Trail**: Append-only audit logging tracks all state changes, reviewer decisions, comments, attachments, and administrative overrides.

---

## 🏗️ Architecture & Technology Stack

```
MediFlow Platform
├── client/                     # Frontend SPA (React 18 + TypeScript + Vite)
│   ├── src/
│   │   ├── components/         # Reusable UI components & layouts
│   │   ├── context/            # AuthContext & Session management
│   │   ├── pages/              # Role-specific dashboards & detail views
│   │   └── services/           # Typed REST API client
│   └── index.html
├── server/                     # Backend API (Node.js + Express 5 + TypeScript)
│   ├── src/
│   │   ├── controllers/        # REST route handlers
│   │   ├── core/               # WorkflowEngine, StepResolver, RuleEvaluator
│   │   ├── middleware/         # JWT Auth, RBAC, Multer magic-byte upload
│   │   ├── services/           # Business logic & domain services
│   │   └── db.ts               # Prisma PostgreSQL Client
│   └── prisma/
│       ├── schema.prisma       # Database schema definition
│       └── seed.ts             # Master database seed with 8 demo scenarios
└── docs/                       # Technical & deployment documentation
    ├── ARCHITECTURE.md         # System architecture & FSM specification
    ├── WORKFLOW_RULES.md       # Formal rules & invariants specification
    ├── USER_ROLES_PERMISSIONS.md # RBAC matrix & department scoping
    ├── ADMIN_GUIDE.md          # Administrator operations guide
    ├── DEMO_GUIDE.md           # Client presentation demo script
    ├── DEMO_ACCOUNTS.md        # Master demo accounts directory
    └── DEPLOYMENT_GUIDE.md     # Production deployment blueprint
```

---

## ⚡ Quickstart & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: Local instance or cloud database (e.g., [Neon.tech](https://neon.tech))
- **npm**: v9.0.0 or higher

### 1. Clone & Configure Environment

```bash
# Clone the repository
git clone https://github.com/hospital/mediflow.git
cd mediflow/mediflow-core

# Configure backend environment
cd server
cp .env.example .env
```

Edit `server/.env`:
```ini
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
PORT=5000
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=1d
```

### 2. Install Dependencies & Generate Prisma Client

```bash
# In server directory:
npm install
npx prisma generate
```

### 3. Run Database Migrations & Master Seed

```bash
# Run migrations and seed 8 realistic hospital demo scenarios:
npx prisma migrate deploy
npx prisma db seed
```

### 4. Install Frontend Dependencies

```bash
cd ../client
npm install
```

### 5. Start Development Servers

Open two terminal windows:

**Terminal 1 (Backend API):**
```bash
cd server
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
# Client runs on http://localhost:5173
```

---

## 🧪 Testing & Verification

MediFlow includes a comprehensive automated test suite covering unit rules, lifecycle transitions, RBAC security, attachment validation, and end-to-end workflows:

```bash
# Run backend test suite
cd server
npm test

# Verify production builds
npm run build          # Server TypeScript compilation
cd ../client
npm run build          # Client Vite + TypeScript bundle compilation
```

---

## 👥 Master Demo Accounts

> **Default Password for All Demo Accounts:** `password123`

| Role | Email Address | Department | Key Responsibility |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@mediflow.com` | IT | Full system administration & audit logs |
| **Hospital Director** | `director@mediflow.com` | Administration | Capital purchases (> ₹1L) & HOD escalations |
| **Medical Superintendent** | `medsupt@mediflow.com` | Administration | Clinical oversight & extended leave |
| **Head of Cardiology** | `hod.cardio@mediflow.com` | Cardiology | Departmental staff approvals |
| **Finance Officer** | `finance@mediflow.com` | Finance | **Stage-1 Finance clearance (> ₹1L)** |
| **Procurement Officer** | `purchase@mediflow.com` | Procurement | PO processing & vendor quotation reviews |
| **Facilities Officer** | `maintenance@mediflow.com` | Facilities | Equipment repairs & dynamic forwarding |
| **HR Manager** | `hr@mediflow.com` | Human Resources | Staff leave processing |
| **Staff Doctor** | `dr.employee@mediflow.com` | Cardiology | Originator for requisitions & leave |

*For complete account list and step-by-step presentation scripts, refer to [docs/DEMO_GUIDE.md](file:///c:/Users/vimal/OneDrive/Jubilee%20hospital%20demo/mediflow-core/docs/DEMO_GUIDE.md) and [docs/DEMO_ACCOUNTS.md](file:///c:/Users/vimal/OneDrive/Jubilee%20hospital%20demo/mediflow-core/docs/DEMO_ACCOUNTS.md).*

---

## 🚀 Production Deployment

MediFlow is cloud-ready and can be deployed in minutes:
- **Frontend**: Deployable to [Vercel](https://vercel.com) or [Cloudflare Pages](https://pages.cloudflare.com) via standard Vite preset (`npm run build`).
- **Backend**: Deployable to [Railway](https://railway.app), [Render](https://render.com), AWS ECS, or Docker VPS (`npm run build && npm run start`).
- **Database**: Compatible with [Neon](https://neon.tech), AWS RDS, Supabase, or self-hosted PostgreSQL.

For detailed deployment blueprints and Nginx reverse proxy configurations, see [docs/DEPLOYMENT_GUIDE.md](file:///c:/Users/vimal/OneDrive/Jubilee%20hospital%20demo/mediflow-core/docs/DEPLOYMENT_GUIDE.md).

---

## 📄 License & Compliance

MediFlow is engineered for healthcare operational compliance (NABH, JCI, and ISO 9001 standards).
All rights reserved © 2026 MediFlow Healthcare Systems.
