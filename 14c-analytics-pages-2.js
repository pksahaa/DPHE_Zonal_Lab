// ===== 14c-analytics-pages-2.js (Inventory/Glassware/Gas/Equipment/Trends/Forecast pages) =====
function InventoryAnalyticsPage({
  filteredRecords,
  filteredChemicals,
  filteredGlassware,
  filteredGas,
  filteredEquipment,
  rangeDays
}) {
  const totalChemBatches = sum(filteredChemicals.map(c => c.batches.length));
  const totalGlassUnits = sum(filteredGlassware.map(g => g.totalQuantity));
  const totalCylinders = sum(filteredGas.map(g => g.cylinders.length));
  const totalEquip = filteredEquipment.length;
  const totalConsumed = sum(filteredRecords.flatMap(r => Object.values(r.consumption || {})));
  const avgActiveStock = avg(filteredChemicals.map(c => sum(c.batches.filter(b => b.status === "active").map(b => b.remaining))));
  const turnover = avgActiveStock > 0 ? +(totalConsumed / (avgActiveStock * filteredChemicals.length || 1)).toFixed(2) : 0;
  const treemapItems = filteredChemicals.map((c, i) => ({
    label: c.name,
    value: sum(c.batches.filter(b => b.status === "active").map(b => b.remaining)),
    unit: ` ${c.unit}`,
    color: paletteColor(i)
  })).filter(i => i.value > 0);
  let active = 0,
    expired = 0,
    depleted = 0;
  filteredChemicals.forEach(c => c.batches.forEach(b => {
    if (b.status === "active") active++;else if (b.status === "expired") expired++;else depleted++;
  }));
  const functional = filteredEquipment.filter(e => e.functional).length;
  const broken = filteredEquipment.length - functional;
  const categoryCounts = [{
    label: "Chemical Batches",
    value: totalChemBatches
  }, {
    label: "Glassware Units",
    value: totalGlassUnits
  }, {
    label: "Gas Cylinders",
    value: totalCylinders
  }, {
    label: "Equipment",
    value: totalEquip
  }];
  const lowStockRows = [...filteredChemicals.filter(c => sum(c.batches.filter(b => b.status === "active").map(b => b.remaining)) > 0 && sum(c.batches.filter(b => b.status === "active").map(b => b.remaining)) < sum(c.batches.map(b => b.initialAmount)) * 0.15).map(c => ({
    item: c.name,
    category: "Chemical",
    detail: `${fmtNum(sum(c.batches.filter(b => b.status === "active").map(b => b.remaining)))} ${c.unit} remaining`,
    tone: "warn"
  })), ...filteredGlassware.filter(g => g.broken > 0).map(g => ({
    item: g.name,
    category: "Glassware",
    detail: `${g.broken} broken of ${g.totalQuantity}`,
    tone: "warn"
  })), ...filteredGas.flatMap(g => g.cylinders.filter(c => c.status === "active" && c.capacity > 0 && c.remaining / c.capacity < 0.2).map(c => ({
    item: `${g.name} — ${c.name}`,
    category: "Gas",
    detail: `${(c.remaining / c.capacity * 100).toFixed(0)}% full`,
    tone: "warn"
  })))];
  const c1 = React.useRef(null),
    c2 = React.useRef(null);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 12
    }),
    label: "Chemical Batches",
    value: fmtNum(totalChemBatches)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 12
    }),
    label: "Glassware Units",
    value: fmtNum(totalGlassUnits)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 12
    }),
    label: "Gas Cylinders",
    value: fmtNum(totalCylinders)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wrench",
      size: 12
    }),
    label: "Equipment",
    value: fmtNum(totalEquip)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Chemical Turnover",
    value: `${turnover}x`
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Active Stock Composition (Treemap)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(Treemap, {
    items: treemapItems,
    height: 240
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Inventory Count by Category",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: categoryCounts,
    filename: "inventory_by_category"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c1,
    height: 240,
    data: {
      labels: categoryCounts.map(c => c.label),
      datasets: [{
        label: "Count",
        data: categoryCounts.map(c => c.value),
        backgroundColor: categoryCounts.map((_, i) => paletteColor(i)),
        borderRadius: 4
      }]
    },
    options: {
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Overall Status Distribution",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: [{
      Status: "Chem Active",
      Count: active
    }, {
      Status: "Chem Expired",
      Count: expired
    }, {
      Status: "Chem Depleted",
      Count: depleted
    }, {
      Status: "Equip Functional",
      Count: functional
    }, {
      Status: "Equip Broken",
      Count: broken
    }],
    filename: "status_distribution"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "doughnut",
    chartRef: c2,
    height: 240,
    data: {
      labels: ["Chem Active", "Chem Expired", "Chem Depleted", "Equip Functional", "Equip Broken"],
      datasets: [{
        data: [active, expired, depleted, functional, broken],
        backgroundColor: [C.ok, "#E63946", C.muted, C.teal, C.warn],
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  }))), /*#__PURE__*/React.createElement(SectionCard, {
    title: `Low Stock / Reorder Watchlist (${lowStockRows.length})`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 16,
      color: C.warn
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "low_stock_watchlist",
    columns: [{
      key: "category",
      label: "Category"
    }, {
      key: "item",
      label: "Item"
    }, {
      key: "detail",
      label: "Detail"
    }],
    rows: lowStockRows
  })));
}

