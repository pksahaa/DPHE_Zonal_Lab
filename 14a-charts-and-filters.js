// ===== 14a-charts-and-filters.js (split from 14-reports-ui.js) =====
// ===== 14-reports-ui.js =====
// ============================================================================
// REPORTS & ANALYTICS — BI helpers, chart primitives, DataTable/FilterPanel,
// and every analytics page (Executive, Insights, Technician, Revenue,
// Chemical/Inventory/Glassware/Gas/Equipment analytics, Trends, Forecast).
// ============================================================================
// ---------------- BI date helpers ----------------
function quarterKey(dateStr) {
  if (!dateStr) return "";
  const [y, m] = dateStr.split("-");
  const q = Math.ceil(Number(m) / 3);
  return `${y}-Q${q}`;
}
function isoWeekKey(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function dowIndex(dateStr) {
  return new Date(dateStr + "T00:00:00").getDay();
}
const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function yearOf(dateStr) {
  return (dateStr || "").slice(0, 4);
}
function daysBetweenD(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}
function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function shiftMonthKey(mk, delta) {
  if (!mk) return mk;
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------- Small stats helpers ----------------
function sum(arr) {
  return arr.reduce((s, v) => s + (Number(v) || 0), 0);
}
function avg(arr) {
  return arr.length ? sum(arr) / arr.length : 0;
}
function pctGrowth(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0;
  return (curr - prev) / prev * 100;
}
function fmtPct(n) {
  if (!isFinite(n)) return "—";
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}
function fmtMoney(n) {
  return `৳${fmtNum(n || 0)}`;
}
function groupSum(arr, keyFn, valFn) {
  const m = {};
  arr.forEach(x => {
    const k = keyFn(x);
    if (!k) return;
    m[k] = (m[k] || 0) + (valFn ? valFn(x) : 1);
  });
  return m;
}
function topEntries(map, n = 10) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
}
function bottomEntries(map, n = 10) {
  return Object.entries(map).sort((a, b) => a[1] - b[1]).slice(0, n);
}
function movingAverage(series, window = 3) {
  return series.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = series.slice(start, i + 1);
    return avg(slice);
  });
}
// Simple least-squares linear regression over index-based x values.
function linreg(values) {
  const n = values.length;
  if (n < 2) return {
    slope: 0,
    intercept: values[0] || 0
  };
  const xs = values.map((_, i) => i);
  const mx = avg(xs),
    my = avg(values);
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (values[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return {
    slope,
    intercept
  };
}
function forecastNext(values, periods = 3) {
  const {
    slope,
    intercept
  } = linreg(values);
  const out = [];
  for (let i = 0; i < periods; i++) {
    const x = values.length + i;
    out.push(Math.max(0, +(slope * x + intercept).toFixed(2)));
  }
  return out;
}

// ---------------- Chart palette (extends app teal identity with a categorical BI set) ----------------
const CHART_PALETTE = ["#028090", "#02C39A", "#F5A623", "#7C5CFC", "#EF476F", "#118AB2", "#FFB703", "#06A77D", "#8338EC", "#FB5607", "#4CC9F0", "#E63946"];
function paletteColor(i) {
  return CHART_PALETTE[i % CHART_PALETTE.length];
}
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16),
    g = parseInt(h.substring(2, 4), 16),
    b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------- Equipment maintenance metrics ----------------
// MTBF (Mean Time Between Failures, days), MTTR (Mean Time To Repair, days), downtime days, repair cost.
function equipmentMaintenanceStats(eq) {
  const hist = [...(eq.history || [])].sort((a, b) => a.date < b.date ? -1 : 1);
  const breakdowns = hist.filter(h => h.type === "breakdown");
  let totalDowntime = 0,
    repairDurations = [];
  breakdowns.forEach(bd => {
    const nextRepair = hist.find(h => h.date >= bd.date && (h.type === "repair" || h.type === "other") && h.functionalAfter);
    if (nextRepair) {
      const d = Math.max(0, daysBetweenD(bd.date, nextRepair.date));
      totalDowntime += d;
      repairDurations.push(d);
    }
  });
  const repairCost = hist.reduce((s, h) => s + (h.type === "repair" || h.type === "other" ? Number(h.cost) || 0 : 0), 0);
  const firstDate = eq.dateReceived || hist[0] && hist[0].date || todayStr();
  const operatingDays = Math.max(1, daysBetweenD(firstDate, todayStr()));
  const mtbf = breakdowns.length > 0 ? +(operatingDays / breakdowns.length).toFixed(1) : operatingDays;
  const mttr = repairDurations.length > 0 ? +avg(repairDurations).toFixed(1) : 0;
  const uptimePct = Math.max(0, Math.min(100, 100 - totalDowntime / operatingDays * 100));
  return {
    breakdownCount: breakdowns.length,
    repairCount: hist.filter(h => h.type === "repair").length,
    mtbf,
    mttr,
    downtime: totalDowntime,
    repairCost,
    uptimePct: +uptimePct.toFixed(1),
    operatingDays
  };
}
// ---------------- Sparkline ----------------
function Sparkline({
  data,
  color,
  width = 96,
  height = 28
}) {
  if (!data || data.length < 2) return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height
    }
  });
  const max = Math.max(...data, 0.0001),
    min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - (v - min) / range * height).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  const lastY = (height - (last - min) / range * height).toFixed(1);
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    viewBox: `0 0 ${width} ${height}`
  }, /*#__PURE__*/React.createElement("polyline", {
    points: pts,
    fill: "none",
    stroke: color || C.teal,
    strokeWidth: "1.75",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: width,
    cy: lastY,
    r: "2.5",
    fill: color || C.teal
  }));
}

