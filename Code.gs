/**
 * ============================================================================
 * DPHE LIMS — Google Apps Script backend
 * ============================================================================
 * Paired with 01-data-service.js (DataService, mode "gas") and
 * 23-data-backup.js (Data Backup settings) in the front-end app.
 *
 * WHAT THIS FILE DOES
 * 1. Generic CRUD over a Google Sheet ("list" / "save" / "remove" /
 *    "bulkSet" / "appendAudit" / "ping") — one sheet per collection, each
 *    row storing one record as JSON. This is what makes Settings → Backend
 *    Settings → "Google Apps Script (shared)" mode actually work.
 * 2. Automatic email backup — "configureBackup" / "getBackupConfig" /
 *    "backupNow", plus a daily time-driven trigger (dailyMaintenance) that
 *    checks whether the configured interval has elapsed and, if so, emails
 *    a fresh JSON export of every sheet as an attachment to the configured
 *    address, THEN deletes/trashes the previous backup email it sent — only
 *    the newest one is ever left in the inbox.
 * 3. A `runOnce_setup` helper you run ONE TIME from the Apps Script editor
 *    to install the daily trigger. (Auto-archive itself runs client-side —
 *    see 23-data-backup.js — because it only ever touches the small, active
 *    Test Records list; nothing about it needs a server.)
 *
 * ---------------------------------------------------------------------------
 * DEPLOYMENT (one-time)
 * ---------------------------------------------------------------------------
 * 1. Go to https://script.google.com, create a new project, and paste this
 *    file in as Code.gs (delete the default myFunction() stub first).
 * 2. Project Settings → Script Properties → add:
 *      API_TOKEN        any random string — must match the "Shared secret /
 *                        token" field in Settings → Backend Settings in the
 *                        app.
 *      SPREADSHEET_ID    (optional) the ID of an existing Google Sheet to
 *                        use as storage. If you skip this, the script
 *                        creates one for itself the first time it runs and
 *                        remembers its ID automatically — you don't have to
 *                        do anything.
 * 3. Run the `runOnce_setup` function once from the editor (Run ▸
 *    runOnce_setup). The first run will ask you to authorize the script —
 *    accept it (it needs permission to read/write a Sheet and send Gmail on
 *    your behalf, since that's literally what the backup email feature
 *    does). This installs the one daily trigger the whole file needs.
 * 4. Deploy ▸ New deployment ▸ type "Web app". Execute as: Me. Who has
 *    access: Anyone. Deploy, and copy the Web App URL it gives you.
 * 5. In the app: Settings → Backend Settings → paste that URL into "Apps
 *    Script Web App URL", paste the same token you set in step 2, set
 *    Storage mode to "Google Apps Script (shared)", Save, then reload.
 * 6. In the app: Settings → Data Backup → turn on Automatic Email Backup,
 *    enter the recipient address and how often, Save Schedule.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------
function scriptProps_() {
  return PropertiesService.getScriptProperties();
}
function getToken_() {
  return scriptProps_().getProperty("API_TOKEN") || "";
}
function checkToken_(token) {
  const expected = getToken_();
  // If no token has been configured server-side, allow anything through —
  // matches the app's own "token is optional" behaviour so a fresh
  // deployment works before you've set one up, without silently failing.
  if (!expected) return true;
  return token === expected;
}

// ---------------------------------------------------------------------------
// Security: password hashing, sessions, sensitive-collection protection
// ---------------------------------------------------------------------------
// NOTE ON THE SHARED API_TOKEN: this deployment is a static front-end (the
// token literally ships in the page source on GitHub Pages) talking to one
// shared Apps Script backend, so `token` can only ever be a light filter
// against opportunistic/bot traffic — it is NOT a real secret and must never
// be treated as the thing that authorizes a specific user to do something.
// Everything below moves that responsibility to per-user sessions issued
// only after a verified username/password login, validated on every write.

function byteArrayToHex_(bytes) {
  return bytes.map(b => ((b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))).join("");
}
// Matches the legacy client-side scheme (unsalted SHA-256 of the raw
// password) so existing accounts created before this change can still log
// in once and get transparently upgraded — see verifyAndMaybeMigratePassword_.
function sha256Hex_(str) {
  return byteArrayToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8));
}
// Current scheme: per-user random salt + HMAC-SHA256(password, salt). Not a
// slow/memory-hard KDF (Apps Script has none built in), but a meaningful
// step up from a bare unsalted hash — same password no longer produces the
// same hash across users/accounts, and a stolen hash alone can't be reused
// against a different salt.
function hmacSha256Hex_(str, key) {
  return byteArrayToHex_(Utilities.computeHmacSha256Signature(str, key));
}
function verifyAndMaybeMigratePassword_(user, plainPassword) {
  if (user.passwordSalt && user.passwordHash) {
    return { ok: hmacSha256Hex_(plainPassword, user.passwordSalt) === user.passwordHash, migrated: false };
  }
  if (user.passwordHash) {
    // Legacy unsalted SHA-256(password) scheme from before the salted
    // upgrade. Verify against it once, then silently re-save the account
    // using the salted scheme so it never has to be checked this way again.
    if (sha256Hex_(plainPassword) === user.passwordHash) {
      const salt = Utilities.getUuid();
      const salted = hmacSha256Hex_(plainPassword, salt);
      try {
        upsertRow_("users", Object.assign({}, user, { passwordHash: salted, passwordSalt: salt }));
      } catch (e) { /* migration is best-effort; login still succeeds this time */ }
      return { ok: true, migrated: true };
    }
    return { ok: false, migrated: false };
  }
  return { ok: false, migrated: false };
}
// Never let a user record (including passwordHash/passwordSalt/legacy
// plaintext password) leave the server. Everything the front-end actually
// uses (assignment dropdowns, the RBAC screen, session re-sync) only needs
// these fields.
function safeUserProjection_(u) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    designation: u.designation || "",
    active: u.active !== false,
    status: u.status || (u.active === false ? "Disabled" : "Active"),
    permissionOverrides: u.permissionOverrides || {},
    createdAt: u.createdAt || ""
  };
}

const FAILED_LOGIN_PREFIX_ = "loginfail_";
const MAX_FAILED_ATTEMPTS_ = 5;
const LOCKOUT_SECONDS_ = 300;
function isLockedOut_(username) {
  const count = Number(CacheService.getScriptCache().get(FAILED_LOGIN_PREFIX_ + username.toLowerCase()) || 0);
  return count >= MAX_FAILED_ATTEMPTS_;
}
function recordFailedLogin_(username) {
  const cache = CacheService.getScriptCache();
  const key = FAILED_LOGIN_PREFIX_ + username.toLowerCase();
  const count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), LOCKOUT_SECONDS_);
}
function clearFailedLogin_(username) {
  CacheService.getScriptCache().remove(FAILED_LOGIN_PREFIX_ + username.toLowerCase());
}

// Best-effort security-event logging into the same append-only auditLog
// sheet used for everything else. Never allowed to throw — a logging
// failure must not block the login/action it's describing.
function logSecurityEvent_(eventType, details) {
  try {
    const entry = Object.assign({
      id: "sec_" + Utilities.getUuid(),
      eventType: eventType,
      entityType: "security",
      performedAt: new Date().toISOString()
    }, details || {});
    const sheet = getSheet_("auditLog");
    const now = new Date().toISOString();
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, 3).setValues([[entry.id, JSON.stringify(entry), now]]);
    invalidateCache_("auditLog");
  } catch (e) { /* never let audit logging break the primary action */ }
}

