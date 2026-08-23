// ===== 22-results-workflow-ui.js =====
// ============================================================================
// RESULTS WORKFLOW — the ONE place "Upload results / Review / Approve /
// Release" happens now. Previously these were scattered across three spots:
//   1. Sample Detail (21-sample-ui.js) — per-parameter Final Approve/Release
//      buttons + the whole-sample signature panel.
//   2. Create Analytical Batch's Sub-Batch rows — inline Mark Reviewed /
//      Final Approve / Release buttons.
//   3. Create Analytical Batch's "Batch Actions" toolbar — Batch Approve /
//      Batch Release by Reference.
// All three are removed from those locations (Sample Detail now only shows
// read-only stage/value + a deep-link here; Create Analytical Batch is
// creation-only again) and consolidated into this tab, reached from Samples
// → "Results Workflow".
//
// IMPORTANT — no new decision logic lives here. Every action below calls the
// exact same functions that used to live in those three places
// (bulkDecideParameter / bulkReleaseParameter in 20-sample-model.js,
// setRequestedTestStatus for the un-signed review step) — this file is a UI
// consolidation only. Because those functions already take an arbitrary
// list of samples (not just a Sub-Batch's members), every queue below groups
// by (testTypeId) across ALL samples needing that step, regardless of
// whether they were tested via a Sub-Batch, Batch(Reference) mode, or a
// plain individual Add Test Record entry — one queue, one action, no matter
// how the result got entered.
//
// ROLE AWARENESS — a stage/queue is only rendered at all if the signed-in
// user is permissioned for it (permissionsFor(permissionMatrix, session) in
// 20-sample-model.js — role default from the "samples" module of the shared
// permission matrix, per-user override wins if set):
//   - Sample Analyzer → canEnterResults only → sees ONLY
//     "Pending Upload". Nothing else from this tab is even reachable.
//   - Reviewer → canReview only → sees ONLY "Awaiting Review".
//   - QA Manager / Administrator → canReview + canApprove + canRelease (and
//     canEnterResults for Administrator) → see every stage they're
//     permissioned for.
// This is enforced by hiding the pill + queue entirely, not just disabling
// a button, so a multi-role lab can hand this one screen to everyone and
// each person only ever sees their own piece of it.
// ============================================================================

const E = React.createElement;

// ---- floating scroll-to-top / scroll-to-bottom buttons — the page itself
// scrolls (LabApp's shell is min-h-screen, no inner overflow container), so
// this just drives window.scrollTo. Only rendered once the page is tall
// enough to actually need it, and hides itself again once nothing's above
// or below the current position, so it never sits there uselessly. ----
function ScrollTopBottomButtons() {
  const [canUp, setCanUp] = React.useState(false);
  const [canDown, setCanDown] = React.useState(false);
  React.useEffect(() => {
    function update() {
      const scrollable = document.documentElement.scrollHeight > window.innerHeight + 80;
      setCanUp(scrollable && window.scrollY > 200);
      setCanDown(scrollable && window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 200);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const id = setInterval(update, 800); // table rows expand/collapse without a scroll event — catch those too
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); clearInterval(id); };
  }, []);
  if (!canUp && !canDown) return null;
  const btnStyle = {
    width: 34, height: 34, borderRadius: "50%",
    background: C.card, border: `1px solid ${C.border}`,
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: C.teal
  };
  return E("div", {
    className: "no-print",
    style: { position: "fixed", right: 18, bottom: 18, zIndex: 40, display: "flex", flexDirection: "column", gap: 8 }
  },
    canUp && E("button", {
      type: "button", title: "Scroll to top",
      onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      style: btnStyle
    }, E("svg", { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, E("path", { d: "M18 15l-6-6-6 6" }))),
    canDown && E("button", {
      type: "button", title: "Scroll to bottom",
      onClick: () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }),
      style: btnStyle
    }, E("svg", { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, E("path", { d: "M6 9l6 6 6-6" })))
  );
}

// ---- shared grouping: every (sample, requestedTest) pair currently at
// `stage`, grouped by testTypeId. This is what makes the queues indifferent
// to Sub-Batch vs. individual vs. Batch(Reference) origin. ----
function groupSamplesByParamStage(samples, stage) {
  const map = {};
  (samples || []).forEach(sample => {
    (sample.requestedTests || []).forEach(rt => {
      if (rt.status !== stage) return;
      const key = rt.testTypeId;
      if (!map[key]) {
        map[key] = {
          testTypeId: rt.testTypeId,
          testTypeName: rt.testTypeName,
          samples: []
        };
      }
      map[key].samples.push(sample);
    });
  });
  return Object.values(map).sort((a, b) => (a.testTypeName || "").localeCompare(b.testTypeName || ""));
}

// ---- un-signed technical review step (results_entered -> under_review, or
// back to in_progress) — same as reviewSubBatchApprove/Return in
// 16-sub-batch.js used to do, just generalized to any sample list instead
// of requiring a Sub-Batch wrapper object. ----
function bulkMarkReviewed(sampleList, testTypeId, testTypeName, session, setSamples, notify) {
  let count = 0;
  const updatedList = [];
  sampleList.forEach(sample => {
    const rt = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
    if (!rt || rt.status !== "results_entered") return;
    const updated = setRequestedTestStatus(sample, testTypeId, "under_review", session);
    updatedList.push(updated);
    count++;
  });
  if (!updatedList.length) return Promise.resolve();
  // ONE backend call — move setSamples INSIDE .then() so rows only disappear
  // from the Review queue after the backend has confirmed the save.
  // This way the user sees the row persist with a pending state and only
  // sees it vanish (along with the success toast) once it's truly saved.
  return DataService.submitApprovalDecision(updatedList, { step: "review", testTypeId }).then(stamped => {
    if (Array.isArray(stamped)) {
      stamped.forEach(st => {
        const orig = updatedList.find(u => u.id === st.id);
        if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
      });
    }
    setSamples(prev => {
      const map = new Map(updatedList.map(u => [u.id, u]));
      return prev.map(s => map.get(s.id) || s);
    }, null);
    notify?.(`${count} sample(s) marked reviewed for ${testTypeName} — ready for final approval.`, "ok");
  }).catch(err => {
    console.error("Failed to save reviewed samples to backend:", err);
    notify?.(`Review failed to save — please try again. (${err && err.message || err})`, "warn");
    throw err;
  });
}
// (Group-level "Return to Analyst" used to live here as
// bulkReturnToAnalystFromReview — superseded by the per-row/per-batch
// Return to Analyst action below, which also retracts the prior result via
// voidSampleResultForTest so the sample genuinely becomes eligible for a
// new Analytical Batch again, the way this function never did.)

