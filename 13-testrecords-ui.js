// ===== 13-testrecords-ui.js =====
// ============================================================================
// TEST EXECUTION & RECORDS — running a test against a Test Method (consumes
// inventory per the method's requirements) and the resulting records list.
// In Phase 2 this will be wired to consume a specific Sample (see 20/21)
// instead of a bare tester-entered sample count; today it preserves the
// original V14 behaviour exactly.
// ============================================================================
function AddTestTab({
  testTypes,
  chemicals,
  setChemicals,
  equipment,
  gasList,
  setGasList,
  testRecords,
  setTestRecords,
  samples,
  setSamples,
  subBatches,
  setSubBatches,
  session,
  notify,
  editingRecord,
  onDoneEditing,
  goToTestTypes
}) {
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [selectedSubBatchId, setSelectedSubBatchId] = useState("");
  const [memberInputs, setMemberInputs] = useState({}); // { [sampleId]: { [paramId]: { [inputKey]: value } } } — sub-batch mode only
  const [selectedTestId, setSelectedTestId] = useState(testTypes[0]?.id || "");
  const [values, setValues] = useState({});
  const [bottleOverride, setBottleOverride] = useState({});
  const [expiredReason, setExpiredReason] = useState({}); // { [chemicalId]: reason text } — required when an expired batch is picked
  const [tester, setTester] = useState("");
  const [testDate, setTestDate] = useState(todayStr());
  const [numberOfStandardSamples, setNumberOfStandardSamples] = useState("");
  const [numberOfFieldSamples, setNumberOfFieldSamples] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [sampleSource, setSampleSource] = useState("");
  const [collectFee, setCollectFee] = useState(true);
  const [gasesUsed, setGasesUsed] = useState([]); // [{gasId, gasName}] — entry only, no amount
  const [dilutionRequired, setDilutionRequired] = useState(false);
  const [numberOfDilutedSamples, setNumberOfDilutedSamples] = useState("");
  const [dilutionGasesUsed, setDilutionGasesUsed] = useState([]);
  // Alternative/optional chemicals (e.g. Nitric Acid OR Hydrochloric Acid) default to disabled/not-required
  // — the tester actively enables the one they actually used. { [chemicalId or "dilution-"+chemicalId]: true }
  // means "tester enabled/used this optional chemical for this record".
  const [optionalUsed, setOptionalUsed] = useState({});
  const [resultInputs, setResultInputs] = useState({}); // { [paramId]: { [inputKey]: value } }
  const [qcSampleType, setQcSampleType] = useState(""); // "" | qcType matching a rule on selectedTest
  const [qcMeasuredValue, setQcMeasuredValue] = useState("");
  const [bracketingPoints, setBracketingPoints] = useState([]); // [{id,label,value}] — bracketing/interspersed QC only
  const [submitAttempted, setSubmitAttempted] = useState(false);
  function toggleOptionalUsed(key) {
    setOptionalUsed(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }
  const selectedTest = testTypes.find(t => t.id === selectedTestId);
  // Samples that still need test records logged against them (registered through
  // in_progress, i.e. not yet at results/review/approval/release).
  const pendingSubBatches = (subBatches || []).filter(sb => sb.status === "pending");
  // Samples that still have at least one requested parameter genuinely
  // pending (not yet resulted, not already queued in a pending sub-batch
  // for that specific parameter) — computed per (sample, testType) pair via
  // pendingTestTypeIdsForSample, NOT off the sample's single overall
  // `status` field. A sample with 3 requested parameters where only 1 is
  // done must still show up here for the other 2.
  const linkableSamples = (samples || []).filter(s => pendingTestTypeIdsForSample(s, testRecords, subBatches).length > 0);
  const selectedSample = (samples || []).find(s => s.id === selectedSampleId) || null;
  const selectedSubBatch = pendingSubBatches.find(sb => sb.id === selectedSubBatchId) || null;
  const subBatchMembers = selectedSubBatch ? selectedSubBatch.memberSampleIds.map(id => (samples || []).find(s => s.id === id)).filter(Boolean) : [];
  // Once a sample or sub-batch is picked, only show the test type(s) it
  // actually still needs — a parameter that's already Done (has a result)
  // or already Queued (committed to a different pending sub-batch) is left
  // off the list so it can't be silently re-recorded or double-run.
  const testTypesForForm = selectedSubBatch ? testTypes.filter(t => t.id === selectedSubBatch.testTypeId) : selectedSample ? testTypes.filter(t => pendingTestTypeIdsForSample(selectedSample, testRecords, subBatches).includes(t.id)) : testTypes;
  const chemGroups = selectedTest ? selectedTest.chemicalRequirements : [];
  const dilutionGroups = selectedTest ? selectedTest.dilutionChemicalRequirements || [] : [];
  const resultParameters = selectedTest?.resultParameters || [];
  const qcRules = selectedTest?.qcRules || [];
  const matchedQcRule = qcSampleType ? qcRules.find(r => r.qcType === qcSampleType) : null;
  const qcEvaluation = matchedQcRule && qcMeasuredValue !== "" ? evaluateQcRule(matchedQcRule, qcMeasuredValue) : null;
  const isBracketing = matchedQcRule?.qcType === "bracketing";
  const bracketingRunLength = selectedSubBatch ? subBatchMembers.length : Number(numberOfFieldSamples) || 0;
  function addBracketingPoint(label) {
    setBracketingPoints(prev => [...prev, {
      id: uid("bkt"),
      label: label || `Checkpoint ${prev.length + 1}`,
      value: ""
    }]);
  }
  function removeBracketingPoint(id) {
    setBracketingPoints(prev => prev.filter(p => p.id !== id));
  }
  function updateBracketingPoint(id, patch) {
    setBracketingPoints(prev => prev.map(p => p.id === id ? {
      ...p,
      ...patch
    } : p));
  }
  // Auto-lay-out checkpoints across the run: always brackets sample #1 and
  // the last sample, plus one every `bracketingInterval` samples in between
  // — the standard "bracketing/interspersed QC" pattern for a batch run.
  function autoLayoutBracketingPoints() {
    const interval = Number(matchedQcRule?.bracketingInterval) || 0;
    const total = bracketingRunLength;
    if (!total) {
      notify?.("Pick a Sub-Batch (or enter No. of Field Samples) first so positions can be laid out.", "warn");
      return;
    }
    const positions = new Set([1, total]);
    if (interval > 0) {
      for (let p = interval; p < total; p += interval) positions.add(p);
    }
    const sorted = Array.from(positions).sort((a, b) => a - b);
    setBracketingPoints(sorted.map(pos => ({
      id: uid("bkt"),
      label: pos === 1 ? `Before Sample 1` : pos === total ? `After Sample ${total} (end of run)` : `After Sample ${pos}`,
      value: ""
    })));
  }
  const bracketingFilled = bracketingPoints.filter(p => p.value !== "");
  const bracketingEvaluated = bracketingFilled.map(p => ({
    ...p,
    ...evaluateQcRule(matchedQcRule || {}, p.value)
  }));
  const bracketingOverallPass = bracketingEvaluated.length ? bracketingEvaluated.every(p => p.pass) : null;
  function setResultInput(paramId, key, val) {
    setResultInputs(prev => ({
      ...prev,
      [paramId]: {
        ...prev[paramId],
        [key]: val
      }
    }));
  }
  function computeResult(param) {
    const vars = {};
    param.inputs.forEach(inp => {
      vars[inp.key] = Number((resultInputs[param.id] || {})[inp.key]) || 0;
    });
    const res = evaluateFormula(param.formula, vars);
    return res.ok ? {
      ...res,
      value: +res.value.toFixed(param.roundTo ?? 2)
    } : res;
  }
  function setMemberInput(sampleId, paramId, key, val) {
    setMemberInputs(prev => ({
      ...prev,
      [sampleId]: {
        ...(prev[sampleId] || {}),
        [paramId]: {
          ...(prev[sampleId]?.[paramId] || {}),
          [key]: val
        }
      }
    }));
  }
  function computeMemberResult(sampleId, param) {
    const vars = {};
    param.inputs.forEach(inp => {
      vars[inp.key] = Number(memberInputs[sampleId]?.[param.id]?.[inp.key]) || 0;
    });
    const res = evaluateFormula(param.formula, vars);
    return res.ok ? {
      ...res,
      value: +res.value.toFixed(param.roundTo ?? 2)
    } : res;
  }
  function renderSubBatchMemberRow(sampleId) {
    const sample = (samples || []).find(s => s.id === sampleId);
    const cells = [/*#__PURE__*/React.createElement("td", {
      key: "code",
      className: "p-1.5 font-medium",
      style: {
        borderBottom: `1px solid ${C.border}`
      }
    }, sample?.sampleCode)];
    resultParameters.forEach(p => {
      const res = computeMemberResult(sampleId, p);
      const inputEls = p.inputs.map(inp => /*#__PURE__*/React.createElement("input", {
        key: inp.id,
        type: "number",
        placeholder: inp.label || inp.key,
        title: inp.label || inp.key,
        className: "border rounded px-1 py-0.5 w-16",
        style: {
          borderColor: C.border
        },
        value: memberInputs[sampleId]?.[p.id]?.[inp.key] ?? "",
        onChange: e => setMemberInput(sampleId, p.id, inp.key, e.target.value)
      }));
      cells.push(/*#__PURE__*/React.createElement("td", {
        key: p.id,
        className: "p-1.5",
        style: {
          borderBottom: `1px solid ${C.border}`
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex gap-1 items-center"
      }, inputEls, /*#__PURE__*/React.createElement("span", {
        className: "text-xs font-semibold ml-1",
        style: {
          color: res.ok ? C.ok : C.muted
        }
      }, res.ok ? `= ${fmtNum(res.value)}` : ""))));
    });
    return /*#__PURE__*/React.createElement("tr", {
      key: sampleId
    }, cells);
  }
  function defaultValuesForItems(reqs) {
    const initial = {};
    (reqs || []).forEach(req => {
      req.items.forEach(item => {
        if (item.type === "direct" || item.type === "volumetric" && item.scaling === "direct") initial[item.id] = {
          value: Number(item.defaultValue ?? item.defaultAmount) || 0
        };else initial[item.id] = {
          amount: Number(item.defaultAmount) || 0
        };
      });
    });
    return initial;
  }

  // Load an existing record for editing.
  useEffect(() => {
    if (editingRecord) {
      setSelectedTestId(editingRecord.testTypeId || "");
      setValues(editingRecord.values || {});
      setBottleOverride({});
      setExpiredReason({});
      setTester(editingRecord.tester || "");
      setTestDate(editingRecord.date || todayStr());
      setNumberOfStandardSamples(editingRecord.numberOfStandardSamples === 0 ? "0" : editingRecord.numberOfStandardSamples ?? "0");
      setNumberOfFieldSamples(editingRecord.numberOfFieldSamples === 0 ? "0" : editingRecord.numberOfFieldSamples ?? (editingRecord.numberOfSamples === 0 ? "0" : editingRecord.numberOfSamples ?? ""));
      setEquipmentId(editingRecord.equipmentId || "");
      setSampleSource(editingRecord.sampleSource || "");
      setCollectFee(editingRecord.feeApplicable !== false);
      setGasesUsed(editingRecord.gasesUsed || []);
      setDilutionRequired(!!editingRecord.dilutionRequired);
      setNumberOfDilutedSamples(editingRecord.numberOfDilutedSamples === 0 ? "0" : editingRecord.numberOfDilutedSamples ?? "");
      setDilutionGasesUsed(editingRecord.dilutionGasesUsed || []);
      setOptionalUsed(editingRecord.optionalUsed || editingRecord.notRequired || {});
      setResultInputs(editingRecord.resultInputs || {});
      setQcSampleType(editingRecord.qcCheck?.qcType || "");
      setQcMeasuredValue(editingRecord.qcCheck && editingRecord.qcCheck.qcType !== "bracketing" ? String(editingRecord.qcCheck.value ?? "") : "");
      setBracketingPoints(editingRecord.qcCheck?.qcType === "bracketing" ? (editingRecord.qcCheck.points || []).map(p => ({
        id: p.id || uid("bkt"),
        label: p.label,
        value: p.value === null || p.value === undefined ? "" : String(p.value)
      })) : []);
    }
  }, [editingRecord]);

  // When the selected test type changes (fresh entry, not editing), pull in its design:
  // dummy/default chemical values, default equipment, and default-checked gases. No. of Samples is
  // deliberately left blank every time, and Dilution Required always resets to No.
  useEffect(() => {
    if (editingRecord) return;
    setValues({
      ...defaultValuesForItems(chemGroups),
      ...defaultValuesForItems(dilutionGroups)
    });
    setBottleOverride({});
    setExpiredReason({});
    setEquipmentId(selectedTest?.defaultEquipmentId || "");
    setGasesUsed(selectedTest?.gasRequirements || []);
    setDilutionRequired(false);
    setNumberOfDilutedSamples("");
    setDilutionGasesUsed(selectedTest?.dilutionGasRequirements || []);
    setOptionalUsed({});
    setResultInputs({});
    setQcSampleType("");
    setQcMeasuredValue("");
    setBracketingPoints([]);
  }, [selectedTestId]);

  // When a sample is picked: jump the Test Type selector to one of that sample's
  // requested tests (if the currently selected one isn't among them), and prefill
  // No. of Field Samples from the batch size recorded at registration. The tester
  // can still edit the count by hand afterwards — this only sets the starting value.
  useEffect(() => {
    if (editingRecord || !selectedSample) return;
    if (!selectedSample.requestedTests.some(rt => rt.testTypeId === selectedTestId)) {
      const firstReq = selectedSample.requestedTests[0];
      if (firstReq) setSelectedTestId(firstReq.testTypeId);
    }
    setNumberOfFieldSamples(String(selectedSample.numberOfSamples || 1));
  }, [selectedSampleId]);
  // When a sub-batch is picked: lock the Test Type to the sub-batch's method
  // and prefill No. of Field Samples from its member count.
  useEffect(() => {
    if (editingRecord || !selectedSubBatch) return;
    setSelectedTestId(selectedSubBatch.testTypeId);
    setNumberOfFieldSamples(String(selectedSubBatch.memberSampleIds.length));
  }, [selectedSubBatchId]);
  function setDirect(itemId, val) {
    setValues(prev => ({
      ...prev,
      [itemId]: {
        value: Number(val) || 0
      }
    }));
  }
  function setAmount(itemId, val) {
    setValues(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        amount: Number(val) || 0
      }
    }));
  }
  // Gas Name and Cylinder are always shown for every gas linked to the test type — the tester always
  // records which cylinder a gas was drawn from. Inventory is only deducted if "Update Gas Inventory"
  // is ticked, in which case Amount Used also appears. gasMeta is passed so a missing entry can be
  // created on first edit (upsert) instead of requiring a separate "enable" step.
  function updateGasEntry(gasId, setList, patch, gasMeta) {
    setList(prev => {
      if (prev.some(x => x.gasId === gasId)) return prev.map(x => x.gasId === gasId ? {
        ...x,
        ...patch
      } : x);
      return [...prev, {
        gasId,
        gasName: gasMeta?.gasName || "",
        cylinderId: "",
        amount: "",
        updateInventory: false,
        ...patch
      }];
    });
  }
  const standardSamplesNum = numberOfStandardSamples === "" ? 0 : Number(numberOfStandardSamples) || 0;
  const fieldSamplesNum = numberOfFieldSamples === "" ? 0 : Number(numberOfFieldSamples) || 0;
  const samplesNum = standardSamplesNum + fieldSamplesNum;
  const dilutedSamplesNum = numberOfDilutedSamples === "" ? 0 : Number(numberOfDilutedSamples) || 0;

  // Each "No. of Sample × Amount" chemical item says which count drives it — Field Samples, Standard
  // Samples, or Both — chosen back in the Test Type design.
  function countForSampleSource(source) {
    if (source === "standard") return standardSamplesNum;
    if (source === "field") return fieldSamplesNum;
    return samplesNum; // "both" (or legacy items without a choice)
  }
  function totalsByChemicalId() {
    const totals = {};
    chemGroups.forEach(req => {
      if (req.optional && !optionalUsed[req.chemicalId]) return;
      let sum = 0;
      req.items.forEach(item => {
        const v = values[item.id] || {};
        if (item.type === "direct" || item.type === "volumetric" && item.scaling === "direct") sum += v.value || 0;else sum += countForSampleSource(item.sampleSource) * (v.amount || 0);
      });
      totals[req.chemicalId] = (totals[req.chemicalId] || 0) + sum;
    });
    // Dilution chemical requirement only counts toward inventory deduction when the record is marked
    // "Dilution Required" — it never affects revenue (revenue is billed samples × cost only).
    if (dilutionRequired) {
      dilutionGroups.forEach(req => {
        if (req.optional && !optionalUsed["dilution-" + req.chemicalId]) return;
        let sum = 0;
        req.items.forEach(item => {
          const v = values[item.id] || {};
          if (item.type === "direct" || item.type === "volumetric" && item.scaling === "direct") sum += v.value || 0;else sum += dilutedSamplesNum * (v.amount || 0);
        });
        totals[req.chemicalId] = (totals[req.chemicalId] || 0) + sum;
      });
    }
    return totals;
  }
  const totals = totalsByChemicalId();
  function chemicalById(id) {
    return chemicals.find(c => c.id === id);
  }
  function gasCylinderInfo(gasId) {
    const g = (gasList || []).find(x => x.id === gasId);
    if (!g) return null;
    const activeCyls = g.cylinders.filter(c => c.status === "active");
    const total = activeCyls.reduce((s, c) => s + c.remaining, 0);
    return {
      hasActive: activeCyls.length > 0,
      total,
      unit: g.unit
    };
  }
  const unitCost = selectedTest ? Number(selectedTest.costPerTest) || 0 : 0;
  // Fee applicability is decided per record (not fixed to the test type), and only Field Samples are billed —
  // standard/QC samples are for verifying the test's own accuracy and aren't charged to anyone. No. of
  // Samples Requiring Dilution never enters this calculation — dilution is inventory-only.
  const feeApplicable = collectFee;
  const billedSamples = feeApplicable ? fieldSamplesNum : 0;
  const revenuePreview = +(billedSamples * unitCost).toFixed(2);
  function resetForm() {
    setValues({
      ...defaultValuesForItems(chemGroups),
      ...defaultValuesForItems(dilutionGroups)
    });
    setBottleOverride({});
    setExpiredReason({});
    setTester("");
    setTestDate(todayStr());
    setNumberOfStandardSamples("");
    setNumberOfFieldSamples(selectedSample ? String(selectedSample.numberOfSamples || 1) : "");
    setEquipmentId(selectedTest?.defaultEquipmentId || "");
    setSampleSource("");
    setCollectFee(true);
    setGasesUsed(selectedTest?.gasRequirements || []);
    setDilutionRequired(false);
    setNumberOfDilutedSamples("");
    setDilutionGasesUsed(selectedTest?.dilutionGasRequirements || []);
    setOptionalUsed({});
    setSubmitAttempted(false);
    setResultInputs({});
    setQcSampleType("");
    setQcMeasuredValue("");
    setBracketingPoints([]);
  }
  function handleCancelEdit() {
    resetForm();
    onDoneEditing && onDoneEditing();
  }
  function handleSave() {
    setSubmitAttempted(true);
    if (!selectedTest) return;
    if (!tester.trim()) return notify("Please enter tester name", "warn");
    if (numberOfStandardSamples === "" && numberOfFieldSamples === "") return notify("Please enter No. of Standard Samples and No. of Field Samples (use 0 if none).", "warn");
    if (dilutionRequired && numberOfDilutedSamples === "") return notify("Please enter No. of Samples Requiring Dilution (use 0 if none).", "warn");

    // If editing an existing record, first restore its previous consumption so we validate against true available stock.
    let baseChemicals = chemicals;
    if (editingRecord) baseChemicals = restoreConsumption(chemicals, editingRecord.bottleLog || {});
    let nextChemicals = markExpiredBatches(baseChemicals.map(c => ({
      ...c,
      batches: c.batches.map(b => ({
        ...b
      }))
    })));

    // Block save if any linked chemical does not have enough active stock. (Gas is tracked manually in
    // its own inventory and is never auto-deducted here.)
    const insufficient = [];
    const expiredOverrides = [];
    Object.entries(totals).forEach(([chemId, amount]) => {
      if (amount <= 0) return;
      const chem = nextChemicals.find(c => c.id === chemId);
      if (!chem) return;
      const preferred = bottleOverride[chemId];
      const preferredBatch = preferred ? chem.batches.find(b => b.id === preferred) : null;
      let available = chem.batches.filter(b => b.status === "active").reduce((s, b) => s + b.remaining, 0);
      if (preferredBatch && preferredBatch.status === "expired") {
        available += preferredBatch.remaining;
        if (!(expiredReason[chemId] || "").trim()) insufficient.push(`${chem.name}: please give a reason for using the expired batch (Exp ${preferredBatch.expiryDate})`);else expiredOverrides.push({
          chemical: chem.name,
          batchId: preferredBatch.id,
          expiryDate: preferredBatch.expiryDate,
          reason: expiredReason[chemId].trim(),
          tester: tester.trim(),
          date: `${testDate} ${new Date().toTimeString().slice(0, 5)}`
        });
      }
      if (amount > available) insufficient.push(`${chem.name} (need ${fmtNum(amount)}, have ${fmtNum(available)})`);
    });
    if (insufficient.length > 0) {
      notify(`Not enough stock to save this test record — insufficient: ${insufficient.join("; ")}. Please restock before saving.`, "warn");
      return;
    }

    // Gas: same idea as chemicals — restore this record's previous gas draw (if editing), then validate
    // and deduct from the specific cylinder the tester picked for each required gas.
    let baseGasList = gasList;
    if (editingRecord) baseGasList = restoreGasConsumption(gasList, editingRecord.gasLog || []);
    let nextGasList = baseGasList.map(g => ({
      ...g,
      cylinders: g.cylinders.map(c => ({
        ...c
      }))
    }));
    // Only gas entries explicitly ticked "Update Gas Inventory" get deducted — others are logged for
    // reporting only (inventory tracked manually), per the optional Amount Used design.
    const allGasUsage = [...gasesUsed, ...(dilutionRequired ? dilutionGasesUsed : [])].filter(e => e.updateInventory);
    const gasInsufficient = [];
    allGasUsage.forEach(e => {
      if (!e.cylinderId) {
        gasInsufficient.push(`${e.gasName}: please select which cylinder was used`);
        return;
      }
      if (!(Number(e.amount) > 0)) {
        gasInsufficient.push(`${e.gasName}: please enter Amount Used`);
        return;
      }
      const g = nextGasList.find(x => x.id === e.gasId);
      const cyl = g && g.cylinders.find(c => c.id === e.cylinderId);
      if (!cyl) {
        gasInsufficient.push(`${e.gasName}: selected cylinder not found`);
        return;
      }
      if (Number(e.amount) > cyl.remaining) gasInsufficient.push(`${e.gasName} (need ${fmtNum(e.amount)}, have ${fmtNum(cyl.remaining)} in that cylinder)`);
    });
    if (gasInsufficient.length > 0) {
      notify(`Gas cylinder issue — ${gasInsufficient.join("; ")}.`, "warn");
      return;
    }
    const gasLog = [];
    allGasUsage.forEach(e => {
      const {
        gasList: updated
      } = deductFromGasCylinder(nextGasList, e.gasId, e.cylinderId, Number(e.amount));
      nextGasList = updated;
      gasLog.push({
        gasId: e.gasId,
        cylinderId: e.cylinderId,
        amount: Number(e.amount)
      });
    });
    setGasList(nextGasList);
    const consumption = {};
    const bottleLog = {};
    let anyMissing = false;
    Object.entries(totals).forEach(([chemId, amount]) => {
      if (amount <= 0) return;
      const chem = nextChemicals.find(c => c.id === chemId);
      if (!chem) {
        anyMissing = true;
        return;
      }
      const preferred = bottleOverride[chemId];
      const {
        batches,
        usedFrom
      } = deductFromChemical(chem, amount, preferred);
      chem.batches = batches;
      consumption[chem.name] = amount;
      bottleLog[chem.name] = usedFrom;
    });
    setChemicals(nextChemicals);
    const equip = equipment.find(e => e.id === equipmentId);
    const recordPayload = {
      date: testDate,
      tester: tester.trim(),
      testTypeName: selectedTest.name,
      testTypeId: selectedTest.id,
      equipmentId: equipmentId || "",
      equipmentName: equip ? equip.name : "",
      consumption,
      bottleLog,
      values,
      numberOfSamples: samplesNum,
      numberOfStandardSamples: standardSamplesNum,
      numberOfFieldSamples: fieldSamplesNum,
      sampleId: selectedSubBatch ? null : selectedSampleId || null,
      sampleCode: selectedSubBatch ? "" : selectedSample?.sampleCode || "",
      memberSampleIds: selectedSubBatch ? selectedSubBatch.memberSampleIds : null,
      feeApplicable,
      unitCost,
      billedSamples,
      revenue: revenuePreview,
      sampleSource: sampleSource.trim(),
      gasesUsed,
      dilutionRequired,
      numberOfDilutedSamples: dilutionRequired ? dilutedSamplesNum : 0,
      dilutionGasesUsed: dilutionRequired ? dilutionGasesUsed : [],
      optionalUsed,
      expiredOverrides,
      gasLog,
      resultInputs,
      results: selectedSubBatch ? [] : resultParameters.map(p => {
        const res = computeResult(p);
        return {
          paramId: p.id,
          name: p.name,
          unit: p.unit,
          inputs: resultInputs[p.id] || {},
          ...(res.ok ? {
            value: res.value,
            error: null
          } : {
            value: null,
            error: res.error
          })
        };
      }),
      memberResults: selectedSubBatch ? selectedSubBatch.memberSampleIds.map(sampleId => {
        const memberSample = (samples || []).find(s => s.id === sampleId);
        return {
          sampleId,
          sampleCode: memberSample?.sampleCode || "",
          results: resultParameters.map(p => {
            const res = computeMemberResult(sampleId, p);
            return {
              paramId: p.id,
              name: p.name,
              unit: p.unit,
              inputs: memberInputs[sampleId]?.[p.id] || {},
              ...(res.ok ? {
                value: res.value,
                error: null
              } : {
                value: null,
                error: res.error
              })
            };
          })
        };
      }) : null,
      qcCheck: isBracketing ? bracketingEvaluated.length ? {
        ruleId: matchedQcRule.id,
        qcType: "bracketing",
        label: matchedQcRule.label,
        points: bracketingEvaluated.map(p => ({
          id: p.id,
          label: p.label,
          value: Number(p.value),
          pass: p.pass,
          message: p.message
        })),
        pass: bracketingOverallPass,
        message: `${bracketingEvaluated.filter(p => p.pass).length}/${bracketingEvaluated.length} checkpoint(s) within limits`
      } : null : matchedQcRule && qcMeasuredValue !== "" ? {
        ruleId: matchedQcRule.id,
        qcType: matchedQcRule.qcType,
        label: matchedQcRule.label,
        value: Number(qcMeasuredValue),
        pass: qcEvaluation?.pass ?? null,
        message: qcEvaluation?.message || ""
      } : null
    };
    if (editingRecord) {
      setTestRecords(prev => prev.map(r => r.id === editingRecord.id ? {
        ...r,
        ...recordPayload
      } : r));
      notify(anyMissing ? "Test record updated, but one or more linked chemicals no longer exist in inventory." : "Test record updated. Inventory adjusted accordingly.", anyMissing ? "warn" : "ok");
      resetForm();
      onDoneEditing && onDoneEditing();
    } else {
      const newRecordId = uid("rec");
      const newRecord = {
        id: newRecordId,
        ...recordPayload
      };
      setTestRecords(prev => [...prev, newRecord]);
      const actingUser = session || {
        name: tester || "System",
        role: "Technician"
      };
      // The specific parameter this record is FOR — only that parameter's
      // status moves to results_entered; every other requested parameter on
      // the sample is untouched. setRequestedTestStatus() re-syncs the
      // whole-sample `status` as a bottleneck rollup on its own (Phase 3) —
      // no separate "check if everything's done" logic needed here anymore.
      if (selectedSampleId && setSamples && selectedSample) {
        const updatedSample = setRequestedTestStatus({
          ...selectedSample,
          linkedTestRecordIds: [...(selectedSample.linkedTestRecordIds || []), newRecordId]
        }, selectedTest.id, "results_entered", actingUser);
        setSamples(prev => prev.map(s => s.id === selectedSampleId ? updatedSample : s), updatedSample);
      }
      if (selectedSubBatch && setSamples) {
        for (const memberId of selectedSubBatch.memberSampleIds) {
          const member = (samples || []).find(s => s.id === memberId);
          if (!member) continue;
          const updatedMember = setRequestedTestStatus({
            ...member,
            linkedTestRecordIds: [...(member.linkedTestRecordIds || []), newRecordId]
          }, selectedSubBatch.testTypeId, "results_entered", actingUser);
          setSamples(prev => prev.map(s => s.id === memberId ? updatedMember : s), updatedMember);
        }
        if (setSubBatches) {
          setSubBatches(prev => prev.map(sb => sb.id === selectedSubBatch.id ? {
            ...sb,
            status: "tested",
            testRecordId: newRecordId
          } : sb));
        }
        setSelectedSubBatchId("");
        setMemberInputs({});
      }
      notify(anyMissing ? "Saved, but one or more linked chemicals no longer exist in inventory." : "Test record saved. Inventory updated (FEFO).", anyMissing ? "warn" : "ok");
      resetForm();
    }
  }
  const sampleSourceLabel = {
    field: "field",
    standard: "standard",
    both: "std+field"
  };
  function renderRequirementGroup(req, countNum, countTitle) {
    const chem = chemicalById(req.chemicalId);
    const nrKey = countTitle === "dilution" ? "dilution-" + req.chemicalId : req.chemicalId;
    // Optional (alternative) chemicals default to disabled/not-required until the tester actively
    // enables the one they actually used for this record.
    const isSkipped = !!(req.optional && !optionalUsed[nrKey]);
    return /*#__PURE__*/React.createElement(SectionCard, {
      key: `chem-${req.chemicalId || req.chemical}-${countTitle}`,
      title: /*#__PURE__*/React.createElement("span", {
        className: "flex items-center gap-1.5"
      }, chem ? chem.name : `${req.chemical} (unlinked)`, /*#__PURE__*/React.createElement("span", {
        className: "flex items-center gap-1 text-xs font-normal px-1.5 py-0.5 rounded",
        style: {
          background: C.infoBg,
          color: C.info
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "link",
        size: 11
      }), "linked to inventory"), chem && /*#__PURE__*/React.createElement("span", {
        className: "flex items-center gap-1 text-xs font-normal px-1.5 py-0.5 rounded",
        style: {
          background: "#EEF4F3",
          color: C.muted
        },
        title: "Unit — from Chemical/Inventory master, read-only"
      }, "Unit: ", /*#__PURE__*/React.createElement("strong", {
        style: {
          color: C.ink
        }
      }, chem.unit))),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "flask",
        size: 16,
        color: C.teal
      })
    }, !chem && /*#__PURE__*/React.createElement("div", {
      className: "text-xs mb-2",
      style: {
        color: C.warn
      }
    }, "This requirement isn't linked to a chemical currently in inventory — edit the test type or add the chemical first."), req.optional && /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-1.5 text-xs mb-2 px-2 py-1 rounded w-fit",
      style: {
        background: !isSkipped ? C.okBg : "#F7FBFB",
        color: !isSkipped ? C.ok : C.muted
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: !isSkipped,
      onChange: () => toggleOptionalUsed(nrKey)
    }), "Used this chemical for this record (optional alternative — off by default, not required)"), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-3",
      style: {
        opacity: isSkipped ? 0.45 : 1,
        pointerEvents: isSkipped ? "none" : "auto"
      }
    }, req.items.map(item => {
      const itemCount = countTitle === "dilution" ? dilutedSamplesNum : countForSampleSource(item.sampleSource);
      return /*#__PURE__*/React.createElement("div", {
        key: item.id,
        className: "rounded p-2.5",
        style: {
          border: `1px solid ${C.border}`,
          background: "#FFFFFF"
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-3 flex-wrap"
      }, /*#__PURE__*/React.createElement("div", {
        className: "text-xs font-medium w-48",
        style: {
          color: C.ink
        }
      }, item.label, item.type === "volumetric" && /*#__PURE__*/React.createElement("div", {
        className: "text-[11px] font-normal",
        style: {
          color: C.muted
        }
      }, "volumetric — ", item.defaultPercent, "% of ", fmtNum(item.solutionVolume), "ml solution")), item.type === "direct" || item.type === "volumetric" && item.scaling === "direct" ? /*#__PURE__*/React.createElement("input", {
        type: "number",
        placeholder: "amount",
        className: "border rounded px-2 py-1.5 text-sm w-28",
        style: {
          borderColor: C.border
        },
        value: values[item.id]?.value ?? "",
        onChange: e => setDirect(item.id, e.target.value)
      }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        className: "border rounded px-2 py-1.5 text-sm w-40 text-center",
        style: {
          borderColor: C.border,
          background: "#F3FAF9",
          color: C.muted
        },
        title: countTitle === "dilution" ? "No. of Samples Requiring Dilution" : `driven by: ${sampleSourceLabel[item.sampleSource] || "std+field"}`
      }, itemCount, " ", countTitle === "dilution" ? "diluted" : sampleSourceLabel[item.sampleSource] || "std+field", " sample(s)"), /*#__PURE__*/React.createElement("span", {
        className: "text-xs",
        style: {
          color: C.muted
        }
      }, "×"), /*#__PURE__*/React.createElement("input", {
        type: "number",
        placeholder: item.amountLabel || "amount per sample",
        className: "border rounded px-2 py-1.5 text-sm w-40",
        style: {
          borderColor: C.border
        },
        value: values[item.id]?.amount ?? "",
        onChange: e => setAmount(item.id, e.target.value)
      }), /*#__PURE__*/React.createElement("span", {
        className: "text-xs",
        style: {
          color: C.muted
        }
      }, "= ", fmtNum(itemCount * (values[item.id]?.amount || 0))))));
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-3 pt-2 mt-1 flex-wrap",
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs font-semibold",
      style: {
        color: C.tealDark
      }
    }, "Total required: ", fmtNum(totals[req.chemicalId] || 0), " ", chem ? chem.unit : ""), /*#__PURE__*/React.createElement(BottleSelector, {
      chemical: chem,
      needed: totals[req.chemicalId] || 0,
      value: bottleOverride[req.chemicalId],
      onChange: batchId => setBottleOverride(prev => ({
        ...prev,
        [req.chemicalId]: batchId
      }))
    })), chem && (() => {
      const selectedBatch = chem.batches.find(b => b.id === bottleOverride[req.chemicalId]);
      if (!selectedBatch || selectedBatch.status !== "expired") return null;
      return /*#__PURE__*/React.createElement("div", {
        className: "mt-2 p-2 rounded flex flex-col gap-1.5",
        style: {
          background: C.warnBg
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "text-xs flex items-center gap-1.5",
        style: {
          color: C.warn
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "warning",
        size: 13
      }), "This bottle expired on ", selectedBatch.expiryDate, ". Using it will be logged in the Expired Chemical Usage Report."), /*#__PURE__*/React.createElement("input", {
        className: "border rounded px-2 py-1 text-xs",
        style: {
          borderColor: C.border
        },
        placeholder: "Reason for using expired chemical (required)",
        value: expiredReason[req.chemicalId] || "",
        onChange: e => setExpiredReason(prev => ({
          ...prev,
          [req.chemicalId]: e.target.value
        }))
      }));
    })()));
  }
  function renderGasChecklist(reqList, selected, setSelected) {
    return /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-2"
    }, reqList.map(g => {
      // Gas Name and Cylinder are always visible — tester picks the cylinder the gas was taken
      // from first. Only ticking "Update Gas Inventory" reveals Amount Used and causes a deduction.
      const entry = selected.find(x => x.gasId === g.gasId) || {
        gasId: g.gasId,
        gasName: g.gasName,
        cylinderId: "",
        amount: "",
        updateInventory: false
      };
      const gas = (gasList || []).find(x => x.id === g.gasId);
      const availableCyls = gas ? gas.cylinders.filter(c => c.status === "active" && c.remaining > 0) : [];
      return /*#__PURE__*/React.createElement("div", {
        key: g.gasId,
        className: "rounded p-3",
        style: {
          border: `1px solid ${C.border}`,
          background: "#FAFEFE"
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "grid gap-3 mb-2",
        style: {
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex flex-col gap-1 text-xs",
        style: {
          color: C.muted
        }
      }, "Gas Name", /*#__PURE__*/React.createElement("div", {
        className: "border rounded px-2 py-1.5 text-sm flex items-center gap-1.5 font-medium",
        style: {
          borderColor: C.border,
          background: "#F3FAF9",
          color: C.ink
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "flask",
        size: 13,
        color: C.teal
      }), g.gasName)), /*#__PURE__*/React.createElement("label", {
        className: "flex flex-col gap-1 text-xs",
        style: {
          color: C.muted
        }
      }, "Cylinder", /*#__PURE__*/React.createElement("select", {
        className: "border rounded px-2 py-1.5 text-sm",
        style: {
          borderColor: C.border,
          color: C.ink
        },
        value: entry.cylinderId || "",
        onChange: e => updateGasEntry(g.gasId, setSelected, {
          cylinderId: e.target.value
        }, g)
      }, /*#__PURE__*/React.createElement("option", {
        value: ""
      }, availableCyls.length === 0 ? "No active cylinder" : "Select cylinder..."), availableCyls.map(c => /*#__PURE__*/React.createElement("option", {
        key: c.id,
        value: c.id
      }, c.name ? `[${c.name}] ` : "", "Recv. ", c.dateReceived, " · ", fmtNum(c.remaining), " ", gas.unit, " left"))))), /*#__PURE__*/React.createElement("label", {
        className: "flex items-center gap-1.5 text-xs mb-2",
        style: {
          color: C.ink
        }
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: !!entry.updateInventory,
        onChange: e => updateGasEntry(g.gasId, setSelected, {
          updateInventory: e.target.checked,
          amount: e.target.checked ? entry.amount : ""
        }, g)
      }), "Update Gas Inventory"), entry.updateInventory && /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-3 flex-wrap"
      }, /*#__PURE__*/React.createElement(TextField, {
        label: `Amount Used (${gas?.unit || ""}) — required`,
        type: "number",
        value: entry.amount ?? "",
        onChange: e => updateGasEntry(g.gasId, setSelected, {
          amount: e.target.value
        }, g),
        placeholder: "e.g. 0.5"
      }), !entry.cylinderId && /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.warn
        },
        className: "flex items-center gap-0.5 text-xs"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "warning",
        size: 11
      }), "pick a cylinder"), entry.cylinderId && (entry.amount === "" || Number(entry.amount) <= 0) && /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.warn
        },
        className: "flex items-center gap-0.5 text-xs"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "warning",
        size: 11
      }), "enter amount used")));
    }));
  }
  return /*#__PURE__*/React.createElement("div", null, editingRecord && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-3 p-2.5 rounded mb-4",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "edit",
    size: 13
  }), "Editing test record from ", editingRecord.date, " — saving will update this record and adjust inventory accordingly."), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: handleCancelEdit
  }, "Cancel Edit")), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg mb-4",
    style: {
      border: `1px solid ${C.border}`,
      background: C.card
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 px-4 py-3 flex-wrap",
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-2 text-sm font-semibold",
    style: {
      color: C.ink
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 16,
    color: C.teal
  }), "Log Water Test Record"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: goToTestTypes
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Manage Test Types")), /*#__PURE__*/React.createElement("div", {
    className: "px-4 pt-4 grid gap-3",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "Select Sample (optional — links this record to a registered batch)", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: {
      borderColor: C.border
    },
    value: selectedSampleId,
    onChange: e => {
      setSelectedSampleId(e.target.value);
      if (e.target.value) setSelectedSubBatchId("");
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— No sample (standalone record) —"), linkableSamples.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.sampleCode, " — ", s.clientName, " (", s.numberOfSamples || 1, " samples)")))), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "OR Select Sub-Batch (many samples, shared QC)", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: {
      borderColor: C.border
    },
    value: selectedSubBatchId,
    onChange: e => {
      setSelectedSubBatchId(e.target.value);
      if (e.target.value) setSelectedSampleId("");
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— No sub-batch —"), pendingSubBatches.map(sb => /*#__PURE__*/React.createElement("option", {
    key: sb.id,
    value: sb.id
  }, sb.label, " — ", sb.testTypeName, " (", sb.memberSampleIds.length, " samples)")))), selectedSample && /*#__PURE__*/React.createElement("div", {
    className: "mx-4 mt-2 p-2 rounded text-xs",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Batch of ", selectedSample.numberOfSamples || 1, " sample(s) from ", selectedSample.siteLocation, ". Requested tests: ", selectedSample.requestedTests.map(rt => rt.testTypeName).join(", "), "."), selectedSubBatch && /*#__PURE__*/React.createElement("div", {
    className: "mx-4 mt-2 p-2 rounded text-xs",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, selectedSubBatch.label, ": ", subBatchMembers.length, " sample(s) — ", subBatchMembers.map(s => s.sampleCode).join(", "), ". Test Type locked to ", selectedSubBatch.testTypeName, ".")), /*#__PURE__*/React.createElement("div", {
    className: "p-4 grid gap-3.5",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))"
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "Select Test Type", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: {
      borderColor: C.border
    },
    value: selectedTestId,
    disabled: !!selectedSubBatch,
    onChange: e => setSelectedTestId(e.target.value)
  }, testTypesForForm.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.id,
    value: t.id
  }, t.name)))), /*#__PURE__*/React.createElement(TextField, {
    label: "Test Date",
    type: "date",
    value: testDate,
    onChange: e => setTestDate(e.target.value)
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Tester Name",
    value: tester,
    onChange: e => setTester(e.target.value),
    placeholder: "e.g. M. Rahman",
    error: submitAttempted && !tester.trim() ? "Tester Name is required." : undefined
  }), /*#__PURE__*/React.createElement(SelectField, {
    label: "Equipment Used",
    value: equipmentId,
    onChange: e => setEquipmentId(e.target.value),
    options: equipment.map(e => ({
      value: e.id,
      label: e.name
    })),
    placeholder: "None"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "No. of Field Samples",
    type: "number",
    min: "0",
    value: numberOfFieldSamples,
    onChange: e => setNumberOfFieldSamples(e.target.value),
    disabled: !!selectedSubBatch,
    placeholder: selectedSubBatch ? "set by sub-batch size" : "enter every time",
    error: submitAttempted && numberOfStandardSamples === "" && numberOfFieldSamples === "" ? "No. of Samples is required." : undefined
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "No. of Standard Samples (QC)",
    type: "number",
    min: "0",
    value: numberOfStandardSamples,
    onChange: e => setNumberOfStandardSamples(e.target.value),
    placeholder: "e.g. 4 or 5",
    error: submitAttempted && numberOfStandardSamples === "" && numberOfFieldSamples === "" ? "Enter 0 if none." : undefined
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Sample Source / Client",
    value: sampleSource,
    onChange: e => setSampleSource(e.target.value),
    placeholder: "e.g. Ward-4 Tubewell / Client name"
  }), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-1.5 text-xs self-end pb-1.5",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: collectFee,
    onChange: e => setCollectFee(e.target.checked)
  }), "Collect fee for this record"))), selectedTest && /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-4 p-2 rounded flex items-center gap-4 flex-wrap",
    style: {
      background: feeApplicable && billedSamples > 0 ? C.okBg : C.infoBg,
      color: feeApplicable && billedSamples > 0 ? C.ok : C.muted
    }
  }, !feeApplicable && /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ban",
    size: 12
  }), "Fee not collected for this record — no revenue will be added."), feeApplicable && billedSamples > 0 && /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "coins",
    size: 13
  }), "৳", fmtNum(unitCost), " × ", billedSamples, " field sample(s) = ", /*#__PURE__*/React.createElement("strong", null, "৳", fmtNum(revenuePreview)), " revenue for this record"), feeApplicable && billedSamples === 0 && /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 12
  }), "Enter Field Samples above to calculate revenue for this record (standard/QC samples aren't billed).")), !selectedTest && /*#__PURE__*/React.createElement("div", {
    className: "text-sm",
    style: {
      color: C.muted
    }
  }, "No test types defined yet — ", /*#__PURE__*/React.createElement("button", {
    className: "underline",
    onClick: goToTestTypes
  }, "create one in Test Types"), " to get started."), selectedTest && chemGroups.length === 0 && (selectedTest.gasRequirements || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-sm mb-3 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "This test type doesn't consume any chemical or gas from inventory — you can save it directly for revenue tracking."), selectedTest && chemGroups.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold uppercase tracking-wide mb-2 mt-1 flex items-center gap-1.5",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "flask",
    size: 13,
    color: C.teal
  }), "Calculated Chemical Consumption (FEFO Auto-Allocation)"), selectedTest && chemGroups.map(req => renderRequirementGroup(req, null, "main")), selectedTest && (selectedTest.gasRequirements || []).length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Gas Cylinder Usage",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, "Select which cylinder each gas was drawn from. Gas Name and Cylinder are always recorded; tick \"Update Gas Inventory\" only if the drawn amount should be deducted from that cylinder's stock."), renderGasChecklist(selectedTest.gasRequirements, gasesUsed, setGasesUsed)), selectedTest && selectedTest.dilutionEnabled && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Dilution",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-end gap-3 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-1.5 text-xs",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: dilutionRequired,
    onChange: e => setDilutionRequired(e.target.checked)
  }), "Dilution Required for this record (result looked absurd — likely high trace elements)"), dilutionRequired && /*#__PURE__*/React.createElement(TextField, {
    label: "No. of Samples Requiring Dilution",
    type: "number",
    min: "0",
    value: numberOfDilutedSamples,
    onChange: e => setNumberOfDilutedSamples(e.target.value),
    placeholder: "e.g. 2",
    error: submitAttempted && dilutionRequired && numberOfDilutedSamples === "" ? "No. of Samples Requiring Dilution is required." : undefined
  })), dilutionRequired && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Dilution chemical/gas use is added to inventory deduction only — it never affects revenue."), dilutionGroups.map(req => renderRequirementGroup(req, null, "dilution")), (selectedTest.dilutionGasRequirements || []).length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Dilution Gas Used"), renderGasChecklist(selectedTest.dilutionGasRequirements, dilutionGasesUsed, setDilutionGasesUsed)))), selectedTest && resultParameters.length > 0 && !selectedSubBatch && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Calculated Results",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3",
    style: {
      color: C.muted
    }
  }, "Enter the raw readings below — the final value is computed automatically from this method's formula."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, resultParameters.map(p => {
    const res = computeResult(p);
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: "rounded p-2.5",
      style: {
        border: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs font-semibold mb-1.5",
      style: {
        color: C.ink
      }
    }, p.name || "(unnamed result)"), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-2 mb-1.5"
    }, p.inputs.map(inp => /*#__PURE__*/React.createElement("label", {
      key: inp.id,
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, inp.label || inp.key, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: (resultInputs[p.id] || {})[inp.key] ?? "",
      onChange: e => setResultInput(p.id, inp.key, e.target.value),
      className: "px-2 py-1 rounded text-sm w-32",
      style: {
        border: `1px solid ${C.border}`
      }
    })))), res.ok ? /*#__PURE__*/React.createElement("div", {
      className: "text-sm font-semibold",
      style: {
        color: C.ok
      }
    }, p.name, " = ", fmtNum(res.value), " ", p.unit) : /*#__PURE__*/React.createElement("div", {
      className: "text-xs flex items-center gap-1",
      style: {
        color: C.muted
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 11
    }), res.error));
  }))), selectedSubBatch && resultParameters.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Individual Results per Sample (Sub-Batch)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3",
    style: {
      color: C.muted
    }
  }, "Each sample in this sub-batch gets its own reading and computed result."), /*#__PURE__*/React.createElement("div", {
    className: "table-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, [/*#__PURE__*/React.createElement("th", {
    key: "sample-col",
    className: "text-left p-1.5",
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, "Sample"), ...resultParameters.map(p => /*#__PURE__*/React.createElement("th", {
    key: p.id,
    className: "text-left p-1.5",
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, p.name, p.unit ? ` (${p.unit})` : ""))])), /*#__PURE__*/React.createElement("tbody", null, selectedSubBatch.memberSampleIds.map(sampleId => renderSubBatchMemberRow(sampleId)))))), selectedSubBatch && resultParameters.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "mx-4 text-xs p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "This method has no calculated result formula defined (Test Types → Calculated Results) — add one to enable per-sample entry here."), selectedTest && qcRules.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "QC Check (optional)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, "If this record is a QC sample (blank, duplicate, spike, calibration check), select the type and enter the measured value for an immediate pass/fail against this method's acceptance rule."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 items-end"
  }, /*#__PURE__*/React.createElement(SelectField, {
    label: "This record is a",
    value: qcSampleType,
    onChange: e => setQcSampleType(e.target.value),
    options: qcRules.map(r => ({
      value: r.qcType,
      label: `${QC_RULE_TYPES.find(q => q.value === r.qcType)?.label || r.qcType}${r.label ? ` — ${r.label}` : ""}`
    })),
    placeholder: "Regular sample (no QC check)"
  }), matchedQcRule && !isBracketing && /*#__PURE__*/React.createElement(TextField, {
    label: `Measured Value${matchedQcRule.unit ? ` (${matchedQcRule.unit})` : ""}`,
    type: "number",
    value: qcMeasuredValue,
    onChange: e => setQcMeasuredValue(e.target.value)
  })), matchedQcRule && !isBracketing && qcEvaluation && /*#__PURE__*/React.createElement("div", {
    className: "mt-2 text-xs font-medium p-2 rounded flex items-center gap-1.5",
    style: {
      background: qcEvaluation.pass ? C.okBg : C.warnBg,
      color: qcEvaluation.pass ? C.ok : C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: qcEvaluation.pass ? "check" : "warning",
    size: 13
  }), qcEvaluation.message), matchedQcRule && isBracketing && /*#__PURE__*/React.createElement("div", {
    className: "mt-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, "Insert a QC checkpoint (a known standard/control) before the first sample, after the last sample, and every ", matchedQcRule.bracketingInterval || "N", " samples in between — the usual bracketing/interspersed pattern for a run."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: autoLayoutBracketingPoints
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 12
  }), "Auto-Layout Checkpoints", bracketingRunLength ? ` (run of ${bracketingRunLength})` : ""), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => addBracketingPoint()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 12
  }), "Add Checkpoint")), bracketingPoints.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "No checkpoints yet — use Auto-Layout or add them one at a time.") : /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1.5"
  }, bracketingPoints.map(p => {
    const ev = p.value !== "" ? evaluateQcRule(matchedQcRule, p.value) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: "flex items-center gap-2 text-xs p-1.5 rounded",
      style: {
        background: ev ? ev.pass ? C.okBg : C.warnBg : C.bg
      }
    }, /*#__PURE__*/React.createElement("input", {
      value: p.label,
      onChange: e => updateBracketingPoint(p.id, {
        label: e.target.value
      }),
      className: "border rounded px-2 py-1 flex-1",
      style: {
        borderColor: C.border
      }
    }), /*#__PURE__*/React.createElement("input", {
      type: "number",
      placeholder: `Value${matchedQcRule.unit ? ` (${matchedQcRule.unit})` : ""}`,
      value: p.value,
      onChange: e => updateBracketingPoint(p.id, {
        value: e.target.value
      }),
      className: "border rounded px-2 py-1 w-32",
      style: {
        borderColor: C.border
      }
    }), ev && /*#__PURE__*/React.createElement(Icon, {
      name: ev.pass ? "check" : "warning",
      size: 13,
      color: ev.pass ? C.ok : C.warn
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeBracketingPoint(p.id),
      title: "Remove checkpoint",
      style: {
        color: C.warn
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "trash",
      size: 13
    })));
  })), bracketingEvaluated.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-2 text-xs font-medium p-2 rounded flex items-center gap-1.5",
    style: {
      background: bracketingOverallPass ? C.okBg : C.warnBg,
      color: bracketingOverallPass ? C.ok : C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: bracketingOverallPass ? "check" : "warning",
    size: 13
  }), bracketingEvaluated.filter(p => p.pass).length, "/", bracketingEvaluated.length, " checkpoint(s) within limits"))), selectedTest && /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, editingRecord && /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: handleCancelEdit
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleSave
  }, editingRecord ? "Update Test Record" : "Save Test Record")));
}
// ============================================================================
// BULK RESULT UPLOAD — for the common real-world case: testing already
// happened on paper/instrument-side, and the tester now has the finished
// numbers in hand and just needs them in the system for reporting. Downloads
// an Excel template (Sample Code + one blank column per result parameter,
// plus optional QC checkpoint rows), and re-imports the filled sheet to
// create Test Records directly — no formula/inputs re-entry needed.
// ============================================================================
// ============================================================================
// PER-RECORD BULK RESULT UPLOAD — for a Test Record that's already been
// saved (single sample or a sub-batch run), download an Excel template
// pre-filled with that record's own sample list + current values, patch in
// the real numbers you already have on paper/instrument printout, and
// re-upload to correct/fill exactly those samples — nothing else.
// ============================================================================
function bulkResultParamHeader(p) {
  return `${p.name}${p.unit ? ` (${p.unit})` : ""}`;
}
const GENERIC_RESULT_PARAM_ID = "generic_result";
const GENERIC_VALUE_HEADER = "Result Value";
const GENERIC_UNIT_HEADER = "Unit (optional)";
function recordMemberRows(record) {
  // Normalizes both shapes (single-sample vs sub-batch) into one list.
  if (record.memberResults && record.memberResults.length) return record.memberResults;
  if (record.sampleId) return [{
    sampleId: record.sampleId,
    sampleCode: record.sampleCode || "",
    results: record.results || []
  }];
  return [];
}
function downloadRecordResultTemplate(record, testType, samples) {
  const members = recordMemberRows(record);
  const params = testType?.resultParameters || [];
  // Most test types here are set up for chemical/inventory tracking only and
  // don't have Result Parameters configured (that's an optional, separate
  // setup in Test Types → Calculated Results). Without at least one
  // parameter there is no column to name — so fall back to one generic
  // "Result Value" column instead of shipping a template with nothing to
  // fill in.
  const headers = params.length ? ["SampleCode", "ClientName", ...params.map(bulkResultParamHeader)] : ["SampleCode", "ClientName", GENERIC_VALUE_HEADER, GENERIC_UNIT_HEADER];
  const rows = members.map(m => {
    const sample = (samples || []).find(s => s.id === m.sampleId);
    if (!params.length) {
      const existing = (m.results || []).find(r => r.paramId === GENERIC_RESULT_PARAM_ID);
      return [m.sampleCode, sample?.clientName || "", existing?.value ?? "", existing?.unit || ""];
    }
    const byParamId = {};
    (m.results || []).forEach(r => byParamId[r.paramId] = r.value);
    return [m.sampleCode, sample?.clientName || "", ...params.map(p => byParamId[p.id] ?? "")];
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.writeFile(wb, `${(testType?.name || "test").replace(/[^a-z0-9]+/gi, "_")}_${record.date}_results.xlsx`);
}
function RecordBulkUploadModal({
  record,
  testType,
  samples,
  onApply,
  onClose,
  notify
}) {
  const members = recordMemberRows(record);
  const params = testType?.resultParameters || [];
  const isGeneric = params.length === 0;
  const [pendingRows, setPendingRows] = React.useState(null);
  function handleFile(file) {
    readWorkbook(file, (err, rows) => {
      if (err) return notify?.("Could not read Excel file", "warn");
      setPendingRows(rows);
    });
  }
  const preview = React.useMemo(() => {
    if (!pendingRows) return null;
    let matched = 0,
      unmatched = 0,
      blank = 0;
    pendingRows.forEach(row => {
      const code = String(row.SampleCode || "").trim();
      if (!code) return;
      const member = members.find(m => m.sampleCode === code);
      if (!member) {
        unmatched++;
        return;
      }
      const hasAnyValue = isGeneric ? String(row[GENERIC_VALUE_HEADER] ?? "").trim() !== "" : params.some(p => String(row[bulkResultParamHeader(p)] ?? "").trim() !== "");
      if (!hasAnyValue) blank++;else matched++;
    });
    return {
      matched,
      unmatched,
      blank
    };
  }, [pendingRows, members, params, isGeneric]);
  function confirmApply() {
    const updatedMembers = members.map(m => {
      const row = pendingRows.find(r => String(r.SampleCode || "").trim() === m.sampleCode);
      if (!row) return m;
      const existingByParamId = {};
      (m.results || []).forEach(r => existingByParamId[r.paramId] = r);
      let results;
      if (isGeneric) {
        const raw = row[GENERIC_VALUE_HEADER];
        const existing = existingByParamId[GENERIC_RESULT_PARAM_ID];
        if (raw === "" || raw == null) {
          results = existing ? [existing] : [];
        } else {
          const num = Number(raw);
          results = [{
            paramId: GENERIC_RESULT_PARAM_ID,
            name: testType?.name || record.testTypeName || "Result",
            unit: String(row[GENERIC_UNIT_HEADER] || existing?.unit || ""),
            value: Number.isNaN(num) ? null : num,
            error: Number.isNaN(num) ? "Non-numeric value in upload" : null
          }];
        }
      } else {
        results = params.map(p => {
          const raw = row[bulkResultParamHeader(p)];
          const existing = existingByParamId[p.id];
          if (raw === "" || raw == null) return existing || {
            paramId: p.id,
            name: p.name,
            unit: p.unit,
            value: null,
            error: "No value provided"
          };
          const num = Number(raw);
          return {
            paramId: p.id,
            name: p.name,
            unit: p.unit,
            value: Number.isNaN(num) ? null : num,
            error: Number.isNaN(num) ? "Non-numeric value in upload" : null
          };
        });
      }
      return {
        ...m,
        results
      };
    });
    onApply(updatedMembers);
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Bulk Upload Results — ${testType?.name || record.testTypeName}`,
    onClose: onClose,
    wide: true
  }, isGeneric && /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "This test type has no Result Parameters configured yet, so the template uses one generic \"", GENERIC_VALUE_HEADER, "\" column. For multi-parameter methods (e.g. pH + Turbidity), set up named parameters under Test Types \u2192 the method \u2192 Calculated Results, then this template will use those column names instead."), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3",
    style: {
      color: C.muted
    }
  }, "This only affects the ", members.length, " sample(s) already in this record (", record.date, "). Download the template, fill in the values you already have, then upload it back — blank cells leave the existing value untouched."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center gap-2 mb-3"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => downloadRecordResultTemplate(record, testType, samples)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 13
  }), "Download Template"), /*#__PURE__*/React.createElement("label", {
    className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer",
    style: {
      border: `1px solid ${C.teal}`,
      color: C.teal
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 13
  }), "Upload Filled Template", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: ".xlsx,.xls",
    className: "hidden",
    onChange: e => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
      e.target.value = "";
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1 max-h-56 overflow-y-auto p-1 rounded mb-3",
    style: {
      border: `1px solid ${C.border}`
    }
  }, members.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.sampleId || m.sampleCode,
    className: "flex flex-wrap items-center gap-2 px-2 py-1.5 text-xs"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-semibold"
  }, m.sampleCode), (m.results || []).filter(r => r.value != null).map(r => /*#__PURE__*/React.createElement("span", {
    key: r.paramId,
    className: "px-1.5 py-0.5 rounded",
    style: {
      background: C.okBg,
      color: C.ok
    }
  }, r.name, ": ", fmtNum(r.value), " ", r.unit)), (m.results || []).every(r => r.value == null) && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.muted
    }
  }, "no result yet")))), preview && /*#__PURE__*/React.createElement("div", {
    className: "p-3 rounded mb-3",
    style: {
      border: `1px solid ${C.border}`,
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, preview.matched, " sample(s) will be updated", preview.unmatched || preview.blank ? ` · skipping ${preview.unmatched + preview.blank} row(s) (${preview.unmatched} unmatched code, ${preview.blank} blank)` : ""), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: confirmApply
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), "Confirm & Apply"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => setPendingRows(null)
  }, "Cancel"))));
}


function TestRecordsTab({
  testRecords,
  setTestRecords,
  chemicals,
  setChemicals,
  gasList,
  setGasList,
  samples,
  setSamples,
  testTypes,
  notify,
  onEditRecord
}) {
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [bulkUploadRecord, setBulkUploadRecord] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const toggleExpand = id => setExpanded(prev => ({
    ...prev,
    [id]: !prev[id]
  }));
  function applyBulkResults(updatedMembers) {
    const record = bulkUploadRecord;
    setTestRecords(prev => prev.map(r => {
      if (r.id !== record.id) return r;
      if (r.memberResults && r.memberResults.length) return {
        ...r,
        memberResults: updatedMembers
      };
      // single-sample shape: updatedMembers has exactly one entry
      return {
        ...r,
        results: updatedMembers[0]?.results || r.results
      };
    }));
    notify?.(`Updated results for ${updatedMembers.length} sample(s) on this record.`, "ok");
    setBulkUploadRecord(null);
  }
  const PAGE_SIZE = 10;
  function doDelete(rec) {
    setChemicals(prev => markExpiredBatches(restoreConsumption(prev, rec.bottleLog || {})));
    if (rec.gasLog && rec.gasLog.length > 0) setGasList(prev => restoreGasConsumption(prev, rec.gasLog));
    setTestRecords(prev => prev.filter(r => r.id !== rec.id));
    setDeleteRecord(null);
    notify("Test record deleted — consumed chemical/gas amounts were restored.");
  }
  const q = search.trim().toLowerCase();
  const filtered = [...testRecords].reverse().filter(r => {
    if (!q) return true;
    return [r.tester, r.testTypeName, r.equipmentName, r.date, r.sampleSource].some(v => (v || "").toLowerCase().includes(q));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);
  function exportFiltered() {
    const rows = filtered.map(r => ({
      Date: r.date,
      Tester: r.tester,
      Test: r.testTypeName,
      SampleSource: r.sampleSource || "",
      Equipment: r.equipmentName || "",
      Standard_Samples: r.numberOfStandardSamples ?? 0,
      Field_Samples: r.numberOfFieldSamples ?? r.numberOfSamples ?? 0,
      Chemicals_Used: Object.entries(r.consumption).map(([k, v]) => `${k}: ${fmtNum(v)}ml`).join(", "),
      Gas_Used: (r.gasesUsed || []).map(g => g.gasName).join(", "),
      Dilution: r.dilutionRequired ? `${r.numberOfDilutedSamples || 0} sample(s)` : "No",
      Revenue: r.feeApplicable === false ? "Free" : fmtNum(r.revenue || 0)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Test Records");
    XLSX.writeFile(wb, "test_records.xlsx");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: `All Test Records (${testRecords.length})`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    }),
    right: /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 flex-wrap no-print"
    }, /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-1.5 text-xs",
      style: {
        color: C.muted
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 13
    }), /*#__PURE__*/React.createElement("input", {
      value: search,
      onChange: e => {
        setSearch(e.target.value);
        setPage(1);
      },
      placeholder: "Search tester, test, sample source...",
      className: "border rounded px-2 py-1 text-xs w-56",
      style: {
        borderColor: C.border
      }
    })), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: exportFiltered
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "download",
      size: 13
    }), "Export Excel"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: () => window.print()
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "printer",
      size: 13
    }), "Print / Save as PDF"))
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Deleting a test record returns the chemical amounts it used back to the exact bottles (batches) they were drawn from."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, pageRows.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs py-2",
    style: {
      color: C.muted
    }
  }, testRecords.length === 0 ? "No test records yet." : "No records match your search."), pageRows.map(r => {
    const isOpen = !!expanded[r.id];
    const chemPairs = Object.entries(r.consumption);
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      className: "rounded",
      style: {
        border: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleExpand(r.id),
      className: "w-full flex items-center gap-3 px-3 py-2 text-left flex-wrap",
      style: {
        background: isOpen ? "#F3FAF9" : "#fff"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: isOpen ? "chevronDown" : "chevronRight",
      size: 14,
      color: C.muted
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-xs w-24 shrink-0",
      style: {
        color: C.muted
      }
    }, r.date), /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-semibold flex-1 min-w-[140px]",
      style: {
        color: C.ink
      }
    }, r.testTypeName), /*#__PURE__*/React.createElement("span", {
      className: "text-xs",
      style: {
        color: C.muted
      }
    }, "Tester: ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.ink
      }
    }, r.tester)), r.source === "bulk-result-import" && /*#__PURE__*/React.createElement(Badge, {
      tone: "muted"
    }, "Bulk Import"), /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, r.numberOfStandardSamples ?? 0, " std · ", r.numberOfFieldSamples ?? r.numberOfSamples ?? 0, " field"), r.dilutionRequired && /*#__PURE__*/React.createElement(Badge, {
      tone: "warn"
    }, r.numberOfDilutedSamples || 0, " diluted"), r.qcCheck && /*#__PURE__*/React.createElement(Badge, {
      tone: r.qcCheck.pass ? "ok" : "warn"
    }, "QC ", r.qcCheck.pass ? "Pass" : "Fail"), r.feeApplicable === false ? /*#__PURE__*/React.createElement(Badge, {
      tone: "muted"
    }, "Free") : /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, "৳", fmtNum(r.revenue || 0)), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-1 ml-auto",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(IconButton, {
      name: "upload",
      color: C.teal,
      title: "Bulk upload results for this record's sample(s) from Excel",
      onClick: () => setBulkUploadRecord(r)
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit full test record",
      onClick: () => onEditRecord(r)
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: "Delete record",
      onClick: () => setDeleteRecord(r)
    }))), isOpen && /*#__PURE__*/React.createElement("div", {
      className: "px-4 py-3 text-xs grid grid-cols-2 md:grid-cols-3 gap-3",
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      }
    }, "Sample Source"), /*#__PURE__*/React.createElement("div", {
      className: "font-medium",
      style: {
        color: C.ink
      }
    }, r.sampleSource || "—")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      }
    }, "Equipment"), /*#__PURE__*/React.createElement("div", {
      className: "font-medium",
      style: {
        color: C.ink
      }
    }, r.equipmentName || "—")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      }
    }, "Revenue Detail"), /*#__PURE__*/React.createElement("div", {
      className: "font-medium",
      style: {
        color: C.ink
      }
    }, r.feeApplicable === false ? "Free test" : r.revenue != null ? `${r.billedSamples ?? r.numberOfSamples} × ৳${fmtNum(r.unitCost || 0)}` : "—")), (r.memberResults || []).length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "col-span-2 md:col-span-3"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      },
      className: "mb-1"
    }, "Samples in this Sub-Batch (", r.memberResults.length, ")"), /*#__PURE__*/React.createElement("div", {
      className: "grid gap-1"
    }, r.memberResults.map(m => /*#__PURE__*/React.createElement("div", {
      key: m.sampleId,
      className: "flex flex-wrap items-center gap-1.5 px-2 py-1 rounded",
      style: {
        background: C.bg
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-semibold",
      style: {
        color: C.ink
      }
    }, m.sampleCode), (m.results || []).filter(res => res.value != null).map(res => /*#__PURE__*/React.createElement("span", {
      key: res.paramId,
      className: "px-1.5 py-0.5 rounded",
      style: {
        background: C.okBg,
        color: C.ok
      }
    }, res.name, ": ", fmtNum(res.value), " ", res.unit)), (m.results || []).every(res => res.value == null) && /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.warn
      }
    }, "no result yet"))))), (r.results || []).filter(res => res.value !== null).length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "col-span-2 md:col-span-3"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      },
      className: "mb-1"
    }, "Calculated Results"), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-1.5"
    }, r.results.filter(res => res.value !== null).map(res => /*#__PURE__*/React.createElement("span", {
      key: res.paramId,
      className: "px-2 py-0.5 rounded font-medium",
      style: {
        background: C.okBg,
        color: C.ok
      }
    }, res.name, ": ", fmtNum(res.value), " ", res.unit)))), r.qcCheck && /*#__PURE__*/React.createElement("div", {
      className: "col-span-2 md:col-span-3"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      },
      className: "mb-1"
    }, "QC Check"), r.qcCheck.qcType === "bracketing" ? /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-1"
    }, (r.qcCheck.points || []).map((p, i) => /*#__PURE__*/React.createElement("span", {
      key: p.id || i,
      className: "px-2 py-1 rounded inline-flex items-center gap-1",
      style: {
        background: p.pass ? C.okBg : C.warnBg,
        color: p.pass ? C.ok : C.warn
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: p.pass ? "check" : "warning",
      size: 11
    }), p.label, ": ", p.value))) : /*#__PURE__*/React.createElement("div", {
      className: "px-2 py-1 rounded inline-flex items-center gap-1.5",
      style: {
        background: r.qcCheck.pass ? C.okBg : C.warnBg,
        color: r.qcCheck.pass ? C.ok : C.warn
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: r.qcCheck.pass ? "check" : "warning",
      size: 12
    }), r.qcCheck.label || r.qcCheck.qcType, ": ", r.qcCheck.value, " — ", r.qcCheck.message)), /*#__PURE__*/React.createElement("div", {
      className: "col-span-2 md:col-span-3"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      },
      className: "mb-1"
    }, "Chemicals Used"), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-1.5"
    }, chemPairs.length === 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.muted
      }
    }, "—"), chemPairs.map(([k, v]) => /*#__PURE__*/React.createElement("span", {
      key: k,
      className: "px-2 py-0.5 rounded",
      style: {
        background: C.okBg,
        color: C.ok
      }
    }, k, ": ", fmtNum(v), "ml")))), /*#__PURE__*/React.createElement("div", {
      className: "col-span-2 md:col-span-3"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      },
      className: "mb-1"
    }, "Gas Used"), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-1.5"
    }, (r.gasesUsed || []).length === 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.muted
      }
    }, "—"), (r.gasesUsed || []).map(g => /*#__PURE__*/React.createElement("span", {
      key: g.gasId,
      className: "px-2 py-0.5 rounded",
      style: {
        background: C.infoBg,
        color: C.info
      }
    }, g.gasName, g.amount ? `: ${fmtNum(g.amount)}` : "")))), r.dilutionRequired && (r.dilutionGasesUsed || []).length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "col-span-2 md:col-span-3"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      },
      className: "mb-1"
    }, "Dilution Gas Used"), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-1.5"
    }, r.dilutionGasesUsed.map(g => /*#__PURE__*/React.createElement("span", {
      key: g.gasId,
      className: "px-2 py-0.5 rounded",
      style: {
        background: C.infoBg,
        color: C.info
      }
    }, g.gasName, g.amount ? `: ${fmtNum(g.amount)}` : ""))))), deleteRecord?.id === r.id && /*#__PURE__*/React.createElement("div", {
      className: "px-3 pb-2"
    }, /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete this test record (${r.date} · ${r.testTypeName})? Consumed chemical amounts will be returned to their bottles.`,
      onConfirm: () => doDelete(r),
      onCancel: () => setDeleteRecord(null)
    })));
  })), filtered.length > PAGE_SIZE && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mt-3 text-xs",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "Page ", pageClamped, " of ", totalPages, " · ", filtered.length, " record(s)"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    disabled: pageClamped <= 1,
    onClick: () => setPage(pageClamped - 1)
  }, "Prev"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    disabled: pageClamped >= totalPages,
    onClick: () => setPage(pageClamped + 1)
  }, "Next")))), bulkUploadRecord && /*#__PURE__*/React.createElement(RecordBulkUploadModal, {
    record: bulkUploadRecord,
    testType: testTypes?.find(t => t.id === bulkUploadRecord.testTypeId),
    samples: samples,
    onApply: applyBulkResults,
    onClose: () => setBulkUploadRecord(null),
    notify: notify
  }));
}
