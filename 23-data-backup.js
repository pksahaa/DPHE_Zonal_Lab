// ===== 23-data-backup.js =====
// ============================================================================
// DATA BACKUP — Settings → Data Backup
//
// Three independent pieces, deliberately kept separate because they have
// different honest capabilities:
//
// 1. MANUAL BACKUP (works always, either backend mode). A single "Download
//    Backup Now" button bundles every collection this app actually keeps —
//    both the legacy localStorage modules (Chemicals, Test Types, Test
//    Records, Equipment, Glassware, Gas, Parameters, Users, Permission
//    Matrix, Sub-Batches, Lab Identity) AND the newer DataService-backed
//    modules (Samples, References, Audit Log) — into one timestamped .json
//    file and downloads it straight to your computer. Nothing leaves the
//    browser; no backend required.
//
// 2. AUTOMATIC EMAIL BACKUP (requires the Google Apps Script backend — see
//    /gas-backend). Sending an email on a schedule and deleting the
//    previous one are both things that need a server that's alive even when
//    nobody has this page open — a browser tab can't do either reliably.
//    So this piece is owned entirely by gas-backend/Code.gs: a Script time
//    trigger checks daily whether the configured interval has elapsed,
//    emails a fresh export as an attachment to whatever address is
//    configured, and trashes the previous backup email it sent. Because the
//    legacy localStorage modules never touch the backend today (see the
//    note at the top of 06-legacy-storage.js / 01-data-service.js), this
//    modal also offers "Sync data to backend now", which pushes those
//    collections up via DataService.bulkSet so the backend actually has
//    something current to email. Saving the schedule runs that sync once
//    automatically; for the automatic runs to stay fresh, sync again from
//    time to time (or once Phase-2 migrates those modules onto DataService
//    directly — see README.md — every save syncs itself).
//
// 3. AUTO-ARCHIVE (age-based). Fully client-side, works in any backend
//    mode, no server required — it only ever touches the ACTIVE testRecords
//    array (never reads archived_records, so it can never slow the app
//    down the way scanning the whole archive would). Once a day, on app
//    load, it checks a configurable "archive completed records older than
//    N days" threshold and archives whatever now qualifies, reusing the
//    exact same DataService.archiveTestRecord() path the manual "Archive"
//    button in Test Records already uses. The manual per-record and
//    bulk-select Archive actions in Test Records (13-testrecords-ui.js)
//    keep working exactly as before — this only adds an automatic sweep on
//    top, it doesn't replace anything.
// ============================================================================

// ---------------- Manual full-data backup ----------------
const LEGACY_BACKUP_COLLECTIONS = [
  { key: "chemicals", label: "Chemicals" },
  { key: "masterChemicals", label: "Master Chemical List" },
  { key: "glassware", label: "Glassware" },
  { key: "equipment", label: "Equipment" },
  { key: "gasInventory", label: "Gas" },
  { key: "parameters", label: "Parameters" },
  { key: "testTypes", label: "Test Types" },
  { key: "testRecords", label: "Test Records" },
  { key: "subBatches", label: "Analytical Batches" },
  { key: "users", label: "Users" },
  { key: "permissionMatrix", label: "Permission Matrix" },
  { key: "labIdentity", label: "Lab Identity / Letterhead" }
];
// DataService-backed collections. archived_records is deliberately last and
// separately labeled — it's the one collection that can genuinely be large,
// so the UI makes including it an explicit, visible choice rather than a
// silent default (see the "Include archived records" checkbox below).
const BACKEND_BACKUP_COLLECTIONS = [
  { key: "samples", label: "Samples" },
  { key: "references", label: "References" },
  { key: "auditLog", label: "Audit Log" }
];

