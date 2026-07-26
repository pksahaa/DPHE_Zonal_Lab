# Zonal Water Quality Lab — LIMS

Split version of `Water_Quality_Lab_LIMS_Standalone_V2.html` for GitHub deployment.
No build step needed — this is plain JS loaded via `<script src="">` tags in order,
exactly like the original single-file version.

## Redesign — Phase B (this round): mixed-parameter batches

A Batch (`16-sub-batch.js`) can now hold samples needing DIFFERENT test
parameters — matching how the lab actually "brackets" testing: grab a pile of
samples, whatever each one specifically needs gets checked off, run together.

- **Data model**: a batch's `members` is now a flat list of `{sampleId,
  testTypeId, testTypeName}` pairs instead of one `testTypeId` for the whole
  batch. Old batches (single test type) are migrated automatically on load —
  nothing stored needs manual fixing.
- **Batch Builder** (Samples → Create and Edit Sub-Batches): a sample-centric
  picker — each sample shows its own eligible pending tests as checkable
  chips, so you build up (sample, test) pairs freely across multiple test
  types in one batch. "Auto-Select" and "Auto-Create Batches" both work on
  pairs now, same spirit as Phase A.
- **Running a batch**: since chemical consumption/formulas/QC rules are still
  fundamentally per-Test-Type (that's the Test Method Engine's job, unchanged),
  "running" a batch means running each of its distinct test types separately.
  Add Test Record's "OR Select Sub-Batch" picker shows a secondary "which
  test type in this batch?" selector when a batch has more than one pending
  group. Each run produces its own Test Record, tagged with `sourceBatchId`
  so it always traces back to the exact batch/group it came from.
- **Batch status** (Pending / Partially Run / Completed) is derived from
  which of its groups have a Test Record, not stored — same "derive, don't
  store" principle as Phase A's sample progress tracking, for the same reason:
  nothing to fall out of sync. A batch can't be deleted once at least one of
  its groups has been run (clear message explaining why).
- Fixed a bug found while wiring this up: the sample delete-safety check
  still referenced the old batch shape and would throw once any batch used
  the new mixed-parameter structure.

## Redesign — Phase A (previous round)

Following a full architecture discussion, this addresses the "sample lifecycle
stages aren't interconnected" problem at its root:

1. **New: Reference / Source entity** (`18-reference-model.js`) — DPHE, Private
   Institution, or Walk-in. A "References" tab now exists inside Samples
   (list + create/edit), and every sample registration form (Register New
   Sample, Register Batch, Edit Sample) has a Reference picker. This is the
   basis for reporting *per reference* later (Phase B), instead of per
   internal testing batch.
2. **Per-test progress is now DERIVED, not stored.** Rather than adding a
   status field that has to be manually kept in sync (the exact kind of
   drift that caused the original mess), `sampleTestProgress()` in
   `20-sample-model.js` computes each requested test's real stage — Pending
   → Batched → Result Entered → Under Review → Approved → Released — fresh
   from the actual Sub-Batches and Test Records every time it's viewed.
   There's nothing to fall out of sync because nothing extra is stored.
3. **Samples now auto-advance.** `autoAdvanceSampleStatus()` is wired into
   every path that can complete a sample's last pending test — single Add
   Test Record, Sub-Batch Add Test Record, and Bulk Result Upload's commit.
   The moment every requested test has a result, the sample jumps to
   "Results Entered" automatically, with a custody log entry — verified by
   actually running the full flow (register → sub-batch → test → save) and
   confirming the sample's status changed with no manual click involved.
4. **Sample Detail now shows a live "Test Progress" table** (per requested
   test, with its derived stage) and the linked Reference, replacing the old
   static list of test-name chips. This is the start of a proper single
   "Sample Profile" view — everything about a sample in one place, so other
   screens can link to it instead of duplicating sample info.
5. **Fixed a related pre-existing bug** found along the way: Bulk Result
   Upload's sample updates were only touching React state, never actually
   saved to storage — they'd have been lost on refresh.

**Deliberately not done yet (Phase B, next round):** Sub-Batches still
require one Test Type per batch. The discussed "mixed-parameter batch"
(different samples in the same batch needing different tests — matching how
the lab actually brackets samples together) is a bigger structural change to
`16-sub-batch.js` + Add Test Record's consumption logic + Bulk Result Upload,
and needs its own careful pass rather than being rushed in alongside
everything above.

## Fixes (prior round)

1. **Fixed the sample double-testing bug.** Creating (or bulk-uploading results
   for) a Sub-Batch now correctly removes those samples from the eligible pool
   for that Test Type everywhere — Sub-Batch creation, Bulk Result Upload, and
   the underlying lookup both use one shared `sampleAlreadyCommittedForTest()`
   check (in `16-sub-batch.js`). Previously only *pending* sub-batches were
   excluded, so a sample already tested (directly, or via a *tested*
   sub-batch) could still be picked again and effectively double-tested.
2. **"Filter by Registration Batch" is now a real dropdown** (`MultiSelectDropdown`,
   new in `02-ui-kit.js`) instead of a row of checkbox chips — used in both
   Sub-Batch creation and Bulk Result Upload.
3. **"No. of Batches" auto-split**, in Create and Edit Sub-Batches: set
   samples-per-batch + number of batches, click "Auto-Create Batches", and it
   creates all of them in one action from the eligible pool — the last batch
   gets whatever's left (equal to or fewer than the others, never more).
4. **Sample-level Edit + Delete**, previously missing entirely (only Sub-Batches
   had it). Edit opens a form covering all registration fields — useful for
   fixing typos from manual or bulk-upload registration. A requested test
   that already has a result can't be unchecked from Edit (shown locked 🔒).
   Delete is blocked with a clear reason if the sample has any test result or
   is a member of a sub-batch — remove those first.
5. **Test Records → expand a record → "Samples in this Batch"**: for
   Sub-Batch-based records, the member sample list (code, client, site, and
   each one's computed result) is now shown alongside the existing Chemicals
   Used / Gas Used / QC Check sections.
6. **"Bulk Upload Samples" moved** into the same row/style as "Register Batch"
   / "Register New Sample" in the Samples tab (previously a small secondary-row
   button that didn't match).

**Note:** `16-test-run.js` in this repo is **not loaded by `index.html`** — it's
leftover from an earlier design, superseded by the Sub-Batch workflow. Safe to
delete whenever convenient; left in place here since removing files wasn't asked for.

## Structure

**Note:** files are flat in the repo root (no `js/` subfolder) — this matches
how they were uploaded to GitHub via drag-and-drop, which doesn't preserve
folder structure. `index.html` references them without a `js/` prefix.

```
index.html                          # shell: CDN libs + CSS link + script tags in order
style.css                           # global styles
00-core.js                          # theme, i18n, date/number helpers, icon set
01-data-service.js                  # DataService (storage/backend abstraction)
02-ui-kit.js                        # Badge, Modal, Button, TextField, etc.
05-seed-data.js                     # demo seed data generators
06-legacy-storage.js                # localStorage load/save helpers
10-inventory-logic.js               # chemical/gas/glassware/equipment logic
10b-formula-engine.js               # formula tokenizer/parser/evaluator
11-inventory-ui.js                  # InventoryTab + related forms/modals
12-testtypes-ui.js                  # TestTypeBuilder, TestTypesTab
13-testrecords-ui.js                # AddTestTab, TestRecordsTab
14a-charts-and-filters.js           # chart primitives, DataTable, FilterPanel
14b-analytics-pages-1.js            # Executive/Insights/Test/Tech/Revenue/Chemical pages
14c-analytics-pages-2.js            # Inventory/Glassware/Gas/Equipment/Trends/Forecast pages
15-qc-module.js                     # Westgard rules, control charts, QcModuleTab
16-sub-batch.js                     # Sub-Batch model + getSampleResultForTest lookup
17-report-generator.js              # Custom Report Generator (official DPHE report format)
20-sample-model.js                  # sample lifecycle/status logic
21-sample-ui.js                     # SamplesTab (Samples + Sub-Batches sub-tabs), forms, QC banner, bulk manifest upload
30-dashboard.js                     # DashboardTab, SampleKpiStrip
40-auth-ui.js                       # LoginPage
99-app.js                           # AppRoot, LabApp, ReactDOM.render
```

## Why this split

The original standalone file had `// ===== filename.js =====` marker comments
showing it was originally built from these same modules by a build script.
This split restores that structure (the two large `14-reports-ui.js` /
`14b-analytics-pages.js` files were further divided since they'd grown too
large to edit efficiently).

