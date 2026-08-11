// ===== 01-data-service.js =====
// ============================================================================
// DATA SERVICE — the ONE place that knows how to read/write data.
//
// Why this exists: you told me the deployment target is GitHub Pages (static
// front-end) + Google Apps Script (backend). Every other module in this app
// should never call localStorage or fetch() directly for anything new — they
// call DataService.list/save/remove/appendAudit, and DataService decides
// where that data actually lives.
//
// Today: mode "local" — plain localStorage, zero setup, works offline.
// Later: mode "gas" — every call becomes an HTTP request to your Apps Script
//        Web App (see /gas-backend/Code.gs for the matching server code).
// Flipping the switch is a Settings-screen toggle, not a rewrite: nothing
// that calls DataService needs to change.
//
// IMPORTANT — this file currently backs the new Sample Lifecycle module
// (20-sample-model.js / 21-sample-ui.js), the audit log, and the Archive
// system's "archived_records" collection (18-archive-ui.js). Chemicals, Test
// Types, Test Records, Equipment, Glassware and Gas still use the original
// V14 localStorage mechanism (06-legacy-storage.js) so nothing about your
// existing workflows changes in this phase. Migrating them onto DataService
// is a mechanical follow-up (swap loadKey/saveKey for DataService.list/
// bulkSet in 99-app.js) — flagged in README.md as the next phase.
// ============================================================================

