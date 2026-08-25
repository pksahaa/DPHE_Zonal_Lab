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
        backgroundColor: [C.ok, C.danger, C.muted, C.teal, C.warn],
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
        backgroundColor: urgent.map(u => u.daysLeft < 7 ? C.danger : u.daysLeft < 14 ? C.warn : C.ok),
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
    color: s.uptimePct > 90 ? C.ok : s.uptimePct > 70 ? C.warn : C.danger
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
        backgroundColor: C.danger,
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

// ==================================== CHEMICAL USAGE REPORT ====================================
// Per-chemical inventory consumption report. For every chemical in inventory it
// shows: batch details (no., expiry, status), amounts received/used/remaining,
// and a table of every analytical sub-batch that consumed this chemical in the
// chosen date range — including the field-sample and standard-sample counts.
//
// Design rules to avoid calculation duplication:
//   - "Used in period"  → summed from testRecord.bottleLog[chemName] entries
//                         (already deducted when the test record was saved —
//                          never re-run deductFromChemical()).
//   - "Current Remaining" → read directly from batch.remaining (live balance).
//   - "Opening Balance"   → batch.remaining + usedInPeriod + usedAfterPeriod.
//     Since we can compute usedAfterPeriod (records after period end date) from
//     bottleLog, we can reconstruct the opening balance without storing it.
function ChemicalUsageReportPage({ chemicals, testRecords, session }) {
  // ---- Date range state ----
  var today = todayStr();
  var firstOfMonth = today.slice(0, 7) + "-01";
  var [startDate, setStartDate] = React.useState(firstOfMonth);
  var [endDate,   setEndDate]   = React.useState(today);
  var [designation, setDesignation] = React.useState("Senior Chemist");
  var [signLine2, setSignLine2] = React.useState("");
  // ---- Chemical filter ----
  var [selectedChemId, setSelectedChemId] = React.useState("ALL");
  var [reportData, setReportData] = React.useState(null);

  function generateReportData() {
    var stats = {}; // chemName → { batches: { batchId → {usedInPeriod, usedAfterPeriod} }, subBatchRows: [] }

    (testRecords || []).forEach(function(tr) {
      var d = tr.date || "";
      var inPeriod  = d >= startDate && d <= endDate;
      var afterPeriod = d > endDate;
      if (!inPeriod && !afterPeriod) return;
      var log = tr.bottleLog || {};
      Object.keys(log).forEach(function(chemName) {
        var entries = Array.isArray(log[chemName]) ? log[chemName] : [];
        if (!entries.length) return;
        if (!stats[chemName]) stats[chemName] = { batches: {}, subBatchRows: [] };
        var totalUsedThisRecord = 0;
        entries.forEach(function(e) {
          var bid = e.batchId || "__unknown__";
          var amt = Number(e.amount) || 0;
          if (!stats[chemName].batches[bid]) {
            stats[chemName].batches[bid] = { usedInPeriod: 0, usedAfterPeriod: 0 };
          }
          if (inPeriod) {
            stats[chemName].batches[bid].usedInPeriod += amt;
            totalUsedThisRecord += amt;
          } else {
            stats[chemName].batches[bid].usedAfterPeriod += amt;
          }
        });
        if (inPeriod && totalUsedThisRecord > 0) {
          var fSamp = tr.numberOfFieldSamples || 0;
          var sSamp = tr.numberOfStandardSamples || 0;
          var dSamp = tr.dilutionRequired ? (Number(tr.numberOfDilutedSamples) || 0) : 0;
          stats[chemName].subBatchRows.push({
            date:           d,
            label:          tr.subBatchLabel || "(individual)",
            testTypeName:   tr.testTypeName  || "",
            fieldSamples:   fSamp,
            stdSamples:     sSamp,
            dilutedSamples: dSamp,
            totalSamples:   fSamp + sSamp + dSamp,
            totalUsed:      totalUsedThisRecord
          });
        }
      });
    });
    setReportData(stats);
  }

  // Clear report data if dates or chemical filter changes
  React.useEffect(function() {
    setReportData(null);
  }, [startDate, endDate, selectedChemId]);

  // ---- Which chemicals to show ----
  var allChemicals = (chemicals || []).slice().sort(function(a, b) {
    return (a.name || "").localeCompare(b.name || "");
  });
  var displayChemicals = selectedChemId === "ALL"
    ? allChemicals
    : allChemicals.filter(function(c) { return c.id === selectedChemId; });

  // ---- Helper: 4dp number formatter ----
  function fmtAmt(v, unit) {
    var n = Number(v);
    if (!n) return "—";
    var s = n % 1 === 0 ? String(n) : n.toFixed(2);
    return unit ? s + " " + unit : s;
  }

  // ---- Shared table header/cell styles ----
  var th = function(extra) {
    return Object.assign({
      padding: "5px 8px", fontSize: 11, fontWeight: 700,
      background: "#f0fdf4", borderBottom: "2px solid " + C.border,
      borderRight: "1px solid " + C.border, whiteSpace: "nowrap", textAlign: "center"
    }, extra || {});
  };
  var td = function(extra) {
    return Object.assign({
      padding: "4px 8px", fontSize: 12,
      borderBottom: "1px solid " + C.border,
      borderRight: "1px solid " + C.border, textAlign: "center"
    }, extra || {});
  };
  var tdL = function(extra) { return td(Object.assign({ textAlign: "left" }, extra)); };

  // ---- Build XLSX export data (flat — one row per batch) ----
  var exportRows = [];

  async function generateAndPrint() {
    var htmlStr = "";
    var tableStyle = "width:100%; border-collapse:collapse; border:1px solid #111; margin-bottom: 8px;";
    var thStyle = "padding:5px 8px; font-size:11px; font-weight:bold; background:#f0fdf4; border:1px solid #111; text-align:center;";
    var tdStyle = "padding:4px 8px; font-size:12px; border:1px solid #111; text-align:center;";
    var tdLeft = tdStyle + "text-align:left;";

    displayChemicals.forEach(function(chem) {
       var cStats = reportData[chem.name] || { batches: {}, subBatchRows: [] };
       var unit = chem.unit || "";
       var batchRows = (chem.batches || []).slice().sort(function(a,b) { return (a.expiryDate || "").localeCompare(b.expiryDate || ""); }).map(function(b) {
          var bStat = cStats.batches[b.id] || { usedInPeriod: 0, usedAfterPeriod: 0 };
          var openingBal = +(b.remaining + bStat.usedInPeriod + bStat.usedAfterPeriod).toFixed(4);
          var closingBal = +(b.remaining + bStat.usedAfterPeriod).toFixed(4);
          return { batchName: b.batchName||"—", mfgDate: b.manufacturingDate||"—", expiryDate: b.expiryDate||"—", status: b.status||"active", initialAmt: b.initialAmount, openingBal, usedInPeriod: bStat.usedInPeriod, closingBal, remaining: b.remaining, receivedFrom: b.receivedFrom||"—" };
       });
       var totUsed = batchRows.reduce(function(s,r) { return s+r.usedInPeriod; }, 0);
       var totOpening = batchRows.reduce(function(s,r) { return s+r.openingBal; }, 0);
       var totClosing = batchRows.reduce(function(s,r) { return s+r.closingBal; }, 0);
       var totRemain = batchRows.reduce(function(s,r) { return s+r.remaining; }, 0);
       var sbRows = cStats.subBatchRows.slice().sort(function(a,b) { return (a.date||"").localeCompare(b.date||""); });
       var hasActivity = totUsed > 0 || sbRows.length > 0;
       
       htmlStr += `<div style="margin-bottom:24px; page-break-inside:avoid;">`;
       htmlStr += `<h3 style="margin:0 0 6px; font-size:14px; border-left:4px solid #0d9488; padding-left:8px;">${chem.name} ${chem.grade ? `<span style="font-weight:normal;font-size:11px;">(Grade: ${chem.grade})</span>` : ""} <span style="font-weight:normal;font-size:11px;">(Unit: ${unit||"—"})</span>${!hasActivity ? ` <span style="font-style:italic;color:#666;font-size:11px;">(no usage in period)</span>` : ""}</h3>`;
       
       if (batchRows.length > 0) {
         htmlStr += `<table style="${tableStyle}"><thead><tr>
           <th style="${thStyle}">Batch No.</th><th style="${thStyle}">Mfg. Date</th><th style="${thStyle}">Expiry Date</th><th style="${thStyle}">Status</th>
           <th style="${thStyle}">Initial Recd.</th><th style="${thStyle}">Opening Bal.</th><th style="${thStyle}">Used in Period</th><th style="${thStyle}">Closing Bal.</th><th style="${thStyle}">Current Remaining</th>
         </tr></thead><tbody>`;
         batchRows.forEach(function(r) {
            htmlStr += `<tr>
              <td style="${tdLeft}font-weight:bold;">${r.batchName}</td><td style="${tdStyle}">${r.mfgDate}</td><td style="${tdStyle}">${r.expiryDate}</td><td style="${tdStyle}">${(r.status||"active").toUpperCase()}</td>
              <td style="${tdStyle}">${fmtAmt(r.initialAmt)}</td><td style="${tdStyle}">${fmtAmt(r.openingBal)}</td><td style="${tdStyle}">${fmtAmt(r.usedInPeriod)}</td><td style="${tdStyle}">${fmtAmt(r.closingBal)}</td><td style="${tdStyle}">${fmtAmt(r.remaining)}</td>
            </tr>`;
         });
         htmlStr += `<tr style="background:#f0f9ff;font-weight:bold;">
           <td colspan="5" style="${tdLeft}">TOTAL</td><td style="${tdStyle}">${fmtAmt(totOpening)}</td><td style="${tdStyle}">${fmtAmt(totUsed)}</td><td style="${tdStyle}">${fmtAmt(totClosing)}</td><td style="${tdStyle}">${fmtAmt(totRemain)}</td>
         </tr></tbody></table>`;
       }
       
       if (sbRows.length > 0) {
         htmlStr += `<div style="font-size:11px;font-weight:bold;margin-bottom:4px;">Analytical Batches consuming this chemical:</div>`;
         htmlStr += `<table style="${tableStyle}"><thead><tr>
           <th style="${thStyle}">Date</th><th style="${thStyle}">Sub-Batch</th><th style="${thStyle}">Test Type</th><th style="${thStyle}">Field Samples</th><th style="${thStyle}">Std. Samples</th><th style="${thStyle}">Diluted Samples</th><th style="${thStyle}">Total Samples</th><th style="${thStyle}">Amount Used</th>
         </tr></thead><tbody>`;
         sbRows.forEach(function(r) {
           htmlStr += `<tr>
             <td style="${tdStyle}">${r.date}</td><td style="${tdLeft}font-family:monospace;">${r.label}</td><td style="${tdLeft}">${r.testTypeName}</td>
             <td style="${tdStyle}">${r.fieldSamples||0}</td><td style="${tdStyle}">${r.stdSamples||0}</td><td style="${tdStyle}">${r.dilutedSamples||0}</td><td style="${tdStyle}">${r.totalSamples||0}</td>
             <td style="${tdStyle}font-weight:bold;">${fmtAmt(r.totalUsed)}</td>
           </tr>`;
         });
         var sumField = sbRows.reduce(function(s,r) { return s+(r.fieldSamples||0); }, 0);
         var sumStd = sbRows.reduce(function(s,r) { return s+(r.stdSamples||0); }, 0);
         var sumDil = sbRows.reduce(function(s,r) { return s+(r.dilutedSamples||0); }, 0);
         var sumTot = sbRows.reduce(function(s,r) { return s+(r.totalSamples||0); }, 0);
         var sumUsed = sbRows.reduce(function(s,r) { return s+(r.totalUsed||0); }, 0);
         htmlStr += `<tr style="background:#f0f9ff;font-weight:bold;">
           <td colspan="3" style="${tdLeft}">TOTAL</td><td style="${tdStyle}">${sumField}</td><td style="${tdStyle}">${sumStd}</td><td style="${tdStyle}">${sumDil}</td><td style="${tdStyle}">${sumTot}</td><td style="${tdStyle}">${fmtAmt(sumUsed)}</td>
         </tr></tbody></table>`;
       }
       htmlStr += `</div>`;
    });
    
    var html = buildChemicalUsageReportHtml({
      labIdentity: session || {},
      startDate: startDate,
      endDate: endDate,
      tableHtml: htmlStr,
      signatory: { designation: designation, line2: signLine2 }
    });
    
    var w = openReportPrintWindow();
    finishReportPrintWindow(w, html);
  }

  // ---- Render ----
  return /*#__PURE__*/React.createElement("div", null,

    // ── Controls bar ──
    /*#__PURE__*/React.createElement(SectionCard, {
      title: "Chemical Inventory Usage Report",
      icon: /*#__PURE__*/React.createElement(Icon, { name: "flask", size: 15 })
    },
      /*#__PURE__*/React.createElement("div", {
        className: "flex flex-wrap gap-3 mb-4 items-end no-print",
        style: { borderBottom: "1px solid " + C.border, paddingBottom: 12 }
      },
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "From",
          /*#__PURE__*/React.createElement("input", {
            type: "date", value: startDate,
            onChange: function(e) { setStartDate(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          })
        ),
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "To",
          /*#__PURE__*/React.createElement("input", {
            type: "date", value: endDate,
            onChange: function(e) { setEndDate(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          })
        ),
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "Chemical",
          /*#__PURE__*/React.createElement("select", {
            value: selectedChemId,
            onChange: function(e) { setSelectedChemId(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          },
            /*#__PURE__*/React.createElement("option", { value: "ALL" }, "All Chemicals"),
            allChemicals.map(function(c) {
              return /*#__PURE__*/React.createElement("option", { key: c.id, value: c.id }, c.name);
            })
          )
        ),
        /*#__PURE__*/React.createElement(Button, {
          size: "sm", variant: "primary",
          onClick: generateReportData
        }, /*#__PURE__*/React.createElement(Icon, { name: "chart", size: 12 }), " Generate Report")
      ),
      /*#__PURE__*/React.createElement("div", {
        className: "grid gap-2 mb-3 no-print",
        style: { gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }
      },
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Designation",
          value: designation,
          onChange: function(v) { setDesignation(v); }
        }),
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Address Line (optional)",
          value: signLine2,
          onChange: function(v) { setSignLine2(v); },
          placeholder: "e.g. Radha Ballob, Rangpur."
        })
      ),
      reportData && /*#__PURE__*/React.createElement("div", { className: "mb-4 no-print flex justify-end" },
        /*#__PURE__*/React.createElement(Button, {
          size: "sm", variant: "outline",
          onClick: generateAndPrint
        }, /*#__PURE__*/React.createElement(Icon, { name: "printer", size: 12 }), " Print / PDF (Official Format)")
      ),

      // ── Per-chemical sections ──
      !reportData ? /*#__PURE__*/React.createElement("div", { className: "text-sm p-4", style: { color: C.muted } }, "Click 'Generate Report' to view chemical usage for the selected period.") :
      displayChemicals.length === 0
        ? /*#__PURE__*/React.createElement("div", { className: "text-sm p-4", style: { color: C.muted } }, "No chemicals in inventory.")
        : displayChemicals.map(function(chem) {
            var cStats = reportData[chem.name] || { batches: {}, subBatchRows: [] };
            var unit = chem.unit || "";

            // ---- Build per-batch rows ----
            var batchRows = (chem.batches || []).slice().sort(function(a, b) {
              return (a.expiryDate || "").localeCompare(b.expiryDate || "");
            }).map(function(b) {
              var bStat = cStats.batches[b.id] || { usedInPeriod: 0, usedAfterPeriod: 0 };
              // Opening balance for the period = remaining + usedInPeriod + usedAfterPeriod
              var openingBal = +(b.remaining + bStat.usedInPeriod + bStat.usedAfterPeriod).toFixed(4);
              var closingBal = +(b.remaining + bStat.usedAfterPeriod).toFixed(4);
              return {
                batchName:    b.batchName || "—",
                mfgDate:      b.manufacturingDate || "—",
                expiryDate:   b.expiryDate || "—",
                status:       b.status || "active",
                initialAmt:   b.initialAmount,
                openingBal:   openingBal,
                usedInPeriod: bStat.usedInPeriod,
                closingBal:   closingBal,
                remaining:    b.remaining,
                receivedFrom: b.receivedFrom || "—"
              };
            });

            // Totals for batch table
            var totUsed    = batchRows.reduce(function(s, r) { return s + r.usedInPeriod; }, 0);
            var totOpening = batchRows.reduce(function(s, r) { return s + r.openingBal;   }, 0);
            var totClosing = batchRows.reduce(function(s, r) { return s + r.closingBal;   }, 0);
            var totRemain  = batchRows.reduce(function(s, r) { return s + r.remaining;    }, 0);

            // Sub-batch rows sorted by date
            var sbRows = cStats.subBatchRows.slice().sort(function(a, b) {
              return (a.date || "").localeCompare(b.date || "");
            });

            // Accumulate export rows
            batchRows.forEach(function(r) {
              exportRows.push({
                "Chemical":          chem.name,
                "Grade":             chem.grade || "",
                "Unit":              unit,
                "Batch No.":         r.batchName,
                "Mfg. Date":         r.mfgDate,
                "Expiry Date":       r.expiryDate,
                "Status":            r.status,
                "Received From":     r.receivedFrom,
                "Initial Received":  r.initialAmt,
                "Opening Balance":   r.openingBal,
                "Used in Period":    r.usedInPeriod,
                "Closing Balance":   r.closingBal,
                "Current Remaining": r.remaining
              });
            });

            var statusBadge = function(s) {
              var col = s === "active" ? "#16a34a" : s === "expired" ? "#dc2626" : "#6b7280";
              return /*#__PURE__*/React.createElement("span", {
                style: {
                  display: "inline-block", padding: "1px 6px", borderRadius: 9,
                  fontSize: 10, fontWeight: 700, color: "#fff", background: col
                }
              }, (s || "active").toUpperCase());
            };

            var hasActivity = totUsed > 0 || sbRows.length > 0;

            return /*#__PURE__*/React.createElement("div", {
              key: chem.id,
              className: "mb-6",
              style: { pageBreakInside: "avoid" }
            },
              // Chemical header
              /*#__PURE__*/React.createElement("div", {
                className: "flex items-center gap-3 mb-2 px-1",
                style: {
                  borderLeft: "4px solid " + C.teal, paddingLeft: 8
                }
              },
                /*#__PURE__*/React.createElement("span", {
                  className: "font-bold text-sm", style: { color: C.ink }
                }, chem.name),
                chem.grade && /*#__PURE__*/React.createElement("span", {
                  className: "text-xs px-2 py-0.5 rounded",
                  style: { background: C.border, color: C.muted }
                }, "Grade: " + chem.grade),
                /*#__PURE__*/React.createElement("span", {
                  className: "text-xs", style: { color: C.muted }
                }, "Unit: " + (unit || "—")),
                !hasActivity && /*#__PURE__*/React.createElement("span", {
                  className: "text-xs italic", style: { color: C.muted }
                }, "(no usage in selected period)")
              ),

              // ── Batch summary table ──
              /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto", marginBottom: 8 } },
                /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", border: "1px solid " + C.border } },
                  /*#__PURE__*/React.createElement("thead", null,
                    /*#__PURE__*/React.createElement("tr", null,
                      ["Batch No.", "Mfg. Date", "Expiry Date", "Status", "Initial Recd.", "Opening Bal.", "Used in Period", "Closing Bal.", "Current Remaining"].map(function(h) {
                        return /*#__PURE__*/React.createElement("th", { key: h, style: th() }, h);
                      })
                    )
                  ),
                  /*#__PURE__*/React.createElement("tbody", null,
                    batchRows.length === 0
                      ? /*#__PURE__*/React.createElement("tr", null,
                          /*#__PURE__*/React.createElement("td", { colSpan: 9, style: td({ color: C.muted, fontStyle: "italic" }) }, "No batches.")
                        )
                      : batchRows.map(function(r, i) {
                          var rowBg = r.status === "expired" ? "#fef2f2" : r.status === "depleted" ? "#f9fafb" : "transparent";
                          return /*#__PURE__*/React.createElement("tr", { key: i, style: { background: rowBg } },
                            /*#__PURE__*/React.createElement("td", { style: tdL({ fontWeight: 600 }) }, r.batchName),
                            /*#__PURE__*/React.createElement("td", { style: td() }, r.mfgDate),
                            /*#__PURE__*/React.createElement("td", { style: td() }, r.expiryDate),
                            /*#__PURE__*/React.createElement("td", { style: td() }, statusBadge(r.status)),
                            /*#__PURE__*/React.createElement("td", { style: td() }, fmtAmt(r.initialAmt, unit)),
                            /*#__PURE__*/React.createElement("td", { style: td() }, fmtAmt(r.openingBal, unit)),
                            /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: r.usedInPeriod > 0 ? 700 : 400, color: r.usedInPeriod > 0 ? "#1d4ed8" : C.muted }) },
                              fmtAmt(r.usedInPeriod, unit)
                            ),
                            /*#__PURE__*/React.createElement("td", { style: td() }, fmtAmt(r.closingBal, unit)),
                            /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 600, color: r.remaining < (r.initialAmt * 0.15) ? "#dc2626" : "#16a34a" }) },
                              fmtAmt(r.remaining, unit)
                            )
                          );
                        }),
                    // Totals row
                    batchRows.length > 0 && /*#__PURE__*/React.createElement("tr", { style: { background: "#f0f9ff", fontWeight: 700 } },
                      /*#__PURE__*/React.createElement("td", { colSpan: 5, style: tdL({ borderTop: "2px solid " + C.border, fontWeight: 700 }) }, "TOTAL"),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, fmtAmt(totOpening, unit)),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: "#1d4ed8" }) }, fmtAmt(totUsed, unit)),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, fmtAmt(totClosing, unit)),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: "#16a34a" }) }, fmtAmt(totRemain, unit))
                    )
                  )
                )
              ),

              // ── Sub-batch usage table (only shown when there IS usage in period) ──
              sbRows.length > 0 && /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto", marginBottom: 4 } },
                /*#__PURE__*/React.createElement("div", {
                  className: "text-xs font-semibold mb-1 px-1",
                  style: { color: C.muted }
                }, "Analytical Batches consuming this chemical — " + startDate + " to " + endDate),
                /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", border: "1px solid " + C.border } },
                  /*#__PURE__*/React.createElement("thead", null,
                    /*#__PURE__*/React.createElement("tr", null,
                      ["Date", "Sub-Batch", "Test Type", "Field Samples", "Std. Samples", "Diluted Samples", "Total Samples", "Amount Used"].map(function(h) {
                        return /*#__PURE__*/React.createElement("th", { key: h, style: th() }, h);
                      })
                    )
                  ),
                  /*#__PURE__*/React.createElement("tbody", null,
                    sbRows.map(function(r, i) {
                      return /*#__PURE__*/React.createElement("tr", { key: i },
                        /*#__PURE__*/React.createElement("td", { style: td() }, r.date),
                        /*#__PURE__*/React.createElement("td", { style: tdL({ fontFamily: "monospace", fontSize: 11 }) }, r.label),
                        /*#__PURE__*/React.createElement("td", { style: tdL() }, r.testTypeName),
                        /*#__PURE__*/React.createElement("td", { style: td() }, r.fieldSamples || 0),
                        /*#__PURE__*/React.createElement("td", { style: td() }, r.stdSamples || 0),
                        /*#__PURE__*/React.createElement("td", { style: td() }, r.dilutedSamples || 0),
                        /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 600 }) }, r.totalSamples || 0),
                        /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 700, color: "#1d4ed8" }) }, fmtAmt(r.totalUsed, unit))
                      );
                    }),
                    // Sub-batch totals
                    /*#__PURE__*/React.createElement("tr", { style: { background: "#f0f9ff", fontWeight: 700 } },
                      /*#__PURE__*/React.createElement("td", { colSpan: 3, style: tdL({ borderTop: "2px solid " + C.border }) }, "TOTAL"),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) },
                        sbRows.reduce(function(s, r) { return s + (r.fieldSamples || 0); }, 0)
                      ),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) },
                        sbRows.reduce(function(s, r) { return s + (r.stdSamples || 0); }, 0)
                      ),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) },
                        sbRows.reduce(function(s, r) { return s + (r.dilutedSamples || 0); }, 0)
                      ),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) },
                        sbRows.reduce(function(s, r) { return s + (r.totalSamples || 0); }, 0)
                      ),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: "#1d4ed8" }) },
                        fmtAmt(sbRows.reduce(function(s, r) { return s + (r.totalUsed || 0); }, 0), unit)
                      )
                    )
                  )
                )
              )
            ); // end per-chemical div
          }),

      // ── XLSX export (hidden on print) ──
      reportData && /*#__PURE__*/React.createElement("div", { className: "mt-5 no-print" },
        exportRows.length > 0
          ? /*#__PURE__*/React.createElement(DataTable, {
              exportFilename: "chemical_usage_report_" + startDate + "_to_" + endDate,
              columns: [
                { key: "Chemical",          label: "Chemical"          },
                { key: "Grade",             label: "Grade"             },
                { key: "Unit",              label: "Unit"              },
                { key: "Batch No.",         label: "Batch No."         },
                { key: "Mfg. Date",         label: "Mfg. Date"        },
                { key: "Expiry Date",       label: "Expiry Date"       },
                { key: "Status",            label: "Status"            },
                { key: "Received From",     label: "Received From"     },
                { key: "Initial Received",  label: "Initial Received"  },
                { key: "Opening Balance",   label: "Opening Balance"   },
                { key: "Used in Period",    label: "Used in Period"    },
                { key: "Closing Balance",   label: "Closing Balance"   },
                { key: "Current Remaining", label: "Current Remaining" }
              ],
              rows: exportRows
            })
          : /*#__PURE__*/React.createElement("div", { className: "text-xs p-3", style: { color: C.muted } },
              "No chemical usage found in the selected period. The XLSX export will appear here once usage is detected."
            )
      )
    ) // end SectionCard
  ); // end outer div
}

