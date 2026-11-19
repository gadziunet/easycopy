# Configuration

**English** · [Polski](Konfiguracja)

EasyCopy is configured with environment variables (in Docker: the `environment` section of
`docker-compose.yml`). Panel settings such as notifications and accounts are stored in the database.

| Variable | Default | Description |
|----------|---------|-------------|
| `PUID`, `PGID` | `1000` | owner of the saved files (Unraid: `99` and `100`) |
| `TZ` | `UTC` | time zone for dates in the panel and for the schedule, e.g. `Europe/London` |
| `EASYCOPY_LANG` | none | default language: `en` or `pl` (without it – the browser language, then English) |
| `ARCHIVE_PASSWORD` | none | password for the archives (Basic Auth, any username) |
| `ARCHIVE_BASE_URL` | `http://<panel host>:8081` | address of the archives in panel links, e.g. behind a reverse proxy |
| `PANEL_PORT` | `8080` | panel port inside the container |
| `ARCHIVE_PORT` | `8081` | archive server port inside the container; `0` = one port, archives in the panel |
| `HOST` | `0.0.0.0` | listen address of `easycopy start` |
| `ARCHIVE_HOST` | `0.0.0.0` | listen address of `easycopy serve` |
| `DATA_DIR` | `/data` | panel database (SQLite) and settings |
| `ARCHIVE_DIR` | `/data/archiwa` | archive folder |
| `EASYCOPY_PROJECT_URL` | GitHub repository | the “Source code” link and the address in the User-Agent; for forks (AGPL) |

## Language

Order in which the panel picks the language:

1. the language saved in the user’s account,
2. the language cookie (chosen on the sign-in page),
3. `EASYCOPY_LANG`,
4. the browser language (`Accept-Language`),
5. English.

Notifications are sent in the language of the person who last saved the notification settings.

## Ports in Docker

`PANEL_PORT` and `ARCHIVE_PORT` change the ports **inside** the container. To use different ports
on the server, change only the left side in `ports`, e.g. `"9080:8080"`.
