# Command line

**English** · [Polski](Wiersz-polecen)

In Docker, run commands inside the container:

```bash
docker compose exec easycopy easycopy <command or address> [options]
```

Without Docker use `node src/cli.js` instead of `easycopy`.
Files are written as the `PUID`/`PGID` user, not as root. Messages are in English or Polish
(`EASYCOPY_LANG=en|pl`, otherwise the system language).

## Commands

| Command | What it does |
|---------|--------------|
| `easycopy <address> [options]` | makes one copy of a website |
| `easycopy start [options]` | runs the panel, the archive server and the worker |
| `easycopy serve [options]` | runs only the archive server |
| `easycopy reset-password` | sets a new panel password |

## Making a copy: `easycopy <address>`

A copy made in the container goes to `/data/archiwa/<name>/<date>/` and shows up in the panel right away.

### Basics

| Option | Description |
|--------|-------------|
| `-o, --out <dir>` | archive folder (`ARCHIVE_DIR`, default `./archiwa`) |
| `-n, --name <name>` | archive name (default: from the domain) |
| `-p, --preset <name>` | speed: `gentle`, `normal`, `fast` (default `normal`); Polish names work too |
| `-d, --depth <n>` | clicks away from the start page (default `3`, `all` = no limit) |
| `--max-pages <n>` | max. number of pages (default `500`, `0` = no limit) |
| `--max-size <size>` | max. size of the copy, e.g. `500MB`, `2GB` (default: no limit) |

### Scope

| Option | Description |
|--------|-------------|
| `--subdomains` | also download subdomains (e.g. `blog.example.com`) |
| `--skip <list>` | skip file types, e.g. `mp4,zip,iso` |
| `--exclude <patterns>` | skip addresses, e.g. `"/cart/*,/account/*"` |
| `--no-robots` | ignore `robots.txt` (only for your own sites!) |

### The copy

| Option | Description |
|--------|-------------|
| `--external-new-tab` | open links to other sites in a new tab |
| `--allow-js` | mark the copy as “with JavaScript” (the archive server lets scripts run) |

### Identification

| Option | Description |
|--------|-------------|
| `--ua <browser>` | `easycopy`, `chrome`, `firefox`, `safari`, `edge` (default `easycopy`) |
| `--os <system>` | `win`, `mac`, `linux`, `android`, `ios` (default `win`) |
| `--user-agent <text>` | custom User-Agent header |

### Other

| Option | Description |
|--------|-------------|
| `-q, --quiet` | print only the summary |
| `-h, --help` | help |
| `-v, --version` | version |

### Examples

```bash
# someone else's site – slow and careful, without videos and archives
easycopy https://www.example.com/ --preset gentle --depth 2 --skip mp4,zip,iso

# your own site – fast, full copy, without robots.txt
easycopy https://www.example.com/ --preset fast --depth all --max-pages 0 --no-robots

# the mobile version of a site
easycopy https://www.example.com/ --ua safari --os ios
```

## `easycopy start`

| Option | Variable | Default |
|--------|----------|---------|
| `--data-dir <dir>` | `DATA_DIR` | `./data` (`/data` in Docker) |
| `--archive-dir <dir>` | `ARCHIVE_DIR` | `<data-dir>/archiwa` |
| `--panel-port <port>` | `PANEL_PORT` | `8080` |
| `--archive-port <port>` | `ARCHIVE_PORT` | `8081` (`0` = archives in the panel under `/a/…`) |
| `--host <address>` | `HOST` | `0.0.0.0` |

## `easycopy serve`

Runs only the archive server, e.g. on another machine that has a copy of the archive folder.

| Option | Variable | Default |
|--------|----------|---------|
| `-d, --dir <dir>` | `ARCHIVE_DIR` | `./archiwa` |
| `-p, --port <port>` | `ARCHIVE_PORT` | `8081` |
| `--host <address>` | `ARCHIVE_HOST` | `0.0.0.0` (whole local network) |
| `--password <pass>` | `ARCHIVE_PASSWORD` | none |
| `-q, --quiet` | | no request log |

## `easycopy reset-password`

```bash
docker compose exec easycopy easycopy reset-password
```

Sets a new random password, prints it and signs out all devices.
To set your own password:

```bash
docker compose exec easycopy easycopy reset-password admin --password new-password
```
