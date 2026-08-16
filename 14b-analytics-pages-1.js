// ===== 14b-analytics-pages-1.js (Executive/Insights/Test/Tech/Revenue/Chemical analytics pages) =====
// ===== 14b-analytics-pages.js (split from 14-reports-ui.js) =====
function computeSmartInsights({
  filteredRecords,
  chemicals,
  equipment,
  gasList,
  glassware,
  rangeDays
}) {
  const insights = [];

  // 1. Low-stock / soon-to-deplete chemicals
  chemicals.forEach(c => {
    const totalRemaining = sum(c.batches.filter(b => b.status === "active").map(b => b.remaining));
    const consumed = sum(filteredRecords.map(r => Number(r.consumption?.[c.name]) || 0));
    const dailyRate = consumed / Math.max(1, rangeDays);
    if (dailyRate > 0) {
      const daysLeft = totalRemaining / dailyRate;
      if (daysLeft < 14) insights.push({
        tone: "warn",
        icon: /*#__PURE__*/React.createElement(Icon, {
          name: "warning",
          size: 15
        }),
        title: `${c.name} stock critical`,
        text: `Approx. ${daysLeft.toFixed(0)} day(s) of stock remaining at current usage rate (${fmtNum(dailyRate)} ${c.unit}/day). Reorder recommended.`
      });
    }
  });

  // 2. Expiring batches within 30 days
  const today = todayStr();
  chemicals.forEach(c => c.batches.forEach(b => {
    if (b.status === "active" && b.remaining > 0) {
      const d = daysBetweenD(today, b.expiryDate);
      if (d >= 0 && d <= 30) insights.push({
        tone: "warn",
        icon: /*#__PURE__*/React.createElement(Icon, {
          name: "warning",
          size: 15
        }),
        title: `${c.name} batch expiring soon`,
        text: `Batch ${b.batchName} expires in ${d} day(s) with ${fmtNum(b.remaining)} ${c.unit} remaining — prioritize FEFO usage.`
      });
    }
  }));

  // 3. Equipment with concerning maintenance profile
  equipment.forEach(eq => {
    const stats = equipmentMaintenanceStats(eq);
    if (stats.breakdownCount >= 2) insights.push({
      tone: "warn",
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "wrench",
        size: 15
      }),
      title: `${eq.name} needs attention`,
      text: `${stats.breakdownCount} breakdown(s) logged, MTTR ${stats.mttr}d, uptime ${stats.uptimePct}%. Consider preventive maintenance.`
    });
  });

  // 4. Top technician
  const byTech = groupSum(filteredRecords, r => r.tester, () => 1);
  const topTech = topEntries(byTech, 1)[0];
  if (topTech) insights.push({
    tone: "ok",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 15
    }),
    title: "Top performing technician",
    text: `${topTech[0]} logged the most tests in the selected range (${topTech[1]} record(s)).`
  });

  // 5. Revenue MoM growth
  const revByMonth = groupSum(filteredRecords, r => monthKey(r.date), r => r.revenue || 0);
  const months = Object.keys(revByMonth).sort();
  if (months.length >= 2) {
    const last = revByMonth[months[months.length - 1]],
      prev = revByMonth[months[months.length - 2]];
    const g = pctGrowth(last, prev);
    insights.push({
      tone: g >= 0 ? "ok" : "warn",
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "coins",
        size: 15
      }),
      title: `Revenue ${g >= 0 ? "growth" : "decline"} month-over-month`,
      text: `Revenue moved ${fmtPct(g)} from ${months[months.length - 2]} to ${months[months.length - 1]} (${fmtMoney(prev)} → ${fmtMoney(last)}).`
    });
  }

  // 6. Most profitable test type
  const revByType = groupSum(filteredRecords, r => r.testTypeName, r => r.revenue || 0);
  const topType = topEntries(revByType, 1)[0];
  if (topType) insights.push({
    tone: "ok",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 15
    }),
    title: "Highest-revenue test type",
    text: `${topType[0]} generated ${fmtMoney(topType[1])} in the selected range — your leading revenue driver.`
  });

  // 7. Dilution rate
  const dilutionCount = filteredRecords.filter(r => r.dilutionRequired).length;
  if (filteredRecords.length > 0) {
    const rate = dilutionCount / filteredRecords.length * 100;
    if (rate > 25) insights.push({
      tone: "info",
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "flask",
        size: 15
      }),
      title: "High dilution rate detected",
      text: `${rate.toFixed(0)}% of test records required dilution, increasing chemical/gas consumption. Review sample concentration protocols.`
    });
  }

  // 8. Expired chemical usage overrides (compliance)
  const overrideCount = filteredRecords.reduce((s, r) => s + (r.expiredOverrides || []).length, 0);
  if (overrideCount > 0) insights.push({
    tone: "warn",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "ban",
      size: 15
    }),
    title: "Expired chemical usage logged",
    text: `${overrideCount} record(s) used an expired chemical via manual override — review for QA/compliance.`
  });

  // 9. Low gas cylinders
  gasList.forEach(g => g.cylinders.forEach(cyl => {
    if (cyl.status === "active" && cyl.capacity > 0 && cyl.remaining / cyl.capacity < 0.15) {
      insights.push({
        tone: "warn",
        icon: /*#__PURE__*/React.createElement(Icon, {
          name: "flask",
          size: 15
        }),
        title: `${g.name} cylinder running low`,
        text: `Cylinder ${cyl.name} at ${(cyl.remaining / cyl.capacity * 100).toFixed(0)}% capacity (${fmtNum(cyl.remaining)} ${g.unit} left). Schedule a refill.`
      });
    }
  }));

  // 10. Glassware breakage
  glassware.forEach(g => {
    if (g.totalQuantity > 0 && g.broken / g.totalQuantity > 0.1) insights.push({
      tone: "warn",
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "beaker",
        size: 15
      }),
      title: `${g.name} breakage rate high`,
      text: `${g.broken} of ${g.totalQuantity} unit(s) broken (${(g.broken / g.totalQuantity * 100).toFixed(0)}%). Consider handling review or restocking.`
    });
  });
  return insights;
}