const DataService = (() => {
  const CONFIG_KEY = "lims_backend_config";
  // Hardcoded default backend — every browser/device starts pointed at this
  // shared Google Apps Script Web App out of the box, so nobody has to open
  // Settings ▸ Backend Settings and paste the URL/token manually. Users can
  // still override via that screen (saved to their own localStorage), which
  // takes priority over these defaults.
  const DEFAULT_CONFIG = {
    mode: "gas",
    gasUrl: "https://script.google.com/macros/s/AKfycbyKiOeHtZSismoRIgx2w87d6ruL-Blvj9PlDH0L13EeE0as4PQ5QFv40AdcCyDcP5UdHQ/exec",
    token: "Dphe_Zonal_Lab"
  };
  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : { ...DEFAULT_CONFIG };
    } catch (e) {
      reportStorageError("load", "backend config", e);
      return { ...DEFAULT_CONFIG };
    }
  }
  let config = loadConfig();
  function configure(next) {
    config = {
      ...config,
      ...next
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return config;
  }
  function getConfig() {
    return {
      ...config
    };
  }

  // ---- local (localStorage) backend ----
  function localKey(collection) {
    return `lims_${collection}`;
  }
  function localList(collection) {
    try {
      const raw = localStorage.getItem(localKey(collection));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      reportStorageError("load", collection, e);
      return [];
    }
  }
  function localWriteAll(collection, arr) {
    localStorage.setItem(localKey(collection), JSON.stringify(arr));
    return arr;
  }
  function localSave(collection, record) {
    const arr = localList(collection);
    const idx = arr.findIndex(r => r.id === record.id);
    const stamped = {
      ...record,
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) arr[idx] = stamped;else arr.push(stamped);
    localWriteAll(collection, arr);
    return stamped;
  }
  function localRemove(collection, id) {
    const arr = localList(collection).filter(r => r.id !== id);
    localWriteAll(collection, arr);
  }

  // ---- Google Apps Script backend ----
  // Reads use GET (?action=list&collection=...) and writes use POST with a
  // text/plain body (NOT application/json). Both choices are deliberate:
  // Apps Script Web Apps don't answer CORS pre-flight (OPTIONS) requests, so
  // every request from the browser must qualify as a CORS "simple request".
  // GET-with-query-string and POST-with-text/plain both qualify; a POST with
  // Content-Type: application/json would silently fail in the browser.
  async function gasCall(action, {
    collection,
    payload
  } = {}) {
    const {
      gasUrl,
      token
    } = config;
    if (!gasUrl) throw new Error("Google Apps Script URL is not configured (Settings → Backend).");
    if (action === "list" || action === "ping") {
      const qs = new URLSearchParams({
        action,
        collection: collection || "",
        token: token || ""
      });
      const res = await fetch(`${gasUrl}?${qs.toString()}`, {
        method: "GET"
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json.data;
    }
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        collection,
        payload,
        token
      })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data;
  }

  // ---- public, backend-agnostic API ----
  async function list(collection) {
    return config.mode === "gas" ? gasCall("list", {
      collection
    }) : localList(collection);
  }
  async function save(collection, record) {
    const withId = record.id ? record : {
      ...record,
      id: uid(collection.slice(0, 4))
    };
    return config.mode === "gas" ? gasCall("save", {
      collection,
      payload: withId
    }) : localSave(collection, withId);
  }
  async function remove(collection, id) {
    return config.mode === "gas" ? gasCall("remove", {
      collection,
      payload: {
        id
      }
    }) : localRemove(collection, id);
  }
  async function bulkSet(collection, arr) {
    return config.mode === "gas" ? gasCall("bulkSet", {
      collection,
      payload: arr
    }) : localWriteAll(collection, arr);
  }
  async function appendAudit(entry) {
    const stamped = {
      id: uid("aud"),
      ts: new Date().toISOString(),
      ...entry
    };
    return config.mode === "gas" ? gasCall("appendAudit", {
      collection: "auditLog",
      payload: stamped
    }) : localSave("auditLog", stamped);
  }
  async function getAudit(filterFn) {
    const all = await list("auditLog");
    return filterFn ? all.filter(filterFn) : all;
  }
  async function ping() {
    if (config.mode !== "gas") return {
      ok: true,
      mode: "local"
    };
    return gasCall("ping", {});
  }

  // ---- Singleton Helpers (for labIdentity, permissionMatrix, masterChemicals) ----
  async function getSingleton(collection) {
    const arr = await list(collection);
    return arr && arr.length ? arr[0] : null;
  }
  async function saveSingleton(collection, data) {
    return save(collection, { id: "singleton", ...data });
  }

  // ---- Archiving (Test Records → archived_records) --------------------
  // Completed test records are snapshotted and archived into archived_records.
  async function archiveTestRecord(recordId, opts = {}) {
    const testRecordsArr = opts.testRecords || (await list("testRecords"));
    const record = testRecordsArr.find(r => r.id === recordId);
    if (!record) throw new Error(`Test record "${recordId}" was not found — it may already be archived.`);
    const samplesArr = opts.samples || (await list("samples"));
    const sampleIds = record.memberSampleIds && record.memberSampleIds.length ? record.memberSampleIds : record.sampleId ? [record.sampleId] : [];
    const archivedSampleSnapshots = sampleIds.map(id => (samplesArr || []).find(s => s.id === id)).filter(Boolean);
    const archivedRecord = {
      ...record,
      archivedAt: new Date().toISOString(),
      archivedSampleSnapshots
    };
    await save("archived_records", archivedRecord);
    await bulkSet("testRecords", testRecordsArr.filter(r => r.id !== recordId));
    return archivedRecord;
  }
  // Matches an archived record against optional search filters. All filters
  // are AND-ed together; an unset filter is simply skipped. sampleId and
  // clientName match against the snapshot(s) taken at archive time (falling
  // back to the record's own legacy sampleCode field for pre-Sub-Batch
  // records); parameter matches either the test type's name or any one of
  // the record's individual result parameter names.
  function matchesArchiveQuery(rec, filters) {
    const f = filters || {};
    if (f.dateFrom && (rec.date || "") < f.dateFrom) return false;
    if (f.dateTo && (rec.date || "") > f.dateTo) return false;
    const snaps = rec.archivedSampleSnapshots || [];
    if (f.sampleId && f.sampleId.trim()) {
      const needle = f.sampleId.trim().toLowerCase();
      const hit = snaps.some(s => (s.sampleCode || "").toLowerCase().includes(needle)) || (rec.sampleCode || "").toLowerCase().includes(needle);
      if (!hit) return false;
    }
    if (f.clientName && f.clientName.trim()) {
      const needle = f.clientName.trim().toLowerCase();
      const hit = snaps.some(s => (s.clientName || "").toLowerCase().includes(needle));
      if (!hit) return false;
    }
    if (f.parameter && f.parameter.trim()) {
      const needle = f.parameter.trim().toLowerCase();
      const allResultNames = (rec.results || []).concat((rec.memberResults || []).flatMap(m => m.results || [])).map(res => res.name || "");
      const hit = (rec.testTypeName || "").toLowerCase().includes(needle) || allResultNames.some(n => n.toLowerCase().includes(needle));
      if (!hit) return false;
    }
    return true;
  }
  // On-demand fetch — intentionally the ONLY way archived data enters memory.
  // Nothing in the app's initial load calls this; it only runs when the
  // Archive screen itself asks for it, and only for what a search actually
  // matches, so the active appState stays exactly as light as it is today.
  async function fetchArchivedRecords(queryFilters) {
    if (config.mode === "gas") {
      try {
        const params = { action: "archiveQuery", token: config.token || "", ...queryFilters };
        const qs = new URLSearchParams(params);
        const res = await fetch(`${config.gasUrl}?${qs.toString()}`);
        const json = await res.json();
        if (!json.error && json.data) return json.data;
      } catch (e) {
        console.warn("GAS archiveQuery failed, falling back to full list filter:", e);
      }
    }
    const all = await list("archived_records");
    return all.filter(rec => matchesArchiveQuery(rec, queryFilters));
  }
  async function restoreRecord(recordId, recordObj) {
    if (config.mode === "gas") {
      try {
        const restored = await gasCall("restoreRecord", {
          payload: { id: recordId, archiveSheet: recordObj?._archiveSheet }
        });
        if (restored) return restored;
      } catch (e) {
        console.warn("GAS restoreRecord endpoint call failed, attempting client-side restore fallback:", e);
      }
    }
    const archived = await list("archived_records");
    let record = archived.find(r => r.id === recordId) || recordObj;
    if (!record) throw new Error(`Archived record "${recordId}" was not found.`);
    const {
      archivedAt,
      archivedSampleSnapshots,
      _archiveSheet,
      ...restored
    } = record;
    const testRecordsArr = await list("testRecords");
    if (!testRecordsArr.some(r => r.id === recordId)) {
      await bulkSet("testRecords", [...testRecordsArr, restored]);
    }
    await remove("archived_records", recordId);
    return restored;
  }

  async function listActive(collection) {
    if (config.mode === "gas") {
      try {
        return await gasCall("listActive", { collection });
      } catch (e) {
        console.warn("listActive failed on GAS, falling back to full list:", e);
      }
    }
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const all = await list(collection);
    return all.filter(r => !r.date || r.date >= cutoffStr);
  }

  return {
    configure,
    getConfig,
    list,
    listActive,
    save,
    remove,
    bulkSet,
    getSingleton,
    saveSingleton,
    appendAudit,
    getAudit,
    ping,
    archiveTestRecord,
    fetchArchivedRecords,
    restoreRecord,
    // Escape hatch for custom, non-CRUD actions implemented server-side
    // (see gas-backend/Code.gs) — e.g. the Data Backup module's
    // getBackupConfig/configureBackup/backupNow. Only meaningful in "gas"
    // mode; throws the same "not configured" error gasCall already throws
    // otherwise, so callers can just try/catch.
    gasRawCall: (action, opts) => gasCall(action, opts)
  };
})();