// ==================================== GLASSWARE ANALYTICS ====================================
function GlasswareAnalyticsPage({
  filteredGlassware
}) {
  const totalUnits = sum(filteredGlassware.map(g => g.totalQuantity));
  const totalInUse = sum(filteredGlassware.map(g => g.inUse));
  const totalBroken = sum(filteredGlassware.map(g => g.broken));
  const totalInStore = totalUnits - totalInUse - totalBroken;
  const breakageRate = totalUnits ? totalBroken / totalUnits * 100 : 0;
  const stackedData = filteredGlassware.map(g => ({
    name: g.name,
    inStore: g.totalQuantity - g.inUse - g.broken,
    inUse: g.inUse,
    broken: g.broken
  }));
  const c1 = React.useRef(null),
    c2 = React.useRef(null);
  const rows = filteredGlassware.map(g => ({
    name: g.name,
    received: g.dateReceived,
    origin: g.origin || "—",
    supplier: g.receivedFrom || "—",
    total: g.totalQuantity,
    inStore: g.totalQuantity - g.inUse - g.broken,
    inUse: g.inUse,
    broken: g.broken
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 12
    }),
    label: "Glassware Types",
    value: fmtNum(filteredGlassware.length)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Total Units",
    value: fmtNum(totalUnits)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "In Use",
    value: totalUnits ? `${(totalInUse / totalUnits * 100).toFixed(0)}%` : "0%"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 12
    }),
    label: "Breakage Rate",
    value: `${breakageRate.toFixed(1)}%`,
    tone: breakageRate > 10 ? C.warn : C.ok
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Overall Composition",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: [{
      Status: "In Store",
      Count: totalInStore
    }, {
      Status: "In Use",
      Count: totalInUse
    }, {
      Status: "Broken",
      Count: totalBroken
    }],
    filename: "glassware_composition"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "doughnut",
    chartRef: c1,
    height: 250,
    data: {
      labels: ["In Store", "In Use", "Broken"],
      datasets: [{
        data: [totalInStore, totalInUse, totalBroken],
        backgroundColor: [C.ok, C.info, C.warn],
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Stock Breakdown by Item",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: stackedData.map(s => ({
      Name: s.name,
      InStore: s.inStore,
      InUse: s.inUse,
      Broken: s.broken
    })),
    filename: "glassware_by_item"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c2,
    height: 250,
    data: {
      labels: stackedData.map(s => s.name),
      datasets: [{
        label: "In Store",
        data: stackedData.map(s => s.inStore),
        backgroundColor: C.ok
      }, {
        label: "In Use",
        data: stackedData.map(s => s.inUse),
        backgroundColor: C.info
      }, {
        label: "Broken",
        data: stackedData.map(s => s.broken),
        backgroundColor: C.warn
      }]
    },
    options: {
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: C.muted
          }
        },
        y: {
          stacked: true,
          ticks: {
            color: C.muted
          }
        }
      }
    }
  }))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Glassware Status",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "glassware_status",
    columns: [{
      key: "name",
      label: "Name"
    }, {
      key: "received",
      label: "Received"
    }, {
      key: "origin",
      label: "Origin"
    }, {
      key: "supplier",
      label: "Supplier"
    }, {
      key: "total",
      label: "Total"
    }, {
      key: "inStore",
      label: "In Store"
    }, {
      key: "inUse",
      label: "In Use"
    }, {
      key: "broken",
      label: "Broken",
      render: r => r.broken > 0 ? /*#__PURE__*/React.createElement(Badge, {
        tone: "warn"
      }, r.broken) : "0"
    }],
    rows: rows
  })));
}

// ==================================== GAS ANALYTICS ====================================
function GasAnalyticsPage({
  filteredRecords,
  filteredGas
}) {
  const gasUsage = {};
  filteredRecords.forEach(r => [...(r.gasesUsed || []), ...(r.dilutionGasesUsed || [])].forEach(g => {
    gasUsage[g.gasName] = (gasUsage[g.gasName] || 0) + (Number(g.amount) || 0);
  }));
  const usageEntries = topEntries(gasUsage, 10);
  const totalCylinders = sum(filteredGas.map(g => g.cylinders.length));
  const activeCylinders = sum(filteredGas.map(g => g.cylinders.filter(c => c.status === "active").length));
  const avgFill = avg(filteredGas.flatMap(g => g.cylinders.filter(c => c.capacity > 0).map(c => c.remaining / c.capacity * 100)));
  const refillEvents = filteredGas.flatMap(g => g.cylinders.flatMap(c => (c.history || []).map(h => ({
    ...h,
    gas: g.name
  }))));
  const refillCostByMonth = {};
  refillEvents.forEach(h => {
    const mk = monthKey(h.date);
    refillCostByMonth[mk] = (refillCostByMonth[mk] || 0) + (h.type === "refill" ? Number(h.cost) || 0 : 0);
  });
  const monthKeys = Object.keys(refillCostByMonth).sort();
  const totalRefillCost = sum(Object.values(refillCostByMonth));
  const byType = {};
  filteredRecords.forEach(r => [...(r.gasesUsed || []).map(g => ({
    ...g
  })), ...(r.dilutionGasesUsed || []).map(g => ({
    ...g
  }))].forEach(g => {
    const key = r.testTypeName;
    if (!byType[key]) byType[key] = {};
    byType[key][g.gasName] = (byType[key][g.gasName] || 0) + (Number(g.amount) || 0);
  }));
  const testTypeLabels = Object.keys(byType).slice(0, 8);
  const gasNames = [...new Set(usageEntries.map(e => e[0]))];
  const stackedDatasets = gasNames.map((gn, i) => ({
    label: gn,
    backgroundColor: paletteColor(i),
    data: testTypeLabels.map(tt => byType[tt][gn] || 0)
  }));
  const c1 = React.useRef(null),
    c2 = React.useRef(null),
    c3 = React.useRef(null),
    c4 = React.useRef(null);
  const cylinderRows = filteredGas.flatMap(g => g.cylinders.map(c => ({
    gas: g.name,
    cylinder: c.name,
    received: c.dateReceived,
    capacity: c.capacity,
    remaining: c.remaining,
    unit: g.unit,
    fill: c.capacity ? `${(c.remaining / c.capacity * 100).toFixed(0)}%` : "—",
    status: c.status
  })));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 12
    }),
    label: "Gas Types",
    value: fmtNum(filteredGas.length)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Cylinders (active)",
    value: `${fmtNum(activeCylinders)} / ${fmtNum(totalCylinders)}`
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Avg Fill Level",
    value: `${avgFill.toFixed(0)}%`,
    tone: avgFill < 30 ? C.warn : C.ok
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 12
    }),
    label: "Refill Cost (range)",
    value: fmtMoney(totalRefillCost)
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Gas Consumption by Type",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: usageEntries.map(([k, v]) => ({
      Gas: k,
      Used: fmtNum(v)
    })),
    filename: "gas_consumption"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c1,
    height: 250,
    data: {
      labels: usageEntries.map(e => e[0]),
      datasets: [{
        label: "Used",
        data: usageEntries.map(e => +e[1].toFixed(2)),
        backgroundColor: C.teal,
        borderRadius: 4
      }]
    },
    options: {
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Cylinder Status",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: [{
      Status: "Active",
      Count: activeCylinders
    }, {
      Status: "Empty/Other",
      Count: totalCylinders - activeCylinders
    }],
    filename: "cylinder_status"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "doughnut",
    chartRef: c2,
    height: 250,
    data: {
      labels: ["Active", "Empty / Other"],
      datasets: [{
        data: [activeCylinders, totalCylinders - activeCylinders],
        backgroundColor: [C.ok, C.muted],
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Refill Cost Trend",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 16,
      color: C.teal
    }),
    chartRef: c3,
    exportRows: monthKeys.map(m => ({
      Month: m,
      Cost: +refillCostByMonth[m].toFixed(2)
    })),
    filename: "refill_cost_trend"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    chartRef: c3,
    height: 250,
    data: {
      labels: monthKeys,
      datasets: [{
        label: "Refill Cost",
        data: monthKeys.map(m => +refillCostByMonth[m].toFixed(2)),
        borderColor: C.warn,
        backgroundColor: hexToRgba(C.warn, 0.15),
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Gas Usage by Test Type",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 16,
      color: C.teal
    }),
    chartRef: c4,
    exportRows: testTypeLabels.map(tt => ({
      TestType: tt,
      ...byType[tt]
    })),
    filename: "gas_usage_by_test_type"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c4,
    height: 250,
    data: {
      labels: testTypeLabels,
      datasets: stackedDatasets
    },
    options: {
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: C.muted
          }
        },
        y: {
          stacked: true,
          ticks: {
            color: C.muted
          }
        }
      }
    }
  }))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Gas Cylinder Inventory",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "gas_cylinder_inventory",
    columns: [{
      key: "gas",
      label: "Gas"
    }, {
      key: "cylinder",
      label: "Cylinder"
    }, {
      key: "received",
      label: "Received"
    }, {
      key: "capacity",
      label: "Capacity"
    }, {
      key: "remaining",
      label: "Remaining"
    }, {
      key: "fill",
      label: "Fill %"
    }, {
      key: "status",
      label: "Status",
      render: r => /*#__PURE__*/React.createElement(Badge, {
        tone: r.status === "active" ? "ok" : "muted"
      }, r.status)
    }],
    rows: cylinderRows
  })));
}

