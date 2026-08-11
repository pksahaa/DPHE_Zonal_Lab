// ===== 22a-remark-engine.js =====
// ============================================================================
// AUTOMATED REMARK / RESULT VALIDATION ENGINE
// Compares a sample's test result against the limits configured on its
// analytical Parameter (Test Configuration → Parameters → "Limits") and
// produces a dynamic "System Remark" + a color-coded Status Flag for the
// Results Workflow's "Awaiting Review" and "Awaiting Approval" queues
// (22-results-workflow-ui.js).
//
// Pure logic lives in generateResultRemark() — no React, no app state — so
// it can be unit-tested on its own. Everything below it wires that logic
// into the data model already in this app:
//   - a "result" is one entry of a test record's `results` /
//     `memberResults[].results` array — { paramId, name, unit, value }
//     (see 13-testrecords-ui.js).
//   - the Limits live on the Parameter master record ({ lod, loq,
//     minDetection, maxDetection, refLimitMin, refLimitMax } — see
//     12a-parameters-ui.js). A Test Type only stores linkedParameterIds, not
//     a 1:1 id match to its resultParameters, so resolveParameterConfig()
//     below bridges the two by name/unit.
//   - "diluted" is the test record's `dilutionRequired` flag (see the
//     Dilution section of 13-testrecords-ui.js) — it is recorded once per
//     test record/run, i.e. per (sample × testType), not per parameter.
// ============================================================================

// ---------------- 1. Flag catalog + badge tone mapping ----------------
// Reuses the app's existing Badge tones (ok/warn/danger — see 02-ui-kit.js)
// instead of inventing a new color set, so System Remark badges look native
// next to every other status pill in the app.
//   🟢 NORMAL                          -> "ok"     (green)
//   🟡 INFO / WARNING / DEFICIENT      -> "warn"   (amber)
//   🔴 EXCEEDED / ACTION_REQUIRED      -> "danger" (red)
const REMARK_FLAGS = {
  NORMAL: "NORMAL",
  INFO: "INFO",
  WARNING: "WARNING",
  DEFICIENT: "DEFICIENT",
  EXCEEDED: "EXCEEDED",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  UNKNOWN: "UNKNOWN" // no limits configured / no result yet — informational only
};

// Tone is driven by drinkability against the Max Reference Limit, not by
// which sub-rule fired: anything at/below that limit (ND, trace, below-min,
// below-reference, normal) is safe to show green — only a result that
// actually exceeds the Max Reference Limit (with or without dilution) is
// red. ACTION_REQUIRED (raw result over Max Detection Limit, dilution
// pending) stays red too — it's not yet confirmed to be within limit.
const REMARK_FLAG_TONE = {
  NORMAL: "ok",
  INFO: "ok",
  WARNING: "ok",
  DEFICIENT: "ok",
  EXCEEDED: "danger",
  ACTION_REQUIRED: "danger",
  UNKNOWN: "muted"
};

// Short badge text keyed by ruleId, for compact table layouts (Awaiting
// Review/Approve) — the full sentence is still always available as the
// badge's hover title (see SystemRemarkBadge), nothing is lost, it just
// doesn't need a wide column to render on one line.
const REMARK_SHORT_LABEL = {
  no_result: "Pending",
  no_parameter: "No Parameter",
  no_config: "No Limits Set",
  diluted_exceeds_reference: "Exceeds (Diluted)",
  diluted_within_reference: "Within (Diluted)",
  exceeds_max_detection: "Re-test w/ Dilution",
  below_lod: "ND (< LOD)",
  below_loq: "Trace (< LOQ)",
  below_min_detection: "Below Min.",
  exceeds_reference: "Exceeds Limit",
  below_reference: "Below Limit",
  within_range: "Normal"
};

// ---------------- 2. Core evaluation logic (deliverable #1) ----------------
// Small numeric helper — Limits fields default to "" (unset) on a Parameter
// record (see ParameterForm in 12a-parameters-ui.js), so "" / null /
// undefined / NaN all mean "this limit was not configured" and must be
// skipped rather than treated as 0.
function hasLimit(v) {
  return v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
}

