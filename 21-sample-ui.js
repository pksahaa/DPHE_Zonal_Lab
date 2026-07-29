// ===== 21-sample-ui.js =====
// ============================================================================
// SAMPLE LIFECYCLE UI — the "Samples" tab. Reuses 02-ui-kit primitives so it
// looks native to the rest of the app. Talks to samples ONLY through the
// props passed down from 99-app.js's useSamples() hook (DataService-backed),
// never touching storage directly.
// ============================================================================

const WATER_POINT_TYPES = ["Shallow TW (STW)", "Deep TW (DTW)", "Tubewell With Submersible Pump (TSP)", "Community Based Tubewell (CTBT)", "Rural Piped Water Scheme (RPWS)", "Pond Sand Filter (PSF)", "Rainwater Harvesting (RWH)", "Other (Pls. Specify)"];

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
  const [newForm, setNewForm] = React.useState({ ...CLIENT_PART_EMPTY });
  const [newErr, setNewErr] = React.useState("");
  const sorted = [...(references || [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  async function createNew() {
    const result = submitClientPart(newForm, references, session);
    if (result.error) {
      setNewErr(result.error);
      return;
    }
    await setReferences(prev => [...prev, result.reference], result.reference);
    onChange(result.reference.id);
    setShowNew(false);
    notify?.(`Client entry ${result.reference.refNo} created.`, "ok");
    setNewForm({ ...CLIENT_PART_EMPTY });
    setNewErr("");
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
    title: "New Client Entry",
    onClose: () => setShowNew(false),
    wide: true
  }, newErr && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mb-3",
    style: { background: C.warnBg, color: C.warn }
  }, newErr), /*#__PURE__*/React.createElement(ClientPartFields, {
    form: newForm,
    setForm: setNewForm
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-3"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => setShowNew(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: createNew
  }, "Create"))));
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

// ============================================================================
// CLIENT PART FIELDS — always inline, one window, no "+New" popup. Every
// registration action (manual multi-row, or bulk upload) fills these once
// and creates one fresh Reference from them — replacing the old
// picker-dropdown-plus-separate-modal ReferencePicker flow for
// registration specifically (ReferencePicker itself is kept for the
// Sample Detail "move this sample to a different existing Reference" case,
// which is a genuinely different job: picking among EXISTING references).
// ============================================================================
const CLIENT_PART_EMPTY = {
  sourceType: "walkin",
  sourceTypeOther: "",
  clientType: "",
  clientTypeOther: "",
  refNo: "",
  letterDate: "",
  trackingNo: "",
  organizationName: "",
  contactPerson: "",
  contactPhone: "",
  notes: ""
};
function ClientPartFields({
  form,
  setForm
}) {
  function set(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Client Part — for tracking"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3 mb-3",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
    }
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Client Source",
    value: form.sourceType,
    onChange: v => set("sourceType", v),
    options: REFERENCE_SOURCE_TYPES.map(s => ({
      value: s.key,
      label: s.label
    }))
  }), form.sourceType === "others" && /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Client Source — Please Specify",
    value: form.sourceTypeOther,
    onChange: v => set("sourceTypeOther", v)
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Client Type",
    value: form.clientType,
    onChange: v => set("clientType", v),
    options: [{
      value: "",
      label: "— select —"
    }, ...CLIENT_TYPES.map(ct => ({
      value: ct,
      label: ct
    }))]
  }), form.clientType === "Others (Pls Specify)" && /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Client Type — Please Specify",
    value: form.clientTypeOther,
    onChange: v => set("clientTypeOther", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Ref / Memo No.",
    value: form.refNo,
    onChange: v => set("refNo", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    type: "date",
    label: "Date",
    value: form.letterDate,
    onChange: v => set("letterDate", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Tracking No. — required, must be unique",
    value: form.trackingNo,
    onChange: v => set("trackingNo", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Organization Name",
    value: form.organizationName,
    onChange: v => set("organizationName", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Client Name",
    value: form.contactPerson,
    onChange: v => set("contactPerson", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Client Contact No.",
    value: form.contactPhone,
    onChange: v => set("contactPhone", v)
  })), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    textarea: true,
    label: "Notes",
    value: form.notes,
    onChange: v => set("notes", v)
  }));
}
// Validates the Client Part form + actually creates the Reference. Shared
// by the registration form and the bulk-upload popup so the Tracking No.
// uniqueness rule and field mapping only live in one place.
function submitClientPart(form, references, session) {
  if (!(form.trackingNo || "").trim()) {
    return {
      error: "Tracking No. is required."
    };
  }
  if (isTrackingNoTaken(form.trackingNo, references)) {
    return {
      error: `Tracking No. "${form.trackingNo.trim()}" is already used by another Client entry — it must be unique.`
    };
  }
  if (form.sourceType === "others" && !form.sourceTypeOther.trim()) {
    return {
      error: "Please specify the Client Source."
    };
  }
  if (form.clientType === "Others (Pls Specify)" && !form.clientTypeOther.trim()) {
    return {
      error: "Please specify the Client Type."
    };
  }
  const reference = createReference(form, references, session);
  return {
    reference
  };
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
  const [approvingParamId, setApprovingParamId] = React.useState(null);
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
      fatherHusbandName: sample.fatherHusbandName,
      latitude: sample.latitude,
      longitude: sample.longitude,
      waterPointType: sample.waterPointType,
      waterPointTypeOther: sample.waterPointTypeOther,
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
  }, [["clientName", "Customer Name"], ["siteLocation", "Site / Location"], ["district", "District"], ["upazila", "Upazila / City Corp"], ["union", "Union / Pourashava"], ["village", "Site Name"], ["fatherHusbandName", "Father's / Husband's Name"], ["latitude", "Latitude"], ["longitude", "Longitude"], ["waterPointTypeOther", "Type of Water Point - Other"], ["collectedBy", "Collected By"], ["notes", "Notes"]].map(([field, fieldLabel]) => /*#__PURE__*/React.createElement("label", {
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
  }, "Type of Water Point", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: editForm.waterPointType || "",
    onChange: e => setEditForm(prev => ({
      ...prev,
      waterPointType: e.target.value
    }))
  }, [/*#__PURE__*/React.createElement("option", {
    key: "none",
    value: ""
  }, "— select —")].concat(WATER_POINT_TYPES.map(wt => /*#__PURE__*/React.createElement("option", {
    key: wt,
    value: wt
  }, wt))))), /*#__PURE__*/React.createElement("label", {
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
    const chipRow = /*#__PURE__*/React.createElement("div", {
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
    }, resultInfo.results.filter(r => r.value != null).map(r => `${r.name}: ${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ""}`).join(", ") || "no value yet", resultInfo.date ? ` (${resultInfo.date})` : ""), paramStage === "under_review" && approvingParamId !== t.testTypeId && /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: () => setApprovingParamId(t.testTypeId)
    }, "Final Approve"), paramStage === "approved" && /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: () => {
        const result = bulkReleaseParameter([sample], t.testTypeId, t.testTypeName, session);
        if (result.updated.length) {
          onUpdate(result.updated[0]);
          notify?.(`${t.testTypeName} released.`, "ok");
        }
      }
    }, "Release"));
    const approvalPanel = paramStage !== "under_review" || approvingParamId !== t.testTypeId ? null : /*#__PURE__*/React.createElement(SignatureCapture, {
      user: session,
      label: `Final Approval — ${t.testTypeName} for ${sample.sampleCode}`,
      onConfirm: payload => {
        try {
          const result = bulkDecideParameter([sample], t.testTypeId, t.testTypeName, payload, session);
          if (result.updated.length) {
            onUpdate(result.updated[0]);
            notify?.(payload.decision === "approved" ? `${t.testTypeName} approved.` : `${t.testTypeName} sent back to analyst.`, payload.decision === "approved" ? "ok" : "warn");
          }
        } catch (e) {
          notify?.(e.message, "warn");
        }
        setApprovingParamId(null);
      }
    });
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: t.testTypeId
    }, chipRow, approvalPanel);
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