**Load order matters** — later files reference functions/constants defined in
earlier ones, same as the original single `<script>` block. Don't reorder the
`<script src>` tags in `index.html`.

## Deploying to GitHub Pages

1. Upload/push all files listed above to your repo root (flat, no subfolder).
2. Settings → Pages → deploy from the branch containing `index.html`.
3. No build step, no npm install — it's static files served as-is.

## Editing going forward

Since each file maps to one feature area, when you want a change just say
which part it touches (e.g. "the inventory tab" → `11-inventory-ui.js`,
"the chemical analytics chart" → `14b-analytics-pages-1.js`) and only that
file needs to be opened/edited — much cheaper than re-processing the whole
15,000-line file each time.

## QC Module (added)

- Data source: `qcCheck` on test records (`13-testrecords-ui.js`), grouped by
  method (testTypeId) + QC type (blank/duplicate/spike/calibration).
- Target mean/SD: set manually per QC rule in Test Types → QC Acceptance
  Rules (`12-testtypes-ui.js`, `targetMean`/`targetSD` fields), or left blank
  to auto-calculate (sample mean/SD, n-1) from the accumulated QC points —
  see `resolveQcTarget()` in `15-qc-module.js`.
- Westgard subset implemented: 1-3s, 2-2s, R-4s (reject-level), 4-1s, 10x
  (warning-level). See `evaluateWestgard()`.
