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
  infoBg: "#E7F1F7",
  // ---- Added during UI/UX audit: these hex values were previously
  // hardcoded ad-hoc throughout the app (outside this palette), so they
  // never re-themed in dark mode. Now named tokens like everything else.
  danger: "#E63946",
  dangerBg: "#FBE4E6",
  headerText: "#DDF2F0",
  headerTextMuted: "#BFE3E0",
  mutedBg: "#EEF4F3",
  subtle: "#FAFEFE"
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
  infoBg: "#123244",
  danger: "#FF6B75",
  dangerBg: "#3A1518",
  // header bar background (C.tealDark) stays a dark teal in both themes, so
  // the light text sitting on it stays the same in both themes too.
  headerText: "#DDF2F0",
  headerTextMuted: "#BFE3E0",
  mutedBg: "#1C3D3F",
  subtle: "#173537"
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

// Bump this whenever a fix ships, and it shows in the header (bottom-right
// of the title block) — lets anyone confirm at a glance whether the files
// in their browser are actually the updated ones, since local file:// pages
// are notorious for silently serving a cached copy of the old JS after you
// overwrite the files on disk.
const APP_BUILD = "2026-08-04.8 (Guest permission fix + per-user permission overrides)";

const STRINGS = {
  en: {
    appName: "Zonal Water Quality Lab",
    appSub: "Inventory & Test Record Management",
    dashboard: "Dashboard",
    samples: "Sample Management",
    inventory: "Inventory",
    testConfiguration: "Test Configuration",
    parameters: "Parameters",
    testTypes: "Test Types",
    addTest: "Add Test Record",
    testRecords: "Test Records",
    reports: "Reports",
    archive: "Archive",
    logOut: "Log Out",
    welcome: "Welcome back",
    welcomeSub: "A quick snapshot of stock levels, equipment health, and recent testing activity."
  },
  bn: {
    appName: "জোনাল ওয়াটার কোয়ালিটি ল্যাব",
    appSub: "ইনভেন্টরি ও টেস্ট রেকর্ড ব্যবস্থাপনা",
    dashboard: "ড্যাশবোর্ড",
    samples: "নমুনা ব্যবস্থাপনা",
    inventory: "ইনভেন্টরি",
    testConfiguration: "টেস্ট কনফিগারেশন",
    parameters: "প্যারামিটার",
    testTypes: "টেস্ট টাইপ",
    addTest: "টেস্ট রেকর্ড যোগ করুন",
    testRecords: "টেস্ট রেকর্ড",
    reports: "রিপোর্ট",
    archive: "আর্কাইভ",
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
// ---------------- Parameter categories (Test Configuration › Parameters) ----------------
// Shared between 12a-parameters-ui.js (form dropdown) and 12-testtypes-ui.js
// (category badge colouring when a Test Type's linked parameters are listed).
const PARAMETER_CATEGORIES = ["Physical", "Chemical", "Heavy Metal", "Microbiological", "Radiological", "Others"];
const PARAMETER_CATEGORY_TONE = {
  Physical: "info",
  Chemical: "ok",
  "Heavy Metal": "warn",
  Microbiological: "danger",
  Radiological: "muted",
  Others: "muted"
};
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
    case "menu":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M3 6h18M3 12h18M3 18h18"
      }));
    case "settings":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      }));
    case "panelLeft":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "4",
        width: "18",
        height: "16",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9 4v16"
      }));
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
    case "moreVertical":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "5",
        r: "1.5",
        fill: color,
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "1.5",
        fill: color,
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "19",
        r: "1.5",
        fill: color,
        stroke: "none"
      }));
    case "list":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M8 6h13M8 12h13M8 18h13"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 6h.01M3 12h.01M3 18h.01"
      }));
    case "layers":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 2 2 7l10 5 10-5-10-5z"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 17l10 5 10-5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 12l10 5 10-5"
      }));
    case "maximize":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"
      }));
    case "minimize":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M9 3v3a2 2 0 0 1-2 2H4M21 9h-3a2 2 0 0 1-2-2V4M15 21v-3a2 2 0 0 1 2-2h3M4 15h3a2 2 0 0 1 2 2v3"
      }));
    case "archive":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "4",
        width: "18",
        height: "4",
        rx: "1"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10 12h4"
      }));
    case "restore":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M3 12a9 9 0 1 0 3-6.7"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 4v5h5"
      }));
    case "users":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "9",
        cy: "7",
        r: "4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M23 21v-2a4 4 0 0 0-3-3.87"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 3.13a4 4 0 0 1 0 7.75"
      }));
    case "shield":
      return /*#__PURE__*/React.createElement("svg", common, /*#__PURE__*/React.createElement("path", {
        d: "M12 2l8 3.5v6c0 5-3.4 8.7-8 10.5-4.6-1.8-8-5.5-8-10.5v-6L12 2z"
      }));
    default:
      return null;
  }
}

