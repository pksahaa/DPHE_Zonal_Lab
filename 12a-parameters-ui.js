// ===== 12a-parameters-ui.js =====
// ============================================================================
// PARAMETERS SUB-TAB (Test Configuration › Parameters)
// A Parameter is the lightweight analytical-parameter master record (Ammonia,
// pH, Arsenic...) — code, name, unit, method ref, category, decimal places,
// and an optional Limits block (LOD/LOQ/TAT/fee/detection range/reference
// limits). It intentionally does NOT carry Test Group, Instrument linking,
// Calculation/Formula, or Chemical/Reagent usage — those remain Test Type
// concerns (see 12-testtypes-ui.js), and a Test Type links to one or more
// Parameters via `linkedParameterIds` (many-to-many).
//
// UX: the sub-tab opens straight on the Flat View table with a "+ Add
// Parameter" button top-right. Clicking it toggles to a dedicated form view
// with a "Back to List" button (no modal) — the list is unmounted, not
// hidden, so re-opening always starts clean.
// ============================================================================

function ParameterForm({
  initial,
  onSave,
  onCancel
}) {
  const [code, setCode] = useState(initial?.code || "");
  const [name, setName] = useState(initial?.name || "");
  const [shortName, setShortName] = useState(initial?.shortName || "");
  const [unit, setUnit] = useState(initial?.unit || "");
  const [methodRef, setMethodRef] = useState(initial?.methodRef || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [decimalPlaces, setDecimalPlaces] = useState(initial ? String(initial.decimalPlaces ?? 2) : "2");
  const [lod, setLod] = useState(initial?.lod ?? "");
  const [loq, setLoq] = useState(initial?.loq ?? "");
  const [tatHours, setTatHours] = useState(initial?.tatHours ?? "");
  const [standardFee, setStandardFee] = useState(initial?.standardFee ?? "");
  const [minDetection, setMinDetection] = useState(initial?.minDetection ?? "");
  const [maxDetection, setMaxDetection] = useState(initial?.maxDetection ?? "");
  const [refLimitMin, setRefLimitMin] = useState(initial?.refLimitMin ?? "");
  const [refLimitMax, setRefLimitMax] = useState(initial?.refLimitMax ?? "");
  const [refStandard, setRefStandard] = useState(initial?.refStandard || "");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const savingRef = React.useRef(false);

  const errors = {};
  if (submitAttempted) {
    if (!code.trim()) errors.code = "Parameter Code is required.";
    if (!name.trim()) errors.name = "Name is required.";
  }
  const hasErrors = Object.keys(errors).length > 0;

  function handleSubmit() {
    if (savingRef.current) return;
    setSubmitAttempted(true);
    if (!code.trim() || !name.trim()) return;
    savingRef.current = true;
    onSave({
      id: initial?.id || uid("param"),
      code: code.trim(),
      name: name.trim(),
      shortName: shortName.trim(),
      unit: unit.trim(),
      methodRef: methodRef.trim(),
      category: category || "Others",
      decimalPlaces: decimalPlaces === "" ? 2 : Number(decimalPlaces),
      lod: lod === "" ? "" : Number(lod),
      loq: loq === "" ? "" : Number(loq),
      tatHours: tatHours === "" ? "" : Number(tatHours),
      standardFee: standardFee === "" ? "" : Number(standardFee),
      minDetection: minDetection === "" ? "" : Number(minDetection),
      maxDetection: maxDetection === "" ? "" : Number(maxDetection),
      refLimitMin: refLimitMin === "" ? "" : Number(refLimitMin),
      refLimitMax: refLimitMax === "" ? "" : Number(refLimitMax),
      refStandard: refStandard.trim()
    });
    savingRef.current = false;
  }

  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, submitAttempted && hasErrors && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center gap-1.5",
    style: { background: C.warnBg, color: C.warn }
  }, /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 13 }), "Please fix the highlighted field(s) below before saving."),

  /*#__PURE__*/React.createElement(SectionCard, {
    title: "Parameter Setup",
    icon: /*#__PURE__*/React.createElement(Icon, { name: "beaker", size: 15, color: C.teal })
  },
  /*#__PURE__*/React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
    /*#__PURE__*/React.createElement(TextField, {
      label: "Parameter Code *",
      value: code,
      onChange: e => setCode(e.target.value),
      placeholder: "e.g. NH3",
      error: errors.code
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Name *",
      value: name,
      onChange: e => setName(e.target.value),
      placeholder: "e.g. Ammonia",
      error: errors.name
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Short Name",
      value: shortName,
      onChange: e => setShortName(e.target.value),
      placeholder: "e.g. Ammonia"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Unit",
      value: unit,
      onChange: e => setUnit(e.target.value),
      placeholder: "e.g. mg/L"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Method Ref",
      value: methodRef,
      onChange: e => setMethodRef(e.target.value),
      placeholder: "e.g. APHA 4500-NH3 B"
    }),
    /*#__PURE__*/React.createElement(SelectField, {
      label: "Category",
      value: category,
      onChange: e => setCategory(e.target.value),
      options: PARAMETER_CATEGORIES,
      placeholder: "Select category..."
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Decimal Places",
      type: "number",
      min: "0",
      step: "1",
      value: decimalPlaces,
      onChange: e => setDecimalPlaces(e.target.value),
      placeholder: "e.g. 2"
    })
  )),

  /*#__PURE__*/React.createElement(CollapsibleSection, {
    step: "⚑",
    title: "Limits (Optional)",
    subtitle: "LOD/LOQ, turnaround time, fee, detection range, and reference limits",
    defaultOpen: !!(initial && (initial.lod !== "" || initial.loq !== "" || initial.tatHours !== "" || initial.standardFee !== "" || initial.refLimitMax !== "" || initial.refLimitMin !== "" || initial.refStandard))
  },
  /*#__PURE__*/React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
    /*#__PURE__*/React.createElement(TextField, {
      label: "LOD (Limit of Detection)",
      type: "number",
      value: lod,
      onChange: e => setLod(e.target.value),
      placeholder: "e.g. 0.01"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "LOQ (Limit of Quantitation)",
      type: "number",
      value: loq,
      onChange: e => setLoq(e.target.value),
      placeholder: "e.g. 0.03"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "TAT (hours)",
      type: "number",
      min: "0",
      value: tatHours,
      onChange: e => setTatHours(e.target.value),
      placeholder: "e.g. 24"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Standard Fee (per test)",
      type: "number",
      min: "0",
      value: standardFee,
      onChange: e => setStandardFee(e.target.value),
      placeholder: "e.g. 100"
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Min Detection",
      type: "number",
      value: minDetection,
      onChange: e => setMinDetection(e.target.value)
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Max Detection",
      type: "number",
      value: maxDetection,
      onChange: e => setMaxDetection(e.target.value)
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Reference Limit Min",
      type: "number",
      value: refLimitMin,
      onChange: e => setRefLimitMin(e.target.value)
    }),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Reference Limit Max",
      type: "number",
      value: refLimitMax,
      onChange: e => setRefLimitMax(e.target.value)
    }),
    /*#__PURE__*/React.createElement("div", { className: "md:col-span-2" },
      /*#__PURE__*/React.createElement(TextField, {
        label: "Reference Standard",
        value: refStandard,
        onChange: e => setRefStandard(e.target.value),
        placeholder: "e.g. Bangladesh Drinking Water Standard"
      })
    )
  )),

  /*#__PURE__*/React.createElement("div", { className: "flex justify-end gap-2 mt-1" },
    /*#__PURE__*/React.createElement(Button, { variant: "outline", onClick: onCancel }, "Cancel"),
    /*#__PURE__*/React.createElement(Button, { onClick: handleSubmit }, initial ? "Update Parameter" : "Save Parameter")
  ));
}

