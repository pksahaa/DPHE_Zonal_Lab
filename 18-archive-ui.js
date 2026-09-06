// ===== 18-archive-ui.js =====
// ============================================================================
// ARCHIVE — browse, search, reprint, export, and restore Test Records that
// have been archived out of the active/fast dataset (see DataService.
// archiveTestRecord/fetchArchivedRecords/restoreRecord in 01-data-service.js,
// and the "Archive" action in 13-testrecords-ui.js's Test Records list).
//
// Deliberately on-demand: nothing here runs until this tab is actually
// opened (the useEffect below fires on mount, not from 99-app.js's initial
// app-load sequence), and every subsequent search re-queries DataService
// rather than keeping the full archive resident in appState. See the long
// comment at the bottom of this file for the full performance rationale.
//
// An archived Test Record is either a legacy individual record (one sample)
// or an Analytical Batch record (several samples run together, one row per
// member in `memberResults`). Both views below are built from the same
// per-(sample, testType) lookup the rest of the app already trusts —
// getSampleResultForTest() in 16-sub-batch.js, the same function the Report
// Generator and Results Workflow use — so a value that prints correctly can
// never disagree with what this screen displays.
// ============================================================================

// One row per (sample, parameter) fact within a single archived record.
// Kept as its own record-scoped list (not flattened across all archived
// records at once) so both the flat table and the grouped/batch view can
// share this exact same builder. `testTypes` is only used to resolve a
// parameter's display name when the result entry itself didn't carry one
// (older bulk-upload overrides sometimes only stored paramId/value) — look
// it up from the test type's own resultParameters definition, then fall
// back to the record's test type name, so a legitimate result never shows
// as "(unnamed parameter)" just because one label field was left blank.
function resolveParamName(r, rec, testTypes) {
  if (r.name) return r.name;
  const testType = (testTypes || []).find(t => t.id === rec.testTypeId);
  const paramDef = testType?.resultParameters?.find(p => p.id === r.paramId);
  return paramDef?.name || rec.testTypeName || "(unnamed parameter)";
}
function archivedRecordRows(rec, testTypes) {
  const isBatch = !!(rec.memberSampleIds && rec.memberSampleIds.length);
  const sampleIds = isBatch ? rec.memberSampleIds : rec.sampleId ? [rec.sampleId] : [];
  const rows = [];
  sampleIds.forEach(sid => {
    const snap = (rec.archivedSampleSnapshots || []).find(s => s.id === sid) || {
      id: sid
    };
    const found = getSampleResultForTest(snap, rec.testTypeId, [rec]);
    // Same filter Results Workflow uses for its own result column (line
    // ~288 of 22-results-workflow-ui.js) — a real value OR a recorded error,
    // never filtered on whether a `name` copy happens to be present.
    const resultEntries = (found?.results || []).filter(r => r.value != null || r.error);
    if (resultEntries.length === 0) {
      rows.push({
        key: `${rec.id}_${sid}_none`,
        record: rec,
        sample: snap,
        isBatch,
        paramName: "—",
        value: null,
        unit: "",
        error: null
      });
      return;
    }
    resultEntries.forEach(r => {
      rows.push({
        key: `${rec.id}_${sid}_${r.paramId || r.name}`,
        record: rec,
        sample: snap,
        isBatch,
        paramName: resolveParamName(r, rec, testTypes),
        value: r.value,
        unit: r.unit,
        error: r.error
      });
    });
  });
  if (rows.length === 0) {
    rows.push({
      key: `${rec.id}_empty`,
      record: rec,
      sample: null,
      isBatch,
      paramName: "—",
      value: null,
      unit: "",
      error: null
    });
  }
  return rows;
}
function archiveBatchLabel(rec) {
  if (rec.subBatchLabel) return rec.subBatchLabel;
  if (rec.memberSampleIds && rec.memberSampleIds.length) return "Analytical Batch";
  return "Individual";
}

