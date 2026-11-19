# Admin Approval Intelligence – Standalone Feature Archive

**Archive Date:** November 19, 2026  
**Status:** Deactivated from active application; fully preserved in this archive for future restoration.  
**Purpose:** Answers the Administrator's daily operational question: *"What needs my attention today?"* across all four hospital request categories (Purchase, Maintenance, Leave, General).

---

## 1. Feature Architecture

The Approval Intelligence system uses a **two-tier architecture**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   E-Office Admin Client (React 19)                    │
│   • ApprovalIntelligencePage    • ApprovalOverviewCards                │
│   • TodayAttentionList          • BottlenecksPanel                     │
│   • DailyBriefing               • ApprovalIntelligenceChat (Read-Only) │
│   • RequestAISummaryModal                                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS + JWT (requireRole: ADMIN)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Express API Layer (/api/v1/approval-intelligence)        │
│   • requireAuth • requireRole(['ADMIN']) • Rate Limiter                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           Approval Intelligence Service (Deterministic Core)           │
│   • PostgreSQL / Prisma Query Engine                                   │
│   • Calculates stage dwell times & SLA status (OVERDUE / DUE_SOON)     │
│   • Detects "Waiting" vs "Stuck" (inactive or missing approver)        │
│   • Attention scoring & ranking algorithm                              │
│   • Departmental backlog aggregation & stage delay averages            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Verified Request DTO
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Data Minimization & Redaction Gateway                    │
│   • Masks patient MRNs, emails, phone numbers, national IDs            │
│   • Masks confidential clinical details in leave reasons               │
│   • Mitigates prompt injection attacks                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Sanitized Factual Context
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            ApprovalIntelligenceProvider (Abstract Boundary)           │
│   • LocalRuleBasedProvider (Default, 100% in-process, $0 cost, <1ms)   │
│   • Optional future Cloud / Local LLM provider                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Inventory of Archived Files

```
archive/approval-intelligence/
├── README.md                                         (This comprehensive guide)
├── backend/
│   ├── controllers/
│   │   └── approval-intelligence.controller.ts       (REST controller endpoints)
│   ├── routes/
│   │   └── approval-intelligence.routes.ts           (Express router with RBAC guards)
│   ├── services/
│   │   ├── types.ts                                  (Data contracts & DTOs)
│   │   ├── dataMinimizer.ts                          (Privacy & PII redaction gateway)
│   │   ├── provider.interface.ts                     (AI provider abstraction)
│   │   ├── local.provider.ts                         (In-process rule-based provider)
│   │   └── approval-intelligence.service.ts          (Core deterministic calculations, 747 lines)
│   └── tests/
│       └── approval-intelligence.test.ts             (12 automated Vitest tests)
└── frontend/
    ├── pages/
    │   └── ApprovalIntelligencePage.tsx              (Main admin intelligence dashboard, 292 lines)
    ├── components/
    │   ├── ApprovalOverviewCards.tsx                 (5 KPI cards with click filtering)
    │   ├── DailyBriefing.tsx                         (Executive briefing banner)
    │   ├── AttentionRequestCard.tsx                  (Ranked card with SLA status & reasons)
    │   ├── TodayAttentionList.tsx                    (Filterable & searchable attention list)
    │   ├── BottlenecksPanel.tsx                      (Department & stage delay analytics)
    │   ├── ApprovalIntelligenceChat.tsx              (Constrained read-only chatbot)
    │   └── RequestAISummaryModal.tsx                 (Verified data vs. AI synthesis modal)
    └── api-snippet.ts                                (TypeScript interfaces & API service methods)
```

---

## 3. API Endpoints Specification