// ---- shared: flatten a testType-grouped queue into one row per
// (sample, testTypeId) pair — the unit both Flat View and Analytical Batch
// View are built from. ----
function flattenStageGroups(groups) {
  const rows = [];
  groups.forEach(g => g.samples.forEach(sample => rows.push({ sample, testTypeId: g.testTypeId, testTypeName: g.testTypeName })));
  return rows;
}

// ---- shared: group rows by their originating Analytical Batch — the same
// grouping concept as Sample Registration's "Group by Batch", just keyed off
// the test record's subBatchId (via originBatchForSampleTest, 16-sub-batch.js)
// instead of the sample's Reference. ----
function groupRowsByBatch(rows, testRecords, subBatches) {
  const map = {};
  rows.forEach(row => {
    const bucket = originBatchForSampleTest(row.sample, row.testTypeId, testRecords, subBatches);
    const key = `${bucket.key}__${row.testTypeId}`;
    if (!map[key]) map[key] = { key, label: bucket.label, testTypeId: row.testTypeId, testTypeName: row.testTypeName, rows: [] };
    map[key].rows.push(row);
  });
  return Object.values(map).sort((a, b) => a.label.localeCompare(b.label) || a.testTypeName.localeCompare(b.testTypeName));
}

// ---- Flat View / Analytical Batch View toggle — visually the same pill
// pattern as Sample Registration's Flat View / Group by Batch toggle. ----
function StageViewToggle({ viewMode, setViewMode }) {
  const opts = [{ k: "flat", label: "Flat View" }, { k: "batch", label: "Analytical Batch View" }];
  return E("div", {
    className: "inline-flex p-0.5 rounded-lg mb-3",
    style: { background: C.bg, border: `1px solid ${C.border}` }
  }, opts.map(v => E("button", {
    key: v.k,
    type: "button",
    onClick: () => setViewMode(v.k),
    className: "px-3 py-1 rounded-md text-xs font-medium",
    style: {
      background: viewMode === v.k ? C.card : "transparent",
      color: viewMode === v.k ? C.ink : C.muted,
      boxShadow: viewMode === v.k ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
    }
  }, v.label)));
}

