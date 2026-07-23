// ===== 21-sample-ui.js =====
// ============================================================================
// SAMPLE LIFECYCLE UI — the "Samples" tab. Reuses 02-ui-kit primitives so it
// looks native to the rest of the app. Talks to samples ONLY through the
// props passed down from 99-app.js's useSamples() hook (DataService-backed),
// never touching storage directly.
// ============================================================================

function SampleStatusBadge({
  status
}) {
  const meta = sampleStatusMeta(status);
  const toneMap = {
    info: C.teal,
    warn: C.warn,
    ok: C.ok
  };
  return /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
    style: {
      background: `${toneMap[meta.color]}1A`,
      color: toneMap[meta.color]
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: meta.icon,
    size: 11
  }), meta.label);
}
function PriorityBadge({
  priority
}) {
  const urgent = priority === "Urgent";
  return /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
    style: {
      background: urgent ? `${C.warn}1A` : `${C.muted}1A`,
      color: urgent ? C.warn : C.muted
    }
  }, priority);
}

// ---- compact "N status" chip strip shown on a collapsed/expanded batch header row ----
function BatchStatusSummary({
  members
}) {
  const toneMap = {
    info: C.teal,
    warn: C.warn,
    ok: C.ok
  };
  const counts = {};
  members.forEach(s => {
    counts[s.status] = (counts[s.status] || 0) + 1;
  });
  const order = Object.keys(counts).sort((a, b) => SAMPLE_STATUSES.findIndex(x => x.key === a) - SAMPLE_STATUSES.findIndex(x => x.key === b));
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1 flex-wrap"
  }, order.map(statusKey => {
    const meta = sampleStatusMeta(statusKey);
    return /*#__PURE__*/React.createElement("span", {
      key: statusKey,
      className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
      style: {
        background: `${toneMap[meta.color]}1A`,
        color: toneMap[meta.color]
      }
    }, counts[statusKey], " ", meta.label);
  }));
}

