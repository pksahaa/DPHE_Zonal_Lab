// ===== 30-dashboard.js =====
// ============================================================================
// DASHBOARD TAB — KPI snapshot, inventory health, equipment status, today's
// workload. Sample Lifecycle KPIs are shown first at the top.
// ============================================================================

// ---------------------------------------------------------------------------
// Fiscal Year helpers
// Fiscal year: July 1 – June 30. "2025-26" means Jul-2025 to Jun-2026.
// ---------------------------------------------------------------------------
function getFiscalYear(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-indexed; 6 = July
  const startYear = m >= 6 ? y : y - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function currentFiscalYear() {
  return getFiscalYear(new Date().toISOString());
}

// Returns the last N fiscal year strings in ascending order (oldest first).
function lastNFiscalYears(n) {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  const currentStart = m >= 6 ? y : y - 1;
  const years = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = currentStart - i;
    years.push(`${s}-${String(s + 1).slice(-2)}`);
  }
  return years;
}

// Every fiscal year that appears in these samples' receivedDate, plus the
// current fiscal year (so the picker is never empty on a fresh install),
// ascending, oldest first. Used to populate the Sample Life Cycle period
// filter's Year/Range dropdowns — see computeSampleLifecycleV2() below.
function fiscalYearsFromSamples(allSamples) {
  const starts = (allSamples || [])
    .map(function(s) { return getFiscalYear(s.receivedDate); })
    .filter(Boolean)
    .map(function(fy) { return Number(fy.split("-")[0]); });
  const curStart = Number(currentFiscalYear().split("-")[0]);
  const minStart = starts.length ? Math.min.apply(null, starts) : curStart;
  const maxStart = Math.max(curStart, starts.length ? Math.max.apply(null, starts) : curStart);
  const out = [];
  for (let y = minStart; y <= maxStart; y++) out.push(y + "-" + String(y + 1).slice(-2));
  return out;
}

// Builds a `(dateStr) => boolean` matcher for the Sample Life Cycle period
// filter. mode: "all" | "month" | "year" | "range". Applied per-figure to
// whichever date field is the right anchor for that figure — see
// computeSampleLifecycleV2()'s doc comment (receivedDate for the sample
// headcount, each parameter's own test-record date once it's been tested).
//   month — monthKey is "YYYY-MM", matched against dateStr's prefix.
//   year  — fy is a single fiscal-year string e.g. "2025-26".
//   range — fromFy/toFy are fiscal-year strings, inclusive both ends.
function buildLifecyclePeriodMatcher(mode, monthKey, fy, fromFy, toFy) {
  if (mode === "month") {
    return function(dateStr) { return !!dateStr && dateStr.slice(0, 7) === monthKey; };
  }
  if (mode === "year") {
    return function(dateStr) { return getFiscalYear(dateStr) === fy; };
  }
  if (mode === "range") {
    const fromStart = Number((fromFy || "0-0").split("-")[0]);
    const toStart = Number((toFy || "9999-99").split("-")[0]);
    return function(dateStr) {
      const gfy = getFiscalYear(dateStr);
      if (!gfy) return false;
      const st = Number(gfy.split("-")[0]);
      return st >= fromStart && st <= toStart;
    };
  }
  return function() { return true; }; // "all"
}

