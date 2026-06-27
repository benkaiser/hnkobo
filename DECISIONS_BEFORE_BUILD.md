# Decisions Before Build

Companion to `VISION.md`. `VISION.md` is human-authored and stays as-is; this file
captures the implementation decisions and open considerations agreed before building.

## Locked decisions

| Area | Decision |
|------|----------|
| Tech stack | Node.js, Express, server-rendered HTML (no client framework) |
| Storage | SQLite (single file) holding stories, comments, and scraped article text |
| Comment tree UI | Minimal JS toggle for expand/collapse, with big tap targets |
| Article images | Hotlink original URLs (no local rehosting) |
| Deployment / access | LAN-only, plain HTTP, no auth |
| HN data source | Algolia HN API (high rate limit: 10k req/hour/IP) |

### Data source detail
- Story list: `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=points>X`
  (X defaults to 300, configurable via `.env`).
- Comments: `https://hn.algolia.com/api/v1/items/{id}` returns the **entire nested
  comment tree in a single request**.
- Budget: ~1 list call + ~30 item calls = **~31 requests/hour**. Well within limits.

### Read / visited state
- Track read/visited state **server-side** in SQLite (single personal user, no auth
  needed). Mark a story as read when its comments or scraped-article view is opened.
- Dim already-read stories on the front page.

### Retention / refresh policy
- **Comments:** re-cached every run (hourly by default).
- **Article bodies:** scraped **once** and kept; not re-fetched on later runs.
- **Stories:** kept for **7 days**, then purged.
- **Front page:** renders all stories from the last 7 days on **one page**, sorted
  strictly by HN **post time (`created_at`) descending** (most recent first), so the
  user scrolls a week of top stories in pure chronological order. Sort is by original
  post time, **not** by when the scraper first saw the story cross the threshold.
- **Front-page volume:** render **all** unique stories from the last 7 days on one
  long page (no cap, no pagination). De-dupe so a story appearing in multiple runs
  shows once.

### Story list / threshold semantics
- "The list" per run is purely what the `points>X` query returns (~30 stories).
- Comments are re-fetched **only** for those ~30 current-above-threshold stories each
  run — not for all stories in the 7-day window.
- A story dropping below the threshold is **not** purged early; only the 7-day age
  purge removes it. Once cached it sticks around for the full window.

### Comment display
- Default expand state: show the **top level and the first level of replies**
  (i.e. 2 levels deep) expanded; deeper nesting is collapsed and revealed on tap.

### Article extraction
- Best-effort extraction (readability-style). When extraction fails, fall back to
  showing the "direct link" button so the user can open the live article.
- **Failure is permanent:** if the first extraction attempt fails, mark the article
  failed and do **not** retry on later runs — the story shows direct-link only.

## Configuration (`.env`)
- `POINTS_THRESHOLD` — the `over?points` / `points>` value (default `300`).
- `SCRAPE_INTERVAL` — how often the scrape runs (default hourly).
- (To confirm during build) `PORT`, `DB_PATH`, retention window override.

## Open considerations / edge cases to handle during build

### Scraping & extraction
- **Non-article posts:** Ask HN / Show HN with no URL, or post text only — the
  "scraped article" view should show the HN post text itself; gracefully handle the
  missing external URL.
- **Unsupported link types:** PDFs, videos, image-only pages, X/Twitter, paywalls —
  define a clear "couldn't extract, use direct link" fallback.
- **Politeness:** even with headroom, cap concurrency on article fetches and set a
  sane request timeout so a slow/hanging site doesn't stall the whole scrape.
- **Partial scrape failure:** keep serving the previous cache rather than rendering a
  broken page; a failed article fetch shouldn't lose the story or its comments.

### Comments
- Handle `[flagged]` / `[dead]` / deleted comments and deleted users.
- Very deep nesting — cap or clamp indentation so it doesn't blow out width on a
  narrow e-ink render.
- Unicode / emoji / code blocks in comment text.

### Kobo rendering
- Elipsa 2e screen is ~1404x1872. Pick **sane default** base font size and content
  width; the device has built-in zoom, so the user can zoom if needed — no need to
  make sizing configurable.
- Plaintext-y, minimal CSS, no web fonts — optimize for fast e-ink render.
- Tap targets sized in px for the e-ink touch layer; no hover-dependent UI.
- Keep the JS toggle tiny and degrade sensibly if JS is slow/disabled.

### Operational
- Scheduler: in-process interval/cron with a **concurrency guard** so two scrapes
  never overlap.
- Serve stale cache on scrape failure.
- 7-day purge job for old stories (and their comments/articles).

## Resolved (previously open)
- **Read/visited state:** tracked server-side in SQLite; read stories dimmed on the
  front page (single personal user, so no per-client storage needed).
- **Font size / content width:** ship sane defaults; rely on the device's built-in
  zoom rather than making sizing configurable.
