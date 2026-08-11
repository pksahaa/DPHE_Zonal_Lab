# Deploying the DPHE Zonal Lab LIMS on GitHub Pages (with logos)

This app needs **no build step**. It's plain HTML/CSS/JS loaded via `<script>`
tags in order, so "deploying" just means putting these files in a GitHub
repo and turning on GitHub Pages.

Your two report-header logos are already wired up to read from this repo —
see "Part 3" below, that's the part you actually asked about.

---

## Part 1 — Create the repo

**Option A — GitHub website (no git installed, easiest)**
1. Go to https://github.com/new
2. Name it (e.g. `dphe-zonal-lims`), set Public or Private, click **Create repository**.
3. On the empty repo page, click **uploading an existing file**.
4. Drag in every file from this folder — all the `.js` files, `index.html`,
   `style.css`, and the `assets` folder — **into the repo root** (not a
   subfolder). Commit.

**Option B — git command line**
```bash
cd path/to/this/folder
git init
git add .
git commit -m "Initial deploy: DPHE Zonal Lab LIMS"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

> Note: the repo's own README explains the files are flat (no `js/`
> subfolder) on purpose — `index.html` references them without a prefix, so
> keep that flat layout.

## Part 2 — Turn on GitHub Pages

1. In the repo, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Click **Save**.
4. Wait ~1 minute, then GitHub shows your live URL, typically:
   `https://<your-username>.github.io/<repo-name>/`
5. Open it — you should see the LIMS login page.

Every time you push a change to `main`, Pages redeploys automatically
(usually within a minute).

## Part 3 — Your two logos (the part you asked about)

The **Settings ▸ Lab Identity / Letterhead** screen in the app already
expects the logos to live in the repo, at:

```
assets/logo_left.png    ← e.g. National Emblem / Government seal
assets/logo_right.png   ← e.g. DPHE emblem
```

These exact paths are the **built-in defaults** — you don't have to type
anything into Settings for this to work. Do this:

1. Get your two logo image files. PNG with a transparent background works
   best; keep them reasonably small (under ~200 KB each) so reports load fast.
2. Name them exactly `logo_left.png` and `logo_right.png`.
3. Put them in the `assets/` folder of the repo (drag-and-drop on GitHub's
   web UI, or `cp` them in locally and `git add/commit/push`).
4. Reload the deployed site. Go to **Settings ▸ Lab Identity**, and you
   should see both previews render automatically — no extra config needed,
   since the app already looks for `assets/logo_left.png` / `assets/logo_right.png`
   by default.

**If you ever want to change the filenames, or host them somewhere else**
(a different path in the repo, or a raw GitHub URL), open **Settings ▸ Lab
Identity** in the app and edit the "GitHub Repo / URL Path" field for each
logo — for example:
```
assets/dphe-emblem.png
https://raw.githubusercontent.com/<user>/<repo>/main/assets/logo_right.png
```
That field is saved in the browser (per-device), so if multiple people use
the app on different computers/browsers, each will pick up the repo default
automatically unless they've overridden it locally.

There's also an **"Or upload custom image file"** option in that same
Settings screen — that stores the image directly in the browser's local
storage instead of the repo. Use the repo (`assets/` folder) method instead
if you want the logo to show up the same way for every user/device that
opens the deployed site — that's the "take it from GitHub" behavior you
asked for.

## Part 4 — A note on the `.gs` files

`Code.gs`, `InitDB.gs`, `ArchiveService.gs`, and `README_apps_script.md` are
for an **optional** Google Apps Script backend (a way to swap local-storage
for a shared Google Sheets backend later). They're not used by GitHub Pages
and don't need to be uploaded there — you can leave them out of the repo, or
leave them in (Pages will simply ignore files it doesn't reference). Nothing
extra to configure for now; the app runs fully client-side with
`localStorage` out of the box.

## Quick troubleshooting

| Symptom | Fix |
|---|---|
| Blank page after deploy | Open browser dev tools console — usually a script 404 from a renamed/missing file, or the repo isn't flat (files sit inside a subfolder). |
| Logos don't show | Check the exact filenames/case (`logo_left.png` vs `Logo_Left.PNG` — GitHub Pages is case-sensitive) and that they're directly inside `assets/`. |
| Changes don't appear | Hard-refresh (Ctrl/Cmd+Shift+R) — Pages + browser both cache aggressively; the `?v=...` query strings on script tags help but images aren't versioned. |
| 404 on the whole site | Double check Pages is set to deploy from `main` / root, and give it a minute after enabling. |