All endpoints are mounted under `/api/v1/approval-intelligence` and require `requireAuth` and `requireRole(['ADMIN'])`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/approval-intelligence/overview` | Returns 5 high-level KPI counts (received today, pending, critical, overdue, stuck). |
| `GET` | `/api/v1/approval-intelligence/attention-list` | Returns prioritized requests sorted by urgency with delay reasons. Query params: `category`, `level`, `limit`. |
| `GET` | `/api/v1/approval-intelligence/bottlenecks` | Department backlogs, category counts, stage delay averages, stuck requisitions. |
| `GET` | `/api/v1/approval-intelligence/daily-briefing` | Executive summary narrative, most delayed stage, highest workload dept. |
| `GET` | `/api/v1/approval-intelligence/requests/:id/summary` | Segregated Verified System Data and AI-generated summary with missing info checklist. |
| `POST` | `/api/v1/approval-intelligence/chat` | Sandboxed administrative Q&A returning text, citations, and disclaimer. Payload: `{ query: string, requestId?: string }`. |

---

## 4. Database Requirements

- **No Dedicated Tables or Migrations Required:**  
  Approval Intelligence operates completely on existing core tables:
  - `Request`
  - `PurchaseDetail`, `MaintenanceDetail`, `LeaveDetail`, `GeneralDetail`
  - `ApprovalAction`
  - `WorkflowStep`
  - `User`
  - `Department`
- **Zero Schema Migrations:** No fields or tables were added to `schema.prisma` exclusively for Approval Intelligence.
- **Read-Only:** The intelligence service performs only `findMany`, `count`, and in-memory aggregation. It has zero write operations to request data.

---

## 5. Dependencies & Requirements

- **Backend:** Standard Node.js + Express + Prisma (no external AI libraries needed; default provider runs in-memory).
- **Frontend:** Standard React 19 + React Router + Tailwind CSS (no external chart libraries needed; uses clean SVG and HTML progress bars).
- **External AI:** Default is `LocalRuleBasedProvider` with zero cost and zero external calls.

---

## 6. Step-by-Step Restoration Instructions

When the team decides to re-enable Admin Approval Intelligence, follow these exact steps:

### Step 1: Restore Backend Files
1. Copy `archive/approval-intelligence/backend/services/*` to `server/src/services/approval-intelligence/`
2. Copy `archive/approval-intelligence/backend/controllers/approval-intelligence.controller.ts` to `server/src/controllers/`
3. Copy `archive/approval-intelligence/backend/routes/approval-intelligence.routes.ts` to `server/src/routes/`
4. Copy `archive/approval-intelligence/backend/tests/approval-intelligence.test.ts` to `server/tests/unit/`

### Step 2: Mount Backend Route in `server/src/app.ts`
1. Add import:
   ```ts
   import approvalIntelligenceRouter from './routes/approval-intelligence.routes';
   ```
2. Mount route before the 404 handler:
   ```ts
   app.use('/api/v1/approval-intelligence', approvalIntelligenceRouter);
   ```

### Step 3: Restore Frontend Files
1. Copy `archive/approval-intelligence/frontend/components/*` to `client/src/components/approval-intelligence/`
2. Copy `archive/approval-intelligence/frontend/pages/ApprovalIntelligencePage.tsx` to `client/src/pages/`

### Step 4: Restore API Service Methods in `client/src/services/api.ts`
1. Copy the interfaces (`IntelligenceOverviewData`, `AttentionRequestItem`, `BottlenecksData`, `DailyBriefingData`, `RequestSummaryResult`, `ChatQueryResponse`) from `archive/approval-intelligence/frontend/api-snippet.ts` into `client/src/services/api.ts`.
2. Add the API methods (`getIntelligenceOverview`, `getIntelligenceAttentionList`, `getIntelligenceBottlenecks`, `getIntelligenceDailyBriefing`, `getRequestIntelligenceSummary`, `postIntelligenceChat`) into the `api` export object.

### Step 5: Restore Admin Navigation in `client/src/components/AdminNav.tsx`
Add `{ name: 'Approval Intelligence', path: '/admin/approval-intelligence' }` to `ADMIN_NAV_ITEMS`:
```ts
const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { name: 'Overview', path: '/admin', end: true },
  { name: 'Approval Intelligence', path: '/admin/approval-intelligence' },
  // ... other items
];
```

### Step 6: Restore Route in `client/src/App.tsx`
1. Add import:
   ```ts
   import ApprovalIntelligencePage from './pages/ApprovalIntelligencePage';
   ```
2. Add route inside `<RoleRoute roles={ADMIN_ROLES}>`:
   ```tsx
   <Route
     path="/admin/approval-intelligence"
     element={
       <RoleRoute roles={ADMIN_ROLES}>
         <ApprovalIntelligencePage />
       </RoleRoute>
     }
   />
   ```

### Step 7: Run Verification
```bash
# 1. Backend tests
cd server && npx vitest run tests/unit/approval-intelligence.test.ts

# 2. Frontend build
cd ../client && npm run build
```
