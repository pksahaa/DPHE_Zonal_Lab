# Zonal Water Quality Lab — LIMS

Split version of `Water_Quality_Lab_LIMS_Standalone_V2.html` for GitHub deployment.
No build step needed — this is plain JS loaded via `<script src="">` tags in order,
exactly like the original single-file version.

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

### Per-parameter eligibility (fixed)

A sample with several `requestedTests` does **not** move through them in
lockstep — one parameter can be Done while another is still fully Pending.
Eligibility ("does this sample still need testing for parameter X?") is
computed per **(sample, testTypeId)** pair via `pendingTestTypeIdsForSample()`
/ `testStatusForSample()` in `16-sub-batch.js`, never off the sample's single
overall `status` field. A sample keeps showing up in the Sub-Batch Builder
and the Add Test Record sample picker for every parameter it still needs,
independently, until a test record is actually saved for that specific
parameter (or it's queued into a pending sub-batch for that parameter).
Sample Detail's "Requested Tests" chips show each parameter's own state
(Done / Queued / Pending / On Hold) for the same reason.

Previously the sample's single `status` field (and a same-sample-any-
pending-sub-batch check that didn't look at *which* test type) was used for
this, which could wrongly hide a sample from parameters it still needed
once one other parameter moved forward, or wrongly block re-offering a
parameter that was actually still open.

### Auto status propagation + per-parameter stage (Phase 2)

Previously nothing ever moved `Sample.status` forward automatically — every
transition (including "all results are in") needed a manual click in
Sample Detail, even when the underlying work was already done. Now, every
time a test record is saved (single-sample or via a Sub-Batch), the app
checks whether *every* parameter the sample requested now has a result; if
so and the sample is still `in_progress`, it auto-advances to
`results_entered` via the normal `transitionSample()` state machine (so it
still respects the allowed-transitions table and still logs a custody
event) — see the save handler in `13-testrecords-ui.js`.

Review / Approve / Release remain single decisions made on the whole
Sample (unchanged, same buttons in Sample Detail) — turning those into
fully independent per-parameter actions would mean rebuilding the
Review/Approve UI itself around Sub-Batches instead of Samples, which is a
bigger, separate change from what's implemented here. What IS fully
per-parameter now is *visibility*: `testStageForSample()` in
`16-sub-batch.js` reports each requested parameter's real position —
Pending / In Progress / Result Entered / Under Review / Approved /
Released / On Hold — shown on the Sample Detail "Requested Tests" chips.
An un-resulted parameter never shows further along than "Pending"/"In
Progress" even if the sample itself has been pushed further, since a
result can't be reviewed/approved before it exists.

### Per-parameter Review / Approve / Release (Phase 3)

`requestedTests[].status` is now the real, stored source of truth for each
parameter's pipeline position (`pending → in_progress → results_entered →
under_review → approved → released`), not just a display-time derivation.
`Sample.status` is a **rollup** of these — the least-advanced ("bottleneck")
parameter decides where the sample as a whole shows up — computed by
`rollupSampleStatus()` / applied via `setRequestedTestStatus()` in
`20-sample-model.js`, every time any parameter's status changes.

**Sub-Batch review** (`21-sample-ui.js`, `SubBatchBuilder`) — a "tested"
Sub-Batch can be **Marked Reviewed** (bulk-moves that one parameter,
`results_entered → under_review`, for all its member samples) or **Returned
to Analyst** (back to `in_progress`, with an optional note; the Sub-Batch
itself goes back to `pending` so it naturally reappears in Add Test
Record's picker — the previous test record stays linked, a resubmit adds a
new one on top rather than overwriting it). This is the doc's "Review is
performed at batch level" — except the "batch" it now correctly means is
the Sub-Batch (one parameter), not the whole sample.

**Final Approval / Release stay exactly where they were** — the existing
e-signature/attestation flow (`addApproval()` in `20-sample-model.js`,
triggered from Sample Detail's `SignatureCapture`) and `releaseResults()`.
Nothing routes around that on purpose: it's a real compliance gate
(typed name + attestation), so Sub-Batch review deliberately stops one
step short of it. What changed is that both functions now also call
`syncRequestedTestsToStage()` after a signed decision, bringing every
parameter waiting at the stage just cleared up to match — so the signed
whole-sample decision and the per-parameter record can never disagree.
Because the rollup only lets `Sample.status` reach `results_entered` /
`under_review` once *every* requested parameter has independently reached
that stage, the signature step was always effectively deciding for all of
them at once anyway — this just makes that explicit in the data.

The old generic "Move Status" buttons in Sample Detail no longer offer
`results_entered` / `under_review` / `approved` / `released` as manual
targets (those are exclusively reached through the mechanisms above now);
they still handle genuine whole-sample custody moves — `on_hold`,
`cancelled`, `rejected`, and starting testing (`assigned → in_progress`) —
which have no automated equivalent.

**Release** (`17-report-generator.js`) — generating a report marks
`released` on exactly the (sample, testType) pairs actually included,
*if* they were already `approved`. Per the workflow doc, a report should
only be generated after approval — this is enforced as a **soft** gate
(warns and lists which parameters weren't approved yet, but still lets the
report print) rather than a hard block, since not every lab necessarily
runs every parameter through the formal review step.

A pre-Phase-3 sample (`requestedTests[]` with no `status` field yet) is
backfilled once, on load, by `backfillRequestedTestStatuses()` in
`16-sub-batch.js` — same idempotent-migration pattern as the Reference
backfill in Phase 1.

### Sample Detail as the single source of truth (observation #4)

Add Test Record and the Report Generator used to each show their own
ad-hoc slice of a sample (a bare sentence of text, independently
formatted). Sample Detail (in the Samples tab) is the real record — full
registration info, Reference, custody log, and every requested parameter's
own status. Two small, shared pieces now connect everything to it instead
of duplicating it:

- **`SampleMiniCard`** (`21-sample-ui.js`) — a shared summary component
  (code, client, site, Reference, per-parameter status chips) that Add
  Test Record renders instead of its own one-line summary. Report
  Generator's sample picker gets a lighter "↗" deep-link per row instead
  (a full card per row would be too heavy for a 50-sample checklist).
- **`goToSample(id)`** (`99-app.js`) — switches to the Samples tab and
  opens that sample's Sample Detail directly. `focusSampleId` is lifted
  out of `SamplesTab` into the app root so any tab can drive it (`SamplesTab`
  still falls back to its own internal state if used without these props,
  so it stays usable standalone). Wired into Add Test Record's sample/
  sub-batch pickers and the Report Generator's sample list.

QC Module doesn't reference individual samples directly, so it didn't need
this.

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