// Builds and prints the certificate for an archived record on-demand, using
// the same pure HTML builder the live Custom Report Generator uses
// (17-report-generator.js) — reconstructed entirely from what was
// snapshotted at archive time, so this works even if the live sample record
// has since changed or been removed. Pass `onlySampleId` to print just one
// member of a batch record; omit it to print every sample the record
// covers together as one certificate.
async function printArchivedRecord(rec, testTypes, onlySampleId) {
  const testType = (testTypes || []).find(t => t.id === rec.testTypeId) || {
    id: rec.testTypeId,
    name: rec.testTypeName || "Test",
    method: "",
    reportLimit: ""
  };
  const allSnaps = rec.archivedSampleSnapshots && rec.archivedSampleSnapshots.length ? rec.archivedSampleSnapshots : [{
    id: rec.sampleId || "unknown",
    sampleCode: rec.sampleCode || "—",
    clientName: "",
    village: "",
    union: "",
    upazila: ""
  }];
  const selectedSamples = onlySampleId ? allSnaps.filter(s => s.id === onlySampleId) : allSnaps;
  // Open the popup synchronously (before any await) so it isn't blocked,
  // then fill it in once the letterhead logos are resolved — see
  // 17-report-generator.js for why this two-step dance is needed.
  const reportWindow = openReportPrintWindow();
  const labIdentity = await resolveLabIdentityLogos(getLabIdentity());
  const html = buildReportHtml({
    labIdentity,
    memo: {
      memoNo: "",
      date: todayStr(),
      sentBy: "",
      district: "",
      sampleSource: rec.sampleSource || "",
      refMemoNo: "",
      refMemoDate: "",
      dateOfTesting: rec.date || "",
      receivingDate: "",
      collectionDate: "",
      notes: "Reprinted from the Archive."
    },
    selectedSamples: selectedSamples.length ? selectedSamples : allSnaps,
    selectedTests: [testType],
    testRecords: [rec],
    signatories: {
      performedBy: [{
        name: rec.tester || "",
        designation: ""
      }],
      approvedBy: [{
        name: "",
        designation: ""
      }]
    }
  });
  finishReportPrintWindow(reportWindow, html);
}

