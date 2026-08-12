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
  registered: ["received", "on_hold", "rejected", "cancelled"],
  received: ["assigned", "on_hold", "rejected", "cancelled"],
  assigned: ["in_progress", "on_hold", "rejected", "cancelled"],
  in_progress: ["results_entered", "on_hold", "rejected", "cancelled"],
  results_entered: ["under_review", "in_progress"],
  under_review: ["approved", "rejected", "in_progress"],
  approved: ["released", "under_review"],
  released: [],
  on_hold: [],
  // resumes to `sample.preHoldStatus`, offered separately in the UI
  rejected: [],
  cancelled: []
};
function nextAllowedStatuses(sample) {
  const base = FORWARD_FLOW[sample.status] || [];
  if (sample.status === "on_hold" && sample.preHoldStatus) return [sample.preHoldStatus];
  return base;
}

// ============================================================================
// PER-PARAMETER STATUS ROLLUP (Phase 3) — requestedTests[].status is now the
// real, stored source of truth for where each individual parameter sits in
// the pipeline. Sample.status becomes a derived ROLLUP: the least-advanced
// ("bottleneck") parameter decides where the sample as a whole shows up in
// status filters/dashboards — a sample isn't "Approved" until every
// parameter it requested is. registered/received/on_hold/rejected/cancelled
// are untouched by this — those are custody decisions about the physical
// sample, not about any one parameter's testing progress.
// ============================================================================
const TEST_STATUS_RANK = {
  pending: 0,
  in_progress: 1,
  results_entered: 2,
  under_review: 3,
  approved: 4,
  released: 5
};
const RANK_TO_SAMPLE_STATUS = {
  0: "assigned",
  1: "in_progress",
  2: "results_entered",
  3: "under_review",
  4: "approved",
  5: "released"
};
const SAMPLE_ROLLUP_ELIGIBLE = ["registered", "received", "assigned", "in_progress", "results_entered", "under_review", "approved", "released"];
function rollupSampleStatus(sample) {
  if (!SAMPLE_ROLLUP_ELIGIBLE.includes(sample.status)) return sample.status;
  if (!sample.requestedTests || !sample.requestedTests.length) return sample.status;
  const ranks = sample.requestedTests.map(rt => TEST_STATUS_RANK[rt.status] ?? 0);
  return RANK_TO_SAMPLE_STATUS[Math.min(...ranks)];
}

// Pure updater: move ONE requestedTest to a new status, then re-sync the
// whole-sample `status` field as a rollup. Every place that changes a
// parameter's status (test-record save, Sub-Batch review, single-parameter
// review, report release) goes through this one function so the rollup is
// never forgotten or done inconsistently.
function setRequestedTestStatus(sample, testTypeId, newStatus, user, note) {
  const target = (sample.requestedTests || []).find(rt => rt.testTypeId === testTypeId);
  if (!target || target.status === newStatus) return sample; // no-op, nothing to log
  const nextRequestedTests = sample.requestedTests.map(rt => rt.testTypeId === testTypeId ? {
    ...rt,
    status: newStatus
  } : rt);
  const withTests = {
    ...sample,
    requestedTests: nextRequestedTests
  };
  const rolled = rollupSampleStatus(withTests);
  const next = {
    ...withTests,
    status: rolled
  };
  return addCustodyEvent(next, {
    action: rolled === sample.status ? `Parameter update: ${target.testTypeName}` : `Status → ${sampleStatusMeta(rolled).label}`,
    toUser: user?.name,
    notes: note || `${target.testTypeName}: ${newStatus.replace(/_/g, " ")}.`
  }, user);
}

