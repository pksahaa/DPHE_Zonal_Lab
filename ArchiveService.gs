/**
 * ============================================================================
 * DPHE LIMS — Automated Data Archival Service (ArchiveService.gs)
 * ============================================================================
 * Runs automatically via a daily time-driven trigger configured by runOnce_setup.
 *
 * Archiving applies ONLY to Test Records, and ONLY once every sample a
 * record covers has that specific test fully Released — mirrors exactly what
 * the manual "Archive" button in Test Records already requires
 * (archiveReleasedMembers(), 13-testrecords-ui.js). Samples and Sub-Batches
 * are never swept on their own: a sample stays in the live "samples" sheet
 * for as long as ANY of its requested tests hasn't been released+archived
 * yet (the same "s.archived" flag the manual flow sets) — so nothing is
 * silently pulled out of the live sheet by the daily sweep just because a
 * date field is old, while a test on it is still genuinely in progress.
 *
 * Archived records land in "archived_records" — the SAME destination the
 * manual "Archive" button uses (previously the sweep wrote into separate
 * dated "testRecords_Archive_<year>" sheets, so there were two different
 * places a record could end up depending on whether a person or the sweep
 * archived it; now there is exactly one place to search/restore from).
 * ============================================================================
 */

// Archiving now applies ONLY to Test Records, and ONLY once every sample
// covered by a record has that specific test fully Released — see the file
// header above. Samples and Sub-Batches are no longer part of this config.
const ARCHIVE_CONFIG = {
  testRecords: { dateField: "date" }
};

// ---- Admin-configurable Archive Settings ----
// Stored as a singleton row (id: "singleton") in the "archiveSettings"
// sheet — edited from Settings ▸ Archive Settings (see ArchiveSettingsModal,
// 18-archive-ui.js). Falls back to these defaults (the historical hardcoded
// 2-year threshold, converted to days) if nothing has been saved yet, so an
// install that's never touched this setting keeps behaving exactly as it
// always has.
const ARCHIVE_SETTINGS_DEFAULTS = {
  archiveAfterDays: {
    testRecords: 730
  },
  // How many days a manually-restored record (see handleRestoreRecord_
  // below, which stamps `restoredAt`) is protected from being swept back
  // into Archive by runArchiveSweep, and stays visible in the app's normal
  // active lists (see isWithinActiveWindow_ in Code.gs) even though its own
  // date is still outside the normal 1-year window. Without this, a record
  // restored today with an old date would either vanish from view again on
  // the very next page load, or get silently swept right back into Archive
  // on the next daily run — from the user's side, "restoring" it would look
  // like it never worked at all.
  restoreGraceDays: 90
};
function getArchiveSettings_() {
  const rows = readAllRowsCached_("archiveSettings");
  const saved = rows.find(r => r.id === "singleton");
  if (!saved) return ARCHIVE_SETTINGS_DEFAULTS;
  return {
    archiveAfterDays: Object.assign({}, ARCHIVE_SETTINGS_DEFAULTS.archiveAfterDays, saved.archiveAfterDays || {}),
    restoreGraceDays: typeof saved.restoreGraceDays === "number" && saved.restoreGraceDays >= 0 ? saved.restoreGraceDays : ARCHIVE_SETTINGS_DEFAULTS.restoreGraceDays
  };
}

// Same shape archiveReleasedMembers() (13-testrecords-ui.js) builds for a
// manual archive — kept identical on purpose so a record looks the same in
// the Archive tab, and counts the same toward Sample Breakdown by Programme
// / the Monthly Progress Report's archived-records branch, regardless of
// whether a person clicked "Archive" or the daily sweep did it. Crucially
// includes referenceId/clientType — omitting these (as an earlier version
// of both this and the manual snapshot did) made every archived sample fall
// back to "Unspecified" in Sample Breakdown by Programme, since there was
// nothing left in the snapshot for getClientType() to resolve a client type
// from.
function buildArchiveSnapshots_(ids, sampleById) {
  return ids.map(id => {
    const s = sampleById[id];
    return s ? { id: s.id, sampleCode: s.sampleCode, clientName: s.clientName, referenceId: s.referenceId, clientType: s.clientType, village: s.village, union: s.union, upazila: s.upazila } : { id };
  });
}

