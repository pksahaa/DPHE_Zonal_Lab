# DPHE Zonal Lab LIMS V22 — Phase 2 Security & RBAC Upgrade

## Objective

Implement a production-oriented security layer for the existing DPHE Zonal Lab LIMS V22.

This phase is **exclusively** for:
- Authentication
- Server-side sessions
- Server-side RBAC
- API authorization
- Permission enforcement
- User/session security
- Sensitive collection protection
- Security audit logging
- Security testing

Preserve the Phase 1 workflow/data-integrity changes already implemented.

## IMPORTANT SCOPE RULE

Do not unnecessarily rewrite the application.

Do not redesign the laboratory workflow, UI, reporting, or data model except where security enforcement requires it.

---

# 1. SERVER-SIDE AUTHENTICATION

The browser must NOT download the `users` collection and verify passwords locally.

Use:

```text
Browser
  ↓
username + password
  ↓
Server
  ↓
Find user
  ↓
Verify password server-side
  ↓
Create authenticated session
  ↓
Return safe user/session information
```

Never return password hashes to the browser.

The client should receive only necessary information such as:

```text
userId
name
username
role
sessionToken
expiresAt
```

---

# 2. PASSWORD SECURITY

Review the current password hashing implementation.

Requirements:

- Never store plaintext passwords.
- Verify passwords only on the server.
- Use salted password hashes.
- If the current hashing method is weak, improve it where the current backend supports it.
- Preserve existing users through a safe migration strategy.
- Do not silently invalidate all existing users without documenting the migration.

---

# 3. REMOVE TRUST FROM FRONTEND API TOKEN

Treat the current frontend-visible shared API token as compromised.

Do not use a browser-visible token as the primary user authorization mechanism.

The security model must become:

```text
Authenticated Session
        ↓
Server validates session
        ↓
Server resolves user
        ↓
Server resolves role
        ↓
Server checks permission
        ↓
Server performs action
```

If an application token remains necessary, it must not be treated as user authorization and must not contain a sensitive server secret exposed unnecessarily in frontend code.

---

# 4. SERVER-SIDE SESSION MANAGEMENT

Implement real server-side sessions.

A session should contain:

```text
sessionId
userId
createdAt
expiresAt
lastActivityAt
status
```

The backend must validate the session for every protected request.

Validation:

```text
Request
 ↓
Session token
 ↓
Session exists?
 ↓
Session active?
 ↓
Session expired?
 ↓
User exists?
 ↓
User active?
 ↓
Continue
```

Expired/revoked sessions must be rejected.

---

# 5. SESSION EXPIRATION AND REVOCATION

Implement:

- absolute expiration
- inactivity timeout where appropriate
- logout/revocation
- user disable → invalidate active sessions
- session status
- server-side expiry enforcement

Do not rely only on frontend timers.

---

# 6. SESSION TOKEN SECURITY

Session IDs/tokens must be unpredictable.

Do not derive tokens from:

- username
- user ID
- timestamp alone
- role

Never store passwords inside sessions.

Prefer secure cookie-based sessions if supported by the deployment architecture.

If a token must be returned to JavaScript, make it:

- random
- short-lived
- revocable
- server validated

---

# 7. SERVER-SIDE RBAC

The existing frontend permission matrix can remain for UI behavior, but it must no longer be the security boundary.

Implement backend authorization:

```text
User
 ↓
Role
 ↓
Permission
 ↓
Resource
 ↓
Action
```

Preserve the existing role names where possible, for example:

```text
Administrator
Technician
Reviewer
QA Manager
Guest
```

Do not invent a completely different permission vocabulary unless necessary.

---

# 8. ACTION-LEVEL AUTHORIZATION

Protect individual actions, not just pages/modules.

Examples:

```text
samples.view
samples.create
samples.edit
samples.assign

tests.view
tests.create
tests.start
tests.return
tests.void
tests.retest

results.enter
results.edit
results.review
results.approve
results.release

reports.generate
reports.release
reports.revise

equipment.view
equipment.create
equipment.edit
equipment.delete

audit.view
```

Use the application's existing terminology where possible.

---

# 9. NEVER TRUST CLIENT-SUPPLIED ROLE

Never authorize based on:

```text
localStorage.role
React state
client session object
hidden form fields
URL parameters
```

Never trust a request such as:

```json
{"role":"Administrator"}
```

The server must resolve the authoritative role from the authenticated session/user record.

---

# 10. LABORATORY SEGREGATION OF DUTIES

Security must protect the laboratory workflow.

Implement server-side restrictions such as:

- Analyst cannot approve their own result.
- Analyst cannot review their own result where independent review is required.
- Reviewer cannot approve their own review where policy requires separation.
- Unauthorized users cannot directly release results.
- Approved results cannot be modified outside the authorized correction workflow.

Do not rely on hidden/disabled buttons.

---

# 11. APPROVAL AUTHORIZATION

Before approving a result, the backend must verify:

