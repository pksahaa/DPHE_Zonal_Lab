// ===== 02-ui-kit.js =====
// ============================================================================
// UI KIT — shared, reusable presentation primitives (Badge, Modal, Button,
// Fields, DataTable, StatCard...). Pure presentation: no data-fetching, no
// business logic. Reused by every tab so styling stays consistent.
// ============================================================================
// ---------------- Small UI primitives ----------------
function Badge({
  children,
  tone = "ok",
  title
}) {
  const tones = {
    ok: {
      color: C.ok,
      background: C.okBg
    },
    warn: {
      color: C.warn,
      background: C.warnBg
    },
    danger: {
      color: C.danger,
      background: C.dangerBg
    },
    muted: {
      color: C.muted,
      background: C.mutedBg
    },
    neutral: {
      color: C.muted,
      background: C.mutedBg
    },
    info: {
      color: C.info,
      background: C.infoBg
    }
  };
  const activeTone = tones[tone] || tones.muted;
  return /*#__PURE__*/React.createElement("span", {
    title: title,
    className: "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap",
    style: {
      color: activeTone.color,
      background: activeTone.background
    }
  }, children);
}

// ---- Dismissible alert Banner ----
// Replaces the old pattern of a permanent little "text-xs p-2 rounded"
// instructional paragraph sitting at the top of a card forever. Same tone
// palette as Badge (info/ok/warn/danger). Dismissal is per-mount state by
// default; pass a `storageKey` to remember the dismissal across reloads
// (sessionStorage) for banners that are genuinely one-time tips.
function Banner({
  tone = "info",
  icon,
  children,
  storageKey,
  onDismiss
}) {
  const tones = {
    info: { color: C.info, background: C.infoBg, iconName: "clipboard" },
    ok: { color: C.ok, background: C.okBg, iconName: "check" },
    warn: { color: C.warn, background: C.warnBg, iconName: "warning" },
    danger: { color: C.danger, background: C.dangerBg, iconName: "warning" }
  };
  const t = tones[tone] || tones.info;
  const [dismissed, setDismissed] = React.useState(() => {
    if (!storageKey) return false;
    try {
      return sessionStorage.getItem(`wq_banner_dismissed_${storageKey}`) === "1";
    } catch (e) {
      return false;
    }
  });
  if (dismissed) return null;
  function handleDismiss() {
    setDismissed(true);
    if (storageKey) {
      try {
        sessionStorage.setItem(`wq_banner_dismissed_${storageKey}`, "1");
      } catch (e) {}
    }
    onDismiss?.();
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 px-3 py-2 rounded-lg flex items-start gap-2",
    style: {
      background: t.background,
      color: t.color,
      border: `1px solid ${t.color}22`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon || t.iconName,
    size: 13,
    color: t.color
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 leading-relaxed"
  }, children), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleDismiss,
    title: "Dismiss",
    className: "shrink-0 rounded p-0.5 hover:bg-black/10 -mt-0.5 -mr-0.5"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 12,
    color: t.color
  })));
}

// ---- Reusable table Pagination footer ----
// "Showing X–Y of Z" + Prev/Next, consistent look everywhere a list is
// paged (Test Types, Test Records, ...).
function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange
}) {
  if (totalItems === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 px-1 pt-3 mt-1 text-xs flex-wrap",
    style: {
      borderTop: `1px solid ${C.border}`,
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "Showing ", /*#__PURE__*/React.createElement("strong", {
    style: { color: C.ink }
  }, start, "–", end), " of ", /*#__PURE__*/React.createElement("strong", {
    style: { color: C.ink }
  }, totalItems)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", null, "Page ", page, " of ", totalPages), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    disabled: page <= 1,
    onClick: () => onPageChange(page - 1)
  }, /*#__PURE__*/React.createElement(Icon, { name: "arrowLeft", size: 12 }), "Prev"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    disabled: page >= totalPages,
    onClick: () => onPageChange(page + 1)
  }, "Next", /*#__PURE__*/React.createElement(Icon, { name: "arrowRight", size: 12 }))));
}
// ---- Spinner ----
// One shared loading indicator — used inside Button (loading prop) and
// anywhere else a fetch/save is in flight, instead of ad-hoc "Loading…"
// text with no visual motion.
function Spinner({
  size = 14,
  color
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    className: "animate-spin",
    style: {
      color: color || "currentColor"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 12,
    cy: 12,
    r: 9,
    stroke: "currentColor",
    strokeWidth: 3,
    opacity: 0.25
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 12a9 9 0 0 0-9-9",
    stroke: "currentColor",
    strokeWidth: 3,
    strokeLinecap: "round"
  }));
}

