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
    notify?.(`Client entry ${result.reference.refNo} created.${result.isDuplicateTrackingNo ? ` Tracking No. "${(result.reference.trackingNo || "").trim()}" matches an existing batch — these samples will be grouped under it.` : ""}`, "ok");
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
    setForm: setNewForm,
    references: references
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
  contactPhone: ""
};
function ClientPartFields({
  form,
  setForm,
  references
}) {
  // Tracking No. is required, but is intentionally allowed to repeat — a
  // single batch of samples legitimately shares one Tracking No. These bits
  // of local UI state just drive the inline red-asterisk/red-border
  // "required" validation and the (non-blocking) "same batch" info note
  // below, without affecting the shared submit-time validation in
  // submitClientPart() (which still runs when the form is actually
  // submitted, and no longer blocks on a repeated Tracking No. either).
  const [trackingTouched, setTrackingTouched] = React.useState(false);
  const [showDupInfoModal, setShowDupInfoModal] = React.useState(false);
  function set(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  }
  const trackingNoTrimmed = (form.trackingNo || "").trim();
  const isDuplicateTrackingNo = !!trackingNoTrimmed && isTrackingNoTaken(form.trackingNo, references);
  const trackingNoError = trackingTouched && !trackingNoTrimmed ? "Tracking No. is required." : "";
  const trackingNoInfo = !trackingNoError && isDuplicateTrackingNo ? `Tracking No. "${trackingNoTrimmed}" is already in use — these samples will be grouped under the same Tracking No.` : "";
  function checkTrackingNoOnBlur() {
    setTrackingTouched(true);
    if (trackingNoTrimmed && isTrackingNoTaken(form.trackingNo, references)) {
      setShowDupInfoModal(true);
    }
  }
  return /*#__PURE__*/React.createElement("div", null, showDupInfoModal && /*#__PURE__*/React.createElement(Modal, {
    title: "Same Tracking No. as an existing batch",
    onClose: () => setShowDupInfoModal(false)
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm",
    style: { color: C.ink }
  }, `Tracking No. "${trackingNoTrimmed}" is already used by another Client entry. That's fine if these samples belong to the same batch — they'll be grouped under it. If they don't, enter a different Tracking No., or use "Generate" for a new one.`), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mt-3"
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => setShowDupInfoModal(false)
  }, "OK"))), /*#__PURE__*/React.createElement("div", {
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
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-1",
    style: {
      gridColumn: "span 2",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-end gap-1.5 flex-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1",
    style: {
      minWidth: 160
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: /*#__PURE__*/React.createElement("span", null, "Tracking No. ", /*#__PURE__*/React.createElement("span", {
      style: { color: C.warn }
    }, "*")),
    value: form.trackingNo,
    onChange: v => set("trackingNo", v),
    onBlur: checkTrackingNoOnBlur,
    error: trackingNoError
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Auto-generate a Tracking No.",
    onClick: () => {
      set("trackingNo", generateTrackingNo(references, form.letterDate));
      setTrackingTouched(false);
    },
    className: "px-2.5 py-1.5 rounded text-xs font-medium border whitespace-nowrap shrink-0",
    style: {
      borderColor: C.border,
      color: C.ink,
      background: C.card
    }
  }, "Generate")), trackingNoInfo ? /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] flex items-center gap-1",
    style: { color: C.teal }
  }, /*#__PURE__*/React.createElement(Icon, { name: "info", size: 11 }), trackingNoInfo) : !trackingNoError && /*#__PURE__*/React.createElement("span", {
    className: "text-[11px]",
    style: { color: C.muted }
  }, "Samples from the same batch/delivery should share the same Tracking No.")), /*#__PURE__*/React.createElement("div", {
    style: { minWidth: 0 }
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Organization Name",
    value: form.organizationName,
    onChange: v => set("organizationName", v)
  })), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Client Name",
    value: form.contactPerson,
    onChange: v => set("contactPerson", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Client Contact No.",
    value: form.contactPhone,
    onChange: v => set("contactPhone", v)
  })));
}
// Validates the Client Part form + actually creates the Reference. Shared
// by the registration form and the bulk-upload popup so field mapping only
// lives in one place. Tracking No. is required, but — since one batch of
// samples legitimately shares a single Tracking No. — it is NOT required to
// be unique across Client entries. When it repeats an existing one, the
// caller gets `isDuplicateTrackingNo: true` on a successful result so it can
// surface an informational (non-blocking) message that the new samples will
// be grouped under that same Tracking No.
function submitClientPart(form, references, session) {
  if (!(form.trackingNo || "").trim()) {
    return {
      error: "Tracking No. is required."
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
  const isDuplicateTrackingNo = isTrackingNoTaken(form.trackingNo, references);
  const reference = createReference(form, references, session);
  return {
    reference,
    isDuplicateTrackingNo
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
    twId: "",
    sampleType: "Drinking Water",
    collectionDate: todayStr(),
    collectedBy: "",
    receivedDate: todayStr(),
    priority: "Routine",
    numberOfSamples: 1
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
    className: "grid grid-cols-1 md:grid-cols-2 gap-3"
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
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "TW ID",
    value: form.twId,
    onChange: v => setForm({
      ...form,
      twId: v
    })
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Sample Type",
    value: form.sampleType,
    onChange: v => setForm({
      ...form,
      sampleType: v
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
  }, "No test methods configured yet — add one in Test Method Engine first."))), err && /*#__PURE__*/React.createElement("div", {
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
  const [signedName, setSignedName] = React.useState(user?.name || user?.username || "");
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
  permissionMatrix,
  testTypes,
  testRecords,
  subBatches,
  references,
  setReferences,
  onClose,
  onUpdate,
  onDelete,
  notify,
  goToResultsWorkflow
}) {
  const perms = permissionsFor(permissionMatrix, session);
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
  const [addParamOpen, setAddParamOpen] = React.useState(false);
  const [addParamSelection, setAddParamSelection] = React.useState([]);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [custodyAction, setCustodyAction] = React.useState(null); // target status string ("on_hold"|"rejected"|"cancelled") | null
  const isGuestUser = session?.role === "Guest";
  const canEditAllowed = perms.canRegister && sample.status !== "released";
  const canDeleteAllowed = perms.canRegister && (sample.linkedTestRecordIds || []).length === 0;
  const canEdit = canEditAllowed || (isGuestUser && sample.status !== "released");
  const canDelete = canDeleteAllowed || (isGuestUser && (sample.linkedTestRecordIds || []).length === 0);
  // Deliberately NOT gated the same way as "Correct Registration" (which
  // blocks once sample.status is "released") — adding a NEW parameter is
  // exactly what you need to do *after* the original parameter(s) were
  // already released and the client asks for one more test on the same
  // retained sample. The new parameter starts at "pending" regardless, so
  // it's always safe to add — the only real blocker is the physical sample
  // itself being unusable (rejected/cancelled).
  const canAddParamAllowed = perms.canRegister && !["rejected", "cancelled"].includes(sample.status);
  const canAddParam = canAddParamAllowed || (isGuestUser && !["rejected", "cancelled"].includes(sample.status));
  function guardSampleAction(allowed, handler) {
    return () => {
      if (allowed) return handler();
      notify?.("Guest access can't edit or delete samples — this login is view-only for this action.", "warn");
    };
  }
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
      sampleType: sample.sampleType,
      collectionDate: sample.collectionDate,
      collectedBy: sample.collectedBy,
      receivedDate: sample.receivedDate,
      priority: sample.priority
    });
    setEditing(true);
  }
  function saveEdit() {
    const next = editSample(sample, editForm, session);
    onUpdate(next);
    notify?.("Registration details updated.", "ok");
    setEditing(false);
  }
  // Fixes "we meant to request 3 parameters but only ticked 2 at
  // registration" — lets a missed parameter be added after the fact,
  // for this one sample. It starts at "pending" just like any parameter
  // picked at registration, and joins the normal pipeline from there
  // (gets grouped into a Sub-Batch / test record like any other pending
  // parameter). See addRequestedTests() in 20-sample-model.js.
  const notYetRequestedTypes = (testTypes || []).filter(t => !(sample.requestedTests || []).some(rt => rt.testTypeId === t.id));
  function toggleAddParamSelection(t) {
    setAddParamSelection(prev => prev.some(x => x.testTypeId === t.id) ? prev.filter(x => x.testTypeId !== t.id) : [...prev, {
      testTypeId: t.id,
      testTypeName: t.name
    }]);
  }
  function confirmAddParams() {
    if (!addParamSelection.length) return;
    const next = addRequestedTests(sample, addParamSelection, session);
    onUpdate(next);
    notify?.(`Added ${addParamSelection.map(t => t.testTypeName).join(", ")} to this sample's requested tests.`, "ok");
    setAddParamSelection([]);
    setAddParamOpen(false);
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
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))"
    }
  }, [["clientName", "Customer Name"], ["siteLocation", "Site / Location"], ["district", "District"], ["upazila", "Upazila / City Corp"], ["union", "Union / Pourashava"], ["village", "Site Name/Village"], ["fatherHusbandName", "Father's / Husband's Name"], ["latitude", "Latitude"], ["longitude", "Longitude"], ["waterPointTypeOther", "Type of Water Point - Other"], ["collectedBy", "Collected By"]].map(([field, fieldLabel]) => /*#__PURE__*/React.createElement("label", {
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
  }, "Sample Type", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: editForm.sampleType,
    onChange: e => setEditForm(prev => ({
      ...prev,
      sampleType: e.target.value
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
  }, sample.sampleType, " · ", sample.siteLocation, " · ", sample.numberOfSamples || 1, " sample", (sample.numberOfSamples || 1) > 1 ? "s" : "", " in batch"), /*#__PURE__*/React.createElement("div", {
    className: "ml-auto flex items-center gap-1"
  }, canEdit && /*#__PURE__*/React.createElement(IconButton, {
    name: "edit",
    color: C.teal,
    title: "Correct registration details",
    onClick: guardSampleAction(canEditAllowed, startEdit)
  }), canDelete && /*#__PURE__*/React.createElement(IconButton, {
    name: "trash",
    color: C.warn,
    title: "Delete this sample (no test records linked yet)",
    onClick: guardSampleAction(canDeleteAllowed, () => setConfirmDelete(true))
  }))), deleteConfirmPanel, editPanel, addParamOpen ? /*#__PURE__*/React.createElement("div", {
    className: "mb-3 p-3 rounded",
    style: {
      background: C.bg,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Add Parameter(s) to This Sample"), notYetRequestedTypes.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.muted
    }
  }, "Every available test type is already requested for this sample.") : /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 mb-2"
  }, notYetRequestedTypes.map(t => {
    const on = addParamSelection.some(x => x.testTypeId === t.id);
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      type: "button",
      onClick: () => toggleAddParamSelection(t),
      className: "px-2.5 py-1 rounded-full text-xs font-medium border",
      style: {
        borderColor: on ? C.teal : C.border,
        background: on ? `${C.teal}14` : "transparent",
        color: on ? C.teal : C.ink
      }
    }, t.name);
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => {
      setAddParamOpen(false);
      setAddParamSelection([]);
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    disabled: !addParamSelection.length,
    onClick: confirmAddParams
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 12
  }), `Add ${addParamSelection.length || ""} Parameter${addParamSelection.length === 1 ? "" : "s"}`))) : null, qcWarnings.length > 0 && /*#__PURE__*/React.createElement("div", {
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
    className: "grid grid-cols-1 md:grid-cols-3 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-span-2 space-y-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: {
      color: C.ink
    }
  }, "Sample Details"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-x-4 gap-y-1.5",
    style: { gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }
  }, [
    ["Collection Date", sample.collectionDate],
    ["Received Date", sample.receivedDate],
    ["Collected By", sample.collectedBy],
    ["District", sample.district],
    ["Upazila / City Corp", sample.upazila],
    ["Union / Pourashava", sample.union],
    ["Site Name/Village", sample.village],
    ["Father's / Husband's Name", sample.fatherHusbandName],
    ["Water Point Type", sample.waterPointType === "Other" ? sample.waterPointTypeOther : sample.waterPointType]
  ].map(([label, value]) => /*#__PURE__*/React.createElement("div", { key: label },
    /*#__PURE__*/React.createElement("div", { className: "text-[10px]", style: { color: C.muted } }, label),
    /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.ink } }, value || "—")
  )))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
    }, resultInfo.results.filter(r => r.value != null).map(r => `${r.name}: ${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ""}`).join(", ") || "no value yet", resultInfo.date ? ` (${resultInfo.date})` : ""), ["results_entered", "under_review", "approved"].includes(paramStage) && /*#__PURE__*/React.createElement("button", {
      className: "text-[11px] underline",
      style: {
        color: C.teal
      },
      onClick: () => goToResultsWorkflow?.()
    }, "Act in Results Workflow →"));
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: t.testTypeId
    }, chipRow);
  })), canAddParam && !addParamOpen && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "text-[11px] underline mt-1",
    style: {
      color: C.teal
    },
    onClick: guardSampleAction(canAddParamAllowed, () => setAddParamOpen(true))
  }, "+ Add Parameter"), !!sample.linkedTestRecordIds.length && /*#__PURE__*/React.createElement("div", {
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
  }), "Assign")), !!manualAllowedNext.length && !["results_entered", "under_review"].includes(sample.status) && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
    onClick: () => {
      if (SAMPLE_CUSTODY_ACTIONS[s]) {
        setCustodyAction(s);
      } else {
        guardedUpdate(() => transitionSample(sample, s, {}, session), `Status updated to ${sampleStatusMeta(s).label}.`);
      }
    }
  }, sampleStatusMeta(s).label)))), custodyAction && /*#__PURE__*/React.createElement(SampleCustodyActionModal, {
    sample: sample,
    action: custodyAction,
    onClose: () => setCustodyAction(null),
    onConfirm: reason => {
      guardedUpdate(
        () => transitionSample(sample, custodyAction, { notes: reason || undefined }, session),
        `${sample.sampleCode} ${SAMPLE_CUSTODY_ACTIONS[custodyAction].verb}.`
      );
      setCustodyAction(null);
    }
  }), step && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center justify-between gap-2",
    style: {
      background: C.bg,
      color: C.muted,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("span", null, "Waiting on ", step === "review" ? "review" : "final approval", "."), /*#__PURE__*/React.createElement("button", {
    className: "text-xs underline shrink-0",
    style: {
      color: C.teal
    },
    onClick: () => goToResultsWorkflow?.()
  }, "Go to Results Workflow →")), sample.status === "approved" && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center justify-between gap-2",
    style: {
      background: C.bg,
      color: C.muted,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("span", null, "Approved — awaiting release."), /*#__PURE__*/React.createElement("button", {
    className: "text-xs underline shrink-0",
    style: {
      color: C.teal
    },
    onClick: () => goToResultsWorkflow?.()
  }, "Go to Results Workflow →")), sample.status === "released" && /*#__PURE__*/React.createElement("div", {
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
        background: active ? C.teal : done ? `${C.teal}14` : C.bg,
        color: active ? "#fff" : done ? C.teal : C.muted
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "grid place-items-center w-5 h-5 rounded-full text-[11px] font-semibold",
      style: {
        background: active ? "rgba(255,255,255,0.25)" : done ? C.teal : "#fff",
        color: active ? "#fff" : done ? "#fff" : C.muted,
        border: !active && !done ? `1px solid ${C.border}` : "none"
      }
    }, done ? /*#__PURE__*/React.createElement(Icon, { name: "check", size: 12 }) : n), label);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, pill(1, "Client & Batch Info", step === 1, step1Confirmed && step !== 1, step === 2), /*#__PURE__*/React.createElement(Icon, {
    name: "chevronRight",
    size: 14,
    color: C.border
  }), pill(2, "Sample Details", step === 2, false, false));
}

