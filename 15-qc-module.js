// ===== 15-qc-module.js =====
// ============================================================================
// QC MODULE — Levey-Jennings control charts + a Westgard multirule subset,
// built on top of the qcCheck data already captured on test records
// (see 13-testrecords-ui.js) and the QC acceptance rules defined per method
// (see 12-testtypes-ui.js / QcRuleEditor). This file is self-contained:
// stats + rule-evaluation logic first, then the QC Module tab UI.
// ============================================================================

// ---- basic stats ---------------------------------------------------------
function sampleMeanSD(values) {
  const nums = (values || []).filter(v => typeof v === "number" && !Number.isNaN(v));
  const n = nums.length;
  if (n === 0) return {
    mean: 0,
    sd: 0,
    n: 0
  };
  const mean = sum(nums) / n;
  if (n < 2) return {
    mean,
    sd: 0,
    n
  };
  const variance = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
  return {
    mean,
    sd: Math.sqrt(variance),
    n
  };
}

// Resolve the mean/SD to plot & evaluate against: a lab-set target on the
// rule wins if both fields are present, otherwise fall back to the mean/SD
// of the QC points themselves (rolling — recalculated as new points arrive).
function resolveQcTarget(rule, points) {
  const hasManual = rule && rule.targetMean != null && rule.targetSD != null && rule.targetSD > 0;
  if (hasManual) {
    return {
      mean: Number(rule.targetMean),
      sd: Number(rule.targetSD),
      source: "manual",
      n: points.length
    };
  }
  const stats = sampleMeanSD(points.map(p => p.value));
  return {
    mean: stats.mean,
    sd: stats.sd,
    source: "rolling",
    n: stats.n
  };
}

// ---- Westgard multirule subset --------------------------------------------
// Points are expected sorted oldest -> newest: [{ value, date, recordId }, ...]
// Returns violations: [{ index, date, rule, severity, message }]
const WESTGARD_RULES = {
  R1_3S: {
    code: "1-3s",
    label: "Single point beyond 3SD",
    severity: "reject"
  },
  R2_2S: {
    code: "2-2s",
    label: "Two consecutive points beyond 2SD (same side)",
    severity: "reject"
  },
  R_4S: {
    code: "R-4s",
    label: "Range between consecutive points exceeds 4SD",
    severity: "reject"
  },
  R4_1S: {
    code: "4-1s",
    label: "Four consecutive points beyond 1SD (same side)",
    severity: "warning"
  },
  R10X: {
    code: "10x",
    label: "Ten consecutive points on the same side of the mean",
    severity: "warning"
  }
};
function evaluateWestgard(points, mean, sd) {
  const violations = [];
  if (!points.length || !sd || sd <= 0) return violations;
  const z = points.map(p => (p.value - mean) / sd);
  const flag = (i, rule, message) => violations.push({
    index: i,
    date: points[i].date,
    recordId: points[i].recordId,
    rule: rule.code,
    ruleLabel: rule.label,
    severity: rule.severity,
    message
  });

  // 1-3s — any single point beyond ±3SD
  z.forEach((zi, i) => {
    if (Math.abs(zi) > 3) flag(i, WESTGARD_RULES.R1_3S, `Value is ${zi.toFixed(2)}SD from the mean.`);
  });

  // 2-2s — two consecutive points both beyond +2SD or both beyond -2SD
  for (let i = 1; i < z.length; i++) {
    if (z[i] > 2 && z[i - 1] > 2 || z[i] < -2 && z[i - 1] < -2) {
      flag(i, WESTGARD_RULES.R2_2S, "Two consecutive points beyond 2SD on the same side.");
    }
  }

  // R-4s — the range between two consecutive points exceeds 4SD
  // (classically one point >+2SD and the very next <-2SD, or vice versa;
  // we use the simpler general form: |zi - z(i-1)| > 4)
  for (let i = 1; i < z.length; i++) {
    if (Math.abs(z[i] - z[i - 1]) > 4) {
      flag(i, WESTGARD_RULES.R_4S, `Range between consecutive points is ${Math.abs(z[i] - z[i - 1]).toFixed(2)}SD.`);
    }
  }

  // 4-1s — four consecutive points all beyond +1SD or all beyond -1SD
  for (let i = 3; i < z.length; i++) {
    const win = z.slice(i - 3, i + 1);
    if (win.every(v => v > 1) || win.every(v => v < -1)) {
      flag(i, WESTGARD_RULES.R4_1S, "Four consecutive points beyond 1SD on the same side.");
    }
  }

  // 10x — ten consecutive points on the same side of the mean
  for (let i = 9; i < z.length; i++) {
    const win = z.slice(i - 9, i + 1);
    if (win.every(v => v > 0) || win.every(v => v < 0)) {
      flag(i, WESTGARD_RULES.R10X, "Ten consecutive points on the same side of the mean.");
    }
  }
  return violations;
}