// ---- per-row Return to Analyst / On Hold / Resume — available on every
// sample row in Awaiting Review, Awaiting Approval, and Approved-Release,
// independent of every other sample in whatever Analytical Batch it came
// from and independent of every other parameter on the same sample.
//
//   Return to Analyst — retracts this sample's specific result (voided, not
//     deleted — full audit trail stays intact) and resets this parameter's
//     status to "in_progress", so the sample becomes eligible for a
//     brand-new Analytical Batch again: it behaves exactly like a freshly
//     registered sample. It no longer shows up in ANY Results Workflow
//     queue — it's back with Sample Registration / Add Test Record instead.
//     REQUIRES A REASON — see ReasonRequiredModal above; the reason,
//     previous result, and originating Test Record are recorded on the
//     sample itself (sample.returnEvents[], see returnRequestedTestToAnalyst
//     in 20-sample-model.js) AND as a structured auditLog entry below, so
//     both "look at this sample's history" and "look at the audit trail"
//     show the same, complete story.
//   On Hold — flags the parameter and parks it at Awaiting Review (staying
//     put if it was already there). It keeps showing up — visibly, tagged
//     "On Hold" — so nothing silently disappears; it's just skipped by
//     whatever bulk action moves the rest of that batch/group forward.
//   Resume — clears the hold with no status change.
// ----
function RowHoldReturnActions({ sample, testTypeId, testTypeName, session, notify, setSamples, setTestRecords, testRecords, size, stageGate }) {
  const held = isTestOnHold(sample, testTypeId);
  const [confirmingReturn, setConfirmingReturn] = React.useState(false);
  const [confirmingHold, setConfirmingHold] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);

  async function doReturn(reason) {
    if (!stageGate.allowed || isProcessing) return;
    // Capture what the result actually was, and the pre-change status,
    // BEFORE voiding/transitioning — so the return event (and the audit
    // entry below) keep a record of both.
    const rtBefore = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
    const previousStatus = rtBefore ? rtBefore.status : null;
    const resultInfo = getSampleResultForTest(sample, testTypeId, testRecords);
    const nextRecords = voidSampleResultForTest(testRecords, sample, testTypeId);
    if (nextRecords !== testRecords) setTestRecords?.(nextRecords);
    const updated = returnRequestedTestToAnalyst(sample, testTypeId, testTypeName, session, reason, {
      previousResult: resultInfo?.results ?? null,
      testRecordId: resultInfo?.recordId ?? null
    });
    if (updated === sample) return; // reason was rejected inside the model function — nothing changed, nothing to persist/notify
    setIsProcessing(true);
    try {
      const stamped = await DataService.returnToAnalyst([updated]);
      const final = (Array.isArray(stamped) && stamped[0]) ? { ...updated, _version: stamped[0]._version, updatedAt: stamped[0].updatedAt } : updated;
      setSamples(prev => prev.map(s => s.id === sample.id ? final : s), final);
      DataService.appendAudit({
        eventType: "RESULT_RETURNED",
        entityType: "requestedTest",
        entityId: `${sample.id}:${testTypeId}`,
        sampleId: sample.id,
        sampleCode: sample.sampleCode,
        testTypeId,
        testTypeName,
        testRecordId: resultInfo?.recordId ?? null,
        reason,
        previousValue: previousStatus,
        newValue: "in_progress",
        entity: "sample",
        action: "return_to_analyst",
        note: `Returned to analyst for ${testTypeName}: ${reason}`
      }).catch(err => console.error("Audit log write failed (non-fatal):", err));
      setConfirmingReturn(false);
      notify?.(`${sample.sampleCode} returned to analyst for ${testTypeName} — back in the pending-testing queue, same as a freshly registered sample.`, "warn");
    } catch(err) {
      console.error("Failed to return sample to analyst:", err);
      notify?.(`Return failed — please try again. (${err && err.message || err})`, "warn");
    } finally {
      setIsProcessing(false);
    }
  }
  // A REASON IS REQUIRED (Workflow/Data-Integrity Upgrade Step 8 — this was
  // previously the one sensitive per-parameter action with no reason
  // prompt at all). Passed through as `note` to holdRequestedTestForSample
  // (20-sample-model.js), which already accepted an optional note param —
  // just wasn't being given one from here.
  async function doHold(reason) {
    if (!stageGate.allowed || isProcessing) return;
    const updated = holdRequestedTestForSample(sample, testTypeId, testTypeName, session, reason);
    if (updated === sample) return; // reason was rejected inside the model function — nothing changed, nothing to persist/notify
    setIsProcessing(true);
    try {
      const stamped = await DataService.holdTest([updated]);
      const final = (Array.isArray(stamped) && stamped[0]) ? { ...updated, _version: stamped[0]._version, updatedAt: stamped[0].updatedAt } : updated;
      setSamples(prev => prev.map(s => s.id === sample.id ? final : s), final);
      DataService.appendAudit({
        eventType: "TEST_ON_HOLD",
        entityType: "requestedTest",
        entityId: `${sample.id}:${testTypeId}`,
        sampleId: sample.id,
        sampleCode: sample.sampleCode,
        testTypeId,
        testTypeName,
        reason,
        entity: "sample",
        action: "hold",
        note: `${testTypeName} put on hold: ${reason}`
      }).catch(err => console.error("Audit log write failed (non-fatal):", err));
      setConfirmingHold(false);
      notify?.(`${sample.sampleCode} put on hold for ${testTypeName} — parked in Awaiting Review, other samples in this batch are unaffected.`, "warn");
    } catch(err) {
      console.error("Failed to put test on hold:", err);
      notify?.(`Hold failed — please try again. (${err && err.message || err})`, "warn");
    } finally {
      setIsProcessing(false);
    }
  }
  async function doResume() {
    if (!stageGate.allowed || isProcessing) return;
    const updated = resumeRequestedTestForSample(sample, testTypeId, testTypeName, session);
    setIsProcessing(true);
    try {
      const stamped = await DataService.resumeTest([updated]);
      const final = (Array.isArray(stamped) && stamped[0]) ? { ...updated, _version: stamped[0]._version, updatedAt: stamped[0].updatedAt } : updated;
      setSamples(prev => prev.map(s => s.id === sample.id ? final : s), final);
      notify?.(`${sample.sampleCode} resumed for ${testTypeName} — back in the normal queue.`, "ok");
    } catch(err) {
      console.error("Failed to resume test:", err);
      notify?.(`Resume failed — please try again. (${err && err.message || err})`, "warn");
    } finally {
      setIsProcessing(false);
    }
  }
  if (!stageGate.visible) return E(React.Fragment, null);
  return E(React.Fragment, null,
    E("div", { className: "flex items-center gap-1" },
      held
        ? E(IconButton, { key: "resume", name: "check", color: isProcessing ? C.muted : C.ok, title: "Resume — back into the normal queue", onClick: stageGate.guard(doResume), disabled: isProcessing })
        : E(IconButton, { key: "hold", name: "lock", color: isProcessing ? C.muted : C.warn, title: "On Hold — park in Awaiting Review", onClick: stageGate.guard(() => setConfirmingHold(true)), disabled: isProcessing }),
      E(IconButton, { key: "return", name: "arrowLeft", color: isProcessing ? C.muted : C.danger, title: "Return to Analyst — back to pending testing, like a fresh sample", onClick: stageGate.guard(() => setConfirmingReturn(true)), disabled: isProcessing })
    ),
    confirmingReturn && E(ReasonRequiredModal, {
      title: `Return to Analyst — ${sample.sampleCode}`,
      description: `${testTypeName} will go back to pending testing, exactly like a freshly registered sample. The current result is voided (kept, not deleted, for the audit trail) and this sample drops out of every Results Workflow queue until it's tested again.`,
      confirmLabel: "Return to Analyst",
      onClose: () => setConfirmingReturn(false),
      onConfirm: doReturn
    }),
    confirmingHold && E(ReasonRequiredModal, {
      title: `On Hold — ${sample.sampleCode}`,
      description: `${testTypeName} will be parked in Awaiting Review (excluded from whatever bulk action moves the rest of this batch forward) until resumed. No result is changed or voided.`,
      confirmLabel: "Put On Hold",
      onClose: () => setConfirmingHold(false),
      onConfirm: doHold
    })
  );
}

// ---- expandable "reviewer remark" editor row, opened from the Actions
// column's edit icon (see StageRow) instead of living inline inside the
// System Remark cell — keeps every row a single line unless someone is
// actually mid-edit. Mirrors the SignatureCapture expansion row already
// used for Final Approve/Reject just below it. ----
function RemarkEditRow({ manualRemark, onSave, onClose, colSpan }) {
  const [draft, setDraft] = React.useState(manualRemark || "");
  function commit() {
    onSave((draft || "").trim());
    onClose();
  }
  return E("tr", null, E("td", { colSpan, className: "px-3 pb-2 pt-1" },
    E("div", { className: "flex items-center gap-1.5" },
      E(Icon, { name: "edit", size: 12, color: C.muted }),
      E("input", {
        autoFocus: true,
        className: "border rounded px-2 py-1 text-xs flex-1",
        style: { borderColor: C.border },
        placeholder: "Add reviewer remark…",
        value: draft,
        onChange: e => setDraft(e.target.value),
        onKeyDown: e => { if (e.key === "Enter") commit(); if (e.key === "Escape") onClose(); }
      }),
      E(Button, { size: "sm", onClick: commit }, "Save"),
      E("button", { type: "button", className: "text-xs px-2", style: { color: C.muted }, onClick: onClose }, "Cancel")
    )
  ));
}