// ==================================== PREDICTIVE INVENTORY ====================================
function PredictiveInventoryPage({
  filteredRecords,
  filteredChemicals,
  filteredGas,
  rangeDays
}) {
  const chemPredictions = filteredChemicals.map(c => {
    const totalRemaining = sum(c.batches.filter(b => b.status === "active").map(b => b.remaining));
    const consumed = sum(filteredRecords.map(r => Number(r.consumption?.[c.name]) || 0));
    const dailyRate = consumed / Math.max(1, rangeDays);
    const daysLeft = dailyRate > 0 ? totalRemaining / dailyRate : Infinity;
    return {
      name: c.name,
      category: "Chemical",
      remaining: totalRemaining,
      unit: c.unit,
      dailyRate: +dailyRate.toFixed(3),
      daysLeft,
      reorder: daysLeft < 14
    };
  });
  const gasPredictions = filteredGas.map(g => {
    const totalRemaining = sum(g.cylinders.filter(c => c.status === "active").map(c => c.remaining));
    const used = sum(filteredRecords.flatMap(r => [...(r.gasesUsed || []), ...(r.dilutionGasesUsed || [])].filter(x => x.gasName === g.name).map(x => Number(x.amount) || 0)));
    const dailyRate = used / Math.max(1, rangeDays);
    const daysLeft = dailyRate > 0 ? totalRemaining / dailyRate : Infinity;
    return {
      name: g.name,
      category: "Gas",
      remaining: totalRemaining,
      unit: g.unit,
      dailyRate: +dailyRate.toFixed(3),
      daysLeft,
      reorder: daysLeft < 14
    };
  });
  const all = [...chemPredictions, ...gasPredictions];
  const urgent = all.filter(p => isFinite(p.daysLeft)).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 10);
  const reorderCount = all.filter(p => p.reorder).length;
  const c1 = React.useRef(null);
  const rows = all.map(p => ({
    name: p.name,
    category: p.category,
    remaining: `${fmtNum(p.remaining)} ${p.unit}`,
    dailyRate: `${p.dailyRate} ${p.unit}/day`,
    daysLeft: isFinite(p.daysLeft) ? p.daysLeft.toFixed(0) : "No recent use",
    recommendation: p.reorder ? "Reorder now" : isFinite(p.daysLeft) ? "Monitor" : "Sufficient / idle"
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 12
    }),
    label: "Items Tracked",
    value: fmtNum(all.length)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 12
    }),
    label: "Reorder Now",
    value: fmtNum(reorderCount),
    tone: reorderCount > 0 ? C.warn : C.ok
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Forecast Window",
    value: `${rangeDays}d basis`
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Most Urgent",
    value: urgent[0] ? urgent[0].name : "—"
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Days of Stock Remaining (most urgent first)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: urgent.map(u => ({
      Item: u.name,
      DaysLeft: u.daysLeft.toFixed(1)
    })),
    filename: "predictive_inventory_urgent"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c1,
    height: 280,
    data: {
      labels: urgent.map(u => u.name),
      datasets: [{
        label: "Days Remaining",
        data: urgent.map(u => +u.daysLeft.toFixed(1)),
        backgroundColor: urgent.map(u => u.daysLeft < 7 ? "#E63946" : u.daysLeft < 14 ? C.warn : C.ok),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Predictive Inventory — Reorder Recommendations",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "predictive_inventory",
    defaultSortKey: "daysLeft",
    columns: [{
      key: "category",
      label: "Category"
    }, {
      key: "name",
      label: "Item"
    }, {
      key: "remaining",
      label: "Remaining"
    }, {
      key: "dailyRate",
      label: "Avg Daily Use"
    }, {
      key: "daysLeft",
      label: "Days Remaining"
    }, {
      key: "recommendation",
      label: "Recommendation",
      render: r => /*#__PURE__*/React.createElement(Badge, {
        tone: r.recommendation === "Reorder now" ? "warn" : r.recommendation === "Monitor" ? "info" : "ok"
      }, r.recommendation)
    }],
    rows: rows
  })));
}
// ==================================== EQUIPMENT ANALYTICS ====================================
function EquipmentAnalyticsPage({
  filteredRecords,
  filteredEquipment
}) {
  const totalTests = filteredRecords.length || 1;
  const usageByEquip = groupSum(filteredRecords, r => r.equipmentName, () => 1);
  const stats = filteredEquipment.map(eq => {
    const s = equipmentMaintenanceStats(eq);
    const usage = usageByEquip[eq.name] || 0;
    return {
      name: eq.name,
      functional: eq.functional,
      uptimePct: s.uptimePct,
      utilization: +(usage / totalTests * 100).toFixed(1),
      repairCost: s.repairCost,
      breakdownCount: s.breakdownCount,
      mtbf: s.mtbf,
      mttr: s.mttr,
      tests: usage
    };
  });
  const functionalCount = filteredEquipment.filter(e => e.functional).length;
  const avgUtil = avg(stats.map(s => s.utilization));
  const avgUptime = avg(stats.map(s => s.uptimePct));
  const totalRepairCost = sum(stats.map(s => s.repairCost));
  const c1 = React.useRef(null),
    c2 = React.useRef(null);
  const usageEntries = stats.sort((a, b) => b.tests - a.tests).map(s => [s.name, s.tests]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wrench",
      size: 12
    }),
    label: "Total Equipment",
    value: fmtNum(filteredEquipment.length)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 12
    }),
    label: "Functional",
    value: `${functionalCount} / ${filteredEquipment.length}`,
    tone: functionalCount === filteredEquipment.length ? C.ok : C.warn
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Avg Utilization",
    value: `${avgUtil.toFixed(1)}%`
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 12
    }),
    label: "Total Repair Cost",
    value: fmtMoney(totalRepairCost)
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Uptime by Equipment",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wrench",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-4 justify-around py-2"
  }, stats.map((s, i) => /*#__PURE__*/React.createElement(Gauge, {
    key: i,
    value: s.uptimePct,
    label: s.name,
    color: s.uptimePct > 90 ? C.ok : s.uptimePct > 70 ? C.warn : "#E63946"
  })), stats.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs py-4",
    style: {
      color: C.muted
    }
  }, "No equipment matches current filters."))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Usage Share (test volume)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: usageEntries.map(([k, v]) => ({
      Equipment: k,
      Tests: v
    })),
    filename: "equipment_usage"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c1,
    height: 250,
    data: {
      labels: usageEntries.map(e => e[0]),
      datasets: [{
        label: "Tests",
        data: usageEntries.map(e => e[1]),
        backgroundColor: C.teal,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Functional vs Broken",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wrench",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: [{
      Status: "Functional",
      Count: functionalCount
    }, {
      Status: "Broken",
      Count: filteredEquipment.length - functionalCount
    }],
    filename: "equipment_functional_status"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "doughnut",
    chartRef: c2,
    height: 250,
    data: {
      labels: ["Functional", "Broken"],
      datasets: [{
        data: [functionalCount, filteredEquipment.length - functionalCount],
        backgroundColor: [C.ok, C.warn],
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  }))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Equipment Status Table",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wrench",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "equipment_status",
    defaultSortKey: "utilization",
    columns: [{
      key: "name",
      label: "Equipment"
    }, {
      key: "functional",
      label: "Status",
      render: r => r.functional ? /*#__PURE__*/React.createElement(Badge, {
        tone: "ok"
      }, "Functional") : /*#__PURE__*/React.createElement(Badge, {
        tone: "warn"
      }, "Broken")
    }, {
      key: "utilization",
      label: "Utilization %"
    }, {
      key: "uptimePct",
      label: "Uptime %"
    }, {
      key: "breakdownCount",
      label: "Breakdowns"
    }, {
      key: "mtbf",
      label: "MTBF (d)"
    }, {
      key: "mttr",
      label: "MTTR (d)"
    }, {
      key: "repairCost",
      label: "Repair Cost",
      render: r => fmtMoney(r.repairCost)
    }],
    rows: stats
  })));
}

