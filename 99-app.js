// ===== 99-app.js =====
// ============================================================================
// APP SHELL — AppRoot (session) + LabApp (tab shell, top-level state).
// Loads last: depends on every module above it.
//
// Phase-1 changes vs V14, clearly marked below with "// >>> PHASE 1":
//   1. AppRoot now also passes `users` down to LabApp (Samples needs the
//      technician list for assignment).
//   2. LabApp gains a `samples` collection, loaded/saved through DataService
//      (see 01-data-service.js) instead of the legacy loadKey/saveKey used
//      by every other collection here — this is the new module's data path.
//   3. A "Samples" nav tab is added, and the Dashboard gets a Sample
//      Lifecycle KPI strip above its original content.
// Everything else below is byte-for-byte the original V14 behaviour.
// ============================================================================
function AppRoot() {
  const [users] = useState(() => loadKey("users", seedUsers()));
  const [session, setSession] = useState(() => loadKey("session", null));
  useEffect(() => {
    saveKey("users", users);
  }, [users]);
  function handleLogin(user) {
    const sess = {
      userId: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      ts: Date.now()
    };
    setSession(sess);
    saveKey("session", sess);
  }
  function handleLogout() {
    setSession(null);
    saveKey("session", null);
  }
  if (!session) return /*#__PURE__*/React.createElement(LoginPage, {
    users: users,
    onLogin: handleLogin
  });
  // >>> PHASE 1: users passed through so Samples can offer a technician list for assignment.
  return /*#__PURE__*/React.createElement(LabApp, {
    session: session,
    onLogout: handleLogout,
    users: users
  });
}

