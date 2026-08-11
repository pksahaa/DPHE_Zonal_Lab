// ===== 12-testtypes-ui.js =====
// ============================================================================
// TEST METHOD ENGINE — configurable analytical methods: chemical/gas
// requirement builder, dilution rules, formula-driven default values.
// This is the "Test Method Engine" module referenced in the LIMS spec.
// ============================================================================
function BottleSelector({
  chemical,
  needed,
  value,
  onChange
}) {
  if (!chemical) return /*#__PURE__*/React.createElement("span", {
    className: "text-xs",
    style: {
      color: C.warn
    }
  }, "Chemical not found in inventory");
  const suggestion = fefoSuggestion(chemical);
  const activeBatches = chemical.batches.filter(b => b.status === "active");
  const expiredBatches = chemical.batches.filter(b => b.status === "expired" && b.remaining > 0);
  const selected = value || (suggestion ? suggestion.id : "");
  return /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-xs ml-auto",
    style: {
      color: C.muted
    }
  }, "Bottle:", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1 text-xs",
    style: {
      borderColor: C.border
    },
    value: selected,
    onChange: e => onChange(e.target.value)
  }, activeBatches.length === 0 && expiredBatches.length === 0 && /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "No stock"), activeBatches.map(b => /*#__PURE__*/React.createElement("option", {
    key: b.id,
    value: b.id
  }, b.batchName ? `[${b.batchName}] ` : "", "Exp ", b.expiryDate, " · ", fmtNum(b.remaining), " left", suggestion && b.id === suggestion.id ? " (FEFO)" : "")), expiredBatches.length > 0 && /*#__PURE__*/React.createElement("optgroup", {
    label: "Expired (override required)"
  }, expiredBatches.map(b => /*#__PURE__*/React.createElement("option", {
    key: b.id,
    value: b.id
  }, "⚠ ", b.batchName ? `[${b.batchName}] ` : "", "EXPIRED ", b.expiryDate, " · ", fmtNum(b.remaining), " left")))), needed > activeBatches.reduce((s, b) => s + b.remaining, 0) && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.warn
    },
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 12
  }), "low stock"));
}
function RequirementEditor({
  title,
  hint,
  requirements,
  setRequirements,
  chemOptions,
  chemicalsEmpty,
  addLabel,
  sampleAmountKind = "standardOrField",
  showErrors = false,
  chemicals = [],
  setChemicals,
  masterChemicals = [],
  setMasterChemicals,
  notify
}) {
  const [showMasterList, setShowMasterList] = useState(false);
  const [showAddChemical, setShowAddChemical] = useState(false);
  function addReq() {
    setRequirements(prev => [...prev, {
      chemicalId: "",
      chemical: "",
      optional: false,
      items: []
    }]);
  }
  function updateChem(idx, chemicalId, chemicals) {
    const chem = chemicals.find(c => c.id === chemicalId);
    setRequirements(prev => prev.map((r, i) => i === idx ? {
      ...r,
      chemicalId,
      chemical: chem ? chem.name : ""
    } : r));
  }
  function updateReqField(idx, patch) {
    setRequirements(prev => prev.map((r, i) => i === idx ? {
      ...r,
      ...patch
    } : r));
  }
  function addItem(idx, type) {
    setRequirements(prev => prev.map((r, i) => i === idx ? {
      ...r,
      items: [...r.items, type === "direct" ? {
        id: uid("item"),
        label: "New Item",
        type: "direct",
        defaultValue: 0
      } : type === "volumetric" ? {
        id: uid("item"),
        label: "New Item",
        type: "volumetric",
        scaling: "sampleAmount",
        solutionVolume: 100,
        defaultPercent: 10,
        defaultAmount: 10,
        ...(sampleAmountKind === "standardOrField" ? {
          sampleSource: "field"
        } : {})
      } : {
        id: uid("item"),
        label: "New Item",
        type: "sampleAmount",
        amountLabel: "Amount required per sample",
        defaultAmount: 0,
        ...(sampleAmountKind === "standardOrField" ? {
          sampleSource: "field"
        } : {})
      }]
    } : r));
  }
  function updateItem(reqIdx, itemId, patch) {
    setRequirements(prev => prev.map((r, i) => i === reqIdx ? {
      ...r,
      items: r.items.map(it => it.id === itemId ? {
        ...it,
        ...patch
      } : it)
    } : r));
  }
  function updateVolumetric(reqIdx, itemId, patch) {
    setRequirements(prev => prev.map((r, i) => i === reqIdx ? {
      ...r,
      items: r.items.map(it => {
        if (it.id !== itemId) return it;
        const merged = {
          ...it,
          ...patch
        };
        merged.defaultAmount = (Number(merged.solutionVolume) || 0) * (Number(merged.defaultPercent) || 0) / 100;
        return merged;
      })
    } : r));
  }
  function removeItem(reqIdx, itemId) {
    setRequirements(prev => prev.map((r, i) => i === reqIdx ? {
      ...r,
      items: r.items.filter(it => it.id !== itemId)
    } : r));
  }
  function removeReq(idx) {
    setRequirements(prev => prev.filter((_, i) => i !== idx));
  }
  const itemTypeMeta = {
    direct: {
      label: "Fixed Direct Value",
      tone: C.info,
      toneBg: C.infoBg
    },
    sampleAmount: {
      label: "No. of Sample × Amount",
      tone: C.ok,
      toneBg: C.okBg
    },
    volumetric: {
      label: "Volumetric %",
      tone: C.tealDark,
      toneBg: `${C.tealDark}1A`
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold",
    style: {
      color: C.ink
    }
  }, title), setChemicals && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1.5"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => setShowMasterList(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "link",
    size: 12
  }), "Master Chemical List"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => setShowAddChemical(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 12
  }), "Add Chemical to Inventory"))), hint && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, hint), requirements.map((req, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "rounded-lg p-3.5",
    style: {
      border: `1px solid ${C.border}`,
      background: C.subtle
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3 mb-2.5",
    style: {
      gridTemplateColumns: "1fr auto auto"
    }
  }, /*#__PURE__*/React.createElement(SelectField, {
    label: "Linked Chemical (from Inventory)",
    value: req.chemicalId,
    onChange: e => updateChem(idx, e.target.value, chemOptions.raw),
    options: chemOptions.options,
    placeholder: "Select a chemical from inventory...",
    error: showErrors && !req.chemicalId ? "Please select a chemical for this requirement." : undefined
  }), req.chemicalId && (() => {
    const c = chemOptions.raw.find(x => x.id === req.chemicalId);
    return c ? /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Unit", /*#__PURE__*/React.createElement("div", {
      className: "border rounded px-3 py-1.5 text-sm text-center",
      style: {
        borderColor: C.border,
        background: C.bg,
        color: C.ink
      }
    }, c.unit)) : /*#__PURE__*/React.createElement("div", null);
  })(), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: "transparent"
    }
  }, ".", /*#__PURE__*/React.createElement("button", {
    onClick: () => removeReq(idx),
    className: "border rounded px-2 py-1.5",
    style: {
      borderColor: C.border
    },
    title: "Remove this requirement"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 14,
    color: C.warn
  })))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-3 text-xs"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.muted
    }
  }, "Field status:"), /*#__PURE__*/React.createElement("div", {
    className: "inline-flex rounded overflow-hidden",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => updateReqField(idx, {
      optional: false
    }),
    className: "px-2.5 py-1",
    style: {
      background: !req.optional ? C.teal : C.card,
      color: !req.optional ? "#fff" : C.muted,
      fontWeight: !req.optional ? 600 : 400
    }
  }, "Required"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => updateReqField(idx, {
      optional: true
    }),
    className: "px-2.5 py-1",
    style: {
      background: req.optional ? C.warn : C.card,
      color: req.optional ? "#fff" : C.muted,
      fontWeight: req.optional ? 600 : 400
    }
  }, "Not Required")), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.muted
    }
  }, req.optional ? "— alternative chemical; appears disabled/not-required by default in Add Test Record, tester ticks a box to enable and use it instead." : "— mandatory in Add Test Record.")), req.items.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] font-semibold uppercase tracking-wide mb-1.5",
    style: {
      color: C.muted
    }
  }, "Chemical Usage Formula Configuration"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2 mb-2"
  }, req.items.map(item => {
    const meta = itemTypeMeta[item.type] || itemTypeMeta.direct;
    return /*#__PURE__*/React.createElement("div", {
      key: item.id,
      className: "rounded p-2.5",
      style: {
        border: `1px solid ${C.border}`,
        background: C.card
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 mb-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
      style: {
        background: meta.toneBg,
        color: meta.tone
      }
    }, meta.label), /*#__PURE__*/React.createElement("input", {
      className: "border rounded px-2 py-1 text-xs flex-1 min-w-[120px]",
      style: {
        borderColor: C.border
      },
      value: item.label,
      placeholder: "Row Identifier / Purpose (e.g. Acid digestion, Wash)",
      onChange: e => updateItem(idx, item.id, {
        label: e.target.value
      })
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeItem(idx, item.id),
      title: "Remove this row"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 13,
      color: C.warn
    }))), item.type === "direct" && /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-2 text-xs",
      style: {
        color: C.muted
      }
    }, "Dummy default (fixed amount per record):", /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "border rounded px-2 py-1 text-xs w-24",
      style: {
        borderColor: C.border
      },
      value: item.defaultValue ?? 0,
      onChange: e => updateItem(idx, item.id, {
        defaultValue: Number(e.target.value) || 0
      })
    })), item.type === "volumetric" && /*#__PURE__*/React.createElement("div", {
      className: "grid gap-2 items-end",
      style: {
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))"
      }
    }, /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Applies", /*#__PURE__*/React.createElement("select", {
      className: "border rounded px-1.5 py-1.5 text-xs",
      style: {
        borderColor: C.border
      },
      value: item.scaling || "sampleAmount",
      onChange: e => updateItem(idx, item.id, {
        scaling: e.target.value
      })
    }, /*#__PURE__*/React.createElement("option", {
      value: "direct"
    }, "Direct (one flat amount per record)"), /*#__PURE__*/React.createElement("option", {
      value: "sampleAmount"
    }, "No. of Sample × Amount"))), item.scaling !== "direct" && (sampleAmountKind === "standardOrField" ? /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Multiplier Reference", /*#__PURE__*/React.createElement("select", {
      className: "border rounded px-1.5 py-1.5 text-xs",
      style: {
        borderColor: C.border
      },
      value: item.sampleSource || "field",
      onChange: e => updateItem(idx, item.id, {
        sampleSource: e.target.value
      })
    }, /*#__PURE__*/React.createElement("option", {
      value: "field"
    }, "No. of Field Samples"), /*#__PURE__*/React.createElement("option", {
      value: "standard"
    }, "No. of Standard Samples"), /*#__PURE__*/React.createElement("option", {
      value: "both"
    }, "Both (Field + Standard)"))) : /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Multiplier Reference", /*#__PURE__*/React.createElement("span", {
      className: "text-xs px-2 py-1.5 rounded",
      style: {
        background: C.mutedBg,
        color: C.muted
      }
    }, "No. of Diluted Samples"))), /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Sol. Volume (ml)", /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "border rounded px-2 py-1.5 text-xs",
      style: {
        borderColor: C.border
      },
      value: item.solutionVolume ?? 100,
      onChange: e => updateVolumetric(idx, item.id, {
        solutionVolume: Number(e.target.value) || 0
      })
    })), /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Conc. / Percent (%)", /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "border rounded px-2 py-1.5 text-xs",
      style: {
        borderColor: C.border
      },
      value: item.defaultPercent ?? 0,
      onChange: e => updateVolumetric(idx, item.id, {
        defaultPercent: Number(e.target.value) || 0
      })
    })), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Standard Prep (ml)", /*#__PURE__*/React.createElement("span", {
      className: "text-xs px-2 py-1.5 rounded font-semibold text-center",
      style: {
        background: C.okBg,
        color: C.ok
      }
    }, "= ", fmtNum(item.defaultAmount || 0), item.scaling === "direct" ? " total" : " /sample"))), item.type === "sampleAmount" && /*#__PURE__*/React.createElement("div", {
      className: "grid gap-2 items-end",
      style: {
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))"
      }
    }, sampleAmountKind === "standardOrField" ? /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Multiplier Reference", /*#__PURE__*/React.createElement("select", {
      className: "border rounded px-1.5 py-1.5 text-xs",
      style: {
        borderColor: C.border
      },
      value: item.sampleSource || "field",
      onChange: e => updateItem(idx, item.id, {
        sampleSource: e.target.value
      })
    }, /*#__PURE__*/React.createElement("option", {
      value: "field"
    }, "No. of Field Samples"), /*#__PURE__*/React.createElement("option", {
      value: "standard"
    }, "No. of Standard Samples"), /*#__PURE__*/React.createElement("option", {
      value: "both"
    }, "Both (Field + Standard)"))) : /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Multiplier Reference", /*#__PURE__*/React.createElement("span", {
      className: "text-xs px-2 py-1.5 rounded",
      style: {
        background: C.mutedBg,
        color: C.muted
      }
    }, "No. of Diluted Samples")), /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col gap-1 text-xs",
      style: {
        color: C.muted
      }
    }, "Scaled Amt / Sample", /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "border rounded px-2 py-1.5 text-xs",
      style: {
        borderColor: C.border
      },
      value: item.defaultAmount ?? 0,
      onChange: e => updateItem(idx, item.id, {
        defaultAmount: Number(e.target.value) || 0
      })
    }))));
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => addItem(idx, "direct")
  }, "+ Fixed Direct Value"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => addItem(idx, "sampleAmount")
  }, "+ Sample Scaled Amount"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => addItem(idx, "volumetric")
  }, "+ Standard Calibration Solution")))), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: addReq,
    disabled: chemicalsEmpty
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  }), "Add ", addLabel, " Requirement"), chemicalsEmpty && setChemicals && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center gap-1.5",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), "No chemicals in inventory yet — use \"Add Chemical to Inventory\" above to add one without leaving this page."), showMasterList && /*#__PURE__*/React.createElement(MasterChemicalListModal, {
    masterList: masterChemicals,
    setMasterList: setMasterChemicals,
    existingNames: chemicals.map(c => c.name),
    setChemicals: setChemicals,
    notify: notify,
    onClose: () => setShowMasterList(false)
  }), showAddChemical && /*#__PURE__*/React.createElement(Modal, {
    title: "Add Chemical to Inventory",
    onClose: () => setShowAddChemical(false)
  }, /*#__PURE__*/React.createElement(AddChemicalForm, {
    masterList: masterChemicals,
    existingNames: chemicals.map(c => c.name),
    onSave: (name, unit) => {
      setChemicals(prev => [...prev, {
        id: uid("chem"),
        name,
        unit,
        batches: []
      }]);
      notify && notify(`Added "${name}" to inventory — now available to link above.`);
      setShowAddChemical(false);
    },
    onCancel: () => setShowAddChemical(false)
  })));
}
// Gas requirements are a flat, name-only link to the Gas inventory (Acetylene, Argon, ...) — just ticking
// which gas(es) a test may need. No amount/calculation, since gas use per sample is tracked manually.
function GasRequirementPicker({
  gasList,
  selected,
  setSelected
}) {
  function toggle(g) {
    setSelected(prev => prev.some(x => x.gasId === g.id) ? prev.filter(x => x.gasId !== g.id) : [...prev, {
      gasId: g.id,
      gasName: g.name
    }]);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 p-2 rounded",
    style: {
      border: `1px solid ${C.border}`
    }
  }, gasList.length === 0 && /*#__PURE__*/React.createElement("span", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "No gas types registered in inventory yet — add one in Inventory → Gas."), gasList.map(g => {
    const checked = selected.some(x => x.gasId === g.id);
    return /*#__PURE__*/React.createElement("label", {
      key: g.id,
      className: "flex items-center gap-1.5 text-xs px-2 py-1 rounded",
      style: {
        background: checked ? C.okBg : C.subtle,
        color: checked ? C.ok : C.muted
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: checked,
      onChange: () => toggle(g)
    }), g.name);
  }));
}
// ---- Parameter linker: many-to-many attach/detach between a Test Type and
// the Parameters sub-tab (Test Configuration › Parameters). Checkbox-list
// with search — attaches/detaches by id, and lets the order be seen at a
// glance via the "selected" chip row above the list. ----
function ParameterLinker({
  parameters,
  selectedIds,
  setSelectedIds
}) {
  // Single-select only: a Test Type reports exactly one Parameter. Picking a
  // new one replaces whatever was selected before (radio behaviour, not
  // checkboxes) — selectedIds is kept as a 0-or-1-length array so the rest of
  // the app (isParameterUsed, exports, etc.) doesn't need to change shape.
  const [q, setQ] = useState("");
  const selectedId = (selectedIds || [])[0] || "";
  const selected = parameters.find(p => p.id === selectedId) || null;
  const query = q.trim().toLowerCase();
  const filtered = parameters.filter(p => !query || [p.code, p.name, p.shortName].some(v => (v || "").toLowerCase().includes(query)));
  function select(id) {
    setSelectedIds(prev => (prev || [])[0] === id ? [] : [id]);
  }
  function remove() {
    setSelectedIds([]);
  }
  if (parameters.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "text-xs p-2 rounded flex items-center gap-1.5",
      style: { background: C.warnBg, color: C.warn }
    }, /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 13 }), "No parameters defined yet — add some in Test Configuration \u203a Parameters first, then come back to link them here.");
  }
  const listBody = filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2",
    style: { color: C.muted }
  }, "No parameters match.") : filtered.map(p => /*#__PURE__*/React.createElement("label", {
    key: p.id,
    className: "flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer",
    style: { borderTop: `1px solid ${C.border}` }
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "linked-parameter",
    checked: selectedId === p.id,
    onChange: () => select(p.id)
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-semibold",
    style: { color: C.ink }
  }, p.code), /*#__PURE__*/React.createElement("span", {
    style: { color: C.muted }
  }, "— ", p.name, p.shortName ? ` (${p.shortName})` : "", p.unit ? ` (${p.unit})` : "")));
  return /*#__PURE__*/React.createElement("div", { className: "flex flex-col gap-2" },
    selected && /*#__PURE__*/React.createElement("div", { className: "flex flex-wrap gap-1.5" },
      /*#__PURE__*/React.createElement("span", {
        className: "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold",
        style: { background: C.okBg, color: C.ok }
      }, selected.code || selected.name, /*#__PURE__*/React.createElement("button", {
        type: "button",
        onClick: remove,
        "aria-label": `Remove ${selected.name}`,
        className: "ml-0.5"
      }, /*#__PURE__*/React.createElement(Icon, { name: "x", size: 10 })))),
    !selected && /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "No parameter linked yet — pick one from the list below. This test type will report that single parameter."),
    /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-1.5 text-xs",
      style: { color: C.muted }
    }, /*#__PURE__*/React.createElement(Icon, { name: "search", size: 13 }),
      /*#__PURE__*/React.createElement("input", {
        value: q,
        onChange: e => setQ(e.target.value),
        placeholder: "Search parameters to attach…",
        className: "border rounded px-2 py-1 text-xs w-56",
        style: { borderColor: C.border }
      })),
    /*#__PURE__*/React.createElement("div", {
      className: "rounded max-h-48 overflow-y-auto",
      style: { border: `1px solid ${C.border}` }
    }, listBody)
  );
}
function CollapsibleSection({
  step,
  title,
  subtitle,
  defaultOpen = true,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOpen(o => !o),
    className: "w-full flex items-center gap-2.5 px-3 py-2.5 text-left",
    style: {
      background: C.subtle
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center justify-center rounded-full text-xs font-bold shrink-0",
    style: {
      width: 22,
      height: 22,
      background: C.teal,
      color: "#fff"
    }
  }, step), /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold",
    style: {
      color: C.ink
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, subtitle)), /*#__PURE__*/React.createElement(Icon, {
    name: open ? "chevronDown" : "chevronRight",
    size: 16,
    color: C.muted
  })), open && /*#__PURE__*/React.createElement("div", {
    className: "p-3 flex flex-col gap-3",
    style: {
      borderTop: `1px solid ${C.border}`
    }
  }, children));
}
// ============================================================================
// CALCULATED RESULTS EDITOR — define one or more result parameters for a
// method (e.g. "Free Chlorine (mg/L)"), each with its own input variables
// and a formula (evaluated by 15-formula-engine.js, no eval()). Includes a
// live "try it" calculator so whoever designs the method can sanity-check
// the formula before saving.
// ============================================================================
function ResultParameterEditor({
  resultParameters,
  setResultParameters,
  linkedParameter
}) {
  function addParam() {
    setResultParameters(prev => [...prev, {
      id: uid("rp"),
      name: "",
      unit: "",
      roundTo: 2,
      formula: "",
      inputs: [{
        id: uid("in"),
        key: "A",
        label: ""
      }]
    }]);
  }
  function updateParam(id, patch) {
    setResultParameters(prev => prev.map(p => p.id === id ? {
      ...p,
      ...patch
    } : p));
  }
  function removeParam(id) {
    setResultParameters(prev => prev.filter(p => p.id !== id));
  }
  function addInput(paramId) {
    setResultParameters(prev => prev.map(p => p.id === paramId ? {
      ...p,
      inputs: [...p.inputs, {
        id: uid("in"),
        key: nextVarKey(p.inputs),
        label: ""
      }]
    } : p));
  }
  function updateInput(paramId, inputId, patch) {
    setResultParameters(prev => prev.map(p => p.id === paramId ? {
      ...p,
      inputs: p.inputs.map(inp => inp.id === inputId ? {
        ...inp,
        ...patch
      } : inp)
    } : p));
  }
  function removeInput(paramId, inputId) {
    setResultParameters(prev => prev.map(p => p.id === paramId ? {
      ...p,
      inputs: p.inputs.filter(inp => inp.id !== inputId)
    } : p));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, resultParameters.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "No calculated results yet — optional. If this method's final value is computed from raw readings (e.g. titration volume, dilution factor), define it here so Add Test Record computes it automatically instead of the tester doing the math by hand."), resultParameters.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "rounded p-3",
    style: {
      border: `1px solid ${C.border}`,
      background: C.subtle
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-2 flex-1"
  }, /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement(TextField, {
      label: "Result Name",
      value: linkedParameter
        ? (linkedParameter.shortName ? `${linkedParameter.name} (${linkedParameter.shortName})` : linkedParameter.name)
        : p.name,
      onChange: linkedParameter ? undefined : e => updateParam(p.id, { name: e.target.value }),
      readOnly: !!linkedParameter,
      placeholder: "e.g. Free Chlorine",
      style: linkedParameter ? { background: "#f3f4f6", cursor: "not-allowed" } : undefined
    }),
    linkedParameter && /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] mt-0.5",
      style: { color: C.teal }
    }, "\u2190 auto-filled from linked parameter")
  ), /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement(TextField, {
      label: "Unit",
      value: linkedParameter ? (linkedParameter.unit || "") : p.unit,
      onChange: linkedParameter ? undefined : e => updateParam(p.id, { unit: e.target.value }),
      readOnly: !!linkedParameter,
      placeholder: "e.g. mg/L",
      style: linkedParameter ? { background: "#f3f4f6", cursor: "not-allowed" } : undefined
    }),
    linkedParameter && /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] mt-0.5",
      style: { color: C.teal }
    }, "\u2190 auto-filled from linked parameter")
  ), /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement(TextField, {
      label: "Round To (decimals)",
      type: "number",
      min: "0",
      value: linkedParameter
        ? (linkedParameter.decimalPlaces != null ? linkedParameter.decimalPlaces : p.roundTo)
        : p.roundTo,
      onChange: linkedParameter ? undefined : e => updateParam(p.id, { roundTo: Number(e.target.value) || 0 }),
      readOnly: !!linkedParameter,
      style: linkedParameter ? { background: "#f3f4f6", cursor: "not-allowed" } : undefined
    }),
    linkedParameter && /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] mt-0.5",
      style: { color: C.teal }
    }, "\u2190 auto-filled from linked parameter")
  )), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeParam(p.id),
    className: "mt-5 p-1.5 rounded",
    style: {
      color: C.warn
    },
    title: "Remove result"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium mb-1",
    style: {
      color: C.muted
    }
  }, "Input Variables (used in the formula below)"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-1.5"
  }, p.inputs.map(inp => /*#__PURE__*/React.createElement("div", {
    key: inp.id,
    className: "flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("input", {
    value: inp.key,
    onChange: e => updateInput(p.id, inp.id, {
      key: e.target.value.replace(/[^A-Za-z0-9_]/g, "")
    }),
    className: "px-2 py-1 rounded text-xs font-mono w-16 text-center",
    style: {
      border: `1px solid ${C.border}`
    },
    placeholder: "A"
  }), /*#__PURE__*/React.createElement("input", {
    value: inp.label,
    onChange: e => updateInput(p.id, inp.id, {
      label: e.target.value
    }),
    className: "px-2 py-1 rounded text-xs flex-1",
    style: {
      border: `1px solid ${C.border}`
    },
    placeholder: "What the tester enters, e.g. Titration Volume (mL)"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeInput(p.id, inp.id),
    className: "p-1",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 13
  })))), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: () => addInput(p.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 12
  }), "Add Input Variable"))), /*#__PURE__*/React.createElement(TextField, {
    label: "Formula",
    value: p.formula,
    onChange: e => updateParam(p.id, {
      formula: e.target.value
    }),
    placeholder: `e.g. (${p.inputs.map(i => i.key).join(" - ")}) * 1000 / V`
  }), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-1",
    style: {
      color: C.muted
    }
  }, "Use the variable keys above (case-sensitive). Supported: + − × ÷ ^ ( ) and functions abs(), round(x,d), min(), max(), sqrt(), log10(), ln()."), !p.formula.trim() && p.inputs.length === 1 && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-1 p-1.5 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Left blank with a single input — the raw reading entered in Add Test Record will be used as the result as-is (no conversion)."), !p.formula.trim() && p.inputs.length > 1 && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-1 p-1.5 rounded",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, "A formula is required here — with ", p.inputs.length, " inputs there's no single value to fall back to. Add Test Record will show \"No formula set\" until one is added."), /*#__PURE__*/React.createElement(FormulaTryIt, {
    param: p
  }))), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: addParam
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  }), "Add Calculated Result"));
}
function nextVarKey(inputs) {
  const used = new Set(inputs.map(i => i.key));
  for (let code = 65; code < 91; code++) {
    const k = String.fromCharCode(code);
    if (!used.has(k)) return k;
  }
  return `V${inputs.length + 1}`;
}
function FormulaTryIt({
  param
}) {
  const [testValues, setTestValues] = useState({});
  const variables = {};
  param.inputs.forEach(inp => {
    variables[inp.key] = testValues[inp.id] !== undefined && testValues[inp.id] !== "" ? Number(testValues[inp.id]) : 0;
  });
  const hasSingleInputPassthrough = !param.formula.trim() && param.inputs.length === 1;
  const result = param.formula.trim() ? evaluateFormula(param.formula, variables) : hasSingleInputPassthrough ? {
    ok: true,
    value: variables[param.inputs[0].key]
  } : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-2 p-2 rounded",
    style: {
      background: C.bg,
      border: `1px dashed ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] font-semibold mb-1.5",
    style: {
      color: C.muted
    }
  }, "Try it — sample values to sanity-check the formula"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 mb-1.5"
  }, param.inputs.map(inp => /*#__PURE__*/React.createElement("label", {
    key: inp.id,
    className: "flex items-center gap-1 text-[11px]",
    style: {
      color: C.ink
    }
  }, inp.key, "=", /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: testValues[inp.id] ?? "",
    onChange: e => setTestValues(prev => ({
      ...prev,
      [inp.id]: e.target.value
    })),
    className: "px-1.5 py-0.5 rounded w-16 text-xs",
    style: {
      border: `1px solid ${C.border}`
    }
  })))), result && (result.ok ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium",
    style: {
      color: C.ok
    }
  }, "Result = ", fmtNum(+result.value.toFixed(param.roundTo ?? 2)), " ", param.unit) : /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium flex items-center gap-1",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 11
  }), result.error)));
}

// ============================================================================
// QC ACCEPTANCE RULES EDITOR — attach acceptance criteria to a method
// (blank / duplicate RPD / spike recovery / calibration R² / other). Actual
// control-charting and trend analysis is the separate QC module; this is
// the method-design side — what "in spec" means for this test.
// ============================================================================
function QcRuleEditor({
  qcRules,
  setQcRules,
  linkedParameter
}) {
  function addRule() {
    setQcRules(prev => [...prev, {
      id: uid("qc"),
      qcType: "blank",
      label: "",
      comparator: "lt",
      limitLow: 0,
      limitHigh: 0,
      unit: linkedParameter ? (linkedParameter.unit || "") : "",
      notes: "",
      targetMean: null,
      targetSD: null,
      bracketingInterval: null,
      bracketingIncludesBlank: true,
      bracketingConcentrations: [{ id: uid("bkc"), label: "", value: "", comparator: "between", limitLow: 0, limitHigh: 0 }]
    }]);
  }
  function update(id, patch) {
    setQcRules(prev => prev.map(r => r.id === id ? {
      ...r,
      ...patch
    } : r));
  }
  function remove(id) {
    setQcRules(prev => prev.filter(r => r.id !== id));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, qcRules.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "No QC acceptance rules yet — optional. Define what counts as \"in spec\" for blanks, duplicates, spikes, or calibration curves on this method. In Add Test Record, a tester can mark a run as one of these QC types and get an immediate pass/fail against the rule."), qcRules.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    className: "rounded p-3",
    style: {
      border: `1px solid ${C.border}`,
      background: C.subtle
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-2 flex-1"
  }, /*#__PURE__*/React.createElement(SelectField, {
    label: "QC Type",
    value: r.qcType,
    onChange: e => update(r.id, {
      qcType: e.target.value
    }),
    options: QC_RULE_TYPES
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Label",
    value: r.label,
    onChange: e => update(r.id, {
      label: e.target.value
    }),
    placeholder: "e.g. Method Blank ≤ MDL"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => remove(r.id),
    className: "mt-5 p-1.5 rounded",
    style: {
      color: C.warn
    },
    title: "Remove rule"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2"
  }, r.qcType !== "bracketing" && /*#__PURE__*/React.createElement(SelectField, {
    label: "Comparator",
    value: r.comparator,
    onChange: e => update(r.id, {
      comparator: e.target.value
    }),
    options: QC_COMPARATORS
  }), r.qcType !== "bracketing" && /*#__PURE__*/React.createElement(TextField, {
    label: r.comparator === "between" ? "Lower Limit" : "Limit",
    type: "number",
    value: r.limitLow,
    onChange: e => update(r.id, {
      limitLow: Number(e.target.value) || 0
    })
  }), r.qcType !== "bracketing" && r.comparator === "between" && /*#__PURE__*/React.createElement(TextField, {
    label: "Upper Limit",
    type: "number",
    value: r.limitHigh,
    onChange: e => update(r.id, {
      limitHigh: Number(e.target.value) || 0
    })
  }), /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement(TextField, {
      label: "Unit",
      value: linkedParameter ? (linkedParameter.unit || "") : r.unit,
      onChange: linkedParameter ? undefined : e => update(r.id, { unit: e.target.value }),
      readOnly: !!linkedParameter,
      placeholder: "e.g. %, mg/L",
      style: linkedParameter ? { background: "#f3f4f6", cursor: "not-allowed" } : undefined
    }),
    linkedParameter && /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] mt-0.5",
      style: { color: C.teal }
    }, "\u2190 auto-filled from linked parameter")
  )), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Target Mean (optional, for QC control chart)",
    type: "number",
    value: r.targetMean ?? "",
    onChange: e => update(r.id, {
      targetMean: e.target.value === "" ? null : Number(e.target.value)
    }),
    placeholder: "leave blank to auto-calculate"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Target SD (optional)",
    type: "number",
    value: r.targetSD ?? "",
    onChange: e => update(r.id, {
      targetSD: e.target.value === "" ? null : Number(e.target.value)
    }),
    placeholder: "leave blank to auto-calculate"
  })), r.qcType === "bracketing" && /*#__PURE__*/React.createElement("div", {
    className: "mt-2 rounded p-2.5",
    style: { border: `1px solid ${C.border}`, background: C.bg }
  },
    /*#__PURE__*/React.createElement("div", {
      className: "text-xs font-semibold mb-2",
      style: { color: C.ink }
    }, "Bracketing QC Design"),
    /*#__PURE__*/React.createElement(TextField, {
      label: "Bracketing Interval (insert a QC checkpoint every N field samples)",
      type: "number",
      value: r.bracketingInterval ?? "",
      onChange: e => update(r.id, {
        bracketingInterval: e.target.value === "" ? null : Number(e.target.value)
      }),
      placeholder: "e.g. 10 — also brackets the very first and last sample"
    }),
    /*#__PURE__*/React.createElement("label", {
      className: "flex items-center gap-2 text-xs mt-2",
      style: { color: C.ink }
    },
      /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: r.bracketingIncludesBlank !== false,
        onChange: e => update(r.id, { bracketingIncludesBlank: e.target.checked })
      }),
      "Include a Blank sample at the start of each bracketing sequence"
    ),
    /*#__PURE__*/React.createElement("div", { className: "mt-2" },
      /*#__PURE__*/React.createElement("div", {
        className: "text-xs font-medium mb-1",
        style: { color: C.muted }
      }, "Known Concentration Standards (placed at each bracketing interval)"),
      /*#__PURE__*/React.createElement("div", {
        className: "text-[11px] mb-2 p-1.5 rounded",
        style: { background: C.infoBg, color: C.info }
      }, "\"Target Value\" is just a reference label for the tester (the nominal strength of that standard). Pass/fail at Add Test Record is decided ONLY by that standard's own Comparator and Limit(s) below — set both for every standard, or its checkpoint can never be evaluated."),
      (r.bracketingConcentrations || []).map((bc, idx) =>
        /*#__PURE__*/React.createElement("div", {
          key: bc.id,
          className: "p-2 rounded mb-2",
          style: { background: "#fff", border: `1px solid ${C.border}` }
        },
          /*#__PURE__*/React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2 mb-2" },
            /*#__PURE__*/React.createElement("div", { className: "flex items-center gap-2" },
              /*#__PURE__*/React.createElement("span", { className: "text-[11px] font-mono", style: { color: C.muted } }, idx + 1 + "."),
              /*#__PURE__*/React.createElement("div", { className: "flex-1" },
                /*#__PURE__*/React.createElement(TextField, {
                  label: "Label",
                  value: bc.label,
                  onChange: e => update(r.id, {
                    bracketingConcentrations: (r.bracketingConcentrations || []).map(x =>
                      x.id === bc.id ? { ...x, label: e.target.value } : x
                    )
                  }),
                  placeholder: "e.g. Low Std"
                })
              )
            ),
            /*#__PURE__*/React.createElement("div", { className: "flex items-center gap-2" },
              /*#__PURE__*/React.createElement("div", { className: "flex-1" },
                /*#__PURE__*/React.createElement(TextField, {
                  label: `Target Value${linkedParameter?.unit ? ` (${linkedParameter.unit})` : ""}`,
                  type: "number",
                  value: bc.value,
                  onChange: e => update(r.id, {
                    bracketingConcentrations: (r.bracketingConcentrations || []).map(x =>
                      x.id === bc.id ? { ...x, value: e.target.value } : x
                    )
                  })
                })
              ),
              (r.bracketingConcentrations || []).length > 1 &&
                /*#__PURE__*/React.createElement("button", {
                  onClick: () => update(r.id, {
                    bracketingConcentrations: (r.bracketingConcentrations || []).filter(x => x.id !== bc.id)
                  }),
                  className: "mt-5 p-1.5",
                  style: { color: C.warn }
                }, /*#__PURE__*/React.createElement(Icon, { name: "trash", size: 14 }))
            )
          ),
          /*#__PURE__*/React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2" },
            /*#__PURE__*/React.createElement(SelectField, {
              label: "Comparator",
              value: bc.comparator || "between",
              onChange: e => update(r.id, {
                bracketingConcentrations: (r.bracketingConcentrations || []).map(x =>
                  x.id === bc.id ? { ...x, comparator: e.target.value } : x
                )
              }),
              options: QC_COMPARATORS
            }),
            /*#__PURE__*/React.createElement(TextField, {
              label: (bc.comparator || "between") === "between" ? "Lower Limit" : "Limit",
              type: "number",
              value: bc.limitLow ?? "",
              onChange: e => update(r.id, {
                bracketingConcentrations: (r.bracketingConcentrations || []).map(x =>
                  x.id === bc.id ? { ...x, limitLow: Number(e.target.value) || 0 } : x
                )
              })
            }),
            (bc.comparator || "between") === "between" && /*#__PURE__*/React.createElement(TextField, {
              label: "Upper Limit",
              type: "number",
              value: bc.limitHigh ?? "",
              onChange: e => update(r.id, {
                bracketingConcentrations: (r.bracketingConcentrations || []).map(x =>
                  x.id === bc.id ? { ...x, limitHigh: Number(e.target.value) || 0 } : x
                )
              })
            })
          )
        )
      ),
      /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outline",
        onClick: () => update(r.id, {
          bracketingConcentrations: [...(r.bracketingConcentrations || []), { id: uid("bkc"), label: "", value: "", comparator: "between", limitLow: 0, limitHigh: 0 }]
        })
      }, /*#__PURE__*/React.createElement(Icon, { name: "plus", size: 12 }), "Add Concentration Standard")
    )
  ), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-1",
    style: {
      color: C.muted
    }
  }, "If Target Mean/SD are left blank, the QC Module control chart calculates them automatically from this method's accumulated QC points."), /*#__PURE__*/React.createElement(TextField, {
    label: "Notes (optional)",
    value: r.notes,
    onChange: e => update(r.id, {
      notes: e.target.value
    }),
    textarea: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-1",
    style: {
      color: C.muted
    }
  }, "Preview: passes when the measured value is ", qcComparatorLabel(r), "."))), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: addRule
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  }), "Add QC Rule"));
}
function TestTypeBuilder({
  chemicals,
  setChemicals,
  masterChemicals,
  setMasterChemicals,
  notify,
  equipment,
  gasList,
  parameters,
  onSave,
  onCancel,
  initial
}) {
  const [testName, setTestName] = useState(initial?.testName || "");
  const [method, setMethod] = useState(initial?.method || "");
  const [linkedParameterIds, setLinkedParameterIds] = useState(initial?.linkedParameterIds || []);
  const [costPerTest, setCostPerTest] = useState(initial ? String(initial.costPerTest ?? 0) : "");
  // Submit-guard: onSave() is synchronous, but a fast double-click can still
  // fire it twice before React disables the button — this ref stops it cold.
  const savingRef = React.useRef(false);
  const [defaultEquipmentId, setDefaultEquipmentId] = useState(initial?.defaultEquipmentId || "");
  const [chemicalRequirements, setChemicalRequirements] = useState(initial?.chemicalRequirements || []);
  const [gasRequirements, setGasRequirements] = useState(initial?.gasRequirements || []);
  const [dilutionEnabled, setDilutionEnabled] = useState(initial?.dilutionEnabled || false);
  const [dilutionChemicalRequirements, setDilutionChemicalRequirements] = useState(initial?.dilutionChemicalRequirements || []);
  const [dilutionGasRequirements, setDilutionGasRequirements] = useState(initial?.dilutionGasRequirements || []);
  const [resultParameters, setResultParameters] = useState(initial?.resultParameters || []);
  const [qcRules, setQcRules] = useState(initial?.qcRules || []);
  const [qcFrequency, setQcFrequency] = useState(initial?.qcFrequency ? String(initial.qcFrequency) : "");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // A Test Type now reports exactly one Parameter (see ParameterLinker). Once
  // that Parameter is picked, Name / Method / Cost are no longer typed by
  // hand — they're derived straight from the Parameter master record and
  // kept in lock-step with it:
  //   Name   = "<Parameter Name> (<Parameter Short Name>)", e.g. "Iron (Fe)"
  //   Method = the Parameter's Method Ref
  //   Cost   = the Parameter's Standard Fee
  // These three fields are disabled (locked) below whenever a parameter is
  // linked, so the only way to change them is to edit the Parameter itself
  // in Test Configuration › Parameters.
  const linkedParameter = linkedParameterIds.length > 0
    ? (parameters || []).find(x => x.id === linkedParameterIds[0]) || null
    : null;
  const fieldsLocked = !!linkedParameter;
  React.useEffect(() => {
    if (!linkedParameter) return;
    const autoName = linkedParameter.shortName
      ? `${linkedParameter.name} (${linkedParameter.shortName})`
      : linkedParameter.name;
    setTestName(autoName || "");
    setMethod(linkedParameter.methodRef || "");
    const fee = Number(linkedParameter.standardFee);
    setCostPerTest(Number.isFinite(fee) ? String(fee) : "0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedParameter]);
  const chemOptions = {
    raw: chemicals,
    options: chemicals.map(c => ({
      value: c.id,
      label: `${c.name} (${c.unit})`
    }))
  };
  const equipOptions = equipment.map(e => ({
    value: e.id,
    label: e.name
  }));
  const combinedName = fieldsLocked
    ? testName.trim()
    : [testName.trim(), method.trim()].filter(Boolean).join("-");

  // Inline validation — same red-border + message-below-field pattern used in Add Test Record.
  const errors = {};
  if (submitAttempted) {
    if (!testName.trim()) errors.testName = "Test Name is required.";
    if (costPerTest === "") errors.costPerTest = "Standard Fee (per test) is required.";
    if (chemicalRequirements.some(r => !r.chemicalId)) errors.chemicalRequirements = "Every Chemical Requirement row needs a linked chemical selected (or remove the empty row).";
    if (dilutionEnabled && dilutionChemicalRequirements.some(r => !r.chemicalId)) errors.dilutionChemicalRequirements = "Every Dilution Chemical Requirement row needs a linked chemical selected (or remove the empty row).";
  }
  const hasErrors = Object.keys(errors).length > 0;
  function handleSubmit() {
    if (savingRef.current) return;
    setSubmitAttempted(true);
    const invalid = !testName.trim() || costPerTest === "" || chemicalRequirements.some(r => !r.chemicalId) || dilutionEnabled && dilutionChemicalRequirements.some(r => !r.chemicalId);
    if (invalid) return;
    savingRef.current = true;
    // Normalize QC rules before persisting: the design screen's Comparator
    // dropdown falls back to displaying "between" whenever a bracketing
    // concentration's comparator was never actually written (bc.comparator
    // || "between"), which used to let a row look correctly configured on
    // screen while saving with an empty comparator underneath. Bake that
    // same default into the saved data here so what's stored always matches
    // what's shown, and downstream evaluation never has to guess.
    const normalizedQcRules = qcRules.map(r => ({
      ...r,
      bracketingConcentrations: (r.bracketingConcentrations || []).map(bc => ({
        ...bc,
        comparator: bc.comparator || "between"
      }))
    }));
    onSave({
      id: initial?.id || uid("test"),
      testName: testName.trim(),
      method: method.trim(),
      name: combinedName || testName.trim(),
      costPerTest: Number(costPerTest) || 0,
      defaultEquipmentId,
      linkedParameterIds,
      chemicalRequirements,
      gasRequirements,
      dilutionEnabled,
      dilutionChemicalRequirements: dilutionEnabled ? dilutionChemicalRequirements : [],
      dilutionGasRequirements: dilutionEnabled ? dilutionGasRequirements : [],
      resultParameters,
      qcRules: normalizedQcRules,
      qcFrequency: qcFrequency === "" ? null : Number(qcFrequency)
    });
    savingRef.current = false;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, submitAttempted && hasErrors && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center gap-1.5",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), "Please fix the highlighted field(s) below before saving."), /*#__PURE__*/React.createElement(CollapsibleSection, {
    step: 1,
    title: "Basic Info",
    subtitle: "Select the single parameter this test type covers — name, method & cost auto-fill and lock, then set default equipment"
  }, /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("div", {
      className: "text-xs font-semibold mb-1.5",
      style: { color: C.ink }
    }, "Parameter this Test Type reports"),
    /*#__PURE__*/React.createElement(ParameterLinker, {
      parameters: parameters || [],
      selectedIds: linkedParameterIds,
      setSelectedIds: setLinkedParameterIds
    })
  ), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: fieldsLocked ? "Name of Test (locked — from Parameter)" : "Name of Test",
    value: testName,
    onChange: e => setTestName(e.target.value),
    placeholder: "e.g. Arsenic (As)",
    error: errors.testName,
    disabled: fieldsLocked,
    style: fieldsLocked ? { background: C.bg, color: C.muted, cursor: "not-allowed" } : undefined
  }), /*#__PURE__*/React.createElement(TextField, {
    label: fieldsLocked ? "Method (locked — from Parameter)" : "Method",
    value: method,
    onChange: e => setMethod(e.target.value),
    placeholder: "e.g. HVG",
    disabled: fieldsLocked,
    style: fieldsLocked ? { background: C.bg, color: C.muted, cursor: "not-allowed" } : undefined
  })), fieldsLocked && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center gap-1.5",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 13
  }), "Name, Method and Cost are locked — they're taken automatically from the linked parameter \"", linkedParameter.name, linkedParameter.shortName ? ` (${linkedParameter.shortName})` : "", "\". To change them, edit the parameter in Test Configuration \u203a Parameters."), combinedName && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.okBg,
      color: C.ok
    }
  }, "This test type will be saved as: ", /*#__PURE__*/React.createElement("strong", null, combinedName)), /*#__PURE__*/React.createElement(TextField, {
    label: fieldsLocked ? "Standard Fee (per test) — locked, from Parameter" : "Standard Fee (per test)",
    type: "number",
    min: "0",
    value: costPerTest,
    onChange: e => setCostPerTest(e.target.value),
    placeholder: "e.g. 100 — use 0 for free tests",
    error: errors.costPerTest,
    disabled: fieldsLocked,
    style: fieldsLocked ? { background: C.bg, color: C.muted, cursor: "not-allowed" } : undefined
  }), fieldsLocked && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.okBg,
      color: C.ok
    }
  }, "Auto-filled from the Standard Fee set on the linked parameter — unlink the parameter above if this test type needs a different name, method, or fee."), /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Whether a fee is actually collected is decided per test record (in Add Test Record) — not fixed here — since the same test type can sometimes be billed and sometimes free."), /*#__PURE__*/React.createElement(SelectField, {
    label: "Default Equipment (from Inventory)",
    value: defaultEquipmentId,
    onChange: e => setDefaultEquipmentId(e.target.value),
    options: equipOptions,
    placeholder: "None — choose later"
  }), equipment.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center gap-1.5",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), "No equipment in inventory yet — you can still save this test type and set equipment later.")), /*#__PURE__*/React.createElement(CollapsibleSection, {
    step: 2,
    title: "Chemical Requirement",
    subtitle: "Which chemicals this test consumes from inventory, and how much",
    defaultOpen: chemicalRequirements.length > 0
  }, chemicals.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center gap-1.5",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), "No chemicals in inventory yet — you can still save this test type without a chemical requirement."), /*#__PURE__*/React.createElement(RequirementEditor, {
    title: "Chemical Requirement",
    addLabel: "Chemical Requirement",
    sampleAmountKind: "standardOrField",
    hint: "Some tests don't consume any chemical from inventory — you can save a test type with no chemical requirement below. Each No. of Sample × Amount item must say whether it's driven by Field Samples, Standard Samples, or both — that's what auto-fills the count in Add Test Record. Dummy defaults you set here pre-fill Add Test Record; if nobody edits them, that value is used as-is.",
    requirements: chemicalRequirements,
    setRequirements: setChemicalRequirements,
    chemOptions: chemOptions,
    chemicalsEmpty: chemicals.length === 0,
    showErrors: submitAttempted,
    chemicals: chemicals,
    setChemicals: setChemicals,
    masterChemicals: masterChemicals,
    setMasterChemicals: setMasterChemicals,
    notify: notify
  })), /*#__PURE__*/React.createElement(CollapsibleSection, {
    step: 3,
    title: "Gas Requirement",
    subtitle: "Optional — e.g. Acetylene, Argon",
    defaultOpen: gasRequirements.length > 0
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Tick which gas(es) this test may need. In Add Test Record the tester then picks which specific cylinder was used and how much was drawn — deducted from that cylinder only."), /*#__PURE__*/React.createElement(GasRequirementPicker, {
    gasList: gasList,
    selected: gasRequirements,
    setSelected: setGasRequirements
  })), /*#__PURE__*/React.createElement(CollapsibleSection, {
    step: 4,
    title: "Dilution Settings",
    subtitle: "Optional — extra requirements when a sample needs dilution",
    defaultOpen: dilutionEnabled
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-xs font-semibold",
    style: {
      color: C.ink
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: dilutionEnabled,
    onChange: e => setDilutionEnabled(e.target.checked)
  }), "This test may need Dilution for high-concentration (absurd) results"), dilutionEnabled && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Design what's needed for dilution here — Add Test Record will simply show a \"Dilution Required?\" tick plus these fields, no need to build them fresh each time. Dilution amounts are driven by a separate \"No. of Samples Requiring Dilution\" count, and only ever affect inventory deduction — never revenue."), /*#__PURE__*/React.createElement(RequirementEditor, {
    title: "Dilution Chemical Requirement",
    addLabel: "Dilution Chemical Requirement",
    sampleAmountKind: "dilution",
    hint: "No. of Sample × Amount items here are driven by No. of Samples Requiring Dilution (entered in Add Test Record).",
    requirements: dilutionChemicalRequirements,
    setRequirements: setDilutionChemicalRequirements,
    chemOptions: chemOptions,
    chemicalsEmpty: chemicals.length === 0,
    showErrors: submitAttempted,
    chemicals: chemicals,
    setChemicals: setChemicals,
    masterChemicals: masterChemicals,
    setMasterChemicals: setMasterChemicals,
    notify: notify
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1.5",
    style: {
      color: C.ink
    }
  }, "Dilution Gas Requirement (optional)"), /*#__PURE__*/React.createElement(GasRequirementPicker, {
    gasList: gasList,
    selected: dilutionGasRequirements,
    setSelected: setDilutionGasRequirements
  })))), /*#__PURE__*/React.createElement(CollapsibleSection, {
    step: 5,
    title: "Calculated Results (Formulas)",
    subtitle: "Optional — auto-compute the final value from raw readings",
    defaultOpen: resultParameters.length > 0
  }, /*#__PURE__*/React.createElement(ResultParameterEditor, {
    resultParameters: resultParameters,
    setResultParameters: setResultParameters,
    linkedParameter: linkedParameter
  })), /*#__PURE__*/React.createElement(CollapsibleSection, {
    step: 6,
    title: "QC Acceptance Rules",
    subtitle: "Optional — acceptance criteria for blanks, duplicates, spikes, calibration",
    defaultOpen: qcRules.length > 0
  }, /*#__PURE__*/React.createElement(QcRuleEditor, {
    qcRules: qcRules,
    setQcRules: setQcRules,
    linkedParameter: linkedParameter
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 pt-3",
    style: {
      borderTop: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "QC Frequency — warn if a Test Run exceeds this many samples without a QC check",
    type: "number",
    value: qcFrequency,
    onChange: e => setQcFrequency(e.target.value),
    placeholder: "e.g. 15 (leave blank to disable this reminder)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleSubmit
  }, initial ? "Update Test Type" : "Save Test Type")));
}

// ============================================================================
// TEST TYPES TAB — create/manage test type designs (moved out of Add Test Record)
// ============================================================================
// ============================================================================
// TEST CONFIGURATION TAB — top-level shell for the renamed "Test Type"
// module. Two sub-tabs: Parameters (lightweight analytical-parameter master
// list) and Test Types (the existing Test Method Engine, now also able to
// link Parameters). Mirrors the pill sub-nav pattern already used by
// InventoryTab (Equipment/Glassware/Chemicals/Gas).
// ============================================================================
function TestConfigurationTab({
  testConfigTab,
  setTestConfigTab,
  parameters,
  setParameters,
  testTypes,
  setTestTypes,
  chemicals,
  setChemicals,
  equipment,
  setEquipment,
  gasList,
  setGasList,
  masterChemicals,
  setMasterChemicals,
  testRecords,
  session,
  permissionMatrix,
  notify
}) {
  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("div", { className: "flex gap-2 mb-5" },
      [{ k: "parameters", label: "Parameters", icon: "list" }, { k: "testTypes", label: "Test Types", icon: "beaker" }].map(s =>
        /*#__PURE__*/React.createElement("button", {
          key: s.k,
          onClick: () => setTestConfigTab(s.k),
          className: "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium",
          style: {
            background: testConfigTab === s.k ? C.teal : "#fff",
            color: testConfigTab === s.k ? "#fff" : C.muted,
            border: `1px solid ${testConfigTab === s.k ? C.teal : C.border}`
          }
        }, /*#__PURE__*/React.createElement(Icon, { name: s.icon, size: 14 }), s.label))
    ),
    testConfigTab === "parameters" && /*#__PURE__*/React.createElement(ParametersTab, {
      parameters: parameters,
      setParameters: setParameters,
      testTypes: testTypes,
      session: session,
      permissionMatrix: permissionMatrix,
      notify: notify
    }),
    testConfigTab === "testTypes" && /*#__PURE__*/React.createElement(TestTypesTab, {
      testTypes: testTypes,
      setTestTypes: setTestTypes,
      chemicals: chemicals,
      setChemicals: setChemicals,
      equipment: equipment,
      setEquipment: setEquipment,
      gasList: gasList,
      setGasList: setGasList,
      masterChemicals: masterChemicals,
      setMasterChemicals: setMasterChemicals,
      parameters: parameters,
      setParameters: setParameters,
      testRecords: testRecords,
      session: session,
      permissionMatrix: permissionMatrix,
      notify: notify
    })
  );
}

function TestTypesTab({
  testTypes,
  setTestTypes,
  chemicals,
  setChemicals,
  equipment,
  setEquipment,
  gasList,
  setGasList,
  masterChemicals,
  setMasterChemicals,
  parameters,
  setParameters,
  testRecords,
  session,
  permissionMatrix,
  notify
}) {
  const ttCreateGate = permGate(permissionMatrix, session, "testTypes", "create", notify, "add test types");
  const ttEditGate = permGate(permissionMatrix, session, "testTypes", "edit", notify, "edit test types");
  const ttDeleteGate = permGate(permissionMatrix, session, "testTypes", "delete", notify, "delete test types");
  const canCreateTestTypes = ttCreateGate.visible;
  const canEditTestTypes = ttEditGate.visible;
  const canDeleteTestTypes = ttDeleteGate.visible;
  function parameterSummary(t) {
    return (t.linkedParameterIds || []).map(id => (parameters || []).find(p => p.id === id)).filter(Boolean);
  }
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importStage, setImportStage] = useState("select"); // select | preview | importing | done
  const [importFile, setImportFile] = useState(null);
  const [importParsed, setImportParsed] = useState(null); // { drafts, errors }
  const [importProgress, setImportProgress] = useState(0);
  const [importFileError, setImportFileError] = useState("");
  // ---- Data Density redesign: the list used to be one full SectionCard per
  // test type stacked vertically (very tall, very little visible at once).
  // Now a dense, sticky-header, zebra-striped table — click a row to expand
  // its chemical/gas requirement detail inline, same info as before.
  const [ttSearch, setTtSearch] = useState("");
  const [ttExpanded, setTtExpanded] = useState({});
  const [ttPage, setTtPage] = useState(1);
  const TT_PAGE_SIZE = 12;
  function toggleTtExpand(id) {
    setTtExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }
  function equipmentName(id) {
    return equipment.find(e => e.id === id)?.name || "—";
  }
  function isTestTypeUsed(id) {
    return testRecords.some(r => r.testTypeId === id);
  }
  function handleSave(testType) {
    if (editingType) {
      setTestTypes(prev => prev.map(t => t.id === testType.id ? testType : t));
      DataService.appendAudit({
        entity: "testType",
        entityId: testType.id,
        action: "edit",
        user: session.username,
        role: session.role,
        note: `Updated test type "${testType.name}"`
      });
      notify(`Test type "${testType.name}" updated`);
      setEditingType(null);
    } else {
      setTestTypes(prev => [...prev, testType]);
      DataService.appendAudit({
        entity: "testType",
        entityId: testType.id,
        action: "create",
        user: session.username,
        role: session.role,
        note: `Created test type "${testType.name}"`
      });
      notify(`Test type "${testType.name}" created`);
      setShowBuilder(false);
    }
  }
  function handleDelete(t) {
    if (isTestTypeUsed(t.id)) {
      notify("This test type has existing test records — delete those records first.", "warn");
      setDeleteFor(null);
      return;
    }
    setTestTypes(prev => prev.filter(x => x.id !== t.id));
    setDeleteFor(null);
    DataService.appendAudit({
      entity: "testType",
      entityId: t.id,
      action: "delete",
      user: session.username,
      role: session.role,
      note: `Deleted test type "${t.name}"`
    });
    notify(`Deleted test type "${t.name}"`);
  }

  // ---- Export: bundle a test type + everything it references (chemicals, gases, machine) by
  // name/unit — not by id — so it's portable to a lab whose ids will be totally different. ----
  function exportTestType(t) {
    const chemNames = {};
    [...(t.chemicalRequirements || []), ...(t.dilutionChemicalRequirements || [])].forEach(r => {
      const c = chemicals.find(x => x.id === r.chemicalId);
      if (c) chemNames[r.chemicalId] = {
        name: c.name,
        unit: c.unit
      };
    });
    const gasNames = {};
    [...(t.gasRequirements || []), ...(t.dilutionGasRequirements || [])].forEach(g => {
      const gg = gasList.find(x => x.id === g.gasId);
      if (gg) gasNames[g.gasId] = {
        name: gg.name,
        unit: gg.unit
      };
    });
    const equip = equipment.find(e => e.id === t.defaultEquipmentId);
    // Linked parameter travels with the export by value (code/name/etc, not
    // by id — ids won't match on the receiving lab). If that lab doesn't have
    // this parameter registered yet, importing will auto-create it (same
    // "reuse by name, create what's missing" pattern already used for
    // chemicals/gases/machines below).
    const linkedParam = (t.linkedParameterIds || []).map(id => (parameters || []).find(p => p.id === id)).filter(Boolean)[0] || null;
    const payload = {
      schema: "aqualab-testtype-export-v1",
      exportedAt: new Date().toISOString(),
      testType: {
        testName: t.testName,
        method: t.method,
        name: t.name,
        costPerTest: t.costPerTest,
        feeApplicable: t.feeApplicable,
        dilutionEnabled: t.dilutionEnabled
      },
      linkedParameter: linkedParam ? {
        code: linkedParam.code,
        name: linkedParam.name,
        shortName: linkedParam.shortName,
        unit: linkedParam.unit,
        methodRef: linkedParam.methodRef,
        category: linkedParam.category,
        decimalPlaces: linkedParam.decimalPlaces,
        lod: linkedParam.lod,
        loq: linkedParam.loq,
        tatHours: linkedParam.tatHours,
        standardFee: linkedParam.standardFee,
        minDetection: linkedParam.minDetection,
        maxDetection: linkedParam.maxDetection,
        refLimitMin: linkedParam.refLimitMin,
        refLimitMax: linkedParam.refLimitMax,
        refStandard: linkedParam.refStandard
      } : null,
      defaultEquipmentName: equip ? equip.name : "",
      chemicalRequirements: (t.chemicalRequirements || []).map(r => ({
        chemicalName: chemNames[r.chemicalId]?.name || r.chemical,
        chemicalUnit: chemNames[r.chemicalId]?.unit || "ml",
        optional: !!r.optional,
        items: r.items
      })),
      dilutionChemicalRequirements: (t.dilutionChemicalRequirements || []).map(r => ({
        chemicalName: chemNames[r.chemicalId]?.name || r.chemical,
        chemicalUnit: chemNames[r.chemicalId]?.unit || "ml",
        optional: !!r.optional,
        items: r.items
      })),
      gasRequirements: (t.gasRequirements || []).map(g => ({
        gasName: gasNames[g.gasId]?.name || g.gasName,
        gasUnit: gasNames[g.gasId]?.unit || "kg"
      })),
      dilutionGasRequirements: (t.dilutionGasRequirements || []).map(g => ({
        gasName: gasNames[g.gasId]?.name || g.gasName,
        gasUnit: gasNames[g.gasId]?.unit || "kg"
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `testtype_${(t.name || "export").replace(/[^a-z0-9]+/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Exported test type "${t.name}"`);
  }

  // ---- Import commit: takes one or more "drafts" (each shaped like a flattened test type) and
  // resolves/creates chemicals, gases, and machines by NAME across the whole batch, then creates the
  // test type record(s). Used by both the JSON path (1 draft) and the Excel/CSV path (N drafts, one
  // per distinct TestName+Method group in the sheet). ----
  function commitImportDrafts(drafts) {
    let createdChem = 0,
      reusedChem = 0,
      createdGas = 0,
      reusedGas = 0,
      createdMachine = 0,
      reusedMachine = 0,
      createdParam = 0,
      reusedParam = 0;
    const conflicts = [];
    const nextChemicals = [...chemicals];
    const nextMaster = [...masterChemicals];
    const nextGasList = [...gasList];
    const nextEquipment = [...equipment];
    const nextParameters = [...(parameters || [])];
    const usedNamesThisBatch = [];
    // Resolve a linked parameter by Code (preferred) or Name — reuse the
    // existing registered parameter if this lab already has it, otherwise
    // auto-create it (mirrors resolveChemical/resolveGas/resolveMachine
    // below), so an imported test type is never left unlinked just because
    // the destination lab hadn't registered that parameter yet.
    function resolveParameter(p) {
      if (!p || (!p.code && !p.name)) return null;
      let existing = nextParameters.find(x =>
        (p.code && x.code && x.code.toLowerCase() === p.code.toLowerCase()) ||
        (p.name && x.name && x.name.toLowerCase() === p.name.toLowerCase())
      );
      if (existing) {
        reusedParam++;
        return existing;
      }
      existing = {
        id: uid("param"),
        code: p.code || p.name,
        name: p.name || p.code,
        shortName: p.shortName || "",
        unit: p.unit || "",
        methodRef: p.methodRef || "",
        category: p.category || "Others",
        decimalPlaces: Number.isFinite(Number(p.decimalPlaces)) ? Number(p.decimalPlaces) : 2,
        lod: p.lod ?? "",
        loq: p.loq ?? "",
        tatHours: p.tatHours ?? "",
        standardFee: p.standardFee ?? "",
        minDetection: p.minDetection ?? "",
        maxDetection: p.maxDetection ?? "",
        refLimitMin: p.refLimitMin ?? "",
        refLimitMax: p.refLimitMax ?? "",
        refStandard: p.refStandard || ""
      };
      nextParameters.push(existing);
      createdParam++;
      return existing;
    }
    function resolveChemical(name, unit) {
      if (!name) return null;
      let c = nextChemicals.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (c) {
        reusedChem++;
        return c;
      }
      c = {
        id: uid("chem"),
        name,
        unit: unit || "ml",
        batches: []
      };
      nextChemicals.push(c);
      createdChem++;
      if (!nextMaster.some(m => m.toLowerCase() === name.toLowerCase())) nextMaster.push(name);
      return c;
    }
    function resolveGas(name, unit) {
      if (!name) return null;
      let g = nextGasList.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (g) {
        reusedGas++;
        return g;
      }
      g = {
        id: uid("gas"),
        name,
        unit: unit || "kg",
        cylinders: []
      };
      nextGasList.push(g);
      createdGas++;
      return g;
    }
    function resolveMachine(name) {
      if (!name) return null;
      let eq = nextEquipment.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (eq) {
        reusedMachine++;
        return eq;
      }
      eq = {
        id: uid("equip"),
        name,
        dateReceived: todayStr(),
        origin: "",
        receivedFrom: "",
        functional: true,
        history: []
      };
      nextEquipment.push(eq);
      createdMachine++;
      return eq;
    }
    const mapChemReq = r => {
      const c = resolveChemical(r.chemicalName, r.chemicalUnit);
      return {
        chemicalId: c?.id || "",
        chemical: c?.name || r.chemicalName,
        optional: !!r.optional,
        items: r.items || []
      };
    };
    const mapGasReq = g => {
      const gg = resolveGas(g.gasName, g.gasUnit);
      return {
        gasId: gg?.id || "",
        gasName: gg?.name || g.gasName
      };
    };
    const newTestTypes = [];
    drafts.forEach(d => {
      const chemicalRequirements = (d.chemicalRequirements || []).map(mapChemReq);
      const dilutionChemicalRequirements = (d.dilutionChemicalRequirements || []).map(mapChemReq);
      const gasRequirements = (d.gasRequirements || []).map(mapGasReq);
      const dilutionGasRequirements = (d.dilutionGasRequirements || []).map(mapGasReq);
      const machine = resolveMachine(d.defaultEquipmentName);
      const linkedParam = d.linkedParameter ? resolveParameter(d.linkedParameter) : null;
      let finalName = d.name || [d.testName, d.method].filter(Boolean).join("-");
      const nameTaken = n => testTypes.some(t => t.name.toLowerCase() === n.toLowerCase()) || usedNamesThisBatch.some(n2 => n2.toLowerCase() === n.toLowerCase());
      if (nameTaken(finalName)) {
        let n = 2;
        let candidate = `${finalName} (imported)`;
        while (nameTaken(candidate)) {
          candidate = `${finalName} (imported ${n})`;
          n++;
        }
        conflicts.push(`Test type name "${finalName}" already existed — imported as "${candidate}"`);
        finalName = candidate;
      }
      usedNamesThisBatch.push(finalName);
      newTestTypes.push({
        id: uid("test"),
        testName: d.testName || "",
        method: d.method || "",
        name: finalName,
        costPerTest: Number(d.costPerTest) || 0,
        feeApplicable: d.feeApplicable !== false,
        defaultEquipmentId: machine?.id || "",
        linkedParameterIds: linkedParam ? [linkedParam.id] : [],
        chemicalRequirements,
        gasRequirements,
        dilutionEnabled: !!d.dilutionEnabled,
        dilutionChemicalRequirements,
        dilutionGasRequirements
      });
    });
    setChemicals(nextChemicals);
    setMasterChemicals(nextMaster);
    setGasList(nextGasList);
    setEquipment(nextEquipment);
    if (typeof setParameters === "function") setParameters(nextParameters);
    setTestTypes(prev => [...prev, ...newTestTypes]);
    return {
      names: newTestTypes.map(t => t.name),
      createdChem,
      reusedChem,
      createdGas,
      reusedGas,
      createdMachine,
      reusedMachine,
      createdParam,
      reusedParam,
      conflicts
    };
  }

  // ---- Parsers: turn an uploaded file into "drafts" (flattened test type shape), plus a list of
  // row-level errors that don't block the rest of the file from importing. ----
  function parseJsonFile(text) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      return {
        drafts: [],
        errors: [{
          row: "-",
          message: "Could not parse JSON — file may be corrupted."
        }]
      };
    }
    if (!payload || payload.schema !== "aqualab-testtype-export-v1" || !payload.testType) {
      return {
        drafts: [],
        errors: [{
          row: "-",
          message: "This JSON file doesn't look like a Test Type export (missing/invalid schema)."
        }]
      };
    }
    return {
      drafts: [{
        testName: payload.testType.testName,
        method: payload.testType.method,
        name: payload.testType.name,
        costPerTest: payload.testType.costPerTest,
        feeApplicable: payload.testType.feeApplicable,
        dilutionEnabled: payload.testType.dilutionEnabled,
        linkedParameter: payload.linkedParameter || null,
        defaultEquipmentName: payload.defaultEquipmentName,
        chemicalRequirements: payload.chemicalRequirements || [],
        dilutionChemicalRequirements: payload.dilutionChemicalRequirements || [],
        gasRequirements: payload.gasRequirements || [],
        dilutionGasRequirements: payload.dilutionGasRequirements || []
      }],
      errors: []
    };
  }
  // parseCSVText is a shared global helper now — see 10-inventory-logic.js.

  // Flat row template: TestName, Method, CostPerTest, FeeApplicable(Y/N), DilutionEnabled(Y/N),
  // MachineName, RequirementType (Chemical / DilutionChemical / Gas / DilutionGas), ChemicalOrGasName,
  // Unit, Optional(Y/N). One row per chemical/gas requirement; TestName+Method groups rows into one test type.
  function rowsToDrafts(rows) {
    const errors = [];
    const groups = new Map();
    const getVal = (row, key) => {
      const found = Object.keys(row).find(k => k.trim().toLowerCase().replace(/[\s_]/g, "") === key);
      return found ? String(row[found] ?? "").trim() : "";
    };
    const truthy = s => /^(y|yes|true|1)$/i.test((s || "").trim());
    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // header row + 1-index
      const testName = getVal(row, "testname");
      if (!testName) {
        errors.push({
          row: rowNum,
          message: "Missing TestName — row skipped."
        });
        return;
      }
      const name = getVal(row, "chemicalorgasname") || getVal(row, "name");
      if (!name) {
        errors.push({
          row: rowNum,
          message: `Missing ChemicalOrGasName for "${testName}" — row skipped.`
        });
        return;
      }
      const method = getVal(row, "method");
      const key = testName.toLowerCase() + "|" + method.toLowerCase();
      if (!groups.has(key)) {
        const paramCode = getVal(row, "parametercode");
        const paramName = getVal(row, "parametername");
        groups.set(key, {
          testName,
          method,
          costPerTest: Number(getVal(row, "costpertest")) || 0,
          feeApplicable: !getVal(row, "feeapplicable") || truthy(getVal(row, "feeapplicable")),
          dilutionEnabled: truthy(getVal(row, "dilutionenabled")),
          defaultEquipmentName: getVal(row, "machinename"),
          linkedParameter: (paramCode || paramName) ? {
            code: paramCode || paramName,
            name: paramName || paramCode,
            shortName: getVal(row, "parametershortname"),
            unit: getVal(row, "parameterunit"),
            methodRef: getVal(row, "parametermethodref") || method,
            category: getVal(row, "parametercategory"),
            standardFee: getVal(row, "parameterfee") === "" ? Number(getVal(row, "costpertest")) || 0 : Number(getVal(row, "parameterfee")) || 0
          } : null,
          chemicalRequirements: [],
          dilutionChemicalRequirements: [],
          gasRequirements: [],
          dilutionGasRequirements: []
        });
      }
      const d = groups.get(key);
      const reqType = (getVal(row, "requirementtype") || "chemical").toLowerCase();
      const unit = getVal(row, "unit");
      const optional = truthy(getVal(row, "optional"));
      const isGas = reqType.includes("gas");
      const isDilution = reqType.includes("dilution");
      if (isGas && isDilution) d.dilutionGasRequirements.push({
        gasName: name,
        gasUnit: unit || "kg"
      });else if (isGas) d.gasRequirements.push({
        gasName: name,
        gasUnit: unit || "kg"
      });else if (isDilution) d.dilutionChemicalRequirements.push({
        chemicalName: name,
        chemicalUnit: unit || "ml",
        optional,
        items: [{
          id: uid("item"),
          label: name,
          type: "direct",
          defaultValue: 0
        }]
      });else d.chemicalRequirements.push({
        chemicalName: name,
        chemicalUnit: unit || "ml",
        optional,
        items: [{
          id: uid("item"),
          label: name,
          type: "direct",
          defaultValue: 0
        }]
      });
    });
    return {
      drafts: [...groups.values()],
      errors
    };
  }
  function downloadImportTemplate() {
    const header = "TestName,Method,CostPerTest,FeeApplicable,DilutionEnabled,MachineName,ParameterCode,ParameterName,ParameterShortName,ParameterUnit,ParameterMethodRef,ParameterCategory,ParameterFee,RequirementType,ChemicalOrGasName,Unit,Optional";
    const sample1 = "Arsenic (As),HVG,100,Y,N,HVG Analyzer,As,Arsenic,As,mg/L,HVG,Heavy Metal,100,Chemical,Fe Standard,ml,N";
    const sample2 = "Arsenic (As),HVG,100,Y,N,HVG Analyzer,As,Arsenic,As,mg/L,HVG,Heavy Metal,100,Gas,Acetylene,kg,N";
    const blob = new Blob([[header, sample1, sample2].join("\n")], {
      type: "text/csv"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "test_type_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function resetImportModal() {
    setImportStage("select");
    setImportFile(null);
    setImportParsed(null);
    setImportProgress(0);
    setImportFileError("");
  }
  function closeImportModal() {
    setImportOpen(false);
    resetImportModal();
  }
  function handleImportFileChosen(file) {
    setImportFileError("");
    setImportParsed(null);
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["xlsx", "csv", "json"].includes(ext)) {
      setImportFileError("Unsupported file type — please upload a .xlsx, .csv, or .json file.");
      setImportFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImportFileError("File is too large (max 10MB).");
      setImportFile(null);
      return;
    }
    setImportFile(file);
  }
  function handleParseFile() {
    if (!importFile) {
      setImportFileError("Please choose a file first.");
      return;
    }
    const ext = (importFile.name.split(".").pop() || "").toLowerCase();
    const reader = new FileReader();
    reader.onerror = () => setImportFileError("Could not read the file.");
    if (ext === "json") {
      reader.onload = e => {
        const {
          drafts,
          errors
        } = parseJsonFile(e.target.result);
        if (drafts.length === 0 && errors.length > 0) {
          setImportFileError(errors[0].message);
          return;
        }
        setImportParsed({
          drafts,
          errors
        });
        setImportStage("preview");
      };
      reader.readAsText(importFile);
    } else if (ext === "csv") {
      reader.onload = e => {
        const rows = parseCSVText(e.target.result);
        const {
          drafts,
          errors
        } = rowsToDrafts(rows);
        if (drafts.length === 0) {
          setImportFileError(errors[0]?.message || "No valid rows found in this file.");
          return;
        }
        setImportParsed({
          drafts,
          errors
        });
        setImportStage("preview");
      };
      reader.readAsText(importFile);
    } else if (ext === "xlsx") {
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, {
            type: "binary"
          });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, {
            defval: ""
          });
          const {
            drafts,
            errors
          } = rowsToDrafts(rows);
          if (drafts.length === 0) {
            setImportFileError(errors[0]?.message || "No valid rows found in this sheet.");
            return;
          }
          setImportParsed({
            drafts,
            errors
          });
          setImportStage("preview");
        } catch (err) {
          setImportFileError("Could not read this Excel file — is it a valid .xlsx?");
        }
      };
      reader.readAsBinaryString(importFile);
    }
  }
  function handleConfirmImport() {
    if (!importParsed || importParsed.drafts.length === 0) return;
    setImportStage("importing");
    setImportProgress(0);
    const total = importParsed.drafts.length;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setImportProgress(Math.min(95, Math.round(step / (total + 1) * 100)));
      if (step >= total) {
        clearInterval(timer);
        const summary = commitImportDrafts(importParsed.drafts);
        setImportProgress(100);
        setImportSummary({
          ...summary,
          rowErrors: importParsed.errors
        });
        setImportStage("done");
        notify(`Imported ${summary.names.length} test type(s): ${summary.names.join(", ")}`);
      }
    }, 180);
  }
  const ttq = ttSearch.trim().toLowerCase();
  const ttFiltered = !ttq ? testTypes : testTypes.filter(t => [t.name, t.testName, t.method, equipmentName(t.defaultEquipmentId)].some(v => (v || "").toLowerCase().includes(ttq)));
  const ttTotalPages = Math.max(1, Math.ceil(ttFiltered.length / TT_PAGE_SIZE));
  const ttPageClamped = Math.min(ttPage, ttTotalPages);
  const ttPageRows = ttFiltered.slice((ttPageClamped - 1) * TT_PAGE_SIZE, ttPageClamped * TT_PAGE_SIZE);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-sm mb-2",
    style: {
      color: C.muted
    }
  }, "Design test types here — equipment, chemical/gas requirements, dummy defaults, and cost. \"Add Test Record\" simply loads whatever is designed here."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 flex-wrap items-center"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-1.5 text-xs",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 13
  }), /*#__PURE__*/React.createElement("input", {
    value: ttSearch,
    onChange: e => {
      setTtSearch(e.target.value);
      setTtPage(1);
    },
    placeholder: "Search name, method, equipment…",
    className: "border rounded px-2 py-1 text-xs w-52",
    style: {
      borderColor: C.border
    }
  })), canCreateTestTypes && /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: ttCreateGate.guard(() => {
      resetImportModal();
      setImportOpen(true);
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 14
  }), "Import Test Type"), canCreateTestTypes && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: ttCreateGate.guard(() => setShowBuilder(true))
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "New Test Type"))), /*#__PURE__*/React.createElement(Banner, {
    tone: "info",
    storageKey: "testtypes-import-export-tip"
  }, "Export a test type to share its full setup (linked parameter, chemicals, gases, machine, requirements) with another lab as a .json file. Importing recreates the test type(s) here from .xlsx, .csv, or .json — reusing any parameter/chemical/gas/machine that already exists by code or name, and auto-registering (like Inventory) whatever is missing."), ttFiltered.length === 0 && /*#__PURE__*/React.createElement(EmptyState, {
    icon: "beaker",
    title: testTypes.length === 0 ? "No test types yet" : "No test types match your search",
    subtitle: testTypes.length === 0 ? "Design one — equipment, chemical/gas requirements, and cost per sample." : "Try a different name, method, or equipment.",
    action: testTypes.length === 0 && canCreateTestTypes ? /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: ttCreateGate.guard(() => setShowBuilder(true))
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 13
    }), "New Test Type") : undefined
  }), ttFiltered.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg overflow-hidden mb-1",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto max-h-[70vh] overflow-y-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm border-collapse"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: C.bg
    }
  }, ["Test Type", "Method", "Standard Fee", "Default Equipment", "Linked Parameters", "Requirements", ""].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-3 py-2.5 text-xs font-semibold sticky top-0",
    style: {
      color: C.muted,
      background: C.bg,
      borderBottom: `1px solid ${C.border}`,
      zIndex: 1
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, ttPageRows.map((t, idx) => {
    const isOpen = !!ttExpanded[t.id];
    const reqCount = (t.chemicalRequirements || []).length + (t.gasRequirements || []).length;
    const linkedFeeParam = (t.linkedParameterIds || []).length > 0 ? (parameters || []).find(p => p.id === t.linkedParameterIds[0]) : null;
    const liveCost = linkedFeeParam ? Number(linkedFeeParam.standardFee) || 0 : Number(t.costPerTest) || 0;
    const mainRow = /*#__PURE__*/React.createElement("tr", {
      key: t.id,
      className: "cursor-pointer",
      onClick: () => toggleTtExpand(t.id),
      style: {
        borderTop: `1px solid ${C.border}`,
        background: isOpen ? `${C.teal}0F` : idx % 2 === 1 ? C.bg : C.card
      }
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: isOpen ? "chevronDown" : "chevronRight",
      size: 13,
      color: C.muted
    }), /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 14,
      color: C.teal
    }), /*#__PURE__*/React.createElement("span", {
      className: "font-semibold",
      style: {
        color: C.ink
      }
    }, t.name))), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5",
      style: {
        color: C.muted
      }
    }, t.method || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, "৳", fmtNum(liveCost), "/sample")), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5",
      style: {
        color: C.muted
      }
    }, t.defaultEquipmentId ? equipmentName(t.defaultEquipmentId) : "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5"
    }, (() => {
      const linked = parameterSummary(t);
      return linked.length === 0 ? /*#__PURE__*/React.createElement("span", {
        style: { color: C.muted }
      }, "—") : /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-1 flex-wrap"
      }, linked.slice(0, 3).map(p => /*#__PURE__*/React.createElement(Badge, {
        key: p.id,
        tone: PARAMETER_CATEGORY_TONE[p.category] || "muted"
      }, p.code || p.name)), linked.length > 3 && /*#__PURE__*/React.createElement(Badge, {
        tone: "muted"
      }, "+", linked.length - 3, " more"));
    })()), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5"
    }, reqCount === 0 ? /*#__PURE__*/React.createElement(Badge, {
      tone: "muted"
    }, "Entry / revenue only") : /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-1 flex-wrap"
    }, (t.chemicalRequirements || []).length > 0 && /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, (t.chemicalRequirements || []).length, " chemical"), (t.gasRequirements || []).length > 0 && /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, (t.gasRequirements || []).length, " gas"), t.dilutionEnabled && /*#__PURE__*/React.createElement(Badge, {
      tone: "warn"
    }, "Dilution"))), /*#__PURE__*/React.createElement("td", {
      className: "px-3 py-2.5 text-right",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-end gap-1"
    }, /*#__PURE__*/React.createElement(IconButton, {
      name: "download",
      color: C.info,
      title: "Export test type",
      onClick: () => exportTestType(t)
    }), canEditTestTypes && /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit test type",
      onClick: ttEditGate.guard(() => setEditingType(t))
    }), canDeleteTestTypes && /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: "Delete test type",
      onClick: ttDeleteGate.guard(() => setDeleteFor(t))
    }))));
    const detailRow = !isOpen ? null : /*#__PURE__*/React.createElement("tr", {
      key: t.id + "-detail"
    }, /*#__PURE__*/React.createElement("td", {
      colSpan: 7,
      className: "px-4 py-3",
      style: {
        background: `${C.teal}0F`,
        borderTop: "none"
      }
    }, deleteFor?.id === t.id && /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete test type "${t.name}"? This cannot be undone.`,
      onConfirm: () => handleDelete(t),
      onCancel: () => setDeleteFor(null)
    }), /*#__PURE__*/React.createElement("div", {
      className: "text-xs mb-2 flex flex-wrap gap-x-4 gap-y-1",
      style: {
        color: C.muted
      }
    }, /*#__PURE__*/React.createElement("span", null, "Name of Test: ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: C.ink
      }
    }, t.testName || t.name)), /*#__PURE__*/React.createElement("span", null, "Linked Parameters: ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: C.ink
      }
    }, parameterSummary(t).length === 0 ? "none" : parameterSummary(t).map(p => p.name).join(", ")))), /*#__PURE__*/React.createElement("div", {
      className: "text-xs",
      style: {
        color: C.muted
      }
    }, reqCount === 0 ? "No chemical or gas requirement — pure entry/revenue test." : /*#__PURE__*/React.createElement("ul", {
      className: "list-disc pl-4"
    }, (t.chemicalRequirements || []).map((r, i) => /*#__PURE__*/React.createElement("li", {
      key: `c${i}`
    }, r.chemical, " — ", r.items.map(it => it.label).join(", "))), (t.gasRequirements || []).length > 0 && /*#__PURE__*/React.createElement("li", {
      key: "g"
    }, "Gas: ", t.gasRequirements.map(g => g.gasName).join(", ")))), t.dilutionEnabled && /*#__PURE__*/React.createElement("div", {
      className: "text-xs mt-2 pt-2 flex flex-wrap gap-x-4 gap-y-1",
      style: {
        borderTop: `1px solid ${C.border}`,
        color: C.muted
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "flex items-center gap-1"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 12,
      color: C.info
    }), "Dilution supported:"), (t.dilutionChemicalRequirements || []).map((r, i) => /*#__PURE__*/React.createElement("span", {
      key: `dc${i}`
    }, r.chemical, " (", r.items.map(it => it.label).join(", "), ")")), (t.dilutionGasRequirements || []).length > 0 && /*#__PURE__*/React.createElement("span", null, "Gas: ", t.dilutionGasRequirements.map(g => g.gasName).join(", ")), (t.dilutionChemicalRequirements || []).length === 0 && (t.dilutionGasRequirements || []).length === 0 && /*#__PURE__*/React.createElement("span", null, "no extra chemical/gas configured"))));
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: t.id
    }, mainRow, detailRow);
  })))), /*#__PURE__*/React.createElement(Pagination, {
    page: ttPageClamped,
    totalPages: ttTotalPages,
    totalItems: ttFiltered.length,
    pageSize: TT_PAGE_SIZE,
    onPageChange: setTtPage
  })), showBuilder && /*#__PURE__*/React.createElement(Modal, {
    title: "Create New Test Type",
    onClose: () => setShowBuilder(false),
    wide: true
  }, /*#__PURE__*/React.createElement(TestTypeBuilder, {
    chemicals: chemicals,
    setChemicals: setChemicals,
    masterChemicals: masterChemicals,
    setMasterChemicals: setMasterChemicals,
    notify: notify,
    equipment: equipment,
    gasList: gasList,
    parameters: parameters,
    onSave: handleSave,
    onCancel: () => setShowBuilder(false)
  })), editingType && /*#__PURE__*/React.createElement(Modal, {
    title: "Edit Test Type",
    onClose: () => setEditingType(null),
    wide: true
  }, /*#__PURE__*/React.createElement(TestTypeBuilder, {
    chemicals: chemicals,
    setChemicals: setChemicals,
    masterChemicals: masterChemicals,
    setMasterChemicals: setMasterChemicals,
    notify: notify,
    equipment: equipment,
    gasList: gasList,
    parameters: parameters,
    initial: editingType,
    onSave: handleSave,
    onCancel: () => setEditingType(null)
  })), importOpen && /*#__PURE__*/React.createElement(Modal, {
    title: "Import Test Type",
    onClose: closeImportModal
  }, importStage === "select" && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Upload an Excel (.xlsx) or CSV file exported from another lab (or a Test Type .json export). One row per chemical/gas requirement; rows sharing the same TestName+Method are grouped into one test type."), /*#__PURE__*/React.createElement("button", {
    onClick: () => document.getElementById("importFileInput").click(),
    className: "border-2 border-dashed rounded p-6 flex flex-col items-center gap-2 text-sm",
    style: {
      borderColor: C.border,
      color: C.muted,
      background: C.subtle
    },
    onDragOver: e => e.preventDefault(),
    onDrop: e => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) handleImportFileChosen(e.dataTransfer.files[0]);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 22,
    color: C.teal
  }), /*#__PURE__*/React.createElement("div", null, "Drag & drop a file here, or ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.teal,
      fontWeight: 600
    }
  }, "Browse File")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Supported: .xlsx, .csv, .json — max 10MB")), /*#__PURE__*/React.createElement("input", {
    id: "importFileInput",
    type: "file",
    accept: ".xlsx,.csv,.json",
    className: "hidden",
    onChange: e => handleImportFileChosen(e.target.files[0])
  }), importFile && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    style: {
      color: C.ok
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Selected: ", importFile.name, " (", (importFile.size / 1024).toFixed(1), " KB)"), importFileError && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), importFileError), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mt-1"
  }, /*#__PURE__*/React.createElement("button", {
    className: "text-xs underline",
    style: {
      color: C.teal
    },
    onClick: downloadImportTemplate
  }, "Download CSV Template"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: closeImportModal
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    disabled: !importFile,
    onClick: handleParseFile
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 14
  }), "Upload")))), importStage === "preview" && importParsed && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center gap-1.5",
    style: {
      background: C.okBg,
      color: C.ok
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Parsed ", importParsed.drafts.length, " test type", importParsed.drafts.length === 1 ? "" : "s", " from \"", importFile?.name, "\"."), /*#__PURE__*/React.createElement("div", {
    className: "max-h-52 overflow-y-auto flex flex-col gap-1.5"
  }, importParsed.drafts.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "text-xs p-2 rounded",
    style: {
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-semibold",
    style: {
      color: C.ink
    }
  }, [d.testName, d.method].filter(Boolean).join(" — ") || `Test type #${i + 1}`), /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.muted
    }
  }, (d.chemicalRequirements || []).length, " chemical(s) · ", (d.gasRequirements || []).length, " gas(es)", d.dilutionEnabled ? " · dilution configured" : "", d.linkedParameter ? ` · parameter: ${d.linkedParameter.code || d.linkedParameter.name}` : "")))), importParsed.errors.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "p-2 rounded",
    style: {
      background: C.warnBg
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1",
    style: {
      color: C.warn
    }
  }, importParsed.errors.length, " row issue(s) — these rows were skipped, the rest will still import:"), importParsed.errors.slice(0, 8).map((er, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "text-xs",
    style: {
      color: C.warn
    }
  }, "Row ", er.row, ": ", er.message)), importParsed.errors.length > 8 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.warn
    }
  }, "...and ", importParsed.errors.length - 8, " more")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: resetImportModal
  }, "Back"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleConfirmImport
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14
  }), "Import"))), importStage === "importing" && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3 items-center py-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm",
    style: {
      color: C.ink
    }
  }, "Importing ", importParsed?.drafts.length, " test type(s)..."), /*#__PURE__*/React.createElement("div", {
    className: "w-full h-2 rounded overflow-hidden",
    style: {
      background: C.border
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full transition-all",
    style: {
      width: `${importProgress}%`,
      background: C.teal
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, importProgress, "%")), importStage === "done" && importSummary && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2 text-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded flex items-center gap-1.5",
    style: {
      background: C.okBg,
      color: C.ok
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), "Success — imported: ", importSummary.names.join(", ")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "beaker",
    size: 14,
    color: C.teal
  }), "Parameters: ", /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, importSummary.createdParam || 0, " new"), /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, importSummary.reusedParam || 0, " reused")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "flask",
    size: 14,
    color: C.teal
  }), "Chemicals: ", /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, importSummary.createdChem, " new"), /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, importSummary.reusedChem, " reused")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "flask",
    size: 14,
    color: C.teal
  }), "Gases: ", /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, importSummary.createdGas, " new"), /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, importSummary.reusedGas, " reused")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "wrench",
    size: 14,
    color: C.teal
  }), "Machines: ", /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, importSummary.createdMachine, " new"), /*#__PURE__*/React.createElement(Badge, {
    tone: "info"
  }, importSummary.reusedMachine, " reused")), importSummary.conflicts.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-1 p-2 rounded",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1"
  }, "Conflicts (auto-resolved):"), importSummary.conflicts.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "text-xs flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 12
  }), c))), importSummary.rowErrors && importSummary.rowErrors.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-1 p-2 rounded",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold mb-1"
  }, "Error Summary — ", importSummary.rowErrors.length, " row(s) skipped:"), importSummary.rowErrors.slice(0, 8).map((er, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "text-xs"
  }, "Row ", er.row, ": ", er.message))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: closeImportModal
  }, "Done")))));
}

// ============================================================================
// TEST RECORDS TAB — manage (edit/delete) saved test records
// ============================================================================