// ==================================== EQUIPMENT USAGE & MAINTENANCE REPORT ====================================
function EquipmentUsageReportPage({ equipment, testRecords, session }) {
  var today = todayStr();
  var firstOfMonth = today.slice(0, 7) + "-01";
  var [startDate, setStartDate] = React.useState(firstOfMonth);
  var [endDate,   setEndDate]   = React.useState(today);
  var [designation, setDesignation] = React.useState("Senior Chemist");
  var [signLine2, setSignLine2] = React.useState("");
  var [selectedEquipId, setSelectedEquipId] = React.useState("ALL");
  var [reportData, setReportData] = React.useState(null);

  // Clear report data if filters change
  React.useEffect(function() {
    setReportData(null);
  }, [startDate, endDate, selectedEquipId]);

  var allEquip = (equipment || []).slice().sort(function(a, b) {
    return (a.name || "").localeCompare(b.name || "");
  });
  var displayEquip = selectedEquipId === "ALL"
    ? allEquip
    : allEquip.filter(function(e) { return e.id === selectedEquipId; });

  function generateReportData() {
    var stats = {}; // equipId -> { equipment, testRuns: [], periodEvents: [], periodRepairCost: 0, lifetimeRepairCost: 0, lifetimeBreakdowns: 0, periodBreakdowns: 0 }
    
    (equipment || []).forEach(function(eq) {
      var hist = (eq.history || []).slice().sort(function(a,b) { return (a.date||"").localeCompare(b.date||""); });
      var periodEvents = hist.filter(function(h) {
        var d = h.date || "";
        return d >= startDate && d <= endDate;
      });
      var periodCost = periodEvents.reduce(function(s, h) {
        return s + (h.type === "repair" || h.type === "other" || h.type === "maintenance" ? (Number(h.cost) || 0) : 0);
      }, 0);
      var lifetimeCost = hist.reduce(function(s, h) {
        return s + (h.type === "repair" || h.type === "other" || h.type === "maintenance" ? (Number(h.cost) || 0) : 0);
      }, 0);
      var periodBreakdowns = periodEvents.filter(function(h) { return h.type === "breakdown"; }).length;
      var lifetimeBreakdowns = hist.filter(function(h) { return h.type === "breakdown"; }).length;

      stats[eq.id] = {
        equipment: eq,
        testRuns: [],
        periodEvents: periodEvents,
        lifetimeEvents: hist,
        periodRepairCost: periodCost,
        lifetimeRepairCost: lifetimeCost,
        periodBreakdowns: periodBreakdowns,
        lifetimeBreakdowns: lifetimeBreakdowns
      };
    });

    (testRecords || []).forEach(function(tr) {
      var d = tr.date || "";
      if (d < startDate || d > endDate) return;
      var eqId = tr.equipmentId;
      var targetEq = (equipment || []).find(function(e) { return (eqId && e.id === eqId) || (tr.equipmentName && e.name === tr.equipmentName); });
      if (!targetEq) return;
      var fSamp = tr.numberOfFieldSamples || 0;
      var sSamp = tr.numberOfStandardSamples || 0;
      var dSamp = tr.dilutionRequired ? (Number(tr.numberOfDilutedSamples) || 0) : 0;
      var totSamp = fSamp + sSamp + dSamp;

      if (!stats[targetEq.id]) {
        stats[targetEq.id] = {
          equipment: targetEq,
          testRuns: [],
          periodEvents: [],
          lifetimeEvents: [],
          periodRepairCost: 0,
          lifetimeRepairCost: 0,
          periodBreakdowns: 0,
          lifetimeBreakdowns: 0
        };
      }

      stats[targetEq.id].testRuns.push({
        date: d,
        label: tr.subBatchLabel || "(individual)",
        testTypeName: tr.testTypeName || "",
        fieldSamples: fSamp,
        stdSamples: sSamp,
        dilutedSamples: dSamp,
        totalSamples: totSamp,
        tester: tr.tester || "—"
      });
    });

    setReportData(stats);
  }

  function fmtNum(v) {
    var n = Number(v) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  var th = function(extra) {
    return Object.assign({
      padding: "5px 8px", fontSize: 11, fontWeight: 700,
      background: "#f0fdf4", borderBottom: "2px solid " + C.border,
      borderRight: "1px solid " + C.border, whiteSpace: "nowrap", textAlign: "center"
    }, extra || {});
  };
  var td = function(extra) {
    return Object.assign({
      padding: "4px 8px", fontSize: 12,
      borderBottom: "1px solid " + C.border,
      borderRight: "1px solid " + C.border, textAlign: "center"
    }, extra || {});
  };
  var tdL = function(extra) { return td(Object.assign({ textAlign: "left" }, extra)); };

  var exportRows = [];

  async function generateAndPrint() {
    var htmlStr = "";
    var tableStyle = "width:100%; border-collapse:collapse; border:1px solid #111; margin-bottom: 12px;";
    var thStyle = "padding:5px 8px; font-size:11px; font-weight:bold; background:#f0fdf4; border:1px solid #111; text-align:center;";
    var tdStyle = "padding:4px 8px; font-size:12px; border:1px solid #111; text-align:center;";
    var tdLeft = tdStyle + "text-align:left;";

    displayEquip.forEach(function(eq) {
      var eStats = (reportData && reportData[eq.id]) || { testRuns: [], periodEvents: [], periodRepairCost: 0, lifetimeRepairCost: 0 };
      var runs = eStats.testRuns.slice().sort(function(a,b) { return (a.date||"").localeCompare(b.date||""); });
      var totRuns = runs.length;
      var totField = runs.reduce(function(s,r){ return s + (r.fieldSamples||0); }, 0);
      var totStd = runs.reduce(function(s,r){ return s + (r.stdSamples||0); }, 0);
      var totDil = runs.reduce(function(s,r){ return s + (r.dilutedSamples||0); }, 0);
      var totSamples = runs.reduce(function(s,r){ return s + (r.totalSamples||0); }, 0);
      var events = eStats.periodEvents.slice().sort(function(a,b) { return (a.date||"").localeCompare(b.date||""); });

      htmlStr += `<div style="margin-bottom:28px; page-break-inside:avoid;">`;
      htmlStr += `<div style="background:#f8fafc; border:1px solid #cbd5e1; padding:8px 12px; margin-bottom:8px; border-left:4px solid #0d9488;">
        <div style="font-size:14px; font-weight:bold; color:#0f172a;">${eq.name} <span style="font-size:11px; font-weight:normal; color:#475569;">[Status: ${eq.functional ? "FUNCTIONAL" : "NOT FUNCTIONAL"}]</span></div>
        <div style="font-size:11px; color:#475569; margin-top:2px;">
          <span>Received: <strong>${eq.dateReceived || "—"}</strong></span> | 
          <span>Origin / Make: <strong>${eq.origin || "—"}</strong></span> | 
          <span>Received From: <strong>${eq.receivedFrom || "—"}</strong></span> | 
          <span>Period Maintenance Cost: <strong>${fmtNum(eStats.periodRepairCost)} BDT</strong></span> | 
          <span>Lifetime Maintenance Cost: <strong>${fmtNum(eStats.lifetimeRepairCost)} BDT</strong></span>
        </div>
      </div>`;

      // Table 1: Testing & Sample Utilization
      htmlStr += `<div style="font-size:11px; font-weight:bold; margin:6px 0 4px;">1. Testing & Sample Utilization Breakdown in Period:</div>`;
      if (runs.length === 0) {
        htmlStr += `<div style="font-size:11px; font-style:italic; color:#64748b; margin-bottom:10px;">No test runs logged with this equipment in the selected period.</div>`;
      } else {
        htmlStr += `<table style="${tableStyle}"><thead><tr>
          <th style="${thStyle}">Date</th><th style="${thStyle}">Sub-Batch</th><th style="${thStyle}">Test Type / Parameter</th><th style="${thStyle}">Field Samples</th><th style="${thStyle}">Std. Samples</th><th style="${thStyle}">Diluted Samples</th><th style="${thStyle}">Total Samples</th><th style="${thStyle}">Tester</th>
        </tr></thead><tbody>`;
        runs.forEach(function(r) {
          htmlStr += `<tr>
            <td style="${tdStyle}">${r.date}</td><td style="${tdLeft}font-family:monospace;">${r.label}</td><td style="${tdLeft}">${r.testTypeName}</td>
            <td style="${tdStyle}">${r.fieldSamples}</td><td style="${tdStyle}">${r.stdSamples}</td><td style="${tdStyle}">${r.dilutedSamples}</td><td style="${tdStyle}font-weight:bold;">${r.totalSamples}</td><td style="${tdStyle}">${r.tester}</td>
          </tr>`;
        });
        htmlStr += `<tr style="background:#f0f9ff; font-weight:bold;">
          <td colspan="3" style="${tdLeft}">TOTAL</td><td style="${tdStyle}">${totField}</td><td style="${tdStyle}">${totStd}</td><td style="${tdStyle}">${totDil}</td><td style="${tdStyle}">${totSamples}</td><td style="${tdStyle}">—</td>
        </tr></tbody></table>`;
      }

      // Table 2: Maintenance & Repair Log
      htmlStr += `<div style="font-size:11px; font-weight:bold; margin:6px 0 4px;">2. Maintenance, Calibration & Repair Log in Period:</div>`;
      if (events.length === 0) {
        htmlStr += `<div style="font-size:11px; font-style:italic; color:#64748b; margin-bottom:14px;">No maintenance, repair, or breakdown events logged in the selected period.</div>`;
      } else {
        htmlStr += `<table style="${tableStyle}"><thead><tr>
          <th style="${thStyle}">Date</th><th style="${thStyle}">Event Type</th><th style="${thStyle}">Description / Problem</th><th style="${thStyle}">Cost (BDT)</th><th style="${thStyle}">Functional After</th>
        </tr></thead><tbody>`;
        events.forEach(function(h) {
          htmlStr += `<tr>
            <td style="${tdStyle}">${h.date || "—"}</td>
            <td style="${tdStyle}">${(h.type || "Event").toUpperCase()}</td>
            <td style="${tdLeft}">${h.description || h.note || "—"}</td>
            <td style="${tdStyle}">${h.cost ? fmtNum(h.cost) : "0.00"}</td>
            <td style="${tdStyle}">${h.functionalAfter ? "Yes (Functional)" : "No (Needs Repair)"}</td>
          </tr>`;
        });
        htmlStr += `<tr style="background:#f0f9ff; font-weight:bold;">
          <td colspan="3" style="${tdLeft}">TOTAL MAINTENANCE EXPENDITURE (PERIOD)</td>
          <td style="${tdStyle}">${fmtNum(eStats.periodRepairCost)}</td>
          <td style="${tdStyle}">—</td>
        </tr></tbody></table>`;
      }

      htmlStr += `</div>`;
    });

    var html = buildEquipmentUsageReportHtml({
      labIdentity: session || {},
      startDate: startDate,
      endDate: endDate,
      tableHtml: htmlStr,
      signatory: { designation: designation, line2: signLine2 }
    });

    var w = openReportPrintWindow();
    finishReportPrintWindow(w, html);
  }

  // ---- Render ----
  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement(SectionCard, {
      title: "Equipment Utilization & Maintenance Report",
      icon: /*#__PURE__*/React.createElement(Icon, { name: "wrench", size: 15 })
    },
      /*#__PURE__*/React.createElement("div", {
        className: "flex flex-wrap gap-3 mb-4 items-end no-print",
        style: { borderBottom: "1px solid " + C.border, paddingBottom: 12 }
      },
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "From",
          /*#__PURE__*/React.createElement("input", {
            type: "date", value: startDate,
            onChange: function(e) { setStartDate(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          })
        ),
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "To",
          /*#__PURE__*/React.createElement("input", {
            type: "date", value: endDate,
            onChange: function(e) { setEndDate(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          })
        ),
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "Equipment",
          /*#__PURE__*/React.createElement("select", {
            value: selectedEquipId,
            onChange: function(e) { setSelectedEquipId(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          },
            /*#__PURE__*/React.createElement("option", { value: "ALL" }, "All Equipment"),
            allEquip.map(function(e) {
              return /*#__PURE__*/React.createElement("option", { key: e.id, value: e.id }, e.name);
            })
          )
        ),
        /*#__PURE__*/React.createElement(Button, {
          size: "sm", variant: "primary",
          onClick: generateReportData
        }, /*#__PURE__*/React.createElement(Icon, { name: "chart", size: 12 }), " Generate Report")
      ),
      /*#__PURE__*/React.createElement("div", {
        className: "grid gap-2 mb-3 no-print",
        style: { gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }
      },
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Designation",
          value: designation,
          onChange: function(v) { setDesignation(v); }
        }),
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Address Line (optional)",
          value: signLine2,
          onChange: function(v) { setSignLine2(v); },
          placeholder: "e.g. Radha Ballob, Rangpur."
        })
      ),
      reportData && /*#__PURE__*/React.createElement("div", { className: "mb-4 no-print flex justify-end" },
        /*#__PURE__*/React.createElement(Button, {
          size: "sm", variant: "outline",
          onClick: generateAndPrint
        }, /*#__PURE__*/React.createElement(Icon, { name: "printer", size: 12 }), " Print / PDF (Official Format)")
      ),

      // ── Per-Equipment sections ──
      !reportData ? /*#__PURE__*/React.createElement("div", { className: "text-sm p-4", style: { color: C.muted } }, "Click 'Generate Report' to view equipment utilization & maintenance records for the selected period.") :
      displayEquip.length === 0
        ? /*#__PURE__*/React.createElement("div", { className: "text-sm p-4", style: { color: C.muted } }, "No equipment found.")
        : displayEquip.map(function(eq) {
            var eStats = reportData[eq.id] || { testRuns: [], periodEvents: [], periodRepairCost: 0, lifetimeRepairCost: 0 };
            var runs = eStats.testRuns.slice().sort(function(a,b) { return (a.date||"").localeCompare(b.date||""); });
            var totRuns = runs.length;
            var totField = runs.reduce(function(s,r){ return s + (r.fieldSamples||0); }, 0);
            var totStd = runs.reduce(function(s,r){ return s + (r.stdSamples||0); }, 0);
            var totDil = runs.reduce(function(s,r){ return s + (r.dilutedSamples||0); }, 0);
            var totSamples = runs.reduce(function(s,r){ return s + (r.totalSamples||0); }, 0);
            var events = eStats.periodEvents.slice().sort(function(a,b) { return (a.date||"").localeCompare(b.date||""); });

            // Accumulate export rows
            runs.forEach(function(r) {
              exportRows.push({
                "Equipment":              eq.name,
                "Status":                 eq.functional ? "Functional" : "Not Functional",
                "Date Received":          eq.dateReceived || "—",
                "Origin":                 eq.origin || "—",
                "Received From":          eq.receivedFrom || "—",
                "Test Date":              r.date,
                "Sub-Batch":              r.label,
                "Test Type / Parameter":  r.testTypeName,
                "Field Samples":          r.fieldSamples,
                "Std. Samples":           r.stdSamples,
                "Diluted Samples":        r.dilutedSamples,
                "Total Samples":          r.totalSamples,
                "Tester":                 r.tester,
                "Period Maint. Cost":     eStats.periodRepairCost,
                "Lifetime Maint. Cost":   eStats.lifetimeRepairCost
              });
            });
            if (runs.length === 0) {
              exportRows.push({
                "Equipment":              eq.name,
                "Status":                 eq.functional ? "Functional" : "Not Functional",
                "Date Received":          eq.dateReceived || "—",
                "Origin":                 eq.origin || "—",
                "Received From":          eq.receivedFrom || "—",
                "Test Date":              "—",
                "Sub-Batch":              "—",
                "Test Type / Parameter":  "— (No runs)",
                "Field Samples":          0,
                "Std. Samples":           0,
                "Diluted Samples":        0,
                "Total Samples":          0,
                "Tester":                 "—",
                "Period Maint. Cost":     eStats.periodRepairCost,
                "Lifetime Maint. Cost":   eStats.lifetimeRepairCost
              });
            }

            return /*#__PURE__*/React.createElement("div", {
              key: eq.id,
              className: "mb-6 p-4 rounded-lg border",
              style: { borderColor: C.border, background: "#fff" }
            },
              // Header & metadata
              /*#__PURE__*/React.createElement("div", {
                className: "flex flex-wrap items-center justify-between gap-2 mb-3 pb-2",
                style: { borderBottom: "1px solid " + C.border }
              },
                /*#__PURE__*/React.createElement("div", { className: "flex items-center gap-2" },
                  /*#__PURE__*/React.createElement("span", { className: "font-bold text-base", style: { color: C.ink } }, eq.name),
                  /*#__PURE__*/React.createElement(Badge, { tone: eq.functional ? "ok" : "warn" }, eq.functional ? "Functional" : "Not Functional")
                ),
                /*#__PURE__*/React.createElement("div", { className: "flex flex-wrap gap-x-4 gap-y-1 text-xs", style: { color: C.muted } },
                  /*#__PURE__*/React.createElement("span", null, "Received: ", /*#__PURE__*/React.createElement("strong", { style: { color: C.ink } }, eq.dateReceived || "—")),
                  /*#__PURE__*/React.createElement("span", null, "Origin: ", /*#__PURE__*/React.createElement("strong", { style: { color: C.ink } }, eq.origin || "—")),
                  /*#__PURE__*/React.createElement("span", null, "Received From: ", /*#__PURE__*/React.createElement("strong", { style: { color: C.ink } }, eq.receivedFrom || "—"))
                )
              ),

              // KPI Metric Cards
              /*#__PURE__*/React.createElement("div", {
                className: "grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4"
              },
                /*#__PURE__*/React.createElement("div", { className: "p-2.5 rounded border text-center", style: { borderColor: C.border, background: "#f8fafc" } },
                  /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Analytical Batches"),
                  /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: C.teal } }, totRuns)
                ),
                /*#__PURE__*/React.createElement("div", { className: "p-2.5 rounded border text-center", style: { borderColor: C.border, background: "#f8fafc" } },
                  /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Total Samples Tested"),
                  /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: "#1d4ed8" } }, totSamples),
                  /*#__PURE__*/React.createElement("div", { className: "text-[10px]", style: { color: C.muted } }, `Field: ${totField} | Std: ${totStd} | Dil: ${totDil}`)
                ),
                /*#__PURE__*/React.createElement("div", { className: "p-2.5 rounded border text-center", style: { borderColor: C.border, background: "#f8fafc" } },
                  /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Period Maint. Cost"),
                  /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: eStats.periodRepairCost > 0 ? "#dc2626" : C.ink } }, fmtNum(eStats.periodRepairCost) + " BDT")
                ),
                /*#__PURE__*/React.createElement("div", { className: "p-2.5 rounded border text-center", style: { borderColor: C.border, background: "#f8fafc" } },
                  /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Lifetime Maint. Cost"),
                  /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: C.ink } }, fmtNum(eStats.lifetimeRepairCost) + " BDT")
                )
              ),

              // Table 1: Testing & Sample Utilization Breakdown
              /*#__PURE__*/React.createElement("div", { className: "text-xs font-bold mb-1.5 flex items-center gap-1.5", style: { color: C.ink } },
                /*#__PURE__*/React.createElement(Icon, { name: "clipboard", size: 13 }), " 1. Testing & Sample Utilization Breakdown in Period"
              ),
              runs.length === 0
                ? /*#__PURE__*/React.createElement("div", { className: "text-xs italic p-2 mb-3 rounded", style: { background: "#f8fafc", color: C.muted } }, "No test records found for this equipment in the selected period.")
                : /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto", marginBottom: 16 } },
                    /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", border: "1px solid " + C.border } },
                      /*#__PURE__*/React.createElement("thead", null,
                        /*#__PURE__*/React.createElement("tr", null,
                          ["Date", "Sub-Batch", "Test Type / Parameter", "Field Samples", "Std. Samples", "Diluted Samples", "Total Samples", "Tester"].map(function(h) {
                            return /*#__PURE__*/React.createElement("th", { key: h, style: th() }, h);
                          })
                        )
                      ),
                      /*#__PURE__*/React.createElement("tbody", null,
                        runs.map(function(r, i) {
                          return /*#__PURE__*/React.createElement("tr", { key: i },
                            /*#__PURE__*/React.createElement("td", { style: td() }, r.date),
                            /*#__PURE__*/React.createElement("td", { style: tdL({ fontFamily: "monospace", fontSize: 11 }) }, r.label),
                            /*#__PURE__*/React.createElement("td", { style: tdL() }, r.testTypeName),
                            /*#__PURE__*/React.createElement("td", { style: td() }, r.fieldSamples),
                            /*#__PURE__*/React.createElement("td", { style: td() }, r.stdSamples),
                            /*#__PURE__*/React.createElement("td", { style: td() }, r.dilutedSamples),
                            /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 700, color: "#1d4ed8" }) }, r.totalSamples),
                            /*#__PURE__*/React.createElement("td", { style: td() }, r.tester)
                          );
                        }),
                        /*#__PURE__*/React.createElement("tr", { style: { background: "#f0f9ff", fontWeight: 700 } },
                          /*#__PURE__*/React.createElement("td", { colSpan: 3, style: tdL({ borderTop: "2px solid " + C.border }) }, "TOTAL SAMPLES"),
                          /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, totField),
                          /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, totStd),
                          /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, totDil),
                          /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: "#1d4ed8" }) }, totSamples),
                          /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, "—")
                        )
                      )
                    )
                  ),

              // Table 2: Maintenance, Calibration & Repair Log
              /*#__PURE__*/React.createElement("div", { className: "text-xs font-bold mb-1.5 flex items-center gap-1.5", style: { color: C.ink } },
                /*#__PURE__*/React.createElement(Icon, { name: "wrench", size: 13 }), " 2. Maintenance, Calibration & Repair Log in Period"
              ),
              events.length === 0
                ? /*#__PURE__*/React.createElement("div", { className: "text-xs italic p-2 rounded", style: { background: "#f8fafc", color: C.muted } }, "No maintenance or repair events recorded in the selected period.")
                : /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto" } },
                    /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", border: "1px solid " + C.border } },
                      /*#__PURE__*/React.createElement("thead", null,
                        /*#__PURE__*/React.createElement("tr", null,
                          ["Date", "Event Type", "Description / Problem", "Cost (BDT)", "Functional After"].map(function(h) {
                            return /*#__PURE__*/React.createElement("th", { key: h, style: th() }, h);
                          })
                        )
                      ),
                      /*#__PURE__*/React.createElement("tbody", null,
                        events.map(function(h, i) {
                          return /*#__PURE__*/React.createElement("tr", { key: i },
                            /*#__PURE__*/React.createElement("td", { style: td() }, h.date || "—"),
                            /*#__PURE__*/React.createElement("td", { style: td() }, /*#__PURE__*/React.createElement(Badge, { tone: h.type === "breakdown" ? "warn" : h.type === "repair" ? "info" : "neutral" }, (h.type || "Event").toUpperCase())),
                            /*#__PURE__*/React.createElement("td", { style: tdL() }, h.description || h.note || "—"),
                            /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: h.cost > 0 ? 600 : 400 }) }, h.cost ? fmtNum(h.cost) : "0.00"),
                            /*#__PURE__*/React.createElement("td", { style: td() }, h.functionalAfter ? /*#__PURE__*/React.createElement(Badge, { tone: "ok" }, "Yes") : /*#__PURE__*/React.createElement(Badge, { tone: "warn" }, "No"))
                          );
                        }),
                        /*#__PURE__*/React.createElement("tr", { style: { background: "#f0f9ff", fontWeight: 700 } },
                          /*#__PURE__*/React.createElement("td", { colSpan: 3, style: tdL({ borderTop: "2px solid " + C.border }) }, "TOTAL MAINTENANCE EXPENDITURE (PERIOD)"),
                          /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: "#dc2626" }) }, fmtNum(eStats.periodRepairCost) + " BDT"),
                          /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, "—")
                        )
                      )
                    )
                  )
            );
          }),

      // ── XLSX export (hidden on print) ──
      reportData && /*#__PURE__*/React.createElement("div", { className: "mt-5 no-print" },
        exportRows.length > 0
          ? /*#__PURE__*/React.createElement(DataTable, {
              exportFilename: "equipment_usage_report_" + startDate + "_to_" + endDate,
              columns: [
                { key: "Equipment",              label: "Equipment"              },
                { key: "Status",                 label: "Status"                 },
                { key: "Date Received",          label: "Date Received"          },
                { key: "Origin",                 label: "Origin"                 },
                { key: "Received From",          label: "Received From"          },
                { key: "Test Date",              label: "Test Date"              },
                { key: "Sub-Batch",              label: "Sub-Batch"              },
                { key: "Test Type / Parameter",  label: "Test Type / Parameter"  },
                { key: "Field Samples",          label: "Field Samples"          },
                { key: "Std. Samples",           label: "Std. Samples"           },
                { key: "Diluted Samples",        label: "Diluted Samples"        },
                { key: "Total Samples",          label: "Total Samples"          },
                { key: "Tester",                 label: "Tester"                 },
                { key: "Period Maint. Cost",     label: "Period Maint. Cost"     },
                { key: "Lifetime Maint. Cost",   label: "Lifetime Maint. Cost"   }
              ],
              rows: exportRows
            })
          : /*#__PURE__*/React.createElement("div", { className: "text-xs p-3", style: { color: C.muted } },
              "No equipment activity found in the selected period."
            )
      )
    ) // end SectionCard
  ); // end outer div
}