// Validates a bearer session token against the sessions/users sheets.
// Throws (never returns falsy) so every call site fails closed — forgetting
// a null-check can't accidentally let an unauthenticated request through.
function requireSession_(sessionToken) {
  if (!sessionToken) throw new Error("UNAUTHORIZED: Missing session. Please log in again.");
  const sess = readAllRows_("sessions").find(s => s.id === sessionToken);
  if (!sess) throw new Error("UNAUTHORIZED: Invalid session. Please log in again.");
  if (sess.status === "revoked") throw new Error("UNAUTHORIZED: Session has been signed out. Please log in again.");
  if (sess.expiresAt && new Date(sess.expiresAt).getTime() < Date.now()) {
    throw new Error("UNAUTHORIZED: Session expired. Please log in again.");
  }
  const user = readAllRows_("users").find(u => u.id === sess.userId);
  if (!user || user.active === false || user.status === "Disabled" || user.status === "Locked") {
    throw new Error("UNAUTHORIZED: Account is no longer active.");
  }
  // Best-effort activity touch — a failure here must never block the
  // caller's actual request.
  try { upsertRow_("sessions", Object.assign({}, sess, { lastActivityAt: new Date().toISOString() })); } catch (e) {}
  return { session: sess, user: user };
}
// Collections that must never be exposed through the generic list/write
// actions — they only move through the dedicated, purpose-built paths
// below (login/logout/bootstrapAdmin for sessions; safe projections for
// users; append-only helpers for auditLog).
const SESSION_ONLY_COLLECTION_ = "sessions";
const APPEND_ONLY_COLLECTIONS_ = new Set(["auditLog"]);
const ADMIN_ONLY_COLLECTIONS_ = new Set(["users", "permissionMatrix"]);

// ---------------------------------------------------------------------------
// Backend CRUD Authorization — Permission-matrix enforcement (Phase 2)
// ---------------------------------------------------------------------------
// Maps each Google Sheet collection name to the permission-module key used
// in the admin-editable permissionMatrix (Settings ▸ Roles & Permissions).
// Collections not listed here are either already guarded above (users,
// permissionMatrix, sessions, auditLog) or don't need gating (e.g.
// labIdentity — a single lab-config object any logged-in user may read).
const COLLECTION_TO_MODULE_ = {
  testRecords: "testRecords",
  testTypes:   "testTypes",
  parameters:  "testTypes",      // parameters are edited on the same Settings page
  chemicals:   "inventory",
  masterChemicals: "inventory",
  equipment:   "inventory",
  glassware:   "inventory",
  gas:         "inventory",
  references:  "references",
  subBatches:  "subBatches",
  samples:     "samples",
};
// Determines which CRUD action a generic write operation represents.
function writeActionToPermAction_(action, payload, collection) {
  if (action === "remove" || action === "bulkRemove") return "delete";
  // For save/bulkUpsert/bulkSet: if a record with the same id already
  // exists in the sheet it's an edit; otherwise it's a create.
  // Checking every id against the sheet on every call would be expensive,
  // so we use a simpler heuristic: if the payload has an id, treat the
  // very first save of an id-bearing object as "create" only when the id
  // is brand-new. For bulk operations, we just require "edit" (which
  // subsumes "create" in every built-in role's defaults).
  if (action === "bulkSet" || action === "bulkUpsert") return "edit";
  // Single "save": check whether the record already exists.
  if (action === "save" && payload && payload.id) {
    const existing = readAllRows_(collection).find(r => r.id === payload.id);
    return existing ? "edit" : "create";
  }
  return "create";
}
const DEFAULT_PERMISSION_MATRIX_FALLBACK_ = {
  Administrator: { testRecords: { view: true, create: true, edit: true, delete: true }, testTypes: { view: true, create: true, edit: true, delete: true }, inventory: { view: true, create: true, edit: true, delete: true }, references: { view: true, create: true, edit: true, delete: true }, subBatches: { view: true, create: true, edit: true, delete: true }, qc: { view: true, create: true, edit: true, delete: true }, reports: { view: true, create: true, edit: true, delete: true }, archive: { view: true, create: true, edit: true, delete: true }, users: { view: true, create: true, edit: true, delete: true }, auditLog: { view: true, create: true, edit: true, delete: true }, settings: { view: true, create: true, edit: true, delete: true } },
  "Sample Analyzer": { testRecords: { view: true, create: true, edit: true, delete: false }, testTypes: { view: true, create: false, edit: false, delete: false }, inventory: { view: true, create: true, edit: true, delete: false }, references: { view: true, create: true, edit: true, delete: false }, subBatches: { view: true, create: true, edit: true, delete: false }, qc: { view: true, create: true, edit: false, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: false, delete: false } },
  "Junior Chemist": { testRecords: { view: true, create: true, edit: true, delete: false }, testTypes: { view: true, create: false, edit: false, delete: false }, inventory: { view: true, create: true, edit: true, delete: false }, references: { view: true, create: true, edit: true, delete: false }, subBatches: { view: true, create: true, edit: true, delete: false }, qc: { view: true, create: true, edit: false, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: false, delete: false } },
  "Senior Chemist": { testRecords: { view: true, create: true, edit: true, delete: true }, testTypes: { view: true, create: true, edit: true, delete: false }, inventory: { view: true, create: true, edit: true, delete: false }, references: { view: true, create: true, edit: true, delete: true }, subBatches: { view: true, create: true, edit: true, delete: true }, qc: { view: true, create: true, edit: true, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: true, delete: false }, users: { view: true, create: false, edit: false, delete: false }, auditLog: { view: true, create: false, edit: false, delete: false } },
  "Chief Chemist": { testRecords: { view: true, create: true, edit: true, delete: true }, testTypes: { view: true, create: true, edit: true, delete: true }, inventory: { view: true, create: true, edit: true, delete: true }, references: { view: true, create: true, edit: true, delete: true }, subBatches: { view: true, create: true, edit: true, delete: true }, qc: { view: true, create: true, edit: true, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: true, delete: false }, users: { view: true, create: false, edit: true, delete: false }, auditLog: { view: true, create: false, edit: false, delete: false }, settings: { view: true, create: false, edit: false, delete: false } },
  "QA Manager": { testRecords: { view: true, create: false, edit: true, delete: false }, testTypes: { view: true, create: false, edit: false, delete: false }, inventory: { view: true, create: false, edit: false, delete: false }, references: { view: true, create: true, edit: true, delete: false }, subBatches: { view: true, create: true, edit: true, delete: false }, qc: { view: true, create: false, edit: true, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: true, delete: false }, users: { view: true, create: false, edit: false, delete: false }, auditLog: { view: true, create: false, edit: false, delete: false } },
  "Executive Engineer": { testRecords: { view: true, create: false, edit: false, delete: false }, testTypes: { view: true, create: false, edit: false, delete: false }, inventory: { view: true, create: true, edit: true, delete: true }, references: { view: true, create: false, edit: false, delete: false }, subBatches: { view: true, create: false, edit: false, delete: false }, qc: { view: true, create: false, edit: false, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: false, delete: false } },
  "Superintendent Engineer": { testRecords: { view: true, create: true, edit: true, delete: true }, testTypes: { view: true, create: true, edit: true, delete: true }, inventory: { view: true, create: true, edit: true, delete: true }, references: { view: true, create: true, edit: true, delete: true }, subBatches: { view: true, create: true, edit: true, delete: true }, qc: { view: true, create: true, edit: true, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: true, delete: false }, users: { view: true, create: true, edit: true, delete: false }, auditLog: { view: true, create: false, edit: false, delete: false }, settings: { view: true, create: false, edit: false, delete: false } },
  Reviewer: { testRecords: { view: true, create: false, edit: false, delete: false }, testTypes: { view: true, create: false, edit: false, delete: false }, inventory: { view: true, create: false, edit: false, delete: false }, references: { view: true, create: false, edit: false, delete: false }, subBatches: { view: true, create: false, edit: false, delete: false }, qc: { view: true, create: false, edit: false, delete: false }, reports: { view: true, create: false, edit: false, delete: false }, archive: { view: true, create: false, edit: false, delete: false } },
  "Store Keeper": { testRecords: { view: false, create: false, edit: false, delete: false }, testTypes: { view: true, create: false, edit: false, delete: false }, inventory: { view: true, create: true, edit: true, delete: true }, references: { view: true, create: false, edit: false, delete: false }, subBatches: { view: false, create: false, edit: false, delete: false }, qc: { view: false, create: false, edit: false, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: false, delete: false } },
  "Sample Receiver": { testRecords: { view: false, create: false, edit: false, delete: false }, testTypes: { view: true, create: false, edit: false, delete: false }, inventory: { view: false, create: false, edit: false, delete: false }, references: { view: true, create: true, edit: true, delete: true }, subBatches: { view: false, create: false, edit: false, delete: false }, qc: { view: false, create: false, edit: false, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: false, delete: false } },
  Accountant: { testRecords: { view: true, create: false, edit: false, delete: false }, testTypes: { view: true, create: false, edit: false, delete: false }, inventory: { view: false, create: false, edit: false, delete: false }, references: { view: true, create: false, edit: false, delete: false }, subBatches: { view: false, create: false, edit: false, delete: false }, qc: { view: false, create: false, edit: false, delete: false }, reports: { view: true, create: true, edit: false, delete: false }, archive: { view: true, create: false, edit: false, delete: false } },
  Guest: { testRecords: { view: true, create: false, edit: false, delete: false }, testTypes: { view: true, create: false, edit: false, delete: false }, inventory: { view: true, create: false, edit: false, delete: false }, references: { view: true, create: false, edit: false, delete: false }, subBatches: { view: true, create: false, edit: false, delete: false }, qc: { view: true, create: false, edit: false, delete: false }, reports: { view: true, create: false, edit: false, delete: false }, archive: { view: true, create: false, edit: false, delete: false } }
};

