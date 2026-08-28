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
21-sample-ui.js                     # SamplesTab (Samples Registration + Create Analytical Batch sub-tabs), forms, QC banner, bulk manifest upload
22-results-workflow-ui.js           # Samples tab's 3rd sub-tab: Upload/Review/Approve/Release, consolidated + role-gated (see note below)
30-dashboard.js                     # DashboardTab, SampleKpiStrip
40-auth-ui.js                       # LoginPage
99-app.js                           # AppRoot, LabApp, ReactDOM.render
```

## 2026-07-30 — Results Workflow consolidation

"Upload results / Review / Approve / Release" used to be scattered across
three places: Sample Detail's per-parameter buttons + whole-sample signature
panel, Create Analytical Batch's per-row buttons, and its "Batch Actions"
toolbar (Batch Approve/Release by Reference). All three are now **read-only
status + a deep-link** — the actions themselves live in one place: Samples →
**Results Workflow** (`22-results-workflow-ui.js`), reached via
`goToResultsWorkflow()` in `99-app.js`.

- Groups by `testTypeId` across **all** samples needing a step, regardless of
  whether they were tested via a Sub-Batch, Batch(Reference) mode, or an
  individual entry — one queue per step, not per grouping mechanism.
- Role-gated using the existing `permissionsFor()` (`20-sample-model.js`):
  a stage is hidden entirely (not just disabled) unless the signed-in role
  has that permission. Sample Analyzer has
  `canEnterResults` only, so it sees **only** Pending Upload.
- No new decision logic — every action calls the same
  `bulkDecideParameter` / `bulkReleaseParameter` / `setRequestedTestStatus`
  functions the old locations used.
- "Matrix" field in Sample Detail's edit view was renamed to "Sample Type"
  to match the Registration form's label for the same underlying
  `sample.matrix` field (was previously two different labels for one field).


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

### Bug fix: Sub-Batch Builder crash on every create/edit/reset

The Phase 1 rename of `selectedBatchRefs` → `selectedReferenceIds` missed
three call sites inside `resetForm()` / `startEdit()` / the auto-batch
helper in `21-sample-ui.js`, left calling a setter that no longer existed.
This threw on every single Sub-Batch creation, right after the real work
(creating the Sub-Batch, marking members `in_progress`) had already
happened — so the data was fine, but the form never properly reset,
producing exactly the "samples still show up again" symptom. Fixed by
restoring the correct setter name at all three sites.

### Selection Mode (Individual / Batch / Sub-Batch)

Both **Add Test Record** (`13-testrecords-ui.js`) and the **Report
Generator** (`17-report-generator.js`) now lead with an explicit "How are
you selecting samples?" dropdown instead of two pickers shown side by side
(Add Test Record) or a single always-on checkbox list (Report Generator):

- **Individual Sample(s)** — unchanged behavior, pick one directly.
- **Sub-Batch** — pick an existing Sub-Batch; its member list and locked
  Test Type are shown.
- **Batch (by Reference)** — pick a Reference; every sample under it that
  still needs the chosen parameter is listed. In Add Test Record, clicking
  "Use This Batch" **creates a real Sub-Batch behind the scenes** for that
  Reference + parameter combination and switches into normal Sub-Batch
  flow — no separate/duplicate code path for results entry, review, or
  reporting. In the Report Generator, picking a Reference just selects its
  samples (and auto-fills Ref Memo No/Date from it); picking a Sub-Batch
  selects its members **and** locks the report's Test Type column to that
  Sub-Batch's parameter (the normal "auto-pick every test type these
  samples have ever requested" effect is suppressed in this mode so it
  doesn't widen the column selection back out).

Once a sample/Sub-Batch is selected, the old "sample IDs in a bad list"
display is gone — Add Test Record shows a proper card/table (client, site,
Reference, per-parameter stage — the same `SampleMiniCard` from the single-
source-of-truth work, or a compact member table for Sub-Batch mode) instead
of raw codes.

### Test Records list — batch/sub-batch identity + inline review

Each record row now carries a clear **Sub-Batch: `<label>`** or
**Individual: `<sample code>`** badge (previously just the test name +
date — no way to tell what the record actually covered without opening
it). Expanding a record shows each member's client, site, Reference, and
live per-parameter stage — not just a sample code and a result number.
**Mark Reviewed** / **Return to Analyst** are available directly here too
(reusing the shared `reviewSubBatchApprove()` / `reviewSubBatchReturn()`
functions from `16-sub-batch.js` — the same ones the Sub-Batch Builder's
review queue uses, so there's one implementation, not two that could
drift), plus the equivalent single-parameter version for standalone
(non-Sub-Batch) records. This was the point raised: review shouldn't
require leaving the screen where you're already looking at the readings.

### Report Generator: hard gate on missing results

Previously report generation only soft-warned about parameters that
weren't `approved` yet. Now, before generation is even attempted, every
selected (sample, test) column that has **no result at all** (`pending` or
`in_progress`) blocks generation entirely, listing which ones are missing
— per the workflow doc, a report can't be produced from parameters that
haven't been tested yet. The softer "not approved yet, so not marked
Released" warning still applies afterward for columns that do have a
result but haven't cleared final approval.

### Bug fix: Bulk Upload Results (into an existing record) never updated sample status

`RecordBulkUploadModal` (Test Records → row → "Bulk upload results from
Excel") fills in result values for an already-created record's member
samples — a separate path from the normal Add Test Record save, and it
was only ever writing to `testRecords`. It never called
`setRequestedTestStatus()`, so a sample whose result got filled in this
way stayed stuck at `Pending`/`In Progress` on Sample Detail even though
the actual value was sitting right there in the record — exactly the "I
uploaded a result and the sample still shows manual/pending" symptom.
Fixed in `applyBulkResults()` (`13-testrecords-ui.js`): any member that
now has a non-null value gets its parameter moved to `results_entered`,
same as every other results-entry path, with the rollup keeping
`Sample.status` in sync automatically.

(There's also a `bulk-result-import` badge referenced in the row display
for a "create whole new records from an Excel sheet" style import — that
`source` value is never actually set anywhere in the code, so it's inert/
vestigial, not a live path that needed the same fix.)

### Sample Detail now shows actual result values, not just a status count

Previously the "Requested Tests" section only showed a status chip per
parameter, plus a bare "Linked test records: N (see Test Records tab)"
line — the actual measured values were never shown on the sample's own
page, only in Test Records. Each parameter row now also shows its real
value(s) and the record date once results exist, via the existing
`getSampleResultForTest()` helper (`16-sub-batch.js`) — no reason to make
someone leave the single source of truth to see the number that's
supposedly already "entered."

### Final Approve — now available at Batch, Sub-Batch, and Individual level

Previously, once a parameter reached `under_review`, the only way to
actually approve it was one sample at a time via Sample Detail's
signature flow — there was no bulk option. `bulkDecideParameter()`
(`20-sample-model.js`) is the same signature-gated decision as
`addApproval()`, just applicable to many (sample, testType) pairs in one
signed action:

- **Sub-Batch level** — a "reviewed" Sub-Batch gets a **Final Approve**
  button (Sub-Batch Builder's queue, and mirrored in Test Records) that
  opens the same `SignatureCapture` panel used everywhere else; one
  signature approves every member still `under_review` for that Sub-
  Batch's parameter. `bulkApproveSubBatch()` (`16-sub-batch.js`) is the
  shared implementation both places call.
- **Batch (Reference) level** — a new "Batch Approve (by Reference)" card
  in the Sub-Batch Builder tab: pick a Reference, see every (sample,
  parameter) pair under it that's ready for final approval (could span
  several different parameters/Sub-Batches at once), one signature
  approves all of them — grouped by parameter under the hood since the
  underlying decision is still per-parameter, but the person approving
  only signs once.
- **Individual level** — Test Records' expanded view for a standalone
  (non-Sub-Batch) record now also gets a **Final Approve** button once
  that parameter reaches `under_review`, instead of only being reachable
  via Sample Detail.

All three ultimately call the same `bulkDecideParameter()` /
`setRequestedTestStatus()` machinery, so the rollup, Sub-Batch status
badges, and audit trail (`sample.approvals[]`) stay consistent regardless
of which level someone approved from.

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


### Bug fix: Sample.status stuck at "Registered" forever once testing started

The rollup only applied once `Sample.status` was already `assigned` or
later (`SAMPLE_ROLLUP_ELIGIBLE`) — but nothing actually requires a sample
to be manually moved through Received/Assigned before it can be queued
into a Sub-Batch (Phase 1's eligibility check only looks at on_hold/
rejected/cancelled). So a sample could go straight from `registered` into
full testing/review at the parameter level, while the rollup guard kept
ignoring it because `registered` wasn't in the eligible list — leaving it
displaying "Registered" forever, no matter how far its parameters actually
progressed. Fixed by broadening `SAMPLE_ROLLUP_ELIGIBLE` to include
`registered` and `received` too (`20-sample-model.js`) — the rollup is
only ever invoked when a parameter's status actually changes, so this
doesn't cause any premature jumps for samples with no testing activity
yet; it just lets the rollup catch up from wherever the sample actually
is instead of only from `assigned` onward.

### Sample Detail now has its own per-parameter Final Approve

The whole-sample signature flow in Sample Detail only ever appears once
`Sample.status` reaches `under_review` — which (correctly) requires every
one of a sample's parameters to have independently reached that stage
first. If only some parameters were ready, Sample Detail showed no way to
approve anything at all, even though the Sub-Batch/Individual-record
Final Approve existed elsewhere (Sub-Batch Builder, Test Records) — not
the first place someone looking at "my sample" would think to check.
Each Requested Test row in Sample Detail now gets its own **Final
Approve** button once that specific parameter reaches `under_review`,
using the same `bulkDecideParameter()` / signature panel as everywhere
else — so approving one specific parameter no longer requires waiting for
every other parameter on the sample to catch up first.

### Report tab reorganized into two groups

The Reports browse menu is now exactly two groups, as requested:
- **Report & Analytics** — every existing analytics page (previously
  spread across Overview/Operations/Inventory/Equipment/Trends & Forecast)
  folded into one group.
- **Custom Report** — three pages: **Multiple Sample Report** (the
  existing Custom Report Generator, unchanged, just relabeled/relocated),
  **Single Sample Report** (the same generator with `forceMode="individual"`
  — hides the selection-mode dropdown and makes picking a sample replace
  the selection instead of adding to it, so it behaves like a proper
  single-sample tool instead of a multi-select one locked to "individual"
  mode), and **Monthly Progress Report** — genuinely new, not built yet.
  It's an honest placeholder (`MonthlyProgressReportPage` in
  `14c-analytics-pages-2.js`) rather than something half-working — tell me
  what fields/layout you want (likely a month-by-month summary of
  registered/tested/approved/released counts) and I'll build it.


## Latest round: Release at 3 levels, form field additions, Client Type

- **Release** now mirrors Approve — available at **Individual** (Sample
  Detail per-parameter, Test Records individual record), **Sub-Batch**
  (Sub-Batch Builder + Test Records), and **Batch (Reference)** level (new
  "Batch Release (by Reference)" card in Sub-Batch Builder). Same pattern
  as approve: `bulkReleaseParameter()` in `20-sample-model.js`,
  `bulkReleaseSubBatch()` in `16-sub-batch.js`.
- Fixed: **Batch Approve (by Reference)** wasn't showing the actual test
  result value for each pending pair — a reviewer was approving blind.
  Now shows it, same as the Sub-Batch review views.
- **Registration form fields** now match the DPHE-LIMS v2 spec: added
  Father's/Husband's Name, Latitude, Longitude, and a Type of Water Point
  dropdown (`WATER_POINT_TYPES` in `21-sample-ui.js`) to both the
  registration rows and Sample Detail's edit view. Labels renamed to
  match ("Customer Name", "Sample Type", "Location / Address").
- **Client Type** dropdown expanded from 3 to the 5 requested options —
  DPHE, Private Organization, Other Government Institution, Walk-in
  Customer, Others (`REFERENCE_SOURCE_TYPES` in `19-reference-model.js`).
  Reference/Memo No., Organization Name, Letter Date, Contact Person,
  Contact Phone, and Notes are already collected for all of them via the
  existing ReferencePicker "+ New" flow (not conditionally hidden by
  type). Legacy `"institution"` data still resolves correctly (mapped to
  Private Organization).

### Still outstanding (not done this round — flagging honestly)

- **Bulk Upload → popup asking for Client Type + Reference details once**
  (instead of per-row / auto-created-per-refNo as it works today).
- **Test Record expand → proper HTML `<table>`** instead of the current
  flex-wrap row layout.
- **Reports tab restyled like the Inventory "Chemical" tab** (need to
  confirm exactly which visual pattern that refers to before building it).
- **Custom Report's sample picker → table layout** instead of the
  checkbox list.

These are all sizable pieces of their own — rather than rush them and risk
more mistakes, next turn I'll tackle them in this order unless told
otherwise.


## Round after: Reports pill nav, Bulk Upload popup, tables everywhere

- **Reports tab restyled to match Inventory's pill nav** — replaced the
  dropdown-per-group "Browse:" menu with the same rounded-full pill
  pattern as Equipment/Glassware/Chemicals/Gas
  (`ReportGroupPills`/`ReportPagePills` in `14c-analytics-pages-2.js`).
  Top level: two pills, **Report & Analytics** and **Custom Report**.
  Custom Report's 3 pages get their own pill row (small set, fits
  cleanly); Report & Analytics' 15 pages use a compact dropdown
  (`ReportPagePicker`) instead, since that many wouldn't fit as pills.
- **Bulk Upload now asks for Client Type/Reference once**, in the same
  modal where Requested Tests are picked (`ImportTestPickerModal` in
  `21-sample-ui.js`, extended with a `ReferencePicker`) — instead of the
  old per-row "auto-create a Reference from the BatchRef column" logic.
  One manifest sheet = one source, entered once, applied to every row.
- **Test Record expand → real `<table>`** instead of flex-wrap rows —
  columns are Sample / Client·Site / Reference / Stage / one column per
  result parameter (union across all members, so it stays a consistent
  table even when some samples aren't resulted yet).
- **Custom Report's sample picker → real `<table>`** too — checkbox /
  Sample / Client / Site·Village / Reference / view-link columns, click
  anywhere in the row to toggle selection.

All four of last round's "still outstanding" items are done now.


## Major registration redesign: Client Part / Sample Part, Tracking No.

- **Sub-tabs renamed**: "Samples" → **Samples Registration**, "Create and
  Edit Sub-Batches" → **Create Analytical Batch**.
- **Registration split into two clearly divided sections, one window, no
  popup**: **Client Part** (tracking info, filled once per registration/
  upload) and **Sample Part** (per-sample site details, one row per
  sample). The old ReferencePicker "+ New" separate-modal pattern is gone
  from the registration flow — `ClientPartFields` (`21-sample-ui.js`) is
  always inline now, in `BatchRegistrationForm`, the bulk-upload
  `ImportTestPickerModal`, and (for consistency) `ReferencePicker`'s own
  "+ New" modal too.
- **Client Part fields**: Client Source (DPHE / Other Govt. organization /
  Private organization / Walk-in-Client / Others — with a "please specify"
  box for Others), Client Type (ADP / Non-ADP / Calamity / Monitoring /
  VVIP / Others — same pattern), Ref/Memo No., Date, **Tracking No.**
  (required, validated unique across every Client entry via
  `isTrackingNoTaken()` in `19-reference-model.js`), Organization Name,
  Client Name, Client Contact No., Notes.
- **Sample Part fields** (per row): Customer Name, Father's/Husband's
  Name, District, City Corp./Pouroshova/Upazilla, Ward/Union, Site Name,
  Latitude, Longitude, Type of Water Point (Shallow TW/Deep TW/TSP/CTBT/
  RPWS/PSF/RWH/Other — updated `WATER_POINT_TYPES` list with a "please
  specify" box for Other). District/Upazilla/Union moved from
  batch-shared to per-row, since a bulk upload can span more than one
  administrative area.
- **Samples list**: group header (Reference/Client Part entry) now shows
  Tracking No. inline (folded into `referenceDisplayLabel()`) plus a
  Client Type badge; search box also matches Tracking No. and Ref No.
  Collapse/expand per batch group already existed — unchanged.
- `submitClientPart()` is the one shared validate-and-create function used
  everywhere a Client Part gets submitted, so the Tracking No. uniqueness
  rule and field mapping only live in one place.


## Register Samples modal — progressive-disclosure redesign

`BatchRegistrationForm` (`21-sample-ui.js`) rebuilt as an explicit two-step
flow instead of one long scroll with a nested Client Part box sitting on
top of cramped per-sample rows:

- **Step 1 — Client & Batch Info**: `ClientPartFields` (unchanged) plus
  Batch Defaults and Requested Tests, with nothing about individual
  samples visible yet. "Continue to Sample Details" runs a local,
  side-effect-free check (Tracking No. present, "please specify" fields,
  at least one test selected) — the real uniqueness check and Reference
  creation still happen exactly once, in `submitClientPart()` at final
  submit, same as before.
- Once confirmed, Step 1 collapses into a one-line **`ClientPartSummaryBar`**
  (client name · Tracking No. · Ref No. · requested tests) with an Edit
  link that jumps straight back — Sample Details gets the modal's full
  width instead of competing with the Client Part form for space.
- **Step 2 — Sample Details**: each sample is now its own **`SampleEntryCard`**
  (max 5 — `MAX_BATCH_ROWS` — with a note pointing to the bulk manifest
  upload beyond that) instead of a 4-line flex-wrap row of tiny inputs.
  Fields keep their existing names/order (Customer Name → Father's/
  Husband's Name → Site Name → District → Upazilla → Union → Lat/Long →
  Water Point Type), just laid out in a readable grid per card. Per-card
  **duplicate** (inserts a copy directly after that row, not just
  appended at the end) and **remove** actions replace the old "Duplicate
  Last Row" button.
- If final submit's `submitClientPart()` call does return an error (e.g.
  Tracking No. turned out to be taken), the form now automatically jumps
  back to Step 1 so the person lands on the field the error refers to,
  instead of showing the error while Step 2's sample cards are still on
  screen.
- Modal shell is bespoke (not the shared `Modal` component) so it can be
  wider (`max-width: 900px`) and have a sticky header (title + step
  indicator) and sticky footer (Cancel / Back / Continue-or-Register)
  that stay reachable regardless of how many sample cards are open —
  the shared `Modal` doesn't support either.
- New small presentational components, all local to `21-sample-ui.js`:
  `RegistrationStepper`, `ClientPartSummaryBar`, `SampleEntryCard`. No
  changes to `20-sample-model.js`, `19-reference-model.js`, or any other
  file — `onCreate(shared, validRows, reference)`'s shape is identical to
  before, so nothing downstream needed touching.


## Per-user overrides now cover Samples (Register / Assign / Review / Approve / Release)

The Module × Action permission matrix (Users → Permission Matrix, plus the
"Custom permissions for this user" editor on each user) previously covered
everything *except* the Sample Lifecycle's own register/assign/review/
approve/release permissions — those were still role-only
(`ROLE_PERMISSIONS` / `permissionsFor(role)` in `20-sample-model.js`), with
no way to grant or revoke one person's access without moving them to a
different role.

- **`permissionsFor()`** (`20-sample-model.js`) now takes
  `(permissionMatrix, session)` instead of a bare role string. Resolution
  order matches every other module: Administrator always full access →
  `session.overrides.samples.<action>` (per-user override) → the matrix's
  `permissionMatrix[role].samples.<action>` (role default) → a defensive
  fallback to the original `ROLE_PERMISSIONS` constant if a role is
  somehow missing a `samples` entry. All three call sites (`SamplesTab`
  and `SampleDetail` in `21-sample-ui.js`, `ResultsWorkflowTab` in
  `22-results-workflow-ui.js`) now take `permissionMatrix` as a prop,
  threaded down from `AppRoot`/`LabApp` in `99-app.js`.
- **`41-rbac-ui.js`**: added a `SAMPLE_MODULE` definition (Register /
  Assign / Enter Results / Review / Approve / Release — a different
  action set than the shared View/Create/Edit/Delete columns, so it's
  rendered as its own small grid rather than forced into
  `PERMISSION_MODULES`). Both `PermissionMatrixPanel` (role-level
  defaults) and `UserPermissionOverridesEditor` (per-user Allow/Deny/
  Inherit) now show this second grid, using the exact same
  `toggleCell()`/`cycle()`/`overrideCellState()` logic already used for
  every other module — no new interaction pattern to learn.
- **Migration**: `DEFAULT_PERMISSION_MATRIX[role].samples` is seeded from
  the existing `ROLE_PERMISSIONS` values, so behavior for every role is
  identical to before on a fresh install. For labs that already have a
  `permissionMatrix` saved in localStorage (from before this change, so
  missing the `samples` key entirely), `backfillSamplePermissions()` fills
  it in from the same `ROLE_PERMISSIONS` defaults the first time the app
  loads after updating — a no-op if it's already been through this once,
  same idempotent-migration pattern used elsewhere in this app.
- Verified end-to-end: created a Sample Analyzer user with an explicit
  per-user "Approve" override — Results Workflow correctly shows them the
  "Awaiting Approval" queue (which a stock Sample Analyzer never sees), while
  Review/Release stayed hidden since those weren't overridden.


## 2026-08-09 — RBAC enforcement audit: buttons that ignored permissions entirely

Reported bug: turning a role's (or a per-user override's) edit/delete off
for a module had no effect on several screens — the button still worked.
Root cause was **not** in permission resolution (`can()` /
`permissionsFor()` and their override logic were already correct — see the
previous section's migration work) but in UI code that never called those
functions at all. A permission can't do anything if nothing checks it.

**Confirmed gaps, closed this round:**

- **Inventory** (`11-inventory-ui.js`) — top-level Chemical/Glassware/
  Equipment/Gas add/edit/delete were already gated, but everything nested
  one level down was not: chemical **batch** edit/delete, glassware
  **move actions** (To Analysis Room / To Store / Mark Broken — these had
  no gate at all, not even a hidden one), equipment **history event**
  edit/delete, and gas **cylinder** add/edit/delete/refill/mark-empty.
  Also the three **Import Data** buttons (Chemicals/Glassware/Equipment)
  and their `importChemicals`/`importGlassware`/`importEquipment`
  functions — completely ungated.
- **Test Configuration › Parameters** (`12a-parameters-ui.js`) — didn't
  even receive `session`/`permissionMatrix` as props from
  `TestConfigurationTab` (`12-testtypes-ui.js`), so Add/Edit/Delete
  Parameter ran unconditionally for every role. Now shares the
  `testTypes` module's permissions (Parameters lives inside Test
  Configuration; it has no RBAC bucket of its own).
- **Sub-Batches** (`21-sample-ui.js`, `SubBatchBuilder`) — same story:
  `permissionMatrix` wasn't threaded in from `SamplesTab`, so
  create/edit/delete and the tester-reassignment dropdown were wide open
  regardless of the `subBatches` module's settings.
- **Add Test Record** (`13-testrecords-ui.js`, `AddTestTab`) — had zero
  permission checks, and worse, was reachable even when its nav tab was
  hidden: `goToTestEntry()` (called from the Results Workflow "Upload
  Results" queue, `99-app.js`) does a direct `setTab("addTest")`, which
  bypasses the nav bar's own `can()` filter entirely since that filter
  only hides the *button*, not programmatic tab switches. Fixed by
  gating `handleSave` (covers both the create and the edit-via-row-Edit
  path, using `testRecords.create`/`testRecords.edit` respectively) and
  the **Upload Results (Excel)** bulk-fill button — the latter needed its
  own gate because otherwise a blocked person could still open the modal
  and fill the form from a spreadsheet; only the final Save was blocked,
  which reads as "it worked" even though nothing was persisted.
- **Archive** (`18-archive-ui.js`) Restore, **Reports**
  (`17-report-generator.js`) Generate & Print, **Sample** edit/delete and
  **Register/Import Sample** (`21-sample-ui.js`) — all previously gated
  correctly, converted to the new pattern below for consistency.

**The fix — two small shared helpers, not a rewrite of every screen:**

- **`permGate(matrix, session, moduleKey, action, notify, actionLabel)`**
  (`41-rbac-ui.js`, next to `can()`) — for the generic Module × Action
  matrix. Returns `{ allowed, visible, guard(handler) }`.
- **`sampleActionGate(perms, actionKey, session, notify, actionLabel)`**
  (`20-sample-model.js`, next to `permissionsFor()`) — same shape, built
  on the Sample Lifecycle's fine-grained `canRegister`/`canReview`/
  `canApprove`/`canRelease`/etc. booleans instead of the generic matrix.

Both encode the same rule, which is also this round's UX decision:

- **Guest** is meant to browse the whole app like an Administrator would —
  every button and every tab stays visible, nothing hidden, including
  ones it can't use. But `guard(handler)` only calls `handler` if
  `allowed` is actually true; otherwise it shows a toast ("Guest access
  can't … — this login is view-only for this action.") and does nothing.
  So `visible = allowed || role === "Guest"`, while the click itself
  always checks `allowed`, never `visible`.
- **Every other role** (Sample Analyzer, Reviewer, QA Manager, or anyone with
  a tightened per-user override) keeps the pre-existing convention: a
  control it has no permission for is hidden entirely, same as it's
  always been in this app.

Applied `permGate`/`sampleActionGate` across Inventory (all of it, listed
above), Parameters, Test Types, Test Records (Edit/Archive/Delete/Add/
bulk-upload), Archive Restore, Reports Generate, Sub-Batches, Sample
edit/delete, Register/Import Sample, and — the biggest piece — **Results
Workflow** (`22-results-workflow-ui.js`): Upload Results / Awaiting
Review / Awaiting Approval / Approved-Release are now all visible tabs
for Guest (`stageDefs[].show` includes `|| isGuestUser`), with a single
`stageGate` computed once per tab in `ResultsWorkflowTab` and threaded
down through `ReviewQueue`/`ApproveQueue`/`ReleaseQueue` →
`StageQueueBody` → `FlatStageTable`/`BatchStageTable` → `StageRow` →
`RowHoldReturnActions`, gating Mark Reviewed, Final Approve/Reject
(single row and whole-batch signing), Release, Hold/Resume, Return to
Analyst, and reviewer-remark editing.

Also updated the **nav bar itself** (`99-app.js`): Guest now sees every
tab a `Guest`-role-appropriate person would expect, including ones whose
underlying action it can't perform (e.g. "Add Test Record", which needs
`testRecords.create`) — the page itself blocks the actual mutation, per
above. Users & Audit Log stay hidden from Guest specifically, since the
default permission matrix already denies Guest *view* access to those
two (a deliberate design choice, not a bug — see
`DEFAULT_PERMISSION_MATRIX.Guest` in `41-rbac-ui.js`).

Every hide-vs-block point also got a matching check inside the mutating
function itself (not just the `onClick`), e.g. `createGroup`,
`doDeleteSubBatch`, `handleSave`, `doBulkRelease`, `importChemicals` —
so a handler can never fire past its permission check even if something
somehow calls it directly instead of through the guarded button.

**Known boundary, not addressed:** the `references` RBAC module
(View/Create/Edit/Delete, defined in the Permission Matrix) has no
standalone screen to gate — References are only ever created implicitly
during Sample Registration, folded into that flow's own `samples`
permission. Nothing to fix here; noted so it isn't mistaken for a missed
spot later.


## 2026-08-09 — Audit Log coverage extended to Inventory, Sub-Batches, Parameters

The Audit Log viewer itself (`42-audit-log-ui.js` — search, filters, CSV
export, `auditLog.view` gating) was already fully built; the gap was in
*what gets written*. Before this round, `DataService.appendAudit()` was
only called from Sample state changes (automatically, via the central
`setSamples(updater, changedRecord)` wrapper in `99-app.js`), Test
Records, Test Types, and Users/Permission Matrix edits — so deleting a
chemical batch or a sub-batch left no trail at all, silently.

- Added `DataService.appendAudit()` calls at every mutation point covered
  by this round's `permGate()` audit above:
  **Inventory** (`11-inventory-ui.js`) — chemical create/edit/delete,
  batch add/edit/delete, glassware create/edit/delete/move (to Analysis
  Room / to Store / Mark Broken), equipment create/edit/delete + event
  log/edit/delete, gas create/edit/delete + cylinder add/edit/delete/
  refill/mark-empty, and the three bulk-import actions (one summary
  entry per import, e.g. "Imported 12 chemical batch row(s)…").
  **Sub-Batches** (`21-sample-ui.js`) — create/edit (`createGroup`) and
  delete (`doDeleteSubBatch`). **Parameters** (`12a-parameters-ui.js`) —
  create/edit (`handleSave`) and delete (`handleDelete`).
- Every new call uses the same field shape already established
  elsewhere: `{ entity, entityId, action, user: session.username,
  role: session.role, note }` — no new conventions.
- `AUDIT_ENTITY_OPTIONS` (`42-audit-log-ui.js`) extended with `chemical`,
  `glassware`, `equipment`, `gas`, `subBatch`, and `parameter` so the new
  entries are filterable, not just visible in an unfiltered dump. Updated
  the file's own header comment (it previously documented this exact gap
  as known-and-open) to reflect the closed state and list every
  write-site for future reference.


## 2026-08-09 — Navigation redesign: left sidebar + 3-tier cascading flyout

Replaced the horizontal top-nav bar with a left icon rail plus a
horizontal, cascading multi-level flyout menu (Module → Sub-module →
Sub-sub-module), collapsible to an icon-only rail, with a full slide-over
drawer on mobile. New file: `03-sidebar-nav.js`, self-contained — only
depends on `Icon`/`C` (`00-core.js`) and `loadKey`/`saveKey`
(`06-legacy-storage.js`, called lazily so load order doesn't matter).

**Component shape** — `<SidebarNav tree={...} activePath={[...]}
onNavigate={fn} session={} permissionMatrix={} topOffset={px}
collapsed={bool} onToggleCollapsed={fn} mobileOpen={bool}
onCloseMobile={fn} />`:

- **Desktop**: a fixed left rail (216px expanded / 64px collapsed —
  `SIDEBAR_EXPANDED_W`/`SIDEBAR_COLLAPSED_W`). Clicking or hovering a
  module with children opens a 236px-wide flyout column
  (`FLYOUT_COL_W`) to its right; a sub-module with its own children
  opens a third column to *its* right. Columns are positioned with
  plain `left` offsets built from those width constants, so they sit
  side by side and never overlap. `shadow-xl` + a 1px border give them
  depth; chevrons (`chevronRight`) mark anything with children.
- **Transitions**: `useSlideReveal(isOpen)`, a small hook that keeps a
  flyout column mounted for one extra `SIDEBAR_TRANSITION_MS` (200ms)
  after it "closes" so the fade/slide-out can actually play, instead of
  the column vanishing the instant React would otherwise unmount it.
  Getting this right took two passes: the first version conditionally
  *rendered* the column based on the same open/closed state driving the
  animation, which meant the exit transition never had a chance to run;
  fixed by caching the last-known items list (`tier2Cache`/`tier3Cache`)
  so the column keeps its content while fading, and letting `isOpen`
  (not the presence of items) drive `useSlideReveal`.
- **Click-away**: an invisible full-viewport div behind the flyout
  columns (`z-index` between the rail and the columns) closes everything
  on click; Escape does the same. Clicks *inside* a flyout column are
  excluded from the click-away check via a `[data-sidebar-flyout]`
  marker, so drilling into a sub-menu doesn't also trigger its own close.
- **Mobile** (`<768px`, plain `hidden md:flex` / `md:hidden` — no JS
  breakpoint detection needed): a hamburger button in the header opens a
  slide-over drawer showing the same tree as a vertical accordion
  (`MobileNavNode`, recursive) instead of horizontal columns, since a
  flyout has nowhere to cascade *to* on a narrow screen. Opening the
  drawer auto-expands every ancestor branch of wherever you currently
  are, not just the top level.
- **Collapsed-rail state** is lifted up to `LabApp` (`99-app.js`), not
  kept inside `SidebarNav` itself, persisted via `loadKey`/`saveKey`
  under `"sidebarCollapsed"` — so the main content area's left padding
  (`md:pl-[${collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W}px]`)
  can reference the exact same constants the rail itself uses, instead
  of a second hardcoded pixel value that could drift out of sync (an
  earlier draft did exactly that — `pl-20`/`pl-[236px]` next to a
  64px/216px rail — caught and fixed before shipping).

**Wiring into the real app** (`99-app.js`) — `buildNavTree()` mirrors the
app's actual sub-tab structure, not a cosmetic mockup: Inventory
(Chemicals/Glassware/Equipment/Gas → `invTab`), Test Configuration (Test
Types/Parameters → `testConfigTab`), and — the one genuine 3-tier
example — Samples → Results Workflow → Upload Results/Awaiting
Review/Awaiting Approval/Approved-Release. `invTab`/`testConfigTab` were
already lifted to `LabApp`; Results Workflow's stage wasn't, so it got
the same `focusStage`/`setFocusStage` controlled-if-provided treatment
already used for `focusSamplesSubTab` (`22-results-workflow-ui.js`,
threaded through `21-sample-ui.js`). `buildActivePath()` is the single
source of truth for "where am I" (root → leaf, matching the tree shape),
used both to highlight the active item and to figure out where a click
should land; `handleSidebarNavigate(path)` reverses that — `setTab` plus
whichever of `setInvTab`/`setTestConfigTab`/`setFocusSamplesSubTab`/
`setFocusResultsStage` applies. Preserved two pre-existing quirks
exactly rather than "fixing" them as a drive-by: the `samples` nav node
has no `moduleKey` (it was never permission-gated, same as before), and
Guest still sees every tab except Users/Audit Log — this redesign
changes *how* the nav looks, not what any role is allowed to see (that
was the subject of the RBAC round above).

Also: header height is measured live via `ResizeObserver`
(`headerRef`/`headerHeight`) rather than assumed as a fixed pixel value,
since the header's actual height is organic (wraps on narrow screens,
grows with the build-version footer line) — the sidebar's `topOffset`
tracks whatever that real number is on every resize. Two new icons
(`menu`, `panelLeft`) added to `Icon` (`00-core.js`) for the hamburger
and collapse-toggle buttons. `style.css` gained a `.sidebar-scroll` thin
scrollbar and a `.sidebar-nav-item:focus-visible` ring, since Tailwind's
reset removes the browser's default outline and nothing else in this
app was relying on keyboard focus visibility as much as a click-driven
cascading menu does.

**Caught in review before shipping** (worth naming since they're the
kind of bug that doesn't show up in a syntax check): a flyout column
computed each item's navigation path from `activePath` (wherever the
user currently *is*) instead of `expandedPath` (the branch they're
currently *browsing*) — harmless whenever those happen to be the same
branch, silently wrong the moment they weren't (e.g. hovering Samples'
flyout while the active page is still Inventory would have navigated
into `["inventory", "samples"]`, which doesn't exist). Also: `Icon`
doesn't accept or forward a `style` prop, so a chevron rotation
animation passed directly to `<Icon style={...}>` would have been
silently dropped — fixed by wrapping the icon in a plain `<span>` that
actually receives the style instead.


## 2026-08-10 — Sidebar visual bugs, real ones this time

Screenshots came back showing every page's own colored headings (e.g.
Reports & Analytics' title/subtitle/breadcrumb) sitting on a dark teal
background instead of the light page background, washing them out to
near-unreadable. Root cause: the paren-balance fix from the previous
round closed the teal header `<div>` in the wrong place — one paren
short right before `SidebarNav`, one paren extra way down near
`AuditLogTab` — so the header's `React.createElement(...)` call never
actually closed until the very end of the component. `SidebarNav`, the
whole content area, every tab body, all of it was — structurally, not
just visually — nested *inside* the teal header div the entire time.
`node --check` can't catch this class of bug (the file is syntactically
valid either way); found it by walking the actual paren nesting with a
small Python script rather than re-guessing by eye, which is what
produced the wrong fix in the first place. Also fixed along the way:

- **Sidebar top not aligned with the header** — same root symptom,
  different mechanism: the rail used `position: fixed; top:
  <headerHeight measured via ResizeObserver>`, which depends on
  measurement timing and can't be *guaranteed* pixel-exact. Replaced
  with a structural fix instead of a tighter measurement: the outer
  wrapper is now `flex flex-col` (header, then a new `flex flex-1
  min-w-0` row for sidebar+content); the rail is `position: sticky; top:
  0` instead of `fixed`, so its very first rendered position is wherever
  normal document flow puts it — directly after the header, always,
  by construction, not by measurement. Bonus: since the rail is now a
  real flex child instead of a `fixed` element pulled out of flow, the
  content area no longer needs the `md:pl-[${…}px]` padding hack that
  had to be kept in sync with `SIDEBAR_COLLAPSED_W`/`SIDEBAR_EXPANDED_W`
  by hand (the exact bug class from two sessions ago) — flexbox sizes it
  automatically now, so that whole category of bug can't recur.
- **Flyout opens then instantly closes on hover** — moving the mouse
  diagonally from a rail item toward its already-open flyout sweeps
  across whatever *other* rail items sit in between, each one's
  `onMouseEnter` firing and immediately stealing the menu shut — the
  classic hover-menu "safe triangle" problem. Fixed with a hover-intent
  delay (`scheduleHoverOpen`/`cancelHoverOpen`, ~150ms): a row only
  commits to opening after the cursor actually rests there; a quick
  pass-through cancels before that timer fires, leaving whatever was
  already open alone. Click still opens instantly — no reason to delay
  an explicit click. Wired into both the rail and the flyout columns'
  own rows (`onMouseLeave` added to `NavRow` to support it).
- **Flyout column too tall, empty space below Test Types/Parameters** —
  it used `top` + `bottom: 12` (always stretching to the viewport's
  bottom), regardless of item count. Now uses `maxHeight: calc(100vh -
  ${top}px - 12px)` instead, so the column hugs its content and only
  caps out (with internal scroll) if it would genuinely run off-screen.
- **Flyout not aligned with whichever row opened it** — was always
  `top: topOffset + 8` no matter which rail item was clicked. Each rail
  row (and each tier-2 row, for tier-3's sake) now registers its own DOM
  node in a ref map (`registerRowRef(depth, key, el)`); a
  `useLayoutEffect` measures the triggering row's `getBoundingClientRect()`
  and the column opens level with it (clamped so it can't render above
  the header or past the bottom of the viewport).
- **"Sample Management" label clipped** — `t("samples")` really is that
  long a string; the 216px rail was cutting it close. Widened to 240px.
- **Icon set had real duplicates** — audited the whole tree
  programmatically (a small script that groups icons by "would these
  ever be on screen together" — same flyout column, or top-level rail
  vs. its own open flyout) rather than eyeballing it. Found and fixed:
  Reports/QC (both top-level, both `chart`) → QC is now `check`;
  Samples/Add Test Record (both top-level, both `clipboard`) → Add Test
  Record is now `plus`; Inventory's own flyout reused `flask` three
  times (top-level Inventory, Chemicals, *and* Gas) → Inventory's own
  icon is now `wrench`, freeing `flask` for Chemicals alone, `droplet`
  for Gas. One accepted, disclosed trade-off remains: QC's top-level
  `check` and Results Workflow's "Awaiting Approval" (three tiers deep
  in a completely different branch) still share an icon — the ~30-icon
  vocabulary doesn't stretch to a fully unique assignment across every
  node without sacrificing semantic fit somewhere, and this is the
  least visually adjacent place to accept it.
- **Settings moved out of the header, into the sidebar** — the header's
  "Settings" popover (Backend Settings + Lab Identity) is gone; a new
  `settings` branch sits at the bottom of the sidebar tree instead, with
  those same two items as children. Since they open modals rather than
  switch tabs, `handleSidebarNavigate` special-cases `top === "settings"`
  to call `setShowBackendSettings`/`setShowLabIdentitySettings` directly
  and return early, instead of touching `tab` at all — so Settings never
  shows as an "active" sidebar item, which is correct for something
  that floats a modal rather than being a page. Hidden from Guest the
  same way Users/Audit Log are (the permission matrix denies Guest even
  *view* access to `settings`). No icon in the existing set fit "gear/
  settings" semantically without colliding with something else already
  in use, so a real gear/cog icon was added to `Icon` (`00-core.js`)
  rather than force a compromise. Cleaned up the now-dead
  `settingsMenuOpen` state and a dangling reference to its setter in the
  user-menu button's `onClick` that `node --check` didn't catch (unused
  variable reads aren't a syntax error) but would have thrown at runtime
  the first time that button was clicked.

## 2026-08-10 — Small-fixes round: header alignment, sticky flyout, nav-order parity, Reports cleanup

- **Header left/right alignment** (`99-app.js`) — the top bar now uses two
  explicit flex groups (`justify-between`) instead of a single `flex-wrap`
  row with one child pushed by `mr-auto`: a left group (menu button + logo +
  "Zonal Water Quality Lab" / subtitle / build line, `min-w-0` + `truncate`
  so long text can't force a wrap) and a right group (language toggle, theme
  toggle, account pill — `flex-shrink-0`). Title stays flush-left and the
  account/role info stays flush-right regardless of viewport width, instead
  of the whole right-hand block being able to drop onto its own line under
  certain widths.
- **Flyout menu no longer flickers open/closed on hover** (`03-sidebar-nav.js`)
  — clicking a rail item with children (Samples, Inventory, Test
  Configuration, Reports, Settings) now **pins** that menu open
  (`pinnedRef`): once pinned, both the hover-close timer and the hover-open
  timer are skipped entirely, so the submenu stays exactly where it is no
  matter where the mouse pointer wanders next. It closes again only on a
  deliberate action — clicking the same item, clicking a different
  top-level item, clicking away, selecting a leaf, or Escape — all of which
  now also clear the pinned flag. Hovering without clicking still works as
  a quick, non-committal preview with the existing short intent delay.
- **Sidebar sub-module order now matches the actual page tabs, everywhere**:
  - Inventory: was Chemicals/Glassware/Equipment/Gas in the sidebar vs.
    Equipment/Glassware/Chemicals/Gas on the page — sidebar reordered to
    match the page (`InventoryTab`, `11-inventory-ui.js`).
  - Test Configuration: reordered to Parameters, then Test Types, matching
    `TestConfigurationTab` (`12-testtypes-ui.js`).
  - Samples and Results Workflow were already in the correct order —
    verified, not changed.
- **Reports now has a real sidebar sub-module** instead of being a single
  flat item with nothing to expand: added **Report & Analytics** and
  **Custom Report** children, mirroring the two pill groups on the page
  itself (`REPORT_GROUPS` / `ReportGroupPills`, `14c-analytics-pages-2.js`).
  Picking either from the sidebar switches `reportTab` to that group's
  first page; `buildActivePath()` resolves the current page back to
  whichever of the two groups it belongs to, so the sidebar highlight and
  the page's own pills always agree.
- **Reports page: removed the redundant heading block** — the "Reports &
  Analytics" title, "Enterprise business intelligence for laboratory
  operations." subtitle, and the "Report & Analytics / Executive Dashboard"
  breadcrumb are gone. The group pills (Report & Analytics / Custom Report)
  are now the first thing shown, right under the Load Demo Data / Print
  buttons, instead of sitting underneath descriptive text that duplicated
  what the pills already say.

## 2026-08-10 (round 2) — Parameters export/import, Data Backup + GAS backend, delete-cascade fix

- **Parameters: Export / Import / Template**, made identical to Test Types
  (`12a-parameters-ui.js`): per-row "Export" to `.json`, a full Import modal
  (select → preview → importing → done) accepting `.xlsx`/`.csv`/`.json`,
  and "Download CSV Template". The shared CSV parser used by both modules
  was de-duplicated into one implementation in `10-inventory-logic.js`
  (`parseCSVText`) instead of two copies that could drift apart.
- **Settings → Data Backup** (new `23-data-backup.js`):
  - **Manual backup** — "Download Backup Now" bundles every collection
    (legacy localStorage modules + DataService-backed ones) into one
    timestamped `.json`, no backend required.
  - **Automatic email backup** — schedule (daily/weekly/2-weekly/monthly) +
    recipient email, saved server-side via the new GAS backend so it runs
    even with no browser open. Sends the export as a Gmail attachment, then
    **deletes the previous backup email it sent** — only the newest stays
    in the inbox. Requires the Google Apps Script backend (see
    `gas-backend/`); a "Sync Local Data to Backend" button bridges the
    legacy localStorage-only modules, which don't otherwise reach the
    server.
  - **Auto-archive** — a settable "archive completed records older than N
    days" threshold, checked automatically once a day on app load, entirely
    client-side (no server needed) and never reading `archived_records`
    itself — only the active Test Records list, so it can't be what slows
    the app down. The existing manual per-record/bulk Archive button in
    Test Records keeps working unchanged; a "Run Sweep Now" button was
    added alongside it for an on-demand manual sweep.
- **New `gas-backend/Code.gs` + `gas-backend/README.md`** — the full Google
  Apps Script backend: generic list/save/remove/bulkSet/appendAudit CRUD
  (one Sheet per collection, one JSON-stringified record per row), the
  daily trigger that drives the automatic backup email + old-email
  deletion, and a one-time `runOnce_setup()` to install it. Deployment
  steps are documented in that README.
- **Delete-cascade fix, sample ↔ test record ↔ Analytical Batch ↔ Ref
  Batch**:
  - Deleting a **Test Record** (`doDelete`, `13-testrecords-ui.js`) now
    also reverts every member sample's per-parameter status back to
    "in_progress" via the same `returnRequestedTestToAnalyst` helper the
    Results Workflow's own "Return to Analyst" action already uses — before
    this fix, the stored status was left wherever it was, so a sample
    stayed invisible to a brand-new Analytical Batch even though its test
    record was gone.
  - Deleting a **pending Analytical Batch** (`doDeleteSubBatch`,
    `21-sample-ui.js`) already made members eligible for a new batch again
    (eligibility never depended on the stored status field to begin with —
    see `pendingTestTypeIdsForSample`, `16-sub-batch.js`); this pass adds
    resetting that stored status back to "pending" too, so what's displayed
    on Sample Detail stops saying "In Progress" for a batch that no longer
    exists.
  - Deleting a **Ref Batch (Reference)** did not exist as a feature at all
    before this — Samples → Group by Batch now has a delete action on each
    batch header. It's only allowed while every member sample is still
    untouched (every requested test still "pending"), the same "must be
    pending" safety rule the Analytical Batch delete button already
    enforces; deleting it removes the Reference and every one of its member
    samples, so they no longer appear in Register Sample — closing the
    cascade exactly as described.

## 2026-08-18 — Security & RBAC hardening (Phase 2, part 1)

Phase 1 (`DPHE_ZONAL_LAB_LIMS_Workflow_Data_Integrity.md`) covered workflow
correctness. This round covers the security architecture described in
`DPHE_Zonal_Lab_LIMS_RBAC_Prompt.md` — not a rewrite, a hardening pass on
top of the existing static-frontend + shared-Apps-Script-backend
architecture. **Read this before deploying** if you're updating an existing
installation — a couple of things change shape.

**The core problem being fixed:** every account's password hash used to
ship to the browser (even before login, since the login screen compared
hashes client-side), the `sessions` sheet was written but never actually
checked by anything, and role/permission was resolved entirely client-side
— a tampered browser could claim to be an Administrator and the backend had
no way to know better.

- **Login moved server-side** (`Code.gs`: `handleLogin_`). The browser now
  sends the raw password over HTTPS to a `login` action; the server
  verifies it against a per-user salted hash (`HMAC-SHA256(password, salt)`
  via `Utilities.computeHmacSha256Signature`) and returns a session token.
  Existing accounts (unsalted `SHA-256(password)`, the old scheme) are
  verified against that once and silently upgraded to the salted scheme on
  their next successful login — no forced password reset needed.
- **`users` never leaves the server with password fields attached**, full
  stop — every read path (`list`/`listActive`/`multiList`/`listSince`)
  strips `passwordHash`/`passwordSalt` before responding, regardless of
  whether the caller is logged in.
- **Sessions are real now.** Every protected write (`save`, `bulkSet`,
  `bulkUpsert`, `bulkRemove`, `appendAudit`, etc.) requires a valid,
  non-expired session token (`requireSession_`), not just the shared deploy
  token. The `sessions` collection itself can't be read or written through
  the generic list/save/remove paths at all — only through
  `login`/`logout`.
- **First-admin setup is now atomic and server-controlled**
  (`handleBootstrapAdmin_`, `LockService`-guarded) instead of a client-side
  `users.length === 0` check, which could let two near-simultaneous first
  visitors (or one bad reload) create duplicate or overwritten admin
  accounts.
- **`users` and `permissionMatrix` writes are Administrator-only**,
  enforced backend-side — and a client can never plant an arbitrary
  password on an account by including `passwordHash` in a `users` write;
  the server strips it and requires the dedicated `setUserPassword` action
  instead (also Administrator-only for now — self-service password change
  is a follow-up).
- **`auditLog` is append-only** (remove/bulkSet/bulkRemove rejected) and
  **read-gated**: viewing it now requires a valid session whose role has
  `auditLog.view` in the Roles & Permissions matrix (or the built-in
  default for a role that's never been customized). No other collection's
  reads are gated yet — see Known Limitations.
- **Segregation of duties on sample approvals** (`enforceSamplesWritePolicy_`
  in `Code.gs`, mirroring `20-sample-model.js`'s `addApproval`/
  `bulkDecideParameter`): a new approval/review entry on a sample is
  rejected if its signed name/role doesn't match the actual logged-in
  session, if that role isn't allowed to review/approve, or — where the
  underlying test record's `tester` field makes it possible to tell — if
  the approver is the same person who entered the result being approved.
- **Failed-login lockout**: 5 failed attempts locks that username out for 5
  minutes (`CacheService`-backed, resets on a successful login).
- **New security audit events** appended to the same audit log as
  everything else: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`,
  `UNAUTHORIZED_ACCESS_ATTEMPT`, `USER_CREATED`, `PASSWORD_RESET`.

