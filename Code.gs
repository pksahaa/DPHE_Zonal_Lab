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
  const stamped = Object.assign({}, record, { updatedAt: now });
  const idCol = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
  let rowIndex = -1;
  for (let i = 0; i < idCol.length; i++) {
    if (idCol[i][0] === record.id) { rowIndex = i + 2; break; }
  }
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
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(([id], i) => {
      if (id) idIndex[id] = i + 2; // sheet row number
    });
  }
  const toAppend = [];
  const stampedRecords = [];
  (records || []).forEach(record => {
    const stamped = Object.assign({}, record, { updatedAt: now });
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

function handleLogin_(payload) {
  const { username, passwordHash } = payload || {};
  const users = readAllRows_("users");
  const user = users.find(u => (u.username || "").toLowerCase() === (username || "").toLowerCase());
  if (!user || user.active === false) return { ok: false, error: "Invalid credentials or inactive account." };
  if (user.passwordHash !== passwordHash) return { ok: false, error: "Invalid credentials." };
  const sessionToken = Utilities.getUuid();
  const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  const sess = { id: sessionToken, userId: user.id, role: user.role, expiresAt };
  upsertRow_("sessions", sess);
  return { ok: true, token: sessionToken, user: { id: user.id, name: user.name, role: user.role, username: user.username } };
}

// ---------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------
function doGet(e) {
  try {
    const action = e.parameter.action;
    const token = e.parameter.token || "";
    if (!checkToken_(token)) return jsonOut_({ error: "Invalid token." });
    if (action === "ping") return jsonOut_({ data: { ok: true, mode: "gas" } });
    if (action === "list") {
      const collection = e.parameter.collection;
      if (!collection) return jsonOut_({ error: "Missing collection." });
      return jsonOut_({ data: readAllRowsCached_(collection) });
    }
    if (action === "listActive") {
      const collection = e.parameter.collection;
      if (!collection) return jsonOut_({ error: "Missing collection." });
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const all = readAllRows_(collection);
      const active = all.filter(r => !r.date || r.date >= cutoffStr);
      return jsonOut_({ data: active });
    }
    if (action === "multiList") {
      const collections = (e.parameter.collections || "").split(",").filter(Boolean);
      const res = {};
      collections.forEach(col => {
        if (col.startsWith("active:")) {
          const c = col.slice(7);
          const cutoff = new Date();
          cutoff.setFullYear(cutoff.getFullYear() - 1);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          const all = readAllRows_(c);
          res[col] = all.filter(r => !r.date || r.date >= cutoffStr);
        } else {
          res[col] = readAllRowsCached_(col);
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
      return jsonOut_({ data: filtered });
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
const WRITE_ACTIONS_ = new Set(["save", "remove", "bulkSet", "bulkUpsert", "bulkAppendAudit", "appendAudit", "restoreRecord"]);
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const { action, collection, payload, token } = body;
    if (!checkToken_(token)) return jsonOut_({ error: "Invalid token." });
    let lock = null;
    if (WRITE_ACTIONS_.has(action)) {
      lock = LockService.getScriptLock();
      // Waits up to 30s for any other in-flight write to finish rather than
      // failing immediately — a queued write beats a silently dropped one.
      lock.waitLock(30000);
    }
    try {
      switch (action) {
        case "save":
          return jsonOut_({ data: upsertRow_(collection, payload) });
        case "remove":
          removeRow_(collection, payload.id);
          return jsonOut_({ data: { ok: true } });
        case "bulkSet":
          return jsonOut_({ data: replaceAllRows_(collection, payload) });
        case "bulkUpsert":
          return jsonOut_({ data: bulkUpsertRows_(collection, payload) });
        case "bulkAppendAudit":
          return jsonOut_({ data: bulkAppendAuditRows_(payload) });
        case "appendAudit":
          return jsonOut_({ data: upsertRow_("auditLog", payload) });
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