// ==================================== EXECUTIVE DASHBOARD ====================================
function ExecutiveDashboardPage({
  filteredRecords,
  filteredChemicals: chemicals,
  filteredEquipment: equipment,
  filteredGas: gasList,
  filteredGlassware: glassware,
  testTypes,
  rangeDays
}) {
  const totalRevenue = sum(filteredRecords.map(r => r.revenue || 0));
  const totalTests = filteredRecords.length;
  const totalSamples = sum(filteredRecords.map(r => r.billedSamples ?? (r.feeApplicable === false ? 0 : r.numberOfSamples || 0)));
  const activeChemBatches = sum(chemicals.map(c => c.batches.filter(b => b.status === "active").length));
  const equipUptimeAvg = avg(equipment.map(e => equipmentMaintenanceStats(e).uptimePct));
  const lowStockAlerts = computeSmartInsights({
    filteredRecords,
    chemicals,
    equipment,
    gasList,
    glassware,
    rangeDays
  }).filter(i => i.tone === "warn").length;
  const revByMonth = groupSum(filteredRecords, r => monthKey(r.date), r => r.revenue || 0);
  const monthKeys = Object.keys(revByMonth).sort().slice(-12);
  const revSeries = monthKeys.map(m => +revByMonth[m].toFixed(2));
  const testsByMonth = groupSum(filteredRecords, r => monthKey(r.date), () => 1);
  const testSeries = monthKeys.map(m => testsByMonth[m] || 0);
  const testsByType = groupSum(filteredRecords, r => r.testTypeName, () => 1);
  const typeEntries = topEntries(testsByType, 8);
  const testsByTech = groupSum(filteredRecords, r => r.tester, () => 1);
  const techEntries = topEntries(testsByTech, 6);
  const dailyMap = {};
  filteredRecords.forEach(r => {
    dailyMap[r.date] = (dailyMap[r.date] || 0) + 1;
  });
  const chart1Ref = React.useRef(null),
    chart2Ref = React.useRef(null),
    chart3Ref = React.useRef(null);
  const insights = computeSmartInsights({
    filteredRecords,
    chemicals,
    equipment,
    gasList,
    glassware,
    rangeDays
  }).slice(0, 4);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 12
    }),
    label: "Total Revenue",
    value: fmtMoney(totalRevenue),
    spark: revSeries
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Total Tests",
    value: fmtNum(totalTests),
    spark: testSeries,
    sparkColor: C.seafoam
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 12
    }),
    label: "Billed Samples",
    value: fmtNum(totalSamples)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 12
    }),
    label: "Active Chemical Batches",
    value: fmtNum(activeChemBatches)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wrench",
      size: 12
    }),
    label: "Avg Equipment Uptime",
    value: `${equipUptimeAvg.toFixed(1)}%`,
    tone: equipUptimeAvg > 90 ? C.ok : C.warn
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 12
    }),
    label: "Active Alerts",
    value: fmtNum(lowStockAlerts),
    tone: lowStockAlerts > 0 ? C.warn : C.ok
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lg:col-span-2"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Revenue & Test Volume Trend",
    subtitle: "Last 12 months in range",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: chart1Ref,
    exportRows: monthKeys.map((m, i) => ({
      Month: m,
      Revenue: revSeries[i],
      Tests: testSeries[i]
    })),
    filename: "executive_trend"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    chartRef: chart1Ref,
    height: 260,
    data: {
      labels: monthKeys,
      datasets: [{
        label: "Revenue (৳)",
        data: revSeries,
        borderColor: C.teal,
        backgroundColor: hexToRgba(C.teal, 0.12),
        fill: true,
        tension: 0.35,
        yAxisID: "y"
      }, {
        label: "Tests",
        data: testSeries,
        borderColor: paletteColor(2),
        backgroundColor: "transparent",
        tension: 0.35,
        yAxisID: "y1"
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
  }))), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Tests by Type",
    subtitle: "Top categories",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    }),
    chartRef: chart2Ref,
    exportRows: typeEntries.map(([k, v]) => ({
      TestType: k,
      Count: v
    })),
    filename: "tests_by_type"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "doughnut",
    chartRef: chart2Ref,
    height: 260,
    data: {
      labels: typeEntries.map(e => e[0]),
      datasets: [{
        data: typeEntries.map(e => e[1]),
        backgroundColor: typeEntries.map((_, i) => paletteColor(i)),
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
    className: "grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Top Sample Analyzers",
    subtitle: "By test volume",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 16,
      color: C.teal
    }),
    chartRef: chart3Ref,
    exportRows: techEntries.map(([k, v]) => ({
      "Sample Analyzer": k,
      Tests: v
    })),
    filename: "top_technicians"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: chart3Ref,
    height: 240,
    data: {
      labels: techEntries.map(e => e[0]),
      datasets: [{
        label: "Tests",
        data: techEntries.map(e => e[1]),
        backgroundColor: C.seafoam,
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
  })), /*#__PURE__*/React.createElement("div", {
    className: "lg:col-span-2"
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Daily Test Activity (last 17 weeks)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(CalendarHeatmap, {
    valueByDate: dailyMap
  })))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Smart Insights",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 16,
      color: C.teal
    }),
    right: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      onClick: () => {}
    }, "See all in Smart Insights →")
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-2.5"
  }, insights.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: C.muted
    }
  }, "No notable insights for the current filters — everything looks healthy."), insights.map((ins, i) => /*#__PURE__*/React.createElement(InsightCard, {
    key: i,
    ...ins
  })))));
}

