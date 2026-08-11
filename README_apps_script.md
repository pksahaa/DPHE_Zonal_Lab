# DPHE LIMS — Google Apps Script backend

This is the optional server side of the app: `Code.gs` in this folder. Point
the app at it from **Settings → Backend Settings** (storage mode "Google
Apps Script (shared)") and you get:

- **Shared data across devices/users** — the same generic list/save/remove
  CRUD every module in the app already calls through `DataService`.
- **Automatic email backup** — configured from **Settings → Data Backup**:
  on a schedule you pick (daily/weekly/every-2-weeks/monthly), it emails a
  full JSON export as an attachment to whatever address you set, then
  deletes the previous backup email it sent — only the newest one is ever
  left sitting in the inbox.
- Auto-archive (age-based) does **not** need this backend — it runs
  entirely client-side, see the note in `23-data-backup.js`.

## Deploy it (one time)

1. Go to [script.google.com](https://script.google.com), **New project**,
   paste `Code.gs` in over the default stub.
2. **Project Settings ▸ Script Properties**, add:
   | Property | Value |
   |---|---|
   | `API_TOKEN` | any random string — this becomes the "Shared secret / token" you'll paste into the app |
   | `SPREADSHEET_ID` | optional — leave it out and the script creates its own storage spreadsheet automatically the first time it runs |
3. In the editor, select `runOnce_setup` from the function dropdown and hit
   **Run**. The first run asks you to authorize the script — accept it (it
   needs to read/write a Sheet and send Gmail on your behalf, since that's
   what the backup feature does). This installs the one daily trigger the
   whole file relies on and creates the storage spreadsheet immediately.
4. **Deploy ▸ New deployment ▸ Web app**. Execute as **Me**, who has access
   **Anyone**. Deploy, copy the Web App URL.
5. Back in the app: **Settings → Backend Settings** → paste the Web App URL
   and the same token from step 2 → set Storage mode to "Google Apps Script
   (shared)" → Save → reload the page.
6. **Settings → Data Backup** → turn on **Automatic Email Backup** → enter
   the recipient address and frequency → **Save Schedule**.

Re-running `runOnce_setup` any time is safe — it clears and reinstalls the
trigger rather than duplicating it.

## Why the legacy modules need "Sync Local Data to Backend"

Chemicals, Test Types, Test Records, Equipment, Glassware, Gas, Parameters,
Users, and the Permission Matrix are still stored purely in the browser
(`localStorage`) — see the note at the top of `01-data-service.js`. They
don't automatically flow into this backend the way Samples/References/Audit
Log do, so an unattended scheduled email backup would otherwise only ever
contain those newer collections.

**Settings → Data Backup → "Sync Local Data to Backend"** bridges that: it
pushes every legacy collection up via `DataService.bulkSet`, so the backend
actually has something current to email. Saving the automatic-backup
schedule triggers one sync automatically; run it again yourself from time to
time (or after a big batch of changes) to keep the scheduled emails fresh.
Migrating those modules onto `DataService` directly — so every save syncs
itself, with no separate step — is flagged as the natural next phase in the
main `README.md`.

If you never touch "gas" mode at all, none of this matters: **Settings →
Data Backup → "Download Backup Now"** always produces a complete backup by
reading everything directly out of the browser, regardless of backend mode.

## How data is stored

One Google Sheet tab per collection, three columns: `id`, `json` (the whole
record, as-is), `updatedAt`. Deliberately schema-free per row — this app's
record shapes change over time (new fields on a Parameter, a Test Type,
etc.) and a JSON-per-row store never needs a spreadsheet migration when that
happens.

## Security note

`API_TOKEN` is a shared secret, not real authentication — anyone with the
Web App URL *and* the token can read/write everything. Treat the URL and
token the way you'd treat a shared password, and don't commit them into a
public repo. For anything more sensitive than a lab's internal working data,
put this behind Google Workspace domain restrictions on the deployment
instead of (or in addition to) the token.