// ---------------- Radial Gauge (0-100%) ----------------
function Gauge({
  value,
  label,
  color,
  size = 96,
  sublabel
}) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const cx = size / 2,
    cy = size / 2;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center justify-center",
    style: {
      width: size
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: r,
    fill: "none",
    stroke: C.border,
    strokeWidth: "9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: r,
    fill: "none",
    stroke: color || C.teal,
    strokeWidth: "9",
    strokeLinecap: "round",
    strokeDasharray: circ,
    strokeDashoffset: offset,
    transform: `rotate(-90 ${cx} ${cy})`,
    style: {
      transition: "stroke-dashoffset .6s ease"
    }
  }), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy - 2,
    textAnchor: "middle",
    fontSize: "17",
    fontWeight: "700",
    fill: C.ink
  }, pct.toFixed(0), "%"), sublabel && /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy + 14,
    textAnchor: "middle",
    fontSize: "8.5",
    fill: C.muted
  }, sublabel)), label && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-center mt-1",
    style: {
      color: C.muted
    }
  }, label));
}

// ---------------- Calendar Heatmap (GitHub-style, last N days) ----------------
function CalendarHeatmap({
  valueByDate,
  days = 119,
  colorBase
}) {
  const end = new Date();
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({
      key,
      dow: d.getDay(),
      value: valueByDate[key] || 0
    });
  }
  const max = Math.max(1, ...cells.map(c => c.value));
  // pad to start on Sunday for clean week columns
  const lead = cells.length ? cells[0].dow : 0;
  const padded = Array(lead).fill(null).concat(cells);
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  const base = colorBase || C.teal;
  const cellColor = v => {
    if (!v) return C.border;
    const intensity = Math.min(1, v / max);
    return hexToRgba(base, 0.18 + intensity * 0.82);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-[3px] overflow-x-auto pb-1"
  }, weeks.map((week, wi) => /*#__PURE__*/React.createElement("div", {
    key: wi,
    className: "flex flex-col gap-[3px]"
  }, week.map((c, di) => /*#__PURE__*/React.createElement("div", {
    key: di,
    title: c ? `${c.key}: ${c.value}` : "",
    style: {
      width: 11,
      height: 11,
      borderRadius: 2,
      background: c ? cellColor(c.value) : "transparent"
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1.5 text-[10px]",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "Less"), [0.15, 0.35, 0.55, 0.75, 1].map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 10,
      height: 10,
      borderRadius: 2,
      background: hexToRgba(base, a)
    }
  })), /*#__PURE__*/React.createElement("span", null, "More")));
}