```text
valid session
+
approve permission
+
result exists
+
correct current state
+
user eligibility
+
segregation-of-duties rules
```

Reject arbitrary status manipulation such as:

```text
Pending → Approved
In Progress → Approved
```

unless explicitly allowed by the business rules.

---

# 12. RELEASE AUTHORIZATION

Before releasing a result/report, verify server-side:

- user permission
- current result state
- approval state
- required parameters
- report rules
- user eligibility

A direct API request must not be able to release an unapproved result.

---

# 13. PROTECT SENSITIVE COLLECTIONS

Do not allow arbitrary:

```text
?collection=<anything>
```

Create an explicit resource/collection allowlist.

Sensitive collections such as:

```text
users
sessions
permissionMatrix
auditLog
systemConfiguration
```

must have explicit backend authorization.

Do not expose them through generic CRUD.

---

# 14. USERS COLLECTION

Normal users must never receive the complete users collection.

Never expose:

- password hashes
- password-reset information
- session tokens
- security fields

Use safe user projections such as:

```text
id
name
username
role
status
```

Only authorized administrators may perform user-management operations.

---

# 15. SESSIONS COLLECTION

Do not expose session records/tokens through generic CRUD.

Normal users must not be able to:

```text
list sessions
edit sessions
delete arbitrary sessions
bulk replace sessions
```

Use dedicated server-side session operations.

---

# 16. AUDIT LOG PROTECTION

Audit logs must be append-only through normal application operations.

Reject:

```text
auditLog.update
auditLog.remove
auditLog.bulkSet
```

Record security events such as:

```text
LOGIN_SUCCESS
LOGIN_FAILED
LOGOUT
SESSION_EXPIRED
SESSION_REVOKED
PASSWORD_CHANGED
USER_CREATED
USER_DISABLED
USER_ENABLED
ROLE_CHANGED
PERMISSION_CHANGED
UNAUTHORIZED_ACCESS_ATTEMPT
APPROVAL_ATTEMPT
RELEASE_ATTEMPT
```

Where appropriate include:

```text
userId
username
timestamp
action
resource
resourceId
result
reason
```

---

# 17. FAILED LOGIN PROTECTION

Implement reasonable protection against repeated failed logins using capabilities available in the current environment.

Possible mechanisms:

- rate limiting
- temporary lockout
- progressive delay
- failed-attempt counter

Avoid permanent lockouts without a recovery mechanism.

Document the selected approach.

---

# 18. FIRST ADMIN INITIALIZATION

First-admin creation must be server-controlled.

Do not rely only on frontend logic such as:

```text
users.length === 0
```

The backend must atomically verify that initialization has not already happened.

Prevent two simultaneous requests from creating competing first administrators.

After initialization, first-admin setup must be disabled unless an explicit secure recovery mechanism exists.

---

# 19. USER STATUS

Support server-side states where appropriate:

```text
Active
Disabled
Locked
Pending
```

Disabled/locked users must not be able to continue using existing sessions.

---

# 20. USER MANAGEMENT

Protect server-side:

```text
Create user
Disable user
Enable user
Reset password
Change role
Change permissions
Deactivate user
```

Prefer disabling/deactivating rather than deleting users whose identity is required by audit history.

---

# 21. PERMISSION OVERRIDE PROTECTION

If user-specific permission overrides exist:

- Users cannot modify their own privileges.
- Normal users cannot modify another user's privileges.
- Only authorized administrative actions can change permissions.
- The backend must ignore unauthorized client-supplied permission fields.

Never accept:

```json
{
  "role": "Administrator",
  "permissions": {"all": true}
}
```

from an unauthorized client.

---

# 22. API ACTION VALIDATION

Every protected API request must validate:

### Authentication
Is the session valid?

### Authorization
Does the user have the required permission?

### Resource
Does the resource exist?

### State
Is the resource currently in a valid state for this action?

### Input
Is the request valid?

### Scope
Is this user allowed to act on this specific resource?

---

# 23. IDOR PROTECTION

Test direct object reference attacks.

Knowing:

```text
sampleId = S001
```

must not automatically authorize access to:

```text
sampleId = S002
```

The backend must check authorization for the actual resource being accessed.

---

# 24. MASS-ASSIGNMENT PROTECTION

Do not blindly save entire client objects for sensitive operations.

Avoid accepting arbitrary fields such as:

```text
role
permissions
approved
released
status
```

through generic save operations.

Prefer explicit server-side operations such as:

```text
updateSample()
updateTestResult()
approveResult()
releaseResult()
changeUserRole()
```

Each operation should accept only fields appropriate to that operation.

---

# 25. WORKFLOW + AUTHORIZATION

Permission alone is not enough.

For example:

```text
User has results.approve
```

does not mean the user can approve any result at any time.

The backend must also verify:

```text
Current status = Under Review
```

and reject invalid transitions.

Security authorization and Phase 1 workflow validation must work together.

---

# 26. CSRF / REQUEST PROTECTION