// ---- grouping QC data by method + QC type ---------------------------------
// One "group" = one method (testType) x one qcType (blank/duplicate/spike/...)
// combination that has at least one QC-flagged test record.
function collectQcGroups(testTypes, testRecords) {
  const byKey = new Map();
  function ensureGroup(r, ruleIdOverride) {
    const key = `${r.testTypeId}::${r.qcCheck.qcType}::${ruleIdOverride ?? r.qcCheck.ruleId ?? ""}`;
    if (!byKey.has(key)) {
      const testType = (testTypes || []).find(t => t.id === r.testTypeId) || null;
      const rule = testType?.qcRules?.find(q => q.id === (ruleIdOverride ?? r.qcCheck.ruleId)) || testType?.qcRules?.find(q => q.qcType === r.qcCheck.qcType) || null;
      byKey.set(key, {
        key,
        testTypeId: r.testTypeId,
        testTypeName: r.testTypeName || testType?.name || "Unknown Method",
        qcType: r.qcCheck.qcType,
        qcTypeLabel: QC_RULE_TYPES.find(q => q.value === r.qcCheck.qcType)?.label || r.qcCheck.qcType,
        ruleLabel: r.qcCheck.label || "",
        rule,
        unit: rule?.unit || "",
        points: []
      });
    }
    return byKey.get(key);
  }
  (testRecords || []).forEach(r => {
    if (!r.qcCheck) return;
    if (r.qcCheck.qcType === "bracketing") {
      // Bracketing/interspersed QC: every checkpoint in the run is its own
      // control-chart point (that's the whole idea — several checks spread
      // across one run, each plotted and Westgard-evaluated on the series).
      (r.qcCheck.points || []).forEach((p, i) => {
        if (p.value == null || Number.isNaN(Number(p.value))) return;
        const g = ensureGroup(r, r.qcCheck.ruleId);
        g.points.push({
          value: Number(p.value),
          date: r.date,
          recordId: r.id,
          pass: p.pass,
          tester: r.tester,
          checkpointLabel: p.label
        });
      });
      return;
    }
    if (r.qcCheck.value == null || Number.isNaN(Number(r.qcCheck.value))) return;
    const g = ensureGroup(r);
    g.points.push({
      value: Number(r.qcCheck.value),
      date: r.date,
      recordId: r.id,
      pass: r.qcCheck.pass,
      tester: r.tester
    });
  });
  return Array.from(byKey.values()).map(g => {
    g.points.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    return g;
  });
}

// Attaches target mean/SD + Westgard violations + an overall status to a group.
function evaluateQcGroup(group) {
  const target = resolveQcTarget(group.rule, group.points);
  const violations = evaluateWestgard(group.points, target.mean, target.sd);
  const hasReject = violations.some(v => v.severity === "reject");
  const hasWarning = violations.some(v => v.severity === "warning");
  const status = hasReject ? "reject" : hasWarning ? "warning" : "ok";
  return {
    ...group,
    target,
    violations,
    status
  };
}

// Public helper used by the Sample review/approval flow (see SampleDetail
// in 21-sample-ui.js) to check whether a method has an unresolved QC issue.
function getQcStatusForMethod(testTypeId, testTypes, testRecords) {
  const groups = collectQcGroups(testTypes, testRecords).filter(g => g.testTypeId === testTypeId).map(evaluateQcGroup);
  const hasReject = groups.some(g => g.status === "reject");
  const hasWarning = groups.some(g => g.status === "warning");
  return {
    hasReject,
    hasWarning,
    groups
  };
}

