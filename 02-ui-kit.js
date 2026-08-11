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
    info: {
      color: C.info,
      background: C.infoBg
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    title: title,
    className: "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap",
    style: {
      color: tones[tone].color,
      background: tones[tone].background
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
    className: "rounded-lg mb-5",
    style: {
      background: C.card,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3 flex-wrap gap-2",
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, icon, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-sm",
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
  return /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    htmlFor: fieldId,
    style: {
      color: C.muted
    }
  }, label, /*#__PURE__*/React.createElement(Tag, {
    ...props,
    id: fieldId,
    rows: textarea ? rows || 3 : undefined,
    onChange: handleChange,
    "aria-invalid": !!error,
    "aria-describedby": error ? errorId : undefined,
    className: "border rounded px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
    style: {
      borderColor: error ? C.warn : C.border,
      borderWidth: error ? 1.5 : 1,
      color: C.ink,
      resize: textarea ? "vertical" : undefined,
      "--tw-ring-color": C.teal,
      ...(props.style || {})
    }
  }), error && /*#__PURE__*/React.createElement("span", {
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
  const base = "inline-flex items-center gap-1.5 rounded font-medium transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
  const sizes = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  const styles = variant === "primary" ? {
    background: C.teal,
    color: "#fff",
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
    className: "p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
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
      background: "rgba(10,30,32,0.45)"
    },
    onClick: e => {
      if (e.target === e.currentTarget) onClose?.();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: `rounded-lg w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[85vh] overflow-y-auto`,
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": titleId,
    style: {
      background: C.card
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3",
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("h3", {
    id: titleId,
    className: "font-semibold text-sm",
    style: {
      color: C.ink
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close dialog",
    className: "p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
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
    className: "text-left rounded-lg p-4 flex flex-col gap-1 w-full",
    style: {
      background: C.card,
      border: `1px solid ${C.border}`,
      cursor: onClick ? "pointer" : "default"
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
    className: "text-2xl font-bold",
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
