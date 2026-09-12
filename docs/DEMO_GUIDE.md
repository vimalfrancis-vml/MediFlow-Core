# MediFlow Client Demonstration Playbook

This scripted demonstration playbook is designed for executive presentations to hospital leadership, procurement committees, and IT directors.

> **Default Password for All Demo Accounts:** `password123`

---

## Demonstration Script & Scenario Matrix

| Scenario # | Focus Area / Feature | Request Reference | Logins Used | Narrative & Key Takeaways |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Normal Purchase Flow** | `REQ-PUR-2026-001` | `dr.employee` $\rightarrow$ `hod.cardio` $\rightarrow$ `purchase` | Standard 2-step departmental requisition (₹18,500). Shows HOD queue and procurement completion. |
| **2** | **Finance-First Invariant (> ₹1L)** | `REQ-PUR-2026-002` | `dr.employee` $\rightarrow$ `finance` $\rightarrow$ `hod.cardio` $\rightarrow$ `director` | High-value ultrasound purchase (₹8,50,000). Demonstrates dynamic Stage-1 Finance interception and Director sign-off. |
| **3** | **No-Self-Approval Rule** | `REQ-MNT-2026-003` | `hod.cardio` $\rightarrow$ `director` $\rightarrow$ `maintenance` | Cath Lab HEPA filter repair initiated by HOD. Shows automatic escalation to Hospital Director instead of self-approval. |
| **4** | **Dynamic Forwarding** | `REQ-MNT-2026-004` | `dr.employee` $\rightarrow$ `hod.cardio` $\rightarrow$ `maintenance` $\rightarrow$ `hod.it` | Emergency MRI chiller coolant leak. Shows HOD approval, facilities review, and peer delegation to IT/Biomedical Head with full audit logging. |
| **5** | **Approved Requisition** | `REQ-PUR-2026-005` | `employee1` | Defibrillator battery order (₹64,000). Shows completed state, PO number, multi-stage approval timestamps, and sealed record. |
| **6** | **Rejection with Reason** | `REQ-PUR-2026-006` | `employee4` $\rightarrow$ `finance` | Luxury lounge seating (₹1,20,000). Shows rejection at Step 1 Finance review with budgetary feedback and requester notification. |
| **7** | **Multi-Stage Leave** | `REQ-LEV-2026-007` | `dr.employee` $\rightarrow$ `hod.cardio` $\rightarrow$ `hr` | 6-day academic conference leave in Singapore. Shows HOD duty cover sign-off and HR processing queue. |
| **8** | **Returned Request (Needs Changes)** | `REQ-PUR-2026-008` | `dr.employee` $\rightarrow$ `hod.cardio` | Autoclave supplies (₹42,000). Shows HOD returning requisition for competitive supplier quotes, editing, and resubmitting. |

---

## Detailed Step-by-Step Walkthrough

### Part 1: Executive Overview & Requester Experience
1. **Login as Staff Doctor** (`dr.employee@mediflow.com` / `password123`):
   - Navigate to the **Employee Dashboard** (`/dashboard`).
   - Highlight the clean KPI cards: Active Requests, Pending Approvals, Approved, and Rejected counts.
   - Point out `REQ-PUR-2026-001` (ECG supplies, ₹18,500) currently under review at HOD Approval.
   - Open `REQ-PUR-2026-002` (High-Value Ultrasound, ₹8,50,000):
     - Notice that despite being a purchase request, **Step 1 is "Finance Department Review"** because the amount exceeds ₹1,00,000.
     - Highlight the interactive **Workflow Timeline** showing the dynamic 4-step sequence: `Finance Review` $\rightarrow$ `HOD Approval` $\rightarrow$ `Procurement Review` $\rightarrow$ `Director Approval`.
   - Open `REQ-PUR-2026-008` (Returned Autoclave Requisition):
     - Show the reviewer note: *"Please attach competitive vendor quotations from at least two certified bio-medical suppliers before resubmitting."*
     - Demonstrate that the requester can upload new PDF quotes and click **Resubmit Request**.

---

### Part 2: The Finance-First Rule in Action
2. **Login as Finance Officer** (`finance@mediflow.com` / `password123`):
   - Navigate to the **Approver Dashboard** (`/approver`).
   - Observe `REQ-PUR-2026-002` (₹8,50,000) waiting at the top of the Finance queue.
   - Click on the request to view details, CAPEX budget code, justification, and vendor warranty terms.
   - Click **Approve Step** with comment: *"Capital expenditure authorized under CAPEX-CARDIO-2026-Q3."*
   - Observe that the request advances to Step 2 (Cardiology HOD Approval).

---

### Part 3: HOD Multi-Role & No-Self-Approval Demonstration
3. **Login as Cardio Head** (`hod.cardio@mediflow.com` / `password123`):
   - Navigate to the **Approver Dashboard**:
     - See `REQ-PUR-2026-001` (Sterile ECG Electrodes) and approve it.
     - See `REQ-PUR-2026-002` (Echocardiography system now at HOD stage after Finance clearance) and approve it.
   - Open `REQ-MNT-2026-003` (Cath Lab AHU Overhaul initiated by this HOD):
     - Point out that because Cardio Head is the requester, **the system prevented self-approval** and automatically routed Step 1 to **Hospital Director**!

---

### Part 4: Dynamic Forwarding & Delegation
4. **Login as Facilities Officer** (`maintenance@mediflow.com` / `password123`):
   - Open `REQ-MNT-2026-004` (MRI Chiller emergency leak).
   - Point out that Cardio HOD has already signed off.
   - Facilities team has inspected the unit, but requires bio-medical engineering specialist analysis.
   - Click **Forward Request**:
     - Select recipient: `hod.it@mediflow.com` (IT & Bio-Medical Engineering Head).
     - Enter comment: *"Forwarding for specialized OEM chiller cryogenic calibration."*
     - Click **Confirm Forward**.
   - Show that the request remains active in `IN_REVIEW` at Facilities Processing, but is now assigned specifically to `hod.it@mediflow.com`.

---

### Part 5: Final Executive & Procurement Sign-Off
5. **Login as Hospital Director** (`director@mediflow.com` / `password123`):
   - See `REQ-MNT-2026-003` (HOD repair request) and approve it.
   - See `REQ-PUR-2026-002` (High-Value Ultrasound final stage) and grant executive authorization.

6. **Login as Procurement Officer** (`purchase@mediflow.com` / `password123`):
   - Open `REQ-PUR-2026-001` and approve the purchase order issuance, completing the requisition to `APPROVED`.

---

### Part 6: System Administration, Customization & Audit Logs
7. **Login as System Administrator** (`admin@mediflow.com` / `password123`):
   - Open **User Management** (`/admin/users`) to show user provisioning and active status toggling.
   - Open **Visual Workflow Builder** (`/admin/workflows`) to demonstrate how templates and steps are configured with versioning.
   - Open **System Terminology** (`/admin/terminology`) to demonstrate renaming hospital terminology.
   - Open **Audit Log Explorer** (`/admin/audit-logs`):
     - Show the complete, tamper-evident audit ledger capturing every action taken during the demo.