// ---- Settings UI: point the app at your Google Apps Script Web App -------
function BackendSettingsModal({
  onClose,
  notify
}) {
  const [cfg, setCfg] = React.useState(DataService.getConfig());
  const [testing, setTesting] = React.useState(false);
  async function save() {
    DataService.configure(cfg);
    notify?.("Backend settings saved. Reload the page to apply.", "ok");
    onClose();
  }
  async function testConnection() {
    setTesting(true);
    const prevCfg = DataService.getConfig();
    DataService.configure(cfg); // temporarily apply so ping() uses the fields being tested
    try {
      const res = await DataService.ping();
      notify?.(res.ok ? "Connected successfully." : "No response — check the URL.", res.ok ? "ok" : "warn");
    } catch (e) {
      notify?.(`Connection failed: ${e.message}`, "warn");
    } finally {
      DataService.configure(prevCfg);
      setTesting(false);
    }
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Backend Settings",
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3",
    style: {
      color: C.muted
    }
  }, "This app is pre-configured to use the shared Google Apps Script backend — data is shared across every device/browser automatically, nothing to set up. Only change these fields if you're pointing the app at a different Apps Script deployment."), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Storage mode",
    value: cfg.mode,
    onChange: v => setCfg({
      ...cfg,
      mode: v
    }),
    options: [{
      value: "local",
      label: "Local (this browser only)"
    }, {
      value: "gas",
      label: "Google Apps Script (shared)"
    }]
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Shared secret / token",
    value: cfg.token,
    onChange: v => setCfg({
      ...cfg,
      token: v
    }),
    placeholder: "matches API_TOKEN in Code.gs"
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Apps Script Web App URL",
    value: cfg.gasUrl,
    onChange: v => setCfg({
      ...cfg,
      gasUrl: v
    }),
    placeholder: "https://script.google.com/macros/s/XXXXX/exec"
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 flex justify-between items-center"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: testConnection,
    disabled: testing || cfg.mode !== "gas"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "link",
    size: 12
  }), testing ? "Testing…" : "Test Connection"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: save
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Save"))));
}