// ---- Registration form ----
function SampleRegistrationForm({
  testTypes,
  onCreate,
  onClose
}) {
  const [form, setForm] = React.useState({
    clientName: "",
    siteLocation: "",
    district: "",
    upazila: "",
    union: "",
    village: "",
    caretakerName: "",
    sampleSourceId: "",
    matrix: "Drinking Water",
    collectionDate: todayStr(),
    collectedBy: "",
    receivedDate: todayStr(),
    priority: "Routine",
    numberOfSamples: 1,
    notes: ""
  });
  const [selectedTests, setSelectedTests] = React.useState([]);
  const [err, setErr] = React.useState("");
  function toggleTest(t) {
    setSelectedTests(prev => prev.some(x => x.testTypeId === t.id) ? prev.filter(x => x.testTypeId !== t.id) : [...prev, {
      testTypeId: t.id,
      testTypeName: t.name
    }]);
  }
  function submit() {
    if (!form.clientName.trim() || !form.siteLocation.trim()) {
      setErr("Client / requester and site location are required.");
      return;
    }
    if (!selectedTests.length) {
      setErr("Select at least one requested test.");
      return;
    }
    onCreate({
      ...form,
      requestedTests: selectedTests
    });
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Register New Sample",
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Client / Requester",
    value: form.clientName,
    onChange: v => setForm({
      ...form,
      clientName: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Site / Location",
    value: form.siteLocation,
    onChange: v => setForm({
      ...form,
      siteLocation: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "District",
    value: form.district,
    onChange: v => setForm({
      ...form,
      district: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Upazila / City Corporation",
    value: form.upazila,
    onChange: v => setForm({
      ...form,
      upazila: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Union / Pourashava",
    value: form.union,
    onChange: v => setForm({
      ...form,
      union: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Village / Ward",
    value: form.village,
    onChange: v => setForm({
      ...form,
      village: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Caretaker Name",
    value: form.caretakerName,
    onChange: v => setForm({
      ...form,
      caretakerName: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Sample Source (e.g. STW-6)",
    value: form.sampleSourceId,
    onChange: v => setForm({
      ...form,
      sampleSourceId: v
    })
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Matrix",
    value: form.matrix,
    onChange: v => setForm({
      ...form,
      matrix: v
    }),
    options: ["Drinking Water", "Ground Water", "Surface Water", "Wastewater", "Other"]
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Priority",
    value: form.priority,
    onChange: v => setForm({
      ...form,
      priority: v
    }),
    options: ["Routine", "Urgent"]
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collection Date",
    type: "date",
    value: form.collectionDate,
    onChange: v => setForm({
      ...form,
      collectionDate: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collected By",
    value: form.collectedBy,
    onChange: v => setForm({
      ...form,
      collectedBy: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Received Date",
    type: "date",
    value: form.receivedDate,
    onChange: v => setForm({
      ...form,
      receivedDate: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "No. of Samples in this Batch",
    type: "number",
    min: "1",
    value: form.numberOfSamples,
    onChange: v => setForm({
      ...form,
      numberOfSamples: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium mb-1.5",
    style: {
      color: C.muted
    }
  }, "Requested Tests"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5"
  }, testTypes.map(t => {
    const on = selectedTests.some(x => x.testTypeId === t.id);
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => toggleTest(t),
      className: "px-2.5 py-1 rounded-full text-xs font-medium border",
      style: {
        background: on ? C.teal : "transparent",
        color: on ? "#fff" : C.ink,
        borderColor: on ? C.teal : C.border
      }
    }, t.testName || t.name);
  }), !testTypes.length && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "No test methods configured yet — add one in Test Method Engine first."))), /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Notes",
    value: form.notes,
    onChange: v => setForm({
      ...form,
      notes: v
    }),
    textarea: true
  })), err && /*#__PURE__*/React.createElement("div", {
    className: "mt-2 text-xs font-medium",
    style: {
      color: C.warn
    }
  }, err), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: submit
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Register Sample")));
}

// ---- Chain of custody timeline ----
function CustodyTimeline({
  events
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-0"
  }, events.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: e.id,
    className: "flex gap-3 pb-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rounded-full",
    style: {
      width: 8,
      height: 8,
      background: C.teal,
      marginTop: 4
    }
  }), i < events.length - 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      flex: 1,
      background: C.border,
      marginTop: 2
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 pb-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold",
    style: {
      color: C.ink
    }
  }, e.action), /*#__PURE__*/React.createElement("span", {
    className: "text-[11px]",
    style: {
      color: C.muted
    }
  }, new Date(e.ts).toLocaleString())), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px]",
    style: {
      color: C.muted
    }
  }, e.fromUser ? `${e.fromUser} → ` : "", e.toUser, e.location ? ` · ${e.location}` : ""), e.notes && /*#__PURE__*/React.createElement("div", {
    className: "text-xs mt-0.5",
    style: {
      color: C.ink
    }
  }, e.notes)))));
}

// ---- e-signature capture ----
function SignatureCapture({
  user,
  onConfirm,
  label
}) {
  const [signedName, setSignedName] = React.useState("");
  const [attested, setAttested] = React.useState(false);
  const [comment, setComment] = React.useState("");
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-3 mt-2",
    style: {
      background: C.bg,
      border: `1px dashed ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-2",
    style: {
      color: C.ink
    }
  }, label), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Comment (optional)",
    value: comment,
    onChange: setComment,
    textarea: true
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Type your full name to sign",
    value: signedName,
    onChange: setSignedName,
    placeholder: user?.name || ""
  }), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 mt-2 text-xs",
    style: {
      color: C.ink
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: attested,
    onChange: e => setAttested(e.target.checked)
  }), "I attest that this decision reflects my professional review of the results."), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] mt-1",
    style: {
      color: C.muted
    }
  }, "Workflow-level electronic signature (typed name + attestation + timestamp). Not a cryptographic signature."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => onConfirm({
      decision: "rejected",
      comment,
      signedName,
      attested
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 12
  }), "Reject"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => onConfirm({
      decision: "approved",
      comment,
      signedName,
      attested
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), "Sign & Approve")));
}

// ---- Sample detail drawer ----
function SampleDetail({
  sample,
  users,
  session,
  testTypes,
  testRecords,
  onClose,
  onUpdate,
  notify
}) {
  const perms = permissionsFor(session.role);
  const allowedNext = nextAllowedStatuses(sample);
  const technicians = users.filter(u => u.role === "Technician" || u.role === "Administrator");
  const [assignee, setAssignee] = React.useState(sample.assignedTo || "");
  const step = sample.status === "results_entered" ? "review" : sample.status === "under_review" ? "approve" : null;
  // QC status check — only relevant once results are in and someone is about
  // to review/approve. Flags if any requested test method has an open
  // Westgard violation or warning so the reviewer can check before sign-off.
  const qcWarnings = React.useMemo(() => {
    if (!step || !testTypes) return [];
    return sample.requestedTests.map(rt => ({
      testTypeName: rt.testTypeName,
      status: getQcStatusForMethod(rt.testTypeId, testTypes, testRecords)
    })).filter(x => x.status.hasReject || x.status.hasWarning);
  }, [step, testTypes, testRecords, sample.requestedTests]);
  function guardedUpdate(mutator, successMsg) {
    try {
      const next = mutator();
      onUpdate(next);
      notify?.(successMsg, "ok");
    } catch (e) {
      notify?.(e.message, "warn");
    }
  }
  const canActOnStep = step === "review" ? perms.canReview : step === "approve" ? perms.canApprove : false;
  return /*#__PURE__*/React.createElement(Modal, {
    title: `${sample.sampleCode} — ${sample.clientName}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-3"
  }, /*#__PURE__*/React.createElement(SampleStatusBadge, {
    status: sample.status
  }), /*#__PURE__*/React.createElement(PriorityBadge, {
    priority: sample.priority
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, sample.matrix, " · ", sample.siteLocation, " · ", sample.numberOfSamples || 1, " sample", (sample.numberOfSamples || 1) > 1 ? "s" : "", " in batch")), qcWarnings.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mb-3 p-3 rounded text-xs",
    style: {
      background: qcWarnings.some(w => w.status.hasReject) ? C.warnBg : C.infoBg,
      color: qcWarnings.some(w => w.status.hasReject) ? C.warn : C.info,
      border: `1px solid ${qcWarnings.some(w => w.status.hasReject) ? C.warn : C.info}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1.5 font-semibold mb-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: qcWarnings.some(w => w.status.hasReject) ? "ban" : "warning",
    size: 13
  }), "Check QC status before ", step === "review" ? "review" : "approval"), qcWarnings.map((w, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, w.testTypeName, ": ", w.status.hasReject ? "Westgard violation" : "warning pattern", " detected on recent QC runs — see QC Module tab."))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-span-2 space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: {
      color: C.ink
    }
  }, "Requested Tests"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5"
  }, sample.requestedTests.map(t => /*#__PURE__*/React.createElement("span", {
    key: t.testTypeId,
    className: "text-[11px] px-2 py-0.5 rounded-full",
    style: {
      background: `${C.teal}1A`,
      color: C.tealDark
    }
  }, t.testTypeName))), !!sample.linkedTestRecordIds.length && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-1.5",
    style: {
      color: C.muted
    }
  }, "Linked test records: ", sample.linkedTestRecordIds.length, " (see Test Records tab)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: {
      color: C.ink
    }
  }, "Chain of Custody"), /*#__PURE__*/React.createElement(CustodyTimeline, {
    events: sample.custodyLog
  })), sample.approvals.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: {
      color: C.ink
    }
  }, "Approval History"), sample.approvals.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    className: "text-xs mb-1.5 p-2 rounded",
    style: {
      background: C.bg,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-medium",
    style: {
      color: a.decision === "approved" ? C.ok : C.warn
    }
  }, a.step === "review" ? "Review" : "Approval", ": ", a.decision), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.muted
    }
  }, new Date(a.ts).toLocaleString())), /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.muted
    }
  }, "Signed by ", a.signature.signedName, " (", a.byRole, ")"), a.comment && /*#__PURE__*/React.createElement("div", {
    className: "mt-0.5",
    style: {
      color: C.ink
    }
  }, a.comment))))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, sample.status === "received" && perms.canAssign && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: {
      color: C.ink
    }
  }, "Assign Technician"), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    value: assignee,
    onChange: setAssignee,
    options: technicians.map(t => t.name),
    placeholder: "Select technician"
  }), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    className: "mt-2",
    disabled: !assignee,
    onClick: () => guardedUpdate(() => assignSample(sample, assignee, session), `Assigned to ${assignee}.`)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 12
  }), "Assign")), !!allowedNext.length && !["received", "results_entered", "under_review"].includes(sample.status) && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: {
      color: C.ink
    }
  }, "Move Status"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5"
  }, allowedNext.map(s => /*#__PURE__*/React.createElement(Button, {
    key: s,
    size: "sm",
    variant: "outline",
    onClick: () => guardedUpdate(() => transitionSample(sample, s, {}, session), `Status updated to ${sampleStatusMeta(s).label}.`)
  }, sampleStatusMeta(s).label)))), step && (canActOnStep ? /*#__PURE__*/React.createElement(SignatureCapture, {
    user: session,
    label: step === "review" ? "Technical Review" : "Final Approval",
    onConfirm: sig => guardedUpdate(() => addApproval(sample, {
      step,
      ...sig
    }, session), "Decision recorded.")
  }) : /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.bg,
      color: C.muted,
      border: `1px solid ${C.border}`
    }
  }, "Waiting on a ", step === "review" ? "Reviewer" : "QA Manager / Administrator", " to sign off.")), sample.status === "approved" && perms.canRelease && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: {
      color: C.ink
    }
  }, "Release Results"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => guardedUpdate(() => releaseResults(sample, session, ""), "Results released.")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "printer",
    size: 12
  }), "Release to Client")), sample.status === "released" && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.okBg,
      color: C.ok,
      border: `1px solid ${C.ok}`
    }
  }, "Released by ", sample.resultRelease.releasedBy, " on ", new Date(sample.resultRelease.releasedAt).toLocaleString(), "."))));
}

// ---- manual batch registration: shared fields once + repeatable per-sample rows ----
function BatchRegistrationForm({
  testTypes,
  onCreate,
  onClose
}) {
  const [shared, setShared] = React.useState({
    clientName: "",
    matrix: "Drinking Water",
    district: "",
    upazila: "",
    union: "",
    collectionDate: todayStr(),
    collectedBy: "",
    receivedDate: todayStr(),
    priority: "Routine",
    batchRef: ""
  });
  const [selectedTests, setSelectedTests] = React.useState([]);
  const [rows, setRows] = React.useState([{
    village: "",
    caretakerName: "",
    sampleSourceId: ""
  }]);
  const [err, setErr] = React.useState("");
  function toggleTest(t) {
    setSelectedTests(prev => prev.some(x => x.testTypeId === t.id) ? prev.filter(x => x.testTypeId !== t.id) : [...prev, {
      testTypeId: t.id,
      testTypeName: t.name
    }]);
  }
  function updateRow(i, field, value) {
    setRows(prev => prev.map((r, idx) => idx === i ? {
      ...r,
      [field]: value
    } : r));
  }
  function addRow() {
    setRows(prev => [...prev, {
      village: "",
      caretakerName: "",
      sampleSourceId: ""
    }]);
  }
  function removeRow(i) {
    setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }
  function duplicateLastRow() {
    setRows(prev => [...prev, {
      ...prev[prev.length - 1]
    }]);
  }
  function submit() {
    if (!shared.clientName.trim()) {
      setErr("Client / requester is required.");
      return;
    }
    if (rows.every(r => !r.village.trim() && !r.caretakerName.trim())) {
      setErr("Fill in at least one sample row (Village/Ward or Caretaker Name).");
      return;
    }
    const validRows = rows.filter(r => r.village.trim() || r.caretakerName.trim());
    onCreate({
      ...shared,
      requestedTests: selectedTests
    }, validRows);
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Register Batch (multiple samples, shared info)",
    onClose: onClose,
    wide: true
  }, err && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mb-3",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, err), /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Shared Info (applies to every sample in this batch)"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3 mb-3",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Client / Requester",
    value: shared.clientName,
    onChange: v => setShared({
      ...shared,
      clientName: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Batch Ref (e.g. Memo No.)",
    value: shared.batchRef,
    onChange: v => setShared({
      ...shared,
      batchRef: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "District",
    value: shared.district,
    onChange: v => setShared({
      ...shared,
      district: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Upazila / City Corporation",
    value: shared.upazila,
    onChange: v => setShared({
      ...shared,
      upazila: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Union / Pourashava",
    value: shared.union,
    onChange: v => setShared({
      ...shared,
      union: v
    })
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Matrix",
    value: shared.matrix,
    onChange: v => setShared({
      ...shared,
      matrix: v
    }),
    options: ["Drinking Water", "Surface Water", "Wastewater", "Groundwater", "Other"].map(m => ({
      value: m,
      label: m
    }))
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collection Date",
    type: "date",
    value: shared.collectionDate,
    onChange: v => setShared({
      ...shared,
      collectionDate: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Received Date",
    type: "date",
    value: shared.receivedDate,
    onChange: v => setShared({
      ...shared,
      receivedDate: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collected By",
    value: shared.collectedBy,
    onChange: v => setShared({
      ...shared,
      collectedBy: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Requested Tests (applies to every sample)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 mb-4"
  }, testTypes.map(t => /*#__PURE__*/React.createElement("label", {
    key: t.id,
    className: "flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer",
    style: {
      border: `1px solid ${selectedTests.some(x => x.testTypeId === t.id) ? C.teal : C.border}`,
      background: selectedTests.some(x => x.testTypeId === t.id) ? `${C.teal}14` : "transparent"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedTests.some(x => x.testTypeId === t.id),
    onChange: () => toggleTest(t)
  }), t.name))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold",
    style: {
      color: C.ink
    }
  }, "Per-Sample Rows (", rows.length, ") — only what differs per sample"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: duplicateLastRow
  }, "Duplicate Last Row"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: addRow
  }, "+ Add Row"))), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1.5 max-h-56 overflow-y-auto p-1"
  }, rows.map((row, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "flex gap-2 items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs w-5",
    style: {
      color: C.muted
    }
  }, i + 1), /*#__PURE__*/React.createElement("input", {
    className: "border rounded px-2 py-1 text-xs flex-1",
    style: {
      borderColor: C.border
    },
    placeholder: "Village/Ward",
    value: row.village,
    onChange: e => updateRow(i, "village", e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    className: "border rounded px-2 py-1 text-xs flex-1",
    style: {
      borderColor: C.border
    },
    placeholder: "Caretaker Name",
    value: row.caretakerName,
    onChange: e => updateRow(i, "caretakerName", e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    className: "border rounded px-2 py-1 text-xs flex-1",
    style: {
      borderColor: C.border
    },
    placeholder: "Sample Source (e.g. STW-6)",
    value: row.sampleSourceId,
    onChange: e => updateRow(i, "sampleSourceId", e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeRow(i),
    title: "Remove row",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 14
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: submit
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Register ", rows.filter(r => r.village.trim() || r.caretakerName.trim()).length, " Sample(s)")));
}

// ---- shown right after a bulk manifest file is picked: choose which tests
// apply to every row in that file (checkbox multi-select, same pattern as
// Register New Sample / Register Batch — no more typing test names) ----
function ImportTestPickerModal({
  testTypes,
  rowCount,
  onConfirm,
  onClose
}) {
  const [selectedTests, setSelectedTests] = React.useState([]);
  const [err, setErr] = React.useState("");
  function toggleTest(t) {
    setSelectedTests(prev => prev.some(x => x.testTypeId === t.id) ? prev.filter(x => x.testTypeId !== t.id) : [...prev, {
      testTypeId: t.id,
      testTypeName: t.name
    }]);
  }
  function submit() {
    if (!selectedTests.length) {
      setErr("Select at least one requested test.");
      return;
    }
    onConfirm(selectedTests);
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Requested Tests for ${rowCount} Imported Sample(s)`,
    onClose: onClose
  }, err && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mb-3",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, err), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, "These tests will be applied to every sample in this upload (same as one physical manifest sheet requesting one panel)."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 mb-4"
  }, testTypes.map(t => /*#__PURE__*/React.createElement("label", {
    key: t.id,
    className: "flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer",
    style: {
      border: `1px solid ${selectedTests.some(x => x.testTypeId === t.id) ? C.teal : C.border}`,
      background: selectedTests.some(x => x.testTypeId === t.id) ? `${C.teal}14` : "transparent"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedTests.some(x => x.testTypeId === t.id),
    onChange: () => toggleTest(t)
  }), t.name))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: submit
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Import ", rowCount, " Sample(s)")));
}

