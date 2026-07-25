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
function generateSubBatchLabel(existingSubBatches) {
  const year = todayStr().slice(0, 4);
  const nums = (existingSubBatches || []).filter(sb => (sb.label || "").startsWith(`SB-${year}-`)).map(sb => Number(sb.label.split("-")[2]) || 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SB-${year}-${String(next).padStart(4, "0")}`;
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
      source: "subBatch"
    };
  }
  return null;
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