// Add one or more brand-new parameters to a sample that's already been
// registered — the fix for "we meant to request 3 parameters but only
// ticked 2 at registration". Each new parameter starts at "pending" (exactly
// like a parameter picked at registration) and is skipped if the sample
// already has it (no duplicates). The whole-sample status is re-rolled the
// same way setRequestedTestStatus() does it, so adding a pending parameter
// to an already Approved/Released sample correctly pulls its rollup status
// back down — the sample isn't genuinely "Released" as a whole while one of
// its parameters hasn't even started. Returns `sample` unchanged (no-op, no
// custody event) if every requested testTypeId was already present.
function addRequestedTests(sample, newTests, user) {
  const existingIds = new Set((sample.requestedTests || []).map(rt => rt.testTypeId));
  const toAdd = (newTests || []).filter(t => t && t.testTypeId && !existingIds.has(t.testTypeId));
  if (!toAdd.length) return sample;
  const stampedNew = toAdd.map(t => ({
    status: "pending",
    testTypeId: t.testTypeId,
    testTypeName: t.testTypeName
  }));
  const nextRequestedTests = [...(sample.requestedTests || []), ...stampedNew];
  const withTests = {
    ...sample,
    requestedTests: nextRequestedTests
  };
  const next = {
    ...withTests,
    status: rollupSampleStatus(withTests)
  };
  return addCustodyEvent(next, {
    action: "Parameter(s) Added",
    toUser: user?.name,
    notes: `Added to requested tests: ${stampedNew.map(t => t.testTypeName).join(", ")}.`
  }, user);
}

// Bulk-move every requestedTest currently sitting at any of `fromStatuses`
// up to `toStatus` — used when a whole-sample, signature-gated decision
// (addApproval / releaseResults) needs to bring every parameter waiting at
// that stage forward together, in one go.
function syncRequestedTestsToStage(sample, fromStatuses, toStatus, user, note) {
  let next = sample;
  (sample.requestedTests || []).filter(rt => fromStatuses.includes(rt.status)).forEach(rt => {
    next = setRequestedTestStatus(next, rt.testTypeId, toStatus, user, note);
  });
  return next;
}

// ============================================================================
// PER-PARAMETER ON HOLD / RETURN TO ANALYST (Results Workflow) — these act on
// ONE (sample, testTypeId) pair at a time, independent of every other
// parameter on the sample and every other sample in whatever Analytical
// Batch it came from, so "do this for one sample" never disturbs the rest
// of that batch's progress.
//
//   On Hold      — flags the parameter (rt.onHold = true) and parks its
//                   status at "results_entered" (Awaiting Review) if it had
//                   moved further along (Awaiting Approval / Approved). If
//                   it was already at Awaiting Review, it simply stays
//                   there, now flagged. Held rows keep showing up in
//                   Awaiting Review — visibly, with a badge — so nothing
//                   silently vanishes; they're just excluded from whatever
//                   bulk action moves the rest of the group forward.
//   Resume       — clears the onHold flag with no status change, handing
//                   the parameter back into the normal queue.
//   Return to    — sends the parameter's status back to "in_progress" (the
//   Analyst        same stage a freshly-assigned, not-yet-tested parameter
//                   sits at) and clears onHold. Combined with
//                   voidSampleResultForTest() below (which retracts this
//                   sample's specific result from whatever test record
//                   currently carries it), the sample becomes eligible for
//                   a brand-new Analytical Batch again — i.e. it behaves
//                   exactly like a newly registered sample, per parameter.
// ============================================================================
function isTestOnHold(sample, testTypeId) {
  const rt = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
  return !!(rt && rt.onHold);
}
function holdRequestedTestForSample(sample, testTypeId, testTypeName, user, note) {
  const rt = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
  if (!rt) return sample;
  const flagged = {
    ...sample,
    requestedTests: sample.requestedTests.map(r => r.testTypeId === testTypeId ? { ...r, onHold: true } : r)
  };
  const stepped = rt.status === "results_entered" ? flagged : setRequestedTestStatus(flagged, testTypeId, "results_entered", user, note);
  return addCustodyEvent(stepped, {
    action: `On Hold: ${testTypeName}`,
    toUser: user?.name,
    notes: note || `${testTypeName} put on hold pending resolution.`
  }, user);
}
function resumeRequestedTestForSample(sample, testTypeId, testTypeName, user, note) {
  const rt = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
  if (!rt || !rt.onHold) return sample;
  const flagged = {
    ...sample,
    requestedTests: sample.requestedTests.map(r => r.testTypeId === testTypeId ? { ...r, onHold: false } : r)
  };
  return addCustodyEvent(flagged, {
    action: `Resumed: ${testTypeName}`,
    toUser: user?.name,
    notes: note || `${testTypeName} taken off hold — back in the normal queue.`
  }, user);
}
function returnRequestedTestToAnalyst(sample, testTypeId, testTypeName, user, note) {
  const rt = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
  if (!rt) return sample;
  const cleared = {
    ...sample,
    requestedTests: sample.requestedTests.map(r => r.testTypeId === testTypeId ? { ...r, onHold: false } : r)
  };
  return setRequestedTestStatus(cleared, testTypeId, "in_progress", user, note || `Returned to analyst for ${testTypeName}.`);
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
  },
  // Explicit entry required — without it, permissionsFor("Guest") falls
  // through to the Technician default below and Guest silently inherits
  // full register/assign/enter/delete rights on samples. Never rely on the
  // fallback for a role that's supposed to be locked down.
  Guest: {
    canRegister: false,
    canAssign: false,
    canEnterResults: false,
    canReview: false,
    canApprove: false,
    canRelease: false
  }
};
const NO_SAMPLE_PERMISSIONS = {
  canRegister: false,
  canAssign: false,
  canEnterResults: false,
  canReview: false,
  canApprove: false,
  canRelease: false
};
const SAMPLE_PERMISSION_ACTIONS = ["canRegister", "canAssign", "canEnterResults", "canReview", "canApprove", "canRelease"];

