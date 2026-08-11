/**
 * ============================================================================
 * DPHE LIMS — Automated Data Archival Service (ArchiveService.gs)
 * ============================================================================
 * Runs automatically via a daily time-driven trigger configured by runOnce_setup.
 * Moves active records older than 1 or 2 years to dedicated archive tabs
 * (e.g., testRecords_Archive_2024, samples_Archive_2024).
 * ============================================================================
 */

const ARCHIVE_CONFIG = {
  testRecords: { dateField: "date", archiveAfterYears: 2 },
  samples:     { dateField: "receivedAt", archiveAfterYears: 2 },
  subBatches:  { dateField: "createdAt", archiveAfterYears: 2 }
};

function runArchiveSweep() {
  const now = new Date();
  const sweepResults = [];

  Object.keys(ARCHIVE_CONFIG).forEach(collection => {
    const cfg = ARCHIVE_CONFIG[collection];
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - cfg.archiveAfterYears);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const activeRows = readAllRows_(collection);
    const toArchive = [];
    const remaining = [];

    activeRows.forEach(r => {
      const recDate = r[cfg.dateField] || r.createdAt || r.date;
      if (recDate && recDate < cutoffStr) {
        toArchive.push(r);
      } else {
        remaining.push(r);
      }
    });

    if (toArchive.length === 0) return;

    // Group items to be archived by calendar year
    const byYear = {};
    toArchive.forEach(r => {
      const recDate = r[cfg.dateField] || r.createdAt || r.date || "";
      const year = recDate.slice(0, 4) || "Older";
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(r);
    });

    Object.keys(byYear).forEach(year => {
      const archiveSheetName = `${collection}_Archive_${year}`;
      byYear[year].forEach(rec => {
        upsertRow_(archiveSheetName, Object.assign({}, rec, { archivedAt: now.toISOString() }));
      });
    });

    // Update active collection with lightweight remaining records
    replaceAllRows_(collection, remaining);
    sweepResults.push({ collection, archived: toArchive.length, activeRemaining: remaining.length });
  });

  if (sweepResults.length > 0) {
    upsertRow_("auditLog", {
      id: "archive_sweep_" + now.getTime(),
      ts: now.toISOString(),
      action: "auto_archive_sweep",
      details: JSON.stringify(sweepResults),
      user: "system_trigger"
    });
  }

  Logger.log("Archive sweep complete: " + JSON.stringify(sweepResults));
  return sweepResults;
}

/** Handles archive search queries on-demand without loading entire archive on startup */
function handleArchiveQuery_(params) {
  const { collection, year, dateFrom, dateTo, keyword } = params || {};
  const ss = getSpreadsheet_();
  const sheets = ss.getSheets();
  
  const targetSheets = sheets.filter(s => {
    const name = s.getName();
    if (name === "archived_records") return true;
    if (!name.includes("_Archive_")) return false;
    if (collection && !name.startsWith(collection + "_Archive_")) return false;
    if (year && !name.endsWith("_" + year)) return false;
    return true;
  });

  const results = [];
  targetSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    const rows = readAllRows_(sheetName);
    rows.forEach(r => {
      const recDate = r.date || r.receivedAt || r.createdAt || "";
      if (dateFrom && recDate < dateFrom) return;
      if (dateTo && recDate > dateTo) return;
      if (keyword) {
        const kw = String(keyword).toLowerCase();
        const jsonStr = JSON.stringify(r).toLowerCase();
        if (!jsonStr.includes(kw)) return;
      }
      results.push(Object.assign({}, r, { _archiveSheet: sheetName }));
    });
  });

  return results;
}

/** Handles restoring a record from any archive sheet back to its active collection */
function handleRestoreRecord_(payload) {
  const { id, archiveSheet } = payload || {};
  if (!id) throw new Error("Missing record id to restore.");
  const ss = getSpreadsheet_();
  let targetSheetName = archiveSheet;
  let recordToRestore = null;

  if (targetSheetName) {
    const sheet = ss.getSheetByName(targetSheetName);
    if (sheet) {
      const rows = readAllRows_(targetSheetName);
      recordToRestore = rows.find(r => r.id === id);
    }
  }

  if (!recordToRestore) {
    const archiveSheets = ss.getSheets()
      .map(s => s.getName())
      .filter(name => name === "archived_records" || name.includes("_Archive_"));

    for (const sName of archiveSheets) {
      const rows = readAllRows_(sName);
      const hit = rows.find(r => r.id === id);
      if (hit) {
        recordToRestore = hit;
        targetSheetName = sName;
        break;
      }
    }
  }

  if (!recordToRestore) {
    throw new Error("Archived record \"" + id + "\" was not found in any archive sheet.");
  }

  const clean = Object.assign({}, recordToRestore);
  delete clean.archivedAt;
  delete clean._archiveSheet;

  upsertRow_("testRecords", clean);

  if (targetSheetName) {
    removeRow_(targetSheetName, id);
  }

  return clean;
}
