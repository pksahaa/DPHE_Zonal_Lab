// ===== 00-core.js =====
// ============================================================================
// CORE — theme palette, i18n strings, date/number helpers, icon set
// Loaded first. Declares globals (C, STRINGS, LANG, Icon, uid, todayStr, etc.)
// that every later module reads. No external dependencies.
// ============================================================================
const {
  useState,
  useEffect,
  useCallback,
  useRef
} = React;

// ---------------- Palette (light / dark) ----------------
const LIGHT_PALETTE = {
  ink: "#123437",
  teal: "#028090",
  tealDark: "#045C64",
  seafoam: "#00A896",
  mint: "#02C39A",
  bg: "#F3FAF9",
  card: "#FFFFFF",
  warn: "#C7511F",
  warnBg: "#FDEDE6",
  ok: "#0E7C56",
  okBg: "#E6F6EF",
  border: "#D6ECEA",
  muted: "#5B7275",
  info: "#1D5B7A",
  infoBg: "#E7F1F7"
};
const DARK_PALETTE = {
  ink: "#EAF6F5",
  teal: "#12A5A8",
  tealDark: "#0C3B3D",
  seafoam: "#00A896",
  mint: "#02C39A",
  bg: "#0E2325",
  card: "#153436",
  warn: "#FF8A65",
  warnBg: "#3A2117",
  ok: "#5FD8A8",
  okBg: "#123A2E",
  border: "#25494B",
  muted: "#9BC4C2",
  info: "#7FC4E8",
  infoBg: "#123244"
};
// C is a mutable palette object — components read C.xxx at render time, so
// re-assigning its keys (via applyTheme) and forcing a re-render is enough
// to re-theme the whole app without threading props everywhere.
const C = {
  ...LIGHT_PALETTE
};
function applyTheme(mode) {
  Object.assign(C, mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE);
}

// ---------------- Minimal i18n ----------------
const STRINGS = {
  en: {
    appName: "Zonal Water Quality Lab",
    appSub: "Inventory & Test Record Management",
    dashboard: "Dashboard",
    inventory: "Inventory",
    testTypes: "Test Types",
    addTest: "Add Test Record",
    testRecords: "Test Records",
    reports: "Reports",
    logOut: "Log Out",
    welcome: "Welcome back",
    welcomeSub: "A quick snapshot of stock levels, equipment health, and recent testing activity."
  },
  bn: {
    appName: "জোনাল ওয়াটার কোয়ালিটি ল্যাব",
    appSub: "ইনভেন্টরি ও টেস্ট রেকর্ড ব্যবস্থাপনা",
    dashboard: "ড্যাশবোর্ড",
    inventory: "ইনভেন্টরি",
    testTypes: "টেস্ট টাইপ",
    addTest: "টেস্ট রেকর্ড যোগ করুন",
    testRecords: "টেস্ট রেকর্ড",
    reports: "রিপোর্ট",
    logOut: "লগ আউট",
    welcome: "স্বাগতম",
    welcomeSub: "স্টক লেভেল, যন্ত্রপাতির অবস্থা এবং সাম্প্রতিক টেস্টিং কার্যক্রমের সংক্ষিপ্ত চিত্র।"
  }
};
let LANG = "en";
function setLang(l) {
  LANG = l;
}
function t(key) {
  return STRINGS[LANG] && STRINGS[LANG][key] || STRINGS.en[key] || key;
}
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const fmtNum = n => (Math.round((n + Number.EPSILON) * 1000) / 1000).toString();
const daysUntil = dateStr => Math.round((new Date(dateStr) - new Date(todayStr())) / (1000 * 60 * 60 * 24));
const monthKey = dateStr => (dateStr || "").slice(0, 7); // "YYYY-MM"