**What callers need to know:** `DataService` (`01-data-service.js`) now
holds a session token in memory and attaches it to every write
automatically (`setSessionToken()`), plus new `login()`, `logout()`,
`bootstrapAdmin()`, and `setUserPassword()` methods. Nothing that already
calls `DataService.save`/`bulkSet`/etc. needs to change. `AppRoot`
(`99-app.js`) restores the token from the persisted session on every reload
and calls it again after a fresh login — if you're embedding `DataService`
somewhere outside the normal app shell, you need to do the same or writes
will start failing with "Missing session" after the first page load.

**Honest note on the shared token:** `token` (`Dphe_Zonal_Lab` by default)
still ships in the frontend source, because this is a static GitHub Pages
site talking to one shared Apps Script backend — there's nowhere to keep it
truly secret in that architecture. It was never a real authorization
boundary and still isn't; everything above is what actually authorizes a
specific user to do something now, not the token.

**Known limitations / not done in this pass** (candidates for the next
round):
1. Reads other than `auditLog` (samples, testRecords, inventory, reports,
   etc.) aren't role-gated yet — any valid token can still read them. The
   app's own permission model doesn't define a `view` flag for every one of
   these modules cleanly (`samples` in particular), so gating them needs a
   bit more design work to avoid breaking a legitimate role's workflow.