// ---- main tab: list + registration + detail ----
function SamplesTab({
  samples,
  setSamples,
  testTypes,
  testRecords,
  subBatches,
  setSubBatches,
  equipment,
  users,
  session,
  notify
}) {
  const [sampleSubTab, setSampleSubTab] = React.useState("samples");
  const [showForm, setShowForm] = React.useState(false);
  const [showBatchForm, setShowBatchForm] = React.useState(false);
  const bulkUploadInputRef = React.useRef(null);
  const [openId, setOpenId] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [q, setQ] = React.useState("");
  const [expandedBatches, setExpandedBatches] = React.useState(new Set());
  const [pendingImportRows, setPendingImportRows] = React.useState(null);
  const [pendingImportSkipped, setPendingImportSkipped] = React.useState(0);
  const perms = permissionsFor(session.role);
  const openSample = samples.find(s => s.id === openId) || null;
  const filtered = samples.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (q && !`${s.sampleCode} ${s.clientName} ${s.siteLocation}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
  function toggleBatchExpand(ref) {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);else next.add(ref);
      return next;
    });
  }
  // Group filtered samples by batchRef (bulk upload / Register Batch) while
  // keeping individually-registered samples (no batchRef) as plain rows, all
  // in original sort order (position = first/most-recent member encountered).
  const batchGroups = {};
  filtered.forEach(s => {
    if (s.batchRef) (batchGroups[s.batchRef] = batchGroups[s.batchRef] || []).push(s);
  });
  const listItems = [];
  const seenBatchRefs = new Set();
  filtered.forEach(s => {
    if (s.batchRef) {
      if (seenBatchRefs.has(s.batchRef)) return;
      seenBatchRefs.add(s.batchRef);
      listItems.push({
        type: "batch",
        batchRef: s.batchRef,
        members: batchGroups[s.batchRef]
      });
    } else {
      listItems.push({
        type: "single",
        sample: s
      });
    }
  });
  async function handleCreate(fields) {
    const sample = createSample(fields, samples, session);
    await setSamples(prev => [sample, ...prev], sample);
    setShowForm(false);
    notify?.(`${sample.sampleCode} registered.`, "ok");
  }
  // Step 1: just read the workbook and stage the rows — test selection now
  // happens via a checkbox window (same UX as Register Sample/Batch) instead
  // of a typed "RequestedTests" column.
  function importSamples(file) {
    readWorkbook(file, (err, rows) => {
      if (err) return notify("Could not read Excel file", "warn");
      const usableRows = rows.filter(row => String(row.ClientName || row["Client Name"] || "").trim() && String(row.SiteLocation || row["Site Location"] || "").trim());
      const skipped = rows.length - usableRows.length;
      if (!usableRows.length) return notify("No usable rows found (need Client Name and Site Location in every row).", "warn");
      setPendingImportRows(usableRows);
      setPendingImportSkipped(skipped);
    });
  }
  // Step 2: after the tester picks tests in ImportTestPickerModal, actually
  // create the samples — every row gets the same requestedTests, same as one
  // physical manifest sheet requesting the same panel for the whole batch.
  async function confirmImportSamples(requestedTests) {
    let runningSamples = [...samples];
    let count = 0;
    for (const row of pendingImportRows) {
      const sample = createSample({
        clientName: String(row.ClientName || row["Client Name"] || "").trim(),
        siteLocation: String(row.SiteLocation || row["Site Location"] || "").trim(),
        district: String(row.District || "").trim(),
        upazila: String(row.Upazila || row["Upazila/City Corporation"] || "").trim(),
        union: String(row.Union || row["Union/Pourashava"] || "").trim(),
        village: String(row.Village || row["Village/Ward"] || "").trim(),
        caretakerName: String(row.CaretakerName || row["Caretaker Name"] || "").trim(),
        sampleSourceId: String(row.SampleSource || row["Sample Source"] || "").trim(),
        batchRef: String(row.BatchRef || row["Batch Ref"] || "").trim(),
        matrix: String(row.Matrix || "Drinking Water").trim(),
        collectionDate: String(row.CollectionDate || todayStr()),
        collectedBy: String(row.CollectedBy || "").trim(),
        receivedDate: String(row.ReceivedDate || todayStr()),
        priority: String(row.Priority || "Routine").trim(),
        numberOfSamples: 1,
        requestedTests,
        notes: String(row.Notes || "").trim()
      }, runningSamples, session);
      runningSamples = [...runningSamples, sample];
      await setSamples(prev => [...prev, sample], sample);
      count++;
    }
    notify(`Imported ${count} sample(s) from manifest${pendingImportSkipped ? `, skipped ${pendingImportSkipped} row(s) missing Client Name/Site Location` : ""}.`, count ? "ok" : "warn");
    setPendingImportRows(null);
    setPendingImportSkipped(0);
  }
  async function handleUpdate(next) {
    await setSamples(prev => prev.map(s => s.id === next.id ? next : s), next);
  }
  async function handleBatchCreate(shared, rows) {
    let runningSamples = [...samples];
    let count = 0;
    for (const row of rows) {
      const sample = createSample({
        ...shared,
        village: row.village,
        caretakerName: row.caretakerName,
        sampleSourceId: row.sampleSourceId,
        numberOfSamples: 1
      }, runningSamples, session);
      runningSamples = [...runningSamples, sample];
      await setSamples(prev => [...prev, sample], sample);
      count++;
    }
    setShowBatchForm(false);
    notify?.(`${count} sample(s) registered under batch ${shared.batchRef || "(no ref)"}.`, "ok");
  }
  const stats = sampleLifecycleStats(samples);
  function renderSampleRow(s, indented) {
    return /*#__PURE__*/React.createElement("tr", {
      key: s.id,
      className: "cursor-pointer",
      style: {
        borderTop: `1px solid ${C.border}`,
        background: indented ? C.card : "transparent"
      },
      onClick: () => setOpenId(s.id)
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2 font-medium",
      style: {
        color: C.ink,
        paddingLeft: indented ? 28 : undefined
      }
    }, s.sampleCode), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2",
      style: {
        color: C.ink
      }
    }, s.clientName), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2",
      style: {
        color: C.muted
      }
    }, s.siteLocation), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2",
      style: {
        color: C.muted
      }
    }, s.matrix), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2"
    }, /*#__PURE__*/React.createElement(PriorityBadge, {
      priority: s.priority
    })), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2"
    }, /*#__PURE__*/React.createElement(SampleStatusBadge, {
      status: s.status
    })), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2",
      style: {
        color: C.muted
      }
    }, s.assignedTo || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2 text-right"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevronRight",
      size: 14,
      color: C.muted
    })));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-4 flex-wrap"
  }, [{
    k: "samples",
    label: "Samples",
    icon: "beaker"
  }, {
    k: "subBatches",
    label: "Create and Edit Sub-Batches",
    icon: "flask"
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    onClick: () => setSampleSubTab(t.k),
    className: "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium",
    style: {
      background: sampleSubTab === t.k ? C.teal : "#fff",
      color: sampleSubTab === t.k ? "#fff" : C.muted,
      border: `1px solid ${sampleSubTab === t.k ? C.teal : C.border}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: t.icon,
    size: 14
  }), t.label))), sampleSubTab === "samples" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between mb-3 flex-wrap gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "text-base font-bold",
    style: {
      color: C.ink
    }
  }, "Sample Lifecycle"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mt-0.5",
    style: {
      color: C.muted
    }
  }, "Registration, chain of custody, assignment, approval and result release.")), perms.canRegister && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: () => setShowBatchForm(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 13
  }), "Register Batch"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setShowForm(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 13
  }), "Register New Sample"))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => downloadTemplate("samples")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 14
  }), "Download Manifest Template"), perms.canRegister && /*#__PURE__*/React.createElement("input", {
    ref: bulkUploadInputRef,
    type: "file",
    accept: ".xlsx,.xls,.csv",
    className: "hidden",
    onChange: e => {
      if (e.target.files[0]) importSamples(e.target.files[0]);
      e.target.value = "";
    }
  }), perms.canRegister && /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => bulkUploadInputRef.current && bulkUploadInputRef.current.click()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 14
  }), "Bulk Upload Samples")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-4 gap-3 mb-4"
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Active Samples",
    value: stats.activeCount,
    icon: "beaker"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Pending Review",
    value: stats.pendingApproval,
    icon: "chart",
    tone: stats.pendingApproval ? "warn" : "ink"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Awaiting Release",
    value: stats.awaitingRelease,
    icon: "printer"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Overdue",
    value: stats.overdue,
    icon: "warning",
    tone: stats.overdue ? "warn" : "ink"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search sample code, client, site…",
    className: "px-3 py-1.5 rounded text-sm",
    style: {
      border: `1px solid ${C.border}`,
      background: C.card,
      color: C.ink,
      minWidth: 240
    }
  }), /*#__PURE__*/React.createElement("select", {
    value: statusFilter,
    onChange: e => setStatusFilter(e.target.value),
    className: "px-2 py-1.5 rounded text-sm",
    style: {
      border: `1px solid ${C.border}`,
      background: C.card,
      color: C.ink
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All statuses"), SAMPLE_STATUSES.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.key,
    value: s.key
  }, s.label)))), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg overflow-hidden",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: C.bg
    }
  }, ["Sample Code", "Client", "Site", "Matrix", "Priority", "Status", "Assigned To", ""].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-3 py-2 text-xs font-semibold",
    style: {
      color: C.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, listItems.map(item => {
    if (item.type === "single") return renderSampleRow(item.sample, false);
    const isOpen = expandedBatches.has(item.batchRef);
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: "batch-" + item.batchRef
    }, /*#__PURE__*/React.createElement("tr", {
      className: "cursor-pointer",
      style: {
        borderTop: `1px solid ${C.border}`,
        background: C.bg
      },
      onClick: () => toggleBatchExpand(item.batchRef)
    }, /*#__PURE__*/React.createElement("td", {
      colSpan: 8,
      className: "px-3 py-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 flex-wrap"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: isOpen ? "chevronDown" : "chevronRight",
      size: 14,
      color: C.muted
    }), /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 14,
      color: C.teal
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-semibold",
      style: {
        color: C.ink
      }
    }, "Batch: ", item.batchRef), /*#__PURE__*/React.createElement("span", {
      className: "text-xs",
      style: {
        color: C.muted
      }
    }, item.members.length, " sample(s)"), /*#__PURE__*/React.createElement("span", {
      className: "flex-1"
    }), /*#__PURE__*/React.createElement(BatchStatusSummary, {
      members: item.members
    })))), isOpen && item.members.map(s => renderSampleRow(s, true)));
  }), !listItems.length && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 8,
    className: "px-3 py-8 text-center text-sm",
    style: {
      color: C.muted
    }
  }, "No samples match. Register one to get started.")))))), sampleSubTab === "subBatches" && /*#__PURE__*/React.createElement(SubBatchBuilder, {
    samples: samples,
    testTypes: testTypes,
    subBatches: subBatches,
    setSubBatches: setSubBatches,
    users: users,
    notify: notify
  }), showForm && /*#__PURE__*/React.createElement(SampleRegistrationForm, {
    testTypes: testTypes,
    onCreate: handleCreate,
    onClose: () => setShowForm(false)
  }), showBatchForm && /*#__PURE__*/React.createElement(BatchRegistrationForm, {
    testTypes: testTypes,
    onCreate: handleBatchCreate,
    onClose: () => setShowBatchForm(false)
  }), pendingImportRows && /*#__PURE__*/React.createElement(ImportTestPickerModal, {
    testTypes: testTypes,
    rowCount: pendingImportRows.length,
    onConfirm: confirmImportSamples,
    onClose: () => {
      setPendingImportRows(null);
      setPendingImportSkipped(0);
    }
  }), openSample && /*#__PURE__*/React.createElement(SampleDetail, {
    sample: openSample,
    users: users,
    session: session,
    testTypes: testTypes,
    testRecords: testRecords,
    onClose: () => setOpenId(null),
    onUpdate: handleUpdate,
    notify: notify
  }));
}

