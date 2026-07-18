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

// ---- Registration form ----
function SampleRegistrationForm({
  testTypes,
  onCreate,
  onClose
}) {
  const [form, setForm] = React.useState({
    clientName: "",
    siteLocation: "",
    matrix: "Drinking Water",
    collectionDate: todayStr(),
    collectedBy: "",
    receivedDate: todayStr(),
    priority: "Routine",
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
  }, sample.matrix, " · ", sample.siteLocation)), qcWarnings.length > 0 && /*#__PURE__*/React.createElement("div", {
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

// ---- main tab: list + registration + detail ----
function SamplesTab({
  samples,
  setSamples,
  testTypes,
  testRecords,
  users,
  session,
  notify
}) {
  const [showForm, setShowForm] = React.useState(false);
  const [openId, setOpenId] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [q, setQ] = React.useState("");
  const perms = permissionsFor(session.role);
  const openSample = samples.find(s => s.id === openId) || null;
  const filtered = samples.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (q && !`${s.sampleCode} ${s.clientName} ${s.siteLocation}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
  async function handleCreate(fields) {
    const sample = createSample(fields, samples, session);
    await setSamples(prev => [sample, ...prev], sample);
    setShowForm(false);
    notify?.(`${sample.sampleCode} registered.`, "ok");
  }
  async function handleUpdate(next) {
    await setSamples(prev => prev.map(s => s.id === next.id ? next : s), next);
  }
  const stats = sampleLifecycleStats(samples);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between mb-4 flex-wrap gap-3"
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
  }, "Registration, chain of custody, assignment, approval and result release.")), perms.canRegister && /*#__PURE__*/React.createElement(Button, {
    onClick: () => setShowForm(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 13
  }), "Register New Sample")), /*#__PURE__*/React.createElement("div", {
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
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.id,
    className: "cursor-pointer",
    style: {
      borderTop: `1px solid ${C.border}`
    },
    onClick: () => setOpenId(s.id)
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-3 py-2 font-medium",
    style: {
      color: C.ink
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
  })))), !filtered.length && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 8,
    className: "px-3 py-8 text-center text-sm",
    style: {
      color: C.muted
    }
  }, "No samples match. Register one to get started."))))), showForm && /*#__PURE__*/React.createElement(SampleRegistrationForm, {
    testTypes: testTypes,
    onCreate: handleCreate,
    onClose: () => setShowForm(false)
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