// ==================================== SMART INSIGHTS PAGE ====================================
function SmartInsightsPage({
  filteredRecords,
  filteredChemicals: chemicals,
  filteredEquipment: equipment,
  filteredGas: gasList,
  filteredGlassware: glassware,
  rangeDays
}) {
  const insights = computeSmartInsights({
    filteredRecords,
    chemicals,
    equipment,
    gasList,
    glassware,
    rangeDays
  });
  const warn = insights.filter(i => i.tone === "warn");
  const ok = insights.filter(i => i.tone === "ok");
  const info = insights.filter(i => i.tone === "info");
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 12
    }),
    label: "Alerts",
    value: fmtNum(warn.length),
    tone: C.warn
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 12
    }),
    label: "Positive Signals",
    value: fmtNum(ok.length),
    tone: C.ok
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Informational",
    value: fmtNum(info.length),
    tone: C.info
  })), warn.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: `Needs Attention (${warn.length})`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 16,
      color: C.warn
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-2.5"
  }, warn.map((ins, i) => /*#__PURE__*/React.createElement(InsightCard, {
    key: i,
    ...ins
  })))), ok.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: `Positive Signals (${ok.length})`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 16,
      color: C.ok
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-2.5"
  }, ok.map((ins, i) => /*#__PURE__*/React.createElement(InsightCard, {
    key: i,
    ...ins
  })))), info.length > 0 && /*#__PURE__*/React.createElement(SectionCard, {
    title: `Informational (${info.length})`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.info
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-2.5"
  }, info.map((ins, i) => /*#__PURE__*/React.createElement(InsightCard, {
    key: i,
    ...ins
  })))), insights.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-sm py-10 text-center",
    style: {
      color: C.muted
    }
  }, "No insights to show for the current filter selection — operations look nominal."));
}
// ==================================== TEST ANALYTICS ====================================
function TestAnalyticsPage({
  filteredRecords
}) {
  const [drillType, setDrillType] = React.useState(null);
  const total = filteredRecords.length;
  const totalFieldSamples = sum(filteredRecords.map(r => r.numberOfFieldSamples ?? r.numberOfSamples ?? 0));
  const totalStdSamples = sum(filteredRecords.map(r => r.numberOfStandardSamples ?? 0));
  const dilutionCount = filteredRecords.filter(r => r.dilutionRequired).length;
  const avgSamplesPerTest = total ? +(totalFieldSamples / total).toFixed(2) : 0;
  const byType = groupSum(filteredRecords, r => r.testTypeName, () => 1);
  const typeEntries = topEntries(byType, 10);

  // stacked: technician x testType
  const techs = [...new Set(filteredRecords.map(r => r.tester))].filter(Boolean);
  const types = [...new Set(filteredRecords.map(r => r.testTypeName))].filter(Boolean).slice(0, 6);
  const stackedDatasets = types.map((ty, i) => ({
    label: ty,
    backgroundColor: paletteColor(i),
    data: techs.map(t => filteredRecords.filter(r => r.tester === t && r.testTypeName === ty).length)
  }));
  const bySource = groupSum(filteredRecords, r => r.sampleSource || "Unspecified", () => 1);
  const sourceEntries = topEntries(bySource, 8);
  const c1 = React.useRef(null),
    c2 = React.useRef(null),
    c3 = React.useRef(null);
  const tableRows = (drillType ? filteredRecords.filter(r => r.testTypeName === drillType) : filteredRecords).map(r => ({
    date: r.date,
    tester: r.tester,
    test: r.testTypeName,
    source: r.sampleSource || "—",
    std: r.numberOfStandardSamples ?? 0,
    field: r.numberOfFieldSamples ?? r.numberOfSamples ?? 0,
    equipment: r.equipmentName || "—",
    dilution: r.dilutionRequired ? `${r.numberOfDilutedSamples || 0} sample(s)` : "No"
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Total Test Records",
    value: fmtNum(total)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 12
    }),
    label: "Field Samples",
    value: fmtNum(totalFieldSamples)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 12
    }),
    label: "Standard/QC Samples",
    value: fmtNum(totalStdSamples)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 12
    }),
    label: "Dilution Rate",
    value: `${total ? (dilutionCount / total * 100).toFixed(1) : 0}%`
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Tests by Type",
    subtitle: "Click a bar to drill down",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: typeEntries.map(([k, v]) => ({
      TestType: k,
      Count: v
    })),
    filename: "tests_by_type",
    right: drillType && /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      onClick: () => setDrillType(null)
    }, "Clear drill-down (", drillType, ")")
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c1,
    height: 260,
    data: {
      labels: typeEntries.map(e => e[0]),
      datasets: [{
        label: "Tests",
        data: typeEntries.map(e => e[1]),
        backgroundColor: typeEntries.map((e, i) => e[0] === drillType ? C.tealDark : paletteColor(i)),
        borderRadius: 4
      }]
    },
    options: {
      onClick: (evt, elements) => {
        if (elements && elements[0]) setDrillType(typeEntries[elements[0].index][0]);
      },
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
    title: "Client Breakdown",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: sourceEntries.map(([k, v]) => ({
      Source: k,
      Count: v
    })),
    filename: "sample_source"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "pie",
    chartRef: c2,
    height: 260,
    data: {
      labels: sourceEntries.map(e => e[0]),
      datasets: [{
        data: sourceEntries.map(e => e[1]),
        backgroundColor: sourceEntries.map((_, i) => paletteColor(i)),
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
  }))), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Test Volume by Sample Analyzer & Type",
    subtitle: "Stacked comparison (top 6 test types)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 16,
      color: C.teal
    }),
    chartRef: c3,
    exportRows: techs.map(t => ({
      "Sample Analyzer": t,
      ...Object.fromEntries(types.map(ty => [ty, filteredRecords.filter(r => r.tester === t && r.testTypeName === ty).length]))
    })),
    filename: "tests_by_technician_type"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c3,
    height: 280,
    data: {
      labels: techs,
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
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: `Test Record Log${drillType ? ` — ${drillType}` : ""}`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "test_records",
    defaultSortKey: "date",
    columns: [{
      key: "date",
      label: "Date"
    }, {
      key: "tester",
      label: "Tester"
    }, {
      key: "test",
      label: "Test"
    }, {
      key: "source",
      label: "Client"
    }, {
      key: "std",
      label: "Std."
    }, {
      key: "field",
      label: "Field"
    }, {
      key: "equipment",
      label: "Equipment"
    }, {
      key: "dilution",
      label: "Dilution"
    }],
    rows: tableRows
  })));
}