// ---- one sample row, used by both Flat View (all rows in one table, with
// a Test Type column since nothing else identifies which parameter a row is
// for) and Analytical Batch View (rows nested under their originating
// batch, Test Type column omitted since a batch's rows share one method).
// Carries its own primary stage action (Mark Reviewed / Final Approve-Reject
// / Release) sized to just this one sample — reuses the exact same
// bulkMarkReviewed / bulkDecideParameter / bulkReleaseParameter functions
// bulk actions use, just called with a one-sample list, so per-row and
// bulk/batch behavior can never drift apart. ----
function StageRow({ row, stage, testRecords, testTypes, parameters, references, session, notify, setSamples, setTestRecords, goToSample, showSystemRemark, showTestTypeColumn, signingKey, setSigningKey, remarkEditKey, setRemarkEditKey, stageGate }) {
  const { sample, testTypeId, testTypeName } = row;
  const held = isTestOnHold(sample, testTypeId);
  const resultInfo = getSampleResultForTest(sample, testTypeId, testRecords);
  const ref = sample.referenceId ? findReferenceById(references, sample.referenceId) : null;
  const evaluated = showSystemRemark ? evaluateSampleResultsForTest(sample, testTypeId, testTypes, parameters, testRecords) : [];
  const [isProcessing, setIsProcessing] = React.useState(false);
  const rowKey = `${sample.id}__${testTypeId}`;
  const isSigningThisRow = signingKey === rowKey;
  const isEditingRemarkThisRow = remarkEditKey === rowKey;
  const currentManualRemark = getManualRemark(sample, testTypeId);
  const canEditRemark = showSystemRemark && !!setSamples && stageGate.visible;

  function handleManualRemarkChange(text) {
    if (!stageGate.allowed) {
      notify?.("Guest access can't edit reviewer remarks — this login is view-only for this action.", "warn");
      return;
    }
    const updated = setManualRemarkOnSample(sample, testTypeId, text);
    setSamples?.(prev => prev.map(s => s.id === sample.id ? updated : s), updated);
  }

  async function doMarkReviewed() {
    if (!stageGate.allowed || isProcessing) return;
    setIsProcessing(true);
    try {
      await bulkMarkReviewed([sample], testTypeId, testTypeName, session, setSamples, notify);
    } catch (e) {} finally {
      setIsProcessing(false);
    }
  }

  async function doRelease() {
    if (!stageGate.allowed || isProcessing) return;
    const result = bulkReleaseParameter([sample], testTypeId, testTypeName, session);
    const updatedList = result.updated;
    if (!updatedList.length) return;
    setIsProcessing(true);
    try {
      // Move setSamples INSIDE .then() so the row stays visible until backend confirms
      const stamped = await DataService.releaseResult(updatedList);
      if (Array.isArray(stamped)) {
        stamped.forEach(st => {
          const orig = updatedList.find(u => u.id === st.id);
          if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
        });
      }
      setSamples(prev => {
        const map = new Map(updatedList.map(u => [u.id, u]));
        return prev.map(s => map.get(s.id) || s);
      }, null);
      notify?.(`${sample.sampleCode} released for ${testTypeName}.`, "ok");
    } catch(err) {
      console.error("Failed to save released samples to backend:", err);
      notify?.(`Release failed to save — please try again. (${err && err.message || err})`, "warn");
    } finally {
      setIsProcessing(false);
    }
  }

  const cells = [
    E("td", { key: "sample", className: "px-2 py-1.5" },
      E("button", { className: "text-xs font-semibold underline whitespace-nowrap", style: { color: C.teal }, onClick: () => goToSample?.(sample.id) }, sample.sampleCode),
      held && E("div", { className: "mt-0.5" }, E(Badge, { tone: "warn" }, "Hold"))
    ),
    E("td", { key: "client", className: "px-2 py-1.5 text-xs truncate max-w-[110px]", style: { color: C.muted }, title: sample.clientName || "" }, sample.clientName || "—"),
    E("td", { key: "ref", className: "px-2 py-1.5 text-xs truncate max-w-[110px]", style: { color: C.muted }, title: ref ? referenceDisplayLabel(ref) : "" }, ref ? referenceDisplayLabel(ref) : "—")
  ];
  if (showTestTypeColumn) cells.push(E("td", { key: "tt", className: "px-2 py-1.5 text-xs truncate max-w-[110px]", style: { color: C.ink }, title: testTypeName }, testTypeName));
  const resultRows = resultInfo && resultInfo.results ? resultInfo.results.filter(r => r.value != null) : [];
  const resultText = resultRows.length
    ? (resultRows.length > 1
        ? resultRows.map(r => `${r.name}: ${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ""}`).join(", ")
        : resultRows.map(r => `${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ""}`).join(", ")) || "—"
    : "—";
  cells.push(E("td", { key: "result", className: "px-2 py-1.5 text-xs truncate max-w-[110px]", style: { color: C.ink }, title: resultText }, resultText));
  if (showSystemRemark) cells.push(E("td", { key: "remark", className: "px-2 py-1.5" },
    E(SystemRemarkCell, { evaluated, manualRemark: currentManualRemark })
  ));

  cells.push(E("td", { key: "actions", className: "px-2 py-1.5" },
    E("div", { className: "flex items-center gap-1 whitespace-nowrap" },
      isProcessing ? E("span", { className: "text-[10px] uppercase font-bold text-gray-400" }, "Saving...") : E(React.Fragment, null,
        !held && stage === "review" && stageGate.visible && E(IconButton, { name: "check", color: C.teal, title: "Mark Reviewed", onClick: stageGate.guard(doMarkReviewed) }),
        !held && stage === "approve" && stageGate.visible && E(IconButton, { name: "check", color: C.teal, title: "Final Approve / Reject", onClick: stageGate.guard(() => setSigningKey(isSigningThisRow ? null : rowKey)) }),
        !held && stage === "release" && stageGate.visible && E(IconButton, { name: "printer", color: C.teal, title: "Release", onClick: stageGate.guard(doRelease) }),
        canEditRemark && E(IconButton, {
          name: "edit",
          color: currentManualRemark ? C.teal : C.muted,
          title: currentManualRemark ? "Edit reviewer remark" : "Add reviewer remark",
          onClick: stageGate.guard(() => setRemarkEditKey(isEditingRemarkThisRow ? null : rowKey))
        }),
        E(RowHoldReturnActions, { sample, testTypeId, testTypeName, session, notify, setSamples, setTestRecords, testRecords, size: "sm", stageGate })
      )
    )
  ));
  return E(React.Fragment, { key: rowKey },
    E("tr", { className: "border-t", style: { borderColor: C.border } }, cells),
    isEditingRemarkThisRow && E(RemarkEditRow, {
      key: `${rowKey}-remark`,
      manualRemark: currentManualRemark,
      colSpan: cells.length,
      onSave: handleManualRemarkChange,
      onClose: () => setRemarkEditKey(null)
    }),
    isSigningThisRow && E("tr", { key: `${rowKey}-sig` }, E("td", { colSpan: cells.length, className: "px-3 pb-2" },
      E(SignatureCapture, {
        user: session,
        label: `Final Approval — ${testTypeName} (${sample.sampleCode})`,
        onConfirm: payload => {
          if (!stageGate.allowed) {
            notify?.("Guest access can't approve results — this login is view-only for this action.", "warn");
            setSigningKey(null);
            return;
          }
          try {
            const result = bulkDecideParameter([sample], testTypeId, testTypeName, payload, session, testRecords, testTypes);
            const updatedList = result.updated;
            if (updatedList.length) {
              // ONE backend call — setSamples is inside .then() so the row
              // stays visible until the backend confirms the save.
              DataService.submitApprovalDecision(updatedList, { step: "approve", testTypeId }).then(stamped => {
                if (Array.isArray(stamped)) {
                  stamped.forEach(st => {
                    const orig = updatedList.find(u => u.id === st.id);
                    if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
                  });
                }
                setSamples(prev => {
                  const map = new Map(updatedList.map(u => [u.id, u]));
                  return prev.map(s => map.get(s.id) || s);
                }, null);
                notify?.(
                  payload.decision === "approved" ? `${sample.sampleCode} approved for ${testTypeName}.` : `${sample.sampleCode} sent back to analyst for ${testTypeName}.`,
                  payload.decision === "approved" ? "ok" : "warn"
                );
              }).catch(err => {
                console.error("Failed to save approved sample to backend:", err);
                notify?.(`Approval failed to save — please try again. (${err && err.message || err})`, "warn");
              });
            }
          } catch (e) {
            notify?.(e.message, "warn");
          }
          setSigningKey(null);
        }
      })
    ))
  );
}

