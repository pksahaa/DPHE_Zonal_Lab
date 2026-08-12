// ===== 10-inventory-logic.js =====
// ============================================================================
// INVENTORY BUSINESS LOGIC — pure functions: normalization, FEFO allocation,
// batch deduction/restoration, gas cylinder deduction, Excel import/export,
// label printing. No React here — keeps calculation logic unit-testable and
// reusable from the Test Method Engine / Sample module too.
// ============================================================================
// ---------------- Chemical inventory logic ----------------
function normalizeChemicals(chemicals) {
  return (chemicals || []).map(c => ({
    ...c,
    batches: (c.batches || []).map(b => ({
      origin: "",
      receivedFrom: "",
      manufacturingDate: "",
      expiryType: "exact",
      shelfLifeYears: 0,
      expiredOverrides: [],
      batchName: "",
      ...b
    }))
  }));
}
function normalizeGlassware(glassware) {
  return (glassware || []).map(g => ({
    origin: "",
    receivedFrom: "",
    brokenLog: [],
    ...g
  }));
}
// Parameters (Test Configuration › Parameters) — analytical parameters such as
// Ammonia (NH3), pH, Arsenic, etc. Deliberately decoupled from the "Test Method
// Engine" fields (chemical/gas requirements, formulas, instrument linking) that
// live on Test Type — a Parameter is just the definition/reference-limit record
// that one or more Test Types then link to.
function normalizeParameters(parameters) {
  return (parameters || []).map(p => ({
    id: p.id,
    code: p.code || "",
    name: p.name || "",
    shortName: p.shortName || "",
    unit: p.unit || "",
    methodRef: p.methodRef || "",
    category: p.category || "Others",
    decimalPlaces: Number.isFinite(Number(p.decimalPlaces)) ? Number(p.decimalPlaces) : 2,
    lod: p.lod ?? "",
    loq: p.loq ?? "",
    tatHours: p.tatHours ?? "",
    standardFee: p.standardFee ?? "",
    minDetection: p.minDetection ?? "",
    maxDetection: p.maxDetection ?? "",
    refLimitMin: p.refLimitMin ?? "",
    refLimitMax: p.refLimitMax ?? "",
    refStandard: p.refStandard || ""
  }));
}
function normalizeEquipment(equipment) {
  return (equipment || []).map(eq => ({
    origin: "",
    receivedFrom: "",
    ...eq
  }));
}
// Gas cylinders (Acetylene, Argon, etc.) — tracked separately from chemicals because they arrive as
// refillable cylinders (usually topped up in kg) rather than single-use bottles/batches.
function normalizeGas(gasList) {
  return (gasList || []).map(g => ({
    unit: "kg",
    ...g,
    cylinders: (g.cylinders || []).map(c => ({
      history: [],
      origin: "",
      receivedFrom: "",
      name: "",
      ...c,
      status: c.status || (c.remaining > 0 ? "active" : "empty")
    }))
  }));
}
// Migrates old test-type records to the current schema:
//  - chemicalRequirements: "sampleAmount" items now carry a sampleSource ("field" | "standard" | "both")
//    so each item can be tied to either the No. of Field Samples or No. of Standard Samples entered in
//    Add Test Record (older items without this choice default to "both", preserving old totals).
//  - gasRequirements / dilutionGasRequirements are now a flat, name-only link list — {gasId, gasName} —
//    with no amount/calculation (gas usage per sample is too hard to model precisely, so it's tracked
//    manually in the Gas inventory instead; here we just record which gas(es) a test may need).
//  - dilutionEnabled / dilutionChemicalRequirements / dilutionGasRequirements: an optional extra set of
//    requirements that only apply when a record is marked "Dilution Required".
function normalizeTestTypes(testTypes) {
  const migrateChemItems = items => (items || []).map(item => {
    if (item.type === "volumetric") {
      return {
        id: item.id,
        label: item.label,
        type: "volumetric",
        scaling: item.scaling || "sampleAmount",
        solutionVolume: Number(item.solutionVolume) || 100,
        defaultPercent: Number(item.defaultPercent) || 0,
        defaultAmount: Number(item.defaultAmount) || 0,
        sampleSource: item.sampleSource || "both"
      };
    }
    if (item.type === "countAmount" || item.type === "sampleAmount") {
      return {
        id: item.id,
        label: item.label,
        type: "sampleAmount",
        amountLabel: item.amountLabel || "Amount required per sample",
        defaultAmount: Number(item.defaultAmount) || 0,
        sampleSource: item.sampleSource || "both"
      };
    }
    return {
      id: item.id,
      label: item.label,
      type: "direct",
      defaultValue: Number(item.defaultValue) || 0
    };
  });
  const migrateDilutionItems = items => (items || []).map(item => {
    if (item.type === "direct") return {
      id: item.id,
      label: item.label,
      type: "direct",
      defaultValue: Number(item.defaultValue) || 0
    };
    if (item.type === "volumetric") return {
      id: item.id,
      label: item.label,
      type: "volumetric",
      scaling: item.scaling || "sampleAmount",
      solutionVolume: Number(item.solutionVolume) || 100,
      defaultPercent: Number(item.defaultPercent) || 0,
      defaultAmount: Number(item.defaultAmount) || 0
    };
    return {
      id: item.id,
      label: item.label,
      type: "sampleAmount",
      amountLabel: item.amountLabel || "Amount required per diluted sample",
      defaultAmount: Number(item.defaultAmount) || 0
    };
  });
  const migrateGasList = list => (list || []).map(g => g.gasId !== undefined ? {
    gasId: g.gasId,
    gasName: g.gasName || ""
  } : {
    gasId: "",
    gasName: g.chemical || g.gasName || g.name || ""
  });
  return (testTypes || []).map(t => {
    const chemicalRequirements = (t.chemicalRequirements || t.requirements || []).map(req => ({
      ...req,
      items: migrateChemItems(req.items)
    }));
    const dilutionChemicalRequirements = (t.dilutionChemicalRequirements || []).map(req => ({
      ...req,
      items: migrateDilutionItems(req.items)
    }));
    return {
      feeApplicable: true,
      defaultEquipmentId: "",
      dilutionEnabled: false,
      resultParameters: t.resultParameters || [],
      qcRules: t.qcRules || [],
      // Many-to-many link to the Parameters sub-tab (Test Configuration ›
      // Parameters). Stored as a flat array of Parameter ids, same pattern
      // already used for gasRequirements/chemicalRequirements above.
      linkedParameterIds: t.linkedParameterIds || [],
      testName: t.testName ?? t.name ?? "",
      method: t.method ?? "",
      ...t,
      chemicalRequirements,
      dilutionChemicalRequirements,
      gasRequirements: migrateGasList(t.gasRequirements),
      dilutionGasRequirements: migrateGasList(t.dilutionGasRequirements),
      name: t.name || [t.testName, t.method].filter(Boolean).join("-")
    };
  });
}
function markExpiredBatches(chemicals) {
  const today = todayStr();
  return chemicals.map(c => ({
    ...c,
    batches: c.batches.map(b => {
      if (b.status === "depleted") return b;
      if (b.expiryDate < today && b.status !== "expired") return {
        ...b,
        status: "expired"
      };
      if (b.expiryDate >= today && b.status === "expired") return {
        ...b,
        status: "active"
      };
      return b;
    })
  }));
}
function fefoSuggestion(chemical) {
  if (!chemical) return null;
  const active = chemical.batches.filter(b => b.status === "active" && b.remaining > 0);
  active.sort((a, b) => a.expiryDate < b.expiryDate ? -1 : 1);
  return active[0] || null;
}
function deductFromChemical(chemical, amount, preferredBatchId) {
  let batches = chemical.batches.map(b => ({
    ...b
  }));
  // Normally only "active" (non-expired) batches are eligible. An expired batch only enters the pool
  // when explicitly hand-picked (preferredBatchId) — i.e. the tester consciously overrode the expiry warning.
  const order = [...batches].filter(b => b.remaining > 0 && (b.status === "active" || preferredBatchId && b.id === preferredBatchId && b.status === "expired")).sort((a, b) => a.expiryDate < b.expiryDate ? -1 : 1);
  if (preferredBatchId) {
    const idx = order.findIndex(b => b.id === preferredBatchId);
    if (idx > 0) {
      const [chosen] = order.splice(idx, 1);
      order.unshift(chosen);
    }
  }
  let left = amount;
  const usedFrom = [];
  for (const b of order) {
    if (left <= 0) break;
    const take = Math.min(b.remaining, left);
    if (take <= 0) continue;
    const target = batches.find(x => x.id === b.id);
    target.remaining = +(target.remaining - take).toFixed(4);
    if (target.remaining <= 0) {
      target.remaining = 0;
      target.status = "depleted";
    }
    left = +(left - take).toFixed(4);
    usedFrom.push({
      batchId: b.id,
      amount: take
    });
  }
  return {
    batches,
    shortfall: +left.toFixed(4),
    usedFrom
  };
}
function restoreConsumption(chemicals, bottleLog) {
  if (!bottleLog) return chemicals;
  return chemicals.map(c => {
    const arr = bottleLog[c.name];
    if (!arr || arr.length === 0) return c;
    const batches = c.batches.map(b => ({
      ...b
    }));
    arr.forEach(u => {
      const b = batches.find(x => x.id === u.batchId);
      if (b) {
        b.remaining = +(b.remaining + u.amount).toFixed(4);
        if (b.remaining > 0 && b.status === "depleted") b.status = "active";
      }
    });
    return {
      ...c,
      batches
    };
  });
}
// Deducts `amount` from one specific cylinder (tester picks which cylinder was used, since a gas type
// can have several cylinders in stock at once). Unlike chemicals there's no FEFO auto-pick — the tester
// must choose the cylinder directly, and consumption only ever comes from that one cylinder.
function deductFromGasCylinder(gasList, gasId, cylinderId, amount) {
  let shortfall = 0;
  const next = gasList.map(g => {
    if (g.id !== gasId) return g;
    return {
      ...g,
      cylinders: g.cylinders.map(c => {
        if (c.id !== cylinderId) return c;
        const take = Math.min(c.remaining, amount);
        shortfall = +(amount - take).toFixed(4);
        const remaining = +(c.remaining - take).toFixed(4);
        return {
          ...c,
          remaining,
          status: remaining <= 0 ? "empty" : c.status
        };
      })
    };
  });
  return {
    gasList: next,
    shortfall
  };
}
function restoreGasConsumption(gasList, gasLog) {
  if (!gasLog) return gasList;
  return gasList.map(g => {
    const entries = gasLog.filter(e => e.gasId === g.id);
    if (entries.length === 0) return g;
    return {
      ...g,
      cylinders: g.cylinders.map(c => {
        const e = entries.find(x => x.cylinderId === c.id);
        if (!e) return c;
        const remaining = Math.min(c.capacity, +(c.remaining + e.amount).toFixed(4));
        return {
          ...c,
          remaining,
          status: remaining > 0 ? "active" : c.status
        };
      })
    };
  });
}
function isBatchUsedInTests(batchId, testRecords) {
  return testRecords.some(r => Object.values(r.bottleLog || {}).some(arr => (arr || []).some(u => u.batchId === batchId)));
}