/**
 * generateResultRemark(result, parameterConfig, isDiluted)
 *
 * @param {number|string} result - the final calculated/entered result value.
 * @param {object|null} parameterConfig - limits from the Parameter record:
 *   { lod, loq, minDetection, maxDetection, refLimitMin, refLimitMax }
 *   Any field may be "" / null / undefined if that limit isn't configured.
 *   Pass null (not {}) when the Parameter entity itself couldn't be
 *   resolved/hydrated at all — that renders as "Pending Parameter Match"
 *   rather than being treated as "matched, nothing configured".
 * @param {boolean} isDiluted - whether dilution was applied for the batch/
 *   record this result belongs to. NOTE: this is a per-record flag, not a
 *   per-sample one — a batch can be marked "Dilution Required" while only
 *   some of its samples actually needed it. This function only honors the
 *   flag for a given result if that result's own value exceeds
 *   maxDetection; otherwise it evaluates the result as if isDiluted were
 *   false, regardless of what the batch/record flag says.
 * @returns {{ remark: string, flag: string, displayValue: string|null, ruleId: string }}
 */
function generateResultRemark(result, parameterConfig, isDiluted) {
  const num = result === "" || result === null || result === undefined ? NaN : Number(result);

  // ---- guard: nothing to evaluate yet ----
  if (!Number.isFinite(num)) {
    return { remark: "Pending Result", flag: REMARK_FLAGS.UNKNOWN, displayValue: null, ruleId: "no_result" };
  }
  // ---- guard: the Parameter entity itself couldn't be hydrated/joined at
  // all (no linked Parameter found for this Test Type, or it was deleted).
  // This is deliberately a DIFFERENT case from "matched, but nobody filled
  // in any limits yet" below — collapsing the two used to mean a genuinely
  // missing Parameter silently fell through to showing the raw result value
  // next to a vague message, which read as if the raw value WAS the
  // validated remark. Bail out here, before touching any limit field, so a
  // missing Parameter can never be mistaken for a validated result. ----
  if (!parameterConfig) {
    return { remark: "Pending Parameter Match", flag: REMARK_FLAGS.UNKNOWN, displayValue: null, ruleId: "no_parameter" };
  }
  const cfg = parameterConfig;
  // ---- guard: parameter has no Limits configured at all — nothing to
  // validate against, so say so instead of silently claiming "Normal". ----
  const anyLimitConfigured = [cfg.lod, cfg.loq, cfg.minDetection, cfg.maxDetection, cfg.refLimitMin, cfg.refLimitMax].some(hasLimit);
  if (!anyLimitConfigured) {
    return { remark: "No parameter limits configured for validation", flag: REMARK_FLAGS.UNKNOWN, displayValue: fmtNum(num), ruleId: "no_config" };
  }

  const lod = hasLimit(cfg.lod) ? Number(cfg.lod) : null;
  const loq = hasLimit(cfg.loq) ? Number(cfg.loq) : null;
  const minDetection = hasLimit(cfg.minDetection) ? Number(cfg.minDetection) : null;
  const maxDetection = hasLimit(cfg.maxDetection) ? Number(cfg.maxDetection) : null;
  const refLimitMin = hasLimit(cfg.refLimitMin) ? Number(cfg.refLimitMin) : null;
  const refLimitMax = hasLimit(cfg.refLimitMax) ? Number(cfg.refLimitMax) : null;

  // ==== 1. DILUTION HANDLING ====
  // `isDiluted` is recorded once per test record/batch, not per sample —
  // but in reality only the sample(s) whose result actually exceeded Max
  // Detection needed dilution. So a batch-level dilution flag should NOT
  // push every sample in that batch through the diluted pathway; only the
  // sample(s) whose own result exceeds maxDetection go through it. Any
  // other sample in the same "diluted" batch falls straight through to the
  // normal (not-diluted) rules below, exactly as if isDiluted were false
  // for it. If maxDetection isn't configured at all we have no way to tell
  // which samples needed it, so we fall back to trusting the flag.
  const dilutionAppliesToThisResult = isDiluted && (maxDetection === null || num > maxDetection);
  if (dilutionAppliesToThisResult) {
    // maxDetection is intentionally ignored while diluted.
    if (refLimitMax !== null && num > refLimitMax) {
      return {
        remark: "Exceeds Reference Limit (Diluted)",
        flag: REMARK_FLAGS.EXCEEDED, // red — a genuine out-of-spec value even after dilution
        displayValue: refLimitMax !== null ? `max: ${fmtNum(refLimitMax)}` : null,
        ruleId: "diluted_exceeds_reference"
      };
    }
    return {
      remark: "Within Reference Limit (Diluted)",
      flag: REMARK_FLAGS.NORMAL,
      displayValue: refLimitMax !== null ? `max: ${fmtNum(refLimitMax)}` : null,
      ruleId: "diluted_within_reference"
    };
  }

  // ==== not diluted (or diluted batch, but this sample didn't need it):
  // raw result vs Max Detection Limit ====
  if (maxDetection !== null && num > maxDetection) {
    return {
      remark: "Exceeds Max Detection Limit! Re-test with Dilution.",
      flag: REMARK_FLAGS.ACTION_REQUIRED,
      displayValue: `max detection: ${fmtNum(maxDetection)}`,
      ruleId: "exceeds_max_detection"
    };
  }

  // ==== 2. LOWER LIMITS (result <= maxDetection, not diluted) ====
  if (lod !== null && num < lod) {
    return {
      remark: "Below Detection Limit (ND)",
      flag: REMARK_FLAGS.INFO,
      displayValue: `< ${fmtNum(lod)}`,
      ruleId: "below_lod"
    };
  }
  if (loq !== null && (lod === null || num >= lod) && num < loq) {
    return {
      remark: "Trace Amount Present (Below Quantitation Limit)",
      flag: REMARK_FLAGS.INFO,
      displayValue: `LOQ: ${fmtNum(loq)}`,
      ruleId: "below_loq"
    };
  }
  if (minDetection !== null && (loq === null || num >= loq) && num < minDetection) {
    return {
      remark: "Below Minimum Operating Limit",
      flag: REMARK_FLAGS.WARNING,
      displayValue: `min: ${fmtNum(minDetection)}`,
      ruleId: "below_min_detection"
    };
  }

  // ==== 3. STANDARD OPERATING & REFERENCE RANGE ====
  // (minDetection <= result <= maxDetection, or those limits simply aren't
  // configured — either way we've fallen through the lower-limit checks.)
  if (refLimitMax !== null && num > refLimitMax) {
    return {
      remark: "Exceeds Standard Reference Limit",
      flag: REMARK_FLAGS.EXCEEDED,
      displayValue: `max: ${fmtNum(refLimitMax)}`,
      ruleId: "exceeds_reference"
    };
  }
  if (refLimitMin !== null && num < refLimitMin) {
    return {
      remark: "Below Standard Reference Limit",
      flag: REMARK_FLAGS.DEFICIENT,
      displayValue: `min: ${fmtNum(refLimitMin)}`,
      ruleId: "below_reference"
    };
  }
  // Nothing was crossed — still show whichever configured range the value
  // actually landed inside (Reference Limit preferred, falling back to
  // Detection range), so "Normal" results carry the same limit context as
  // every other outcome instead of going blank.
  const withinRangeLimit = refLimitMin !== null || refLimitMax !== null
    ? `range: ${refLimitMin !== null ? fmtNum(refLimitMin) : "—"}–${refLimitMax !== null ? fmtNum(refLimitMax) : "—"}`
    : minDetection !== null || maxDetection !== null
      ? `range: ${minDetection !== null ? fmtNum(minDetection) : "—"}–${maxDetection !== null ? fmtNum(maxDetection) : "—"}`
      : null;
  return {
    remark: "Within Acceptable Range",
    flag: REMARK_FLAGS.NORMAL,
    displayValue: withinRangeLimit,
    ruleId: "within_range"
  };
}