// ==================================== MAINTENANCE ANALYTICS ====================================
function MaintenanceAnalyticsPage({
  filteredEquipment,
  filters
}) {
  const inRange = d => (!filters.dateFrom || d >= filters.dateFrom) && (!filters.dateTo || d <= filters.dateTo);
  const allEvents = filteredEquipment.flatMap(eq => (eq.history || []).filter(h => inRange(h.date)).map(h => ({
    ...h,
    equipment: eq.name
  })));
  const breakdowns = allEvents.filter(h => h.type === "breakdown");
  const repairs = allEvents.filter(h => h.type === "repair" || h.type === "other");
  const totalRepairCost = sum(repairs.map(h => h.cost || 0));
  const statsByEquip = filteredEquipment.map(eq => ({
    name: eq.name,
    ...equipmentMaintenanceStats(eq)
  }));
  const avgMTBF = avg(statsByEquip.filter(s => s.breakdownCount > 0).map(s => s.mtbf));
  const avgMTTR = avg(statsByEquip.filter(s => s.mttr > 0).map(s => s.mttr));
  const totalDowntime = sum(statsByEquip.map(s => s.downtime));
  const costByEquip = groupSum(repairs, h => h.equipment, h => h.cost || 0);
  const costEntries = topEntries(costByEquip, 10);
  const breakdownByEquip = groupSum(breakdowns, h => h.equipment, () => 1);
  const breakdownEntries = topEntries(breakdownByEquip, 10);
  const costByMonth = groupSum(repairs, h => monthKey(h.date), h => h.cost || 0);
  const monthKeys = Object.keys(costByMonth).sort();
  const c1 = React.useRef(null),
    c2 = React.useRef(null),
    c3 = React.useRef(null);
  const logRows = [...allEvents].sort((a, b) => a.date < b.date ? 1 : -1).map(h => ({
    date: h.date,
    equipment: h.equipment,
    type: h.type,
    description: h.description || "—",
    cost: h.cost || 0,
    functionalAfter: h.functionalAfter ? "Yes" : "No"
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 12
    }),
    label: "Breakdowns",
    value: fmtNum(breakdowns.length)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Avg MTBF",
    value: `${avgMTBF ? avgMTBF.toFixed(1) : 0}d`
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wrench",
      size: 12
    }),
    label: "Avg MTTR",
    value: `${avgMTTR ? avgMTTR.toFixed(1) : 0}d`
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Total Downtime",
    value: `${fmtNum(totalDowntime)}d`
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 12
    }),
    label: "Total Repair Cost",
    value: fmtMoney(totalRepairCost)
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Repair Cost by Equipment",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: costEntries.map(([k, v]) => ({
      Equipment: k,
      Cost: v
    })),
    filename: "repair_cost_by_equipment"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c1,
    height: 250,
    data: {
      labels: costEntries.map(e => e[0]),
      datasets: [{
        label: "Repair Cost (৳)",
        data: costEntries.map(e => e[1]),
        backgroundColor: C.warn,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Breakdown Frequency",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: breakdownEntries.map(([k, v]) => ({
      Equipment: k,
      Breakdowns: v
    })),
    filename: "breakdown_frequency"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c2,
    height: 250,
    data: {
      labels: breakdownEntries.map(e => e[0]),
      datasets: [{
        label: "Breakdowns",
        data: breakdownEntries.map(e => e[1]),
        backgroundColor: "#E63946",
        borderRadius: 4
      }]
    },
    options: {
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  }))), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Repair Cost Trend (monthly)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c3,
    exportRows: monthKeys.map(m => ({
      Month: m,
      Cost: costByMonth[m]
    })),
    filename: "repair_cost_trend"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    chartRef: c3,
    height: 250,
    data: {
      labels: monthKeys,
      datasets: [{
        label: "Repair Cost",
        data: monthKeys.map(m => costByMonth[m]),
        borderColor: C.warn,
        backgroundColor: hexToRgba(C.warn, 0.15),
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Maintenance Log",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wrench",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "maintenance_log",
    defaultSortKey: "date",
    columns: [{
      key: "date",
      label: "Date"
    }, {
      key: "equipment",
      label: "Equipment"
    }, {
      key: "type",
      label: "Event",
      render: r => /*#__PURE__*/React.createElement("span", {
        className: "capitalize"
      }, r.type)
    }, {
      key: "description",
      label: "Description"
    }, {
      key: "cost",
      label: "Cost",
      render: r => r.cost ? fmtMoney(r.cost) : "—"
    }, {
      key: "functionalAfter",
      label: "Functional After"
    }],
    rows: logRows
  })));
}
// ==================================== MONTHLY TRENDS ====================================
function MonthlyTrendsPage({
  filteredRecords
}) {
  const revByMonth = groupSum(filteredRecords, r => monthKey(r.date), r => r.revenue || 0);
  const testsByMonth = groupSum(filteredRecords, r => monthKey(r.date), () => 1);
  const monthKeys = [...new Set([...Object.keys(revByMonth), ...Object.keys(testsByMonth)])].sort();
  const revSeries = monthKeys.map(m => +(revByMonth[m] || 0).toFixed(2));
  const testSeries = monthKeys.map(m => testsByMonth[m] || 0);
  const growthRows = monthKeys.map((m, i) => ({
    month: m,
    tests: testSeries[i],
    revenue: revSeries[i],
    testGrowth: i > 0 ? fmtPct(pctGrowth(testSeries[i], testSeries[i - 1])) : "—",
    revGrowth: i > 0 ? fmtPct(pctGrowth(revSeries[i], revSeries[i - 1])) : "—"
  }));
  const c1 = React.useRef(null);
  const lastGrowth = monthKeys.length >= 2 ? pctGrowth(revSeries[revSeries.length - 1], revSeries[revSeries.length - 2]) : 0;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Months in Range",
    value: fmtNum(monthKeys.length)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Avg Tests / Month",
    value: monthKeys.length ? (sum(testSeries) / monthKeys.length).toFixed(1) : "0"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 12
    }),
    label: "Avg Revenue / Month",
    value: fmtMoney(monthKeys.length ? sum(revSeries) / monthKeys.length : 0)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Latest MoM Growth",
    value: fmtPct(lastGrowth),
    delta: lastGrowth
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Monthly Tests & Revenue",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: growthRows,
    filename: "monthly_trends"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    chartRef: c1,
    height: 280,
    data: {
      labels: monthKeys,
      datasets: [{
        label: "Tests",
        data: testSeries,
        borderColor: C.seafoam,
        backgroundColor: "transparent",
        tension: 0.3,
        yAxisID: "y1"
      }, {
        label: "Revenue (৳)",
        data: revSeries,
        borderColor: C.teal,
        backgroundColor: hexToRgba(C.teal, 0.12),
        fill: true,
        tension: 0.3,
        yAxisID: "y"
      }]
    },
    options: {
      scales: {
        y: {
          position: "left",
          ticks: {
            color: C.muted
          }
        },
        y1: {
          position: "right",
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: C.muted
          }
        },
        x: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Month-over-Month Detail",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "monthly_growth",
    defaultSortKey: "month",
    columns: [{
      key: "month",
      label: "Month"
    }, {
      key: "tests",
      label: "Tests"
    }, {
      key: "testGrowth",
      label: "Test MoM"
    }, {
      key: "revenue",
      label: "Revenue",
      render: r => fmtMoney(r.revenue)
    }, {
      key: "revGrowth",
      label: "Revenue MoM"
    }],
    rows: growthRows
  })));
}

