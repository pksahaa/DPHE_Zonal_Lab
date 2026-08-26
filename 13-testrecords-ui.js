// ============================================================================
// ARCHIVING — a record only becomes eligible for archiving once samples in
// it have actually been RELEASED (not merely results-entered/under-review/
// approved). A batch/Analytical-Batch record (memberSampleIds) can contain a
// mix — some members released, others on_hold/rejected/cancelled/still in
// review — so archiving is done PER RELEASED MEMBER, not all-or-nothing:
// releasedMemberSampleIds() below tells you exactly which member sample IDs
// (out of the whole record) are actually archivable right now. The archive
// action (see archiveOne/archiveSelectedRecords) splits a batch record:
// released members move into a new archived_records row, and any remaining
// not-yet-released members stay behind in the still-active testRecords row
// so they can be archived later once released. A legacy individual record
// (sampleId, no members) is archivable only when that one sample is
// released. If a referenced sample can no longer be found, it's treated as
// not-yet-archivable rather than guessing.
// ============================================================================
function releasedMemberSampleIds(r, samples, testRecords, subBatches) {
  if (!r) return [];
  const sampleIds = r.memberSampleIds && r.memberSampleIds.length ? r.memberSampleIds : r.sampleId ? [r.sampleId] : [];
  return sampleIds.filter(sid => {
    const sample = (samples || []).find(s => s.id === sid);
    if (!sample) return false;
    return testStageForSample(sample, r.testTypeId, testRecords, subBatches) === "released";
  });
}
function isTestRecordArchivable(r, samples, testRecords, subBatches) {
  if (!r) return false;
  return releasedMemberSampleIds(r, samples, testRecords, subBatches).length > 0;
}
// ============================================================================
// EDIT LOCK (Workflow/Data-Integrity Upgrade Step 5) — once ANY member of a
// Test Record has reached "approved" or "released", the whole record is no
// longer normally editable: approving/releasing is a formal sign-off, and
// quietly changing the numbers underneath it afterward would invalidate
// that sign-off without anyone downstream knowing. A record still at
// "results_entered"/"under_review" is untouched by this — routine editing
// before sign-off is normal lab work, not a correction.
//
// "Whole record", not per-member, because Edit changes shared fields
// (tester, equipment, chemicals, every member's results) in one save — a
// partial lock would let editing member A's results slip through a save
// that's really being driven by still-editable member B, silently altering
// A's already-approved value too.
//
// The way BACK to changing an approved/released result is Void/Invalidate
// (Step 3) — framed as "Request Correction" here (same underlying action,
// see doVoid — it already does exactly what the spec calls for: previous
// result retained, sample reset for a brand-new attempt, which Retest/
// Attempt History (Step 4) then automatically tracks as attemptNo+1).
// ============================================================================
function isTestRecordLocked(r, samples, testRecords, subBatches) {
  if (!r || r.voided) return false;
  const sampleIds = r.memberSampleIds && r.memberSampleIds.length ? r.memberSampleIds : r.sampleId ? [r.sampleId] : [];
  return sampleIds.some(sid => {
    const sample = (samples || []).find(s => s.id === sid);
    if (!sample) return false;
    const stage = testStageForSample(sample, r.testTypeId, testRecords, subBatches);
    return stage === "approved" || stage === "released";
  });
}
// ============================================================================
// RETEST FEE MODAL — the fix for revenue double-counting across retests
// (each retested sample in a batch is billed independently). Unlike the
// two-button "Waive All / Charge All" choice this replaces, every retested
// member gets its OWN checkbox, so e.g. 5 retests where 3 should be billed
// and 2 waived can be decided in a single save — the two-button version
// couldn't express that at all.
// ============================================================================
function RetestFeeModal({ samples, onClose, onConfirm }) {
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState("");
  // sampleId -> true (charge) | false/undefined (waived). Defaults to
  // waived — matches "lab decided to repeat" being the more common,
  // safer-by-default retest reason; each row is an explicit opt-IN to charge.
  const [charge, setCharge] = React.useState({});
  const [submitted, setSubmitted] = React.useState(false);
  function waiveAll() {
    setCharge({});
  }
  function chargeAll() {
    setCharge(Object.fromEntries(samples.map(s => [s.id, true])));
  }
  function confirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setErr("A reason is required.");
      return;
    }
    if (submitted) return;
    setSubmitted(true);
    onConfirm(trimmed, charge);
  }
  const chargedCount = samples.filter(s => charge[s.id]).length;
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Retest — reason & fee required",
    onClose
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs mb-3",
    style: { color: C.muted }
  }, `${samples.length} sample(s) in this Analytical Batch were previously tested for this parameter and returned/voided. Saving creates a NEW, separate attempt for each — the earlier attempt stays untouched for the audit trail. Any other, first-time sample(s) in this same batch are unaffected and still bill normally via the "Collect Fee" checkbox.`), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs mb-3",
    style: { color: C.muted }
  }, "Reason (required, applies to all retested sample(s) above)", /*#__PURE__*/React.createElement("textarea", {
    autoFocus: true,
    className: "border rounded px-2 py-1.5 text-sm",
    style: { borderColor: C.border, minHeight: 60 },
    value: reason,
    onChange: e => { setReason(e.target.value); setErr(""); },
    placeholder: "e.g. QC failure on the original run, dilution error, customer requested a re-check…"
  })), err && /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: { color: C.warn }
  }, err), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 mb-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs",
    style: { color: C.muted }
  }, "Per-sample, or apply to all at once:"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1.5"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: waiveAll
  }, "Waive All"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: chargeAll
  }, "Charge All"))), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg mb-2 overflow-hidden",
    style: { border: `1px solid ${C.border}` }
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "text-left px-2.5 py-1.5",
    style: { borderBottom: `1px solid ${C.border}`, color: C.muted, background: C.bg }
  }, "Retested Sample"), /*#__PURE__*/React.createElement("th", {
    className: "text-center px-2.5 py-1.5",
    style: { borderBottom: `1px solid ${C.border}`, color: C.muted, background: C.bg }
  }, "Waive"), /*#__PURE__*/React.createElement("th", {
    className: "text-center px-2.5 py-1.5",
    style: { borderBottom: `1px solid ${C.border}`, color: C.muted, background: C.bg }
  }, "Charge"))), /*#__PURE__*/React.createElement("tbody", null, samples.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-2.5 py-1.5",
    style: { borderBottom: `1px solid ${C.border}`, color: C.ink, fontWeight: 600 }
  }, s.code),
  // Two separate, clearly-labeled checkboxes instead of one checkbox whose
  // meaning flips depending on its checked state (was confusing — a single
  // box that's sometimes "Waived" and sometimes "Charged" reads as if
  // waive+charge were one combined thing). Waive and Charge are mutually
  // exclusive per sample, so checking one always unchecks the other —
  // exactly the same underlying state (`charge[s.id]`), just shown as two
  // explicit boxes rather than one relabeling box.
  /*#__PURE__*/React.createElement("td", {
    className: "px-2.5 py-1.5 text-center",
    style: { borderBottom: `1px solid ${C.border}` }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    "aria-label": `Waive retest fee for ${s.code}`,
    checked: !charge[s.id],
    onChange: () => setCharge(prev => ({ ...prev, [s.id]: false }))
  })),
  /*#__PURE__*/React.createElement("td", {
    className: "px-2.5 py-1.5 text-center",
    style: { borderBottom: `1px solid ${C.border}` }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    "aria-label": `Charge retest fee for ${s.code}`,
    checked: !!charge[s.id],
    onChange: () => setCharge(prev => ({ ...prev, [s.id]: true }))
  }))))))), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3",
    style: { color: C.muted }
  }, `${chargedCount} of ${samples.length} retested sample(s) will be charged; ${samples.length - chargedCount} will be waived.`), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    disabled: submitted,
    onClick: confirm
  }, "Save as Retest")));
}
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
  parameters,
  chemicals,
  setChemicals,
  equipment,
  gasList,
  setGasList,
  testRecords,
  setTestRecords,
  samples,
  setSamples,
  references,
  subBatches,
  setSubBatches,
  session,
  users,
  permissionMatrix,
  notify,
  goToSample,
  editingRecord,
  onDoneEditing,
  goToTestTypes,
  preselectSubBatchId,
  onPreselectHandled
}) {
  const trCreateGate = permGate(permissionMatrix, session, "testRecords", "create", notify, "add test records");
  const trEditGateForSave = permGate(permissionMatrix, session, "testRecords", "edit", notify, "edit test records");
  const [selectedSubBatchId, setSelectedSubBatchId] = useState("");

  // How the technician is choosing what to record results for. Individual
  // (single, unbatched) sample entry has been removed — every result entry
  // must flow through an Analytical Batch, either picked directly
  // ("subbatch") or assembled on the fly from a Reference ("batch", which
  // creates a real Sub-Batch behind the scenes via useReferenceAsSubBatch).
  const [selectionMode, setSelectionMode] = useState("batch"); // "batch" | "subbatch"
  // Deep-link from Results Workflow's "Pending Upload" queue — jump
  // straight into Sub-Batch mode with that Sub-Batch preselected.
  React.useEffect(() => {
    if (preselectSubBatchId) {
      setSelectionMode("subbatch");
      setSelectedSubBatchId(preselectSubBatchId);
      onPreselectHandled?.();
    }
    // eslint-disable-next-line
  }, [preselectSubBatchId]);
  const [selectedReferenceId, setSelectedReferenceId] = useState("");
  const [batchModeTestId, setBatchModeTestId] = useState("");
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
  // Direct result values applied via "Upload Results (Excel)" — the same
  // mechanism that used to live on the Test Records tab as a post-save
  // correction tool, now available here, pre-save, for both individual and
  // Analytical Batch entry. Keyed by sampleId (each member's sampleId for
  // the selected Sub-Batch) → array of
  // {paramId, name, unit, value, error}, same shape as a saved record's
  // results/memberResults[].results. When present for a given parameter it
  // is used as-is (bypassing formula evaluation) when the record is saved —
  // this sidesteps any raw-reading/formula mismatch entirely, the same way
  // it always has on the Test Records tab.
  const [resultOverridesBySample, setResultOverridesBySample] = useState({});
  const [showResultUploadModal, setShowResultUploadModal] = useState(false);
  const [qcSampleType, setQcSampleType] = useState(""); // "" | qcType matching a rule on selectedTest
  const [qcMeasuredValue, setQcMeasuredValue] = useState("");
  const [bracketingPoints, setBracketingPoints] = useState([]); // [{id,label,value, comparator, limitLow, limitHigh, targetValue}]
  const [numQcCheckpoints, setNumQcCheckpoints] = useState("3");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Retest/Attempt History (Workflow/Data-Integrity Upgrade Step 4) — set
  // when handleSaveInner() detects this save covers at least one sample
  // that's being re-tested (had a prior Return to Analyst/Void for this
  // exact test type). Holds the modal open until a reason is given; see
  // handleSaveInner's own comment for why the reason is threaded through as
  // a plain function argument rather than read back out of this state.
  const [retestPrompt, setRetestPrompt] = useState(null); // null | { count }
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
  // Editing an existing Analytical Batch record: that batch's status is no
  // longer "pending" (it flipped to "tested" the moment this record was
  // first saved), so looking it up only inside pendingSubBatches — as the
  // fresh-entry flow does — always came back null. That's what left the
  // Calculated Result table with no member samples to show in edit mode.
  // Resolve against the full subBatches list instead so an already-tested
  // batch still resolves once its record is opened for editing.
  const selectedSubBatch = (subBatches || []).find(sb => sb.id === selectedSubBatchId) || null;
  // Make sure the batch being edited still appears as an option in the
  // picker (it won't be in pendingSubBatches any more), so the dropdown
  // visibly shows the right selection instead of looking empty.
  const subBatchPickerOptions = selectedSubBatch && !pendingSubBatches.some(sb => sb.id === selectedSubBatch.id) ? [selectedSubBatch, ...pendingSubBatches] : pendingSubBatches;
  // Samples that still have at least one requested parameter genuinely
  // pending (not yet resulted, not already queued in a pending sub-batch
  // for that specific parameter) — computed per (sample, testType) pair via
  // pendingTestTypeIdsForSample, NOT off the sample's single overall
  // `status` field. A sample with 3 requested parameters where only 1 is
  // done must still show up here for the other 2.
  // ---- Batch (Reference) mode — pick a Reference, then a Test Type it
  // still needs; the matching samples get bundled into a real Sub-Batch
  // behind the scenes (see useReferenceAsSubBatch below) so everything
  // downstream — results entry, review, reporting — works exactly like any
  // other Sub-Batch, with no separate code path to maintain.
  const referenceOptionsForBatchMode = Array.from(new Set((samples || []).map(s => s.referenceId).filter(Boolean))).map(id => findReferenceById(references, id)).filter(Boolean).filter(ref => (samples || []).some(s => s.referenceId === ref.id && pendingTestTypeIdsForSample(s, testRecords, subBatches).length > 0)).sort((a, b) => (a.refNo || "").localeCompare(b.refNo || ""));
  const selectedReference = selectedReferenceId ? findReferenceById(references, selectedReferenceId) : null;
  const batchModeTestOptions = selectedReference ? testTypes.filter(t => (samples || []).some(s => s.referenceId === selectedReference.id && pendingTestTypeIdsForSample(s, testRecords, subBatches).includes(t.id))) : [];
  const batchModeSamples = selectedReference && batchModeTestId ? (samples || []).filter(s => s.referenceId === selectedReference.id && pendingTestTypeIdsForSample(s, testRecords, subBatches).includes(batchModeTestId)) : [];
  function useReferenceAsSubBatch() {
    if (!selectedReference || !batchModeTestId || batchModeSamples.length === 0) return;
    const test = testTypes.find(t => t.id === batchModeTestId);
    const sb = createSubBatch({
      label: `${selectedReference.refNo} — ${test?.name || ""}`,
      testTypeId: batchModeTestId,
      testTypeName: test?.name || "",
      memberSampleIds: batchModeSamples.map(s => s.id),
      assignedTester: tester
    }, subBatches, samples, references);
    setSubBatches(prev => [sb, ...prev]);
    // Bulk mode (see setSamples() in 99-app.js / markMembersInProgress()
    // in 21-sample-ui.js) — one pass + one persisted call instead of one
    // setSamples() round trip per member sample.
    const changed = [];
    const nextSamples = batchModeSamples.reduce((acc, member) => {
      const rt = (member.requestedTests || []).find(r => r.testTypeId === batchModeTestId);
      if (!rt || rt.status !== "pending") return acc;
      const updated = setRequestedTestStatus(member, batchModeTestId, "in_progress", session);
      changed.push(updated);
      return acc.map(s => s.id === member.id ? updated : s);
    }, samples || []);
    if (changed.length) setSamples(() => nextSamples, changed);
    setSelectedSubBatchId(sb.id);
    setSelectionMode("subbatch");
    notify?.(`Created ${sb.label} from this Reference — ${batchModeSamples.length} sample(s). Continue below.`, "ok");
  }
  const subBatchMembers = selectedSubBatch ? selectedSubBatch.memberSampleIds.map(id => (samples || []).find(s => s.id === id)).filter(Boolean) : [];
  // Earliest a Test Date can legitimately be — a sample can't be tested
  // before it physically existed in the lab. Uses the latest of (Received
  // Date, Collection Date) per member sample (Received Date is already
  // guaranteed >= Collection Date by validateRegistrationDates, so this is
  // effectively "on or after the sample was received"), then takes the max
  // across every member so one earlier-registered sample in a batch can't
  // let the whole batch's Test Date sit before a later-registered member.
  function sampleEarliestTestDate(s) {
    return s.receivedDate || s.collectionDate || null;
  }
  const editingMembers = !selectedSubBatch && editingRecord && editingRecord.sampleId
    ? [(samples || []).find(s => s.id === editingRecord.sampleId)].filter(Boolean)
    : [];
  const testDateMembers = selectedSubBatch ? subBatchMembers : editingMembers;
  const minTestDate = testDateMembers.reduce((min, s) => {
    const d = sampleEarliestTestDate(s);
    return d && (!min || d > min) ? d : min;
  }, null);
  // Preview-only: which of the currently selected batch's members are
  // retests (attemptNo > 1) — surfaced as a heads-up banner before save so
  // the "Retest — reason & fee required" modal doesn't come as a surprise.
  const retestMembersPreview = selectedSubBatch && !editingRecord
    ? subBatchMembers.filter(s => computeAttemptInfo(s, selectedSubBatch.testTypeId, testRecords).attemptNo > 1)
    : [];
  // Client auto-populates from the Reference(s) behind the selected batch/
  // sub-batch — same source (Reference.contactPerson — the Client Name from
  // the Client Part paperwork) and the same "recompute on selection change"
  // behaviour as the Custom Report's "Sent by" field (17-report-generator.js).
  // Still a plain editable field afterwards, same as that one.
  React.useEffect(() => {
    if (editingRecord) return;
    const memberSamples = selectionMode === "subbatch" ? subBatchMembers : selectionMode === "batch" ? batchModeSamples : [];
    const linkedRefs = Array.from(new Set(memberSamples.map(s => s.referenceId).filter(Boolean))).map(id => findReferenceById(references, id)).filter(Boolean);
    if (!linkedRefs.length) return;
    const clientNames = Array.from(new Set(linkedRefs.map(r => r.contactPerson).filter(Boolean)));
    if (clientNames.length) setSampleSource(clientNames.join("; "));
    // eslint-disable-next-line
  }, [selectionMode, selectedSubBatchId, selectedReferenceId, batchModeTestId]);
  // Once a sample or sub-batch is picked, only show the test type(s) it
  // actually still needs — a parameter that's already Done (has a result)
  // or already Queued (committed to a different pending sub-batch) is left
  // off the list so it can't be silently re-recorded or double-run.
  const testTypesForForm = selectedSubBatch ? testTypes.filter(t => t.id === selectedSubBatch.testTypeId) : testTypes;
  const chemGroups = selectedTest ? selectedTest.chemicalRequirements : [];
  const dilutionGroups = selectedTest ? selectedTest.dilutionChemicalRequirements || [] : [];
  const resultParameters = selectedTest?.resultParameters || [];
  const qcRules = selectedTest?.qcRules || [];
  const matchedQcRule = qcSampleType ? qcRules.find(r => r.qcType === qcSampleType) : null;
  const qcEvaluation = matchedQcRule && qcMeasuredValue !== "" ? evaluateQcRule(matchedQcRule, qcMeasuredValue) : null;
  const isBracketing = matchedQcRule?.qcType === "bracketing";
  // Tester Name: dropdown of active users, but still free-typed for anyone
  // not (yet) in the user list — a native <input list> + <datalist> gives
  // both in one field without a custom combobox component.
  const testerNameOptions = Array.from(new Set((users || []).filter(u => u.active !== false).map(u => u.username).filter(Boolean))).sort();
  function addBracketingPoint(label) {
    setBracketingPoints(prev => [...prev, {
      id: uid("bkt"),
      label: label || "",
      value: "",
      targetValue: "",
      comparator: "",
      limitLow: "",
      limitHigh: ""
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
  function generateQcCheckpoints() {
    const num = Number(numQcCheckpoints);
    if (!num || num < 1) {
      notify?.("Please enter a valid number of QC samples.", "warn");
      return;
    }
    const newPoints = [];
    for (let i = 0; i < num; i++) {
      newPoints.push({
        id: uid("bkt"),
        label: "",
        value: "",
        targetValue: "",
        comparator: "",
        limitLow: "",
        limitHigh: ""
      });
    }
    setBracketingPoints(newPoints);
  }
  const bracketingFilled = bracketingPoints.filter(p => p.value !== "");
  // Resolve a checkpoint's acceptance Comparator/Limit(s) LIVE from the
  // current QC design (matched by the standard's Label), rather than
  // trusting whatever got cached on the point at selection time — that
  // cache can go missing (an older saved record, a slot whose label was
  // set before the design existed, etc.) and used to silently fall through
  // to "not evaluable", which looks exactly like every checkpoint failing.
  // Only if no design standard matches the label any more (e.g. renamed or
  // deleted since the record was saved) do we fall back to what's cached on
  // the point itself, so history isn't lost.
  function resolveBracketingLevel(p) {
    const fromDesign = (matchedQcRule?.bracketingConcentrations || []).find(c => c.label === p.label);
    // A matched design row is "configured" the moment it exists — the design
    // screen's own dropdown displays "between" as soon as comparator is
    // unset (bc.comparator || "between"), so a legacy row that predates the
    // comparator default looks fine there but was previously treated as
    // unconfigured here. Mirror the same fallback so display and evaluation
    // never disagree about what a checkpoint's rule actually is.
    if (fromDesign) {
      return {
        comparator: fromDesign.comparator || "between",
        limitLow: fromDesign.limitLow,
        limitHigh: fromDesign.limitHigh
      };
    }
    if (p.comparator) {
      return {
        comparator: p.comparator,
        limitLow: p.limitLow,
        limitHigh: p.limitHigh
      };
    }
    return null;
  }
  const bracketingEvaluated = bracketingFilled.map(p => {
    const level = resolveBracketingLevel(p);
    if (!level) {
      return {
        ...p,
        pass: null,
        message: "Select a QC Standard for this checkpoint first — its Comparator/Limit(s) decide pass/fail."
      };
    }
    const evalRule = {
      comparator: level.comparator,
      limitLow: level.limitLow,
      limitHigh: level.limitHigh,
      unit: matchedQcRule?.unit
    };
    return {
      ...p,
      comparator: level.comparator,
      limitLow: level.limitLow,
      limitHigh: level.limitHigh,
      ...evaluateQcRule(evalRule, p.value)
    };
  });
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
  // ---- Formula resolution for a single (individual) sample's Calculated
  // Result. If the lab never wrote a formula for this parameter — the
  // common case being a single direct-read input (a meter that already
  // shows the final value, e.g. a pH meter or a colorimeter readout) —
  // treat that one raw reading AS the result instead of reporting
  // "No formula defined." forever. This only fires once that one input has
  // actually been typed (not just defaulted to 0), so an untouched field
  // still shows nothing rather than a false 0. Parameters with zero or
  // more than one input still require an explicit formula, since there's
  // no unambiguous way to guess how they combine. ----
  function computeResult(param) {
    const raw = resultInputs[param.id] || {};
    if (!(param.formula || "").trim() && param.inputs.length === 1) {
      const onlyKey = param.inputs[0].key;
      const typed = raw[onlyKey];
      if (typed !== undefined && typed !== "" && typed !== null && Number.isFinite(Number(typed))) {
        return {
          ok: true,
          value: +Number(typed).toFixed(param.roundTo ?? 2)
        };
      }
      return {
        ok: false,
        error: "No formula defined."
      };
    }
    const vars = {};
    param.inputs.forEach(inp => {
      vars[inp.key] = Number(raw[inp.key]) || 0;
    });
    const res = evaluateFormula(param.formula, vars);
    return res.ok ? {
      ...res,
      value: +res.value.toFixed(param.roundTo ?? 2)
    } : res;
  }
  // ---- Upload Results (Excel) — the direct-value bulk upload that used to
  // live on the Test Records tab as a post-save "correct this record"
  // action. It's moved here so it can be used pre-save, for Analytical
  // Batch entry (the only entry path — individual/standalone sample entry
  // has been removed), and reuses the exact same modal/template logic
  // (RecordBulkUploadModal, defined further down this file) by building a
  // lightweight "pseudo record" out of the current in-progress form state
  // instead of an already-saved test record. ----
  function buildUploadPseudoRecord() {
    if (!selectedSubBatch) return null;
    return {
      testTypeId: selectedSubBatch.testTypeId,
      testTypeName: selectedTest?.name || "",
      date: testDate,
      memberResults: selectedSubBatch.memberSampleIds.map(sampleId => {
        const s = (samples || []).find(x => x.id === sampleId);
        return {
          sampleId,
          sampleCode: s?.sampleCode || "",
          results: resultOverridesBySample[sampleId] || []
        };
      })
    };
  }
  function applyPreSaveResultUpload(updatedMembers) {
    const uploadGate = editingRecord ? trEditGateForSave : trCreateGate;
    if (!uploadGate.allowed) {
      notify?.(`Guest access can't ${editingRecord ? "edit" : "add"} test records — this login is view-only for this action.`, "warn");
      setShowResultUploadModal(false);
      return;
    }
    setResultOverridesBySample(prev => {
      const next = { ...prev };
      updatedMembers.forEach(m => {
        next[m.sampleId] = m.results;
      });
      return next;
    });
    setShowResultUploadModal(false);
    notify?.(`Filled results for ${updatedMembers.length} sample(s) from the upload. Click "${editingRecord ? "Update" : "Save"} Test Record" below to save.`, "ok");
  }
  function clearResultOverride(sampleId, paramId) {
    setResultOverridesBySample(prev => ({
      ...prev,
      [sampleId]: (prev[sampleId] || []).filter(r => r.paramId !== paramId)
    }));
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
  // Same identity fallback as computeResult() above, but for a member
  // sample inside an Analytical Batch — this is the function behind the
  // "Calculated Result" column that was showing "—" / Incomplete for
  // manually-typed raw readings whenever the parameter had no formula
  // configured.
  function computeMemberResult(sampleId, param) {
    const raw = memberInputs[sampleId]?.[param.id] || {};
    if (!(param.formula || "").trim() && param.inputs.length === 1) {
      const onlyKey = param.inputs[0].key;
      const typed = raw[onlyKey];
      if (typed !== undefined && typed !== "" && typed !== null && Number.isFinite(Number(typed))) {
        return {
          ok: true,
          value: +Number(typed).toFixed(param.roundTo ?? 2)
        };
      }
      return {
        ok: false,
        error: "No formula defined."
      };
    }
    const vars = {};
    param.inputs.forEach(inp => {
      vars[inp.key] = Number(raw[inp.key]) || 0;
    });
    const res = evaluateFormula(param.formula, vars);
    return res.ok ? {
      ...res,
      value: +res.value.toFixed(param.roundTo ?? 2)
    } : res;
  }
  // ---- Calculated Result table row: ONE row per (sample, parameter) pair
  // — long format instead of the old wide sample×parameter matrix — so the
  // table stays readable with dozens of samples and scrolls vertically
  // instead of needing to be scanned across many columns. ----
  function calcResultRowStatus(sampleId, p, override, res) {
    if (override) {
      return override.value != null ? { label: "From Upload", bg: C.okBg, fg: C.ok } : { label: "Upload Error", bg: C.warnBg, fg: C.warn };
    }
    const hasAnyInput = p.inputs.some(inp => {
      const raw = memberInputs[sampleId]?.[p.id]?.[inp.key];
      return raw !== undefined && raw !== "" && raw !== null;
    });
    if (!hasAnyInput) return { label: "Pending", bg: `${C.muted}1A`, fg: C.muted };
    if (res.ok) return { label: "Entered", bg: C.okBg, fg: C.ok };
    // Genuinely missing formula config (2+ inputs need one to combine them,
    // vs. the single-input case which now auto-resolves in
    // computeMemberResult above) — call this out distinctly from a normal
    // in-progress row so it's obvious the fix is in Test Types, not here.
    if (res.error === "No formula defined." && p.inputs.length > 1) {
      return { label: "No formula set", bg: C.warnBg, fg: C.warn };
    }
    return { label: "Incomplete", bg: C.warnBg, fg: C.warn };
  }
  function renderCalcResultRow(sampleId, p, rowIdx) {
    const sample = (samples || []).find(s => s.id === sampleId);
    const ref = sample?.referenceId ? findReferenceById(references, sample.referenceId) : null;
    const override = (resultOverridesBySample[sampleId] || []).find(r => r.paramId === p.id);
    const res = override ? null : computeMemberResult(sampleId, p);
    const status = calcResultRowStatus(sampleId, p, override, res);

    const sampleCell = /*#__PURE__*/React.createElement("td", {
      key: "sample",
      className: "calc-td",
      style: { borderBottom: `1px solid ${C.border}` }
    }, /*#__PURE__*/React.createElement("div", {
      className: "font-medium",
      style: { color: C.ink }
    }, sample?.sampleCode || sampleId), ref?.trackingNo && /*#__PURE__*/React.createElement("div", {
      className: "text-[10px]",
      style: { color: C.muted }
    }, "Tracking: ", ref.trackingNo));

    const paramCell = /*#__PURE__*/React.createElement("td", {
      key: "param",
      className: "calc-td",
      style: { borderBottom: `1px solid ${C.border}`, color: C.ink }
    }, p.name || "(unnamed result)", p.unit ? /*#__PURE__*/React.createElement("span", {
      style: { color: C.muted }
    }, ` (${p.unit})`) : null);

    const rawReadingCell = /*#__PURE__*/React.createElement("td", {
      key: "raw",
      className: "calc-td",
      style: { borderBottom: `1px solid ${C.border}` }
    }, override ? /*#__PURE__*/React.createElement("span", {
      className: "text-xs",
      style: { color: C.muted }
    }, "— (from upload)") : /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-1 items-center"
    }, p.inputs.map(inp => /*#__PURE__*/React.createElement("input", {
      key: inp.id,
      type: "number",
      placeholder: inp.label || inp.key,
      title: inp.label || inp.key,
      className: "border rounded px-1 py-0.5 w-16 text-xs",
      style: { borderColor: C.border },
      value: memberInputs[sampleId]?.[p.id]?.[inp.key] ?? "",
      onChange: e => setMemberInput(sampleId, p.id, inp.key, e.target.value)
    }))));

    const calcResultCell = /*#__PURE__*/React.createElement("td", {
      key: "calc",
      className: "calc-td font-semibold",
      style: { borderBottom: `1px solid ${C.border}`, color: override ? (override.value != null ? C.ok : C.warn) : (res.ok ? C.ok : C.muted) }
    }, override ? (override.value != null ? `${fmtNum(override.value)}${override.unit ? ` ${override.unit}` : ""}` : override.error || "no value") : (res.ok ? fmtNum(res.value) : "—"));

    const statusCell = /*#__PURE__*/React.createElement("td", {
      key: "status",
      className: "calc-td",
      style: { borderBottom: `1px solid ${C.border}` }
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] font-semibold px-1.5 py-0.5 rounded",
      style: { background: status.bg, color: status.fg }
    }, status.label));

    const actionsCell = /*#__PURE__*/React.createElement("td", {
      key: "actions",
      className: "calc-td",
      style: { borderBottom: `1px solid ${C.border}` }
    }, override ? /*#__PURE__*/React.createElement("button", {
      type: "button",
      title: "Clear uploaded value and enter manually instead",
      onClick: () => clearResultOverride(sampleId, p.id),
      className: "flex items-center gap-1 text-xs",
      style: { color: C.muted }
    }, /*#__PURE__*/React.createElement(Icon, { name: "x", size: 11 }), "Clear") : null);

    return /*#__PURE__*/React.createElement("tr", {
      key: `${sampleId}-${p.id}`,
      style: { background: rowIdx % 2 === 1 ? C.bg : "transparent" }
    }, sampleCell, paramCell, rawReadingCell, calcResultCell, statusCell, actionsCell);
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
        value: p.value === null || p.value === undefined ? "" : String(p.value),
        targetValue: p.targetValue ?? "",
        comparator: p.comparator || "",
        limitLow: p.limitLow ?? "",
        limitHigh: p.limitHigh ?? ""
      })) : []);
      if (editingRecord.sampleId && (editingRecord.results || []).some(r => r.value != null)) {
        setResultOverridesBySample({
          [editingRecord.sampleId]: editingRecord.results
        });
      }
      // Re-link this record to its Analytical Batch and switch the picker
      // into "Existing Analytical Batch" mode — without this, selectionMode
      // stayed on whatever it last was (default "batch") and
      // selectedSubBatchId stayed blank, so selectedSubBatch never resolved
      // and the Calculated Result table had no member samples to show.
      if (editingRecord.subBatchId) {
        setSelectionMode("subbatch");
        setSelectedSubBatchId(editingRecord.subBatchId);
      }
      // Restore each member's raw readings (so they stay editable and
      // recompute exactly as before) or, for results that came from a bulk
      // Excel upload (identifiable by having no raw inputs recorded), the
      // finished value as an override — otherwise the batch table would
      // load with every row blank even though the record has real results.
      if (editingRecord.memberResults && editingRecord.memberResults.length) {
        const nextMemberInputs = {};
        const nextOverrides = {};
        editingRecord.memberResults.forEach(m => {
          (m.results || []).forEach(r => {
            if (r.inputs && Object.keys(r.inputs).length > 0) {
              nextMemberInputs[m.sampleId] = {
                ...(nextMemberInputs[m.sampleId] || {}),
                [r.paramId]: r.inputs
              };
            } else if (r.value != null || r.error) {
              nextOverrides[m.sampleId] = [...(nextOverrides[m.sampleId] || []), r];
            }
          });
        });
        setMemberInputs(nextMemberInputs);
        setResultOverridesBySample(prev => ({ ...prev, ...nextOverrides }));
      }
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
    setResultOverridesBySample({});
  }, [selectedTestId]);

  // When a sub-batch is picked: lock the Test Type to the sub-batch's method
  // and prefill No. of Field Samples from its member count.
  useEffect(() => {
    if (editingRecord || !selectedSubBatch) return;
    setSelectedTestId(selectedSubBatch.testTypeId);
    setNumberOfFieldSamples(String(selectedSubBatch.memberSampleIds.length));
    setResultOverridesBySample({});
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
  // Cost / Sample for a linked Test Type is meant to always mirror its
  // parameter's Standard Fee (per test) — Test Type Builder auto-fills it at
  // save time, but that's a snapshot: if the fee is edited on the Parameter
  // afterwards, a stored (now-stale) testType.costPerTest would silently
  // keep billing the OLD number here. Look the current parameter fee up
  // live instead whenever one is linked, so Standard Fee and Cost / Sample
  // can never drift apart; fall back to the stored value only for
  // legacy/unlinked test types that have no parameter to defer to.
  const linkedFeeParam = selectedTest && (selectedTest.linkedParameterIds || []).length > 0
    ? (parameters || []).find(p => p.id === selectedTest.linkedParameterIds[0])
    : null;
  const unitCost = linkedFeeParam
    ? Number(linkedFeeParam.standardFee) || 0
    : selectedTest ? Number(selectedTest.costPerTest) || 0 : 0;
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
    setNumberOfFieldSamples(selectedSubBatch ? String(selectedSubBatch.memberSampleIds.length) : "");
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
    setResultOverridesBySample({});
    setMemberInputs({});
    setSelectionMode("batch");
    setSelectedSubBatchId("");
    setRetestPrompt(null);
  }
  function handleCancelEdit() {
    resetForm();
    onDoneEditing && onDoneEditing();
  }
  async function handleSaveInner(confirmedRetestReason, chargeRetestFeeMap) {
    setSubmitAttempted(true);
    if (!selectedTest) return;
    if (isFutureDate(testDate)) return notify("Test Date can't be in the future.", "warn");
    if (minTestDate && testDate < minTestDate) return notify(`Test Date can't be before ${minTestDate} — that's when the latest member sample was received/collected.`, "warn");
    if (!tester.trim()) return notify("Please enter tester name", "warn");
    if (numberOfStandardSamples === "" && numberOfFieldSamples === "") return notify("Please enter No. of Standard Samples and No. of Field Samples (use 0 if none).", "warn");
    if (dilutionRequired && numberOfDilutedSamples === "") return notify("Please enter No. of Samples Requiring Dilution (use 0 if none).", "warn");
    // Individual/standalone sample entry has been removed — every new
    // result entry must flow through an Analytical Batch (picked directly,
    // or assembled from a Reference via "Use This Batch" above).
    if (!editingRecord && !selectedSubBatch) return notify("Please select an Analytical Batch before entering results.", "warn");

    // Edit lock (Workflow/Data-Integrity Upgrade Step 5) — defensive
    // re-check in case this record was approved/released by someone else
    // WHILE this edit form was open (the Edit button that opens this form
    // is already hidden/disabled once locked — see isTestRecordLocked,
    // top of this file — this just covers the race). Use Request
    // Correction from the Test Records list instead.
    //
    // `isCorrectionEdit` is the ONE sanctioned bypass: it's only ever set
    // by doCorrectionEdit() (below), which is only reachable via the
    // "Correction Only" button in the Request Correction modal — i.e. the
    // user already explicitly chose this path and already gave a required
    // reason before ever getting here. A locked record can NOT be reached
    // through the normal Edit pencil (hidden once locked) or by directly
    // constructing editingRecord some other way, so this bypass can't be
    // used to silently slip past the lock.
    if (editingRecord && !editingRecord.isCorrectionEdit && isTestRecordLocked(editingRecord, samples, testRecords, subBatches)) {
      notify("This record has since been approved/released and can no longer be edited directly. Close this form and use \"Request Correction\" from the Test Records list instead.", "warn");
      return;
    }

    // Retest detection (Workflow/Data-Integrity Upgrade Step 4) — only
    // applies to a brand-new Analytical Batch save (editing an existing
    // record is a correction to THAT attempt, not a new one). Any member
    // sample with a prior Return to Analyst/Void for this exact test type
    // (see computeAttemptInfo, 16-sub-batch.js) makes this a retest, which
    // requires a reason — same "reason required" contract as Return to
    // Analyst and Void. The reason is threaded straight through as a
    // function argument (confirmedRetestReason) rather than round-tripped
    // through React state, so there's no risk of this synchronous,
    // many-early-return function ever reading a stale value.
    if (!editingRecord && selectedSubBatch && !confirmedRetestReason) {
      const retestSamples = selectedSubBatch.memberSampleIds
        .map(id => (samples || []).find(x => x.id === id))
        .filter(s => s && computeAttemptInfo(s, selectedSubBatch.testTypeId, testRecords).attemptNo > 1);
      if (retestSamples.length > 0) {
        setRetestPrompt({
          samples: retestSamples.map(s => ({ id: s.id, code: s.sampleCode }))
        });
        return; // wait for the reason — RetestReasonModal below re-calls handleSaveInner(reason) on confirm
      }
    }

    // Analytical Batch (Sub-Batch) save: refuse to create a record where a
    // member sample ends up with zero result values — this is what used to
    // let a bulk-upload with mismatched Excel headers silently produce a
    // "results_entered" sample with nothing actually in it (batch visible in
    // Awaiting Review, value column blank). Catch it here, before the
    // record/status changes happen, not after.
    if (selectedSubBatch && resultParameters.length) {
      const emptyMembers = selectedSubBatch.memberSampleIds.map(sampleId => {
        const sample = (samples || []).find(s => s.id === sampleId);
        const hasAnyRawInput = resultParameters.some(p => p.inputs.some(inp => {
          const raw = memberInputs[sampleId]?.[p.id]?.[inp.key];
          return raw !== undefined && raw !== "" && raw !== null;
        }));
        const hasAnyOverride = (resultOverridesBySample[sampleId] || []).some(r => r.value != null);
        return hasAnyRawInput || hasAnyOverride ? null : sample?.sampleCode || sampleId;
      }).filter(Boolean);
      if (emptyMembers.length) {
        notify(`${emptyMembers.length} sample(s) have no readings entered yet — fix before saving: ${emptyMembers.slice(0, 6).join(", ")}${emptyMembers.length > 6 ? "…" : ""}. If this came from a bulk upload, re-check the column headers against the downloaded template.`, "warn");
        return;
      }
    }

    // Hard stop for oversized Analytical Batches — computed and checked
    // HERE, before any inventory is touched (setChemicals/setGasList below,
    // and the stock-sufficiency checks that precede them still only read
    // state, they don't commit it). Previously this check ran much later,
    // right before the record was actually saved — by which point chemical
    // and gas stock had ALREADY been deducted (setChemicals/setGasList), so
    // a blocked save still silently consumed inventory for a batch that
    // never actually got saved. Doing the size check first, before any of
    // that, means a rejected save truly changes nothing.
    //
    // The backend stores a whole Test Record as ONE JSON blob in a single
    // Google Sheets cell (see upsertRow_ in Code.gs), and Sheets enforces a
    // hard 50,000-character limit per cell. memberResults — one entry per
    // member sample, each with its own inputs/value/error per parameter —
    // is by far the dominant contributor to that size, so it's computed
    // here (once) both to check the size and to reuse below, instead of
    // rebuilding it a second time when the record payload is assembled.
    const computedMemberResults = selectedSubBatch ? selectedSubBatch.memberSampleIds.map(sampleId => {
      const memberSample = (samples || []).find(s => s.id === sampleId);
      // Retest/Attempt History — computed fresh per member (not editing, so
      // this is always attemptNo 1 unless computeAttemptInfo finds a prior
      // Return to Analyst/Void for this exact test type). See
      // computeAttemptInfo's own comment in 16-sub-batch.js.
      const attemptInfo = memberSample ? computeAttemptInfo(memberSample, selectedSubBatch.testTypeId, testRecords) : {
        attemptNo: 1,
        previousTestRecordId: null
      };
      // Per-member fee — this is the actual fix for revenue double-counting
      // on retests. A first attempt (attemptNo===1) bills exactly like
      // before, off the record-wide "Collect Fee" toggle. A RETEST member
      // (attemptNo>1) does NOT automatically inherit that toggle — it's
      // priced off the explicit PER-SAMPLE choice made in the Retest fee
      // modal (chargeRetestFeeMap[sampleId] === true = customer-requested
      // repeat, billed again; anything else = lab-decided repeat, fee
      // waived), so one Analytical Batch can freely mix first-time
      // (billed), waived-retest, AND charged-retest members — e.g. 5
      // retests where 3 are billed and 2 are waived in the very same save.
      // When just correcting/re-saving an ALREADY-retested record (editing,
      // not a fresh retest), the original per-member decision is preserved
      // from editingRecord rather than re-asked.
      const memberFeeApplicable = attemptInfo.attemptNo <= 1
        ? feeApplicable
        : editingRecord
          ? ((editingRecord.memberResults || []).find(m => m.sampleId === sampleId)?.feeApplicable ?? false)
          : !!(chargeRetestFeeMap && chargeRetestFeeMap[sampleId]);
      return {
        sampleId,
        sampleCode: memberSample?.sampleCode || "",
        attemptNo: attemptInfo.attemptNo,
        previousTestRecordId: attemptInfo.previousTestRecordId,
        feeApplicable: memberFeeApplicable,
        results: resultParameters.map(p => {
          const override = (resultOverridesBySample[sampleId] || []).find(r => r.paramId === p.id);
          if (override) return override;
          const res = computeMemberResult(sampleId, p);
          return {
            paramId: p.id,
            name: p.name,
            unit: p.unit,
            inputs: memberInputs[sampleId]?.[p.id] || {},
            ...(res.ok ? { value: res.value, error: null } : { value: null, error: res.error })
          };
        })
      };
    }) : null;
    if (computedMemberResults) {
      const SHEETS_CELL_CHAR_LIMIT = 50000;
      const SAFETY_MARGIN = 5000; // headroom for the record's other fields (chemicals/gas/qc/etc), unicode escaping, updatedAt stamping
      const memberResultsSize = JSON.stringify(computedMemberResults).length;
      if (memberResultsSize > SHEETS_CELL_CHAR_LIMIT - SAFETY_MARGIN) {
        const memberCount = selectedSubBatch.memberSampleIds.length;
        const perMember = Math.max(1, Math.round(memberResultsSize / memberCount));
        const safeMemberCount = Math.max(1, Math.floor((SHEETS_CELL_CHAR_LIMIT - SAFETY_MARGIN) / perMember));
        notify(`This Analytical Batch is too large to save (~${memberResultsSize.toLocaleString()} characters of results — the backend spreadsheet caps a single record at ${SHEETS_CELL_CHAR_LIMIT.toLocaleString()}). With this test's number of parameters, roughly ${safeMemberCount} sample(s) per batch is the safe limit — please split this batch into smaller ones (e.g. via Analytical Batch management) and save separately. Nothing has been changed — chemical/gas inventory has NOT been touched.`, "warn");
        return;
      }
    }

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
      // bottleOverride[chemId] is an ORDERED LIST of manually-picked bottles
      // (see BottleSelector) — [{batchId, amount}], amount optional (null =
      // "take everything available from this bottle before moving to the
      // next one in the list"). Empty/undefined list = fully automatic
      // FEFO across every active batch, same as before this feature existed.
      const selection = Array.isArray(bottleOverride[chemId]) ? bottleOverride[chemId] : bottleOverride[chemId] ? [{
        batchId: bottleOverride[chemId],
        amount: null
      }] : [];
      let available = chem.batches.filter(b => b.status === "active").reduce((s, b) => s + b.remaining, 0);
      // Expired batches only ever enter the pool when explicitly hand-picked
      // (same "conscious override" rule as before) — now potentially several
      // at once if more than one expired bottle is in the manual list. One
      // shared reason field still covers all of them for this chemical.
      const expiredSelected = selection.map(s => chem.batches.find(b => b.id === s.batchId)).filter(b => b && b.status === "expired");
      if (expiredSelected.length) {
        available += expiredSelected.reduce((s, b) => s + b.remaining, 0);
        if (!(expiredReason[chemId] || "").trim()) {
          insufficient.push(`${chem.name}: please give a reason for using the expired batch(es) (${expiredSelected.map(b => `Exp ${b.expiryDate}`).join(", ")})`);
        } else {
          expiredSelected.forEach(b => expiredOverrides.push({
            chemical: chem.name,
            batchId: b.id,
            expiryDate: b.expiryDate,
            reason: expiredReason[chemId].trim(),
            tester: tester.trim(),
            date: `${testDate} ${new Date().toTimeString().slice(0, 5)}`
          }));
        }
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
    
    const allGasEntries = [...gasesUsed, ...(dilutionRequired ? dilutionGasesUsed : [])];
    const allGasUsage = allGasEntries.filter(e => e.updateInventory);
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
      const selection = Array.isArray(bottleOverride[chemId]) ? bottleOverride[chemId] : bottleOverride[chemId] ? [{
        batchId: bottleOverride[chemId],
        amount: null
      }] : [];
      const {
        batches,
        usedFrom
      } = deductFromChemical(chem, amount, selection);
      chem.batches = batches;
      consumption[chem.name] = amount;
      bottleLog[chem.name] = usedFrom;
    });
    setChemicals(nextChemicals);
    const equip = equipment.find(e => e.id === equipmentId);
    // Actual billed count/revenue for THIS record — for an Analytical
    // Batch, this is member-aware (see computedMemberResults above): a
    // retested member only counts toward billedSamples/revenue if it was
    // explicitly charged (chargeRetestFee/preserved decision), so a batch
    // mixing first-time and retested samples bills correctly instead of
    // the old all-or-nothing "Collect Fee" toggle double-charging (or
    // under-charging) every retest in the batch alike. Falls back to the
    // simple record-wide count for the (legacy) non-batch case.
    const finalBilledSamples = computedMemberResults
      ? computedMemberResults.filter(m => m.feeApplicable !== false).length
      : billedSamples;
    const finalRevenue = +(finalBilledSamples * unitCost).toFixed(2);
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
      // New entries are always Analytical Batch entries (individual/
      // standalone entry has been removed). If editing a record created
      // before that removal, its original single-sample link is preserved
      // rather than silently wiped out by this update.
      sampleId: selectedSubBatch ? null : editingRecord?.sampleId ?? null,
      sampleCode: selectedSubBatch ? "" : editingRecord?.sampleCode || "",
      memberSampleIds: selectedSubBatch ? selectedSubBatch.memberSampleIds : null,
      subBatchId: selectedSubBatch ? selectedSubBatch.id : null,
      subBatchLabel: selectedSubBatch ? selectedSubBatch.label : null,
      // Retest/Attempt History (record-level rollup of the per-member
      // attemptNo/previousTestRecordId set on computedMemberResults above —
      // see computeAttemptInfo, 16-sub-batch.js). Preserved as-is when
      // editing an existing record (a correction to that SAME attempt, not
      // a new one); only set fresh for a brand-new Analytical Batch save.
      attemptNo: editingRecord ? editingRecord.attemptNo || 1 : computedMemberResults ? Math.max(1, ...computedMemberResults.map(m => m.attemptNo || 1)) : 1,
      retestReason: editingRecord ? editingRecord.retestReason || null : confirmedRetestReason || null,
      createdAt: editingRecord ? editingRecord.createdAt || null : new Date().toISOString(),
      createdBy: editingRecord ? editingRecord.createdBy || null : session?.name || tester.trim(),
      feeApplicable,
      unitCost,
      billedSamples: finalBilledSamples,
      revenue: finalRevenue,
      sampleSource: sampleSource.trim(),
      gasesUsed,
      dilutionRequired,
      numberOfDilutedSamples: dilutionRequired ? dilutedSamplesNum : 0,
      dilutionGasesUsed: dilutionRequired ? dilutionGasesUsed : [],
      optionalUsed,
      expiredOverrides,
      gasLog,
      resultInputs,
      // Legacy individual records carried their single result set here;
      // new entries are always Analytical Batch entries, so results live in
      // memberResults[] below instead (kept in sync with editingRecord.results
      // when updating a pre-existing individual record).
      results: selectedSubBatch ? [] : editingRecord?.results || [],
      // Reuses computedMemberResults built earlier (before the size guard /
      // inventory deduction above) instead of recomputing it here — keeps
      // this in sync with exactly what the size check actually measured.
      memberResults: computedMemberResults,
      qcCheck: isBracketing ? bracketingEvaluated.length ? {
        ruleId: matchedQcRule.id,
        qcType: "bracketing",
        label: matchedQcRule.label,
        points: bracketingEvaluated.map(p => ({
          id: p.id,
          label: p.label,
          value: Number(p.value),
          targetValue: p.targetValue,
          comparator: p.comparator,
          limitLow: p.limitLow,
          limitHigh: p.limitHigh,
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
      // Correction-edit audit trail (Workflow/Data-Integrity Upgrade Step
      // 5/6 follow-up) — captures a genuine BEFORE/AFTER of exactly what a
      // Correction Only edit is allowed to touch (reported values and what
      // was actually consumed), not just "someone corrected this, trust
      // me". The Immutable Approval Snapshot on the sample's approval
      // record (see buildApprovalSnapshot, 20-sample-model.js) still keeps
      // the ORIGINALLY approved value frozen regardless of this edit — this
      // history is what lets a reviewer see what changed and why.
      const historyEntry = editingRecord.isCorrectionEdit ? {
        id: uid("ch"),
        reason: editingRecord.correctionReason || "Correction Only",
        date: new Date().toISOString(),
        by: session?.name || "System",
        before: {
          memberResults: (editingRecord.memberResults || []).map(m => ({
            sampleId: m.sampleId,
            results: m.results
          })),
          consumption: editingRecord.consumption || {},
          bottleLog: editingRecord.bottleLog || {},
          gasLog: editingRecord.gasLog || [],
          equipmentName: editingRecord.equipmentName || "",
          tester: editingRecord.tester || ""
        },
        after: {
          memberResults: (computedMemberResults || []).map(m => ({
            sampleId: m.sampleId,
            results: m.results
          })),
          consumption,
          bottleLog,
          gasLog,
          equipmentName: equip ? equip.name : "",
          tester: tester.trim()
        }
      } : null;

      const updatedRecord = {
        ...editingRecord,
        ...recordPayload,
        correctionHistory: historyEntry 
          ? [...(editingRecord.correctionHistory || []), historyEntry] 
          : editingRecord.correctionHistory
      };
      
      delete updatedRecord.correctionReason;
      
      // Wait for backend save to complete before updating UI
      try {
        const stamped = await DataService.save("testRecords", updatedRecord);
        if (stamped && stamped._version) {
          updatedRecord._version = stamped._version;
          updatedRecord.updatedAt = stamped.updatedAt;
        }
        setTestRecords(prev => prev.map(r => r.id === editingRecord.id ? updatedRecord : r));
        notify(historyEntry ? "Correction saved — the approved/released status is unchanged, and inventory was reconciled (not double-consumed)." : anyMissing ? "Test record updated, but one or more linked chemicals no longer exist in inventory." : "Test record updated. Inventory adjusted accordingly.", anyMissing ? "warn" : "ok");
        resetForm();
        onDoneEditing && onDoneEditing();
        DataService.appendAudit({
          eventType: historyEntry ? "CORRECTION_APPLIED" : "TEST_RECORD_EDITED",
          entity: "testRecord",
          entityType: "testRecord",
          entityId: editingRecord.id,
          opId: historyEntry?.id || null,
          testTypeId: recordPayload.testTypeId,
          testTypeName: recordPayload.testTypeName,
          action: historyEntry ? "correction_applied" : "edit",
          performedBy: session?.name,
          user: session?.username || tester || "System",
          role: session?.role || "Sample Analyzer",
          reason: historyEntry?.reason || null,
          note: historyEntry ? `Correction applied to approved/released test record "${recordPayload.testTypeName}" (${recordPayload.date}): ${historyEntry.reason} — approval status left untouched; inventory reconciled (old consumption restored, new consumption deducted) rather than double-counted.` : `Updated test record "${recordPayload.testTypeName}" (${recordPayload.date})`
        }).catch(err => console.error("Audit log write failed (non-fatal):", err));
      } catch (err) {
        console.error("Failed to persist edit to backend:", err);
        throw new Error(err.message || "Failed to save to backend.");
      }
    } else {
      const newRecordId = uid("rec");
      const newRecord = {
        id: newRecordId,
        ...recordPayload
      };
      const actingUser = session || {
        name: tester || "System",
        role: "Sample Analyzer"
      };
      const AWAITING_REVIEW = "results_entered";

      try {
        // 1. Wait for testRecord to save
        const stampedRecord = await DataService.save("testRecords", newRecord);
        if (stampedRecord && stampedRecord._version) {
          newRecord._version = stampedRecord._version;
          newRecord.updatedAt = stampedRecord.updatedAt;
        }

        let updatedSamples = [];
        let changedSamples = [];
        if (selectedSubBatch && setSamples) {
          const memberIdSet = new Set(selectedSubBatch.memberSampleIds);
          updatedSamples = (samples || []).map(s => {
            if (!memberIdSet.has(s.id)) return s;
            const updated = setRequestedTestStatus({
              ...s,
              linkedTestRecordIds: [...(s.linkedTestRecordIds || []), newRecordId]
            }, selectedSubBatch.testTypeId, AWAITING_REVIEW, actingUser);
            changedSamples.push(updated);
            return updated;
          });

          // 2. Wait for samples to save
          if (changedSamples.length > 0) {
            const stampedSamples = await DataService.bulkUpsert("samples", changedSamples);
            if (Array.isArray(stampedSamples)) {
              stampedSamples.forEach(st => {
                const orig = changedSamples.find(u => u.id === st.id);
                if (orig) {
                  orig._version = st._version;
                  orig.updatedAt = st.updatedAt;
                }
              });
            }
          }
        }

        // 3. Backend calls succeeded! Now update React State.
        setTestRecords(prev => {
          if (prev.some(r => r.id === newRecord.id)) {
            return prev.map(r => r.id === newRecord.id ? newRecord : r);
          }
          return [...prev, newRecord];
        });

        if (selectedSubBatch && setSamples) {
          // Pass null as second arg so setSamples only updates state (avoiding duplicate backend save)
          setSamples(() => updatedSamples, null);

          if (setSubBatches) {
            setSubBatches(prev => prev.map(sb => sb.id === selectedSubBatch.id ? {
              ...sb,
              status: "tested",
              testRecordId: newRecordId
            } : sb));
          }
        }
        setSelectedSubBatchId("");
        setMemberInputs({});
        notify(anyMissing ? "Saved, but one or more linked chemicals no longer exist in inventory." : "Test record saved. Inventory updated (FEFO).", anyMissing ? "warn" : "ok");
        resetForm();
      } catch (err) {
        console.error("Failed to persist test record to backend:", err);
        throw new Error(err.message || "Failed to save test record.");
      }

      DataService.appendAudit({
        entity: "testRecord",
        entityId: newRecordId,
        testTypeId: recordPayload.testTypeId,
        testTypeName: recordPayload.testTypeName,
        action: "create",
        performedBy: session?.name,
        user: session?.username || tester || "System",
        role: session?.role || "Sample Analyzer",
        note: `Created test record "${recordPayload.testTypeName}" (${recordPayload.date})`
      }).catch(err => console.error("Audit log write failed (non-fatal):", err));
    }
  }

  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(confirmedRetestReason, chargeRetestFeeMap) {
    if (isSaving) return;
    const saveGate = editingRecord ? trEditGateForSave : trCreateGate;
    if (!saveGate.allowed) {
      notify?.(`Guest access can't ${editingRecord ? "edit" : "add"} test records — this login is view-only for this action.`, "warn");
      return;
    }
    setIsSaving(true);
    try {
      await handleSaveInner(confirmedRetestReason, chargeRetestFeeMap);
    } catch (e) {
      notify(`Failed to save: ${e.message}`, "warn");
    } finally {
      setIsSaving(false);
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
          background: C.mutedBg,
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
        background: !isSkipped ? C.okBg : C.subtle,
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
          background: C.card
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
          background: C.bg,
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
      onChange: nextSelection => setBottleOverride(prev => ({
        ...prev,
        [req.chemicalId]: nextSelection
      }))
    })), chem && (() => {
      const selection = Array.isArray(bottleOverride[req.chemicalId]) ? bottleOverride[req.chemicalId] : bottleOverride[req.chemicalId] ? [{
        batchId: bottleOverride[req.chemicalId]
      }] : [];
      const expiredSelected = selection.map(s => chem.batches.find(b => b.id === s.batchId)).filter(b => b && b.status === "expired");
      if (!expiredSelected.length) return null;
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
      }), expiredSelected.length === 1 ? `This bottle expired on ${expiredSelected[0].expiryDate}.` : `${expiredSelected.length} selected bottles are expired (${expiredSelected.map(b => b.expiryDate).join(", ")}).`, " Using it will be logged in the Expired Chemical Usage Report."), /*#__PURE__*/React.createElement("input", {
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
          background: C.subtle
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
          background: C.bg,
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
  // ---- Selection Mode section (Batch-by-Reference / Existing Analytical
  // Batch). Individual (single, unbatched) sample selection has been
  // removed — every result entry must flow through an Analytical Batch. ----
  const modeSelectorField = /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: { color: C.muted }
  }, "How are you selecting samples?", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: { borderColor: C.border },
    value: selectionMode,
    disabled: !!editingRecord,
    onChange: e => {
      const mode = e.target.value;
      setSelectionMode(mode);
      setSelectedSubBatchId("");
      setSelectedReferenceId("");
      setBatchModeTestId("");
    }
  }, /*#__PURE__*/React.createElement("option", { value: "batch" }, "Batch (by Reference)"), /*#__PURE__*/React.createElement("option", { value: "subbatch" }, "Existing Analytical Batch")));

  const subBatchPickerField = selectionMode !== "subbatch" ? null : /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: { color: C.muted }
  }, "Select Analytical Batch (many samples, shared QC)", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: { borderColor: C.border },
    value: selectedSubBatchId,
    disabled: !!editingRecord,
    onChange: e => setSelectedSubBatchId(e.target.value)
  }, [/*#__PURE__*/React.createElement("option", { key: "none", value: "" }, "— No sub-batch —")].concat(subBatchPickerOptions.map(sb => /*#__PURE__*/React.createElement("option", {
    key: sb.id,
    value: sb.id
  }, `${sb.label} — ${sb.testTypeName} (${sb.memberSampleIds.length} samples)`)))));

  const referencePickerField = selectionMode !== "batch" ? null : /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: { color: C.muted }
  }, "Select Reference (source batch)", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: { borderColor: C.border },
    value: selectedReferenceId,
    onChange: e => {
      setSelectedReferenceId(e.target.value);
      setBatchModeTestId("");
    }
  }, [/*#__PURE__*/React.createElement("option", { key: "none", value: "" }, "— Select a Reference —")].concat(referenceOptionsForBatchMode.map(ref => /*#__PURE__*/React.createElement("option", {
    key: ref.id,
    value: ref.id
  }, `${referenceSourceMeta(ref.sourceType).label} — ${referenceDisplayLabel(ref)}`)))));

  const batchTestPickerField = (selectionMode !== "batch" || !selectedReference) ? null : /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: { color: C.muted }
  }, "Which parameter?", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: { borderColor: C.border },
    value: batchModeTestId,
    onChange: e => setBatchModeTestId(e.target.value)
  }, [/*#__PURE__*/React.createElement("option", { key: "none", value: "" }, "— Select a parameter —")].concat(batchModeTestOptions.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.id,
    value: t.id
  }, t.name)))));

  const selectionModeSection = /*#__PURE__*/React.createElement("div", {
    className: "px-4 pt-4 grid gap-3",
    style: { gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }
  }, modeSelectorField, subBatchPickerField, referencePickerField, batchTestPickerField);

  const batchPreviewBox = (selectionMode !== "batch" || !selectedReference || !batchModeTestId) ? null : /*#__PURE__*/React.createElement("div", {
    className: "mx-4 mt-2 p-3 rounded",
    style: { background: C.infoBg, border: `1px solid ${C.info}33` }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs",
    style: { color: C.info }
  }, `${batchModeSamples.length} sample(s) under ${referenceDisplayLabel(selectedReference)} still need ${testTypes.find(t => t.id === batchModeTestId)?.name || ""}:`), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    disabled: batchModeSamples.length === 0,
    onClick: useReferenceAsSubBatch
  }, `Use This Batch (${batchModeSamples.length})`)), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 mt-2"
  }, batchModeSamples.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    className: "text-[11px] px-2 py-0.5 rounded-full",
    style: { background: C.card, color: C.ink }
  }, `${s.sampleCode} · ${s.clientName}`))));

  const selectedSubBatchBox = !selectedSubBatch ? null : /*#__PURE__*/React.createElement("div", {
    className: "mx-4 mt-2 p-3 rounded",
    style: { background: C.infoBg, border: `1px solid ${C.info}33` }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-2",
    style: { color: C.ink }
  }, `${selectedSubBatch.label} — ${subBatchMembers.length} sample(s), locked to ${selectedSubBatch.testTypeName}`), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1 max-h-48 overflow-y-auto"
  }, subBatchMembers.map(s => {
    const ref = s.referenceId ? findReferenceById(references, s.referenceId) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      className: "flex flex-wrap items-center gap-1.5 px-2 py-1 rounded text-xs",
      style: { background: C.card }
    }, goToSample ? /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "font-semibold underline",
      style: { color: C.ink },
      onClick: () => goToSample(s.id)
    }, s.sampleCode) : /*#__PURE__*/React.createElement("span", {
      className: "font-semibold",
      style: { color: C.ink }
    }, s.sampleCode), /*#__PURE__*/React.createElement("span", {
      style: { color: C.muted }
    }, `${s.clientName} · ${s.siteLocation}${ref ? ` · ${referenceDisplayLabel(ref)}` : ""}`));
  })));

  return /*#__PURE__*/React.createElement("div", null, editingRecord && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-3 p-2.5 rounded mb-4",
    style: {
      background: editingRecord.isCorrectionEdit ? C.warnBg : C.infoBg,
      color: editingRecord.isCorrectionEdit ? C.warn : C.info
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "edit",
    size: 13
  }), editingRecord.isCorrectionEdit ? `Correction Only — editing an already approved/released record from ${editingRecord.date}. Reason: "${editingRecord.correctionReason}". Its approval/release status is NOT affected; only the values you change here are updated, and inventory is reconciled (old consumption restored, new consumption deducted) rather than double-counted.` : `Editing test record from ${editingRecord.date} — saving will update this record and adjust inventory accordingly.`), /*#__PURE__*/React.createElement(Button, {
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
  }), "Manage Test Types")), selectionModeSection, batchPreviewBox, selectedSubBatchBox, /*#__PURE__*/React.createElement("div", {
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
    max: todayStr(),
    min: minTestDate || undefined,
    value: testDate,
    onChange: e => setTestDate(e.target.value),
    error: submitAttempted && isFutureDate(testDate) ? "Test Date can't be in the future." : submitAttempted && minTestDate && testDate < minTestDate ? `Test Date can't be before ${minTestDate} (sample not yet received/collected).` : undefined
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Tester Name",
    value: tester,
    onChange: e => setTester(e.target.value),
    placeholder: "Select or type a name",
    list: "testerNameOptions",
    autoComplete: "off",
    error: submitAttempted && !tester.trim() ? "Tester Name is required." : undefined
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "testerNameOptions"
  }, testerNameOptions.map(name => /*#__PURE__*/React.createElement("option", {
    key: name,
    value: name
  }))), /*#__PURE__*/React.createElement(SelectField, {
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
    label: "Client",
    value: sampleSource,
    onChange: e => setSampleSource(e.target.value),
    placeholder: "Auto-fills from the selected batch's Client"
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
  }), "Enter Field Samples above to calculate revenue for this record (standard/QC samples aren't billed).")), retestMembersPreview.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-4 p-2.5 rounded flex items-start gap-2",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), /*#__PURE__*/React.createElement("span", null, `${retestMembersPreview.length} sample(s) in this batch are RETESTS (previously returned/voided for this parameter): ${retestMembersPreview.slice(0, 6).map(s => s.sampleCode).join(", ")}${retestMembersPreview.length > 6 ? "…" : ""}. Saving will ask for a reason and let you tick, per sample, whether to charge the fee again — the rest of this batch still bills normally.`)), !selectedTest && /*#__PURE__*/React.createElement("div", {
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
  }, "Dilution Gas Used"), renderGasChecklist(selectedTest.dilutionGasRequirements, dilutionGasesUsed, setDilutionGasesUsed)))), selectedSubBatch && resultParameters.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Calculated Result",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    right: /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      onClick: () => {
        const uploadGate = editingRecord ? trEditGateForSave : trCreateGate;
        if (!uploadGate.allowed) {
          notify?.(`Guest access can't ${editingRecord ? "edit" : "add"} test records — this login is view-only for this action.`, "warn");
          return;
        }
        setShowResultUploadModal(true);
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "upload",
      size: 12
    }), "Upload Results (Excel)")
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, `Each sample in this Analytical Batch gets its own reading and computed result — ${selectedSubBatch.memberSampleIds.length} sample(s) × ${resultParameters.length} parameter(s). Enter raw readings below, or use "Upload Results (Excel)" to fill the finished values directly.`),
  /*#__PURE__*/React.createElement("div", {
    className: "calc-result-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "calc-result-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["Sample ID / Tracking No", "Parameter", "Raw Reading", "Calculated Result", "Status", "Actions"].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "calc-th",
    style: {
      borderBottom: `1px solid ${C.border}`,
      color: C.muted,
      background: C.card
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, selectedSubBatch.memberSampleIds.flatMap((sampleId, sIdx) => resultParameters.map((p, pIdx) => renderCalcResultRow(sampleId, p, sIdx * resultParameters.length + pIdx))))))), selectedSubBatch && resultParameters.length === 0 && /*#__PURE__*/React.createElement("div", {
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
    className: "mt-2 p-3 rounded"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 font-medium text-gray-700"
  }, "Configure Bracketing Checkpoints for this run"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 items-center mb-3 p-2 bg-gray-50 rounded border"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-medium whitespace-nowrap"
  }, "Number of QC Samples:"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: numQcCheckpoints,
    onChange: e => setNumQcCheckpoints(e.target.value),
    className: "border rounded px-2 py-1 w-16 text-xs text-center",
    min: 1
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    onClick: generateQcCheckpoints
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 12
  }), "Generate Slots"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => addBracketingPoint()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 12
  }), "Add One")), bracketingPoints.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded text-gray-500 text-center"
  }, "Select the number of QC samples you need and click Generate Slots.") : /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, bracketingPoints.map((p, idx) => {
    const level = resolveBracketingLevel(p);
    const ev = p.value !== "" ? (!level ? {
      pass: null,
      message: "Select a QC Standard for this checkpoint first."
    } : evaluateQcRule({
      comparator: level.comparator,
      limitLow: level.limitLow,
      limitHigh: level.limitHigh,
      unit: matchedQcRule?.unit
    }, p.value)) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: "flex flex-col gap-1"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 text-xs p-2 rounded border bg-white shadow-sm",
      style: {
        borderColor: ev ? ev.pass ? C.okBg : C.warnBg : C.border
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-5 text-gray-400 font-mono text-right"
    }, idx + 1, "."), /*#__PURE__*/React.createElement("div", {
      className: "flex-1"
    }, /*#__PURE__*/React.createElement("select", {
      value: p.label,
      onChange: e => {
        const val = e.target.value;
        const selected = (matchedQcRule.bracketingConcentrations || []).find(c => c.label === val);
        updateBracketingPoint(p.id, {
          label: val,
          targetValue: selected ? selected.value : "",
          comparator: selected ? selected.comparator : "",
          limitLow: selected ? selected.limitLow : "",
          limitHigh: selected ? selected.limitHigh : ""
        });
      },
      className: "border rounded px-2 py-1.5 w-full bg-gray-50"
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "-- Select QC Standard --"), (matchedQcRule.bracketingConcentrations || []).map(c => /*#__PURE__*/React.createElement("option", {
      key: c.id,
      value: c.label || "Std"
    }, c.label || "Std")))), /*#__PURE__*/React.createElement("input", {
      type: "number",
      placeholder: `Measured Value${matchedQcRule.unit ? ` (${matchedQcRule.unit})` : ""}`,
      value: p.value,
      onChange: e => updateBracketingPoint(p.id, {
        value: e.target.value
      }),
      className: "border rounded px-2 py-1.5 w-32"
    }, null), ev && /*#__PURE__*/React.createElement("span", {
      title: ev.message
    }, /*#__PURE__*/React.createElement(Icon, {
      name: ev.pass ? "check" : "warning",
      size: 13,
      color: ev.pass ? C.ok : C.warn
    })), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeBracketingPoint(p.id),
      title: "Remove checkpoint",
      style: {
        color: C.warn
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "trash",
      size: 13
    }))), ev && /*#__PURE__*/React.createElement("div", {
      className: "text-[11px] pl-7",
      style: {
        color: ev.pass ? C.ok : C.warn
      }
    }, ev.message));
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
    disabled: isSaving,
    onClick: () => handleSave()
  }, isSaving ? "Saving..." : editingRecord ? "Update Test Record" : "Save Test Record")), showResultUploadModal && buildUploadPseudoRecord() && /*#__PURE__*/React.createElement(RecordBulkUploadModal, {
    record: buildUploadPseudoRecord(),
    testType: selectedTest,
    samples: samples,
    onApply: applyPreSaveResultUpload,
    onClose: () => setShowResultUploadModal(false),
    notify: notify
  }), retestPrompt && /*#__PURE__*/React.createElement(RetestFeeModal, {
    samples: retestPrompt.samples,
    onClose: () => setRetestPrompt(null),
    onConfirm: (reason, chargeMap) => {
      setRetestPrompt(null);
      handleSave(reason, chargeMap);
    }
  }));
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
  }, isGeneric && /*#__PURE__*/React.createElement(Banner, {
    tone: "warn"
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
  subBatches,
  setSubBatches,
  references,
  testTypes,
  parameters,
  session,
  permissionMatrix,
  goToSample,
  goToResultsWorkflow,
  notify,
  onEditRecord
}) {
  const [voidingRecord, setVoidingRecord] = useState(null);
  const trEditGate = permGate(permissionMatrix, session, "testRecords", "edit", notify, "edit test records");
  const trDeleteGate = permGate(permissionMatrix, session, "testRecords", "delete", notify, "void test records");
  const canEditRecords = trEditGate.visible;
  const canDeleteRecords = trDeleteGate.visible;
  // A record can only be archived once at least one of its samples has
  // reached the final "released" stage for this record's test type — see
  // isTestRecordArchivable()/releasedMemberSampleIds() near the top of this
  // file. Archiving pulls out ONLY the released member(s); anything not yet
  // released (on_hold / rejected / cancelled / still in review) stays
  // behind in the active list so it can be archived later once released.
  const trArchiveGate = trEditGate;
  const canArchiveRecords = trArchiveGate.visible;
  const [archiveSelection, setArchiveSelection] = useState([]);
  const [archivingId, setArchivingId] = useState(null);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const isArchivable = React.useCallback(r => isTestRecordArchivable(r, samples, testRecords, subBatches), [samples, testRecords, subBatches]);
  const isLocked = React.useCallback(r => isTestRecordLocked(r, samples, testRecords, subBatches), [samples, testRecords, subBatches]);
  function toggleArchiveSelect(id) {
    setArchiveSelection(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  // Splits `rec` into (a) an archived_records row containing only the
  // released member(s) — tagged with originRecordId so the Archive tab can
  // reunite it with any still-active remainder — and (b) whatever's left of
  // `rec` in the active testRecords list (or nothing, if every member was
  // released). Works the same for legacy single-sample records (releasedIds
  // is either [] or [rec.sampleId] there, never a partial split).
  // Batches with many members (100+) were building ONE archived_records row
  // holding every released member's snapshot + results in a single JSON
  // blob written into a single spreadsheet cell. A 250-member batch lands
  // well past 50,000 characters — Google Sheets' hard per-cell limit — and
  // even short of that limit, one large POST is far more likely to get
  // dropped by a slow/unstable connection mid-transfer than several small
  // ones (this is almost certainly the "NetworkError when attempting to
  // fetch resource" — the request never completing — on large batches).
  // Chunking is safe here because the rest of the app (restore, the
  // Archive tab, matchesArchiveQuery) already treats every archived_records
  // row as independent and self-contained, keyed by originRecordId rather
  // than assuming one row per release event — see 18-archive-ui.js.
  const ARCHIVE_CHUNK_SIZE = 40;
  async function archiveReleasedMembers(rec, releasedIds) {
    const isBatch = !!(rec.memberSampleIds && rec.memberSampleIds.length);
    const allSampleIds = isBatch ? rec.memberSampleIds : rec.sampleId ? [rec.sampleId] : [];
    const remainingIds = allSampleIds.filter(sid => !releasedIds.includes(sid));
    const fullyReleased = remainingIds.length === 0;
    const idChunks = isBatch && releasedIds.length > ARCHIVE_CHUNK_SIZE ? Array.from({
      length: Math.ceil(releasedIds.length / ARCHIVE_CHUNK_SIZE)
    }, (_, i) => releasedIds.slice(i * ARCHIVE_CHUNK_SIZE, (i + 1) * ARCHIVE_CHUNK_SIZE)) : [releasedIds];
    // Limit snapshot to ID + sampleCode + clientName only — storing full sample
    // objects in each archived record bloated payloads and could hit GAS size
    // limits on large batches. The Archive tab fetches full sample detail via
    // the active samples list if needed.
    const buildSnapshots = ids => ids.map(id => {
      const s = (samples || []).find(x => x.id === id);
      return s ? { id: s.id, sampleCode: s.sampleCode, clientName: s.clientName } : { id };
    });
    // Save to backend FIRST — only update local state after every chunk's
    // backend call confirms the save. This prevents the record from
    // disappearing from the active list if a backend call fails, keeping
    // the UI consistent. Chunks are awaited sequentially (not in parallel)
    // so they queue politely behind the shared write lock instead of all
    // fighting over it at once.
    for (let i = 0; i < idChunks.length; i++) {
      const chunkIds = idChunks[i];
      const archivedRecord = isBatch ? {
        ...rec,
        // Only the single-chunk, fully-released case reuses rec.id — once a
        // release is split into chunks there's no one row left to inherit
        // the original id, so every chunk gets its own, same as the
        // partial-release case always did.
        id: idChunks.length === 1 && fullyReleased ? rec.id : uid("tr"),
        originRecordId: rec.id,
        memberSampleIds: chunkIds,
        memberResults: (rec.memberResults || []).filter(m => chunkIds.includes(m.sampleId)),
        archivedAt: new Date().toISOString(),
        archivedSampleSnapshots: buildSnapshots(chunkIds)
      } : {
        ...rec,
        originRecordId: rec.id,
        archivedAt: new Date().toISOString(),
        archivedSampleSnapshots: buildSnapshots(chunkIds)
      };
      await DataService.save("archived_records", archivedRecord);
    }
    let nextTestRecords;
    if (fullyReleased) {
      nextTestRecords = testRecords.filter(r => r.id !== rec.id);
      setTestRecords(nextTestRecords);
    } else {
      const trimmedRecord = {
        ...rec,
        memberSampleIds: remainingIds,
        memberResults: (rec.memberResults || []).filter(m => !releasedIds.includes(m.sampleId))
      };
      nextTestRecords = testRecords.map(r => r.id === rec.id ? trimmedRecord : r);
      setTestRecords(nextTestRecords);
    }
    // Mark a sample itself as archived — hiding it from the Sample
    // Registration list — once nothing about it is active anymore. A sample
    // can carry several requested tests (e.g. Iron AND Arsenic), so
    // archiving away just one test's record shouldn't hide the sample while
    // another test on it is still pending/in progress. Only once every
    // requested test has either already been archived or has no remaining
    // active test record referencing it does the sample disappear from the
    // register — it reappears automatically the moment any of it is
    // restored (see handleRestore in 18-archive-ui.js, which reverses this
    // exact flag).
    if (setSamples) {
      const stillActiveSampleIds = new Set();
      nextTestRecords.forEach(r => {
        (r.memberSampleIds && r.memberSampleIds.length ? r.memberSampleIds : r.sampleId ? [r.sampleId] : []).forEach(sid => stillActiveSampleIds.add(sid));
      });
      const releasedIdSet = new Set(releasedIds);
      const changedSamples = [];
      const nextSamples = (samples || []).map(s => {
        if (!releasedIdSet.has(s.id) || s.archived) return s;
        if (stillActiveSampleIds.has(s.id)) return s;
        const stillPending = (s.requestedTests || []).some(rt => rt.status === "pending" || rt.status === "in_progress");
        if (stillPending) return s;
        const updated = {
          ...s,
          archived: true,
          archivedAt: new Date().toISOString()
        };
        changedSamples.push(updated);
        return updated;
      });
      if (changedSamples.length) setSamples(() => nextSamples, changedSamples);
    }
    return {
      fullyReleased,
      archivedCount: releasedIds.length
    };
  }
  async function archiveOne(rec) {
    setArchivingId(rec.id);
    try {
      const releasedIds = releasedMemberSampleIds(rec, samples, testRecords, subBatches);
      if (releasedIds.length === 0) {
        notify("No released sample in this record yet — nothing eligible to archive.", "warn");
        return;
      }
      const {
        fullyReleased,
        archivedCount
      } = await archiveReleasedMembers(rec, releasedIds);
      setArchiveSelection(prev => prev.filter(x => x !== rec.id));
      DataService.appendAudit({
        entity: "testRecord",
        entityId: rec.id,
        action: "archive",
        user: session.username,
        role: session.role,
        note: fullyReleased ? `Archived "${rec.testTypeName}" (${rec.date})` : `Archived ${archivedCount} released sample(s) of "${rec.testTypeName}" (${rec.date}); ${releasedIds.length && rec.memberSampleIds ? rec.memberSampleIds.length - archivedCount : 0} sample(s) remain active pending release`
      });
      notify(fullyReleased ? `Archived "${rec.testTypeName}" (${rec.date}). Find it any time in the Archive tab.` : `Archived ${archivedCount} released sample(s) — the rest of this batch stays here until released.`, "ok");
    } catch (e) {
      notify(`Archive failed: ${e.message}`, "warn");
    } finally {
      setArchivingId(null);
    }
  }
  async function archiveSelectedRecords() {
    const ids = archiveSelection.filter(id => {
      const rec = testRecords.find(r => r.id === id);
      return rec && isArchivable(rec);
    });
    if (ids.length === 0) {
      notify("Nothing eligible selected — a record needs at least one Released sample to be archived.", "warn");
      return;
    }
    setBulkArchiving(true);
    let archivedCount = 0;
    let recordCount = 0;
    for (const id of ids) {
      try {
        // Re-read from `testRecords` (not a captured snapshot) each loop —
        // a prior iteration may have already trimmed this exact row if two
        // selected records shared members (rare, but cheap to guard).
        const rec = testRecords.find(r => r.id === id);
        if (!rec) continue;
        const releasedIds = releasedMemberSampleIds(rec, samples, testRecords, subBatches);
        if (releasedIds.length === 0) continue;
        const result = await archiveReleasedMembers(rec, releasedIds);
        archivedCount += result.archivedCount;
        recordCount++;
      } catch (e) {
        notify(`Couldn't archive one record: ${e.message}`, "warn");
      }
    }
    setArchiveSelection([]);
    setBulkArchiving(false);
    if (recordCount > 0) {
      DataService.appendAudit({
        entity: "testRecord",
        entityId: ids.join(","),
        action: "archive",
        user: session.username,
        role: session.role,
        note: `Bulk-archived ${archivedCount} released sample(s) across ${recordCount} record(s)`
      });
      notify(`Archived ${archivedCount} released sample(s) across ${recordCount} record(s). Find them any time in the Archive tab.`, "ok");
    }
  }
  // Resolves the Reference behind a record — via its single sample, or (for
  // an Analytical Batch record) its first member sample. Used for the
  // structured Batch Identifier badge (4.1).
  function referenceForRecord(r) {
    const sampleId = r.sampleId || (r.memberSampleIds && r.memberSampleIds[0]);
    const sample = sampleId ? (samples || []).find(s => s.id === sampleId) : null;
    return sample?.referenceId ? findReferenceById(references, sample.referenceId) : null;
  }
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const toggleExpand = id => setExpanded(prev => ({
    ...prev,
    [id]: !prev[id]
  }));
  const PAGE_SIZE = 10;
  // ============================================================================
  // VOID / INVALIDATE — replaces the old permanent delete for a Test
  // Record (Workflow/Data-Integrity Upgrade Step 3). A voided record STAYS
  // in the database — original result, tester, date, everything — with
  // voided/voidedAt/voidedBy/voidReason recorded alongside it, instead of
  // vanishing outright. Every other consumer of testRecords already treats
  // a voided result as "doesn't count":
  //   - getSampleResultForTest() (16-sub-batch.js) already filters out
  //     !r.voided / !m.voided — this is the SAME field the per-sample
  //     "Return to Analyst" void already uses, just applied to every member
  //     of the whole record here — so a voided record is automatically
  //     invisible to reports, eligibility checks, and Results Workflow
  //     with no changes needed there.
  //   - Analytics' filteredRecords (14c-analytics-pages-2.js) explicitly
  //     excludes voided records from revenue/consumption/performance
  //     numbers, so a voided test never inflates anyone's stats.
  // A reason is REQUIRED (same "reason required" contract as Return to
  // Analyst — see ReasonRequiredModal in 02-ui-kit.js), and reused as the
  // reason passed to returnRequestedTestToAnalyst() below so the sample's
  // own returnEvents[] history and this void share one consistent story.
  //
  // `correctionMode` (only meaningful when the record was locked, i.e. this
  // is a Request Correction, not a routine Void) is either:
  //   "retest"          — same as before: chemical/gas consumption is
  //                        RESTORED to inventory, since the sample(s) go
  //                        back through the analytical process from scratch
  //                        and will consume fresh reagent on the new attempt.
  //   "correction_only" — a paperwork/transcription-style fix (e.g. wrong
  //                        unit typed, wrong sample code on the report) —
  //                        the analytical work itself was fine, so nothing
  //                        was actually wasted. Consumption is LEFT AS-IS
  //                        (not restored) since restoring it would let the
  //                        same physical reagent draw get "un-spent" and
  //                        potentially double-counted against a future
  //                        batch that didn't actually reuse it.
  // A routine Void (wasLocked === false) has always had exactly one
  // behavior — restore — and keeps that; the choice only appears for the
  // "Request Correction" framing.
  // ============================================================================
  function doCorrectionEdit(rec, reason) {
    onEditRecord({
      ...rec,
      isCorrectionEdit: true,
      correctionReason: reason
    });
    setVoidingRecord(null);
  }

  function doVoid(rec, reason, correctionMode) {
    // Same underlying action either way (see the function-level comment on
    // isTestRecordLocked, top of this file, for why "Request Correction"
    // on an approved/released record and a routine Void of an
    // in-review one are the same operation, just framed differently) —
    // computed once, up front, so the audit entry below reflects which
    // framing was actually shown to the user for THIS record, even if its
    // lock state could theoretically change between render and click.
    const wasLocked = isTestRecordLocked(rec, samples, testRecords, subBatches);
    const mode = wasLocked ? correctionMode === "correction_only" ? "correction_only" : "retest" : null;
    const restoreConsumptionForThisAction = !wasLocked || mode === "retest";
    if (restoreConsumptionForThisAction) {
      setChemicals(prev => markExpiredBatches(restoreConsumption(prev, rec.bottleLog || {})));
      if (rec.gasLog && rec.gasLog.length > 0) setGasList(prev => restoreGasConsumption(prev, rec.gasLog));
    }
    // Same reset every member sample needs as a full delete used to do —
    // see returnRequestedTestToAnalyst's own comment in 20-sample-model.js
    // for why this is the exact right function to reuse here.
    const memberIds = rec.memberSampleIds && rec.memberSampleIds.length ? rec.memberSampleIds : rec.sampleId ? [rec.sampleId] : [];
    if (memberIds.length) {
      const updatedMembers = [];
      memberIds.forEach(id => {
        const member = (samples || []).find(s => s.id === id);
        if (!member) return;
        updatedMembers.push(returnRequestedTestToAnalyst(member, rec.testTypeId, rec.testTypeName, session, reason, {
          testRecordId: rec.id
        }));
      });
      // Single state update for all member samples
      setSamples(prev => {
        const map = new Map(updatedMembers.map(u => [u.id, u]));
        return prev.map(s => map.get(s.id) || s);
      }, null);
      DataService.bulkUpsert("samples", updatedMembers).then(stamped => {
        if (Array.isArray(stamped)) {
          stamped.forEach(st => {
            const orig = updatedMembers.find(u => u.id === st.id);
            if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
          });
        }
      }).catch(err => {
        console.error("Failed to persist sample resets to backend:", err);
      });
    }
    if (rec.subBatchId && setSubBatches) {
      setSubBatches(prev => prev.map(sb => sb.id === rec.subBatchId ? {
        ...sb,
        status: "pending",
        testRecordId: null
      } : sb));
    }
    const voidedAt = new Date().toISOString();
    setTestRecords(prev => prev.map(r => r.id === rec.id ? {
      ...r,
      voided: true,
      voidedAt,
      voidedBy: session.name,
      voidReason: reason,
      // Distinguishes "Request Correction" (this record was already
      // approved/released — see isTestRecordLocked, top of file) from a
      // routine Void of a still-in-review record, so the badge below and
      // any later audit review can tell the two apart even without
      // re-deriving lock state from the (now-superseded) member data.
      wasCorrectionRequest: wasLocked,
      // Which of the two Correction Request choices was made — null for a
      // routine Void (no choice was ever offered there). See the doVoid
      // comment above for what each mode means for chemical/gas
      // consumption; kept on the record itself so the Test Records list,
      // audit review, and analytics can all see it later without having to
      // re-derive it from whether inventory happens to look restored.
      correctionMode: mode,
      // Every member's own result is flagged too — for a Sub-Batch/batch
      // record this is what actually makes getSampleResultForTest() treat
      // EVERY sample it covered as "no result", not just the record as a
      // whole. A single (non-batch) record has no memberResults array, so
      // this is a no-op there — the top-level `voided` flag above already
      // covers it.
      memberResults: Array.isArray(r.memberResults) ? r.memberResults.map(m => ({
        ...m,
        voided: true
      })) : r.memberResults
    } : r));
    setVoidingRecord(null);
    DataService.appendAudit({
      eventType: wasLocked ? "CORRECTION_REQUESTED" : "TEST_RECORD_VOIDED",
      entityType: "testRecord",
      entity: "testRecord",
      entityId: rec.id,
      testTypeId: rec.testTypeId,
      testTypeName: rec.testTypeName,
      sampleIds: memberIds,
      action: wasLocked ? "correction_requested" : "void",
      correctionMode: mode,
      performedBy: session.name,
      user: session.username,
      role: session.role,
      reason,
      note: wasLocked ? `Correction requested (${mode === "correction_only" ? "Correction Only — chemical/gas consumption left as-is" : "Retest — chemical/gas consumption restored"}) for approved/released test record "${rec.testTypeName}" (${rec.date}): ${reason} — approved value retained; ${memberIds.length} sample(s) returned to pending testing for a new, corrected attempt.` : `Voided test record "${rec.testTypeName}" (${rec.date}): ${reason} — ${memberIds.length} sample(s) returned to pending testing; analytical batch reset to pending.`
    }).catch(err => console.error("Audit log write failed (non-fatal):", err));
    notify(`${wasLocked ? `Correction requested (${mode === "correction_only" ? "Correction Only" : "Retest"}) — the approved/released value is kept for the audit trail` : "Test record voided"}. ${restoreConsumptionForThisAction ? "Chemical/gas amounts restored, sample(s)" : "Sample(s)"} back in the pending-testing queue.${ rec.subBatchId ? " The analytical batch has been reset to pending — enter the corrected results as a new Analytical Batch, or delete it from Analytical Batch management." : ""}`);
  }
  const [showVoided, setShowVoided] = useState(false);
  const q = search.trim().toLowerCase();
  const voidedCount = testRecords.filter(r => r.voided).length;
  const filtered = [...testRecords].reverse().filter(r => {
    if (r.voided && !showVoided) return false;
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
      Client: r.sampleSource || "",
      Equipment: r.equipmentName || "",
      Standard_Samples: r.numberOfStandardSamples ?? 0,
      Field_Samples: r.numberOfFieldSamples ?? r.numberOfSamples ?? 0,
      Chemicals_Used: Object.entries(r.consumption).map(([k, v]) => `${k}: ${fmtNum(v)}ml`).join(", "),
      Gas_Used: (r.gasesUsed || []).map(g => g.gasName).join(", "),
      Dilution: r.dilutionRequired ? `${r.numberOfDilutedSamples || 0} sample(s)` : "No",
      // A voided record's revenue is shown as 0, not its original figure —
      // matching the analytics exclusion in 14c-analytics-pages-2.js, so an
      // export can't accidentally double as a "billable tests" sheet that
      // still counts invalidated work.
      Revenue: r.voided ? 0 : r.feeApplicable === false ? "Free" : fmtNum(r.revenue || 0),
      Voided: r.voided ? `${r.wasCorrectionRequest ? `Correction Requested (${r.correctionMode === "correction_only" ? "Correction Only" : "Retest"})` : "Yes"} — ${r.voidReason || ""}` : "No"
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
    }, voidedCount > 0 && /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-1.5 text-xs cursor-pointer",
      style: {
        color: C.muted
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: showVoided,
      onChange: e => {
        setShowVoided(e.target.checked);
        setPage(1);
      }
    }), `Show voided (${voidedCount})`), /*#__PURE__*/React.createElement("label", {
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
      placeholder: "Search tester, test, client...",
      className: "border rounded px-2 py-1 text-xs w-56",
      style: {
        borderColor: C.border
      }
    })), canArchiveRecords && archiveSelection.length > 0 && /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: trArchiveGate.guard(archiveSelectedRecords),
      loading: bulkArchiving
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "archive",
      size: 13
    }), `Archive Selected (${archiveSelection.length})`), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: exportFiltered
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "download",
      size: 13
    }), "Export Data"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: () => window.print()
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "printer",
      size: 13
    }), "Print / Save as PDF"))
  }, /*#__PURE__*/React.createElement(Banner, {
    tone: "info",
    storageKey: "testrecords-delete-restore-tip"
  }, "Deleting a test record returns the chemical amounts it used back to the exact bottles (batches) they were drawn from."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, pageRows.length === 0 && /*#__PURE__*/React.createElement(EmptyState, {
    icon: "edit",
    title: testRecords.length === 0 ? "No test records yet" : "No records match your search",
    subtitle: testRecords.length === 0 ? "Results recorded from the Add Test Record tab will show up here." : "Try a different sample code, tester, or test type."
  }), pageRows.map((r, rowIdx) => {
    const isOpen = !!expanded[r.id];
    const chemPairs = Object.entries(r.consumption);
    const rowRef = referenceForRecord(r);
    // Cost of Test shown here always mirrors the linked parameter's current
    // Standard Fee (same live lookup as Test Types and Add Test Record) —
    // previously this row had no direct "Cost of Test" figure at all, only
    // a total Revenue badge, which is why it looked disconnected from
    // whatever the Parameter said the fee should be.
    const recordTestType = (testTypes || []).find(t => t.id === r.testTypeId);
    const linkedFeeParam = recordTestType && (recordTestType.linkedParameterIds || []).length > 0
      ? (parameters || []).find(p => p.id === recordTestType.linkedParameterIds[0])
      : null;
    const liveUnitCost = linkedFeeParam ? Number(linkedFeeParam.standardFee) || 0 : Number(recordTestType?.costPerTest) || 0;
    const billedSamplesForRow = r.billedSamples ?? r.numberOfFieldSamples ?? r.numberOfSamples ?? 0;
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      className: "rounded",
      style: {
        border: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleExpand(r.id),
      className: "w-full flex items-center justify-between gap-3 px-3 py-2 text-left overflow-x-auto",
      style: {
        background: isOpen ? `${C.teal}14` : rowIdx % 2 === 1 ? C.bg : C.card
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-3 shrink-0"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: isOpen ? "chevronDown" : "chevronRight",
      size: 14,
      color: C.muted
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-xs shrink-0",
      style: {
        color: C.muted
      }
    }, r.date), /*#__PURE__*/React.createElement("span", {
      className: "text-xs font-semibold shrink-0",
      style: {
        color: C.ink
      }
    }, r.testTypeName), /*#__PURE__*/React.createElement("span", {
      className: "text-xs shrink-0",
      style: {
        color: C.muted
      }
    }, "Ref: ", /*#__PURE__*/React.createElement("span", { style: { color: C.ink } }, rowRef?.refNo || "—")), /*#__PURE__*/React.createElement("span", {
      className: "text-xs shrink-0",
      style: {
        color: C.muted
      }
    }, "Tracking: ", /*#__PURE__*/React.createElement("span", { style: { color: C.ink } }, rowRef?.trackingNo || "—")), (() => {
      // Which unit does this record actually cover — a Sub-Batch (many
      // samples, one parameter) or one Individual Sample? Previously the
      // row only showed the test name + date, with no way to tell.
      const sb = r.subBatchId ? (subBatches || []).find(x => x.id === r.subBatchId) : null;
      if (r.memberSampleIds && r.memberSampleIds.length) {
        return /*#__PURE__*/React.createElement(Badge, {
          tone: "info"
        }, /*#__PURE__*/React.createElement(Icon, {
          name: "clipboard",
          size: 11
        }), " Analytical Batch: ", sb ? sb.label : r.subBatchLabel || "(deleted)");
      }
      const sample = r.sampleId ? (samples || []).find(s => s.id === r.sampleId) : null;
      return /*#__PURE__*/React.createElement(Badge, {
        tone: "muted"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "flask",
        size: 11
      }), " Individual: ", sample ? sample.sampleCode : r.sampleCode || "(sample removed)");
    })()), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-3 shrink-0 ml-auto",
      onClick: e => e.stopPropagation()
    }, canArchiveRecords && isArchivable(r) && /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      title: "Select for bulk archiving",
      checked: archiveSelection.includes(r.id),
      onChange: () => toggleArchiveSelect(r.id)
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-xs shrink-0",
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
    }, "QC ", r.qcCheck.pass ? "Pass" : "Fail"), (r.attemptNo || 1) > 1 && /*#__PURE__*/React.createElement(Badge, {
      tone: "info",
      title: r.retestReason ? `Retest reason: ${r.retestReason}` : undefined
    }, "Attempt #", r.attemptNo), r.voided ? /*#__PURE__*/React.createElement(Badge, {
      tone: "danger",
      title: `${r.wasCorrectionRequest ? `Correction requested (${r.correctionMode === "correction_only" ? "Correction Only — consumption not restored" : "Retest — consumption restored"})` : "Voided"} by ${r.voidedBy || "?"} on ${r.voidedAt ? r.voidedAt.slice(0, 10) : "?"}: ${r.voidReason || ""}`
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 11
    }), r.wasCorrectionRequest ? (r.correctionMode === "correction_only" ? " Corrected (no restore)" : " Corrected (retest)") : " Voided") : (r.correctionHistory && r.correctionHistory.length > 0) ? /*#__PURE__*/React.createElement(Badge, {
      tone: "info",
      title: `Corrected in-place ${r.correctionHistory.length} time(s). Latest: ${r.correctionHistory[r.correctionHistory.length - 1].reason}`
    }, "Corrected") : r.feeApplicable === false ? /*#__PURE__*/React.createElement(Badge, {
      tone: "muted"
    }, "Free") : /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, "Total Cost: BDT ", fmtNum(liveUnitCost * billedSamplesForRow)), !r.voided && isLocked(r) && /*#__PURE__*/React.createElement(Badge, {
      tone: "info",
      title: "Approved/released — no longer directly editable. Use \"Request Correction\" if a change is genuinely needed."
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "lock",
      size: 11
    }), " Locked"), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-1"
    }, canEditRecords && !r.voided && !isLocked(r) && /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit full test record",
      onClick: trEditGate.guard(() => onEditRecord(r))
    }), canArchiveRecords && isArchivable(r) && /*#__PURE__*/React.createElement(IconButton, {
      name: "archive",
      color: C.ok,
      title: "Archive this completed record",
      disabled: archivingId === r.id,
      onClick: trArchiveGate.guard(() => archiveOne(r))
    }), canDeleteRecords && !r.voided && /*#__PURE__*/React.createElement(IconButton, {
      name: isLocked(r) ? "restore" : "trash",
      color: isLocked(r) ? C.info : C.warn,
      title: isLocked(r) ? "Request Correction — approved/released, so this starts a new corrected attempt instead of editing in place" : "Void this record — kept for the audit trail, not permanently deleted",
      onClick: trDeleteGate.guard(() => setVoidingRecord(r))
    })))), isOpen && /*#__PURE__*/React.createElement("div", {
      className: "px-4 py-3 text-xs grid grid-cols-2 md:grid-cols-3 gap-3",
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      }
    }, "Client"), /*#__PURE__*/React.createElement("div", {
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
    }, r.feeApplicable === false ? "Free test" : r.revenue != null ? `${r.billedSamples ?? r.numberOfSamples} × ৳${fmtNum(r.unitCost || 0)}` : "—")), (r.memberResults || []).length > 0 && (() => {
      const sb = r.subBatchId ? (subBatches || []).find(x => x.id === r.subBatchId) : null;

      const headerLine = /*#__PURE__*/React.createElement("div", {
        className: "flex items-center justify-between flex-wrap gap-2 mb-1"
      }, /*#__PURE__*/React.createElement("span", {
        style: { color: C.muted }
      }, `Samples in this Analytical Batch (${r.memberResults.length})`));

      // Union of every result-parameter name across all members, in first-seen
      // order — so the table has consistent columns even if some samples'
      // results haven't been entered yet (blank cell) or a method has more
      // than one named parameter.
      const paramNames = [];
      r.memberResults.forEach(m => (m.results || []).forEach(res => {
        if (!paramNames.includes(res.name)) paramNames.push(res.name);
      }));
      const memberListDiv = /*#__PURE__*/React.createElement("div", {
        className: "overflow-x-auto"
      }, /*#__PURE__*/React.createElement("table", {
        className: "w-full text-xs border-collapse"
      }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["Sample", "Client / Site", "Reference", "Stage", "Fee"].concat(paramNames).map(h => /*#__PURE__*/React.createElement("th", {
        key: h,
        className: "text-left px-2 py-1.5",
        style: { borderBottom: `1px solid ${C.border}`, color: C.muted }
      }, h)))), /*#__PURE__*/React.createElement("tbody", null, r.memberResults.map(m => {
        const sample = (samples || []).find(s => s.id === m.sampleId);
        const ref = sample?.referenceId ? findReferenceById(references, sample.referenceId) : null;
        const stage = sample ? testStageForSample(sample, r.testTypeId, testRecords, subBatches) : null;
        const stageStyle = stage ? testStageChipStyle(stage) : null;
        const resultByName = {};
        (m.results || []).forEach(res => {
          resultByName[res.name] = res;
        });
        return /*#__PURE__*/React.createElement("tr", {
          key: m.sampleId,
          style: { borderBottom: `1px solid ${C.border}` }
        }, /*#__PURE__*/React.createElement("td", {
          className: "px-2 py-1.5"
        }, goToSample ? /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "font-semibold underline",
          style: { color: C.ink },
          onClick: () => goToSample(m.sampleId)
        }, m.sampleCode) : /*#__PURE__*/React.createElement("span", {
          className: "font-semibold",
          style: { color: C.ink }
        }, m.sampleCode)), /*#__PURE__*/React.createElement("td", {
          className: "px-2 py-1.5",
          style: { color: C.muted }
        }, sample ? `${sample.clientName} · ${sample.siteLocation}` : "—"), /*#__PURE__*/React.createElement("td", {
          className: "px-2 py-1.5",
          style: { color: C.muted }
        }, ref ? referenceDisplayLabel(ref) : "—"), /*#__PURE__*/React.createElement("td", {
          className: "px-2 py-1.5"
        }, stage && /*#__PURE__*/React.createElement("span", {
          className: "px-1.5 py-0.5 rounded",
          style: { background: stageStyle.bg, color: stageStyle.fg }
        }, testStageLabel(stage))), /*#__PURE__*/React.createElement("td", {
          className: "px-2 py-1.5"
        }, (m.attemptNo || 1) > 1
          ? /*#__PURE__*/React.createElement("span", {
              className: "px-1.5 py-0.5 rounded",
              style: { background: m.feeApplicable === false ? C.infoBg : C.okBg, color: m.feeApplicable === false ? C.muted : C.ok },
              title: `Attempt #${m.attemptNo}`
            }, m.feeApplicable === false ? `Waived (retest #${m.attemptNo})` : `Charged (retest #${m.attemptNo})`)
          : /*#__PURE__*/React.createElement("span", { style: { color: C.muted } }, m.feeApplicable === false ? "Free" : "Billed")
        ), ...paramNames.map(name => {
          const res = resultByName[name];
          return /*#__PURE__*/React.createElement("td", {
            key: name,
            className: "px-2 py-1.5",
            style: { color: res && res.value != null ? C.ok : C.warn }
          }, res && res.value != null ? `${fmtNum(res.value)} ${res.unit || ""}` : "—");
        }));
      }))));

      const reviewActionsBlock = (sb && ["tested", "reviewed", "approved"].includes(sb.status)) ? /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-2 mt-2"
      }, /*#__PURE__*/React.createElement("span", {
        className: "text-xs",
        style: { color: C.muted }
      }, "Review/Approve/Release moved to "), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "text-xs underline",
        style: { color: C.teal },
        onClick: () => goToResultsWorkflow?.()
      }, "Results Workflow →")) : null;

      return /*#__PURE__*/React.createElement("div", {
        className: "col-span-2 md:col-span-3"
      }, headerLine, memberListDiv, reviewActionsBlock);
    })(), r.sampleId && !r.memberSampleIds && (() => {
      // Individual (non-Sub-Batch) record — same review controls, applied
      // directly to this one (sample, testType) pair since there's no
      // Sub-Batch wrapper to act on.
      const sample = (samples || []).find(s => s.id === r.sampleId);
      if (!sample || !setSamples) return null;
      const rt = (sample.requestedTests || []).find(x => x.testTypeId === r.testTypeId);
      if (!rt) return null;
      const ref = sample.referenceId ? findReferenceById(references, sample.referenceId) : null;

      const headerLine = /*#__PURE__*/React.createElement("div", {
        className: "flex flex-wrap items-center gap-1.5 px-2 py-1 rounded mb-2",
        style: { background: C.bg }
      }, goToSample ? /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "font-semibold underline",
        style: { color: C.ink },
        onClick: () => goToSample(sample.id)
      }, sample.sampleCode) : /*#__PURE__*/React.createElement("span", {
        className: "font-semibold",
        style: { color: C.ink }
      }, sample.sampleCode),
      /*#__PURE__*/React.createElement("span", {
        style: { color: C.muted }
      }, `${sample.clientName} · ${sample.siteLocation}${ref ? ` · ${referenceDisplayLabel(ref)}` : ""}`),
      /*#__PURE__*/React.createElement("span", {
        className: "px-1.5 py-0.5 rounded",
        style: { background: testStageChipStyle(rt.status).bg, color: testStageChipStyle(rt.status).fg }
      }, testStageLabel(rt.status)));

      const reviewActionsBlock = ["results_entered", "under_review", "approved"].includes(rt.status) ? /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-2"
      }, /*#__PURE__*/React.createElement("span", {
        className: "text-xs",
        style: { color: C.muted }
      }, "Review/Approve/Release moved to "), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "text-xs underline",
        style: { color: C.teal },
        onClick: () => goToResultsWorkflow?.()
      }, "Results Workflow →")) : null;

      return /*#__PURE__*/React.createElement("div", {
        className: "col-span-2 md:col-span-3"
      }, headerLine, reviewActionsBlock);
    })(), (r.results || []).filter(res => res.value !== null).length > 0 && /*#__PURE__*/React.createElement("div", {
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
    }, g.gasName, g.amount ? `: ${fmtNum(g.amount)}` : ""))))));
  })), voidingRecord && /*#__PURE__*/React.createElement(ReasonRequiredModal, {
    title: isLocked(voidingRecord) ? `Request Correction — ${voidingRecord.date} · ${voidingRecord.testTypeName}` : `Void Test Record — ${voidingRecord.date} · ${voidingRecord.testTypeName}`,
    description: isLocked(voidingRecord) ? "This result is approved/released, so it's no longer directly editable. The approved value is retained exactly as it was (for the audit trail) and every sample this record covered goes back to pending testing — enter the corrected result as a new Analytical Batch and it will automatically be tracked as a new, numbered attempt. Choose what should happen to the chemical/gas already consumed on this record:" : "The record stays in the system (not deleted) for the audit trail. Consumed chemical/gas amounts are returned to inventory, and every sample this record covered goes back to pending testing.",
    confirmLabel: "Void Record",
    // Request Correction offers a CHOICE (Correction Only vs Retest) instead
    // of one button — a routine Void keeps the single-button flow it always
    // had (see ReasonRequiredModal in 02-ui-kit.js: `actions` with 1 entry
    // falls back to that same single-button layout automatically).
    actions: isLocked(voidingRecord) ? [{
      key: "correction_only",
      label: "Correction Only (no restore)",
      variant: "outline",
      detail: "The test itself was done correctly — this is a paperwork/transcription-style fix (e.g. wrong unit, wrong sample code on the report). Chemical/gas already consumed stays consumed; nothing is returned to inventory.",
      onConfirm: reason => doCorrectionEdit(voidingRecord, reason)
    }, {
      key: "retest",
      label: "Retest (restore consumption)",
      variant: "danger",
      detail: "The result itself needs to be redone from scratch. Chemical/gas already consumed on this record is restored to inventory, since a fresh Analytical Batch will consume it again on the new attempt.",
      onConfirm: reason => doVoid(voidingRecord, reason, "retest")
    }] : null,
    onClose: () => setVoidingRecord(null),
    onConfirm: reason => doVoid(voidingRecord, reason)
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: pageClamped,
    totalPages: totalPages,
    totalItems: filtered.length,
    pageSize: PAGE_SIZE,
    onPageChange: setPage
  })));
}
