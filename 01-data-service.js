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
// IMPORTANT — this file currently backs ONLY the new Sample Lifecycle module
// (20-sample-model.js / 21-sample-ui.js) and the audit log. Chemicals, Test
// Types, Test Records, Equipment, Glassware and Gas still use the original
// V14 localStorage mechanism (06-legacy-storage.js) so nothing about your
// existing workflows changes in this phase. Migrating them onto DataService
// is a mechanical follow-up (swap loadKey/saveKey for DataService.list/
// bulkSet in 99-app.js) — flagged in README.md as the next phase.
// ============================================================================

const DataService = (() => {
  const CONFIG_KEY = "lims_backend_config";
  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : {
        mode: "local",
        gasUrl: "",
        token: ""
      };
    } catch {
      return {
        mode: "local",
        gasUrl: "",
        token: ""
      };
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
    } catch {
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
  return {
    configure,
    getConfig,
    list,
    save,
    remove,
    bulkSet,
    appendAudit,
    getAudit,
    ping
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
  }, "By default this app stores data in the browser (localStorage) — nothing to configure. To share data across devices/users, deploy the included Google Apps Script backend (see ", /*#__PURE__*/React.createElement("code", null, "/gas-backend/README.md"), ") and paste its Web App URL below."), /*#__PURE__*/React.createElement("div", {
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
    rightLogoDataUrl: ""
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
    className: "grid grid-cols-2 gap-3 mt-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "Left logo (e.g. national emblem)", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: e => handleLogo("leftLogoDataUrl", e.target.files[0])
  }), id_.leftLogoDataUrl && /*#__PURE__*/React.createElement("img", {
    src: id_.leftLogoDataUrl,
    style: {
      height: 40,
      marginTop: 4
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "Right logo (e.g. DPHE logo)", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: e => handleLogo("rightLogoDataUrl", e.target.files[0])
  }), id_.rightLogoDataUrl && /*#__PURE__*/React.createElement("img", {
    src: id_.rightLogoDataUrl,
    style: {
      height: 40,
      marginTop: 4
    }
  }))), /*#__PURE__*/React.createElement("div", {
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
