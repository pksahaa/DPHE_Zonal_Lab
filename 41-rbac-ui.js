// ===== 41-rbac-ui.js =====
// ============================================================================
// RBAC — Users management + a Module × Action permission matrix.
//
// This file adds module-level gating (View / Create / Edit / Delete) for
// most of the app — Test Records, Test Types, Inventory, References,
// Sub-Batches, QC, Reports, Archive, Users, Audit Log, Settings — plus a
// "Guest" role that can view but never modify anything, anywhere. Every
// module here also supports a per-user override (session.overrides,
// resolved by can() below) so one person's access can be tightened or
// loosened without splitting them into a new role.
//
// The Sample Lifecycle's own fine-grained stage permissions (register /
// assign / enter results / review / approve / release — see
// ROLE_PERMISSIONS / permissionsFor() in 20-sample-model.js) used to be
// entirely separate and role-only, with no per-user override support. It's
// now folded into the SAME matrix + override mechanism as a "samples"
// module (SAMPLE_MODULE below) — same can()-style resolution order
// (Administrator > per-user override > role default), same "Custom
// permissions for this user" editor, just with its own action set and its
// own dedicated grid (its 6 actions don't fit the generic View/Create/
// Edit/Delete columns every other module uses, so it's rendered as a
// second small table inside PermissionMatrixPanel and
// UserPermissionOverridesEditor below, instead). The
// underlying storage (permissionMatrix[role].samples,
// user.permissionOverrides.samples) and resolution logic
// (permissionsFor(matrix, session) in 20-sample-model.js) are otherwise
// identical in shape to every other module — see the comment there for why
// that logic isn't just a call to can() from this file.
//
// Honest limitation: this is enforcement inside the UI, not on a server.
// Until the GAS backend also checks role per request, someone with
// dev-tools access could bypass a client-side gate. It's still real
// protection against ordinary mistakes and mis-clicks, and it's the
// necessary foundation for server-side checks later.
// ============================================================================

