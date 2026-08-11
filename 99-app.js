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
  const [users, setUsers] = useState([]);
  const [permissionMatrix, setPermissionMatrixState] = useState(() => DEFAULT_PERMISSION_MATRIX);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [session, setSession] = useState(() => loadKey("session", null));

  useEffect(() => {
    Promise.all([
      DataService.list("users"),
      DataService.getSingleton("permissionMatrix")
    ]).then(([uList, permSingleton]) => {
      setUsers(uList || []);
      if (permSingleton) {
        setPermissionMatrixState(backfillSamplePermissions(permSingleton.matrix || permSingleton));
      } else {
        setPermissionMatrixState(backfillSamplePermissions(DEFAULT_PERMISSION_MATRIX));
      }
      setUsersLoaded(true);
    }).catch(err => {
      console.error("Failed loading auth data via DataService:", err);
      setUsersLoaded(true);
    });
  }, []);

  const handleUpdateUsers = useCallback((updater) => {
    setUsers(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      DataService.bulkSet("users", next);
      return next;
    });
  }, []);

  function setPermissionMatrix(updater) {
    setPermissionMatrixState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      DataService.saveSingleton("permissionMatrix", { matrix: next });
      return next;
    });
  }

  // Session needs re-syncing if the logged-in user's own record changes
  useEffect(() => {
    if (!session || !usersLoaded) return;
    const fresh = users.find(u => u.id === session.userId);
    if (!fresh) return;
    if (fresh.active === false) {
      handleLogout();
      return;
    }
    const freshOverrides = fresh.permissionOverrides || {};
    if (fresh.role !== session.role || fresh.name !== session.name || JSON.stringify(freshOverrides) !== JSON.stringify(session.overrides || {})) {
      const nextSess = {
        ...session,
        role: fresh.role,
        name: fresh.name,
        overrides: freshOverrides
      };
      setSession(nextSess);
      saveKey("session", nextSess);
    }
  }, [users, session, usersLoaded]);

  function handleLogin(user) {
    const sess = {
      userId: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      overrides: user.permissionOverrides || {},
      ts: Date.now()
    };
    setSession(sess);
    saveKey("session", sess);
  }
  function handleLogout() {
    setSession(null);
    saveKey("session", null);
  }

  if (!usersLoaded) {
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen w-full flex items-center justify-center p-6 text-sm text-gray-500"
    }, "Initializing authentication...");
  }

  if (users.length === 0) {
    return /*#__PURE__*/React.createElement(FirstTimeSetupPage, {
      onSetupComplete: (newAdmin) => {
        setUsers([newAdmin]);
        DataService.bulkSet("users", [newAdmin]);
        handleLogin(newAdmin);
      }
    });
  }

  if (!session) return /*#__PURE__*/React.createElement(LoginPage, {
    users: users,
    onLogin: handleLogin
  });

  return /*#__PURE__*/React.createElement(LabApp, {
    session: session,
    onLogout: handleLogout,
    users: users,
    setUsers: handleUpdateUsers,
    permissionMatrix: permissionMatrix,
    setPermissionMatrix: setPermissionMatrix
  });
}

