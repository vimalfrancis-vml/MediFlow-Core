# Architectural Decision Log

*Last Updated: 2026-07-18*

This document serves as a historical record of major architectural and design decisions made throughout the MediFlow project. Its purpose is to explain *why* certain approaches were chosen, making developer onboarding and future AI sessions much easier.

---

## Dynamic Workflow Architecture
### Date
2026-07-18
### Decision
Workflows are data-driven via `WorkflowTemplate` and `WorkflowStep` database tables rather than hardcoded in the codebase.
### Reason
Different request types (Maintenance, Purchase, Leave) require entirely different, often complex approval chains that may change frequently based on hospital policy. Hardcoding these chains would require constant code deployments. A dynamic structure allows administrators to adjust pipelines safely.
### Alternatives Considered
Hardcoding approval logic in specific services (e.g., `LeaveService`, `PurchaseService`). This was rejected due to lack of flexibility and high long-term maintenance overhead.
### Status
Active

---

## DashboardLayout & DashboardHeader Introduction
### Date
2026-07-18
### Decision
Implement a unified `DashboardLayout` and `DashboardHeader` to wrap all authenticated routes.
### Reason
To guarantee a consistent navigation experience, strict layout bounds, and uniform branding across all role-based dashboards (Admin, Approver, Employee), avoiding UI drift and duplicated layout code across page components.
### Alternatives Considered
Duplicating a navbar component in every single page view. Rejected due to code duplication and difficulty in maintaining consistent spacing.
### Status
Active

---

## Shared UI Component Standardization
### Date
2026-07-18
### Decision
Standardize loading and empty states using shared `LoadingState` and `EmptyState` components.
### Reason
To provide a highly polished, consistent user experience across the application whenever data is being fetched or when a list/table has no records to display.
### Alternatives Considered
Using plain text ("Loading..." or "No data") directly inside pages. Rejected as it violates the project philosophy of premium aesthetics and reusable components.
### Status
Active

---

## Notification Refresh Event System
### Date
2026-07-18
### Decision
Use a custom window event (`NOTIFICATIONS_REFRESH_EVENT`) for cross-component communication to trigger notification fetches.
### Reason
Components deep in the React tree need a way to tell the globally-mounted `NotificationCenter` that an action occurred (e.g., a request was approved) so it can refresh the unread count. Using a native custom event is lightweight and avoids introducing complex, heavy state-management libraries (like Redux or Zustand) just for notification triggers.
### Alternatives Considered
- Redux / Zustand: Deemed over-engineering for the current MVP scope.
- Prop drilling: Impossible since the Notification Center sits at a different level in the layout hierarchy.
- WebSockets: Acknowledged as the optimal long-term solution, but deferred to the post-MVP roadmap to maintain rapid development speed.
### Status
Active

---

## Accessibility-First UI Standardization
### Date
2026-07-18
### Decision
Mandate ARIA labels, semantic HTML, and visible focus states across all interactive elements.
### Reason
To ensure the application is usable by all hospital staff, including those relying on screen readers or keyboard navigation, aligning with standard compliance requirements for medical software.
### Alternatives Considered
None. Accessibility is a hard requirement for the project philosophy.
### Status
Active