// ---------------- Treemap (slice-and-dice) ----------------
function sliceDice(items, x, y, w, h, horizontal) {
  const total = sum(items.map(i => i.value)) || 1;
  let pos = 0;
  const out = [];
  items.forEach(item => {
    const frac = item.value / total;
    if (horizontal) {
      const iw = w * frac;
      out.push({
        ...item,
        x: x + pos,
        y,
        w: iw,
        h
      });
      pos += iw;
    } else {
      const ih = h * frac;
      out.push({
        ...item,
        x,
        y: y + pos,
        w,
        h: ih
      });
      pos += ih;
    }
  });
  return out;
}
function Treemap({
  items,
  width = 640,
  height = 260
}) {
  const sorted = [...items].filter(i => i.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length === 0) return /*#__PURE__*/React.createElement("div", {
    className: "text-xs py-6 text-center",
    style: {
      color: C.muted
    }
  }, "No data to display.");
  // split into two rows for a richer layout when many items
  const half = Math.max(1, Math.ceil(sorted.length / 2));
  const rowA = sorted.slice(0, half),
    rowB = sorted.slice(half);
  const totalA = sum(rowA.map(i => i.value)),
    totalB = sum(rowB.map(i => i.value));
  const totalAll = totalA + totalB || 1;
  const rowAHeight = height * (totalA / totalAll);
  const rowBHeight = height - rowAHeight;
  const blocksA = sliceDice(rowA, 0, 0, width, rowAHeight, true);
  const blocksB = rowB.length ? sliceDice(rowB, 0, rowAHeight, width, rowBHeight, true) : [];
  const blocks = [...blocksA, ...blocksB];
  return /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    viewBox: `0 0 ${width} ${height}`,
    style: {
      display: "block"
    }
  }, blocks.map((b, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("rect", {
    x: b.x + 1,
    y: b.y + 1,
    width: Math.max(0, b.w - 2),
    height: Math.max(0, b.h - 2),
    fill: b.color || paletteColor(i),
    rx: "4",
    opacity: "0.92"
  }, /*#__PURE__*/React.createElement("title", null, `${b.label}: ${fmtNum(b.value)}${b.unit || ""}`)), b.w > 60 && b.h > 26 && /*#__PURE__*/React.createElement("text", {
    x: b.x + 8,
    y: b.y + 18,
    fontSize: "11",
    fontWeight: "600",
    fill: "#fff"
  }, b.label.length > b.w / 7 ? b.label.slice(0, Math.floor(b.w / 7)) + "…" : b.label), b.w > 60 && b.h > 40 && /*#__PURE__*/React.createElement("text", {
    x: b.x + 8,
    y: b.y + 33,
    fontSize: "10",
    fill: "rgba(255,255,255,0.9)"
  }, fmtNum(b.value), b.unit || ""))));
}

// ---------------- KPI Card ----------------
function KpiCard({
  icon,
  label,
  value,
  delta,
  deltaGoodDirection = "up",
  spark,
  sparkColor,
  tone
}) {
  const hasDelta = delta !== undefined && delta !== null && isFinite(delta);
  const good = deltaGoodDirection === "up" ? delta >= 0 : delta <= 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-3.5 flex flex-col gap-2",
    style: {
      background: C.card,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1.5 text-[11px] font-medium",
    style: {
      color: C.muted
    }
  }, icon, label), hasDelta && /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5",
    style: {
      color: good ? C.ok : C.warn,
      background: good ? C.okBg : C.warnBg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: delta >= 0 ? "arrowRight" : "arrowLeft",
    size: 9
  }), fmtPct(delta))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-end justify-between gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xl font-bold",
    style: {
      color: tone || C.ink
    }
  }, value), spark && /*#__PURE__*/React.createElement(Sparkline, {
    data: spark,
    color: sparkColor
  })));
}

