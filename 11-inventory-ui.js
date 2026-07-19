// ===== 11-inventory-ui.js =====
// ============================================================================
// INVENTORY UI — Chemicals / Glassware / Equipment / Gas tab + all add/edit
// forms. Depends on 00-core, 02-ui-kit, 10-inventory-logic.
// ============================================================================
function InventoryTab({
  invTab,
  setInvTab,
  chemicals,
  setChemicals,
  masterChemicals,
  setMasterChemicals,
  glassware,
  setGlassware,
  equipment,
  setEquipment,
  gasList,
  setGasList,
  testTypes,
  testRecords,
  notify
}) {
  const [showAddChemical, setShowAddChemical] = useState(false);
  const chemUploadRef = useRef(null);
  const glassUploadRef = useRef(null);
  const equipUploadRef = useRef(null);
  const [showMasterList, setShowMasterList] = useState(false);
  const [editChemicalFor, setEditChemicalFor] = useState(null);
  const [deleteChemicalFor, setDeleteChemicalFor] = useState(null);
  const [batchFormFor, setBatchFormFor] = useState(null);
  const [editBatch, setEditBatch] = useState(null); // { chemId, batch }
  const [deleteBatch, setDeleteBatch] = useState(null); // { chemId, batch }

  const [showAddGlass, setShowAddGlass] = useState(false);
  const [editGlassFor, setEditGlassFor] = useState(null);
  const [deleteGlassFor, setDeleteGlassFor] = useState(null);
  const [moveFormFor, setMoveFormFor] = useState(null); // { id, mode: 'toUse'|'toStore'|'break' }

  const [showAddEquip, setShowAddEquip] = useState(false);
  const [editEquipFor, setEditEquipFor] = useState(null);
  const [deleteEquipFor, setDeleteEquipFor] = useState(null);
  const [eventFormFor, setEventFormFor] = useState(null);
  const [editEvent, setEditEvent] = useState(null); // { equipId, evt }
  const [deleteEvent, setDeleteEvent] = useState(null); // { equipId, evt }

  const [collapsedChem, setCollapsedChem] = useState({});
  const [collapsedEquip, setCollapsedEquip] = useState({});
  const toggleChem = id => setCollapsedChem(prev => ({
    ...prev,
    [id]: !prev[id]
  }));
  const toggleEquip = id => setCollapsedEquip(prev => ({
    ...prev,
    [id]: !prev[id]
  }));
  const [showAddGas, setShowAddGas] = useState(false);
  const [editGasFor, setEditGasFor] = useState(null);
  const [deleteGasFor, setDeleteGasFor] = useState(null);
  const [cylinderFormFor, setCylinderFormFor] = useState(null); // gasId — "Add New Cylinder"
  const [refillFormFor, setRefillFormFor] = useState(null); // { gasId, cylinder } — "Refill"
  const [editCylinder, setEditCylinder] = useState(null); // { gasId, cylinder }
  const [deleteCylinder, setDeleteCylinder] = useState(null); // { gasId, cylinder }
  const [historyFor, setHistoryFor] = useState(null); // { gasId, cylinder } — "New vs Refill" log
  const [collapsedGas, setCollapsedGas] = useState({});
  const toggleGas = id => setCollapsedGas(prev => ({
    ...prev,
    [id]: !prev[id]
  }));
  function isGasUsedInTestTypes(gasId) {
    return (testTypes || []).some(t => (t.gasRequirements || []).some(g => g.gasId === gasId) || (t.dilutionGasRequirements || []).some(g => g.gasId === gasId));
  }
  function deleteGasType(g) {
    if (g.cylinders.length > 0) {
      notify("Delete all cylinders of this gas first.", "warn");
      return;
    }
    if (isGasUsedInTestTypes(g.id)) {
      notify("This gas is linked to one or more test types — unlink it there first.", "warn");
      return;
    }
    setGasList(prev => prev.filter(x => x.id !== g.id));
    setDeleteGasFor(null);
    notify(`Deleted gas "${g.name}"`);
  }
  function deleteCylinderNow(gasId, cylinder) {
    setGasList(prev => prev.map(g => g.id === gasId ? {
      ...g,
      cylinders: g.cylinders.filter(c => c.id !== cylinder.id)
    } : g));
    setDeleteCylinder(null);
    notify("Cylinder removed from inventory");
  }
  function importChemicals(file) {
    readWorkbook(file, (err, rows) => {
      if (err) return notify("Could not read Excel file", "warn");
      let count = 0;
      setChemicals(prev => {
        const next = prev.map(c => ({
          ...c,
          batches: [...c.batches]
        }));
        rows.forEach(row => {
          const name = String(row.ChemicalName || row.Chemical || "").trim();
          if (!name) return;
          const unit = String(row.Unit || "ml").trim();
          let chem = next.find(c => c.name.toLowerCase() === name.toLowerCase());
          if (!chem) {
            chem = {
              id: uid("chem"),
              name,
              unit,
              batches: []
            };
            next.push(chem);
          }
          chem.batches.push({
            id: uid("batch"),
            dateReceived: String(row.DateReceived || todayStr()),
            expiryDate: String(row.ExpiryDate || todayStr()),
            initialAmount: Number(row.Amount || 0),
            remaining: Number(row.Amount || 0),
            status: "active",
            origin: String(row.Origin || ""),
            receivedFrom: String(row.ReceivedFrom || row["Received From"] || "")
          });
          count++;
        });
        return markExpiredBatches(next);
      });
      notify(`Imported ${count} chemical batch row(s) across possibly multiple chemical types`);
    });
  }
  function importGlassware(file) {
    readWorkbook(file, (err, rows) => {
      if (err) return notify("Could not read Excel file", "warn");
      setGlassware(prev => [...prev, ...rows.filter(row => String(row.Name || row.Item || "").trim()).map(row => ({
        id: uid("glass"),
        name: String(row.Name || row.Item || "Item"),
        dateReceived: String(row.DateReceived || todayStr()),
        totalQuantity: Number(row.TotalQuantity || 0),
        inUse: Number(row.InUse || 0),
        broken: Number(row.Broken || 0),
        origin: String(row.Origin || ""),
        receivedFrom: String(row.ReceivedFrom || row["Received From"] || "")
      }))]);
      notify(`Imported ${rows.length} glassware row(s) — different item types can be mixed in one file`);
    });
  }
  function importEquipment(file) {
    readWorkbook(file, (err, rows) => {
      if (err) return notify("Could not read Excel file", "warn");
      setEquipment(prev => [...prev, ...rows.filter(row => String(row.Name || row.Equipment || "").trim()).map(row => ({
        id: uid("equip"),
        name: String(row.Name || row.Equipment || "Equipment"),
        dateReceived: String(row.DateReceived || todayStr()),
        origin: String(row.Origin || row.Project || ""),
        receivedFrom: String(row.ReceivedFrom || row["Received From"] || ""),
        functional: true,
        history: []
      }))]);
      notify(`Imported ${rows.length} equipment row(s) — different equipment types can be mixed in one file`);
    });
  }

  // ---- chemical helpers ----
  function deleteChemical(chem) {
    if (chem.batches.length > 0) {
      notify("Delete all batches of this chemical first.", "warn");
      return;
    }
    setChemicals(prev => prev.filter(c => c.id !== chem.id));
    setDeleteChemicalFor(null);
    notify(`Deleted chemical "${chem.name}"`);
  }
  function deleteBatchNow(chemId, batch) {
    if (isBatchUsedInTests(batch.id, testRecords)) {
      notify("This bottle has been used in a test record — delete that test record first.", "warn");
      setDeleteBatch(null);
      return;
    }
    setChemicals(prev => prev.map(c => c.id === chemId ? {
      ...c,
      batches: c.batches.filter(b => b.id !== batch.id)
    } : c));
    setDeleteBatch(null);
    notify("Batch deleted from inventory");
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-5"
  }, [{
    k: "equipment",
    label: "Equipment",
    icon: "wrench"
  }, {
    k: "glassware",
    label: "Glassware",
    icon: "beaker"
  }, {
    k: "chemicals",
    label: "Chemicals",
    icon: "flask"
  }, {
    k: "gas",
    label: "Gas",
    icon: "flask"
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    onClick: () => setInvTab(t.k),
    className: "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium",
    style: {
      background: invTab === t.k ? C.teal : "#fff",
      color: invTab === t.k ? "#fff" : C.muted,
      border: `1px solid ${invTab === t.k ? C.teal : C.border}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: t.icon,
    size: 14
  }), t.label))), invTab === "chemicals" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => downloadTemplate("chemicals")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 14
  }), "Download Template"), /*#__PURE__*/React.createElement("input", {
    ref: chemUploadRef,
    type: "file",
    accept: ".xlsx,.xls,.csv",
    className: "hidden",
    onChange: e => {
      if (e.target.files[0]) importChemicals(e.target.files[0]);
      e.target.value = "";
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => chemUploadRef.current && chemUploadRef.current.click()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 14
  }), "Import from Excel"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => setShowMasterList(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "wrench",
    size: 14
  }), "Master Chemical List"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => setShowAddChemical(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Add Chemical")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "One Excel file can contain rows for many different chemicals at once — rows are grouped automatically by \"ChemicalName\". New chemicals must be picked from the Master Chemical List — this prevents the same chemical being added twice by mistake."), chemicals.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-sm mb-3",
    style: {
      color: C.muted
    }
  }, "No chemicals yet — add one to get started."), chemicals.map(chem => {
    const isCollapsed = !!collapsedChem[chem.id];
    return /*#__PURE__*/React.createElement(SectionCard, {
      key: chem.id,
      title: /*#__PURE__*/React.createElement("button", {
        onClick: () => toggleChem(chem.id),
        className: "flex items-center gap-1.5 text-left"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: isCollapsed ? "chevronRight" : "chevronDown",
        size: 14,
        color: C.muted
      }), `${chem.name} (Unit: ${chem.unit})`),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "flask",
        size: 16,
        color: C.teal
      }),
      right: /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-1"
      }, /*#__PURE__*/React.createElement(IconButton, {
        name: "edit",
        color: C.teal,
        title: "Edit chemical",
        onClick: () => setEditChemicalFor(chem)
      }), /*#__PURE__*/React.createElement(IconButton, {
        name: "trash",
        color: C.warn,
        title: "Delete chemical",
        onClick: () => setDeleteChemicalFor(chem),
        disabled: chem.batches.length > 0
      }), /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outline",
        onClick: () => setBatchFormFor(chem.id)
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 13
      }), "Add Batch"))
    }, deleteChemicalFor?.id === chem.id && /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete chemical "${chem.name}"? This cannot be undone.`,
      onConfirm: () => deleteChemical(chem),
      onCancel: () => setDeleteChemicalFor(null)
    }), !isCollapsed && /*#__PURE__*/React.createElement("table", {
      className: "w-full text-xs"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        color: C.muted
      },
      className: "text-left"
    }, /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Batch Name"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Mfg. Date"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Date Received"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Expiry Date"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Initial"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Remaining"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Origin"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Received From"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Status"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, chem.batches.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: 10,
      className: "py-2",
      style: {
        color: C.muted
      }
    }, "No batches yet.")), [...chem.batches].sort((a, b) => a.expiryDate < b.expiryDate ? -1 : 1).map(b => {
      const used = isBatchUsedInTests(b.id, testRecords);
      return /*#__PURE__*/React.createElement("tr", {
        key: b.id,
        style: {
          borderTop: `1px solid ${C.border}`
        }
      }, /*#__PURE__*/React.createElement("td", {
        className: "py-1.5 font-medium"
      }, b.batchName || "—"), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, b.manufacturingDate || "—", b.expiryType === "shelf" ? ` (+${b.shelfLifeYears}y)` : ""), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, b.dateReceived), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, b.expiryDate), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, fmtNum(b.initialAmount), " ", chem.unit), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5 font-medium"
      }, fmtNum(b.remaining), " ", chem.unit), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, b.origin || "—"), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, b.receivedFrom || "—"), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, b.status === "active" && /*#__PURE__*/React.createElement(Badge, {
        tone: "ok"
      }, "Active"), b.status === "expired" && /*#__PURE__*/React.createElement(Badge, {
        tone: "warn"
      }, "Expired"), b.status === "depleted" && /*#__PURE__*/React.createElement(Badge, {
        tone: "muted"
      }, "Depleted")), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-1"
      }, /*#__PURE__*/React.createElement(IconButton, {
        name: "printer",
        color: C.info,
        title: "Print bottle label",
        onClick: () => printLabel({
          title: b.batchName || chem.name,
          lines: [{
            k: "Chemical",
            v: chem.name
          }, {
            k: "Batch",
            v: b.batchName || "—"
          }, {
            k: "Received",
            v: b.dateReceived
          }, {
            k: "Expiry",
            v: b.expiryDate
          }, {
            k: "Amount",
            v: `${fmtNum(b.initialAmount)} ${chem.unit}`
          }]
        })
      }), /*#__PURE__*/React.createElement(IconButton, {
        name: "edit",
        color: C.teal,
        title: "Edit batch",
        onClick: () => setEditBatch({
          chemId: chem.id,
          batch: b
        })
      }), /*#__PURE__*/React.createElement(IconButton, {
        name: "trash",
        color: C.warn,
        title: used ? "In use by a test record — delete that record first" : "Delete batch",
        disabled: used,
        onClick: () => setDeleteBatch({
          chemId: chem.id,
          batch: b
        })
      }))));
    }))), deleteBatch && deleteBatch.chemId === chem.id && /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete this batch (received ${deleteBatch.batch.dateReceived})? This cannot be undone.`,
      onConfirm: () => deleteBatchNow(chem.id, deleteBatch.batch),
      onCancel: () => setDeleteBatch(null)
    }));
  }), showAddChemical && /*#__PURE__*/React.createElement(Modal, {
    title: "Add Chemical",
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
      setShowAddChemical(false);
      notify(`Added chemical "${name}"`);
    },
    onCancel: () => setShowAddChemical(false)
  })), editChemicalFor && /*#__PURE__*/React.createElement(Modal, {
    title: "Edit Chemical",
    onClose: () => setEditChemicalFor(null)
  }, /*#__PURE__*/React.createElement(AddChemicalForm, {
    initial: editChemicalFor,
    masterList: masterChemicals,
    existingNames: chemicals.filter(c => c.id !== editChemicalFor.id).map(c => c.name),
    onSave: (name, unit) => {
      setChemicals(prev => prev.map(c => c.id === editChemicalFor.id ? {
        ...c,
        name,
        unit
      } : c));
      setEditChemicalFor(null);
      notify(`Updated chemical "${name}"`);
    },
    onCancel: () => setEditChemicalFor(null)
  })), batchFormFor && /*#__PURE__*/React.createElement(Modal, {
    title: "Add Batch",
    onClose: () => setBatchFormFor(null)
  }, /*#__PURE__*/React.createElement(AddBatchForm, {
    existingNames: (chemicals.find(c => c.id === batchFormFor)?.batches || []).map(b => b.batchName).filter(Boolean),
    onSave: batch => {
      setChemicals(prev => markExpiredBatches(prev.map(c => c.id === batchFormFor ? {
        ...c,
        batches: [...c.batches, {
          id: uid("batch"),
          ...batch,
          remaining: batch.initialAmount,
          status: "active"
        }]
      } : c)));
      setBatchFormFor(null);
      notify("Batch added to inventory");
    },
    onCancel: () => setBatchFormFor(null)
  })), editBatch && /*#__PURE__*/React.createElement(Modal, {
    title: "Edit Batch",
    onClose: () => setEditBatch(null)
  }, /*#__PURE__*/React.createElement(AddBatchForm, {
    initial: editBatch.batch,
    existingNames: (chemicals.find(c => c.id === editBatch.chemId)?.batches || []).filter(b => b.id !== editBatch.batch.id).map(b => b.batchName).filter(Boolean),
    onSave: payload => {
      setChemicals(prev => markExpiredBatches(prev.map(c => {
        if (c.id !== editBatch.chemId) return c;
        return {
          ...c,
          batches: c.batches.map(b => {
            if (b.id !== editBatch.batch.id) return b;
            const delta = payload.initialAmount - b.initialAmount;
            let remaining = +(b.remaining + delta).toFixed(4);
            if (remaining < 0) remaining = 0;
            let status = remaining <= 0 ? "depleted" : "active";
            return {
              ...b,
              ...payload,
              remaining,
              status
            };
          })
        };
      })));
      setEditBatch(null);
      notify("Batch updated");
    },
    onCancel: () => setEditBatch(null)
  })), showMasterList && /*#__PURE__*/React.createElement(MasterChemicalListModal, {
    masterList: masterChemicals,
    setMasterList: setMasterChemicals,
    existingNames: chemicals.map(c => c.name),
    setChemicals: setChemicals,
    notify: notify,
    onClose: () => setShowMasterList(false)
  })), invTab === "glassware" && /*#__PURE__*/React.createElement(SectionCard, {
    title: "Glassware Register",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 16,
      color: C.teal
    }),
    right: /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2 flex-wrap"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: () => downloadTemplate("glassware")
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "download",
      size: 13
    }), "Template"), /*#__PURE__*/React.createElement("input", {
      ref: glassUploadRef,
      type: "file",
      accept: ".xlsx,.xls,.csv",
      className: "hidden",
      onChange: e => {
        if (e.target.files[0]) importGlassware(e.target.files[0]);
        e.target.value = "";
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      onClick: () => glassUploadRef.current && glassUploadRef.current.click()
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "upload",
      size: 13
    }), "Import"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: () => setShowAddGlass(true)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 13
    }), "Add Glassware"))
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "One Excel file can list many different glassware item types at once — each row becomes its own item."), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      color: C.muted
    },
    className: "text-left"
  }, /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Name"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Received"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Origin"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Received From"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Total"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "In Store"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "In Use"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Broken"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, glassware.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 9,
    className: "py-2",
    style: {
      color: C.muted
    }
  }, "No glassware registered yet.")), glassware.map(g => {
    const inStore = g.totalQuantity - g.inUse - g.broken;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: g.id
    }, /*#__PURE__*/React.createElement("tr", {
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-1.5 font-medium"
    }, g.name), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, g.dateReceived), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, g.origin || "—"), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, g.receivedFrom || "—"), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, g.totalQuantity), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, inStore < 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.warn
      }
    }, inStore) : inStore), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, g.inUse), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, g.broken > 0 ? /*#__PURE__*/React.createElement(Badge, {
      tone: "warn",
      title: g.brokenLog && g.brokenLog.length ? `Last: ${g.brokenLog[g.brokenLog.length - 1].date} by ${g.brokenLog[g.brokenLog.length - 1].by || "—"}` : ""
    }, g.broken) : "0"), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2 flex-wrap items-center"
    }, /*#__PURE__*/React.createElement("button", {
      className: "text-xs underline",
      style: {
        color: C.teal
      },
      onClick: () => setMoveFormFor({
        id: g.id,
        mode: "toUse"
      })
    }, "To Analysis Room"), /*#__PURE__*/React.createElement("button", {
      className: "text-xs underline",
      style: {
        color: C.seafoam
      },
      onClick: () => setMoveFormFor({
        id: g.id,
        mode: "toStore"
      })
    }, "To Store"), /*#__PURE__*/React.createElement("button", {
      className: "text-xs underline",
      style: {
        color: C.warn
      },
      onClick: () => setMoveFormFor({
        id: g.id,
        mode: "break"
      })
    }, "Mark Broken"), /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit glassware",
      onClick: () => setEditGlassFor(g)
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: "Delete glassware",
      onClick: () => setDeleteGlassFor(g)
    })))), deleteGlassFor?.id === g.id && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: 9
    }, /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete glassware "${g.name}"? This cannot be undone.`,
      onConfirm: () => {
        setGlassware(prev => prev.filter(x => x.id !== g.id));
        setDeleteGlassFor(null);
        notify(`Deleted glassware "${g.name}"`);
      },
      onCancel: () => setDeleteGlassFor(null)
    }))));
  }))), showAddGlass && /*#__PURE__*/React.createElement(Modal, {
    title: "Add Glassware",
    onClose: () => setShowAddGlass(false)
  }, /*#__PURE__*/React.createElement(AddGlasswareForm, {
    onSave: payload => {
      setGlassware(prev => [...prev, {
        id: uid("glass"),
        ...payload
      }]);
      setShowAddGlass(false);
      notify(`Added glassware "${payload.name}"`);
    },
    onCancel: () => setShowAddGlass(false)
  })), editGlassFor && /*#__PURE__*/React.createElement(Modal, {
    title: "Edit Glassware",
    onClose: () => setEditGlassFor(null)
  }, /*#__PURE__*/React.createElement(AddGlasswareForm, {
    initial: editGlassFor,
    onSave: payload => {
      setGlassware(prev => prev.map(g => g.id === editGlassFor.id ? {
        ...g,
        ...payload
      } : g));
      setEditGlassFor(null);
      notify("Glassware updated");
    },
    onCancel: () => setEditGlassFor(null)
  })), moveFormFor && /*#__PURE__*/React.createElement(Modal, {
    title: moveFormFor.mode === "toUse" ? "Move to Analysis Room" : moveFormFor.mode === "toStore" ? "Move Back to Store" : "Mark Items Broken",
    onClose: () => setMoveFormFor(null)
  }, /*#__PURE__*/React.createElement(GlasswareMoveForm, {
    item: glassware.find(g => g.id === moveFormFor.id),
    mode: moveFormFor.mode,
    onSave: (qty, brokenInfo) => {
      setGlassware(prev => prev.map(g => {
        if (g.id !== moveFormFor.id) return g;
        if (moveFormFor.mode === "toUse") return {
          ...g,
          inUse: g.inUse + qty
        };
        if (moveFormFor.mode === "toStore") return {
          ...g,
          inUse: Math.max(0, g.inUse - qty)
        };
        const fromUse = Math.min(g.inUse, qty);
        return {
          ...g,
          inUse: g.inUse - fromUse,
          broken: g.broken + qty,
          brokenLog: [...(g.brokenLog || []), {
            id: uid("brk"),
            date: brokenInfo.date,
            by: brokenInfo.by,
            qty
          }]
        };
      }));
      setMoveFormFor(null);
      notify(moveFormFor.mode === "break" ? "Marked items as broken" : "Glassware quantity updated");
    },
    onCancel: () => setMoveFormFor(null)
  }))), invTab === "equipment" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => downloadTemplate("equipment")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download",
    size: 14
  }), "Download Template"), /*#__PURE__*/React.createElement("input", {
    ref: equipUploadRef,
    type: "file",
    accept: ".xlsx,.xls,.csv",
    className: "hidden",
    onChange: e => {
      if (e.target.files[0]) importEquipment(e.target.files[0]);
      e.target.value = "";
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: () => equipUploadRef.current && equipUploadRef.current.click()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 14
  }), "Import from Excel"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => setShowAddEquip(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Add Equipment")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "One Excel file can list many different equipment types at once — each row becomes its own equipment record."), equipment.map(eq => {
    const eqCollapsed = !!collapsedEquip[eq.id];
    return /*#__PURE__*/React.createElement(SectionCard, {
      key: eq.id,
      title: /*#__PURE__*/React.createElement("button", {
        onClick: () => toggleEquip(eq.id),
        className: "flex items-center gap-1.5 text-left"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: eqCollapsed ? "chevronRight" : "chevronDown",
        size: 14,
        color: C.muted
      }), eq.name),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "wrench",
        size: 16,
        color: C.teal
      }),
      right: /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-2"
      }, eq.functional ? /*#__PURE__*/React.createElement(Badge, {
        tone: "ok"
      }, "Functional") : /*#__PURE__*/React.createElement(Badge, {
        tone: "warn"
      }, "Not Functional"), /*#__PURE__*/React.createElement(IconButton, {
        name: "edit",
        color: C.teal,
        title: "Edit equipment",
        onClick: () => setEditEquipFor(eq)
      }), /*#__PURE__*/React.createElement(IconButton, {
        name: "trash",
        color: C.warn,
        title: "Delete equipment",
        onClick: () => setDeleteEquipFor(eq)
      }), /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outline",
        onClick: () => setEventFormFor(eq.id)
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 13
      }), "Log Event"))
    }, deleteEquipFor?.id === eq.id && /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete equipment "${eq.name}" and its full history? This cannot be undone.`,
      onConfirm: () => {
        setEquipment(prev => prev.filter(x => x.id !== eq.id));
        setDeleteEquipFor(null);
        notify(`Deleted equipment "${eq.name}"`);
      },
      onCancel: () => setDeleteEquipFor(null)
    }), !eqCollapsed && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "text-xs mb-2 flex flex-wrap gap-x-4 gap-y-1",
      style: {
        color: C.muted
      }
    }, /*#__PURE__*/React.createElement("span", null, "Received: ", eq.dateReceived), /*#__PURE__*/React.createElement("span", null, "Origin: ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: C.ink
      }
    }, eq.origin || "—")), /*#__PURE__*/React.createElement("span", null, "Received From: ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: C.ink
      }
    }, eq.receivedFrom || "—"))), /*#__PURE__*/React.createElement("table", {
      className: "w-full text-xs"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        color: C.muted
      },
      className: "text-left"
    }, /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Date"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Event"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Description"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Cost"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Functional After"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, eq.history.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: 6,
      className: "py-2",
      style: {
        color: C.muted
      }
    }, "No history logged yet.")), [...eq.history].sort((a, b) => a.date < b.date ? -1 : 1).map(h => /*#__PURE__*/React.createElement(React.Fragment, {
      key: h.id
    }, /*#__PURE__*/React.createElement("tr", {
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, h.date), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5 capitalize"
    }, h.type), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, h.description), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, h.cost ? `৳${fmtNum(h.cost)}` : "—"), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, h.functionalAfter ? /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, "Yes") : /*#__PURE__*/React.createElement(Badge, {
      tone: "warn"
    }, "No")), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-1"
    }, /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit event",
      onClick: () => setEditEvent({
        equipId: eq.id,
        evt: h
      })
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: "Delete event",
      onClick: () => setDeleteEvent({
        equipId: eq.id,
        evt: h
      })
    })))), deleteEvent && deleteEvent.equipId === eq.id && deleteEvent.evt.id === h.id && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: 6
    }, /*#__PURE__*/React.createElement(ConfirmBar, {
      text: "Delete this history event?",
      onConfirm: () => {
        setEquipment(prev => prev.map(e => {
          if (e.id !== eq.id) return e;
          const history = e.history.filter(x => x.id !== h.id);
          const last = [...history].sort((a, b) => a.date < b.date ? -1 : 1).slice(-1)[0];
          return {
            ...e,
            history,
            functional: last ? last.functionalAfter : true
          };
        }));
        setDeleteEvent(null);
        notify("Event deleted");
      },
      onCancel: () => setDeleteEvent(null)
    })))))))));
  }), showAddEquip && /*#__PURE__*/React.createElement(Modal, {
    title: "Add Equipment",
    onClose: () => setShowAddEquip(false)
  }, /*#__PURE__*/React.createElement(AddEquipmentForm, {
    onSave: payload => {
      setEquipment(prev => [...prev, {
        id: uid("equip"),
        ...payload,
        functional: true,
        history: []
      }]);
      setShowAddEquip(false);
      notify(`Added equipment "${payload.name}"`);
    },
    onCancel: () => setShowAddEquip(false)
  })), editEquipFor && /*#__PURE__*/React.createElement(Modal, {
    title: "Edit Equipment",
    onClose: () => setEditEquipFor(null)
  }, /*#__PURE__*/React.createElement(AddEquipmentForm, {
    initial: editEquipFor,
    onSave: payload => {
      setEquipment(prev => prev.map(e => e.id === editEquipFor.id ? {
        ...e,
        ...payload
      } : e));
      setEditEquipFor(null);
      notify("Equipment updated");
    },
    onCancel: () => setEditEquipFor(null)
  })), eventFormFor && /*#__PURE__*/React.createElement(Modal, {
    title: "Log Equipment Event",
    onClose: () => setEventFormFor(null)
  }, /*#__PURE__*/React.createElement(EquipmentEventForm, {
    onSave: evt => {
      setEquipment(prev => prev.map(eq => eq.id === eventFormFor ? {
        ...eq,
        functional: evt.functionalAfter,
        history: [...eq.history, {
          id: uid("evt"),
          ...evt
        }]
      } : eq));
      setEventFormFor(null);
      notify("Event logged for equipment");
    },
    onCancel: () => setEventFormFor(null)
  })), editEvent && /*#__PURE__*/React.createElement(Modal, {
    title: "Edit Equipment Event",
    onClose: () => setEditEvent(null)
  }, /*#__PURE__*/React.createElement(EquipmentEventForm, {
    initial: editEvent.evt,
    onSave: evt => {
      setEquipment(prev => prev.map(e => {
        if (e.id !== editEvent.equipId) return e;
        const history = e.history.map(h => h.id === editEvent.evt.id ? {
          ...h,
          ...evt
        } : h);
        const last = [...history].sort((a, b) => a.date < b.date ? -1 : 1).slice(-1)[0];
        return {
          ...e,
          history,
          functional: last ? last.functionalAfter : true
        };
      }));
      setEditEvent(null);
      notify("Event updated");
    },
    onCancel: () => setEditEvent(null)
  }))), invTab === "gas" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Gas cylinders (Acetylene, Argon, etc.) are tracked separately from chemicals because they're mostly topped up by ", /*#__PURE__*/React.createElement("strong", null, "refilling"), " an existing cylinder in kg, rather than bought as a fresh single-use batch. Per-sample gas usage is hard to calculate precisely, so it isn't auto-deducted — mark a cylinder \"Empty\" yourself once it runs out, then refill or add a new one. Test types can still link to a gas by name so reports show which tests used which gas."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mb-3"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => setShowAddGas(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Add Gas Type")), gasList.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-sm mb-3",
    style: {
      color: C.muted
    }
  }, "No gas types yet — add one (e.g. Acetylene) to get started."), gasList.map(g => {
    const isCollapsed = !!collapsedGas[g.id];
    return /*#__PURE__*/React.createElement(SectionCard, {
      key: g.id,
      title: /*#__PURE__*/React.createElement("button", {
        onClick: () => toggleGas(g.id),
        className: "flex items-center gap-1.5 text-left"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: isCollapsed ? "chevronRight" : "chevronDown",
        size: 14,
        color: C.muted
      }), `${g.name} (Unit: ${g.unit})`),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "flask",
        size: 16,
        color: C.teal
      }),
      right: /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-1"
      }, /*#__PURE__*/React.createElement(IconButton, {
        name: "edit",
        color: C.teal,
        title: "Edit gas",
        onClick: () => setEditGasFor(g)
      }), /*#__PURE__*/React.createElement(IconButton, {
        name: "trash",
        color: C.warn,
        title: "Delete gas",
        onClick: () => setDeleteGasFor(g),
        disabled: g.cylinders.length > 0
      }), /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outline",
        onClick: () => setCylinderFormFor(g.id)
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 13
      }), "New Cylinder"))
    }, deleteGasFor?.id === g.id && /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete gas "${g.name}"? This cannot be undone.`,
      onConfirm: () => deleteGasType(g),
      onCancel: () => setDeleteGasFor(null)
    }), !isCollapsed && /*#__PURE__*/React.createElement("table", {
      className: "w-full text-xs"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        color: C.muted
      },
      className: "text-left"
    }, /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Cylinder Name"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Received"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Capacity"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Remaining"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Origin"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Received From"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Status"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Last Activity"), /*#__PURE__*/React.createElement("th", {
      className: "pb-1.5"
    }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, g.cylinders.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: 9,
      className: "py-2",
      style: {
        color: C.muted
      }
    }, "No cylinders yet.")), g.cylinders.map(c => {
      const low = c.status === "active" && c.capacity > 0 && c.remaining / c.capacity < 0.15;
      const hist = c.history || [];
      const last = hist[hist.length - 1];
      const refillCount = hist.filter(h => h.type === "refill").length;
      return /*#__PURE__*/React.createElement("tr", {
        key: c.id,
        style: {
          borderTop: `1px solid ${C.border}`
        }
      }, /*#__PURE__*/React.createElement("td", {
        className: "py-1.5 font-medium"
      }, c.name || "—"), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, c.dateReceived), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, fmtNum(c.capacity), " ", g.unit), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5 font-medium"
      }, fmtNum(c.remaining), " ", g.unit, " ", low && /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.warn
        }
      }, "(low)")), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, c.origin || "—"), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, c.receivedFrom || "—"), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, c.status === "active" ? /*#__PURE__*/React.createElement(Badge, {
        tone: low ? "warn" : "ok"
      }, low ? "Low" : "Active") : /*#__PURE__*/React.createElement(Badge, {
        tone: "muted"
      }, "Empty")), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, /*#__PURE__*/React.createElement("button", {
        onClick: () => setHistoryFor({
          gasId: g.id,
          cylinder: c
        }),
        className: "flex items-center gap-1 flex-wrap"
      }, /*#__PURE__*/React.createElement(Badge, {
        tone: last?.type === "new" ? "info" : "ok"
      }, last?.type === "refill" ? "Refilled" : "New Cylinder"), last && /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.muted
        }
      }, last.date), refillCount > 0 && /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.muted
        }
      }, "(", refillCount, " refill", refillCount > 1 ? "s" : "", ")"))), /*#__PURE__*/React.createElement("td", {
        className: "py-1.5"
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-1 flex-wrap"
      }, /*#__PURE__*/React.createElement(IconButton, {
        name: "printer",
        color: C.info,
        title: "Print cylinder label",
        onClick: () => printLabel({
          title: c.name || g.name,
          lines: [{
            k: "Gas",
            v: g.name
          }, {
            k: "Cylinder",
            v: c.name || "—"
          }, {
            k: "Received",
            v: c.dateReceived
          }, {
            k: "Capacity",
            v: `${fmtNum(c.capacity)} ${g.unit}`
          }]
        })
      }), /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outline",
        onClick: () => setRefillFormFor({
          gasId: g.id,
          cylinder: c
        })
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "upload",
        size: 12
      }), "Refill"), c.status === "active" && /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "ghost",
        onClick: () => {
          setGasList(prev => prev.map(x => x.id === g.id ? {
            ...x,
            cylinders: x.cylinders.map(cy => cy.id === c.id ? {
              ...cy,
              remaining: 0,
              status: "empty"
            } : cy)
          } : x));
          notify(`Marked cylinder as empty — remember to refill or replace it.`, "warn");
        }
      }, "Mark Empty"), /*#__PURE__*/React.createElement(IconButton, {
        name: "edit",
        color: C.teal,
        title: "Edit cylinder",
        onClick: () => setEditCylinder({
          gasId: g.id,
          cylinder: c
        })
      }), /*#__PURE__*/React.createElement(IconButton, {
        name: "trash",
        color: C.warn,
        title: "Delete cylinder",
        onClick: () => setDeleteCylinder({
          gasId: g.id,
          cylinder: c
        })
      }))));
    }))), deleteCylinder && deleteCylinder.gasId === g.id && /*#__PURE__*/React.createElement(ConfirmBar, {
      text: `Delete this cylinder (received ${deleteCylinder.cylinder.dateReceived})? This cannot be undone.`,
      onConfirm: () => deleteCylinderNow(g.id, deleteCylinder.cylinder),
      onCancel: () => setDeleteCylinder(null)
    }));
  }), showAddGas && /*#__PURE__*/React.createElement(Modal, {
    title: "Add Gas Type",
    onClose: () => setShowAddGas(false)
  }, /*#__PURE__*/React.createElement(AddGasForm, {
    onSave: (name, unit) => {
      setGasList(prev => [...prev, {
        id: uid("gas"),
        name,
        unit,
        cylinders: []
      }]);
      setShowAddGas(false);
      notify(`Added gas "${name}"`);
    },
    onCancel: () => setShowAddGas(false)
  })), editGasFor && /*#__PURE__*/React.createElement(Modal, {
    title: "Edit Gas Type",
    onClose: () => setEditGasFor(null)
  }, /*#__PURE__*/React.createElement(AddGasForm, {
    initial: editGasFor,
    onSave: (name, unit) => {
      setGasList(prev => prev.map(g => g.id === editGasFor.id ? {
        ...g,
        name,
        unit
      } : g));
      setEditGasFor(null);
      notify(`Updated gas "${name}"`);
    },
    onCancel: () => setEditGasFor(null)
  })), cylinderFormFor && /*#__PURE__*/React.createElement(Modal, {
    title: "New Cylinder",
    onClose: () => setCylinderFormFor(null)
  }, /*#__PURE__*/React.createElement(AddCylinderForm, {
    unit: gasList.find(g => g.id === cylinderFormFor)?.unit || "kg",
    existingNames: (gasList.find(g => g.id === cylinderFormFor)?.cylinders || []).map(c => c.name).filter(Boolean),
    onSave: payload => {
      setGasList(prev => prev.map(g => g.id === cylinderFormFor ? {
        ...g,
        cylinders: [...g.cylinders, {
          id: uid("cyl"),
          ...payload,
          remaining: payload.capacity,
          status: "active",
          history: [{
            id: uid("gevt"),
            date: payload.dateReceived,
            type: "new",
            amount: payload.capacity,
            cost: 0,
            note: "New cylinder received"
          }]
        }]
      } : g));
      setCylinderFormFor(null);
      notify("New cylinder added to inventory");
    },
    onCancel: () => setCylinderFormFor(null)
  })), editCylinder && /*#__PURE__*/React.createElement(Modal, {
    title: "Edit Cylinder",
    onClose: () => setEditCylinder(null)
  }, /*#__PURE__*/React.createElement(AddCylinderForm, {
    initial: editCylinder.cylinder,
    unit: gasList.find(g => g.id === editCylinder.gasId)?.unit || "kg",
    existingNames: (gasList.find(g => g.id === editCylinder.gasId)?.cylinders || []).filter(c => c.id !== editCylinder.cylinder.id).map(c => c.name).filter(Boolean),
    onSave: payload => {
      setGasList(prev => prev.map(g => {
        if (g.id !== editCylinder.gasId) return g;
        return {
          ...g,
          cylinders: g.cylinders.map(c => {
            if (c.id !== editCylinder.cylinder.id) return c;
            let remaining = Math.min(c.remaining, payload.capacity);
            return {
              ...c,
              ...payload,
              remaining,
              status: remaining > 0 ? "active" : "empty"
            };
          })
        };
      }));
      setEditCylinder(null);
      notify("Cylinder updated");
    },
    onCancel: () => setEditCylinder(null)
  })), refillFormFor && /*#__PURE__*/React.createElement(Modal, {
    title: "Refill Cylinder",
    onClose: () => setRefillFormFor(null)
  }, /*#__PURE__*/React.createElement(RefillCylinderForm, {
    cylinder: refillFormFor.cylinder,
    unit: gasList.find(g => g.id === refillFormFor.gasId)?.unit || "kg",
    onSave: payload => {
      setGasList(prev => prev.map(g => {
        if (g.id !== refillFormFor.gasId) return g;
        return {
          ...g,
          cylinders: g.cylinders.map(c => {
            if (c.id !== refillFormFor.cylinder.id) return c;
            const remaining = Math.min(c.capacity, c.remaining + payload.amount);
            return {
              ...c,
              remaining,
              status: "active",
              history: [...(c.history || []), {
                id: uid("gevt"),
                date: payload.date,
                type: "refill",
                amount: payload.amount,
                cost: payload.cost,
                note: payload.note
              }]
            };
          })
        };
      }));
      setRefillFormFor(null);
      notify("Cylinder refilled");
    },
    onCancel: () => setRefillFormFor(null)
  })), historyFor && /*#__PURE__*/React.createElement(Modal, {
    title: `Cylinder History — received ${historyFor.cylinder.dateReceived}`,
    onClose: () => setHistoryFor(null)
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      color: C.muted
    },
    className: "text-left"
  }, /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Date"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Type"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Amount"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Cost"), /*#__PURE__*/React.createElement("th", {
    className: "pb-1.5"
  }, "Note"))), /*#__PURE__*/React.createElement("tbody", null, (historyFor.cylinder.history || []).map(h => /*#__PURE__*/React.createElement("tr", {
    key: h.id,
    style: {
      borderTop: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, h.date), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: h.type === "new" ? "info" : "ok"
  }, h.type === "new" ? "New Cylinder" : "Refill")), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, fmtNum(h.amount), " ", gasList.find(g => g.id === historyFor.gasId)?.unit), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, h.cost ? `৳${fmtNum(h.cost)}` : "—"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, h.note || "—"))))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mt-3"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: () => setHistoryFor(null)
  }, "Close")))));
}
function MasterChemicalListModal({
  masterList,
  setMasterList,
  existingNames,
  setChemicals,
  notify,
  onClose
}) {
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState(null); // original name being edited
  const [editValue, setEditValue] = useState("");
  function add() {
    const n = newName.trim();
    if (!n || masterList.some(m => m.toLowerCase() === n.toLowerCase())) return;
    setMasterList(prev => [...prev, n]);
    setNewName("");
  }
  function startEdit(n) {
    setEditingName(n);
    setEditValue(n);
  }
  function saveEdit() {
    const nv = editValue.trim();
    if (!nv || nv.toLowerCase() !== editingName.toLowerCase() && masterList.some(m => m.toLowerCase() === nv.toLowerCase())) return;
    setMasterList(prev => prev.map(m => m === editingName ? nv : m));
    // Keep any matching inventory chemical's name in sync so batches/test types don't silently detach.
    if (setChemicals) setChemicals(prev => prev.map(c => c.name === editingName ? {
      ...c,
      name: nv
    } : c));
    notify && notify(`Renamed "${editingName}" to "${nv}"`);
    setEditingName(null);
    setEditValue("");
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Master Chemical List",
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-3 p-2 rounded",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "This is the approved list of chemical names admins can add to inventory from — it stops the same chemical being typed in twice under slightly different names. Use Edit to fix a typo — if that chemical already exists in inventory, its name is updated too."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-3"
  }, /*#__PURE__*/React.createElement("input", {
    className: "border rounded px-2 py-1.5 text-sm flex-1",
    style: {
      borderColor: C.border
    },
    value: newName,
    onChange: e => setNewName(e.target.value),
    placeholder: "e.g. Sulfuric Acid",
    onKeyDown: e => e.key === "Enter" && add()
  }), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: add
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  }), "Add")), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-1 max-h-72 overflow-y-auto"
  }, masterList.map(n => {
    const inUse = existingNames.includes(n);
    const isEditing = editingName === n;
    return /*#__PURE__*/React.createElement("div", {
      key: n,
      className: "flex items-center justify-between text-sm px-2 py-1.5 rounded gap-2",
      style: {
        background: "#FAFEFE",
        border: `1px solid ${C.border}`
      }
    }, isEditing ? /*#__PURE__*/React.createElement("input", {
      autoFocus: true,
      className: "border rounded px-2 py-1 text-sm flex-1",
      style: {
        borderColor: C.border
      },
      value: editValue,
      onChange: e => setEditValue(e.target.value),
      onKeyDown: e => e.key === "Enter" && saveEdit()
    }) : /*#__PURE__*/React.createElement("span", null, n), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 shrink-0"
    }, inUse && /*#__PURE__*/React.createElement(Badge, {
      tone: "info"
    }, "in inventory"), isEditing ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
      name: "check",
      color: C.ok,
      title: "Save name",
      onClick: saveEdit
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "x",
      color: C.muted,
      title: "Cancel",
      onClick: () => setEditingName(null)
    })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit name",
      onClick: () => startEdit(n)
    }), /*#__PURE__*/React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: inUse ? "Already in inventory — remove the chemical first" : "Remove from master list",
      disabled: inUse,
      onClick: () => setMasterList(prev => prev.filter(m => m !== n))
    }))));
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mt-3"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Close")));
}
function AddChemicalForm({
  onSave,
  onCancel,
  initial,
  masterList = [],
  existingNames = []
}) {
  const available = masterList.filter(n => n === initial?.name || !existingNames.includes(n));
  const [name, setName] = useState(initial?.name || available[0] || "");
  const [unit, setUnit] = useState(initial?.unit || "ml");
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, available.length === 0 && !initial ? /*#__PURE__*/React.createElement("div", {
    className: "text-xs p-2 rounded",
    style: {
      background: C.warnBg,
      color: C.warn
    }
  }, "Every chemical in the Master List has already been added to inventory. Use \"Master Chemical List\" to add a new name first.") : /*#__PURE__*/React.createElement(SelectField, {
    label: "Chemical Name (from Master List)",
    value: name,
    onChange: e => setName(e.target.value),
    options: available.map(n => ({
      value: n,
      label: n
    })),
    placeholder: "Select a chemical..."
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Unit",
    value: unit,
    onChange: e => setUnit(e.target.value),
    placeholder: "ml, g, L"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    disabled: !name,
    onClick: () => name && onSave(name, unit.trim() || "ml")
  }, "Save")));
}
function addYears(dateStr, years) {
  if (!dateStr || !years) return "";
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + Number(years));
  return d.toISOString().slice(0, 10);
}
function AddBatchForm({
  onSave,
  onCancel,
  initial,
  existingNames = []
}) {
  const [batchName, setBatchName] = useState(initial?.batchName || "");
  const [dateReceived, setDateReceived] = useState(initial?.dateReceived || todayStr());
  const [manufacturingDate, setManufacturingDate] = useState(initial?.manufacturingDate || "");
  const [expiryType, setExpiryType] = useState(initial?.expiryType || "exact");
  const [shelfLifeYears, setShelfLifeYears] = useState(initial?.shelfLifeYears ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate || "");
  const [amount, setAmount] = useState(initial?.initialAmount ?? "");
  const [origin, setOrigin] = useState(initial?.origin || "");
  const [receivedFrom, setReceivedFrom] = useState(initial?.receivedFrom || "");
  const usedAmount = initial ? +(initial.initialAmount - initial.remaining).toFixed(4) : 0;
  const belowUsed = initial && amount !== "" && Number(amount) < usedAmount;
  const computedExpiry = expiryType === "shelf" ? addYears(manufacturingDate, shelfLifeYears) : expiryDate;
  const nameDupe = batchName.trim() && existingNames.some(n => n.toLowerCase() === batchName.trim().toLowerCase());
  const canSave = computedExpiry && amount !== "" && !belowUsed && batchName.trim() && !nameDupe;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Batch Name / Label (printed on bottle)",
    value: batchName,
    onChange: e => setBatchName(e.target.value),
    placeholder: "e.g. HCl-2026-01"
  }), nameDupe && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), "This batch name is already used for this chemical — pick a unique one."), /*#__PURE__*/React.createElement(TextField, {
    label: "Date of Receive",
    type: "date",
    value: dateReceived,
    onChange: e => setDateReceived(e.target.value)
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Manufacturing Date",
    type: "date",
    value: manufacturingDate,
    onChange: e => setManufacturingDate(e.target.value)
  }), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "Expiry Type", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: {
      borderColor: C.border
    },
    value: expiryType,
    onChange: e => setExpiryType(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "exact"
  }, "Exact Expiry Date"), /*#__PURE__*/React.createElement("option", {
    value: "shelf"
  }, "Shelf Life (Years from Manufacturing Date)"))), expiryType === "exact" ? /*#__PURE__*/React.createElement(TextField, {
    label: "Expiry Date",
    type: "date",
    value: expiryDate,
    onChange: e => setExpiryDate(e.target.value)
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TextField, {
    label: "Shelf Life (Years)",
    type: "number",
    min: "0",
    step: "0.5",
    value: shelfLifeYears,
    onChange: e => setShelfLifeYears(e.target.value),
    placeholder: "e.g. 2"
  }), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Computed Expiry Date: ", /*#__PURE__*/React.createElement("span", {
    className: "font-semibold",
    style: {
      color: C.ink
    }
  }, computedExpiry || "— set Manufacturing Date & Years"))), /*#__PURE__*/React.createElement(TextField, {
    label: "Amount",
    type: "number",
    min: initial ? usedAmount : undefined,
    value: amount,
    onChange: e => setAmount(e.target.value),
    placeholder: "e.g. 500"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Origin of the Product",
    value: origin,
    onChange: e => setOrigin(e.target.value),
    placeholder: "e.g. Central Reagent Store"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Received From",
    value: receivedFrom,
    onChange: e => setReceivedFrom(e.target.value),
    placeholder: "e.g. DPHE Water Safety Project"
  }), initial && !belowUsed && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Changing the amount will adjust the remaining stock by the same difference. This batch already has ", fmtNum(usedAmount), " used by test records, so the amount can't go below that."), belowUsed && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), "Amount can't be less than ", fmtNum(usedAmount), " — that much has already been used from this batch in test records."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    disabled: !canSave,
    onClick: () => canSave && onSave({
      batchName: batchName.trim(),
      dateReceived,
      manufacturingDate,
      expiryType,
      shelfLifeYears: expiryType === "shelf" ? Number(shelfLifeYears) || 0 : 0,
      expiryDate: computedExpiry,
      initialAmount: Number(amount),
      origin: origin.trim(),
      receivedFrom: receivedFrom.trim()
    })
  }, "Save")));
}
const GAS_UNIT_OPTIONS = ["L", "m³", "kg", "Cylinder", "SCF"];
function AddGasForm({
  onSave,
  onCancel,
  initial
}) {
  const [name, setName] = useState(initial?.name || "");
  const knownUnit = initial && GAS_UNIT_OPTIONS.includes(initial.unit);
  const [unit, setUnit] = useState(initial?.unit || "kg");
  const [customUnit, setCustomUnit] = useState(initial && !knownUnit ? initial.unit : "");
  const [useCustom, setUseCustom] = useState(initial ? !knownUnit : false);
  const finalUnit = (useCustom ? customUnit : unit).trim();
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Gas Name",
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. Acetylene, Argon"
  }), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "Unit", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: {
      borderColor: C.border
    },
    value: useCustom ? "__custom" : unit,
    onChange: e => {
      if (e.target.value === "__custom") setUseCustom(true);else {
        setUseCustom(false);
        setUnit(e.target.value);
      }
    }
  }, GAS_UNIT_OPTIONS.map(u => /*#__PURE__*/React.createElement("option", {
    key: u,
    value: u
  }, u)), /*#__PURE__*/React.createElement("option", {
    value: "__custom"
  }, "Other (type below)"))), useCustom && /*#__PURE__*/React.createElement(TextField, {
    label: "Custom Unit",
    value: customUnit,
    onChange: e => setCustomUnit(e.target.value),
    placeholder: "e.g. lb"
  }), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Different gases can use different units — this only sets the unit for this gas type, existing cylinders/history keep their recorded values."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    disabled: !name.trim() || !finalUnit,
    onClick: () => name.trim() && finalUnit && onSave(name.trim(), finalUnit)
  }, "Save")));
}
function AddCylinderForm({
  onSave,
  onCancel,
  initial,
  unit = "kg",
  existingNames = []
}) {
  const [name, setName] = useState(initial?.name || "");
  const [dateReceived, setDateReceived] = useState(initial?.dateReceived || todayStr());
  const [capacity, setCapacity] = useState(initial?.capacity ?? "");
  const [origin, setOrigin] = useState(initial?.origin || "");
  const [receivedFrom, setReceivedFrom] = useState(initial?.receivedFrom || "");
  const minCapacity = initial ? +(initial.capacity - initial.remaining).toFixed(4) : 0;
  const belowUsed = initial && capacity !== "" && Number(capacity) < minCapacity;
  const nameDupe = name.trim() && existingNames.some(n => n.toLowerCase() === name.trim().toLowerCase());
  const canSave = capacity !== "" && !belowUsed && name.trim() && !nameDupe;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Cylinder Name / Label (printed on cylinder)",
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. Acetylene-C1"
  }), nameDupe && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), "This cylinder name is already used for this gas — pick a unique one."), /*#__PURE__*/React.createElement(TextField, {
    label: "Date Received",
    type: "date",
    value: dateReceived,
    onChange: e => setDateReceived(e.target.value)
  }), /*#__PURE__*/React.createElement(TextField, {
    label: `Capacity (${unit})`,
    type: "number",
    min: initial ? minCapacity : undefined,
    value: capacity,
    onChange: e => setCapacity(e.target.value),
    placeholder: "e.g. 40"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Origin of the Product",
    value: origin,
    onChange: e => setOrigin(e.target.value),
    placeholder: "e.g. Bangladesh Oxygen Ltd."
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Received From",
    value: receivedFrom,
    onChange: e => setReceivedFrom(e.target.value),
    placeholder: "e.g. Zonal Office Procurement"
  }), !initial && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "A new cylinder starts out full (remaining = capacity)."), belowUsed && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), "Capacity can't be less than the amount already consumed (", fmtNum(minCapacity), " ", unit, ")."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    disabled: !canSave,
    onClick: () => canSave && onSave({
      name: name.trim(),
      dateReceived,
      capacity: Number(capacity),
      origin: origin.trim(),
      receivedFrom: receivedFrom.trim()
    })
  }, "Save")));
}
function RefillCylinderForm({
  cylinder,
  unit,
  onSave,
  onCancel
}) {
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const room = cylinder ? +(cylinder.capacity - cylinder.remaining).toFixed(4) : 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, cylinder && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Currently ", fmtNum(cylinder.remaining), " / ", fmtNum(cylinder.capacity), " ", unit, " — room for up to ", fmtNum(room), " ", unit, " more."), /*#__PURE__*/React.createElement(TextField, {
    label: "Refill Date",
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value)
  }), /*#__PURE__*/React.createElement(TextField, {
    label: `Amount Refilled (${unit})`,
    type: "number",
    min: "0",
    max: room,
    value: amount,
    onChange: e => setAmount(e.target.value),
    placeholder: "e.g. 25"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Refill Cost (৳, optional)",
    type: "number",
    min: "0",
    value: cost,
    onChange: e => setCost(e.target.value),
    placeholder: "e.g. 3500"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Note (optional)",
    value: note,
    onChange: e => setNote(e.target.value),
    placeholder: "e.g. Vendor / invoice ref."
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => {
      const n = Number(amount);
      if (n > 0) onSave({
        date,
        amount: n,
        cost: Number(cost) || 0,
        note: note.trim()
      });
    }
  }, "Save")));
}
function AddGlasswareForm({
  onSave,
  onCancel,
  initial
}) {
  const [name, setName] = useState(initial?.name || "");
  const [dateReceived, setDateReceived] = useState(initial?.dateReceived || todayStr());
  const [totalQuantity, setTotalQuantity] = useState(initial?.totalQuantity ?? "");
  const [origin, setOrigin] = useState(initial?.origin || "");
  const [receivedFrom, setReceivedFrom] = useState(initial?.receivedFrom || "");
  const minQty = initial ? initial.inUse + initial.broken : 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Item Name",
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. Conical Flask 250ml"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Date of Receive",
    type: "date",
    value: dateReceived,
    onChange: e => setDateReceived(e.target.value)
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Total Quantity",
    type: "number",
    min: minQty,
    value: totalQuantity,
    onChange: e => setTotalQuantity(e.target.value),
    placeholder: "e.g. 20"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Origin of the Product",
    value: origin,
    onChange: e => setOrigin(e.target.value),
    placeholder: "e.g. Central Glassware Store"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Received From",
    value: receivedFrom,
    onChange: e => setReceivedFrom(e.target.value),
    placeholder: "e.g. DPHE Water Safety Project"
  }), !initial && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "New items are added as fully in-store (0 in use, 0 broken) — move quantities afterward as needed."), initial && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "Total quantity must be at least ", minQty, " (currently in use + broken)."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => {
      if (!name.trim() || totalQuantity === "" || Number(totalQuantity) < minQty) return;
      onSave(initial ? {
        name: name.trim(),
        dateReceived,
        totalQuantity: Number(totalQuantity),
        origin: origin.trim(),
        receivedFrom: receivedFrom.trim()
      } : {
        name: name.trim(),
        dateReceived,
        totalQuantity: Number(totalQuantity),
        inUse: 0,
        broken: 0,
        origin: origin.trim(),
        receivedFrom: receivedFrom.trim()
      });
    }
  }, "Save")));
}
function GlasswareMoveForm({
  item,
  mode,
  onSave,
  onCancel
}) {
  const [qty, setQty] = useState("");
  const [brokenDate, setBrokenDate] = useState(todayStr());
  const [brokenBy, setBrokenBy] = useState("");
  if (!item) return null;
  const inStore = item.totalQuantity - item.inUse - item.broken;
  const max = mode === "toUse" ? inStore : mode === "toStore" ? item.inUse : inStore + item.inUse;
  const helper = mode === "toUse" ? `Available in store: ${inStore}` : mode === "toStore" ? `Currently in analysis room: ${item.inUse}` : `Available to mark broken (store + in use): ${inStore + item.inUse}`;
  const valid = mode === "break" ? brokenBy.trim().length > 0 : true;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium",
    style: {
      color: C.ink
    }
  }, item.name), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, helper), /*#__PURE__*/React.createElement(TextField, {
    label: "Quantity",
    type: "number",
    min: "1",
    max: max,
    value: qty,
    onChange: e => setQty(e.target.value),
    placeholder: "e.g. 2"
  }), mode === "break" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TextField, {
    label: "Broken Date",
    type: "date",
    value: brokenDate,
    onChange: e => setBrokenDate(e.target.value)
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Broken By",
    value: brokenBy,
    onChange: e => setBrokenBy(e.target.value),
    placeholder: "e.g. tester name"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    disabled: !valid,
    onClick: () => {
      const n = Number(qty);
      if (n > 0 && n <= max && valid) onSave(n, {
        date: brokenDate,
        by: brokenBy.trim()
      });
    }
  }, "Confirm")));
}
function AddEquipmentForm({
  onSave,
  onCancel,
  initial
}) {
  const [name, setName] = useState(initial?.name || "");
  const [dateReceived, setDateReceived] = useState(initial?.dateReceived || todayStr());
  const [origin, setOrigin] = useState(initial?.origin || "");
  const [receivedFrom, setReceivedFrom] = useState(initial?.receivedFrom || "");
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Equipment Name",
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. Turbidity Meter"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Date of Receive",
    type: "date",
    value: dateReceived,
    onChange: e => setDateReceived(e.target.value)
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Origin of the Equipment",
    value: origin,
    onChange: e => setOrigin(e.target.value),
    placeholder: "e.g. Manufacturer — HACH"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Received From",
    value: receivedFrom,
    onChange: e => setReceivedFrom(e.target.value),
    placeholder: "e.g. DPHE Water Safety Project"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => name.trim() && onSave({
      name: name.trim(),
      dateReceived,
      origin: origin.trim(),
      receivedFrom: receivedFrom.trim()
    })
  }, "Save")));
}
function EquipmentEventForm({
  onSave,
  onCancel,
  initial
}) {
  const [type, setType] = useState(initial?.type || "breakdown");
  const [date, setDate] = useState(initial?.date || todayStr());
  const [description, setDescription] = useState(initial?.description || "");
  const [cost, setCost] = useState(initial?.cost ?? "");
  const [functionalAfter, setFunctionalAfter] = useState(initial ? initial.functionalAfter : type === "repair");
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs",
    style: {
      color: C.muted
    }
  }, "Event Type", /*#__PURE__*/React.createElement("select", {
    className: "border rounded px-2 py-1.5 text-sm",
    style: {
      borderColor: C.border
    },
    value: type,
    onChange: e => {
      setType(e.target.value);
      setFunctionalAfter(e.target.value === "repair");
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "breakdown"
  }, "Breakdown / Fault"), /*#__PURE__*/React.createElement("option", {
    value: "repair"
  }, "Repair"), /*#__PURE__*/React.createElement("option", {
    value: "other"
  }, "Others"))), /*#__PURE__*/React.createElement(TextField, {
    label: "Date",
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value)
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Description",
    value: description,
    onChange: e => setDescription(e.target.value),
    placeholder: "What broke / what was fixed"
  }), (type === "repair" || type === "other") && /*#__PURE__*/React.createElement(TextField, {
    label: `Cost Incurred (৳)${type === "other" ? " — optional" : ""}`,
    type: "number",
    value: cost,
    onChange: e => setCost(e.target.value),
    placeholder: "e.g. 2500"
  }), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-xs",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: functionalAfter,
    onChange: e => setFunctionalAfter(e.target.checked)
  }), "Equipment is functional after this event"), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => description.trim() && onSave({
      type,
      date,
      description: description.trim(),
      cost: Number(cost) || 0,
      functionalAfter
    })
  }, "Save")));
}
