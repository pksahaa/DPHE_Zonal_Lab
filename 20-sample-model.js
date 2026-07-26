// ===== 20-sample-model.js =====
// ============================================================================
// SAMPLE LIFECYCLE MODEL — the LIMS core: Registration → Chain of Custody →
// Assignment → Status tracking → Approval workflow → Result release.
//
// This is deliberately a plain-data + pure-function module (like
// 10-inventory-logic.js) so the state machine can be unit tested and reused
// from anywhere (UI, reports, future API layer) without dragging React in.
//
// A "Sample" is the physical thing that arrives at the lab. It is distinct
// from a "Test Record" (which already existed in V14 and represents one
// tester's execution of one Test Method, consuming reagents). One Sample
// can require several Test Methods, so a Sample links out to zero or more
// Test Record ids in `linkedTestRecordIds`. This preserves 100% of the
// existing Test Record / inventory-consumption behaviour — the Sample layer
// sits ABOVE it and tracks custody + approval, it doesn't replace it.
// ============================================================================

// ---- status catalogue -------------------------------------------------
const SAMPLE_STATUSES = [{
  key: "registered",
  label: "Registered",
  color: "info",
  icon: "clipboard"
}, {
  key: "received",
  label: "Received in Lab",
  color: "info",
  icon: "check"
}, {
  key: "assigned",
  label: "Assigned",
  color: "info",
  icon: "user"
}, {
  key: "in_progress",
  label: "In Progress",
  color: "warn",
  icon: "beaker"
}, {
  key: "results_entered",
  label: "Results Entered",
  color: "warn",
  icon: "edit"
}, {
  key: "under_review",
  label: "Under Review",
  color: "warn",
  icon: "chart"
}, {
  key: "approved",
  label: "Approved",
  color: "ok",
  icon: "check"
}, {
  key: "released",
  label: "Released",
  color: "ok",
  icon: "printer"
}, {
  key: "on_hold",
  label: "On Hold",
  color: "warn",
  icon: "warning"
}, {
  key: "rejected",
  label: "Rejected",
  color: "warn",
  icon: "warning"
}, {
  key: "cancelled",
  label: "Cancelled",
  color: "warn",
  icon: "warning"
}];
function sampleStatusMeta(key) {
  return SAMPLE_STATUSES.find(s => s.key === key) || SAMPLE_STATUSES[0];
}

// ---- forward-motion state machine --------------------------------------
// Maps a status to the statuses a user is allowed to move it to next. "Side"
// states (on_hold / rejected / cancelled) are reachable from any active
// status and, for on_hold, return to whatever status preceded it.
const FORWARD_FLOW = {
  registered: ["received", "cancelled"],
  received: ["assigned", "on_hold", "cancelled"],
  assigned: ["in_progress", "on_hold"],
  in_progress: ["results_entered", "on_hold"],
  results_entered: ["under_review", "in_progress"],
  under_review: ["approved", "rejected", "in_progress"],
  approved: ["released", "under_review"],
  released: [],
  on_hold: [],
  // resumes to `sample.preHoldStatus`, offered separately in the UI
  rejected: ["in_progress"],
  cancelled: []
};
function nextAllowedStatuses(sample) {
  const base = FORWARD_FLOW[sample.status] || [];
  if (sample.status === "on_hold" && sample.preHoldStatus) return [sample.preHoldStatus];
  return base;
}

// ---- roles / permissions (additive — existing Administrator/Technician
// users keep working unchanged; these two roles are optional extras a lab
// can create for approval segregation-of-duties) ----
const ROLE_PERMISSIONS = {
  Administrator: {
    canRegister: true,
    canAssign: true,
    canEnterResults: true,
    canReview: true,
    canApprove: true,
    canRelease: true
  },
  Technician: {
    canRegister: true,
    canAssign: false,
    canEnterResults: true,
    canReview: false,
    canApprove: false,
    canRelease: false
  },
  Reviewer: {
    canRegister: false,
    canAssign: false,
    canEnterResults: false,
    canReview: true,
    canApprove: false,
    canRelease: false
  },
  "QA Manager": {
    canRegister: false,
    canAssign: true,
    canEnterResults: false,
    canReview: true,
    canApprove: true,
    canRelease: true
  }
};
function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Technician;
}