// ---- UI: status badge ------------------------------------------------------
function QcStatusBadge({
  status
}) {
  if (status === "reject") return /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ban",
    size: 11
  }), " Violation");
  if (status === "warning") return /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 11
  }), " Warning");
  return /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 11
  }), " In Control");
}

// ---- UI: Levey-Jennings control chart --------------------------------------
function QcControlChart({
  group
}) {
  const {
    points,
    target,
    violations
  } = group;
  const labels = points.map(p => p.date);
  const violByIndex = new Map(violations.map(v => [v.index, v]));
  const flatLine = v => labels.map(() => v);
  const chartRef = React.useRef(null);
  const data = {
    labels,
    datasets: [{
      label: `${group.qcTypeLabel} value${group.unit ? ` (${group.unit})` : ""}`,
      data: points.map(p => p.value),
      borderColor: C.teal,
      backgroundColor: points.map((p, i) => violByIndex.has(i) ? violByIndex.get(i).severity === "reject" ? C.warn : C.info : C.teal),
      pointRadius: points.map((p, i) => violByIndex.has(i) ? 6 : 3),
      pointBackgroundColor: points.map((p, i) => violByIndex.has(i) ? violByIndex.get(i).severity === "reject" ? C.warn : C.info : C.teal),
      tension: 0.15,
      order: 1
    }, {
      label: "Mean",
      data: flatLine(target.mean),
      borderColor: C.ink,
      borderDash: [4, 3],
      pointRadius: 0,
      borderWidth: 1.25,
      order: 2
    }, {
      label: "+2SD",
      data: flatLine(target.mean + 2 * target.sd),
      borderColor: C.warn,
      borderDash: [2, 3],
      pointRadius: 0,
      borderWidth: 1,
      order: 3
    }, {
      label: "-2SD",
      data: flatLine(target.mean - 2 * target.sd),
      borderColor: C.warn,
      borderDash: [2, 3],
      pointRadius: 0,
      borderWidth: 1,
      order: 3
    }, {
      label: "+3SD",
      data: flatLine(target.mean + 3 * target.sd),
      borderColor: C.muted,
      borderDash: [1, 3],
      pointRadius: 0,
      borderWidth: 1,
      order: 4
    }, {
      label: "-3SD",
      data: flatLine(target.mean - 3 * target.sd),
      borderColor: C.muted,
      borderDash: [1, 3],
      pointRadius: 0,
      borderWidth: 1,
      order: 4
    }]
  };
  const options = {
    plugins: {
      tooltip: {
        callbacks: {
          afterBody: items => {
            const i = items[0]?.dataIndex;
            const v = violByIndex.get(i);
            return v ? [`⚠ ${v.ruleLabel}`] : [];
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          color: C.muted,
          font: {
            size: 10
          }
        },
        grid: {
          color: C.border
        }
      },
      x: {
        ticks: {
          color: C.muted,
          font: {
            size: 9
          },
          maxRotation: 45,
          minRotation: 0
        },
        grid: {
          display: false
        }
      }
    }
  };
  return /*#__PURE__*/React.createElement(ChartCard, {
    title: `${group.testTypeName} — ${group.qcTypeLabel}${group.ruleLabel ? ` (${group.ruleLabel})` : ""}`,
    subtitle: `${target.source === "manual" ? "Lab target" : "Auto-calculated"} mean ${fmtNum(target.mean)}${group.unit ? ` ${group.unit}` : ""}, SD ${fmtNum(target.sd)} · n=${points.length}`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 15
    }),
    chartRef: chartRef,
    exportRows: points.map((p, i) => ({
      date: p.date,
      value: p.value,
      tester: p.tester,
      violation: violByIndex.has(i) ? violByIndex.get(i).ruleLabel : ""
    })),
    filename: `${group.testTypeName}-${group.qcType}-QC`
  }, points.length < 2 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-3 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Need at least 2 QC points to draw a control chart. Currently ", points.length, ".") : /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    data: data,
    options: options,
    height: 300,
    chartRef: chartRef
  }), violations.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 space-y-1"
  }, violations.slice().reverse().map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "text-xs p-2 rounded flex items-center gap-2",
    style: {
      background: v.severity === "reject" ? C.warnBg : C.infoBg,
      color: v.severity === "reject" ? C.warn : C.info
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: v.severity === "reject" ? "ban" : "warning",
    size: 12
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-semibold"
  }, v.rule), " — ", v.ruleLabel, /*#__PURE__*/React.createElement("span", {
    className: "ml-auto",
    style: {
      color: C.muted
    }
  }, v.date)))));
}

