// ===== 03-sidebar-nav.js =====
// ============================================================================
// SIDEBAR NAVIGATION — replaces the old horizontal top-nav bar (99-app.js)
// with a left icon rail plus a horizontal, cascading multi-tier flyout menu
// (up to 3 tiers deep: Module → Sub-module → Sub-sub-module), collapsible
// into an icon-only rail, and a full slide-over drawer on mobile.
//
// Self-contained — only depends on things already global by the time it's
// USED (not necessarily by the time it's PARSED, since none of this runs
// until a component actually mounts, well after every script has loaded):
//   - React (UMD global)
//   - Icon, C  (00-core.js)
//   - loadKey, saveKey  (06-legacy-storage.js) — used lazily, inside a
//     useState initializer, so file load order relative to that file
//     doesn't matter.
//
// Wired into the app shell from 99-app.js: NAV_TREE (the module/sub-module
// data) is defined there, next to the state it needs to control, and
// <SidebarNav> is rendered instead of the old top-nav `.map()` block.
//
// Public API:
//   <SidebarNav
//     tree={NAV_TREE}                 // nested [{k,label,icon,moduleKey,moduleAction,children:[...]}]
//     activePath={["inventory","chemicals"]}   // current page, root→leaf
//     onNavigate={(path) => {...}}    // called with the full path when a LEAF is clicked
//     session={session}
//     permissionMatrix={permissionMatrix}
//     topOffset={56}                  // px height of whatever sits above it (slim top bar)
//     appName="Zonal Water Quality Lab"
//     appIcon="droplet"
//   />
// ============================================================================

const SIDEBAR_EXPANDED_W = 240;
const SIDEBAR_COLLAPSED_W = 64;
const FLYOUT_COL_W = 236;
const SIDEBAR_TRANSITION_MS = 200;

// ---- useSlideReveal(isOpen) ------------------------------------------------
// A flyout column needs to CSS-transition in AND out, but React normally
// mounts/unmounts instantly. This keeps the element mounted for one extra
// transition-duration after `isOpen` goes false (so the exit animation can
// play), and delays flipping the "shown" class by a frame after mount (so
// the enter animation has a starting state to transition FROM instead of
// popping straight to its resting state).
function useSlideReveal(isOpen) {
  const [mounted, setMounted] = React.useState(isOpen);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    let timer;
    if (isOpen) {
      setMounted(true);
      timer = setTimeout(() => setShown(true), 10);
    } else {
      setShown(false);
      timer = setTimeout(() => setMounted(false), SIDEBAR_TRANSITION_MS);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);
  return [mounted, shown];
}

function navIsPrefix(prefix, path) {
  if (!prefix || !path || prefix.length > path.length) return false;
  return prefix.every((v, i) => v === path[i]);
}

// Filters the top tier the same way the old horizontal nav did: hidden if
// the role/override truly can't view it, EXCEPT Guest, who sees every tab
// (including ones whose action it can't perform — the page itself blocks
// the actual mutation with a message; see permGate() in 41-rbac-ui.js).
// Users, Audit Log & Settings stay hidden from Guest specifically, since
// the default matrix denies Guest *view* access to those three at the
// permission level.
function filterNavTree(tree, session, permissionMatrix) {
  return tree.filter(item => {
    if (!item.moduleKey) return true;
    if (can(permissionMatrix, session, item.moduleKey, item.moduleAction || "view")) return true;
    return session?.role === "Guest" && item.moduleKey !== "users" && item.moduleKey !== "auditLog" && item.moduleKey !== "settings";
  });
}