// ALL_ROLES is the seed list only — the live set of roles is dynamic (see
// "Add Role" / "Delete Role" in PermissionMatrixPanel below, and
// rolesFromMatrix() / PermissionMatrixPanel's editableRoles). Anyone with Users & Permissions access
// can create a brand-new role from scratch (starts with everything
// unchecked) or remove a custom one that's no longer in use. This array
// only supplies the DEFAULT_PERMISSION_MATRIX's starting set on a fresh
// install / first backfill.
const ALL_ROLES = ["Administrator", "Sample Analyzer", "Reviewer", "QA Manager", "Junior Chemist", "Senior Chemist", "Chief Chemist", "Executive Engineer", "Superintendent Engineer", "Guest"];
// The live, current role list — every place that used to read the fixed
// ALL_ROLES constant for "what roles exist" (role dropdowns, the
// Permission Matrix's role tabs) now reads this instead, so a role created
// or deleted at runtime (see PermissionMatrixPanel's Add Role / Delete Role
// below) shows up everywhere immediately. Administrator is always pinned
// first since it's the one role that's never shown as editable/deletable.
function rolesFromMatrix(matrix) {
  const keys = Object.keys(matrix || {});
  const rest = keys.filter(k => k !== "Administrator").sort((a, b) => a.localeCompare(b));
  return keys.includes("Administrator") ? ["Administrator", ...rest] : rest;
}
const PERMISSION_MODULES = [{
  key: "testRecords",
  label: "Test Records",
  actions: ["view", "create", "edit", "delete"]
}, {
  key: "testTypes",
  label: "Test Types & QC Rules",
  actions: ["view", "create", "edit", "delete"]
}, {
  key: "inventory",
  label: "Inventory (Chemicals / Equipment / Gas / Glassware)",
  actions: ["view", "create", "edit", "delete"]
}, {
  key: "references",
  label: "References",
  actions: ["view", "create", "edit", "delete"]
}, {
  key: "subBatches",
  label: "Sub-Batches",
  actions: ["view", "create", "edit", "delete"]
}, {
  key: "qc",
  label: "QC Module",
  actions: ["view", "create", "edit"]
}, {
  key: "reports",
  label: "Reports",
  actions: ["view", "create"]
}, {
  key: "archive",
  label: "Archive (Edit = Restore)",
  actions: ["view", "edit"]
}, {
  key: "users",
  label: "Users & Permissions",
  actions: ["view", "create", "edit", "delete"]
}, {
  key: "auditLog",
  label: "Audit Log",
  actions: ["view"]
}, {
  key: "settings",
  label: "Backend Settings",
  actions: ["view", "edit"]
}];
// ---- Sample Lifecycle "module" — same matrix/override mechanism as every
// module above, but its own action set (register/assign/enter results/
// review/approve/release), so it's kept out of PERMISSION_MODULES (whose
// generic grids assume the shared view/create/edit/delete columns) and
// rendered with its own dedicated grid instead. See permissionsFor() in
// 20-sample-model.js for how this is actually resolved at runtime.
const SAMPLE_MODULE = {
  key: "samples",
  label: "Samples — Register / Assign / Review / Approve / Release",
  actions: SAMPLE_PERMISSION_ACTIONS // ["canRegister","canAssign","canEnterResults","canReview","canApprove","canRelease"] — from 20-sample-model.js
};
const SAMPLE_ACTION_LABELS = {
  canRegister: "Register",
  canAssign: "Assign",
  canEnterResults: "Enter Results",
  canReview: "Review",
  canApprove: "Approve",
  canRelease: "Release"
};
function emptyModulePerms(actions, value) {
  const o = {};
  (actions || ["view", "create", "edit", "delete"]).forEach(a => {
    o[a] = value;
  });
  return o;
}
function buildRolePerms(overrides) {
  const perms = {};
  PERMISSION_MODULES.forEach(m => {
    perms[m.key] = {
      ...emptyModulePerms(m.actions, false),
      ...(overrides?.[m.key] || {})
    };
  });
  return perms;
}
function allTrueOverrides() {
  const o = {};
  PERMISSION_MODULES.forEach(m => {
    o[m.key] = emptyModulePerms(m.actions, true);
  });
  return o;
}
function viewOnlyOverrides() {
  const o = {};
  PERMISSION_MODULES.forEach(m => {
    o[m.key] = {
      ...emptyModulePerms(m.actions, false),
      view: true
    };
  });
  return o;
}
const DEFAULT_PERMISSION_MATRIX = {
  Administrator: buildRolePerms(allTrueOverrides()),
  "Sample Analyzer": buildRolePerms({
    testRecords: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    testTypes: {
      view: true,
      create: false,
      edit: false,
      delete: false
    },
    inventory: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    references: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    subBatches: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    qc: {
      view: true,
      create: true,
      edit: false
    },
    reports: {
      view: true,
      create: true
    },
    archive: {
      view: true,
      edit: false
    }
  }),
  Reviewer: buildRolePerms({
    testRecords: {
      view: true
    },
    testTypes: {
      view: true
    },
    inventory: {
      view: true
    },
    references: {
      view: true
    },
    subBatches: {
      view: true
    },
    qc: {
      view: true
    },
    reports: {
      view: true
    },
    archive: {
      view: true
    }
  }),
  "QA Manager": buildRolePerms({
    testRecords: {
      view: true,
      edit: true
    },
    testTypes: {
      view: true
    },
    inventory: {
      view: true
    },
    references: {
      view: true,
      create: true,
      edit: true
    },
    subBatches: {
      view: true,
      create: true,
      edit: true
    },
    qc: {
      view: true,
      edit: true
    },
    reports: {
      view: true,
      create: true
    },
    archive: {
      view: true,
      edit: true
    },
    users: {
      view: true
    },
    auditLog: {
      view: true
    }
  }),
  // ---- DPHE lab hierarchy roles (added alongside the generic RBAC
  // roles above) ----
  // Junior Chemist — works under the Senior Chemist; day-to-day bench work
  // much like Sample Analyzer, but is sometimes put in charge of a District
  // Laboratory, so also gets Assign on the Samples grid below.
  "Junior Chemist": buildRolePerms({
    testRecords: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    testTypes: {
      view: true,
      create: false,
      edit: false,
      delete: false
    },
    inventory: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    references: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    subBatches: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    qc: {
      view: true,
      create: true,
      edit: false
    },
    reports: {
      view: true,
      create: true
    },
    archive: {
      view: true,
      edit: false
    }
  }),
  // Senior Chemist — head of a Zonal Laboratory: full operational control
  // of that lab's day-to-day modules, plus the whole Sample Lifecycle
  // (register through release), but not Users/Settings (that's reserved
  // for the Chief Chemist / Administrator above them).
  "Senior Chemist": buildRolePerms({
    testRecords: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    testTypes: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    inventory: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    references: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    subBatches: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    qc: {
      view: true,
      create: true,
      edit: true
    },
    reports: {
      view: true,
      create: true
    },
    archive: {
      view: true,
      edit: true
    },
    users: {
      view: true
    },
    auditLog: {
      view: true
    }
  }),
  // Chief Chemist — superior of the Senior Chemist, so gets everything a
  // Senior Chemist has plus delete rights on Test Types/Inventory and
  // oversight (view+edit) on Users, matching a chemist-side counterpart
  // to QA Manager/Administrator without touching Backend Settings.
  "Chief Chemist": buildRolePerms({
    testRecords: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    testTypes: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    inventory: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    references: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    subBatches: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    qc: {
      view: true,
      create: true,
      edit: true
    },
    reports: {
      view: true,
      create: true
    },
    archive: {
      view: true,
      edit: true
    },
    users: {
      view: true,
      create: false,
      edit: true,
      delete: false
    },
    auditLog: {
      view: true
    },
    settings: {
      view: true
    }
  }),
  // Executive Engineer — responsible for purchasing everything the
  // laboratory needs, so full control of Inventory (Chemicals/Equipment/
  // Gas/Glassware) and its reports, but no role in running the Sample
  // Lifecycle itself (see the "samples" seed just below).
  "Executive Engineer": buildRolePerms({
    testRecords: {
      view: true
    },
    testTypes: {
      view: true
    },
    inventory: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    references: {
      view: true
    },
    subBatches: {
      view: true
    },
    qc: {
      view: true
    },
    reports: {
      view: true,
      create: true
    },
    archive: {
      view: true
    }
  }),
  // Superintendent Engineer — head of the whole DPHE Laboratory (above
  // every Zonal Lab), so gets broad cross-module authority including
  // Users/Audit Log/Settings oversight, on par with Administrator for
  // day-to-day purposes even though Administrator remains the only role
  // that's always-fully-trusted by can()/permissionsFor() below.
  "Superintendent Engineer": buildRolePerms({
    testRecords: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    testTypes: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    inventory: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    references: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    subBatches: {
      view: true,
      create: true,
      edit: true,
      delete: true
    },
    qc: {
      view: true,
      create: true,
      edit: true
    },
    reports: {
      view: true,
      create: true
    },
    archive: {
      view: true,
      edit: true
    },
    users: {
      view: true,
      create: true,
      edit: true,
      delete: false
    },
    auditLog: {
      view: true
    },
    settings: {
      view: true,
      edit: false
    }
  }),
  Guest: buildRolePerms({
    ...viewOnlyOverrides(),
    users: emptyModulePerms(["view", "create", "edit", "delete"], false),
    auditLog: emptyModulePerms(["view"], false),
    settings: emptyModulePerms(["view", "edit"], false)
  })
};

// "samples" isn't in PERMISSION_MODULES (see SAMPLE_MODULE above), so
// buildRolePerms() above never touched it — seed it here from the same
// ROLE_PERMISSIONS defaults 20-sample-model.js's permissionsFor() has
// always fallen back to, so behavior for every existing role is unchanged
// the moment this ships.
ALL_ROLES.forEach(role => {
  DEFAULT_PERMISSION_MATRIX[role].samples = {
    ...(role === "Administrator" ? emptyModulePerms(SAMPLE_MODULE.actions, true) : ROLE_PERMISSIONS[role] || NO_SAMPLE_PERMISSIONS)
  };
});

