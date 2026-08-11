/**
 * ============================================================================
 * DPHE LIMS — Database Initialization Script (InitDB.gs)
 * ============================================================================
 * Run this ONCE from the Apps Script editor (Run ▸ initProductionDatabase)
 * to set up clean, fresh Google Sheets tabs with proper column headers upon first deployment.
 * Safe to re-run — it only creates missing tabs and never overwrites existing data.
 * ============================================================================
 */

const PRODUCTION_COLLECTIONS = [
  "users",
  "permissionMatrix",
  "masterChemicals",
  "labIdentity",
  "samples",
  "references",
  "subBatches",
  "chemicals",
  "glassware",
  "equipment",
  "gas",
  "parameters",
  "testTypes",
  "testRecords",
  "archived_records",
  "auditLog",
  "sessions"
];

function initProductionDatabase() {
  const ss = getSpreadsheet_();
  const created = [];
  const existing = [];

  PRODUCTION_COLLECTIONS.forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, 3).setValues([["id", "json", "updatedAt"]]);
      sheet.setFrozenRows(1);
      created.push(name);
    } else {
      existing.push(name);
    }
  });

  Logger.log("Initialized database.");
  Logger.log("Created tabs (" + created.length + "): " + created.join(", "));
  Logger.log("Existing tabs (" + existing.length + "): " + existing.join(", "));

  const users = readAllRows_("users");
  if (users.length === 0) {
    Logger.log("✅ Database is ready for Production. First-time Admin Setup flow will launch on first application visit.");
  } else {
    Logger.log("ℹ️ Existing users found (" + users.length + "). First-time setup will be skipped.");
  }
}