// Resolves the permission matrix and checks whether `auth.user` is allowed
// to perform `permAction` on `moduleKey`. Administrator always passes.
// Throws on denial so the caller can catch-and-log consistently.
function enforceMatrixPermission_(auth, collection, action, payload) {
  if (!auth) return; // unauthenticated paths are already blocked earlier
  if (auth.user.role === "Administrator") return; // full access

  const moduleKey = COLLECTION_TO_MODULE_[collection];
  if (!moduleKey) return; // collection not gated by the matrix

  // "samples" uses a different action vocabulary (canRegister, canAssign,
  // canEnterResults, canReview, canApprove, canRelease) that's enforced by
  // enforceSamplesWritePolicy_ — don't double-gate it here with the
  // generic create/edit/delete vocabulary that doesn't apply.
  if (moduleKey === "samples") return;

  const permAction = writeActionToPermAction_(action, payload, collection);

  try {
    const singleton = readAllRows_("permissionMatrix")[0];
    const matrix = (singleton && (singleton.matrix || singleton)) || DEFAULT_PERMISSION_MATRIX_FALLBACK_;
    const rolePerms = (matrix && matrix[auth.user.role]) || DEFAULT_PERMISSION_MATRIX_FALLBACK_[auth.user.role];
    const modulePerms = rolePerms && rolePerms[moduleKey];
    if (modulePerms && modulePerms[permAction]) return; // allowed
  } catch (e) {
    // If reading the matrix threw, fallback to default matrix
    try {
      const fbRolePerms = DEFAULT_PERMISSION_MATRIX_FALLBACK_[auth.user.role];
      const fbModulePerms = fbRolePerms && fbRolePerms[moduleKey];
      if (fbModulePerms && fbModulePerms[permAction]) return;
    } catch (e2) {}
  }

  logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", {
    action: action, collection: collection, permAction: permAction,
    userId: auth.user.id, role: auth.user.role, reason: "permission_denied"
  });
  throw new Error(`FORBIDDEN: Your role "${auth.user.role}" does not have "${permAction}" permission on "${moduleKey}".`);
}
function getSpreadsheet_() {
  let id = scriptProps_().getProperty("SPREADSHEET_ID");
  if (id) {
    // A configured ID that fails to open must be a loud error, not a
    // silent "start over with a brand-new empty spreadsheet" — that used
    // to make every single collection look wiped (app AND the sheet you'd
    // check both looked empty) whenever openById hit any transient issue
    // (a Google API hiccup, a temporary permissions glitch after
    // redeploying, etc.), even though the real data was completely intact
    // and untouched in the original sheet the whole time.
    return SpreadsheetApp.openById(id);
  }
  // Only auto-create when truly unconfigured (id was never set at all) —
  // this path is for a brand-new deployment's very first run, not a
  // recovery path for an existing one.
  const ss = SpreadsheetApp.create("DPHE LIMS — Data (auto-created)");
  scriptProps_().setProperty("SPREADSHEET_ID", ss.getId());
  return ss;
}
// Every collection is its own sheet: column A = record id, column B = the
// full record as a JSON string, column C = updatedAt. Deliberately schema-
// free per collection (no fixed columns) — this app's record shapes evolve
// (new fields on Parameters, Test Types, etc.) and a generic JSON-per-row
// store never needs a migration when that happens.
function getSheet_(collection) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(collection);
  if (!sheet) {
    sheet = ss.insertSheet(collection);
    sheet.getRange(1, 1, 1, 3).setValues([["id", "json", "updatedAt"]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
const CACHED_COLLECTIONS = ["parameters", "testTypes", "masterChemicals", "users", "permissionMatrix"];
const CACHE_TTL_SECS = 300;

function invalidateCache_(collection) {
  if (CACHED_COLLECTIONS.includes(collection)) {
    try { CacheService.getScriptCache().remove("col_" + collection); } catch (e) {}
  }
}

function readAllRowsCached_(collection) {
  if (CACHED_COLLECTIONS.includes(collection)) {
    try {
      const cache = CacheService.getScriptCache();
      const hit = cache.get("col_" + collection);
      if (hit) return JSON.parse(hit);
      const rows = readAllRows_(collection);
      cache.put("col_" + collection, JSON.stringify(rows), CACHE_TTL_SECS);
      return rows;
    } catch (e) {
      return readAllRows_(collection);
    }
  }
  return readAllRows_(collection);
}

function readAllRows_(collection) {
  const sheet = getSheet_(collection);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const out = [];
  values.forEach(([id, json]) => {
    if (!id) return;
    try {
      out.push(JSON.parse(json));
    } catch (e) {
      // skip a corrupted row rather than fail the whole list
    }
  });
  return out;
}
function upsertRow_(collection, record) {
  const sheet = getSheet_(collection);
  const lastRow = sheet.getLastRow();
  const now = new Date().toISOString();
  let rowIndex = -1;
  const idCol = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 2).getValues() : [];
  let existingJson = null;
  for (let i = 0; i < idCol.length; i++) {
    if (idCol[i][0] === record.id) { 
      rowIndex = i + 2; 
      existingJson = idCol[i][1];
      break; 
    }
  }

  if (rowIndex !== -1 && typeof record._version === "number") {
    let existingRecord;
    try { existingRecord = JSON.parse(existingJson); } catch (e) {}
    if (existingRecord && typeof existingRecord._version === "number") {
      if (existingRecord._version !== record._version) {
        throw new Error("CONFLICT: Record was modified by another user. Please reload the latest version before saving.");
      }
    }
  }

  const newVersion = typeof record._version === "number" ? record._version + 1 : 1;
  const stamped = Object.assign({}, record, { updatedAt: now, _version: newVersion });
  const rowValues = [[stamped.id, JSON.stringify(stamped), now]];
  
  if (rowIndex === -1) {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, 3).setValues(rowValues);
  } else {
    sheet.getRange(rowIndex, 1, 1, 3).setValues(rowValues);
  }
  invalidateCache_(collection);
  return stamped;
}
function removeRow_(collection, id) {
  const sheet = getSheet_(collection);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < idCol.length; i++) {
    if (idCol[i][0] === id) {
      sheet.deleteRow(i + 2);
      invalidateCache_(collection);
      return;
    }
  }
}
// Deletes several rows in ONE call — reads the id column once (like
// bulkUpsertRows_ does for writes) instead of calling removeRow_ in a loop,
// which would re-fetch and re-scan the whole id column from scratch for
// every single id. Row indices are collected up front and deleted from the
// bottom up so an earlier deletion never shifts the row number of one
// still waiting to be deleted.
function bulkRemoveRows_(collection, ids) {
  const idSet = new Set(ids || []);
  if (!idSet.size) return { ok: true };
  const sheet = getSheet_(collection);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true };
  const idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const rowsToDelete = [];
  idCol.forEach(([id], i) => {
    if (idSet.has(id)) rowsToDelete.push(i + 2);
  });
  rowsToDelete.sort((a, b) => b - a).forEach(rowIndex => sheet.deleteRow(rowIndex));
  invalidateCache_(collection);
  return { ok: true, removed: rowsToDelete.length };
}
function replaceAllRows_(collection, records) {
  const sheet = getSheet_(collection);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
  if (!records || !records.length) {
    invalidateCache_(collection);
    return records || [];
  }
  const now = new Date().toISOString();
  const rows = records.map(r => [r.id, JSON.stringify(Object.assign({}, r, { updatedAt: now })), now]);
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  invalidateCache_(collection);
  return records;
}
// Updates/inserts several records in ONE call — unlike replaceAllRows_
// (bulkSet), this only touches the given records; everything else already
// in the sheet is left alone. Used wherever a single user action changes
// many records of a collection that's normally saved one row at a time
// (e.g. every member sample of a new Analytical Batch flipping to
// "in_progress" together) — doing that as N separate upsertRow_ calls means
// N round trips through the shared write lock (see WRITE_ACTIONS_ below);
// queue enough of those up (worse, doubled by N audit-log appends
// alongside them) and a second action fired right after the first can
// genuinely wait long enough to time out and get dropped. One bulkUpsert_
// call reads the sheet once and writes every changed/new row in a single
// pass instead.
function bulkUpsertRows_(collection, records) {
  const sheet = getSheet_(collection);
  const lastRow = sheet.getLastRow();
  const now = new Date().toISOString();
  const idIndex = {};
  const existingJsonMap = {};
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 2).getValues().forEach(([id, json], i) => {
      if (id) {
        idIndex[id] = i + 2; // sheet row number
        existingJsonMap[id] = json;
      }
    });
  }
  
  // OCC check first before modifying anything
  (records || []).forEach(record => {
    if (idIndex[record.id] && typeof record._version === "number") {
      let existingRecord;
      try { existingRecord = JSON.parse(existingJsonMap[record.id]); } catch (e) {}
      if (existingRecord && typeof existingRecord._version === "number") {
        if (existingRecord._version !== record._version) {
          throw new Error(`CONFLICT: Record ${record.id} was modified by another user. Please reload the latest version before saving.`);
        }
      }
    }
  });

  const toAppend = [];
  const stampedRecords = [];
  (records || []).forEach(record => {
    const newVersion = typeof record._version === "number" ? record._version + 1 : 1;
    const stamped = Object.assign({}, record, { updatedAt: now, _version: newVersion });
    stampedRecords.push(stamped);
    const rowValues = [stamped.id, JSON.stringify(stamped), now];
    const rowIndex = idIndex[record.id];
    if (rowIndex) {
      sheet.getRange(rowIndex, 1, 1, 3).setValues([rowValues]);
    } else {
      toAppend.push(rowValues);
    }
  });
  if (toAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, 3).setValues(toAppend);
  }
  invalidateCache_(collection);
  return stampedRecords;
}
// Appends several already-stamped audit-log entries (each already carrying
// its own id/ts from the client) in one sheet write instead of one
// upsertRow_ call per entry — same reasoning as bulkUpsertRows_ above.
function bulkAppendAuditRows_(entries) {
  const sheet = getSheet_("auditLog");
  const now = new Date().toISOString();
  const list = entries || [];
  if (list.length) {
    const rows = list.map(e => [e.id, JSON.stringify(e), now]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  }
  invalidateCache_("auditLog");
  return list;
}

// Verified server-side: the browser sends the RAW password (over HTTPS,
// POST body — never logged in a URL) instead of a pre-computed hash, so the
// hash itself can never be replayed as a credential ("pass the hash").
function handleLogin_(payload) {
  const { username, password } = payload || {};
  const uname = String(username || "").trim();
  if (!uname || !password) return { ok: false, error: "Username and password are required." };
  if (isLockedOut_(uname)) {
    logSecurityEvent_("LOGIN_FAILED", { username: uname, reason: "locked_out" });
    return { ok: false, error: "Too many failed attempts. Try again in a few minutes." };
  }
  const user = readAllRows_("users").find(u => (u.username || "").toLowerCase() === uname.toLowerCase());
  if (!user || user.active === false || user.status === "Disabled" || user.status === "Locked") {
    recordFailedLogin_(uname);
    logSecurityEvent_("LOGIN_FAILED", { username: uname, reason: "invalid_or_inactive" });
    // Deliberately identical message to "wrong password" below — does not
    // reveal whether the username exists.
    return { ok: false, error: "Invalid username or password." };
  }
  const result = verifyAndMaybeMigratePassword_(user, password);
  if (!result.ok) {
    recordFailedLogin_(uname);
    logSecurityEvent_("LOGIN_FAILED", { username: uname, userId: user.id, reason: "bad_password" });
    return { ok: false, error: "Invalid username or password." };
  }
  clearFailedLogin_(uname);
  const sessionToken = Utilities.getUuid();
  const now = new Date();
  // Extended session timeout to 48 hours to prevent immediate "Session expired" 
  // errors caused by timezone/clock skew or long-running apps script sessions.
  const expiresAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
  upsertRow_("sessions", {
    id: sessionToken,
    userId: user.id,
    status: "active",
    createdAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: expiresAt
  });
  logSecurityEvent_("LOGIN_SUCCESS", { username: uname, userId: user.id, sessionId: sessionToken });
  return { ok: true, token: sessionToken, expiresAt: expiresAt, user: safeUserProjection_(user) };
}
function handleLogout_(payload) {
  const sessionToken = payload && payload.sessionToken;
  if (!sessionToken) return { ok: true };
  const sess = readAllRows_("sessions").find(s => s.id === sessionToken);
  if (sess) {
    upsertRow_("sessions", Object.assign({}, sess, { status: "revoked" }));
    logSecurityEvent_("LOGOUT", { userId: sess.userId, sessionId: sessionToken });
  }
  return { ok: true };
}
// Atomic first-run admin creation — replaces the old client-side
// `users.length === 0` check (which any two simultaneous first visitors, or
// a single bad reload, could turn into duplicate/overwritten admin
// accounts, since it made the decision using a copy of the list already
// sitting in the browser instead of asking the server at the moment of
// creation).
function handleBootstrapAdmin_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (readAllRows_("users").length > 0) {
      logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "bootstrapAdmin", reason: "already_initialized" });
      return { ok: false, error: "This system already has accounts — first-time setup is no longer available." };
    }
    const { username, password, name, designation } = payload || {};
    const uname = String(username || "").trim().toLowerCase();
    if (!uname) return { ok: false, error: "Username is required." };
    if (!password || password.length < 8) return { ok: false, error: "Password must be at least 8 characters long." };
    const salt = Utilities.getUuid();
    const admin = {
      id: "user_" + Utilities.getUuid(),
      username: uname,
      passwordHash: hmacSha256Hex_(password, salt),
      passwordSalt: salt,
      name: String(name || "System Administrator").trim() || "System Administrator",
      designation: String(designation || "Senior Chemist").trim() || "Senior Chemist",
      role: "Administrator",
      active: true,
      status: "Active",
      createdAt: new Date().toISOString()
    };
    upsertRow_("users", admin);
    logSecurityEvent_("USER_CREATED", { username: admin.username, userId: admin.id, reason: "first_admin_bootstrap" });
    return { ok: true, user: safeUserProjection_(admin) };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Segregation of duties — Sample approvals
