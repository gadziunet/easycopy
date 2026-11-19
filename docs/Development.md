# Development

**English** · [Polski](Rozwoj)

## Requirements

- Node.js 22.13 or newer – **no npm dependencies**, only built-in modules
  (the database is the built-in `node:sqlite`).
- Docker for building the image (optional).

```bash
git clone https://github.com/gadziunet/easycopy.git
cd easycopy
npm test                  # tests – use a local test site, no internet needed
node src/cli.js start     # panel and archives on http://localhost:8080 and :8081
docker build -t easycopy .
```

## Code structure

| Folder | What is there |
|--------|---------------|
| `src/worker/` | crawler: downloading, HTML/CSS rewriting, `robots.txt`, block detection, archive layout |
| `src/server/` | archive server |
| `src/panel/` | web panel: HTTP server, views, database, accounts, scheduler, notifications |
| `src/shared/` | URL → path mapping, translations, SQLite, cookies, PUID/PGID |
| `test/` | tests (`node --test`) with a local test site |
| `docs/` | this wiki |

## Rules

- No npm dependencies.
- All tests must pass: `npm test`.
- Every user-facing text goes through the dictionaries `src/shared/locales/en.js` and `pl.js`
  (the same keys in both – a test checks it). Texts stored in the database (log, errors) are
  saved with `msg()` and translated when displayed.
- Panel paths (`/zadania`, `/harmonogram`, …) and the `archiwa` folder stay as they are, for
  compatibility with existing installations.
- The crawler never bypasses protections – it only slows down or pauses.
- Code, comments, commits and the changelog are in English.

## Images

GitHub Actions build the image `ghcr.io/gadziunet/easycopy` (amd64 and arm64):
the `main` branch → the `edge` tag, a `v1.2.3` tag → `1.2.3`, `1.2` and `latest`.

## Editing this wiki

The wiki pages live in the repository in the `docs/` folder. After a push to `main`, a GitHub
Action copies them to the wiki. Change the pages in `docs/`, not in the wiki editor – changes
made only in the wiki are overwritten.

- File name = page name (`Using-the-panel.md` → the “Using the panel” page).
- Link to other pages by name: `[Installation](Installation)`.
- Every English page has a Polish counterpart and the other way round.
- Use example data only: `example.com`, `192.168.1.x`.

## How this project is made

EasyCopy is developed with the help of Claude (an AI assistant by Anthropic).
The author reviews and tests every change before it is published.

## Licence

[GNU AGPL-3.0](https://github.com/gadziunet/easycopy/blob/main/LICENSE). If you make a changed
version available to others – also as a service over a network – you have to publish its source code.
Forks can set their own source code link with `EASYCOPY_PROJECT_URL`.