// ==================================== TECHNICIAN PERFORMANCE ====================================
function TechnicianPerformancePage({
  filteredRecords
}) {
  const techs = [...new Set(filteredRecords.map(r => r.tester))].filter(Boolean);
  const rows = techs.map(t => {
    const recs = filteredRecords.filter(r => r.tester === t);
    const revenue = sum(recs.map(r => r.revenue || 0));
    const samples = sum(recs.map(r => r.billedSamples ?? (r.feeApplicable === false ? 0 : r.numberOfSamples || 0)));
    const byMonth = groupSum(recs, r => monthKey(r.date), () => 1);
    const monthKeys = Object.keys(byMonth).sort();
    const spark = monthKeys.slice(-8).map(m => byMonth[m]);
    const dilRate = recs.length ? recs.filter(r => r.dilutionRequired).length / recs.length * 100 : 0;
    return {
      tester: t,
      tests: recs.length,
      revenue,
      avgRevenue: recs.length ? +(revenue / recs.length).toFixed(2) : 0,
      samples,
      dilRate: +dilRate.toFixed(1),
      spark
    };
  }).sort((a, b) => b.tests - a.tests);
  const c1 = React.useRef(null),
    c2 = React.useRef(null);
  const top = rows.slice(0, 10);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 12
    }),
    label: "Active Sample Analyzers",
    value: fmtNum(techs.length)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Avg Tests / Sample Analyzer",
    value: techs.length ? (filteredRecords.length / techs.length).toFixed(1) : "0"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 12
    }),
    label: "Avg Revenue / Sample Analyzer",
    value: fmtMoney(techs.length ? sum(rows.map(r => r.revenue)) / techs.length : 0)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 12
    }),
    label: "Top Performer",
    value: rows[0] ? rows[0].tester : "—"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Ranking by Test Volume",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: top.map(r => ({
      "Sample Analyzer": r.tester,
      Tests: r.tests
    })),
    filename: "technician_ranking_tests"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c1,
    height: 280,
    data: {
      labels: top.map(r => r.tester),
      datasets: [{
        label: "Tests",
        data: top.map(r => r.tests),
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
    title: "Ranking by Revenue Generated",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: top.map(r => ({
      "Sample Analyzer": r.tester,
      Revenue: r.revenue
    })),
    filename: "technician_ranking_revenue"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c2,
    height: 280,
    data: {
      labels: top.map(r => r.tester),
      datasets: [{
        label: "Revenue (৳)",
        data: top.map(r => r.revenue),
        backgroundColor: C.seafoam,
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
  }))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Sample Analyzer Leaderboard",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "technician_leaderboard",
    defaultSortKey: "tests",
    columns: [{
      key: "tester",
      label: "Sample Analyzer"
    }, {
      key: "tests",
      label: "Tests"
    }, {
      key: "samples",
      label: "Billed Samples"
    }, {
      key: "revenue",
      label: "Revenue",
      render: r => fmtMoney(r.revenue)
    }, {
      key: "avgRevenue",
      label: "Avg ৳/Test",
      render: r => fmtMoney(r.avgRevenue)
    }, {
      key: "dilRate",
      label: "Dilution %",
      render: r => `${r.dilRate}%`
    }, {
      key: "trend",
      label: "Trend",
      render: r => /*#__PURE__*/React.createElement(Sparkline, {
        data: r.spark.length > 1 ? r.spark : [0, r.spark[0] || 0]
      })
    }],
    rows: rows
  })));
}