// ---------------------------------------------------------------------------
// Sample Life Cycle KPIs (v2)
// ---------------------------------------------------------------------------
// Single source of truth: the raw `samples` array, archived-flagged or not —
// archiving (see archiveReleasedMembers() in 13-testrecords-ui.js) never
// deletes or rewrites a sample's own record, it only sets `archived: true`
// once every one of its requested tests is done, so every field used below
// (status, requestedTests[].status, receivedDate) is still intact and
// correct on an archived sample. This function never reads the separate
// `archived_records` collection, so nothing here can be double-counted
// against it.
//
// Two counting units, and two date fields, used deliberately:
//   - totalSamples/overdueSamples are counted per SAMPLE, dated by
//     `receivedDate` — the field entered at registration for "when this
//     sample arrived at the lab" (NOT `collectionDate`, which is when it
//     was collected in the field — an earlier, different date, and the
//     wrong one to answer "how many samples did we receive this month").
//   - every other figure (Total Parameters Requested, In Testing, Awaiting,
//     Tested & Released, Rejected & Cancelled) is counted per PARAMETER —
//     one entry in a sample's requestedTests[] = 1 — because sample.status
//     is only a bottleneck ROLLUP of its parameters (rollupSampleStatus(),
//     20-sample-model.js): a sample with 3 requested parameters where 1 has
//     been released and 2 are still in progress shows sample.status =
//     "in_progress" as a whole, which would hide the 1 already-released
//     parameter from any card that counted by sample.status instead of by
//     each parameter's own status.
//
// Per-parameter DATE also matters, to match the Monthly Progress Report
// (computeMonthlyProgressStats(), 17-report-generator.js):
//   - a parameter that has reached results_entered/under_review/approved/
//     released is dated by its own test record's Test Date (the date
//     entered on Add Test Record — via getSampleResultForTest()), the same
//     field MPR now buckets by. A parameter tested and released in April
//     counts toward April here and in MPR, even if its sample was received
//     back in February.
//   - a parameter still pending/in_progress, or one that never got tested
//     because its sample was rejected/cancelled/on_hold/registered/
//     received, has no test record yet — the only date that exists for it
//     is the sample's own receivedDate.
// Because of this, Total Samples Received (dated by receivedDate) and
// Total Parameters Requested (dated per-parameter, mixing receivedDate and
// test-record date) will legitimately disagree on WHICH samples they're
// counting once a period narrower than "All Time" is selected — they are
// deliberately answering two different questions ("what arrived in this
// period" vs. "what had pipeline activity dated to this period"), not a
// bug.
//
// Identity that must always hold within THIS function's own numbers (no
// parameter is ever double counted or dropped): totalParams === inTesting
// + awaiting + releasedCnt + rejectedCnt + cancelledCnt. overdueSamples is
// a cross-cutting alert over the receivedDate-in-period sample set (a
// sample not yet fully released whose TAT has breached) and is
// intentionally NOT part of that sum.
function computeSampleLifecycleV2(allSamples, testRecords, inPeriod) {
  const AWAITING_PARAM_STATUSES = ["results_entered", "under_review", "approved"];
  const allArr = allSamples || [];

  let totalSamples = 0;
  let totalParams = 0;
  let inTesting = 0;       // pending/in_progress parameters, plus registered/received/on_hold samples' parameters
  let onHoldOnly = 0;      // subset of inTesting, tracked separately only for the sub-label
  let awaiting = 0;        // results_entered / under_review / approved parameters
  let releasedCnt = 0;
  let releasedLive = 0;
  let releasedArchived = 0;
  let rejectedCnt = 0;
  let cancelledCnt = 0;
  let overdueSamples = 0;

  allArr.forEach(function(s) {
    const rts = s.requestedTests || [];
    const receivedInPeriod = inPeriod(s.receivedDate);

    if (receivedInPeriod) {
      totalSamples++;
      // Overdue is judged against this same receivedDate-in-period set —
      // TAT is a per-sample commitment measured from receivedDate.
      const notFullyReleased = rts.length === 0 || rts.some(function(rt) { return rt.status !== "released"; });
      if (notFullyReleased && s.status !== "rejected" && s.status !== "cancelled") {
        const days = daysBetweenD(s.receivedDate, todayStr());
        const breached = (s.priority === "Urgent" && days > 1) || (s.priority !== "Urgent" && days > 5);
        if (breached) overdueSamples++;
      }
    }

    if (s.status === "rejected" || s.status === "cancelled") {
      // Custody-level, whole-sample decision, before any test record could
      // exist for these parameters — receivedDate is the only anchor.
      if (!receivedInPeriod) return;
      totalParams += rts.length;
      if (s.status === "rejected") rejectedCnt += rts.length; else cancelledCnt += rts.length;
      return;
    }
    if (s.status === "on_hold" || s.status === "registered" || s.status === "received") {
      if (!receivedInPeriod) return;
      totalParams += rts.length;
      inTesting += rts.length;
      if (s.status === "on_hold") onHoldOnly += rts.length;
      return;
    }
    // assigned / in_progress / results_entered / under_review / approved /
    // released — read each parameter's OWN status AND own date rather than
    // the sample rollup/receivedDate, so partial releases land in the
    // correct bucket and period.
    rts.forEach(function(rt) {
      let anchor = s.receivedDate;
      if (rt.status === "released" || AWAITING_PARAM_STATUSES.indexOf(rt.status) !== -1) {
        const info = getSampleResultForTest(s, rt.testTypeId, testRecords);
        if (info && info.date) anchor = info.date;
      }
      if (!inPeriod(anchor)) return;
      totalParams++;
      if (rt.status === "released") {
        releasedCnt++;
        if (s.archived) releasedArchived++; else releasedLive++;
      } else if (AWAITING_PARAM_STATUSES.indexOf(rt.status) !== -1) {
        awaiting++;
      } else {
        inTesting++; // pending / in_progress
      }
    });
  });

  return {
    totalSamples: totalSamples,
    totalParams: totalParams,
    inTesting: inTesting,
    onHoldOnly: onHoldOnly,
    awaiting: awaiting,
    releasedCnt: releasedCnt,
    releasedLive: releasedLive,
    releasedArchived: releasedArchived,
    rejectedCnt: rejectedCnt,
    cancelledCnt: cancelledCnt,
    overdueSamples: overdueSamples
  };
}

// Returns the best "date of test" for a sample — the release date stored in
// the most recent released requestedTest, falling back to updatedAt.
function sampleReleaseDate(sample) {
  const rts = (sample.requestedTests || []).filter(rt => rt.status === "released" && rt.updatedAt);
  if (rts.length) {
    return rts.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt;
  }
  return sample.updatedAt || sample.collectionDate || null;
}