// ---- Step indicator for the two-step registration flow ----
function RegistrationStepper({ step, step1Confirmed, onJumpToStep1 }) {
  function pill(n, label, active, done, clickable) {
    return /*#__PURE__*/React.createElement("button", {
      key: n,
      type: "button",
      disabled: !clickable,
      onClick: clickable ? onJumpToStep1 : undefined,
      className: "flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1 text-xs font-medium transition " + (clickable ? "cursor-pointer" : "cursor-default"),
      style: {
        background: active ? C.teal : done ? `${C.teal}14` : "#F1F5F9",
        color: active ? "#fff" : done ? C.teal : "#94A3B8"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "grid place-items-center w-5 h-5 rounded-full text-[11px] font-semibold",
      style: {
        background: active ? "rgba(255,255,255,0.25)" : done ? C.teal : "#fff",
        color: active ? "#fff" : done ? "#fff" : "#94A3B8",
        border: !active && !done ? "1px solid #CBD5E1" : "none"
      }
    }, done ? /*#__PURE__*/React.createElement(Icon, { name: "check", size: 12 }) : n), label);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, pill(1, "Client & Batch Info", step === 1, step1Confirmed && step !== 1, step === 2), /*#__PURE__*/React.createElement(Icon, {
    name: "chevronRight",
    size: 14,
    color: "#CBD5E1"
  }), pill(2, "Sample Details", step === 2, false, false));
}

// ---- Collapsed one-line summary of a confirmed Step 1, with an Edit link ----
function ClientPartSummaryBar({ clientPart, selectedTests, onEdit }) {
  const clientLabel = clientPart.organizationName || clientPart.contactPerson || "—";
  const testNames = selectedTests.map(t => t.testTypeName).join(", ") || "None selected";
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-4 rounded-xl px-4 py-3 mb-5",
    style: { background: `${C.teal}0D`, border: "1px solid border-slate-200".replace("border-slate-200", "#E2E8F0") }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-semibold",
    style: { color: C.ink }
  }, clientLabel), /*#__PURE__*/React.createElement("span", { style: { color: "#CBD5E1" } }, "\u2022"), /*#__PURE__*/React.createElement("span", {
    style: { color: C.muted }
  }, "Tracking #", clientPart.trackingNo || "—"), clientPart.refNo && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", { style: { color: "#CBD5E1" } }, "\u2022"), /*#__PURE__*/React.createElement("span", { style: { color: C.muted } }, "Memo #", clientPart.refNo)), /*#__PURE__*/React.createElement("span", { style: { color: "#CBD5E1" } }, "\u2022"), /*#__PURE__*/React.createElement("span", {
    style: { color: C.muted }
  }, "Tests: ", testNames)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onEdit,
    className: "shrink-0 flex items-center gap-1 text-xs font-medium",
    style: { color: C.teal }
  }, /*#__PURE__*/React.createElement(Icon, { name: "edit", size: 12 }), "Edit"));
}