// permissionsFor() used to take just a role string and look straight into
// ROLE_PERMISSIONS — role-based only, no way to grant or revoke one
// person's register/assign/review/approve/release access without moving
// them into a whole new role. It now takes the shared Module × Action
// permission matrix (permissionMatrix — see 41-rbac-ui.js, where the
// "samples" module lives alongside Test Records/Inventory/etc.) plus the
// full session, so a per-user override — session.overrides.samples.<action>,
// set via the same "Custom permissions for this user" editor every other
// module uses — always wins over the role default, exactly like the rest
// of the app's permission checks (see can() in 41-rbac-ui.js, whose
// resolution order this deliberately mirrors). Duplicated in miniature
// here rather than calling can() directly, since this file loads before
// 41-rbac-ui.js and every other file in this app follows the convention
// that later files may depend on earlier ones, never the reverse.
// Administrator is still always fully trusted regardless of matrix state.
// ROLE_PERMISSIONS above remains the seed data for the matrix's "samples"
// column (see DEFAULT_PERMISSION_MATRIX in 41-rbac-ui.js) and is used here
// as a defensive fallback if a role is somehow missing a "samples" entry
// in the matrix (e.g. mid-migration) — matching pre-override behavior
// exactly in that case.
function permissionsFor(matrix, session) {
  const role = session?.role;
  const perms = {};
  SAMPLE_PERMISSION_ACTIONS.forEach(action => {
    if (role === "Administrator") {
      perms[action] = true;
      return;
    }
    const override = session?.overrides?.samples?.[action];
    if (override === true || override === false) {
      perms[action] = override;
      return;
    }
    // Defaulting an unrecognized role to Technician's access was the bug
    // that let Guest inherit register/delete rights before "Guest" was
    // added above — any future unlisted or misspelled role still safely
    // gets NO access instead of quietly inheriting Technician's.
    const roleDefaults = matrix?.[role]?.samples || ROLE_PERMISSIONS[role] || NO_SAMPLE_PERMISSIONS;
    perms[action] = !!roleDefaults[action];
  });
  return perms;
}