Evaluate the actual deployment architecture.

If cookie-based authentication is used:

- implement appropriate CSRF protection.

If token-based authentication is used:

- protect the token appropriately
- validate requests correctly
- minimize token exposure

Document the selected approach.

---

# 27. SERVER-SIDE INPUT VALIDATION

Validate important fields server-side:

- IDs
- usernames
- roles
- statuses
- dates
- numeric results
- parameter IDs
- test IDs
- report IDs
- collection names
- action names

Do not rely only on frontend validation.

Reject unknown/sensitive fields where practical.

---

# 28. SAFE ERROR HANDLING

Do not expose:

- stack traces
- internal sheet names
- API secrets
- password hashes
- session tokens
- internal implementation details

Use safe errors such as:

```text
Unauthorized
Forbidden
Invalid session
Invalid request
Resource not found
Invalid state transition
```

Detailed technical information may be logged server-side where appropriate.

---

# 29. SECURITY TEST MATRIX

Actually test direct backend/API calls, not only UI buttons.

## Authentication

```text
Valid login → PASS
Invalid password → FAIL
Unknown user → FAIL
Disabled user → FAIL
Expired session → FAIL
Revoked session → FAIL
```

## Authorization

```text
Technician → approve result → FAIL
Technician → release report → FAIL
Reviewer → change user role → FAIL
Normal user → read users collection → FAIL
Normal user → read sessions → FAIL
Normal user → modify audit log → FAIL
```

## Tampering

```text
Client changes role → FAIL
Client changes permission → FAIL
Client changes approval state → FAIL
Client changes release state → FAIL
Client changes another user's ID → FAIL
```

For every test, report:

```text
PASS
FAIL
NOT TESTED
```

Never claim PASS without actually testing it.

---

# 30. SECURITY REGRESSION

After security changes, verify the authorized workflow still works:

```text
Login
 ↓
Sample Registration
 ↓
Assignment
 ↓
Batch Creation
 ↓
Testing
 ↓
Result Entry
 ↓
Review
 ↓
Approval
 ↓
Release
 ↓
Report
```

Each step must work for the appropriate authorized user.

---

# 31. PRESERVE PHASE 1

Do not break these existing Phase 1 features:

- Parameter-level status
- Sample custody status
- Return to Analyst
- Void/Invalidate
- Retest/Attempt history
- Approval snapshot
- Audit events
- Version/concurrency handling
- Partial/Final report logic
- Report revision
- Sample/Parameter hold distinction
- Targeted updates instead of unsafe routine bulk replacement

Security should enforce these workflows, not replace them.

---

# 32. CODEBASE SECURITY AUDIT BEFORE FINALIZING

Search the entire codebase for:

- every API endpoint
- every generic CRUD path
- every frontend permission check
- every direct collection access
- every place role is read from localStorage/session state
- every `bulkSet`
- every approval operation
- every release operation
- every users collection access
- every sessions collection access
- every password/hash reference
- every hardcoded token/secret

Do not assume that fixing one endpoint fixes the whole system.

---

# 33. TARGET ARCHITECTURE

The final security architecture should conceptually be:

```text
Browser
   │
   ▼
Login Request
   │
   ▼
Server Authentication
   │
   ▼
Server Session
   │
   ▼
Authenticated API Request
   │
   ▼
Session Validation
   │
   ▼
User Resolution
   │
   ▼
Role / Permission Check
   │
   ▼
Resource / State Validation
   │
   ▼
Business Action
   │
   ▼
Security / Audit Event
   │
   ▼
Response
```

Never rely on:

```text
Browser
 ↓
Client role
 ↓
Shared API token
 ↓
Generic CRUD
```

as the security model.

---

# 34. REQUIRED FINAL REPORT

After implementation, provide:

## A. Security Architecture
Explain the authentication and session flow.

## B. RBAC Architecture
Explain roles, permissions, server-side enforcement, and UI enforcement.

## C. API Protection
List protected resources/endpoints.

## D. Sensitive Collections
Explain protection of:

```text
users
sessions
permissionMatrix
auditLog
system configuration
```

## E. Authentication Changes
Explain password/session changes.

## F. Authorization Changes
Explain action-level authorization.

## G. Laboratory Segregation of Duties
Explain protections for:

```text
Analyst
Reviewer
Approver
Releaser
Administrator
```

## H. Security Tests
Report actual results using:

```text
PASS
FAIL
NOT TESTED
```

## I. Known Limitations
Clearly identify anything that could not be fully secured because of the existing deployment architecture.

---

# FINAL REQUIREMENT

Do not merely describe what should be changed.

**Actually implement the security and RBAC changes in the provided V22 codebase.**

Do not rewrite the application unnecessarily.

Preserve existing functionality.

Most importantly:

> A user must never be able to gain access to a protected laboratory operation merely by modifying frontend JavaScript, localStorage, React state, URL parameters, or direct API requests.

The backend must always make the final security decision.