// A permissionMatrix already saved in localStorage from before this change
// won't have a "samples" key on any role (loadKey() returns the stored
// blob as-is, ignoring DEFAULT_PERMISSION_MATRIX's new default entirely).
// Called once on load (see AppRoot in 99-app.js) to backfill it in place —
// same idempotent-migration pattern the sample/sub-batch model uses
// elsewhere in this app. A no-op for a fresh install (DEFAULT_PERMISSION_MATRIX
// already has "samples" from the block above) or a matrix that's already
// been through this once.
function backfillSamplePermissions(matrix) {
  const next = { ...(matrix || {}) };
  ALL_ROLES.forEach(role => {
    // A role entirely missing from a matrix saved before this role existed
    // (e.g. an install made before Senior Chemist/Chief Chemist/Executive
    // Engineer/Superintendent Engineer/Junior Chemist were added) seeds from
    // DEFAULT_PERMISSION_MATRIX's full, hand-picked defaults for that role —
    // not a blank buildRolePerms({}) — so it shows up with its intended
    // starting permissions instead of silently losing every module
    // permission except Samples the first time an existing install loads.
    const existingRole = next[role] || DEFAULT_PERMISSION_MATRIX[role] || buildRolePerms({});
    if (existingRole.samples) {
      next[role] = existingRole;
      return;
    }
    next[role] = {
      ...existingRole,
      samples: {
        ...(role === "Administrator" ? emptyModulePerms(SAMPLE_MODULE.actions, true) : ROLE_PERMISSIONS[role] || NO_SAMPLE_PERMISSIONS)
      }
    };
  });
  return next;
}

// Administrator is always fully trusted, even if the persisted matrix is
// somehow missing or mid-migration — never let a corrupted settings blob
// lock every Administrator out of their own permission screen. Below
// Administrator, a per-user override (session.overrides) always wins over
// the role's own matrix default when present, so an individual account can
// be tightened or loosened without having to split them into a new role.
function can(matrix, session, moduleKey, action) {
  const role = session?.role;
  if (role === "Administrator") return true;
  const override = session?.overrides?.[moduleKey]?.[action];
  if (override === true || override === false) return override;
  return !!matrix?.[role]?.[moduleKey]?.[action];
}
function roleModulePerms(matrix, role, moduleKey) {
  if (role === "Administrator") return {
    view: true,
    create: true,
    edit: true,
    delete: true
  };
  return matrix?.[role]?.[moduleKey] || {};
}

// ---- permGate(): the one place that decides how an action control reacts
// to a missing permission, for every module in the app.
//
// Two different UX rules by design:
//   - Guest is meant to browse the whole app like an Administrator would —
//     every button stays visible, including ones it can't use — but a click
//     on something it isn't permitted for is blocked with a message instead
//     of running. This is the "admin-like read-only demo" persona pks asked
//     for: nothing hidden, nothing silently broken.
//   - Every other role (Sample Analyzer / Reviewer / QA Manager, or any role with
//     a tightened per-user override) keeps the existing convention: a
//     control it has no permission for is hidden entirely, same as it's
//     always been elsewhere in this app.
//
// Usage at a call site:
//   const glassEdit = permGate(permissionMatrix, session, "inventory", "edit", notify, "edit glassware");
//   ...
//   glassEdit.visible && React.createElement(IconButton, {
//     onClick: glassEdit.guard(() => setEditGlassFor(g)), ...
//   })
//
// `guard()` also doubles as defense-in-depth: even if a handler is somehow
// invoked directly (not just via the wrapped onClick), it still won't run
// past the permission check.
function permGate(matrix, session, moduleKey, action, notify, actionLabel) {
  const allowed = can(matrix, session, moduleKey, action);
  const isGuest = session?.role === "Guest";
  return {
    allowed,
    visible: allowed || isGuest,
    guard(handler) {
      return (...args) => {
        if (allowed) return handler(...args);
        notify?.(`Guest access can't ${actionLabel || "do that"} — this login is view-only for this action.`, "warn");
      };
    }
  };
}

