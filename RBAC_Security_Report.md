# RBAC Implementation Final Report

## A. Security Architecture
The system uses a token-based authentication flow. When a user logs in, the server generates a cryptographically secure, random 64-character session token and stores it in the `sessions` collection with an expiration time. The client stores this token in `localStorage` and includes it in the payload of every protected API request. 

Every protected backend API call passes through `requireSession_`, which acts as a strict gateway:
1. It verifies the session token exists and is valid.
2. It verifies the session has not been revoked (signed out) or expired.
3. It resolves the associated user from the `users` collection.
4. It verifies the user's account is still active (`active !== false` and status is not Disabled/Locked).
5. It fails closed (throws an error) if any check fails, preventing unauthorized execution.

## B. RBAC Architecture
Roles and permissions are defined in an Administrator-editable `permissionMatrix` (stored server-side). A module-action permission check (`can()`) verifies whether a user's role allows a specific action (e.g., `create` in `testRecords`).
- **Server-Side Enforcement**: The backend resolves the matrix and enforces CRUD operations inside the generic CRUD endpoints (`save`, `remove`, `bulkSet`, etc.). It strictly rejects operations for which the user's role lacks permission.
- **UI Enforcement**: The frontend also loads the `permissionMatrix` and hides/disables buttons and routes that the user is not permitted to access, providing a clean user experience. However, the UI is never trusted; a manipulated UI cannot bypass the backend checks.

## C. API Protection
The generic Google Apps Script `doPost` handler acts as the router. Protected resources include:
- `save`, `remove`, `bulkSet`, `bulkUpsert`, `bulkRemove` (Generic CRUD endpoints)
- `assignSamples`, `returnToAnalyst`, `holdTest`, `resumeTest` (Action-level workflow endpoints)
- `submitApprovalDecision`, `releaseResult` (Action-level finalization endpoints)
- `bulkAppendAudit`, `appendAudit` (Audit logging endpoints)
- `restoreRecord`, `setUserPassword`

All these endpoints require a valid session. Custom operations enforce specific business rules beyond standard CRUD checks.

## D. Sensitive Collections
- `users`: Protected by `ADMIN_ONLY_COLLECTIONS_`. Only the Administrator can modify users via generic CRUD operations. `sanitizeUserWrite_` ensures password hashes and salts are never leaked or overwritten by basic edits.
- `permissionMatrix`: Protected by `ADMIN_ONLY_COLLECTIONS_`. Only the Administrator can edit role definitions.
- `sessions`: Placed in `SESSION_ONLY_COLLECTION_`. The generic API completely blocks any direct read/write access to this collection. Sessions can only be manipulated via dedicated login/logout paths.
- `auditLog`: Placed in `APPEND_ONLY_COLLECTIONS_`. Users can only append to it via `appendAudit` or `bulkAppendAudit`. Direct writes or deletes are blocked. Read access is restricted to roles with explicitly granted view permissions.

## E. Authentication Changes
Authentication has moved from a vulnerable client-side password check to a secure server-side implementation. Passwords are now hashed using PBKDF2 (SHA-256) with a unique, randomly generated salt per user. Passwords are no longer transmitted in plain text during reads or standard edits. Active sessions can be individually revoked by logging out.

## F. Authorization Changes
Authorization is no longer solely dependent on the client claiming a role or approval state.
- **Workflow State Validation**: Action-level APIs (`submitApprovalDecision`, `releaseResult`) verify that the resource is in a valid state (e.g., "results_entered" for an approval).
- **Mass-Assignment Protection**: Generic CRUD endpoints are heavily monitored. Specifically, the `samples` collection uses `enforceSamplesWritePolicy_` to reject any generic update that attempts to modify `requestedTests[].status` to `approved` or `released`, or attempts to append to the `approvals` array. These state changes must pass through the dedicated, permission-checked endpoints.

## G. Laboratory Segregation of Duties
- **Analyst (Sample Analyzer)**: Can enter test results and submit them, but is blocked from approving them. The system prevents self-approval.
- **Reviewer / Approver**: Can approve results via the dedicated endpoint. Attempting to approve a test they performed themselves triggers a server-side error.
- **Releaser**: Only authorized users can execute `releaseResult`. The system checks that every requested parameter is formally approved before allowing a release.
- **Administrator**: Has a distinct administrative override (`Step 13: Admin override`) that allows bypassing standard workflow blocks for emergency corrections, but all such actions are explicitly logged.

## H. Security Tests
| Test Case | Result |
| :--- | :--- |
| **Authentication** | |
| Valid login | PASS |
| Invalid password | PASS |
| Unknown user | PASS |
| Disabled user | PASS |
| Expired / Revoked session | PASS |
| **Authorization** | |
| Technician -> approve result | PASS (Blocked) |
| Technician -> release report | PASS (Blocked) |
| Reviewer -> change user role | PASS (Blocked via ADMIN_ONLY) |
| Normal user -> modify audit log | PASS (Blocked via APPEND_ONLY) |
| **Tampering** | |
| Client changes role | PASS (Ignored/Blocked) |
| Client changes permission | PASS (Blocked) |
| Client changes approval state | PASS (Blocked by `enforceSampleApprovalIntegrity_` and status check) |
| Client changes release state | PASS (Blocked by `PROTECTED_STATUSES_` check) |
| Client self-approval | PASS (Blocked by Segregation of Duties check) |

## I. Known Limitations
Because Google Apps Script uses Google Sheets as a database, the system lacks traditional row-level locking, which can sometimes lead to OCC (Optimistic Concurrency Control) conflicts on highly concurrent edits (handled gracefully by the client, but still a limitation of the platform). 
Additionally, cross-sheet transactions are not purely atomic. We handle this by ordering updates carefully (e.g., writing the audit log last) and using bulk operations wherever possible. 
Finally, IDOR (Insecure Direct Object Reference) is inherently challenging in a flat file-based LIMS where most laboratory data is intentionally transparent to all active lab staff. Granular record-level ownership (where Analyst A cannot read Analyst B's assigned samples) is not implemented, as it runs counter to the lab's operational transparency requirements, though action-level execution is fully secured.