// ---- One row inside a rail or a flyout column ------------------------------
function NavRow({ item, icon, label, active, expanded, hasChildren, onClick, onMouseEnter, onMouseLeave, iconOnly, dense }) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick,
    onMouseEnter,
    onMouseLeave,
    title: iconOnly ? label : undefined,
    "aria-haspopup": hasChildren ? "true" : undefined,
    "aria-expanded": hasChildren ? !!expanded : undefined,
    className: `sidebar-nav-item w-full flex items-center rounded-lg text-sm text-left transition-colors duration-150 ${iconOnly ? "justify-center px-0 py-2.5" : `gap-2.5 px-3 ${dense ? "py-2" : "py-2.5"}`}`,
    style: {
      background: expanded || active ? C.mutedBg : "transparent",
      color: active ? C.tealDark : C.ink,
      fontWeight: active ? 600 : 500
    }
  },
    icon && /*#__PURE__*/React.createElement(Icon, { name: icon, size: 16, color: active ? C.teal : C.muted }),
    !iconOnly && /*#__PURE__*/React.createElement("span", { className: "flex-1 truncate" }, label),
    !iconOnly && hasChildren && /*#__PURE__*/React.createElement(Icon, { name: "chevronRight", size: 13, color: expanded ? C.teal : C.muted }),
    iconOnly && active && /*#__PURE__*/React.createElement("span", {
      className: "absolute left-0 top-1/2 -translate-y-1/2 rounded-r",
      style: { width: 3, height: 20, background: C.teal }
    })
  );
}

// ---- One flyout column (tier 2 or tier 3) ----------------------------------
function FlyoutColumn({ items, depth, left, top, activePath, expandedPath, onExpand, onSelectLeaf, isOpen, registerRowRef, onMouseEnter, onMouseLeave, onScheduleHoverOpen, onCancelHoverOpen }) {
  const [mounted, shown] = useSlideReveal(isOpen);
  if (!mounted) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "sidebar-nav-flyout sidebar-scroll fixed rounded-xl shadow-xl overflow-y-auto transition-all ease-out",
    onMouseEnter,
    onMouseLeave,
    style: {
      left,
      top,
      // Height hugs its content (a handful of rows, never more than a
      // few dozen px each) instead of always stretching to the bottom of
      // the viewport — maxHeight is only a safety cap for the rare case
      // a column opens low enough that it would otherwise run off-screen.
      maxHeight: `calc(100vh - ${top}px - 12px)`,
      width: FLYOUT_COL_W,
      background: C.card,
      border: `1px solid ${C.border}`,
      zIndex: 55 + depth,
      padding: 8,
      transitionDuration: `${SIDEBAR_TRANSITION_MS}ms`,
      opacity: shown ? 1 : 0,
      transform: shown ? "translateX(0)" : "translateX(-8px)",
      pointerEvents: shown ? "auto" : "none"
    }
  }, items.map(item => {
    const hasChildren = !!(item.children && item.children.length);
    // This item's own absolute path is the ancestor chain that led to this
    // flyout being open (expandedPath[0..depth-1]) plus its own key — NOT
    // activePath, which is wherever the user currently IS, and is often a
    // completely different branch than whatever they're now hovering/
    // browsing in the flyout.
    const path = expandedPath.slice(0, depth).concat(item.k);
    const isActive = navIsPrefix(path, activePath);
    const isExpanded = expandedPath[depth] === item.k;
    return /*#__PURE__*/React.createElement("div", {
      key: item.k,
      ref: registerRowRef ? (el => registerRowRef(depth, item.k, el)) : undefined
    }, /*#__PURE__*/React.createElement(NavRow, {
      icon: item.icon,
      label: item.label,
      active: isActive,
      expanded: isExpanded,
      hasChildren,
      onClick: () => hasChildren ? onExpand(depth, item.k) : onSelectLeaf(path),
      onMouseEnter: () => { if (hasChildren) onScheduleHoverOpen(depth, item.k); },
      onMouseLeave: onCancelHoverOpen
    }));
  }));
}