// ---- Users & Permissions tab (Administrator only — gated in 99-app.js's
// nav array before this even renders) ----
function UsersAdminTab({
  users,
  setUsers,
  permissionMatrix,
  setPermissionMatrix,
  session,
  notify
}) {
  const [subTab, setSubTab] = React.useState("users"); // "users" | "permissions"
  const [formUser, setFormUser] = React.useState(null); // null = closed, {} = new, {...user} = edit
  const [resetTarget, setResetTarget] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const canCreate = can(permissionMatrix, session, "users", "create");
  const canEdit = can(permissionMatrix, session, "users", "edit");
  const canDelete = can(permissionMatrix, session, "users", "delete");
  function activeAdminCount(list) {
    return list.filter(u => u.role === "Administrator" && u.active !== false).length;
  }
  async function handleSaveUser(payload) {
    if (payload.id) {
      const patch = {
        username: payload.username.trim(),
        name: payload.name.trim(),
        designation: payload.designation.trim(),
        role: payload.role,
        permissionOverrides: payload.permissionOverrides || {}
      };
      setUsers(prev => prev.map(u => u.id === payload.id ? {
        ...u,
        ...patch
      } : u));
      const overrideCount = Object.keys(patch.permissionOverrides).length;
      DataService.appendAudit({
        entity: "user",
        entityId: payload.id,
        action: "edit",
        user: session.username,
        role: session.role,
        note: `Updated user "${patch.username}" (role: ${patch.role}${overrideCount ? `, ${overrideCount} custom permission module(s)` : ""})`
      });
      notify(`Updated "${patch.username}".`, "ok");
    } else {
      const passwordHash = await hashPassword(payload.password);
      const newUser = {
        id: uid("user"),
        username: payload.username.trim(),
        passwordHash,
        name: payload.name.trim(),
        designation: payload.designation.trim(),
        role: payload.role,
        permissionOverrides: payload.permissionOverrides || {},
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: session.username
      };
      setUsers(prev => [...prev, newUser]);
      DataService.appendAudit({
        entity: "user",
        entityId: newUser.id,
        action: "create",
        user: session.username,
        role: session.role,
        note: `Created user "${newUser.username}" (role: ${newUser.role})`
      });
      notify(`Created "${newUser.username}".`, "ok");
    }
    setFormUser(null);
  }
  async function handleResetPassword(id, newPassword) {
    const passwordHash = await hashPassword(newPassword);
    setUsers(prev => prev.map(u => u.id === id ? {
      ...u,
      passwordHash
    } : u));
    const target = users.find(u => u.id === id);
    DataService.appendAudit({
      entity: "user",
      entityId: id,
      action: "edit",
      user: session.username,
      role: session.role,
      note: `Password reset for "${target?.username || id}"`
    });
    notify(`Password reset for "${target?.username || "user"}".`, "ok");
    setResetTarget(null);
  }
  function handleToggleActive(u) {
    const nextActive = u.active === false ? true : false;
    if (!nextActive && u.role === "Administrator" && activeAdminCount(users) <= 1) {
      notify("Can't deactivate the last active Administrator.", "warn");
      return;
    }
    setUsers(prev => prev.map(x => x.id === u.id ? {
      ...x,
      active: nextActive
    } : x));
    DataService.appendAudit({
      entity: "user",
      entityId: u.id,
      action: "edit",
      user: session.username,
      role: session.role,
      note: `${nextActive ? "Reactivated" : "Deactivated"} user "${u.username}"`
    });
  }
  function handleDeleteConfirmed(u) {
    if (u.id === session.userId) {
      notify("You can't delete your own account while logged in.", "warn");
      setDeleteTarget(null);
      return;
    }
    if (u.role === "Administrator" && activeAdminCount(users) <= 1) {
      notify("Can't delete the last active Administrator.", "warn");
      setDeleteTarget(null);
      return;
    }
    setUsers(prev => prev.filter(x => x.id !== u.id));
    DataService.appendAudit({
      entity: "user",
      entityId: u.id,
      action: "delete",
      user: session.username,
      role: session.role,
      note: `Deleted user "${u.username}"`
    });
    notify(`Deleted "${u.username}".`, "ok");
    setDeleteTarget(null);
  }
  function saveMatrixForRole(role, nextRolePerms) {
    setPermissionMatrix(prev => ({
      ...prev,
      [role]: nextRolePerms
    }));
    DataService.appendAudit({
      entity: "permissionMatrix",
      entityId: role,
      action: "edit",
      user: session.username,
      role: session.role,
      note: `Updated permission matrix for role "${role}"`
    });
    notify(`Saved permissions for ${role}.`, "ok");
  }
  // A brand-new role starts with everything unchecked — the same blank
  // slate buildRolePerms({}) already gives every module, plus NO_SAMPLE_
  // PERMISSIONS for the Samples grid — so it can't accidentally grant
  // access to anything until an Administrator explicitly turns permissions
  // on and saves. See rolesFromMatrix() above for how this shows up
  // everywhere (role dropdowns, matrix tabs) the moment it's added.
  function handleAddRole(name) {
    setPermissionMatrix(prev => ({
      ...prev,
      [name]: {
        ...buildRolePerms({}),
        samples: { ...NO_SAMPLE_PERMISSIONS }
      }
    }));
    DataService.appendAudit({
      entity: "permissionMatrix",
      entityId: name,
      action: "create",
      user: session.username,
      role: session.role,
      note: `Created role "${name}"`
    });
    notify(`Created role "${name}" — set its permissions below, then Save.`, "ok");
  }
  function handleDeleteRole(role) {
    setPermissionMatrix(prev => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
    DataService.appendAudit({
      entity: "permissionMatrix",
      entityId: role,
      action: "delete",
      user: session.username,
      role: session.role,
      note: `Deleted role "${role}"`
    });
    notify(`Deleted role "${role}".`, "ok");
  }
  const toggleBar = React.createElement("div", {
    className: "inline-flex rounded-lg p-0.5 mb-3",
    style: {
      background: C.bg,
      border: `1px solid ${C.border}`
    }
  }, [{
    k: "users",
    label: "Users",
    icon: "users"
  }, {
    k: "permissions",
    label: "Permission Matrix",
    icon: "shield"
  }].map(v => React.createElement("button", {
    key: v.k,
    type: "button",
    onClick: () => setSubTab(v.k),
    className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
    style: {
      background: subTab === v.k ? C.card : "transparent",
      color: subTab === v.k ? C.ink : C.muted,
      boxShadow: subTab === v.k ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
    }
  }, React.createElement(Icon, {
    name: v.icon,
    size: 13
  }), v.label)));
  return React.createElement("div", {
    className: "grid gap-4"
  }, toggleBar, subTab === "users" ? React.createElement(UsersListPanel, {
    users: users,
    session: session,
    canCreate: canCreate,
    canEdit: canEdit,
    canDelete: canDelete,
    onAdd: () => setFormUser({}),
    onEdit: u => setFormUser(u),
    onResetPassword: u => setResetTarget(u),
    onToggleActive: handleToggleActive,
    onDelete: u => setDeleteTarget(u)
  }) : React.createElement(PermissionMatrixPanel, {
    permissionMatrix: permissionMatrix,
    canEdit: canEdit,
    onSaveRole: saveMatrixForRole,
    onAddRole: handleAddRole,
    onDeleteRole: handleDeleteRole,
    users: users,
    notify: notify
  }), formUser && React.createElement(UserFormModal, {
    initial: formUser,
    existingUsernames: users.filter(u => u.id !== formUser.id).map(u => u.username.toLowerCase()),
    permissionMatrix: permissionMatrix,
    onClose: () => setFormUser(null),
    onSave: handleSaveUser
  }), resetTarget && React.createElement(ResetPasswordModal, {
    user: resetTarget,
    onClose: () => setResetTarget(null),
    onSave: pw => handleResetPassword(resetTarget.id, pw)
  }), deleteTarget && React.createElement(Modal, {
    title: "Delete User",
    onClose: () => setDeleteTarget(null)
  }, React.createElement("div", {
    className: "p-4 grid gap-3"
  }, React.createElement(Banner, {
    tone: "danger"
  }, `Delete "${deleteTarget.username}"? This can't be undone.`), React.createElement("div", {
    className: "flex justify-end gap-2"
  }, React.createElement(Button, {
    variant: "outline",
    onClick: () => setDeleteTarget(null)
  }, "Cancel"), React.createElement(Button, {
    onClick: () => handleDeleteConfirmed(deleteTarget)
  }, "Delete")))));
}

// ---- Users list table ----
function UsersListPanel({
  users,
  session,
  canCreate,
  canEdit,
  canDelete,
  onAdd,
  onEdit,
  onResetPassword,
  onToggleActive,
  onDelete
}) {
  const headerRight = canCreate ? React.createElement(Button, {
    size: "sm",
    onClick: onAdd
  }, React.createElement(Icon, {
    name: "plus",
    size: 13
  }), "Add User") : null;
  const headerCells = ["Username", "Name", "Designation", "Role", "Status", "Actions"].map(h => React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1.5",
    style: {
      borderBottom: `1px solid ${C.border}`,
      color: C.muted
    }
  }, h));
  const bodyRows = (users || []).map(u => {
    const isSelf = u.id === session.userId;
    const isActive = u.active !== false;
    const roleCell = React.createElement("div", {
      className: "flex items-center gap-1 flex-wrap"
    }, React.createElement(Badge, {
      tone: u.role === "Administrator" ? "danger" : u.role === "Guest" ? "muted" : "info"
    }, u.role), Object.keys(u.permissionOverrides || {}).length > 0 && React.createElement(Badge, {
      tone: "info",
      title: "This user has custom per-module permission overrides"
    }, "Custom"));
    const statusCell = React.createElement(Badge, {
      tone: isActive ? "ok" : "muted"
    }, isActive ? "Active" : "Inactive");
    const actionCell = React.createElement("div", {
      className: "flex items-center gap-1"
    }, canEdit && React.createElement(IconButton, {
      name: "edit",
      color: C.teal,
      title: "Edit user",
      onClick: () => onEdit(u)
    }), canEdit && React.createElement(IconButton, {
      name: "lock",
      color: C.info,
      title: "Reset password",
      onClick: () => onResetPassword(u)
    }), canEdit && React.createElement(IconButton, {
      name: isActive ? "x" : "check",
      color: isActive ? C.warn : C.ok,
      title: isActive ? "Deactivate" : "Reactivate",
      onClick: () => onToggleActive(u)
    }), canDelete && React.createElement(IconButton, {
      name: "trash",
      color: C.warn,
      title: isSelf ? "You can't delete your own account" : "Delete user",
      disabled: isSelf,
      onClick: () => onDelete(u)
    }));
    return React.createElement("tr", {
      key: u.id,
      style: {
        borderBottom: `1px solid ${C.border}`
      }
    }, React.createElement("td", {
      className: "px-2 py-1.5 font-semibold",
      style: {
        color: C.ink
      }
    }, u.username, isSelf && React.createElement("span", {
      className: "ml-1 text-[10px]",
      style: {
        color: C.muted
      }
    }, "(you)")), React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.ink
      }
    }, u.name || "—"), React.createElement("td", {
      className: "px-2 py-1.5",
      style: {
        color: C.muted
      }
    }, u.designation || "—"), React.createElement("td", {
      className: "px-2 py-1.5"
    }, roleCell), React.createElement("td", {
      className: "px-2 py-1.5"
    }, statusCell), React.createElement("td", {
      className: "px-2 py-1.5"
    }, actionCell));
  });
  const table = React.createElement("div", {
    className: "overflow-x-auto"
  }, React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, React.createElement("thead", null, React.createElement("tr", null, headerCells)), React.createElement("tbody", null, bodyRows)));
  return React.createElement(SectionCard, {
    title: `Users (${(users || []).length})`,
    icon: React.createElement(Icon, {
      name: "users",
      size: 16,
      color: C.teal
    }),
    right: headerRight
  }, table);
}