// ==================================== DAILY TRENDS ====================================
function DailyTrendsPage({
  filteredRecords
}) {
  const byDate = {};
  const revByDate = {};
  filteredRecords.forEach(r => {
    byDate[r.date] = (byDate[r.date] || 0) + 1;
    revByDate[r.date] = (revByDate[r.date] || 0) + (r.revenue || 0);
  });
  const dates = Object.keys(byDate).sort().slice(-45);
  const testSeries = dates.map(d => byDate[d]);
  const revSeries = dates.map(d => +(revByDate[d] || 0).toFixed(2));
  const byDow = {};
  const dowDateSet = {};
  filteredRecords.forEach(r => {
    const dow = dowIndex(r.date);
    byDow[dow] = (byDow[dow] || 0) + 1;
    (dowDateSet[dow] = dowDateSet[dow] || new Set()).add(r.date);
  });
  const dowAvg = DOW_NAMES.map((_, i) => {
    const set = dowDateSet[i];
    return set && set.size ? +((byDow[i] || 0) / set.size).toFixed(2) : 0;
  });
  const c1 = React.useRef(null),
    c2 = React.useRef(null);
  const totalDays = Object.keys(byDate).length || 1;
  const avgPerDay = sum(Object.values(byDate)) / totalDays;
  const busiestDate = topEntries(byDate, 1)[0];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Active Days",
    value: fmtNum(totalDays)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Avg Tests / Active Day",
    value: avgPerDay.toFixed(1)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 12
    }),
    label: "Busiest Day",
    value: busiestDate ? busiestDate[0] : "—"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 12
    }),
    label: "Avg Revenue / Day",
    value: fmtMoney(totalDays ? sum(Object.values(revByDate)) / totalDays : 0)
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Daily Test Volume & Revenue (last 45 active days)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: dates.map((d, i) => ({
      Date: d,
      Tests: testSeries[i],
      Revenue: revSeries[i]
    })),
    filename: "daily_trends"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    chartRef: c1,
    height: 270,
    data: {
      labels: dates,
      datasets: [{
        label: "Tests",
        data: testSeries,
        borderColor: C.seafoam,
        backgroundColor: hexToRgba(C.seafoam, 0.12),
        fill: true,
        tension: 0.25,
        yAxisID: "y1"
      }, {
        label: "Revenue (৳)",
        data: revSeries,
        borderColor: C.teal,
        backgroundColor: "transparent",
        tension: 0.25,
        yAxisID: "y"
      }]
    },
    options: {
      scales: {
        y: {
          position: "left",
          ticks: {
            color: C.muted
          }
        },
        y1: {
          position: "right",
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: C.muted
          }
        },
        x: {
          ticks: {
            color: C.muted,
            maxRotation: 60,
            minRotation: 60
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Avg Tests by Day of Week",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: DOW_NAMES.map((d, i) => ({
      Day: d,
      AvgTests: dowAvg[i]
    })),
    filename: "tests_by_weekday"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c2,
    height: 250,
    data: {
      labels: DOW_NAMES,
      datasets: [{
        label: "Avg Tests",
        data: dowAvg,
        backgroundColor: DOW_NAMES.map((_, i) => paletteColor(i)),
        borderRadius: 4
      }]
    },
    options: {
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Daily Activity Heatmap",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(CalendarHeatmap, {
    valueByDate: byDate
  }))));
}

