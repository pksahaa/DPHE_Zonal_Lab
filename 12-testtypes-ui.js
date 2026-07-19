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
      toneBg: "#EAF6F5"
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
      background: "#FAFEFE"
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
        background: "#F3FAF9",
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
      background: !req.optional ? C.teal : "#FFFFFF",
      color: !req.optional ? "#FFFFFF" : C.muted,
      fontWeight: !req.optional ? 600 : 400
    }
  }, "Required"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => updateReqField(idx, {
      optional: true
    }),
    className: "px-2.5 py-1",
    style: {
      background: req.optional ? C.warn : "#FFFFFF",
      color: req.optional ? "#FFFFFF" : C.muted,
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
        background: "#FFFFFF"
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
        background: "#EEF4F3",
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
        background: "#EEF4F3",
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
        background: checked ? C.okBg : "#F7FBFB",
        color: checked ? C.ok : C.muted
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: checked,
      onChange: () => toggle(g)
    }), g.name);
  }));
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
      background: "#FAFEFE"
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
  setResultParameters
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
      background: "#FAFEFE"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2 flex-1"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Result Name",
    value: p.name,
    onChange: e => updateParam(p.id, {
      name: e.target.value
    }),
    placeholder: "e.g. Free Chlorine"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Unit",
    value: p.unit,
    onChange: e => updateParam(p.id, {
      unit: e.target.value
    }),
    placeholder: "e.g. mg/L"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Round To (decimals)",
    type: "number",
    min: "0",
    value: p.roundTo,
    onChange: e => updateParam(p.id, {
      roundTo: Number(e.target.value) || 0
    })
  })), /*#__PURE__*/React.createElement("button", {
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
  }, "Use the variable keys above (case-sensitive). Supported: + − × ÷ ^ ( ) and functions abs(), round(x,d), min(), max(), sqrt(), log10(), ln()."), /*#__PURE__*/React.createElement(FormulaTryIt, {
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
  const result = param.formula.trim() ? evaluateFormula(param.formula, variables) : null;
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
  setQcRules
}) {
  function addRule() {
    setQcRules(prev => [...prev, {
      id: uid("qc"),
      qcType: "blank",
      label: "",
      comparator: "lt",
      limitLow: 0,
      limitHigh: 0,
      unit: "",
      notes: "",
      targetMean: null,
      targetSD: null
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
      background: "#FAFEFE"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2 flex-1"
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
    className: "grid grid-cols-4 gap-2"
  }, /*#__PURE__*/React.createElement(SelectField, {
    label: "Comparator",
    value: r.comparator,
    onChange: e => update(r.id, {
      comparator: e.target.value
    }),
    options: QC_COMPARATORS
  }), /*#__PURE__*/React.createElement(TextField, {
    label: r.comparator === "between" ? "Lower Limit" : "Limit",
    type: "number",
    value: r.limitLow,
    onChange: e => update(r.id, {
      limitLow: Number(e.target.value) || 0
    })
  }), r.comparator === "between" && /*#__PURE__*/React.createElement(TextField, {
    label: "Upper Limit",
    type: "number",
    value: r.limitHigh,
    onChange: e => update(r.id, {
      limitHigh: Number(e.target.value) || 0
    })
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Unit",
    value: r.unit,
    onChange: e => update(r.id, {
      unit: e.target.value
    }),
    placeholder: "e.g. %, mg/L"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2 mt-2"
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
  })), /*#__PURE__*/React.createElement("div", {
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
  onSave,
  onCancel,
  initial
}) {
  const [testName, setTestName] = useState(initial?.testName || "");
  const [method, setMethod] = useState(initial?.method || "");
  const [costPerTest, setCostPerTest] = useState(initial ? String(initial.costPerTest ?? 0) : "");
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
  const combinedName = [testName.trim(), method.trim()].filter(Boolean).join("-");

  // Inline validation — same red-border + message-below-field pattern used in Add Test Record.
  const errors = {};
  if (submitAttempted) {
    if (!testName.trim()) errors.testName = "Test Name is required.";
    if (costPerTest === "") errors.costPerTest = "Cost of Test is required.";
    if (chemicalRequirements.some(r => !r.chemicalId)) errors.chemicalRequirements = "Every Chemical Requirement row needs a linked chemical selected (or remove the empty row).";
    if (dilutionEnabled && dilutionChemicalRequirements.some(r => !r.chemicalId)) errors.dilutionChemicalRequirements = "Every Dilution Chemical Requirement row needs a linked chemical selected (or remove the empty row).";
  }
  const hasErrors = Object.keys(errors).length > 0;
  function handleSubmit() {
    setSubmitAttempted(true);
    const invalid = !testName.trim() || costPerTest === "" || chemicalRequirements.some(r => !r.chemicalId) || dilutionEnabled && dilutionChemicalRequirements.some(r => !r.chemicalId);
    if (invalid) return;
    onSave({
      id: initial?.id || uid("test"),
      testName: testName.trim(),
      method: method.trim(),
      name: combinedName || testName.trim(),
      costPerTest: Number(costPerTest) || 0,
      defaultEquipmentId,
      chemicalRequirements,
      gasRequirements,
      dilutionEnabled,
      dilutionChemicalRequirements: dilutionEnabled ? dilutionChemicalRequirements : [],
      dilutionGasRequirements: dilutionEnabled ? dilutionGasRequirements : [],
      resultParameters,
      qcRules,
      qcFrequency: qcFrequency === "" ? null : Number(qcFrequency)
    });
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
    subtitle: "Name, method, cost & default equipment"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Name of Test",
    value: testName,
    onChange: e => setTestName(e.target.value),
    placeholder: "e.g. Arsenic (As)",
    error: errors.testName
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Method",
    value: method,
    onChange: e => setMethod(e.target.value),
    placeholder: "e.g. HVG"
  })), combinedName && /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.okBg,
      color: C.ok
    }
  }, "This test type will be saved as: ", /*#__PURE__*/React.createElement("strong", null, combinedName)), /*#__PURE__*/React.createElement(TextField, {
    label: "Cost of Test (৳ per billed sample)",
    type: "number",
    min: "0",
    value: costPerTest,
    onChange: e => setCostPerTest(e.target.value),
    placeholder: "e.g. 100 — use 0 for free tests",
    error: errors.costPerTest
  }), /*#__PURE__*/React.createElement("div", {
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
    setResultParameters: setResultParameters
  })), /*#__PURE__*/React.createElement(CollapsibleSection, {
    step: 6,
    title: "QC Acceptance Rules",
    subtitle: "Optional — acceptance criteria for blanks, duplicates, spikes, calibration",
    defaultOpen: qcRules.length > 0
  }, /*#__PURE__*/React.createElement(QcRuleEditor, {
    qcRules: qcRules,
    setQcRules: setQcRules
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
  testRecords,
  notify
}) {
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
  function equipmentName(id) {
    return equipment.find(e => e.id === id)?.name || "—";
  }
  function isTestTypeUsed(id) {
    return testRecords.some(r => r.testTypeId === id);
  }
  function handleSave(testType) {
    if (editingType) {
      setTestTypes(prev => prev.map(t => t.id === testType.id ? testType : t));
      notify(`Test type "${testType.name}" updated`);
      setEditingType(null);
    } else {
      setTestTypes(prev => [...prev, testType]);
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
      reusedMachine = 0;
    const conflicts = [];
    const nextChemicals = [...chemicals];
    const nextMaster = [...masterChemicals];
    const nextGasList = [...gasList];
    const nextEquipment = [...equipment];
    const usedNamesThisBatch = [];
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
    setTestTypes(prev => [...prev, ...newTestTypes]);
    return {
      names: newTestTypes.map(t => t.name),
      createdChem,
      reusedChem,
      createdGas,
      reusedGas,
      createdMachine,
      reusedMachine,
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
        defaultEquipmentName: payload.defaultEquipmentName,
        chemicalRequirements: payload.chemicalRequirements || [],
        dilutionChemicalRequirements: payload.dilutionChemicalRequirements || [],
        gasRequirements: payload.gasRequirements || [],
        dilutionGasRequirements: payload.dilutionGasRequirements || []
      }],
      errors: []
    };
  }
  function parseCSVText(text) {
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim() !== "");
    if (lines.length === 0) return [];
    function splitLine(line) {
      const out = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            if (line[i + 1] === '"') {
              cur += '"';
              i++;
            } else inQuotes = false;
          } else cur += ch;
        } else {
          if (ch === '"') inQuotes = true;else if (ch === ",") {
            out.push(cur);
            cur = "";
          } else cur += ch;
        }
      }
      out.push(cur);
      return out.map(s => s.trim());
    }
    const headers = splitLine(lines[0]);
    return lines.slice(1).map(line => {
      const cells = splitLine(line);
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = cells[i] ?? "";
      });
      return obj;
    });
  }

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
        groups.set(key, {
          testName,
          method,
          costPerTest: Number(getVal(row, "costpertest")) || 0,
          feeApplicable: !getVal(row, "feeapplicable") || truthy(getVal(row, "feeapplicable")),
          dilutionEnabled: truthy(getVal(row, "dilutionenabled")),
          defaultEquipmentName: getVal(row, "machinename"),
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
    const header = "TestName,Method,CostPerTest,FeeApplicable,DilutionEnabled,MachineName,RequirementType,ChemicalOrGasName,Unit,Optional";
    const sample1 = "Arsenic (As),HVG,100,Y,N,HVG Analyzer,Chemical,Fe Standard,ml,N";
    const sample2 = "Arsenic (As),HVG,100,Y,N,HVG Analyzer,Gas,Acetylene,kg,N";
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
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4 flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm",
    style: {
      color: C.muted
    }
  }, "Design test types here — equipment, chemical/gas requirements, dummy defaults, and cost. \"Add Test Record\" simply loads whatever is designed here."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => {
      resetImportModal();
      setImportOpen(true);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 14
  }), "Import Test Type"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => setShowBuilder(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "New Test Type"))), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Export a test type to share its full setup (chemicals, gases, machine, requirements) with another lab as a .json file. Importing recreates the test type(s) here from .xlsx, .csv, or .json — reusing any chemical/gas/machine that already exists by name and creating what's missing."), testTypes.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-sm",
    style: {
      color: C.muted
    }
  }, "No test types yet — create one to get started."), testTypes.map(t => /*#__PURE__*/React.createElement(SectionCard, {
    key: t.id,
    title: /*#__PURE__*/React.createElement("span", {
      className: "flex items-center gap-2"
    }, t.name, /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, "৳", fmtNum(t.costPerTest || 0), "/sample")),
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 16,
      color: C.teal
    }),
    right: /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-1"
    }, /*#__PURE__*/React.createElement(IconButton, {
      name: "download",
      color: C.info,
      title: "Export test type",
      onClick: () => exportTestType(t)
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit test type",
      onClick: () => setEditingType(t)
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: "Delete test type",
      onClick: () => setDeleteFor(t)
    }))
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
  }, t.testName || t.name)), /*#__PURE__*/React.createElement("span", null, "Method: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: C.ink
    }
  }, t.method || "—")), /*#__PURE__*/React.createElement("span", null, "Cost per sample: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: C.ink
    }
  }, "৳", fmtNum(t.costPerTest || 0))), /*#__PURE__*/React.createElement("span", null, "Default equipment: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: C.ink
    }
  }, t.defaultEquipmentId ? equipmentName(t.defaultEquipmentId) : "—"))), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, (t.chemicalRequirements || []).length === 0 && (t.gasRequirements || []).length === 0 ? "No chemical or gas requirement — pure entry/revenue test." : /*#__PURE__*/React.createElement("ul", {
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
  }, r.chemical, " (", r.items.map(it => it.label).join(", "), ")")), (t.dilutionGasRequirements || []).length > 0 && /*#__PURE__*/React.createElement("span", null, "Gas: ", t.dilutionGasRequirements.map(g => g.gasName).join(", ")), (t.dilutionChemicalRequirements || []).length === 0 && (t.dilutionGasRequirements || []).length === 0 && /*#__PURE__*/React.createElement("span", null, "no extra chemical/gas configured")))), showBuilder && /*#__PURE__*/React.createElement(Modal, {
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
      background: "#FAFEFE"
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
  }, (d.chemicalRequirements || []).length, " chemical(s) · ", (d.gasRequirements || []).length, " gas(es)", d.dilutionEnabled ? " · dilution configured" : "")))), importParsed.errors.length > 0 && /*#__PURE__*/React.createElement("div", {
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