// ---- Collapsed one-line summary of a confirmed Step 1, with an Edit link ----
function ClientPartSummaryBar({ clientPart, selectedTests, onEdit }) {
  const clientLabel = clientPart.organizationName || clientPart.contactPerson || "—";
  const testNames = selectedTests.map(t => t.testTypeName).join(", ") || "None selected";
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-4 rounded-xl px-4 py-3 mb-5",
    style: { background: `${C.teal}0D`, border: `1px solid ${C.border}` }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-semibold",
    style: { color: C.ink }
  }, clientLabel), /*#__PURE__*/React.createElement("span", { style: { color: C.border } }, "\u2022"), /*#__PURE__*/React.createElement("span", {
    style: { color: C.muted }
  }, "Tracking #", clientPart.trackingNo || "—"), clientPart.refNo && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", { style: { color: C.border } }, "\u2022"), /*#__PURE__*/React.createElement("span", { style: { color: C.muted } }, "Memo #", clientPart.refNo)), /*#__PURE__*/React.createElement("span", { style: { color: C.border } }, "\u2022"), /*#__PURE__*/React.createElement("span", {
    style: { color: C.muted }
  }, "Tests: ", testNames)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onEdit,
    className: "shrink-0 flex items-center gap-1 text-xs font-medium",
    style: { color: C.teal }
  }, /*#__PURE__*/React.createElement(Icon, { name: "edit", size: 12 }), "Edit"));
}