// ---------------------------------------------------------------------------
// SVG Chart Components
// ---------------------------------------------------------------------------
function MiniBarChart({ data, width, height, color, revenueColor, yLabel, valueFormatter }) {
  width = width || 340; height = height || 160;
  color = color || "#14b8a6"; revenueColor = revenueColor || "#f59e0b";
  yLabel = yLabel || "Samples";
  valueFormatter = valueFormatter || function(v) { return v; };
  if (!data || !data.length) return null;
  const maxVal = Math.max.apply(null, data.map(function(d) { return d.value; }).concat([1]));
  const barW = Math.floor((width - 40) / data.length) - 6;
  const chartH = height - 40;
  const pad = 30;

  const bars = data.map(function(d, i) {
    const bh = Math.max(2, Math.round((d.value / maxVal) * chartH));
    const x = pad + i * (barW + 6);
    const y = chartH - bh + 10;
    const revLabel = (d.revenue != null && d.revenue > 0) ? ("৳" + fmtNum(d.revenue)) : null;
    const els = [
      React.createElement("rect", { key: "r"+i, x: x, y: y, width: barW, height: bh, rx: 3, fill: color, opacity: 0.85 })
    ];
    if (d.value > 0) els.push(
      React.createElement("text", { key: "cnt"+i, x: x + barW/2, y: y - (revLabel ? 14 : 3), textAnchor: "middle", fontSize: 9, fill: C.ink, fontWeight: "600" }, valueFormatter(d.value))
    );
    if (revLabel) els.push(
      React.createElement("text", { key: "rev"+i, x: x + barW/2, y: y - 2, textAnchor: "middle", fontSize: 8, fill: revenueColor }, revLabel)
    );
    els.push(
      React.createElement("text", { key: "lbl"+i, x: x + barW/2, y: chartH + 22, textAnchor: "middle", fontSize: 8, fill: C.muted }, d.label)
    );
    return els;
  });

  return React.createElement("svg", { width: width, height: height, style: { overflow: "visible" } },
    React.createElement("text", { x: 0, y: 10, fontSize: 9, fill: C.muted }, yLabel),
    React.createElement("line", { x1: pad - 4, y1: chartH + 10, x2: width, y2: chartH + 10, stroke: C.border, strokeWidth: 1 }),
    bars
  );
}