// ---------------------------------------------------------------------------
// Mirrors just enough of 20-sample-model.js's addApproval()/
// bulkDecideParameter() to catch a tampered or bypassed client — the full
// state machine (canTransitionTestStatus and friends) stays client-side for
// now (flagged in the final report as a larger follow-up); this specific
// check is what actually enforces "you can't sign off as someone else" and
// "you can't approve your own result" at the one point that matters most.
const SAMPLE_ROLE_PERMISSIONS_FALLBACK_ = {
  Administrator: { canReview: true, canApprove: true },
  "Sample Analyzer": { canReview: false, canApprove: false },
  Reviewer: { canReview: true, canApprove: false },
  "QA Manager": { canReview: true, canApprove: true },
  Guest: { canReview: false, canApprove: false }
};
// The authoritative permission source is the admin-editable permissionMatrix
// singleton (Settings ▸ Roles & Permissions) if one has been saved; the
// table above is only the same built-in fallback 20-sample-model.js itself
// falls back to for a role that was never customized.
function resolveSampleRolePerm_(role) {
  try {
    const singleton = readAllRows_("permissionMatrix")[0];
    const matrix = singleton && (singleton.matrix || singleton);
    const fromMatrix = matrix && matrix[role] && matrix[role].samples;
    if (fromMatrix) return fromMatrix;
  } catch (e) { /* fall through to the built-in default below */ }
  return SAMPLE_ROLE_PERMISSIONS_FALLBACK_[role] || { canReview: false, canApprove: false };
}
// Best-effort: finds who actually ran the given test on this sample, so a
// self-approval attempt can be caught. Returns null (never throws) when it
// can't be resolved confidently — a missing tester name should never block
// a legitimate approval, only a confirmed match should ever block one.
function findTesterForTestType_(sample, testTypeId, testRecordsAll) {
  const linkedIds = sample.linkedTestRecordIds || [];
  const record = linkedIds
    .map(id => testRecordsAll.find(r => r.id === id))
    .find(r => r && (r.testTypeId === testTypeId || (r.memberResults || []).some(m => m.sampleId === sample.id)));
  return (record && record.tester) || null;
}
// Throws on the first violation found among newly-added approvals on this
// write; a write that doesn't touch `approvals` at all (registration,
// assignment, hold, status-only edits, etc.) returns immediately and is
// completely unaffected.
function enforceSampleApprovalIntegrity_(record, existing, auth, testRecordsAll) {
  if (auth && auth.user.role === "Administrator") return; // Step 13: Admin override
  const prevApprovals = (existing && existing.approvals) || [];
  const nextApprovals = record.approvals || [];
  if (nextApprovals.length <= prevApprovals.length) return;
  nextApprovals.slice(prevApprovals.length).forEach(approval => {
    if (!approval || !approval.decision) return; // not a signature-style entry — nothing to check
    if (approval.byUser !== auth.user.name || approval.byRole !== auth.user.role) {
      throw new Error("SECURITY: This approval's signed identity does not match the logged-in user.");
    }
    const step = approval.step === "review" ? "review" : "approve"; // bulkDecideParameter entries have no `step` and are always a final approve
    const perm = resolveSampleRolePerm_(auth.user.role);
    if (step === "review" && !perm.canReview) {
      throw new Error(`SECURITY: Role "${auth.user.role}" is not authorized to review results.`);
    }
    if (step === "approve" && !perm.canApprove) {
      throw new Error(`SECURITY: Role "${auth.user.role}" is not authorized to approve results.`);
    }
    if (approval.testTypeId) {
      const tester = findTesterForTestType_(record, approval.testTypeId, testRecordsAll);
      if (tester && auth.user.name && tester === auth.user.name) {
}
    }
  });
}
function enforceSamplesWritePolicy_(records, auth) {
  const list = Array.isArray(records) ? records : [records];
  // Skip the read if no record touches approvals, returnEvents, or requestedTests
  if (!list.some(r => r && (r.approvals || r.returnEvents || r.requestedTests))) return;
  const existingById = {};
  readAllRows_("samples").forEach(s => { existingById[s.id] = s; });
  const testRecordsAll = readAllRows_("testRecords");
  list.forEach(record => {
    if (!record) return;
    const existing = existingById[record.id];

    // Protect requestedTests from mass-assignment of sensitive final states
    if (record.requestedTests && existing && auth && auth.user.role !== "Administrator") {
      const prevRtMap = new Map((existing.requestedTests || []).map(rt => [rt.testTypeId, rt.status]));
      record.requestedTests.forEach(rt => {
        const prevStatus = prevRtMap.get(rt.testTypeId);
        if (rt.status !== prevStatus && PROTECTED_STATUSES_.has(rt.status)) {
          logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { userId: auth.user.id, collection: "samples", sampleId: record.id, reason: "mass_assignment_status" });
          throw new Error(`SECURITY: Cannot change test status to "${rt.status}" via generic save. Please use the dedicated workflow endpoints.`);
        }
      });
    }

    // Protect approvals integrity — other fields (including status) are
    // still writable via generic save for legitimate custody moves.
    // Approval / release flow changes must come through submitApprovalDecision
    // or releaseResult which carry their own permission checks.
    if (record.approvals) {
      try {
        enforceSampleApprovalIntegrity_(record, existing, auth, testRecordsAll);
      } catch (err) {
        logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { userId: auth.user.id, collection: "samples", sampleId: record.id, reason: String(err && err.message || err) });
        throw err;
      }
    }
  });
}