// ---- sample code generator: WQ-<year>-###### sequential per year ----
function generateSampleCode(existingSamples, dateStr) {
  const year = (dateStr || todayStr()).slice(0, 4);
  const nums = existingSamples.filter(s => (s.sampleCode || "").startsWith(`WQ-${year}-`)).map(s => Number(s.sampleCode.split("-")[2]) || 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `WQ-${year}-${String(next).padStart(6, "0")}`;
}

// ---- factory ----
function createSample(fields, existingSamples, user) {
  const now = new Date().toISOString();
  const sample = {
    id: uid("smp"),
    sampleCode: generateSampleCode(existingSamples, fields.collectionDate),
    clientName: fields.clientName || "",
    siteLocation: fields.siteLocation || "",
    // Administrative address hierarchy + caretaker/source — needed for the
    // official lab report format (District > Upazila/City Corp > Union/Pourashava
    // > Village/Ward), captured per physical sample since these can differ even
    // within one registered batch.
    district: fields.district || "",
    upazila: fields.upazila || "",
    union: fields.union || "",
    village: fields.village || "",
    caretakerName: fields.caretakerName || "",
    sampleSourceId: fields.sampleSourceId || "",
    // e.g. "STW-6"
    referenceId: fields.referenceId || null,
    // links to a Reference (18-reference-model.js) — who sent this sample
    batchRef: fields.batchRef || "",
    // shared reference (e.g. office memo no.) linking samples uploaded together
    matrix: fields.matrix || "Drinking Water",
    collectionDate: fields.collectionDate || todayStr(),
    collectedBy: fields.collectedBy || "",
    receivedDate: fields.receivedDate || todayStr(),
    priority: fields.priority || "Routine",
    requestedTests: fields.requestedTests || [],
    // [{testTypeId, testTypeName}]
    numberOfSamples: Number(fields.numberOfSamples) > 0 ? Number(fields.numberOfSamples) : 1,
    // batch size — how many physical field samples this registration covers
    notes: fields.notes || "",
    status: "registered",
    preHoldStatus: null,
    assignedTo: "",
    assignedAt: null,
    linkedTestRecordIds: [],
    approvals: [],
    resultRelease: {
      released: false,
      releasedBy: "",
      releasedAt: null,
      note: ""
    },
    custodyLog: [{
      id: uid("coc"),
      ts: now,
      action: "Registered",
      fromUser: null,
      toUser: user?.name || "Unknown",
      location: "Sample Reception",
      notes: `Sample registered by ${user?.name || "Unknown"}.`
    }],
    createdAt: now,
    createdBy: user?.name || "Unknown"
  };
  return sample;
}

// ---- mutations (all pure — return a NEW sample object, caller persists it) ----
function addCustodyEvent(sample, {
  action,
  fromUser,
  toUser,
  location,
  notes
}, user) {
  const event = {
    id: uid("coc"),
    ts: new Date().toISOString(),
    action,
    fromUser: fromUser ?? sample.custodyLog[sample.custodyLog.length - 1]?.toUser ?? null,
    toUser: toUser || user?.name || "Unknown",
    location: location || "Lab",
    notes: notes || ""
  };
  return {
    ...sample,
    custodyLog: [...sample.custodyLog, event]
  };
}
function transitionSample(sample, newStatus, meta, user) {
  const allowed = nextAllowedStatuses(sample);
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move sample from "${sampleStatusMeta(sample.status).label}" to "${sampleStatusMeta(newStatus).label}".`);
  }
  const isHold = newStatus === "on_hold";
  const next = {
    ...sample,
    status: newStatus,
    preHoldStatus: isHold ? sample.status : sample.status === "on_hold" ? null : sample.preHoldStatus
  };
  return addCustodyEvent(next, {
    action: `Status → ${sampleStatusMeta(newStatus).label}`,
    toUser: user?.name,
    location: meta?.location,
    notes: meta?.notes
  }, user);
}
function assignSample(sample, assigneeName, user) {
  const next = {
    ...sample,
    status: "assigned",
    assignedTo: assigneeName,
    assignedAt: new Date().toISOString()
  };
  return addCustodyEvent(next, {
    action: "Assigned",
    fromUser: user?.name,
    toUser: assigneeName,
    notes: `Assigned to ${assigneeName}.`
  }, user);
}
function linkTestRecord(sample, testRecordId) {
  if (sample.linkedTestRecordIds.includes(testRecordId)) return sample;
  return {
    ...sample,
    linkedTestRecordIds: [...sample.linkedTestRecordIds, testRecordId]
  };
}

// e-signature: this is a WORKFLOW-level attestation (typed name + explicit
// checkbox + server/local timestamp), matching what most LIMS call a "type 1"
// signature. It is not a cryptographic signature — flagged clearly in the UI
// and in README.md so nobody mistakes it for 21 CFR Part 11 compliance.
function addApproval(sample, {
  step,
  decision,
  comment,
  signedName,
  attested
}, user) {
  if (!attested || !signedName || signedName.trim().length < 2) {
    throw new Error("Electronic signature requires the approver's typed full name and the attestation checkbox.");
  }
  const approval = {
    id: uid("apr"),
    step,
    decision,
    comment: comment || "",
    byUser: user?.name,
    byRole: user?.role,
    ts: new Date().toISOString(),
    signature: {
      signedName: signedName.trim(),
      attested: true
    }
  };
  const nextStatus = decision === "approved" ? step === "review" ? "under_review" : "approved" : "rejected";
  let next = {
    ...sample,
    approvals: [...sample.approvals, approval]
  };
  next = transitionSample({
    ...next,
    status: sample.status === "results_entered" ? "results_entered" : sample.status
  }, step === "review" ? decision === "approved" ? "under_review" : "rejected" : decision === "approved" ? "approved" : "rejected", {
    notes: `${step === "review" ? "Review" : "Approval"} ${decision} by ${user?.name}${comment ? `: ${comment}` : ""}`
  }, user);
  return next;
}
function releaseResults(sample, user, note) {
  if (sample.status !== "approved") throw new Error("Only approved samples can be released.");
  const next = {
    ...sample,
    status: "released",
    resultRelease: {
      released: true,
      releasedBy: user?.name,
      releasedAt: new Date().toISOString(),
      note: note || ""
    }
  };
  return addCustodyEvent(next, {
    action: "Results Released",
    toUser: sample.clientName || "Client",
    notes: note || "Final report released."
  }, user);
}

// ============================================================================
// PER-TEST PROGRESS — DERIVED, not stored. This is the fix for "samples e
// auto update hobe na" (nothing updates automatically): rather than storing
// a testStatus field on each requestedTest that some other screen has to
// remember to keep in sync (exactly the kind of drift that caused the
// original mess), a sample's per-test progress is computed fresh, every
// time, from the Batches and Test Records that actually exist. There is
// nothing to fall out of sync because there is nothing extra being stored.
// ============================================================================

const TEST_PROGRESS_STAGES = [{
  key: "pending",
  label: "Pending",
  color: "muted"
}, {
  key: "batched",
  label: "Batched",
  color: "info"
}, {
  key: "result_entered",
  label: "Result Entered",
  color: "warn"
}, {
  key: "under_review",
  label: "Under Review",
  color: "warn"
}, {
  key: "approved",
  label: "Approved",
  color: "ok"
}, {
  key: "released",
  label: "Released",
  color: "ok"
}];
function testProgressMeta(key) {
  return TEST_PROGRESS_STAGES.find(s => s.key === key) || TEST_PROGRESS_STAGES[0];
}

// batches here means the Sub-Batch/Batch collection (16-sub-batch.js).
function getRequestedTestStatus(sample, testTypeId, testRecords, batches) {
  const result = getSampleResultForTest(sample, testTypeId, testRecords);
  if (result) {
    // A result exists — from here the SAMPLE's own approval stage (which is
    // whole-sample, since one signed report covers all its tests together)
    // determines how far along this particular test really is.
    if (sample.status === "released") return "released";
    if (sample.status === "approved") return "approved";
    if (sample.status === "under_review") return "under_review";
    return "result_entered";
  }
  const reserved = (batches || []).some(b => (b.members || []).some(m => m.sampleId === sample.id && m.testTypeId === testTypeId) && batchGroupStatus(b, testTypeId, testRecords) === "pending");
  return reserved ? "batched" : "pending";
}

// The full picture for one sample — every requested test with its live,
// derived stage. This is what the Sample Profile view and every summary
// badge should read from, instead of each screen inventing its own logic.
function sampleTestProgress(sample, testRecords, batches) {
  const tests = (sample.requestedTests || []).map(rt => ({
    ...rt,
    stage: getRequestedTestStatus(sample, rt.testTypeId, testRecords, batches)
  }));
  const total = tests.length;
  const doneStages = ["result_entered", "under_review", "approved", "released"];
  const done = tests.filter(t => doneStages.includes(t.stage)).length;
  return {
    tests,
    total,
    done,
    allResultsIn: total > 0 && done === total
  };
}

// Call this after ANY action that might complete a sample's last pending
// test (saving a Test Record, committing a Bulk Result Upload, running a
// Batch). If every requested test now has a result and the sample hasn't
// already moved past that point, this bumps the sample straight to
// "results_entered" — automatically, with a custody log entry — so nobody
// has to remember to click "Move Status" by hand. Returns the sample
// unchanged if nothing needs to happen (safe to call unconditionally).
function autoAdvanceSampleStatus(sample, testRecords, batches, user) {
  const stillEarly = ["registered", "received", "assigned", "in_progress"].includes(sample.status);
  if (!stillEarly) return sample;
  const progress = sampleTestProgress(sample, testRecords, batches);
  if (!progress.allResultsIn) return sample;
  let next = sample.status === "registered" ? addCustodyEvent(sample, {
    action: "Auto: Received in Lab",
    toUser: user?.name,
    notes: "All requested tests now have results."
  }, user) : sample;
  next = { ...next, status: "results_entered" };
  return addCustodyEvent(next, {
    action: "Auto: All Results Entered",
    toUser: user?.name,
    notes: "Every requested test on this sample now has a result — ready for review."
  }, user);
}


function sampleLifecycleStats(samples) {
  const byStatus = {};
  SAMPLE_STATUSES.forEach(s => byStatus[s.key] = 0);
  samples.forEach(s => {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  });
  const pendingApproval = byStatus.under_review || 0;
  const awaitingRelease = byStatus.approved || 0;
  const activeCount = samples.filter(s => !["released", "rejected", "cancelled"].includes(s.status)).length;
  const overdue = samples.filter(s => {
    if (["released", "rejected", "cancelled"].includes(s.status)) return false;
    const days = daysBetweenD(s.collectionDate, todayStr());
    return s.priority === "Urgent" && days > 1 || s.priority !== "Urgent" && days > 5;
  }).length;
  return {
    byStatus,
    pendingApproval,
    awaitingRelease,
    activeCount,
    overdue
  };
}
