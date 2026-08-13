// ===== 16-test-run.js =====
// ============================================================================
// TEST RUN MODULE — for methods where many field samples (15-20+) are run
// together in one analytical batch, sharing one QC check (blank/duplicate/
// spike) but each producing its own individual result. Sits between Sample
// registration and the single-sample "Add Test Record" flow: one Test Run
// produces ONE test record carrying an array of per-member results
// (`memberResults`), rather than N separate records.
//
// Scope note: unlike Add Test Record, this module does not yet deduct
// chemical/gas inventory per run — it focuses on getting result + QC data
// captured correctly for many samples at once. Inventory consumption for
// batch runs can be added later without changing this data shape.
// ============================================================================

const RUN_ELIGIBLE_STATUSES = ["registered", "received", "assigned", "in_progress"];

// Shared lookup used by the QC Module banner, Sample review, and the Report
// Generator: find a sample's result for a given test, whether it came from a
// single Add Test Record entry or from inside a Test Run's memberResults.
function getSampleResultForTest(sample, testTypeId, testRecords) {
  const direct = (testRecords || []).find(r => r.testTypeId === testTypeId && r.sampleId === sample.id);
  if (direct) return {
    results: direct.results || [],
    recordId: direct.id,
    date: direct.date,
    source: "single"
  };
  const run = (testRecords || []).find(r => r.testTypeId === testTypeId && Array.isArray(r.memberSampleIds) && r.memberSampleIds.includes(sample.id));
  if (run) {
    const member = (run.memberResults || []).find(m => m.sampleId === sample.id);
    if (member) return {
      results: member.results || [],
      recordId: run.id,
      date: run.date,
      source: "run"
    };
  }
  return null;
}
function TestRunTab({
  testTypes,
  samples,
  setSamples,
  testRecords,
  setTestRecords,
  equipment,
  notify
}) {
  const [selectedTestId, setSelectedTestId] = React.useState("");
  const [selectedSampleIds, setSelectedSampleIds] = React.useState([]);
  const [tester, setTester] = React.useState("");
  const [testDate, setTestDate] = React.useState(todayStr());
  const [equipmentId, setEquipmentId] = React.useState("");
  const [memberInputs, setMemberInputs] = React.useState({});
  const [qcSampleType, setQcSampleType] = React.useState("");
  const [qcMeasuredValue, setQcMeasuredValue] = React.useState("");
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const selectedTest = testTypes.find(t => t.id === selectedTestId);
  const resultParameters = selectedTest?.resultParameters || [];
  const qcRules = selectedTest?.qcRules || [];
  const matchedQcRule = qcSampleType ? qcRules.find(r => r.qcType === qcSampleType) : null;
  const qcEvaluation = matchedQcRule && qcMeasuredValue !== "" ? evaluateQcRule(matchedQcRule, qcMeasuredValue) : null;
  const eligibleSamples = selectedTestId ? samples.filter(s => RUN_ELIGIBLE_STATUSES.includes(s.status) && s.requestedTests.some(rt => rt.testTypeId === selectedTestId)) : [];
  const hasQc = !!(matchedQcRule && qcMeasuredValue !== "");
  const qcFrequencyWarning = selectedTest?.qcFrequency && selectedSampleIds.length > selectedTest.qcFrequency && !hasQc ? `This run has ${selectedSampleIds.length} samples — more than the QC frequency of ${selectedTest.qcFrequency} set for this method. Add a QC check below before saving.` : null;
  function toggleMember(id) {
    setSelectedSampleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
  function resetForm() {
    setSelectedSampleIds([]);
    setMemberInputs({});
    setQcSampleType("");
    setQcMeasuredValue("");
    setSubmitAttempted(false);
  }
  async function handleSubmit() {
    setSubmitAttempted(true);
    if (!selectedTestId || !tester.trim() || selectedSampleIds.length === 0) {
      notify("Select a test type, enter a tester name, and pick at least one sample.", "warn");
      return;
    }
    const memberResults = selectedSampleIds.map(sampleId => {
      const sample = samples.find(s => s.id === sampleId);
      return {
        sampleId,
        sampleCode: sample?.sampleCode || "",
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
    });
    const newRecord = {
      id: uid("rec"),
      runId: uid("run"),
      testTypeId: selectedTestId,
      testTypeName: selectedTest.name,
      date: testDate,
      tester: tester.trim(),
      equipmentId: equipmentId || null,
      equipmentName: equipment.find(e => e.id === equipmentId)?.name || "",
      sampleId: null,
      sampleCode: "",
      memberSampleIds: selectedSampleIds,
      numberOfFieldSamples: selectedSampleIds.length,
      memberResults,
      qcCheck: hasQc ? {
        ruleId: matchedQcRule.id,
        qcType: matchedQcRule.qcType,
        label: matchedQcRule.label,
        value: Number(qcMeasuredValue),
        pass: qcEvaluation?.pass ?? null,
        message: qcEvaluation?.message || ""
      } : null
    };
    setTestRecords(prev => [...prev, newRecord]);
    if (setSamples) {
      const updatedMembers = [];
      for (const sampleId of selectedSampleIds) {
        const member = samples.find(s => s.id === sampleId);
        if (!member) continue;
        updatedMembers.push({
          ...member,
          linkedTestRecordIds: [...(member.linkedTestRecordIds || []), newRecord.id]
        });
      }
      if (updatedMembers.length) {
        // Update local state without triggering per-item server calls
        updatedMembers.forEach(u => {
          setSamples(prev => prev.map(s => s.id === u.id ? u : s), null);
        });
        
        // Persist all changes in one bulkUpsert call — only these rows,
        // no full-table re-fetch/replace, so it's fast even with a huge
        // samples table and can't race with another bulk action.
        DataService.bulkUpsert("samples", updatedMembers).then(() => {
          // One audit entry summarizing the batch action
          return DataService.appendAudit({
            entity: "sample",
            entityId: updatedMembers.map(s => s.id).join(","),
            action: "link_test_record",
            user: session.username,
            role: session.role,
            note: `Linked ${updatedMembers.length} sample(s) to test record "${selectedTest.name}"`
          });
        }).catch(err => {
          console.error("Failed to persist linked samples to backend:", err);
        });
      }
    }
    notify(`Test run saved — ${selectedSampleIds.length} sample(s) logged for ${selectedTest.name}.${hasQc ? " QC check recorded." : ""}`, "ok");
    resetForm();
  }
  function renderMemberRow(sampleId) {
    const sample = samples.find(s => s.id === sampleId);
    const cells = [/*#__PURE__*/React.createElement("td", {
      key: "code",
      className: "p-1.5 font-medium",
      style: {
        borderBottom: `1px solid ${C.border}`
      }
    }, sample?.sampleCode)];
    resultParameters.forEach(p => {
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
        className: "flex gap-1"
      }, inputEls)));
    });
    return /*#__PURE__*/React.createElement("tr", {
      key: sampleId
    }, cells);
  }
  return /*#__PURE__*/React.createElement(SectionCard, {
    title: "Test Run — Batch Testing",
    subtitle: "Run one method across many field samples together, with a single shared QC check.",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 16
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3.5",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))"
    }
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Test Type",
    value: selectedTestId,
    onChange: v => {
      setSelectedTestId(v);
      resetForm();
    },
    options: testTypes.map(t => ({
      value: t.id,
      label: t.name
    })),
    placeholder: "Select a method"
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Tester Name",
    value: tester,
    onChange: v => setTester(v),
    error: submitAttempted && !tester.trim() ? "Required." : undefined
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Test Date",
    type: "date",
    value: testDate,
    onChange: v => setTestDate(v)
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Equipment Used",
    value: equipmentId,
    onChange: v => setEquipmentId(v),
    options: equipment.map(e => ({
      value: e.id,
      label: e.name
    })),
    placeholder: "None"
  })), !selectedTestId && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-3 rounded mt-3",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Pick a Test Type to see which registered samples are requesting it."), selectedTestId && /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold",
    style: {
      color: C.ink
    }
  }, "Select Samples for this Run (", selectedSampleIds.length, " of ", eligibleSamples.length, " selected)"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedSampleIds(eligibleSamples.map(s => s.id))
  }, "Select All"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedSampleIds([])
  }, "Clear"))), eligibleSamples.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-3 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "No pending samples are requesting this test. Register or bulk-upload samples first.") : /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1 max-h-48 overflow-y-auto p-1 rounded",
    style: {
      border: `1px solid ${C.border}`
    }
  }, eligibleSamples.map(s => /*#__PURE__*/React.createElement("label", {
    key: s.id,
    className: "flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer",
    style: {
      background: selectedSampleIds.includes(s.id) ? `${C.teal}14` : "transparent"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedSampleIds.includes(s.id),
    onChange: () => toggleMember(s.id)
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-semibold"
  }, s.sampleCode), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.muted
    }
  }, s.clientName, " · ", s.siteLocation))))), qcFrequencyWarning && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2.5 rounded mt-3 flex items-center gap-1.5",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), qcFrequencyWarning), selectedSampleIds.length > 0 && resultParameters.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Individual Results per Sample"), /*#__PURE__*/React.createElement("div", {
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
  }, p.name, p.unit ? ` (${p.unit})` : ""))])), /*#__PURE__*/React.createElement("tbody", null, selectedSampleIds.map(sampleId => renderMemberRow(sampleId)))))), selectedSampleIds.length > 0 && resultParameters.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mt-3",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "This method has no calculated result formula defined (Test Types → Calculated Results). Results for these samples can still be entered later, or add a formula to enable per-sample entry here."), selectedTestId && qcRules.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-4 pt-3",
    style: {
      borderTop: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "QC Check for this Run (shared across all selected samples)"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "QC Sample Type",
    value: qcSampleType,
    onChange: v => setQcSampleType(v),
    options: qcRules.map(r => ({
      value: r.qcType,
      label: `${QC_RULE_TYPES.find(q => q.value === r.qcType)?.label || r.qcType}${r.label ? ` — ${r.label}` : ""}`
    })),
    placeholder: "None"
  }), matchedQcRule && /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: `Measured Value${matchedQcRule.unit ? ` (${matchedQcRule.unit})` : ""}`,
    type: "number",
    value: qcMeasuredValue,
    onChange: v => setQcMeasuredValue(v)
  })), matchedQcRule && qcEvaluation && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mt-2",
    style: {
      background: qcEvaluation.pass ? C.okBg : C.warnBg,
      color: qcEvaluation.pass ? C.ok : C.warn
    }
  }, qcEvaluation.pass ? "Within acceptance limits." : qcEvaluation.message || "Outside acceptance limits.")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mt-4"
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: handleSubmit,
    disabled: !selectedTestId || selectedSampleIds.length === 0
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Save Test Run (", selectedSampleIds.length, " sample", selectedSampleIds.length === 1 ? "" : "s", ")")));
}