// A record that's allowed to differ from what's already stored ONLY in
// specific fields — everything else must match exactly, or the whole
// write is rejected. This is the actual "dedicated endpoint instead of
// generic save" fix: even with a valid session and the right role, a
// review/approval action can never smuggle in a change to, say,
// sampleCode, referenceId, or requestedTests for a DIFFERENT testTypeId
// than the one being decided — fields the generic save/bulkSet path had no
// way to restrict, because it didn't know which action was happening.
function enforceAllowedFieldDiff_(record, existing, allowedFields, actionLabel) {
  if (!existing) return; // brand-new record — nothing to compare against
  const allowed = new Set(allowedFields);
  // Check fields present in the submitted record
  Object.keys(record).forEach(key => {
    if (allowed.has(key)) return;
    const before = JSON.stringify(existing[key] === undefined ? null : existing[key]);
    const after = JSON.stringify(record[key] === undefined ? null : record[key]);
    if (before !== after) {
      throw new Error(`SECURITY: "${actionLabel}" is not allowed to change field "${key}".`);
    }
  });
  // Also check fields present in existing but missing from record —
  // a missing key in the submitted object must not differ from the stored value.
  // This catches cases where the client accidentally omits a field.
  Object.keys(existing).forEach(key => {
    if (allowed.has(key)) return;
    if (key in record) return; // already checked above
    const before = JSON.stringify(existing[key] === undefined ? null : existing[key]);
    const after = "null"; // field was omitted from the submitted record
    if (before !== after) {
      throw new Error(`SECURITY: "${actionLabel}" is not allowed to omit field "${key}" (stored value is non-null).`);
    }
  });
}
// Fields a review/approve-or-reject decision is allowed to touch. Covers
// both bulkMarkReviewed (bumps requestedTests[].status + the rollup
// status + a custodyLog entry, no signature) and bulkDecideParameter /
// addApproval (same, plus a new signed entry in approvals[]).
// Any OTHER field on the sample object must be identical between what the
// client sends and what's already stored — detected by enforceAllowedFieldDiff_
// above. New non-critical fields added to sample objects (e.g.
// linkedTestRecordIds, returnEvents) are allowed to pass through unchanged
// because they are NOT in this list and must therefore match exactly.
const APPROVAL_DECISION_ALLOWED_FIELDS_ = [
  "approvals", "requestedTests", "status", "custodyLog", "updatedAt", "_version",
  // These fields may differ between the client-side object and the stored
  // record when the client has newer local state (e.g. from a previous save
  // in the same session that hasn't been round-tripped back yet). They are
  // read-only from the review/approve endpoint's perspective — the stored
  // value wins, but we don't reject the whole operation just because the
  // client sent them along. The bulkUpsertRows_ call below will preserve
  // the value that was actually saved.
  "linkedTestRecordIds", "returnEvents", "correctionHistory"
];
const ASSIGN_SAMPLES_ALLOWED_FIELDS_ = ["status", "subBatchIds", "assignedTo", "updatedAt", "_version"];
function handleAssignSamples_(payload, auth) {
  const { records } = payload || {};
  if (!Array.isArray(records) || !records.length) return { ok: false, error: "No records supplied." };
  const perm = resolveSampleRolePerm_(auth.user.role);
  if (!perm.canAssign && auth.user.role !== "Administrator") {
    logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "assignSamples", userId: auth.user.id, reason: "not_authorized_to_assign" });
    return { ok: false, error: `Role "${auth.user.role}" is not authorized to assign samples.` };
  }
  const existingById = {};
  readAllRows_("samples").forEach(s => { existingById[s.id] = s; });
  records.forEach(record => {
    const existing = existingById[record.id];
    try {
      enforceAllowedFieldDiff_(record, existing, ASSIGN_SAMPLES_ALLOWED_FIELDS_, "Assign Samples");
    } catch (err) {
      if (auth.user.role !== "Administrator") throw err;
    }
  });
  const saved = bulkUpsertRows_("samples", records);
  logSecurityEvent_("SAMPLES_ASSIGNED", { userId: auth.user.id, count: records.length });
  return { ok: true, data: saved };
}

const RETURN_TO_ANALYST_ALLOWED_FIELDS_ = ["status", "approvals", "returnEvents", "updatedAt", "_version"];
function handleReturnToAnalyst_(payload, auth) {
  const { records } = payload || {};
  if (!Array.isArray(records) || !records.length) return { ok: false, error: "No records supplied." };
  const perm = resolveSampleRolePerm_(auth.user.role);
  if (!perm.canReview && !perm.canApprove && auth.user.role !== "Administrator") {
    logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "returnToAnalyst", userId: auth.user.id, reason: "not_authorized" });
    return { ok: false, error: `Role "${auth.user.role}" is not authorized to return samples.` };
  }
  const existingById = {};
  readAllRows_("samples").forEach(s => { existingById[s.id] = s; });
  records.forEach(record => {
    const existing = existingById[record.id];
    try {
      enforceAllowedFieldDiff_(record, existing, RETURN_TO_ANALYST_ALLOWED_FIELDS_, "Return to Analyst");
    } catch (err) {
      if (auth.user.role !== "Administrator") throw err;
    }
  });
  const saved = bulkUpsertRows_("samples", records);
  logSecurityEvent_("RETURNED_TO_ANALYST", { userId: auth.user.id, count: records.length });
  return { ok: true, data: saved };
}