// ---- One clean card per sample (replaces the cramped 4-line flex rows) ----
function SampleEntryCard({ index, row, updateRow, onDuplicate, onRemove, canRemove }) {
  const gridCls = "grid gap-3";
  const gridStyle = { gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" };
  const waterPointOptions = [{ value: "", label: "— Type of Water Point —" }].concat(WATER_POINT_TYPES.map(wt => ({ value: wt, label: wt })));
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-xl p-4 border border-slate-200"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "grid place-items-center w-6 h-6 rounded-full text-xs font-semibold",
    style: { background: "#F1F5F9", color: C.muted }
  }, index + 1), /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-semibold",
    style: { color: C.ink }
  }, "Sample ", index + 1)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onDuplicate,
    title: "Duplicate this sample",
    style: { color: C.muted }
  }, /*#__PURE__*/React.createElement(Icon, { name: "clipboard", size: 14 })), canRemove && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onRemove,
    title: "Remove this sample",
    style: { color: C.warn }
  }, /*#__PURE__*/React.createElement(Icon, { name: "trash", size: 14 })))), /*#__PURE__*/React.createElement("div", {
    className: gridCls,
    style: gridStyle
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Customer Name",
    value: row.customerName,
    onChange: v => updateRow("customerName", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Father's / Husband's Name",
    value: row.fatherHusbandName,
    onChange: v => updateRow("fatherHusbandName", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Site Name",
    value: row.village,
    onChange: v => updateRow("village", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "District",
    value: row.district,
    onChange: v => updateRow("district", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "City Corp. / Pouroshova / Upazilla",
    value: row.upazila,
    onChange: v => updateRow("upazila", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Ward / Union",
    value: row.union,
    onChange: v => updateRow("union", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Latitude",
    value: row.latitude,
    onChange: v => updateRow("latitude", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Longitude",
    value: row.longitude,
    onChange: v => updateRow("longitude", v)
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Type of Water Point",
    value: row.waterPointType,
    onChange: v => updateRow("waterPointType", v),
    options: waterPointOptions
  }), row.waterPointType === "Other (Pls. Specify)" && /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Water Point Type — Please Specify",
    value: row.waterPointTypeOther,
    onChange: v => updateRow("waterPointTypeOther", v)
  })));
}

const MAX_BATCH_ROWS = 5;
function emptySampleRow() {
  return {
    customerName: "",
    fatherHusbandName: "",
    district: "",
    upazila: "",
    union: "",
    village: "",
    latitude: "",
    longitude: "",
    waterPointType: "",
    waterPointTypeOther: ""
  };
}

// ---- manual batch registration: Step 1 (Client & Batch Info, collapses once
// confirmed) then Step 2 (one card per sample, 1-5 rows) — sticky header/
// footer so Cancel/Register are always reachable regardless of scroll ----
function BatchRegistrationForm({
  testTypes,
  references,
  setReferences,
  session,
  notify,
  onCreate,
  onClose
}) {
  const [step, setStep] = React.useState(1);
  const [step1Confirmed, setStep1Confirmed] = React.useState(false);
  const [shared, setShared] = React.useState({
    matrix: "Drinking Water",
    collectionDate: todayStr(),
    collectedBy: "",
    receivedDate: todayStr(),
    priority: "Routine"
  });
  const [clientPart, setClientPart] = React.useState({
    ...CLIENT_PART_EMPTY
  });
  const [selectedTests, setSelectedTests] = React.useState([]);
  const [rows, setRows] = React.useState([emptySampleRow()]);
  const [err, setErr] = React.useState("");

  function toggleTest(t) {
    setSelectedTests(prev => prev.some(x => x.testTypeId === t.id) ? prev.filter(x => x.testTypeId !== t.id) : [...prev, {
      testTypeId: t.id,
      testTypeName: t.name
    }]);
  }
  function updateRow(i, field, value) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function addRow() {
    setRows(prev => prev.length >= MAX_BATCH_ROWS ? prev : [...prev, emptySampleRow()]);
  }
  function duplicateRow(i) {
    setRows(prev => [...prev.slice(0, i + 1), { ...prev[i] }, ...prev.slice(i + 1)].slice(0, MAX_BATCH_ROWS));
  }
  function removeRow(i) {
    setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }

  // Local, side-effect-free validation gate for "Continue to Sample Details" —
  // the real uniqueness check + Reference creation still happens exactly
  // once, in submit() below via the shared submitClientPart(), same as
  // every other Client Part entry point in the app.
  function validateStep1() {
    if (!(clientPart.trackingNo || "").trim()) return "Tracking No. is required.";
    if (!clientPart.sourceType) return "Client Source is required.";
    if (clientPart.sourceType === "others" && !(clientPart.sourceTypeOther || "").trim()) return "Please specify the Client Source.";
    if (clientPart.clientType === "Others (Pls Specify)" && !(clientPart.clientTypeOther || "").trim()) return "Please specify the Client Type.";
    if (selectedTests.length === 0) return "Select at least one requested test.";
    return "";
  }
  function goToStep2() {
    const validationError = validateStep1();
    if (validationError) {
      setErr(validationError);
      return;
    }
    setErr("");
    setStep1Confirmed(true);
    setStep(2);
  }

  function submit() {
    if (rows.every(r => !r.customerName.trim() && !r.village.trim())) {
      setErr("Fill in at least one sample row (Customer Name or Site Name).");
      return;
    }
    const validRows = rows.filter(r => r.customerName.trim() || r.village.trim());
    const result = submitClientPart(clientPart, references, session);
    if (result.error) {
      // Tracking No. / Client Source live in Step 1 — jump back so the
      // person can see and fix the field the error refers to.
      setErr(result.error);
      setStep(1);
      return;
    }
    setReferences(prev => [...prev, result.reference], result.reference);
    onCreate({
      ...shared,
      requestedTests: selectedTests
    }, validRows, result.reference);
  }

  const validCount = rows.filter(r => r.village.trim() || r.customerName.trim()).length;

  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 flex items-center justify-center p-4 z-50",
    style: { background: "rgba(10,30,32,0.45)" }
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full rounded-2xl flex flex-col overflow-hidden shadow-xl",
    style: { background: "#fff", maxWidth: "900px", maxHeight: "90vh" }
  },
  // ---- sticky header: title + stepper ----
  /*#__PURE__*/React.createElement("div", {
    className: "shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-base font-semibold",
    style: { color: C.ink }
  }, "Register Samples"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs mt-0.5",
    style: { color: C.muted }
  }, "One Client Part, then one row per physical sample.")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4"
  }, /*#__PURE__*/React.createElement(RegistrationStepper, {
    step: step,
    step1Confirmed: step1Confirmed,
    onJumpToStep1: () => setStep(1)
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: { color: C.muted }
  }, /*#__PURE__*/React.createElement(Icon, { name: "x", size: 18 })))),
  // ---- scrollable content ----
  /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto px-6 py-5"
  }, err && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mb-4",
    style: { background: C.warnBg, color: C.warn }
  }, err), step === 1 && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold mb-3",
    style: { color: C.ink }
  }, "Client Part"), /*#__PURE__*/React.createElement(ClientPartFields, {
    form: clientPart,
    setForm: setClientPart
  })), /*#__PURE__*/React.createElement("div", {
    className: "h-px",
    style: { background: "#E2E8F0" }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold mb-3",
    style: { color: C.ink }
  }, "Batch Defaults"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: { gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Sample Type",
    value: shared.matrix,
    onChange: v => setShared({ ...shared, matrix: v }),
    options: ["Drinking Water", "Surface Water", "Wastewater", "Groundwater", "Other"].map(m => ({ value: m, label: m }))
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collection Date",
    type: "date",
    value: shared.collectionDate,
    onChange: v => setShared({ ...shared, collectionDate: v })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Received Date",
    type: "date",
    value: shared.receivedDate,
    onChange: v => setShared({ ...shared, receivedDate: v })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collected By",
    value: shared.collectedBy,
    onChange: v => setShared({ ...shared, collectedBy: v })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "h-px",
    style: { background: "#E2E8F0" }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold mb-1",
    style: { color: C.ink }
  }, "Requested Tests"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs mb-3",
    style: { color: C.muted }
  }, "Applies to every sample in this batch."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, testTypes.map(t => {
    const on = selectedTests.some(x => x.testTypeId === t.id);
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      type: "button",
      onClick: () => toggleTest(t),
      className: "px-3 py-1.5 rounded-full text-xs font-medium transition",
      style: {
        border: `1px solid ${on ? C.teal : "#E2E8F0"}`,
        background: on ? C.teal : "transparent",
        color: on ? "#fff" : C.muted
      }
    }, t.name);
  })))), step === 2 && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement(ClientPartSummaryBar, {
    clientPart: clientPart,
    selectedTests: selectedTests,
    onEdit: () => setStep(1)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold",
    style: { color: C.ink }
  }, "Sample Details ", /*#__PURE__*/React.createElement("span", {
    className: "font-normal",
    style: { color: C.muted }
  }, "(", rows.length, ")")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: addRow,
    disabled: rows.length >= MAX_BATCH_ROWS,
    className: "flex items-center gap-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed",
    style: { color: C.teal }
  }, /*#__PURE__*/React.createElement(Icon, { name: "plus", size: 13 }), "Add Another Sample")), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, rows.map((row, i) => /*#__PURE__*/React.createElement(SampleEntryCard, {
    key: i,
    index: i,
    row: row,
    updateRow: (field, v) => updateRow(i, field, v),
    onDuplicate: () => duplicateRow(i),
    onRemove: () => removeRow(i),
    canRemove: rows.length > 1
  }))), rows.length >= MAX_BATCH_ROWS && /*#__PURE__*/React.createElement("p", {
    className: "text-xs",
    style: { color: C.muted }
  }, MAX_BATCH_ROWS, " samples is the manual-entry limit — use the bulk manifest upload for larger batches."))),
  // ---- sticky footer: Cancel + Back + Continue/Register ----
  /*#__PURE__*/React.createElement("div", {
    className: "shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-200"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, step === 2 && /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => setStep(1)
  }, "Back"), step === 1 ? /*#__PURE__*/React.createElement(Button, {
    onClick: goToStep2
  }, "Continue to Sample Details", /*#__PURE__*/React.createElement(Icon, { name: "chevronRight", size: 14 })) : /*#__PURE__*/React.createElement(Button, {
    onClick: submit
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Register ", validCount, " Sample(s)")))));
}


// ---- shown right after a bulk manifest file is picked: choose which tests
// apply to every row in that file (checkbox multi-select, same pattern as
// Register New Sample / Register Batch — no more typing test names) ----
function ImportTestPickerModal({
  testTypes,
  references,
  setReferences,
  session,
  rowCount,
  onConfirm,
  onClose,
  notify
}) {
  const [selectedTests, setSelectedTests] = React.useState([]);
  const [clientPart, setClientPart] = React.useState({ ...CLIENT_PART_EMPTY });
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
    const result = submitClientPart(clientPart, references, session);
    if (result.error) {
      setErr(result.error);
      return;
    }
    setReferences(prev => [...prev, result.reference], result.reference);
    onConfirm(selectedTests, result.reference);
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: `${rowCount} Sample(s) Imported — a Few More Details`,
    onClose: onClose,
    wide: true
  }, err && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mb-3",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, err), /*#__PURE__*/React.createElement("div", {
    className: "mb-4 p-3 rounded",
    style: { background: C.bg, border: `1px solid ${C.border}` }
  }, /*#__PURE__*/React.createElement(ClientPartFields, {
    form: clientPart,
    setForm: setClientPart
  })), /*#__PURE__*/React.createElement("div", {
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
  // ---- Flat Data Table redesign: "Flat View" (every row = one sample,
  // default) vs "Group by Batch" (legacy accordion-by-Reference). Flat is
  // the default so sample IDs are visible on landing without any clicks —
  // see README "Flat Data Table" note.
  const [viewMode, setViewMode] = React.useState("flat");
  // Real-time Registration Sync — ids of samples created in the last few
  // seconds get a highlight + "New" chip so a just-registered/imported
  // sample is unmistakable even in a long list (it also floats to the top
  // naturally since `filtered` is sorted by createdAt desc).
  const [recentlyAddedIds, setRecentlyAddedIds] = React.useState(new Set());
  const [openMenuId, setOpenMenuId] = React.useState(null);
  const perms = permissionsFor(session.role);
  const openSample = samples.find(s => s.id === openId) || null;
  const filtered = samples.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    const ref = s.referenceId ? findReferenceById(references, s.referenceId) : null;
    const haystack = `${s.sampleCode} ${s.clientName} ${s.siteLocation} ${ref?.trackingNo || ""} ${ref?.refNo || ""}`;
    if (q && !haystack.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
  function toggleBatchExpand(ref) {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);else next.add(ref);
      return next;
    });
  }
  // ---- Real-time Registration Sync UX ----
  // Called right after Register Sample(s) / Bulk Import finishes creating
  // samples. New rows already land at the top of the table (sort is by
  // createdAt desc), this just (1) marks them for the highlight style in
  // renderSampleRow, (2) auto-fades that highlight after a few seconds, and
  // (3) scrolls the first new row into view so it's impossible to miss —
  // the "where did my sample go" problem the accordion version had.
  function flagRecentlyAdded(ids) {
    if (!ids || !ids.length) return;
    setRecentlyAddedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    setTimeout(() => {
      const el = document.getElementById(`sample-row-${ids[0]}`);
      if (el) el.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 150);
    setTimeout(() => {
      setRecentlyAddedIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }, 5000);
  }
  function isSampleOverdue(s) {
    if (["released", "rejected", "cancelled"].includes(s.status)) return false;
    const days = daysBetweenD(s.collectionDate, todayStr());
    return s.priority === "Urgent" && days > 1 || s.priority !== "Urgent" && days > 5;
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
      const usableRows = rows.filter(row => {
        const hasName = String(readSampleImportField(row, "customerName")).trim();
        const hasSite = String(readSampleImportField(row, "siteName")).trim();
        return hasName && hasSite;
      });
      const skipped = rows.length - usableRows.length;
      if (!usableRows.length) return notify("No usable rows found (need Customer Name and Site Name in every row).", "warn");
      setPendingImportRows(usableRows);
      setPendingImportSkipped(skipped);
    });
  }
  // Step 2: after the tester picks tests + one Client Type/Reference in
  // ImportTestPickerModal, actually create the samples — every row shares
  // the same requestedTests AND the same Reference (one manifest sheet =
  // one source), instead of each row auto-creating its own Reference from
  // a BatchRef column.
  async function confirmImportSamples(requestedTests, ref) {
    let runningSamples = [...samples];
    let count = 0;
    const newIds = [];
    for (const row of pendingImportRows) {
      const sample = createSample({
        clientName: String(readSampleImportField(row, "customerName")).trim(),
        siteLocation: String(readSampleImportField(row, "siteName")).trim(),
        district: String(readSampleImportField(row, "district")).trim(),
        upazila: String(readSampleImportField(row, "upazila")).trim(),
        union: String(readSampleImportField(row, "union")).trim(),
        village: String(readSampleImportField(row, "siteName")).trim(),
        fatherHusbandName: String(readSampleImportField(row, "fatherHusbandName")).trim(),
        latitude: String(readSampleImportField(row, "latitude")).trim(),
        longitude: String(readSampleImportField(row, "longitude")).trim(),
        waterPointType: String(readSampleImportField(row, "waterPointType")).trim(),
        waterPointTypeOther: String(readSampleImportField(row, "waterPointTypeOther")).trim(),
        referenceId: ref ? ref.id : "",
        batchRef: ref ? ref.refNo : "",
        matrix: String(readSampleImportField(row, "matrix") || "Drinking Water").trim(),
        collectionDate: String(readSampleImportField(row, "collectionDate") || todayStr()),
        collectedBy: String(readSampleImportField(row, "collectedBy")).trim(),
        receivedDate: String(readSampleImportField(row, "receivedDate") || todayStr()),
        priority: String(readSampleImportField(row, "priority") || "Routine").trim(),
        numberOfSamples: 1,
        requestedTests,
        notes: String(readSampleImportField(row, "notes")).trim()
      }, runningSamples, session);
      runningSamples = [...runningSamples, sample];
      await setSamples(prev => [...prev, sample], sample);
      newIds.push(sample.id);
      count++;
    }
    notify(`Imported ${count} sample(s) from manifest under ${ref ? referenceDisplayLabel(ref) : "(no reference)"}${pendingImportSkipped ? `, skipped ${pendingImportSkipped} row(s) missing Client Name/Site Location` : ""}.`, count ? "ok" : "warn");
    setPendingImportRows(null);
    setPendingImportSkipped(0);
    if (ref) setExpandedBatches(prev => new Set(prev).add(ref.id));
    flagRecentlyAdded(newIds);
  }
  async function handleUpdate(next) {
    await setSamples(prev => prev.map(s => s.id === next.id ? next : s), next);
  }
  async function handleDeleteSample(sample) {
    await setSamples(prev => prev.filter(s => s.id !== sample.id));
    notify?.(`${sample.sampleCode} deleted.`, "ok");
  }
  async function handleBatchCreate(shared, rows, ref) {
    let runningSamples = [...samples];
    let count = 0;
    const newIds = [];
    for (const row of rows) {
      const sample = createSample({
        ...shared,
        clientName: row.customerName,
        siteLocation: row.village,
        referenceId: ref.id,
        batchRef: ref.refNo,
        district: row.district,
        upazila: row.upazila,
        union: row.union,
        village: row.village,
        fatherHusbandName: row.fatherHusbandName,
        latitude: row.latitude,
        longitude: row.longitude,
        waterPointType: row.waterPointType,
        waterPointTypeOther: row.waterPointTypeOther,
        numberOfSamples: 1
      }, runningSamples, session);
      runningSamples = [...runningSamples, sample];
      await setSamples(prev => [...prev, sample], sample);
      newIds.push(sample.id);
      count++;
    }
    setShowBatchForm(false);
    setExpandedBatches(prev => new Set(prev).add(ref.id));
    notify?.(`${count} sample(s) registered under Reference ${referenceDisplayLabel(ref)} (Tracking No. ${ref.trackingNo}).`, "ok");
    flagRecentlyAdded(newIds);
  }
  const stats = sampleLifecycleStats(samples);
  function renderBatchTag(s) {
    const ref = s.referenceId ? findReferenceById(references, s.referenceId) : null;
    if (!ref) return /*#__PURE__*/React.createElement("span", {
      className: "text-xs",
      style: {
        color: C.muted
      }
    }, "—");
    const meta = referenceSourceMeta(ref.sourceType);
    return /*#__PURE__*/React.createElement("span", {
      title: `${meta.label}: ${referenceDisplayLabel(ref)}`,
      className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium max-w-[170px]"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 10
    }), /*#__PURE__*/React.createElement("span", {
      className: "truncate"
    }, referenceDisplayLabel(ref)));
  }
  function renderRowActions(s) {
    const ref = s.referenceId ? findReferenceById(references, s.referenceId) : null;
    const menuOpen = openMenuId === s.id;
    return /*#__PURE__*/React.createElement("div", {
      className: "relative inline-block text-left",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      title: "Row actions",
      onClick: () => setOpenMenuId(menuOpen ? null : s.id),
      className: "p-1.5 rounded hover:bg-black/5"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "moreVertical",
      size: 15,
      color: C.muted
    })), menuOpen && /*#__PURE__*/React.createElement("div", {
      className: "absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg py-1",
      style: {
        background: "#fff",
        border: `1px solid ${C.border}`,
        zIndex: 30
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-black/5",
      style: {
        color: C.ink
      },
      onClick: () => {
        setOpenId(s.id);
        setOpenMenuId(null);
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 12
    }), "View Details"), ref && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-black/5",
      style: {
        color: C.ink
      },
      onClick: () => {
        setViewMode("grouped");
        setExpandedBatches(prev => new Set(prev).add(s.referenceId));
        setOpenMenuId(null);
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "layers",
      size: 12
    }), "View Full Batch"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-black/5",
      style: {
        color: C.muted
      },
      onClick: () => {
        if (navigator.clipboard) navigator.clipboard.writeText(s.sampleCode);
        notify?.(`Copied ${s.sampleCode} to clipboard.`, "ok");
        setOpenMenuId(null);
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "link",
      size: 12
    }), "Copy Sample ID")));
  }
  function renderSampleRow(s, indented) {
    const isNew = recentlyAddedIds.has(s.id);
    const overdue = isSampleOverdue(s);
    return /*#__PURE__*/React.createElement("tr", {
      key: s.id,
      id: `sample-row-${s.id}`,
      className: "cursor-pointer",
      style: {
        borderTop: `1px solid ${C.border}`,
        background: isNew ? `${C.teal}14` : indented ? C.card : "transparent",
        transition: "background-color 1.5s ease"
      },
      onClick: () => setOpenId(s.id)
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2 font-medium",
      style: {
        color: C.ink,
        paddingLeft: indented ? 28 : undefined
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "inline-flex items-center gap-1.5"
    }, s.sampleCode, isNew && /*#__PURE__*/React.createElement("span", {
      className: "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide",
      style: {
        background: C.teal,
        color: "#fff"
      }
    }, "New"))), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2"
    }, renderBatchTag(s)), /*#__PURE__*/React.createElement("td", {
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
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-1 flex-wrap"
    }, /*#__PURE__*/React.createElement(SampleStatusBadge, {
      status: s.status
    }), overdue && /*#__PURE__*/React.createElement("span", {
      className: "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
      style: {
        background: C.warnBg,
        color: C.warn
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 9
    }), "Overdue"))), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2",
      style: {
        color: C.muted
      }
    }, s.assignedTo || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2 text-right"
    }, renderRowActions(s)));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-4 flex-wrap"
  }, [{
    k: "samples",
    label: "Samples Registration",
    icon: "beaker"
  }, {
    k: "subBatches",
    label: "Create Analytical Batch",
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
  }, perms.canRegister && /*#__PURE__*/React.createElement("input", {
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
  }), "Import Data"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => downloadTemplate("samples")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 14
  }), "Download Template")), /*#__PURE__*/React.createElement("div", {
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
    placeholder: "Search sample code, client, site, Tracking No…",
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
  }, s.label))), /*#__PURE__*/React.createElement("span", {
    className: "flex-1"
  }), /*#__PURE__*/React.createElement("div", {
    className: "inline-flex rounded-lg p-0.5",
    style: {
      background: C.bg,
      border: `1px solid ${C.border}`
    }
  }, [{
    k: "flat",
    label: "Flat View",
    icon: "list"
  }, {
    k: "grouped",
    label: "Group by Batch",
    icon: "layers"
  }].map(v => /*#__PURE__*/React.createElement("button", {
    key: v.k,
    type: "button",
    onClick: () => setViewMode(v.k),
    className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
    style: {
      background: viewMode === v.k ? C.card : "transparent",
      color: viewMode === v.k ? C.ink : C.muted,
      boxShadow: viewMode === v.k ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: v.icon,
    size: 13
  }), v.label)))), /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg overflow-hidden",
    style: {
      border: `1px solid ${C.border}`
    },
    onClick: () => openMenuId && setOpenMenuId(null)
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: C.bg
    }
  }, ["Sample Code", "Batch / Memo Ref", "Client", "Site", "Matrix", "Priority", "Status", "Assigned To", ""].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-3 py-2 text-xs font-semibold",
    style: {
      color: C.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, viewMode === "flat" ? filtered.map(s => renderSampleRow(s, false)) : listItems.map(item => {
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
      colSpan: 9,
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
    }, item.reference ? `${referenceSourceMeta(item.reference.sourceType).label}: ${referenceDisplayLabel(item.reference)}` : "Reference: (unknown)"), item.reference?.clientType && /*#__PURE__*/React.createElement("span", {
      className: "text-[11px] px-2 py-0.5 rounded-full",
      style: {
        background: `${C.info}1A`,
        color: C.info
      }
    }, item.reference.clientType), /*#__PURE__*/React.createElement("span", {
      className: "text-xs",
      style: {
        color: C.muted
      }
    }, item.members.length, " sample(s)"), /*#__PURE__*/React.createElement("span", {
      className: "flex-1"
    }), /*#__PURE__*/React.createElement(BatchStatusSummary, {
      members: item.members
    })))), isOpen && item.members.map(s => renderSampleRow(s, true)));
  }), (viewMode === "flat" ? !filtered.length : !listItems.length) && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 9,
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
    references: references,
    setReferences: setReferences,
    session: session,
    rowCount: pendingImportRows.length,
    onConfirm: confirmImportSamples,
    onClose: () => {
      setPendingImportRows(null);
      setPendingImportSkipped(0);
    },
    notify: notify
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
  if (status === "released") return /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11
  }), " Released");
  if (status === "approved") return /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11
  }), " Approved");
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
  const [approvingSubBatchId, setApprovingSubBatchId] = React.useState(null);
  // Which Batch Action panel (Approve / Release) is expanded in the
  // consolidated toolbar above "All Analytical Batches" — replaces the two
  // separate always-visible "Batch Approve"/"Batch Release" cards.
  const [activeBatchAction, setActiveBatchAction] = React.useState(null); // "approve" | "release" | null
  // ---- Batch (Reference) level bulk approve — the same signed decision as
  // Sub-Batch approve, just scoped to "every parameter under_review for any
  // sample under this Reference" instead of one Sub-Batch's single
  // parameter. Grouped by testTypeId under the hood since the underlying
  // bulkDecideParameter() call is per-parameter — one signature still
  // covers everything found.
  const [batchApproveReferenceId, setBatchApproveReferenceId] = React.useState("");
  const [showBatchApproveSignature, setShowBatchApproveSignature] = React.useState(false);
  const referenceApproveOptions = Array.from(new Set(samples.map(s => s.referenceId).filter(Boolean))).map(id => findReferenceById(references, id)).filter(Boolean).filter(ref => samples.some(s => s.referenceId === ref.id && (s.requestedTests || []).some(rt => rt.status === "under_review"))).sort((a, b) => (a.refNo || "").localeCompare(b.refNo || ""));
  const selectedBatchApproveReference = batchApproveReferenceId ? findReferenceById(references, batchApproveReferenceId) : null;
  const pendingApprovalPairs = selectedBatchApproveReference ? samples.filter(s => s.referenceId === selectedBatchApproveReference.id).flatMap(s => (s.requestedTests || []).filter(rt => rt.status === "under_review").map(rt => ({
    sample: s,
    testTypeId: rt.testTypeId,
    testTypeName: rt.testTypeName
  }))) : [];
  function batchApproveByReference(payload) {
    if (!selectedBatchApproveReference) return;
    const byTestType = {};
    pendingApprovalPairs.forEach(p => {
      (byTestType[p.testTypeId] = byTestType[p.testTypeId] || {
        testTypeName: p.testTypeName,
        samples: []
      }).samples.push(p.sample);
    });
    let totalUpdated = 0,
      totalSkipped = 0,
      hadError = false;
    Object.entries(byTestType).forEach(([testTypeId, group]) => {
      let result;
      try {
        result = bulkDecideParameter(group.samples, testTypeId, group.testTypeName, payload, session);
      } catch (e) {
        notify?.(e.message, "warn");
        hadError = true;
        return;
      }
      result.updated.forEach(updated => {
        setSamples(prev => prev.map(s => s.id === updated.id ? updated : s), updated);
      });
      totalUpdated += result.updated.length;
      totalSkipped += result.skipped;
    });
    if (hadError) return;
    notify?.(`${totalUpdated} parameter-sample pair(s) ${payload.decision === "approved" ? "approved" : "sent back to analyst"} across ${referenceDisplayLabel(selectedBatchApproveReference)}.`, payload.decision === "approved" ? "ok" : "warn");
    setBatchApproveReferenceId("");
    setShowBatchApproveSignature(false);
  }
  // ---- Batch (Reference) level bulk RELEASE — same shape as bulk
  // approve above, but for the Approved -> Released step (no signature
  // needed, matching the existing single-sample Release button). ----
  const [batchReleaseReferenceId, setBatchReleaseReferenceId] = React.useState("");
  const referenceReleaseOptions = Array.from(new Set(samples.map(s => s.referenceId).filter(Boolean))).map(id => findReferenceById(references, id)).filter(Boolean).filter(ref => samples.some(s => s.referenceId === ref.id && (s.requestedTests || []).some(rt => rt.status === "approved"))).sort((a, b) => (a.refNo || "").localeCompare(b.refNo || ""));
  const selectedBatchReleaseReference = batchReleaseReferenceId ? findReferenceById(references, batchReleaseReferenceId) : null;
  const pendingReleasePairs = selectedBatchReleaseReference ? samples.filter(s => s.referenceId === selectedBatchReleaseReference.id).flatMap(s => (s.requestedTests || []).filter(rt => rt.status === "approved").map(rt => ({
    sample: s,
    testTypeId: rt.testTypeId,
    testTypeName: rt.testTypeName
  }))) : [];
  function batchReleaseByReference() {
    if (!selectedBatchReleaseReference) return;
    const byTestType = {};
    pendingReleasePairs.forEach(p => {
      (byTestType[p.testTypeId] = byTestType[p.testTypeId] || {
        testTypeName: p.testTypeName,
        samples: []
      }).samples.push(p.sample);
    });
    let totalUpdated = 0,
      totalSkipped = 0;
    Object.entries(byTestType).forEach(([testTypeId, group]) => {
      const result = bulkReleaseParameter(group.samples, testTypeId, group.testTypeName, session);
      result.updated.forEach(updated => {
        setSamples(prev => prev.map(s => s.id === updated.id ? updated : s), updated);
      });
      totalUpdated += result.updated.length;
      totalSkipped += result.skipped;
    });
    notify?.(`${totalUpdated} parameter-sample pair(s) released across ${referenceDisplayLabel(selectedBatchReleaseReference)}.`, "ok");
    setBatchReleaseReferenceId("");
  }

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
    label: "Analytical Batch Label (optional)",
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

  // Interactive selection GRID (real table + checkboxes) instead of a passive
  // info box / flex list — this is what actually shows up once a Test Type
  // is picked, addressing "poor interactive feedback" from the old design.
  const pickerListBox = /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg overflow-hidden",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-h-64 overflow-y-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: C.bg,
      position: "sticky",
      top: 0
    }
  }, ["", "Sample Code", "Client", "Reference"].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1.5 font-semibold",
    style: {
      color: C.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, eligibleSamples.map(s => {
    const checked = selectedSampleIds.includes(s.id);
    const ref = s.referenceId ? findReferenceById(references, s.referenceId) : null;
    return /*#__PURE__*/React.createElement("tr", {
      key: s.id,
      className: "cursor-pointer",
      style: {
        borderTop: `1px solid ${C.border}`,
        background: checked ? `${C.teal}14` : "transparent"
      },
      onClick: () => toggleMember(s.id)
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: checked,
      onChange: () => toggleMember(s.id)
    })), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5 font-semibold",
      style: {
        color: C.ink
      }
    }, s.sampleCode), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.muted
      }
    }, s.clientName), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.muted
      }
    }, ref ? referenceDisplayLabel(ref) : "—"));
  })))));

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
  }), editingSubBatchId ? "Save Changes" : `Create Analytical Batch (${selectedSampleIds.length})`));

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

  // ---- Two-Column Dashboard Layout ----
  // Left: the creation form (Test Type / Label / Tester). Right: the live,
  // dynamic "Eligible Pending Samples" picker for whichever Test Type is
  // selected on the left — replaces the old single stacked card where the
  // picker sat awkwardly below a wall of form fields.
  const formCard = /*#__PURE__*/React.createElement(SectionCard, {
    title: editingSubBatchId ? "Edit Analytical Batch" : "Create Analytical Batch",
    subtitle: "Group pending samples requesting the same test into one batch — shares one QC check, tested together in Add Test Record.",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 15
    })
  }, filterFields);
  const pickerCard = /*#__PURE__*/React.createElement(SectionCard, {
    title: "Eligible Pending Samples",
    subtitle: selectedTestId ? `${eligibleSamples.length} sample(s) pending ${testTypes.find(t => t.id === selectedTestId)?.name || "this test"} — check the ones to include.` : "Pick a Test Type on the left to load the live picker.",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 15
    })
  }, pickerBlock);
  const creationSection = /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4",
    style: {
      gridTemplateColumns: "minmax(240px, 1fr) minmax(320px, 1.6fr)"
    }
  }, formCard, pickerCard);

  // ---- Consolidated "All Analytical Batches" data table ----
  // Each sub-batch is a real <tr> now (Analytical Batch / Samples / Tester /
  // Status / Actions columns) instead of a standalone bordered card, so the
  // whole list reads as one aligned enterprise table. Review/Return/Final
  // Approve/Release live as row-level action buttons on the right — this is
  // also where Batch Approve/Release (by Reference) results ultimately show
  // up once applied. Any inline panel a row needs (delete confirm, return
  // note, signature capture) renders as a second, full-width <tr> directly
  // beneath it rather than breaking table alignment.
  function renderSubBatchRow(sb) {
    const testerControl = sb.status === "pending" ? /*#__PURE__*/React.createElement("select", {
      className: "border rounded px-2 py-1 text-xs w-full",
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
    const hasPanel = deleteSubBatchId === sb.id || returningSubBatchId === sb.id || approvingSubBatchId === sb.id;
    const mainRow = /*#__PURE__*/React.createElement("tr", {
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs font-semibold",
      style: {
        color: C.ink
      }
    }, sb.label, " · ", sb.testTypeName), /*#__PURE__*/React.createElement("div", {
      className: "text-[11px]",
      style: {
        color: C.muted
      }
    }, "created ", new Date(sb.createdAt).toLocaleDateString())), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2 text-xs",
      style: {
        color: C.ink
      }
    }, sb.memberSampleIds.length), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2"
    }, testerControl), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2"
    }, SUB_BATCH_STATUS_BADGE(sb.status)), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2 text-right"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-end gap-1.5 flex-wrap"
    }, sb.status === "tested" && /*#__PURE__*/React.createElement(Button, {
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
    }, "Return"), sb.status === "reviewed" && /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: () => setApprovingSubBatchId(sb.id)
    }, "Final Approve"), sb.status === "approved" && /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: () => bulkReleaseSubBatch(sb, samples, setSamples, setSubBatches, session, notify)
    }, "Release"), /*#__PURE__*/React.createElement(IconButton, {
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
    }))));
    const panelRow = !hasPanel ? null : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: 5,
      className: "px-3 pb-3"
    }, deleteSubBatchId === sb.id && /*#__PURE__*/React.createElement(ConfirmBar, {
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
    }, "Confirm Return"))), approvingSubBatchId === sb.id && /*#__PURE__*/React.createElement(SignatureCapture, {
      user: session,
      label: `Final Approval — ${sb.testTypeName} for ${sb.memberSampleIds.length} sample(s) in ${sb.label}`,
      onConfirm: payload => {
        bulkApproveSubBatch(sb, samples, setSamples, setSubBatches, session, notify, payload);
        setApprovingSubBatchId(null);
      }
    })));
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: sb.id
    }, mainRow, panelRow);
  }

  const listCard = /*#__PURE__*/React.createElement(SectionCard, {
    title: "All Analytical Batches",
    subtitle: "Review, approve, and release results directly from the batch list.",
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
  }, ["Analytical Batch", "Samples", "Tester", "Status", ""].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-3 py-2 text-xs font-semibold",
    style: {
      color: C.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, subBatches.map(sb => renderSubBatchRow(sb))))));

  const batchApproveReferencePicker = /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm w-full",
    style: {
      borderColor: C.border
    },
    value: batchApproveReferenceId,
    onChange: e => {
      setBatchApproveReferenceId(e.target.value);
      setShowBatchApproveSignature(false);
    }
  }, [/*#__PURE__*/React.createElement("option", {
    key: "none",
    value: ""
  }, "— Select a Reference —")].concat(referenceApproveOptions.map(ref => /*#__PURE__*/React.createElement("option", {
    key: ref.id,
    value: ref.id
  }, `${referenceSourceMeta(ref.sourceType).label} — ${referenceDisplayLabel(ref)}`))));

  const batchApprovePairsList = !selectedBatchApproveReference ? null : /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1 mt-2 max-h-56 overflow-y-auto"
  }, pendingApprovalPairs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Nothing awaiting final approval under this Reference right now.") : pendingApprovalPairs.map(p => {
    const resultInfo = getSampleResultForTest(p.sample, p.testTypeId, testRecords);
    return /*#__PURE__*/React.createElement("div", {
      key: `${p.sample.id}-${p.testTypeId}`,
      className: "flex flex-wrap items-center gap-1.5 px-2 py-1 rounded text-xs",
      style: {
        background: C.bg
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-semibold",
      style: {
        color: C.ink
      }
    }, p.sample.sampleCode), /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.muted
      }
    }, p.sample.clientName), /*#__PURE__*/React.createElement("span", {
      className: "px-1.5 py-0.5 rounded",
      style: {
        background: `${C.info}1A`,
        color: C.info
      }
    }, p.testTypeName), resultInfo && resultInfo.results.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "ml-auto px-1.5 py-0.5 rounded",
      style: {
        background: C.okBg,
        color: C.ok
      }
    }, resultInfo.results.filter(r => r.value != null).map(r => `${r.name}: ${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ""}`).join(", ") || "no value yet"));
  }));

  const batchApproveButton = !selectedBatchApproveReference || pendingApprovalPairs.length === 0 || showBatchApproveSignature ? null : /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    className: "mt-2",
    onClick: () => setShowBatchApproveSignature(true)
  }, `Final Approve All (${pendingApprovalPairs.length})`);

  const batchApproveSignaturePanel = !selectedBatchApproveReference || !showBatchApproveSignature ? null : /*#__PURE__*/React.createElement(SignatureCapture, {
    user: session,
    label: `Final Approval — ${pendingApprovalPairs.length} parameter-sample pair(s) under ${referenceDisplayLabel(selectedBatchApproveReference)}`,
    onConfirm: batchApproveByReference
  });

  const batchApproveCard = /*#__PURE__*/React.createElement(SectionCard, {
    title: "Batch Approve (by Reference)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 15
    })
  }, referenceApproveOptions.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "No Reference currently has parameters awaiting final approval.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, "One signature approves every parameter across every sample under the chosen Reference that's ready for final approval."), batchApproveReferencePicker, batchApprovePairsList, batchApproveButton, batchApproveSignaturePanel));

  const batchReleaseReferencePicker = /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm w-full",
    style: {
      borderColor: C.border
    },
    value: batchReleaseReferenceId,
    onChange: e => setBatchReleaseReferenceId(e.target.value)
  }, [/*#__PURE__*/React.createElement("option", {
    key: "none",
    value: ""
  }, "— Select a Reference —")].concat(referenceReleaseOptions.map(ref => /*#__PURE__*/React.createElement("option", {
    key: ref.id,
    value: ref.id
  }, `${referenceSourceMeta(ref.sourceType).label} — ${referenceDisplayLabel(ref)}`))));

  const batchReleasePairsList = !selectedBatchReleaseReference ? null : /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1 mt-2 max-h-56 overflow-y-auto"
  }, pendingReleasePairs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Nothing approved and awaiting release under this Reference right now.") : pendingReleasePairs.map(p => {
    const resultInfo = getSampleResultForTest(p.sample, p.testTypeId, testRecords);
    return /*#__PURE__*/React.createElement("div", {
      key: `${p.sample.id}-${p.testTypeId}`,
      className: "flex flex-wrap items-center gap-1.5 px-2 py-1 rounded text-xs",
      style: {
        background: C.bg
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-semibold",
      style: {
        color: C.ink
      }
    }, p.sample.sampleCode), /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.muted
      }
    }, p.sample.clientName), /*#__PURE__*/React.createElement("span", {
      className: "px-1.5 py-0.5 rounded",
      style: {
        background: `${C.info}1A`,
        color: C.info
      }
    }, p.testTypeName), resultInfo && resultInfo.results.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "ml-auto px-1.5 py-0.5 rounded",
      style: {
        background: C.okBg,
        color: C.ok
      }
    }, resultInfo.results.filter(r => r.value != null).map(r => `${r.name}: ${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ""}`).join(", ") || "no value yet"));
  }));

  const batchReleaseButton = !selectedBatchReleaseReference || pendingReleasePairs.length === 0 ? null : /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    className: "mt-2",
    onClick: batchReleaseByReference
  }, `Release All (${pendingReleasePairs.length})`);

  const batchReleaseCard = /*#__PURE__*/React.createElement(SectionCard, {
    title: "Batch Release (by Reference)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 15
    })
  }, referenceReleaseOptions.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "No Reference currently has approved parameters awaiting release.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, "Releases every approved parameter across every sample under the chosen Reference — no signature needed, same as the single-sample Release button."), batchReleaseReferencePicker, batchReleasePairsList, batchReleaseButton));

  // ---- Consolidated Batch Actions toolbar ----
  // Batch Approve / Batch Release used to be two large, always-open cards
  // sitting between "Create" and "All Analytical Batches" — most of the
  // time empty or single-line. They're now two toggle buttons; the picked
  // one's panel (unchanged content/logic — batchApproveCard/batchReleaseCard
  // above) expands directly beneath, right above the batch table it acts on.
  const batchActionsToolbar = /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold",
    style: {
      color: C.muted
    }
  }, "Batch Actions:"), /*#__PURE__*/React.createElement(Button, {
    variant: activeBatchAction === "approve" ? "primary" : "outline",
    size: "sm",
    onClick: () => setActiveBatchAction(activeBatchAction === "approve" ? null : "approve")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), `Batch Approve (by Reference)${referenceApproveOptions.length ? ` · ${referenceApproveOptions.length}` : ""}`), /*#__PURE__*/React.createElement(Button, {
    variant: activeBatchAction === "release" ? "primary" : "outline",
    size: "sm",
    onClick: () => setActiveBatchAction(activeBatchAction === "release" ? null : "release")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "printer",
    size: 12
  }), `Batch Release (by Reference)${referenceReleaseOptions.length ? ` · ${referenceReleaseOptions.length}` : ""}`));

  const batchActionsPanel = activeBatchAction === "approve" ? batchApproveCard : activeBatchAction === "release" ? batchReleaseCard : null;

  const batchActionsCard = /*#__PURE__*/React.createElement(SectionCard, {
    title: "Batch Actions",
    subtitle: "Approve or release every parameter across a whole Reference in one signed action.",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 15
    })
  }, batchActionsToolbar, batchActionsPanel);

  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, creationSection, batchActionsCard, listCard);
}