function runArchiveSweep() {
  const now = new Date();
  const settings = getArchiveSettings_();
  const graceMs = settings.restoreGraceDays * 24 * 60 * 60 * 1000;
  const days = typeof settings.archiveAfterDays.testRecords === "number" && settings.archiveAfterDays.testRecords > 0 ? settings.archiveAfterDays.testRecords : 730;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Read samples once, reused both to check "is every member of this record
  // actually Released?" and to build the archivedSampleSnapshots below.
  const sampleRows = readAllRows_("samples");
  const sampleById = {};
  sampleRows.forEach(s => { sampleById[s.id] = s; });
  function isMemberReleased_(sampleId, testTypeId) {
    const s = sampleById[sampleId];
    if (!s) return false; // sample missing/already archived elsewhere — be conservative, don't sweep
    const rt = (s.requestedTests || []).find(t => t.testTypeId === testTypeId);
    return !!(rt && rt.status === "released");
  }

  const activeRows = readAllRows_("testRecords");
  const toArchive = [];
  const remaining = [];

  activeRows.forEach(r => {
    // A recently-restored record is protected for restoreGraceDays,
    // regardless of how old its own date field says it is — otherwise a
    // manual restore would get silently undone again by the very next
    // sweep run, which is exactly the "restored but doesn't stay" bug this
    // setting exists to fix.
    if (r.restoredAt) {
      const restoredMs = new Date(r.restoredAt).getTime();
      if (!isNaN(restoredMs) && (now.getTime() - restoredMs) < graceMs) {
        remaining.push(r);
        return;
      }
    }
    const recDate = r.date || r.createdAt;
    if (!recDate || recDate >= cutoffStr) {
      remaining.push(r);
      return;
    }
    const memberIds = (r.memberSampleIds && r.memberSampleIds.length) ? r.memberSampleIds : r.sampleId ? [r.sampleId] : [];
    const fullyReleased = memberIds.length > 0 && memberIds.every(id => isMemberReleased_(id, r.testTypeId));
    if (!fullyReleased) {
      // Old but not (fully) released yet — never auto-archive, no matter
      // how stale the date. Someone still needs to finish/release this.
      remaining.push(r);
      return;
    }
    toArchive.push({ record: r, memberIds });
  });

  if (toArchive.length === 0) {
    Logger.log("Archive sweep complete: nothing eligible.");
    return [];
  }

  // Write into archived_records — see the file header above for why this
  // is now the one unified destination instead of a dated per-year sheet.
  const existingArchived = readAllRows_("archived_records");
  const existingById = {};
  existingArchived.forEach(r => { existingById[r.id] = r; });
  const touchedSampleIds = new Set();
  toArchive.forEach(({ record, memberIds }) => {
    existingById[record.id] = Object.assign({}, record, {
      archivedAt: now.toISOString(),
      archivedSampleSnapshots: buildArchiveSnapshots_(memberIds, sampleById)
    });
    memberIds.forEach(id => touchedSampleIds.add(id));
  });
  replaceAllRows_("archived_records", Object.values(existingById));
  replaceAllRows_("testRecords", remaining);

  // Mirror archiveReleasedMembers()'s sample-flagging: hide a sample from
  // the live Sample Registration list once every requested test on it has
  // either already been archived or has no remaining active test record —
  // same condition, just evaluated here for whatever the sweep (rather than
  // a person) just archived.
  if (touchedSampleIds.size) {
    const stillActiveSampleIds = new Set();
    remaining.forEach(r => {
      (r.memberSampleIds && r.memberSampleIds.length ? r.memberSampleIds : r.sampleId ? [r.sampleId] : []).forEach(id => stillActiveSampleIds.add(id));
    });
    let samplesChanged = false;
    const nextSamples = sampleRows.map(s => {
      if (!touchedSampleIds.has(s.id) || s.archived || stillActiveSampleIds.has(s.id)) return s;
      const stillPending = (s.requestedTests || []).some(rt => rt.status === "pending" || rt.status === "in_progress");
      if (stillPending) return s;
      samplesChanged = true;
      return Object.assign({}, s, { archived: true, archivedAt: now.toISOString() });
    });
    if (samplesChanged) replaceAllRows_("samples", nextSamples);
  }

  const sweepResults = [{ collection: "testRecords", archived: toArchive.length, activeRemaining: remaining.length }];
  upsertRow_("auditLog", {
    id: "archive_sweep_" + now.getTime(),
    ts: now.toISOString(),
    action: "auto_archive_sweep",
    details: JSON.stringify(sweepResults),
    user: "system_trigger"
  });

  Logger.log("Archive sweep complete: " + JSON.stringify(sweepResults));
  return sweepResults;
}

/**
 * Handles archive search queries on-demand without loading entire archive on
 * startup. Searches archived_records (the sweep's and the manual Archive
 * button's shared destination — see the file header above) + any legacy
 * dated "<collection>_Archive_<year>" sheets from before that unification —
 * AND, when searching testRecords, also the RAW "testRecords" sheet itself
 * for rows that have aged out of the app's normal ~1-year "active window"
 * (see isWithinActiveWindow_ / the listActive/multiList cutoff in Code.gs)
 * but aren't (yet, or ever going to be, if still unreleased) in
 * archived_records — either because the daily sweep hasn't run since, or
 * because the record isn't fully Released yet and so is never eligible for
 * the sweep at all. Those are tagged `_notYetArchived: true` so the UI can
 * show that distinction and offer to bring them back into the active list
 * (or, if actually done, file them into Archive right away instead of
 * waiting for the next sweep). De-duplicated by id against whatever
 * archived_records/a legacy dated sheet already has.
 *
 * `sampleId`/`clientName` also match against the Reference (Tracking No. /
 * Organization / Client Name) of the sample(s) a record covers — resolved
 * via a samples/references join, done lazily (only once, only if a search
 * actually asks for it) so a plain date-only search doesn't pay for it.
 */