// ---- Flat View: every row from every group, in one table, Test Type
// column included since there's no grouping header to imply it. ----
function FlatStageTable({ rows, stage, testRecords, testTypes, parameters, references, session, notify, setSamples, setTestRecords, goToSample, showSystemRemark, stageGate }) {
  const [signingKey, setSigningKey] = React.useState(null);
  const [remarkEditKey, setRemarkEditKey] = React.useState(null);
  const headers = ["Sample", "Client", "Reference", "Test Type", "Result", ...(showSystemRemark ? ["System Remark"] : []), "Actions"];
  const colWidths = ["12%", "14%", "14%", "13%", "15%", ...(showSystemRemark ? ["20%"] : []), "12%"];
  if (!rows.length) return E("div", { className: "text-xs p-3", style: { color: C.muted } }, "Nothing here right now.");
  return E("div", { className: "rounded-lg", style: { border: `1px solid ${C.border}` } },
    E("table", { className: "w-full text-left table-fixed" },
      E("colgroup", null, colWidths.map((w, i) => E("col", { key: i, style: { width: w } }))),
      E("thead", null, E("tr", null, headers.map(h =>
        E("th", { key: h, className: "px-2 py-1.5 text-[11px] font-semibold", style: { color: C.muted } }, h)
      ))),
      E("tbody", null, rows.map(row => E(StageRow, {
        key: `${row.sample.id}__${row.testTypeId}`, row, stage, testRecords, testTypes, parameters, references, session, notify,
        setSamples, setTestRecords, goToSample, showSystemRemark, showTestTypeColumn: true, signingKey, setSigningKey, remarkEditKey, setRemarkEditKey, stageGate
      })))
    )
  );
}