async function collectFullBackupBundle({ includeArchived } = {}) {
  const bundle = {
    schema: "aqualab-full-backup-v1",
    exportedAt: new Date().toISOString(),
    collections: {}
  };
  LEGACY_BACKUP_COLLECTIONS.forEach(({ key }) => {
    bundle.collections[key] = loadKey(key, key === "labIdentity" ? {} : []);
  });
  for (const { key } of BACKEND_BACKUP_COLLECTIONS) {
    try {
      bundle.collections[key] = await DataService.list(key);
    } catch {
      bundle.collections[key] = [];
    }
  }
  if (includeArchived) {
    try {
      bundle.collections.archived_records = await DataService.list("archived_records");
    } catch {
      bundle.collections.archived_records = [];
    }
  }
  return bundle;
}
async function downloadBackupNow({ includeArchived, notify } = {}) {
  const bundle = await collectFullBackupBundle({ includeArchived });
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.download = `dphe_lims_backup_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  notify?.("Backup downloaded.", "ok");
}
// Pushes every legacy (localStorage-only) collection up to the configured
// GAS backend via DataService.bulkSet, so a server-side scheduled backup
// actually has something current to email. No-op (with a warning) unless
// the backend mode is "gas".
async function syncLegacyToBackend(notify) {
  if (DataService.getConfig().mode !== "gas") {
    notify?.("Connect the Google Apps Script backend first (Settings → Backend Settings).", "warn");
    return false;
  }
  for (const { key } of LEGACY_BACKUP_COLLECTIONS) {
    if (key === "labIdentity") continue; // single object, not an array — bulkSet expects a list
    const data = loadKey(key, []);
    if (Array.isArray(data) && data.length) {
      try {
        await DataService.bulkSet(key, data);
      } catch (e) {
        notify?.(`Sync failed for "${key}": ${e.message}`, "warn");
        return false;
      }
    }
  }
  notify?.("Local data synced to the backend.", "ok");
  return true;
}

// ---------------- Automatic email backup (GAS-driven) ----------------
// Config itself lives server-side (Script Properties, via configureBackup /
// getBackupConfig in gas-backend/Code.gs) so it keeps working whether or
// not this browser tab is ever open again — the schedule is owned by the
// Apps Script time trigger, not by anything running here.
async function getAutoBackupConfig() {
  if (DataService.getConfig().mode !== "gas") return null;
  return DataService.gasRawCall("getBackupConfig", {});
}
async function saveAutoBackupConfig(cfg) {
  return DataService.gasRawCall("configureBackup", { payload: cfg });
}
async function sendBackupNowViaBackend() {
  return DataService.gasRawCall("backupNow", {});
}

// ---------------- Auto-archive (age-based, client-side) ----------------
function getAutoArchiveConfig() {
  return loadKey("autoArchiveConfig", { enabled: false, afterDays: 90, lastSweepAt: "" });
}
function saveAutoArchiveConfig(cfg) {
  saveKey("autoArchiveConfig", cfg);
}
function daysBetween(dateStr) {
  if (!dateStr) return Infinity;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}
// Runs at most once per calendar day (tracked via lastSweepAt). Only ever
// reads the active testRecords/samples/subBatches already in memory and
// archived_records is never touched for the age check itself — the same
// "archive is on-demand only" rule the rest of the app follows (see
// 18-archive-ui.js and DataService.fetchArchivedRecords).
async function runAutoArchiveSweepIfDue({ testRecords, samples, subBatches, setTestRecords, session, notify }) {
  const cfg = getAutoArchiveConfig();
  if (!cfg.enabled) return;
  const today = todayStr();
  if (cfg.lastSweepAt === today) return; // already ran today
  const dueDate = todayStr();
  saveAutoArchiveConfig({ ...cfg, lastSweepAt: dueDate }); // mark run first — never re-attempt mid-failure in a tight loop
  const eligible = (testRecords || []).filter(r => isTestRecordArchivable(r, samples, testRecords, subBatches) && daysBetween(r.date) >= Number(cfg.afterDays || 90));
  if (eligible.length === 0) return;
  let archivedCount = 0;
  for (const rec of eligible) {
    try {
      await DataService.archiveTestRecord(rec.id, { samples });
      archivedCount++;
    } catch {
      // Leave it for the next sweep (or manual archive) rather than blocking the rest.
    }
  }
  if (archivedCount > 0) {
    setTestRecords(prev => prev.filter(r => !eligible.some(e => e.id === r.id)));
    DataService.appendAudit({
      entity: "testRecord",
      entityId: eligible.map(r => r.id).join(","),
      action: "archive",
      user: session?.username,
      role: session?.role,
      note: `Auto-archived ${archivedCount} record(s) older than ${cfg.afterDays} day(s)`
    });
    notify?.(`Auto-archive: moved ${archivedCount} completed record(s) older than ${cfg.afterDays} days into the Archive.`, "ok");
  }
}
// One-off, manual "run the sweep right now regardless of when it last ran" —
// the "manual option should also exist" half of the request, separate from
// the per-record/bulk Archive buttons that already live in Test Records.
async function runAutoArchiveSweepNow(args) {
  const cfg = getAutoArchiveConfig();
  saveAutoArchiveConfig({ ...cfg, lastSweepAt: "" }); // force it to run even if it already ran today
  await runAutoArchiveSweepIfDue(args);
}

// ---------------- Settings UI ----------------
function DataBackupSettingsModal({ onClose, notify, testRecords, samples, subBatches, setTestRecords, session }) {
  const backendMode = DataService.getConfig().mode;
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [sendingNow, setSendingNow] = React.useState(false);
  const [loadingCfg, setLoadingCfg] = React.useState(backendMode === "gas");
  const [backupCfg, setBackupCfg] = React.useState({ enabled: false, email: "", frequencyDays: 7 });
  const [savingBackupCfg, setSavingBackupCfg] = React.useState(false);
  const [archiveCfg, setArchiveCfg] = React.useState(getAutoArchiveConfig());
  const [sweeping, setSweeping] = React.useState(false);

  React.useEffect(() => {
    if (backendMode !== "gas") { setLoadingCfg(false); return; }
    getAutoBackupConfig().then(cfg => {
      if (cfg) setBackupCfg({ enabled: !!cfg.enabled, email: cfg.email || "", frequencyDays: cfg.frequencyDays || 7 });
    }).catch(() => {}).finally(() => setLoadingCfg(false));
  }, [backendMode]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadBackupNow({ includeArchived, notify });
    } catch (e) {
      notify?.(`Backup failed: ${e.message}`, "warn");
    } finally {
      setDownloading(false);
    }
  }
  async function handleSync() {
    setSyncing(true);
    try {
      await syncLegacyToBackend(notify);
    } finally {
      setSyncing(false);
    }
  }
  async function handleSaveBackupCfg() {
    if (backupCfg.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupCfg.email.trim())) {
      notify?.("Enter a valid email address first.", "warn");
      return;
    }
    setSavingBackupCfg(true);
    try {
      await saveAutoBackupConfig(backupCfg);
      await syncLegacyToBackend(); // best-effort refresh so the very first scheduled run isn't empty
      notify?.("Automatic email backup settings saved.", "ok");
    } catch (e) {
      notify?.(`Couldn't save: ${e.message}`, "warn");
    } finally {
      setSavingBackupCfg(false);
    }
  }
  async function handleSendNow() {
    setSendingNow(true);
    try {
      await syncLegacyToBackend();
      await sendBackupNowViaBackend();
      notify?.(`Backup email sent to ${backupCfg.email || "the configured address"}.`, "ok");
    } catch (e) {
      notify?.(`Couldn't send backup email: ${e.message}`, "warn");
    } finally {
      setSendingNow(false);
    }
  }
  function handleSaveArchiveCfg() {
    saveAutoArchiveConfig(archiveCfg);
    notify?.("Auto-archive settings saved.", "ok");
  }
  async function handleSweepNow() {
    setSweeping(true);
    try {
      await runAutoArchiveSweepNow({ testRecords, samples, subBatches, setTestRecords, session, notify });
    } catch (e) {
      notify?.(`Sweep failed: ${e.message}`, "warn");
    } finally {
      setArchiveCfg(getAutoArchiveConfig());
      setSweeping(false);
    }
  }

  return /*#__PURE__*/React.createElement(Modal, {
    title: "Data Backup",
    onClose,
    wide: true
  },
  // ---- 1. Manual backup ----
  /*#__PURE__*/React.createElement(SectionCard, {
    title: "Manual Backup",
    icon: /*#__PURE__*/React.createElement(Icon, { name: "download", size: 15, color: C.teal })
  },
  /*#__PURE__*/React.createElement("div", { className: "text-xs mb-2", style: { color: C.muted } },
    "Downloads every collection this app keeps — Chemicals, Test Types, Test Records, Inventory, Parameters, Users, Samples, References, Audit Log, and more — as one .json file to your computer. Works right now, in either backend mode."),
  /*#__PURE__*/React.createElement("label", { className: "flex items-center gap-1.5 text-xs mb-2", style: { color: C.muted } },
    /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: includeArchived,
      onChange: e => setIncludeArchived(e.target.checked)
    }), "Include archived records (can be large — slower to prepare)"),
  /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: handleDownload,
    disabled: downloading
  }, /*#__PURE__*/React.createElement(Icon, { name: "download", size: 13 }), downloading ? "Preparing…" : "Download Backup Now")),

  // ---- 2. Automatic email backup ----
  /*#__PURE__*/React.createElement("div", { className: "mt-4" },
  /*#__PURE__*/React.createElement(SectionCard, {
    title: "Automatic Email Backup",
    icon: /*#__PURE__*/React.createElement(Icon, { name: "mail", size: 15, color: C.teal })
  },
  backendMode !== "gas" ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: { background: C.warnBg, color: C.warn }
  }, "Requires the Google Apps Script backend. Connect it first in Settings → Backend Settings, deploy ", /*#__PURE__*/React.createElement("code", null, "/gas-backend/Code.gs"), " (see its README), then come back here.") :
  loadingCfg ? /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Loading current schedule…") :
  /*#__PURE__*/React.createElement("div", { className: "flex flex-col gap-3" },
    /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } },
      "On the schedule below, the backend emails a fresh full export as an attachment to this address, then deletes the backup email it sent last time — only the newest one is ever kept in the inbox."),
    /*#__PURE__*/React.createElement("label", { className: "flex items-center gap-1.5 text-xs", style: { color: C.ink } },
      /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: backupCfg.enabled,
        onChange: e => setBackupCfg({ ...backupCfg, enabled: e.target.checked })
      }), "Enable automatic email backup"),
    /*#__PURE__*/React.createElement("div", { className: "grid grid-cols-2 gap-3" },
      /*#__PURE__*/React.createElement(TextField, {
        simple: true,
        label: "Send backup to (email)",
        type: "email",
        value: backupCfg.email,
        onChange: v => setBackupCfg({ ...backupCfg, email: v }),
        placeholder: "labmanager@dphe.gov.bd"
      }),
      /*#__PURE__*/React.createElement(SelectField, {
        simple: true,
        label: "How often",
        value: String(backupCfg.frequencyDays),
        onChange: v => setBackupCfg({ ...backupCfg, frequencyDays: Number(v) }),
        options: [
          { value: "1", label: "Every day" },
          { value: "7", label: "Every week" },
          { value: "14", label: "Every 2 weeks" },
          { value: "30", label: "Every month" }
        ]
      })),
    /*#__PURE__*/React.createElement("div", { className: "flex justify-between items-center mt-1" },
      /*#__PURE__*/React.createElement(Button, {
        variant: "outline",
        size: "sm",
        onClick: handleSync,
        disabled: syncing
      }, /*#__PURE__*/React.createElement(Icon, { name: "upload", size: 12 }), syncing ? "Syncing…" : "Sync Local Data to Backend"),
      /*#__PURE__*/React.createElement("div", { className: "flex gap-2" },
        /*#__PURE__*/React.createElement(Button, {
          variant: "outline",
          size: "sm",
          onClick: handleSendNow,
          disabled: sendingNow || !backupCfg.email
        }, sendingNow ? "Sending…" : "Send Backup Email Now"),
        /*#__PURE__*/React.createElement(Button, {
          size: "sm",
          onClick: handleSaveBackupCfg,
          disabled: savingBackupCfg
        }, /*#__PURE__*/React.createElement(Icon, { name: "check", size: 12 }), savingBackupCfg ? "Saving…" : "Save Schedule")))))),

  // ---- 3. Auto-archive (age-based) ----
  /*#__PURE__*/React.createElement("div", { className: "mt-4" },
  /*#__PURE__*/React.createElement(SectionCard, {
    title: "Auto-Archive",
    icon: /*#__PURE__*/React.createElement(Icon, { name: "archive", size: 15, color: C.teal })
  },
  /*#__PURE__*/React.createElement("div", { className: "text-xs mb-2", style: { color: C.muted } },
    "A fully-released Test Record older than the threshold below is moved into the Archive automatically, once a day, the same way the \"Archive\" button in Test Records already does it. Manual archiving (single or bulk-select, in Test Records) keeps working exactly as before — this only adds an automatic sweep on top. Archived data itself is never scanned by this or any background check — only the active Test Records list is."),
  /*#__PURE__*/React.createElement("label", { className: "flex items-center gap-1.5 text-xs mb-2", style: { color: C.ink } },
    /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: archiveCfg.enabled,
      onChange: e => setArchiveCfg({ ...archiveCfg, enabled: e.target.checked })
    }), "Enable automatic archiving"),
  /*#__PURE__*/React.createElement("div", { className: "flex items-end gap-3" },
    /*#__PURE__*/React.createElement(TextField, {
      simple: true,
      label: "Archive completed records older than (days)",
      type: "number",
      min: "1",
      value: String(archiveCfg.afterDays),
      onChange: v => setArchiveCfg({ ...archiveCfg, afterDays: v })
    }),
    /*#__PURE__*/React.createElement(Button, { size: "sm", onClick: handleSaveArchiveCfg },
      /*#__PURE__*/React.createElement(Icon, { name: "check", size: 12 }), "Save Threshold"),
    /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: handleSweepNow,
      disabled: sweeping || !testRecords
    }, /*#__PURE__*/React.createElement(Icon, { name: "archive", size: 12 }), sweeping ? "Sweeping…" : "Run Sweep Now")),
  /*#__PURE__*/React.createElement("div", { className: "text-xs mt-2", style: { color: C.muted } },
    archiveCfg.lastSweepAt ? `Last automatic sweep: ${archiveCfg.lastSweepAt}.` : "The automatic sweep hasn't run yet — it runs once per day, the next time the app is opened."))),

  /*#__PURE__*/React.createElement("div", { className: "flex justify-end mt-4" },
    /*#__PURE__*/React.createElement(Button, { variant: "outline", onClick: onClose }, "Close")));
}
