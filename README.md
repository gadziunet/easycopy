# EasyCopy

**English** · [Polski](README.pl.md)

A simple website archiver for your homelab. It makes a copy of a site for offline browsing,
in the spirit of SiteSucker or WebCopy, with a few simple presets instead of dozens of options.
It runs in a single Docker container.

> **Status:** development version – the first release (0.1.0) hasn’t been made yet.
> The web panel, making copies, the archive server, the schedule and notifications work.
> Until the release the image only has the `edge` tag (the current `main` branch).

## What it does

- Downloads a page together with its subpages up to a set depth, with page and size limits.
- Rewrites links to relative ones while downloading – a copy opens straight from disk
  (`index.html`), from a USB stick or through the built-in server, under any path.
- Also downloads assets from other domains (CSS, fonts, images, scripts from CDNs) into `_ext/`.
- Links to other sites lead to the original. Subpages of the archived site that weren’t
  downloaded lead to a `_brak.html` page with the reason and an “Open the original” button.
- Converts character encodings to UTF-8 (e.g. old pages in ISO-8859-2 / Windows-1250).
- Is a “polite crawler”: keeps a request rate per host, respects `robots.txt` and `Crawl-delay`,
  and when it sees signs of blocking (HTTP 429, 503 with `Retry-After`, a Cloudflare challenge
  page) it slows down or pauses. **It never tries to bypass protections.**
- Keeps successive versions of a copy and serves them with safe headers (sandbox).
- Has a simple web panel: a new copy in a few clicks, a job queue, live progress, a log,
  a schedule and notifications (ntfy, Gotify, Pushover, Discord, webhook).
- Speaks English and Polish – pick the language on the sign-in page or on the Account page.
- No npm dependencies – all you need is Node.js 22.13 or newer, or Docker.

## Installation: Docker Compose

```yaml
services:
  easycopy:
    image: ghcr.io/gadziunet/easycopy:edge   # after the 0.1.0 release: :latest
    container_name: easycopy
    restart: unless-stopped
    init: true
    ports:
      - "8080:8080"   # panel
      - "8081:8081"   # archives
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/London
      # - EASYCOPY_LANG=en
      # - ARCHIVE_PASSWORD=change-this-password
    volumes:
      - ./data:/data
```

```bash
docker compose up -d
```

- **Panel:** `http://<server-address>:8080/` – add copies and follow their progress here.
  On the first visit the panel asks you to create the administrator account (username and password).
- **Archives:** `http://<server-address>:8081/` – finished copies open here (the panel links to them).

The panel and the archives use separate ports on purpose: archived pages are someone else’s code,
and a separate port is a separate origin for the browser – a copy has no access to the panel session.

### One port instead of two

Set `ARCHIVE_PORT=0` and keep only the panel in `ports` (e.g. `"8080:8080"`). The panel then
serves the archives itself at `http://<server-address>:8080/a/<name>/`.

Copies are still isolated with the `sandbox` header (no access to the panel cookies), but you lose
the extra layer of protection a separate port gives – a malicious archived page is shown under the
same address as the panel. In this mode the archives don’t require signing in to the panel;
protect them with the `ARCHIVE_PASSWORD` variable.

### Schedule, changes and deleting

- **Recurring copies:** in the new copy form, in the “Repeat” section, choose daily, weekly or
  monthly and a time. Every copy is saved as a new version of the archive. Times use the `TZ`
  time zone. Pause, resume, change or delete schedules on the **Schedule** page. When the previous
  copy is still running, the next run is skipped.
- **Stopping and changes:** stop a running download with **Stop** (what has been downloaded stays).
  A queued job can be changed before it starts, and for a finished one **Change settings** opens
  the form with the previous settings and makes a new version.
- **Deleting:** a whole archive (all versions, history and schedule), a single version or an entry
  in the job history. An archive that is being downloaded has to be stopped first.
- **The job log** shows labels (“✓ Downloaded”, “✗ Error”, “– Skipped”) with the error described
  in words, e.g. “not on the server (404)”, and has a **Problems only** filter.

### Notifications

On the **Notifications** page you enable channels – ntfy, Gotify, Pushover, Discord or any
webhook (JSON in a POST request) – and choose when to send a message: copy finished, limit reached,
paused by a server block, error. Notifications can be limited to copies made by the schedule.
**Send a test notification** checks the settings right away. The result of every send goes to the
job log. If you enter the panel address, the message links to the job.

Tokens and webhook addresses are stored in the panel database and aren’t shown in the form
again (an empty field keeps the saved value).

### Language

The panel, the archive server and the command line work in English and Polish. The panel takes
the language from the account settings, then from the browser; change it on the sign-in page or
on the **Account** page. `EASYCOPY_LANG=pl` sets the default for everyone (including terminal
messages). The `_brak.html` page inside a copy is shown in the visitor’s browser language.

### Forgotten password

```bash
docker compose exec easycopy easycopy reset-password
```