// Small dependency-free bar chart (no charting library is loaded in this file).
function MiniBarChart({
  data,
  valueFmt,
  color
}) {
  // data: [{ label, value }]
  const max = Math.max(1, ...data.map(d => d.value));
  const barColor = color || C.teal;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-end gap-2",
    style: {
      height: 140
    }
  }, data.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "No data for this range."), data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "flex flex-col items-center gap-1",
    style: {
      flex: "1 1 0",
      minWidth: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px]",
    style: {
      color: C.muted
    }
  }, valueFmt ? valueFmt(d.value) : d.value), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "70%",
      height: Math.max(2, d.value / max * 100),
      background: barColor,
      borderRadius: 3
    },
    title: `${d.label}: ${d.value}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px]",
    style: {
      color: C.muted
    }
  }, d.label))));
}

// ---------------- Icons (inline SVG) ----------------
function Icon({
  name,
  size = 16,
  color = "currentColor"
}) {
  const s = {
    width: size,
    height: size,
    display: "inline-block",
    verticalAlign: "middle"
  };
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: s
  };
  switch (name) {
    case "droplet":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 2s7 8.5 7 13a7 7 0 1 1-14 0c0-4.5 7-13 7-13z"
      }));
    case "flask":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M9 2h6"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10 2v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 8.5V2"
      }));
    case "beaker":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M4.5 3h15"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 3v7l-3.5 9.5A1.5 1.5 0 0 0 4 21.5h16a1.5 1.5 0 0 0 1.4-2L18 10V3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 14h12"
      }));
    case "wrench":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M14.7 6.3a4 4 0 0 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-3-3 2.6-2.6z"
      }));
    case "clipboard":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("rect", {
        x: "6",
        y: "4",
        width: "12",
        height: "17",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9 4V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5V4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9 10h6M9 14h6M9 18h4"
      }));
    case "chart":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M4 20V10M12 20V4M20 20v-7"
      }));
    case "plus":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 5v14M5 12h14"
      }));
    case "upload":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 16V4M6 9l6-6 6 6"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"
      }));
    case "download":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 4v12M6 11l6 6 6-6"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"
      }));
    case "warning":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M10.3 3.9 1.8 18a1 1 0 0 0 .9 1.5h18.6a1 1 0 0 0 .9-1.5L13.7 3.9a1 1 0 0 0-1.7 0z"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M12 9v4M12 17h.01"
      }));
    case "check":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "9"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m9 12 2 2 4-4"
      }));
    case "x":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M18 6 6 18M6 6l12 12"
      }));
    case "trash":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M4 7h16"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10 11v6M14 11v6"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
      }));
    case "edit":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 20h9"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
      }));
    case "lock":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("rect", {
        x: "4",
        y: "10",
        width: "16",
        height: "10",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M8 10V7a4 4 0 0 1 8 0v3"
      }));
    case "user":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "8",
        r: "4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M4 21c0-4 4-6 8-6s8 2 8 6"
      }));
    case "logout":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 17l5-5-5-5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M21 12H9"
      }));
    case "home":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M3 11l9-8 9 8"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M5 10v10h14V10"
      }));
    case "arrowRight":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M5 12h14M13 6l6 6-6 6"
      }));
    case "arrowLeft":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M19 12H5M11 18l-6-6 6-6"
      }));
    case "link":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M9 17H7A5 5 0 0 1 7 7h2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M15 7h2a5 5 0 1 1 0 10h-2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M8 12h8"
      }));
    case "ban":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "9"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m5 5 14 14"
      }));
    case "chevronDown":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M6 9l6 6 6-6"
      }));
    case "chevronRight":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M9 6l6 6-6 6"
      }));
    case "coins":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "8",
        cy: "8",
        r: "6"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M18.09 10.37A6 6 0 1 1 10.34 18"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M7 6h1v4"
      }));
    case "moon":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
      }));
    case "sun":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      }));
    case "globe":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "9"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"
      }));
    case "printer":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M6 9V3h12v6"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "4",
        y: "9",
        width: "16",
        height: "8",
        rx: "1"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 17v4h12v-4"
      }));
    case "search":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "11",
        cy: "11",
        r: "7"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m21 21-4.3-4.3"
      }));
    case "table":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "4",
        width: "18",
        height: "16",
        rx: "1.5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 9h18M3 15h18M9 4v16"
      }));
    case "maximize":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"
      }));
    case "minimize":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M9 3v3a2 2 0 0 1-2 2H4M21 9h-3a2 2 0 0 1-2-2V4M15 21v-3a2 2 0 0 1 2-2h3M4 15h3a2 2 0 0 1 2 2v3"
      }));
    default:
      return null;
  }
}

// ---------------- Seed data ----------------