// ---- Analytical Batch View: rows nested under the Analytical Batch (or
// "Individual / No Batch") they came from, each section with its own
// batch-scoped bulk action (applies to every non-held row in that section
// only) alongside the same per-row actions Flat View has. ----
function BatchStageTable({ rows, stage, testRecords, subBatches, testTypes, parameters, references, session, notify, setSamples, setTestRecords, goToSample, showSystemRemark, stageGate }) {
  const [signingKey, setSigningKey] = React.useState(null);
  const [remarkEditKey, setRemarkEditKey] = React.useState(null);
  // Default: all buckets start collapsed so the reviewer sees a summary first
  const [collapsedBuckets, setCollapsedBuckets] = React.useState(() => {
    const init = {};
    // We'll populate on first render via useMemo below
    return init;
  });
  const [processingBuckets, setProcessingBuckets] = React.useState({});
  const [bucketsInitialized, setBucketsInitialized] = React.useState(false);
  const MIN_VISIBLE_WHEN_COLLAPSED = 3;
  const buckets = React.useMemo(() => groupRowsByBatch(rows, testRecords, subBatches), [rows, testRecords, subBatches]);
  // Collapse all buckets on first load
  React.useEffect(() => {
    if (!bucketsInitialized && buckets.length > 0) {
      const init = {};
      buckets.forEach(b => { if (b.rows.length > MIN_VISIBLE_WHEN_COLLAPSED) init[b.key] = true; });
      setCollapsedBuckets(init);
      setBucketsInitialized(true);
    }
  }, [buckets, bucketsInitialized]);
  return E("div", null,
    !buckets.length && E("div", { className: "text-xs p-3", style: { color: C.muted } }, "Nothing here right now."),
    buckets.map(bucket => {
      const activeSamples = bucket.rows.filter(r => !isTestOnHold(r.sample, r.testTypeId)).map(r => r.sample);
      const headers = ["Sample", "Client", "Reference", "Result", ...(showSystemRemark ? ["System Remark"] : []), "Actions"];
      const colWidths = ["14%", "16%", "16%", "17%", ...(showSystemRemark ? ["22%"] : []), "15%"];
      const isCollapsible = bucket.rows.length > MIN_VISIBLE_WHEN_COLLAPSED;
      const isCollapsed = isCollapsible && !!collapsedBuckets[bucket.key];
      // In collapsed mode all rows are shown inside a fixed-height scroll container;
      // in expanded mode the full table renders without any height cap.
      const visibleRows = bucket.rows;
      const hiddenCount = 0; // no rows hidden — scroll handles overflow
      const isProcessing = !!processingBuckets[bucket.key];
      // Collect all unique tracking / reference numbers for this batch's member samples
      const bucketTrackingNos = (() => {
        const tnSet = new Set();
        bucket.rows.forEach(r => {
          const s = r.sample;
          if (s && s.referenceId) {
            const ref = findReferenceById(references, s.referenceId);
            const tn = ref && (ref.trackingNo || ref.refNo);
            if (tn) tnSet.add(tn);
          }
        });
        return Array.from(tnSet).join(", ");
      })();
      const bucketTitle = bucketTrackingNos
        ? `${bucket.label} — ${bucket.testTypeName} [${bucketTrackingNos}]`
        : `${bucket.label} — ${bucket.testTypeName}`;
      function setIsProcessing(val) {
        setProcessingBuckets(prev => ({ ...prev, [bucket.key]: val }));
      }
      function toggleCollapse() {
        setCollapsedBuckets(prev => ({ ...prev, [bucket.key]: !prev[bucket.key] }));
      }
      async function doBulkMarkReviewed() {
        if (!stageGate.allowed || isProcessing) return;
        setIsProcessing(true);
        try {
          await bulkMarkReviewed(activeSamples, bucket.testTypeId, bucket.testTypeName, session, setSamples, notify);
        } catch (e) {} finally {
          setIsProcessing(false);
        }
      }
      async function doBulkRelease() {
        if (!stageGate.allowed || isProcessing) return;
        const result = bulkReleaseParameter(activeSamples, bucket.testTypeId, bucket.testTypeName, session);
        if (!result.updated.length) return;
        setIsProcessing(true);
        try {
          const stamped = await DataService.releaseResult(result.updated);
          if (Array.isArray(stamped)) {
            stamped.forEach(st => {
              const orig = result.updated.find(u => u.id === st.id);
              if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
            });
          }
          setSamples(prev => {
            const map = new Map(result.updated.map(u => [u.id, u]));
            return prev.map(s => map.get(s.id) || s);
          }, null);
          notify?.(`${result.updated.length} sample(s) released for ${bucket.testTypeName}.`, "ok");
        } catch(err) {
          console.error("Failed to save released samples to backend:", err);
          notify?.(`Release failed to save — please try again. (${err && err.message || err})`, "warn");
        } finally {
          setIsProcessing(false);
        }
      }
      const bucketSigningKey = `bucket__${bucket.key}`;
      const isBucketSigning = signingKey === bucketSigningKey;
      return E(SectionCard, {
        key: bucket.key,
        title: bucketTitle,
        className: "mb-3",
        right: isCollapsible && E("button", {
          type: "button",
          onClick: toggleCollapse,
          className: "flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded",
          style: { color: C.teal, border: `1px solid ${C.border}` }
        },
          E(Icon, { name: isCollapsed ? "chevronRight" : "chevronDown", size: 11 }),
          isCollapsed ? `Expand (${bucket.rows.length})` : "Collapse"
        )
      },
        E("div", { className: "text-[11px] mb-2", style: { color: C.muted } },
          `${bucket.rows.length} sample(s)${activeSamples.length !== bucket.rows.length ? ` · ${bucket.rows.length - activeSamples.length} on hold` : ""}`
        ),
        E("div", null,
          E("div", {
            style: {
              maxHeight: isCollapsed ? "260px" : "none",
              overflowY: isCollapsed ? "auto" : "visible",
              borderLeft: isCollapsed ? `3px solid ${C.teal}` : "none",
              paddingLeft: isCollapsed ? "6px" : 0,
              transition: "max-height 0.2s ease"
            }
          },
            E("table", { className: "w-full text-left table-fixed" },
            E("colgroup", null, colWidths.map((w, i) => E("col", { key: i, style: { width: w } }))),
            E("thead", null, E("tr", null, headers.map(h =>
              E("th", { key: h, className: "px-2 py-1.5 text-[11px] font-semibold", style: { color: C.muted } }, h)
            ))),
            E("tbody", null, visibleRows.map(row => E(StageRow, {
              key: `${row.sample.id}__${row.testTypeId}`, row, stage, testRecords, testTypes, parameters, references, session, notify,
              setSamples, setTestRecords, goToSample, showSystemRemark, showTestTypeColumn: false, signingKey, setSigningKey, remarkEditKey, setRemarkEditKey, stageGate
            })))
          )
          ) // close scrollable wrapper div
        ),
        activeSamples.length > 0 && E("div", { className: "flex flex-wrap gap-2 mt-2" },
          stage === "review" && stageGate.visible && E(Button, { size: "sm", disabled: isProcessing, onClick: stageGate.guard(doBulkMarkReviewed) }, isProcessing ? "Saving..." : E(React.Fragment, null, E(Icon, { name: "check", size: 12 }), `Mark Reviewed — whole batch (${activeSamples.length})`)),
          stage === "approve" && stageGate.visible && E(Button, { size: "sm", disabled: isProcessing, onClick: stageGate.guard(() => setSigningKey(isBucketSigning ? null : bucketSigningKey)) }, isProcessing ? "Saving..." : E(React.Fragment, null, E(Icon, { name: "check", size: 12 }), `Final Approve / Reject — whole batch (${activeSamples.length})`)),
          stage === "release" && stageGate.visible && E(Button, { size: "sm", disabled: isProcessing, onClick: stageGate.guard(doBulkRelease) }, isProcessing ? "Saving..." : E(React.Fragment, null, E(Icon, { name: "printer", size: 12 }), `Release — whole batch (${activeSamples.length})`))
        ),
        isBucketSigning && E(SignatureCapture, {
          user: session,
          label: `Final Approval — ${bucket.label} · ${bucket.testTypeName} (${activeSamples.length} sample(s))`,
          onConfirm: async payload => {
            if (!stageGate.allowed) {
              notify?.("Guest access can't approve results — this login is view-only for this action.", "warn");
              setSigningKey(null);
              return;
            }
            if (isProcessing) return;
            setIsProcessing(true);
            try {
              const result = bulkDecideParameter(activeSamples, bucket.testTypeId, bucket.testTypeName, payload, session, testRecords, testTypes);
              const updatedList = result.updated;
              if (updatedList.length) {
                const stamped = await DataService.submitApprovalDecision(updatedList, { step: "approve", testTypeId: bucket.testTypeId });
                if (Array.isArray(stamped)) {
                  stamped.forEach(st => {
                    const orig = updatedList.find(u => u.id === st.id);
                    if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
                  });
                }
                setSamples(prev => {
                  const map = new Map(updatedList.map(u => [u.id, u]));
                  return prev.map(s => map.get(s.id) || s);
                }, null);
                notify?.(
                  payload.decision === "approved" ? `${updatedList.length} sample(s) approved for ${bucket.testTypeName}.` : `${updatedList.length} sample(s) sent back to analyst for ${bucket.testTypeName}.`,
                  payload.decision === "approved" ? "ok" : "warn"
                );
              }
            } catch (err) {
              console.error("Failed to save approved samples to backend:", err);
              notify?.(`Approval failed to save — please try again. (${err && err.message || err})`, "warn");
            } finally {
              setIsProcessing(false);
              setSigningKey(null);
            }
          }
        })
      );
    })
  );
}

