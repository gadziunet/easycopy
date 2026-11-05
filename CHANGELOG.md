# Changelog

## Unreleased (0.1.0 in progress)

- Website copy from the command line: speed presets, depth, page and size limits,
  skipping file types and address patterns, User-Agent choice.
- Links rewritten to relative ones while downloading, CDN assets in `_ext/`,
  a `_brak.html` page for subpages that weren’t downloaded, conversion to UTF-8.
- Polite crawler: per-host rate, `robots.txt`, `Crawl-delay`, reacting to 429/503
  and Cloudflare challenge pages (slowing down, pausing – never bypassing protections).
- Dated copy versions with a `latest` link and a `manifest.json` in every copy.
- Archive server: list of copies, `/a/<name>/`, CSP sandbox header, protection against
  leaving the folder, Range, gzip/brotli, ETag, optional password.
- Web panel (`easycopy start`): archive list, new copy with presets and advanced settings,
  job queue and history, live progress and log, cancelling, retrying
  (also “as Gentle” or in 10 minutes), form protection.
- First-run wizard: the administrator account is created in the browser, passwords hashed
  with scrypt, password change on the Account page (signs out other devices),
  `easycopy reset-password` for a forgotten password.
- Schedule (daily, weekly, monthly at a chosen time) with a page to pause, edit and delete
  schedules; runs are skipped while the previous copy is still running.
- Stopping a running download, changing a queued job, “Change settings” for finished jobs;
  deleting an archive, a single version or a history entry.
- Readable job log: labels, HTTP errors described in words, a “Problems only” filter.
- Notifications: ntfy, Gotify, Pushover, Discord and a JSON webhook; events (finished, limit,
  paused, error), “scheduled copies only”, a test button, results in the job log.
- English and Polish: panel, archive server, `_brak.html` (in the visitor’s browser language)
  and the command line; English is the default, language choice on the sign-in and Account pages,
  `EASYCOPY_LANG` for the default language.
- Worker in a separate process, queue in an SQLite database (built-in `node:sqlite`), a warning
  when the database is on a network share.
- Docker image (amd64, arm64) with PUID/PGID and a healthcheck, example `docker-compose.yml`.
