# Key Design & Architectural Decisions

*Document Version: 1.0 (Client Handover Edition)*

This document explains the key design choices made during the creation of **MediFlow**, detailing *why* the system was built this way to help hospital administrators and IT leads understand its foundation.

---

## 1. Flexible & Customizable Workflows
* **What We Built:** Approval paths for requests (Leave, Equipment Purchases, Facilities Maintenance) are stored as flexible system rules rather than fixed code.
* **Why This Matters:** Hospital policies and approval hierarchies change over time. By storing workflow rules flexibly, administrators can adjust approval steps without needing software developers to rewrite the core application code.
* **Benefit to Hospital:** Saves long-term maintenance costs and allows hospital management to update approval rules whenever internal policies change.

---

## 2. Dynamic High-Value Approval Escalation
* **What We Built:** An automatic spending threshold checker. Any purchase request exceeding **₹1,00,000** automatically adds a Hospital Director approval step into the approval chain.
* **Why This Matters:** Routine medical supplies can be approved quickly by Department Heads and Purchase Officers, but major capital purchases require executive oversight.
* **Benefit to Hospital:** Prevents unauthorized large expenditures while ensuring low-cost daily items are approved without unnecessary management delays.

---

## 3. Unified Screen Design & Navigation Header
* **What We Built:** A single shared top header and screen framework that adapts dynamically to whoever is logged in (Doctor, HOD, Director, HR Manager, or Administrator).
* **Why This Matters:** Keeps the visual design consistent, modern, and predictable across all departments.
* **Benefit to Hospital:** Reduces training time for hospital staff. Switching between roles or viewing different pages feels seamless and familiar.

---

## 4. Instant Status Notifications & Badge System
* **What We Built:** A top-corner notification bell that updates hospital staff whenever a request requires their action or when their own application status changes.
* **Why This Matters:** Doctors and managers don't need to manually check their email or call other departments to ask "Did you approve my request?". The application alerts them immediately inside the system.
* **Benefit to Hospital:** Accelerates request processing times and eliminates phone/email follow-up bottlenecks.

---

## 5. Complete Audit Trail & Visual History Timeline
* **What We Built:** Every action—creation, approval, rejection, or comment—is automatically saved with exact dates, times, and user details, and displayed as a visual progress timeline on each request.
* **Why This Matters:** Transparency is essential in medical operations. Everyone can see exactly where a request is stuck, who approved it, and why a decision was made.
* **Benefit to Hospital:** Provides 100% accountability, satisfies institutional audit standards, and prevents lost paperwork.

---

## 6. Accessibility & Clean Interface Standard
* **What We Built:** High-contrast text colors, clear buttons, keyboard navigation support, and simple status badges (e.g., Green for Approved, Yellow for Pending, Red for Rejected).
* **Why This Matters:** Hospital staff work under high-stress, fast-paced conditions and use a variety of computer monitors and tablets.
* **Benefit to Hospital:** Reduces user error, prevents eye strain, and ensures all hospital staff can easily use the software regardless of technical skill.
