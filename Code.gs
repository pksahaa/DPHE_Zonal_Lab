/**
 * LIMS backend — Google Apps Script Web App
 * ------------------------------------------------------------------
 * Pairs with /js/01-data-service.js on the front end. Deploy this as a
 * Web App (Extensions > Apps Script, from a Google Sheet) and paste the
 * resulting /exec URL into the app's "Backend Settings" screen.
 *
 * Storage model: one Sheet tab per collection ("samples", "auditLog",
 * "chemicals", "testTypes", ...), each with exactly 3 columns:
 *   id | json | updatedAt
 * The whole record is stored as a JSON string in column B. This keeps the
 * backend generic — it never needs to know a Sample's shape vs a Chemical's
 * shape — at the cost of not being spreadsheet-friendly for manual editing.
 * If you want human-readable columns for a specific collection, add a
 * dedicated sync function rather than changing this generic path.
 *
 * Auth: a single shared-secret token (Script Property API_TOKEN), checked
 * on every request. This is NOT the same as per-user login — the app's own
 * Administrator/Technician/Reviewer/QA Manager login (client-side) governs
 * who can do what inside the UI. The token only stops random internet
 * traffic from hitting your spreadsheet. For real per-user server-side auth
 * you would front this with a proper backend (e.g. Cloud Run) — see the
 * caveat in README.md.
 *
 * SETUP
 *  1. Create a new Google Sheet. Extensions → Apps Script. Paste this file
 *     in as Code.gs (replace the default content).
 *  2. Project Settings → Script Properties → add API_TOKEN = <a long random
 *     string you invent>.
 *  3. Deploy → New deployment → Web app.
 *       Execute as: Me
 *       Who has access: Anyone
 *  4. Copy the /exec URL it gives you.
 *  5. In the LIMS app: Backend Settings → mode "Google Apps Script" → paste
 *     the URL and the same token you set in step 2 → Test Connection.
 */

function API_TOKEN_() {
  return PropertiesService.getScriptProperties().getProperty('API_TOKEN') || '';
}

function checkToken_(token) {
  const expected = API_TOKEN_();
  return !!expected && token === expected;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheetFor_(collection) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(collection);
  if (!sheet) {
    sheet = ss.insertSheet(collection);
    sheet.appendRow(['id', 'json', 'updatedAt']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function listCollection_(collection) {
  const sheet = sheetFor_(collection);
  const values = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    try { out.push(JSON.parse(row[1])); } catch (e) { /* skip corrupt row */ }
  }
  return out;
}

function findRowById_(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) return i + 1; // 1-indexed, +1 for header row already in i
  }
  return -1;
}

function saveRecord_(collection, record) {
  if (!record || !record.id) throw new Error('Record must have an id.');
  const sheet = sheetFor_(collection);
  const now = new Date().toISOString();
  const stamped = Object.assign({}, record, { updatedAt: now });
  const rowIdx = findRowById_(sheet, record.id);
  const rowValues = [record.id, JSON.stringify(stamped), now];
  if (rowIdx > 0) sheet.getRange(rowIdx, 1, 1, 3).setValues([rowValues]);
  else sheet.appendRow(rowValues);
  return stamped;
}

function removeRecord_(collection, id) {
  const sheet = sheetFor_(collection);
  const rowIdx = findRowById_(sheet, id);
  if (rowIdx > 0) sheet.deleteRow(rowIdx);
  return { id, deleted: true };
}

function bulkSetCollection_(collection, arr) {
  const sheet = sheetFor_(collection);
  sheet.clear();
  sheet.appendRow(['id', 'json', 'updatedAt']);
  sheet.setFrozenRows(1);
  const now = new Date().toISOString();
  (arr || []).forEach(function (record) {
    sheet.appendRow([record.id, JSON.stringify(record), now]);
  });
  return arr;
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action;
  const collection = params.collection;
  const token = params.token;

  if (action === 'ping') {
    if (!checkToken_(token)) return jsonOut_({ error: 'unauthorized' });
    return jsonOut_({ data: { ok: true, time: new Date().toISOString() } });
  }
  if (!checkToken_(token)) return jsonOut_({ error: 'unauthorized' });
  if (action === 'list') return jsonOut_({ data: listCollection_(collection) });
  return jsonOut_({ error: 'unknown action: ' + action });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ error: 'invalid JSON body' });
  }
  const { action, collection, payload, token } = body;
  if (!checkToken_(token)) return jsonOut_({ error: 'unauthorized' });

  if (action === 'save') return jsonOut_({ data: saveRecord_(collection, payload) });
  if (action === 'remove') return jsonOut_({ data: removeRecord_(collection, payload.id) });
  if (action === 'bulkSet') return jsonOut_({ data: bulkSetCollection_(collection, payload) });
  if (action === 'appendAudit') return jsonOut_({ data: saveRecord_('auditLog', payload) });
  return jsonOut_({ error: 'unknown action: ' + action });
}