function ParametersTab({
  parameters,
  setParameters,
  testTypes,
  session,
  permissionMatrix,
  notify
}) {
  // Parameters live inside Test Configuration, so they share the "testTypes"
  // module's permissions rather than having their own RBAC bucket.
  const ttCreateGate = permGate(permissionMatrix, session, "testTypes", "create", notify, "add parameters");
  const ttEditGate = permGate(permissionMatrix, session, "testTypes", "edit", notify, "edit parameters");
  const ttDeleteGate = permGate(permissionMatrix, session, "testTypes", "delete", notify, "delete parameters");
  const [view, setView] = useState("list"); // "list" | "form"
  const [editingParam, setEditingParam] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // ---- Export / Import / Template — same pattern as Test Types
  // (12-testtypes-ui.js): per-row "Export" downloads one parameter as a
  // portable .json; "Import Parameters" opens a select → preview →
  // importing → done modal that accepts .xlsx, .csv, or .json; "Download
  // CSV Template" lives inside that modal. Parameters have no
  // chemical/gas/machine dependencies to resolve, so importing is just
  // "create if the Code doesn't already exist, otherwise reuse it".
  const [importOpen, setImportOpen] = useState(false);
  const [importStage, setImportStage] = useState("select"); // select | preview | importing | done
  const [importFile, setImportFile] = useState(null);
  const [importParsed, setImportParsed] = useState(null); // { drafts, errors }
  const [importProgress, setImportProgress] = useState(0);
  const [importFileError, setImportFileError] = useState("");
  const [importSummary, setImportSummary] = useState(null);

  function isParameterUsed(id) {
    return (testTypes || []).some(t => (t.linkedParameterIds || []).includes(id));
  }
  function openAdd() {
    if (!ttCreateGate.allowed) return;
    setEditingParam(null);
    setView("form");
  }
  function openEdit(p) {
    if (!ttEditGate.allowed) return;
    setEditingParam(p);
    setView("form");
  }
  function backToList() {
    setEditingParam(null);
    setView("list");
  }
  function handleSave(param) {
    if (editingParam ? !ttEditGate.allowed : !ttCreateGate.allowed) return;
    if (editingParam) {
      setParameters(prev => prev.map(p => p.id === param.id ? param : p));
      DataService.appendAudit({
        entity: "parameter",
        entityId: param.id,
        action: "edit",
        user: session.username,
        role: session.role,
        note: `Updated parameter "${param.name}"`
      });
      notify(`Parameter "${param.name}" updated`);
    } else {
      setParameters(prev => [...prev, param]);
      DataService.appendAudit({
        entity: "parameter",
        entityId: param.id,
        action: "create",
        user: session.username,
        role: session.role,
        note: `Created parameter "${param.name}"`
      });
      notify(`Parameter "${param.name}" created`);
    }
    setView("list");
    setEditingParam(null);
  }
  function handleDelete(p) {
    if (!ttDeleteGate.allowed) return;
    if (isParameterUsed(p.id)) {
      notify("This parameter is linked to one or more Test Types — unlink it first.", "warn");
      setDeleteFor(null);
      return;
    }
    setParameters(prev => prev.filter(x => x.id !== p.id));
    setDeleteFor(null);
    DataService.appendAudit({
      entity: "parameter",
      entityId: p.id,
      action: "delete",
      user: session.username,
      role: session.role,
      note: `Deleted parameter "${p.name}"`
    });
    notify(`Deleted parameter "${p.name}"`);
  }

  // ---- Export: one parameter as a portable .json — by value, not by id,
  // so it can be dropped into another lab's Parameters list directly. ----
  function exportParameter(p) {
    const payload = {
      schema: "aqualab-parameter-export-v1",
      exportedAt: new Date().toISOString(),
      parameter: {
        code: p.code,
        name: p.name,
        shortName: p.shortName,
        unit: p.unit,
        methodRef: p.methodRef,
        category: p.category,
        decimalPlaces: p.decimalPlaces,
        lod: p.lod,
        loq: p.loq,
        tatHours: p.tatHours,
        standardFee: p.standardFee,
        minDetection: p.minDetection,
        maxDetection: p.maxDetection,
        refLimitMin: p.refLimitMin,
        refLimitMax: p.refLimitMax,
        refStandard: p.refStandard
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parameter_${(p.code || p.name || "export").replace(/[^a-z0-9]+/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Exported parameter "${p.name}"`);
  }
  function downloadParametersTemplate() {
    const header = "Code,Name,ShortName,Unit,MethodRef,Category,DecimalPlaces,LOD,LOQ,TATHours,StandardFee,MinDetection,MaxDetection,RefLimitMin,RefLimitMax,RefStandard";
    const sample1 = "NH3,Ammonia,Ammonia,mg/L,APHA 4500-NH3 B,Nitrogen,2,0.01,0.03,24,100,0,50,,0.5,Bangladesh Drinking Water Standard";
    const sample2 = "pH,pH,pH,,APHA 4500-H+ B,Physical,1,,,4,50,0,14,6.5,8.5,Bangladesh Drinking Water Standard";
    const blob = new Blob([[header, sample1, sample2].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "parameter_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function resetImportModal() {
    setImportStage("select");
    setImportFile(null);
    setImportParsed(null);
    setImportProgress(0);
    setImportFileError("");
  }
  function closeImportModal() {
    setImportOpen(false);
    resetImportModal();
  }
  function handleImportFileChosen(file) {
    setImportFileError("");
    setImportParsed(null);
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["xlsx", "csv", "json"].includes(ext)) {
      setImportFileError("Unsupported file type — please upload a .xlsx, .csv, or .json file.");
      setImportFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImportFileError("File is too large (max 10MB).");
      setImportFile(null);
      return;
    }
    setImportFile(file);
  }
  // Normalizes one raw row (from CSV/XLSX, or a parsed JSON object) into a
  // parameter "draft". Returns null (with an error pushed onto `errors`) if
  // the row has neither a Code nor a Name to key off of.
  function rowToParamDraft(row, rowNum, errors) {
    const code = String(row.Code ?? row.code ?? "").trim();
    const name = String(row.Name ?? row.name ?? "").trim();
    if (!code && !name) {
      errors.push({ row: rowNum, message: "Missing both Code and Name — row skipped." });
      return null;
    }
    const num = v => (v === "" || v === undefined || v === null ? "" : Number(v));
    return {
      code: code || name,
      name: name || code,
      shortName: String(row.ShortName ?? row.shortName ?? "").trim(),
      unit: String(row.Unit ?? row.unit ?? "").trim(),
      methodRef: String(row.MethodRef ?? row.methodRef ?? "").trim(),
      category: String(row.Category ?? row.category ?? "").trim() || "Others",
      decimalPlaces: num(row.DecimalPlaces ?? row.decimalPlaces) === "" ? 2 : num(row.DecimalPlaces ?? row.decimalPlaces),
      lod: num(row.LOD ?? row.lod),
      loq: num(row.LOQ ?? row.loq),
      tatHours: num(row.TATHours ?? row.tatHours),
      standardFee: num(row.StandardFee ?? row.standardFee),
      minDetection: num(row.MinDetection ?? row.minDetection),
      maxDetection: num(row.MaxDetection ?? row.maxDetection),
      refLimitMin: num(row.RefLimitMin ?? row.refLimitMin),
      refLimitMax: num(row.RefLimitMax ?? row.refLimitMax),
      refStandard: String(row.RefStandard ?? row.refStandard ?? "").trim()
    };
  }
  function rowsToDrafts(rows) {
    const errors = [];
    const drafts = [];
    rows.forEach((row, i) => {
      const d = rowToParamDraft(row, i + 2, errors); // +2: header is row 1
      if (d) drafts.push(d);
    });
    return { drafts, errors };
  }
  function parseJsonFile(text) {
    const errors = [];
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { drafts: [], errors: [{ row: "-", message: "This file isn't valid JSON." }] };
    }
    // Accepts: a single { schema, parameter } export, a bare array of those,
    // or a plain array of parameter-shaped objects.
    let items = [];
    if (Array.isArray(data)) items = data.map(x => x && x.parameter ? x.parameter : x);
    else if (data && data.parameter) items = [data.parameter];
    else if (data && typeof data === "object") items = [data];
    if (items.length === 0) {
      return { drafts: [], errors: [{ row: "-", message: "No parameter data found in this file." }] };
    }
    const drafts = [];
    items.forEach((item, i) => {
      const d = rowToParamDraft(item, i + 1, errors);
      if (d) drafts.push(d);
    });
    return { drafts, errors };
  }
  function handleParseFile() {
    if (!importFile) {
      setImportFileError("Please choose a file first.");
      return;
    }
    const ext = (importFile.name.split(".").pop() || "").toLowerCase();
    const reader = new FileReader();
    reader.onerror = () => setImportFileError("Could not read the file.");
    if (ext === "json") {
      reader.onload = e => {
        const { drafts, errors } = parseJsonFile(e.target.result);
        if (drafts.length === 0 && errors.length > 0) {
          setImportFileError(errors[0].message);
          return;
        }
        setImportParsed({ drafts, errors });
        setImportStage("preview");
      };
      reader.readAsText(importFile);
    } else if (ext === "csv") {
      reader.onload = e => {
        const rows = parseCSVText(e.target.result);
        const { drafts, errors } = rowsToDrafts(rows);
        if (drafts.length === 0) {
          setImportFileError(errors[0]?.message || "No valid rows found in this file.");
          return;
        }
        setImportParsed({ drafts, errors });
        setImportStage("preview");
      };
      reader.readAsText(importFile);
    } else if (ext === "xlsx") {
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: "binary" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          const { drafts, errors } = rowsToDrafts(rows);
          if (drafts.length === 0) {
            setImportFileError(errors[0]?.message || "No valid rows found in this sheet.");
            return;
          }
          setImportParsed({ drafts, errors });
          setImportStage("preview");
        } catch {
          setImportFileError("Could not read this Excel file — is it a valid .xlsx?");
        }
      };
      reader.readAsBinaryString(importFile);
    }
  }
  function commitImportDrafts(drafts) {
    let created = 0, reused = 0;
    const names = [];
    setParameters(prev => {
      const next = [...prev];
      drafts.forEach(d => {
        const codeNorm = d.code.trim().toLowerCase();
        const existing = next.find(p => (p.code || "").trim().toLowerCase() === codeNorm);
        if (existing) {
          reused++;
          names.push(existing.name);
          return;
        }
        next.push({
          id: uid("param"),
          code: d.code,
          name: d.name,
          shortName: d.shortName,
          unit: d.unit,
          methodRef: d.methodRef,
          category: d.category,
          decimalPlaces: d.decimalPlaces,
          lod: d.lod,
          loq: d.loq,
          tatHours: d.tatHours,
          standardFee: d.standardFee,
          minDetection: d.minDetection,
          maxDetection: d.maxDetection,
          refLimitMin: d.refLimitMin,
          refLimitMax: d.refLimitMax,
          refStandard: d.refStandard
        });
        created++;
        names.push(d.name);
      });
      return next;
    });
    DataService.appendAudit({
      entity: "parameter",
      entityId: "bulk-import",
      action: "create",
      user: session.username,
      role: session.role,
      note: `Imported parameters — ${created} new, ${reused} reused`
    });
    return { created, reused, names };
  }
  function handleConfirmImport() {
    if (!importParsed || importParsed.drafts.length === 0) return;
    setImportStage("importing");
    setImportProgress(0);
    const total = importParsed.drafts.length;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setImportProgress(Math.min(95, Math.round(step / (total + 1) * 100)));
      if (step >= total) {
        clearInterval(timer);
        const summary = commitImportDrafts(importParsed.drafts);
        setImportProgress(100);
        setImportSummary({ ...summary, rowErrors: importParsed.errors });
        setImportStage("done");
        notify(`Imported parameters: ${summary.created} new, ${summary.reused} reused`);
      }
    }, 180);
  }

  if (view === "form") {
    return /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("div", { className: "flex items-center justify-between mb-4 flex-wrap gap-2" },
        /*#__PURE__*/React.createElement(Button, {
          variant: "outline",
          size: "sm",
          onClick: backToList
        }, /*#__PURE__*/React.createElement(Icon, { name: "arrowLeft", size: 13 }), "Back to List"),
        /*#__PURE__*/React.createElement("div", { className: "text-sm font-semibold", style: { color: C.ink } },
          editingParam ? `Edit Parameter — ${editingParam.name}` : "Add Parameter")
      ),
      /*#__PURE__*/React.createElement(ParameterForm, {
        initial: editingParam,
        onSave: handleSave,
        onCancel: backToList
      })
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = parameters.filter(p => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (!q) return true;
    return [p.code, p.name, p.shortName, p.methodRef].some(v => (v || "").toLowerCase().includes(q));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("div", { className: "text-sm mb-3", style: { color: C.muted } },
      "Define analytical parameters here (code, name, unit, method reference, category, and optional limits). Link them to one or more Test Types in the Test Types sub-tab."),
    /*#__PURE__*/React.createElement("div", { className: "flex items-center justify-between mb-3 flex-wrap gap-2" },
      /*#__PURE__*/React.createElement("div", { className: "flex gap-2 flex-wrap items-center" },
        /*#__PURE__*/React.createElement("label", {
          className: "flex items-center gap-1.5 text-xs",
          style: { color: C.muted }
        }, /*#__PURE__*/React.createElement(Icon, { name: "search", size: 13 }),
          /*#__PURE__*/React.createElement("input", {
            value: search,
            onChange: e => { setSearch(e.target.value); setPage(1); },
            placeholder: "Search code, name, method ref…",
            className: "border rounded px-2 py-1 text-xs w-56",
            style: { borderColor: C.border }
          })),
        /*#__PURE__*/React.createElement("select", {
          value: categoryFilter,
          onChange: e => { setCategoryFilter(e.target.value); setPage(1); },
          className: "border rounded px-2 py-1 text-xs",
          style: { borderColor: C.border, color: C.ink }
        }, /*#__PURE__*/React.createElement("option", { value: "" }, "All categories"),
           PARAMETER_CATEGORIES.map(cat => /*#__PURE__*/React.createElement("option", { key: cat, value: cat }, cat)))
      ),
      /*#__PURE__*/React.createElement("div", { className: "flex gap-2 flex-wrap items-center" },
        ttCreateGate.visible && /*#__PURE__*/React.createElement(Button, {
          variant: "outline",
          size: "sm",
          onClick: ttCreateGate.guard(() => { resetImportModal(); setImportOpen(true); })
        }, /*#__PURE__*/React.createElement(Icon, { name: "upload", size: 14 }), "Import Parameters"),
        ttCreateGate.visible && /*#__PURE__*/React.createElement(Button, {
          size: "sm",
          onClick: ttCreateGate.guard(openAdd)
        }, /*#__PURE__*/React.createElement(Icon, { name: "plus", size: 14 }), "+ Add Parameter")
      )
    ),
    /*#__PURE__*/React.createElement(Banner, {
      tone: "info",
      storageKey: "parameters-import-export-tip"
    }, "Export a parameter to share its full setup (unit, method ref, category, limits) with another lab as a .json file. Importing recreates parameter(s) here from .xlsx, .csv, or .json — reusing any parameter that already exists by Code, and creating whatever is missing."),
    filtered.length === 0 && /*#__PURE__*/React.createElement(EmptyState, {
      icon: "beaker",
      title: parameters.length === 0 ? "No parameters yet" : "No parameters match your search",
      subtitle: parameters.length === 0 ? "Add your first analytical parameter — code, name, unit, and optional limits." : "Try a different code, name, or category.",
      action: (parameters.length === 0 && ttCreateGate.visible) ? /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        onClick: ttCreateGate.guard(openAdd)
      }, /*#__PURE__*/React.createElement(Icon, { name: "plus", size: 13 }), "+ Add Parameter") : undefined
    }),
    filtered.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "rounded-lg overflow-hidden mb-1",
      style: { border: `1px solid ${C.border}` }
    }, /*#__PURE__*/React.createElement("div", { className: "overflow-x-auto max-h-[70vh] overflow-y-auto" },
      /*#__PURE__*/React.createElement("table", { className: "w-full text-sm border-collapse" },
        /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", { style: { background: C.bg } },
          ["Code", "Name", "Short Name", "Unit", "Category", "Method Ref", "TAT (hrs)", ""].map(h =>
            /*#__PURE__*/React.createElement("th", {
              key: h,
              className: "text-left px-3 py-2.5 text-xs font-semibold sticky top-0",
              style: { color: C.muted, background: C.bg, borderBottom: `1px solid ${C.border}`, zIndex: 1 }
            }, h)))),
        /*#__PURE__*/React.createElement("tbody", null, pageRows.map((p, idx) => {
          const usedCount = (testTypes || []).filter(t => (t.linkedParameterIds || []).includes(p.id)).length;
          return /*#__PURE__*/React.createElement("tr", {
            key: p.id,
            style: { borderTop: `1px solid ${C.border}`, background: idx % 2 === 1 ? C.bg : C.card }
          },
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5 font-semibold", style: { color: C.ink } }, p.code),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.ink } }, p.name),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.muted } }, p.shortName || "—"),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.muted } }, p.unit || "—"),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5" },
            /*#__PURE__*/React.createElement(Badge, { tone: PARAMETER_CATEGORY_TONE[p.category] || "muted" }, p.category)),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.muted } }, p.methodRef || "—"),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5", style: { color: C.muted } }, p.tatHours === "" || p.tatHours === undefined || p.tatHours === null ? "—" : p.tatHours),
          /*#__PURE__*/React.createElement("td", { className: "px-3 py-2.5 text-right" },
            /*#__PURE__*/React.createElement("div", { className: "flex items-center justify-end gap-1" },
              usedCount > 0 && /*#__PURE__*/React.createElement(Badge, { tone: "info", title: `Linked to ${usedCount} test type(s)` }, usedCount, " test type", usedCount === 1 ? "" : "s"),
              /*#__PURE__*/React.createElement(IconButton, { name: "download", color: C.info, title: "Export parameter", onClick: () => exportParameter(p) }),
              ttEditGate.visible && /*#__PURE__*/React.createElement(IconButton, { name: "edit", color: C.teal, title: "Edit parameter", onClick: ttEditGate.guard(() => openEdit(p)) }),
              ttDeleteGate.visible && /*#__PURE__*/React.createElement(IconButton, { name: "trash", color: C.warn, title: "Delete parameter", onClick: ttDeleteGate.guard(() => setDeleteFor(p)) })
            ))
          );
        }))
      )),
      deleteFor && /*#__PURE__*/React.createElement("div", { className: "p-2" },
        /*#__PURE__*/React.createElement(ConfirmBar, {
          text: `Delete parameter "${deleteFor.name}"? This cannot be undone.`,
          onConfirm: () => handleDelete(deleteFor),
          onCancel: () => setDeleteFor(null)
        }))
    ),
    /*#__PURE__*/React.createElement(Pagination, {
      page: pageClamped,
      totalPages: totalPages,
      totalItems: filtered.length,
      pageSize: PAGE_SIZE,
      onPageChange: setPage
    }),
    importOpen && /*#__PURE__*/React.createElement(Modal, {
      title: "Import Parameters",
      onClose: closeImportModal
    }, importStage === "select" && /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs p-2 rounded",
      style: { background: C.infoBg, color: C.info }
    }, "Upload an Excel (.xlsx) or CSV file exported from another lab (or a Parameter .json export). One row per parameter — an existing Code is reused, a new Code is created."),
    /*#__PURE__*/React.createElement("button", {
      onClick: () => document.getElementById("paramImportFileInput").click(),
      className: "border-2 border-dashed rounded p-6 flex flex-col items-center gap-2 text-sm",
      style: { borderColor: C.border, color: C.muted, background: C.subtle },
      onDragOver: e => e.preventDefault(),
      onDrop: e => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) handleImportFileChosen(e.dataTransfer.files[0]);
      }
    }, /*#__PURE__*/React.createElement(Icon, { name: "upload", size: 22, color: C.teal }),
    /*#__PURE__*/React.createElement("div", null, "Drag & drop a file here, or ",
      /*#__PURE__*/React.createElement("span", { style: { color: C.teal, fontWeight: 600 } }, "Browse File")),
    /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Supported: .xlsx, .csv, .json — max 10MB")),
    /*#__PURE__*/React.createElement("input", {
      id: "paramImportFileInput",
      type: "file",
      accept: ".xlsx,.csv,.json",
      className: "hidden",
      onChange: e => handleImportFileChosen(e.target.files[0])
    }),
    importFile && /*#__PURE__*/React.createElement("div", {
      className: "text-xs flex items-center gap-1.5",
      style: { color: C.ok }
    }, /*#__PURE__*/React.createElement(Icon, { name: "check", size: 13 }), "Selected: ", importFile.name, " (", (importFile.size / 1024).toFixed(1), " KB)"),
    importFileError && /*#__PURE__*/React.createElement("div", {
      className: "text-xs flex items-center gap-1.5",
      style: { color: C.warn }
    }, /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 13 }), importFileError),
    /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between items-center mt-1"
    }, /*#__PURE__*/React.createElement("button", {
      className: "text-xs underline",
      style: { color: C.teal },
      onClick: downloadParametersTemplate
    }, "Download CSV Template"),
    /*#__PURE__*/React.createElement("div", { className: "flex gap-2" },
      /*#__PURE__*/React.createElement(Button, { variant: "outline", onClick: closeImportModal }, "Cancel"),
      /*#__PURE__*/React.createElement(Button, {
        disabled: !importFile,
        onClick: handleParseFile
      }, /*#__PURE__*/React.createElement(Icon, { name: "upload", size: 14 }), "Upload")))),
    importStage === "preview" && importParsed && /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs p-2 rounded flex items-center gap-1.5",
      style: { background: C.okBg, color: C.ok }
    }, /*#__PURE__*/React.createElement(Icon, { name: "check", size: 13 }), "Parsed ", importParsed.drafts.length, " parameter", importParsed.drafts.length === 1 ? "" : "s", " from \"", importFile?.name, "\"."),
    /*#__PURE__*/React.createElement("div", { className: "max-h-52 overflow-y-auto flex flex-col gap-1.5" },
      importParsed.drafts.map((d, i) => /*#__PURE__*/React.createElement("div", {
        key: i,
        className: "text-xs p-2 rounded",
        style: { border: `1px solid ${C.border}` }
      }, /*#__PURE__*/React.createElement("div", {
        className: "font-semibold",
        style: { color: C.ink }
      }, [d.code, d.name].filter(Boolean).join(" — ") || `Parameter #${i + 1}`),
      /*#__PURE__*/React.createElement("div", { style: { color: C.muted } },
        d.unit ? `Unit: ${d.unit}` : "No unit", " · ", d.category)))),
    importParsed.errors.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "p-2 rounded",
      style: { background: C.warnBg }
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs font-semibold mb-1",
      style: { color: C.warn }
    }, importParsed.errors.length, " row issue(s) — these rows were skipped, the rest will still import:"),
    importParsed.errors.slice(0, 8).map((er, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "text-xs",
      style: { color: C.warn }
    }, "Row ", er.row, ": ", er.message)),
    importParsed.errors.length > 8 && /*#__PURE__*/React.createElement("div", {
      className: "text-xs",
      style: { color: C.warn }
    }, "...and ", importParsed.errors.length - 8, " more")),
    /*#__PURE__*/React.createElement("div", { className: "flex justify-end gap-2" },
      /*#__PURE__*/React.createElement(Button, { variant: "outline", onClick: resetImportModal }, "Back"),
      /*#__PURE__*/React.createElement(Button, { onClick: handleConfirmImport },
        /*#__PURE__*/React.createElement(Icon, { name: "check", size: 14 }), "Import"))),
    importStage === "importing" && /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-3 items-center py-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-sm",
      style: { color: C.ink }
    }, "Importing ", importParsed?.drafts.length, " parameter(s)..."),
    /*#__PURE__*/React.createElement("div", {
      className: "w-full h-2 rounded overflow-hidden",
      style: { background: C.border }
    }, /*#__PURE__*/React.createElement("div", {
      className: "h-full transition-all",
      style: { width: `${importProgress}%`, background: C.teal }
    })),
    /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, importProgress, "%")),
    importStage === "done" && importSummary && /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-2 text-sm"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs p-2 rounded flex items-center gap-1.5",
      style: { background: C.okBg, color: C.ok }
    }, /*#__PURE__*/React.createElement(Icon, { name: "check", size: 13 }), "Success — ", importSummary.created, " new, ", importSummary.reused, " reused."),
    importSummary.rowErrors && importSummary.rowErrors.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "mt-1 p-2 rounded",
      style: { background: C.warnBg, color: C.warn }
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs font-semibold mb-1"
    }, "Error Summary — ", importSummary.rowErrors.length, " row(s) skipped:"),
    importSummary.rowErrors.slice(0, 8).map((er, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "text-xs"
    }, "Row ", er.row, ": ", er.message))),
    /*#__PURE__*/React.createElement("div", { className: "flex justify-end mt-2" },
      /*#__PURE__*/React.createElement(Button, { onClick: closeImportModal }, "Done"))))
  );
}