2. Generic `save`/`bulkSet`/`bulkUpsert` are still the transport for almost
   everything, including sensitive state changes — a full move to
   dedicated, single-purpose operations (`approveResult()`,
   `releaseResult()`, `changeUserRole()`, ...) would close the remaining
   mass-assignment surface but is a much larger refactor across both
   `Code.gs` and every UI module that currently calls `save`/`bulkSet`
   directly.
3. Self-service password change (a user resetting their own password) isn't
   built — only an Administrator can call `setUserPassword` today.
4. Session tokens are UUIDs stored in a Sheet with an 8-hour expiry; there's
   no "log out everywhere" / revoke-all-sessions-for-user action yet beyond
   disabling the account outright.
5. GAS's `Utilities` has no slow/memory-hard KDF (bcrypt/scrypt/Argon2) —
   the salted HMAC-SHA256 scheme here is a real improvement over the old
   unsalted hash, not a modern password-hashing standard.

Automated coverage: `tests/test-gas-security.js` (mocks just enough of the
Apps Script runtime — `PropertiesService`, `CacheService`, `LockService`,
an in-memory "sheet" — to load `Code.gs` unmodified in Node and exercise it
end to end: bootstrap atomicity, login success/failure/lockout, password
migration, safe projections, session-gated writes, privilege-escalation and
hash-smuggling attempts, append-only enforcement, and the segregation-of-
duties checks above). All 9 pre-existing Phase 1 test files continue to
pass unchanged.

