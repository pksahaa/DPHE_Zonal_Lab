// ============================================================================
// REFERENCE / SOURCE MODEL — who a sample came from. Previously this was a
// loose free-text field on each Sample (`batchRef`); it's now a proper entity
// so a lab can see, at a glance, everything that came in under one DPHE
// letter or one private institution's request, and so reports can be
// generated PER REFERENCE (which is how the lab actually delivers results —
// not per internal testing batch).
//
// Three source types, matching how samples actually arrive:
//   - "DPHE"    — usually bulk, always an official letter + reference no.
//   - "Private" — an institution with its own water points; bulk or small,
//                 usually with a letter + reference no.
//   - "Walkin"  — a person bringing 1-2 samples directly, often no letter.
//                 Gets an auto-generated internal reference so it can still
//                 be tracked/reported the same way as everything else.
// ============================================================================

const REFERENCE_SOURCE_TYPES = [{
  value: "DPHE",
  label: "DPHE"
}, {
  value: "Private",
  label: "Private / Public Institution"
}, {
  value: "Walkin",
  label: "Walk-in"
}];

// Ref code format: <PREFIX>-<year>-#### — prefix signals source type at a glance.
function generateRefCode(existingReferences, sourceType, dateStr) {
  const year = (dateStr || todayStr()).slice(0, 4);
  const prefix = sourceType === "DPHE" ? "DPHE" : sourceType === "Private" ? "PVT" : "WI";
  const nums = (existingReferences || [])
    .filter(r => (r.refCode || "").startsWith(`${prefix}-${year}-`))
    .map(r => Number(r.refCode.split("-")[2]) || 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

function createReference(fields, existingReferences, user) {
  const now = new Date().toISOString();
  return {
    id: uid("ref"),
    refCode: generateRefCode(existingReferences, fields.sourceType, fields.letterDate),
    sourceType: fields.sourceType || "Walkin",
    organizationName: fields.organizationName || "",
    // The official letter's own reference number, if the source provided one
    // (DPHE/Private usually do; Walk-in usually doesn't) — kept separate from
    // our internal refCode so both are searchable without colliding.
    officialRefNo: fields.officialRefNo || "",
    letterDate: fields.letterDate || "",
    contactPerson: fields.contactPerson || "",
    contactPhone: fields.contactPhone || "",
    notes: fields.notes || "",
    createdAt: now,
    createdBy: user?.name || "Unknown",
  };
}

function referenceDisplayLabel(ref) {
  if (!ref) return "—";
  const org = ref.organizationName ? ` — ${ref.organizationName}` : "";
  return `${ref.refCode}${org}`;
}

// Samples grouped by reference — the basis for both the References list view
// and per-reference reporting (report generation groups by this, not by
// internal testing Batch).
function samplesByReference(samples, referenceId) {
  return (samples || []).filter(s => s.referenceId === referenceId);
}