// ---- One clean card per sample (replaces the cramped 4-line flex rows) ----
function SampleEntryCard({ index, row, updateRow, onDuplicate, onRemove, canRemove, collectionDateFrom, collectionDateTo }) {
  const gridCls = "grid gap-3";
  const gridStyle = { gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" };
  const waterPointOptions = [{ value: "", label: "— Type of Water Point —" }].concat(WATER_POINT_TYPES.map(wt => ({ value: wt, label: wt })));
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-xl p-4 border",
    style: { borderColor: C.border }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "grid place-items-center w-6 h-6 rounded-full text-xs font-semibold",
    style: { background: C.bg, color: C.muted }
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
    label: "Site Name/Village",
    value: row.village,
    onChange: v => updateRow("village", v)
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collection Date",
    type: "date",
    value: row.collectionDate,
    min: collectionDateFrom || undefined,
    max: collectionDateTo || undefined,
    onChange: v => updateRow("collectionDate", v)
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
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "TW ID",
    value: row.twId,
    onChange: v => updateRow("twId", v)
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
    waterPointTypeOther: "",
    twId: "",
    collectionDate: ""
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
    sampleType: "Drinking Water",
    collectionDateFrom: todayStr(),
    collectionDateTo: todayStr(),
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
  const [saving, setSaving] = React.useState(false);

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
    if (shared.collectionDateFrom && shared.collectionDateTo && shared.collectionDateTo < shared.collectionDateFrom) {
      return "Collection Date \u2014 To can't be before Collection Date \u2014 From.";
    }
    return "";
  }
  function goToStep2() {
    setErr("");
    setStep1Confirmed(true);
    setStep(2);
  }

  async function submit() {
    if (saving) return;
    const step1Error = validateStep1();
    if (step1Error) {
      setErr(step1Error);
      setStep(1);
      return;
    }
    if (rows.every(r => !r.customerName.trim() && !r.village.trim())) {
      setErr("Fill in at least one sample row (Customer Name or Site Name/Village).");
      setStep(2);
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
    setSaving(true);
    if (result.isDuplicateTrackingNo) {
      notify?.(`Tracking No. "${(result.reference.trackingNo || "").trim()}" matches an existing batch — these samples will be grouped under it.`, "ok");
    }
    await onCreate({
      ...shared,
      requestedTests: selectedTests
    }, validRows, result.reference);
    setSaving(false);
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
    className: "shrink-0 flex items-center justify-between px-6 py-4 border-b",
    style: { borderColor: C.border }
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
    setForm: setClientPart,
    references: references
  })), /*#__PURE__*/React.createElement("div", {
    className: "h-px",
    style: { background: C.border }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold mb-3",
    style: { color: C.ink }
  }, "Batch Defaults"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: { gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }
  }, /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Sample Type",
    value: shared.sampleType,
    onChange: v => setShared({ ...shared, sampleType: v }),
    options: ["Drinking Water", "Surface Water", "Wastewater", "Groundwater", "Other"].map(m => ({ value: m, label: m }))
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Priority",
    value: shared.priority,
    onChange: v => setShared({ ...shared, priority: v }),
    options: ["Routine", "Urgent"].map(m => ({ value: m, label: m }))
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collection Date — From",
    type: "date",
    value: shared.collectionDateFrom,
    onChange: v => setShared({ ...shared, collectionDateFrom: v, collectionDateTo: shared.collectionDateTo < v ? v : shared.collectionDateTo })
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collection Date — To",
    type: "date",
    value: shared.collectionDateTo,
    min: shared.collectionDateFrom || undefined,
    onChange: v => setShared({ ...shared, collectionDateTo: v })
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
  }))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs mt-2",
    style: { color: C.muted }
  }, "Each water point in Step 2 can be given its own single Collection Date if it differs from the rest — leave it blank there to default to ", shared.collectionDateFrom || "the From date", "."), /*#__PURE__*/React.createElement("div", {
    className: "h-px",
    style: { background: C.border }
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
        border: `1px solid ${on ? C.teal : C.border}`,
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
    canRemove: rows.length > 1,
    collectionDateFrom: shared.collectionDateFrom,
    collectionDateTo: shared.collectionDateTo
  }))), rows.length >= MAX_BATCH_ROWS && /*#__PURE__*/React.createElement("p", {
    className: "text-xs",
    style: { color: C.muted }
  }, MAX_BATCH_ROWS, " samples is the manual-entry limit — use the bulk manifest upload for larger batches."))),
  // ---- sticky footer: Cancel + Back + Continue/Register ----
  /*#__PURE__*/React.createElement("div", {
    className: "shrink-0 flex items-center justify-between px-6 py-4 border-t",
    style: { borderColor: C.border }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose,
    disabled: saving
  }, "Cancel"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, step === 2 && /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => setStep(1),
    disabled: saving
  }, "Back"), step === 1 ? /*#__PURE__*/React.createElement(Button, {
    onClick: goToStep2
  }, "Continue to Sample Details", /*#__PURE__*/React.createElement(Icon, { name: "chevronRight", size: 14 })) : /*#__PURE__*/React.createElement(Button, {
    onClick: submit,
    loading: saving
  }, !saving && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), saving ? "Registering…" : `Register ${validCount} Sample(s)`)))));
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
  const [collectionDateFrom, setCollectionDateFrom] = React.useState(todayStr());
  const [collectionDateTo, setCollectionDateTo] = React.useState(todayStr());
  const [priority, setPriority] = React.useState("Routine");
  const [err, setErr] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  function toggleTest(t) {
    setSelectedTests(prev => prev.some(x => x.testTypeId === t.id) ? prev.filter(x => x.testTypeId !== t.id) : [...prev, {
      testTypeId: t.id,
      testTypeName: t.name
    }]);
  }
  async function submit() {
    if (saving) return;
    if (!selectedTests.length) {
      setErr("Select at least one requested test.");
      return;
    }
    if (collectionDateTo < collectionDateFrom) {
      setErr("Collection Date \u2014 To can't be before Collection Date \u2014 From.");
      return;
    }
    const result = submitClientPart(clientPart, references, session);
    if (result.error) {
      setErr(result.error);
      return;
    }
    setReferences(prev => [...prev, result.reference], result.reference);
    setSaving(true);
    if (result.isDuplicateTrackingNo) {
      notify?.(`Tracking No. "${(result.reference.trackingNo || "").trim()}" matches an existing batch — these samples will be grouped under it.`, "ok");
    }
    await onConfirm(selectedTests, result.reference, { collectionDateFrom, collectionDateTo, priority });
    setSaving(false);
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
    setForm: setClientPart,
    references: references
  })), /*#__PURE__*/React.createElement("div", {
    className: "mb-4 p-3 rounded",
    style: { background: C.bg, border: `1px solid ${C.border}` }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold mb-2",
    style: { color: C.ink }
  }, "Batch Defaults"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3",
    style: { color: C.muted }
  }, "Collection Date is applied to any row in the manifest that doesn't already have its own \"Collection Date\" column value — rows with one keep that date. Priority applies to every sample in this upload."), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: { gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }
  }, /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collection Date — From",
    type: "date",
    value: collectionDateFrom,
    onChange: v => { setCollectionDateFrom(v); if (collectionDateTo < v) setCollectionDateTo(v); }
  }), /*#__PURE__*/React.createElement(TextField, {
    simple: true,
    label: "Collection Date — To",
    type: "date",
    value: collectionDateTo,
    min: collectionDateFrom || undefined,
    onChange: v => setCollectionDateTo(v)
  }), /*#__PURE__*/React.createElement(SelectField, {
    simple: true,
    label: "Priority",
    value: priority,
    onChange: setPriority,
    options: ["Routine", "Urgent"].map(m => ({ value: m, label: m }))
  }))), /*#__PURE__*/React.createElement("div", {
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
    onClick: onClose,
    disabled: saving
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: submit,
    loading: saving
  }, !saving && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), saving ? "Importing…" : `Import ${rowCount} Sample(s)`)));
}

// ---- Sample Registration table: column catalog for the "Columns" show/hide
// dropdown. `key` order here is also the left-to-right render order.
// `locked: true` columns (Tracking No. and Actions) can never be hidden, so
// there's always at least an identifier and a way to act on each row.
const SAMPLE_TABLE_COLUMNS = [
  { key: "sampleCode", label: "Sample Code" },
  { key: "twId", label: "TW ID" },
  { key: "refNo", label: "Ref / Memo No." },
  { key: "trackingNo", label: "Tracking No.", locked: true },
  { key: "clientContact", label: "Client" },
  { key: "customerName", label: "Customer Name" },
  { key: "site", label: "Site Name/Village" },
  { key: "district", label: "District" },
  { key: "upazila", label: "Upazilla" },
  { key: "ward", label: "Ward/Union" },
  { key: "sampleType", label: "Sample Type" },
  { key: "collectionDate", label: "Collection Date" },
  { key: "collectedBy", label: "Collected By" },
  { key: "latLong", label: "Lat/Long" },
  { key: "waterPointType", label: "Type of Water Point" },
  { key: "priority", label: "Priority" },
  { key: "registrationDate", label: "Registration Date" },
  { key: "status", label: "Status" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "actions", label: "Actions", locked: true }
];
const SAMPLE_TABLE_COLUMNS_STORAGE_KEY = "dphe_lims_sample_columns_v1";
function loadSampleColumnPrefs() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(SAMPLE_TABLE_COLUMNS_STORAGE_KEY) || "null");
  } catch (e) {
    stored = null;
  }
  const prefs = {};
  SAMPLE_TABLE_COLUMNS.forEach(c => {
    prefs[c.key] = c.locked ? true : stored && Object.prototype.hasOwnProperty.call(stored, c.key) ? !!stored[c.key] : true;
  });
  return prefs;
}
function saveSampleColumnPrefs(prefs) {
  try {
    localStorage.setItem(SAMPLE_TABLE_COLUMNS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    /* localStorage unavailable (private mode, quota, etc.) — preference just won't persist */
  }
}

// ---- "Columns" show/hide dropdown button, used above the Sample
// Registration table. ----
function ColumnsToggleDropdown({ visibleCols, onToggle }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  const shownCount = SAMPLE_TABLE_COLUMNS.filter(c => visibleCols[c.key] !== false).length;
  return /*#__PURE__*/React.createElement("div", {
    ref,
    className: "relative inline-block text-left",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOpen(o => !o),
    className: "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium",
    style: { border: `1px solid ${C.border}`, background: C.card, color: C.ink }
  }, /*#__PURE__*/React.createElement(Icon, { name: "table", size: 14 }), `Columns (${shownCount}/${SAMPLE_TABLE_COLUMNS.length})`, /*#__PURE__*/React.createElement(Icon, { name: "chevronDown", size: 12, color: C.muted })),
  open && /*#__PURE__*/React.createElement("div", {
    className: "absolute right-0 top-full mt-1 w-64 rounded-lg shadow-lg py-1.5 col-toggle-menu",
    style: { background: "#fff", border: `1px solid ${C.border}`, zIndex: 30 }
  },
  /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-1 text-[10px] font-semibold uppercase tracking-wide",
    style: { color: C.muted }
  }, "Show / hide columns"),
  SAMPLE_TABLE_COLUMNS.map(c => /*#__PURE__*/React.createElement("label", {
    key: c.key,
    className: `col-toggle-row${c.locked ? " locked" : ""}`,
    style: { color: C.ink }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: visibleCols[c.key] !== false,
    disabled: !!c.locked,
    onChange: () => onToggle(c.key)
  }), c.label, c.locked && /*#__PURE__*/React.createElement("span", {
    className: "text-[10px]",
    style: { color: C.muted, marginLeft: "auto" }
  }, "locked"))))
  );
}

