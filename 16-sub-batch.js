// ============================================================================
// BATCH — a persistent grouping of pending samples that will be tested
// together, matching how the lab actually works: grab a pile of samples
// (possibly from different References — DPHE, private, walk-in, doesn't
// matter) and "bracket" them into one working session, where different
// samples in that same batch can need DIFFERENT test parameters (some need
// Chlorine, some need Arsenic, whatever each one was actually requested).
//
// Internally, a Batch's `members` array is a flat list of (sampleId,
// testTypeId) pairs — NOT one testTypeId for the whole batch. Chemical
// consumption, formulas, and QC rules are still fundamentally per-Test-Type
// (that's the Test Method Engine's job and doesn't change), so "running" a
// batch means running each distinct testTypeId present in it separately —
// each such run produces its own Test Record (tagged with `sourceBatchId`
// so it always traces back to the batch it came from), and the batch as a
// whole is "completed" once every one of its distinct test types has been
// run. A batch can sit at "partially done" for a while, same as real life.
//
// BACKWARD COMPATIBILITY: batches created before this phase have the old
// shape { testTypeId, memberSampleIds, status }. normalizeBatches() below
// migrates those into the new { members: [...] } shape on load — nothing
// stored anywhere needs to change by hand.
// ============================================================================

const SUBBATCH_ELIGIBLE_STATUSES = ["registered", "received", "assigned", "in_progress"];

function generateSubBatchLabel(existingSubBatches) {
  const year = todayStr().slice(0, 4);
  const nums = (existingSubBatches || []).filter(sb => (sb.label || "").startsWith(`SB-${year}-`)).map(sb => Number(sb.label.split("-")[2]) || 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SB-${year}-${String(next).padStart(4, "0")}`;
}

// Old shape -> new shape. Idempotent: already-new batches pass through
// unchanged (they just won't have the old testTypeId/memberSampleIds fields).
function normalizeBatches(subBatches) {
  return (subBatches || []).map(sb => {
    if (Array.isArray(sb.members)) return sb; // already new shape
    const members = (sb.memberSampleIds || []).map(sampleId => ({
      sampleId, testTypeId: sb.testTypeId, testTypeName: sb.testTypeName
    }));
    return { ...sb, members };
  });
}

function createBatch(fields, existingSubBatches) {
  return {
    id: uid("sb"),
    label: fields.label || generateSubBatchLabel(existingSubBatches),
    members: fields.members || [],
    // [{ sampleId, testTypeId, testTypeName }] — can span multiple test types
    assignedTester: fields.assignedTester || "",
    createdAt: new Date().toISOString(),
  };
}
// Kept as an alias so any lingering call to the old name still works.
const createSubBatch = createBatch;

function distinctTestTypesInBatch(batch) {
  const seen = new Map();
  (batch.members || []).forEach(m => { if (!seen.has(m.testTypeId)) seen.set(m.testTypeId, m.testTypeName); });
  return [...seen.entries()].map(([testTypeId, testTypeName]) => ({ testTypeId, testTypeName }));
}

function batchMembersForTestType(batch, testTypeId) {
  return (batch.members || []).filter(m => m.testTypeId === testTypeId).map(m => m.sampleId);
}

// A batch's per-test-type "group" is done once a Test Record exists that was
// generated FROM this batch for that test type. Traced via sourceBatchId —
// unambiguous even if two batches happen to share member samples.
function batchGroupStatus(batch, testTypeId, testRecords) {
  const done = (testRecords || []).some(r => r.sourceBatchId === batch.id && r.testTypeId === testTypeId);
  return done ? "completed" : "pending";
}

// Whole-batch status, derived from its groups — "pending" (nothing run yet),
// "partial" (some test types done, some not), or "completed" (all done).
function batchOverallStatus(batch, testRecords) {
  const groups = distinctTestTypesInBatch(batch);
  if (!groups.length) return "pending";
  const doneCount = groups.filter(g => batchGroupStatus(batch, g.testTypeId, testRecords) === "completed").length;
  if (doneCount === 0) return "pending";
  if (doneCount === groups.length) return "completed";
  return "partial";
}

// Shared lookup used by the QC Module banner, Sample review, and the Report
// Generator: find a sample's result for a given test, whether it came from a
// single Add Test Record entry (sampleId set directly) or from inside a
// Batch group's memberResults (memberSampleIds + memberResults).
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

// ---- THE canonical "is this sample already spoken for, for this test?"
// check. Use this everywhere a sample-eligibility pool for a Test Type is
// built (Batch creation, Bulk Result Upload, Add Test Record's single-
// sample picker) so a sample can never end up double-booked for the same
// test via two different entry points. A sample is "committed" if:
//   1. it already has a result (single Add Test Record OR a completed
//      Batch group), OR
//   2. it's a member of a Batch's still-PENDING group for that test type
//      (reserved, not yet run).
// `excludeBatchId` lets a Batch being edited ignore its own current
// membership (otherwise its own members would wrongly look unavailable).
function sampleAlreadyCommittedForTest(sample, testTypeId, testRecords, subBatches, excludeBatchId) {
  if (getSampleResultForTest(sample, testTypeId, testRecords)) return true;
  return (subBatches || []).some(sb => {
    if (sb.id === excludeBatchId) return false;
    const inGroup = (sb.members || []).some(m => m.sampleId === sample.id && m.testTypeId === testTypeId);
    if (!inGroup) return false;
    return batchGroupStatus(sb, testTypeId, testRecords) === "pending";
  });
}
