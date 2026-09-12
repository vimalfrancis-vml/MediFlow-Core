# MediFlow Master Demo Accounts Directory

> **Default Password for All Accounts:** `password123`

This document lists every demo account pre-configured in the MediFlow system for demonstrations, stakeholder reviews, and system verification.

---

## 1. Executive Leadership & System Administration

| Email Address | Role | Display Name | Department | Purpose in Demonstrations |
| :--- | :--- | :--- | :--- | :--- |
| `admin@mediflow.com` | `ADMIN` | System Administrator | Information Technology | Master administrative access: manage users, departments, visual workflow builder, terminology, audit ledger, and administrative overrides. |
| `director@mediflow.com` | `DIRECTOR` | Hospital Director | Hospital Administration | Executive authorization for capital purchases (> ₹1,00,000) and HOD maintenance auto-escalations. |
| `medsupt@mediflow.com` | `MEDICAL_SUPERINTENDENT` | Medical Superintendent | Hospital Administration | Clinical oversight, extended/emergency leave approval (> 14 days), and HOD leave escalations. |

---

## 2. Department Heads (HODs)

Department heads review, endorse, or return requests initiated by clinical and operational staff within their department.

| Email Address | Role | Department | Primary Function |
| :--- | :--- | :--- | :--- |
| `hod.cardio@mediflow.com` | `HOD` | Cardiology | Authorizes cardiology doctor and nurse requisitions, staff leave, and medical supplies. |
| `hod.it@mediflow.com` | `HOD` | IT & Bio-Medical Engineering | Authorizes IT infrastructure and receives forwarded specialized engineering work orders. |
| `hod.proc@mediflow.com` | `HOD` | Procurement & Supply Chain | Departmental procurement head. |
| `hod.fac@mediflow.com` | `HOD` | Facilities & Maintenance | Departmental facilities leadership. |
| `hod.hr@mediflow.com` | `HOD` | Human Resources | Departmental HR leadership. |
| `hod.admin@mediflow.com` | `HOD` | Hospital Administration | Departmental administrative leadership. |
| `hod.fin@mediflow.com` | `HOD` | Finance & Accounts | Departmental finance leadership. |

---

## 3. Specialized Processing & Clearance Officers

Processing officers handle institutional fulfillment, technical work orders, leave processing, and budgetary clearances.

| Email Address | Role | Department | Key Responsibility |
| :--- | :--- | :--- | :--- |
| `finance@mediflow.com` | `FINANCE_OFFICER` | Finance & Accounts | **Mandatory Step-1 Finance Review** on qualifying requisitions > ₹1,00,000 (Finance-First Invariant). |
| `purchase@mediflow.com` | `PURCHASE_OFFICER` | Procurement & Supply Chain | Procurement review, vendor quote validation, PO generation, and purchase sign-off. |
| `maintenance@mediflow.com` | `MAINTENANCE_OFFICER` | Facilities & Maintenance | Work order dispatch, equipment repairs, facility servicing, and dynamic peer forwarding. |
| `hr@mediflow.com` | `HR` | Human Resources | Leave balance verification, roster coverage verification, and leave approval. |

---

## 4. Requisition Originators (Staff & Doctors)

Staff accounts used to draft, submit, track, and upload documentation for hospital requisitions.

| Email Address | Role | Name | Department | Primary Use in Demo |
| :--- | :--- | :--- | :--- | :--- |
| `dr.employee@mediflow.com` | `EMPLOYEE` | Staff Doctor | Cardiology | Main requisition originator account for normal purchases, high-value ultrasounds, leave, and returned items. |
| `employee1@mediflow.com` | `EMPLOYEE` | Vimal Francis | Cardiology | Originator for fully approved defibrillator order (`REQ-PUR-2026-005`). |
| `employee2@mediflow.com` | `EMPLOYEE` | Aashna Babu | Human Resources | Submits HR internal requisitions. |
| `employee3@mediflow.com` | `EMPLOYEE` | Bestin Byju | Procurement | Submits Procurement internal requisitions. |
| `employee4@mediflow.com` | `EMPLOYEE` | Adhityan Kr | Cardiology | Originator for rejected luxury furniture request (`REQ-PUR-2026-006`). |

---

## 5. Seeded Demo Scenarios Quick Reference

| Ref # | Title | Type | Status | Key Feature Highlight |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-PUR-2026-001` | Cardiology Ward ECG Supplies | Purchase (₹18,500) | `IN_REVIEW` | Standard 2-step purchase pending HOD review (`hod.cardio`). |
| `REQ-PUR-2026-002` | ICU Echocardiography System | Purchase (₹8,50,000) | `IN_REVIEW` | **Finance-First Invariant (> ₹1L)**: Step 1 pending Finance (`finance`). |
| `REQ-MNT-2026-003` | Cath Lab AHU HEPA Overhaul | Maintenance | `IN_REVIEW` | **No-Self-Approval**: Initiated by HOD, auto-escalated to Director (`director`). |
| `REQ-MNT-2026-004` | MRI Chiller Refrigerant Leak | Maintenance | `IN_REVIEW` | **Dynamic Forwarding**: Forwarded by Maintenance Officer to IT Head (`hod.it`). |
| `REQ-PUR-2026-005` | ER Defibrillator Batteries | Purchase (₹64,000) | `APPROVED` | **Completed Workflow**: Shows timestamps, PO number, and sealed state. |
| `REQ-PUR-2026-006` | Staff Lounge Recliners | Purchase (₹1,20,000) | `REJECTED` | **Rejection with Reason**: Rejected by Finance Officer with budgetary feedback. |
| `REQ-LEV-2026-007` | Annual Medical Conference Leave | Leave (6 Days) | `IN_REVIEW` | **Multi-Stage Leave**: Approved by HOD, pending HR Processing (`hr`). |
| `REQ-PUR-2026-008` | Autoclave Consumables | Purchase (₹42,000) | `RETURNED` | **Returned State**: Returned by HOD for competitive supplier quotations. |
