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
  references,
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
    referenceId: "",
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
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Reference (who sent this sample) — optional",
    value: form.referenceId,
    onChange: v => setForm({
      ...form,
      referenceId: v
    }),
    options: (references || []).map(r => ({
      value: r.id,
      label: referenceDisplayLabel(r)
    })),
    placeholder: "No reference / walk-in"
  }), /*#__PURE__*/React.createElement(TextField, {
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


// ---- Edit an existing sample's registration fields (fixes typos from manual
// or bulk-upload registration). Requested tests that already have a result
// (direct or via a tested Sub-Batch) can't be unchecked here — removing a
// test that's already been run would orphan that result silently.
function EditSampleForm({
  sample,
  testTypes,
  testRecords,
  references,
  onSave,
  onClose
}) {
  const [form, setForm] = React.useState({
    clientName: sample.clientName || "",
    siteLocation: sample.siteLocation || "",
    district: sample.district || "",
    upazila: sample.upazila || "",
    union: sample.union || "",
    village: sample.village || "",
    caretakerName: sample.caretakerName || "",
    sampleSourceId: sample.sampleSourceId || "",
    referenceId: sample.referenceId || "",
    matrix: sample.matrix || "Drinking Water",
    collectionDate: sample.collectionDate || todayStr(),
    collectedBy: sample.collectedBy || "",
    receivedDate: sample.receivedDate || todayStr(),
    priority: sample.priority || "Routine",
    notes: sample.notes || ""
  });
  const [selectedTests, setSelectedTests] = React.useState(sample.requestedTests || []);
  const [err, setErr] = React.useState("");
  function testLocked(t) {
    return !!getSampleResultForTest(sample, t.id, testRecords);
  }
  function toggleTest(t) {
    if (testLocked(t)) return; // already has a result — can't be removed here
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
    onSave({
      ...sample,
      ...form,
      requestedTests: selectedTests
    });
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Edit Sample — ${sample.sampleCode}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Reference (who sent this sample) — optional",
    value: form.referenceId,
    onChange: v => setForm({
      ...form,
      referenceId: v
    }),
    options: (references || []).map(r => ({
      value: r.id,
      label: referenceDisplayLabel(r)
    })),
    placeholder: "No reference / walk-in"
  }), /*#__PURE__*/React.createElement(TextField, {
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
    const locked = testLocked(t);
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => toggleTest(t),
      disabled: locked,
      title: locked ? "Already has a result — remove the test record first to change this." : undefined,
      className: "px-2.5 py-1 rounded-full text-xs font-medium border",
      style: {
        background: on ? C.teal : "transparent",
        color: on ? "#fff" : locked ? C.muted : C.ink,
        borderColor: on ? C.teal : C.border,
        opacity: locked ? 0.6 : 1,
        cursor: locked ? "not-allowed" : "pointer"
      }
    }, t.testName || t.name, locked ? " 🔒" : "");
  }))), /*#__PURE__*/React.createElement("div", {
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
  }), "Save Changes")));
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
  subBatches,
  references,
  onClose,
  onUpdate,
  notify
}) {
  const perms = permissionsFor(session.role);
  const allowedNext = nextAllowedStatuses(sample);
  const technicians = users.filter(u => u.role === "Technician" || u.role === "Administrator");
  const [assignee, setAssignee] = React.useState(sample.assignedTo || "");
  const progress = React.useMemo(() => sampleTestProgress(sample, testRecords, subBatches), [sample, testRecords, subBatches]);
  const reference = (references || []).find(r => r.id === sample.referenceId) || null;
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
  }, "Test Progress"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: { color: C.ink }
  }, "Test Progress"), /*#__PURE__*/React.createElement("div", {
    className: "rounded overflow-hidden mb-1.5",
    style: { border: `1px solid ${C.border}` }
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: { background: C.bg }
  }, ["Test", "Stage"].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1 font-semibold",
    style: { color: C.muted }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, progress.tests.map(t => {
    const meta = testProgressMeta(t.stage);
    const toneBg = { ok: C.okBg, warn: C.warnBg, info: C.infoBg, muted: "#EEF4F3" }[meta.color];
    const toneFg = { ok: C.ok, warn: C.warn, info: C.info, muted: C.muted }[meta.color];
    return /*#__PURE__*/React.createElement("tr", {
      key: t.testTypeId,
      style: { borderTop: `1px solid ${C.border}` }
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1 font-medium",
      style: { color: C.ink }
    }, t.testTypeName), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1"
    }, /*#__PURE__*/React.createElement("span", {
      className: "px-1.5 py-0.5 rounded text-[11px] font-semibold",
      style: { background: toneBg, color: toneFg }
    }, meta.label)));
  })))), reference && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-1.5",
    style: { color: C.muted }
  }, "Reference: ", referenceDisplayLabel(reference)), !!sample.linkedTestRecordIds.length && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-1.5",
    style: { color: C.muted }
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
  references,
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
    batchRef: "",
    referenceId: ""
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
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Reference (who sent these) — optional",
    value: shared.referenceId,
    onChange: v => setShared({
      ...shared,
      referenceId: v
    }),
    options: (references || []).map(r => ({
      value: r.id,
      label: referenceDisplayLabel(r)
    })),
    placeholder: "No reference / walk-in"
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
  references,
  setReferences,
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
  const [editingSample, setEditingSample] = React.useState(null);
  const [deletingSampleId, setDeletingSampleId] = React.useState(null);
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
  // Deleting a sample is only safe if nothing else references it — a test
  // result (direct or via a Sub-Batch) or Sub-Batch membership would be
  // orphaned/corrupted otherwise. Block with a clear reason instead.
  function sampleDeleteBlockReason(s) {
    const hasAnyResult = testTypes.some(t => getSampleResultForTest(s, t.id, testRecords));
    if (hasAnyResult) return "This sample already has test result(s) — delete those test records first.";
    const inSubBatch = subBatches.some(sb => (sb.members || []).some(m => m.sampleId === s.id));
    if (inSubBatch) return "This sample is part of a sub-batch — remove it from the sub-batch first.";
    return null;
  }
  async function handleDeleteSample(s) {
    const reason = sampleDeleteBlockReason(s);
    if (reason) { notify?.(reason, "warn"); return; }
    await setSamples(prev => prev.filter(x => x.id !== s.id), null);
    await DataService.remove("samples", s.id);
    await DataService.appendAudit({ entity: "sample", entityId: s.id, sampleCode: s.sampleCode, action: "deleted", user: session.name, role: session.role });
    notify?.(`${s.sampleCode} deleted.`, "ok");
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
    const deleteBlockReason = sampleDeleteBlockReason(s);
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: s.id
    }, /*#__PURE__*/React.createElement("tr", {
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
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-end gap-1",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit sample",
      onClick: () => setEditingSample(s)
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: deleteBlockReason || "Delete sample",
      onClick: () => deleteBlockReason ? notify?.(deleteBlockReason, "warn") : setDeletingSampleId(s.id)
    }), /*#__PURE__*/React.createElement(Icon, {
      name: "chevronRight",
      size: 14,
      color: C.muted
    })))), deletingSampleId === s.id && /*#__PURE__*/React.createElement("tr", {
      key: `${s.id}-confirm`
    }, /*#__PURE__*/React.createElement("td", {
      colSpan: 8
    }, /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete sample "${s.sampleCode}"? This cannot be undone.`,
      onConfirm: () => {
        handleDeleteSample(s);
        setDeletingSampleId(null);
      },
      onCancel: () => setDeletingSampleId(null)
    }))));
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
  }, {
    k: "references",
    label: "References",
    icon: "clipboard"
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
    className: "flex gap-2 flex-wrap items-center"
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
  }), "Register New Sample"), /*#__PURE__*/React.createElement("input", {
    ref: bulkUploadInputRef,
    type: "file",
    accept: ".xlsx,.xls,.csv",
    className: "hidden",
    onChange: e => {
      if (e.target.files[0]) importSamples(e.target.files[0]);
      e.target.value = "";
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: () => bulkUploadInputRef.current && bulkUploadInputRef.current.click()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 13
  }), "Bulk Upload Samples"))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mb-3"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => downloadTemplate("samples")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 14
  }), "Download Manifest Template")), /*#__PURE__*/React.createElement("div", {
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
    testRecords: testRecords,
    users: users,
    notify: notify
  }), sampleSubTab === "references" && /*#__PURE__*/React.createElement(ReferencesPanel, {
    references: references,
    setReferences: setReferences,
    samples: samples,
    session: session,
    notify: notify
  }), showForm && /*#__PURE__*/React.createElement(SampleRegistrationForm, {
    testTypes: testTypes,
    references: references,
    onCreate: handleCreate,
    onClose: () => setShowForm(false)
  }), showBatchForm && /*#__PURE__*/React.createElement(BatchRegistrationForm, {
    testTypes: testTypes,
    references: references,
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
  }), editingSample && /*#__PURE__*/React.createElement(EditSampleForm, {
    sample: editingSample,
    testTypes: testTypes,
    testRecords: testRecords,
    references: references,
    onSave: async next => {
      await handleUpdate(next);
      setEditingSample(null);
      notify?.(`${next.sampleCode} updated.`, "ok");
    },
    onClose: () => setEditingSample(null)
  }), openSample && /*#__PURE__*/React.createElement(SampleDetail, {
    sample: openSample,
    users: users,
    session: session,
    testTypes: testTypes,
    testRecords: testRecords,
    subBatches: subBatches,
    references: references,
    onClose: () => setOpenId(null),
    onUpdate: handleUpdate,
    notify: notify
  }));
}

// ---- Sub-Batches sub-view: group pending samples for one method into a
// persistent, named batch that Add Test Record can later consume as a unit ----
// ============================================================================
// BATCH BUILDER (Phase B) — build a batch of (sample, test type) pairs, not
// samples-for-one-test-type. Matches how the lab actually brackets samples:
// grab a pile, and whatever each one specifically needs gets checked off.
// ============================================================================
function pairKey(sampleId, testTypeId) {
  return `${sampleId}::${testTypeId}`;
}
function BatchGroupBadge({
  batch,
  testTypeId,
  testTypeName,
  testRecords
}) {
  const status = batchGroupStatus(batch, testTypeId, testRecords);
  const tone = status === "completed" ? "ok" : "info";
  return /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold mr-1 mb-1",
    style: {
      background: tone === "ok" ? C.okBg : C.infoBg,
      color: tone === "ok" ? C.ok : C.info
    }
  }, testTypeName, " — ", status === "completed" ? "Run" : "Pending");
}
function SubBatchBuilder({
  samples,
  testTypes,
  subBatches,
  setSubBatches,
  testRecords,
  users,
  notify
}) {
  const [testTypeFilter, setTestTypeFilter] = React.useState([]); // [] = all test types
  const [selectedBatchRefs, setSelectedBatchRefs] = React.useState([]);
  const [selectedPairs, setSelectedPairs] = React.useState([]); // [{sampleId, testTypeId, testTypeName}]
  const [label, setLabel] = React.useState("");
  const [assignedTester, setAssignedTester] = React.useState("");
  const [autoCount, setAutoCount] = React.useState("");
  const [autoBatchCount, setAutoBatchCount] = React.useState("");
  const [editingBatchId, setEditingBatchId] = React.useState(null);
  const [expandedBatchId, setExpandedBatchId] = React.useState(null);
  const [deleteBatchId, setDeleteBatchId] = React.useState(null);

  // ---- eligible (sample, testType) pairs across the whole pool ----
  const batchRefOptions = Array.from(new Set(samples.map(s => s.batchRef).filter(Boolean))).sort();
  const testTypeOptions = testTypes.map(t => ({
    value: t.id,
    label: t.name
  }));
  function eligiblePairsForSample(sample) {
    return (sample.requestedTests || []).filter(rt => SUBBATCH_ELIGIBLE_STATUSES.includes(sample.status)).filter(rt => testTypeFilter.length === 0 || testTypeFilter.includes(rt.testTypeId)).filter(rt => !sampleAlreadyCommittedForTest(sample, rt.testTypeId, testRecords, subBatches, editingBatchId)).map(rt => ({
      sampleId: sample.id,
      testTypeId: rt.testTypeId,
      testTypeName: rt.testTypeName
    }));
  }
  const filteredSamples = samples.filter(s => selectedBatchRefs.length === 0 || selectedBatchRefs.includes(s.batchRef));
  const samplesWithEligiblePairs = filteredSamples.map(s => ({
    sample: s,
    pairs: eligiblePairsForSample(s)
  })).filter(x => x.pairs.length > 0);
  const allEligiblePairsFlat = samplesWithEligiblePairs.flatMap(x => x.pairs);
  const totalEligiblePairs = allEligiblePairsFlat.length;
  function isPairSelected(sampleId, testTypeId) {
    return selectedPairs.some(p => p.sampleId === sampleId && p.testTypeId === testTypeId);
  }
  function togglePair(pair) {
    setSelectedPairs(prev => isPairSelected(pair.sampleId, pair.testTypeId) ? prev.filter(p => !(p.sampleId === pair.sampleId && p.testTypeId === pair.testTypeId)) : [...prev, pair]);
  }
  function toggleAllForSample(sample, pairs) {
    const allOn = pairs.every(p => isPairSelected(p.sampleId, p.testTypeId));
    setSelectedPairs(prev => {
      const withoutSample = prev.filter(p => p.sampleId !== sample.id);
      return allOn ? withoutSample : [...withoutSample, ...pairs];
    });
  }
  function resetForm() {
    setSelectedPairs([]);
    setLabel("");
    setAssignedTester("");
    setEditingBatchId(null);
  }
  function saveBatch() {
    if (!selectedPairs.length) {
      notify?.("Select at least one sample/test pair.", "warn");
      return;
    }
    if (editingBatchId) {
      setSubBatches(prev => prev.map(sb => sb.id === editingBatchId ? {
        ...sb,
        label: label.trim() || sb.label,
        assignedTester,
        members: selectedPairs
      } : sb));
      notify?.("Batch updated.", "ok");
    } else {
      const batch = createBatch({
        label: label.trim(),
        members: selectedPairs,
        assignedTester
      }, subBatches);
      setSubBatches(prev => [batch, ...prev]);
      notify?.(`${batch.label} created with ${selectedPairs.length} sample/test pair(s).`, "ok");
    }
    resetForm();
  }
  function autoSelect() {
    const n = parseInt(autoCount, 10);
    if (!n || n <= 0) {
      notify?.("Enter a valid number of pairs first.", "warn");
      return;
    }
    const remaining = allEligiblePairsFlat.filter(p => !isPairSelected(p.sampleId, p.testTypeId));
    setSelectedPairs(prev => [...prev, ...remaining.slice(0, n)]);
    setAutoCount("");
  }

  // Same idea as Phase A's per-sample auto-split, now operating on pairs
  // instead of whole samples — a batch can end up with fewer distinct
  // samples than "pairs per batch" if some samples contribute >1 pair.
  function autoCreateBatches() {
    const perBatch = parseInt(autoCount, 10);
    const numBatches = parseInt(autoBatchCount, 10);
    if (!perBatch || perBatch <= 0) {
      notify?.("Enter a valid number of pairs per batch first.", "warn");
      return;
    }
    if (!numBatches || numBatches <= 0) {
      notify?.("Enter a valid number of batches to create.", "warn");
      return;
    }
    const pool = allEligiblePairsFlat.filter(p => !isPairSelected(p.sampleId, p.testTypeId));
    if (!pool.length) {
      notify?.("No eligible sample/test pairs available.", "warn");
      return;
    }
    const created = [];
    let cursor = 0;
    let running = [...subBatches];
    for (let i = 0; i < numBatches && cursor < pool.length; i++) {
      const chunk = pool.slice(cursor, cursor + perBatch);
      if (!chunk.length) break;
      cursor += chunk.length;
      const batch = createBatch({
        label: label.trim() ? `${label.trim()} ${i + 1}` : "",
        members: chunk,
        assignedTester
      }, running);
      running = [...running, batch];
      created.push(batch);
    }
    if (!created.length) {
      notify?.("Nothing to create.", "warn");
      return;
    }
    setSubBatches(prev => [...created, ...prev]);
    const totalPairs = created.reduce((s, b) => s + b.members.length, 0);
    const short = numBatches * perBatch > pool.length;
    notify?.(`Created ${created.length} batch(es) covering ${totalPairs} pair(s)${short ? ` — only ${pool.length} pair(s) were available, so the last batch has fewer than ${perBatch}` : ""}.`, "ok");
    setAutoCount("");
    setAutoBatchCount("");
  }
  function startEdit(batch) {
    setEditingBatchId(batch.id);
    setLabel(batch.label);
    setAssignedTester(batch.assignedTester || "");
    setSelectedPairs(batch.members || []);
  }
  function batchDeleteBlockReason(batch) {
    const status = batchOverallStatus(batch, testRecords);
    if (status !== "pending") return "This batch has at least one test type already run — remove that test record first, or edit only the pending groups.";
    return null;
  }
  function doDeleteBatch(batch) {
    setSubBatches(prev => prev.filter(sb => sb.id !== batch.id));
    setDeleteBatchId(null);
    notify?.(`${batch.label} deleted.`, "ok");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: editingBatchId ? `Editing ${label}` : "Build a Batch",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-3 mb-3"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 260
    }
  }, /*#__PURE__*/React.createElement(MultiSelectDropdown, {
    label: "Filter by Test Type (optional — leave blank for all)",
    options: testTypeOptions,
    selected: testTypeFilter,
    onChange: setTestTypeFilter,
    placeholder: "All test types"
  })), batchRefOptions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 220
    }
  }, /*#__PURE__*/React.createElement(MultiSelectDropdown, {
    label: "Filter by Registration Batch (optional)",
    options: batchRefOptions.map(r => ({
      value: r,
      label: r
    })),
    selected: selectedBatchRefs,
    onChange: setSelectedBatchRefs,
    placeholder: "All registration batches"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, selectedPairs.length, " sample/test pair(s) selected · ", totalEligiblePairs, " eligible in the current filter"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-end gap-2 mb-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "No. of pairs", /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    value: autoCount,
    onChange: e => setAutoCount(e.target.value),
    className: "border rounded px-2 py-1 text-xs w-28",
    style: {
      borderColor: C.border
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: autoSelect
  }, "Auto-Select"), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "No. of batches", /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    value: autoBatchCount,
    onChange: e => setAutoBatchCount(e.target.value),
    className: "border rounded px-2 py-1 text-xs w-28",
    style: {
      borderColor: C.border
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: autoCreateBatches,
    title: "Creates that many batches at once, each with \"No. of pairs\" sample/test pairs; the last one gets whatever's left over."
  }, "Auto-Create Batches"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedPairs(allEligiblePairsFlat)
  }, "Select All"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setSelectedPairs([])
  }, "Clear")), samplesWithEligiblePairs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-3 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "No samples with eligible pending tests match the current filters.") : /*#__PURE__*/React.createElement("div", {
    className: "rounded overflow-hidden mb-3",
    style: {
      border: `1px solid ${C.border}`,
      maxHeight: 340,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: C.bg,
      position: "sticky",
      top: 0
    }
  }, ["", "Sample Code", "Client", "Requested Tests (check to include)"].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1.5 font-semibold",
    style: {
      color: C.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, samplesWithEligiblePairs.map(({
    sample,
    pairs
  }) => {
    const allOn = pairs.every(p => isPairSelected(p.sampleId, p.testTypeId));
    return /*#__PURE__*/React.createElement("tr", {
      key: sample.id,
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: allOn,
      onChange: () => toggleAllForSample(sample, pairs),
      title: "Toggle all this sample's eligible tests"
    })), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5 font-medium",
      style: {
        color: C.ink
      }
    }, sample.sampleCode), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.muted
      }
    }, sample.clientName), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-1"
    }, pairs.map(p => {
      const on = isPairSelected(p.sampleId, p.testTypeId);
      return /*#__PURE__*/React.createElement("button", {
        key: p.testTypeId,
        onClick: () => togglePair(p),
        className: "px-2 py-0.5 rounded-full text-[11px] font-medium border",
        style: {
          background: on ? C.teal : "transparent",
          color: on ? "#fff" : C.ink,
          borderColor: on ? C.teal : C.border
        }
      }, p.testTypeName);
    }))));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3 mb-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Batch Label (optional — auto-generated if blank)",
    value: label,
    onChange: setLabel
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Assigned Tester (optional)",
    value: assignedTester,
    onChange: setAssignedTester,
    options: users.map(u => ({
      value: u.name,
      label: u.name
    })),
    placeholder: "Unassigned"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, editingBatchId && /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: resetForm
  }, "Cancel Edit"), /*#__PURE__*/React.createElement(Button, {
    onClick: saveBatch
  }, editingBatchId ? "Save Changes" : "Create Batch"))), /*#__PURE__*/React.createElement(SectionCard, {
    title: `Existing Batches (${subBatches.length})`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "table",
      size: 16,
      color: C.teal
    })
  }, subBatches.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "No batches yet.") : /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, subBatches.map(sb => {
    const groups = distinctTestTypesInBatch(sb);
    const overall = batchOverallStatus(sb, testRecords);
    const isOpen = expandedBatchId === sb.id;
    const blockReason = batchDeleteBlockReason(sb);
    return /*#__PURE__*/React.createElement("div", {
      key: sb.id,
      className: "rounded p-2.5",
      style: {
        border: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between flex-wrap gap-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setExpandedBatchId(isOpen ? null : sb.id),
      className: "flex items-center gap-1.5 text-left"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: isOpen ? "chevronDown" : "chevronRight",
      size: 13,
      color: C.muted
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-semibold",
      style: {
        color: C.ink
      }
    }, sb.label), /*#__PURE__*/React.createElement(Badge, {
      tone: overall === "completed" ? "ok" : overall === "partial" ? "warn" : "muted"
    }, overall === "completed" ? "Completed" : overall === "partial" ? "Partially Run" : "Pending"), /*#__PURE__*/React.createElement("span", {
      className: "text-[11px]",
      style: {
        color: C.muted
      }
    }, sb.members.length, " pair(s) · ", groups.length, " test type(s)")), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-1"
    }, overall === "pending" && /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit batch",
      onClick: () => startEdit(sb)
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: blockReason || "Delete batch",
      onClick: () => blockReason ? notify?.(blockReason, "warn") : setDeleteBatchId(sb.id)
    }))), isOpen && /*#__PURE__*/React.createElement("div", {
      className: "mt-2 pt-2",
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "mb-2"
    }, groups.map(g => /*#__PURE__*/React.createElement(BatchGroupBadge, {
      key: g.testTypeId,
      batch: sb,
      testTypeId: g.testTypeId,
      testTypeName: g.testTypeName,
      testRecords: testRecords
    }))), /*#__PURE__*/React.createElement("table", {
      className: "w-full text-xs"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        background: C.bg
      }
    }, ["Sample", "Test", "Status"].map(h => /*#__PURE__*/React.createElement("th", {
      key: h,
      className: "text-left px-2 py-1 font-semibold",
      style: {
        color: C.muted
      }
    }, h)))), /*#__PURE__*/React.createElement("tbody", null, sb.members.map((m, i) => {
      const sm = samples.find(s => s.id === m.sampleId);
      const groupStatus = batchGroupStatus(sb, m.testTypeId, testRecords);
      return /*#__PURE__*/React.createElement("tr", {
        key: i,
        style: {
          borderTop: `1px solid ${C.border}`
        }
      }, /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1",
        style: {
          color: C.ink
        }
      }, sm ? sm.sampleCode : m.sampleId), /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1",
        style: {
          color: C.muted
        }
      }, m.testTypeName), /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1"
      }, /*#__PURE__*/React.createElement("span", {
        className: "px-1.5 py-0.5 rounded text-[10px] font-semibold",
        style: {
          background: groupStatus === "completed" ? C.okBg : C.infoBg,
          color: groupStatus === "completed" ? C.ok : C.info
        }
      }, groupStatus === "completed" ? "Run" : "Pending")));
    })))), deleteBatchId === sb.id && /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete batch "${sb.label}"? Its members become available for another batch again.`,
      onConfirm: () => doDeleteBatch(sb),
      onCancel: () => setDeleteBatchId(null)
    }));
  }))));
}
function ReferenceForm({
  initial,
  onSave,
  onClose,
  existingReferences
}) {
  const [sourceType, setSourceType] = React.useState(initial?.sourceType || "DPHE");
  const [organizationName, setOrganizationName] = React.useState(initial?.organizationName || "");
  const [officialRefNo, setOfficialRefNo] = React.useState(initial?.officialRefNo || "");
  const [letterDate, setLetterDate] = React.useState(initial?.letterDate || todayStr());
  const [contactPerson, setContactPerson] = React.useState(initial?.contactPerson || "");
  const [contactPhone, setContactPhone] = React.useState(initial?.contactPhone || "");
  const [notes, setNotes] = React.useState(initial?.notes || "");
  const [err, setErr] = React.useState("");
  function submit() {
    if (sourceType !== "Walkin" && !organizationName.trim()) {
      setErr("Organization name is required for DPHE / Private references.");
      return;
    }
    onSave({
      sourceType,
      organizationName: organizationName.trim(),
      officialRefNo: officialRefNo.trim(),
      letterDate,
      contactPerson: contactPerson.trim(),
      contactPhone: contactPhone.trim(),
      notes: notes.trim()
    });
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: initial ? `Edit Reference — ${initial.refCode}` : "New Reference",
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Source Type",
    value: sourceType,
    onChange: setSourceType,
    options: REFERENCE_SOURCE_TYPES
  }), sourceType !== "Walkin" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Organization Name",
    value: organizationName,
    onChange: setOrganizationName,
    placeholder: "e.g. DPHE Zone-3, or ABC Textiles Ltd."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Official Letter Ref No.",
    value: officialRefNo,
    onChange: setOfficialRefNo,
    placeholder: "e.g. DPHE/WQ/2026/114"
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Letter Date",
    type: "date",
    value: letterDate,
    onChange: setLetterDate
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Contact Person",
    value: contactPerson,
    onChange: setContactPerson
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Contact Phone",
    value: contactPhone,
    onChange: setContactPhone
  }))), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Notes",
    value: notes,
    onChange: setNotes,
    textarea: true
  }), err && /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium",
    style: {
      color: C.warn
    }
  }, err), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-1"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: submit
  }, initial ? "Save Changes" : "Create Reference"))));
}
function ReferencesPanel({
  references,
  setReferences,
  samples,
  session,
  notify
}) {
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [q, setQ] = React.useState("");
  function handleCreate(fields) {
    const ref = createReference(fields, references, session);
    setReferences(prev => [ref, ...prev]);
    setShowForm(false);
    notify?.(`${ref.refCode} created.`, "ok");
  }
  function handleUpdate(fields) {
    setReferences(prev => prev.map(r => r.id === editing.id ? {
      ...r,
      ...fields
    } : r));
    setEditing(null);
    notify?.(`${editing.refCode} updated.`, "ok");
  }
  const filtered = references.filter(r => !q || `${r.refCode} ${r.organizationName} ${r.officialRefNo}`.toLowerCase().includes(q.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3 flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search reference code, organization, letter no…",
    className: "px-3 py-1.5 rounded text-sm",
    style: {
      border: `1px solid ${C.border}`,
      background: C.card,
      color: C.ink,
      minWidth: 260
    }
  }), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setShowForm(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  }), "New Reference")), /*#__PURE__*/React.createElement("div", {
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
  }, ["Reference", "Type", "Organization", "Letter Ref No.", "Samples", ""].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-3 py-2 text-xs font-semibold",
    style: {
      color: C.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(r => {
    const count = samplesByReference(samples, r.id).length;
    return /*#__PURE__*/React.createElement("tr", {
      key: r.id,
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2 font-medium",
      style: {
        color: C.ink
      }
    }, r.refCode), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, REFERENCE_SOURCE_TYPES.find(t => t.value === r.sourceType)?.label || r.sourceType)), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2",
      style: {
        color: C.ink
      }
    }, r.organizationName || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2",
      style: {
        color: C.muted
      }
    }, r.officialRefNo || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2",
      style: {
        color: C.ink
      }
    }, count), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2 text-right"
    }, /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit reference",
      onClick: () => setEditing(r)
    })));
  }), !filtered.length && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 6,
    className: "px-3 py-8 text-center text-sm",
    style: {
      color: C.muted
    }
  }, "No references yet. Create one to link incoming samples to their source."))))), showForm && /*#__PURE__*/React.createElement(ReferenceForm, {
    existingReferences: references,
    onSave: handleCreate,
    onClose: () => setShowForm(false)
  }), editing && /*#__PURE__*/React.createElement(ReferenceForm, {
    initial: editing,
    existingReferences: references,
    onSave: handleUpdate,
    onClose: () => setEditing(null)
  }));
}
