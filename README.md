# Zonal Water Quality Lab — LIMS (Phase 1)

Phase 1 of turning the single-file V14 app into a modular LIMS: **architecture
refactor + Sample Lifecycle module**. Everything else (Inventory, Test Method
Engine, Test Records, Reports) behaves exactly as it did in V14 — it's just
been split into readable files.

## What actually changed vs V14

1. **One file → nineteen files.** Same code, reorganized by responsibility
   (see `js/` below). No behavior changes to Inventory, Test Types, Test
   Records, or Reports — verified by re-transpiling and re-concatenating all
   modules through Babel to confirm nothing was lost or duplicated in the split.
2. **New: Sample Lifecycle module** (`20-sample-model.js` + `21-sample-ui.js`),
   the actual LIMS core: Registration → Chain of Custody → Assignment →
   Status tracking → Review/Approval (with e-signature) → Result Release.
   A "Sample" is the physical thing that arrives at the lab; it's separate
   from a "Test Record" (which already existed — one tester's execution of
   one Test Method, consuming reagents). A Sample links out to the Test
   Records performed against it, so nothing about reagent consumption changes.
3. **New: DataService** (`01-data-service.js`), a small backend-agnostic data
   layer. Today it's used only by Samples + the audit log (everything else
   still uses the original `loadKey`/`saveKey` localStorage helpers, now in
   `06-legacy-storage.js`). Flip **Backend Settings** in the header from
   "Local" to "Google Apps Script" once you've deployed `gas-backend/Code.gs`
   (see `gas-backend/README.md`) and Samples data becomes shared across
   devices/users — no code changes required.

## Folder structure

```
index.html                 shell — loads precompiled modules from /dist
Water_Quality_Lab_LIMS_Standalone.html   single-file build, precompiled, no server needed
build.js                    recompiles js/*.js (JSX) → dist/*.js (plain JS) + the standalone file
css/styles.css              base styles (unchanged from V14)
js/                          SOURCE — edit these (JSX)
  00-core.js                 theme, i18n, date/number helpers, icon set
  01-data-service.js          NEW — localStorage/Apps-Script data abstraction
  02-ui-kit.js                shared presentation components (Badge, Modal, ...)
  05-seed-data.js              demo/seed datasets
  06-legacy-storage.js         legacy localStorage load/save (Phase-2 migration target)
  10-inventory-logic.js       FEFO, batch deduction, Excel import/export
  11-inventory-ui.js          Chemicals / Glassware / Equipment / Gas tab
  12-testtypes-ui.js          Test Method Engine (requirement/QC builder)
  13-testrecords-ui.js        running a test + records list
  14-reports-ui.js            BI / analytics pages
  20-sample-model.js         NEW — Sample entity, state machine, custody, e-sign
  21-sample-ui.js             NEW — Samples tab UI
  30-dashboard.js             KPI dashboard (+ new Sample Lifecycle KPI strip)
  40-auth-ui.js                login screen
  99-app.js                    AppRoot + LabApp shell — loads last
dist/                         GENERATED — plain-JS output of js/*.js, don't hand-edit
gas-backend/
  Code.gs                     Google Apps Script backend (Sheets as a JSON store)
  README.md                   deployment steps for the backend
```

## Running it

`index.html` loads **precompiled** JavaScript from `/dist` (JSX already
converted to plain `React.createElement` calls — no Babel, no `eval` at
runtime). That was a deliberate fix: the original build used
Babel-standalone to transform JSX in the browser, which fails inside any
sandbox with a strict Content-Security-Policy (eval disabled) — including
Claude's own in-chat file preview. Precompiling avoids that entirely and is
also just the correct thing to do for production (it's what "please
precompile your scripts for production" in Babel's own console warning was
telling us).

Because these are now plain `<script src="dist/...">` tags (not
`text/babel`), you technically *can* now open `index.html` via `file://`
too — the earlier restriction was specifically about Babel's runtime
`fetch()` calls, which are gone. A local server is still the more reliable
option:

```bash
npx serve .
# or: python3 -m http.server 8080
```

**If you edit anything under `/js`**, recompile before testing:

```bash
npm install --no-save @babel/core @babel/preset-react   # one-time
node build.js
```

This regenerates `/dist/*.js` and `Water_Quality_Lab_LIMS_Standalone.html`.
Don't hand-edit files in `/dist` or the standalone HTML — they're generated.

### Just want to double-click and look at it?

Open `Water_Quality_Lab_LIMS_Standalone.html` — everything's inlined into
one file, precompiled, no server needed.


## Roles

Existing `Administrator` / `Technician` users work unchanged. Two additional
roles are recognized by the Sample approval workflow if you create users with
them (in `05-seed-data.js` or your own user management, not yet built —
see roadmap):

| Role | Register | Assign | Enter Results | Review | Approve | Release |
|---|---|---|---|---|---|---|
| Administrator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Technician | ✓ | | ✓ | | | |
| Reviewer | | | | ✓ | | |
| QA Manager | | ✓ | | ✓ | ✓ | ✓ |

## Honest caveats

- **The e-signature is workflow-level** (typed full name + explicit
  attestation checkbox + timestamp), not a cryptographic signature. It
  records *who claimed to approve what, and when* — appropriate for an
  internal LIMS, not a substitute for a regulated e-signature system.
- **Role checks are enforced in the browser only.** Nothing stops someone
  from editing the page to grant themselves permissions, and the Apps Script
  backend (once connected) has no per-role awareness — see
  `gas-backend/README.md` for the full security caveat.
- **Google Sheets as a database has ceilings** (row counts, request rate).
  Fine for a lab's real volume; not built for high concurrency.

## Roadmap (not built yet — next phases)

Following the original brief's full scope, in priority order:
1. **Test Method Engine extensions** — formula-based calculated results (not
   just reagent quantities), QC rules (blank/duplicate/spike/recovery
   acceptance criteria) attached to a method, report templates.
2. **QC module** — control charts, calibration curve capture, acceptance
   criteria evaluation, tied into the Sample's `results_entered` → `under_review`
   transition so out-of-spec results block approval automatically.
3. **Equipment** — calibration due-dates and preventive-maintenance
   scheduling (repair history already exists in V14; this adds the "due
   soon" alerting and a maintenance calendar).
4. **Security** — a real user-management screen (add/edit/deactivate users,
   assign the new roles), and an audit log viewer over the `auditLog`
   collection DataService already writes to.
5. **Migrate remaining collections onto DataService** so Inventory/Test
   Types/Test Records/Equipment are also shareable via the Apps Script
   backend, not just Samples.

Tell me which of these to build next and I'll do the same real-code, same
backward-compatible treatment.