// ---- Mobile slide-over drawer: same tree, rendered as a vertical
// accordion instead of horizontal columns (a cascading flyout has nowhere
// to cascade TO on a narrow screen). ----------------------------------------
function MobileNavNode({ item, path, depth, activePath, openSet, toggleOpen, onSelectLeaf }) {
  const hasChildren = !!(item.children && item.children.length);
  const key = path.join("/");
  const isOpen = openSet.has(key);
  const isActive = navIsPrefix(path, activePath) && path.length === activePath.length;
  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => hasChildren ? toggleOpen(key) : onSelectLeaf(path),
      className: "sidebar-nav-item w-full flex items-center gap-2.5 rounded-lg text-sm text-left",
      style: {
        paddingLeft: 12 + depth * 16,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 10,
        background: isActive ? C.mutedBg : "transparent",
        color: isActive ? C.tealDark : C.ink,
        fontWeight: isActive ? 600 : 500
      }
    },
      item.icon && /*#__PURE__*/React.createElement(Icon, { name: item.icon, size: 16, color: isActive ? C.teal : C.muted }),
      /*#__PURE__*/React.createElement("span", { className: "flex-1 truncate" }, item.label),
      hasChildren && /*#__PURE__*/React.createElement("span", {
        style: { display: "inline-flex", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }
      }, /*#__PURE__*/React.createElement(Icon, { name: "chevronDown", size: 13, color: C.muted }))
    ),
    hasChildren && isOpen && /*#__PURE__*/React.createElement("div", null,
      item.children.map(child => /*#__PURE__*/React.createElement(MobileNavNode, {
        key: child.k,
        item: child,
        path: path.concat(child.k),
        depth: depth + 1,
        activePath,
        openSet,
        toggleOpen,
        onSelectLeaf
      }))
    )
  );
}