// ==================================== GLASSWARE INVENTORY & USAGE REPORT ====================================
function GlasswareUsageReportPage({ glassware, session }) {
  var today = todayStr();
  var firstOfMonth = today.slice(0, 7) + "-01";
  var [startDate, setStartDate] = React.useState(firstOfMonth);
  var [endDate,   setEndDate]   = React.useState(today);
  var [designation, setDesignation] = React.useState("Senior Chemist");
  var [signLine2, setSignLine2] = React.useState("");
  var [selectedGlassId, setSelectedGlassId] = React.useState("ALL");
  var [reportData, setReportData] = React.useState(null);

  React.useEffect(function() {
    setReportData(null);
  }, [startDate, endDate, selectedGlassId]);

  var allGlass = (glassware || []).slice().sort(function(a, b) {
    return (a.name || "").localeCompare(b.name || "");
  });
  var displayGlass = selectedGlassId === "ALL"
    ? allGlass
    : allGlass.filter(function(g) { return g.id === selectedGlassId; });

  function generateReportData() {
    var stats = {}; // glassId -> { item, inStore, breakageRate, periodBreakage, events }
    (glassware || []).forEach(function(g) {
      var inStore = g.totalQuantity - (g.inUse || 0) - (g.broken || 0);
      var bRate = g.totalQuantity > 0 ? +((g.broken / g.totalQuantity) * 100).toFixed(1) : 0;
      var bLog = (g.brokenLog || []).filter(function(b) {
        var d = b.date || "";
        return d >= startDate && d <= endDate;
      });
      var periodBroken = bLog.reduce(function(s, b) { return s + (Number(b.count) || 1); }, 0);
      stats[g.id] = {
        item: g,
        inStore: inStore < 0 ? 0 : inStore,
        inUse: g.inUse || 0,
        totalQuantity: g.totalQuantity || 0,
        broken: g.broken || 0,
        breakageRate: bRate,
        periodBroken: periodBroken,
        brokenLog: bLog
      };
    });
    setReportData(stats);
  }

  var th = function(extra) {
    return Object.assign({
      padding: "5px 8px", fontSize: 11, fontWeight: 700,
      background: "#f0fdf4", borderBottom: "2px solid " + C.border,
      borderRight: "1px solid " + C.border, whiteSpace: "nowrap", textAlign: "center"
    }, extra || {});
  };
  var td = function(extra) {
    return Object.assign({
      padding: "4px 8px", fontSize: 12,
      borderBottom: "1px solid " + C.border,
      borderRight: "1px solid " + C.border, textAlign: "center"
    }, extra || {});
  };
  var tdL = function(extra) { return td(Object.assign({ textAlign: "left" }, extra)); };

  var exportRows = [];

  async function generateAndPrint() {
    var htmlStr = "";
    var tableStyle = "width:100%; border-collapse:collapse; border:1px solid #111; margin-bottom: 14px;";
    var thStyle = "padding:5px 8px; font-size:11px; font-weight:bold; background:#f0fdf4; border:1px solid #111; text-align:center;";
    var tdStyle = "padding:4px 8px; font-size:12px; border:1px solid #111; text-align:center;";
    var tdLeft = tdStyle + "text-align:left;";

    // Table 1: Inventory Summary Table
    htmlStr += `<div style="font-size:12px; font-weight:bold; margin-bottom:6px;">1. Glassware Inventory Register & Distribution Summary:</div>`;
    htmlStr += `<table style="${tableStyle}"><thead><tr>
      <th style="${thStyle}">Glassware Item Name</th>
      <th style="${thStyle}">Date Received</th>
      <th style="${thStyle}">Origin / Make</th>
      <th style="${thStyle}">Received From</th>
      <th style="${thStyle}">Total Received</th>
      <th style="${thStyle}">In Store (Available)</th>
      <th style="${thStyle}">In Analysis Room</th>
      <th style="${thStyle}">Total Broken</th>
      <th style="${thStyle}">Breakage Rate (%)</th>
    </tr></thead><tbody>`;

    var sumTotal = 0, sumStore = 0, sumUse = 0, sumBroken = 0;
    displayGlass.forEach(function(g) {
      var st = (reportData && reportData[g.id]) || { inStore: 0, inUse: 0, totalQuantity: 0, broken: 0, breakageRate: 0, brokenLog: [] };
      sumTotal += st.totalQuantity;
      sumStore += st.inStore;
      sumUse += st.inUse;
      sumBroken += st.broken;
      htmlStr += `<tr>
        <td style="${tdLeft}font-weight:bold;">${g.name}</td>
        <td style="${tdStyle}">${g.dateReceived || "—"}</td>
        <td style="${tdStyle}">${g.origin || "—"}</td>
        <td style="${tdStyle}">${g.receivedFrom || "—"}</td>
        <td style="${tdStyle}">${st.totalQuantity}</td>
        <td style="${tdStyle}font-weight:600; color:#16a34a;">${st.inStore}</td>
        <td style="${tdStyle}font-weight:600; color:#1d4ed8;">${st.inUse}</td>
        <td style="${tdStyle}font-weight:600; color:${st.broken > 0 ? '#dc2626' : '#111'};">${st.broken}</td>
        <td style="${tdStyle}">${st.breakageRate}%</td>
      </tr>`;
    });
    htmlStr += `<tr style="background:#f0f9ff; font-weight:bold;">
      <td colspan="4" style="${tdLeft}">TOTAL GLASSWARE UNITS</td>
      <td style="${tdStyle}">${sumTotal}</td>
      <td style="${tdStyle}">${sumStore}</td>
      <td style="${tdStyle}">${sumUse}</td>
      <td style="${tdStyle}">${sumBroken}</td>
      <td style="${tdStyle}">${sumTotal > 0 ? ((sumBroken / sumTotal) * 100).toFixed(1) : 0}%</td>
    </tr></tbody></table>`;

    // Table 2: Breakage & Damage Log in Period
    htmlStr += `<div style="font-size:12px; font-weight:bold; margin:14px 0 6px;">2. Breakage, Damage & Movement Log in Selected Period:</div>`;
    var hasAnyBreakage = displayGlass.some(function(g) {
      var st = reportData && reportData[g.id];
      return st && st.brokenLog && st.brokenLog.length > 0;
    });

    if (!hasAnyBreakage) {
      htmlStr += `<div style="font-size:11px; font-style:italic; color:#64748b; margin-bottom:12px;">No breakage or damage events logged in the selected period.</div>`;
    } else {
      htmlStr += `<table style="${tableStyle}"><thead><tr>
        <th style="${thStyle}">Date</th>
        <th style="${thStyle}">Glassware Item</th>
        <th style="${thStyle}">Units Damaged</th>
        <th style="${thStyle}">Reported By</th>
        <th style="${thStyle}">Reason / Incident Note</th>
      </tr></thead><tbody>`;
      displayGlass.forEach(function(g) {
        var st = reportData && reportData[g.id];
        if (st && st.brokenLog) {
          st.brokenLog.forEach(function(b) {
            htmlStr += `<tr>
              <td style="${tdStyle}">${b.date || "—"}</td>
              <td style="${tdLeft}font-weight:bold;">${g.name}</td>
              <td style="${tdStyle}font-weight:bold; color:#dc2626;">${b.count || 1}</td>
              <td style="${tdStyle}">${b.by || "—"}</td>
              <td style="${tdLeft}">${b.note || "—"}</td>
            </tr>`;
          });
        }
      });
      htmlStr += `</tbody></table>`;
    }

    var html = buildGlasswareReportHtml({
      labIdentity: session || {},
      startDate: startDate,
      endDate: endDate,
      tableHtml: htmlStr,
      signatory: { designation: designation, line2: signLine2 }
    });

    var w = openReportPrintWindow();
    finishReportPrintWindow(w, html);
  }

  // ---- Render ----
  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement(SectionCard, {
      title: "Glassware Inventory & Usage Report",
      icon: /*#__PURE__*/React.createElement(Icon, { name: "beaker", size: 15 })
    },
      /*#__PURE__*/React.createElement("div", {
        className: "flex flex-wrap gap-3 mb-4 items-end no-print",
        style: { borderBottom: "1px solid " + C.border, paddingBottom: 12 }
      },
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "From",
          /*#__PURE__*/React.createElement("input", {
            type: "date", value: startDate,
            onChange: function(e) { setStartDate(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          })
        ),
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "To",
          /*#__PURE__*/React.createElement("input", {
            type: "date", value: endDate,
            onChange: function(e) { setEndDate(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          })
        ),
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "Glassware Item",
          /*#__PURE__*/React.createElement("select", {
            value: selectedGlassId,
            onChange: function(e) { setSelectedGlassId(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          },
            /*#__PURE__*/React.createElement("option", { value: "ALL" }, "All Glassware Items"),
            allGlass.map(function(g) {
              return /*#__PURE__*/React.createElement("option", { key: g.id, value: g.id }, g.name);
            })
          )
        ),
        /*#__PURE__*/React.createElement(Button, {
          size: "sm", variant: "primary",
          onClick: generateReportData
        }, /*#__PURE__*/React.createElement(Icon, { name: "chart", size: 12 }), " Generate Report")
      ),
      /*#__PURE__*/React.createElement("div", {
        className: "grid gap-2 mb-3 no-print",
        style: { gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }
      },
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Designation",
          value: designation,
          onChange: function(v) { setDesignation(v); }
        }),
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Address Line (optional)",
          value: signLine2,
          onChange: function(v) { setSignLine2(v); },
          placeholder: "e.g. Radha Ballob, Rangpur."
        })
      ),
      reportData && /*#__PURE__*/React.createElement("div", { className: "mb-4 no-print flex justify-end" },
        /*#__PURE__*/React.createElement(Button, {
          size: "sm", variant: "outline",
          onClick: generateAndPrint
        }, /*#__PURE__*/React.createElement(Icon, { name: "printer", size: 12 }), " Print / PDF (Official Format)")
      ),

      !reportData ? /*#__PURE__*/React.createElement("div", { className: "text-sm p-4", style: { color: C.muted } }, "Click 'Generate Report' to view glassware inventory balances, room distribution, and breakage records.") :
      displayGlass.length === 0
        ? /*#__PURE__*/React.createElement("div", { className: "text-sm p-4", style: { color: C.muted } }, "No glassware items found in inventory.")
        : (function() {
            var totItems = displayGlass.length;
            var totQty = displayGlass.reduce(function(s, g) { return s + (g.totalQuantity || 0); }, 0);
            var totStore = displayGlass.reduce(function(s, g) {
              var st = reportData[g.id];
              return s + (st ? st.inStore : 0);
            }, 0);
            var totUse = displayGlass.reduce(function(s, g) { return s + (g.inUse || 0); }, 0);
            var totBroken = displayGlass.reduce(function(s, g) { return s + (g.broken || 0); }, 0);
            var totPeriodBroken = displayGlass.reduce(function(s, g) {
              var st = reportData[g.id];
              return s + (st ? st.periodBroken : 0);
            }, 0);

            // Populate exportRows
            exportRows = [];
            displayGlass.forEach(function(g) {
              var st = reportData[g.id] || { inStore: 0, inUse: 0, totalQuantity: 0, broken: 0, breakageRate: 0, periodBroken: 0 };
              exportRows.push({
                "Glassware Name":     g.name,
                "Date Received":      g.dateReceived || "—",
                "Origin":             g.origin || "—",
                "Received From":      g.receivedFrom || "—",
                "Total Quantity":     st.totalQuantity,
                "In Store":           st.inStore,
                "In Analysis Room":   st.inUse,
                "Total Broken":       st.broken,
                "Breakage Rate (%)":  st.breakageRate + "%",
                "Broken in Period":   st.periodBroken
              });
            });

            return /*#__PURE__*/React.createElement("div", null,
              // Top KPI cards
              /*#__PURE__*/React.createElement("div", {
                className: "grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5"
              },
                /*#__PURE__*/React.createElement("div", { className: "p-2.5 rounded border text-center", style: { borderColor: C.border, background: "#f8fafc" } },
                  /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Item Categories"),
                  /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: C.ink } }, totItems)
                ),
                /*#__PURE__*/React.createElement("div", { className: "p-2.5 rounded border text-center", style: { borderColor: C.border, background: "#f8fafc" } },
                  /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Total Units"),
                  /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: C.teal } }, totQty)
                ),
                /*#__PURE__*/React.createElement("div", { className: "p-2.5 rounded border text-center", style: { borderColor: C.border, background: "#f8fafc" } },
                  /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "In Store (Reserve)"),
                  /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: "#16a34a" } }, totStore)
                ),
                /*#__PURE__*/React.createElement("div", { className: "p-2.5 rounded border text-center", style: { borderColor: C.border, background: "#f8fafc" } },
                  /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "In Analysis Room"),
                  /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: "#1d4ed8" } }, totUse)
                ),
                /*#__PURE__*/React.createElement("div", { className: "p-2.5 rounded border text-center", style: { borderColor: C.border, background: "#f8fafc" } },
                  /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Broken (All-time / Period)"),
                  /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: totBroken > 0 ? "#dc2626" : C.ink } }, `${totBroken} / ${totPeriodBroken}`)
                )
              ),

              // Table 1: Inventory & Distribution Table
              /*#__PURE__*/React.createElement("div", { className: "text-xs font-bold mb-2 flex items-center gap-1.5", style: { color: C.ink } },
                /*#__PURE__*/React.createElement(Icon, { name: "table", size: 13 }), " 1. Glassware Inventory Register & Distribution Summary"
              ),
              /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto", marginBottom: 20 } },
                /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", border: "1px solid " + C.border } },
                  /*#__PURE__*/React.createElement("thead", null,
                    /*#__PURE__*/React.createElement("tr", null,
                      ["Glassware Item", "Date Received", "Origin", "Received From", "Total Qty", "In Store", "In Analysis Room", "Broken", "Breakage %"].map(function(h) {
                        return /*#__PURE__*/React.createElement("th", { key: h, style: th() }, h);
                      })
                    )
                  ),
                  /*#__PURE__*/React.createElement("tbody", null,
                    displayGlass.map(function(g) {
                      var st = reportData[g.id] || { inStore: 0, inUse: 0, totalQuantity: 0, broken: 0, breakageRate: 0 };
                      return /*#__PURE__*/React.createElement("tr", { key: g.id },
                        /*#__PURE__*/React.createElement("td", { style: tdL({ fontWeight: 600 }) }, g.name),
                        /*#__PURE__*/React.createElement("td", { style: td() }, g.dateReceived || "—"),
                        /*#__PURE__*/React.createElement("td", { style: td() }, g.origin || "—"),
                        /*#__PURE__*/React.createElement("td", { style: td() }, g.receivedFrom || "—"),
                        /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 600 }) }, st.totalQuantity),
                        /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 600, color: "#16a34a" }) }, st.inStore),
                        /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 600, color: "#1d4ed8" }) }, st.inUse),
                        /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 600, color: st.broken > 0 ? "#dc2626" : C.ink }) }, st.broken),
                        /*#__PURE__*/React.createElement("td", { style: td() }, st.breakageRate + "%")
                      );
                    }),
                    /*#__PURE__*/React.createElement("tr", { style: { background: "#f0f9ff", fontWeight: 700 } },
                      /*#__PURE__*/React.createElement("td", { colSpan: 4, style: tdL({ borderTop: "2px solid " + C.border }) }, "TOTAL UNITS"),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, totQty),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: "#16a34a" }) }, totStore),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: "#1d4ed8" }) }, totUse),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: totBroken > 0 ? "#dc2626" : C.ink }) }, totBroken),
                      /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, totQty > 0 ? ((totBroken / totQty) * 100).toFixed(1) + "%" : "0%")
                    )
                  )
                )
              ),

              // Table 2: Breakage in Period
              /*#__PURE__*/React.createElement("div", { className: "text-xs font-bold mb-2 flex items-center gap-1.5", style: { color: C.ink } },
                /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 13 }), " 2. Breakage & Damage Log in Selected Period"
              ),
              (function() {
                var breakRows = [];
                displayGlass.forEach(function(g) {
                  var st = reportData[g.id];
                  if (st && st.brokenLog) {
                    st.brokenLog.forEach(function(b, idx) {
                      breakRows.push({
                        key: g.id + "_" + idx,
                        date: b.date || "—",
                        name: g.name,
                        count: b.count || 1,
                        by: b.by || "—",
                        note: b.note || "—"
                      });
                    });
                  }
                });

                if (breakRows.length === 0) {
                  return /*#__PURE__*/React.createElement("div", { className: "text-xs italic p-3 rounded", style: { background: "#f8fafc", color: C.muted } },
                    "No breakage or damage events logged for the selected glassware in this period."
                  );
                }

                return /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto" } },
                  /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", border: "1px solid " + C.border } },
                    /*#__PURE__*/React.createElement("thead", null,
                      /*#__PURE__*/React.createElement("tr", null,
                        ["Date", "Glassware Item", "Units Damaged", "Reported By", "Reason / Incident Note"].map(function(h) {
                          return /*#__PURE__*/React.createElement("th", { key: h, style: th() }, h);
                        })
                      )
                    ),
                    /*#__PURE__*/React.createElement("tbody", null,
                      breakRows.map(function(br) {
                        return /*#__PURE__*/React.createElement("tr", { key: br.key },
                          /*#__PURE__*/React.createElement("td", { style: td() }, br.date),
                          /*#__PURE__*/React.createElement("td", { style: tdL({ fontWeight: 600 }) }, br.name),
                          /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 700, color: "#dc2626" }) }, br.count),
                          /*#__PURE__*/React.createElement("td", { style: td() }, br.by),
                          /*#__PURE__*/React.createElement("td", { style: tdL() }, br.note)
                        );
                      }),
                      /*#__PURE__*/React.createElement("tr", { style: { background: "#f0f9ff", fontWeight: 700 } },
                        /*#__PURE__*/React.createElement("td", { colSpan: 2, style: tdL({ borderTop: "2px solid " + C.border }) }, "TOTAL UNITS DAMAGED IN PERIOD"),
                        /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: "#dc2626" }) },
                          breakRows.reduce(function(s, r) { return s + (Number(r.count) || 1); }, 0)
                        ),
                        /*#__PURE__*/React.createElement("td", { colSpan: 2, style: td({ borderTop: "2px solid " + C.border }) }, "—")
                      )
                    )
                  )
                );
              })()
            );
          })(),

      // XLSX export
      reportData && /*#__PURE__*/React.createElement("div", { className: "mt-5 no-print" },
        exportRows.length > 0
          ? /*#__PURE__*/React.createElement(DataTable, {
              exportFilename: "glassware_usage_report_" + startDate + "_to_" + endDate,
              columns: [
                { key: "Glassware Name",    label: "Glassware Name"    },
                { key: "Date Received",     label: "Date Received"     },
                { key: "Origin",            label: "Origin"            },
                { key: "Received From",     label: "Received From"     },
                { key: "Total Quantity",    label: "Total Quantity"    },
                { key: "In Store",          label: "In Store"          },
                { key: "In Analysis Room",  label: "In Analysis Room"  },
                { key: "Total Broken",      label: "Total Broken"      },
                { key: "Breakage Rate (%)", label: "Breakage Rate (%)" },
                { key: "Broken in Period",  label: "Broken in Period"  }
              ],
              rows: exportRows
            })
          : /*#__PURE__*/React.createElement("div", { className: "text-xs p-3", style: { color: C.muted } },
              "No glassware inventory data available."
            )
      )
    )
  );
}