// ---- Sub-Batches sub-view: group pending samples for one method into a
// persistent, named batch that Add Test Record can later consume as a unit ----
function SUB_BATCH_STATUS_BADGE(status) {
  if (status === "tested") return /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11
  }), " Tested");
  return /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 11
  }), " Pending");
}
function SubBatchBuilder({
  samples,
  testTypes,
  subBatches,
  setSubBatches,
  users,
  notify
}) {
  const [selectedTestId, setSelectedTestId] = React.useState("");
  const [selectedBatchRefs, setSelectedBatchRefs] = React.useState([]);
  const [selectedSampleIds, setSelectedSampleIds] = React.useState([]);
  const [label, setLabel] = React.useState("");
  const [assignedTester, setAssignedTester] = React.useState("");
  const [autoCount, setAutoCount] = React.useState("");
  const [editingSubBatchId, setEditingSubBatchId] = React.useState(null);
  const [deleteSubBatchId, setDeleteSubBatchId] = React.useState(null);

  // Samples eligible for the chosen Test Type — ignoring the sub-batch's own
  // current membership while it's being edited (otherwise its members would
  // wrongly look "already used" and disappear from the picker).
  const eligibleForTest = selectedTestId ? samples.filter(s => SUBBATCH_ELIGIBLE_STATUSES.includes(s.status) && s.requestedTests.some(rt => rt.testTypeId === selectedTestId) && !subBatches.some(sb => sb.status === "pending" && sb.id !== editingSubBatchId && sb.memberSampleIds.includes(s.id))) : [];
  // Registration batches (BatchRef) available to filter by, scoped to the
  // Test Type above — a batch can carry several test types, so this narrows
  // to only batches that actually have samples requesting THIS test.
  const batchRefOptions = Array.from(new Set(eligibleForTest.map(s => s.batchRef).filter(Boolean))).sort();
  const eligibleSamples = selectedBatchRefs.length ? eligibleForTest.filter(s => selectedBatchRefs.includes(s.batchRef)) : eligibleForTest;
  const distinctBatchRefs = Array.from(new Set(samples.filter(s => selectedSampleIds.includes(s.id)).map(s => s.batchRef).filter(Boolean)));
  function toggleMember(id) {
    setSelectedSampleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleBatchRefFilter(ref) {
    setSelectedBatchRefs(prev => prev.includes(ref) ? prev.filter(x => x !== ref) : [...prev, ref]);
  }
  // "No. of samples" auto-pick — takes that many not-yet-selected eligible
  // samples (in list order). If fewer are available (odd/short batch), it
  // takes all it can and tells the tester so the remainder can go in a
  // separate sub-batch instead of silently under-filling.
  function autoSelect() {
    const n = parseInt(autoCount, 10);
    if (!n || n <= 0) {
      notify?.("Enter a valid number of samples first.", "warn");
      return;
    }
    const notYetSelected = eligibleSamples.filter(s => !selectedSampleIds.includes(s.id));
    const take = notYetSelected.slice(0, n).map(s => s.id);
    setSelectedSampleIds(prev => [...prev, ...take]);
    if (take.length < n) {
      notify?.(`Only ${take.length} eligible sample(s) were available (asked for ${n}) — added all of them. Put the remainder in a second sub-batch.`, "warn");
    } else {
      notify?.(`Added ${take.length} sample(s).`, "ok");
    }
    setAutoCount("");
  }
  function resetForm() {
    setSelectedTestId("");
    setSelectedBatchRefs([]);
    setSelectedSampleIds([]);
    setLabel("");
    setAssignedTester("");
    setAutoCount("");
    setEditingSubBatchId(null);
  }
  function startEdit(sb) {
    setSelectedTestId(sb.testTypeId);
    setSelectedBatchRefs([]);
    setSelectedSampleIds(sb.memberSampleIds || []);
    setLabel(sb.label);
    setAssignedTester(sb.assignedTester || "");
    setEditingSubBatchId(sb.id);
  }
  function createGroup() {
    if (!selectedTestId || selectedSampleIds.length === 0) {
      notify?.("Pick a test type and at least one sample.", "warn");
      return;
    }
    const test = testTypes.find(t => t.id === selectedTestId);
    if (editingSubBatchId) {
      setSubBatches(prev => prev.map(sb => sb.id === editingSubBatchId ? {
        ...sb,
        label: label.trim() || sb.label,
        testTypeId: selectedTestId,
        testTypeName: test?.name || sb.testTypeName,
        memberSampleIds: selectedSampleIds,
        assignedTester
      } : sb));
      notify?.(`${label.trim() || "Sub-batch"} updated — now ${selectedSampleIds.length} sample(s).`, "ok");
    } else {
      const sb = createSubBatch({
        label: label.trim(),
        testTypeId: selectedTestId,
        testTypeName: test?.name || "",
        memberSampleIds: selectedSampleIds,
        assignedTester
      }, subBatches);
      setSubBatches(prev => [sb, ...prev]);
      notify?.(`${sb.label} created with ${selectedSampleIds.length} sample(s).`, "ok");
    }
    resetForm();
  }
  function updateAssignedTester(sbId, tester) {
    setSubBatches(prev => prev.map(sb => sb.id === sbId ? {
      ...sb,
      assignedTester: tester
    } : sb));
  }
  function doDeleteSubBatch(sb) {
    setSubBatches(prev => prev.filter(x => x.id !== sb.id));
    setDeleteSubBatchId(null);
    if (editingSubBatchId === sb.id) resetForm();
    notify?.(`${sb.label} deleted.`, "ok");
  }
  const filterFields = /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
    }
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Test Type",
    value: selectedTestId,
    onChange: v => {
      setSelectedTestId(v);
      setSelectedBatchRefs([]);
      setSelectedSampleIds([]);
    },
    options: testTypes.map(t => ({
      value: t.id,
      label: t.name
    })),
    placeholder: "Select a method"
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Sub-Batch Label (optional)",
    value: label,
    onChange: v => setLabel(v),
    placeholder: "auto-generated if left blank"
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Assign Tester",
    value: assignedTester,
    onChange: v => setAssignedTester(v),
    options: users.map(u => ({
      value: u.name,
      label: `${u.name} (${u.designation || u.role})`
    })),
    placeholder: "Unassigned"
  }));

  const batchFilterBlock = batchRefOptions.length > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "mb-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Filter by Registration Batch (optional — pick one or more)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, batchRefOptions.map(ref => /*#__PURE__*/React.createElement("label", {
    key: ref,
    className: "flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer",
    style: {
      border: `1px solid ${selectedBatchRefs.includes(ref) ? C.teal : C.border}`,
      background: selectedBatchRefs.includes(ref) ? `${C.teal}14` : "transparent"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedBatchRefs.includes(ref),
    onChange: () => toggleBatchRefFilter(ref)
  }), ref)))) : null;

  const pickerHeaderRow = /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-1.5 flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold",
    style: {
      color: C.ink
    }
  }, "Select Samples (", selectedSampleIds.length, " of ", eligibleSamples.length, ")"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 1,
    placeholder: "No. of samples",
    value: autoCount,
    onChange: e => setAutoCount(e.target.value),
    className: "border rounded px-2 py-1 text-xs w-28",
    style: {
      borderColor: C.border
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: autoSelect
  }, "Auto-Select"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedSampleIds(eligibleSamples.map(s => s.id))
  }, "Select All"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedSampleIds([])
  }, "Clear")));

  const pickerListBox = /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1 max-h-56 overflow-y-auto p-1 rounded",
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
  }, s.clientName, s.batchRef ? ` · batch: ${s.batchRef}` : ""))));

  const mixedBatchWarning = distinctBatchRefs.length > 1 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mt-2",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, "Heads up: this sub-batch mixes samples from ", distinctBatchRefs.length, " different registration batches (", distinctBatchRefs.join(", "), "). That's fine for testing — each sample keeps its own batch reference for reporting.") : null;

  const actionRow = /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-3"
  }, editingSubBatchId && /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: resetForm
  }, "Cancel Edit"), /*#__PURE__*/React.createElement(Button, {
    onClick: createGroup
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), editingSubBatchId ? "Save Changes" : `Create Sub-Batch (${selectedSampleIds.length})`));

  const pickerBlock = !selectedTestId ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-3 rounded mt-3",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Pick a Test Type to see eligible pending samples.") : /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, batchFilterBlock, eligibleSamples.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-3 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "No pending samples match this Test Type", selectedBatchRefs.length ? " + Batch filter" : "", " (or all are already in another pending sub-batch).") : /*#__PURE__*/React.createElement("div", null, pickerHeaderRow, pickerListBox, mixedBatchWarning, actionRow));

  const createCard = /*#__PURE__*/React.createElement(SectionCard, {
    title: editingSubBatchId ? "Edit Sub-Batch" : "Create a Sub-Batch",
    subtitle: "Group pending samples requesting the same test into one batch — shares one QC check, tested together in Add Test Record.",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 15
    })
  }, filterFields, pickerBlock);

  function renderSubBatchRow(sb) {
    const testerControl = sb.status === "pending" ? /*#__PURE__*/React.createElement("select", {
      className: "border rounded px-2 py-1 text-xs",
      style: {
        borderColor: C.border
      },
      value: sb.assignedTester,
      onChange: e => updateAssignedTester(sb.id, e.target.value)
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Unassigned"), users.map(u => /*#__PURE__*/React.createElement("option", {
      key: u.id,
      value: u.name
    }, u.name))) : /*#__PURE__*/React.createElement("span", {
      className: "text-xs",
      style: {
        color: C.muted
      }
    }, sb.assignedTester || "—");
    return /*#__PURE__*/React.createElement("div", {
      key: sb.id,
      className: "px-3 py-2 rounded",
      style: {
        border: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between gap-2"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "text-xs font-semibold",
      style: {
        color: C.ink
      }
    }, sb.label, " · ", sb.testTypeName), /*#__PURE__*/React.createElement("div", {
      className: "text-[11px]",
      style: {
        color: C.muted
      }
    }, sb.memberSampleIds.length, " samples · created ", new Date(sb.createdAt).toLocaleDateString())), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, testerControl, SUB_BATCH_STATUS_BADGE(sb.status), /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: sb.status === "pending" ? "Edit sub-batch" : "Only pending sub-batches can be edited (this one is already tested)",
      disabled: sb.status !== "pending",
      onClick: () => startEdit(sb)
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: sb.status === "pending" ? "Delete sub-batch" : "Delete the linked test record first to remove a tested sub-batch",
      disabled: sb.status !== "pending",
      onClick: () => setDeleteSubBatchId(sb.id)
    }))), deleteSubBatchId === sb.id && /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete sub-batch "${sb.label}"? Its ${sb.memberSampleIds.length} member sample(s) become available for another sub-batch again.`,
      onConfirm: () => doDeleteSubBatch(sb),
      onCancel: () => setDeleteSubBatchId(null)
    }));
  }

  const listCard = /*#__PURE__*/React.createElement(SectionCard, {
    title: "All Sub-Batches",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 15
    })
  }, subBatches.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "No sub-batches created yet.") : /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1.5"
  }, subBatches.map(sb => renderSubBatchRow(sb))));

  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, createCard, listCard);
}