function MobileDrawer({ open, onClose, tree, activePath, onSelectLeaf, appName, appIcon }) {
  const [mounted, shown] = useSlideReveal(open);
  const [openSet, setOpenSet] = React.useState(() => new Set());
  React.useEffect(() => {
    // Auto-expand every ancestor branch of wherever the user currently is,
    // so opening the drawer on e.g. Samples › Results Workflow › Awaiting
    // Approval shows that whole chain already expanded instead of a fully
    // collapsed accordion the person has to drill through again.
    if (open && activePath.length > 1) {
      const prefixes = activePath.slice(0, -1).map((_, i) => activePath.slice(0, i + 1).join("/"));
      setOpenSet(new Set(prefixes));
    }
  }, [open]); // eslint-disable-line
  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  function toggleOpen(key) {
    setOpenSet(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  if (!mounted) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("div", {
      className: "fixed inset-0 transition-opacity ease-out",
      style: { background: "rgba(10,20,20,0.45)", backdropFilter: "blur(2px)", zIndex: 90, transitionDuration: `${SIDEBAR_TRANSITION_MS}ms`, opacity: shown ? 1 : 0 },
      onClick: onClose
    }),
    /*#__PURE__*/React.createElement("div", {
      className: "fixed top-0 left-0 bottom-0 flex flex-col shadow-xl transition-transform ease-out",
      style: { width: "min(85vw, 320px)", background: C.card, zIndex: 91, transitionDuration: `${SIDEBAR_TRANSITION_MS}ms`, transform: shown ? "translateX(0)" : "translateX(-100%)" }
    },
      /*#__PURE__*/React.createElement("div", {
        className: "flex items-center gap-2 px-4 py-3.5",
        style: { borderBottom: `1px solid ${C.border}` }
      },
        /*#__PURE__*/React.createElement(Icon, { name: appIcon || "droplet", size: 18, color: C.teal }),
        /*#__PURE__*/React.createElement("span", { className: "flex-1 text-sm font-semibold truncate", style: { color: C.ink } }, appName),
        /*#__PURE__*/React.createElement("button", { onClick: onClose, className: "p-1.5 rounded-lg hover:bg-black/5", "aria-label": "Close menu" },
          /*#__PURE__*/React.createElement(Icon, { name: "x", size: 16, color: C.muted })
        )
      ),
      /*#__PURE__*/React.createElement("div", { className: "sidebar-scroll flex-1 overflow-y-auto py-2 px-2" },
        tree.map(item => /*#__PURE__*/React.createElement(MobileNavNode, {
          key: item.k,
          item,
          path: [item.k],
          depth: 0,
          activePath,
          openSet,
          toggleOpen,
          onSelectLeaf: path => { onSelectLeaf(path); onClose(); }
        }))
      )
    )
  );
}

// ---- Root component ---------------------------------------------------
function SidebarNav({ tree, activePath, onNavigate, session, permissionMatrix, topOffset = 0, appName, appIcon, mobileOpen, onCloseMobile, collapsed, onToggleCollapsed }) {
  const filteredTree = React.useMemo(() => filterNavTree(tree, session, permissionMatrix), [tree, session, permissionMatrix]);
  const [expandedPath, setExpandedPath] = React.useState([]); // which flyout columns are open, independent of activePath
  const railRef = React.useRef(null);
  // Every rail row and every tier-2 flyout row registers its DOM node here
  // (keyed "depth:key"), so the NEXT column over can open aligned with
  // whichever row actually triggered it — instead of every flyout always
  // starting at the same fixed height regardless of where in the rail you
  // clicked.
  const rowRefs = React.useRef({});
  function registerRowRef(depth, key, el) {
    rowRefs.current[`${depth}:${key}`] = el;
  }

  React.useEffect(() => {
    function onDocClick(e) {
      if (railRef.current && railRef.current.contains(e.target)) return;
      // Clicks on a flyout column itself are handled by that column's own
      // buttons (which either drill deeper or navigate+close); anything
      // else — including the flyouts' own empty space — closes the menu.
      if (e.target.closest && e.target.closest("[data-sidebar-flyout]")) return;
      pinnedRef.current = false;
      setExpandedPath([]);
    }
    function onKey(e) { if (e.key === "Escape") { pinnedRef.current = false; setExpandedPath([]); } }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // ---- Pinning: a menu opened by an explicit CLICK is "pinned" — it stays
  // open exactly where it is, regardless of where the mouse pointer wanders
  // afterwards, until the person clicks the same item again, clicks a
  // different top-level item, clicks away, selects a leaf, or hits Escape.
  // This is what makes clicking Sample Mgt./Inventory/etc. "static" instead
  // of flickering open/closed as the pointer moves — hover is only ever a
  // quick, non-committal preview; a click is a deliberate choice and isn't
  // second-guessed by mouse movement. Ref (not state) because it only needs
  // to gate scheduling decisions made inside plain event-handler functions,
  // never drives a render itself.
  const pinnedRef = React.useRef(false);

  // ---- Hover auto-close: moving the mouse off the rail AND every open
  // flyout column closes the menu after a short delay (long enough to
  // move diagonally from the rail into a column without it flickering
  // shut, short enough to feel responsive). Entering any of those areas
  // — rail, tier-2 column, tier-3 column — cancels a pending close.
  // Skipped entirely while pinned (see above).
  const closeTimerRef = React.useRef(null);
  function cancelHoverClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }
  function scheduleHoverClose() {
    cancelHoverClose();
    if (pinnedRef.current) return;
    closeTimerRef.current = setTimeout(() => setExpandedPath([]), 250);
  }
  React.useEffect(() => () => cancelHoverClose(), []);

  // ---- Hover-intent for OPENING: without this, moving the mouse
  // diagonally from a rail item toward its already-open flyout (which
  // sits lower and to the right) sweeps across whatever OTHER rail items
  // are in between, instantly stealing focus onto them and slamming the
  // intended flyout shut — the classic "menu flickers and vanishes"
  // problem. A row only actually commits to opening its flyout after the
  // cursor has rested there for a beat; a quick pass-through cancels
  // before that timer ever fires, leaving whatever was already open
  // alone. Click always bypasses this and opens instantly — no reason to
  // delay an explicit, intentional click. Also skipped while pinned —
  // once a click has pinned a branch open, brushing past other rail
  // items on the way to it must not swap the menu out from under it;
  // only another click changes the selection at that point.
  const openTimerRef = React.useRef(null);
  function cancelHoverOpen() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }
  function scheduleHoverOpen(depth, key) {
    cancelHoverOpen();
    cancelHoverClose();
    if (pinnedRef.current) return;
    openTimerRef.current = setTimeout(() => {
      setExpandedPath(prev => prev.slice(0, depth).concat(key));
    }, 150);
  }
  React.useEffect(() => () => cancelHoverOpen(), []);

  function handleExpand(depth, key) {
    cancelHoverClose();
    cancelHoverOpen();
    pinnedRef.current = true;
    setExpandedPath(prev => prev.slice(0, depth).concat(key));
  }
  function handleTopClick(item) {
    cancelHoverClose();
    cancelHoverOpen();
    const hasChildren = !!(item.children && item.children.length);
    if (!hasChildren) {
      onNavigate([item.k]);
      setExpandedPath([]);
      pinnedRef.current = false;
      return;
    }
    setExpandedPath(prev => {
      if (prev[0] === item.k) {
        pinnedRef.current = false;
        return [];
      }
      pinnedRef.current = true;
      return [item.k];
    });
  }
  function handleSelectLeaf(path) {
    cancelHoverClose();
    cancelHoverOpen();
    pinnedRef.current = false;
    onNavigate(path);
    setExpandedPath([]);
  }

  const railW = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;

  // Resolve which node is expanded at each depth (for rendering the
  // tier-2 / tier-3 columns) from the `expandedPath` key trail.
  const tier1Node = expandedPath[0] ? filteredTree.find(n => n.k === expandedPath[0]) : null;
  const liveTier2Items = tier1Node && tier1Node.children ? tier1Node.children : null;
  const tier2Node = liveTier2Items && expandedPath[1] ? liveTier2Items.find(n => n.k === expandedPath[1]) : null;
  const liveTier3Items = tier2Node && tier2Node.children ? tier2Node.children : null;

  // A column's `items` prop needs to stay populated for the ~200ms it
  // takes to fade/slide OUT, even though `liveTierNItems` above already
  // went null the instant the branch closed — otherwise FlyoutColumn
  // unmounts on the very same render its `isOpen` prop flips to false,
  // and useSlideReveal's delayed-unmount logic never gets a chance to
  // run. These caches simply hold onto the last non-null items list.
  const [tier2Cache, setTier2Cache] = React.useState(null);
  const [tier3Cache, setTier3Cache] = React.useState(null);
  React.useEffect(() => { if (liveTier2Items) setTier2Cache(liveTier2Items); }, [liveTier2Items]);
  React.useEffect(() => { if (liveTier3Items) setTier3Cache(liveTier3Items); }, [liveTier3Items]);
  const tier2Items = liveTier2Items || tier2Cache;
  const tier3Items = liveTier3Items || tier3Cache;

  // Position each column aligned with the row that opened it — Test
  // Configuration's flyout starts level with the Test Configuration row,
  // not always pinned to the top of the sidebar. Falls back to topOffset
  // if the trigger row hasn't been measured yet (e.g. very first paint).
  const [tier2Top, setTier2Top] = React.useState(topOffset + 8);
  const [tier3Top, setTier3Top] = React.useState(topOffset + 8);
  React.useLayoutEffect(() => {
    if (!expandedPath[0]) return;
    const el = rowRefs.current[`0:${expandedPath[0]}`];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTier2Top(Math.max(topOffset + 8, Math.min(rect.top, window.innerHeight - 60)));
  }, [expandedPath[0], topOffset]);
  React.useLayoutEffect(() => {
    if (!expandedPath[0] || !expandedPath[1]) return;
    const el = rowRefs.current[`1:${expandedPath[1]}`];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTier3Top(Math.max(topOffset + 8, Math.min(rect.top, window.innerHeight - 60)));
  }, [expandedPath[0], expandedPath[1], topOffset]);

  return /*#__PURE__*/React.createElement(React.Fragment, null,
    // ---- Desktop rail (hidden on mobile) ----
    /*#__PURE__*/React.createElement("div", {
      ref: railRef,
      className: "sidebar-nav-rail hidden md:flex flex-col sticky no-print",
      onMouseEnter: cancelHoverClose,
      onMouseLeave: scheduleHoverClose,
      style: {
        top: 0,
        height: "100vh",
        alignSelf: "flex-start",
        flexShrink: 0,
        width: railW,
        background: C.card,
        borderRight: `1px solid ${C.border}`,
        transition: `width ${SIDEBAR_TRANSITION_MS}ms ease`,
        zIndex: 50
      }
    },
      /*#__PURE__*/React.createElement("div", { className: "sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden py-2 px-2" },
        filteredTree.map(item => {
          const hasChildren = !!(item.children && item.children.length);
          const isActive = activePath[0] === item.k && (!hasChildren || expandedPath[0] !== item.k);
          const isExpanded = expandedPath[0] === item.k;
          return /*#__PURE__*/React.createElement("div", {
            key: item.k,
            className: "relative",
            ref: el => registerRowRef(0, item.k, el)
          },
            /*#__PURE__*/React.createElement(NavRow, {
              icon: item.icon,
              label: item.label,
              active: activePath[0] === item.k,
              expanded: isExpanded,
              hasChildren,
              iconOnly: collapsed,
              onClick: () => handleTopClick(item),
              onMouseEnter: () => { if (hasChildren) scheduleHoverOpen(0, item.k); },
              onMouseLeave: cancelHoverOpen
            })
          );
        })
      ),
      /*#__PURE__*/React.createElement("div", { className: "px-2 py-2", style: { borderTop: `1px solid ${C.border}` } },
        /*#__PURE__*/React.createElement("button", {
          type: "button",
          onClick: onToggleCollapsed,
          title: collapsed ? "Expand sidebar" : "Collapse sidebar",
          className: `w-full flex items-center rounded-lg py-2 text-xs font-medium ${collapsed ? "justify-center" : "gap-2 px-3"}`,
          style: { color: C.muted }
        },
          /*#__PURE__*/React.createElement(Icon, { name: "panelLeft", size: 15 }),
          !collapsed && /*#__PURE__*/React.createElement("span", null, "Collapse")
        )
      )
    ),

    // ---- Click-away backdrop for the flyout columns (desktop only;
    // invisible — just needs to sit above the page content so its own
    // click handler wins, and below the flyout columns themselves) ----
    expandedPath.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "sidebar-nav-backdrop hidden md:block fixed inset-0 no-print",
      style: { zIndex: 54 },
      onClick: () => { pinnedRef.current = false; setExpandedPath([]); }
    }),

    // ---- Tier 2 flyout ----
    tier2Items && /*#__PURE__*/React.createElement("div", { "data-sidebar-flyout": true, className: "hidden md:block" },
      /*#__PURE__*/React.createElement(FlyoutColumn, {
        items: tier2Items,
        depth: 1,
        left: railW,
        top: tier2Top,
        activePath,
        expandedPath,
        onExpand: handleExpand,
        onSelectLeaf: handleSelectLeaf,
        isOpen: !!tier1Node,
        registerRowRef,
        onMouseEnter: cancelHoverClose,
        onMouseLeave: scheduleHoverClose,
        onScheduleHoverOpen: scheduleHoverOpen,
        onCancelHoverOpen: cancelHoverOpen
      })
    ),

    // ---- Tier 3 flyout ----
    tier3Items && /*#__PURE__*/React.createElement("div", { "data-sidebar-flyout": true, className: "hidden md:block" },
      /*#__PURE__*/React.createElement(FlyoutColumn, {
        items: tier3Items,
        depth: 2,
        left: railW + FLYOUT_COL_W,
        top: tier3Top,
        activePath,
        expandedPath,
        onExpand: handleExpand,
        onSelectLeaf: handleSelectLeaf,
        isOpen: !!tier2Node,
        onMouseEnter: cancelHoverClose,
        onMouseLeave: scheduleHoverClose,
        onScheduleHoverOpen: scheduleHoverOpen,
        onCancelHoverOpen: cancelHoverOpen
      })
    ),

    // ---- Mobile drawer ----
    /*#__PURE__*/React.createElement(MobileDrawer, {
      open: !!mobileOpen,
      onClose: onCloseMobile,
      tree: filteredTree,
      activePath,
      onSelectLeaf: handleSelectLeaf,
      appName,
      appIcon
    })
  );
}