## Anti-Pattern Warning: Avoid bulkSet for Mass Data
**CRITICAL:** Never use DataService.bulkSet() to update individual records in large collections (like samples, users, eferences).
ulkSet replaces the **entire** Google Sheet, which takes a very long time and often fails when dealing with mass data. It also creates a severe race condition if multiple users or asynchronous functions try to save at the same time.

**How to avoid this bug:**
1. **Never tie setCollection([...]) to an auto-saving ulkSet effect.** In 99-app.js, do not trigger a backend ulkSet simply because the local React state array changed.
2. **Use targeted saves.** When creating, editing, or deleting an entity, explicitly await DataService.save("collection", item), DataService.bulkUpsert("collection", [changedItems]), or DataService.remove("collection", id) in your handler function *before* or *concurrently* with updating the local UI state.
3. **Use useDiffSync carefully.** For smaller configuration collections, useDiffSync works well by calculating diffs, but for mass data like samples, always use explicit targeted ulkUpsert (as refactored in Phase 1).

## Security Architecture

The full Role-Based Access Control (RBAC) and Security Architecture implementation details, including the API protection model, session management, segregation of duties, and security testing matrix, can be found in the [RBAC Security Report](./RBAC_Security_Report.md).

## Dashboard — Sample Life Cycle KPIs (v2, dynamic period filter)