// ============================================================================
// MAIN APP
// ============================================================================
function LabApp({
  session,
  onLogout,
  users,
  setUsers,
  permissionMatrix,
  setPermissionMatrix
}) {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  // Sample Detail (in the Samples tab) is the single source of truth for
  // "everything about this sample" — Test Record UI, QC Module, and the
  // Report Generator each used to show their own ad-hoc slice of a sample
  // instead of linking to it. This is the shared piece of navigation state
  // that lets any of them jump straight there.
  const [focusSampleId, setFocusSampleId] = useState(null);
  function goToSample(sampleId) {
    setFocusSampleId(sampleId);
    setTab("samples");
  }
  // Same pattern as goToSample — jumps to the Samples tab's "Results
  // Workflow" sub-tab (Upload/Review/Approve/Release consolidated there;
  // see 22-results-workflow-ui.js).
  const [focusSamplesSubTab, setFocusSamplesSubTab] = useState(null);
  function goToResultsWorkflow() {
    setFocusSamplesSubTab("resultsWorkflow");
    setTab("samples");
  }
  // Same pattern one level deeper — lets the sidebar nav's 3rd tier
  // (Upload/Review/Approve/Release) deep-link straight into a specific
  // Results Workflow stage, not just the Results Workflow sub-tab itself.
  const [focusResultsStage, setFocusResultsStage] = useState(null);
  // Deep-link from the Results Workflow "Pending Upload" queue straight
  // into Add Test Record, optionally preselecting a Sub-Batch.
  const [entrySubBatchId, setEntrySubBatchId] = useState(undefined);
  function goToTestEntry(subBatchId) {
    setEntrySubBatchId(subBatchId || null);
    setTab("addTest");
  }
  const [invTab, setInvTab] = useState("equipment");
  const [testConfigTab, setTestConfigTab] = useState("parameters");
  const [reportTab, setReportTab] = useState("executive");
  // ---- Sidebar nav (03-sidebar-nav.js) state ----
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => loadKey("sidebarCollapsed", false));
  useEffect(() => { saveKey("sidebarCollapsed", sidebarCollapsed); }, [sidebarCollapsed]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // The header's height is organic (wraps on narrow screens, grows with a
  // build-version footer line, etc.) rather than a fixed value, so the
  // sidebar measures it instead of guessing a pixel number.
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(64);
  useEffect(() => {
    if (!headerRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setHeaderHeight(Math.ceil(entry.contentRect.height));
    });
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);
  // Single source of truth for "where am I", root→leaf, matching the
  // sidebar's tree shape — used both to highlight the active item and to
  // resolve where a sidebar click should actually land.
  function buildActivePath() {
    if (tab === "samples") {
      const sub = focusSamplesSubTab || "samples";
      if (sub === "resultsWorkflow") {
        return focusResultsStage ? ["samples", "resultsWorkflow", focusResultsStage] : ["samples", "resultsWorkflow"];
      }
      return ["samples", sub];
    }
    if (tab === "inventory") return invTab ? ["inventory", invTab] : ["inventory"];
    if (tab === "testConfig") return testConfigTab ? ["testConfig", testConfigTab] : ["testConfig"];
    if (tab === "reports") {
      const grp = REPORT_GROUPS.find(g => g.pages.some(p => p.k === reportTab));
      return ["reports", grp && grp.group === "Custom Report" ? "customReport" : "reportAnalytics"];
    }
    return [tab];
  }
  function handleSidebarNavigate(path) {
    const [top, sub, subsub] = path;
    if (top === "settings") {
      if (sub === "backend") setShowBackendSettings(true);
      if (sub === "labIdentity") setShowLabIdentitySettings(true);
      if (sub === "dataBackup") setShowDataBackupSettings(true);
      setMobileNavOpen(false);
      return;
    }
    if (top !== "addTest") setEditingRecord(null);
    if (top === "archive") {
      goToArchive();
      setMobileNavOpen(false);
      return;
    }
    setTab(top);
    if (top === "inventory" && sub) setInvTab(sub);
    if (top === "testConfig" && sub) setTestConfigTab(sub);
    if (top === "reports" && sub) {
      const grp = REPORT_GROUPS.find(g => g.group === (sub === "customReport" ? "Custom Report" : "Report & Analytics"));
      if (grp) setReportTab(grp.pages[0].k);
    }
    if (top === "samples") {
      setFocusSamplesSubTab(sub || "samples");
      setFocusResultsStage(sub === "resultsWorkflow" ? subsub || null : null);
    }
    setMobileNavOpen(false);
  }
  function buildNavTree() {
    return [{
      k: "dashboard",
      label: t("dashboard"),
      icon: "home"
    }, {
      k: "samples",
      label: t("samples"),
      icon: "clipboard",
      children: [{
        k: "samples",
        label: "Sample Registration",
        icon: "beaker"
      }, {
        k: "subBatches",
        label: "Create Analytical Batch",
        icon: "table"
      }, {
        k: "resultsWorkflow",
        label: "Results Workflow",
        icon: "search",
        children: [{
          k: "upload",
          label: "Upload Results",
          icon: "upload"
        }, {
          k: "review",
          label: "Awaiting Review",
          icon: "list"
        }, {
          k: "approve",
          label: "Awaiting Approval",
          icon: "check"
        }, {
          k: "release",
          label: "Approved — Release",
          icon: "printer"
        }]
      }]
    }, {
      k: "inventory",
      label: t("inventory"),
      icon: "wrench",
      moduleKey: "inventory",
      // Order matches the actual pill tabs inside the Inventory page itself
      // (see InventoryTab in 11-inventory-ui.js) — Equipment, Glassware,
      // Chemicals, Gas — so the sidebar isn't a different order than what
      // you land on.
      children: [{
        k: "equipment",
        label: "Equipment",
        icon: "table"
      }, {
        k: "glassware",
        label: "Glassware",
        icon: "beaker"
      }, {
        k: "chemicals",
        label: "Chemicals",
        icon: "flask"
      }, {
        k: "gas",
        label: "Gas",
        icon: "droplet"
      }]
    }, {
      k: "testConfig",
      label: t("testConfiguration"),
      icon: "layers",
      moduleKey: "testTypes",
      // Order matches the actual pill tabs inside Test Configuration
      // (see TestConfigurationTab in 12-testtypes-ui.js) — Parameters,
      // then Test Types.
      children: [{
        k: "parameters",
        label: "Parameters",
        icon: "list"
      }, {
        k: "testTypes",
        label: "Test Types",
        icon: "beaker"
      }]
    }, {
      k: "addTest",
      label: t("addTest"),
      icon: "plus",
      moduleKey: "testRecords",
      moduleAction: "create"
    }, {
      k: "testRecords",
      label: t("testRecords"),
      icon: "edit",
      moduleKey: "testRecords"
    }, {
      k: "reports",
      label: t("reports"),
      icon: "chart",
      moduleKey: "reports",
      // Mirrors the two pill groups shown inside the Reports page itself
      // (ReportGroupPills in 14c-analytics-pages-2.js) — Report & Analytics
      // and Custom Report — so the sidebar has a real sub-module instead of
      // dropping straight into a page with no menu context.
      children: [{
        k: "reportAnalytics",
        label: "Report & Analytics",
        icon: "chart"
      }, {
        k: "customReport",
        label: "Custom Report",
        icon: "printer"
      }]
    }, {
      k: "qc",
      label: "QC",
      icon: "check",
      moduleKey: "qc"
    }, {
      k: "archive",
      label: t("archive"),
      icon: "archive",
      moduleKey: "archive"
    }, {
      k: "users",
      label: "Users",
      icon: "users",
      moduleKey: "users"
    }, {
      k: "auditLog",
      label: "Audit Log",
      icon: "shield",
      moduleKey: "auditLog"
    }, {
      k: "settings",
      label: "Settings",
      icon: "settings",
      moduleKey: "settings",
      children: [{
        k: "backend",
        label: "Backend Settings",
        icon: "link"
      }, {
        k: "labIdentity",
        label: "Lab Identity / Letterhead",
        icon: "printer"
      }, {
        k: "dataBackup",
        label: "Data Backup",
        icon: "archive"
      }]
    }];
  }
  // Archive tab route. Deliberately just a tab switch — archived data is
  // fetched on-demand by ArchiveTab itself when it mounts, never as part of
  // the initial app-load sequence below (see the loadAll effect).
  function goToArchive() {
    setTab("archive");
  }
  // Header used to line up 6 always-visible controls (lang, theme, backend
  // settings, lab identity, user pill, logout) — crowded on anything less
  // than a wide desktop. Backend/Lab Identity now live in the sidebar's
  // own "Settings" branch (see buildNavTree() below) rather than a header
  // popover; the header just keeps the user pill + Log Out.
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  function closeHeaderMenus() {
    setUserMenuOpen(false);
  }
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
  const [masterChemicals, setMasterChemicals] = useState(() => loadKey("masterChemicals", []));
  const [glassware, setGlassware] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [gasList, setGasList] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [testRecords, setTestRecords] = useState([]);
  const [subBatches, setSubBatches] = useState([]);
  const [toast, setToast] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showBackendSettings, setShowBackendSettings] = useState(false);
  const [showLabIdentitySettings, setShowLabIdentitySettings] = useState(false);
  const [showDataBackupSettings, setShowDataBackupSettings] = useState(false);

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
  // referenceId (and requestedTests already carrying a status) is left
  // untouched. Runs once every collection involved has loaded, and only
  // writes anything if there's actually legacy data to migrate.
  const [migrationChecked, setMigrationChecked] = useState(false);
  useEffect(() => {
    if (!samplesLoaded || !referencesLoaded || !loaded || migrationChecked) return;
    setMigrationChecked(true);
    const needsReferenceMigration = samples.some(s => !s.referenceId);
    const needsStatusBackfill = samples.some(s => (s.requestedTests || []).some(rt => !rt.status));
    if (!needsReferenceMigration && !needsStatusBackfill) return;
    let workingSamples = samples;
    let workingReferences = references;
    if (needsReferenceMigration) {
      const migrated = migrateBatchRefsToReferences(workingSamples, workingReferences);
      workingReferences = migrated.references;
      workingSamples = migrated.samples;
    }
    if (needsStatusBackfill) {
      workingSamples = backfillRequestedTestStatuses(workingSamples, testRecords, subBatches);
    }
    setReferencesState(workingReferences);
    setSamplesState(workingSamples);
    DataService.bulkSet("references", workingReferences);
    DataService.bulkSet("samples", workingSamples);
  }, [samplesLoaded, referencesLoaded, loaded, migrationChecked, samples, references, testRecords, subBatches]);

  // Auto-archive sweep — runs at most once per calendar day, only after
  // everything it needs (legacy testRecords/subBatches + DataService
  // samples) has finished loading. See 23-data-backup.js for the full
  // rationale; it never reads archived_records, only the active
  // testRecords list, so it can't be the thing that slows the app down.
  const [autoArchiveChecked, setAutoArchiveChecked] = useState(false);
  useEffect(() => {
    if (!loaded || !samplesLoaded || autoArchiveChecked) return;
    setAutoArchiveChecked(true);
    runAutoArchiveSweepIfDue({ testRecords, samples, subBatches, setTestRecords, session, notify });
  }, [loaded, samplesLoaded, autoArchiveChecked, testRecords, samples, subBatches, session]);
  useEffect(() => {
    Promise.all([
      DataService.list("chemicals"),
      DataService.list("glassware"),
      DataService.list("equipment"),
      DataService.list("gas"),
      DataService.list("parameters"),
      DataService.list("testTypes"),
      DataService.listActive("testRecords"),
      DataService.list("subBatches"),
      DataService.getSingleton("masterChemicals")
    ]).then(([rawChems, rawGlass, rawEquip, rawGas, rawParams, rawTestTypes, rawTestRecs, rawSubBatches, rawMasterChem]) => {
      // NOTE: production deployments must NOT fall back to seed/demo data
      // when a collection comes back empty from the backend — an empty
      // result is a legitimate state (e.g. the admin deleted everything),
      // not a signal to repopulate. No demo/seed data exists anywhere in
      // this app — inventory starts genuinely empty and stays that way
      // until an admin adds real data.
      const chems = markExpiredBatches(normalizeChemicals(rawChems || []));
      const equip = normalizeEquipment(rawEquip || []);
      const gases = normalizeGas(rawGas || []);
      setChemicals(chems);
      setGlassware(normalizeGlassware(rawGlass || []));
      setEquipment(equip);
      setGasList(gases);
      const params = normalizeParameters(rawParams || []);
      setParameters(params);
      setTestTypes(normalizeTestTypes(rawTestTypes || []).map(t => ({
        costPerTest: 0,
        ...t
      })));
      setTestRecords(rawTestRecs || []);
      setSubBatches(rawSubBatches || []);
      if (rawMasterChem && rawMasterChem.list) {
        setMasterChemicals(rawMasterChem.list);
      }
      setLoaded(true);
    }).catch(err => {
      console.error("Error loading data via DataService:", err);
      setLoaded(true);
    });
  }, []);

  // Auto-save effects below persist every in-memory change to the backend.
  // Previously these had no .catch — if a save/delete failed (network drop,
  // wrong/expired Apps Script URL, bad token, Apps Script quota, etc.) the
  // UI would still show the change as done, but the backend never actually
  // received it — so on the next reload the old data would come back,
  // looking exactly like "delete doesn't work". Every write now surfaces a
  // toast on failure so a failed save is never silent.
  const notifyBackendSaveError = (what, err) => {
    console.error(`Failed to save ${what} to backend:`, err);
    notify(`Could not save ${what} to the backend — your change may be lost on reload. (${err && err.message || err})`, "warn");
  };
  useEffect(() => {
    if (loaded) DataService.bulkSet("chemicals", chemicals).catch(err => notifyBackendSaveError("chemicals/inventory", err));
  }, [chemicals, loaded]);
  useEffect(() => {
    if (loaded) DataService.saveSingleton("masterChemicals", { list: masterChemicals }).catch(err => notifyBackendSaveError("master chemical list", err));
  }, [masterChemicals, loaded]);
  useEffect(() => {
    if (loaded) DataService.bulkSet("glassware", glassware).catch(err => notifyBackendSaveError("glassware", err));
  }, [glassware, loaded]);
  useEffect(() => {
    if (loaded) DataService.bulkSet("equipment", equipment).catch(err => notifyBackendSaveError("equipment", err));
  }, [equipment, loaded]);
  useEffect(() => {
    if (loaded) DataService.bulkSet("gas", gasList).catch(err => notifyBackendSaveError("gas cylinders", err));
  }, [gasList, loaded]);
  useEffect(() => {
    if (loaded) DataService.bulkSet("parameters", parameters).catch(err => notifyBackendSaveError("parameters", err));
  }, [parameters, loaded]);
  useEffect(() => {
    if (loaded) DataService.bulkSet("testTypes", testTypes).catch(err => notifyBackendSaveError("test types", err));
  }, [testTypes, loaded]);
  useEffect(() => {
    if (loaded) DataService.bulkSet("testRecords", testRecords).catch(err => notifyBackendSaveError("test records", err));
  }, [testRecords, loaded]);
  useEffect(() => {
    if (loaded) DataService.bulkSet("subBatches", subBatches).catch(err => notifyBackendSaveError("sub-batches", err));
  }, [subBatches, loaded]);
  const notify = useCallback((msg, tone = "ok") => {
    setToast({
      msg,
      tone
    });
    setTimeout(() => setToast(null), 3200);
  }, []);
  // A failed localStorage save/load now surfaces as a toast instead of
  // failing silently — see reportStorageError() in 00-core.js.
  registerStorageErrorHandler(notify);
  if (!loaded) return /*#__PURE__*/React.createElement("div", {
    className: "p-8 text-sm",
    style: {
      color: C.muted
    }
  }, "Loading lab data…");
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen w-full flex flex-col",
    style: {
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: headerRef,
    style: {
      background: C.tealDark
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 min-w-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMobileNavOpen(true),
    className: "md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0",
    "aria-label": "Open menu",
    title: "Menu"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 18,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    className: "rounded-full p-2 flex-shrink-0",
    style: {
      background: "rgba(255,255,255,0.15)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "droplet",
    size: 20,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-white font-semibold text-lg leading-tight truncate"
  }, t("appName")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs truncate",
    style: {
      color: C.headerTextMuted
    }
  }, t("appSub")), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] opacity-60",
    style: {
      color: C.headerTextMuted
    }
  }, "Build ", APP_BUILD))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-xs no-print relative flex-shrink-0",
    style: {
      color: C.headerText
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: toggleLang,
    className: "flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 transition-colors",
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
    className: "flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 transition-colors",
    style: {
      background: "rgba(255,255,255,0.12)",
      color: "#fff"
    },
    title: "Toggle dark mode"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: theme === "dark" ? "sun" : "moon",
    size: 13
  })),
  /* ---- User popover: role + Log Out ---- */
  /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setUserMenuOpen(o => !o),
    className: "flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded hover:bg-white/10 transition-colors",
    style: {
      background: userMenuOpen ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)",
      color: "#fff"
    },
    title: "Account"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rounded-full p-1",
    style: {
      background: "rgba(255,255,255,0.2)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 12,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    className: "max-w-[110px] truncate"
  }, session.name), /*#__PURE__*/React.createElement(Icon, {
    name: "chevronDown",
    size: 11
  })), userMenuOpen && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0",
    style: {
      zIndex: 40
    },
    onClick: closeHeaderMenus
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute right-0 top-full mt-1.5 w-56 rounded-lg shadow-xl py-1 text-left",
    style: {
      background: C.card,
      border: `1px solid ${C.border}`,
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2",
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold",
    style: {
      color: C.ink
    }
  }, session.name), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, session.role)), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      closeHeaderMenus();
      onLogout();
    },
    className: "w-full flex items-center gap-2 text-left px-3 py-2 text-xs hover:bg-black/5 mt-1",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "logout",
    size: 13
  }), t("logOut")))))))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement(SidebarNav, {
    tree: buildNavTree(),
    activePath: buildActivePath(),
    onNavigate: handleSidebarNavigate,
    session: session,
    permissionMatrix: permissionMatrix,
    topOffset: headerHeight,
    appName: t("appName"),
    appIcon: "droplet",
    collapsed: sidebarCollapsed,
    onToggleCollapsed: () => setSidebarCollapsed(c => !c),
    mobileOpen: mobileNavOpen,
    onCloseMobile: () => setMobileNavOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-0 px-5 py-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto"
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
    setTestRecords: setTestRecords,
    parameters: parameters,
    subBatches: subBatches,
    setSubBatches: setSubBatches,
    equipment: equipment,
    users: users,
    session: session,
    permissionMatrix: permissionMatrix,
    notify: notify,
    focusSampleId: focusSampleId,
    setFocusSampleId: setFocusSampleId,
    focusSamplesSubTab: focusSamplesSubTab,
    setFocusSamplesSubTab: setFocusSamplesSubTab,
    focusResultsStage: focusResultsStage,
    setFocusResultsStage: setFocusResultsStage,
    goToTestEntry: goToTestEntry
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
    session: session,
    permissionMatrix: permissionMatrix,
    notify: notify
  }), tab === "testConfig" && /*#__PURE__*/React.createElement(TestConfigurationTab, {
    testConfigTab: testConfigTab,
    setTestConfigTab: setTestConfigTab,
    parameters: parameters,
    setParameters: setParameters,
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
    session: session,
    permissionMatrix: permissionMatrix,
    notify: notify
  }), tab === "addTest" && /*#__PURE__*/React.createElement(AddTestTab, {
    testTypes: testTypes,
    parameters: parameters,
    chemicals: chemicals,
    setChemicals: setChemicals,
    equipment: equipment,
    gasList: gasList,
    setGasList: setGasList,
    testRecords: testRecords,
    setTestRecords: setTestRecords,
    samples: samples,
    setSamples: setSamples,
    references: references,
    subBatches: subBatches,
    setSubBatches: setSubBatches,
    session: session,
    permissionMatrix: permissionMatrix,
    notify: notify,
    goToSample: goToSample,
    editingRecord: editingRecord,
    onDoneEditing: () => setEditingRecord(null),
    goToTestTypes: () => {
      setTestConfigTab("testTypes");
      setTab("testConfig");
    },
    preselectSubBatchId: entrySubBatchId,
    onPreselectHandled: () => setEntrySubBatchId(undefined)
  }), tab === "testRecords" && /*#__PURE__*/React.createElement(TestRecordsTab, {
    testRecords: testRecords,
    setTestRecords: setTestRecords,
    chemicals: chemicals,
    setChemicals: setChemicals,
    gasList: gasList,
    setGasList: setGasList,
    samples: samples,
    setSamples: setSamples,
    subBatches: subBatches,
    setSubBatches: setSubBatches,
    references: references,
    testTypes: testTypes,
    parameters: parameters,
    session: session,
    permissionMatrix: permissionMatrix,
    goToSample: goToSample,
    goToResultsWorkflow: goToResultsWorkflow,
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
    setSamples: setSamples,
    references: references,
    subBatches: subBatches,
    users: users,
    session: session,
    permissionMatrix: permissionMatrix,
    notify: notify,
    goToSample: goToSample
  }), tab === "qc" && /*#__PURE__*/React.createElement(QcModuleTab, {
    testTypes: testTypes,
    testRecords: testRecords
  }), tab === "archive" && /*#__PURE__*/React.createElement(ArchiveTab, {
    testTypes: testTypes,
    samples: samples,
    testRecords: testRecords,
    setTestRecords: setTestRecords,
    session: session,
    permissionMatrix: permissionMatrix,
    notify: notify,
    goToSample: goToSample
  }), tab === "users" && /*#__PURE__*/React.createElement(UsersAdminTab, {
    users: users,
    setUsers: setUsers,
    permissionMatrix: permissionMatrix,
    setPermissionMatrix: setPermissionMatrix,
    session: session,
    notify: notify
  }), tab === "auditLog" && /*#__PURE__*/React.createElement(AuditLogTab, {
    session: session,
    permissionMatrix: permissionMatrix
  })))), showBackendSettings && /*#__PURE__*/React.createElement(BackendSettingsModal, {
    notify: notify,
    onClose: () => setShowBackendSettings(false)
  }), showLabIdentitySettings && /*#__PURE__*/React.createElement(LabIdentityModal, {
    notify: notify,
    onClose: () => setShowLabIdentitySettings(false)
  }), showDataBackupSettings && /*#__PURE__*/React.createElement(DataBackupSettingsModal, {
    notify: notify,
    onClose: () => setShowDataBackupSettings(false),
    testRecords: testRecords,
    samples: samples,
    subBatches: subBatches,
    setTestRecords: setTestRecords,
    session: session
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
