# MediFlow - Master Demo Accounts Directory

> **Default Password for All Demo Accounts:** `password123`

This document lists every account pre-configured in the MediFlow system for demonstrations, testing, and client review.

---

## 1. System Administration & Management

| Email Address | Password | Name | Role | Department | Purpose in Demo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `admin@mediflow.com` | `password123` | System Admin | System Admin (`ADMIN`) | Information Technology | Manage users, view all departments, oversee system health. |
| `director@mediflow.com` | `password123` | Hospital Director | Hospital Director (`DIRECTOR`) | Administration | Review and approve high-value requests (purchases over ₹1,00,000). |
| `medsupt@mediflow.com` | `password123` | Medical Superintendent | Medical Superintendent (`MEDICAL_SUPERINTENDENT`) | Administration | Executive review of medical department operations and clinical requests. |

---

## 2. Department Heads (HODs)

Department Heads receive requests submitted by staff members in their department before forwarding them to functional teams.

| Email Address | Password | Name | Role | Department | Purpose in Demo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hod.cardio@mediflow.com` | `password123` | Cardio Head | Head of Department (`HOD`) | Cardiology | Approve leave, equipment repair, or purchase requests from doctors/nurses in Cardiology. |
| `hod.hr@mediflow.com` | `password123` | HR Head | Head of Department (`HOD`) | Human Resources | Approve internal HR department requests. |
| `hod.proc@mediflow.com` | `password123` | Procurement Head | Head of Department (`HOD`) | Procurement | Approve internal procurement department requests. |
| `hod.it@mediflow.com` | `password123` | IT Head | Head of Department (`HOD`) | Information Technology | Approve IT department requests and hardware needs. |
| `hod.fac@mediflow.com` | `password123` | Facilities Head | Head of Department (`HOD`) | Facilities | Approve facilities team requests. |
| `hod.admin@mediflow.com` | `password123` | Admin Head | Head of Department (`HOD`) | Administration | Approve administration staff requests. |

---

## 3. Specialized Processing Officers

Processing Officers handle the final stage of request fulfillment after HOD approval.

| Email Address | Password | Name | Role | Department | Purpose in Demo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hr@mediflow.com` | `password123` | HR Manager | HR Officer (`HR`) | Human Resources | Process staff leave applications once approved by HOD. |
| `purchase@mediflow.com` | `password123` | Purchase Officer | Procurement Officer (`PURCHASE_OFFICER`) | Procurement | Review, source, and complete equipment purchase requests. |
| `maintenance@mediflow.com` | `password123` | Maintenance Officer | Facilities Officer (`MAINTENANCE_OFFICER`) | Facilities | Assign and resolve facility repair or maintenance tickets. |

---

## 4. Hospital Staff & Doctors (Requesters)

Staff accounts used to create and submit new requests.

| Email Address | Password | Name | Role | Department | Purpose in Demo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `dr.employee@mediflow.com` | `password123` | Staff Doctor | Staff Member (`EMPLOYEE`) | Cardiology | Main demo account for submitting leave, repair, or medical supply requests. |
| `employee1@mediflow.com` | `password123` | Vimal Francis | Staff Member (`EMPLOYEE`) | Cardiology | Secondary Cardiology staff account for multi-user workflow testing. |
| `employee2@mediflow.com` | `password123` | Aashna Babu | Staff Member (`EMPLOYEE`) | Human Resources | Submit HR department internal requests. |
| `employee3@mediflow.com` | `password123` | Bestin Byju | Staff Member (`EMPLOYEE`) | Procurement | Submit Procurement department requests. |
| `employee4@mediflow.com` | `password123` | Adhityan Kr | Staff Member (`EMPLOYEE`) | Cardiology | Submit Cardiology department requests. |

---

## Quick Testing Scenarios

1. **Leave Application**:
   * Log in as `dr.employee@mediflow.com` $\rightarrow$ Submit Leave Request.
   * Log in as `hod.cardio@mediflow.com` $\rightarrow$ Approve Request.
   * Log in as `hr@mediflow.com` $\rightarrow$ Process & Complete Request.

2. **High-Value Equipment Purchase (Auto-Escalation)**:
   * Log in as `dr.employee@mediflow.com` $\rightarrow$ Submit Purchase Request with cost > ₹1,00,000.
   * Log in as `hod.cardio@mediflow.com` $\rightarrow$ Approve Request.
   * Log in as `director@mediflow.com` $\rightarrow$ Approve High-Value Escalation Step.
   * Log in as `purchase@mediflow.com` $\rightarrow$ Final Procurement Approval.

3. **Facility Repair Request**:
   * Log in as `dr.employee@mediflow.com` $\rightarrow$ Submit Repair Request for broken equipment.
   * Log in as `hod.cardio@mediflow.com` $\rightarrow$ Approve Request.
   * Log in as `maintenance@mediflow.com` $\rightarrow$ Mark Repair Complete.