// ==================================== FORECAST REPORTS ====================================
function ForecastPage({
  filteredRecords
}) {
  const revByMonth = groupSum(filteredRecords, r => monthKey(r.date), r => r.revenue || 0);
  const testsByMonth = groupSum(filteredRecords, r => monthKey(r.date), () => 1);
  const monthKeys = [...new Set([...Object.keys(revByMonth), ...Object.keys(testsByMonth)])].sort();
  const revSeries = monthKeys.map(m => +(revByMonth[m] || 0).toFixed(2));
  const testSeries = monthKeys.map(m => testsByMonth[m] || 0);
  const FORECAST_PERIODS = 3;
  const revForecast = forecastNext(revSeries, FORECAST_PERIODS);
  const testForecast = forecastNext(testSeries, FORECAST_PERIODS);
  const lastMonth = monthKeys[monthKeys.length - 1] || monthKey(todayStr());
  const forecastMonths = Array.from({
    length: FORECAST_PERIODS
  }, (_, i) => shiftMonthKey(lastMonth, i + 1));
  const allMonths = [...monthKeys, ...forecastMonths];
  const revHistData = [...revSeries, ...Array(FORECAST_PERIODS).fill(null)];
  const revFcData = [...Array(Math.max(0, monthKeys.length - 1)).fill(null), revSeries[revSeries.length - 1] ?? 0, ...revForecast];
  const testHistData = [...testSeries, ...Array(FORECAST_PERIODS).fill(null)];
  const testFcData = [...Array(Math.max(0, monthKeys.length - 1)).fill(null), testSeries[testSeries.length - 1] ?? 0, ...testForecast];
  const c1 = React.useRef(null),
    c2 = React.useRef(null);
  const forecastRows = forecastMonths.map((m, i) => ({
    month: m,
    forecastRevenue: revForecast[i],
    forecastTests: testForecast[i]
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-3 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 12
    }),
    label: `Forecast Revenue (${forecastMonths[0] || "next"})`,
    value: fmtMoney(revForecast[0] || 0)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: `Forecast Tests (${forecastMonths[0] || "next"})`,
    value: fmtNum(testForecast[0] || 0)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "3-Month Forecast Revenue",
    value: fmtMoney(sum(revForecast))
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-4 p-2.5 rounded no-print",
    style: {
      background: C.infoBg,
      color: C.info
    }
  }, "Forecasts use simple linear-regression trend extrapolation over the monthly history in the current filter range. Treat as directional guidance, not a guarantee."), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Revenue Forecast",
    subtitle: "Historical (solid) vs projected (dashed)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: forecastRows.map(r => ({
      Month: r.month,
      ForecastRevenue: r.forecastRevenue
    })),
    filename: "revenue_forecast"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    chartRef: c1,
    height: 260,
    data: {
      labels: allMonths,
      datasets: [{
        label: "Historical",
        data: revHistData,
        borderColor: C.teal,
        backgroundColor: hexToRgba(C.teal, 0.1),
        fill: true,
        tension: 0.3,
        spanGaps: false
      }, {
        label: "Forecast",
        data: revFcData,
        borderColor: paletteColor(4),
        borderDash: [6, 4],
        backgroundColor: "transparent",
        tension: 0.3,
        spanGaps: true
      }]
    },
    options: {
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Test Volume Forecast",
    subtitle: "Historical (solid) vs projected (dashed)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: forecastRows.map(r => ({
      Month: r.month,
      ForecastTests: r.forecastTests
    })),
    filename: "test_volume_forecast"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    chartRef: c2,
    height: 260,
    data: {
      labels: allMonths,
      datasets: [{
        label: "Historical",
        data: testHistData,
        borderColor: C.seafoam,
        backgroundColor: hexToRgba(C.seafoam, 0.1),
        fill: true,
        tension: 0.3,
        spanGaps: false
      }, {
        label: "Forecast",
        data: testFcData,
        borderColor: paletteColor(6),
        borderDash: [6, 4],
        backgroundColor: "transparent",
        tension: 0.3,
        spanGaps: true
      }]
    },
    options: {
      scales: {
        x: {
          ticks: {
            color: C.muted
          }
        },
        y: {
          ticks: {
            color: C.muted
          }
        }
      }
    }
  }))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Forecast Table (next 3 months)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "forecast_table",
    columns: [{
      key: "month",
      label: "Month"
    }, {
      key: "forecastRevenue",
      label: "Forecast Revenue",
      render: r => fmtMoney(r.forecastRevenue)
    }, {
      key: "forecastTests",
      label: "Forecast Tests"
    }],
    rows: forecastRows
  })));
}
// ---------------- Report page registry ----------------
const REPORT_GROUPS = [{
  group: "Overview",
  pages: [{
    k: "executive",
    label: "Executive Dashboard",
    icon: "home"
  }, {
    k: "insights",
    label: "Smart Insights",
    icon: "warning"
  }]
}, {
  group: "Operations",
  pages: [{
    k: "testAnalytics",
    label: "Test Analytics",
    icon: "clipboard"
  }, {
    k: "technician",
    label: "Technician Performance",
    icon: "user"
  }, {
    k: "revenue",
    label: "Revenue Analytics",
    icon: "coins"
  }]
}, {
  group: "Inventory",
  pages: [{
    k: "chemicalAnalytics",
    label: "Chemical Analytics",
    icon: "flask"
  }, {
    k: "inventoryAnalytics",
    label: "Inventory Analytics",
    icon: "beaker"
  }, {
    k: "glasswareAnalytics",
    label: "Glassware Analytics",
    icon: "beaker"
  }, {
    k: "gasAnalytics",
    label: "Gas Analytics",
    icon: "flask"
  }, {
    k: "predictiveInventory",
    label: "Predictive Inventory",
    icon: "chart"
  }]
}, {
  group: "Equipment",
  pages: [{
    k: "equipmentAnalytics",
    label: "Equipment Analytics",
    icon: "wrench"
  }, {
    k: "maintenanceAnalytics",
    label: "Maintenance Analytics",
    icon: "wrench"
  }]
}, {
  group: "Trends & Forecast",
  pages: [{
    k: "monthlyTrends",
    label: "Monthly Trends",
    icon: "chart"
  }, {
    k: "dailyTrends",
    label: "Daily Trends",
    icon: "chart"
  }, {
    k: "forecast",
    label: "Forecast Reports",
    icon: "chart"
  }]
}, {
  group: "Official Report",
  pages: [{
    k: "customReport",
    label: "Custom Report Generator",
    icon: "printer"
  }]
}];
const ALL_REPORT_PAGES = REPORT_GROUPS.flatMap(g => g.pages);