// Plain CSV (no XLSX dependency needed for a flat export like this) —
// exports exactly what's on screen (the current filtered search results).
function exportArchivedRecordsCsv(rows) {
  const header = ["Sample ID", "Client", "Batch", "Completion Date", "Parameter", "Result", "Unit", "Status", "Archived At"];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(",")];
  rows.forEach(r => {
    lines.push([r.sample?.sampleCode || r.record.sampleCode || "—", r.sample?.clientName || "", archiveBatchLabel(r.record), r.record.date || "", r.paramName, r.value ?? (r.error || ""), r.unit || "", "Released", r.record.archivedAt || ""].map(esc).join(","));
  });
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `archived_test_records_${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function resultCell(row) {
  if (row.value != null) return `${fmtNum(row.value)} ${row.unit || ""}`.trim();
  if (row.error) return row.error;
  return "—";
}

const ARCHIVE_EMPTY_FILTERS = {
  sampleId: "",
  clientName: "",
  subBatch: "",
  parameter: "",
  dateFrom: "",
  dateTo: ""
};
function ArchiveTab({
  testTypes,
  samples,
  setSamples,
  testRecords,
  setTestRecords,
  session,
  permissionMatrix,
  notify,
  goToSample
}) {
  const archiveRestoreGate = permGate(permissionMatrix, session, "archive", "edit", notify, "restore archived records");
  const canRestore = archiveRestoreGate.visible;
  const [filters, setFilters] = React.useState(ARCHIVE_EMPTY_FILTERS);
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState(null);
  const [archivingId, setArchivingId] = React.useState(null);
  const [viewMode, setViewMode] = React.useState("flat"); // "flat" | "batch"
  const [collapsedBatches, setCollapsedBatches] = React.useState(() => new Set());

  const runSearch = React.useCallback(async activeFilters => {
    setLoading(true);
    setError(null);
    try {
      const recs = await DataService.fetchArchivedRecords(activeFilters);
      setResults(recs);
      // Group by Batch starts fully collapsed — a fresh search (or first
      // load) shouldn't dump every batch's sample list open at once.
      setCollapsedBatches(new Set(recs.map(r => r.id)));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, []);

  // Deliberately does NOT auto-search when this tab opens (previously it
  // fired a search with empty filters on mount, which loaded the ENTIRE
  // archive immediately — exactly the "growing archive slows things down"
  // problem this on-demand design was meant to avoid, just deferred to tab
  // -open instead of app-boot). Now nothing is fetched until the tester
  // actually clicks Search — see the EmptyState below for the pre-search
  // prompt.
  function patchFilter(key, value) {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }
  function clearFilters() {
    setFilters(ARCHIVE_EMPTY_FILTERS);
    // Clearing just resets the filters and the currently-shown results — it
    // does NOT re-run a search on its own; that would reintroduce the same
    // unwanted auto-load this whole change removes. Click Search again for
    // a fresh (unfiltered) look.
    setResults([]);
    setHasSearched(false);
  }
  function toggleBatchCollapsed(id) {
    setCollapsedBatches(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Restoring can act on the WHOLE record, or on just one/some sample(s)
  // out of a multi-sample batch — a batch's members can have been archived
  // gradually (each one only becomes archivable once IT is released), so
  // restoring needs the same per-sample granularity. When `sampleIds` is
  // omitted, every member of the archived record is restored (unchanged
  // "Restore Batch" / legacy single-record behavior). When a subset is
  // given, only those member(s) come back: if the batch's not-yet-released
  // remainder is still sitting in active Test Records (originRecordId),
  // the restored sample(s) are merged back into that same row so the batch
  // reunites; otherwise a new active row is created for just that subset.
  // The archived row shrinks to whatever wasn't restored, or is deleted
  // entirely once nothing archived remains of it.
  async function handleRestore(rec, sampleIds) {
    if (!archiveRestoreGate.allowed) {
      notify?.("Guest access can't restore archived records — this login is view-only for this action.", "warn");
      return;
    }
    const isBatch = !!(rec.memberSampleIds && rec.memberSampleIds.length);
    const allMemberIds = isBatch ? rec.memberSampleIds : rec.sampleId ? [rec.sampleId] : [];
    const idsToRestore = sampleIds && sampleIds.length ? sampleIds : allMemberIds;
    const restoringAll = !isBatch || idsToRestore.length >= allMemberIds.length;
    setRestoringId(rec.id);
    // Un-hide these samples from the Sample Registration list — the mirror
    // image of what archiveReleasedMembers() (13-testrecords-ui.js) does
    // when archiving. A sample marked archived only because THIS record's
    // test was archived becomes visible again the moment any part of it is
    // restored; nothing here needs to check whether other tests are still
    // pending, since setting archived:false is only ever wrong if the
    // sample was already active (in which case this is a harmless no-op).
    if (setSamples) {
      const idSet = new Set(idsToRestore);
      const changedSamples = [];
      const nextSamples = (samples || []).map(s => {
        if (!idSet.has(s.id) || !s.archived) return s;
        const updated = {
          ...s,
          archived: false,
          archivedAt: null
        };
        changedSamples.push(updated);
        return updated;
      });
      if (changedSamples.length) setSamples(() => nextSamples, changedSamples);
    }
    try {
      if (restoringAll) {
        const restored = await DataService.restoreRecord(rec.id, rec);
        setTestRecords(prev => prev.some(r => r.id === restored.id) ? prev : [...prev, restored]);
        setResults(prev => prev.filter(r => r.id !== rec.id));
        const n = restored.memberSampleIds?.length || 1;
        DataService.appendAudit({
          entity: "testRecord",
          entityId: rec.id,
          action: "restore",
          user: session.username,
          role: session.role,
          note: `Restored "${rec.testTypeName}" (${rec.date}, ${n} sample${n > 1 ? "s" : ""})`
        });
        notify(`Restored "${rec.testTypeName}" (${rec.date}, ${n} sample${n > 1 ? "s" : ""}) back to active Test Records.`, "ok");
        return;
      }
      // Partial restore of a batch.
      const restoredMemberResults = (rec.memberResults || []).filter(m => idsToRestore.includes(m.sampleId));
      const remainingMemberIds = allMemberIds.filter(id => !idsToRestore.includes(id));
      const remainingMemberResults = (rec.memberResults || []).filter(m => !idsToRestore.includes(m.sampleId));
      const originId = rec.originRecordId || rec.id;
      const activeTestRecordsArr = await DataService.list("testRecords");
      const activeSibling = activeTestRecordsArr.find(r => r.id === originId);
      if (activeSibling) {
        const merged = {
          ...activeSibling,
          memberSampleIds: [...new Set([...(activeSibling.memberSampleIds || []), ...idsToRestore])],
          memberResults: [...(activeSibling.memberResults || []), ...restoredMemberResults]
        };
        await DataService.save("testRecords", merged);
        setTestRecords(prev => prev.map(r => r.id === merged.id ? merged : r));
      } else {
        const {
          archivedAt,
          archivedSampleSnapshots,
          originRecordId,
          ...rest
        } = rec;
        const newActiveRecord = {
          ...rest,
          id: originId,
          memberSampleIds: idsToRestore,
          memberResults: restoredMemberResults
        };
        await DataService.save("testRecords", newActiveRecord);
        setTestRecords(prev => prev.some(r => r.id === newActiveRecord.id) ? prev.map(r => r.id === newActiveRecord.id ? newActiveRecord : r) : [...prev, newActiveRecord]);
      }
      if (remainingMemberIds.length === 0) {
        await DataService.remove("archived_records", rec.id);
        setResults(prev => prev.filter(r => r.id !== rec.id));
      } else {
        const trimmedArchived = {
          ...rec,
          memberSampleIds: remainingMemberIds,
          memberResults: remainingMemberResults,
          archivedSampleSnapshots: (rec.archivedSampleSnapshots || []).filter(s => remainingMemberIds.includes(s.id))
        };
        await DataService.save("archived_records", trimmedArchived);
        setResults(prev => prev.map(r => r.id === rec.id ? trimmedArchived : r));
      }
      DataService.appendAudit({
        entity: "testRecord",
        entityId: rec.id,
        action: "restore",
        user: session.username,
        role: session.role,
        note: `Restored ${idsToRestore.length} sample(s) of "${rec.testTypeName}" (${rec.date}) back to active Test Records`
      });
      notify(`Restored ${idsToRestore.length} sample${idsToRestore.length > 1 ? "s" : ""} back to active Test Records.`, "ok");
    } catch (e) {
      notify(`Restore failed: ${e.message}`, "warn");
    } finally {
      setRestoringId(null);
    }
  }
  // A "Not Yet Archived" search hit (see handleArchiveQuery_ / the
  // fetchArchivedRecords fallback) is a genuine, still-live testRecord that
  // has simply aged out of the app's normal active window. Most of the time
  // "Bring Back to Active" (below) is the right move; this is the secondary
  // option for a record that's actually done and Released, letting someone
  // file it into Archive right away instead of waiting for the next daily
  // sweep. Mirrors runArchiveSweep()'s own rule (ArchiveService.gs): only
  // ever archives once every member sample's requestedTest for this test
  // type is Released — blocked otherwise, same as the automatic sweep would
  // skip it. A member sample that's no longer in the fast windowed
  // `samples` list can't be checked either way, so (being a one-off,
  // explicit admin action rather than an unattended daily job) it's allowed
  // through rather than blocked on a check that simply can't be done here.
  async function handleArchiveNow(rec) {
    if (!archiveRestoreGate.allowed) {
      notify?.("Guest access can't file records into Archive — this login is view-only for this action.", "warn");
      return;
    }
    const sampleIds = rec.memberSampleIds && rec.memberSampleIds.length ? rec.memberSampleIds : rec.sampleId ? [rec.sampleId] : [];
    const notReleased = sampleIds.filter(id => {
      const s = (samples || []).find(x => x.id === id);
      if (!s) return false; // can't verify — let it through, see comment above
      const rt = (s.requestedTests || []).find(t => t.testTypeId === rec.testTypeId);
      return rt && rt.status !== "released";
    });
    if (notReleased.length) {
      notify?.(`Can't archive — ${notReleased.length} sample${notReleased.length > 1 ? "s" : ""} on this record ${notReleased.length > 1 ? "haven't" : "hasn't"} been Released yet.`, "warn");
      return;
    }
    setArchivingId(rec.id);
    try {
      const archivedSampleSnapshots = sampleIds.map(id => {
        const s = (samples || []).find(x => x.id === id);
        return s ? {
          id: s.id,
          sampleCode: s.sampleCode,
          clientName: s.clientName,
          village: s.village,
          union: s.union,
          upazila: s.upazila,
          referenceId: s.referenceId,
          clientType: s.clientType
        } : { id };
      });
      const archivedRecord = {
        ...rec,
        archivedAt: new Date().toISOString(),
        archivedSampleSnapshots
      };
      delete archivedRecord._notYetArchived;
      delete archivedRecord._archiveSheet;
      delete archivedRecord.restoredAt;
      await DataService.save("archived_records", archivedRecord);
      await DataService.remove("testRecords", rec.id);
      setTestRecords(prev => prev.filter(r => r.id !== rec.id));
      setResults(prev => prev.map(r => r.id === rec.id ? { ...archivedRecord, _archiveSheet: "archived_records" } : r));
      DataService.appendAudit({
        entity: "testRecord",
        entityId: rec.id,
        action: "archive",
        user: session?.username,
        role: session?.role,
        note: `Manually filed "${rec.testTypeName}" (${rec.date}) into Archive from a Recall search — it had aged out of the active window without ever being archived.`
      }).catch(() => {});
      notify?.(`"${rec.testTypeName}" (${rec.date}) is now properly filed in Archive.`, "ok");
    } catch (e) {
      notify?.(`Couldn't file this into Archive: ${e.message}`, "warn");
    } finally {
      setArchivingId(null);
    }
  }
  // The PRIMARY fix for "I can't retrieve this from Archive": a
  // "_notYetArchived" hit is already sitting live in testRecords — it was
  // never actually moved anywhere. It just needs to be marked recently
  // restored so isWithinActiveWindow_ (Code.gs) counts it as active again,
  // exactly like a real Archive restore does — no sheet move needed since
  // it never left testRecords in the first place.
  async function handleReviveRecord(rec) {
    if (!archiveRestoreGate.allowed) {
      notify?.("Guest access can't bring records back to active — this login is view-only for this action.", "warn");
      return;
    }
    setRestoringId(rec.id);
    try {
      const revived = { ...rec, restoredAt: new Date().toISOString() };
      delete revived._notYetArchived;
      delete revived._archiveSheet;
      await DataService.save("testRecords", revived);
      setTestRecords(prev => prev.some(r => r.id === rec.id) ? prev.map(r => r.id === rec.id ? revived : r) : [...prev, revived]);
      setResults(prev => prev.map(r => r.id === rec.id ? revived : r));
      DataService.appendAudit({
        entity: "testRecord",
        entityId: rec.id,
        action: "restore",
        user: session?.username,
        role: session?.role,
        note: `Brought "${rec.testTypeName}" (${rec.date}) back to active Test Records from a Recall search — it had aged out of the active window without ever being archived.`
      }).catch(() => {});
      notify?.(`"${rec.testTypeName}" (${rec.date}) is back in active Test Records.`, "ok");
    } catch (e) {
      notify?.(`Couldn't bring this back to active: ${e.message}`, "warn");
    } finally {
      setRestoringId(null);
    }
  }
  const allRows = React.useMemo(() => results.flatMap(rec => archivedRecordRows(rec, testTypes)), [results, testTypes]);
  const totalCount = viewMode === "flat" ? allRows.length : results.length;
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Search Archive",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "archive",
      size: 16,
      color: C.teal
    })
  }, /*#__PURE__*/React.createElement(Banner, {
    tone: "info",
    storageKey: "archive-tab-intro"
  }, "Completed (Released) test records get moved here from Test Records to keep the active dataset fast — search for them any time, reprint their certificate, export to CSV, or restore one back to active records. This search also finds records that simply aged out of the day-to-day list (e.g. an old/back-dated Test Date) but were never formally archived — those show a \"Not Yet Archived\" badge with a one-click option to file them in properly."), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 mb-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Sample ID",
    value: filters.sampleId,
    onChange: e => patchFilter("sampleId", e.target.value),
    placeholder: "e.g. RNP-2026-000014"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Client Name / Reference / Tracking No.",
    value: filters.clientName,
    onChange: e => patchFilter("clientName", e.target.value),
    placeholder: "Client, organization, or Ref/Tracking No."
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Sub-Batch",
    value: filters.subBatch,
    onChange: e => patchFilter("subBatch", e.target.value),
    placeholder: "Sub-batch label/tracking"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Parameter / Test",
    value: filters.parameter,
    onChange: e => patchFilter("parameter", e.target.value),
    placeholder: "e.g. Iron, pH"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Date From",
    type: "date",
    value: filters.dateFrom,
    onChange: e => patchFilter("dateFrom", e.target.value)
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Date To",
    type: "date",
    value: filters.dateTo,
    onChange: e => patchFilter("dateTo", e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => runSearch(filters),
    loading: loading
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 13
  }), "Search"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: clearFilters,
    disabled: loading
  }, "Clear Filters"))), /*#__PURE__*/React.createElement(SectionCard, {
    title: `Archived Records (${totalCount})`,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    }),
    right: /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 flex-wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "inline-flex rounded-lg p-0.5",
      style: {
        background: C.bg,
        border: `1px solid ${C.border}`
      }
    }, [{
      k: "flat",
      label: "Flat View",
      icon: "list"
    }, {
      k: "batch",
      label: "Group by Batch",
      icon: "layers"
    }].map(v => /*#__PURE__*/React.createElement("button", {
      key: v.k,
      type: "button",
      onClick: () => {
        setViewMode(v.k);
        // Switching into Group by Batch always starts collapsed, even if a
        // previous visit to this view had some batches left expanded.
        if (v.k === "batch") setCollapsedBatches(new Set(results.map(r => r.id)));
      },
      className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
      style: {
        background: viewMode === v.k ? C.card : "transparent",
        color: viewMode === v.k ? C.ink : C.muted,
        boxShadow: viewMode === v.k ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: v.icon,
      size: 13
    }), v.label))), allRows.length > 0 && /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: () => exportArchivedRecordsCsv(allRows)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "download",
      size: 13
    }), "Export CSV"))
  }, error && /*#__PURE__*/React.createElement(Banner, {
    tone: "danger"
  }, "Couldn't load the archive: ", error), !error && loading && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-xs py-6 justify-center",
    style: {
      color: C.muted
    }
  }, /*#__PURE__*/React.createElement(Spinner, {
    size: 14
  }), "Searching the archive…"), !error && !loading && totalCount === 0 && /*#__PURE__*/React.createElement(EmptyState, {
    icon: "archive",
    title: hasSearched ? "No archived records match" : "Enter a search above",
    subtitle: hasSearched ? "Try a different Sample ID, client name/reference, sub-batch, parameter, or widen the date range." : "Type any filter (or leave everything blank for all records) and click Search — nothing loads automatically."
  }), !error && !loading && totalCount > 0 && viewMode === "flat" && /*#__PURE__*/React.createElement(FlatArchiveTable, {
    rows: allRows,
    samples: samples,
    testTypes: testTypes,
    goToSample: goToSample,
    onPrint: (rec, sampleId) => printArchivedRecord(rec, testTypes, sampleId),
    onRestore: handleRestore,
    canRestore: canRestore,
    restoringId: restoringId,
    onArchiveNow: handleArchiveNow,
    onReviveRecord: handleReviveRecord,
    archivingId: archivingId
  }), !error && !loading && totalCount > 0 && viewMode === "batch" && /*#__PURE__*/React.createElement(BatchArchiveGroups, {
    records: results,
    samples: samples,
    testTypes: testTypes,
    goToSample: goToSample,
    onPrint: (rec, sampleId) => printArchivedRecord(rec, testTypes, sampleId),
    onRestore: handleRestore,
    canRestore: canRestore,
    restoringId: restoringId,
    onArchiveNow: handleArchiveNow,
    onReviveRecord: handleReviveRecord,
    archivingId: archivingId,
    collapsedBatches: collapsedBatches,
    onToggleCollapsed: toggleBatchCollapsed
  })));
}