// ---- UI: QC Module tab ------------------------------------------------------
function QcModuleTab({
  testTypes,
  testRecords
}) {
  const groups = React.useMemo(() => collectQcGroups(testTypes, testRecords).map(evaluateQcGroup).sort((a, b) => a.testTypeName.localeCompare(b.testTypeName) || a.qcTypeLabel.localeCompare(b.qcTypeLabel)), [testTypes, testRecords]);
  const methodOptions = React.useMemo(() => Array.from(new Map(groups.map(g => [g.testTypeId, g.testTypeName])).entries()).map(([value, label]) => ({
    value,
    label
  })), [groups]);
  const [methodFilter, setMethodFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const visibleGroups = groups.filter(g => (!methodFilter || g.testTypeId === methodFilter) && (!typeFilter || g.qcType === typeFilter));
  const typeOptionsForMethod = React.useMemo(() => {
    const scoped = methodFilter ? groups.filter(g => g.testTypeId === methodFilter) : groups;
    return Array.from(new Map(scoped.map(g => [g.qcType, g.qcTypeLabel])).entries()).map(([value, label]) => ({
      value,
      label
    }));
  }, [groups, methodFilter]);
  const [selectedKey, setSelectedKey] = React.useState(null);
  const selected = groups.find(g => g.key === selectedKey) || visibleGroups[0] || null;
  if (groups.length === 0) {
    return /*#__PURE__*/React.createElement(SectionCard, {
      title: "QC Module",
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "chart",
        size: 16
      })
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-xs p-3 rounded",
      style: {
        background: C.infoBg,
        color: C.info
      }
    }, "No QC data yet. Mark a test record as a QC sample (blank, duplicate, spike, or calibration check) in Add Test Record to start building control charts here."));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionCard, {
    title: "QC Module — Levey-Jennings Control Charts",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16
    }),
    right: /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2"
    }, /*#__PURE__*/React.createElement(SelectField, {
      simple: true,
      value: methodFilter,
      onChange: v => {
        setMethodFilter(v);
        setTypeFilter("");
        setSelectedKey(null);
      },
      options: methodOptions,
      placeholder: "All Methods"
    }), /*#__PURE__*/React.createElement(SelectField, {
      simple: true,
      value: typeFilter,
      onChange: v => {
        setTypeFilter(v);
        setSelectedKey(null);
      },
      options: typeOptionsForMethod,
      placeholder: "All QC Types"
    }))
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-1.5"
  }, visibleGroups.map(g => /*#__PURE__*/React.createElement("button", {
    key: g.key,
    onClick: () => setSelectedKey(g.key),
    className: "flex items-center justify-between gap-2 px-3 py-2 rounded text-left",
    style: {
      background: selected?.key === g.key ? `${C.teal}14` : C.bg,
      border: `1px solid ${selected?.key === g.key ? C.teal : C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold truncate",
    style: {
      color: C.ink
    }
  }, g.testTypeName, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.muted,
      fontWeight: 400
    }
  }, " · ", g.qcTypeLabel)), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px]",
    style: {
      color: C.muted
    }
  }, g.points.length, " points · last ", g.points[g.points.length - 1]?.date)), /*#__PURE__*/React.createElement(QcStatusBadge, {
    status: g.status
  })))), visibleGroups.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2",
    style: {
      color: C.muted
    }
  }, "No QC series match this filter.")), selected && /*#__PURE__*/React.createElement(QcControlChart, {
    group: selected
  }));
}