**File:** `30-dashboard.js` (`DashboardTab`, plus the helper functions just
above it: `fiscalYearsFromSamples`, `buildLifecyclePeriodMatcher`,
`computeSampleLifecycleV2`). Nothing else was touched — the Monthly
Progress Report, the 5-fiscal-year charts further down this same page, the
pie chart, and every other screen keep their existing logic untouched.

### The bug this replaced

The old "Sample Life Cycle" cards computed **Total Samples** as
`activeSamples.length + archivedSampleTotal`, where `activeSamples` came
from the live `samples` collection and `archivedSampleTotal` came from a
*separate* `archived_records` collection. Archiving
(`archiveReleasedMembers()` in `13-testrecords-ui.js`) never deletes a
sample's own record — it only sets `archived: true` on it, once every
requested test on it is done, and *also* writes a lightweight snapshot of
it into `archived_records` for the Archive tab. So a fully-archived sample
was being counted **twice**: once in `activeSamples.length` (the archived
flag wasn't filtered out) and again in `archivedSampleTotal`. The same
double-count applied to "Tested & Released". This is why the Dashboard's
numbers didn't match the Monthly Progress Report or reality.

### The deeper issue found while fixing it

Even after removing the double-count, using `sample.status` to decide "is
this Tested & Released / still In Testing / etc." is itself unreliable,
because `sample.status` is a **rollup**, not raw data
(`rollupSampleStatus()`, `20-sample-model.js`): *"the least-advanced
(bottleneck) parameter decides where the sample as a whole shows up... a
sample isn't 'Approved' until every parameter it requested is."*

Concretely: a sample with 3 requested parameters — 1 already `released`,
2 still `in_progress` — has `sample.status === "in_progress"` as a whole.
Counting by `sample.status` would hide the 1 already-released parameter
completely; it would never show up in "Tested & Released" until the other
2 catch up.

### The fix — two counting units, on purpose

- **Total Samples Received** is counted **per sample** (one physical water
  sample = 1). This is inherently a sample-level question.
- **Every other figure** (Total Parameters Requested, Tested & Released, In
  Testing, Awaiting Review/Approval/Release, Rejected & Cancelled) is
  counted **per parameter** — one entry in a sample's `requestedTests[]` =
  1 — reading each parameter's own `status` field rather than the sample's
  rolled-up `status`. This is what correctly captures partial releases (the
  3-parameter example above now contributes 1 to "Tested & Released" and 2
  to "In Testing", instead of being entirely hidden in one bucket).

Sample-level `status` (`registered`, `received`, `on_hold`, `rejected`,
`cancelled`) is still used first, *before* looking at individual parameter
statuses — these five are custody decisions about the physical sample
(the sample hasn't been assigned yet, or has been paused/rejected/cancelled
as a whole), not something the parameter rollup governs, so every one of
that sample's requested parameters is bulk-assigned to the matching bucket
in those cases. Only once a sample is past that point (`assigned` through
`released`, i.e. inside the rollup range) does the function look at each
`requestedTests[i].status` individually.

**Identity that always holds** (verified by construction, not just by
testing — see the code comment on `computeSampleLifecycleV2`):

```
Total Parameters Requested  =  In Testing + Awaiting Review/Approval/Release
                                + Tested & Released + Rejected & Cancelled
```

No sample or parameter is ever skipped or counted twice, because every
`requestedTests[]` entry across the whole `samples` array is classified
into *exactly one* of those four buckets.

`Overdue (TAT Breached)` is **not** part of that sum — it's a cross-cutting
alert over samples already counted in In Testing / Awaiting Review that
have also breached turnaround time (Urgent priority > 1 day, others > 5
days, measured from `collectionDate`). It can and will overlap with those
two cards; that's intentional, not a bug — it was the confusing part of
the old "Active Samples" card, now made explicit as its own labeled thing.

`On Hold` samples are folded into **In Testing** (their sub-label shows
"incl. N on hold" when relevant) rather than getting a 5th card, since the
whole-sample pause has the same practical meaning ("not yet done, not
released") as the rest of that bucket.

### Archived samples: included, not excluded

Archiving never strips `requestedTests[]`, `status`, or `collectionDate`
off a sample — it only adds `archived: true`/`archivedAt`. So
`computeSampleLifecycleV2()` reads straight from the raw `samples` prop
with **no archived filter at all**; archived and live samples are counted
identically, exactly once each. The `archived_records` collection (used
only for the Archive tab's own list and the "N archived batches" link next
to this section's header) is never consulted for any of these counts
anymore, which is what makes the double-count structurally impossible now
rather than just patched over.

The "Tested & Released" card shows a `live · archived` sub-line purely for
transparency — it's a breakdown of the one number, not two numbers added
together.

### Dynamic period filter

A "Period" control above the cards lets you pick:
- **All Time** (default) — no filtering, same as the old unfiltered view.
- **Month** — any calendar month (native month list, all months from the
  earliest fiscal year present in the data through the current month).
- **Fiscal Year** — a single fiscal year (July–June, e.g. "2025-26"),
  consistent with the fiscal-year charts already on this same page and
  with the Monthly Progress Report's own fiscal-year convention.
- **Fiscal Year Range** — an inclusive `From FY` → `To FY` range.

Fiscal year dropdown options are generated from the actual data
(`fiscalYearsFromSamples()`, keyed off `receivedDate`) — earliest fiscal
year with any sample through the current one — so old data is always
reachable and the dropdown is never empty on a fresh install.

## Dashboard — v3: matching the Monthly Progress Report exactly

The v2 design above used one date field (`collectionDate`) for everything.
Two follow-up problems came up in practice and both are fixed now:

### 1. Wrong date field for "Total Samples Received"

`collectionDate` is when a sample was **collected in the field**;
`receivedDate` (a separate field, entered at registration) is when it
**arrived at the lab**. "Total Samples Received" now reads `receivedDate`,
not `collectionDate`. `fiscalYearsFromSamples()` was updated to match (its
Year/Range dropdowns are now built from `receivedDate` too).

### 2. The Monthly Progress Report's own date bug

`computeMonthlyProgressStats()` (17-report-generator.js) used to bucket an
entire sample into a month/FY using `mprSampleDate()`, which looks for
`requestedTests[i].updatedAt` — a field that **is never actually written
anywhere in the codebase**. That filter always comes back empty, so every
report was silently falling back to `sample.updatedAt` (the sample
document's last-saved timestamp, bumped by *any* edit to *any* field, not
specifically a release) or `sample.collectionDate`. This has now been
fixed: each released parameter is dated by **its own test record's `date`
field** (the "Test Date" entered on Add Test Record, resolved via the
existing `getSampleResultForTest()` helper, which already returned
`date: r.date` — it just wasn't being used for date-bucketing before).
This is also more correct on its own terms: two parameters on the same
sample tested in different batches on different days now land in their
own correct months instead of being blended under one sample-wide date.
The "samples" headcount inside each MPR bucket is still counted once per
sample (not once per parameter) by tracking whether that sample has
already been counted for the current month/cumulative window.

Because the 5-fiscal-year Revenue and Samples-vs-Parameters charts on this
same Dashboard page already call `computeMonthlyProgressStats()` directly,
they inherited this fix automatically — no separate change was needed for
them. The "Test Type" bar chart further down this file had the same
`rt.updatedAt`-based bug independently and was fixed the same way (now
uses `getSampleResultForTest()`'s `date` too).

### 3. Dashboard's pipeline cards now use the same per-parameter test date

`computeSampleLifecycleV2()` was restructured so **each parameter carries
its own anchor date** instead of the whole sample sharing one:

- A parameter that has reached `results_entered` / `under_review` /
  `approved` / `released` is dated by its own test record's `date` (same
  field, same resolution as the MPR fix above) — so "Tested & Released"
  for a given period now matches MPR's "Total Parameters Tested" for that
  same period **exactly**, by construction.
- A parameter still `pending`/`in_progress`, or one that never got tested
  because its sample is `rejected`/`cancelled`/`on_hold`/`registered`/
  `received`, has no test record yet — the only date available for it is
  the sample's `receivedDate`.

The identity from v2 still holds, now on this mixed-but-per-parameter-
consistent date rule:

```
Total Parameters Requested  =  In Testing + Awaiting Review/Approval/Release
                                + Tested & Released + Rejected & Cancelled
```

**Trade-off, stated plainly:** "Total Samples Received" (dated by
`receivedDate`) and "Total Parameters Requested" (dated per-parameter, by
test date once tested) can now disagree on *which* samples they're
counting once a period narrower than All Time is selected — e.g. a
parameter from a sample received in February but tested in March counts
toward March here, not February. This is intentional: the two cards are
answering different questions ("what arrived in this period" vs. "what
had pipeline/release activity dated to this period", the latter being the
one MPR itself answers), not a bug. `Overdue` is judged against the
`receivedDate`-in-period sample set, same as "Total Samples Received", not
against the per-parameter set.

### Unspecified rows in the Monthly Progress Report

Checked for a bug here — there isn't one in the calculation. `references`,
`samples`, and `testRecords` all load together in a single
`DataService.multiList()` call and the whole app is blocked behind one
`loaded` flag until that call returns (99-app.js), so `references` cannot
be missing/incomplete by the time the Reports tab renders — an async
load-order race was ruled out. `mprClientType()` itself is also correct.

The real cause: a sample shows "Unspecified" whenever its linked
Reference's `clientType` field is blank. Two ways that happens:
- **Legacy migration** — `migrateBatchRefsToReferences()`
  (19-reference-model.js) auto-creates a Reference for any pre-existing
  sample that predates the Reference/Client-Type model, but never sets
  `clientType` on it (only `refNo`, `sourceType`, and a note asking staff
  to verify/fill in details) — `createReference()` then defaults that to
  `""`, which reads as "Unspecified".
  - Any Reference created this way carries the note *"Auto-migrated from
    legacy Batch Ref field — please verify source type and add
    organization/contact details."* — that's how to find them in the
    References tab.
- **Optional field** — Client Type is not a required field on the New
  Reference form (only Tracking No. is enforced), so it can also be
  submitted blank going forward.

Fix per-record: edit the Reference in the References tab and set its
Client Type — the sample(s) under it will move out of "Unspecified" the
next time a report is run. No code change was needed for this; flagged
here in case a "make Client Type required" and/or a "find blank Client
Type References" follow-up is wanted later.

### Follow-up: the two "Unspecified" fixes, implemented

**1. Client Type is now required.** `submitClientPart()`
(21-sample-ui.js) rejects a blank Client Type the same way it already
rejected a blank Tracking No. or "Others" without its specify-text, and
the Client Type field's label carries the same red-asterisk marker as
Tracking No. This is a single shared component (`ClientPartFields`),
used by all three places a Reference gets created (manual registration,
bulk-upload popup, and the inline "new Client entry" picker), so the
requirement applies everywhere at once.

**2. "N Missing Client Type" fixer.** There is no standalone References
tab/page in this app — References are created inline during sample
registration and otherwise only referenced by ID, with no browse/edit
screen anywhere (the model already had an unused `editReference()`
helper, now finally called). Rather than invent a new top-level tab for
this one narrow task, a small warning-toned button — `"N Missing Client
Type"` — was added to the existing Samples tab toolbar (next to "Import
Data" / "Download Template"), visible only when
`references.filter(r => !r.clientType)` is non-empty. It opens
`FixClientTypesModal` (21-sample-ui.js, defined just above `SamplesTab`):
one row per blank-Client-Type reference, showing its label, sample count,
and (for legacy-migrated ones) the auto-migration note so the reason it's
blank is visible at a glance; each row gets its own Client Type dropdown,
and "Save All" applies every filled-in row in one pass via
`editReference()` + `setReferences()`.

### Follow-up: Dashboard revenue not matching MPR for the current period

Found and fixed. The 5-fiscal-year bar chart, the Client Type pie chart,
and the Test Type bar chart on this same Dashboard page were all built
from `activeSamples = samples.filter(s => !s.archived)` — silently
excluding any sample flagged `archived: true` — while the Monthly
Progress Report page itself (14c-analytics-pages-2.js) passes the raw,
unfiltered `samples` array into `computeMonthlyProgressStats()`.

Archiving a sample never strips its `requestedTests[]`/results (see the
v3 note above), so that filter looked harmless — but
`computeMonthlyProgressStats()` has exactly **one** other path for
archived data: a separate loop over the `archived_records` collection
that "doesn't retain raw result values" and deliberately contributes
**zero revenue** (samples/parameter-tally only, filed under
Others/Non-Exceed). So any archived-flagged sample whose test record
was still physically present in `testRecords` — which includes any
sample carrying `archived: true` from seeded/imported data, or one
archived through any future path that doesn't also delete its
testRecords — had its real revenue silently dropped on this page while
MPR's own page still counted it correctly. Two calls to the same
aggregation function disagreeing only because one of them was quietly
handed a smaller sample list.

Fix: the FY chart, pie chart, and test-type chart on this page now all
read straight from `samples` (no archived filter), exactly matching what
the Monthly Progress Report page passes. `activeSamples` was removed
entirely rather than left unused.

## Monthly Progress Report — Fiscal Year + Month picker, dynamic cumulative column

### 1. Fiscal Year + Month picker (replaces the old single Month dropdown)

`MonthlyProgressReportPage` (14c-analytics-pages-2.js) used to have one
Month dropdown, built from a hardcoded `BASELINE_FY_START_YEAR = 2025` and
capped at "today" (`mprMonthOptions(BASELINE_FY_START_YEAR, currentMonthKey)`)
— so there was no way to pick a Fiscal Year directly, and a future month
could never be selected at all.

Now there are two dropdowns:
- **Fiscal Year** — `fyOptions` spans every FY present in the data
  (`fiscalYearsFromSamples()`, the same helper 30-dashboard.js's period
  filter uses), widened by a couple of years on both ends (past and
  future) so there's always room to plan ahead or backfill old paper
  records, even on a fresh install with no data yet.
- **Month** — `fyMonthOptions` is always the fixed 12 months of whichever
  FY is selected (July through June), not filtered by whether data
  exists for them. Switching Fiscal Year resets the month to that FY's
  July, unless today's real month happens to fall inside the newly
  picked FY (in which case it jumps straight to "now" instead).

Picking a month/FY with no data doesn't get blocked by the dropdown —
the table (on-screen preview and the print popup both render through the
same `buildMonthlyProgressReportTableHtml()`, so they can't drift apart)
already had a "No released samples found for {month}" row for an empty
result set; that now naturally covers future/no-data selections too,
verified directly (empty `samples`/`testRecords`, `selectedMonth:
"2030-03"` → `rows.length === 0`, no errors).

### 2. The "Cumulative" column now means "up to the END OF THE PRIOR month"

Previously, selecting e.g. December 2026 made the cumulative column cover
July 1 – December 31, 2026 — i.e. it silently re-included everything the
"During this Month" column already showed. That's now fixed:
`computeMonthlyProgressStats()`'s cumulative window ends at the last day
of the month BEFORE the selected one (`new Date(selYear, selMon - 1,
0)` — JS's Date rolls month `0` over to December of the previous year on
its own, so selecting July itself — the first month of the FY — correctly
produces an end-date before `fyStart`, making the window empty with no
special-casing needed). "During this Month" and "Cumulative" are now two
non-overlapping pieces that add up to the FY-to-date total, rather than
the second one silently containing the first.

The column header is now dynamic — `stats.cumulativeAsOfLabel` — showing
the actual last month included (e.g. selecting December/2026 labels the
column "Up to November/2026", and it holds July–November data only). This
replaced the old hardcoded `stats.fyStartLabel` ("July/2026", unchanging
regardless of which month was selected) in: all three "Up to" table
headers (Number of Sample Tested / Total Number of Parameter Tested /
Revenue), the CSV export column names, and the on-screen explanatory
footnote. `fyStartLabel` itself is kept (still correct as "the FY started
in July/2026") since nothing else depended on its old, now-wrong-sounding
usage as a cumulative-column header.

Verified directly with a 6-month synthetic dataset (one released,
fee-applicable parameter per month, July–December 2026): selecting
December returns `duringMonth = 1 sample / ৳100` (December only) and
`cumulative = 5 samples / ৳500` (July–November) — no overlap, no
double-count — and selecting July returns `cumulative = 0` as expected.

### 3. "Released sample" vs. "Add Test Record" — how Tested & Released is built

Asked directly, so answering precisely: it's **both**, deliberately.
- The **status filter** is "released": only parameters whose
  `requestedTests[i].status === "released"` are counted at all (matches
  the v3 note above — `sample.status` itself is a bottleneck rollup, so
  this is always checked per-parameter, never per-sample).
- The **date** used to place that parameter into a specific month/FY is
  its own Add Test Record `date` field (the "Test Date" entered when the
  batch/record was created), resolved via `getSampleResultForTest()` —
  not a separate "release timestamp" (there isn't one — see the v3 note's
  explanation of `rt.updatedAt` never actually being written).

This is the exact same rule in both places that show "Tested & Released":
MPR's `computeMonthlyProgressStats()` and the Dashboard's
`computeSampleLifecycleV2()`. Same status filter, same date field, same
resolution function — which is what guarantees the two screens agree.

### 4. "Unspecified" sample revenue not being added to MPR — investigated, not reproduced

Tested directly rather than guessing: wrote a small Node harness that
loads the real `computeMonthlyProgressStats()` (and its dependencies —
`getSampleResultForTest()`, `resolveParameterConfig()`, etc. — straight
from the actual source files, not a reimplementation) and fed it
synthetic samples with no Reference/blank Client Type (i.e. "Unspecified")
carrying released, fee-applicable parameters, in both the single-record
shape and the Analytical-Batch (`memberSampleIds`/`memberResults`) shape.
In both cases the "Unspecified" row's revenue was computed correctly and
included in the grand total (e.g. one ADP + one Unspecified sample, ৳200
Standard Fee each → totals.revenue = 400, both rows individually correct).

No bug was found in the calculation logic itself this way. The mismatch
being seen is most likely specific to the actual uploaded data — the
leading candidates, in order of likelihood: (a) the sample(s) in question
have gone through the Archive action and their test record's `date`/raw
results were purged (the `archived_records` fallback path deliberately
contributes zero revenue for anyone, any client type — see the v3 note),
or (b) the comparison is against the Report → Executive Dashboard /
Revenue Analytics page specifically, which was never part of this
matching effort and still prices revenue completely differently (flat
Test Type `unitCost` × billed samples, not per-parameter Standard Fee —
see the very first "Dashboard vs MPR" note in this README). Flagging here
rather than shipping a speculative fix; a specific sample/reference code
showing the discrepancy would let this be traced precisely.

