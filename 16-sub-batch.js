// ===== 16-sub-batch.js =====
// ============================================================================
// SUB-BATCH — a persistent grouping of pending samples (typically 15-20) that
// will be tested together for one method, sharing one QC check. A Sub-Batch
// is created from the Samples tab ("Sub-Batches" sub-view) but the actual
// testing — results, QC, and inventory deduction — happens in Add Test
// Record, which can consume a Sub-Batch instead of a single Sample.
//
// A Sub-Batch's members can come from different registration batches
// (different `batchRef`s) — that's fine, since reporting is done by
// filtering Samples on their own `batchRef`, independent of which Sub-Batch
// tested them. See getSampleResultForTest() below and the Report Generator's
// "Filter by Batch Ref" control in 17-report-generator.js.
// ============================================================================

// Superseded by pendingTestTypeIdsForSample() below — a sample's single
// overall `status` can't represent "which of its several requested
// parameters still need testing", so eligibility is now computed per
// (sample, testTypeId) pair instead. Kept here only in case older code
// elsewhere still imports it; do not use for new eligibility checks.
const SUBBATCH_ELIGIBLE_STATUSES = ["registered", "received", "assigned", "in_progress"];
// Generates a human-friendly "Analytical Batch No" like SB-Tracking-001, -002, -003 …
// The counter is global (not year-scoped) so the number always grows and is
// unambiguous even across fiscal-year boundaries.
function generateSubBatchLabel(existingSubBatches) {
  const all = (existingSubBatches || []);
  // Match both the new SB-Tracking-NNN format and the legacy SB-YEAR-NNNN format
  const nums = all.map(sb => {
    const m = (sb.label || "").match(/SB-Tracking-(\d+)$/i)
           || (sb.label || "").match(/SB-\d{4}-(\d+)$/);
    return m ? (Number(m[1]) || 0) : 0;
  });
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SB-Tracking-${String(next).padStart(3, "0")}`;
}

function createSubBatch(fields, existingSubBatches) {
  return {
    id: uid("sb"),
    label: fields.label || generateSubBatchLabel(existingSubBatches),
    testTypeId: fields.testTypeId,
    testTypeName: fields.testTypeName,
    memberSampleIds: fields.memberSampleIds || [],
    assignedTester: fields.assignedTester || "",
    status: "pending",
    // pending -> tested (Add Test Record flips this on save)
    testRecordId: null,
    createdAt: new Date().toISOString()
  };
}

// Shared lookup used by the QC Module banner, Sample review, and the Report
// Generator: find a sample's result for a given test, whether it came from a
// single Add Test Record entry (sampleId set directly) or from inside a
// Sub-Batch's memberResults (memberSampleIds + memberResults).
function getSampleResultForTest(sample, testTypeId, testRecords) {
  // BUGFIX (see test-retest-attempts.js): must scan EVERY matching test
  // record, not stop at the first one found. A sample that was Returned to
  // Analyst and retested in a NEW Analytical Batch ends up referenced by
  // TWO records for the same testTypeId — the old one (this sample's own
  // member entry voided, but the record itself still active for its OTHER
  // members) and the new one (this sample's entry valid). The old record
  // is very often earlier in the array (created first), so a plain
  // `.find()` that stops at the first record containing this sample would
  // land on the OLD, voided-for-this-sample record and incorrectly report
  // "no result" — even though the retest's result exists in a later
  // record. That made retested samples wrongly look un-tested again
  // (reappearing in Add Test Record / pending queues via
  // isTestDoneForSample below) with no result value shown, especially
  // once the old batch got released after the retest batch. Collecting
  // every valid (non-voided, for THIS sample) candidate and picking the
  // most recent attempt avoids that entirely.
  const candidates = [];
  (testRecords || []).forEach(r => {
    if (r.testTypeId !== testTypeId) return;
    if (r.sampleId === sample.id) {
      if (!r.voided) candidates.push({
        results: r.results || [],
        recordId: r.id,
        date: r.date,
        source: "single",
        attemptNo: r.attemptNo || 1
      });
      return;
    }
    if (r.voided || !Array.isArray(r.memberSampleIds) || !r.memberSampleIds.includes(sample.id)) return;
    const member = (r.memberResults || []).find(m => m.sampleId === sample.id && !m.voided);
    if (member) candidates.push({
      results: member.results || [],
      recordId: r.id,
      date: r.date,
      source: "subBatch",
      attemptNo: member.attemptNo || r.attemptNo || 1
    });
  });
  if (!candidates.length) return null;
  // Only one candidate should normally exist at a time (voiding retires
  // the previous attempt) — but if more than one is ever found, the most
  // recent attempt (highest attemptNo, tie-broken by date) wins rather than
  // whichever happened to be inserted first.
  candidates.sort((a, b) => (b.attemptNo || 0) - (a.attemptNo || 0) || new Date(b.date || 0) - new Date(a.date || 0));
  const best = candidates[0];
  delete best.attemptNo;
  return best;
}

// "Return to Analyst" (Results Workflow) needs this specific sample's result
// to stop counting as done — WITHOUT touching any other member sample in
// the same test record/batch. Rather than deleting anything (keep the full
// audit trail intact), this just flags that one sample's entry as voided;
// getSampleResultForTest above then treats it exactly like "no result yet",
// so pendingTestTypeIdsForSample sees this parameter as pending again and
// the sample becomes eligible for a brand-new Analytical Batch — every
// other member of the original batch is untouched and keeps progressing.
function voidSampleResultForTest(testRecords, sample, testTypeId) {
  const info = getSampleResultForTest(sample, testTypeId, testRecords);
  if (!info) return testRecords;
  return (testRecords || []).map(r => {
    if (r.id !== info.recordId) return r;
    if (Array.isArray(r.memberResults)) {
      return {
        ...r,
        memberResults: r.memberResults.map(m => m.sampleId === sample.id ? { ...m, voided: true } : m)
      };
    }
    if (r.sampleId === sample.id) return { ...r, voided: true };
    return r;
  });
}

// ============================================================================
// RETEST/ATTEMPT HISTORY (Workflow/Data-Integrity Upgrade Step 4) — figures
// out this sample's attempt number for a given test type by walking
// sample.returnEvents[] (populated by returnRequestedTestToAnalyst — see
// 20-sample-model.js — for BOTH the Return to Analyst action and Void/
// Invalidate, since Void reuses that same function). The most recent return
// event for this testTypeId points at the Test Record it voided
// (testRecordId); that record's own attemptNo (or its per-member attemptNo,
// for a Sub-Batch/batch record) tells us what number THIS new attempt
// becomes. A sample with no such event is always attempt #1 — no attempt
// tracking to do, no reason required.
//
// NOTE: attempt numbers are never re-derived from testRecords alone —
// returnEvents on the sample is the source of truth for "was there a prior
// attempt". This keeps a voided/superseded Test Record fully inert for
// every OTHER purpose (reports, eligibility — see getSampleResultForTest
// above) while still being reachable here specifically for its attempt
// history.
// ============================================================================
function computeAttemptInfo(sample, testTypeId, testRecords) {
  const events = (sample.returnEvents || []).filter(e => e.testTypeId === testTypeId && e.testRecordId);
  if (!events.length) return {
    attemptNo: 1,
    previousTestRecordId: null
  };
  const lastEvent = events[events.length - 1];
  const prevRecord = (testRecords || []).find(r => r.id === lastEvent.testRecordId);
  let prevAttemptNo = 1;
  if (prevRecord) {
    if (Array.isArray(prevRecord.memberResults)) {
      const prevMember = prevRecord.memberResults.find(m => m.sampleId === sample.id);
      prevAttemptNo = prevMember?.attemptNo || prevRecord.attemptNo || 1;
    } else {
      prevAttemptNo = prevRecord.attemptNo || 1;
    }
  }
  return {
    attemptNo: prevAttemptNo + 1,
    previousTestRecordId: lastEvent.testRecordId
  };
}

// Which Analytical Batch (or "Individual / No Batch") a (sample, testTypeId)
// pair's current result came from — drives the Results Workflow's
// "Analytical Batch View", the same grouping concept as Sample
// Registration's "Group by Batch", just keyed off the test record's
// subBatchId instead of the sample's Reference.
function originBatchForSampleTest(sample, testTypeId, testRecords, subBatches) {
  const info = getSampleResultForTest(sample, testTypeId, testRecords);
  const rec = info ? (testRecords || []).find(r => r.id === info.recordId) : null;
  if (rec && rec.subBatchId) {
    const sb = (subBatches || []).find(b => b.id === rec.subBatchId);
    return {
      key: rec.subBatchId,
      label: sb ? sb.label : rec.subBatchLabel || "Analytical Batch"
    };
  }
  return {
    key: `indiv-${testTypeId}`,
    label: "Individual / No Batch"
  };
}

// ============================================================================
// PER-PARAMETER ELIGIBILITY — a sample with several requestedTests does NOT
// move through those tests in lockstep. "Batch shows up for every parameter
// it still needs, until Add Test Record is saved for that specific
// parameter" — so eligibility must be computed per (sample, testTypeId)
// pair, never off the sample's single `status` field. `status` still gates
// whether the sample can be tested AT ALL right now (on_hold/rejected/
// cancelled), it just can't tell you WHICH parameters remain.
// ============================================================================

// Custody-level gate: blocked from any testing regardless of parameter.
function sampleBlockedFromTesting(sample) {
  return ["on_hold", "rejected", "cancelled"].includes(sample.status);
}

// Has this one requested parameter already produced a result for this
// sample — single Add Test Record entry OR inside a Sub-Batch's
// memberResults? (Done = no longer eligible for anything, anywhere.)
function isTestDoneForSample(sample, testTypeId, testRecords) {
  return !!getSampleResultForTest(sample, testTypeId, testRecords);
}

// Is this parameter already committed to a pending (not-yet-tested)
// Sub-Batch for THIS sample? (Queued = don't offer it again for a second
// sub-batch or a standalone record — but only for this parameter, other
// parameters on the same sample are untouched.)
function isTestQueuedForSample(sample, testTypeId, subBatches) {
  return (subBatches || []).some(sb => sb.status === "pending" && sb.testTypeId === testTypeId && sb.memberSampleIds.includes(sample.id));
}

// The parameters this sample still genuinely needs run: requested, not yet
// resulted, not already queued (unless includeQueued is asked for, e.g. to
// show "committed" state in a status chip). This — not sample.status — is
// what should drive every "pending work" list in the app.
function pendingTestTypeIdsForSample(sample, testRecords, subBatches, {
  includeQueued = false
} = {}) {
  if (sampleBlockedFromTesting(sample)) return [];
  return (sample.requestedTests || []).map(rt => rt.testTypeId).filter(tid => !isTestDoneForSample(sample, tid, testRecords)).filter(tid => includeQueued || !isTestQueuedForSample(sample, tid, subBatches));
}

// Per-parameter status for display: "done" | "queued" | "pending" | "blocked".
// Drives the Requested Tests chips on Sample Detail so the per-parameter
// state is visible, not just correct in the background.
function testStatusForSample(sample, testTypeId, testRecords, subBatches) {
  if (isTestDoneForSample(sample, testTypeId, testRecords)) return "done";
  if (sampleBlockedFromTesting(sample)) return "blocked";
  if (isTestQueuedForSample(sample, testTypeId, subBatches)) return "queued";
  return "pending";
}

// ---- richer per-parameter STAGE (Phase 2) -------------------------------
// testStatusForSample() above answers "is this parameter's result in yet?"
// (done/queued/pending/blocked). This answers the fuller question: "where
// is this parameter in the whole pipeline right now?" — pending / assigned
// / in_progress / results_entered / under_review / approved / released.
//
// IMPORTANT — what's genuinely per-parameter vs. still whole-sample:
//   - Whether a result exists (done vs. not) IS tracked per (sample,
//     testType) pair — that part is fully accurate per parameter.
//   - Review / Approve / Release are still single decisions made on the
//     whole Sample today (one set of buttons in Sample Detail, matching
//     how reviewers actually work through a sample) — rebuilding those to
//     fire per-parameter would mean reworking the Review/Approve UI itself,
//     which is a separate, bigger change from "can I see per-parameter
//     status" (this function's job). So once a sample is formally moved to
//     under_review/approved/released, every one of its RESULTED parameters
//     is shown at that same stage — an un-resulted parameter never jumps
//     ahead of "results_entered" even if the sample itself has been pushed
//     further, since a result can't be reviewed/approved before it exists.
const TEST_STAGE_ORDER = ["pending", "in_progress", "results_entered", "under_review", "approved", "released"];
function testStageForSample(sample, testTypeId, testRecords, subBatches) {
  if (sampleBlockedFromTesting(sample)) return "blocked";
  const target = (sample.requestedTests || []).find(rt => rt.testTypeId === testTypeId);
  // Phase 3: requestedTests[].status is the real, stored source of truth —
  // just read it. Fall back to the old derived logic only for data that
  // predates Phase 3 (a requestedTest with no `status` field yet).
  if (target && target.status) return target.status;
  const basic = testStatusForSample(sample, testTypeId, testRecords, subBatches);
  if (basic === "pending") return "pending";
  if (basic === "queued") return "in_progress";
  return ["results_entered", "under_review", "approved", "released"].includes(sample.status) ? sample.status : "results_entered";
}
function testStageLabel(stage) {
  return {
    pending: "Pending",
    queued: "In Progress",
    in_progress: "In Progress",
    results_entered: "Result Entered",
    under_review: "Under Review",
    approved: "Approved",
    released: "Released",
    blocked: "On Hold"
  }[stage] || stage;
}
function testStageChipStyle(stage) {
  return {
    released: {
      bg: `${C.ok}1A`,
      fg: C.ok
    },
    approved: {
      bg: `${C.ok}1A`,
      fg: C.ok
    },
    under_review: {
      bg: `${C.info}1A`,
      fg: C.info
    },
    results_entered: {
      bg: `${C.info}1A`,
      fg: C.info
    },
    in_progress: {
      bg: `${C.teal}1A`,
      fg: C.tealDark
    },
    pending: {
      bg: `${C.teal}1A`,
      fg: C.tealDark
    },
    blocked: {
      bg: `${C.muted}1A`,
      fg: C.muted
    }
  }[stage] || {
    bg: `${C.muted}1A`,
    fg: C.muted
  };
}

// ---- effectiveSubBatchStatus(): sb.status (pending/tested/reviewed/
// approved/released) is only ever "purely a display convenience" — the
// real state lives per-member on each sample's requestedTests[] (see
// testStageForSample() above). bulkApproveSubBatch/bulkReleaseSubBatch
// below only ever WROTE sb.status forward when every single member moved
// together in that one action; any member decided a different way — a
// per-row Approve/Release button in Results Workflow (see StageRow's
// doRelease() in 22-results-workflow-ui.js, which updates the sample but
// never touches subBatches at all), a partially-skipped bulk action, or a
// member returned/re-queued out of step with its batch-mates — left
// sb.status stuck at whatever it was, so a fully-released batch could go
// on showing "Awaiting Review" (or an earlier stage) forever in the "All
// Analytical Batches" table. This recomputes the batch's DISPLAY status
// from its members' real, current per-parameter stage every time it's
// shown, so the badge can never drift out of sync with reality — sb.status
// itself is left alone (it's still used elsewhere to gate Edit/Delete on
// "still pending", which is a different, narrower question this doesn't
// touch).
function effectiveSubBatchStatus(sb, samples, testRecords, subBatches) {
  if (!sb || sb.status === "pending") return sb ? sb.status : "pending";
  const members = (sb.memberSampleIds || []).map(id => (samples || []).find(s => s.id === id)).filter(Boolean);
  if (!members.length) return sb.status;
  const stages = members.map(s => testStageForSample(s, sb.testTypeId, testRecords, subBatches));
  // A member currently "On Hold" (blocked) doesn't represent real forward
  // progress on this parameter, so it's ignored for the aggregate unless
  // EVERY member is on hold (then there's nothing else to go on).
  const usable = stages.filter(st => st !== "blocked");
  const pool = usable.length ? usable : stages;
  const idxOf = st => {
    const i = TEST_STAGE_ORDER.indexOf(st);
    return i === -1 ? 0 : i;
  };
  // The batch as a whole is only as far along as its LEAST advanced member
  // — one sample still awaiting review means the batch isn't "Released" yet.
  const leastAdvanced = pool.reduce((min, st) => idxOf(st) < idxOf(min) ? st : min, pool[0]);
  const STAGE_TO_BATCH_STATUS = {
    pending: "tested",
    in_progress: "tested",
    results_entered: "tested",
    under_review: "reviewed",
    approved: "approved",
    released: "released"
  };
  return STAGE_TO_BATCH_STATUS[leastAdvanced] || sb.status;
}

// ---- migration: samples registered before Phase 3 have requestedTests
// with no `status` field. Backfill it once from the same derivation logic
// testStageForSample() used to fall back on, so every sample ends up with
// real, stored per-parameter status going forward. Idempotent — a
// requestedTest that already has a status is left untouched. ----
function backfillRequestedTestStatuses(samples, testRecords, subBatches) {
  return (samples || []).map(sample => {
    if ((sample.requestedTests || []).every(rt => rt.status)) return sample;
    return {
      ...sample,
      requestedTests: (sample.requestedTests || []).map(rt => {
        if (rt.status) return rt;
        const basic = testStatusForSample(sample, rt.testTypeId, testRecords, subBatches);
        let status;
        if (basic === "pending") status = "pending";else if (basic === "queued") status = "in_progress";else if (basic === "blocked") status = "pending"; // blocked is a custody overlay, not a real stage
        else status = ["results_entered", "under_review", "approved", "released"].includes(sample.status) ? sample.status : "results_entered";
        return {
          ...rt,
          status
        };
      })
    };
  });
}

// ============================================================================
// SHARED SUB-BATCH REVIEW ACTIONS — used by both the Sub-Batch Builder's
// review queue and the Test Records list (so a reviewer can act right where
// they're looking at the actual readings, not have to go find the Sub-Batch
// screen). Bulk-moves the ONE parameter this Sub-Batch represents
// (results_entered -> under_review, or back to in_progress) for every
// member sample, via setRequestedTestStatus — final Approval/Release stay
// on the signature-gated flow, unaffected (see 20-sample-model.js).
// ============================================================================
function reviewSubBatchApprove(sb, samples, setSamples, setSubBatches, session, notify) {
  if (!setSamples || !sb) return;
  const updatedList = [];
  (sb.memberSampleIds || []).forEach(id => {
    const member = (samples || []).find(s => s.id === id);
    if (!member) return;
    const rt = (member.requestedTests || []).find(r => r.testTypeId === sb.testTypeId);
    if (!rt || rt.status !== "results_entered") return;
    const updated = setRequestedTestStatus(member, sb.testTypeId, "under_review", session);
    updatedList.push(updated);
  });
  
  if (updatedList.length > 0) {
    // Single state update for all samples
    setSamples(prev => {
      const map = new Map(updatedList.map(u => [u.id, u]));
      return prev.map(s => map.get(s.id) || s);
    }, null);
    DataService.submitApprovalDecision(updatedList, { step: "review" }).then(stamped => {
      if (Array.isArray(stamped)) {
        stamped.forEach(st => {
          const orig = updatedList.find(u => u.id === st.id);
          if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
        });
      }
    }).catch(err => {
      console.error("Failed to persist samples to backend:", err);
      notify?.("Changes applied locally but backend save failed — reload to re-check.", "warn");
    });
    DataService.appendAudit({
      entity: "subBatch",
      entityId: sb.id,
      action: "review",
      note: `Marked ${updatedList.length} sample(s) reviewed for ${sb.testTypeName}.`
    });
  }

  setSubBatches(prev => prev.map(x => x.id === sb.id ? {
    ...x,
    status: "reviewed"
  } : x));
  notify?.(`${sb.label} marked reviewed — ${(sb.memberSampleIds || []).length} sample(s) ready for final approval on ${sb.testTypeName}.`, "ok");
}
// NOTE: not currently wired into any screen — the live "Return to Analyst"
// path is the per-row action in 22-results-workflow-ui.js's
// RowHoldReturnActions. Kept here (and kept CORRECT/up to date, per the
// "one authoritative implementation" rule — see returnRequestedTestToAnalyst
// in 20-sample-model.js) in case a future "bulk return this whole
// Analytical Batch" UI wants it, so it isn't a second, silently-diverging
// copy of the same business logic waiting to bite whoever eventually wires
// it up. `reason` is REQUIRED, same as the per-row action.
function reviewSubBatchReturn(sb, samples, setSamples, setSubBatches, testRecords, setTestRecords, session, notify, reason) {
  if (!setSamples || !sb) return;
  const trimmedReason = (reason || "").trim();
  if (!trimmedReason) {
    notify?.("A reason is required to return a batch to the analyst.", "warn");
    return;
  }
  const updatedList = [];
  const auditEntries = [];
  let workingRecords = testRecords;
  (sb.memberSampleIds || []).forEach(id => {
    const member = (samples || []).find(s => s.id === id);
    if (!member) return;
    const rt = (member.requestedTests || []).find(r => r.testTypeId === sb.testTypeId);
    if (!rt || !["results_entered", "under_review"].includes(rt.status)) return;
    const resultInfo = getSampleResultForTest(member, sb.testTypeId, workingRecords);
    workingRecords = voidSampleResultForTest(workingRecords, member, sb.testTypeId);
    const updated = returnRequestedTestToAnalyst(member, sb.testTypeId, sb.testTypeName, session, trimmedReason, {
      previousResult: resultInfo?.results ?? null,
      testRecordId: resultInfo?.recordId ?? null
    });
    if (updated === member) return; // shouldn't happen (reason already validated above), but never persist a no-op
    updatedList.push(updated);
    auditEntries.push({
      eventType: "RESULT_RETURNED",
      entityType: "requestedTest",
      entityId: `${member.id}:${sb.testTypeId}`,
      sampleId: member.id,
      sampleCode: member.sampleCode,
      testTypeId: sb.testTypeId,
      testTypeName: sb.testTypeName,
      testRecordId: resultInfo?.recordId ?? null,
      performedBy: session?.name,
      role: session?.role,
      reason: trimmedReason,
      previousValue: rt.status,
      newValue: "in_progress",
      entity: "sample",
      action: "return_to_analyst",
      note: `Returned to analyst (via Sub-Batch "${sb.label}") for ${sb.testTypeName}: ${trimmedReason}`
    });
  });
  if (workingRecords !== testRecords) setTestRecords?.(workingRecords);
  if (updatedList.length > 0) {
    // Single state update for all samples
    setSamples(prev => {
      const map = new Map(updatedList.map(u => [u.id, u]));
      return prev.map(s => map.get(s.id) || s);
    }, null);
    DataService.returnToAnalyst(updatedList).then(stamped => {
      if (Array.isArray(stamped)) {
        stamped.forEach(st => {
          const orig = updatedList.find(u => u.id === st.id);
          if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
        });
      }
    }).catch(err => {
      console.error("Failed to persist samples to backend:", err);
      notify?.("Changes applied locally but backend save failed — reload to re-check.", "warn");
    });
    DataService.bulkAppendAudit(auditEntries).catch(err => console.error("Audit log write failed (non-fatal):", err));
  }

  setSubBatches(prev => prev.map(x => x.id === sb.id ? {
    ...x,
    status: "pending"
  } : x));
  notify?.(`${sb.label} returned to analyst.`, "warn");
}

// Shared final-approve wrapper for a Sub-Batch — one signature approves
// every member currently under_review for this Sub-Batch's parameter.
// Skipped members (already decided some other way) are silently left
// alone; if every member got approved, the Sub-Batch itself is marked
// "approved" too (purely a display convenience — the real state lives on
// each sample's requestedTests[]).
function bulkApproveSubBatch(sb, samples, setSamples, setSubBatches, session, notify, signaturePayload) {
  const members = (sb.memberSampleIds || []).map(id => (samples || []).find(s => s.id === id)).filter(Boolean);
  let result;
  try {
    result = bulkDecideParameter(members, sb.testTypeId, sb.testTypeName, signaturePayload, session);
  } catch (e) {
    notify?.(e.message, "warn");
    return;
  }
  if (result.updated.length > 0) {
    // Single state update for all samples
    setSamples(prev => {
      const map = new Map(result.updated.map(u => [u.id, u]));
      return prev.map(s => map.get(s.id) || s);
    }, null);

    DataService.submitApprovalDecision(result.updated, { step: "approve" }).then(stamped => {
      if (Array.isArray(stamped)) {
        stamped.forEach(st => {
          const orig = result.updated.find(u => u.id === st.id);
          if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
        });
      }
    }).catch(err => {
      console.error("Failed to persist samples to backend:", err);
      notify?.("Changes applied locally but backend save failed — reload to re-check.", "warn");
    });
    const actionDesc = signaturePayload.decision === "approved" ? "approved" : "sent back to analyst";
    DataService.appendAudit({
      entity: "subBatch",
      entityId: sb.id,
      action: signaturePayload.decision === "approved" ? "approve" : "reject",
      note: `${result.updated.length} sample(s) ${actionDesc} for ${sb.testTypeName}.`
    });
  }
  if (signaturePayload.decision === "approved") {
    if (result.updated.length > 0) {
      // Recompute from the members' real post-update stage rather than only
      // flipping to "approved" when every member moved together — a batch
      // with even one member still skipped (already decided some other way)
      // used to leave sb.status frozen at its old value forever. See
      // effectiveSubBatchStatus() above for why this is the source of truth.
      const mergedSamples = samples.map(s => result.updated.find(u => u.id === s.id) || s);
      const nextStatus = effectiveSubBatchStatus(sb, mergedSamples, [], []);
      setSubBatches(prev => prev.map(x => x.id === sb.id ? {
        ...x,
        status: nextStatus
      } : x));
    }
    notify?.(`${result.updated.length} sample(s) approved for ${sb.testTypeName}${result.skipped ? ` (${result.skipped} skipped — not awaiting approval)` : ""}.`, "ok");
  } else {
    setSubBatches(prev => prev.map(x => x.id === sb.id ? {
      ...x,
      status: "pending"
    } : x));
    notify?.(`${result.updated.length} sample(s) sent back to analyst for ${sb.testTypeName}.`, "warn");
  }
}

// Shared bulk-release wrapper for a Sub-Batch — releases every member
// currently "approved" for this Sub-Batch's parameter, marking the
// Sub-Batch itself "released" for display if every member made it.
function bulkReleaseSubBatch(sb, samples, setSamples, setSubBatches, session, notify, note) {
  const members = (sb.memberSampleIds || []).map(id => (samples || []).find(s => s.id === id)).filter(Boolean);
  const result = bulkReleaseParameter(members, sb.testTypeId, sb.testTypeName, session, note);
  if (result.updated.length > 0) {
    // Single state update for all samples
    setSamples(prev => {
      const map = new Map(result.updated.map(u => [u.id, u]));
      return prev.map(s => map.get(s.id) || s);
    }, null);

    DataService.releaseResult(result.updated).then(stamped => {
      if (Array.isArray(stamped)) {
        stamped.forEach(st => {
          const orig = result.updated.find(u => u.id === st.id);
          if (orig) { orig._version = st._version; orig.updatedAt = st.updatedAt; }
        });
      }
    }).catch(err => {
      console.error("Failed to persist samples to backend:", err);
      notify?.("Changes applied locally but backend save failed — reload to re-check.", "warn");
    });
    DataService.appendAudit({
      entity: "subBatch",
      entityId: sb.id,
      action: "release",
      note: `Released ${result.updated.length} sample(s) for ${sb.testTypeName}.`
    });
  }
  if (result.updated.length > 0) {
    // Same recompute-from-reality fix as bulkApproveSubBatch above — only
    // marking "released" when result.skipped === 0 left sb.status stuck
    // (e.g. at "reviewed"/"Awaiting Review") any time a member had already
    // been released some other way (a per-row Release in Results Workflow)
    // before this batch-level action ran.
    const mergedSamples = samples.map(s => result.updated.find(u => u.id === s.id) || s);
    const nextStatus = effectiveSubBatchStatus(sb, mergedSamples, [], []);
    setSubBatches(prev => prev.map(x => x.id === sb.id ? {
      ...x,
      status: nextStatus
    } : x));
  }
  notify?.(`${result.updated.length} sample(s) released for ${sb.testTypeName}${result.skipped ? ` (${result.skipped} skipped — not approved yet)` : ""}.`, "ok");
}