// ---------------- 3. Bridging the app's data model ----------------
// A Test Type's calculated `resultParameters` (id "rp_...") are a separate
// id-space from the global Parameter master list (id "param_..."); the only
// link between them is `testType.linkedParameterIds`. Resolve which linked
// Parameter's Limits apply to a given result row by name (falling back to
// unit, then to "the only one linked") rather than requiring a rigid 1:1 id
// match that the data model doesn't actually guarantee.
// A Test Type now reports exactly one Parameter (Test Type Builder enforces
// a single linked Parameter — see 12-testtypes-ui.js's ParameterLinker), so
// resolving which Parameter's Limits apply to a result row is a direct
// id-based join in the common case: no name-guessing, no ambiguity. The
// name/unit matching below only exists for LEGACY data saved before that
// single-Parameter rule existed, where linkedParameterIds may still carry
// more than one id.
function resolveParameterConfig(resultItem, testType, parameters) {
  const linked = (testType?.linkedParameterIds || [])
    .map(id => (parameters || []).find(p => p.id === id))
    .filter(Boolean);
  if (!linked.length) return null;
  if (linked.length === 1) return linked[0]; // direct id-based join — the normal case
  // ---- legacy fallback: more than one linked id on this Test Type ----
  const name = (resultItem?.name || "").trim().toLowerCase();
  const byName = linked.find(p =>
    (p.name || "").trim().toLowerCase() === name ||
    (p.shortName || "").trim().toLowerCase() === name
  );
  if (byName) return byName;
  const unit = (resultItem?.unit || "").trim().toLowerCase();
  if (unit) {
    const byUnit = linked.find(p => (p.unit || "").trim().toLowerCase() === unit);
    if (byUnit) return byUnit;
  }
  return null;
}