// ---- Flat View: one row per (sample, parameter) fact, with a Batch column
// so it's clear at a glance which archived run each row came from. Restore
// only appears on rows from a legacy individual record (a "batch of one",
// so restoring the row IS restoring the whole record) — for any row that
// belongs to a multi-sample Analytical Batch, restoring is only offered
// from Group-by-Batch view below, since a single flat row can never
// unambiguously represent "send this whole batch back". ----
function FlatArchiveTable({
  rows,
  samples,
  testTypes,
  goToSample,
  onPrint,
  onRestore,
  canRestore,
  restoringId,
  onArchiveNow,
  onReviveRecord,
  archivingId
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["Sample ID", "Batch", "Completion Date", "Parameter", "Result", "Status", "Actions"].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1.5 sticky top-0",
    style: {
      background: C.card,
      borderBottom: `1px solid ${C.border}`,
      color: C.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, rows.map(row => {
    const sampleExists = row.sample?.id && (samples || []).some(s => s.id === row.sample.id);
    return /*#__PURE__*/React.createElement("tr", {
      key: row.key,
      style: {
        borderBottom: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5 font-semibold"
    }, sampleExists && goToSample ? /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "underline",
      style: {
        color: C.ink
      },
      onClick: () => goToSample(row.sample.id)
    }, row.sample.sampleCode || "—") : /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.ink
      }
    }, row.sample?.sampleCode || row.record.sampleCode || "—")), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.muted
      }
    }, archiveBatchLabel(row.record)), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.muted
      }
    }, row.record.date || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.ink
      }
    }, row.record.testTypeName || "—"), row.paramName !== "—" && row.paramName !== row.record.testTypeName && /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.muted
      }
    }, row.paramName)), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: row.value != null ? C.ok : row.error ? C.warn : C.muted
      }
    }, resultCell(row)), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: row.record._notYetArchived ? "warn" : "ok",
      title: row.record._notYetArchived ? "Aged out of the active window but never formally archived" : row.record.archivedAt ? `Archived ${row.record.archivedAt.slice(0, 10)}` : undefined
    }, row.record._notYetArchived ? "Not Yet Archived" : "Released")), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-1.5"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-1"
    }, /*#__PURE__*/React.createElement(IconButton, {
      name: "printer",
      color: C.info,
      title: row.isBatch ? "Print this sample only" : "Print / Generate Report",
      onClick: () => onPrint(row.record, row.sample?.id)
    }), row.record._notYetArchived && onReviveRecord && /*#__PURE__*/React.createElement(IconButton, {
      name: "restore",
      color: C.teal,
      title: "Bring back to active Test Records",
      disabled: restoringId === row.record.id,
      onClick: () => onReviveRecord(row.record)
    }), row.record._notYetArchived && onArchiveNow && /*#__PURE__*/React.createElement(IconButton, {
      name: "archive",
      color: C.warn,
      title: "File this into Archive now (skip waiting for the next sweep)",
      disabled: archivingId === row.record.id,
      onClick: () => onArchiveNow(row.record)
    }), !row.isBatch && !row.record._notYetArchived && canRestore && /*#__PURE__*/React.createElement(IconButton, {
      name: "restore",
      color: C.teal,
      title: "Restore to active Test Records",
      disabled: restoringId === row.record.id,
      onClick: () => onRestore(row.record)
    }))));
  }))));
}

