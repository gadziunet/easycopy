# Installation

**English** · [Polski](Instalacja)

## Docker Compose (recommended)

Create a folder, e.g. `easycopy`, and a `docker-compose.yml` file in it:

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

Start it:

```bash
docker compose up -d
```

The image works on amd64 and arm64 (e.g. Raspberry Pi 4/5).

## First run

1. Open the panel: `http://<server-address>:8080/`, e.g. `http://192.168.1.10:8080/`.
2. The panel asks you to create the **administrator account** (username and password).
   You are signed in right away.
3. Click **New copy**, enter an address and pick a speed – see [Using the panel](Using-the-panel).
4. Finished copies open on the archive server: `http://<server-address>:8081/`.

`PUID` and `PGID` decide who owns the saved files. Check your user with `id` on the server
(on most Linux systems it is `1000`). On Unraid use `99` and `100` – see [Unraid](Unraid).

## Updating

```bash
docker compose pull
docker compose up -d
```

Your data (database and archives) is in the `./data` folder and stays as it is.
Database changes are applied automatically on start.

## Behind a reverse proxy

EasyCopy speaks plain HTTP. For HTTPS put it behind a reverse proxy (Nginx Proxy Manager,
Caddy, Traefik, Nginx). Use **two addresses**, one for the panel and one for the archives,
e.g. `easycopy.example.com` → port 8080 and `archive.example.com` → port 8081.
Keeping them separate keeps the extra protection of a separate origin (see [Archive server](Archive-server)).

Requirements for the proxy:

- pass the original `Host` header (most proxies do this by default) – forms in the panel are
  accepted only when the `Origin` of the request matches the `Host`,
- send `X-Forwarded-Proto: https` – the session cookie then gets the `Secure` flag.

Tell the panel where the archives are, so its links point to the right place:

```yaml
    environment:
      - ARCHIVE_BASE_URL=https://archive.example.com
```

## Without Docker

You need Node.js 22.13 or newer. EasyCopy has no npm dependencies, so there is nothing to install.

```bash
git clone https://github.com/gadziunet/easycopy.git
cd easycopy
node src/cli.js start                       # panel (8080), archives (8081) and worker, data in ./data
node src/cli.js https://www.example.com/    # or just one copy from the command line into ./archiwa
node src/cli.js serve                       # or just the archive server
```

See [Command line](Command-line) for all commands and options.
