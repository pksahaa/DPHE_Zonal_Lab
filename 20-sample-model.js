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
const SAMPLE_STATUSES = [
  { key: "registered",      label: "Registered",       color: "info",  icon: "clipboard" },
  { key: "received",        label: "Received in Lab",  color: "info",  icon: "check" },
  { key: "assigned",        label: "Assigned",         color: "info",  icon: "user" },
  { key: "in_progress",     label: "In Progress",      color: "warn",  icon: "beaker" },
  { key: "results_entered", label: "Results Entered",  color: "warn",  icon: "edit" },
  { key: "under_review",    label: "Under Review",     color: "warn",  icon: "chart" },
  { key: "approved",        label: "Approved",         color: "ok",    icon: "check" },
  { key: "released",        label: "Released",         color: "ok",    icon: "printer" },
  { key: "on_hold",         label: "On Hold",          color: "warn",  icon: "warning" },
  { key: "rejected",        label: "Rejected",         color: "warn",  icon: "warning" },
  { key: "cancelled",       label: "Cancelled",        color: "warn",  icon: "warning" },
];
function sampleStatusMeta(key) { return SAMPLE_STATUSES.find((s) => s.key === key) || SAMPLE_STATUSES[0]; }

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
  on_hold: [],   // resumes to `sample.preHoldStatus`, offered separately in the UI
  rejected: ["in_progress"],
  cancelled: [],
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
  Administrator: { canRegister: true, canAssign: true, canEnterResults: true, canReview: true, canApprove: true, canRelease: true },
  Technician:    { canRegister: true, canAssign: false, canEnterResults: true, canReview: false, canApprove: false, canRelease: false },
  Reviewer:      { canRegister: false, canAssign: false, canEnterResults: false, canReview: true, canApprove: false, canRelease: false },
  "QA Manager":  { canRegister: false, canAssign: true, canEnterResults: false, canReview: true, canApprove: true, canRelease: true },
};
function permissionsFor(role) { return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Technician; }

// ---- sample code generator: WQ-<year>-###### sequential per year ----
function generateSampleCode(existingSamples, dateStr) {
  const year = (dateStr || todayStr()).slice(0, 4);
  const nums = existingSamples
    .filter((s) => (s.sampleCode || "").startsWith(`WQ-${year}-`))
    .map((s) => Number(s.sampleCode.split("-")[2]) || 0);
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
    matrix: fields.matrix || "Drinking Water",
    collectionDate: fields.collectionDate || todayStr(),
    collectedBy: fields.collectedBy || "",
    receivedDate: fields.receivedDate || todayStr(),
    priority: fields.priority || "Routine",
    requestedTests: fields.requestedTests || [], // [{testTypeId, testTypeName}]
    notes: fields.notes || "",
    status: "registered",
    preHoldStatus: null,
    assignedTo: "",
    assignedAt: null,
    linkedTestRecordIds: [],
    approvals: [],
    resultRelease: { released: false, releasedBy: "", releasedAt: null, note: "" },
    custodyLog: [{
      id: uid("coc"), ts: now, action: "Registered",
      fromUser: null, toUser: user?.name || "Unknown",
      location: "Sample Reception", notes: `Sample registered by ${user?.name || "Unknown"}.`,
    }],
    createdAt: now, createdBy: user?.name || "Unknown",
  };
  return sample;
}

// ---- mutations (all pure — return a NEW sample object, caller persists it) ----
function addCustodyEvent(sample, { action, fromUser, toUser, location, notes }, user) {
  const event = {
    id: uid("coc"), ts: new Date().toISOString(), action,
    fromUser: fromUser ?? sample.custodyLog[sample.custodyLog.length - 1]?.toUser ?? null,
    toUser: toUser || user?.name || "Unknown",
    location: location || "Lab", notes: notes || "",
  };
  return { ...sample, custodyLog: [...sample.custodyLog, event] };
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
    preHoldStatus: isHold ? sample.status : (sample.status === "on_hold" ? null : sample.preHoldStatus),
  };
  return addCustodyEvent(
    next,
    { action: `Status → ${sampleStatusMeta(newStatus).label}`, toUser: user?.name, location: meta?.location, notes: meta?.notes },
    user
  );
}

function assignSample(sample, assigneeName, user) {
  const next = { ...sample, status: "assigned", assignedTo: assigneeName, assignedAt: new Date().toISOString() };
  return addCustodyEvent(next, { action: "Assigned", fromUser: user?.name, toUser: assigneeName, notes: `Assigned to ${assigneeName}.` }, user);
}

function linkTestRecord(sample, testRecordId) {
  if (sample.linkedTestRecordIds.includes(testRecordId)) return sample;
  return { ...sample, linkedTestRecordIds: [...sample.linkedTestRecordIds, testRecordId] };
}

// e-signature: this is a WORKFLOW-level attestation (typed name + explicit
// checkbox + server/local timestamp), matching what most LIMS call a "type 1"
// signature. It is not a cryptographic signature — flagged clearly in the UI
// and in README.md so nobody mistakes it for 21 CFR Part 11 compliance.
function addApproval(sample, { step, decision, comment, signedName, attested }, user) {
  if (!attested || !signedName || signedName.trim().length < 2) {
    throw new Error("Electronic signature requires the approver's typed full name and the attestation checkbox.");
  }
  const approval = {
    id: uid("apr"), step, decision, comment: comment || "",
    byUser: user?.name, byRole: user?.role, ts: new Date().toISOString(),
    signature: { signedName: signedName.trim(), attested: true },
  };
  const nextStatus = decision === "approved"
    ? (step === "review" ? "under_review" : "approved")
    : "rejected";
  let next = { ...sample, approvals: [...sample.approvals, approval] };
  next = transitionSample({ ...next, status: sample.status === "results_entered" ? "results_entered" : sample.status },
    step === "review" ? (decision === "approved" ? "under_review" : "rejected")
                       : (decision === "approved" ? "approved" : "rejected"),
    { notes: `${step === "review" ? "Review" : "Approval"} ${decision} by ${user?.name}${comment ? `: ${comment}` : ""}` },
    user);
  return next;
}

function releaseResults(sample, user, note) {
  if (sample.status !== "approved") throw new Error("Only approved samples can be released.");
  const next = {
    ...sample,
    status: "released",
    resultRelease: { released: true, releasedBy: user?.name, releasedAt: new Date().toISOString(), note: note || "" },
  };
  return addCustodyEvent(next, { action: "Results Released", toUser: sample.clientName || "Client", notes: note || "Final report released." }, user);
}

// ---- dashboard-facing stats ----
function sampleLifecycleStats(samples) {
  const byStatus = {};
  SAMPLE_STATUSES.forEach((s) => (byStatus[s.key] = 0));
  samples.forEach((s) => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
  const pendingApproval = byStatus.under_review || 0;
  const awaitingRelease = byStatus.approved || 0;
  const activeCount = samples.filter((s) => !["released", "rejected", "cancelled"].includes(s.status)).length;
  const overdue = samples.filter((s) => {
    if (["released", "rejected", "cancelled"].includes(s.status)) return false;
    const days = daysBetweenD(s.collectionDate, todayStr());
    return (s.priority === "Urgent" && days > 1) || (s.priority !== "Urgent" && days > 5);
  }).length;
  return { byStatus, pendingApproval, awaitingRelease, activeCount, overdue };
}
