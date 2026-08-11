// ===== 30-dashboard.js =====
// ============================================================================
// DASHBOARD TAB — KPI snapshot, inventory health, equipment status, today's
// workload. Sample Lifecycle KPIs (pending review / awaiting release /
// overdue) are appended into this same tab below the original content so
// lab staff see everything on one screen, exactly like STARLIMS/SampleManager
// dashboards do.
// ============================================================================
function DashboardTab({
  chemicals,
  glassware,
  equipment,
  gasList,
  testRecords,
  goTo
}) {
  const allBatches = chemicals.flatMap(c => c.batches.map(b => ({
    ...b,
    chemName: c.name,
    unit: c.unit
  })));
  const activeBatches = allBatches.filter(b => b.status === "active");
  const expiringSoon = activeBatches.filter(b => daysUntil(b.expiryDate) <= 30 && daysUntil(b.expiryDate) >= 0);
  const expired = allBatches.filter(b => b.status === "expired");
  const depleted = allBatches.filter(b => b.status === "depleted");
  // Low stock: active batch with remaining stock below 15% of its initial amount (and not already empty/expired).
  const lowStock = activeBatches.filter(b => b.initialAmount > 0 && b.remaining > 0 && b.remaining / b.initialAmount < 0.15);
  const allCylinders = (gasList || []).flatMap(g => g.cylinders.map(c => ({
    ...c,
    gasName: g.name,
    unit: g.unit
  })));
  const emptyCylinders = allCylinders.filter(c => c.status === "empty");
  const lowGasCylinders = allCylinders.filter(c => c.status === "active" && c.capacity > 0 && c.remaining / c.capacity < 0.15);
  const totalGlassItems = glassware.reduce((s, g) => s + g.totalQuantity, 0);
  const totalBroken = glassware.reduce((s, g) => s + g.broken, 0);
  const totalInUse = glassware.reduce((s, g) => s + g.inUse, 0);
  const functionalEquip = equipment.filter(e => e.functional).length;
  const nonFunctionalEquip = equipment.length - functionalEquip;
  const recentTests = [...testRecords].reverse().slice(0, 6);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mb-5"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-lg font-semibold",
    style: {
      color: C.ink
    }
  }, t("welcome")), /*#__PURE__*/React.createElement("p", {
    className: "text-sm",
    style: {
      color: C.muted
    }
  }, t("welcomeSub"))), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3 mb-6",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Chemical Types",
    value: chemicals.length,
    sub: `${activeBatches.length} active batches`,
    icon: "flask",
    onClick: () => goTo("inventory", "chemicals")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Expiring Soon (≤30 days)",
    value: expiringSoon.length,
    sub: expired.length ? `${expired.length} already expired` : "none expired",
    tone: expiringSoon.length || expired.length ? "warn" : "ink",
    icon: "warning",
    onClick: () => goTo("inventory", "chemicals")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Glassware Items",
    value: totalGlassItems,
    sub: `${totalInUse} in analysis room · ${totalBroken} broken`,
    icon: "beaker",
    onClick: () => goTo("inventory", "glassware")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Equipment",
    value: equipment.length,
    sub: `${functionalEquip} functional · ${nonFunctionalEquip} down`,
    tone: nonFunctionalEquip ? "warn" : "ink",
    icon: "wrench",
    onClick: () => goTo("inventory", "equipment")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Gas Cylinders",
    value: allCylinders.length,
    sub: `${emptyCylinders.length} empty · ${lowGasCylinders.length} running low`,
    tone: emptyCylinders.length || lowGasCylinders.length ? "warn" : "ink",
    icon: "flask",
    onClick: () => goTo("inventory", "gas")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Test Records",
    value: testRecords.length,
    sub: "total logged tests",
    icon: "clipboard",
    onClick: () => goTo("testRecords")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Depleted Batches",
    value: depleted.length,
    sub: "need restocking",
    tone: depleted.length ? "warn" : "ink",
    icon: "ban",
    onClick: () => goTo("inventory", "chemicals")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Low Stock (<15%)",
    value: lowStock.length,
    sub: "batches running low",
    tone: lowStock.length ? "warn" : "ink",
    icon: "warning",
    onClick: () => goTo("inventory", "chemicals")
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-5",
    style: {
      gridTemplateColumns: "1.2fr 1fr"
    }
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Recent Test Records",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    })
  }, recentTests.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-sm",
    style: {
      color: C.muted
    }
  }, "No test records yet — add one from the \"Add Test Record\" tab."), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("tbody", null, recentTests.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id,
    style: {
      borderTop: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, r.date), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 font-medium"
  }, r.testTypeName), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, r.tester)))))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Attention Needed",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 16,
      color: C.warn
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2 text-xs"
  }, expired.length === 0 && expiringSoon.length === 0 && depleted.length === 0 && lowStock.length === 0 && nonFunctionalEquip === 0 && totalBroken === 0 && emptyCylinders.length === 0 && lowGasCylinders.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.muted
    }
  }, "Everything looks in order right now."), expired.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    className: "flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 12
  }), b.chemName, " batch expired (", b.expiryDate, ")")), expiringSoon.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    className: "flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 12
  }), b.chemName, " batch expires in ", daysUntil(b.expiryDate), " day(s)")), lowStock.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    className: "flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 12
  }), b.chemName, " batch low on stock (", fmtNum(b.remaining), "/", fmtNum(b.initialAmount), " ", b.unit, " left)")), depleted.slice(0, 5).map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    className: "flex items-center gap-1.5",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ban",
    size: 12
  }), b.chemName, " batch depleted")), emptyCylinders.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    className: "flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "flask",
    size: 12
  }), c.gasName, " cylinder is empty — refill or replace")), lowGasCylinders.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    className: "flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "flask",
    size: 12
  }), c.gasName, " cylinder running low (", fmtNum(c.remaining), "/", fmtNum(c.capacity), " ", c.unit, ")")), equipment.filter(e => !e.functional).map(e => /*#__PURE__*/React.createElement("div", {
    key: e.id,
    className: "flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "wrench",
    size: 12
  }), e.name, " is not functional")), totalBroken > 0 && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1.5",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "beaker",
    size: 12
  }), totalBroken, " glassware item(s) marked broken")))));
}

// ============================================================================
// INVENTORY TAB
// ============================================================================

// ---- Sample Lifecycle KPI strip, rendered by LabApp above/alongside DashboardTab ----
function SampleKpiStrip({
  samples,
  goTo
}) {
  const stats = sampleLifecycleStats(samples);
  return /*#__PURE__*/React.createElement(SectionCard, {
    title: "Sample Lifecycle",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 15,
      color: C.teal
    }),
    right: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: () => goTo("samples")
    }, "Open Samples ", /*#__PURE__*/React.createElement(Icon, {
      name: "arrowRight",
      size: 12
    }))
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3"
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Active Samples",
    value: stats.activeCount,
    icon: "beaker",
    onClick: () => goTo("samples")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Pending Review",
    value: stats.pendingApproval,
    icon: "chart",
    tone: stats.pendingApproval ? "warn" : "ink",
    onClick: () => goTo("samples")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Awaiting Release",
    value: stats.awaitingRelease,
    icon: "printer",
    onClick: () => goTo("samples")
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Overdue (TAT)",
    value: stats.overdue,
    icon: "warning",
    tone: stats.overdue ? "warn" : "ink",
    onClick: () => goTo("samples")
  })));
}
