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
      color: "#fff",
      background: C.warn
    },
    muted: {
      color: C.muted,
      background: "#EEF4F3"
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
    danger: { color: "#fff", background: C.warn, iconName: "warning" }
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
      border: tone === "danger" ? "none" : `1px solid ${t.color}22`
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
  ...props
}) {
  const handleChange = simple ? e => onChange(e.target.value) : onChange;
  const Tag = textarea ? "textarea" : "input";
  return /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, label, /*#__PURE__*/React.createElement(Tag, {
    ...props,
    rows: textarea ? rows || 3 : undefined,
    onChange: handleChange,
    className: "border rounded px-2 py-1.5 text-sm",
    style: {
      borderColor: error ? C.warn : C.border,
      borderWidth: error ? 1.5 : 1,
      color: C.ink,
      resize: textarea ? "vertical" : undefined,
      ...(props.style || {})
    }
  }), error && /*#__PURE__*/React.createElement("span", {
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
  simple
}) {
  const norm = (options || []).map(o => typeof o === "string" ? {
    value: o,
    label: o
  } : o);
  const handleChange = simple ? e => onChange(e.target.value) : onChange;
  return /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, label, /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: {
      borderColor: error ? C.warn : C.border,
      borderWidth: error ? 1.5 : 1,
      color: C.ink
    },
    value: value,
    onChange: handleChange
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder || "Select..."), norm.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), error && /*#__PURE__*/React.createElement("span", {
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
  title
}) {
  const base = "inline-flex items-center gap-1.5 rounded font-medium transition-colors disabled:opacity-40";
  const sizes = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  const styles = variant === "primary" ? {
    background: C.teal,
    color: "#fff"
  } : variant === "outline" ? {
    background: "transparent",
    color: C.teal,
    border: `1px solid ${C.teal}`
  } : variant === "ghost" ? {
    background: "transparent",
    color: C.muted,
    border: `1px solid ${C.border}`
  } : {
    background: "transparent",
    color: C.warn,
    border: `1px solid ${C.warn}`
  };
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    title: title,
    onClick: onClick,
    disabled: disabled,
    className: `${base} ${sizes}`,
    style: styles
  }, children);
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
    onClick: onClick,
    disabled: disabled,
    className: "p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed",
    style: {
      color: color || C.muted
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
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 flex items-center justify-center p-4 z-50",
    style: {
      background: "rgba(10,30,32,0.45)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: `rounded-lg w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[85vh] overflow-y-auto`,
    style: {
      background: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3",
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-sm",
    style: {
      color: C.ink
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose
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