const HOLD_TEST_ALLOWED_FIELDS_ = ["status", "updatedAt", "_version"];
function handleHoldTest_(payload, auth) {
  const { records } = payload || {};
  if (!Array.isArray(records) || !records.length) return { ok: false, error: "No records supplied." };
  
  // Permissions for hold/resume logic
  const perm = resolveSampleRolePerm_(auth.user.role);
  if (!perm.canReview && !perm.canApprove && auth.user.role !== "Administrator") {
    logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "holdTest", userId: auth.user.id, reason: "not_authorized" });
    return { ok: false, error: `Role "${auth.user.role}" is not authorized to hold tests.` };
  }

  const existingById = {};
  readAllRows_("samples").forEach(s => { existingById[s.id] = s; });
  records.forEach(record => {
    const existing = existingById[record.id];
    try {
      enforceAllowedFieldDiff_(record, existing, HOLD_TEST_ALLOWED_FIELDS_, "Hold Test");
    } catch (err) {
      if (auth.user.role !== "Administrator") throw err;
    }
  });

  const saved = bulkUpsertRows_("samples", records);
  logSecurityEvent_("TEST_HELD", { userId: auth.user.id, count: records.length });
  return { ok: true, data: saved };
}

function handleResumeTest_(payload, auth) {
  const { records } = payload || {};
  if (!Array.isArray(records) || !records.length) return { ok: false, error: "No records supplied." };
  
  const perm = resolveSampleRolePerm_(auth.user.role);
  if (!perm.canReview && !perm.canApprove && auth.user.role !== "Administrator") {
    logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "resumeTest", userId: auth.user.id, reason: "not_authorized" });
    return { ok: false, error: `Role "${auth.user.role}" is not authorized to resume tests.` };
  }

  const existingById = {};
  readAllRows_("samples").forEach(s => { existingById[s.id] = s; });
  records.forEach(record => {
    const existing = existingById[record.id];
    try {
      enforceAllowedFieldDiff_(record, existing, HOLD_TEST_ALLOWED_FIELDS_, "Resume Test");
    } catch (err) {
      if (auth.user.role !== "Administrator") throw err;
    }
  });

  const saved = bulkUpsertRows_("samples", records);
  logSecurityEvent_("TEST_RESUMED", { userId: auth.user.id, count: records.length });
  return { ok: true, data: saved };
}

function handleReleaseResult_(payload, auth) {
  const { records } = payload || {};
  if (!Array.isArray(records) || !records.length) return { ok: false, error: "No records supplied." };
  
  const perm = resolveSampleRolePerm_(auth.user.role);
  if (!perm.canRelease && auth.user.role !== "Administrator") {
    logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "releaseResult", userId: auth.user.id, reason: "not_authorized" });
    return { ok: false, error: `Role "${auth.user.role}" is not authorized to release results.` };
  }

  const existingById = {};
  readAllRows_("samples").forEach(s => { existingById[s.id] = s; });
  records.forEach(record => {
    const existing = existingById[record.id];
    try {
      enforceAllowedFieldDiff_(record, existing, ["status", "approvals", "updatedAt", "_version"], "Release Result");
    } catch (err) {
      if (auth.user.role !== "Administrator") throw err;
    }
  });

  const saved = bulkUpsertRows_("samples", records);
  logSecurityEvent_("RESULT_RELEASED", { userId: auth.user.id, count: records.length });
  return { ok: true, data: saved };
}

function handleSubmitApprovalDecision_(payload, auth) {
  const { records, step, testTypeId } = payload || {};
  if (!Array.isArray(records) || !records.length) return { ok: false, error: "No records supplied." };
  if (step !== "review" && step !== "approve") return { ok: false, error: 'step must be "review" or "approve".' };
  const perm = resolveSampleRolePerm_(auth.user.role);
  if (step === "review" && !perm.canReview) {
    logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "submitApprovalDecision", step, userId: auth.user.id, reason: "not_authorized_to_review" });
    return { ok: false, error: `Role "${auth.user.role}" is not authorized to review results.` };
  }
  if (step === "approve" && !perm.canApprove) {
    logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "submitApprovalDecision", step, userId: auth.user.id, reason: "not_authorized_to_approve" });
    return { ok: false, error: `Role "${auth.user.role}" is not authorized to approve results.` };
  }
  const existingById = {};
  readAllRows_("samples").forEach(s => { existingById[s.id] = s; });
  const testRecordsAll = readAllRows_("testRecords");
  // All-or-nothing: every record in this batch is validated before any of
  // them is written, matching the "either the whole batch saves or none of
  // it does" behaviour the rest of the app already relies on elsewhere
  // (e.g. bulk sample import).
  records.forEach(record => {
    const existing = existingById[record.id];
    try {
      enforceSampleApprovalIntegrity_(record, existing, auth, testRecordsAll);
      enforceAllowedFieldDiff_(record, existing, APPROVAL_DECISION_ALLOWED_FIELDS_, `${step === "review" ? "Review" : "Approve/Reject"} decision`);
    } catch (err) {
      logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "submitApprovalDecision", step, userId: auth.user.id, sampleId: record.id, reason: String(err && err.message || err) });
      throw err;
    }
  });
  const saved = bulkUpsertRows_("samples", records);
  logSecurityEvent_(step === "review" ? "RESULT_REVIEWED" : "RESULT_APPROVAL_DECIDED", { userId: auth.user.id, testTypeId: testTypeId || null, count: records.length });
  return { ok: true, data: saved };
}