// ---- Floating Scroll to Top / Scroll to Bottom buttons for the Sample
// Registration table. ----
function ScrollNavButtons({ onTop, onBottom }) {
  return /*#__PURE__*/React.createElement("div", { className: "scroll-nav-fab no-print" },
    /*#__PURE__*/React.createElement("button", {
      type: "button",
      title: "Scroll to top",
      onClick: onTop,
      style: { background: C.card, border: `1px solid ${C.border}`, color: C.ink }
    }, /*#__PURE__*/React.createElement("span", { style: { display: "inline-flex", transform: "rotate(180deg)" } }, /*#__PURE__*/React.createElement(Icon, { name: "chevronDown", size: 16, color: C.ink }))),
    /*#__PURE__*/React.createElement("button", {
      type: "button",
      title: "Scroll to bottom",
      onClick: onBottom,
      style: { background: C.teal, border: `1px solid ${C.teal}`, color: "#fff" }
    }, /*#__PURE__*/React.createElement(Icon, { name: "chevronDown", size: 16, color: "#fff" }))
  );
}

// ---- Individual-sample custody actions: Hold / Reject / Cancel ----
// These are chain-of-custody decisions about the physical sample, made
// BEFORE (or independent of) any testing — distinct from the per-parameter
// "Hold" inside Results Workflow, which pauses one already-tested parameter
// mid-review. A sample held/rejected/cancelled here is excluded from
// Analytical Batch creation and Add Test Record entirely (see
// sampleBlockedFromTesting in 16-sub-batch.js) — so no reagent is ever
// consumed for it. Reject and Cancel require a cause and, per FORWARD_FLOW,
// have no path forward again once set.
const SAMPLE_CUSTODY_ACTIONS = {
  on_hold: { label: "Hold", verb: "put on hold", reasonRequired: false, icon: "warning" },
  rejected: { label: "Reject", verb: "rejected", reasonRequired: true, icon: "ban" },
  cancelled: { label: "Cancel", verb: "cancelled", reasonRequired: true, icon: "x" }
};
function SampleCustodyActionModal({ sample, action, onClose, onConfirm }) {
  const meta = SAMPLE_CUSTODY_ACTIONS[action];
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState("");
  function confirm() {
    if (meta.reasonRequired && !reason.trim()) {
      setErr(`A cause is required to ${meta.label.toLowerCase()} a sample.`);
      return;
    }
    onConfirm(reason.trim());
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: `${meta.label} — ${sample.sampleCode}`,
    onClose
  },
    /*#__PURE__*/React.createElement("p", { className: "text-xs mb-3", style: { color: C.muted } },
      `This sample will be ${meta.verb}`,
      action !== "on_hold" ? " and will not proceed to any further stage — it stops here permanently." :
        " — it will be excluded from Analytical Batch creation and Add Test Record until resumed, and won't consume any inventory while held."
    ),
    /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs mb-1", style: { color: C.muted } },
      `Cause / reason${meta.reasonRequired ? " (required)" : " (optional)"}`,
      /*#__PURE__*/React.createElement("textarea", {
        className: "border rounded px-2 py-1.5 text-sm",
        style: { borderColor: C.border, minHeight: 70 },
        value: reason,
        onChange: e => { setReason(e.target.value); setErr(""); },
        placeholder: action === "on_hold" ? "e.g. awaiting client confirmation, insufficient sample volume…" : "e.g. broken container, contamination suspected, duplicate entry…"
      })
    ),
    err && /*#__PURE__*/React.createElement("div", { className: "text-xs mb-2", style: { color: C.warn } }, err),
    /*#__PURE__*/React.createElement("div", { className: "flex justify-end gap-2 mt-3" },
      /*#__PURE__*/React.createElement(Button, { variant: "ghost", size: "sm", onClick: onClose }, "Cancel"),
      /*#__PURE__*/React.createElement(Button, { variant: "danger", size: "sm", onClick: confirm },
        /*#__PURE__*/React.createElement(Icon, { name: meta.icon, size: 12 }), meta.label)
    )
  );
}