- `getQcStatusForMethod(testTypeId, testTypes, testRecords)` is the shared
  helper — used by both the QC Module tab and the Sample review/approval
  banner in `SampleDetail` (`21-sample-ui.js`) so both stay in sync.

## Sub-Batch Workflow (replaces the earlier Test Run tab)

For methods where 15-20+ field samples run together, sharing one QC check.
Three steps, deliberately in three different places since different people
do them at different times:

1. **Create** — Samples tab → "Sub-Batches" sub-tab. Pick a Test Type, check
   off pending samples (any registration batch — mixing is fine, see below),
   optionally assign a tester. Saved as a `subBatch` record (`16-sub-batch.js`),
   status `"pending"`.
2. **Test** — Add Test Record → "OR Select Sub-Batch" dropdown (instead of a
   single Sample). Locks the Test Type, prefills No. of Field Samples from
   the member count (drives the existing chemical/gas deduction — unchanged
   logic), shows a per-sample result-entry grid, and the existing QC section
   (now shared across the whole sub-batch). On save: **one** test record is
   created holding `memberSampleIds` + `memberResults` (per-sample computed
   values), inventory is deducted exactly like a normal single-sample record,
   every member sample gets the record linked into `linkedTestRecordIds`, and
   the sub-batch flips to status `"tested"`.
3. **Report** — `getSampleResultForTest(sample, testTypeId, testRecords)` in
   `16-sub-batch.js` is the shared lookup: works whether a sample's result
   came from a plain single Add Test Record entry or from inside a
   sub-batch's `memberResults`. Used by the QC Module, the Sample review
   banner, and the Report Generator — so none of them care how a sample was
   actually tested.

**Mixing registration batches in one sub-batch is intentional and safe** — a
sample's own `batchRef` (set at registration) never changes regardless of
which sub-batch tested it. Reporting is done by filtering Samples on
`batchRef` (see Report Generator's "Quick-select by original receiving
batch" dropdown), completely independent of testing groupings.

Test Type → QC Acceptance Rules → "QC Frequency" gives a soft warning when
creating/using a sub-batch larger than the configured frequency without a
QC check attached.

Scope note: chemical/gas inventory deduction for sub-batches reuses the
exact same logic Add Test Record already uses for single samples (driven by
No. of Field Samples) — no separate/duplicate inventory code was written.

## Custom Report Generator (added)

- Reports tab → "Official Report" group → "Custom Report Generator".
- Three layers of data, each set in a different place:
  - **Lab Identity** (Settings → "Lab Identity" button, `01-data-service.js`):
    office letterhead — set once per lab, reused on every report.
  - **Per-Sample fields** (Sample registration / bulk manifest,
    `20-sample-model.js` / `21-sample-ui.js`): District, Upazila, Union,
    Village, Caretaker Name, Sample Source — captured once per sample.
  - **Per-Report memo fields** (entered in the generator itself): Memo No,
    Ref Memo No/Date, Date of Testing, Receiving Date, etc. — different for
    every report/memo.
- `buildReportHtml()` in `17-report-generator.js` is a pure function (no
  React) that assembles the full printable HTML; `printOfficialReport()`
  opens it in a new window and calls `window.print()`, the same pattern
  `printLabel()` in `10-inventory-logic.js` already used for bottle labels.
- Step 1 has a "Quick-select by original receiving batch" dropdown — one
  click selects every sample sharing a `batchRef`, regardless of which
  sub-batch(es) actually tested them.

## Manual Batch Registration

Samples tab → "Register Batch" (next to "Register New Sample"): enter
shared info once (client, matrix, district/upazila/union, dates, requested
tests), then add repeatable rows for only what differs per sample
(Village/Ward, Caretaker Name, Sample Source). Creates one individual
Sample per row, all sharing a `batchRef`. Alternative to the Excel manifest
upload for smaller batches typed directly in the browser.