// ============================================================================
// MAIN APP
// ============================================================================
function LabApp({
  session,
  onLogout,
  users
}) {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [invTab, setInvTab] = useState("equipment");
  const [reportTab, setReportTab] = useState("executive");
  const [theme, setTheme] = useState(() => loadKey("theme", "light"));
  const [lang, setLangState] = useState(() => loadKey("lang", "en"));
  applyTheme(theme);
  setLang(lang);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveKey("theme", next);
  }
  function toggleLang() {
    const next = lang === "en" ? "bn" : "en";
    setLangState(next);
    saveKey("lang", next);
  }
  const [chemicals, setChemicals] = useState([]);
  const [masterChemicals, setMasterChemicals] = useState(() => loadKey("masterChemicals", DEFAULT_MASTER_CHEMICALS));
  const [glassware, setGlassware] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [gasList, setGasList] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [testRecords, setTestRecords] = useState([]);
  const [subBatches, setSubBatches] = useState([]);
  const [toast, setToast] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showBackendSettings, setShowBackendSettings] = useState(false);
  const [showLabIdentitySettings, setShowLabIdentitySettings] = useState(false);

  // >>> PHASE 1: Sample Lifecycle collection — loaded/saved through DataService, NOT the
  // legacy loadKey/saveKey mechanism used above. Today DataService defaults to localStorage
  // (mode "local"), so behaviour is unchanged until Settings → Backend is pointed at your
  // Google Apps Script Web App URL (mode "gas") — see gas-backend/README.md.
  const [samples, setSamplesState] = useState([]);
  const [samplesLoaded, setSamplesLoaded] = useState(false);
  useEffect(() => {
    DataService.list("samples").then(list => {
      setSamplesState(list);
      setSamplesLoaded(true);
    });
  }, []);
  const setSamples = useCallback(async (updater, changedRecord) => {
    setSamplesState(prev => updater(prev));
    if (changedRecord) {
      await DataService.save("samples", changedRecord);
      await DataService.appendAudit({
        entity: "sample",
        entityId: changedRecord.id,
        sampleCode: changedRecord.sampleCode,
        action: changedRecord.status,
        user: session.name,
        role: session.role
      });
    }
  }, [session.name, session.role]);

  // >>> PHASE 1: Reference collection — the real source-of-truth for who a
  // sample came from (DPHE / institution / walk-in) + their letter/ref no.,
  // replacing the old free-text Sample.batchRef. Same DataService pattern
  // as samples above.
  const [references, setReferencesState] = useState([]);
  const [referencesLoaded, setReferencesLoaded] = useState(false);
  useEffect(() => {
    DataService.list("references").then(list => {
      setReferencesState(list);
      setReferencesLoaded(true);
    });
  }, []);
  const setReferences = useCallback(async (updater, changedRecord) => {
    setReferencesState(prev => updater(prev));
    if (changedRecord) {
      await DataService.save("references", changedRecord);
    }
  }, []);
  // One-time, idempotent migration: any sample already carrying a
  // referenceId is left untouched. Runs once both collections have loaded,
  // and only writes anything if there's actually legacy data to migrate.
  const [migrationChecked, setMigrationChecked] = useState(false);
  useEffect(() => {
    if (!samplesLoaded || !referencesLoaded || migrationChecked) return;
    setMigrationChecked(true);
    const needsMigration = samples.some(s => !s.referenceId);
    if (!needsMigration) return;
    const {
      references: migratedReferences,
      samples: migratedSamples
    } = migrateBatchRefsToReferences(samples, references);
    setReferencesState(migratedReferences);
    setSamplesState(migratedSamples);
    DataService.bulkSet("references", migratedReferences);
    DataService.bulkSet("samples", migratedSamples);
  }, [samplesLoaded, referencesLoaded, migrationChecked, samples, references]);
  useEffect(() => {
    const chems = markExpiredBatches(normalizeChemicals(loadKey("chemicals", seedChemicals())));
    const equip = normalizeEquipment(loadKey("equipment", seedEquipment()));
    const gases = normalizeGas(loadKey("gasInventory", seedGas()));
    setChemicals(chems);
    setGlassware(normalizeGlassware(loadKey("glassware", seedGlassware())));
    setEquipment(equip);
    setGasList(gases);
    setTestTypes(normalizeTestTypes(loadKey("testTypes", seedTestTypes(chems, equip, gases))).map(t => ({
      costPerTest: 0,
      ...t
    })));
    setTestRecords(loadKey("testRecords", []));
    setSubBatches(loadKey("subBatches", []));
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) saveKey("chemicals", chemicals);
  }, [chemicals, loaded]);
  useEffect(() => {
    if (loaded) saveKey("masterChemicals", masterChemicals);
  }, [masterChemicals, loaded]);
  useEffect(() => {
    if (loaded) saveKey("glassware", glassware);
  }, [glassware, loaded]);
  useEffect(() => {
    if (loaded) saveKey("equipment", equipment);
  }, [equipment, loaded]);
  useEffect(() => {
    if (loaded) saveKey("gasInventory", gasList);
  }, [gasList, loaded]);
  useEffect(() => {
    if (loaded) saveKey("testTypes", testTypes);
  }, [testTypes, loaded]);
  useEffect(() => {
    if (loaded) saveKey("testRecords", testRecords);
  }, [testRecords, loaded]);
  useEffect(() => {
    if (loaded) saveKey("subBatches", subBatches);
  }, [subBatches, loaded]);
  const notify = useCallback((msg, tone = "ok") => {
    setToast({
      msg,
      tone
    });
    setTimeout(() => setToast(null), 3200);
  }, []);
  const loadDemoReportData = useCallback(() => {
    const demo = buildDemoReportData();
    const chems = markExpiredBatches(normalizeChemicals(demo.chemicals));
    const equip = normalizeEquipment(demo.equipment);
    const gases = normalizeGas(demo.gasList);
    setChemicals(chems);
    setEquipment(equip);
    setGasList(gases);
    setTestTypes(normalizeTestTypes(demo.testTypes).map(t => ({
      costPerTest: 0,
      ...t
    })));
    setTestRecords(demo.testRecords);
    setMasterChemicals(prev => [...new Set([...prev, ...demo.masterChemicals])]);
    notify("Demo dataset loaded — 15 test records across Arsenic, Iron, Manganese & Chloride.", "ok");
  }, [notify]);
  if (!loaded) return /*#__PURE__*/React.createElement("div", {
    className: "p-8 text-sm",
    style: {
      color: C.muted
    }
  }, "Loading lab data…");
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen w-full",
    style: {
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.tealDark
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto px-5 py-4 flex items-center gap-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-full p-2",
    style: {
      background: "rgba(255,255,255,0.15)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "droplet",
    size: 20,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    className: "mr-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-white font-semibold text-lg leading-tight"
  }, t("appName")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: "#BFE3E0"
    }
  }, t("appSub"))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-xs no-print",
    style: {
      color: "#DDF2F0"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: toggleLang,
    className: "flex items-center gap-1 px-2 py-1 rounded",
    style: {
      background: "rgba(255,255,255,0.12)",
      color: "#fff"
    },
    title: "Switch language / ভাষা পরিবর্তন"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "globe",
    size: 13
  }), lang === "en" ? "বাংলা" : "EN"), /*#__PURE__*/React.createElement("button", {
    onClick: toggleTheme,
    className: "flex items-center gap-1 px-2 py-1 rounded",
    style: {
      background: "rgba(255,255,255,0.12)",
      color: "#fff"
    },
    title: "Toggle dark mode"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: theme === "dark" ? "sun" : "moon",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowBackendSettings(true),
    className: "flex items-center gap-1 px-2 py-1 rounded",
    style: {
      background: "rgba(255,255,255,0.12)",
      color: "#fff"
    },
    title: "Backend settings"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "link",
    size: 13
  }), "Backend"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowLabIdentitySettings(true),
    className: "flex items-center gap-1 px-2 py-1 rounded",
    style: {
      background: "rgba(255,255,255,0.12)",
      color: "#fff"
    },
    title: "Lab identity / report letterhead"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 13
  }), "Lab Identity"), /*#__PURE__*/React.createElement("span", {
    className: "rounded-full p-1.5",
    style: {
      background: "rgba(255,255,255,0.15)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 14,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("span", null, session.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#9FCFCB"
    }
  }, "· ", session.role)), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    className: "flex items-center gap-1 px-2 py-1 rounded",
    style: {
      background: "rgba(255,255,255,0.12)",
      color: "#fff"
    },
    title: "Log out"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "logout",
    size: 13
  }), t("logOut")))), /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto px-5 flex gap-1 flex-wrap no-print"
  }, [{
    k: "dashboard",
    label: t("dashboard"),
    icon: "home"
  }, {
    k: "samples",
    label: "Samples",
    icon: "clipboard"
  }, {
    k: "inventory",
    label: t("inventory"),
    icon: "flask"
  }, {
    k: "testTypes",
    label: t("testTypes"),
    icon: "beaker"
  }, {
    k: "addTest",
    label: t("addTest"),
    icon: "clipboard"
  }, {
    k: "testRecords",
    label: t("testRecords"),
    icon: "edit"
  }, {
    k: "reports",
    label: t("reports"),
    icon: "chart"
  }, {
    k: "qc",
    label: "QC",
    icon: "chart"
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    onClick: () => {
      if (t.k !== "addTest") setEditingRecord(null);
      setTab(t.k);
    },
    className: "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t",
    style: {
      color: tab === t.k ? C.tealDark : "#DDF2F0",
      background: tab === t.k ? C.bg : "transparent"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: t.icon,
    size: 15
  }), t.label)))), /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto px-5 py-6"
  }, tab === "dashboard" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SampleKpiStrip, {
    samples: samples,
    goTo: t => setTab(t)
  }), /*#__PURE__*/React.createElement(DashboardTab, {
    chemicals: chemicals,
    glassware: glassware,
    equipment: equipment,
    gasList: gasList,
    testRecords: testRecords,
    goTo: (t, sub) => {
      setTab(t);
      if (sub) setInvTab(sub);
    }
  })), tab === "samples" && (samplesLoaded ? /*#__PURE__*/React.createElement(SamplesTab, {
    samples: samples,
    setSamples: setSamples,
    references: references,
    setReferences: setReferences,
    testTypes: testTypes,
    testRecords: testRecords,
    subBatches: subBatches,
    setSubBatches: setSubBatches,
    equipment: equipment,
    users: users,
    session: session,
    notify: notify
  }) : /*#__PURE__*/React.createElement("div", {
    className: "p-8 text-sm",
    style: {
      color: C.muted
    }
  }, "Loading samples…")), tab === "inventory" && /*#__PURE__*/React.createElement(InventoryTab, {
    invTab: invTab,
    setInvTab: setInvTab,
    chemicals: chemicals,
    setChemicals: setChemicals,
    masterChemicals: masterChemicals,
    setMasterChemicals: setMasterChemicals,
    glassware: glassware,
    setGlassware: setGlassware,
    equipment: equipment,
    setEquipment: setEquipment,
    gasList: gasList,
    setGasList: setGasList,
    testTypes: testTypes,
    testRecords: testRecords,
    notify: notify
  }), tab === "testTypes" && /*#__PURE__*/React.createElement(TestTypesTab, {
    testTypes: testTypes,
    setTestTypes: setTestTypes,
    chemicals: chemicals,
    setChemicals: setChemicals,
    equipment: equipment,
    setEquipment: setEquipment,
    gasList: gasList,
    setGasList: setGasList,
    masterChemicals: masterChemicals,
    setMasterChemicals: setMasterChemicals,
    testRecords: testRecords,
    notify: notify
  }), tab === "addTest" && /*#__PURE__*/React.createElement(AddTestTab, {
    testTypes: testTypes,
    chemicals: chemicals,
    setChemicals: setChemicals,
    equipment: equipment,
    gasList: gasList,
    setGasList: setGasList,
    testRecords: testRecords,
    setTestRecords: setTestRecords,
    samples: samples,
    setSamples: setSamples,
    subBatches: subBatches,
    setSubBatches: setSubBatches,
    session: session,
    notify: notify,
    editingRecord: editingRecord,
    onDoneEditing: () => setEditingRecord(null),
    goToTestTypes: () => setTab("testTypes")
  }), tab === "testRecords" && /*#__PURE__*/React.createElement(TestRecordsTab, {
    testRecords: testRecords,
    setTestRecords: setTestRecords,
    chemicals: chemicals,
    setChemicals: setChemicals,
    gasList: gasList,
    setGasList: setGasList,
    samples: samples,
    setSamples: setSamples,
    testTypes: testTypes,
    notify: notify,
    onEditRecord: r => {
      setEditingRecord(r);
      setTab("addTest");
    }
  }), tab === "reports" && /*#__PURE__*/React.createElement(ReportsTab, {
    reportTab: reportTab,
    setReportTab: setReportTab,
    chemicals: chemicals,
    glassware: glassware,
    equipment: equipment,
    gasList: gasList,
    testTypes: testTypes,
    testRecords: testRecords,
    samples: samples,
    references: references,
    users: users,
    notify: notify,
    onLoadDemoData: loadDemoReportData
  }), tab === "qc" && /*#__PURE__*/React.createElement(QcModuleTab, {
    testTypes: testTypes,
    testRecords: testRecords
  })), showBackendSettings && /*#__PURE__*/React.createElement(BackendSettingsModal, {
    notify: notify,
    onClose: () => setShowBackendSettings(false)
  }), showLabIdentitySettings && /*#__PURE__*/React.createElement(LabIdentityModal, {
    notify: notify,
    onClose: () => setShowLabIdentitySettings(false)
  }), toast && /*#__PURE__*/React.createElement("div", {
    className: "fixed bottom-5 right-5 px-4 py-2.5 rounded shadow-lg text-sm font-medium flex items-center gap-2 z-50",
    style: {
      background: toast.tone === "warn" ? C.warnBg : C.okBg,
      color: toast.tone === "warn" ? C.warn : C.ok,
      border: `1px solid ${toast.tone === "warn" ? C.warn : C.ok}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: toast.tone === "warn" ? "warning" : "check",
    size: 16
  }), toast.msg));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/*#__PURE__*/React.createElement(AppRoot, null));