// ---- main tab: list + registration + detail ----
function SamplesTab({
  samples,
  setSamples,
  references,
  setReferences,
  testTypes,
  testRecords,
  setTestRecords,
  parameters,
  subBatches,
  setSubBatches,
  equipment,
  users,
  session,
  permissionMatrix,
  notify,
  focusSampleId,
  setFocusSampleId,
  focusSamplesSubTab,
  setFocusSamplesSubTab,
  focusResultsStage,
  setFocusResultsStage,
  goToTestEntry
}) {
  const [internalSubTab, setInternalSubTab] = React.useState("samples");
  const sampleSubTab = focusSamplesSubTab !== undefined && focusSamplesSubTab !== null ? focusSamplesSubTab : internalSubTab;
  const setSampleSubTab = setFocusSamplesSubTab || setInternalSubTab;
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
  // Column show/hide (Sample Registration table) — persisted in localStorage
  // so a user's preferred column set survives a reload.
  const [visibleCols, setVisibleCols] = React.useState(() => loadSampleColumnPrefs());
  function toggleColumn(key) {
    setVisibleCols(prev => {
      const col = SAMPLE_TABLE_COLUMNS.find(c => c.key === key);
      if (col?.locked) return prev; // Tracking No. / Actions can't be hidden
      const next = { ...prev, [key]: prev[key] === false ? true : false };
      saveSampleColumnPrefs(next);
      return next;
    });
  }
  const activeColumns = SAMPLE_TABLE_COLUMNS.filter(c => visibleCols[c.key] !== false);
  // Scroll-to-top / Scroll-to-bottom for the Sample Registration table.
  const sampleListTopRef = React.useRef(null);
  const sampleListBottomRef = React.useRef(null);
  function scrollSampleListToTop() {
    sampleListTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function scrollSampleListToBottom() {
    sampleListBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }
  // Real-time Registration Sync — ids of samples created in the last few
  // seconds get a highlight + "New" chip so a just-registered/imported
  // sample is unmistakable even in a long list (it also floats to the top
  // naturally since `filtered` is sorted by createdAt desc).
  const [recentlyAddedIds, setRecentlyAddedIds] = React.useState(new Set());
  const [openMenuId, setOpenMenuId] = React.useState(null);
  const [custodyAction, setCustodyAction] = React.useState(null); // { sample, action } | null
  const perms = permissionsFor(permissionMatrix, session);
  const isGuestUser = session?.role === "Guest";
  const registerGate = {
    allowed: perms.canRegister,
    visible: perms.canRegister || isGuestUser,
    guard(handler) {
      return (...args) => {
        if (perms.canRegister) return handler(...args);
        notify?.("Guest access can't register or import samples — this login is view-only for this action.", "warn");
      };
    }
  };
  const openSample = samples.find(s => s.id === openId) || null;
  const filtered = samples.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    const ref = s.referenceId ? findReferenceById(references, s.referenceId) : null;
    const haystack = `${s.sampleCode} ${s.clientName} ${s.siteLocation} ${ref?.trackingNo || ""} ${ref?.refNo || ""} ${ref?.contactPerson || ""}`;
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
    if (!registerGate.allowed) {
      notify?.("Guest access can't import samples — this login is view-only for this action.", "warn");
      return;
    }
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
  async function confirmImportSamples(requestedTests, ref, batchDefaults) {
    let runningSamples = [...samples];
    const newSamples = [];
    for (const row of pendingImportRows) {
      const rowCollectionDate = String(readSampleImportField(row, "collectionDate") || "").trim();
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
        sampleType: String(readSampleImportField(row, "sampleType") || "Drinking Water").trim(),
        // Per-row Collection Date from the manifest wins; otherwise fall back
        // to the start of the batch's Collection Date range picked in this
        // dialog (not always "today" — the whole point of the range is to
        // cover manifests collected over several days).
        collectionDate: rowCollectionDate || batchDefaults?.collectionDateFrom || todayStr(),
        collectedBy: String(readSampleImportField(row, "collectedBy")).trim(),
        receivedDate: String(readSampleImportField(row, "receivedDate") || todayStr()),
        // Priority is a Batch Default picked in the popup, not a manifest
        // column — same field, same reasoning as Collection Date/Sample Type
        // in the manual Register Sample flow, just entered once for the
        // whole upload instead of per row.
        priority: batchDefaults?.priority || "Routine",
        numberOfSamples: 1,
        requestedTests
      }, runningSamples, session);
      runningSamples = [...runningSamples, sample];
      newSamples.push(sample);
    }
    if (!newSamples.length) {
      notify(`No usable rows to import${pendingImportSkipped ? ` (skipped ${pendingImportSkipped} row(s) missing Client Name/Site Location)` : ""}.`, "warn");
      setPendingImportRows(null);
      setPendingImportSkipped(0);
      return;
    }
    // ONE bulk write for the whole manifest, instead of the old approach of
    // one HTTP round-trip PER ROW (a save + an appendAudit call, sequentially
    // awaited). Importing 50 samples used to mean 100 sequential requests —
    // slow enough to time out or get interrupted partway through, which
    // silently left only some rows actually saved with no clear error
    // ("50 samples doesn't upload properly"). bulkUpsert only needs to send
    // (and only touches) the newly-created rows — not the whole samples
    // table — so this stays fast as the table grows into the thousands,
    // and is all-or-nothing from the app's point of view: either it
    // succeeds and local state is updated to match, or it throws and
    // NOTHING is marked as imported — no silent partial batches.
    try {
      await DataService.bulkUpsert("samples", newSamples);
    } catch (e) {
      notify(`Import failed before anything was saved: ${e.message}. Nothing was partially imported — fix the issue (check Settings ▸ Backend Settings) and try the same file again.`, "warn");
      return;
    }
    await setSamples(() => runningSamples);
    const newIds = newSamples.map(s => s.id);
    DataService.appendAudit({
      entity: "sample",
      entityId: newIds.join(","),
      action: "bulk_import",
      user: session.name,
      role: session.role,
      note: `Bulk-imported ${newSamples.length} sample(s) from manifest under ${ref ? referenceDisplayLabel(ref) : "(no reference)"}`
    }).catch(err => console.error("Audit log write for bulk import failed (non-fatal, import itself already succeeded):", err));
    notify(`Imported ${newSamples.length} sample(s) from manifest under ${ref ? referenceDisplayLabel(ref) : "(no reference)"}${pendingImportSkipped ? `, skipped ${pendingImportSkipped} row(s) missing Client Name/Site Location` : ""}.`, "ok");
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
  // ---- Delete Ref Batch (Reference) — the group header action in "Group by
  // Batch" view. A Reference had no delete path at all before this; adding
  // one closes the cascade the rest of this file already documents:
  // deleting a Test Record returns its sample(s) to pending (see doDelete,
  // 13-testrecords-ui.js), deleting a pending Analytical Batch returns its
  // members to pending too (see doDeleteSubBatch, this file) — deleting the
  // Ref Batch itself is the last link, removing the samples from Register
  // Sample entirely. Only allowed while every member sample is still
  // untouched (every requestedTest still "pending") — exactly the same
  // "pending only" safety rule the Analytical Batch delete button already
  // enforces, so a batch that's actually been worked on can't be silently
  // wiped; testing/results must be undone first (delete the Test Record /
  // Analytical Batch) the same way that's already required elsewhere.
  const [deleteReferenceId, setDeleteReferenceId] = React.useState(null);
  const [addBatchParamRefId, setAddBatchParamRefId] = React.useState(null);
  const [addBatchParamSelection, setAddBatchParamSelection] = React.useState([]);
  function referenceMembers(refId) {
    return samples.filter(s => s.referenceId === refId);
  }
  function canDeleteReference(refId) {
    return referenceMembers(refId).every(s => (s.requestedTests || []).every(rt => !rt.status || rt.status === "pending"));
  }
  async function handleDeleteReference(ref) {
    if (!canDeleteReference(ref.id)) {
      notify?.("Can't delete — one or more samples in this batch already have testing in progress or results. Delete/undo those first (Test Records / Analytical Batch), then try again.", "warn");
      setDeleteReferenceId(null);
      return;
    }
    const members = referenceMembers(ref.id);
    const memberIds = members.map(s => s.id);
    await setSamples(prev => prev.filter(s => !memberIds.includes(s.id)));
    setReferences(prev => prev.filter(r => r.id !== ref.id));
    try {
      await DataService.remove("references", ref.id);
    } catch {
      // best-effort — local state above is already the source of truth for this session
    }
    DataService.appendAudit({
      entity: "reference",
      entityId: ref.id,
      action: "delete",
      user: session.username,
      role: session.role,
      note: `Deleted Ref Batch "${referenceDisplayLabel(ref)}" and its ${memberIds.length} sample(s)`
    });
    notify?.(`Ref Batch "${referenceDisplayLabel(ref)}" and its ${memberIds.length} sample(s) deleted.`, "ok");
    setDeleteReferenceId(null);
  }
  // Batch version of the same fix as SampleDetail's "+ Add Parameter" — a
  // batch registered together can just as easily need a parameter added
  // later as a single sample can, INCLUDING after the original parameter(s)
  // for that batch were already released (adding a fresh "pending"
  // parameter doesn't touch anything already reported). Every member gets
  // it except: samples that already have that parameter (silently skipped,
  // no error) and samples that are rejected/cancelled (physically no
  // longer testable — skipped and called out in the result count).
  //
  // ONE bulk write for the whole batch, not one save+appendAudit round-trip
  // PER sample — that old per-sample loop was both slow (N sequential
  // requests for an N-sample batch) and wrote N separate audit log entries
  // for what is, from the user's point of view, a single action ("add this
  // parameter to the batch"). Matches the same fix already applied to bulk
  // sample import/registration — see confirmImportSamples/handleBatchCreate.
  async function handleAddParamsToBatch(refId, newTests) {
    const members = referenceMembers(refId);
    const memberIds = new Set(members.map(s => s.id));
    let count = 0;
    let skippedUnusable = 0;
    const addedSampleIds = [];
    const updatedSamples = (samples || []).map(s => {
      if (!memberIds.has(s.id)) return s;
      if (["rejected", "cancelled"].includes(s.status)) {
        skippedUnusable++;
        return s;
      }
      const next = addRequestedTests(s, newTests, session);
      if (next !== s) {
        count++;
        addedSampleIds.push(s.id);
      }
      return next;
    });
    if (count === 0) {
      return {
        count,
        skippedUnusable
      };
    }
    await DataService.bulkSet("samples", updatedSamples);
    await setSamples(() => updatedSamples);
    DataService.appendAudit({
      entity: "sample",
      entityId: addedSampleIds.join(","),
      action: "add_parameter",
      user: session.name,
      role: session.role,
      note: `Added ${newTests.map(t => t.testTypeName).join(", ")} to ${count} sample(s) in batch`
    }).catch(err => console.error("Audit log write for batch add-parameter failed (non-fatal, the add itself already succeeded):", err));
    return {
      count,
      skippedUnusable
    };
  }
  async function confirmAddBatchParams() {
    if (!addBatchParamSelection.length || !addBatchParamRefId) return;
    try {
      const {
        count,
        skippedUnusable
      } = await handleAddParamsToBatch(addBatchParamRefId, addBatchParamSelection);
      const skippedNote = skippedUnusable > 0 ? ` (${skippedUnusable} rejected/cancelled sample${skippedUnusable > 1 ? "s" : ""} skipped)` : "";
      notify?.(count > 0 ? `Added ${addBatchParamSelection.map(t => t.testTypeName).join(", ")} to ${count} sample(s) in this batch.${skippedNote}` : `Every eligible sample in this batch already had all the selected parameter(s) — nothing to add.${skippedNote}`, count > 0 ? "ok" : "warn");
      setAddBatchParamSelection([]);
      setAddBatchParamRefId(null);
    } catch (e) {
      notify?.(`Could not add the parameter(s) to this batch: ${e.message}. Nothing was saved — try again.`, "warn");
    }
  }
  async function handleBatchCreate(shared, rows, ref) {
    let runningSamples = [...samples];
    const newSamples = [];
    const { collectionDateFrom, collectionDateTo, ...sharedRest } = shared;
    for (const row of rows) {
      const sample = createSample({
        ...sharedRest,
        // Each water point can carry its own single collection date; if left
        // blank it defaults to the start of the batch's collection range.
        collectionDate: row.collectionDate || collectionDateFrom,
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
      newSamples.push(sample);
    }
    // Same reasoning as confirmImportSamples above: one bulkUpsert instead
    // of one save+appendAudit round-trip per row — a large batch (many
    // water points under one Reference) used to mean dozens of sequential
    // requests, slow enough to partially fail with no clear signal.
    // bulkUpsert only sends/touches the newly-created rows, not the whole
    // samples table, so this stays fast as the table grows.
    try {
      await DataService.bulkUpsert("samples", newSamples);
    } catch (e) {
      notify(`Batch registration failed before anything was saved: ${e.message}. Nothing was partially registered — try again.`, "warn");
      return;
    }
    await setSamples(() => runningSamples);
    const newIds = newSamples.map(s => s.id);
    DataService.appendAudit({
      entity: "sample",
      entityId: newIds.join(","),
      action: "bulk_register",
      user: session.name,
      role: session.role,
      note: `Registered ${newSamples.length} sample(s) under Reference ${referenceDisplayLabel(ref)} (Tracking No. ${ref.trackingNo})`
    }).catch(err => console.error("Audit log write for batch registration failed (non-fatal, registration itself already succeeded):", err));
    setShowBatchForm(false);
    setExpandedBatches(prev => new Set(prev).add(ref.id));
    notify?.(`${newSamples.length} sample(s) registered under Reference ${referenceDisplayLabel(ref)} (Tracking No. ${ref.trackingNo}).`, "ok");
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
    const allowedNext = nextAllowedStatuses(s);
    const isOnHold = s.status === "on_hold";
    const canHold = !isOnHold && allowedNext.includes("on_hold");
    const canReject = allowedNext.includes("rejected");
    const canCancel = allowedNext.includes("cancelled");
    function resumeFromHold() {
      try {
        const next = transitionSample(s, allowedNext[0], { notes: "Resumed from hold." }, session);
        setSamples(prev => prev.map(x => x.id === s.id ? next : x));
        notify?.(`${s.sampleCode} resumed.`, "ok");
      } catch (e) {
        notify?.(e.message, "warn");
      }
      setOpenMenuId(null);
    }
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
      className: "absolute right-0 top-full mt-1 w-52 rounded-lg shadow-lg py-1",
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
    }), "Copy Sample ID"), (isOnHold || canHold || canReject || canCancel) && /*#__PURE__*/React.createElement("div", {
      className: "h-px my-1",
      style: { background: C.border }
    }), isOnHold && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-black/5",
      style: { color: C.ink },
      onClick: resumeFromHold
    }, /*#__PURE__*/React.createElement(Icon, { name: "check", size: 12 }), "Resume (take off hold)"),
    canHold && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-black/5",
      style: { color: C.warn },
      onClick: () => { setCustodyAction({ sample: s, action: "on_hold" }); setOpenMenuId(null); }
    }, /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 12 }), "Hold"),
    canReject && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-black/5",
      style: { color: C.warn },
      onClick: () => { setCustodyAction({ sample: s, action: "rejected" }); setOpenMenuId(null); }
    }, /*#__PURE__*/React.createElement(Icon, { name: "ban", size: 12 }), "Reject"),
    canCancel && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-black/5",
      style: { color: C.warn },
      onClick: () => { setCustodyAction({ sample: s, action: "cancelled" }); setOpenMenuId(null); }
    }, /*#__PURE__*/React.createElement(Icon, { name: "x", size: 12 }), "Cancel")));
  }
  function renderSampleRow(s, indented) {
    const isNew = recentlyAddedIds.has(s.id);
    const overdue = isSampleOverdue(s);
    const rowRef = s.referenceId ? findReferenceById(references, s.referenceId) : null;
    const latLong = s.latitude || s.longitude ? `${s.latitude || "—"} / ${s.longitude || "—"}` : "—";
    const registrationDate = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—";
    const cellByKey = {
      sampleCode: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 font-medium whitespace-nowrap",
        style: { color: C.ink, paddingLeft: indented ? 24 : undefined }
      }, /*#__PURE__*/React.createElement("span", {
        className: "inline-flex items-center gap-1.5"
      }, s.sampleCode, isNew && /*#__PURE__*/React.createElement("span", {
        className: "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide",
        style: { background: C.teal, color: "#fff" }
      }, "New"))),
      twId: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.ink }
      }, s.twId || "—"),
      refNo: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, rowRef?.refNo || "—"),
      trackingNo: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, rowRef?.trackingNo || "—"),
      clientContact: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.ink }
      }, rowRef?.contactPerson || "—"),
      customerName: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.ink }
      }, s.clientName),
      site: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, s.siteLocation),
      district: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, s.district || "—"),
      upazila: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, s.upazila || "—"),
      ward: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, s.union || "—"),
      sampleType: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, s.sampleType || "—"),
      collectionDate: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, s.collectionDate || "—"),
      collectedBy: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, s.collectedBy || "—"),
      latLong: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, latLong),
      waterPointType: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, s.waterPointType || "—"),
      priority: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5"
      }, /*#__PURE__*/React.createElement(PriorityBadge, { priority: s.priority })),
      registrationDate: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, registrationDate),
      status: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5"
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-1 flex-wrap"
      }, /*#__PURE__*/React.createElement(SampleStatusBadge, { status: s.status }), overdue && /*#__PURE__*/React.createElement("span", {
        className: "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
        style: { background: C.warnBg, color: C.warn }
      }, /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 9 }), "Overdue"))),
      assignedTo: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 whitespace-nowrap", style: { color: C.muted }
      }, s.assignedTo || "—"),
      actions: /*#__PURE__*/React.createElement("td", {
        className: "px-2 py-1.5 text-right"
      }, renderRowActions(s))
    };
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
    }, activeColumns.map(c => /*#__PURE__*/React.cloneElement(cellByKey[c.key], { key: c.key })));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-4 flex-wrap"
  }, [{
    k: "samples",
    label: "Sample Registration",
    icon: "beaker"
  }, {
    k: "subBatches",
    label: "Create Analytical Batch",
    icon: "flask"
  }, {
    k: "resultsWorkflow",
    label: "Results Workflow",
    icon: "check"
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
  }, "Registration, chain of custody, assignment, approval and result release.")), registerGate.visible && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: registerGate.guard(() => setShowBatchForm(true))
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 13
  }), "Register Sample(s)"))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mb-3 flex-wrap"
  }, registerGate.visible && /*#__PURE__*/React.createElement("input", {
    ref: bulkUploadInputRef,
    type: "file",
    accept: ".xlsx,.xls,.csv",
    className: "hidden",
    onChange: e => {
      if (e.target.files[0]) importSamples(e.target.files[0]);
      e.target.value = "";
    }
  }), registerGate.visible && /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: registerGate.guard(() => bulkUploadInputRef.current && bulkUploadInputRef.current.click())
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
    className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4"
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
  }), v.label))), /*#__PURE__*/React.createElement(ColumnsToggleDropdown, {
    visibleCols,
    onToggle: toggleColumn
  })), /*#__PURE__*/React.createElement("div", {
    ref: sampleListTopRef,
    className: "rounded-lg overflow-hidden",
    style: {
      border: `1px solid ${C.border}`
    },
    onClick: () => openMenuId && setOpenMenuId(null)
  }, /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto table-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-[13px]"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: C.bg
    }
  }, activeColumns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    className: "text-left px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap",
    style: {
      color: C.muted
    }
  }, c.key === "actions" ? "" : c.label)))), /*#__PURE__*/React.createElement("tbody", null, viewMode === "flat" ? filtered.map(s => renderSampleRow(s, false)) : listItems.map(item => {
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
      colSpan: activeColumns.length,
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
    }), item.reference && registerGate.visible && /*#__PURE__*/React.createElement(IconButton, {
      name: "plus",
      color: C.teal,
      title: "Add a parameter to every sample in this batch",
      onClick: e => {
        e.stopPropagation();
        registerGate.guard(() => {
          setAddBatchParamSelection([]);
          setAddBatchParamRefId(item.referenceId);
        })();
      }
    }), item.reference && /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.danger,
      title: "Delete this Ref Batch and its samples",
      onClick: e => {
        e.stopPropagation();
        setDeleteReferenceId(item.referenceId);
      }
    })))), addBatchParamRefId === item.referenceId && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: activeColumns.length,
      className: "px-3 pb-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "p-3 rounded",
      style: {
        background: C.bg,
        border: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs font-semibold mb-1.5",
      style: {
        color: C.ink
      }
    }, `Add Parameter(s) to All ${item.members.length} Sample(s) in This Batch`), /*#__PURE__*/React.createElement("div", {
      className: "text-[11px] mb-2",
      style: {
        color: C.muted
      }
    }, "Only samples that don't already have a selected parameter will get it added — the rest are left as-is."), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-1.5 mb-2"
    }, (testTypes || []).map(t => {
      const on = addBatchParamSelection.some(x => x.testTypeId === t.id);
      return /*#__PURE__*/React.createElement("button", {
        key: t.id,
        type: "button",
        onClick: () => setAddBatchParamSelection(prev => prev.some(x => x.testTypeId === t.id) ? prev.filter(x => x.testTypeId !== t.id) : [...prev, {
          testTypeId: t.id,
          testTypeName: t.name
        }]),
        className: "px-2.5 py-1 rounded-full text-xs font-medium border",
        style: {
          borderColor: on ? C.teal : C.border,
          background: on ? `${C.teal}14` : "transparent",
          color: on ? C.teal : C.ink
        }
      }, t.name);
    })), /*#__PURE__*/React.createElement("div", {
      className: "flex justify-end gap-2"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      onClick: () => {
        setAddBatchParamRefId(null);
        setAddBatchParamSelection([]);
      }
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      disabled: !addBatchParamSelection.length,
      onClick: confirmAddBatchParams
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 12
    }), `Add ${addBatchParamSelection.length || ""} Parameter${addBatchParamSelection.length === 1 ? "" : "s"}`))))), deleteReferenceId === item.referenceId && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: activeColumns.length,
      className: "px-3"
    }, /*#__PURE__*/React.createElement(ConfirmBar, {
      text: canDeleteReference(item.referenceId) ? `Delete Ref Batch "${referenceDisplayLabel(item.reference)}" and all ${item.members.length} of its sample(s)? This can't be undone.` : `Can't delete "${referenceDisplayLabel(item.reference)}" — one or more of its samples already have testing in progress or results. Delete/undo those first (Test Records / Analytical Batch).`,
      onConfirm: () => handleDeleteReference(item.reference),
      onCancel: () => setDeleteReferenceId(null)
    }))), isOpen && item.members.map(s => renderSampleRow(s, true)));
  }), (viewMode === "flat" ? !filtered.length : !listItems.length) && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: activeColumns.length,
    className: "px-3 py-2"
  }, /*#__PURE__*/React.createElement(EmptyState, {
    icon: "clipboard",
    title: samples.length === 0 ? "No samples yet" : "No samples match your search",
    subtitle: samples.length === 0 ? "Register or bulk-import samples to get started." : "Try a different sample code, client, status, or Tracking No.",
    action: samples.length === 0 ? /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: () => setShowBatchForm(true)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 13
    }), "Register Sample(s)") : undefined
  }))))))), /*#__PURE__*/React.createElement("div", { ref: sampleListBottomRef }), /*#__PURE__*/React.createElement(ScrollNavButtons, {
    onTop: scrollSampleListToTop,
    onBottom: scrollSampleListToBottom
  }), custodyAction && /*#__PURE__*/React.createElement(SampleCustodyActionModal, {
    sample: custodyAction.sample,
    action: custodyAction.action,
    onClose: () => setCustodyAction(null),
    onConfirm: reason => {
      try {
        const next = transitionSample(custodyAction.sample, custodyAction.action, { notes: reason || undefined }, session);
        setSamples(prev => prev.map(x => x.id === custodyAction.sample.id ? next : x));
        notify?.(`${custodyAction.sample.sampleCode} ${SAMPLE_CUSTODY_ACTIONS[custodyAction.action].verb}.`, custodyAction.action === "on_hold" ? "warn" : "warn");
      } catch (e) {
        notify?.(e.message, "warn");
      }
      setCustodyAction(null);
    }
  })), sampleSubTab === "subBatches" && /*#__PURE__*/React.createElement(SubBatchBuilder, {
    samples: samples,
    setSamples: setSamples,
    testTypes: testTypes,
    subBatches: subBatches,
    setSubBatches: setSubBatches,
    testRecords: testRecords,
    references: references,
    users: users,
    session: session,
    permissionMatrix: permissionMatrix,
    notify: notify
  }), sampleSubTab === "resultsWorkflow" && /*#__PURE__*/React.createElement(ResultsWorkflowTab, {
    samples: samples,
    setSamples: setSamples,
    subBatches: subBatches,
    setSubBatches: setSubBatches,
    references: references,
    testTypes: testTypes,
    testRecords: testRecords,
    setTestRecords: setTestRecords,
    parameters: parameters,
    session: session,
    permissionMatrix: permissionMatrix,
    notify: notify,
    goToTestEntry: goToTestEntry,
    goToSample: id => setOpenId(id),
    focusStage: focusResultsStage,
    setFocusStage: setFocusResultsStage
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
    permissionMatrix: permissionMatrix,
    testTypes: testTypes,
    testRecords: testRecords,
    subBatches: subBatches,
    references: references,
    setReferences: setReferences,
    onClose: () => setOpenId(null),
    onUpdate: handleUpdate,
    onDelete: handleDeleteSample,
    notify: notify,
    goToResultsWorkflow: () => {
      setOpenId(null);
      setSampleSubTab("resultsWorkflow");
    }
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
  permissionMatrix,
  notify
}) {
  const subBatchCreateGate = permGate(permissionMatrix, session, "subBatches", "create", notify, "create sub-batches");
  const subBatchEditGate = permGate(permissionMatrix, session, "subBatches", "edit", notify, "edit sub-batches");
  const subBatchDeleteGate = permGate(permissionMatrix, session, "subBatches", "delete", notify, "delete sub-batches");
  const canCreateSubBatch = subBatchCreateGate.visible;
  const canEditSubBatch = subBatchEditGate.visible;
  const canDeleteSubBatch = subBatchDeleteGate.visible;
  const [selectedTestId, setSelectedTestId] = React.useState("");
  const [selectedReferenceIds, setSelectedReferenceIds] = React.useState([]);
  const [selectedSampleIds, setSelectedSampleIds] = React.useState([]);
  const [label, setLabel] = React.useState("");
  // Submit-guard: createGroup() is synchronous, but a fast double-click can
  // still fire it twice before React disables anything — this ref stops the
  // re-entrant call cold, no re-render needed.
  const creatingRef = React.useRef(false);
  const [assignedTester, setAssignedTester] = React.useState("");
  const [autoCount, setAutoCount] = React.useState("");
  const [autoBatchCount, setAutoBatchCount] = React.useState("");
  const [editingSubBatchId, setEditingSubBatchId] = React.useState(null);
  const [deleteSubBatchId, setDeleteSubBatchId] = React.useState(null);

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
    setSelectedReferenceIds(prev => {
      const willBeSelected = !prev.includes(id);
      // Picking a Reference in the filter also queues its samples straight
      // into the picker (auto-select) — checking a Reference means "give me
      // these samples", not just "narrow the list and make me tick each one
      // by hand". Individual samples can still be unchecked afterward.
      // Unchecking a Reference un-queues just the samples that came from it.
      const samplesForThisRef = eligibleForTest.filter(s => s.referenceId === id).map(s => s.id);
      setSelectedSampleIds(prevIds => willBeSelected ? Array.from(new Set([...prevIds, ...samplesForThisRef])) : prevIds.filter(sid => !samplesForThisRef.includes(sid)));
      return willBeSelected ? [...prev, id] : prev.filter(x => x !== id);
    });
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
  // Splits the samples currently checked in the picker — whether they got
  // there via "Filter by Reference" auto-select or by hand-ticking rows,
  // and regardless of whether they all share one Reference or come from
  // several — into consecutively-numbered Analytical Batches of "No. of
  // samples" each. "No. of Batches" is now optional: leave it blank to
  // cover every selected sample; set it to cap how many batches get made
  // (any selected samples left over stay selected for a next pass).
  function autoCreateMultipleBatches() {
    const perBatch = parseInt(autoCount, 10);
    const numBatchesRaw = parseInt(autoBatchCount, 10);
    if (!perBatch || perBatch <= 0) {
      notify?.("Enter No. of Samples (per batch) first.", "warn");
      return;
    }
    if (!selectedTestId) {
      notify?.("Pick a Test Type first.", "warn");
      return;
    }
    // Source pool = the samples actually selected right now (tick a
    // Reference to auto-select all of it, and/or hand-pick individual
    // samples in the grid below — both feed this same selection).
    const pool = eligibleSamples.filter(s => selectedSampleIds.includes(s.id));
    if (!pool.length) {
      notify?.("Select samples first — tick a Reference above to auto-select all of it, or check samples individually — then Create Multiple Batches.", "warn");
      return;
    }
    const maxPossibleBatches = Math.ceil(pool.length / perBatch);
    const numBatches = numBatchesRaw && numBatchesRaw > 0 ? Math.min(numBatchesRaw, maxPossibleBatches) : maxPossibleBatches;
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
    const usedIds = pool.slice(0, cursor).map(s => s.id);
    markMembersInProgress(usedIds, selectedTestId);
    // Batched samples drop out of the selection; anything selected but left
    // over (because "No. of Batches" was capped) stays checked so it can be
    // sent through again.
    const usedSet = new Set(usedIds);
    setSelectedSampleIds(prev => prev.filter(id => !usedSet.has(id)));
    const leftover = pool.length - cursor;
    notify?.(`Created ${createdLabels.length} sub-batch(es) from ${cursor} selected sample(s): ${createdLabels.join(", ")}.${leftover > 0 ? ` ${leftover} selected sample(s) left over — still checked, run Create Multiple Batches again if needed.` : ""}`, "ok");
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
    if (!subBatchEditGate.allowed) {
      notify?.("Guest access can't edit sub-batches — this login is view-only for this action.", "warn");
      return;
    }
    setSelectedTestId(sb.testTypeId);
    setSelectedReferenceIds([]);
    setSelectedSampleIds(sb.memberSampleIds || []);
    setLabel(sb.label);
    setAssignedTester(sb.assignedTester || "");
    setEditingSubBatchId(sb.id);
  }
  function markMembersInProgress(memberIds, testTypeId) {
    if (!setSamples) return;
    // Computed as one pure pass over the current `samples` prop (not
    // inside the setSamples updater — that runs the callback separately
    // for local state vs. persistence, and this needs to happen exactly
    // once) then persisted in a SINGLE bulk call — see setSamples() in
    // 99-app.js for why looping N individual setSamples() calls here (one
    // save + one audit-log append each) was the real cause of a second
    // Analytical Batch, created right after the first, sometimes failing
    // to save: N+N sequential round trips through the backend's shared
    // write lock can genuinely queue long enough to time out.
    const idSet = new Set(memberIds);
    const changed = [];
    const nextSamples = (samples || []).map(member => {
      if (!idSet.has(member.id)) return member;
      const rt = (member.requestedTests || []).find(r => r.testTypeId === testTypeId);
      if (!rt || rt.status !== "pending") return member; // already past pending, or edit removed it — leave alone
      const updated = setRequestedTestStatus(member, testTypeId, "in_progress", session);
      changed.push(updated);
      return updated;
    });
    if (!changed.length) return;
    setSamples(() => nextSamples, changed);
  }
  function createGroup() {
    if (creatingRef.current) return;
    creatingRef.current = true;
    if (editingSubBatchId ? !subBatchEditGate.allowed : !subBatchCreateGate.allowed) {
      notify?.("You don't have permission to do that.", "warn");
      creatingRef.current = false;
      return;
    }
    if (!selectedTestId || selectedSampleIds.length === 0) {
      notify?.("Pick a test type and at least one sample.", "warn");
      creatingRef.current = false;
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
      DataService.appendAudit({
        entity: "subBatch",
        entityId: editingSubBatchId,
        action: "edit",
        user: session.username,
        role: session.role,
        note: `Updated sub-batch "${label.trim() || "Sub-batch"}" — now ${selectedSampleIds.length} sample(s)`
      });
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
      DataService.appendAudit({
        entity: "subBatch",
        entityId: sb.id,
        action: "create",
        user: session.username,
        role: session.role,
        note: `Created sub-batch "${sb.label}" with ${selectedSampleIds.length} sample(s)`
      });
      notify?.(`${sb.label} created with ${selectedSampleIds.length} sample(s).`, "ok");
    }
    resetForm();
    creatingRef.current = false;
  }
  function updateAssignedTester(sbId, tester) {
    if (!subBatchEditGate.allowed) {
      notify?.("Guest access can't edit sub-batches — this login is view-only for this action.", "warn");
      return;
    }
    setSubBatches(prev => prev.map(sb => sb.id === sbId ? {
      ...sb,
      assignedTester: tester
    } : sb));
  }
  // A "tested" sub-batch normally can only be deleted by first deleting its
  // linked Test Record (13-testrecords-ui.js doDelete), which resets the
  // sub-batch back to "pending" itself. But if the Test Record save to the
  // backend failed part-way (e.g. a very large batch's memberResults JSON
  // exceeding the ~50,000-character-per-cell limit Google Sheets enforces),
  // the sub-batch can be left stuck at "tested"/testRecordId pointing at a
  // record that was never actually persisted — nothing to click "delete" on
  // in Test Records, and this button stays disabled forever. isOrphanedTested
  // detects exactly that case so it can be unstuck directly.
  function isOrphanedTestedSubBatch(sb) {
    if (sb.status !== "tested") return false;
    if (!sb.testRecordId) return true;
    return !(testRecords || []).some(r => r.id === sb.testRecordId);
  }
  function doDeleteSubBatch(sb) {
    if (!subBatchDeleteGate.allowed) return;
    const orphaned = isOrphanedTestedSubBatch(sb);
    setSubBatches(prev => prev.filter(x => x.id !== sb.id));
    setDeleteSubBatchId(null);
    if (editingSubBatchId === sb.id) resetForm();
    // The Delete button is only enabled while sb.status === "pending" OR the
    // batch is an orphaned "tested" batch as detected above (see the
    // disabled check below — a normal tested batch must have its Test
    // Record deleted first, which itself now reverts the samples — so
    // nothing resulted here needs undoing in that case). But
    // markMembersInProgress() moved every member's rt.status to
    // "in_progress" the moment this batch was created (and, for a genuinely
    // tested batch, results entry moved it on to "results_entered"); removing
    // the batch without resetting that back would leave each sample LOOKING
    // like it's still busy on Sample Detail even though no batch/record
    // backs that anymore. Functionally the sample is already selectable
    // again for a new batch either way — isTestQueuedForSample()/
    // pendingTestTypeIdsForSample() (16-sub-batch.js) key off whether a
    // *pending* sub-batch still references it, not off this stored field —
    // but resetting it keeps what's displayed honest.
    if (setSamples && (sb.status === "pending" || orphaned)) {
      // Same fix as markMembersInProgress() above — one pure pass +
      // one bulk persisted call instead of one setSamples() round trip per
      // member sample.
      const idSet = new Set(sb.memberSampleIds || []);
      const changed = [];
      const nextSamples = (samples || []).map(member => {
        if (!idSet.has(member.id)) return member;
        const rt = (member.requestedTests || []).find(r => r.testTypeId === sb.testTypeId);
        if (!rt) return member;
        // Orphaned case: the member may be sitting at "results_entered"
        // (Awaiting Review) with no real Test Record behind it — reset all
        // the way back to "in_progress", same as deleting a real Test
        // Record would. Normal pending case: only "in_progress" needs
        // resetting, same as before.
        if (orphaned) {
          if (!["in_progress", "results_entered"].includes(rt.status)) return member;
          const updated = setRequestedTestStatus(member, sb.testTypeId, "in_progress", session, `Analytical batch "${sb.label}" deleted (its test record was never actually saved) — back to in-progress testing.`);
          changed.push(updated);
          return updated;
        }
        if (rt.status !== "in_progress") return member;
        const updated = setRequestedTestStatus(member, sb.testTypeId, "pending", session, `Analytical batch "${sb.label}" deleted — back to pending testing.`);
        changed.push(updated);
        return updated;
      });
      if (changed.length) setSamples(() => nextSamples, changed);
    }
    DataService.appendAudit({
      entity: "subBatch",
      entityId: sb.id,
      action: "delete",
      user: session.username,
      role: session.role,
      note: orphaned ? `Deleted orphaned sub-batch "${sb.label}" (linked test record was never saved) — member samples returned to in-progress` : `Deleted sub-batch "${sb.label}"`
    });
    notify?.(orphaned ? `${sb.label} deleted — its test record had never actually been saved to the backend, so member samples were returned to in-progress.` : `${sb.label} deleted.`, "ok");
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
    placeholder: "No. of batches (optional)",
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
    className: "max-h-64 overflow-y-auto overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: C.bg,
      position: "sticky",
      top: 0
    }
  }, ["", "Sample Code", "Ref / Memo No.", "Tracking No.", "Client", "Customer Name", "Site", "Type of Water Point"].map(h => /*#__PURE__*/React.createElement("th", {
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
    }, ref?.refNo || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.muted
      }
    }, ref?.trackingNo || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.ink
      }
    }, ref?.contactPerson || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.ink
      }
    }, s.clientName), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.muted
      }
    }, s.siteLocation), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.muted
      }
    }, s.waterPointType || "—"));
  })))));

  const mixedBatchWarning = distinctReferences.length > 1 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded mt-2",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, "Heads up: this sub-batch mixes samples from ", distinctReferences.length, " different References (", distinctReferences.map(r => r.refNo).join(", "), "). That's fine for testing — each sample keeps its own Reference for reporting.") : null;

  const canSubmitSubBatchForm = editingSubBatchId ? canEditSubBatch : canCreateSubBatch;
  const actionRow = /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-3"
  }, editingSubBatchId && /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: resetForm
  }, "Cancel Edit"), canSubmitSubBatchForm && /*#__PURE__*/React.createElement(Button, {
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
  const creationSection = (canCreateSubBatch || canEditSubBatch) ? /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4",
    style: {
      gridTemplateColumns: "minmax(240px, 1fr) minmax(320px, 1.6fr)"
    }
  }, formCard, pickerCard) : null;

  // ---- Consolidated "All Analytical Batches" data table ----
  // Each sub-batch is a real <tr> now (Analytical Batch / Samples / Tester /
  // Status / Actions columns) instead of a standalone bordered card, so the
  // whole list reads as one aligned enterprise table. Review/Return/Final
  // Approve/Release live as row-level action buttons on the right — this is
  // also where Batch Approve/Release (by Reference) results ultimately show
  // up once applied. Any inline panel a row needs (delete confirm, return
  // note, signature capture) renders as a second, full-width <tr> directly
  // beneath it rather than breaking table alignment.
  // Other parameters still genuinely pending (requested, not yet resulted,
  // not already queued into any pending batch) for this batch's own member
  // samples — e.g. a batch running Arsenic might have members that still
  // need Iron and Manganese done separately. Lets the register answer
  // "does anything from this batch still need another Analytical Batch?"
  // at a glance, without opening each sample.
  function pendingOtherTestsForBatch(sb) {
    const memberSet = new Set(sb.memberSampleIds || []);
    const members = samples.filter(s => memberSet.has(s.id));
    const pendingIds = new Set();
    members.forEach(s => {
      pendingTestTypeIdsForSample(s, testRecords, subBatches).forEach(tid => {
        if (tid !== sb.testTypeId) pendingIds.add(tid);
      });
    });
    return Array.from(pendingIds).map(tid => testTypes.find(t => t.id === tid)?.name).filter(Boolean);
  }
  function renderSubBatchRow(sb) {
    const testerControl = sb.status === "pending" && canEditSubBatch ? /*#__PURE__*/React.createElement("select", {
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
    const hasPanel = deleteSubBatchId === sb.id;
    const sbOrphaned = isOrphanedTestedSubBatch(sb);
    const sbDeletable = sb.status === "pending" || sbOrphaned;
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
      className: "px-3 py-2"
    }, (() => {
      const pendingNames = pendingOtherTestsForBatch(sb);
      return pendingNames.length ? /*#__PURE__*/React.createElement("div", {
        className: "flex flex-wrap gap-1",
        title: `Still pending for this batch's samples: ${pendingNames.join(", ")}`
      }, pendingNames.map(name => /*#__PURE__*/React.createElement(Badge, {
        key: name,
        tone: "warn"
      }, name))) : /*#__PURE__*/React.createElement("span", {
        className: "text-xs",
        style: {
          color: C.muted
        }
      }, "—");
    })()), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2 text-right"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-end gap-1.5 flex-wrap"
    }, ["tested", "reviewed", "approved"].includes(sb.status) && /*#__PURE__*/React.createElement("span", {
      className: "text-[11px]",
      style: {
        color: C.muted
      }
    }, "Review/Approve/Release → Results Workflow"), canEditSubBatch && /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: sb.status === "pending" ? "Edit sub-batch" : "Only pending sub-batches can be edited (this one is already tested)",
      disabled: sb.status !== "pending",
      onClick: subBatchEditGate.guard(() => startEdit(sb))
    }), canDeleteSubBatch && /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: sb.status === "pending" ? "Delete sub-batch" : sbOrphaned ? "This batch's test record was never actually saved to the backend — delete to unstick it" : "Delete the linked test record first to remove a tested sub-batch",
      disabled: !sbDeletable,
      onClick: subBatchDeleteGate.guard(() => setDeleteSubBatchId(sb.id))
    }))));
    const panelRow = !hasPanel ? null : /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: 6,
      className: "px-3 pb-3"
    }, deleteSubBatchId === sb.id && /*#__PURE__*/React.createElement(ConfirmBar, {
      text: sbOrphaned ? `Delete sub-batch "${sb.label}"? Its test record was never actually saved to the backend (likely too large a batch) — its ${sb.memberSampleIds.length} member sample(s) will be returned to in-progress testing so you can re-enter results in a smaller batch.` : `Delete sub-batch "${sb.label}"? Its ${sb.memberSampleIds.length} member sample(s) become available for another sub-batch again.`,
      onConfirm: () => doDeleteSubBatch(sb),
      onCancel: () => setDeleteSubBatchId(null)
    })));
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: sb.id
    }, mainRow, panelRow);
  }

  const listCard = /*#__PURE__*/React.createElement(SectionCard, {
    title: "All Analytical Batches",
    subtitle: "Creation and membership only — review, approve, and release now happen in the Results Workflow tab.",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 15
    })
  }, subBatches.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: "layers",
    title: "No sub-batches yet",
    subtitle: "Group pending samples by test type above to create one."
  }) : /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg overflow-hidden",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: C.bg
    }
  }, ["Analytical Batch", "Samples", "Tester", "Status", "Pending Tests", ""].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-3 py-2 text-xs font-semibold",
    style: {
      color: C.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, subBatches.map(sb => renderSubBatchRow(sb)))))));

  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, creationSection, listCard);
}