// ---- one queue's body: header + view toggle + Flat/Batch table. Shared by
// Review / Approve / Release so the toggle behaves identically in all
// three. ----
function StageQueueBody({ stage, groups, testRecords, subBatches, testTypes, parameters, references, session, notify, setSamples, setTestRecords, goToSample, showSystemRemark, emptyText, stageGate }) {
  const [viewMode, setViewMode] = React.useState("flat");
  const rows = React.useMemo(() => flattenStageGroups(groups), [groups]);
  if (!rows.length) return E("div", { className: "text-xs p-3", style: { color: C.muted } }, emptyText);
  return E("div", null,
    E("div", { className: "flex justify-end" }, E(StageViewToggle, { viewMode, setViewMode })),
    viewMode === "flat"
      ? E(FlatStageTable, { rows, stage, testRecords, testTypes, parameters, references, session, notify, setSamples, setTestRecords, goToSample, showSystemRemark, stageGate })
      : E(BatchStageTable, { rows, stage, testRecords, subBatches, testTypes, parameters, references, session, notify, setSamples, setTestRecords, goToSample, showSystemRemark, stageGate })
  );
}

// ---- Pending Upload queue: Sub-Batches ready to be tested, plus a note
// about individually-registered samples still needing entry. Actual result
// entry still happens in Add Test Record (13-testrecords-ui.js) — this
// queue's job is to surface what's waiting and jump straight into it
// preselected, not to reimplement the entry form. ----
function PendingUploadQueue({ subBatches, samples, testRecords, testTypes, references, goToTestEntry }) {
  const pendingSubBatches = (subBatches || []).filter(sb => sb.status === "pending");
  const individualPendingCount = (samples || []).filter(s =>
    pendingTestTypeIdsForSample(s, testRecords, subBatches).length > 0
  ).length;
  return E("div", null,
    E(SectionCard, {
      title: "Analytical Batches Ready for Testing",
      subtitle: "Created in Create Analytical Batch — pick one to enter results.",
      className: "mb-3"
    },
      pendingSubBatches.length === 0
        ? E("div", { className: "text-xs", style: { color: C.muted } }, "Nothing queued right now.")
        : E("div", { className: "space-y-2" }, pendingSubBatches.map(sb =>
            E("div", {
              key: sb.id,
              className: "flex items-center justify-between p-2 rounded",
              style: { border: `1px solid ${C.border}` }
            },
              E("div", null,
                E("div", { className: "text-xs font-semibold", style: { color: C.ink } }, sb.label),
                E("div", { className: "text-[11px]", style: { color: C.muted } },
                  sb.testTypeName, " · ", (sb.memberSampleIds || []).length, " sample(s)",
                  sb.assignedTester ? ` · Assigned: ${sb.assignedTester}` : ""
                ),
                (() => {
                  // Collect all unique tracking nos / ref nos from ALL member samples
                  const memberRefs = (sb.memberSampleIds || []).reduce((acc, sid) => {
                    const s = (samples || []).find(x => x.id === sid);
                    const ref = s?.referenceId ? findReferenceById(references, s.referenceId) : null;
                    if (ref && !acc.some(r => r.id === ref.id)) acc.push(ref);
                    return acc;
                  }, []);
                  const trackingLabels = memberRefs.map(ref =>
                    ref.trackingNo || ref.refNo || referenceDisplayLabel(ref)
                  ).filter(Boolean);
                  return E("div", {
                    className: "text-[11px] px-1.5 py-0.5 rounded font-mono mt-1 inline-block",
                    style: { background: C.bg, color: C.muted },
                    title: "Linked Reference / Tracking Nos."
                  }, trackingLabels.length
                    ? (trackingLabels.length === 1
                        ? "Ref: " + trackingLabels[0]
                        : "Refs: " + trackingLabels.join(" · "))
                    : "(no reference linked)"
                  );
                })()

              ),
              E("div", { className: "flex items-center gap-2" },
                E(Button, { size: "sm", onClick: () => goToTestEntry?.(sb.id) },
                  E(Icon, { name: "upload", size: 12 }), "Enter Individual Result"
                ),
                E(Button, { size: "sm", variant: "outline", onClick: () => goToTestEntry?.(sb.id) },
                  E(Icon, { name: "download", size: 12 }), "Bulk Upload"
                )
              )
            )
          ))
    ),
    individualPendingCount > 0 && E(SectionCard, {
      title: "Individually-Pending Samples",
      subtitle: `${individualPendingCount} sample(s) still need at least one parameter tested and aren't in a batch yet.`
    },
      E(Button, { size: "sm", variant: "outline", onClick: () => goToTestEntry?.(null) },
        E(Icon, { name: "flask", size: 12 }), "Open Add Test Record"
      )
    )
  );
}