The command sets a new random password, prints it and signs out all devices.
Your own password: `easycopy reset-password admin --password new-password`.

### Making copies from the command line

Instead of the panel you can also run:

```bash
docker compose exec easycopy easycopy https://www.example.com/ --preset gentle --depth 2
```

The copy goes to `./data/archiwa/example-com/<date>/` and shows up in the panel right away.
Files are written as the `PUID`/`PGID` user, not as root.

### Environment variables

| Variable           | Default         | Description                                                |
|--------------------|-----------------|------------------------------------------------------------|
| `PUID`, `PGID`     | `1000`          | owner of the files (Unraid: `99` and `100`)                |
| `EASYCOPY_LANG`    | none            | default language: `en` or `pl` (without it – the browser language) |
| `TZ`               | UTC             | time zone for dates in the panel and the schedule          |
| `ARCHIVE_PASSWORD` | none            | password for the archives (any username)                   |
| `ARCHIVE_BASE_URL` | `http://<panel host>:8081` | address of the archives in panel links (e.g. behind a reverse proxy) |
| `PANEL_PORT`       | `8080`          | panel port inside the container                            |
| `ARCHIVE_PORT`     | `8081`          | archive server port inside the container (`0` = one port, archives in the panel) |
| `DATA_DIR`         | `/data`         | panel database (SQLite)                                    |
| `ARCHIVE_DIR`      | `/data/archiwa` | archive folder                                             |

### Unraid

- Set `PUID=99` and `PGID=100`.
- Keep `/data` on the cache pool, e.g. `/mnt/cache/appdata/easycopy` – not in `/mnt/user/…`.
  It holds the panel database (SQLite), and SQLite on network shares (NFS, SMB) and in `/mnt/user`
  (FUSE) can get corrupted. If EasyCopy detects such a file system, the panel shows a warning.
- Large archives can live on the array, mounted separately:

```yaml
    volumes:
      - /mnt/cache/appdata/easycopy:/data
      - /mnt/user/web-archives:/data/archiwa
```

## Without Docker

```bash
git clone https://github.com/gadziunet/easycopy.git
cd easycopy
node src/cli.js start                             # panel (8080), archives (8081) and worker, data in ./data
node src/cli.js https://www.example.com/          # or just a copy from the command line into ./archiwa
node src/cli.js serve                             # or just the archive server
```

## Examples

```bash
# someone else's site – slow and careful, without videos and archives
easycopy https://www.example.com/ --preset gentle --depth 2 --skip mp4,zip,iso

# your own site – fast, full copy, without robots.txt
easycopy https://www.example.com/ --preset fast --depth all --max-pages 0 --no-robots

# the mobile version of a site
easycopy https://www.example.com/ --ua safari --os ios
```

All options: `easycopy --help`, `easycopy start --help` and `easycopy serve --help`.

## Speed presets

| Preset | Requests per second (per host) | In parallel | For                         |
|--------|--------------------------------|-------------|-----------------------------|
| gentle | 0.5                            | 1           | other people’s sites, small servers |
| normal | 2                              | 2           | the default                 |
| fast   | 5                              | 4           | your own sites              |

The Polish names (`delikatny`, `normalny`, `szybki`) work too.
After the first block the rate for that host drops to the “gentle” level. Three blocks in a row
or a browser verification page end the download with the “paused” status – what has already been
downloaded stays and works.

## Depth

Depth is the number of clicks from the start page: `0` – only the start page,
`1` – plus the pages it links to, and so on. Files needed to display a page
(CSS, images, fonts) don’t count as a level.

## Archive server

- `http://<server>:8081/` – list of copies,
- `http://<server>:8081/a/<name>/` – the latest copy,
- `http://<server>:8081/a/<name>/<version>/` – a specific version, e.g. `/a/example-com/2026-11-04/`.

Archived pages are someone else’s code, so the server:

- runs on a separate port – a different origin than the panel for the browser,
- sends every copy with a `Content-Security-Policy: sandbox` header, so a page has no access to
  cookies or data of other sites; JavaScript in a copy is off by default
  (the `--allow-js` option turns it on when making a copy),
- doesn’t allow leaving the copy folder and doesn’t list directories,
- supports video seeking (Range), gzip/brotli compression and cache headers.

## Archive layout

```
data/archiwa/
  example-com/
    2026-11-04/
      index.html
      about/index.html
      css/style.css
      _ext/fonts.googleapis.com/…
      _brak.html
      manifest.json
    latest -> 2026-11-04
```

## Development

```bash
npm test                 # tests – use a local test site, no internet needed
docker build -t easycopy .
```

The `ghcr.io` image is built by GitHub Actions: the `main` branch → `edge` tag,
tag `v1.2.3` → `1.2.3`, `1.2` and `latest` (amd64 and arm64).

## Licence

[GNU AGPL-3.0](LICENSE). You can use, change and distribute EasyCopy, but if you make a changed
version available to others – also as a service over a network – you have to publish its source
code under the same licence.
