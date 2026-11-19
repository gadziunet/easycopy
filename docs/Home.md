# EasyCopy

**English** · [Polski](Strona-glowna)

EasyCopy is a simple website archiver for your homelab. It makes a copy of a site that you can
browse offline – in the spirit of SiteSucker or WebCopy, with a few simple presets instead of
dozens of options. It runs as one application in a single Docker container:

- **web panel** (port 8080) – add copies, follow progress, set up schedules and notifications,
- **archive server** (port 8081) – finished copies open here,
- **worker** – downloads sites in the background.

> **Status:** development version. The first release (0.1.0) hasn’t been made yet,
> so the Docker image only has the `edge` tag (the current `main` branch).

## Where to start

1. [Installation](Installation) – Docker Compose, first run, updates, running without Docker.
2. [Using the panel](Using-the-panel) – a new copy, the job log, schedule, notifications.
3. [Archive server](Archive-server) – where copies are, how they are protected, archive layout.

## All pages

| Page | What you’ll find there |
|------|------------------------|
| [Installation](Installation) | Docker Compose, updating, reverse proxy, without Docker |
| [Unraid](Unraid) | PUID/PGID, where to keep the database and the archives |
| [Using the panel](Using-the-panel) | new copy, presets, depth, jobs, log, schedule, deleting, notifications, language |
| [Command line](Command-line) | `easycopy <address>` and all options, `start`, `serve`, `reset-password` |
| [Archive server](Archive-server) | addresses, security (separate port, sandbox), single-port mode, archive layout |
| [Configuration](Configuration) | all environment variables |
| [Troubleshooting](Troubleshooting) | connection errors, blocks, HTTPS errors, file systems |
| [Development](Development) | tests, code structure, translations, editing this wiki |

## What EasyCopy does – and what it doesn’t

- Downloads a page with its subpages up to a set depth, with page and size limits.
- Rewrites links to relative ones while downloading, so a copy opens straight from disk too.
- Downloads assets from other domains (CSS, fonts, images, scripts from CDNs) into `_ext/`.
- Converts old character encodings to UTF-8.
- Is a **polite crawler**: keeps a request rate per host, respects `robots.txt` and `Crawl-delay`,
  slows down or pauses when a server shows signs of blocking.
- **Never tries to bypass protections** such as Cloudflare. If a site does not want to be copied,
  EasyCopy stops.
- Is not a full browser: pages that build their content only with JavaScript may be incomplete
  in the copy.