// ==================================== REVENUE ANALYTICS ====================================
function RevenueAnalyticsPage({
  filteredRecords
}) {
  const totalRevenue = sum(filteredRecords.map(r => r.revenue || 0));
  const totalTests = filteredRecords.length;
  const costPerTest = totalTests ? totalRevenue / totalTests : 0;
  const revByMonth = groupSum(filteredRecords, r => monthKey(r.date), r => r.revenue || 0);
  const monthKeys = Object.keys(revByMonth).sort();
  const revSeries = monthKeys.map(m => +revByMonth[m].toFixed(2));
  const ma = movingAverage(revSeries, 3);
  const momGrowth = revSeries.length >= 2 ? pctGrowth(revSeries[revSeries.length - 1], revSeries[revSeries.length - 2]) : 0;
  const yoyIdx = monthKeys.length - 13;
  const yoyGrowth = yoyIdx >= 0 ? pctGrowth(revSeries[revSeries.length - 1], revSeries[yoyIdx]) : null;
  const revByType = groupSum(filteredRecords, r => r.testTypeName, r => r.revenue || 0);
  const typeEntries = topEntries(revByType, 10);
  const revByTech = groupSum(filteredRecords, r => r.tester, r => r.revenue || 0);
  const techEntries = topEntries(revByTech, 10);
  const c1 = React.useRef(null),
    c2 = React.useRef(null),
    c3 = React.useRef(null);
  const rows = [...filteredRecords].reverse().map(r => ({
    date: r.date,
    tester: r.tester,
    test: r.testTypeName,
    billed: r.billedSamples ?? (r.feeApplicable === false ? 0 : r.numberOfSamples || 0),
    unitCost: r.unitCost || 0,
    revenue: r.revenue || 0
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 12
    }),
    label: "Total Revenue",
    value: fmtMoney(totalRevenue),
    spark: revSeries
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Month-over-Month",
    value: fmtPct(momGrowth),
    delta: momGrowth
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Year-over-Year",
    value: yoyGrowth === null ? "N/A" : fmtPct(yoyGrowth),
    delta: yoyGrowth === null ? undefined : yoyGrowth
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Avg Revenue / Test",
    value: fmtMoney(costPerTest)
  })), /*#__PURE__*/React.createElement(ChartCard, {
    title: "Revenue Trend with 3-Month Moving Average",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: monthKeys.map((m, i) => ({
      Month: m,
      Revenue: revSeries[i],
      MovingAvg: +ma[i].toFixed(2)
    })),
    filename: "revenue_trend_ma"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    chartRef: c1,
    height: 270,
    data: {
      labels: monthKeys,
      datasets: [{
        label: "Revenue",
        data: revSeries,
        borderColor: C.teal,
        backgroundColor: hexToRgba(C.teal, 0.12),
        fill: true,
        tension: 0.3
      }, {
        label: "3-mo Moving Avg",
        data: ma.map(v => +v.toFixed(2)),
        borderColor: paletteColor(4),
        borderDash: [6, 4],
        pointRadius: 0,
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
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Revenue by Test Type",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: typeEntries.map(([k, v]) => ({
      TestType: k,
      Revenue: v
    })),
    filename: "revenue_by_type"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c2,
    height: 260,
    data: {
      labels: typeEntries.map(e => e[0]),
      datasets: [{
        label: "Revenue (৳)",
        data: typeEntries.map(e => +e[1].toFixed(2)),
        backgroundColor: typeEntries.map((_, i) => paletteColor(i)),
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
    title: "Revenue by Sample Analyzer",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "user",
      size: 16,
      color: C.teal
    }),
    chartRef: c3,
    exportRows: techEntries.map(([k, v]) => ({
      "Sample Analyzer": k,
      Revenue: v
    })),
    filename: "revenue_by_technician"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c3,
    height: 260,
    data: {
      labels: techEntries.map(e => e[0]),
      datasets: [{
        label: "Revenue (৳)",
        data: techEntries.map(e => +e[1].toFixed(2)),
        backgroundColor: C.mint,
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
  }))), /*#__PURE__*/React.createElement(SectionCard, {
    title: `Revenue Collection (total ${fmtMoney(totalRevenue)})`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "coins",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "revenue_collection",
    defaultSortKey: "date",
    columns: [{
      key: "date",
      label: "Date"
    }, {
      key: "tester",
      label: "Tester"
    }, {
      key: "test",
      label: "Test"
    }, {
      key: "billed",
      label: "Billed Samples"
    }, {
      key: "unitCost",
      label: "Standard Fee",
      render: r => fmtMoney(r.unitCost)
    }, {
      key: "revenue",
      label: "Revenue",
      render: r => fmtMoney(r.revenue)
    }],
    rows: rows
  })));
}
// ==================================== CHEMICAL ANALYTICS ====================================
function ChemicalAnalyticsPage({
  filteredRecords,
  filteredChemicals,
  rangeDays
}) {
  const consumption = {};
  filteredRecords.forEach(r => Object.entries(r.consumption || {}).forEach(([chem, amt]) => {
    consumption[chem] = (consumption[chem] || 0) + amt;
  }));
  const consEntries = topEntries(consumption, 10);
  const totalConsumed = sum(Object.values(consumption));
  const totalFieldSamples = sum(filteredRecords.map(r => r.numberOfFieldSamples ?? r.numberOfSamples ?? 0)) || 1;
  const efficiency = +(totalConsumed / totalFieldSamples).toFixed(3);
  const consByMonth = {};
  filteredRecords.forEach(r => {
    const mk = monthKey(r.date);
    const t = sum(Object.values(r.consumption || {}));
    consByMonth[mk] = (consByMonth[mk] || 0) + t;
  });
  const monthKeys = Object.keys(consByMonth).sort();
  const consSeries = monthKeys.map(m => +consByMonth[m].toFixed(2));
  const stockByChem = filteredChemicals.map(c => ({
    label: c.name,
    value: sum(c.batches.filter(b => b.status === "active").map(b => b.remaining)),
    unit: ` ${c.unit}`,
    color: paletteColor(filteredChemicals.indexOf(c))
  }));
  let activeCount = 0,
    expiringCount = 0,
    expiredCount = 0,
    depletedCount = 0;
  const today = todayStr();
  filteredChemicals.forEach(c => c.batches.forEach(b => {
    if (b.status === "depleted") depletedCount++;else if (b.status === "expired") expiredCount++;else if (daysBetweenD(today, b.expiryDate) <= 30) expiringCount++;else activeCount++;
  }));
  const stockRows = filteredChemicals.flatMap(c => c.batches.map(b => ({
    chemical: c.name,
    received: b.dateReceived,
    expiry: b.expiryDate,
    initial: b.initialAmount,
    remaining: b.remaining,
    origin: b.origin || "—",
    supplier: b.receivedFrom || "—",
    status: b.status
  })));
  const c1 = React.useRef(null),
    c2 = React.useRef(null),
    c3 = React.useRef(null),
    c4 = React.useRef(null);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"
  }, /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 12
    }),
    label: "Chemicals Tracked",
    value: fmtNum(filteredChemicals.length)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 12
    }),
    label: "Total Consumed (range)",
    value: fmtNum(totalConsumed)
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 12
    }),
    label: "Consumption / Sample",
    value: `${efficiency}`
  }), /*#__PURE__*/React.createElement(KpiCard, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "warning",
      size: 12
    }),
    label: "Expiring ≤30d",
    value: fmtNum(expiringCount),
    tone: expiringCount > 0 ? C.warn : C.ok
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Top Consumed Chemicals",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 16,
      color: C.teal
    }),
    chartRef: c1,
    exportRows: consEntries.map(([k, v]) => ({
      Chemical: k,
      Used: fmtNum(v)
    })),
    filename: "chemical_consumption"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c1,
    height: 260,
    data: {
      labels: consEntries.map(e => e[0]),
      datasets: [{
        label: "Consumed",
        data: consEntries.map(e => +e[1].toFixed(2)),
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
    title: "Consumption Trend (monthly)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 16,
      color: C.teal
    }),
    chartRef: c2,
    exportRows: monthKeys.map((m, i) => ({
      Month: m,
      Consumed: consSeries[i]
    })),
    filename: "consumption_trend"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "line",
    chartRef: c2,
    height: 260,
    data: {
      labels: monthKeys,
      datasets: [{
        label: "Total Consumed",
        data: consSeries,
        borderColor: C.seafoam,
        backgroundColor: hexToRgba(C.seafoam, 0.15),
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
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-5"
  }, /*#__PURE__*/React.createElement(ChartCard, {
    title: "Active Stock Levels by Chemical",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "beaker",
      size: 16,
      color: C.teal
    }),
    chartRef: c3,
    exportRows: stockByChem.map(s => ({
      Chemical: s.label,
      Remaining: s.value
    })),
    filename: "stock_levels"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "bar",
    chartRef: c3,
    height: 260,
    data: {
      labels: stockByChem.map(s => s.label),
      datasets: [{
        label: "Remaining",
        data: stockByChem.map(s => +s.value.toFixed(2)),
        backgroundColor: stockByChem.map((_, i) => paletteColor(i)),
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
    title: "Batch Status Distribution",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    }),
    chartRef: c4,
    exportRows: [{
      Status: "Active",
      Count: activeCount
    }, {
      Status: "Expiring ≤30d",
      Count: expiringCount
    }, {
      Status: "Expired",
      Count: expiredCount
    }, {
      Status: "Depleted",
      Count: depletedCount
    }],
    filename: "batch_status"
  }, /*#__PURE__*/React.createElement(ChartCanvas, {
    type: "doughnut",
    chartRef: c4,
    height: 260,
    data: {
      labels: ["Active", "Expiring ≤30d", "Expired", "Depleted"],
      datasets: [{
        data: [activeCount, expiringCount, expiredCount, depletedCount],
        backgroundColor: [C.ok, C.warn, C.danger, C.muted],
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
    title: "Stock & Expiry (FEFO view)",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "flask",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(DataTable, {
    exportFilename: "stock_expiry",
    defaultSortKey: "expiry",
    columns: [{
      key: "chemical",
      label: "Chemical"
    }, {
      key: "received",
      label: "Received"
    }, {
      key: "expiry",
      label: "Expiry"
    }, {
      key: "initial",
      label: "Initial"
    }, {
      key: "remaining",
      label: "Remaining"
    }, {
      key: "origin",
      label: "Origin"
    }, {
      key: "supplier",
      label: "Supplier"
    }, {
      key: "status",
      label: "Status",
      render: r => /*#__PURE__*/React.createElement(Badge, {
        tone: r.status === "active" ? "ok" : r.status === "expired" ? "warn" : "muted"
      }, r.status)
    }],
    rows: stockRows
  })));
}

// ==================================== INVENTORY ANALYTICS (combined) ====================================