// ---- sampleActionGate(): the same Guest-visible-but-blocked idea as
// permGate() in 41-rbac-ui.js, but built on permissionsFor()'s fine-grained
// canRegister/canAssign/canEnterResults/canReview/canApprove/canRelease
// booleans instead of the generic Module × Action matrix. Guest sees every
// stage and every action button in Results Workflow / Sample Registration —
// nothing hidden — but a click on a step it isn't permissioned for blocks
// with a message instead of running. Every other role keeps the existing
// convention: hidden entirely when not permitted.
function sampleActionGate(perms, actionKey, session, notify, actionLabel) {
  const allowed = !!perms?.[actionKey];
  const isGuest = session?.role === "Guest";
  return {
    allowed,
    visible: allowed || isGuest,
    guard(handler) {
      return (...args) => {
        if (allowed) return handler(...args);
        notify?.(`Guest access can't ${actionLabel || "do that"} — this login is view-only for this action.`, "warn");
      };
    }
  };
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
    fatherHusbandName: fields.fatherHusbandName || "",
    latitude: fields.latitude || "",
    longitude: fields.longitude || "",
    waterPointType: fields.waterPointType || "",
    waterPointTypeOther: fields.waterPointTypeOther || "",
    sampleSourceId: fields.sampleSourceId || "",
    // e.g. "STW-6"
    batchRef: fields.batchRef || "",
    // shared reference (e.g. office memo no.) linking samples uploaded together
    referenceId: fields.referenceId || "",
    // FK -> Reference (19-reference-model.js) — the real source-of-truth for
    // who this sample came from (DPHE / institution / walk-in) and what
    // paperwork it arrived with. batchRef above is kept only as a legacy
    // display fallback for pre-migration data.
    sampleType: fields.sampleType || "Drinking Water",
    collectionDate: fields.collectionDate || todayStr(),
    collectedBy: fields.collectedBy || "",
    receivedDate: fields.receivedDate || todayStr(),
    priority: fields.priority || "Routine",
    requestedTests: (fields.requestedTests || []).map(rt => ({
      status: "pending",
      ...rt
    })),
    // [{testTypeId, testTypeName, status}] — status is the real per-parameter
    // pipeline position (see TEST_STATUSES below), independent of the
    // whole-sample `status` further down, which is now a ROLLUP of these
    // (see rollupSampleStatus()).
    numberOfSamples: Number(fields.numberOfSamples) > 0 ? Number(fields.numberOfSamples) : 1,
    // batch size — how many physical field samples this registration covers
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
// Correct registration-entry mistakes (typos, wrong batch upload row, etc.) —
// only the registration fields are editable, never status/results/custody
// history itself; every edit is logged as its own custody event so the
// correction is auditable rather than silently overwritten.
const SAMPLE_EDITABLE_FIELDS = ["clientName", "siteLocation", "district", "upazila", "union", "village", "caretakerName", "fatherHusbandName", "latitude", "longitude", "waterPointType", "waterPointTypeOther", "sampleSourceId", "batchRef", "referenceId", "sampleType", "collectionDate", "collectedBy", "receivedDate", "priority", "numberOfSamples", "requestedTests"];
function editSample(sample, patch, user) {
  const changes = [];
  const cleanPatch = {};
  SAMPLE_EDITABLE_FIELDS.forEach(field => {
    if (!(field in patch)) return;
    const oldVal = sample[field];
    const newVal = patch[field];
    const oldStr = Array.isArray(oldVal) ? oldVal.map(t => t.testTypeName).join(", ") : String(oldVal ?? "");
    const newStr = Array.isArray(newVal) ? newVal.map(t => t.testTypeName).join(", ") : String(newVal ?? "");
    if (oldStr !== newStr) changes.push(`${field}: "${oldStr}" → "${newStr}"`);
    cleanPatch[field] = newVal;
  });
  const next = {
    ...sample,
    ...cleanPatch
  };
  if (!changes.length) return sample;
  return addCustodyEvent(next, {
    action: "Registration Corrected",
    toUser: user?.name,
    notes: changes.join("; ")
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
  // This signature is the real, compliance-gated approval authority for the
  // whole sample — by the time it fires, the rollup guarantees every
  // requested parameter already reached at least this sample-level stage
  // (a lagging parameter would have kept sample.status behind it). Sync
  // every parameter still sitting at the stage just cleared up to match, so
  // per-parameter status and this signed decision never disagree.
  if (decision === "approved") {
    const fromStatus = step === "review" ? "results_entered" : "under_review";
    const toStatus = step === "review" ? "under_review" : "approved";
    next = syncRequestedTestsToStage(next, [fromStatus], toStatus, user, `${step === "review" ? "Reviewed" : "Approved"} (signed by ${user?.name}).`);
  }
  return next;
}
// Bulk, signature-gated final decision on ONE parameter across many
// samples at once — the same attestation requirement as addApproval()
// above, just applied to a list instead of one sample. This is what
// drives Sub-Batch-level and Reference(Batch)-level "Final Approve" —
// Approve was previously only reachable one sample at a time via Sample
// Detail's SignatureCapture.
// Returns { updated: [...changed samples...], skipped: N } — samples not
// currently at under_review for this parameter are left untouched
// (skipped), so calling this on a mixed list never wrongly force-advances
// something that isn't actually ready.
function bulkDecideParameter(samples, testTypeId, testTypeName, {
  decision,
  comment,
  signedName,
  attested
}, user) {
  if (!attested || !signedName || signedName.trim().length < 2) {
    throw new Error("Electronic signature requires the approver's typed full name and the attestation checkbox.");
  }
  const updated = [];
  let skipped = 0;
  samples.forEach(sample => {
    const rt = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
    if (!rt || rt.status !== "under_review") {
      skipped++;
      return;
    }
    const approval = {
      id: uid("apr"),
      testTypeId,
      testTypeName,
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
    let next = {
      ...sample,
      approvals: [...(sample.approvals || []), approval]
    };
    if (decision === "approved") {
      next = setRequestedTestStatus(next, testTypeId, "approved", user, `Approved (signed by ${user?.name}) for ${testTypeName}.`);
    } else {
      next = setRequestedTestStatus(next, testTypeId, "in_progress", user, `Approval rejected (signed by ${user?.name}) for ${testTypeName}${comment ? `: ${comment}` : ""}.`);
    }
    updated.push(next);
  });
  return {
    updated,
    skipped
  };
}
// Bulk release ONE parameter across many samples at once — same pattern as
// bulkDecideParameter, but for the Approved -> Released step. Not
// signature-gated (matching the existing single-sample releaseResults()
// behavior) — just requires the parameter to already be approved.
function bulkReleaseParameter(samples, testTypeId, testTypeName, user, note) {
  const updated = [];
  let skipped = 0;
  samples.forEach(sample => {
    const rt = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
    if (!rt || rt.status !== "approved") {
      skipped++;
      return;
    }
    updated.push(setRequestedTestStatus(sample, testTypeId, "released", user, note || `Released (by ${user?.name}) for ${testTypeName}.`));
  });
  return {
    updated,
    skipped
  };
}
function releaseResults(sample, user, note) {
  if (sample.status !== "approved") throw new Error("Only approved samples can be released.");
  let next = {
    ...sample,
    status: "released",
    resultRelease: {
      released: true,
      releasedBy: user?.name,
      releasedAt: new Date().toISOString(),
      note: note || ""
    }
  };
  next = addCustodyEvent(next, {
    action: "Results Released",
    toUser: sample.clientName || "Client",
    notes: note || "Final report released."
  }, user);
  // Same reasoning as addApproval above — sync every parameter waiting at
  // "approved" up to "released" so the per-parameter record matches.
  return syncRequestedTestsToStage(next, ["approved"], "released", user, `Released (by ${user?.name}).`);
}

// ---- dashboard-facing stats ----
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