// ---------------- Sample Register field definitions (single source of truth) ----------------
// Shared by the Excel manifest template generator (downloadTemplate("samples") in
// 10-inventory-logic.js) and the Bulk Upload parser (importSamples/confirmImportSamples
// in 21-sample-ui.js), and mirrors the per-row fields collected in Register Sample's
// "Sample Part" (BatchRegistrationForm rows, 21-sample-ui.js). Add/rename a field here
// once and both the template and the parser stay in sync automatically.
// `header` is the exact Excel column header written to the template AND read back on
// import (with `aliases` accepted too, for backward compatibility with older sheets).
const SAMPLE_IMPORT_COLUMNS = [{
  key: "customerName",
  header: "Customer Name",
  aliases: ["CustomerName", "ClientName", "Client Name"],
  required: true
}, {
  key: "fatherHusbandName",
  header: "Father's/Husband's Name",
  aliases: ["FatherHusbandName"]
}, {
  key: "district",
  header: "District",
  aliases: []
}, {
  key: "upazila",
  header: "City Corp/Pouroshova/Upazilla",
  aliases: ["Upazila", "Upazila/City Corporation"]
}, {
  key: "union",
  header: "Ward/Union",
  aliases: ["Union", "Union/Pourashava"]
}, {
  key: "siteName",
  header: "Site Name",
  aliases: ["SiteName", "SiteLocation", "Site Location"],
  required: true
}, {
  key: "latitude",
  header: "Latitude",
  aliases: []
}, {
  key: "longitude",
  header: "Longitude",
  aliases: []
}, {
  key: "waterPointType",
  header: "Type of Water Point",
  aliases: ["WaterPointType"]
}, {
  key: "waterPointTypeOther",
  header: "Type of Water Point - Other",
  aliases: ["WaterPointTypeOther"]
}, {
  key: "sampleSourceId",
  header: "Sample Source",
  aliases: ["SampleSource", "Sample Source (e.g. STW-6)"]
}, {
  key: "twId",
  header: "TW ID",
  aliases: ["TW_ID", "TWID"]
}, {
  key: "sampleType",
  header: "Sample Type",
  aliases: ["Matrix", "SampleType"]
}, {
  key: "collectionDate",
  header: "CollectionDate",
  aliases: ["Collection Date"]
}, {
  key: "collectedBy",
  header: "CollectedBy",
  aliases: ["Collected By"]
}, {
  key: "receivedDate",
  header: "ReceivedDate",
  aliases: ["Received Date"]
}];
// Looks up a field's value from a parsed Excel row, trying the canonical header first,
// then every accepted alias — so old manifests and the current template both work.
function readSampleImportField(row, colKey) {
  const col = SAMPLE_IMPORT_COLUMNS.find(c => c.key === colKey);
  if (!col) return "";
  if (row[col.header] !== undefined && row[col.header] !== "") return row[col.header];
  for (const alias of col.aliases) {
    if (row[alias] !== undefined && row[alias] !== "") return row[alias];
  }
  return "";
}

// ---------------- Batch identifier header (4.1) ----------------
// Combined badge/summary string shown on test record list items and batch
// headers so a batch is identifiable at a glance without opening it:
//   [Date] | [Test Name] | [Ref / Memo No.] | [Tracking No.]
// Any missing piece falls back to "—" rather than collapsing the format.
function formatBatchIdentifier(date, testName, refNo, trackingNo) {
  const parts = [date || "—", testName || "—", refNo || "—", trackingNo || "—"];
  return parts.join(" | ");
}

// ---------------- Storage error reporting ----------------
// A failed localStorage save/load used to fail completely silently in both
// 01-data-service.js and 06-legacy-storage.js (catch block just returned a
// fallback, or did nothing) — the person editing data had no way to know
// their change didn't actually persist. This is a tiny registry so any part
// of the app that has a `notify()` toast can plug it in once (see 99-app.js
// LabApp); if nothing has registered yet (very early during boot) it just
// logs to the console instead of throwing.
let _storageErrorNotify = null;
function registerStorageErrorHandler(fn) {
  _storageErrorNotify = fn;
}
function reportStorageError(action, key, e) {
  console.error(`Storage ${action} failed for "${key}":`, e);
  if (_storageErrorNotify) {
    _storageErrorNotify(`Couldn't ${action} "${key}" — ${action === "load" ? "using defaults for now" : "your last change may not survive a page refresh"}. (${e.message || e})`, "warn");
  }
}

// ---------------- Seed data ----------------