// ---- Lab Identity (letterhead) — set once per office, used by the Custom
// Report Generator so this same app can be reused by any DPHE Zonal Lab
// without hardcoding one office's letterhead. Stored locally (or via
// DataService in future if that's wired up); read with getLabIdentity(). ----
function getLabIdentity() {
  return loadKey("labIdentity", {
    orgLine1: "Government of the People's Republic of Bangladesh",
    orgLine2: "Office of the Senior Chemist",
    orgLine3: "Department of Public Health Engineering (DPHE)",
    labName: "",
    phone: "",
    email: "",
    leftLogoDataUrl: "",
    rightLogoDataUrl: "",
    leftLogoUrl: "assets/logo_left.png",
    rightLogoUrl: "assets/logo_right.png"
  });
}
function saveLabIdentity(identity) {
  saveKey("labIdentity", identity);
}
function LabIdentityModal({
  onClose,
  notify
}) {
  const [id_, setId] = React.useState(getLabIdentity());
  function handleLogo(side, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setId(prev => ({
      ...prev,
      [side]: reader.result
    }));
    reader.readAsDataURL(file);
  }
  function save() {
    saveLabIdentity(id_);
    notify?.("Lab identity saved. It will now appear on generated reports.", "ok");
    onClose();
  }
  const effectiveLeftLogo = id_.leftLogoDataUrl || id_.leftLogoUrl || "assets/logo_left.png";
  const effectiveRightLogo = id_.rightLogoDataUrl || id_.rightLogoUrl || "assets/logo_right.png";

  return /*#__PURE__*/React.createElement(Modal, {
    title: "Lab Identity (Report Letterhead)",
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3",
    style: {
      color: C.muted
    }
  }, "Set this once per lab/office. It's used as the header on every generated report — so this same app can be reused by any Zonal Lab, each with its own letterhead."), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Header line 1",
    value: id_.orgLine1,
    onChange: v => setId({
      ...id_,
      orgLine1: v
    }),
    placeholder: "Government of the People's Republic of Bangladesh"
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Header line 2",
    value: id_.orgLine2,
    onChange: v => setId({
      ...id_,
      orgLine2: v
    }),
    placeholder: "Office of the Senior Chemist"
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Header line 3",
    value: id_.orgLine3,
    onChange: v => setId({
      ...id_,
      orgLine3: v
    }),
    placeholder: "Department of Public Health Engineering (DPHE)"
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Lab name / address",
    value: id_.labName,
    onChange: v => setId({
      ...id_,
      labName: v
    }),
    placeholder: "e.g. Rangpur Zonal Lab, Radha Ballob, Rangpur."
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Phone",
    value: id_.phone,
    onChange: v => setId({
      ...id_,
      phone: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Email",
    value: id_.email,
    onChange: v => setId({
      ...id_,
      email: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 font-semibold text-xs border-t pt-3"
  }, "Report Letterhead Logos (GitHub Repo / Remote URLs or Custom Upload)"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-4 mt-2"
  }, /*#__PURE__*/React.createElement("div", { className: "flex flex-col gap-2 p-2.5 rounded border" },
    /*#__PURE__*/React.createElement("span", { className: "text-xs font-medium" }, "Left Logo (e.g. National Emblem)"),
    /*#__PURE__*/React.createElement(TextField, {
      simple: true,
      label: "GitHub Repo / URL Path",
      value: id_.leftLogoUrl || "",
      onChange: v => setId({ ...id_, leftLogoUrl: v }),
      placeholder: "assets/logo_left.png"
    }),
    /*#__PURE__*/React.createElement("label", { className: "text-[11px] text-gray-500 flex flex-col gap-1" },
      "Or upload custom image file:",
      /*#__PURE__*/React.createElement("input", {
        type: "file",
        accept: "image/*",
        onChange: e => handleLogo("leftLogoDataUrl", e.target.files[0])
      })
    ),
    id_.leftLogoDataUrl && /*#__PURE__*/React.createElement(Button, {
      size: "xs",
      variant: "outline",
      onClick: () => setId(prev => ({ ...prev, leftLogoDataUrl: "" }))
    }, "Clear Uploaded File"),
    effectiveLeftLogo && /*#__PURE__*/React.createElement("div", { className: "mt-1 flex items-center gap-2 text-xs" },
      /*#__PURE__*/React.createElement("span", null, "Preview:"),
      /*#__PURE__*/React.createElement("img", { src: effectiveLeftLogo, style: { height: 36, objectFit: "contain" }, onError: e => e.target.style.display='none' })
    )
  ), /*#__PURE__*/React.createElement("div", { className: "flex flex-col gap-2 p-2.5 rounded border" },
    /*#__PURE__*/React.createElement("span", { className: "text-xs font-medium" }, "Right Logo (e.g. DPHE Logo)"),
    /*#__PURE__*/React.createElement(TextField, {
      simple: true,
      label: "GitHub Repo / URL Path",
      value: id_.rightLogoUrl || "",
      onChange: v => setId({ ...id_, rightLogoUrl: v }),
      placeholder: "assets/logo_right.png"
    }),
    /*#__PURE__*/React.createElement("label", { className: "text-[11px] text-gray-500 flex flex-col gap-1" },
      "Or upload custom image file:",
      /*#__PURE__*/React.createElement("input", {
        type: "file",
        accept: "image/*",
        onChange: e => handleLogo("rightLogoDataUrl", e.target.files[0])
      })
    ),
    id_.rightLogoDataUrl && /*#__PURE__*/React.createElement(Button, {
      size: "xs",
      variant: "outline",
      onClick: () => setId(prev => ({ ...prev, rightLogoDataUrl: "" }))
    }, "Clear Uploaded File"),
    effectiveRightLogo && /*#__PURE__*/React.createElement("div", { className: "mt-1 flex items-center gap-2 text-xs" },
      /*#__PURE__*/React.createElement("span", null, "Preview:"),
      /*#__PURE__*/React.createElement("img", { src: effectiveRightLogo, style: { height: 36, objectFit: "contain" }, onError: e => e.target.style.display='none' })
    )
  )), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: save
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Save")));
}