// ==================================== GAS USAGE & CYLINDER EFFICIENCY REPORT ====================================
function GasUsageReportPage({ gasList, testRecords, session }) {
  var today = todayStr();
  var firstOfMonth = today.slice(0, 7) + "-01";
  var [startDate, setStartDate] = React.useState(firstOfMonth);
  var [endDate,   setEndDate]   = React.useState(today);
  var [designation, setDesignation] = React.useState("Senior Chemist");
  var [signLine2, setSignLine2] = React.useState("");
  var [selectedGasId, setSelectedGasId] = React.useState("ALL");
  var [reportData, setReportData] = React.useState(null);

  React.useEffect(function() {
    setReportData(null);
  }, [startDate, endDate, selectedGasId]);

  var allGases = (gasList || []).slice().sort(function(a, b) {
    return (a.name || "").localeCompare(b.name || "");
  });
  var displayGases = selectedGasId === "ALL"
    ? allGases
    : allGases.filter(function(g) { return g.id === selectedGasId; });

  function fmtNum(v) {
    var n = Number(v) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function generateReportData() {
    var stats = {}; // gasId -> { gas, cylindersStats: [ { cylinder, cycles: [], periodRuns: [], totalRefillCost: 0, totalGasUsedPeriod: 0, totalSamplesPeriod: 0, avgSamplesPerRefill: 0 } ] }

    (gasList || []).forEach(function(g) {
      stats[g.id] = {
        gas: g,
        cylindersStats: []
      };

      (g.cylinders || []).forEach(function(c) {
        var hist = (c.history || []).slice().sort(function(a, b) {
          return (a.date || "").localeCompare(b.date || "");
        });

        // 1. Build Refill Cycles
        var cycles = [];
        var cycleMarkers = [];
        hist.forEach(function(h, idx) {
          if (h.type === "new" || h.type === "refill") {
            cycleMarkers.push({ event: h, index: idx });
          }
        });

        if (cycleMarkers.length === 0) {
          cycleMarkers.push({
            event: {
              type: "new",
              date: c.dateReceived || "",
              amount: c.capacity || 0,
              cost: 0
            },
            index: 0
          });
        }

        cycleMarkers.forEach(function(cm, cIdx) {
          var startEvent = cm.event;
          var nextCm = cycleMarkers[cIdx + 1];
          var nextEvent = nextCm ? nextCm.event : null;

          // If next event is not a refill, see if there's an 'empty' event before next refill
          var emptyEvent = null;
          for (var i = cm.index + 1; i < (nextCm ? nextCm.index : hist.length); i++) {
            if (hist[i].type === "empty") { emptyEvent = hist[i]; break; }
          }

          var cycleStartDate = startEvent.date || c.dateReceived || "—";
          var cycleEndDate = nextEvent ? nextEvent.date : (emptyEvent ? emptyEvent.date : "Current (Active)");
          var isCycleClosed = !!nextEvent || !!emptyEvent;

          // Find test records that ran in this cycle interval
          var cycleField = 0, cycleStd = 0, cycleDil = 0, cycleTot = 0, cycleGasUsed = 0, cycleBatches = 0;
          (testRecords || []).forEach(function(tr) {
            var d = tr.date || "";
            if (d < cycleStartDate) return;
            if (nextEvent && d > nextEvent.date) return;
            if (emptyEvent && d > emptyEvent.date) return;

            var matchGu = (tr.gasesUsed || []).find(function(u) { return u.cylinderId === c.id || (!u.cylinderId && u.gasId === g.id); });
            var matchDgu = (tr.dilutionGasesUsed || []).find(function(u) { return u.cylinderId === c.id || (!u.cylinderId && u.gasId === g.id); });
            var matchGl = (tr.gasLog || []).find(function(u) { return u.cylinderId === c.id || (!u.cylinderId && u.gasId === g.id); });

            if (matchGu || matchDgu || matchGl) {
              cycleBatches++;
              var f = tr.numberOfFieldSamples || 0;
              var s = tr.numberOfStandardSamples || 0;
              var dil = tr.dilutionRequired ? (Number(tr.numberOfDilutedSamples) || 0) : 0;
              cycleField += f;
              cycleStd += s;
              cycleDil += dil;
              cycleTot += (f + s + dil);
              var usedAmt = (matchGu ? Number(matchGu.amount) || 0 : 0) + (matchDgu ? Number(matchDgu.amount) || 0 : 0) + (matchGl ? Number(matchGl.amount) || 0 : 0);
              cycleGasUsed += usedAmt;
            }
          });

          var initialAmt = Number(startEvent.amount) || c.capacity || 0;
          var cost = Number(startEvent.cost) || 0;

          cycles.push({
            cycleNo: cIdx + 1,
            type: startEvent.type === "new" ? "New Cylinder" : "Refill",
            startDate: cycleStartDate,
            endDate: cycleEndDate,
            amount: initialAmt,
            cost: cost,
            batches: cycleBatches,
            fieldSamples: cycleField,
            stdSamples: cycleStd,
            dilutedSamples: cycleDil,
            totalSamples: cycleTot,
            gasConsumed: cycleGasUsed,
            isClosed: isCycleClosed,
            status: isCycleClosed ? (emptyEvent ? "Marked Empty" : "Cycle Completed") : `In Progress (${c.remaining} ${g.unit} left)`
          });
        });

        // 2. Find Test Runs in Selected Period (startDate to endDate)
        var periodRuns = [];
        (testRecords || []).forEach(function(tr) {
          var d = tr.date || "";
          if (d < startDate || d > endDate) return;
          var matchGu = (tr.gasesUsed || []).find(function(u) { return u.cylinderId === c.id || (!u.cylinderId && u.gasId === g.id); });
          var matchDgu = (tr.dilutionGasesUsed || []).find(function(u) { return u.cylinderId === c.id || (!u.cylinderId && u.gasId === g.id); });
          var matchGl = (tr.gasLog || []).find(function(u) { return u.cylinderId === c.id || (!u.cylinderId && u.gasId === g.id); });

          if (matchGu || matchDgu || matchGl) {
            var f = tr.numberOfFieldSamples || 0;
            var s = tr.numberOfStandardSamples || 0;
            var dil = tr.dilutionRequired ? (Number(tr.numberOfDilutedSamples) || 0) : 0;
            var usedAmt = (matchGu ? Number(matchGu.amount) || 0 : 0) + (matchDgu ? Number(matchDgu.amount) || 0 : 0) + (matchGl ? Number(matchGl.amount) || 0 : 0);
            periodRuns.push({
              date: d,
              label: tr.subBatchLabel || "(individual)",
              testTypeName: tr.testTypeName || "",
              fieldSamples: f,
              stdSamples: s,
              dilutedSamples: dil,
              totalSamples: f + s + dil,
              gasUsed: usedAmt,
              tester: tr.tester || "—"
            });
          }
        });

        // Calculate averages for this cylinder
        var closedCycles = cycles.filter(function(cy) { return cy.isClosed; });
        var avgSamplesPerRefill = closedCycles.length > 0
          ? Math.round(closedCycles.reduce(function(s, cy) { return s + cy.totalSamples; }, 0) / closedCycles.length)
          : (cycles[0] ? cycles[0].totalSamples : 0);

        var totRefillCost = hist.reduce(function(s, h) {
          return s + (h.type === "refill" ? (Number(h.cost) || 0) : 0);
        }, 0);

        var totGasUsedPeriod = periodRuns.reduce(function(s, r) { return s + r.gasUsed; }, 0);
        var totSamplesPeriod = periodRuns.reduce(function(s, r) { return s + r.totalSamples; }, 0);

        stats[g.id].cylindersStats.push({
          cylinder: c,
          cycles: cycles,
          periodRuns: periodRuns,
          totalRefillCost: totRefillCost,
          avgSamplesPerRefill: avgSamplesPerRefill,
          totalGasUsedPeriod: totGasUsedPeriod,
          totalSamplesPeriod: totSamplesPeriod
        });
      });
    });

    setReportData(stats);
  }

  var th = function(extra) {
    return Object.assign({
      padding: "5px 8px", fontSize: 11, fontWeight: 700,
      background: "#f0fdf4", borderBottom: "2px solid " + C.border,
      borderRight: "1px solid " + C.border, whiteSpace: "nowrap", textAlign: "center"
    }, extra || {});
  };
  var td = function(extra) {
    return Object.assign({
      padding: "4px 8px", fontSize: 12,
      borderBottom: "1px solid " + C.border,
      borderRight: "1px solid " + C.border, textAlign: "center"
    }, extra || {});
  };
  var tdL = function(extra) { return td(Object.assign({ textAlign: "left" }, extra)); };

  var exportRows = [];

  async function generateAndPrint() {
    var htmlStr = "";
    var tableStyle = "width:100%; border-collapse:collapse; border:1px solid #111; margin-bottom: 14px;";
    var thStyle = "padding:5px 8px; font-size:11px; font-weight:bold; background:#f0fdf4; border:1px solid #111; text-align:center;";
    var tdStyle = "padding:4px 8px; font-size:12px; border:1px solid #111; text-align:center;";
    var tdLeft = tdStyle + "text-align:left;";

    displayGases.forEach(function(g) {
      var gStat = (reportData && reportData[g.id]) || { cylindersStats: [] };

      htmlStr += `<div style="margin-bottom:28px; page-break-inside:avoid;">`;
      htmlStr += `<h2 style="font-size:16px; margin:0 0 10px; border-bottom:2px solid #0d9488; padding-bottom:4px;">Gas Type: ${g.name} (Unit: ${g.unit || "kg"})</h2>`;

      gStat.cylindersStats.forEach(function(cs) {
        var c = cs.cylinder;
        htmlStr += `<div style="background:#f8fafc; border:1px solid #cbd5e1; padding:8px 12px; margin-bottom:8px; border-left:4px solid #0d9488;">
          <div style="font-size:13px; font-weight:bold; color:#0f172a;">${c.name || g.name} <span style="font-size:11px; font-weight:normal; color:#475569;">[Status: ${(c.status||"active").toUpperCase()}]</span></div>
          <div style="font-size:11px; color:#475569; margin-top:2px;">
            <span>Received: <strong>${c.dateReceived || "—"}</strong></span> | 
            <span>Capacity: <strong>${fmtNum(c.capacity)} ${g.unit}</strong></span> | 
            <span>Current Remaining: <strong>${fmtNum(c.remaining)} ${g.unit} (${c.capacity > 0 ? ((c.remaining/c.capacity)*100).toFixed(1) : 0}%)</strong></span> | 
            <span>Avg Yield: <strong>${cs.avgSamplesPerRefill > 0 ? cs.avgSamplesPerRefill + " Samples / Refill" : "—"}</strong></span>
          </div>
        </div>`;

        // Cycle Table
        htmlStr += `<div style="font-size:11px; font-weight:bold; margin:6px 0 4px;">1. Cylinder Refill Cycles & Sample Yield Efficiency:</div>`;
        if (cs.cycles.length === 0) {
          htmlStr += `<div style="font-size:11px; font-style:italic; color:#64748b; margin-bottom:10px;">No refill cycles logged for this cylinder.</div>`;
        } else {
          htmlStr += `<table style="${tableStyle}"><thead><tr>
            <th style="${thStyle}">Cycle #</th>
            <th style="${thStyle}">Start Date (Refill)</th>
            <th style="${thStyle}">End Date</th>
            <th style="${thStyle}">Capacity / Refilled</th>
            <th style="${thStyle}">Refill Cost (BDT)</th>
            <th style="${thStyle}">Total Batches</th>
            <th style="${thStyle}">Total Samples Tested</th>
            <th style="${thStyle}">Samples / Full Refill</th>
            <th style="${thStyle}">Cycle Status</th>
          </tr></thead><tbody>`;
          cs.cycles.forEach(function(cy) {
            htmlStr += `<tr>
              <td style="${tdStyle}">Cycle ${cy.cycleNo}</td>
              <td style="${tdStyle}">${cy.startDate}</td>
              <td style="${tdStyle}">${cy.endDate}</td>
              <td style="${tdStyle}">${fmtNum(cy.amount)} ${g.unit}</td>
              <td style="${tdStyle}">${cy.cost ? fmtNum(cy.cost) : "0.00"}</td>
              <td style="${tdStyle}">${cy.batches}</td>
              <td style="${tdStyle}font-weight:bold;">${cy.totalSamples}</td>
              <td style="${tdStyle}font-weight:bold; color:#1d4ed8;">${cy.totalSamples > 0 ? cy.totalSamples + " Samples" : "—"}</td>
              <td style="${tdStyle}">${cy.status}</td>
            </tr>`;
          });
          htmlStr += `</tbody></table>`;
        }

        // Test Activity in Period
        htmlStr += `<div style="font-size:11px; font-weight:bold; margin:6px 0 4px;">2. Analytical Tests consuming this Cylinder in Period:</div>`;
        if (cs.periodRuns.length === 0) {
          htmlStr += `<div style="font-size:11px; font-style:italic; color:#64748b; margin-bottom:14px;">No test runs logged for this cylinder in the selected period.</div>`;
        } else {
          htmlStr += `<table style="${tableStyle}"><thead><tr>
            <th style="${thStyle}">Date</th><th style="${thStyle}">Sub-Batch</th><th style="${thStyle}">Test Type / Parameter</th>
            <th style="${thStyle}">Field Samples</th><th style="${thStyle}">Std. Samples</th><th style="${thStyle}">Diluted Samples</th>
            <th style="${thStyle}">Total Samples</th><th style="${thStyle}">Gas Used</th><th style="${thStyle}">Tester</th>
          </tr></thead><tbody>`;
          var sumF = 0, sumS = 0, sumD = 0, sumTot = 0, sumG = 0;
          cs.periodRuns.forEach(function(r) {
            sumF += r.fieldSamples;
            sumS += r.stdSamples;
            sumD += r.dilutedSamples;
            sumTot += r.totalSamples;
            sumG += r.gasUsed;
            htmlStr += `<tr>
              <td style="${tdStyle}">${r.date}</td>
              <td style="${tdLeft}font-family:monospace;">${r.label}</td>
              <td style="${tdLeft}">${r.testTypeName}</td>
              <td style="${tdStyle}">${r.fieldSamples}</td>
              <td style="${tdStyle}">${r.stdSamples}</td>
              <td style="${tdStyle}">${r.dilutedSamples}</td>
              <td style="${tdStyle}font-weight:bold;">${r.totalSamples}</td>
              <td style="${tdStyle}font-weight:bold; color:#1d4ed8;">${fmtNum(r.gasUsed)} ${g.unit}</td>
              <td style="${tdStyle}">${r.tester}</td>
            </tr>`;
          });
          htmlStr += `<tr style="background:#f0f9ff; font-weight:bold;">
            <td colspan="3" style="${tdLeft}">TOTAL (PERIOD)</td>
            <td style="${tdStyle}">${sumF}</td>
            <td style="${tdStyle}">${sumS}</td>
            <td style="${tdStyle}">${sumD}</td>
            <td style="${tdStyle}">${sumTot}</td>
            <td style="${tdStyle}">${fmtNum(sumG)} ${g.unit}</td>
            <td style="${tdStyle}">—</td>
          </tr></tbody></table>`;
        }
      });

      htmlStr += `</div>`;
    });

    var html = buildGasReportHtml({
      labIdentity: session || {},
      startDate: startDate,
      endDate: endDate,
      tableHtml: htmlStr,
      signatory: { designation: designation, line2: signLine2 }
    });

    var w = openReportPrintWindow();
    finishReportPrintWindow(w, html);
  }

  // ---- Render ----
  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement(SectionCard, {
      title: "Gas Usage & Cylinder Efficiency Report",
      icon: /*#__PURE__*/React.createElement(Icon, { name: "droplet", size: 15 })
    },
      /*#__PURE__*/React.createElement("div", {
        className: "flex flex-wrap gap-3 mb-4 items-end no-print",
        style: { borderBottom: "1px solid " + C.border, paddingBottom: 12 }
      },
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "From",
          /*#__PURE__*/React.createElement("input", {
            type: "date", value: startDate,
            onChange: function(e) { setStartDate(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          })
        ),
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "To",
          /*#__PURE__*/React.createElement("input", {
            type: "date", value: endDate,
            onChange: function(e) { setEndDate(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          })
        ),
        /*#__PURE__*/React.createElement("label", { className: "flex flex-col gap-1 text-xs", style: { color: C.muted } },
          "Gas Type",
          /*#__PURE__*/React.createElement("select", {
            value: selectedGasId,
            onChange: function(e) { setSelectedGasId(e.target.value); },
            className: "border rounded px-2 py-1 text-sm", style: { borderColor: C.border }
          },
            /*#__PURE__*/React.createElement("option", { value: "ALL" }, "All Gas Types"),
            allGases.map(function(g) {
              return /*#__PURE__*/React.createElement("option", { key: g.id, value: g.id }, g.name);
            })
          )
        ),
        /*#__PURE__*/React.createElement(Button, {
          size: "sm", variant: "primary",
          onClick: generateReportData
        }, /*#__PURE__*/React.createElement(Icon, { name: "chart", size: 12 }), " Generate Report")
      ),
      /*#__PURE__*/React.createElement("div", {
        className: "grid gap-2 mb-3 no-print",
        style: { gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }
      },
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Designation",
          value: designation,
          onChange: function(v) { setDesignation(v); }
        }),
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Address Line (optional)",
          value: signLine2,
          onChange: function(v) { setSignLine2(v); },
          placeholder: "e.g. Radha Ballob, Rangpur."
        })
      ),
      reportData && /*#__PURE__*/React.createElement("div", { className: "mb-4 no-print flex justify-end" },
        /*#__PURE__*/React.createElement(Button, {
          size: "sm", variant: "outline",
          onClick: generateAndPrint
        }, /*#__PURE__*/React.createElement(Icon, { name: "printer", size: 12 }), " Print / PDF (Official Format)")
      ),

      !reportData ? /*#__PURE__*/React.createElement("div", { className: "text-sm p-4", style: { color: C.muted } }, "Click 'Generate Report' to view gas consumption, cylinder refill cycles, and sample yield per refill.") :
      displayGases.length === 0
        ? /*#__PURE__*/React.createElement("div", { className: "text-sm p-4", style: { color: C.muted } }, "No gas types registered in inventory.")
        : (function() {
            exportRows = [];
            return displayGases.map(function(g) {
              var gStat = reportData[g.id] || { cylindersStats: [] };

              return /*#__PURE__*/React.createElement("div", {
                key: g.id,
                className: "mb-6 p-4 rounded-lg border",
                style: { borderColor: C.border, background: "#fff" }
              },
                /*#__PURE__*/React.createElement("div", {
                  className: "flex items-center justify-between gap-2 mb-3 pb-2",
                  style: { borderBottom: "2px solid " + C.teal }
                },
                  /*#__PURE__*/React.createElement("div", { className: "flex items-center gap-2" },
                    /*#__PURE__*/React.createElement(Icon, { name: "droplet", size: 18, color: C.teal }),
                    /*#__PURE__*/React.createElement("span", { className: "font-bold text-base", style: { color: C.ink } }, g.name),
                    /*#__PURE__*/React.createElement("span", { className: "text-xs font-normal", style: { color: C.muted } }, `(Unit: ${g.unit || "kg"})`)
                  ),
                  /*#__PURE__*/React.createElement("div", { className: "text-xs font-semibold", style: { color: C.muted } },
                    `${(g.cylinders || []).length} Cylinder(s) in Inventory`
                  )
                ),

                gStat.cylindersStats.map(function(cs) {
                  var c = cs.cylinder;
                  var low = c.status === "active" && c.capacity > 0 && (c.remaining / c.capacity) < 0.15;

                  // Populate export rows
                  cs.cycles.forEach(function(cy) {
                    exportRows.push({
                      "Gas":                    g.name,
                      "Unit":                   g.unit || "kg",
                      "Cylinder":               c.name || g.name,
                      "Cylinder Capacity":      c.capacity,
                      "Current Remaining":      c.remaining,
                      "Cycle #":                cy.cycleNo,
                      "Cycle Type":             cy.type,
                      "Cycle Start Date":       cy.startDate,
                      "Cycle End Date":         cy.endDate,
                      "Refill Cost (BDT)":      cy.cost,
                      "Batches in Cycle":       cy.batches,
                      "Field Samples Tested":   cy.fieldSamples,
                      "Std. Samples Tested":    cy.stdSamples,
                      "Diluted Samples Tested": cy.dilutedSamples,
                      "Total Samples Tested":   cy.totalSamples,
                      "Cycle Status":           cy.status,
                      "Avg Samples / Refill":   cs.avgSamplesPerRefill
                    });
                  });

                  return /*#__PURE__*/React.createElement("div", {
                    key: c.id,
                    className: "mb-5 p-3 rounded border",
                    style: { borderColor: C.border, background: "#f8fafc" }
                  },
                    // Cylinder Header & KPIs
                    /*#__PURE__*/React.createElement("div", {
                      className: "flex flex-wrap items-center justify-between gap-2 mb-3 pb-2",
                      style: { borderBottom: "1px solid " + C.border }
                    },
                      /*#__PURE__*/React.createElement("div", { className: "flex items-center gap-2" },
                        /*#__PURE__*/React.createElement("span", { className: "font-bold text-sm", style: { color: C.ink } }, c.name || g.name),
                        /*#__PURE__*/React.createElement(Badge, { tone: c.status === "active" ? (low ? "warn" : "ok") : "muted" },
                          c.status === "active" ? (low ? "Low Stock" : "Active") : "Empty"
                        )
                      ),
                      /*#__PURE__*/React.createElement("div", { className: "flex flex-wrap gap-x-4 gap-y-1 text-xs", style: { color: C.muted } },
                        /*#__PURE__*/React.createElement("span", null, "Received: ", /*#__PURE__*/React.createElement("strong", { style: { color: C.ink } }, c.dateReceived || "—")),
                        /*#__PURE__*/React.createElement("span", null, "Capacity: ", /*#__PURE__*/React.createElement("strong", { style: { color: C.ink } }, `${fmtNum(c.capacity)} ${g.unit}`)),
                        /*#__PURE__*/React.createElement("span", null, "Remaining: ", /*#__PURE__*/React.createElement("strong", { style: { color: low ? "#dc2626" : "#16a34a" } }, `${fmtNum(c.remaining)} ${g.unit} (${c.capacity > 0 ? ((c.remaining/c.capacity)*100).toFixed(1) : 0}%)`))
                      )
                    ),

                    // Key Metric Badge Row: Samples per Refill
                    /*#__PURE__*/React.createElement("div", {
                      className: "grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3"
                    },
                      /*#__PURE__*/React.createElement("div", { className: "p-2 rounded bg-white border text-center", style: { borderColor: C.border } },
                        /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Refill Cycles"),
                        /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: C.ink } }, cs.cycles.length)
                      ),
                      /*#__PURE__*/React.createElement("div", { className: "p-2 rounded bg-white border text-center", style: { borderColor: C.border } },
                        /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Avg Samples / Full Refill"),
                        /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: "#1d4ed8" } },
                          cs.avgSamplesPerRefill > 0 ? `${cs.avgSamplesPerRefill} Samples` : "—"
                        )
                      ),
                      /*#__PURE__*/React.createElement("div", { className: "p-2 rounded bg-white border text-center", style: { borderColor: C.border } },
                        /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Period Gas Consumed"),
                        /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: C.teal } }, `${fmtNum(cs.totalGasUsedPeriod)} ${g.unit}`)
                      ),
                      /*#__PURE__*/React.createElement("div", { className: "p-2 rounded bg-white border text-center", style: { borderColor: C.border } },
                        /*#__PURE__*/React.createElement("div", { className: "text-xs", style: { color: C.muted } }, "Period Samples Tested"),
                        /*#__PURE__*/React.createElement("div", { className: "text-base font-bold", style: { color: "#16a34a" } }, cs.totalSamplesPeriod)
                      )
                    ),

                    // Table 1: Refill Cycles & Efficiency
                    /*#__PURE__*/React.createElement("div", { className: "text-xs font-bold mb-1.5 flex items-center gap-1.5", style: { color: C.ink } },
                      /*#__PURE__*/React.createElement(Icon, { name: "chart", size: 13 }), " 1. Refill Cycles & Sample Yield per Full Cylinder"
                    ),
                    cs.cycles.length === 0
                      ? /*#__PURE__*/React.createElement("div", { className: "text-xs italic p-2 rounded mb-3 bg-white", style: { color: C.muted } }, "No refill cycles recorded.")
                      : /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto", marginBottom: 14 } },
                          /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", border: "1px solid " + C.border, background: "#fff" } },
                            /*#__PURE__*/React.createElement("thead", null,
                              /*#__PURE__*/React.createElement("tr", null,
                                ["Cycle #", "Start Date", "End Date", "Capacity / Refill", "Refill Cost", "Batches", "Total Samples Tested", "Samples / Full Refill", "Cycle Status"].map(function(h) {
                                  return /*#__PURE__*/React.createElement("th", { key: h, style: th() }, h);
                                })
                              )
                            ),
                            /*#__PURE__*/React.createElement("tbody", null,
                              cs.cycles.map(function(cy) {
                                return /*#__PURE__*/React.createElement("tr", { key: cy.cycleNo },
                                  /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 600 }) }, `Cycle ${cy.cycleNo}`),
                                  /*#__PURE__*/React.createElement("td", { style: td() }, cy.startDate),
                                  /*#__PURE__*/React.createElement("td", { style: td() }, cy.endDate),
                                  /*#__PURE__*/React.createElement("td", { style: td() }, `${fmtNum(cy.amount)} ${g.unit}`),
                                  /*#__PURE__*/React.createElement("td", { style: td() }, cy.cost ? `${fmtNum(cy.cost)} BDT` : "0.00"),
                                  /*#__PURE__*/React.createElement("td", { style: td() }, cy.batches),
                                  /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 600 }) }, cy.totalSamples),
                                  /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 700, color: "#1d4ed8" }) },
                                    cy.totalSamples > 0 ? `${cy.totalSamples} Samples` : "—"
                                  ),
                                  /*#__PURE__*/React.createElement("td", { style: td() },
                                    /*#__PURE__*/React.createElement(Badge, { tone: cy.isClosed ? "muted" : "ok" }, cy.status)
                                  )
                                );
                              })
                            )
                          )
                        ),

                    // Table 2: Analytical Tests in Period
                    /*#__PURE__*/React.createElement("div", { className: "text-xs font-bold mb-1.5 flex items-center gap-1.5", style: { color: C.ink } },
                      /*#__PURE__*/React.createElement(Icon, { name: "clipboard", size: 13 }), " 2. Analytical Tests Consuming this Cylinder in Selected Period"
                    ),
                    cs.periodRuns.length === 0
                      ? /*#__PURE__*/React.createElement("div", { className: "text-xs italic p-2 rounded bg-white", style: { color: C.muted } }, "No test runs logged for this cylinder in the selected period.")
                      : /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto" } },
                          /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", border: "1px solid " + C.border, background: "#fff" } },
                            /*#__PURE__*/React.createElement("thead", null,
                              /*#__PURE__*/React.createElement("tr", null,
                                ["Date", "Sub-Batch", "Test Type / Parameter", "Field Samples", "Std. Samples", "Diluted Samples", "Total Samples", "Gas Consumed", "Tester"].map(function(h) {
                                  return /*#__PURE__*/React.createElement("th", { key: h, style: th() }, h);
                                })
                              )
                            ),
                            /*#__PURE__*/React.createElement("tbody", null,
                              cs.periodRuns.map(function(r, idx) {
                                return /*#__PURE__*/React.createElement("tr", { key: idx },
                                  /*#__PURE__*/React.createElement("td", { style: td() }, r.date),
                                  /*#__PURE__*/React.createElement("td", { style: tdL({ fontFamily: "monospace", fontSize: 11 }) }, r.label),
                                  /*#__PURE__*/React.createElement("td", { style: tdL() }, r.testTypeName),
                                  /*#__PURE__*/React.createElement("td", { style: td() }, r.fieldSamples),
                                  /*#__PURE__*/React.createElement("td", { style: td() }, r.stdSamples),
                                  /*#__PURE__*/React.createElement("td", { style: td() }, r.dilutedSamples),
                                  /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 600 }) }, r.totalSamples),
                                  /*#__PURE__*/React.createElement("td", { style: td({ fontWeight: 700, color: "#1d4ed8" }) }, `${fmtNum(r.gasUsed)} ${g.unit}`),
                                  /*#__PURE__*/React.createElement("td", { style: td() }, r.tester)
                                );
                              }),
                              /*#__PURE__*/React.createElement("tr", { style: { background: "#f0f9ff", fontWeight: 700 } },
                                /*#__PURE__*/React.createElement("td", { colSpan: 3, style: tdL({ borderTop: "2px solid " + C.border }) }, "TOTAL (PERIOD)"),
                                /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) },
                                  cs.periodRuns.reduce(function(s, r) { return s + r.fieldSamples; }, 0)
                                ),
                                /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) },
                                  cs.periodRuns.reduce(function(s, r) { return s + r.stdSamples; }, 0)
                                ),
                                /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) },
                                  cs.periodRuns.reduce(function(s, r) { return s + r.dilutedSamples; }, 0)
                                ),
                                /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, cs.totalSamplesPeriod),
                                /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border, color: "#1d4ed8" }) }, `${fmtNum(cs.totalGasUsedPeriod)} ${g.unit}`),
                                /*#__PURE__*/React.createElement("td", { style: td({ borderTop: "2px solid " + C.border }) }, "—")
                              )
                            )
                          )
                        )
                  );
                })
              );
            });
          })(),

      // XLSX Export
      reportData && /*#__PURE__*/React.createElement("div", { className: "mt-5 no-print" },
        exportRows.length > 0
          ? /*#__PURE__*/React.createElement(DataTable, {
              exportFilename: "gas_usage_report_" + startDate + "_to_" + endDate,
              columns: [
                { key: "Gas",                     label: "Gas"                     },
                { key: "Unit",                    label: "Unit"                    },
                { key: "Cylinder",                label: "Cylinder"                },
                { key: "Cylinder Capacity",       label: "Cylinder Capacity"       },
                { key: "Current Remaining",       label: "Current Remaining"       },
                { key: "Cycle #",                 label: "Cycle #"                 },
                { key: "Cycle Type",              label: "Cycle Type"              },
                { key: "Cycle Start Date",        label: "Cycle Start Date"        },
                { key: "Cycle End Date",          label: "Cycle End Date"          },
                { key: "Refill Cost (BDT)",       label: "Refill Cost (BDT)"       },
                { key: "Batches in Cycle",        label: "Batches in Cycle"        },
                { key: "Field Samples Tested",    label: "Field Samples Tested"    },
                { key: "Std. Samples Tested",     label: "Std. Samples Tested"     },
                { key: "Diluted Samples Tested",  label: "Diluted Samples Tested"  },
                { key: "Total Samples Tested",    label: "Total Samples Tested"    },
                { key: "Cycle Status",            label: "Cycle Status"            },
                { key: "Avg Samples / Refill",    label: "Avg Samples / Refill"    }
              ],
              rows: exportRows
            })
          : /*#__PURE__*/React.createElement("div", { className: "text-xs p-3", style: { color: C.muted } },
              "No gas inventory data available."
            )
      )
    )
  );
}

