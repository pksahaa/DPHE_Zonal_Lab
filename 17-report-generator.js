// ===== 17-report-generator.js =====
// ============================================================================
// CUSTOM REPORT GENERATOR — assembles the official lab report (matching the
// DPHE Zonal Lab "Physical/Chemical/Bacteriological Analysis of Water Sample"
// format) from already-registered Samples and their Test Records. Per-sample
// facts (address, caretaker, source) and lab identity (letterhead) are pulled
// automatically; only the per-report memo/reference fields and signatories
// are entered here, since those change with every memo.
// ============================================================================

function fmtResultValue(v) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

// Builds the full printable HTML document for the report. Pure function —
// no React — so it's easy to hand straight to a print window, matching the
// existing printLabel() pattern in 10-inventory-logic.js.
function buildReportHtml({
  labIdentity,
  memo,
  selectedSamples,
  selectedTests,
  testRecords,
  signatories
}) {
  const sorted = [...selectedSamples].sort((a, b) => a.sampleCode < b.sampleCode ? -1 : a.sampleCode > b.sampleCode ? 1 : 0);
  const firstCode = sorted[0]?.sampleCode || "";
  const lastCode = sorted[sorted.length - 1]?.sampleCode || "";
  const sampleIdLine = sorted.length > 1 ? `${firstCode} To ${lastCode}, Total: ${String(sorted.length).padStart(2, "0")}` : `${firstCode}, Total: 01`;
  const logoLeft = labIdentity.leftLogoDataUrl ? `<img src="${labIdentity.leftLogoDataUrl}" style="height:56px">` : "";
  const logoRight = labIdentity.rightLogoDataUrl ? `<img src="${labIdentity.rightLogoDataUrl}" style="height:56px">` : "";
  const testHeaderCells = selectedTests.map(t => `<th colspan="2">${t.name}${t.reportLimit ? ` <br><span style="font-weight:400">${t.reportLimit}</span>` : ""}</th>`).join("");
  const testSubHeaderCells = selectedTests.map(() => `<th>Conc.</th><th>Method</th>`).join("");
  const bodyRows = sorted.map(s => {
    const cells = selectedTests.map(t => {
      const found = getSampleResultForTest(s, t.id, testRecords);
      const val = found ? fmtResultValue(found.results?.[0]?.value ?? (found.results?.[0]?.error ? "-" : "-")) : "-";
      const method = found ? t.method || "-" : "-";
      return `<td>${val}</td><td>${method}</td>`;
    }).join("");
    return `<tr>
      <td>${s.sampleCode}</td>
      <td>${s.clientName || "-"}</td>
      <td>${s.village || "-"}</td>
      <td>${s.union || "-"}</td>
      <td>${s.upazila || "-"}</td>
      ${cells}
    </tr>`;
  }).join("");
  const signBlock = side => (signatories[side] || []).map((sig, i) => `
    <div style="margin-top:${i === 0 ? "4" : "14"}px;font-size:12px;">
      ${i + 1}.) Name: ${sig.name || ""}<br>
      Designation: ${sig.designation || ""}
      <div style="height:40px;"></div>
    </div>`).join("");
  return `<!DOCTYPE html><html><head><title>${memo.memoNo || "Lab Report"}</title><style>
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; margin: 0; padding: 24px; color: #111; font-size: 13px; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .header-table td { border: 2px solid #111; padding: 6px; vertical-align: middle; }
    .header-table .logo-cell { width: 70px; text-align: center; }
    .header-table .org-cell { text-align: center; font-weight: bold; }
    .org-cell .line1, .org-cell .line2, .org-cell .line3 { margin: 1px 0; }
    .org-cell .lab-name { margin: 2px 0; }
    .org-cell .contact { font-weight: normal; font-size: 11px; margin-top: 2px; }
    .memo-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 12px; }
    .report-title { text-align: center; font-weight: bold; text-decoration: underline; margin: 14px 0 8px; font-size: 14px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
    .info-table td { border: 1px solid #111; padding: 5px 8px; }
    .result-title { text-align: center; font-weight: bold; text-decoration: underline; margin: 10px 0 6px; font-size: 13px; }
    .result-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .result-table th, .result-table td { border: 1px solid #111; padding: 4px 6px; text-align: center; }
    .result-table th { background: #f2f2f2; }
    .note { font-size: 10px; margin-top: 8px; }
    .sign-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    .sign-table td { border: 1px solid #111; padding: 8px; vertical-align: top; width: 50%; }
    .sign-table .sign-title { font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
    @media print { body { padding: 10px; } }
  </style></head><body>
    <table class="header-table"><tr>
      <td class="logo-cell">${logoLeft}</td>
      <td class="org-cell">
        <div class="line1">${labIdentity.orgLine1 || ""}</div>
        <div class="line2">${labIdentity.orgLine2 || ""}</div>
        <div class="line3">${labIdentity.orgLine3 || ""}</div>
        <div class="lab-name">${labIdentity.labName || ""}</div>
        <div class="contact">${labIdentity.phone ? `Phone: ${labIdentity.phone}` : ""}${labIdentity.phone && labIdentity.email ? ", " : ""}${labIdentity.email ? `E-mail: ${labIdentity.email}` : ""}</div>
      </td>
      <td class="logo-cell">${logoRight}</td>
    </tr></table>
    <div class="memo-row"><span>Memo No: ${memo.memoNo || ""}</span><span>Date: ${memo.date || ""}</span></div>
    <div class="report-title">Physical/Chemical/Bacteriological Analysis of Water Sample</div>
    <table class="info-table">
      <tr><td>Sample ID: ${sampleIdLine}</td><td>District: ${memo.district || ""}</td></tr>
      <tr><td>Sent by: ${memo.sentBy || ""}</td><td>Sample Source: ${memo.sampleSource || ""}</td></tr>
      <tr><td>Ref: Memo No: ${memo.refMemoNo || ""}${memo.refMemoDate ? ` & Dated: ${memo.refMemoDate}` : ""}</td><td>Date of Testing: ${memo.dateOfTesting || ""}</td></tr>
      <tr><td>Collection Date: ${memo.collectionDate || "Not Mention"}</td><td>Receiving Date: ${memo.receivingDate || ""}</td></tr>
    </table>
    <div class="result-title">LABORATORY TEST RESULT</div>
    <table class="result-table">
      <thead>
        <tr>
          <th rowspan="2">Sample ID</th>
          <th rowspan="2">Caretaker Name</th>
          <th rowspan="2">Village/Ward</th>
          <th rowspan="2">Union/<br>Pourashava</th>
          <th rowspan="2">Upazila/City<br>corporation</th>
          ${testHeaderCells}
        </tr>
        <tr>${testSubHeaderCells}</tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    ${memo.notes ? `<div class="note">Note: ${memo.notes}</div>` : ""}
    <table class="sign-table"><tr>
      <td><div class="sign-title">Test Performed by: <span style="float:right;text-decoration:underline;">Signature</span></div>${signBlock("performedBy")}</td>
      <td><div class="sign-title">Countersigned/Approved by: <span style="float:right;text-decoration:underline;">Signature</span></div>${signBlock("approvedBy")}</td>
    </tr></table>
    <script>window.print();<\/script>
  </body></html>`;
}
function printOfficialReport(html) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
function SignatorySlot({
  index,
  value,
  onChange,
  users
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1.5 p-2 rounded mb-2",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: "",
    onChange: e => {
      const u = users.find(x => x.id === e.target.value);
      if (u) onChange({
        name: u.name,
        designation: u.designation || ""
      });
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Pick from Users…"), users.map(u => /*#__PURE__*/React.createElement("option", {
    key: u.id,
    value: u.id
  }, u.name, " (", u.designation || u.role, ")"))), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: `Name ${index}`,
    value: value.name,
    onChange: v => onChange({
      ...value,
      name: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Designation",
    value: value.designation,
    onChange: v => onChange({
      ...value,
      designation: v
    })
  }));
}
function CustomReportGeneratorPage({
  samples,
  setSamples,
  references,
  subBatches,
  testTypes,
  testRecords,
  users,
  session,
  goToSample,
  notify,
  forceMode
}) {
  const [q, setQ] = React.useState("");
  const [selectedSampleIds, setSelectedSampleIds] = React.useState([]);
  const [selectedTestIds, setSelectedTestIds] = React.useState([]);
  const [memo, setMemo] = React.useState({
    memoNo: "",
    date: todayStr(),
    sentBy: "",
    district: "",
    sampleSource: "",
    refMemoNo: "",
    refMemoDate: "",
    dateOfTesting: todayStr(),
    receivingDate: "",
    collectionDate: "",
    notes: ""
  });
  const [signatories, setSignatories] = React.useState({
    performedBy: [{
      name: "",
      designation: ""
    }],
    approvedBy: [{
      name: "",
      designation: ""
    }]
  });
  const [selectionMode, setSelectionMode] = React.useState(forceMode || "individual"); // "individual" | "batch" | "subbatch"
  const [reportReferenceId, setReportReferenceId] = React.useState("");
  const [reportSubBatchId, setReportSubBatchId] = React.useState("");
  const filteredSamples = (samples || []).filter(s => !q || `${s.sampleCode} ${s.clientName} ${s.siteLocation} ${s.village}`.toLowerCase().includes(q.toLowerCase()));
  // Reporting is done by Reference (the actual source paperwork — DPHE /
  // institution / walk-in letter+ref no.), not by whichever Sub-Batch
  // happened to test the samples. Only list References that have at least
  // one sample pointing at them.
  const referenceOptions = Array.from(new Set((samples || []).map(s => s.referenceId).filter(Boolean))).map(id => findReferenceById(references, id)).filter(Boolean).sort((a, b) => (a.refNo || "").localeCompare(b.refNo || ""));
  const reportSubBatchOptions = [...(subBatches || [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const selectedReportSubBatch = reportSubBatchId ? (subBatches || []).find(sb => sb.id === reportSubBatchId) : null;
  const selectedSamples = (samples || []).filter(s => selectedSampleIds.includes(s.id));
  const availableTestIds = React.useMemo(() => {
    const ids = new Set();
    selectedSamples.forEach(s => s.requestedTests.forEach(rt => ids.add(rt.testTypeId)));
    return Array.from(ids);
  }, [selectedSampleIds]);
  React.useEffect(() => {
    // In Sub-Batch mode the test column is implied by the picked Sub-Batch
    // (set explicitly when it's chosen) — don't let this effect widen it
    // back out to every test type the member samples have ever requested.
    if (selectionMode === "subbatch") return;
    setSelectedTestIds(availableTestIds);
    // eslint-disable-next-line
  }, [availableTestIds.join(","), selectionMode]);
  const selectedTests = testTypes.filter(t => selectedTestIds.includes(t.id));
  function toggleSample(id) {
    if (forceMode === "individual") {
      setSelectedSampleIds(prev => prev.includes(id) ? [] : [id]);
      return;
    }
    setSelectedSampleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleTest(id) {
    setSelectedTestIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function updateSignatory(side, idx, value) {
    setSignatories(prev => ({
      ...prev,
      [side]: prev[side].map((s, i) => i === idx ? value : s)
    }));
  }
  function addSignatory(side) {
    if (signatories[side].length >= 2) return;
    setSignatories(prev => ({
      ...prev,
      [side]: [...prev[side], {
        name: "",
        designation: ""
      }]
    }));
  }
  function generate() {
    if (selectedSamples.length === 0) {
      notify?.("Select at least one sample first.", "warn");
      return;
    }
    if (selectedTests.length === 0) {
      notify?.("Select at least one test to include as a column.", "warn");
      return;
    }
    // Hard gate — a report can't be produced for a column that has no
    // result yet at all (as opposed to the softer "not approved yet"
    // check further down, which still lets the report print).
    const missingResults = [];
    selectedSamples.forEach(sample => {
      selectedTests.forEach(t => {
        const rt = (sample.requestedTests || []).find(r => r.testTypeId === t.id);
        if (!rt) return; // this sample never requested this column — not this gate's concern
        if (rt.status === "pending" || rt.status === "in_progress") {
          missingResults.push(`${sample.sampleCode} — ${t.name}`);
        }
      });
    });
    if (missingResults.length) {
      notify?.(`Can't generate — ${missingResults.length} selected parameter(s) don't have a result entered yet: ${missingResults.slice(0, 6).join(", ")}${missingResults.length > 6 ? "…" : ""}. Remove them from the selection, or enter their results first.`, "warn");
      return;
    }
    const html = buildReportHtml({
      labIdentity: getLabIdentity(),
      memo,
      selectedSamples,
      selectedTests,
      testRecords,
      signatories
    });
    printOfficialReport(html);
    // Per the workflow doc, a report should only be generated after
    // approval — this is a soft check (warn, don't block) since not every
    // lab necessarily runs every parameter through the formal review step.
    if (setSamples) {
      const notYetApproved = [];
      selectedSamples.forEach(sample => {
        let updated = sample;
        selectedTests.forEach(t => {
          const rt = (sample.requestedTests || []).find(r => r.testTypeId === t.id);
          if (!rt) return; // this sample didn't request this column
          if (rt.status === "approved") {
            updated = setRequestedTestStatus(updated, t.id, "released", session);
          } else if (rt.status !== "released") {
            notYetApproved.push(`${sample.sampleCode} — ${t.name}`);
          }
        });
        if (updated !== sample) {
          setSamples(prev => prev.map(s => s.id === sample.id ? updated : s), updated);
        }
      });
      if (notYetApproved.length) {
        notify?.(`Report generated — but ${notYetApproved.length} parameter(s) hadn't been through final approval yet, so they weren't marked Released: ${notYetApproved.slice(0, 5).join(", ")}${notYetApproved.length > 5 ? "…" : ""}.`, "warn");
      }
    }
  }
  // ---- Step 1 selection, built as plain variables (Individual / Batch-by-
  // Reference / Sub-Batch) instead of one giant nested expression. ----
  const modeSelectorRow = forceMode ? null : /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs mb-2",
    style: { color: C.muted }
  }, "How are you selecting samples?", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: { borderColor: C.border },
    value: selectionMode,
    onChange: e => {
      const mode = e.target.value;
      setSelectionMode(mode);
      setReportReferenceId("");
      setReportSubBatchId("");
      setSelectedSampleIds([]);
    }
  }, /*#__PURE__*/React.createElement("option", { value: "individual" }, "Individual Samples"), /*#__PURE__*/React.createElement("option", { value: "batch" }, "Batch (by Reference)"), /*#__PURE__*/React.createElement("option", { value: "subbatch" }, "Analytical Batch")));

  const individualModeBlock = selectionMode !== "individual" ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    className: "border rounded px-2 py-1.5 text-xs w-full mb-2",
    style: { borderColor: C.border },
    placeholder: "Search by sample code, client, site, village…",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedSampleIds(filteredSamples.map(s => s.id))
  }, "Select All Filtered"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedSampleIds([])
  }, "Clear")), /*#__PURE__*/React.createElement("div", {
    className: "max-h-56 overflow-y-auto rounded",
    style: { border: `1px solid ${C.border}` }
  }, filteredSamples.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2",
    style: { color: C.muted }
  }, "No samples match.") : /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["", "Sample", "Client", "Site / Village", "Reference", ""].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    className: "text-left px-2 py-1.5 sticky top-0",
    style: { background: C.card, borderBottom: `1px solid ${C.border}`, color: C.muted }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filteredSamples.map(s => {
    const ref = s.referenceId ? findReferenceById(references, s.referenceId) : null;
    return /*#__PURE__*/React.createElement("tr", {
      key: s.id,
      className: "cursor-pointer",
      style: { background: selectedSampleIds.includes(s.id) ? `${C.teal}14` : "transparent" },
      onClick: () => toggleSample(s.id)
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: selectedSampleIds.includes(s.id),
      onChange: () => toggleSample(s.id),
      onClick: e => e.stopPropagation()
    })), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5 font-semibold"
    }, s.sampleCode), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: { color: C.muted }
    }, s.clientName), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: { color: C.muted }
    }, `${s.siteLocation}${s.village ? ` · ${s.village}` : ""}`), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: { color: C.muted }
    }, ref ? referenceDisplayLabel(ref) : "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5"
    }, goToSample && /*#__PURE__*/React.createElement("button", {
      type: "button",
      title: "View full sample record",
      style: { color: C.info },
      onClick: e => {
        e.preventDefault();
        e.stopPropagation();
        goToSample(s.id);
      }
    }, "↗")));
  })))));

  const batchModeBlock = selectionMode !== "batch" ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm w-full mb-2",
    style: { borderColor: C.border },
    value: reportReferenceId,
    onChange: e => {
      const refId = e.target.value;
      setReportReferenceId(refId);
      const ref = findReferenceById(references, refId);
      if (!ref) {
        setSelectedSampleIds([]);
        return;
      }
      setSelectedSampleIds((samples || []).filter(s => s.referenceId === ref.id).map(s => s.id));
      setMemo(prev => ({
        ...prev,
        refMemoNo: ref.isAutoGenerated ? prev.refMemoNo : ref.refNo,
        refMemoDate: ref.letterDate || prev.refMemoDate,
        sampleSource: ref.organizationName || prev.sampleSource
      }));
    }
  }, [/*#__PURE__*/React.createElement("option", { key: "none", value: "" }, "— Select a Reference —")].concat(referenceOptions.map(ref => /*#__PURE__*/React.createElement("option", {
    key: ref.id,
    value: ref.id
  }, `${referenceSourceMeta(ref.sourceType).label} — ${referenceDisplayLabel(ref)} (${(samples || []).filter(s => s.referenceId === ref.id).length} samples)`)))), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 mb-2"
  }, selectedSamples.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    className: "text-[11px] px-2 py-0.5 rounded-full",
    style: { background: C.bg, color: C.ink }
  }, `${s.sampleCode} · ${s.clientName}`))));

  const subBatchModeBlock = selectionMode !== "subbatch" ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm w-full mb-2",
    style: { borderColor: C.border },
    value: reportSubBatchId,
    onChange: e => {
      const sbId = e.target.value;
      setReportSubBatchId(sbId);
      const sb = (subBatches || []).find(x => x.id === sbId);
      if (!sb) {
        setSelectedSampleIds([]);
        return;
      }
      setSelectedSampleIds(sb.memberSampleIds || []);
      setSelectedTestIds([sb.testTypeId]);
    }
  }, [/*#__PURE__*/React.createElement("option", { key: "none", value: "" }, "— Select an Analytical Batch —")].concat(reportSubBatchOptions.map(sb => /*#__PURE__*/React.createElement("option", {
    key: sb.id,
    value: sb.id
  }, `${sb.label} — ${sb.testTypeName} (${(sb.memberSampleIds || []).length} samples) · ${sb.status}`)))), selectedReportSubBatch && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 mb-2"
  }, selectedSamples.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    className: "text-[11px] px-2 py-0.5 rounded-full",
    style: { background: C.bg, color: C.ink }
  }, `${s.sampleCode} · ${s.clientName}`))));

  const sampleSelectionSummaryLine = /*#__PURE__*/React.createElement("div", {
    className: "text-xs mt-2 font-semibold",
    style: { color: C.teal }
  }, `${selectedSampleIds.length} sample(s) selected`);

  const sampleSelectionSection = /*#__PURE__*/React.createElement(React.Fragment, null, modeSelectorRow, individualModeBlock, batchModeBlock, subBatchModeBlock, sampleSelectionSummaryLine);

  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Step 1 — Select Samples",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 15
    })
  }, sampleSelectionSection), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Step 2 — Select Tests (Report Columns)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 15
    })
  }, availableTestIds.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Selected samples have no requested tests.") : /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, testTypes.filter(t => availableTestIds.includes(t.id)).map(t => /*#__PURE__*/React.createElement("label", {
    key: t.id,
    className: "flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer",
    style: {
      border: `1px solid ${selectedTestIds.includes(t.id) ? C.teal : C.border}`,
      background: selectedTestIds.includes(t.id) ? `${C.teal}14` : "transparent"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedTestIds.includes(t.id),
    onChange: () => toggleTest(t.id)
  }), t.name, " (", t.method || "no method set", ")")))), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Step 3 — Memo / Reference Details",
    subtitle: "These vary per report — fill them in for this specific memo.",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "edit",
      size: 15
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))"
    }
  }, [["memoNo", "Memo No"], ["date", "Date", "date"], ["sentBy", "Sent by"], ["district", "District"], ["sampleSource", "Sample Source (e.g. STW-6)"], ["refMemoNo", "Ref: Memo No"], ["refMemoDate", "Ref: Memo Date", "date"], ["dateOfTesting", "Date of Testing", "date"], ["collectionDate", "Collection Date", "date"], ["receivingDate", "Receiving Date", "date"]].map(([key, label, type]) => /*#__PURE__*/React.createElement(TextField, {
    key: key,
    simple: true,
    label: label,
    type: type || "text",
    value: memo[key],
    onChange: v => setMemo({
      ...memo,
      [key]: v
    })
  }))), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Notes (optional, printed below the table)",
    value: memo.notes,
    onChange: v => setMemo({
      ...memo,
      notes: v
    }),
    textarea: true
  })), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Step 4 — Signatories",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 15
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Test Performed by"), signatories.performedBy.map((sig, i) => /*#__PURE__*/React.createElement(SignatorySlot, {
    key: i,
    index: i + 1,
    value: sig,
    onChange: v => updateSignatory("performedBy", i, v),
    users: users
  })), signatories.performedBy.length < 2 && /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => addSignatory("performedBy")
  }, "+ Add second signatory")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Countersigned/Approved by"), signatories.approvedBy.map((sig, i) => /*#__PURE__*/React.createElement(SignatorySlot, {
    key: i,
    index: i + 1,
    value: sig,
    onChange: v => updateSignatory("approvedBy", i, v),
    users: users
  })), signatories.approvedBy.length < 2 && /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => addSignatory("approvedBy")
  }, "+ Add second signatory")))), selectedSampleIds.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: generate
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "printer",
    size: 14
  }), "Generate & Print Report (", selectedSampleIds.length, " sample", selectedSampleIds.length === 1 ? "" : "s", ")")));
}
