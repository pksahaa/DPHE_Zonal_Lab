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
    className: "inline-block px-2 py-0.5 rounded text-xs font-semibold",
    style: {
      color: tones[tone].color,
      background: tones[tone].background
    }
  }, children);
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

// ---- Multi-select dropdown: a button showing "N selected", opening a
// checkbox panel. Used for "pick one or more" filters (e.g. Registration
// Batch) where a native <select multiple> is poor UX. ----
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder
}) {
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef(null);
  React.useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  function toggle(value) {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  }
  const summary = selected.length === 0 ? placeholder || "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  return /*#__PURE__*/React.createElement("div", {
    ref: boxRef,
    className: "relative",
    style: {
      minWidth: 220
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOpen(o => !o),
    className: "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left",
    style: {
      border: `1px solid ${C.border}`,
      background: "#fff",
      color: selected.length ? C.ink : C.muted
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "truncate"
  }, summary), /*#__PURE__*/React.createElement(Icon, {
    name: open ? "chevronDown" : "chevronRight",
    size: 12,
    color: C.muted
  })), open && /*#__PURE__*/React.createElement("div", {
    className: "absolute z-10 mt-1 w-full rounded shadow-lg max-h-56 overflow-y-auto p-1",
    style: {
      background: "#fff",
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between px-2 py-1 text-[11px]",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "underline",
    onClick: () => onChange(options.map(o => o.value))
  }, "Select all"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "underline",
    onClick: () => onChange([])
  }, "Clear")), options.map(o => /*#__PURE__*/React.createElement("label", {
    key: o.value,
    className: "flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer",
    style: {
      background: selected.includes(o.value) ? `${C.teal}14` : "transparent"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selected.includes(o.value),
    onChange: () => toggle(o.value)
  }), o.label)), options.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "px-2 py-1.5 text-xs",
    style: {
      color: C.muted
    }
  }, "No options.")));
}