// ---- Group by Batch: one section per archived record, header carries the
// batch-level actions (Print whole batch, Restore whole batch); the rows
// inside are for reading only (plus an optional single-sample reprint), so
// there is exactly one place to restore a multi-sample batch and it can't
// be triggered by mistake for just one member. ----
function BatchArchiveGroups({
  records,
  samples,
  testTypes,
  goToSample,
  onPrint,
  onRestore,
  canRestore,
  restoringId,
  onArchiveNow,
  onReviveRecord,
  archivingId,
  collapsedBatches,
  onToggleCollapsed
}) {
  const groupEls = records.map(rec => {
    const rows = archivedRecordRows(rec, testTypes);
    const isCollapsed = collapsedBatches.has(rec.id);
    const sampleCount = rec.memberSampleIds?.length || (rec.sampleId ? 1 : 0);
    const headerEl = React.createElement("div", {
      className: "flex items-center gap-2 px-3 py-2 flex-wrap",
      style: {
        background: C.bg,
        cursor: "pointer"
      },
      onClick: () => onToggleCollapsed(rec.id)
    }, React.createElement(Icon, {
      name: isCollapsed ? "chevronRight" : "chevronDown",
      size: 14,
      color: C.muted
    }), React.createElement("span", {
      className: "font-semibold text-sm",
      style: {
        color: C.ink
      }
    }, archiveBatchLabel(rec)), React.createElement(Badge, {
      tone: rec._notYetArchived ? "warn" : "ok",
      title: rec._notYetArchived ? "Aged out of the active window but never formally archived" : undefined
    }, rec._notYetArchived ? "Not Yet Archived" : "Released"), React.createElement("span", {
      className: "text-xs",
      style: {
        color: C.muted
      }
    }, `${rec.testTypeName || "—"} · ${rec.date || "—"} · ${sampleCount} sample${sampleCount === 1 ? "" : "s"}`), React.createElement("span", {
      className: "flex-1"
    }), React.createElement("div", {
      className: "flex items-center gap-1",
      onClick: e => e.stopPropagation()
    }, React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: () => onPrint(rec, null)
    }, React.createElement(Icon, {
      name: "printer",
      size: 13
    }), "Print Batch"), rec._notYetArchived && onReviveRecord ? React.createElement(Button, {
      size: "sm",
      onClick: () => onReviveRecord(rec),
      loading: restoringId === rec.id
    }, React.createElement(Icon, {
      name: "restore",
      size: 13
    }), "Bring Back to Active") : null, rec._notYetArchived && onArchiveNow ? React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: () => onArchiveNow(rec),
      loading: archivingId === rec.id
    }, React.createElement(Icon, {
      name: "archive",
      size: 13
    }), "Archive Now") : !rec._notYetArchived && canRestore && React.createElement(Button, {
      size: "sm",
      onClick: () => onRestore(rec),
      loading: restoringId === rec.id
    }, React.createElement(Icon, {
      name: "restore",
      size: 13
    }), "Restore Batch")));
    const tableRows = rows.map(row => {
      const sampleExists = row.sample?.id && (samples || []).some(s => s.id === row.sample.id);
      const sampleCell = sampleExists && goToSample ? React.createElement("button", {
        type: "button",
        className: "underline",
        style: {
          color: C.ink
        },
        onClick: () => goToSample(row.sample.id)
      }, row.sample.sampleCode || "—") : React.createElement("span", {
        style: {
          color: C.ink
        }
      }, row.sample?.sampleCode || rec.sampleCode || "—");
      return React.createElement("tr", {
        key: row.key,
        style: {
          borderBottom: `1px solid ${C.border}`
        }
      }, React.createElement("td", {
        className: "px-2 py-1.5 font-semibold"
      }, sampleCell), React.createElement("td", {
        className: "px-2 py-1.5",
        style: {
          color: C.ink
        }
      }, row.paramName), React.createElement("td", {
        className: "px-2 py-1.5",
        style: {
          color: row.value != null ? C.ok : row.error ? C.warn : C.muted
        }
      }, resultCell(row)), React.createElement("td", {
        className: "px-2 py-1.5"
      }, React.createElement(IconButton, {
        name: "printer",
        color: C.info,
        title: "Print this sample only",
        onClick: () => onPrint(rec, row.sample?.id)
      }), canRestore && !rec._notYetArchived && row.sample?.id && React.createElement(IconButton, {
        name: "restore",
        color: C.teal,
        title: "Restore this sample only",
        disabled: restoringId === rec.id,
        onClick: () => onRestore(rec, [row.sample.id])
      })));
    });
    const theadEl = React.createElement("thead", null, React.createElement("tr", null, ["Sample ID", "Parameter", "Result", "Actions"].map(h => React.createElement("th", {
      key: h,
      className: "text-left px-2 py-1.5",
      style: {
        borderBottom: `1px solid ${C.border}`,
        color: C.muted
      }
    }, h))));
    const tbodyEl = React.createElement("tbody", null, tableRows);
    const tableEl = isCollapsed ? null : React.createElement("div", {
      className: "overflow-x-auto"
    }, React.createElement("table", {
      className: "w-full text-xs border-collapse"
    }, theadEl, tbodyEl));
    return React.createElement("div", {
      key: rec.id,
      className: "rounded-lg",
      style: {
        border: `1px solid ${C.border}`
      }
    }, headerEl, tableEl);
  });
  return React.createElement("div", {
    className: "grid gap-3"
  }, groupEls);
}

