# Archive server

**English** · [Polski](Serwer-archiwow)

## Addresses

- `http://<server>:8081/` – list of copies,
- `http://<server>:8081/a/<name>/` – the latest copy,
- `http://<server>:8081/a/<name>/<version>/` – a specific version, e.g. `/a/example-com/2026-11-04/`.

The panel links to the archives. If they are behind a reverse proxy or another address,
set `ARCHIVE_BASE_URL` (see [Installation](Installation#behind-a-reverse-proxy)).

## Security

Archived pages are someone else’s code, so the archive server:

- runs on a **separate port** – for the browser it is a different origin than the panel,
  so a copy has no access to the panel session,
- sends every copy with a `Content-Security-Policy: sandbox` header – a page has no access to
  cookies or data of other sites,
- has **JavaScript off** by default; “Allow JavaScript in the archive” (`--allow-js`) turns it on
  for one copy, and scripts still run isolated,
- does not allow leaving the copy folder and does not list directories.

It also supports video seeking (Range), gzip/brotli compression and cache headers (ETag).

## Password for the archives

Set `ARCHIVE_PASSWORD` to protect the archives with a password (Basic Auth, any username).
The `/healthz` health check and fonts requested by sandboxed copies work without the password.

## Single-port mode

Set `ARCHIVE_PORT=0` and publish only the panel port:

```yaml
    ports:
      - "8080:8080"
    environment:
      - ARCHIVE_PORT=0
```

The panel then serves the archives itself at `http://<server>:8080/a/<name>/`.
Copies are still isolated with the `sandbox` header, but you lose the extra protection of a
separate origin – a malicious archived page is shown under the same address as the panel.
In this mode the archives don’t require signing in to the panel; protect them with `ARCHIVE_PASSWORD`.

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
    2026-11-04-2/        ← a second copy made the same day
    latest -> 2026-11-04-2
```

- Every copy is a **version** in a folder named by date. `latest` points to the newest one.
- `_ext/` holds assets from other domains (CDNs, fonts).
- `_brak.html` is shown for subpages of the site that were not downloaded (depth, limit,
  `robots.txt`, errors). It shows the reason and an **Open the original** button, in the
  visitor’s browser language.
- `manifest.json` describes the copy (address, settings, list of files, errors).

## Opening a copy without the server

Links in a copy are relative, so you can also open `index.html` straight from disk, copy the
folder to a USB stick or put it on any web server. Some pages need a server to work fully
(e.g. fonts are blocked by browsers for `file://` addresses).