// ---------------- Smart Insight Card ----------------
function InsightCard({
  tone = "info",
  title,
  text,
  icon
}) {
  const tones = {
    info: {
      bg: C.infoBg,
      fg: C.info
    },
    warn: {
      bg: C.warnBg,
      fg: C.warn
    },
    ok: {
      bg: C.okBg,
      fg: C.ok
    }
  };
  const s = tones[tone] || tones.info;
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg p-3 flex items-start gap-2.5",
    style: {
      background: s.bg,
      border: `1px solid ${s.fg}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mt-0.5",
    style: {
      color: s.fg
    }
  }, icon || /*#__PURE__*/React.createElement(Icon, {
    name: "chart",
    size: 15
  })), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold",
    style: {
      color: s.fg
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mt-0.5",
    style: {
      color: C.ink
    }
  }, text)));
}

// ---------------- Progress bar ----------------
function ProgressBar({
  pct,
  color,
  height = 7
}) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      background: C.border,
      borderRadius: height
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${p}%`,
      height,
      background: color || C.teal,
      borderRadius: height,
      transition: "width .5s ease"
    }
  }));
}
// ---------------- Chart.js canvas wrapper (supports bar/line/pie/doughnut/scatter/bubble/radar) ----------------
let __zoomPluginRegistered = false;
function ensureZoomPlugin() {
  if (__zoomPluginRegistered) return;
  try {
    const plugin = window.ChartZoom || window["chartjs-plugin-zoom"] || null;
    if (typeof Chart !== "undefined" && plugin) {
      Chart.register(plugin);
    }
  } catch (e) {/* zoom plugin optional — charts still work without it */}
  __zoomPluginRegistered = true;
}
const ZOOMABLE_TYPES = ["line", "bar", "scatter", "bubble"];
function ChartCanvas({
  type,
  data,
  options,
  height = 260,
  chartRef,
  onReady
}) {
  const canvasRef = React.useRef(null);
  const localRef = React.useRef(null);
  const clickHandlerRef = React.useRef(options && options.onClick);
  clickHandlerRef.current = options && options.onClick;
  React.useEffect(() => {
    if (!canvasRef.current || typeof Chart === "undefined") return;
    ensureZoomPlugin();
    const ctx = canvasRef.current.getContext("2d");
    const zoomConfig = ZOOMABLE_TYPES.includes(type) ? {
      zoom: {
        wheel: {
          enabled: true
        },
        pinch: {
          enabled: true
        },
        mode: options && options.indexAxis === "y" ? "y" : "x"
      },
      pan: {
        enabled: true,
        mode: options && options.indexAxis === "y" ? "y" : "x"
      }
    } : undefined;
    const mergedOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 550,
        easing: "easeOutQuart"
      },
      plugins: {
        legend: {
          labels: {
            color: C.muted,
            boxWidth: 11,
            font: {
              size: 10.5
            }
          },
          ...(options && options.plugins && options.plugins.legend)
        },
        tooltip: {
          backgroundColor: C.ink,
          titleColor: "#fff",
          bodyColor: "#fff",
          padding: 8,
          cornerRadius: 6,
          ...(options && options.plugins && options.plugins.tooltip)
        },
        ...(zoomConfig ? {
          zoom: zoomConfig
        } : {}),
        ...(options && options.plugins)
      },
      scales: options && options.scales,
      onClick: (evt, elements) => {
        if (clickHandlerRef.current) clickHandlerRef.current(evt, elements);
      },
      ...Object.fromEntries(Object.entries(options || {}).filter(([k]) => !["plugins", "scales", "onClick"].includes(k)))
    };
    const chart = new Chart(ctx, {
      type,
      data,
      options: mergedOptions
    });
    localRef.current = chart;
    if (chartRef) chartRef.current = chart;
    if (onReady) onReady(chart);
    return () => chart.destroy();
    // eslint-disable-next-line
  }, [JSON.stringify(data), type, height]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      position: "relative"
    },
    title: ZOOMABLE_TYPES.includes(type) ? "Scroll/pinch to zoom, drag to pan, double-click to reset" : undefined,
    onDoubleClick: () => {
      if (localRef.current && localRef.current.resetZoom) localRef.current.resetZoom();
    }
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef
  }));
}