// ---- Empty state ----
// One shared "nothing here yet" block for lists/tables, instead of each
// module inventing its own one-line gray text.
function EmptyState({
  icon = "clipboard",
  title = "Nothing here yet",
  subtitle,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center justify-center text-center gap-2 py-10 px-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-full p-3",
    style: {
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 22,
    color: C.muted
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold",
    style: {
      color: C.ink
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    className: "text-xs max-w-sm",
    style: {
      color: C.muted
    }
  }, subtitle), action && /*#__PURE__*/React.createElement("div", {
    className: "mt-1"
  }, action));
}

function SectionCard({
  title,
  icon,
  right,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-xl mb-5",
    style: {
      background: C.card,
      border: `1px solid ${C.border}`,
      boxShadow: "0 1px 2px rgba(15,43,46,0.04)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3 flex-wrap gap-2",
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, icon, /*#__PURE__*/React.createElement("h3", {
    className: "font-heading font-semibold text-sm tracking-tight",
    style: {
      color: C.ink
    }
  }, title)), /*#__PURE__*/React.createElement("div", null, right)), /*#__PURE__*/React.createElement("div", {
    className: "p-4"
  }, children));
}
// `label`/`onChange` here also accept the simplified (value) => ... signature used by newer
// modules (Sample Lifecycle) in addition to the original native-event signature, detected by
// arity/shape at call time isn't reliable, so newer callers should pass a plain value handler
// via `onChange={(v) => ...}` AND set `simple` — for old callers nothing changes.
function TextField({
  label,
  error,
  textarea,
  rows,
  simple,
  onChange,
  id,
  ...props
}) {
  const handleChange = simple ? e => onChange(e.target.value) : onChange;
  const Tag = textarea ? "textarea" : "input";
  const fieldId = id || props.name || `f_${React.useId ? React.useId() : Math.random().toString(36).slice(2)}`;
  const errorId = `${fieldId}_err`;
  // Password fields get a show/hide toggle so the person can check what
  // they actually typed before submitting — plain type="password" never
  // lets you see it, which is the #1 source of "wrong password" typos.
  const isPasswordField = !textarea && props.type === "password";
  const [revealed, setRevealed] = useState(false);
  const inputEl = /*#__PURE__*/React.createElement(Tag, {
    ...props,
    type: isPasswordField ? (revealed ? "text" : "password") : props.type,
    id: fieldId,
    rows: textarea ? rows || 3 : undefined,
    onChange: handleChange,
    "aria-invalid": !!error,
    "aria-describedby": error ? errorId : undefined,
    className: "border rounded px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 w-full",
    style: {
      borderColor: error ? C.warn : C.border,
      borderWidth: error ? 1.5 : 1,
      color: C.ink,
      resize: textarea ? "vertical" : undefined,
      paddingRight: isPasswordField ? 30 : undefined,
      "--tw-ring-color": C.teal,
      ...(props.style || {})
    }
  });
  const fieldBody = isPasswordField ? /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, inputEl, /*#__PURE__*/React.createElement("button", {
    type: "button",
    tabIndex: -1,
    onClick: () => setRevealed(v => !v),
    "aria-label": revealed ? "Hide password" : "Show password",
    title: revealed ? "Hide password" : "Show password",
    className: "absolute inset-y-0 right-0 flex items-center px-2 cursor-pointer",
    style: { color: C.muted, background: "transparent", border: "none" }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: revealed ? "eyeOff" : "eye",
    size: 15
  }))) : inputEl;
  return /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    htmlFor: fieldId,
    style: {
      color: C.muted
    }
  }, label, fieldBody, error && /*#__PURE__*/React.createElement("span", {
    id: errorId,
    role: "alert",
    className: "text-xs flex items-center gap-1",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 11
  }), error));
}
function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  simple,
  id
}) {
  const norm = (options || []).map(o => typeof o === "string" ? {
    value: o,
    label: o
  } : o);
  const handleChange = simple ? e => onChange(e.target.value) : onChange;
  const fieldId = id || `s_${React.useId ? React.useId() : Math.random().toString(36).slice(2)}`;
  const errorId = `${fieldId}_err`;
  return /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    htmlFor: fieldId,
    style: {
      color: C.muted
    }
  }, label, /*#__PURE__*/React.createElement("select", {
    id: fieldId,
    className: "border rounded px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
    style: {
      borderColor: error ? C.warn : C.border,
      borderWidth: error ? 1.5 : 1,
      color: C.ink,
      "--tw-ring-color": C.teal
    },
    value: value,
    onChange: handleChange,
    "aria-invalid": !!error,
    "aria-describedby": error ? errorId : undefined
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder || "Select..."), norm.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), error && /*#__PURE__*/React.createElement("span", {
    id: errorId,
    role: "alert",
    className: "text-xs flex items-center gap-1",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 11
  }), error));
}
function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  size = "md",
  disabled,
  title,
  loading
}) {
  const base = "inline-flex items-center gap-1.5 rounded-md font-medium transition duration-150 ease-out disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0";
  const sizes = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  const styles = variant === "primary" ? {
    background: C.teal,
    color: "#fff",
    boxShadow: "0 1px 2px rgba(15,43,46,0.16)",
    "--tw-ring-color": C.teal
  } : variant === "outline" ? {
    background: "transparent",
    color: C.teal,
    border: `1px solid ${C.teal}`,
    "--tw-ring-color": C.teal
  } : variant === "ghost" ? {
    background: "transparent",
    color: C.muted,
    border: `1px solid ${C.border}`,
    "--tw-ring-color": C.muted
  } : variant === "danger" ? {
    background: C.danger,
    color: "#fff",
    boxShadow: "0 1px 2px rgba(15,43,46,0.16)",
    "--tw-ring-color": C.danger
  } : {
    background: "transparent",
    color: C.warn,
    border: `1px solid ${C.warn}`,
    "--tw-ring-color": C.warn
  };
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    title: title,
    onClick: loading ? undefined : onClick,
    disabled: disabled || loading,
    "aria-busy": !!loading,
    className: `${base} ${sizes}`,
    style: styles
  }, loading && /*#__PURE__*/React.createElement(Spinner, {
    size: size === "sm" ? 12 : 14
  }), children);
}
function IconButton({
  name,
  color,
  onClick,
  title,
  disabled
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: title,
    "aria-label": title || name,
    onClick: onClick,
    disabled: disabled,
    className: "p-1 rounded-md cursor-pointer transition-colors duration-150 hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
    style: {
      color: color || C.muted,
      "--tw-ring-color": color || C.teal
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: name,
    size: 14
  }));
}
function Modal({
  title,
  onClose,
  children,
  wide
}) {
  const titleId = `modal_title_${React.useId()}`;
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 flex items-center justify-center p-4 z-50",
    role: "presentation",
    style: {
      background: "rgba(9,22,24,0.55)",
      backdropFilter: "blur(1.5px)"
    },
    onClick: e => {
      if (e.target === e.currentTarget) onClose?.();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: `rounded-xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[85vh] overflow-y-auto`,
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": titleId,
    style: {
      background: C.card,
      boxShadow: "0 12px 32px rgba(9,22,24,0.28)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3",
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("h3", {
    id: titleId,
    className: "font-heading font-semibold text-sm tracking-tight",
    style: {
      color: C.ink
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close dialog",
    className: "p-1 rounded-md cursor-pointer transition-colors duration-150 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
    style: {
      "--tw-ring-color": C.teal
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18,
    color: C.muted
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-4"
  }, children)));
}
function ConfirmBar({
  text,
  onConfirm,
  onCancel,
  confirmLabel = "Delete"
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-3 p-2.5 rounded mt-2",
    style: {
      background: C.warnBg
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs",
    style: {
      color: C.warn
    }
  }, text), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 shrink-0"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "danger",
    onClick: onConfirm
  }, confirmLabel)));
}
// ---- shared "reason required" confirm modal — anywhere an action needs a
// mandatory, non-empty written reason before it proceeds (Return to
// Analyst, Void/Invalidate a Test Record, and any future action the
// Workflow/Data-Integrity Upgrade adds the same requirement to). One
// authoritative implementation instead of copy-pasting this shape into
// every file that needs it — see SampleCustodyActionModal in
// 21-sample-ui.js for the sibling pattern at the whole-sample level
// (On Hold/Reject/Cancel), which this intentionally mirrors visually.
// `actions` (optional) turns this into a CHOICE modal instead of a single
// confirm — e.g. Request Correction offering "Correction Only" vs "Retest"
// as two distinct outcomes sharing one mandatory reason. Each entry is
// { key, label, detail, variant, onConfirm(reason) }. When omitted, this
// renders exactly as before: one button (confirmLabel/onConfirm) — every
// existing call site (Return to Analyst, Void, per-parameter Hold, Reject,
// whole-sample Hold/Reject/Cancel) keeps working unchanged.
function ReasonRequiredModal({
  title,
  description,
  confirmLabel,
  actions,
  onClose,
  onConfirm,
  placeholder
}) {
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState("");
  // Step 11 — Inventory Double-Consumption Guard. A rapid double-click (or
  // clicking again while waiting on a slow network response) must never
  // fire the underlying action twice — most of this modal's callers
  // restore/deduct chemical or gas inventory (Void/Correction Request,
  // Hold, Return to Analyst), and running that twice silently corrupts the
  // balance. `submittedRef` is a ref, not state, specifically so the CHECK
  // is synchronous and can't race a second click that lands before React
  // re-renders (a `submitted` state flag alone can't guarantee that; the
  // ref read/write below happens on the same tick as the click itself).
  const submittedRef = React.useRef(false);
  const [submitted, setSubmitted] = React.useState(false);
  function run(fn) {
    if (submittedRef.current) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setErr("A reason is required.");
      return;
    }
    submittedRef.current = true;
    setSubmitted(true);
    fn(trimmed);
  }
  const resolvedActions = actions && actions.length ? actions : [{
    key: "confirm",
    label: confirmLabel || "Confirm",
    variant: "danger",
    onConfirm
  }];
  const isChoice = !!(actions && actions.length > 1);
  return /*#__PURE__*/React.createElement(Modal, {
    title,
    onClose
  }, description && /*#__PURE__*/React.createElement("p", {
    className: "text-xs mb-3",
    style: {
      color: C.muted
    }
  }, description), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs mb-1",
    style: {
      color: C.muted
    }
  }, "Reason (required)", /*#__PURE__*/React.createElement("textarea", {
    autoFocus: true,
    className: "border rounded px-2 py-1.5 text-sm",
    style: {
      borderColor: C.border,
      minHeight: 70
    },
    value: reason,
    onChange: e => {
      setReason(e.target.value);
      setErr("");
    },
    placeholder: placeholder || "e.g. wrong dilution used, transcription error, QC failure on the run…"
  })), err && /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: C.warn
    }
  }, err), isChoice ?
  // ---- choice layout: one bordered option block per action, each with
  // its own explanation directly above its button, so the two outcomes
  // are never confused for a plain Cancel/Confirm pair. ----
  /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2 mt-2"
  }, resolvedActions.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.key,
    className: "rounded-lg p-2.5",
    style: {
      border: `1px solid ${C.border}`,
      background: C.bg
    }
  }, a.detail && /*#__PURE__*/React.createElement("p", {
    className: "text-xs mb-2",
    style: {
      color: C.ink
    }
  }, a.detail), /*#__PURE__*/React.createElement(Button, {
    variant: a.variant || "danger",
    size: "sm",
    disabled: submitted,
    onClick: () => run(a.onConfirm)
  }, a.label))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mt-1"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: onClose
  }, "Cancel"))) : /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-3"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    variant: resolvedActions[0].variant || "danger",
    size: "sm",
    disabled: submitted,
    onClick: () => run(resolvedActions[0].onConfirm)
  }, resolvedActions[0].label)));
}
function StatCard({
  label,
  value,
  sub,
  tone = "ink",
  icon,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    className: `text-left rounded-xl p-4 flex flex-col gap-1 w-full transition duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${onClick ? "cursor-pointer hover:-translate-y-0.5" : ""}`,
    style: {
      background: C.card,
      border: `1px solid ${C.border}`,
      boxShadow: "0 1px 2px rgba(15,43,46,0.04)",
      "--tw-ring-color": C.teal
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-medium",
    style: {
      color: C.muted
    }
  }, label), icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 15,
    color: C.teal
  })), /*#__PURE__*/React.createElement("div", {
    className: "font-heading text-2xl font-bold tracking-tight",
    style: {
      color: tone === "warn" ? C.warn : C.ink
    }
  }, value), sub && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, sub));
}
