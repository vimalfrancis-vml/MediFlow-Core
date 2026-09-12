# MediFlow Administrator Guide

This guide details all administration capabilities available in the MediFlow Admin Control Center (`/admin`).

---

## 1. Accessing Admin Tools

1. Log in with an administrator account (e.g. `admin@mediflow.com` / `password123`).
2. The navigation bar will display the **Admin** dropdown with direct links to:
   - **User Management** (`/admin/users`)
   - **Department Management** (`/admin/departments`)
   - **Roles & Permissions** (`/admin/roles`)
   - **Workflow Templates** (`/admin/workflows`)
   - **System Terminology** (`/admin/terminology`)
   - **Audit Logs Explorer** (`/admin/audit-logs`)

---

## 2. User Lifecycle Management (`/admin/users`)

The User Management module allows administrators to create, edit, deactivate, and soft-delete hospital personnel.

### 2.1 Provisioning a New User
1. Click **+ Add User** in the top-right toolbar.
2. Fill in the required fields:
   - **Employee ID**: Unique identifier (e.g. `EMP-205`).
   - **Email Address**: Official hospital email.
   - **Password**: Minimum 8 characters.
   - **First & Last Name**.
   - **Department**: Select from configured active departments.
   - **System Role**: Select from the 9 system roles.
3. Click **Save User**.

### 2.2 Modifying & Deactivating Users
- **Edit User**: Update user details, reassign departments, or update role assignments.
- **Deactivate User**: Toggling **Active Status** to `Inactive` immediately prevents the user from logging in or receiving forwarded approval tasks. Existing requests created by the user remain safely intact in their historical state.
- **Soft Delete**: Removing a user preserves database foreign keys and all audit history while preventing future system interactions.

---

## 3. Department Management (`/admin/departments`)

The Department Management module governs clinical, operational, and administrative hospital divisions.

### 3.1 Managing Departments & HOD Assignments
- **Add Department**: Provide department name, unique code (e.g., `NEURO`, `ICU`), and display name.
- **Assign HOD**: Select an active user with role `HOD` to head the department. Requests submitted by staff within this department are routed to this HOD.
- **Finance Identification**: The Finance Department code `FIN` is permanently recognized by the workflow engine for the **Finance-First Invariant**.

---

## 4. Visual Workflow Builder (`/admin/workflows`)

The Visual Workflow Builder allows administrators to configure step sequences, assign approver roles, define optional department constraints, and toggle dynamic forwarding.

### 4.1 Creating & Editing Workflow Templates
1. Select the target Request Type (`Purchase`, `Maintenance`, `Leave`).
2. Define template metadata: Name, description, and status.
3. Add and order workflow steps:
   - **Step Name**: Human-readable label (e.g., `Biomedical Engineering Review`).
   - **Approver Role**: The role required to sign off on this step.
   - **Department Scope (Optional)**: Restrict the step to a specific department.
   - **Allow Dynamic Forwarding**: Enable/disable peer reassignment for this step.
   - **Final Step**: Marks the concluding step that seals the request as `APPROVED`.
4. Click **Publish Workflow Version**.

### 4.2 Versioning & In-Flight Stability
- When a workflow is updated, MediFlow increments the template version (`v1` $\rightarrow$ `v2`).
- The new version is marked active for all future draft submissions.
- **Ongoing requests in `IN_REVIEW` are never disrupted** and continue following the exact step definition in place at the time they were submitted.

---

## 5. System Terminology Customizer (`/admin/terminology`)

MediFlow supports localized and hospital-specific terminology overrides without requiring code changes.

- Customizing labels (e.g., changing *"Purchase Request"* to *"Procurement Indent"* or *"Maintenance Work Order"* to *"Facilities Ticket"*).
- The updated terminology immediately propagates across all employee and approver interfaces.

---

## 6. Audit Log Explorer (`/admin/audit-logs`)

The Audit Log Explorer provides an immutable, real-time ledger of all hospital operations for compliance (NABH, JCI, ISO 9001) and internal controls.

### 6.1 Audit Fields
- **Timestamp**: Exact UTC and local timestamp.
- **Actor**: Name, email, and role of the initiating user.
- **Action**: Event category (`SUBMITTED`, `STEP_APPROVED`, `APPROVED`, `REJECTED`, `RETURNED`, `FORWARDED`, `ATTACHMENT_UPLOADED`, `ADMIN_OVERRIDE_*`).
- **Request Reference**: Clickable link to the requisition details.
- **Description**: Detailed narrative describing the event, comments, or justification.

---

## 7. Administrative Overrides Governance

If a request becomes blocked due to prolonged approver unavailability or emergency operational deadlocks:
1. Open the stuck request as an `ADMIN`.
2. Click **Admin Override**.
3. Choose the action: **Approve Current Step**, **Grant Final Approval**, or **Reject Request**.
4. Enter a **Mandatory Justification Reason** (e.g. *"Dr. Cardio on unscheduled emergency clinical duty; critical ER supply authorized per Medical Director instruction."*).
5. The override is atomically committed and logged with high-visibility audit tags.
6. *Note*: Administrative overrides **cannot bypass Step 1 Finance Clearance** on purchases exceeding ₹1,00,000.