// ---------------------------------------------------------------------------
// Mini grouped (side-by-side) SVG bar chart — two series per label, e.g.
// Samples Tested vs Parameters Tested per fiscal year. Series values come
// straight off computeMonthlyProgressStats() cumulative totals so this
// always reads the same numbers the Monthly Progress Report shows.
// ---------------------------------------------------------------------------
function MiniGroupedBarChart({ data, width, height, seriesA, seriesB }) {
  width = width || 340; height = height || 172;
  if (!data || !data.length) return null;
  const maxVal = Math.max.apply(null, data.reduce(function(arr, d) { return arr.concat([d[seriesA.key] || 0, d[seriesB.key] || 0]); }, []).concat([1]));
  const groupW = Math.floor((width - 40) / data.length) - 6;
  const barW = Math.max(4, Math.floor((groupW - 4) / 2));
  const chartH = height - 46;
  const pad = 30;

  const groups = data.map(function(d, i) {
    const x = pad + i * (groupW + 6);
    const aVal = d[seriesA.key] || 0;
    const bVal = d[seriesB.key] || 0;
    const aH = Math.max(2, Math.round((aVal / maxVal) * chartH));
    const bH = Math.max(2, Math.round((bVal / maxVal) * chartH));
    const ay = chartH - aH + 10;
    const by = chartH - bH + 10;
    const els = [
      React.createElement("rect", { key: "a"+i, x: x, y: ay, width: barW, height: aH, rx: 2, fill: seriesA.color, opacity: 0.88 }),
      React.createElement("rect", { key: "b"+i, x: x + barW + 4, y: by, width: barW, height: bH, rx: 2, fill: seriesB.color, opacity: 0.88 })
    ];
    if (aVal > 0) els.push(
      React.createElement("text", { key: "at"+i, x: x + barW/2, y: ay - 3, textAnchor: "middle", fontSize: 7.5, fill: C.ink, fontWeight: "600" }, aVal)
    );
    if (bVal > 0) els.push(
      React.createElement("text", { key: "bt"+i, x: x + barW + 4 + barW/2, y: by - 3, textAnchor: "middle", fontSize: 7.5, fill: C.ink, fontWeight: "600" }, bVal)
    );
    els.push(
      React.createElement("text", { key: "lbl"+i, x: x + groupW/2, y: chartH + 22, textAnchor: "middle", fontSize: 8, fill: C.muted }, d.label)
    );
    return els;
  });

  return React.createElement("div", null,
    React.createElement("svg", { width: width, height: height - 20, style: { overflow: "visible" } },
      React.createElement("line", { x1: pad - 4, y1: chartH + 10, x2: width, y2: chartH + 10, stroke: C.border, strokeWidth: 1 }),
      groups
    ),
    React.createElement("div", { className: "flex items-center gap-4 justify-center mt-1" },
      React.createElement("span", { className: "flex items-center gap-1.5 text-xs", style: { color: C.muted } },
        React.createElement("span", { style: { width: 9, height: 9, borderRadius: 2, background: seriesA.color, display: "inline-block" } }),
        seriesA.label
      ),
      React.createElement("span", { className: "flex items-center gap-1.5 text-xs", style: { color: C.muted } },
        React.createElement("span", { style: { width: 9, height: 9, borderRadius: 2, background: seriesB.color, display: "inline-block" } }),
        seriesB.label
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Mini SVG pie chart
// ---------------------------------------------------------------------------
function MiniPieChart({ slices, size }) {
  size = size || 120;
  if (!slices || !slices.length) return null;
  const total = slices.reduce(function(s, d) { return s + d.value; }, 0);
  if (total === 0) return React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "No data yet.");
  const cx = size / 2, cy = size / 2, r = size / 2 - 8;
  let angle = -Math.PI / 2;
  const paths = slices.map(function(sl) {
    const sweep = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { d: "M"+cx+","+cy+" L"+x1+","+y1+" A"+r+","+r+" 0 "+large+",1 "+x2+","+y2+" Z", color: sl.color, label: sl.label, value: sl.value };
  });
  return React.createElement("div", { className: "flex items-center gap-4" },
    React.createElement("svg", { width: size, height: size },
      paths.map(function(p, i) { return React.createElement("path", { key: i, d: p.d, fill: p.color, opacity: 0.88 }); })
    ),
    React.createElement("div", { className: "flex flex-col gap-1.5" },
      slices.map(function(sl) {
        return React.createElement("div", { key: sl.label, className: "flex items-center gap-1.5 text-xs" },
          React.createElement("span", { style: { width: 10, height: 10, borderRadius: 2, background: sl.color, display: "inline-block" } }),
          React.createElement("span", { style: { color: C.ink } }, sl.label),
          React.createElement("span", { style: { color: C.muted } }, "("+sl.value+")")
        );
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Mini horizontal bar chart for test types
// ---------------------------------------------------------------------------
function MiniHBarChart({ data, color }) {
  color = color || "#6366f1";
  if (!data || !data.length) return React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "No released samples this fiscal year yet.");
  const maxVal = Math.max.apply(null, data.map(function(d) { return d.value; }).concat([1]));
  return React.createElement("div", { className: "flex flex-col gap-1.5" },
    data.map(function(d) {
      return React.createElement("div", { key: d.label, className: "flex items-center gap-2 text-xs" },
        React.createElement("span", { style: { width: 100, color: C.ink, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: d.label }, d.label),
        React.createElement("div", { style: { flex: 1, background: C.border, borderRadius: 4, height: 10, minWidth: 60 } },
          React.createElement("div", { style: { width: Math.round((d.value / maxVal) * 100) + "%", background: color, height: "100%", borderRadius: 4, minWidth: d.value > 0 ? 6 : 0 } })
        ),
        React.createElement("span", { style: { color: C.muted, width: 28, textAlign: "right" } }, d.value)
      );
    })
  );
}

// ---------------------------------------------------------------------------
// DashboardTab
// ---------------------------------------------------------------------------
function DashboardTab({
  chemicals,
  glassware,
  equipment,
  gasList,
  testRecords,
  samples,
  references,
  testTypes,
  parameters,
  goTo
}) {
  // Lazy-load archived records once on mount for dashboard stats.
  // We only need count + basic fields — same list the ArchiveTab already
  // fetches on demand, so this never blocks the initial app load.
  const [archived, setArchived] = React.useState([]);
  React.useEffect(function() {
    DataService.list("archived_records").then(function(rows) {
      setArchived(rows || []);
    }).catch(function() {}); // non-fatal — stats just show 0
  }, []);

  const allBatches = chemicals.flatMap(function(c) { return c.batches.map(function(b) { return Object.assign({}, b, { chemName: c.name, unit: c.unit }); }); });
  const activeBatches = allBatches.filter(function(b) { return b.status === "active"; });
  const expiringSoon = activeBatches.filter(function(b) { return daysUntil(b.expiryDate) <= 30 && daysUntil(b.expiryDate) >= 0; });
  const expired = allBatches.filter(function(b) { return b.status === "expired"; });
  const depleted = allBatches.filter(function(b) { return b.status === "depleted"; });
  const lowStock = activeBatches.filter(function(b) { return b.initialAmount > 0 && b.remaining > 0 && b.remaining / b.initialAmount < 0.15; });
  const allCylinders = (gasList || []).flatMap(function(g) { return g.cylinders.map(function(c) { return Object.assign({}, c, { gasName: g.name, unit: g.unit }); }); });
  const emptyCylinders = allCylinders.filter(function(c) { return c.status === "empty"; });
  const lowGasCylinders = allCylinders.filter(function(c) { return c.status === "active" && c.capacity > 0 && c.remaining / c.capacity < 0.15; });
  const totalGlassItems = glassware.reduce(function(s, g) { return s + g.totalQuantity; }, 0);
  const totalBroken = glassware.reduce(function(s, g) { return s + g.broken; }, 0);
  const totalInUse = glassware.reduce(function(s, g) { return s + g.inUse; }, 0);
  const functionalEquip = equipment.filter(function(e) { return e.functional; }).length;
  const nonFunctionalEquip = equipment.length - functionalEquip;
  const recentTests = [...testRecords].reverse().slice(0, 6);

  // ---- Sample Lifecycle KPIs (v2, dynamic period filter) ----
  // The FY revenue/parameter charts below now pass the raw `samples` array
  // (identical to what the Monthly Progress Report page itself passes —
  // see 14c-analytics-pages-2.js) instead of a `!s.archived`-filtered copy.
  // A sample's own requestedTests/results stay intact when it's flagged
  // archived (archiving never strips them — see archiveReleasedMembers(),
  // 13-testrecords-ui.js), so excluding archived-flagged samples here only
  // ever threw away real revenue/parameter data that MPR itself still
  // counted: computeMonthlyProgressStats()'s ONLY other path for archived
  // data (the separate archived_records fallback loop, for records whose
  // underlying testRecord was actually deleted on archive) deliberately
  // contributes zero revenue — it "doesn't retain raw result values" — so
  // any archived-flagged sample whose test record was still present (e.g.
  // seeded/imported data carrying `archived: true` without having gone
  // through the in-app archive action) was silently dropped from this
  // page's revenue/parameter totals while MPR itself still counted it in
  // full. This is what caused the two screens' revenue to disagree even
  // though both call the same aggregation function.
  const archivedCount = archived.length;

  // Period filter: All Time / Month / Fiscal Year / Fiscal Year Range.
  const [lcPeriodMode, setLcPeriodMode] = React.useState("all");
  const [lcMonth, setLcMonth] = React.useState(mprMonthKey(todayStr()));
  const [lcYear, setLcYear] = React.useState(currentFiscalYear());
  const [lcFromYear, setLcFromYear] = React.useState(currentFiscalYear());
  const [lcToYear, setLcToYear] = React.useState(currentFiscalYear());
  const lcFiscalYears = React.useMemo(function() { return fiscalYearsFromSamples(samples); }, [samples]);
  const lcMonthOptions = React.useMemo(function() {
    return mprMonthOptions(Number(lcFiscalYears[0].split("-")[0]), mprMonthKey(todayStr()));
  }, [lcFiscalYears]);
  const lcMatcher = buildLifecyclePeriodMatcher(lcPeriodMode, lcMonth, lcYear, lcFromYear, lcToYear);
  const lcStats = React.useMemo(function() {
    return computeSampleLifecycleV2(samples, testRecords, lcMatcher);
  }, [samples, testRecords, lcPeriodMode, lcMonth, lcYear, lcFromYear, lcToYear]);

  // ---- 5 Fiscal Year bar chart ----
  // Reuses computeMonthlyProgressStats() — the exact same aggregation the
  // Monthly Progress Report's fiscal-year "cumulative" column uses — for
  // June of each fiscal year (i.e. the full FY, July through June). This
  // guarantees the two views can never drift apart the way separate
  // hand-rolled tallies used to (different "which samples count" and
  // "how is revenue priced" rules).
  const fyears = lastNFiscalYears(5);
  const fyBarData = fyears.map(function(fy) {
    const fyEndYear = Number(fy.split("-")[0]) + 1;
    const stats = computeMonthlyProgressStats({
      samples: samples,
      references: references,
      testRecords: testRecords,
      testTypes: testTypes,
      parameters: parameters,
      archived: archived,
      selectedMonth: `${fyEndYear}-06`
    });
    return {
      label: fy,
      value: stats.totals.cumulative.samples,
      parameters: stats.totals.cumulative.total,
      revenue: stats.totals.cumulative.revenue > 0 ? stats.totals.cumulative.revenue : null
    };
  });

  // ---- Pie chart: Breakdown by Client Type ----
  const pieMap = {
    "ADP": 0, "Non-ADP": 0, "Calamity": 0, "Monitoring": 0, "VVIP": 0, "Others": 0, "Unspecified": 0
  };
  function countClientType(ct) {
    ct = (ct || "").trim();
    if (ct === "ADP") pieMap.ADP++;
    else if (ct === "Non-ADP") pieMap["Non-ADP"]++;
    else if (ct === "Calamity") pieMap.Calamity++;
    else if (ct === "Monitoring") pieMap.Monitoring++;
    else if (ct === "VVIP") pieMap.VVIP++;
    else if (ct.startsWith("Others")) pieMap.Others++;
    else pieMap.Unspecified++;
  }
  
  function getClientType(sampleObj) {
    if (!sampleObj) return "";
    let ct = "";
    if (sampleObj.referenceId) {
      const ref = (references || []).find(r => r.id === sampleObj.referenceId);
      if (ref && ref.clientType) ct = ref.clientType;
    }
    // Fallback to direct clientType for legacy samples registered before References existed
    if (!ct && sampleObj.clientType) ct = sampleObj.clientType;
    return ct;
  }

  samples.filter(function(s) { return (s.requestedTests || []).some(function(rt) { return rt.status === "released"; }); }).forEach(function(s) {
    countClientType(getClientType(s));
  });
  archived.forEach(function(a) {
    const snaps = (a.archivedSampleSnapshots || [{ id: a.id, referenceId: a.referenceId }]);
    snaps.forEach(function(snap) {
      countClientType(getClientType(snap));
    });
  });
  const pieSlices = [
    { label: "ADP", value: pieMap.ADP, color: "#6366f1" },
    { label: "Non-ADP", value: pieMap["Non-ADP"], color: "#14b8a6" },
    { label: "Calamity", value: pieMap.Calamity, color: "#ef4444" },
    { label: "Monitoring", value: pieMap.Monitoring, color: "#3b82f6" },
    { label: "VVIP", value: pieMap.VVIP, color: "#8b5cf6" },
    { label: "Others", value: pieMap.Others, color: "#f59e0b" },
    { label: "Unspecified", value: pieMap.Unspecified, color: "#94a3b8" }
  ].filter(function(sl) { return sl.value > 0; });

  // ---- Test type bar chart for current FY ----
  const curFY = currentFiscalYear();
  const testTypeCountMap = {};
  samples.forEach(function(s) {
    (s.requestedTests || []).filter(function(rt) {
      if (rt.status !== "released") return false;
      // Same per-parameter test-record date used by MPR/computeSampleLifecycleV2
      // above — not the unreliable rt.updatedAt (never actually written, see
      // computeMonthlyProgressStats() in 17-report-generator.js) or a single
      // whole-sample date.
      const info = getSampleResultForTest(s, rt.testTypeId, testRecords);
      const rd = (info && info.date) || sampleReleaseDate(s);
      return rd && getFiscalYear(rd) === curFY;
    }).forEach(function(rt) {
      const name = rt.testTypeName || rt.testTypeId || "Unknown";
      testTypeCountMap[name] = (testTypeCountMap[name] || 0) + 1;
    });
  });
  archived.filter(function(a) {
    const rd = a.archivedAt || a.updatedAt;
    return rd && getFiscalYear(rd) === curFY;
  }).forEach(function(a) {
    const name = a.testTypeName || "Unknown";
    const cnt = (a.memberSampleIds || [a.id]).length;
    testTypeCountMap[name] = (testTypeCountMap[name] || 0) + cnt;
  });
  const testTypeData = Object.entries(testTypeCountMap)
    .map(function(e) { return { label: e[0], value: e[1] }; })
    .sort(function(a, b) { return b.value - a.value; })
    .slice(0, 8);

  return React.createElement("div", null,

    // ---- Sample Life Cycle Summary ----
    React.createElement(SectionCard, {
      title: "Sample Life Cycle",
      icon: React.createElement(Icon, { name: "clipboard", size: 15, color: C.teal }),
      right: React.createElement("div", { className: "flex items-center gap-2" },
        React.createElement("button", {
          className: "text-xs underline",
          style: { color: C.muted },
          onClick: function() { goTo("archive"); }
        }, archivedCount + " archived batches"),
        React.createElement(Button, { size: "sm", variant: "outline", onClick: function() { goTo("samples"); } },
          "Open Samples ", React.createElement(Icon, { name: "arrowRight", size: 12 }))
      )
    },
      // Period filter — Total Samples/Parameters/Tested/etc below are all
      // computed from this one selection (see computeSampleLifecycleV2()).
      React.createElement("div", { className: "flex flex-wrap items-center gap-2 mb-3 text-xs", style: { color: C.muted } },
        React.createElement("span", null, "Period:"),
        React.createElement("select", {
          className: "border rounded px-2 py-1 text-xs",
          style: { borderColor: C.border },
          value: lcPeriodMode,
          onChange: function(e) { setLcPeriodMode(e.target.value); }
        },
          React.createElement("option", { value: "all" }, "All Time"),
          React.createElement("option", { value: "month" }, "Month"),
          React.createElement("option", { value: "year" }, "Fiscal Year"),
          React.createElement("option", { value: "range" }, "Fiscal Year Range")
        ),
        lcPeriodMode === "month" && React.createElement("select", {
          className: "border rounded px-2 py-1 text-xs",
          style: { borderColor: C.border },
          value: lcMonth,
          onChange: function(e) { setLcMonth(e.target.value); }
        }, lcMonthOptions.map(function(mk) {
          return React.createElement("option", { key: mk, value: mk }, mprMonthLabel(mk));
        })),
        lcPeriodMode === "year" && React.createElement("select", {
          className: "border rounded px-2 py-1 text-xs",
          style: { borderColor: C.border },
          value: lcYear,
          onChange: function(e) { setLcYear(e.target.value); }
        }, lcFiscalYears.map(function(fy) {
          return React.createElement("option", { key: fy, value: fy }, "FY " + fy);
        })),
        lcPeriodMode === "range" && React.createElement(React.Fragment, null,
          React.createElement("span", null, "From"),
          React.createElement("select", {
            className: "border rounded px-2 py-1 text-xs",
            style: { borderColor: C.border },
            value: lcFromYear,
            onChange: function(e) { setLcFromYear(e.target.value); }
          }, lcFiscalYears.map(function(fy) {
            return React.createElement("option", { key: fy, value: fy }, "FY " + fy);
          })),
          React.createElement("span", null, "To"),
          React.createElement("select", {
            className: "border rounded px-2 py-1 text-xs",
            style: { borderColor: C.border },
            value: lcToYear,
            onChange: function(e) { setLcToYear(e.target.value); }
          }, lcFiscalYears.map(function(fy) {
            return React.createElement("option", { key: fy, value: fy }, "FY " + fy);
          }))
        )
      ),
      // Row 1: Totals (3 cards) — card 1 counts SAMPLES, cards 2–3 count
      // PARAMETERS (see computeSampleLifecycleV2 doc comment for why).
      React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3" },
        React.createElement(StatCard, {
          label: "Total Samples Received",
          value: lcStats.totalSamples,
          sub: "every sample received at the lab in this period, any status",
          icon: "beaker",
          onClick: function() { goTo("samples"); }
        }),
        React.createElement(StatCard, {
          label: "Total Parameters Requested",
          value: lcStats.totalParams,
          sub: "each dated by its own test date once tested",
          icon: "clipboard",
          onClick: function() { goTo("samples"); }
        }),
        React.createElement(StatCard, {
          label: "Tested & Released",
          value: lcStats.releasedCnt,
          sub: lcStats.releasedLive + " live · " + lcStats.releasedArchived + " archived",
          icon: "chart",
          tone: "ok",
          onClick: function() { goTo("samples"); }
        })
      ),
      // Row 2: Pipeline breakdown (4 cards, parameter-level). These four
      // always sum back to Total Parameters Requested above — Overdue is a
      // cross-cutting alert over In Testing/Awaiting, not a 5th bucket.
      React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3" },
        React.createElement(StatCard, {
          label: "In Testing",
          value: lcStats.inTesting,
          sub: lcStats.onHoldOnly > 0 ? "incl. " + lcStats.onHoldOnly + " on hold" : "registered · assigned · in progress",
          icon: "beaker",
          onClick: function() { goTo("samples"); }
        }),
        React.createElement(StatCard, {
          label: "Awaiting Review, Approval & Release",
          value: lcStats.awaiting,
          sub: "results entered · under review · approved",
          icon: "chart",
          tone: lcStats.awaiting ? "warn" : "ink",
          onClick: function() { goTo("samples"); }
        }),
        React.createElement(StatCard, {
          label: "Rejected & Cancelled",
          value: lcStats.rejectedCnt + lcStats.cancelledCnt,
          sub: lcStats.rejectedCnt + " rejected · " + lcStats.cancelledCnt + " cancelled",
          icon: "warning",
          onClick: function() { goTo("samples"); }
        }),
        React.createElement(StatCard, {
          label: "Overdue (TAT Breached)",
          value: lcStats.overdueSamples,
          sub: "of samples still in testing/awaiting",
          icon: "warning",
          tone: lcStats.overdueSamples ? "warn" : "ink",
          onClick: function() { goTo("samples"); }
        })
      )
    ),

    // ---- 4 Charts ----
    React.createElement("div", {
      className: "grid gap-5 mb-5",
      style: { gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }
    },
      // Chart 1: 5-year grouped bar — Samples Tested vs Parameters Tested
      React.createElement(SectionCard, {
        title: "Samples vs Parameters Tested — Last 5 Fiscal Years",
        icon: React.createElement(Icon, { name: "chart", size: 15, color: C.teal })
      },
        React.createElement("div", { className: "flex justify-center pt-1 overflow-x-auto" },
          React.createElement(MiniGroupedBarChart, {
            data: fyBarData.map(function(d) { return { label: d.label, samples: d.value, parameters: d.parameters }; }),
            width: 320,
            height: 172,
            seriesA: { key: "samples", label: "Samples Tested", color: C.teal },
            seriesB: { key: "parameters", label: "Parameters Tested", color: "#6366f1" }
          })
        )
      ),

      // Chart 2: 5-year bar (Revenue in Lakh BDT)
      React.createElement(SectionCard, {
        title: "Revenue — Last 5 Fiscal Years (Lakh BDT)",
        icon: React.createElement(Icon, { name: "chart", size: 15, color: "#f59e0b" })
      },
        React.createElement("div", { className: "flex justify-center pt-1 overflow-x-auto" },
          React.createElement(MiniBarChart, { 
            data: fyBarData.map(function(d) {
              var lakhVal = d.revenue ? +(d.revenue / 100000).toFixed(2) : 0;
              return { label: d.label, value: lakhVal };
            }), 
            width: 320, 
            height: 160,
            color: "#f59e0b",
            yLabel: "Revenue (Lakh BDT)",
            valueFormatter: function(v) { return v > 0 ? v.toFixed(2) + " L" : "0"; }
          })
        )
      ),

      // Chart 3: Pie — Client Type
      React.createElement(SectionCard, {
        title: "Sample Breakdown by Programme",
        icon: React.createElement(Icon, { name: "chart", size: 15, color: "#6366f1" })
      },
        React.createElement("div", { className: "flex justify-center py-2" },
          React.createElement(MiniPieChart, { slices: pieSlices, size: 130 })
        )
      ),

      // Chart 4: Test type breakdown for current FY
      React.createElement(SectionCard, {
        title: "Test Type Distribution — FY " + curFY,
        icon: React.createElement(Icon, { name: "chart", size: 15, color: "#6366f1" })
      },
        React.createElement("div", { className: "py-1" },
          React.createElement(MiniHBarChart, { data: testTypeData, color: "#6366f1" })
        )
      )
    ),

    // ---- Welcome header ----
    React.createElement("div", { className: "mb-5" },
      React.createElement("h2", { className: "text-lg font-semibold", style: { color: C.ink } }, t("welcome")),
      React.createElement("p", { className: "text-sm", style: { color: C.muted } }, t("welcomeSub"))
    ),

    // ---- Inventory KPI cards ----
    React.createElement("div", {
      className: "grid gap-3 mb-6",
      style: { gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }
    },
      React.createElement(StatCard, { label: "Chemical Types", value: chemicals.length, sub: activeBatches.length + " active batches", icon: "flask", onClick: function() { goTo("inventory", "chemicals"); } }),
      React.createElement(StatCard, { label: "Expiring Soon (\u226430 days)", value: expiringSoon.length, sub: expired.length ? expired.length + " already expired" : "none expired", tone: expiringSoon.length || expired.length ? "warn" : "ink", icon: "warning", onClick: function() { goTo("inventory", "chemicals"); } }),
      React.createElement(StatCard, { label: "Glassware Items", value: totalGlassItems, sub: totalInUse + " in analysis room \u00b7 " + totalBroken + " broken", icon: "beaker", onClick: function() { goTo("inventory", "glassware"); } }),
      React.createElement(StatCard, { label: "Equipment", value: equipment.length, sub: functionalEquip + " functional \u00b7 " + nonFunctionalEquip + " down", tone: nonFunctionalEquip ? "warn" : "ink", icon: "wrench", onClick: function() { goTo("inventory", "equipment"); } }),
      React.createElement(StatCard, { label: "Gas Cylinders", value: allCylinders.length, sub: emptyCylinders.length + " empty \u00b7 " + lowGasCylinders.length + " running low", tone: emptyCylinders.length || lowGasCylinders.length ? "warn" : "ink", icon: "flask", onClick: function() { goTo("inventory", "gas"); } }),
      React.createElement(StatCard, { label: "Test Records", value: testRecords.length, sub: "total logged tests", icon: "clipboard", onClick: function() { goTo("testRecords"); } }),
      React.createElement(StatCard, { label: "Depleted Batches", value: depleted.length, sub: "need restocking", tone: depleted.length ? "warn" : "ink", icon: "ban", onClick: function() { goTo("inventory", "chemicals"); } }),
      React.createElement(StatCard, { label: "Low Stock (<15%)", value: lowStock.length, sub: "batches running low", tone: lowStock.length ? "warn" : "ink", icon: "warning", onClick: function() { goTo("inventory", "chemicals"); } })
    ),

    // ---- Recent tests + Attention Needed ----
    React.createElement("div", {
      className: "grid gap-5",
      style: { gridTemplateColumns: "1.2fr 1fr" }
    },
      React.createElement(SectionCard, {
        title: "Recent Test Records",
        icon: React.createElement(Icon, { name: "clipboard", size: 16, color: C.teal })
      },
        recentTests.length === 0 && React.createElement("div", { className: "text-sm", style: { color: C.muted } }, "No test records yet."),
        React.createElement("table", { className: "w-full text-xs" },
          React.createElement("tbody", null,
            recentTests.map(function(r) {
              return React.createElement("tr", { key: r.id, style: { borderTop: "1px solid " + C.border } },
                React.createElement("td", { className: "py-1.5" }, r.date),
                React.createElement("td", { className: "py-1.5 font-medium" }, r.testTypeName),
                React.createElement("td", { className: "py-1.5" }, r.tester)
              );
            })
          )
        )
      ),
      React.createElement(SectionCard, {
        title: "Attention Needed",
        icon: React.createElement(Icon, { name: "warning", size: 16, color: C.warn })
      },
        React.createElement("div", { className: "flex flex-col gap-2 text-xs" },
          expired.length === 0 && expiringSoon.length === 0 && depleted.length === 0 && lowStock.length === 0 && nonFunctionalEquip === 0 && totalBroken === 0 && emptyCylinders.length === 0 && lowGasCylinders.length === 0 &&
            React.createElement("div", { style: { color: C.muted } }, "Everything looks in order right now."),
          expired.map(function(b) { return React.createElement("div", { key: b.id, className: "flex items-center gap-1.5", style: { color: C.warn } }, React.createElement(Icon, { name: "warning", size: 12 }), b.chemName + " batch expired (" + b.expiryDate + ")"); }),
          expiringSoon.map(function(b) { return React.createElement("div", { key: b.id, className: "flex items-center gap-1.5", style: { color: C.warn } }, React.createElement(Icon, { name: "warning", size: 12 }), b.chemName + " batch expires in " + daysUntil(b.expiryDate) + " day(s)"); }),
          lowStock.map(function(b) { return React.createElement("div", { key: b.id, className: "flex items-center gap-1.5", style: { color: C.warn } }, React.createElement(Icon, { name: "warning", size: 12 }), b.chemName + " batch low on stock (" + fmtNum(b.remaining) + "/" + fmtNum(b.initialAmount) + " " + b.unit + " left)"); }),
          depleted.slice(0, 5).map(function(b) { return React.createElement("div", { key: b.id, className: "flex items-center gap-1.5", style: { color: C.muted } }, React.createElement(Icon, { name: "ban", size: 12 }), b.chemName + " batch depleted"); }),
          emptyCylinders.map(function(c) { return React.createElement("div", { key: c.id, className: "flex items-center gap-1.5", style: { color: C.warn } }, React.createElement(Icon, { name: "flask", size: 12 }), c.gasName + " cylinder is empty — refill or replace"); }),
          lowGasCylinders.map(function(c) { return React.createElement("div", { key: c.id, className: "flex items-center gap-1.5", style: { color: C.warn } }, React.createElement(Icon, { name: "flask", size: 12 }), c.gasName + " cylinder running low (" + fmtNum(c.remaining) + "/" + fmtNum(c.capacity) + " " + c.unit + ")"); }),
          equipment.filter(function(e) { return !e.functional; }).map(function(e) { return React.createElement("div", { key: e.id, className: "flex items-center gap-1.5", style: { color: C.warn } }, React.createElement(Icon, { name: "wrench", size: 12 }), e.name + " is not functional"); }),
          totalBroken > 0 && React.createElement("div", { className: "flex items-center gap-1.5", style: { color: C.warn } }, React.createElement(Icon, { name: "beaker", size: 12 }), totalBroken + " glassware item(s) marked broken")
        )
      )
    )
  );
}

// ============================================================================
// INVENTORY TAB
// ============================================================================

// ---- Sample Lifecycle KPI strip ----
function SampleKpiStrip({
  samples,
  goTo
}) {
  const stats = sampleLifecycleStats(samples);
  return React.createElement(SectionCard, {
    title: "Sample Lifecycle",
    icon: React.createElement(Icon, { name: "clipboard", size: 15, color: C.teal }),
    right: React.createElement(Button, { size: "sm", variant: "outline", onClick: function() { goTo("samples"); } },
      "Open Samples ", React.createElement(Icon, { name: "arrowRight", size: 12 }))
  },
    React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3" },
      React.createElement(StatCard, { label: "Active Samples", value: stats.activeCount, icon: "beaker", onClick: function() { goTo("samples"); } }),
      React.createElement(StatCard, { label: "Pending Review", value: stats.pendingApproval, icon: "chart", tone: stats.pendingApproval ? "warn" : "ink", onClick: function() { goTo("samples"); } }),
      React.createElement(StatCard, { label: "Awaiting Release", value: stats.awaitingRelease, icon: "printer", onClick: function() { goTo("samples"); } }),
      React.createElement(StatCard, { label: "Overdue (TAT)", value: stats.overdue, icon: "warning", tone: stats.overdue ? "warn" : "ink", onClick: function() { goTo("samples"); } })
    )
  );
}