// ============================================================================
// Archive Settings — admin-configurable thresholds for the automatic Archive
// sweep (runArchiveSweep(), ArchiveService.gs, runs daily) and for how long a
// manually-restored record is protected before it's eligible to be archived
// again. Stored server-side (the "archiveSettings" singleton collection —
// see getArchiveSettings_()/ARCHIVE_SETTINGS_DEFAULTS in ArchiveService.gs),
// NOT in browser localStorage, because the daily sweep trigger runs entirely
// server-side with no browser involved and needs to read the same value
// every admin sees here.
// ============================================================================
function ArchiveSettingsModal({ onClose, notify }) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState(null);

  React.useEffect(function() {
    let cancelled = false;
    DataService.getArchiveSettings().then(function(s) {
      if (!cancelled) setSettings(s);
    }).catch(function() {
      if (!cancelled) setSettings({ archiveAfterDays: { testRecords: 730 }, restoreGraceDays: 90 });
    }).finally(function() {
      if (!cancelled) setLoading(false);
    });
    return function() { cancelled = true; };
  }, []);

  function setDays(v) {
    const n = v === "" ? "" : Math.max(1, Math.round(Number(v) || 0));
    setSettings(prev => ({ ...prev, archiveAfterDays: { ...prev.archiveAfterDays, testRecords: n } }));
  }
  function setGraceDays(v) {
    const n = v === "" ? "" : Math.max(0, Math.round(Number(v) || 0));
    setSettings(prev => ({ ...prev, restoreGraceDays: n }));
  }

  async function handleSave() {
    // Guard against saving "" (a cleared input mid-edit) as an actual value
    // — fall back to the existing safe defaults for anything left blank.
    const clean = {
      archiveAfterDays: {
        testRecords: settings.archiveAfterDays.testRecords || 730
      },
      restoreGraceDays: settings.restoreGraceDays === "" || settings.restoreGraceDays == null ? 90 : settings.restoreGraceDays
    };
    setSaving(true);
    try {
      await DataService.saveArchiveSettings(clean);
      notify?.("Archive settings saved. The daily archive sweep will use these values from its next run.", "ok");
      onClose();
    } catch (e) {
      notify?.(`Couldn't save Archive Settings: ${e.message}`, "warn");
    } finally {
      setSaving(false);
    }
  }

  return /*#__PURE__*/React.createElement(Modal, {
    title: "Archive Settings",
    onClose: onClose,
    wide: true
  }, loading || !settings ? /*#__PURE__*/React.createElement("div", {
    className: "text-sm py-6 text-center",
    style: { color: C.muted }
  }, "Loading…") : /*#__PURE__*/React.createElement(React.Fragment, null,
    React.createElement("div", {
      className: "text-xs mb-4",
      style: { color: C.muted }
    }, "Controls the automatic Archive sweep that runs once a day (", React.createElement("code", null, "runArchiveSweep()"), "). Archiving only ever applies to Test Records, and only once every sample a record covers has that specific test fully Released — an old-but-not-yet-released test is never auto-archived, no matter how much time has passed. Changes apply from the sweep's next run — nothing already archived gets moved back by changing these numbers."),

    React.createElement("div", {
      className: "font-semibold text-xs mb-2",
      style: { color: C.ink }
    }, "Archive a fully-Released test record after this many days"),
    React.createElement("div", {
      className: "text-xs mb-3",
      style: { color: C.muted }
    }, "Counted from the record's own Test Date — not from when it was last touched — and only once nothing on it is still pending."),
    React.createElement("div", {
      className: "grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4"
    },
      React.createElement(TextField, {
        simple: true,
        label: "Days",
        type: "number",
        min: 1,
        value: settings.archiveAfterDays.testRecords,
        onChange: setDays
      })
    ),

    React.createElement("div", {
      className: "h-px mb-4",
      style: { background: C.border }
    }),

    React.createElement("div", {
      className: "font-semibold text-xs mb-2",
      style: { color: C.ink }
    }, "Restore grace period"),
    React.createElement("div", {
      className: "text-xs mb-3",
      style: { color: C.muted }
    }, "When you restore a record from Archive (see the Archive tab), it stays visible in Test Records and protected from the sweep above for this many days — even if its own date is old. After that, the normal \"days since its own date\" rule above applies again and it can be archived once more."),
    React.createElement("div", {
      className: "grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2"
    },
      React.createElement(TextField, {
        simple: true,
        label: "Days",
        type: "number",
        min: 0,
        value: settings.restoreGraceDays,
        onChange: setGraceDays
      })
    ),

    React.createElement("div", {
      className: "mt-4 flex justify-end gap-2"
    },
      React.createElement(Button, { variant: "outline", onClick: onClose }, "Cancel"),
      React.createElement(Button, { onClick: handleSave, loading: saving },
        React.createElement(Icon, { name: "check", size: 13 }), "Save"
      )
    )
  ));
}

// ============================================================================
// PERFORMANCE NOTES — how this reduces API calls / load lag as the archive
// grows (see the reply this was discussed in for the full explanation):
//
// 1. Nothing archived is ever part of the initial app payload. 99-app.js's
//    boot sequence never calls fetchArchivedRecords — this tab only queries
//    DataService when it's actually opened, and only for whatever a search
//    matches. A 50,000-row archive costs nothing until someone searches it.
// 2. Archiving shrinks the ACTIVE dataset. testRecords (loaded/saved as one
//    JSON blob on every app boot and every edit) only holds records that
//    still matter operationally; the day-to-day list, search, and render
//    cost of Test Records / Sample lookups stays flat over time instead of
//    growing with the lab's total historical output.
// 3. Archived records are self-contained (archivedSampleSnapshots). Reading,
//    printing, or exporting one never has to join back against the live
//    `samples` collection, so there's no N+1 lookup cost as the archive
//    grows, and archived data stays readable even after a live sample is
//    later edited or deleted.
// 4. `archived_records` is its own storage collection, independent of
//    `testRecords`/`samples`. It can be paged, filtered, or (once on a real
//    backend) indexed without touching the hot path the rest of the app
//    runs on every render.
// ============================================================================