// ---- Create / Edit user modal ----
function cleanOverrides(overrides) {
  const cleaned = {};
  Object.keys(overrides || {}).forEach(moduleKey => {
    const moduleOverrides = {};
    Object.keys(overrides[moduleKey] || {}).forEach(action => {
      const v = overrides[moduleKey][action];
      if (v === true || v === false) moduleOverrides[action] = v;
    });
    if (Object.keys(moduleOverrides).length > 0) cleaned[moduleKey] = moduleOverrides;
  });
  return cleaned;
}
function overrideCellState(overrides, moduleKey, action) {
  const v = overrides?.[moduleKey]?.[action];
  if (v === true) return "allow";
  if (v === false) return "deny";
  return "inherit";
}
function nextOverrideState(current) {
  if (current === "inherit") return "allow";
  if (current === "allow") return "deny";
  return "inherit";
}

// ---- Compact per-user permission override grid, shown inside the user
// form. Every cell starts as "Inherit" (follows the role's own Permission
// Matrix setting) — only cells someone deliberately clicks become an
// explicit Allow/Deny that overrides the role default for this one person.
function UserPermissionOverridesEditor({
  role,
  permissionMatrix,
  overrides,
  onChange
}) {
  const ALL_ACTIONS = ["view", "create", "edit", "delete"];
  function cycle(moduleKey, action) {
    const current = overrideCellState(overrides, moduleKey, action);
    const next = nextOverrideState(current);
    const nextValue = next === "allow" ? true : next === "deny" ? false : undefined;
    const nextModule = {
      ...(overrides[moduleKey] || {})
    };
    if (nextValue === undefined) {
      delete nextModule[action];
    } else {
      nextModule[action] = nextValue;
    }
    onChange({
      ...overrides,
      [moduleKey]: nextModule
    });
  }
  const headerCells = ["Module", ...ALL_ACTIONS.map(a => a[0].toUpperCase() + a.slice(1))].map(h => React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1 text-[11px]",
    style: {
      borderBottom: `1px solid ${C.border}`,
      color: C.muted
    }
  }, h));
  const bodyRows = PERMISSION_MODULES.map(m => {
    const labelCell = React.createElement("td", {
      className: "px-2 py-1 text-[11px] font-medium",
      style: {
        color: C.ink
      }
    }, m.label);
    const roleDefaults = roleModulePerms(permissionMatrix, role, m.key);
    const actionCells = ALL_ACTIONS.map(a => {
      if (!m.actions.includes(a)) return React.createElement("td", {
        key: a,
        className: "px-2 py-1 text-center text-[11px]",
        style: {
          color: C.border
        }
      }, "—");
      const state = overrideCellState(overrides, m.key, a);
      const roleDefault = !!roleDefaults[a];
      const symbol = state === "allow" ? "✓" : state === "deny" ? "✕" : roleDefault ? "·✓" : "·✕";
      const color = state === "allow" ? C.ok : state === "deny" ? C.warn : C.muted;
      return React.createElement("td", {
        key: a,
        className: "px-2 py-1 text-center"
      }, React.createElement("button", {
        type: "button",
        title: state === "inherit" ? `Inheriting role default (${roleDefault ? "allowed" : "not allowed"}) — click to override` : state === "allow" ? "Explicitly allowed for this user — click to deny" : "Explicitly denied for this user — click to clear",
        onClick: () => cycle(m.key, a),
        className: "text-[11px] w-7 h-6 rounded",
        style: {
          color,
          background: state === "inherit" ? "transparent" : `${color}1a`,
          border: `1px solid ${state === "inherit" ? C.border : color}`
        }
      }, symbol));
    });
    return React.createElement("tr", {
      key: m.key
    }, labelCell, ...actionCells);
  });

  // Sample Lifecycle row — same cycle()/overrideCellState logic (both are
  // generic on moduleKey/action already), its own action set + labels, so
  // it's a second small table rather than forced into the generic
  // View/Create/Edit/Delete columns above. moduleKey is "samples" here,
  // resolved at runtime by permissionsFor() in 20-sample-model.js.
  const sampleHeaderCells = ["Module", ...SAMPLE_MODULE.actions.map(a => SAMPLE_ACTION_LABELS[a])].map(h => React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1 text-[11px]",
    style: {
      borderBottom: `1px solid ${C.border}`,
      color: C.muted
    }
  }, h));
  const sampleRoleDefaults = roleModulePerms(permissionMatrix, role, "samples");
  const sampleActionCells = SAMPLE_MODULE.actions.map(a => {
    const state = overrideCellState(overrides, "samples", a);
    const roleDefault = !!sampleRoleDefaults[a];
    const symbol = state === "allow" ? "✓" : state === "deny" ? "✕" : roleDefault ? "·✓" : "·✕";
    const color = state === "allow" ? C.ok : state === "deny" ? C.warn : C.muted;
    return React.createElement("td", {
      key: a,
      className: "px-2 py-1 text-center"
    }, React.createElement("button", {
      type: "button",
      title: state === "inherit" ? `Inheriting role default (${roleDefault ? "allowed" : "not allowed"}) — click to override` : state === "allow" ? "Explicitly allowed for this user — click to deny" : "Explicitly denied for this user — click to clear",
      onClick: () => cycle("samples", a),
      className: "text-[11px] w-7 h-6 rounded",
      style: {
        color,
        background: state === "inherit" ? "transparent" : `${color}1a`,
        border: `1px solid ${state === "inherit" ? C.border : color}`
      }
    }, symbol));
  });
  const sampleTable = React.createElement("div", {
    className: "overflow-x-auto mt-3"
  }, React.createElement("table", {
    className: "w-full border-collapse"
  }, React.createElement("thead", null, React.createElement("tr", null, sampleHeaderCells)), React.createElement("tbody", null, React.createElement("tr", null, React.createElement("td", {
    className: "px-2 py-1 text-[11px] font-medium",
    style: {
      color: C.ink
    }
  }, SAMPLE_MODULE.label), ...sampleActionCells))));

  return React.createElement("div", null, React.createElement("div", {
    className: "overflow-x-auto"
  }, React.createElement("table", {
    className: "w-full border-collapse"
  }, React.createElement("thead", null, React.createElement("tr", null, headerCells)), React.createElement("tbody", null, bodyRows))), sampleTable);
}
function UserFormModal({
  initial,
  existingUsernames,
  permissionMatrix,
  onClose,
  onSave
}) {
  const isEdit = !!initial.id;
  const [username, setUsername] = React.useState(initial.username || "");
  const [name, setName] = React.useState(initial.name || "");
  const [designation, setDesignation] = React.useState(initial.designation || "");
  const [role, setRole] = React.useState(initial.role || "Sample Analyzer");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [overrides, setOverrides] = React.useState(initial.permissionOverrides || {});
  const [showOverrides, setShowOverrides] = React.useState(Object.keys(initial.permissionOverrides || {}).length > 0);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function handleSubmit() {
    const cleanUsername = username.trim();
    if (!cleanUsername || /\s/.test(cleanUsername)) {
      setError("Username is required and can't contain spaces.");
      return;
    }
    if (existingUsernames.includes(cleanUsername.toLowerCase())) {
      setError("That username is already taken.");
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!isEdit) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
    }
    setError("");
    setSaving(true);
    await onSave({
      id: initial.id,
      username: cleanUsername,
      name,
      designation,
      role,
      password,
      permissionOverrides: cleanOverrides(overrides)
    });
    setSaving(false);
  }
  const roleOptions = rolesFromMatrix(permissionMatrix).map(r => ({
    value: r,
    label: r
  }));
  const overridesToggle = role === "Administrator" ? React.createElement(Banner, {
    tone: "info"
  }, "Administrator always has full access everywhere — per-user overrides don't apply to this role.") : React.createElement("div", null, React.createElement("button", {
    type: "button",
    onClick: () => setShowOverrides(!showOverrides),
    className: "text-xs font-medium flex items-center gap-1",
    style: {
      color: C.teal
    }
  }, React.createElement(Icon, {
    name: showOverrides ? "chevronDown" : "chevronRight",
    size: 12
  }), "Custom permissions for this user", Object.keys(cleanOverrides(overrides)).length > 0 && React.createElement(Badge, {
    tone: "info"
  }, `${Object.keys(cleanOverrides(overrides)).length} module(s) overridden`)), showOverrides && React.createElement("div", {
    className: "mt-2"
  }, React.createElement("p", {
    className: "text-[11px] mb-2",
    style: {
      color: C.muted
    }
  }, "Every cell starts as \"· inherits from the ", role, " role\". Click a cell to explicitly Allow (✓) or Deny (✕) it just for this user, overriding the role default — click again to clear it back to Inherit. The second, smaller table below (Register/Assign/Enter Results/Review/Approve/Release) works exactly the same way, for the Samples workflow specifically."), React.createElement(UserPermissionOverridesEditor, {
    role: role,
    permissionMatrix: permissionMatrix,
    overrides: overrides,
    onChange: setOverrides
  })));
  return React.createElement(Modal, {
    title: isEdit ? "Edit User" : "Add User",
    onClose: onClose,
    wide: true
  }, React.createElement("div", {
    className: "p-4 grid gap-3"
  }, error && React.createElement(Banner, {
    tone: "danger"
  }, error), React.createElement(TextField, {
    label: "Username",
    value: username,
    onChange: e => setUsername(e.target.value),
    simple: false
  }), React.createElement(TextField, {
    label: "Full Name",
    value: name,
    onChange: e => setName(e.target.value)
  }), React.createElement(TextField, {
    label: "Designation",
    value: designation,
    onChange: e => setDesignation(e.target.value),
    placeholder: "e.g. Senior Chemist"
  }), React.createElement(SelectField, {
    label: "Role",
    value: role,
    onChange: v => setRole(v),
    simple: true,
    options: roleOptions
  }), !isEdit && React.createElement(TextField, {
    label: "Password",
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value)
  }), !isEdit && React.createElement(TextField, {
    label: "Confirm Password",
    type: "password",
    value: confirmPassword,
    onChange: e => setConfirmPassword(e.target.value)
  }), overridesToggle, React.createElement("div", {
    className: "flex justify-end gap-2 mt-1"
  }, React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Cancel"), React.createElement(Button, {
    onClick: handleSubmit,
    loading: saving
  }, isEdit ? "Save Changes" : "Create User"))));
}

