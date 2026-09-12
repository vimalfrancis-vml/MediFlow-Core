# MediFlow User Roles & Permissions Matrix

This document defines the Role-Based Access Control (RBAC) architecture, permissions matrix, department-scoping rules, and demo accounts pre-configured in MediFlow.

---

## 1. Role Definitions

| Role Code | System Display Name | Department | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| `ADMIN` | System Administrator | IT | Full system administration, user provisioning, workflow builder, audit trail analysis, and administrative overrides. |
| `DIRECTOR` | Hospital Director | Administration | Executive approval authority for high-value purchases (> ₹1,00,000) and institutional HOD escalations. |
| `MEDICAL_SUPERINTENDENT` | Medical Superintendent | Administration | Clinical administration, extended/emergency leave oversight (> 14 days or HIGH priority), and HOD leave approvals. |
| `HOD` | Head of Department | Variable (Assigned Dept) | Primary departmental authorization for equipment repairs, staff leave, and purchase requisitions within their department. |
| `HR` | Human Resources Officer | Human Resources | Verification of staff leave balances, duty rosters, and leave application processing. |
| `PURCHASE_OFFICER` | Procurement Officer | Procurement | Requisition review, vendor quotations, budget code verification, and PO issuance. |
| `MAINTENANCE_OFFICER` | Facilities Officer | Facilities | Hospital infrastructure repairs, bio-medical equipment servicing, and work order fulfillment. |
| `FINANCE_OFFICER` | Finance Officer | Finance | Mandatory Stage-1 budgetary clearance and capital expenditure approval for requisitions > ₹1,00,000. |
| `EMPLOYEE` | Hospital Staff / Doctor | Variable (Assigned Dept) | Requisition originator: drafting, submitting, tracking, uploading quotes, and managing personal requests. |

---

## 2. Permissions Matrix

| Functional Area / Action | `ADMIN` | `DIRECTOR` | `MED_SUPT` | `HOD` | `HR` | `PURCHASE` | `MAINTENANCE` | `FINANCE` | `EMPLOYEE` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Create & Submit Request** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** |
| **View Own Requests** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** |
| **Cancel Own Pending Request** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** |
| **Upload Attachments & Quotes** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** |
| **Add Discussion Comments** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** |
| **Approve / Reject Department Requests** | — | — | — | **Yes (Own Dept)** | — | — | — | — | — |
| **Process Leave Applications** | — | — | — | — | **Yes** | — | — | — | — |
| **Process Purchase Requisitions** | — | — | — | — | — | **Yes** | — | — | — |
| **Process Maintenance Work Orders** | — | — | — | — | — | — | **Yes** | — | — |
| **Finance-First High-Value Review** | — | — | — | — | — | — | — | **Yes (FIN Dept)** | — |
| **Director Executive Approval** | — | **Yes** | — | — | — | — | — | — | — |
| **Medical Superintendent Approval** | — | — | **Yes** | — | — | — | — | — | — |
| **Dynamic Forwarding (Peer Delegation)** | — | Yes | Yes | Yes | Yes | Yes | Yes | Yes | — |
| **Administrative Overrides** | **Yes\*** | — | — | — | — | — | — | — | — |
| **Manage Users & Departments** | **Yes** | — | — | — | — | — | — | — | — |
| **Visual Workflow Builder** | **Yes** | — | — | — | — | — | — | — | — |
| **System Terminology Customizer** | **Yes** | — | — | — | — | — | — | — | — |
| **System Audit Log Explorer** | **Yes** | — | — | — | — | — | — | — | — |

*\*Note: Administrative Overrides require mandatory justification logging and cannot bypass Step 1 Finance clearance on requisitions > ₹1,00,000.*

---

## 3. Department Scoping Rules

1. **HOD Scoping**:
   - A Head of Department can only approve, reject, return, or forward requests originating from their assigned department (`request.departmentId === user.departmentId`).
2. **Finance Scoping**:
   - Only personnel belonging to the Finance & Accounts Department (`department.code === 'FIN'`) can review and approve Step 1 Finance stages.
3. **Approver Department Step Scoping**:
   - When a workflow step specifies `approverDepartmentId`, only active personnel in that department matching the required role can take action.

---

## 4. Master Demo Accounts Directory

> **Default Password for All Demo Accounts:** `password123`

| Email Address | Role | Name | Department | Primary Use Case in Demo |
| :--- | :--- | :--- | :--- | :--- |
| `admin@mediflow.com` | `ADMIN` | System Admin | Information Technology | Administer users, workflows, terminology, audit logs, overrides. |
| `director@mediflow.com` | `DIRECTOR` | Hospital Director | Hospital Administration | Final sign-off on purchases > ₹1,00,000 and HOD escalations. |
| `medsupt@mediflow.com` | `MEDICAL_SUPERINTENDENT` | Medical Superintendent | Hospital Administration | Extended leave approvals (> 14 days) and HOD leave escalations. |
| `hod.cardio@mediflow.com` | `HOD` | Cardio Head | Cardiology | Approve cardiology staff requisitions and demonstrate HOD rules. |
| `hod.it@mediflow.com` | `HOD` | IT Head | IT & Bio-Medical | Forwarding recipient for specialized equipment inspection. |
| `hod.proc@mediflow.com` | `HOD` | Procurement Head | Procurement & Supply Chain | Approve procurement departmental requests. |
| `hod.fac@mediflow.com` | `HOD` | Facilities Head | Facilities & Maintenance | Departmental facilities oversight. |
| `hod.hr@mediflow.com` | `HOD` | HR Head | Human Resources | Departmental HR oversight. |
| `hod.admin@mediflow.com` | `HOD` | Admin Head | Hospital Administration | Administrative staff approval. |
| `hod.fin@mediflow.com` | `HOD` | Finance Head | Finance & Accounts | Departmental finance leadership. |
| `finance@mediflow.com` | `FINANCE_OFFICER` | Finance Officer | Finance & Accounts | **Step 1 Finance-First clearance** on high-value requisitions. |
| `purchase@mediflow.com` | `PURCHASE_OFFICER` | Purchase Officer | Procurement & Supply Chain | Procurement review, vendor quotes, PO generation. |
| `maintenance@mediflow.com` | `MAINTENANCE_OFFICER` | Maintenance Officer | Facilities & Maintenance | Facilities work orders, equipment repair, dynamic forwarding. |
| `hr@mediflow.com` | `HR` | HR Manager | Human Resources | Processing staff leave applications and balance checks. |
| `dr.employee@mediflow.com` | `EMPLOYEE` | Staff Doctor | Cardiology | Main requisition originator for leave, repairs, and supplies. |
| `employee1@mediflow.com` | `EMPLOYEE` | Vimal Francis | Cardiology | Multi-user workflow and approved requisition testing. |
| `employee2@mediflow.com` | `EMPLOYEE` | Aashna Babu | Human Resources | Submit HR departmental requests. |
| `employee3@mediflow.com` | `EMPLOYEE` | Bestin Byju | Procurement | Submit Procurement departmental requests. |
| `employee4@mediflow.com` | `EMPLOYEE` | Adhityan Kr | Cardiology | Submit Cardiology requests and rejected test cases. |
