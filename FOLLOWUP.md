# Follow-ups / known limitations

The app is built, running, and serving on `http://<LAN-IP>:8089` via the
`hnkobo` systemd user service. Nothing is blocking, but a few things are worth
noting for later.

## Working / verified
- Algolia scrape (40 stories) completes in ~30s, ~41 requests/run.
- Comments cached and rendered (verified 563-comment thread parses cleanly).
- Article extraction works for most sites; permanent fallback to direct link on failure.
- Front page (newest-first, read-dimming), comments (2-level default + tap collapse),
  and article views all render and return HTTP 200.
- systemd user service is enabled + active; `loginctl enable-linger` succeeded, so it
  survives logout/reboot **on this machine** without sudo.

## Known limitations (mostly by design)
1. **Paywalled / bot-blocked sites fail extraction** (Bloomberg, Reuters, some
   openai.com / science.org pages return 401/403). By the agreed design this is a
   *permanent* failure — the story shows "Direct link" only, no retry. If you later
   want better coverage, options: a real browser/headless fetch, or an
   archive.org/readability proxy. Out of scope for v1.
2. **Images are hotlinked**, per decision. If a site blocks hotlinking or the Kobo
   can't fetch it, images simply won't show. Switching to local caching would be a
   follow-up.
3. **No retry on transient article-fetch failures.** A site that was briefly down when
   first seen is marked failed forever. Acceptable per the "mark permanently failed"
   decision, but worth revisiting if it bites.
4. **HN comment HTML is trusted.** We strip `<script>`, `<style>`, and inline
   `on*=` handlers, but otherwise render HN-provided markup as-is. This is fine for a
   single-user LAN app sourcing from HN/Algolia.

## Operational notes
- Reach it from the Kobo at `http://<server-LAN-IP>:8089/`.
- LAN-only, plain HTTP, no auth — as decided. Don't expose port 8089 to the
  public internet without adding auth.
- Logs: `journalctl --user -u hnkobo.service -f`.
- Manual scrape: `curl -X POST http://127.0.0.1:8089/scrape`.

## Possible future enhancements (not requested)
- Read/unread filter or "mark all read".
- Per-story "refresh comments now" button.
- Headless-browser fallback for JS-heavy / paywalled articles.
- Local image caching + grayscale/resize for faster e-ink loads.