function handleArchiveQuery_(params) {
  const { collection, year, dateFrom, dateTo, keyword, sampleId, clientName, parameter, subBatch } = params || {};
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

  // sample.id -> sample, and reference.id -> reference — built once per
  // search, only the first time a filter actually needs to resolve a
  // Reference (Tracking No./Organization/Client) for a record that doesn't
  // already carry its own archivedSampleSnapshots (i.e. a not-yet-archived
  // raw testRecord).
  let sampleById = null, referenceById = null;
  function ensureJoinTables_() {
    if (sampleById) return;
    sampleById = {};
    (readAllRows_("samples") || []).forEach(s => { sampleById[s.id] = s; });
    referenceById = {};
    (readAllRows_("references") || []).forEach(r => { referenceById[r.id] = r; });
  }
  function referenceTextFor_(rec) {
    const ids = rec.memberSampleIds && rec.memberSampleIds.length ? rec.memberSampleIds : rec.sampleId ? [rec.sampleId] : [];
    if (!ids.length) return "";
    ensureJoinTables_();
    return ids.map(id => {
      const sample = sampleById[id];
      const ref = sample && referenceById[sample.referenceId];
      return [sample && sample.clientName, sample && sample.sampleCode, ref && ref.trackingNo, ref && ref.organizationName, ref && ref.contactPerson].filter(Boolean).join(" ");
    }).join(" ");
  }

  function matchesFilters_(r) {
    const recDate = r.date || r.receivedAt || r.createdAt || "";
    if (dateFrom && recDate < dateFrom) return false;
    if (dateTo && recDate > dateTo) return false;
    if (subBatch && subBatch.trim()) {
      const needle = String(subBatch).trim().toLowerCase();
      if (!String(r.subBatchLabel || "").toLowerCase().includes(needle)) return false;
    }
    if (parameter && parameter.trim()) {
      const needle = String(parameter).trim().toLowerCase();
      const allResultNames = (r.results || []).concat((r.memberResults || []).flatMap(m => m.results || [])).map(res => res.name || "");
      const hit = String(r.testTypeName || "").toLowerCase().includes(needle) || allResultNames.some(n => n.toLowerCase().includes(needle));
      if (!hit) return false;
    }
    if (sampleId && sampleId.trim()) {
      const needle = String(sampleId).trim().toLowerCase();
      const snapCodes = (r.archivedSampleSnapshots || []).map(s => s.sampleCode || "").join(" ");
      const memberIds = (r.memberSampleIds || []).join(" ");
      const hay = String((r.sampleCode || "") + " " + snapCodes + " " + memberIds).toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (clientName && clientName.trim()) {
      const needle = String(clientName).trim().toLowerCase();
      const snapNames = (r.archivedSampleSnapshots || []).map(s => s.clientName || "").join(" ");
      // Legacy archived rows already snapshot a clientName; a raw,
      // not-yet-archived testRecord has none, so fall back to the live
      // sample -> reference join for those.
      const refText = snapNames.trim() ? "" : referenceTextFor_(r);
      const hay = String(snapNames + " " + refText).toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (keyword) {
      const kw = String(keyword).toLowerCase();
      if (!JSON.stringify(r).toLowerCase().includes(kw)) return false;
    }
    return true;
  }

  const results = [];
  const seenIds = new Set();
  targetSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    const rows = readAllRows_(sheetName);
    rows.forEach(r => {
      if (!matchesFilters_(r)) return;
      seenIds.add(r.id);
      results.push(Object.assign({}, r, { _archiveSheet: sheetName }));
    });
  });

  if (!collection || collection === "testRecords") {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const graceDays = getArchiveSettings_().restoreGraceDays;
    (readAllRows_("testRecords") || []).forEach(r => {
      if (seenIds.has(r.id)) return;
      if (isWithinActiveWindow_(r, cutoffStr, graceDays)) return; // still inside the normal active window (incl. restore grace period) — not this search's job
      if (!matchesFilters_(r)) return;
      results.push(Object.assign({}, r, { _notYetArchived: true }));
    });
  }

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
  // See getArchiveSettings_()/ARCHIVE_SETTINGS_DEFAULTS.restoreGraceDays
  // above — this is what protects a just-restored record (whose own `date`
  // may still be very old) from immediately dropping out of the active
  // window again or being swept straight back into Archive on the next
  // daily run.
  clean.restoredAt = new Date().toISOString();

  upsertRow_("testRecords", clean);

  if (targetSheetName) {
    removeRow_(targetSheetName, id);
  }

  return clean;
}
