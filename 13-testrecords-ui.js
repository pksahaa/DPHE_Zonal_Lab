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
  notify,
  editingRecord,
  onDoneEditing,
  goToTestTypes
}) {
  const [selectedSampleId, setSelectedSampleId] = useState("");
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
  const linkableSamples = (samples || []).filter(s => ["registered", "received", "assigned", "in_progress"].includes(s.status));
  const selectedSample = (samples || []).find(s => s.id === selectedSampleId) || null;
  // Once a sample is picked, only show the test types that sample actually requested —
  // instead of every test type in the system.
  const testTypesForForm = selectedSample ? testTypes.filter(t => selectedSample.requestedTests.some(rt => rt.testTypeId === t.id)) : testTypes;
  const chemGroups = selectedTest ? selectedTest.chemicalRequirements : [];
  const dilutionGroups = selectedTest ? selectedTest.dilutionChemicalRequirements || [] : [];
  const resultParameters = selectedTest?.resultParameters || [];
  const qcRules = selectedTest?.qcRules || [];
  const matchedQcRule = qcSampleType ? qcRules.find(r => r.qcType === qcSampleType) : null;
  const qcEvaluation = matchedQcRule && qcMeasuredValue !== "" ? evaluateQcRule(matchedQcRule, qcMeasuredValue) : null;
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
      setQcMeasuredValue(editingRecord.qcCheck ? String(editingRecord.qcCheck.value ?? "") : "");
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
      sampleId: selectedSampleId || null,
      sampleCode: selectedSample?.sampleCode || "",
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
      results: resultParameters.map(p => {
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
      qcCheck: matchedQcRule && qcMeasuredValue !== "" ? {
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
      setTestRecords(prev => [...prev, {
        id: newRecordId,
        ...recordPayload
      }]);
      if (selectedSampleId && setSamples && selectedSample) {
        const updatedSample = {
          ...selectedSample,
          linkedTestRecordIds: [...(selectedSample.linkedTestRecordIds || []), newRecordId]
        };
        setSamples(prev => prev.map(s => s.id === selectedSampleId ? updatedSample : s), updatedSample);
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
    className: "px-4 pt-4"
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
    onChange: e => setSelectedSampleId(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— No sample (standalone record) —"), linkableSamples.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.sampleCode, " — ", s.clientName, " (", s.numberOfSamples || 1, " samples)")))), selectedSample && /*#__PURE__*/React.createElement("div", {
    className: "mx-4 mt-2 p-2 rounded text-xs",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Batch of ", selectedSample.numberOfSamples || 1, " sample(s) from ", selectedSample.siteLocation, ". Requested tests: ", selectedSample.requestedTests.map(rt => rt.testTypeName).join(", "), ".")), /*#__PURE__*/React.createElement("div", {
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
    placeholder: "enter every time",
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
  }, "Dilution Gas Used"), renderGasChecklist(selectedTest.dilutionGasRequirements, dilutionGasesUsed, setDilutionGasesUsed)))), selectedTest && resultParameters.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
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
  }))), selectedTest && qcRules.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
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
  }), matchedQcRule && /*#__PURE__*/React.createElement(TextField, {
    label: `Measured Value${matchedQcRule.unit ? ` (${matchedQcRule.unit})` : ""}`,
    type: "number",
    value: qcMeasuredValue,
    onChange: e => setQcMeasuredValue(e.target.value)
  })), matchedQcRule && qcEvaluation && /*#__PURE__*/React.createElement("div", {
    className: "mt-2 text-xs font-medium p-2 rounded flex items-center gap-1.5",
    style: {
      background: qcEvaluation.pass ? C.okBg : C.warnBg,
      color: qcEvaluation.pass ? C.ok : C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: qcEvaluation.pass ? "check" : "warning",
    size: 13
  }), qcEvaluation.message)), selectedTest && /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, editingRecord && /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: handleCancelEdit
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleSave
  }, editingRecord ? "Update Test Record" : "Save Test Record")));
}
function TestRecordsTab({
  testRecords,
  setTestRecords,
  chemicals,
  setChemicals,
  gasList,
  setGasList,
  notify,
  onEditRecord
}) {
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const toggleExpand = id => setExpanded(prev => ({
    ...prev,
    [id]: !prev[id]
  }));
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
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionCard, {
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
    }, r.tester)), /*#__PURE__*/React.createElement(Badge, {
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
    }, r.feeApplicable === false ? "Free test" : r.revenue != null ? `${r.billedSamples ?? r.numberOfSamples} × ৳${fmtNum(r.unitCost || 0)}` : "—")), (r.results || []).filter(res => res.value !== null).length > 0 && /*#__PURE__*/React.createElement("div", {
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
    }, "QC Check"), /*#__PURE__*/React.createElement("div", {
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
  }, "Next")))));
}