// ---------------- Report navigation: one dropdown per group (Overview / Operations / Inventory / Equipment / Trends & Forecast) ----------------
function ReportGroupNav({
  activePage,
  setReportTab
}) {
  const [openGroup, setOpenGroup] = React.useState(null);
  const navRef = React.useRef(null);
  React.useEffect(() => {
    function onDocClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenGroup(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    ref: navRef,
    className: "rounded-lg mb-4 no-print px-3 py-2.5 flex items-center gap-2 flex-wrap",
    style: {
      background: C.card,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-bold uppercase tracking-wide mr-1 shrink-0",
    style: {
      color: C.muted
    }
  }, "Browse:"), REPORT_GROUPS.map(grp => {
    const activePageDef = grp.pages.find(p => p.k === activePage);
    const isOpen = openGroup === grp.group;
    return /*#__PURE__*/React.createElement("div", {
      key: grp.group,
      className: "relative"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setOpenGroup(isOpen ? null : grp.group),
      className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap",
      style: {
        background: activePageDef ? C.teal : "#fff",
        color: activePageDef ? "#fff" : C.ink,
        border: `1px solid ${activePageDef ? C.teal : C.border}`
      }
    }, grp.group, activePageDef && /*#__PURE__*/React.createElement("span", {
      className: "hidden md:inline font-normal opacity-90"
    }, "· ", activePageDef.label), /*#__PURE__*/React.createElement(Icon, {
      name: isOpen ? "chevronDown" : "chevronRight",
      size: 10,
      color: activePageDef ? "#fff" : C.muted
    })), isOpen && /*#__PURE__*/React.createElement("div", {
      className: "absolute z-40 mt-1 rounded-lg shadow-lg py-1.5",
      style: {
        background: "#fff",
        border: `1px solid ${C.border}`,
        minWidth: 230
      }
    }, grp.pages.map(p => /*#__PURE__*/React.createElement("button", {
      key: p.k,
      type: "button",
      onClick: () => {
        setReportTab(p.k);
        setOpenGroup(null);
      },
      className: "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50",
      style: {
        color: p.k === activePage ? C.teal : C.ink,
        fontWeight: p.k === activePage ? 700 : 500,
        background: p.k === activePage ? C.infoBg : "transparent"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: p.icon,
      size: 13,
      color: p.k === activePage ? C.teal : C.muted
    }), p.label))));
  }));
}
function rangeDaysCount(filters, testRecords) {
  if (filters.dateFrom && filters.dateTo) return Math.max(1, daysBetweenD(filters.dateFrom, filters.dateTo) + 1);
  if (testRecords.length) {
    const dates = testRecords.map(r => r.date).sort();
    return Math.max(1, daysBetweenD(dates[0], dates[dates.length - 1]) + 1);
  }
  return 30;
}
function ReportsTab({
  reportTab,
  setReportTab,
  chemicals,
  glassware,
  equipment,
  gasList,
  testTypes,
  testRecords,
  samples,
  users,
  notify,
  onLoadDemoData
}) {
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);
  const activePage = ALL_REPORT_PAGES.some(p => p.k === reportTab) ? reportTab : "executive";
  const batchNameById = React.useMemo(() => {
    const m = {};
    chemicals.forEach(c => c.batches.forEach(b => {
      m[b.id] = b.batchName;
    }));
    return m;
  }, [chemicals]);
  const facets = React.useMemo(() => ({
    technicians: [...new Set(testRecords.map(r => r.tester).filter(Boolean))].sort(),
    equipments: [...new Set(testRecords.map(r => r.equipmentName).filter(Boolean))].sort(),
    testTypes: [...new Set(testRecords.map(r => r.testTypeName).filter(Boolean))].sort(),
    chemicals: [...new Set(chemicals.map(c => c.name))].sort(),
    gases: [...new Set(gasList.map(g => g.name))].sort(),
    batches: [...new Set(chemicals.flatMap(c => c.batches.map(b => b.batchName)).filter(Boolean))].sort(),
    statuses: ["active", "expired", "depleted", "functional", "broken"],
    suppliers: [...new Set([...chemicals.flatMap(c => c.batches.map(b => b.receivedFrom)), ...equipment.map(e => e.receivedFrom), ...gasList.flatMap(g => g.cylinders.map(c => c.receivedFrom)), ...glassware.map(g => g.receivedFrom)].filter(Boolean))].sort()
  }), [testRecords, chemicals, gasList, equipment, glassware]);
  const inDateRange = React.useCallback(d => (!filters.dateFrom || d >= filters.dateFrom) && (!filters.dateTo || d <= filters.dateTo), [filters.dateFrom, filters.dateTo]);
  const supplierMatchesRecord = React.useCallback(r => {
    if (!filters.suppliers.length) return true;
    const eq = equipment.find(e => e.name === r.equipmentName);
    if (eq && filters.suppliers.includes(eq.receivedFrom)) return true;
    const usedBatchIds = Object.values(r.bottleLog || {}).flat().map(u => u.batchId);
    for (const c of chemicals) for (const b of c.batches) if (usedBatchIds.includes(b.id) && filters.suppliers.includes(b.receivedFrom)) return true;
    return false;
  }, [filters.suppliers, equipment, chemicals]);
  const filteredRecords = React.useMemo(() => testRecords.filter(r => {
    if (!inDateRange(r.date)) return false;
    if (filters.technicians.length && !filters.technicians.includes(r.tester)) return false;
    if (filters.equipments.length && !filters.equipments.includes(r.equipmentName)) return false;
    if (filters.testTypesSel.length && !filters.testTypesSel.includes(r.testTypeName)) return false;
    if (filters.chemicalsSel.length && !filters.chemicalsSel.some(ch => Object.keys(r.consumption || {}).includes(ch))) return false;
    if (filters.gasesSel.length) {
      const gasNames = [...(r.gasesUsed || []), ...(r.dilutionGasesUsed || [])].map(g => g.gasName);
      if (!filters.gasesSel.some(g => gasNames.includes(g))) return false;
    }
    if (filters.batches.length) {
      const usedBatchIds = Object.values(r.bottleLog || {}).flat().map(u => u.batchId);
      const usedBatchNames = usedBatchIds.map(id => batchNameById[id]).filter(Boolean);
      if (!filters.batches.some(b => usedBatchNames.includes(b))) return false;
    }
    if (filters.sampleSource && !(r.sampleSource || "").toLowerCase().includes(filters.sampleSource.toLowerCase())) return false;
    if (filters.dilution === "yes" && !r.dilutionRequired) return false;
    if (filters.dilution === "no" && r.dilutionRequired) return false;
    if (!supplierMatchesRecord(r)) return false;
    return true;
  }), [testRecords, filters, batchNameById, inDateRange, supplierMatchesRecord]);
  const filteredChemicals = React.useMemo(() => chemicals.filter(c => !filters.chemicalsSel.length || filters.chemicalsSel.includes(c.name)).map(c => ({
    ...c,
    batches: c.batches.filter(b => (!filters.batches.length || filters.batches.includes(b.batchName)) && (!filters.suppliers.length || filters.suppliers.includes(b.receivedFrom)) && (!filters.statuses.length || filters.statuses.includes(b.status)))
  })), [chemicals, filters.chemicalsSel, filters.batches, filters.suppliers, filters.statuses]);
  const filteredEquipment = React.useMemo(() => equipment.filter(e => (!filters.equipments.length || filters.equipments.includes(e.name)) && (!filters.suppliers.length || filters.suppliers.includes(e.receivedFrom)) && (!filters.statuses.length || filters.statuses.includes(e.functional ? "functional" : "broken"))), [equipment, filters.equipments, filters.suppliers, filters.statuses]);
  const filteredGas = React.useMemo(() => gasList.filter(g => !filters.gasesSel.length || filters.gasesSel.includes(g.name)).map(g => ({
    ...g,
    cylinders: g.cylinders.filter(c => (!filters.suppliers.length || filters.suppliers.includes(c.receivedFrom)) && (!filters.statuses.length || filters.statuses.includes(c.status)))
  })), [gasList, filters.gasesSel, filters.suppliers, filters.statuses]);
  const filteredGlassware = React.useMemo(() => glassware.filter(g => !filters.suppliers.length || filters.suppliers.includes(g.receivedFrom)), [glassware, filters.suppliers]);
  const rangeDays = rangeDaysCount(filters, filteredRecords.length ? filteredRecords : testRecords);
  const shared = {
    filters,
    setFilters,
    testRecords,
    filteredRecords,
    chemicals,
    filteredChemicals,
    equipment,
    filteredEquipment,
    gasList,
    filteredGas,
    glassware,
    filteredGlassware,
    testTypes,
    rangeDays,
    batchNameById,
    samples,
    users,
    notify
  };
  function printReport() {
    window.print();
  }
  const activePageDef = ALL_REPORT_PAGES.find(p => p.k === activePage);
  const activeGroupDef = REPORT_GROUPS.find(grp => grp.pages.some(p => p.k === activePage));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between mb-4 no-print flex-wrap gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "text-base font-bold",
    style: {
      color: C.ink
    }
  }, "Reports & Analytics"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mt-0.5",
    style: {
      color: C.muted
    }
  }, "Enterprise business intelligence for laboratory operations."), activeGroupDef && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] mt-1.5 flex items-center gap-1.5",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: activePageDef.icon,
    size: 12,
    color: C.teal
  }), /*#__PURE__*/React.createElement("span", null, activeGroupDef.group), /*#__PURE__*/React.createElement("span", null, "/"), /*#__PURE__*/React.createElement("span", {
    className: "font-semibold",
    style: {
      color: C.ink
    }
  }, activePageDef.label))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, onLoadDemoData && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: onLoadDemoData,
    title: "Populate 15 demo test records (Arsenic, Iron, Manganese, Chloride) with matching inventory"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "beaker",
    size: 13
  }), "Load Demo Data"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: printReport
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "printer",
    size: 13
  }), "Print / Save as PDF"))), /*#__PURE__*/React.createElement(FilterPanel, {
    filters: filters,
    setFilters: setFilters,
    facets: facets
  }), /*#__PURE__*/React.createElement(ReportGroupNav, {
    activePage: activePage,
    setReportTab: setReportTab
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-4"
  }, activePage === "executive" && /*#__PURE__*/React.createElement(ExecutiveDashboardPage, shared), activePage === "insights" && /*#__PURE__*/React.createElement(SmartInsightsPage, shared), activePage === "testAnalytics" && /*#__PURE__*/React.createElement(TestAnalyticsPage, shared), activePage === "technician" && /*#__PURE__*/React.createElement(TechnicianPerformancePage, shared), activePage === "revenue" && /*#__PURE__*/React.createElement(RevenueAnalyticsPage, shared), activePage === "chemicalAnalytics" && /*#__PURE__*/React.createElement(ChemicalAnalyticsPage, shared), activePage === "inventoryAnalytics" && /*#__PURE__*/React.createElement(InventoryAnalyticsPage, shared), activePage === "glasswareAnalytics" && /*#__PURE__*/React.createElement(GlasswareAnalyticsPage, shared), activePage === "gasAnalytics" && /*#__PURE__*/React.createElement(GasAnalyticsPage, shared), activePage === "predictiveInventory" && /*#__PURE__*/React.createElement(PredictiveInventoryPage, shared), activePage === "equipmentAnalytics" && /*#__PURE__*/React.createElement(EquipmentAnalyticsPage, shared), activePage === "maintenanceAnalytics" && /*#__PURE__*/React.createElement(MaintenanceAnalyticsPage, shared), activePage === "monthlyTrends" && /*#__PURE__*/React.createElement(MonthlyTrendsPage, shared), activePage === "dailyTrends" && /*#__PURE__*/React.createElement(DailyTrendsPage, shared), activePage === "forecast" && /*#__PURE__*/React.createElement(ForecastPage, shared), activePage === "customReport" && /*#__PURE__*/React.createElement(CustomReportGeneratorPage, shared)));
}
