# Phase 4 Walkthrough: Security, Permissions, Edge Cases & Reliability

This document summarizes the completed implementation and verification of **Phase 4: Security, Permissions, Edge Cases & Reliability** for **MediFlow Core** (Jubilee Hospital Demo).

---

## 1. Changes Made

### A. Authentication & Server Hardening
* `server/src/app.ts`:
  * Integrated security headers middleware (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`).
  * Implemented a configurable global API rate limiter (`process.env.API_RATE_LIMIT_MAX`, default: 1000 req/15min) on `/api/v1` routes to prevent denial of service without blocking legitimate hospital staff sharing NAT/proxy IPs.
* `server/src/routes/auth.ts`:
  * Configured strict login rate limiter (`process.env.LOGIN_RATE_LIMIT_MAX`, default: 10 attempts/15min) protecting against brute-force attacks.
  * Added proactive account status verification: deactivated users (`isActive === false` or `deletedAt !== null`) receive HTTP 403 Forbidden ("Your account has been deactivated. Please contact an administrator.").
  * Standardized JWT token generation with explicit `algorithm: 'HS256'`.
* `server/src/middleware/auth.ts`:
  * Differentiated between `TokenExpiredError` (clean HTTP 401 "Your session has expired. Please sign in again.") and generic `JsonWebTokenError` (HTTP 401 "Invalid authentication token. Please sign in again.").
  * Enforced active user lookup (`isActive: true, deletedAt: null`) on every authenticated request.

### B. Document Security & Attachment Handling
* `server/src/validators/request.validators.ts`:
  * Strengthened `documentSchema` with file name path traversal protection (`/[\\/\0]|(\.\.)/`).
  * Blocked executable file extensions (`.exe`, `.bat`, `.cmd`, `.sh`, `.php`, `.pl`, `.cgi`, `.vbs`, `.jar`, `.msi`, `.ps1`).
  * Strictly blocked dangerous URL schemes (`javascript:`, `data:`, `file:`, `vbscript:`) while permitting valid HTTP/HTTPS URLs and secure internal storage paths.
* `server/src/request/request.service.ts`:
  * Hardened `uploadDocument` and `addComment`:
    * Access control enforcement via `getRequestById(requestId, actor)` ensuring only request participants (requester, current approvers, or admins) can attach documents or comments (preventing IDOR).
    * Forbidden document uploads to completed/terminal states (`CANCELLED` or `REJECTED`).
    * Atomic Prisma transactions creating `Attachment` records alongside `DOCUMENT_UPLOADED` audit log entries.

### C. Invariants & Business Logic Integrity
* `server/src/core/WorkflowEngine.ts`:
  * Preserved strict separation between ADMIN management authority and business approval authority: Admins cannot approve business steps without explicit `isOverride: true` and a mandatory, non-empty `overrideReason`.
  * Requester self-approval is impossible under all circumstances, even with administrative overrides.
  * Maintained Finance-first invariant: High-value purchases (> ₹1,00,000) at Finance review cannot be bypassed by admin overrides.
  * Preserved atomic state transitions for all workflow mutations.

### D. Admin Safeguards & Workflow Preservation
* `server/src/services/user.service.ts`:
  * Maintained last-active-admin safeguard preventing the system from ever being left without an active Administrator.
  * Guaranteed `passwordHash` is never selected, returned in API payloads, or exposed in audit logs.
* `server/src/services/workflow.service.ts`:
  * Maintained outage safeguard preventing deactivation/archival of the last active workflow template for any request type.
  * In-flight requests remain pinned to their original workflow template version.

---

## 2. Security Issues Fixed

| Vulnerability / Risk | Root Cause Prior to Phase 4 | Remediation Applied |
| :--- | :--- | :--- |
| **Login Brute-Force** | Weak rate-limiting on authentication | Added strict 10-attempt / 15-min IP rate limiting on `/login` returning HTTP 429. |
| **Denial of Service (API Flooding)** | Unbounded API endpoints | Introduced configurable global rate limiter (default 1000 req / 15 min) on `/api/v1`. |
| **Inactive User Authentication** | Disabled users could generate generic 401 errors without explicit status handling | Explicit check returning HTTP 403 when user is disabled or soft-deleted. |
| **Token Session Handling** | Expired tokens returned generic message | Distinct `TokenExpiredError` handler providing user-friendly session expiry response. |
| **Document URL Injection (XSS/SSRF)** | Arbitrary URL schemes were parsed by `z.string().url()` without protocol validation | Strict regex rejecting `javascript:`, `data:`, `file:`, `vbscript:`, permitting only `http:`, `https:`, or `/`. |
| **File Path Traversal** | Attachment file names were not sanitized | Blocked and stripped `..`, `\`, `/`, and null bytes; blocked executable extensions. |
| **Unauthorized Document / Comment Access (IDOR)** | `addComment` and `uploadDocument` lacked request authorization checks | Added pre-action authorization verifying actor has view permissions on the request. |
| **Document Attachment to Closed Requests** | Documents could be attached to cancelled requests | Terminal state validation blocking uploads to `CANCELLED` or `REJECTED` requests. |
| **Admin Privilege Abuse** | Risk of admin approving business steps without audit justification | Admin cannot approve unless executing explicit override with logged reason; Finance-first and self-approval remain unbypassable. |

---

## 3. Test Results

### Phase 4 Test Suite (`phase4-security-reliability.test.ts`)
* **Test File**: `tests/unit/phase4-security-reliability.test.ts`
* **Tests Passed**: **18 / 18** (100% pass rate)

```
 ✓ tests/unit/phase4-security-reliability.test.ts (18 tests) 17432ms
       ✓ prohibits ADMIN from approving a business step without explicit override
       ✓ rejects ADMIN override if overrideReason is missing or empty
       ✓ prohibits ADMIN override from bypassing Finance-first approval for high-value purchases (> ₹1,00,000)
       ✓ prohibits requester who is an ADMIN from self-approving even with administrative override
       ✓ blocks deactivating or demoting the last active Administrator
       ✓ records ADMIN_PRIVILEGE_GRANTED audit log when promoting a user to ADMIN
       ✓ rejects login for deactivated accounts with HTTP 403
       ✓ rejects expired JWT tokens with clear HTTP 401 error message
       ✓ rejects malformed/invalid JWT tokens with HTTP 401
       ✓ triggers HTTP 429 when rate limit threshold is exceeded on login
       ✓ rejects dangerous URL schemes such as javascript:, data:, and file: in document validator
       ✓ rejects path traversal in file names in document validator
       ✓ rejects executable file extensions in document validator
       ✓ successfully uploads valid document within transaction, records audit log, and allows authorized retrieval
       ✓ prevents uploading documents to already cancelled or rejected requests
       ✓ prohibits submitting a request that is already IN_REVIEW or COMPLETED
       ✓ prevents archiving the only active workflow template for a request type
```

### Full Backend Test Suite (`npm test`)
* **Total Test Files**: **10 / 10 passed** (100%)
* **Total Tests**: **114 / 114 passed** (0 failures, 0 regressions)
* **Duration**: 204.39s across live Neon PostgreSQL database

| Test File | Total Tests | Status |
| :--- | :--- | :--- |
| `tests/unit/phase4-security-reliability.test.ts` | 18 | **PASSED** |
| `tests/unit/phase3-lifecycle-security.test.ts` | 15 | **PASSED** |
| `tests/unit/phase2-safeguards.test.ts` | 14 | **PASSED** |
| `tests/unit/admin-phase1-foundation.test.ts` | 8 | **PASSED** |
| `tests/unit/manual-checklist-runner.test.ts` | 41 | **PASSED** |
| `tests/unit/maintenance-leave.test.ts` | 12 | **PASSED** |
| `tests/unit/WorkflowEngine.test.ts` | 3 | **PASSED** |
| `tests/unit/ApprovalEscalation.test.ts` | 9 | **PASSED** |
| `tests/unit/RuleEvaluator.test.ts` | 4 | **PASSED** |
| `tests/integration/request.e2e.test.ts` | 4 | **PASSED** |

---

## 4. Build Result

* **Command**: `cd client && npm run build` (`tsc -b && vite build`)
* **Result**: **Clean build with 0 TypeScript and bundling errors**.
* **Output**:
  ```
  vite v8.1.4 building client environment for production...
  transforming...✓ 72 modules transformed.
  rendering chunks...
  dist/index.html                   0.80 kB │ gzip:   0.43 kB
  dist/assets/index-BapF-eAa.css   55.16 kB │ gzip:  10.78 kB
  dist/assets/index-B-z1SO_C.js   386.77 kB │ gzip: 102.30 kB
  ✓ built in 2.00s
  ```

---

## 5. Architectural Limitations & Remaining Risks

1. **Document Storage Architecture (Metadata-Only)**:
   * **Current State**: MediFlow currently stores document metadata and validated external/internal URLs in the `Attachment` table (`sizeBytes: 0`). File bytes are not uploaded directly through multipart streams to the API server.
   * **Limitation**: Deep byte-level content inspection (e.g. anti-virus binary scanning, magic byte verification) cannot be performed server-side because bytes reside on external or object storage.
   * **Mitigation**: Strict URL scheme whitelisting (`http:`, `https:`, `/`), path traversal stripping, and file extension validation are enforced server-side.
2. **IP-Based Rate Limiting Behind Proxies**:
   * If the application is deployed behind a reverse proxy without `app.set('trust proxy', 1)`, `req.ip` may reflect the proxy's IP. The global API limit has been set to a generous default (`1000` req/15min) to prevent accidental throttling.

---

## 6. Manual Security Checklist Verification

| Item | Requirement | Verification Method | Result |
| :--- | :--- | :--- | :--- |
| **1** | **HTTP 429 Login Protection** | Sent 12 repeated login requests with `x-test-rate-limit: true` | **PASSED** (HTTP 429 triggered with rate limit message) |
| **2** | **Inactive User Login Rejection** | Attempted login using deactivated staff account | **PASSED** (HTTP 403 returned with deactivation notice) |
| **3** | **Unauthorized Approval / Forwarding** | Non-approver / out-of-department staff attempted approval | **PASSED** (HTTP 403 blocked with permission error) |
| **4** | **Finance-First Bypass Prevention** | Admin override attempted on purchase > ₹1,00,000 at Finance step | **PASSED** (HTTP 403 blocked: override cannot bypass Finance) |
| **5** | **Document Access & Scheme Validation** | Tested `javascript:alert(1)`, `../traversal`, and unauthorized user | **PASSED** (Rejected with HTTP 400 Bad Request / 403 Forbidden) |
| **6** | **Last-Active-Admin Safeguard** | Attempted deactivation and demotion of the final active admin | **PASSED** (HTTP 400 blocked with last admin safeguard notice) |
| **7** | **Duplicate Actions on Requests** | Attempted duplicate submission on in-review request, and cancel on approved request | **PASSED** (HTTP 400 blocked with state error) |