// ---- Reset password modal ----
function ResetPasswordModal({
  user,
  onClose,
  onSave
}) {
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function handleSubmit() {
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setSaving(true);
    await onSave(password);
    setSaving(false);
  }
  return React.createElement(Modal, {
    title: `Reset Password — ${user.username}`,
    onClose: onClose
  }, React.createElement("div", {
    className: "p-4 grid gap-3"
  }, error && React.createElement(Banner, {
    tone: "danger"
  }, error), React.createElement(TextField, {
    label: "New Password",
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value)
  }), React.createElement(TextField, {
    label: "Confirm New Password",
    type: "password",
    value: confirmPassword,
    onChange: e => setConfirmPassword(e.target.value)
  }), React.createElement("div", {
    className: "flex justify-end gap-2 mt-1"
  }, React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Cancel"), React.createElement(Button, {
    onClick: handleSubmit,
    loading: saving
  }, "Reset Password"))));
}

// ---- Permission Matrix editor (per-role Module × Action grid) ----
// Roles are dynamic now — this panel can create a brand-new role (starts
// with everything unchecked, exactly like any other blank slate) or delete
// a custom one that's no longer assigned to any active user. Administrator
// is never shown here; it's always fully trusted (see can()/permissionsFor()
// above) and isn't part of the editable set.
function PermissionMatrixPanel({
  permissionMatrix,
  canEdit,
  onSaveRole,
  onAddRole,
  onDeleteRole,
  users,
  notify
}) {
  const editableRoles = rolesFromMatrix(permissionMatrix).filter(r => r !== "Administrator");
  const [selectedRole, setSelectedRole] = React.useState(editableRoles[0] || null);
  const [draft, setDraft] = React.useState(() => permissionMatrix[selectedRole] || buildRolePerms({}));
  const [newRoleName, setNewRoleName] = React.useState("");
  const [addError, setAddError] = React.useState("");
  const [deleteConfirmRole, setDeleteConfirmRole] = React.useState(null);
  // Keeps selectedRole valid if the role it pointed at was just deleted
  // (by this admin, or — in a multi-tab session — from another tab).
  React.useEffect(() => {
    if (selectedRole && !editableRoles.includes(selectedRole)) {
      setSelectedRole(editableRoles[0] || null);
    }
    // eslint-disable-next-line
  }, [permissionMatrix]);
  React.useEffect(() => {
    setDraft(permissionMatrix[selectedRole] || buildRolePerms({}));
    // eslint-disable-next-line
  }, [selectedRole]);
  function toggleCell(moduleKey, action) {
    if (!canEdit) return;
    setDraft(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [action]: !prev[moduleKey]?.[action]
      }
    }));
  }
  function usersInRole(role) {
    return (users || []).filter(u => u.role === role && u.active !== false).length;
  }
  function handleAddRole() {
    const name = newRoleName.trim();
    if (!name) {
      setAddError("Enter a role name.");
      return;
    }
    if (name.length > 40) {
      setAddError("Keep the role name under 40 characters.");
      return;
    }
    if (name === "Administrator" || rolesFromMatrix(permissionMatrix).some(r => r.toLowerCase() === name.toLowerCase())) {
      setAddError(`A role named "${name}" already exists.`);
      return;
    }
    setAddError("");
    onAddRole(name);
    setSelectedRole(name);
    setNewRoleName("");
  }
  function requestDeleteRole(role) {
    const inUse = usersInRole(role);
    if (inUse > 0) {
      notify?.(`Can't delete "${role}" — ${inUse} active user(s) still have this role. Reassign them first.`, "warn");
      return;
    }
    setDeleteConfirmRole(role);
  }
  function confirmDeleteRole() {
    onDeleteRole(deleteConfirmRole);
    setDeleteConfirmRole(null);
  }
  const roleTabs = React.createElement("div", {
    className: "flex flex-wrap items-center gap-1.5 mb-2"
  }, editableRoles.map(r => React.createElement("div", {
    key: r,
    className: "inline-flex items-stretch"
  }, React.createElement("button", {
    type: "button",
    onClick: () => setSelectedRole(r),
    className: "px-3 py-1.5 rounded-l-md text-xs font-medium",
    style: {
      background: selectedRole === r ? C.teal : C.bg,
      color: selectedRole === r ? "#fff" : C.muted,
      border: `1px solid ${selectedRole === r ? C.teal : C.border}`,
      borderRight: "none"
    }
  }, r), canEdit && React.createElement("button", {
    type: "button",
    title: `Delete role "${r}"`,
    onClick: () => requestDeleteRole(r),
    className: "px-1.5 rounded-r-md text-xs font-semibold",
    style: {
      background: selectedRole === r ? C.teal : C.bg,
      color: selectedRole === r ? "#fff" : C.muted,
      border: `1px solid ${selectedRole === r ? C.teal : C.border}`,
      borderLeft: `1px solid ${selectedRole === r ? "rgba(255,255,255,0.45)" : C.border}`
    }
  }, "\u00D7"))));
  const addRoleRow = canEdit && React.createElement("div", {
    className: "flex flex-wrap items-center gap-2 mb-3"
  }, React.createElement("input", {
    type: "text",
    placeholder: "New role name…",
    value: newRoleName,
    onChange: e => {
      setNewRoleName(e.target.value);
      setAddError("");
    },
    onKeyDown: e => {
      if (e.key === "Enter") handleAddRole();
    },
    className: "border rounded px-2 py-1.5 text-xs",
    style: {
      borderColor: C.border,
      width: 220
    }
  }), React.createElement(Button, {
    variant: "outline",
    onClick: handleAddRole
  }, "+ Add Role"), addError && React.createElement("span", {
    className: "text-xs",
    style: {
      color: C.warn
    }
  }, addError));
  const deleteConfirmBar = deleteConfirmRole && React.createElement(ConfirmBar, {
    text: `Delete role "${deleteConfirmRole}"? This can't be undone — you'll need to recreate and reconfigure it from scratch if you want it back.`,
    onConfirm: confirmDeleteRole,
    onCancel: () => setDeleteConfirmRole(null)
  });
  const ALL_ACTIONS = ["view", "create", "edit", "delete"];
  const headerCells = ["Module", ...ALL_ACTIONS.map(a => a[0].toUpperCase() + a.slice(1))].map(h => React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1.5",
    style: {
      borderBottom: `1px solid ${C.border}`,
      color: C.muted
    }
  }, h));
  const bodyRows = PERMISSION_MODULES.map(m => {
    const labelCell = React.createElement("td", {
      className: "px-2 py-1.5 font-medium",
      style: {
        color: C.ink
      }
    }, m.label);
    const actionCells = ALL_ACTIONS.map(a => {
      const supported = m.actions.includes(a);
      return React.createElement("td", {
        key: a,
        className: "px-2 py-1.5 text-center"
      }, supported ? React.createElement("input", {
        type: "checkbox",
        checked: !!draft[m.key]?.[a],
        disabled: !canEdit,
        onChange: () => toggleCell(m.key, a)
      }) : React.createElement("span", {
        style: {
          color: C.border
        }
      }, "—"));
    });
    return React.createElement("tr", {
      key: m.key,
      style: {
        borderBottom: `1px solid ${C.border}`
      }
    }, labelCell, ...actionCells);
  });
  const table = React.createElement("div", {
    className: "overflow-x-auto"
  }, React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, React.createElement("thead", null, React.createElement("tr", null, headerCells)), React.createElement("tbody", null, bodyRows)));

  // Sample Lifecycle grid — same draft/toggleCell/canEdit, its own action
  // set + labels, kept as a second table since its 6 columns don't fit the
  // generic View/Create/Edit/Delete header above (see SAMPLE_MODULE note).
  const sampleHeaderCells = ["Module", ...SAMPLE_MODULE.actions.map(a => SAMPLE_ACTION_LABELS[a])].map(h => React.createElement("th", {
    key: h,
    className: "text-left px-2 py-1.5",
    style: {
      borderBottom: `1px solid ${C.border}`,
      color: C.muted
    }
  }, h));
  const sampleActionCells = SAMPLE_MODULE.actions.map(a => React.createElement("td", {
    key: a,
    className: "px-2 py-1.5 text-center"
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!draft.samples?.[a],
    disabled: !canEdit,
    onChange: () => toggleCell("samples", a)
  })));
  const sampleTable = React.createElement("div", {
    className: "overflow-x-auto mt-4"
  }, React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, React.createElement("thead", null, React.createElement("tr", null, sampleHeaderCells)), React.createElement("tbody", null, React.createElement("tr", null, React.createElement("td", {
    className: "px-2 py-1.5 font-medium",
    style: {
      color: C.ink
    }
  }, SAMPLE_MODULE.label), ...sampleActionCells))));

  const footer = React.createElement("div", {
    className: "flex justify-end gap-2 mt-3"
  }, React.createElement(Button, {
    variant: "outline",
    onClick: () => setDraft(permissionMatrix[selectedRole] || buildRolePerms({}))
  }, "Reset"), canEdit && React.createElement(Button, {
    disabled: !selectedRole,
    onClick: () => selectedRole && onSaveRole(selectedRole, draft)
  }, "Save Permissions"));
  const body = !selectedRole ? React.createElement(EmptyState, {
    icon: "shield",
    title: "No custom roles yet",
    subtitle: "Use \"+ Add Role\" above to create one — it starts with everything unchecked."
  }) : React.createElement(React.Fragment, null, table, sampleTable, footer);
  return React.createElement(SectionCard, {
    title: "Permission Matrix",
    icon: React.createElement(Icon, {
      name: "shield",
      size: 16,
      color: C.teal
    })
  }, React.createElement(Banner, {
    tone: "info",
    storageKey: "permission-matrix-intro"
  }, "Administrator always has full access everywhere and isn't shown here. Guest can be given \"View\" wherever you like but should stay unchecked on Create/Edit/Delete — that's what makes it a safe read-only account. The second table below (Register/Assign/Enter Results/Review/Approve/Release) sets the same defaults for the Samples workflow — register/assign/review/approve/release. Use \"+ Add Role\" to create a brand-new role with its own permissions, or the × on a role's tab to delete a custom one that's no longer in use."), roleTabs, addRoleRow, deleteConfirmBar, body);
}