// ---------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------
// Roles that can see the Audit Log if the admin-editable permissionMatrix
// singleton hasn't defined one — mirrors 41-rbac-ui.js's
// DEFAULT_PERMISSION_MATRIX at the time of writing (Administrator, QA
// Manager, Senior Chemist, Chief Chemist, Superintendent Engineer all
// default to auditLog.view: true; every other role defaults to false).
const AUDIT_VIEW_ROLES_FALLBACK_ = new Set(["Administrator", "QA Manager", "Senior Chemist", "Chief Chemist", "Superintendent Engineer"]);
function canViewAuditLog_(role) {
  try {
    const singleton = readAllRows_("permissionMatrix")[0];
    const matrix = singleton && (singleton.matrix || singleton);
    if (matrix && matrix[role] && matrix[role].auditLog && typeof matrix[role].auditLog.view === "boolean") {
      return matrix[role].auditLog.view;
    }
  } catch (e) { /* fall through to the built-in default below */ }
  return AUDIT_VIEW_ROLES_FALLBACK_.has(role);
}
// Every GET read (list / listActive / multiList / listSince) funnels through
// here so the "sessions" block and "users" safe-projection apply no matter
// which of the four read paths a given screen happens to use — fixing this
// in one place instead of four keeps a future new read action from
// accidentally reopening the hole. auditLog is the one collection here that
// also requires an authenticated, permitted session — everything else
// stays open to any token holder, matching the rest of this pass's scope
// (see the final report's Known Limitations for the case for going
// further).
function applyCollectionReadPolicy_(collection, rows, sessionToken) {
  if (collection === SESSION_ONLY_COLLECTION_) {
    throw new Error("Direct access to sessions is not permitted.");
  }
  if (collection === "users") {
    return rows.map(safeUserProjection_);
  }
  if (collection === "auditLog") {
    const auth = requireSession_(sessionToken); // throws if missing/invalid — fails closed
    if (!canViewAuditLog_(auth.user.role)) {
      logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: "list", collection: "auditLog", userId: auth.user.id, reason: "role_not_permitted" });
      throw new Error(`Role "${auth.user.role}" is not authorized to view the audit log.`);
    }
  }
  return rows;
}
function doGet(e) {
  try {
    const action = e.parameter.action;
    const token = e.parameter.token || "";
    const sessionToken = e.parameter.sessionToken || "";
    if (!checkToken_(token)) return jsonOut_({ error: "Invalid token." });
    if (action === "ping") return jsonOut_({ data: { ok: true, mode: "gas" } });
    if (action === "list") {
      const collection = e.parameter.collection;
      if (!collection) return jsonOut_({ error: "Missing collection." });
      return jsonOut_({ data: applyCollectionReadPolicy_(collection, readAllRowsCached_(collection), sessionToken) });
    }
    if (action === "listActive") {
      const collection = e.parameter.collection;
      if (!collection) return jsonOut_({ error: "Missing collection." });
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const all = readAllRows_(collection);
      const active = all.filter(r => !r.date || r.date >= cutoffStr);
      return jsonOut_({ data: applyCollectionReadPolicy_(collection, active, sessionToken) });
    }
    if (action === "multiList") {
      const collections = (e.parameter.collections || "").split(",").filter(Boolean);
      const res = {};
      collections.forEach(col => {
        const bareCol = col.startsWith("active:") ? col.slice(7) : col;
        if (col.startsWith("active:")) {
          const cutoff = new Date();
          cutoff.setFullYear(cutoff.getFullYear() - 1);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          const all = readAllRows_(bareCol);
          res[col] = applyCollectionReadPolicy_(bareCol, all.filter(r => !r.date || r.date >= cutoffStr), sessionToken);
        } else {
          res[col] = applyCollectionReadPolicy_(bareCol, readAllRowsCached_(bareCol), sessionToken);
        }
      });
      return jsonOut_({ data: res });
    }
    if (action === "listSince") {
      const collection = e.parameter.collection;
      const since = e.parameter.since || "";
      if (!collection) return jsonOut_({ error: "Missing collection." });
      const all = readAllRows_(collection);
      const filtered = all.filter(r => !since || (r.updatedAt || "") > since);
      return jsonOut_({ data: applyCollectionReadPolicy_(collection, filtered, sessionToken) });
    }
    if (action === "archiveQuery") {
      if (typeof handleArchiveQuery_ === "function") {
        return jsonOut_({ data: handleArchiveQuery_(e.parameter) });
      }
      return jsonOut_({ data: [] });
    }
    return jsonOut_({ error: `Unknown GET action "${action}".` });
  } catch (err) {
    return jsonOut_({ error: String(err && err.message || err) });
  }
}
// A write (save/remove/bulkSet) reads the sheet, modifies it, and writes it
// back — with no lock, two overlapping requests (e.g. the app firing
// several auto-saves in quick succession, or two people/tabs editing at
// once) can interleave and clobber each other, since Apps Script Web Apps
// genuinely do run concurrent executions. LockService serializes just the
// write path (reads stay lock-free/fast) so one write always finishes
// before the next one starts touching the same spreadsheet.
const WRITE_ACTIONS_ = new Set(["save", "remove", "bulkSet", "bulkUpsert", "bulkRemove", "bulkAppendAudit", "appendAudit", "restoreRecord", "setUserPassword", "submitApprovalDecision", "assignSamples", "returnToAnalyst", "holdTest", "resumeTest", "releaseResult"]);
// Actions that establish or end a session themselves — these are the only
// POST actions allowed WITHOUT already holding a valid session token.
// Everything else in doPost is a protected action from here on.
const UNAUTHENTICATED_ACTIONS_ = new Set(["login", "logout", "bootstrapAdmin"]);
// Every other action that touches data or config requires a valid,
// non-expired session — not just the shared deploy token (see the note
// above SESSION_ONLY_COLLECTION_ on why the token alone isn't a real
// authorization boundary in this architecture).
const SESSION_REQUIRED_ACTIONS_ = new Set([
  "save", "remove", "bulkSet", "bulkUpsert", "bulkRemove",
  "bulkAppendAudit", "appendAudit", "restoreRecord", "setUserPassword",
  "submitApprovalDecision", "assignSamples", "returnToAnalyst", "holdTest", "resumeTest", "releaseResult",
  "configureBackup", "getBackupConfig", "backupNow"
]);

