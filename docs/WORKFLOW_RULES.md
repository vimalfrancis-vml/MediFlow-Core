# MediFlow Workflow Rules & Business Invariants Specification

This document defines the formal operational rules, mathematical thresholds, escalation paths, and system invariants enforced by the MediFlow Core Engine.

---

## 1. System Invariants (Non-Bypassable Rules)

System invariants represent core hospital governance policies hardcoded into the workflow engine. They cannot be bypassed by admin template configurations or standard UI operations.

```
+-------------------------------------------------------------------------------+
|                             SYSTEM INVARIANTS                                 |
+-------------------------------------------------------------------------------+
|  1. FINANCE-FIRST INVARIANT:                                                  |
|     Qualifying requests > ₹1,00,000 MUST have Finance Review as Step 1.       |
|                                                                               |
|  2. NO-SELF-APPROVAL INVARIANT:                                                |
|     A requester can NEVER approve, reject, or forward their own request.     |
|                                                                               |
|  3. IN-FLIGHT STABILITY INVARIANT:                                            |
|     Active requests are permanently pinned to their submission template.      |
|                                                                               |
|  4. SCOPED FORWARDING INVARIANT:                                              |
|     Forwarding reassigns the reviewer without completing or advancing step.  |
+-------------------------------------------------------------------------------+
```

---

## 2. Finance-First Rule (> ₹1,00,000)

### 2.1 Rule Definition
Whenever a requisition involves monetary expenditure (e.g., `PURCHASE` request) and the `estimatedCost` exceeds **₹1,00,000.00 (INR One Lakh)**:
1. The workflow engine automatically prepends **Step 1: Finance Department Review** before any departmental or procurement reviews.
2. The approver role is set to `FINANCE_OFFICER`, strictly scoped to the Finance & Accounts Department (`department.code === 'FIN'`).
3. If an admin-configured template contains a Finance Officer step in a later position, that step is moved to **Step 1**.
4. In addition, for purchases exceeding ₹1,00,000, **Director Approval** is appended as the final executive approval step.

### 2.2 Sequence Comparison

#### Standard Purchase (<= ₹1,00,000):
$$\text{Requester} \longrightarrow \text{Step 1: HOD Approval} \longrightarrow \text{Step 2: Procurement Review} \longrightarrow \text{APPROVED}$$

#### High-Value Purchase (> ₹1,00,000):
$$\text{Requester} \longrightarrow \mathbf{\text{Step 1: Finance Department Review}} \longrightarrow \text{Step 2: HOD Approval} \longrightarrow \text{Step 3: Procurement Review} \longrightarrow \mathbf{\text{Step 4: Director Approval}} \longrightarrow \text{APPROVED}$$

### 2.3 Hardened Enforcement
- Administrative overrides (`ADMIN_OVERRIDE`) are **expressly prohibited** from bypassing Step 1 Finance Clearance for high-value requests. Attempting to override Step 1 will return HTTP 403 Forbidden:
  > *"Administrative override cannot bypass mandatory Finance-first approval for high-value requests exceeding ₹1,00,000."*

---

## 3. No-Self-Approval & HOD Escalation Rules

### 3.1 Self-Approval Prevention
Under no circumstances may any user approve their own request:
- `canUserActOnRequest(requestId, userId)` returns `false` if `userId === request.requestedById`.
- Backend endpoints return HTTP 403 Forbidden if a user attempts to execute approval, rejection, or return actions on their own request.

### 3.2 HOD Originator Dynamic Escalations
When a Head of Department (`role === 'HOD'`) initiates a request, the normal "Step 1: HOD Approval" would create a conflict of interest. The `RuleEvaluator` dynamically adjusts the steps:

| Request Type | Baseline Step 1 | Requester is HOD: Dynamic Modification | Reason |
| :--- | :--- | :--- | :--- |
| **`MAINTENANCE`** | HOD Approval | Replaced with **Director Approval** (`DIRECTOR`) | Executive facilities oversight for departmental heads. |
| **`LEAVE`** | HOD Approval | Replaced with **Medical Superintendent Approval** (`MEDICAL_SUPERINTENDENT`) | Clinical administration oversight for department heads. |
| **`PURCHASE`** | HOD Approval | HOD approval **omitted**; moves directly to Procurement / Finance / Director | HOD has already authorized their department requisition. |

---

## 4. Dynamic Forwarding & Delegation Rules

### 4.1 Mechanics
Dynamic Forwarding allows an active reviewer to reassign the pending request to another qualified user without approving, completing, or advancing the workflow step.

- **State Effect**: `request.assignedToUserId` is updated to the recipient user ID.
- **Workflow Effect**: `request.currentStepId` remains unchanged in `IN_REVIEW`.
- **Action Record**: An `ApprovalAction` with action type `FORWARDED` is created, storing the forwarder's comment.
- **Audit Log**: An audit entry is created recording `actorId`, `targetUser`, role, and timestamp.
- **Notification**: In-app alert sent to the assigned recipient.

### 4.2 Eligible Recipient Constraints
A user is eligible to receive a forwarded request if and only if all of the following conditions are satisfied:
1. `user.isActive === true` (Inactive users cannot receive requests).
2. `user.role === request.currentStep.approverRole` (Must match required step role).
3. `user.id !== request.requestedById` (Cannot forward to original requester).
4. `user.id !== currentActor.id` (Cannot self-forward).
5. `user.id !== request.assignedToUserId` (Cannot forward to existing assignee).
6. **Department Scoping**:
   - If `approverRole === 'HOD'`: `user.departmentId === request.departmentId`.
   - If `approverRole === 'FINANCE_OFFICER'`: `user.department.code === 'FIN'`.
   - If step has `approverDepartmentId`: `user.departmentId === step.approverDepartmentId`.

---

## 5. Workflow Versioning & In-Flight Stability

### 5.1 Versioning Model
1. Base templates have integer versions (`version: 1`, `version: 2`, ...).
2. When an administrator edits a workflow template:
   - A new version record is created (`version = currentMax + 1`).
   - The new version is marked `isActive: true`, and the previous version is set to `isActive: false`.

### 5.2 In-Flight Protection
- Requests in `IN_REVIEW`, `APPROVED`, `REJECTED`, or `CANCELLED` maintain a foreign key to their original `workflowTemplateId`.
- The workflow engine **never re-evaluates or alters steps** for in-flight requests when a new template version is published.
- Only new draft requests created after activation use the new template version.

---

## 6. Administrative Overrides Governance

### 6.1 Purpose
Administrative overrides allow authorized System Administrators (`ADMIN`) to unblock requests in cases of prolonged reviewer absence, emergency operational needs, or critical hospital deadlocks.

### 6.2 Safeguards & Audit Logging
1. **Role Restriction**: Only users with `role === 'ADMIN'` can perform overrides.
2. **Mandatory Justification**: `overrideReason` string is strictly required. Submitting an empty reason returns HTTP 400 Bad Request.
3. **Finance Protection**: Overrides cannot bypass Step 1 Finance review for requisitions > ₹1,00,000.
4. **Audit Immutability**: Actions are logged with distinct audit tags:
   - `ADMIN_OVERRIDE_STEP_APPROVAL`
   - `ADMIN_OVERRIDE_FINAL_APPROVAL`
   - `ADMIN_OVERRIDE_REJECTION`