// ---------------- Excel import / template helpers ----------------
function readWorkbook(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, {
        type: "binary"
      });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: ""
      });
      cb(null, rows);
    } catch (err) {
      cb(err);
    }
  };
  reader.onerror = () => cb(new Error("Could not read file"));
  reader.readAsBinaryString(file);
}
// Small dependency-free CSV parser (quoted fields, escaped quotes) shared by
// every module's Import flow (Test Types, Parameters, ...) so there's one
// implementation to trust instead of several copies drifting apart.
function parseCSVText(text) {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim() !== "");
  if (lines.length === 0) return [];
  function splitLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQuotes = false;
        } else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;else if (ch === ",") {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  }
  const headers = splitLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    return obj;
  });
}
function downloadTemplate(kind) {
  let headers, rows;
  if (kind === "samples") {
    // Columns come from SAMPLE_IMPORT_COLUMNS (00-core.js) — the same definition
    // the Bulk Upload parser reads from — so the template can't drift out of
    // sync with what's actually accepted on import again.
    // Note: Requested Tests, Client Type/Source, and Tracking No./Reference are
    // no longer per-row columns — after uploading this file you'll pick the
    // tests and enter the Client/Reference details once, in-app.
    // Note: CollectionDate can be left blank per row — any row without one
    // gets the start date of the Collection Date Range entered on the same
    // "a few more details" screen used to pick tests/Client after upload.
    // Note: Priority is also no longer a per-row column — it's picked once,
    // for the whole upload, on the same "a few more details" screen.
    headers = SAMPLE_IMPORT_COLUMNS.map(c => c.header);
    rows = [["Md. Musha Mia", "Md. Abdul Karim", "Rangpur", "Sadar", "Chandanpat", "Sreerampur", "25.7439", "89.2752", "Shallow TW (STW)", "", "STW-6", "TW-1234", "Drinking Water", "2026-01-10", "Field Team A", "2026-01-12"], ["Md. Moynul Hossain", "Md. Rafiqul Islam", "Rangpur", "Sadar", "City Corporation", "New Jummapara", "25.7501", "89.2612", "Deep TW (DTW)", "", "DTW-9", "TW-5678", "Drinking Water", "", "Field Team A", "2026-01-12"]];
  } else if (kind === "chemicals") {
    headers = ["ChemicalName", "Unit", "DateReceived", "ExpiryDate", "Amount", "Origin", "ReceivedFrom"];
    rows = [["Fe Standard", "ml", "2026-01-10", "2026-07-10", 500, "Central Reagent Store", "DPHE Water Safety Project"], ["HCl", "ml", "2026-01-10", "2026-12-31", 1000, "Local Chemical Supplier", "Zonal Office Procurement"]];
  } else if (kind === "glassware") {
    headers = ["Name", "DateReceived", "TotalQuantity", "Origin", "ReceivedFrom"];
    rows = [["Conical Flask 250ml", "2026-01-10", 20, "Central Glassware Store", "DPHE Water Safety Project"], ["Burette 50ml", "2026-01-10", 10, "Central Glassware Store", "Zonal Office Procurement"]];
  } else {
    headers = ["Name", "DateReceived", "Origin", "ReceivedFrom"];
    rows = [["Turbidity Meter", "2026-01-10", "Manufacturer — HACH", "DPHE Water Safety Project"], ["Digital Balance", "2026-01-10", "Manufacturer — Sartorius", "Zonal Office Procurement"]];
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, `${kind}_import_template.xlsx`);
}

// Opens a small print-friendly window for a bottle/cylinder label (sticker to attach to the container).
function printLabel({
  title,
  lines
}) {
  const w = window.open("", "_blank", "width=420,height=320");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Label</title><style>
    body{font-family:Inter,system-ui,sans-serif;margin:0;padding:14px;}
    .lbl{border:2px solid #123437;border-radius:8px;padding:14px;max-width:340px;}
    .lbl h2{margin:0 0 8px;font-size:18px;color:#123437;}
    .lbl div{font-size:13px;margin:3px 0;color:#123437;}
    .lbl b{color:#028090;}
  </style></head><body>
    <div class="lbl"><h2>${title}</h2>${lines.map(l => `<div><b>${l.k}:</b> ${l.v}</div>`).join("")}</div>
    <script>window.print();<\/script>
  </body></html>`);
  w.document.close();
}

// ============================================================================
// LOGIN PAGE
// ============================================================================