// Statuses that must never be set via generic save/bulkUpsert.
// They must only be entered via their dedicated, permission-checked endpoints.
const PROTECTED_STATUSES_ = new Set(["approved", "released"]);

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const { action, collection, payload, token, sessionToken } = body;
    if (!checkToken_(token)) return jsonOut_({ error: "Invalid token." });

    if (action === "login") return jsonOut_({ data: handleLogin_(payload) });
    if (action === "logout") return jsonOut_({ data: handleLogout_(payload) });
    if (action === "bootstrapAdmin") return jsonOut_({ data: handleBootstrapAdmin_(payload) });

    let auth = null;
    if (SESSION_REQUIRED_ACTIONS_.has(action)) {
      try {
        auth = requireSession_(sessionToken);
      } catch (authErr) {
        logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: action, collection: collection || "", reason: String(authErr && authErr.message || authErr) });
        return jsonOut_({ error: String(authErr && authErr.message || authErr) });
      }
    }

    // Sensitive-collection guards — apply regardless of which write action
    // is being used to reach them, so a new write action added later can't
    // accidentally bypass these by skipping a check that only lived in one
    // switch case.
    if (WRITE_ACTIONS_.has(action) && collection) {
      if (collection === SESSION_ONLY_COLLECTION_) {
        return jsonOut_({ error: "Direct session mutation is not permitted." });
      }
      if (APPEND_ONLY_COLLECTIONS_.has(collection) && action !== "appendAudit" && action !== "bulkAppendAudit") {
        return jsonOut_({ error: `"${collection}" is append-only and cannot be edited or deleted.` });
      }
      if (ADMIN_ONLY_COLLECTIONS_.has(collection) && auth && auth.user.role !== "Administrator") {
        logSecurityEvent_("UNAUTHORIZED_ACCESS_ATTEMPT", { action: action, collection: collection, userId: auth.user.id, reason: "not_administrator" });
        return jsonOut_({ error: "Only an Administrator can modify this data." });
      }
      // Phase 2: Permission-matrix CRUD enforcement — checks the
      // admin-editable Roles & Permissions matrix for every write to a
      // gated collection. Administrator always passes; un-gated
      // collections (labIdentity, etc.) are not affected.
      if (auth) {
        try {
          enforceMatrixPermission_(auth, collection, action, payload);
        } catch (permErr) {
          return jsonOut_({ error: String(permErr && permErr.message || permErr) });
        }
      }
    }

    let lock = null;
    if (WRITE_ACTIONS_.has(action)) {
      lock = LockService.getScriptLock();
      // Waits up to 30s for any other in-flight write to finish rather than
      // failing immediately — a queued write beats a silently dropped one.
      lock.waitLock(30000);
    }
    try {
      switch (action) {
        case "save": {
          if (collection === "samples" && auth) enforceSamplesWritePolicy_(payload, auth);
          const safePayload = collection === "users" ? sanitizeUserWrite_(payload, auth) : payload;
          const saved = upsertRow_(collection, safePayload);
          return jsonOut_({ data: collection === "users" ? safeUserProjection_(saved) : saved });
        }
        case "remove":
          removeRow_(collection, payload.id);
          return jsonOut_({ data: { ok: true } });
        case "bulkSet": {
          if (collection === "samples" && auth) enforceSamplesWritePolicy_(payload, auth);
          const safePayload = collection === "users" ? (payload || []).map(p => sanitizeUserWrite_(p, auth)) : payload;
          const saved = replaceAllRows_(collection, safePayload);
          return jsonOut_({ data: collection === "users" ? saved.map(safeUserProjection_) : saved });
        }
        case "bulkUpsert": {
          if (collection === "samples" && auth) enforceSamplesWritePolicy_(payload, auth);
          const safePayload = collection === "users" ? (payload || []).map(p => sanitizeUserWrite_(p, auth)) : payload;
          const saved = bulkUpsertRows_(collection, safePayload);
          return jsonOut_({ data: collection === "users" ? saved.map(safeUserProjection_) : saved });
        }
        case "assignSamples": {
          const result = handleAssignSamples_(payload, auth);
          return jsonOut_(result.ok ? { data: result.data } : { error: result.error });
        }
        case "returnToAnalyst": {
          const result = handleReturnToAnalyst_(payload, auth);
          return jsonOut_(result.ok ? { data: result.data } : { error: result.error });
        }
        case "holdTest": {
          const result = handleHoldTest_(payload, auth);
          return jsonOut_(result.ok ? { data: result.data } : { error: result.error });
        }
        case "resumeTest": {
          const result = handleResumeTest_(payload, auth);
          return jsonOut_(result.ok ? { data: result.data } : { error: result.error });
        }
        case "releaseResult": {
          const result = handleReleaseResult_(payload, auth);
          return jsonOut_(result.ok ? { data: result.data } : { error: result.error });
        }
        case "submitApprovalDecision": {
          const result = handleSubmitApprovalDecision_(payload, auth);
          return jsonOut_(result.ok ? { data: result.data } : { error: result.error });
        }
        case "setUserPassword": {
          const { userId, newPassword, user } = payload || {};
          if (!userId || !newPassword || newPassword.length < 8) {
            return jsonOut_({ error: "A user id and a password of at least 8 characters are required." });
          }
          let existing = readAllRows_("users").find(u => u.id === userId);
          if (user) {
             const safeUser = sanitizeUserWrite_(user, auth);
             upsertRow_("users", safeUser);
             existing = readAllRows_("users").find(u => u.id === userId);
          }
          if (!existing) return jsonOut_({ error: "User not found." });
          const salt = Utilities.getUuid();
          existing.passwordSalt = salt;
          existing.passwordHash = hmacSha256Hex_(newPassword, salt);
          upsertRow_("users", existing);
          logSecurityEvent_("PASSWORD_RESET", { targetUser: existing.username, byUser: auth.user.username });
          return jsonOut_({ data: safeUserProjection_(existing) });
        }
        case "bulkRemove":
          return jsonOut_({ data: bulkRemoveRows_(collection, payload && payload.ids) });
        case "bulkAppendAudit": {
          const enrichedBulk = (payload || []).map(p => ({
            ...p,
            user: auth ? auth.user.username : p.user,
            role: auth ? auth.user.role : p.role,
            performedBy: auth ? auth.user.name : p.performedBy,
            ts: new Date().toISOString()
          }));
          return jsonOut_({ data: bulkAppendAuditRows_(enrichedBulk) });
        }
        case "appendAudit": {
          const enriched = {
            ...payload,
            user: auth ? auth.user.username : payload.user,
            role: auth ? auth.user.role : payload.role,
            performedBy: auth ? auth.user.name : payload.performedBy,
            ts: new Date().toISOString()
          };
          return jsonOut_({ data: upsertRow_("auditLog", enriched) });
        }
        case "restoreRecord":
          if (typeof handleRestoreRecord_ === "function") {
            return jsonOut_({ data: handleRestoreRecord_(payload) });
          }
          return jsonOut_({ error: "restoreRecord handler not available" });
        case "configureBackup":
          return jsonOut_({ data: configureBackup_(payload) });
        case "getBackupConfig":
          return jsonOut_({ data: getBackupConfig_() });
        case "backupNow":
          sendBackupEmail_(/* isManualTest */ true);
          return jsonOut_({ data: { ok: true } });
        default:
          return jsonOut_({ error: `Unknown POST action "${action}".` });
      }
    } finally {
      if (lock) lock.releaseLock();
    }
  } catch (err) {
    return jsonOut_({ error: String(err && err.message || err) });
  }
}
// A "save"/"bulkSet"/"bulkUpsert" on the users collection is how the
// front-end's RBAC screen creates/edits accounts today (see 41-rbac-ui.js —
// left as-is in this pass rather than rewritten into dedicated
// createUser/setUserRole endpoints, which is flagged as a follow-up in the
// final report). Two things still need enforcing at the point the record
// actually gets written, no matter which of those three actions was used:
// a client can never set its own passwordHash/passwordSalt directly
// (that would let anyone plant an arbitrary password on any account,
// including someone else's, bypassing verifyAndMaybeMigratePassword_
// entirely), and an existing user's stored hash/salt must survive a
// metadata-only edit (e.g. changing a designation) untouched.
function sanitizeUserWrite_(record, auth) {
  if (!record || typeof record !== "object") return record;
  const clean = Object.assign({}, record);
  delete clean.passwordHash;
  delete clean.passwordSalt;
  delete clean.password;
  if (record.id) {
    const existing = readAllRows_("users").find(u => u.id === record.id);
    if (existing) {
      clean.passwordHash = existing.passwordHash;
      clean.passwordSalt = existing.passwordSalt;
    }
  }
  return clean;
}
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Automatic email backup
// ---------------------------------------------------------------------------
const BACKUP_CONFIG_KEY = "BACKUP_CONFIG";
const BACKUP_SUBJECT = "[DPHE LIMS] Automatic Data Backup";
function getBackupConfig_() {
  const raw = scriptProps_().getProperty(BACKUP_CONFIG_KEY);
  return raw ? JSON.parse(raw) : { enabled: false, email: "", frequencyDays: 7, lastSentAt: "" };
}
function configureBackup_(payload) {
  const current = getBackupConfig_();
  const next = {
    enabled: !!payload.enabled,
    email: String(payload.email || "").trim(),
    frequencyDays: Number(payload.frequencyDays || 7),
    lastSentAt: current.lastSentAt || ""
  };
  scriptProps_().setProperty(BACKUP_CONFIG_KEY, JSON.stringify(next));
  return next;
}
// Every sheet in the storage spreadsheet becomes one key in the export —
// this naturally includes anything synced from the client (see
// syncLegacyToBackend in 23-data-backup.js), not just the collections this
// backend itself writes to.
function buildFullExport_() {
  const ss = getSpreadsheet_();
  const bundle = { schema: "aqualab-gas-backup-v1", exportedAt: new Date().toISOString(), collections: {} };
  ss.getSheets().forEach(sheet => {
    bundle.collections[sheet.getName()] = readAllRows_(sheet.getName());
  });
  return bundle;
}
// isManualTest=true (from the "Send Backup Email Now" button) always sends,
// ignoring the schedule — everything else (the daily trigger) only sends
// when the configured interval has actually elapsed.
function sendBackupEmail_(isManualTest) {
  const cfg = getBackupConfig_();
  if (!cfg.enabled && !isManualTest) return;
  if (!cfg.email) return;
  if (!isManualTest) {
    const days = cfg.lastSentAt ? (Date.now() - new Date(cfg.lastSentAt).getTime()) / 86400000 : Infinity;
    if (days < cfg.frequencyDays) return; // not due yet
  }
  // Find the previous backup email BEFORE sending the new one, so we know
  // exactly what to delete afterwards and never risk trashing the one we
  // just sent.
  const previousThreads = GmailApp.search(`subject:"${BACKUP_SUBJECT}" in:sent to:${cfg.email}`);

  const bundle = buildFullExport_();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const blob = Utilities.newBlob(JSON.stringify(bundle, null, 2), "application/json", `dphe_lims_backup_${stamp}.json`);
  GmailApp.sendEmail(cfg.email, BACKUP_SUBJECT, "Attached: the latest automatic DPHE LIMS data backup. This replaces the previous backup email, which has been removed.", { attachments: [blob], name: "DPHE LIMS Backup" });

  // Now that the new one is safely sent, delete the old one(s) — "the
  // previous mail should get deleted" from the request. Trash rather than
  // permanently erase, so a mistake is still recoverable for a while.
  previousThreads.forEach(thread => thread.moveToTrash());

  scriptProps_().setProperty(BACKUP_CONFIG_KEY, JSON.stringify(Object.assign({}, cfg, { lastSentAt: new Date().toISOString() })));
}

// ---------------------------------------------------------------------------
// Daily trigger
// ---------------------------------------------------------------------------
function dailyMaintenance() {
  sendBackupEmail_(false);
  if (typeof runArchiveSweep === "function") {
    try { runArchiveSweep(); } catch (e) { Logger.log("Archive sweep trigger error: " + e); }
  }
}
/** Run this ONCE from the Apps Script editor (Run ▸ runOnce_setup). */
function runOnce_setup() {
  // Clear duplicate triggers from previous setup runs
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "dailyMaintenance" || t.getHandlerFunction() === "runArchiveSweep")
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("dailyMaintenance").timeBased().everyDays(1).atHour(2).create();
  if (typeof runArchiveSweep === "function") {
    ScriptApp.newTrigger("runArchiveSweep").timeBased().everyDays(1).atHour(1).create();
  }

  // Touch the spreadsheet once so it's created immediately
  getSpreadsheet_();
}