function ReviewQueue({ samples, setSamples, testRecords, setTestRecords, subBatches, testTypes, parameters, references, session, notify, goToSample, stageGate }) {
  const groups = React.useMemo(() => groupSamplesByParamStage(samples, "results_entered"), [samples]);
  const qcWarnings = groups.map(g => {
    const qc = getQcStatusForMethod(g.testTypeId, testTypes, testRecords);
    if (qc.hasReject) return `${g.testTypeName}: Westgard violation on recent QC runs — check QC Module before reviewing.`;
    if (qc.hasWarning) return `${g.testTypeName}: QC warning pattern on recent runs — check QC Module before reviewing.`;
    return null;
  }).filter(Boolean);
  return E("div", null,
    qcWarnings.map((w, i) => E("div", {
      key: i,
      className: "text-[11px] px-2 py-1.5 rounded mb-2 flex items-center gap-1.5",
      style: { background: C.warnBg, color: C.warn }
    }, E(Icon, { name: "warning", size: 12 }), w)),
    E(StageQueueBody, {
      stage: "review", groups, testRecords, setTestRecords, subBatches, testTypes, parameters, references, session, notify, setSamples, goToSample, stageGate,
      showSystemRemark: true,
      emptyText: "No parameters awaiting review right now."
    })
  );
}

function ApproveQueue({ samples, setSamples, testRecords, setTestRecords, subBatches, testTypes, parameters, references, session, notify, goToSample, stageGate }) {
  const groups = React.useMemo(() => groupSamplesByParamStage(samples, "under_review"), [samples]);
  return E(StageQueueBody, {
    stage: "approve", groups, testRecords, setTestRecords, subBatches, testTypes, parameters, references, session, notify, setSamples, goToSample, stageGate,
    showSystemRemark: true,
    emptyText: "No parameters awaiting final approval right now."
  });
}

function ReleaseQueue({ samples, setSamples, testRecords, setTestRecords, subBatches, testTypes, parameters, references, session, notify, goToSample, stageGate }) {
  const groups = React.useMemo(() => groupSamplesByParamStage(samples, "approved"), [samples]);
  return E(StageQueueBody, {
    stage: "release", groups, testRecords, setTestRecords, subBatches, testTypes, parameters, references, session, notify, setSamples, goToSample, stageGate,
    showSystemRemark: false,
    emptyText: "Nothing approved and awaiting release right now."
  });
}

// ---- main tab ----
function ResultsWorkflowTab({
  samples,
  setSamples,
  subBatches,
  setSubBatches,
  references,
  testTypes,
  testRecords,
  setTestRecords,
  parameters,
  session,
  permissionMatrix,
  notify,
  goToTestEntry,
  goToSample,
  focusStage,
  setFocusStage
}) {
  const perms = permissionsFor(permissionMatrix, session);
  const isGuestUser = session?.role === "Guest";
  const reviewGate = sampleActionGate(perms, "canReview", session, notify, "review results");
  const approveGate = sampleActionGate(perms, "canApprove", session, notify, "approve results");
  const releaseGate = sampleActionGate(perms, "canRelease", session, notify, "release results");
  const stageDefs = [
    { k: "upload", label: "Upload Results", icon: "upload", show: !!perms.canEnterResults || isGuestUser },
    { k: "review", label: "Awaiting Review", icon: "search", show: !!perms.canReview || isGuestUser },
    { k: "approve", label: "Awaiting Approval", icon: "check", show: !!perms.canApprove || isGuestUser },
    { k: "release", label: "Approved — Release", icon: "printer", show: !!perms.canRelease || isGuestUser }
  ];
  const visible = stageDefs.filter(s => s.show);
  // Same controlled-if-provided pattern as focusSamplesSubTab (21-sample-ui.js):
  // the sidebar nav can deep-link straight into a stage (tier-3 of the
  // cascading menu); otherwise this tab manages its own tab-switching as
  // it always has.
  const [internalActive, setInternalActive] = React.useState(visible[0]?.k || null);
  const active = focusStage !== undefined && focusStage !== null ? focusStage : internalActive;
  const setActive = setFocusStage || setInternalActive;
  React.useEffect(() => {
    if (!visible.some(s => s.k === active)) setActive(visible[0]?.k || null);
    // eslint-disable-next-line
  }, [session.role]);

  if (!visible.length) {
    return E("div", { className: "text-sm p-6 text-center", style: { color: C.muted } },
      "Your role (", session.role, ") isn't permissioned for any step in the Results Workflow."
    );
  }

  return E("div", null,
    E("div", { className: "mb-3" },
      E("h2", { className: "text-base font-bold", style: { color: C.ink } }, "Results Workflow"),
      E("div", { className: "text-xs mt-0.5", style: { color: C.muted } },
        "Upload → Review → Approve → Release — one place, filtered to what your role can act on."
      )
    ),
    E("div", { className: "flex gap-2 mb-4 flex-wrap" }, visible.map(s =>
      E("button", {
        key: s.k,
        onClick: () => setActive(s.k),
        className: "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium",
        style: {
          background: active === s.k ? C.teal : "#fff",
          color: active === s.k ? "#fff" : C.muted,
          border: `1px solid ${active === s.k ? C.teal : C.border}`
        }
      }, E(Icon, { name: s.icon, size: 14 }), s.label)
    )),
    active === "upload" && E(PendingUploadQueue, { subBatches, samples, testRecords, testTypes, references, goToTestEntry }),
    active === "review" && E(ReviewQueue, { samples, setSamples, testRecords, setTestRecords, subBatches, testTypes, parameters, references, session, notify, goToSample, stageGate: reviewGate }),
    active === "approve" && E(ApproveQueue, { samples, setSamples, testRecords, setTestRecords, subBatches, testTypes, parameters, references, session, notify, goToSample, stageGate: approveGate }),
    active === "release" && E(ReleaseQueue, { samples, setSamples, testRecords, setTestRecords, subBatches, testTypes, parameters, references, session, notify, goToSample, stageGate: releaseGate }),
    E(ScrollTopBottomButtons)
  );
}