// Dilution is recorded once per test record (not per result row) — look it
// up from whichever record actually produced this sample's result.
function getIsDilutedForRecord(recordId, testRecords) {
  const rec = (testRecords || []).find(r => r.id === recordId);
  return !!rec?.dilutionRequired;
}

/**
 * evaluateSampleResultsForTest(sample, testTypeId, testTypes, parameters, testRecords)
 * Returns one evaluated row per result the sample has for that test type:
 *   { paramId, name, unit, value, remark, flag, displayValue, manualRemark }
 * or [] if the sample has no results recorded for this test yet.
 */
function evaluateSampleResultsForTest(sample, testTypeId, testTypes, parameters, testRecords) {
  const resultInfo = getSampleResultForTest(sample, testTypeId, testRecords);
  if (!resultInfo || !resultInfo.results || !resultInfo.results.length) return [];
  const testType = (testTypes || []).find(t => t.id === testTypeId);
  const isDiluted = getIsDilutedForRecord(resultInfo.recordId, testRecords);
  const manualRemark = getManualRemark(sample, testTypeId);
  return resultInfo.results
    .filter(r => r.value !== undefined) // drop rows the entry form hasn't produced at all yet;
    // rows with value: null (e.g. a formula error) still pass through and are
    // reported as "Pending Result" by generateResultRemark's guard clause.
    .map(r => {
      const parameterConfig = resolveParameterConfig(r, testType, parameters);
      const evalResult = generateResultRemark(r.value, parameterConfig, isDiluted);
      return {
        paramId: r.paramId,
        name: r.name,
        unit: r.unit,
        value: r.value,
        isDiluted,
        manualRemark,
        ...evalResult
      };
    });
}

// ---------------- 4. Manual override storage ----------------
// Kept alongside the sample's requestedTests entry (one manual remark per
// sample × testType — the same granularity the Review/Approve queues group
// by) so it persists through the app's existing DataService sample storage,
// with no new collection required.
function getManualRemark(sample, testTypeId) {
  const rt = (sample.requestedTests || []).find(x => x.testTypeId === testTypeId);
  return rt?.manualRemark || "";
}
function setManualRemarkOnSample(sample, testTypeId, manualRemark) {
  return {
    ...sample,
    requestedTests: (sample.requestedTests || []).map(rt =>
      rt.testTypeId === testTypeId ? { ...rt, manualRemark } : rt
    )
  };
}

// ---------------- 5. Presentational pieces (deliverable #2/#3) ----------------
// One flag badge, reusing the app's Badge primitive. Shows the short label
// (compact — fits a single-line table row); the full sentence is always the
// hover title, so nothing is actually hidden, just not taking up column
// width by default.
function SystemRemarkBadge({ flag, remark, ruleId }) {
  return /*#__PURE__*/React.createElement(Badge, {
    tone: REMARK_FLAG_TONE[flag] || "muted",
    title: remark
  }, REMARK_SHORT_LABEL[ruleId] || remark);
}

// The "System Remark" table cell: one auto-generated badge per evaluated
// parameter (a method can have more than one result/parameter), plus a
// read-only line for a manual reviewer remark if one has been added. The
// remark editor itself lives in the Actions column (see RemarkEditRow in
// 22-results-workflow-ui.js) so this cell never grows taller than its
// badges just to make room for an edit control most rows won't use.
function SystemRemarkCell({ evaluated, manualRemark }) {
  if (!evaluated.length) {
    return React.createElement("span", { className: "text-xs", style: { color: C.muted } }, "—");
  }

  return React.createElement("div", { className: "flex flex-col gap-1 min-w-0" },
    evaluated.map((ev, i) => React.createElement("div", {
      key: ev.paramId || i,
      className: "flex items-center gap-1.5 flex-wrap"
    },
      evaluated.length > 1 && React.createElement("span", { className: "text-[11px] font-medium", style: { color: C.muted } }, `${ev.name}:`),
      React.createElement(SystemRemarkBadge, { flag: ev.flag, remark: ev.remark, ruleId: ev.ruleId }),
      ev.displayValue && React.createElement("span", { className: "text-[11px]", style: { color: C.muted } }, `(${ev.displayValue}${ev.unit ? ` ${ev.unit}` : ""})`)
    )),
    manualRemark && React.createElement("div", {
      className: "text-[11px] flex items-center gap-1",
      style: { color: C.ink },
      title: "Reviewer remark"
    },
      React.createElement(Icon, { name: "edit", size: 11 }),
      manualRemark
    )
  );
}