// ---------------- ChartCard: title/subtitle + toolbar (export PNG / export Excel / print / fullscreen) ----------------
function ChartCard({
  title,
  subtitle,
  icon,
  children,
  chartRef,
  exportRows,
  filename,
  right,
  footer
}) {
  const [fullscreen, setFullscreen] = React.useState(false);
  function exportPNG() {
    if (!chartRef || !chartRef.current) return;
    const url = chartRef.current.toBase64Image("image/png", 1);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename || title || "chart"}.png`;
    a.click();
  }
  function exportExcel() {
    if (!exportRows || exportRows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename || title || "data"}.xlsx`);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: fullscreen ? "fixed inset-0 z-50 overflow-y-auto p-5" : "rounded-lg mb-5",
    style: {
      background: fullscreen ? C.bg : C.card,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3 flex-wrap gap-2 no-print",
    style: {
      borderBottom: `1px solid ${C.border}`,
      background: C.card,
      position: fullscreen ? "sticky" : "static",
      top: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 min-w-0"
  }, icon, /*#__PURE__*/React.createElement("div", {
    className: "min-w-0"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-sm truncate",
    style: {
      color: C.ink
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] truncate",
    style: {
      color: C.muted
    }
  }, subtitle))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-0.5 shrink-0"
  }, right, chartRef && /*#__PURE__*/React.createElement(IconButton, {
    name: "download",
    title: "Export PNG",
    onClick: exportPNG
  }), exportRows && /*#__PURE__*/React.createElement(IconButton, {
    name: "table",
    title: "Export Excel",
    onClick: exportExcel
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "printer",
    title: "Print",
    onClick: () => window.print()
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: fullscreen ? "minimize" : "maximize",
    title: fullscreen ? "Exit fullscreen" : "Fullscreen",
    onClick: () => setFullscreen(f => !f)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-4"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "px-4 pb-4"
  }, footer));
}

