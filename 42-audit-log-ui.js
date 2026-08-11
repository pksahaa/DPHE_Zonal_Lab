// ===== 42-audit-log-ui.js =====
// ============================================================================
// AUDIT LOG — read-only viewer over DataService.getAudit() (01-data-service.js).
// Entries are written from several places as things actually happen:
//   - sample status changes (setSamples wrapper, 99-app.js)
//   - test record create/edit/delete/archive/restore (13-testrecords-ui.js,
//     18-archive-ui.js)
//   - test type create/edit/delete (12-testtypes-ui.js)
//   - parameter create/edit/delete (12a-parameters-ui.js)
//   - sub-batch create/edit/delete (21-sample-ui.js)
//   - inventory: chemical/glassware/equipment/gas create/edit/delete, plus
//     nested actions (batches, cylinders, equipment events, glassware
//     move/refill/mark-empty/mark-broken) and bulk imports (11-inventory-ui.js)
//   - user create/edit/delete/activate/deactivate, permission matrix edits
//     (41-rbac-ui.js)
// This tab never writes anything — it only searches and displays. Like
// Archive, nothing here is fetched during the app's initial load; it only
// queries when this tab is opened or a search is run, so a growing audit
// history never weighs down day-to-day use of the app.
// ============================================================================

const AUDIT_ENTITY_OPTIONS = [{
  value: "sample",
  label: "Sample"
}, {
  value: "testRecord",
  label: "Test Record"
}, {
  value: "testType",
  label: "Test Type"
}, {
  value: "parameter",
  label: "Parameter"
}, {
  value: "subBatch",
  label: "Sub-Batch"
}, {
  value: "chemical",
  label: "Chemical"
}, {
  value: "glassware",
  label: "Glassware"
}, {
  value: "equipment",
  label: "Equipment"
}, {
  value: "gas",
  label: "Gas"
}, {
  value: "user",
  label: "User"
}, {
  value: "permissionMatrix",
  label: "Permission Matrix"
}];
const AUDIT_EMPTY_FILTERS = {
  entity: "",
  user: "",
  action: "",
  dateFrom: "",
  dateTo: ""
};
function auditEntryLabel(entry) {
  if (entry.entity === "sample" && entry.sampleCode) return entry.sampleCode;
  if (entry.note) return entry.note;
  return entry.entityId || "—";
}
function auditActionTone(action) {
  const a = (action || "").toLowerCase();
  if (a === "delete") return "danger";
  if (a === "create") return "ok";
  if (a === "archive" || a === "restore") return "info";
  return "muted";
}
function exportAuditLogCsv(entries) {
  const header = ["Timestamp", "User", "Role", "Entity", "Entity ID", "Action", "Note"];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(",")];
  entries.forEach(e => {
    lines.push([e.ts, e.user, e.role, e.entity, e.entityId, e.action, e.note || ""].map(esc).join(","));
  });
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_log_${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function AuditLogTab({
  session,
  permissionMatrix
}) {
  const [filters, setFilters] = React.useState(AUDIT_EMPTY_FILTERS);
  const [entries, setEntries] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [hasSearched, setHasSearched] = React.useState(false);
  const canView = can(permissionMatrix, session, "auditLog", "view");
  const runSearch = React.useCallback(async activeFilters => {
    setLoading(true);
    setError(null);
    try {
      const filterFn = entry => {
        if (activeFilters.entity && entry.entity !== activeFilters.entity) return false;
        if (activeFilters.user && !(entry.user || "").toLowerCase().includes(activeFilters.user.trim().toLowerCase())) return false;
        if (activeFilters.action && !(entry.action || "").toLowerCase().includes(activeFilters.action.trim().toLowerCase())) return false;
        const day = (entry.ts || "").slice(0, 10);
        if (activeFilters.dateFrom && day < activeFilters.dateFrom) return false;
        if (activeFilters.dateTo && day > activeFilters.dateTo) return false;
        return true;
      };
      const rows = await DataService.getAudit(filterFn);
      rows.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
      setEntries(rows);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, []);
  React.useEffect(() => {
    if (canView) runSearch(AUDIT_EMPTY_FILTERS);
    // eslint-disable-next-line
  }, []);
  function patchFilter(key, value) {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }
  function clearFilters() {
    setFilters(AUDIT_EMPTY_FILTERS);
    runSearch(AUDIT_EMPTY_FILTERS);
  }
  if (!canView) {
    return React.createElement(SectionCard, {
      title: "Audit Log",
      icon: React.createElement(Icon, {
        name: "clipboard",
        size: 16,
        color: C.teal
      })
    }, React.createElement(Banner, {
      tone: "info"
    }, "You don't have permission to view the audit log. Ask an Administrator to grant Audit Log → View if you need access."));
  }
  const headerCells = ["Timestamp", "User", "Entity", "Reference", "Action", "Note"].map(h => React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1.5 sticky top-0",
    style: {
      background: C.card,
      borderBottom: `1px solid ${C.border}`,
      color: C.muted
    }
  }, h));
  const bodyRows = entries.map(e => React.createElement("tr", {
    key: e.id,
    style: {
      borderBottom: `1px solid ${C.border}`
    }
  }, React.createElement("td", {
    className: "px-2 py-1.5",
    style: {
      color: C.muted,
      whiteSpace: "nowrap"
    }
  }, (e.ts || "").replace("T", " ").slice(0, 19)), React.createElement("td", {
    className: "px-2 py-1.5"
  }, React.createElement("div", {
    style: {
      color: C.ink
    }
  }, e.user || "—"), React.createElement("div", {
    style: {
      color: C.muted
    }
  }, e.role || "")), React.createElement("td", {
    className: "px-2 py-1.5",
    style: {
      color: C.ink
    }
  }, e.entity || "—"), React.createElement("td", {
    className: "px-2 py-1.5",
    style: {
      color: C.muted
    }
  }, auditEntryLabel(e)), React.createElement("td", {
    className: "px-2 py-1.5"
  }, React.createElement(Badge, {
    tone: auditActionTone(e.action)
  }, e.action || "—")), React.createElement("td", {
    className: "px-2 py-1.5",
    style: {
      color: C.muted
    }
  }, e.note || "—")));
  return React.createElement("div", {
    className: "grid gap-4"
  }, React.createElement(SectionCard, {
    title: "Search Audit Log",
    icon: React.createElement(Icon, {
      name: "clipboard",
      size: 16,
      color: C.teal
    })
  }, React.createElement(Banner, {
    tone: "info",
    storageKey: "audit-log-intro"
  }, "Every logged action is permanent — this screen is read-only by design. Inventory changes aren't logged yet; sample, test record, test type, and user/permission changes are."), React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 mb-3"
  }, React.createElement(SelectField, {
    label: "Entity",
    value: filters.entity,
    onChange: v => patchFilter("entity", v),
    simple: true,
    placeholder: "All Entities",
    options: AUDIT_ENTITY_OPTIONS
  }), React.createElement(TextField, {
    label: "User",
    value: filters.user,
    onChange: e => patchFilter("user", e.target.value),
    placeholder: "Search username"
  }), React.createElement(TextField, {
    label: "Action",
    value: filters.action,
    onChange: e => patchFilter("action", e.target.value),
    placeholder: "e.g. create, delete, released"
  }), React.createElement(TextField, {
    label: "Date From",
    type: "date",
    value: filters.dateFrom,
    onChange: e => patchFilter("dateFrom", e.target.value)
  }), React.createElement(TextField, {
    label: "Date To",
    type: "date",
    value: filters.dateTo,
    onChange: e => patchFilter("dateTo", e.target.value)
  })), React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement(Button, {
    size: "sm",
    onClick: () => runSearch(filters),
    loading: loading
  }, React.createElement(Icon, {
    name: "search",
    size: 13
  }), "Search"), React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: clearFilters,
    disabled: loading
  }, "Clear Filters"))), React.createElement(SectionCard, {
    title: `Audit Entries (${entries.length})`,
    icon: React.createElement(Icon, {
      name: "shield",
      size: 16,
      color: C.teal
    }),
    right: entries.length > 0 && React.createElement(Button, {
      size: "sm",
      variant: "outline",
      onClick: () => exportAuditLogCsv(entries)
    }, React.createElement(Icon, {
      name: "download",
      size: 13
    }), "Export CSV")
  }, error && React.createElement(Banner, {
    tone: "danger"
  }, "Couldn't load the audit log: ", error), !error && loading && React.createElement("div", {
    className: "flex items-center gap-2 text-xs py-6 justify-center",
    style: {
      color: C.muted
    }
  }, React.createElement(Spinner, {
    size: 14
  }), "Searching the audit log…"), !error && !loading && entries.length === 0 && React.createElement(EmptyState, {
    icon: "clipboard",
    title: hasSearched ? "No audit entries match" : "No activity yet",
    subtitle: hasSearched ? "Try a different entity, user, action, or widen the date range." : "Actions across the app will start showing up here as they happen."
  }), !error && !loading && entries.length > 0 && React.createElement("div", {
    className: "overflow-x-auto"
  }, React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, React.createElement("thead", null, React.createElement("tr", null, headerCells)), React.createElement("tbody", null, bodyRows)))));
}