// ==================================== FORECAST REPORTS ====================================
// Monthly Progress Report of Water Quality Test — matches the official DPHE
// Zonal Lab paper format exactly (letterhead, one Exceed/Non-Exceed row-pair
// per Client Type, broken down by As/Fe/Cl/Others, "During this month" vs
// cumulative "From July/<FY start>"). The heavy lifting (aggregation +
// printable HTML) lives in computeMonthlyProgressStats() /
// buildMonthlyProgressReportHtml() (17-report-generator.js) — this
// component is just the Month picker, on-screen preview (built from the
// exact same table-HTML builder the print popup uses, via
// dangerouslySetInnerHTML, so preview and printout can never drift apart),
// and the "Generate & Print Report" button that opens it the same way every
// other official report in this app opens (18-archive-ui.js pattern).
function MonthlyProgressReportPage({
  samples,
  references,
  testRecords,
  testTypes,
  parameters,
  notify
}) {
  // Lazy-load archived records so purged/archived samples still count
  // toward the cumulative totals.
  var [archived, setArchived] = React.useState([]);
  React.useEffect(function() {
    DataService.list("archived_records").then(function(rows) {
      setArchived(rows || []);
    }).catch(function() {});
  }, []);

  // Cumulative baseline: from FY 2025-26 onward (July 2025+)
  var BASELINE_FY_START_YEAR = 2025;
  var currentMonthKey = mprMonthKey(todayStr());
  var monthOptions = React.useMemo(function() {
    return mprMonthOptions(BASELINE_FY_START_YEAR, currentMonthKey);
  }, [currentMonthKey]);
  var [selectedMonth, setSelectedMonth] = React.useState(currentMonthKey);

  var [designation, setDesignation] = React.useState("Senior Chemist");
  var [signLine2, setSignLine2] = React.useState("");
  var [generating, setGenerating] = React.useState(false);

  var stats = React.useMemo(function() {
    return computeMonthlyProgressStats({
      samples: samples,
      references: references,
      testRecords: testRecords,
      testTypes: testTypes,
      parameters: parameters,
      archived: archived,
      selectedMonth: selectedMonth
    });
  }, [samples, references, testRecords, testTypes, parameters, archived, selectedMonth]);

  var tableHtml = React.useMemo(function() {
    return buildMonthlyProgressReportTableHtml(stats);
  }, [stats]);

  async function generateAndPrint() {
    if (generating) return;
    setGenerating(true);
    try {
      // Opened synchronously (before the await below) so browsers don't
      // treat it as an unrequested popup — same two-step dance
      // 17-report-generator.js/18-archive-ui.js already use.
      var w = openReportPrintWindow();
      var labIdentity = await resolveLabIdentityLogos(getLabIdentity());
      var html = buildMonthlyProgressReportHtml({
        labIdentity: labIdentity,
        stats: stats,
        signatory: { designation: designation, line1: labIdentity.labName || "", line2: signLine2 }
      });
      finishReportPrintWindow(w, html);
    } catch (e) {
      notify && notify("Could not generate the report: " + (e && e.message ? e.message : e), "error");
    } finally {
      setGenerating(false);
    }
  }

  var exportRows = stats.rows.map(function(row) {
    var r = {};
    r["Client Type"] = row.clientType;
    r["Samples — During " + stats.monthLabel] = row.duringMonth.samples;
    r["Samples — " + stats.fyStartLabel] = row.cumulative.samples;
    MPR_CATEGORIES.forEach(function(cat) {
      r[cat + " Exceed — During Month"] = row.duringMonth.byCat[cat].exceed;
      r[cat + " Non-Exceed — During Month"] = row.duringMonth.byCat[cat].nonExceed;
    });
    r["Total Parameters — During " + stats.monthLabel] = row.duringMonth.total;
    r["Total Parameters — " + stats.fyStartLabel] = row.cumulative.total;
    r["Revenue (TK.) — During Month"] = row.duringMonth.revenue;
    r["Revenue (TK.) — " + stats.fyStartLabel] = row.cumulative.revenue;
    return r;
  });

  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement(SectionCard, {
      title: "Monthly Progress Report of Water Quality Test",
      icon: /*#__PURE__*/React.createElement(Icon, { name: "chart", size: 15 }),
      right: /*#__PURE__*/React.createElement("div", { className: "flex items-center gap-2 no-print flex-wrap" },
        /*#__PURE__*/React.createElement("label", { className: "text-xs", style: { color: C.muted } }, "Month:"),
        /*#__PURE__*/React.createElement("select", {
          className: "border rounded px-2 py-1 text-xs",
          style: { borderColor: C.border },
          value: selectedMonth,
          onChange: function(e) { setSelectedMonth(e.target.value); }
        }, monthOptions.map(function(mk) {
          return /*#__PURE__*/React.createElement("option", { key: mk, value: mk }, mprMonthLabel(mk));
        })),
        /*#__PURE__*/React.createElement(Button, {
          size: "sm",
          onClick: generateAndPrint,
          disabled: generating
        }, /*#__PURE__*/React.createElement(Icon, { name: "printer", size: 13 }), generating ? "Preparing…" : "Generate & Print Report")
      )
    },
      /*#__PURE__*/React.createElement("div", { className: "text-xs mb-3 p-2 rounded no-print", style: { background: C.infoBg, color: C.info } },
        "\"During this month\" shows data for ", /*#__PURE__*/React.createElement("strong", null, stats.monthLabel), ". \"", stats.fyStartLabel, "\" is cumulative since the start of FY ", stats.fiscalYear, " through the end of the selected month. Every released, valued parameter counts toward the Total; it's judged Exceed vs Non-Exceed against that Parameter's Reference Limit Min/Max (Test Configuration \u203a Parameters \u203a Limits) when configured, and counted as Non-Exceed by default when no limit is set (nothing to have exceeded). Only results with nothing entered yet are excluded."
      ),
      /*#__PURE__*/React.createElement("div", {
        className: "grid gap-2 mb-3 no-print",
        style: { gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }
      },
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Designation",
          value: designation,
          onChange: function(v) { setDesignation(v); }
        }),
        /*#__PURE__*/React.createElement(TextField, {
          simple: true,
          label: "Signatory Address Line (optional)",
          value: signLine2,
          onChange: function(v) { setSignLine2(v); },
          placeholder: "e.g. Radha Ballob, Rangpur."
        })
      ),
      /*#__PURE__*/React.createElement("div", {
        style: { overflowX: "auto" },
        dangerouslySetInnerHTML: { __html: tableHtml }
      })
    ),
    /*#__PURE__*/React.createElement("div", { className: "mt-4 no-print" },
      /*#__PURE__*/React.createElement(DataTable, {
        exportFilename: "monthly_progress_report_" + selectedMonth,
        columns: Object.keys(exportRows[0] || { "Client Type": "" }).map(function(k) { return { key: k, label: k }; }),
        rows: exportRows,
        noDataText: "No data to export."
      })
    )
  );
}
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
  group: "Report & Analytics",
  pages: [{
    k: "executive",
    label: "Executive Dashboard",
    icon: "home"
  }, {
    k: "insights",
    label: "Smart Insights",
    icon: "warning"
  }, {
    k: "testAnalytics",
    label: "Test Analytics",
    icon: "clipboard"
  }, {
    k: "technician",
    label: "Sample Analyzer Performance",
    icon: "user"
  }, {
    k: "revenue",
    label: "Revenue Analytics",
    icon: "coins"
  }, {
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
  }, {
    k: "equipmentAnalytics",
    label: "Equipment Analytics",
    icon: "wrench"
  }, {
    k: "maintenanceAnalytics",
    label: "Maintenance Analytics",
    icon: "wrench"
  }, {
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
  group: "Custom Report",
  pages: [{
    k: "customReport",
    label: "Multiple Sample Report",
    icon: "printer"
  }, {
    k: "customReportSingle",
    label: "Single Sample Report",
    icon: "printer"
  }, {
    k: "monthlyProgressReport",
    label: "Monthly Progress Report",
    icon: "chart"
  }, {
    k: "chemicalUsageReport",
    label: "Chemical Usage Report",
    icon: "flask"
  }, {
    k: "equipmentUsageReport",
    label: "Equipment Usage Report",
    icon: "wrench"
  }, {
    k: "glasswareUsageReport",
    label: "Glassware Usage Report",
    icon: "beaker"
  }, {
    k: "gasUsageReport",
    label: "Gas Usage Report",
    icon: "droplet"
  }]
}];
const ALL_REPORT_PAGES = REPORT_GROUPS.flatMap(g => g.pages);