// ---------------- Generic sortable / searchable / exportable / paginated DataTable ----------------
function DataTable({
  columns,
  rows,
  exportFilename,
  pageSize = 8,
  dense,
  rightExtra,
  defaultSortKey,
  title
}) {
  const [sortKey, setSortKey] = React.useState(defaultSortKey || null);
  const [sortDir, setSortDir] = React.useState("desc");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(0);
  const filtered = React.useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter(r => columns.some(c => String(r[c.key] ?? "").toLowerCase().includes(needle)));
  }, [rows, q, columns]);
  const sorted = React.useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey],
        bv = b[sortKey];
      const an = Number(av),
        bn = Number(bv);
      let cmp;
      if (!isNaN(an) && !isNaN(bn) && av !== "" && bv !== "") cmp = an - bn;else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);
  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");else {
      setSortKey(key);
      setSortDir("desc");
    }
  }
  function exportExcel() {
    const exportData = sorted.map(r => Object.fromEntries(columns.map(c => [c.label, r[c.key]])));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${exportFilename || "report"}.xlsx`);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 mb-2.5 flex-wrap no-print"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, title && /*#__PURE__*/React.createElement("h4", {
    className: "text-xs font-semibold",
    style: {
      color: C.ink
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    className: "text-[11px]",
    style: {
      color: C.muted
    }
  }, sorted.length, " row(s)")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, rightExtra, /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => {
      setQ(e.target.value);
      setPage(0);
    },
    placeholder: "Search table...",
    className: "border rounded px-2 py-1 text-xs pl-6",
    style: {
      borderColor: C.border,
      color: C.ink,
      width: 160
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 6,
      top: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 11,
    color: C.muted
  }))), /*#__PURE__*/React.createElement(IconButton, {
    name: "table",
    title: "Export Excel",
    onClick: exportExcel
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "printer",
    title: "Print",
    onClick: () => window.print()
  }))), /*#__PURE__*/React.createElement("div", {
    className: "table-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      color: C.muted
    },
    className: "text-left"
  }, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    className: "pb-1.5 pr-3 cursor-pointer select-none whitespace-nowrap",
    onClick: () => toggleSort(c.key)
  }, /*#__PURE__*/React.createElement("span", {
    className: "inline-flex items-center gap-1"
  }, c.label, sortKey === c.key && /*#__PURE__*/React.createElement(Icon, {
    name: sortDir === "asc" ? "chevronRight" : "chevronDown",
    size: 10
  })))))), /*#__PURE__*/React.createElement("tbody", null, pageRows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length,
    className: "py-3 text-center",
    style: {
      color: C.muted
    }
  }, "No matching rows.")), pageRows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    style: {
      borderTop: `1px solid ${C.border}`
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    className: dense ? "py-1" : "py-1.5 pr-3"
  }, c.render ? c.render(r) : r[c.key]))))))), totalPages > 1 && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mt-2 no-print"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[11px]",
    style: {
      color: C.muted
    }
  }, "Page ", page + 1, " of ", totalPages), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1.5"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    disabled: page === 0,
    onClick: () => setPage(p => p - 1)
  }, "Prev"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    disabled: page >= totalPages - 1,
    onClick: () => setPage(p => p + 1)
  }, "Next"))));
}
// ---------------- Multi-select dropdown ----------------
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  function toggle(v) {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));else onChange([...selected, v]);
  }
  const summary = selected.length === 0 ? placeholder || "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  return /*#__PURE__*/React.createElement("div", {
    className: "relative",
    ref: ref
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, label, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOpen(o => !o),
    className: "border rounded px-2 py-1.5 text-sm text-left flex items-center justify-between gap-2",
    style: {
      borderColor: C.border,
      color: selected.length ? C.ink : C.muted,
      minWidth: 130,
      background: "#fff"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "truncate"
  }, summary), /*#__PURE__*/React.createElement(Icon, {
    name: "chevronDown",
    size: 12,
    color: C.muted
  }))), open && /*#__PURE__*/React.createElement("div", {
    className: "absolute z-40 mt-1 rounded shadow-lg max-h-56 overflow-y-auto",
    style: {
      background: "#fff",
      border: `1px solid ${C.border}`,
      minWidth: 190
    }
  }, options.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2 text-xs",
    style: {
      color: C.muted
    }
  }, "No options."), options.map(o => /*#__PURE__*/React.createElement("label", {
    key: o,
    className: "flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selected.includes(o),
    onChange: () => toggle(o)
  }), /*#__PURE__*/React.createElement("span", {
    className: "truncate",
    style: {
      color: C.ink
    }
  }, o))), selected.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-1.5 border-t",
    style: {
      borderColor: C.border
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "text-[11px]",
    style: {
      color: C.teal
    },
    onClick: () => onChange([])
  }, "Clear"))));
}
const DEFAULT_FILTERS = {
  quickRange: "all",
  dateFrom: "",
  dateTo: "",
  technicians: [],
  equipments: [],
  testTypesSel: [],
  chemicalsSel: [],
  gasesSel: [],
  batches: [],
  sampleSource: "",
  dilution: "all",
  statuses: [],
  suppliers: []
};
function quickRangeToDates(qr) {
  const today = new Date();
  const toStr = d => d.toISOString().slice(0, 10);
  if (qr === "last7") {
    const f = new Date(today);
    f.setDate(f.getDate() - 6);
    return {
      dateFrom: toStr(f),
      dateTo: toStr(today)
    };
  }
  if (qr === "last30") {
    const f = new Date(today);
    f.setDate(f.getDate() - 29);
    return {
      dateFrom: toStr(f),
      dateTo: toStr(today)
    };
  }
  if (qr === "thisMonth") {
    const f = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      dateFrom: toStr(f),
      dateTo: toStr(today)
    };
  }
  if (qr === "thisQuarter") {
    const q = Math.floor(today.getMonth() / 3);
    const f = new Date(today.getFullYear(), q * 3, 1);
    return {
      dateFrom: toStr(f),
      dateTo: toStr(today)
    };
  }
  if (qr === "thisYear") {
    const f = new Date(today.getFullYear(), 0, 1);
    return {
      dateFrom: toStr(f),
      dateTo: toStr(today)
    };
  }
  if (qr === "last12m") {
    const f = new Date(today);
    f.setMonth(f.getMonth() - 12);
    return {
      dateFrom: toStr(f),
      dateTo: toStr(today)
    };
  }
  return {
    dateFrom: "",
    dateTo: ""
  };
}
function FilterPanel({
  filters,
  setFilters,
  facets
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [savedFilters, setSavedFilters] = React.useState(() => loadKey("savedReportFilters", []));
  const [saveName, setSaveName] = React.useState("");
  function patch(p) {
    setFilters(prev => ({
      ...prev,
      ...p
    }));
  }
  function setQuickRange(qr) {
    patch({
      quickRange: qr,
      ...quickRangeToDates(qr)
    });
  }
  const activeCount = ["technicians", "equipments", "testTypesSel", "chemicalsSel", "gasesSel", "batches", "statuses", "suppliers"].reduce((s, k) => s + (filters[k]?.length || 0), 0) + (filters.sampleSource ? 1 : 0) + (filters.dilution !== "all" ? 1 : 0) + (filters.quickRange !== "all" ? 1 : 0);
  function saveCurrent() {
    if (!saveName.trim()) return;
    const next = [...savedFilters.filter(s => s.name !== saveName.trim()), {
      name: saveName.trim(),
      filters
    }];
    setSavedFilters(next);
    saveKey("savedReportFilters", next);
    setSaveName("");
  }
  function applySaved(sf) {
    setFilters({
      ...DEFAULT_FILTERS,
      ...sf.filters
    });
  }
  function deleteSaved(name) {
    const next = savedFilters.filter(s => s.name !== name);
    setSavedFilters(next);
    saveKey("savedReportFilters", next);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg mb-4 no-print",
    style: {
      background: C.card,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-2.5 flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chart",
    size: 14,
    color: C.teal
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold",
    style: {
      color: C.ink
    }
  }, "Global Filters"), activeCount > 0 && /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, activeCount, " active"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1 flex-wrap ml-1"
  }, [["all", "All Time"], ["last7", "Last 7d"], ["last30", "Last 30d"], ["thisMonth", "This Month"], ["thisQuarter", "This Quarter"], ["thisYear", "This Year"], ["last12m", "Last 12mo"]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setQuickRange(k),
    className: "px-2 py-1 rounded-full text-[11px] font-medium",
    style: {
      background: filters.quickRange === k ? C.teal : "transparent",
      color: filters.quickRange === k ? "#fff" : C.muted,
      border: `1px solid ${filters.quickRange === k ? C.teal : C.border}`
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, activeCount > 0 && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => setFilters(DEFAULT_FILTERS)
  }, "Reset all"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => setExpanded(e => !e)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: expanded ? "chevronDown" : "chevronRight",
    size: 12
  }), "Advanced Filters"))), expanded && /*#__PURE__*/React.createElement("div", {
    className: "px-4 pb-4 pt-1 border-t",
    style: {
      borderColor: C.border
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Date From",
    type: "date",
    value: filters.dateFrom,
    onChange: e => patch({
      dateFrom: e.target.value,
      quickRange: "custom"
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Date To",
    type: "date",
    value: filters.dateTo,
    onChange: e => patch({
      dateTo: e.target.value,
      quickRange: "custom"
    })
  }), /*#__PURE__*/React.createElement(MultiSelect, {
    label: "Technician",
    options: facets.technicians,
    selected: filters.technicians,
    onChange: v => patch({
      technicians: v
    })
  }), /*#__PURE__*/React.createElement(MultiSelect, {
    label: "Equipment",
    options: facets.equipments,
    selected: filters.equipments,
    onChange: v => patch({
      equipments: v
    })
  }), /*#__PURE__*/React.createElement(MultiSelect, {
    label: "Test Type",
    options: facets.testTypes,
    selected: filters.testTypesSel,
    onChange: v => patch({
      testTypesSel: v
    })
  }), /*#__PURE__*/React.createElement(MultiSelect, {
    label: "Chemical",
    options: facets.chemicals,
    selected: filters.chemicalsSel,
    onChange: v => patch({
      chemicalsSel: v
    })
  }), /*#__PURE__*/React.createElement(MultiSelect, {
    label: "Gas",
    options: facets.gases,
    selected: filters.gasesSel,
    onChange: v => patch({
      gasesSel: v
    })
  }), /*#__PURE__*/React.createElement(MultiSelect, {
    label: "Batch",
    options: facets.batches,
    selected: filters.batches,
    onChange: v => patch({
      batches: v
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Sample Source",
    value: filters.sampleSource,
    onChange: e => patch({
      sampleSource: e.target.value
    }),
    placeholder: "Search source..."
  }), /*#__PURE__*/React.createElement(SelectField, {
    label: "Dilution",
    value: filters.dilution,
    onChange: e => patch({
      dilution: e.target.value
    }),
    options: [{
      value: "all",
      label: "All"
    }, {
      value: "yes",
      label: "Dilution Required"
    }, {
      value: "no",
      label: "No Dilution"
    }],
    placeholder: "All"
  }), /*#__PURE__*/React.createElement(MultiSelect, {
    label: "Status",
    options: facets.statuses,
    selected: filters.statuses,
    onChange: v => patch({
      statuses: v
    })
  }), /*#__PURE__*/React.createElement(MultiSelect, {
    label: "Supplier",
    options: facets.suppliers,
    selected: filters.suppliers,
    onChange: v => patch({
      suppliers: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 flex-wrap pt-2 border-t",
    style: {
      borderColor: C.border
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] font-semibold",
    style: {
      color: C.muted
    }
  }, "Saved filters:"), savedFilters.length === 0 && /*#__PURE__*/React.createElement("span", {
    className: "text-[11px]",
    style: {
      color: C.muted
    }
  }, "None saved yet."), savedFilters.map(sf => /*#__PURE__*/React.createElement("span", {
    key: sf.name,
    className: "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px]",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => applySaved(sf),
    className: "font-medium"
  }, sf.name), /*#__PURE__*/React.createElement("button", {
    onClick: () => deleteSaved(sf.name),
    title: "Delete"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 9
  })))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1 ml-auto"
  }, /*#__PURE__*/React.createElement("input", {
    value: saveName,
    onChange: e => setSaveName(e.target.value),
    placeholder: "Name this filter set...",
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border,
      color: C.ink,
      width: 170
    }
  }), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: saveCurrent
  }, "Save Filter")))));
}
// ---------------- Smart insight generator (rule-based BI recommendations) ----------------
