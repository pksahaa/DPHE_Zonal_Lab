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
// ============================================================================
// REFERENCE PICKER — pick an existing Reference (source paperwork: DPHE /
// institution / walk-in, letter no./date, org, contact) or create a new one
// inline without leaving the registration form. Used by both
// SampleRegistrationForm and BatchRegistrationForm so a sample is always
// created already pointing at a real Reference instead of a loose
// free-text batchRef string.
// ============================================================================
function ReferencePicker({
  references,
  setReferences,
  value,
  onChange,
  session,
  notify,
  label,
  helpText
}) {
  const [showNew, setShowNew] = React.useState(false);
  const [newForm, setNewForm] = React.useState({
    sourceType: "walkin",
    refNo: "",
    organizationName: "",
    letterDate: "",
    contactPerson: "",
    contactPhone: "",
    address: "",
    notes: ""
  });
  const sorted = [...(references || [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  async function createNew() {
    const ref = createReference(newForm, references, session);
    await setReferences(prev => [...prev, ref], ref);
    onChange(ref.id);
    setShowNew(false);
    notify?.(`Reference ${ref.refNo} created.`, "ok");
    setNewForm({
      sourceType: "walkin",
      refNo: "",
      organizationName: "",
      letterDate: "",
      contactPerson: "",
      contactPhone: "",
      address: "",
      notes: ""
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-1 text-xs"
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.muted
    }
  }, label || "Reference (Source)"), helpText && /*#__PURE__*/React.createElement("span", {
    className: "text-[11px]",
    style: {
      color: C.muted
    }
  }, helpText), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm flex-1",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    value: value || "",
    onChange: e => onChange(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "No reference selected yet…"), sorted.map(r => /*#__PURE__*/React.createElement("option", {
    key: r.id,
    value: r.id
  }, referenceSourceMeta(r.sourceType).label, " — ", referenceDisplayLabel(r)))), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => setShowNew(true)
  }, "+ New")), showNew && /*#__PURE__*/React.createElement(Modal, {
    title: "New Reference",
    onClose: () => setShowNew(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Source Type",
    value: newForm.sourceType,
    onChange: v => setNewForm({
      ...newForm,
      sourceType: v
    }),
    options: REFERENCE_SOURCE_TYPES.map(s => ({
      value: s.key,
      label: s.label
    }))
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Reference / Memo No. (leave blank for walk-in with no letter — one will be auto-generated)",
    value: newForm.refNo,
    onChange: v => setNewForm({
      ...newForm,
      refNo: v
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Organization Name",
    value: newForm.organizationName,
    onChange: v => setNewForm({
      ...newForm,
      organizationName: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    type: "date",
    label: "Letter Date",
    value: newForm.letterDate,
    onChange: v => setNewForm({
      ...newForm,
      letterDate: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Contact Person",
    value: newForm.contactPerson,
    onChange: v => setNewForm({
      ...newForm,
      contactPerson: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Contact Phone",
    value: newForm.contactPhone,
    onChange: v => setNewForm({
      ...newForm,
      contactPhone: v
    })
  })), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Address",
    value: newForm.address,
    onChange: v => setNewForm({
      ...newForm,
      address: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    textarea: true,
    label: "Notes",
    value: newForm.notes,
    onChange: v => setNewForm({
      ...newForm,
      notes: v
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => setShowNew(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: createNew
  }, "Create Reference")))));
}

// ============================================================================
// SAMPLE MINI CARD — the shared "here's this sample, and here's where the
// full record lives" component. Sample Detail (below) is the single source
// of truth for everything about a sample; every OTHER screen that needs to
// show sample info (Add Test Record, Report Generator) renders this instead
// of inventing its own ad-hoc summary, and links back with `goToSample`.
// ============================================================================
function SampleMiniCard({
  sample,
  references,
  testRecords,
  subBatches,
  goToSample,
  note
}) {
  if (!sample) return null;
  const ref = sample.referenceId ? findReferenceById(references, sample.referenceId) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "mx-4 mt-2 p-3 rounded",
    style: {
      background: C.infoBg,
      border: `1px solid ${C.info}33`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-semibold",
    style: {
      color: C.ink
    }
  }, sample.sampleCode, " — ", sample.clientName), /*#__PURE__*/React.createElement("span", {
    className: "text-xs ml-2",
    style: {
      color: C.muted
    }
  }, sample.siteLocation, ref ? ` · ${referenceSourceMeta(ref.sourceType).label}: ${referenceDisplayLabel(ref)}` : "")), goToSample && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => goToSample(sample.id)
  }, "View Full Sample →")), note && /*#__PURE__*/React.createElement("div", {
    className: "text-xs mt-1",
    style: {
      color: C.info
    }
  }, note), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 mt-1.5"
  }, (sample.requestedTests || []).map(t => {
    const stage = testStageForSample(sample, t.testTypeId, testRecords, subBatches);
    const style = testStageChipStyle(stage);
    return /*#__PURE__*/React.createElement("span", {
      key: t.testTypeId,
      className: "text-[11px] px-2 py-0.5 rounded-full",
      style: {
        background: style.bg,
        color: style.fg
      },
      title: `${t.testTypeName} — ${testStageLabel(stage)}`
    }, t.testTypeName, " · ", testStageLabel(stage));
  })));
}

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
  subBatches,
  references,
  setReferences,
  onClose,
  onUpdate,
  onDelete,
  notify
}) {
  const perms = permissionsFor(session.role);
  const allowedNext = nextAllowedStatuses(sample);
  // results_entered/under_review/approved/released are governed elsewhere
  // now (auto-rollup, Sub-Batch review, or the signature-gated approval
  // flow) — the plain "Move Status" buttons only ever offer genuine
  // whole-sample custody moves (on_hold/cancelled/rejected/starting testing).
  const manualAllowedNext = allowedNext.filter(s => !["results_entered", "under_review", "approved", "released"].includes(s));
  const technicians = users.filter(u => u.role === "Technician" || u.role === "Administrator");
  const [assignee, setAssignee] = React.useState(sample.assignedTo || "");
  const [editing, setEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const canEdit = perms.canRegister && sample.status !== "released";
  const canDelete = perms.canRegister && (sample.linkedTestRecordIds || []).length === 0;
  function startEdit() {
    setEditForm({
      clientName: sample.clientName,
      siteLocation: sample.siteLocation,
      district: sample.district,
      upazila: sample.upazila,
      union: sample.union,
      village: sample.village,
      caretakerName: sample.caretakerName,
      sampleSourceId: sample.sampleSourceId,
      batchRef: sample.batchRef,
      referenceId: sample.referenceId,
      matrix: sample.matrix,
      collectionDate: sample.collectionDate,
      collectedBy: sample.collectedBy,
      receivedDate: sample.receivedDate,
      priority: sample.priority,
      notes: sample.notes
    });
    setEditing(true);
  }
  function saveEdit() {
    const next = editSample(sample, editForm, session);
    onUpdate(next);
    notify?.("Registration details updated.", "ok");
    setEditing(false);
  }
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
  const editPanel = editing ? /*#__PURE__*/React.createElement("div", {
    className: "mb-3 p-3 rounded",
    style: {
      border: `1px solid ${C.teal}`,
      background: "#F3FAF9"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-2",
    style: {
      color: C.ink
    }
  }, "Correct Registration Details"), /*#__PURE__*/React.createElement("div", {
    className: "mb-2"
  }, /*#__PURE__*/React.createElement(ReferencePicker, {
    references: references,
    setReferences: setReferences,
    value: editForm?.referenceId,
    onChange: v => setEditForm(prev => ({
      ...prev,
      referenceId: v
    })),
    session: session,
    notify: notify,
    label: "Reference (Source)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))"
    }
  }, [["clientName", "Client / Requester"], ["siteLocation", "Site / Location"], ["district", "District"], ["upazila", "Upazila / City Corp"], ["union", "Union / Pourashava"], ["village", "Village / Ward"], ["caretakerName", "Caretaker Name"], ["sampleSourceId", "Sample Source"], ["collectedBy", "Collected By"], ["notes", "Notes"]].map(([field, fieldLabel]) => /*#__PURE__*/React.createElement("label", {
    key: field,
    className: "flex flex-col gap-0.5 text-xs",
    style: {
      color: C.muted
    }
  }, fieldLabel, /*#__PURE__*/React.createElement("input", {
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: editForm[field] || "",
    onChange: e => setEditForm(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }))), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-0.5 text-xs",
    style: {
      color: C.muted
    }
  }, "Matrix", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: editForm.matrix,
    onChange: e => setEditForm(prev => ({
      ...prev,
      matrix: e.target.value
    }))
  }, ["Drinking Water", "Ground Water", "Surface Water", "Wastewater", "Other"].map(m => /*#__PURE__*/React.createElement("option", {
    key: m,
    value: m
  }, m)))), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-0.5 text-xs",
    style: {
      color: C.muted
    }
  }, "Priority", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: editForm.priority,
    onChange: e => setEditForm(prev => ({
      ...prev,
      priority: e.target.value
    }))
  }, ["Routine", "Urgent"].map(p => /*#__PURE__*/React.createElement("option", {
    key: p,
    value: p
  }, p)))), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-0.5 text-xs",
    style: {
      color: C.muted
    }
  }, "Collection Date", /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: editForm.collectionDate,
    onChange: e => setEditForm(prev => ({
      ...prev,
      collectionDate: e.target.value
    }))
  })), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-0.5 text-xs",
    style: {
      color: C.muted
    }
  }, "Received Date", /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: editForm.receivedDate,
    onChange: e => setEditForm(prev => ({
      ...prev,
      receivedDate: e.target.value
    }))
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-3"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => setEditing(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: saveEdit
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), "Save Correction"))) : null;
  const deleteConfirmPanel = confirmDelete ? /*#__PURE__*/React.createElement(ConfirmBar, {
    text: `Delete ${sample.sampleCode}? This sample has no test records yet, so this is safe — it will be permanently removed.`,
    onConfirm: () => {
      onDelete(sample);
      onClose();
    },
    onCancel: () => setConfirmDelete(false)
  }) : null;
  return /*#__PURE__*/React.createElement(Modal, {
    title: `${sample.sampleCode} — ${sample.clientName}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement(SampleStatusBadge, {
    status: sample.status
  }), /*#__PURE__*/React.createElement(PriorityBadge, {
    priority: sample.priority
  }), sample.referenceId && findReferenceById(references, sample.referenceId) && /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] px-2 py-0.5 rounded-full",
    style: {
      background: `${C.info}1A`,
      color: C.info
    },
    title: "Source reference"
  }, referenceSourceMeta(findReferenceById(references, sample.referenceId).sourceType).label, ": ", referenceDisplayLabel(findReferenceById(references, sample.referenceId))), /*#__PURE__*/React.createElement("span", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, sample.matrix, " · ", sample.siteLocation, " · ", sample.numberOfSamples || 1, " sample", (sample.numberOfSamples || 1) > 1 ? "s" : "", " in batch"), /*#__PURE__*/React.createElement("div", {
    className: "ml-auto flex items-center gap-1"
  }, canEdit && /*#__PURE__*/React.createElement(IconButton, {
    name: "edit",
    color: C.teal,
    title: "Correct registration details",
    onClick: startEdit
  }), canDelete && /*#__PURE__*/React.createElement(IconButton, {
    name: "trash",
    color: C.warn,
    title: "Delete this sample (no test records linked yet)",
    onClick: () => setConfirmDelete(true)
  }))), deleteConfirmPanel, editPanel, qcWarnings.length > 0 && /*#__PURE__*/React.createElement("div", {
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
    className: "grid gap-1.5"
  }, sample.requestedTests.map(t => {
    // Per-parameter STAGE — NOT sample.status. A sample with 3 requested
    // tests can have one Released, one still In Progress, and one still
    // fully Pending, all at the same time. See testStageForSample() in
    // 16-sub-batch.js for exactly what's tracked per-parameter vs. still
    // decided for the whole sample.
    const paramStage = testStageForSample(sample, t.testTypeId, testRecords, subBatches);
    const paramStageStyle = testStageChipStyle(paramStage);
    const paramStageLabel = testStageLabel(paramStage);
    // The actual measured value(s) — previously Sample Detail only ever
    // showed a bare "Linked test records: N" count, never the results
    // themselves, even after they'd been entered (or bulk-uploaded).
    const resultInfo = getSampleResultForTest(sample, t.testTypeId, testRecords);
    return /*#__PURE__*/React.createElement("div", {
      key: t.testTypeId,
      className: "flex flex-wrap items-center gap-1.5"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[11px] px-2 py-0.5 rounded-full",
      style: {
        background: paramStageStyle.bg,
        color: paramStageStyle.fg
      },
      title: `${t.testTypeName} — ${paramStageLabel}`
    }, t.testTypeName, " · ", paramStageLabel), resultInfo && resultInfo.results.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "text-[11px]",
      style: {
        color: C.muted
      }
    }, resultInfo.results.filter(r => r.value != null).map(r => `${r.name}: ${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ""}`).join(", ") || "no value yet", resultInfo.date ? ` (${resultInfo.date})` : ""));
  })), !!sample.linkedTestRecordIds.length && /*#__PURE__*/React.createElement("div", {
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
  }), "Assign")), !!manualAllowedNext.length && !["received", "results_entered", "under_review"].includes(sample.status) && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: {
      color: C.ink
    }
  }, "Move Status"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5"
  }, manualAllowedNext.map(s => /*#__PURE__*/React.createElement(Button, {
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
  setReferences,
  session,
  notify,
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
    if (!shared.referenceId) {
      setErr("Select or create a Reference (source) first.");
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
    title: "Register Sample(s) — shared info once, per-sample rows below (matches the bulk upload sheet)",
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
    className: "mb-3"
  }, /*#__PURE__*/React.createElement(ReferencePicker, {
    references: references,
    setReferences: setReferences,
    value: shared.referenceId,
    onChange: v => setShared({
      ...shared,
      referenceId: v
    }),
    session: session,
    notify: notify,
    label: "Reference (Source) — required",
    helpText: "DPHE / institution letter+ref no., or a walk-in with no letter (one will be auto-generated)."
  })), /*#__PURE__*/React.createElement("div", {
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
  references,
  setReferences,
  testTypes,
  testRecords,
  subBatches,
  setSubBatches,
  equipment,
  users,
  session,
  notify,
  focusSampleId,
  setFocusSampleId
}) {
  const [sampleSubTab, setSampleSubTab] = React.useState("samples");
  const [showBatchForm, setShowBatchForm] = React.useState(false);
  const bulkUploadInputRef = React.useRef(null);
  const [internalOpenId, setInternalOpenId] = React.useState(null);
  const openId = focusSampleId !== undefined ? focusSampleId : internalOpenId;
  const setOpenId = setFocusSampleId || setInternalOpenId;
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
  // Group filtered samples by Reference (bulk upload / Register Batch) while
  // keeping individually-registered samples (no reference) as plain rows, all
  // in original sort order (position = first/most-recent member encountered).
  const batchGroups = {};
  filtered.forEach(s => {
    if (s.referenceId) (batchGroups[s.referenceId] = batchGroups[s.referenceId] || []).push(s);
  });
  const listItems = [];
  const seenReferenceIds = new Set();
  filtered.forEach(s => {
    if (s.referenceId) {
      if (seenReferenceIds.has(s.referenceId)) return;
      seenReferenceIds.add(s.referenceId);
      listItems.push({
        type: "batch",
        referenceId: s.referenceId,
        reference: findReferenceById(references, s.referenceId),
        members: batchGroups[s.referenceId]
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
    let runningReferences = [...references];
    const refNoToReference = new Map(runningReferences.map(r => [r.refNo, r]));
    let count = 0;
    for (const row of pendingImportRows) {
      const rawRef = String(row.BatchRef || row["Batch Ref"] || "").trim();
      let ref = rawRef ? refNoToReference.get(rawRef) : null;
      if (!ref) {
        ref = createReference({
          refNo: rawRef,
          sourceType: rawRef ? "institution" : "walkin",
          notes: "Auto-created from bulk manifest import — please verify source type and add organization/contact details."
        }, runningReferences, session);
        runningReferences = [...runningReferences, ref];
        if (rawRef) refNoToReference.set(rawRef, ref);
        await setReferences(prev => [...prev, ref], ref);
      }
      const sample = createSample({
        clientName: String(row.ClientName || row["Client Name"] || "").trim(),
        siteLocation: String(row.SiteLocation || row["Site Location"] || "").trim(),
        district: String(row.District || "").trim(),
        upazila: String(row.Upazila || row["Upazila/City Corporation"] || "").trim(),
        union: String(row.Union || row["Union/Pourashava"] || "").trim(),
        village: String(row.Village || row["Village/Ward"] || "").trim(),
        caretakerName: String(row.CaretakerName || row["Caretaker Name"] || "").trim(),
        sampleSourceId: String(row.SampleSource || row["Sample Source"] || "").trim(),
        referenceId: ref.id,
        batchRef: ref.refNo,
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
  async function handleDeleteSample(sample) {
    await setSamples(prev => prev.filter(s => s.id !== sample.id));
    notify?.(`${sample.sampleCode} deleted.`, "ok");
  }
  async function handleBatchCreate(shared, rows) {
    const ref = findReferenceById(references, shared.referenceId);
    let runningSamples = [...samples];
    let count = 0;
    for (const row of rows) {
      const sample = createSample({
        ...shared,
        // legacy display fallback — the real source of truth is referenceId
        batchRef: ref ? ref.refNo : "",
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
    notify?.(`${count} sample(s) registered under Reference ${ref ? referenceDisplayLabel(ref) : "(none)"}.`, "ok");
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
    onClick: () => setShowBatchForm(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 13
  }), "Register Sample(s)"))), /*#__PURE__*/React.createElement("div", {
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
    const isOpen = expandedBatches.has(item.referenceId);
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: "batch-" + item.referenceId
    }, /*#__PURE__*/React.createElement("tr", {
      className: "cursor-pointer",
      style: {
        borderTop: `1px solid ${C.border}`,
        background: C.bg
      },
      onClick: () => toggleBatchExpand(item.referenceId)
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
    }, item.reference ? `${referenceSourceMeta(item.reference.sourceType).label}: ${referenceDisplayLabel(item.reference)}` : "Reference: (unknown)"), /*#__PURE__*/React.createElement("span", {
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
    setSamples: setSamples,
    testTypes: testTypes,
    subBatches: subBatches,
    setSubBatches: setSubBatches,
    testRecords: testRecords,
    references: references,
    users: users,
    session: session,
    notify: notify
  }), showBatchForm && /*#__PURE__*/React.createElement(BatchRegistrationForm, {
    testTypes: testTypes,
    references: references,
    setReferences: setReferences,
    session: session,
    notify: notify,
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
    subBatches: subBatches,
    references: references,
    setReferences: setReferences,
    onClose: () => setOpenId(null),
    onUpdate: handleUpdate,
    onDelete: handleDeleteSample,
    notify: notify
  }));
}

// ---- Sub-Batches sub-view: group pending samples for one method into a
// persistent, named batch that Add Test Record can later consume as a unit ----
function SUB_BATCH_STATUS_BADGE(status) {
  if (status === "reviewed") return /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11
  }), " Reviewed");
  if (status === "tested") return /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 11
  }), " Awaiting Review");
  return /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 11
  }), " Pending");
}
function SubBatchBuilder({
  samples,
  setSamples,
  testTypes,
  subBatches,
  setSubBatches,
  testRecords,
  references,
  users,
  session,
  notify
}) {
  const [selectedTestId, setSelectedTestId] = React.useState("");
  const [selectedReferenceIds, setSelectedReferenceIds] = React.useState([]);
  const [selectedSampleIds, setSelectedSampleIds] = React.useState([]);
  const [label, setLabel] = React.useState("");
  const [assignedTester, setAssignedTester] = React.useState("");
  const [autoCount, setAutoCount] = React.useState("");
  const [autoBatchCount, setAutoBatchCount] = React.useState("");
  const [editingSubBatchId, setEditingSubBatchId] = React.useState(null);
  const [deleteSubBatchId, setDeleteSubBatchId] = React.useState(null);
  const [returningSubBatchId, setReturningSubBatchId] = React.useState(null);
  const [returnNote, setReturnNote] = React.useState("");

  // Samples eligible for the chosen Test Type — ignoring the sub-batch's own
  // current membership while it's being edited (otherwise its members would
  // wrongly look "already used" and disappear from the picker).
  const eligibleForTest = selectedTestId ? samples.filter(s => {
    // While editing an existing sub-batch, its own current members must not
    // be excluded by the "already queued" check below (they're queued IN
    // this sub-batch) — pretend this sub-batch doesn't exist for that check.
    const subBatchesForCheck = editingSubBatchId ? subBatches.filter(sb => sb.id !== editingSubBatchId) : subBatches;
    return pendingTestTypeIdsForSample(s, testRecords, subBatchesForCheck).includes(selectedTestId);
  }) : [];
  // References available to filter by, scoped to the Test Type above — a
  // Reference (source batch) can carry several test types, so this narrows
  // to only References that actually have samples requesting THIS test.
  const referenceFilterOptions = Array.from(new Set(eligibleForTest.map(s => s.referenceId).filter(Boolean))).map(id => findReferenceById(references, id)).filter(Boolean).sort((a, b) => (a.refNo || "").localeCompare(b.refNo || ""));
  const eligibleSamples = selectedReferenceIds.length ? eligibleForTest.filter(s => selectedReferenceIds.includes(s.referenceId)) : eligibleForTest;
  const distinctReferences = Array.from(new Set(samples.filter(s => selectedSampleIds.includes(s.id)).map(s => s.referenceId).filter(Boolean))).map(id => findReferenceById(references, id)).filter(Boolean);
  function toggleMember(id) {
    setSelectedSampleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleReferenceFilter(id) {
    setSelectedReferenceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
  function autoCreateMultipleBatches() {
    const perBatch = parseInt(autoCount, 10);
    const numBatches = parseInt(autoBatchCount, 10);
    if (!perBatch || perBatch <= 0 || !numBatches || numBatches <= 0) {
      notify?.("Enter both No. of Samples (per batch) and No. of Batches first.", "warn");
      return;
    }
    if (!selectedTestId) {
      notify?.("Pick a Test Type first.", "warn");
      return;
    }
    const pool = eligibleSamples.filter(s => !selectedSampleIds.includes(s.id));
    const test = testTypes.find(t => t.id === selectedTestId);
    let cursor = 0;
    let runningSubBatches = subBatches;
    const createdLabels = [];
    for (let i = 0; i < numBatches && cursor < pool.length; i++) {
      const chunk = pool.slice(cursor, cursor + perBatch);
      cursor += perBatch;
      const sb = createSubBatch({
        label: label.trim() ? `${label.trim()} — Batch ${i + 1}` : "",
        testTypeId: selectedTestId,
        testTypeName: test?.name || "",
        memberSampleIds: chunk.map(s => s.id),
        assignedTester
      }, runningSubBatches);
      runningSubBatches = [...runningSubBatches, sb];
      createdLabels.push(`${sb.label} (${chunk.length})`);
    }
    setSubBatches(runningSubBatches);
    if (!createdLabels.length) {
      notify?.("No eligible samples were available to create any batch.", "warn");
      return;
    }
    markMembersInProgress(pool.slice(0, cursor).map(s => s.id), selectedTestId);
    const shortBy = numBatches - createdLabels.length;
    notify?.(`Created ${createdLabels.length} sub-batch(es): ${createdLabels.join(", ")}.${shortBy > 0 ? ` Only enough samples for ${createdLabels.length} of the ${numBatches} requested — the last one may have fewer than ${perBatch}.` : ""}`, "ok");
    setAutoCount("");
    setAutoBatchCount("");
  }
  function resetForm() {
    setSelectedTestId("");
    setSelectedReferenceIds([]);
    setSelectedSampleIds([]);
    setLabel("");
    setAssignedTester("");
    setAutoCount("");
    setEditingSubBatchId(null);
  }
  function startEdit(sb) {
    setSelectedTestId(sb.testTypeId);
    setSelectedReferenceIds([]);
    setSelectedSampleIds(sb.memberSampleIds || []);
    setLabel(sb.label);
    setAssignedTester(sb.assignedTester || "");
    setEditingSubBatchId(sb.id);
  }
  function markMembersInProgress(memberIds, testTypeId) {
    if (!setSamples) return;
    memberIds.forEach(id => {
      const member = (samples || []).find(s => s.id === id);
      if (!member) return;
      const rt = (member.requestedTests || []).find(r => r.testTypeId === testTypeId);
      if (!rt || rt.status !== "pending") return; // already past pending, or edit removed it — leave alone
      const updated = setRequestedTestStatus(member, testTypeId, "in_progress", session);
      setSamples(prev => prev.map(s => s.id === id ? updated : s), updated);
    });
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
      markMembersInProgress(selectedSampleIds, selectedTestId);
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
      markMembersInProgress(selectedSampleIds, selectedTestId);
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
  // ---- Review (Phase 3) — approving/returning a Sub-Batch only ever
  // touches the ONE parameter it represents (sb.testTypeId), for its member
  // samples. A sample with 3 requested parameters can have one approved via
  // its Sub-Batch while the other two are still untouched. ----
  // ---- Review (Phase 3) — this is the bulk TECHNICAL review pass
  // (results_entered -> under_review) for the one parameter this Sub-Batch
  // represents, for its member samples. Final Approval/Release stay
  // signature-gated on the whole sample (see addApproval/releaseResults in
  // 20-sample-model.js) — a Sub-Batch can't skip past that; it only brings
  // its own parameter up to "ready for the signed-off approval step",
  // exactly like the workflow doc's "Review is performed at batch level".
  function approveSubBatch(sb) {
    reviewSubBatchApprove(sb, samples, setSamples, setSubBatches, session, notify);
  }
  function confirmReturnSubBatch(sb) {
    reviewSubBatchReturn(sb, samples, setSamples, setSubBatches, session, notify, returnNote);
    setReturningSubBatchId(null);
    setReturnNote("");
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
      setSelectedReferenceIds([]);
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

  const batchFilterBlock = referenceFilterOptions.length > 0 ? /*#__PURE__*/React.createElement("details", {
    className: "mb-3 rounded",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("summary", {
    className: "text-xs font-semibold px-2 py-1.5 cursor-pointer select-none",
    style: {
      color: C.ink
    }
  }, "Filter by Reference ", selectedReferenceIds.length ? `(${selectedReferenceIds.length} selected)` : "(optional — pick one or more)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 px-2 pb-2"
  }, referenceFilterOptions.map(ref => /*#__PURE__*/React.createElement("label", {
    key: ref.id,
    className: "flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer",
    style: {
      border: `1px solid ${selectedReferenceIds.includes(ref.id) ? C.teal : C.border}`,
      background: selectedReferenceIds.includes(ref.id) ? `${C.teal}14` : "transparent"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedReferenceIds.includes(ref.id),
    onChange: () => toggleReferenceFilter(ref.id)
  }), referenceSourceMeta(ref.sourceType).label, ": ", referenceDisplayLabel(ref))))) : null;

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
  }, "Auto-Select"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 1,
    placeholder: "No. of batches",
    value: autoBatchCount,
    onChange: e => setAutoBatchCount(e.target.value),
    className: "border rounded px-2 py-1 text-xs w-28",
    style: {
      borderColor: C.border
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: autoCreateMultipleBatches
  }, "Create Multiple Batches"), /*#__PURE__*/React.createElement(Button, {
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
  }, s.clientName, s.referenceId ? ` · ref: ${referenceDisplayLabel(findReferenceById(references, s.referenceId))}` : ""))));

  const mixedBatchWarning = distinctReferences.length > 1 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mt-2",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, "Heads up: this sub-batch mixes samples from ", distinctReferences.length, " different References (", distinctReferences.map(r => r.refNo).join(", "), "). That's fine for testing — each sample keeps its own Reference for reporting.") : null;

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
  }, "No pending samples match this Test Type", selectedReferenceIds.length ? " + Reference filter" : "", " (or all are already in another pending sub-batch).") : /*#__PURE__*/React.createElement("div", null, pickerHeaderRow, pickerListBox, mixedBatchWarning, actionRow));

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
    }, testerControl, SUB_BATCH_STATUS_BADGE(sb.status), sb.status === "tested" && /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      onClick: () => approveSubBatch(sb)
    }, "Mark Reviewed"), sb.status === "tested" && /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: () => {
        setReturningSubBatchId(sb.id);
        setReturnNote("");
      }
    }, "Return to Analyst"), /*#__PURE__*/React.createElement(IconButton, {
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
    }), returningSubBatchId === sb.id && /*#__PURE__*/React.createElement("div", {
      className: "mt-2 p-2 rounded",
      style: {
        background: C.warnBg
      }
    }, /*#__PURE__*/React.createElement(TextField, {
      simple: true,
      label: `Note for the analyst (optional) — why is "${sb.testTypeName}" being returned?`,
      value: returnNote,
      onChange: setReturnNote
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex justify-end gap-2 mt-2"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: () => {
        setReturningSubBatchId(null);
        setReturnNote("");
      }
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: () => confirmReturnSubBatch(sb)
    }, "Confirm Return"))));
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