// ---------------- Report navigation: one dropdown per group (Overview / Operations / Inventory / Equipment / Trends & Forecast) ----------------
// Top-level group pills — same rounded-full pill style as the Inventory
// tab's Equipment/Glassware/Chemicals/Gas nav (see InventoryTab in
// 11-inventory-ui.js), applied here instead of a dropdown-per-group menu.
function ReportGroupPills({
  activeGroup,
  onSelectGroup
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-3 flex-wrap"
  }, REPORT_GROUPS.map(grp => /*#__PURE__*/React.createElement("button", {
    key: grp.group,
    type: "button",
    onClick: () => onSelectGroup(grp),
    className: "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium",
    style: {
      background: activeGroup === grp.group ? C.teal : "#fff",
      color: activeGroup === grp.group ? "#fff" : C.muted,
      border: `1px solid ${activeGroup === grp.group ? C.teal : C.border}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: grp.group === "Custom Report" ? "printer" : "chart",
    size: 14
  }), grp.group)));
}
// Second-level page pills — used for Custom Report (only 3 pages, fits
// the same pill style cleanly). Report & Analytics has 15 pages, which
// doesn't fit a pill row — ReportPagePicker below handles that one with a
// compact dropdown instead.
function ReportPagePills({
  pages,
  activePage,
  setReportTab
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-4 flex-wrap"
  }, pages.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.k,
    type: "button",
    onClick: () => setReportTab(p.k),
    className: "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium",
    style: {
      background: activePage === p.k ? C.teal : "#fff",
      color: activePage === p.k ? "#fff" : C.muted,
      border: `1px solid ${activePage === p.k ? C.teal : C.border}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: p.icon,
    size: 14
  }), p.label)));
}
function ReportPagePicker({
  pages,
  activePage,
  setReportTab
}) {
  return /*#__PURE__*/React.createElement("select", {
    className: "border rounded-md px-3 py-1.5 text-sm mb-4",
    style: {
      borderColor: C.border
    },
    value: activePage,
    onChange: e => setReportTab(e.target.value)
  }, pages.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.k,
    value: p.k
  }, p.label)));
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
  setSamples,
  references,
  subBatches,
  users,
  session,
  permissionMatrix,
  notify,
  goToSample,
  parameters
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
    // Voided records (Void/Invalidate — see 13-testrecords-ui.js) are kept
    // in the database for audit purposes but must never count toward
    // revenue, consumption, or performance analytics — the test never
    // produced a valid result, so it shouldn't inflate anyone's numbers.
    if (r.voided) return false;
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
    setSamples,
    references,
    subBatches,
    users,
    session,
    permissionMatrix,
    goToSample,
    notify,
    parameters
  };
  function printReport() {
    window.print();
  }
  const activePageDef = ALL_REPORT_PAGES.find(p => p.k === activePage);
  const activeGroupDef = REPORT_GROUPS.find(grp => grp.pages.some(p => p.k === activePage));
  // Per request: no page-level "Reports & Analytics" heading/subtitle and no
  // "Report & Analytics / Executive Dashboard" breadcrumb — the group pills
  // below (ReportGroupPills / ReportPagePills) are the navigation, shown
  // right away instead of underneath descriptive text.
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-end mb-4 no-print flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: printReport
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "printer",
    size: 13
  }), "Print / Save as PDF")), /*#__PURE__*/React.createElement(FilterPanel, {
    filters: filters,
    setFilters: setFilters,
    facets: facets
  }), /*#__PURE__*/React.createElement(ReportGroupPills, {
    activeGroup: activeGroupDef?.group,
    onSelectGroup: grp => setReportTab(grp.pages[0].k)
  }), activeGroupDef?.group === "Custom Report" ? /*#__PURE__*/React.createElement(ReportPagePills, {
    pages: activeGroupDef.pages,
    activePage: activePage,
    setReportTab: setReportTab
  }) : /*#__PURE__*/React.createElement(ReportPagePicker, {
    pages: activeGroupDef?.pages || [],
    activePage: activePage,
    setReportTab: setReportTab
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-4"
  }, activePage === "executive" && /*#__PURE__*/React.createElement(ExecutiveDashboardPage, shared), activePage === "insights" && /*#__PURE__*/React.createElement(SmartInsightsPage, shared), activePage === "testAnalytics" && /*#__PURE__*/React.createElement(TestAnalyticsPage, shared), activePage === "technician" && /*#__PURE__*/React.createElement(TechnicianPerformancePage, shared), activePage === "revenue" && /*#__PURE__*/React.createElement(RevenueAnalyticsPage, shared), activePage === "chemicalAnalytics" && /*#__PURE__*/React.createElement(ChemicalAnalyticsPage, shared), activePage === "inventoryAnalytics" && /*#__PURE__*/React.createElement(InventoryAnalyticsPage, shared), activePage === "glasswareAnalytics" && /*#__PURE__*/React.createElement(GlasswareAnalyticsPage, shared), activePage === "gasAnalytics" && /*#__PURE__*/React.createElement(GasAnalyticsPage, shared), activePage === "predictiveInventory" && /*#__PURE__*/React.createElement(PredictiveInventoryPage, shared), activePage === "equipmentAnalytics" && /*#__PURE__*/React.createElement(EquipmentAnalyticsPage, shared), activePage === "maintenanceAnalytics" && /*#__PURE__*/React.createElement(MaintenanceAnalyticsPage, shared), activePage === "monthlyTrends" && /*#__PURE__*/React.createElement(MonthlyTrendsPage, shared), activePage === "dailyTrends" && /*#__PURE__*/React.createElement(DailyTrendsPage, shared), activePage === "forecast" && /*#__PURE__*/React.createElement(ForecastPage, shared), activePage === "customReport" && /*#__PURE__*/React.createElement(CustomReportGeneratorPage, shared), activePage === "customReportSingle" && /*#__PURE__*/React.createElement(CustomReportGeneratorPage, {
    ...shared,
    forceMode: "individual"
  }), activePage === "monthlyProgressReport" && /*#__PURE__*/React.createElement(MonthlyProgressReportPage, shared), activePage === "chemicalUsageReport" && /*#__PURE__*/React.createElement(ChemicalUsageReportPage, shared), activePage === "equipmentUsageReport" && /*#__PURE__*/React.createElement(EquipmentUsageReportPage, shared), activePage === "glasswareUsageReport" && /*#__PURE__*/React.createElement(GlasswareUsageReportPage, shared), activePage === "gasUsageReport" && /*#__PURE__*/React.createElement(GasUsageReportPage, shared)));
}
