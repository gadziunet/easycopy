# Unraid

**English** · [Polski](Unraid-PL)

## Settings

- `PUID=99` and `PGID=100` (the `nobody:users` user, as in other Unraid containers).
- Ports: `8080` (panel) and `8081` (archives).

## Where to keep the data

**Keep `/data` on the cache pool**, e.g. `/mnt/cache/appdata/easycopy` – **not** in `/mnt/user/…`
and not on a network share (NFS, SMB).

`/data` holds the panel database (SQLite). SQLite needs reliable file locking, which does not
work properly on `/mnt/user` (FUSE) or on network shares – the database could get corrupted.
If EasyCopy detects such a file system, the panel shows a warning.

Large archives can live on the array. Mount them as a separate volume:

```yaml
    volumes:
      - /mnt/cache/appdata/easycopy:/data
      - /mnt/user/web-archives:/data/archiwa
```

Archives are plain files (HTML, CSS, images), so the array is fine for them.

## Example `docker-compose.yml`

```yaml
services:
  easycopy:
    image: ghcr.io/gadziunet/easycopy:edge
    container_name: easycopy
    restart: unless-stopped
    init: true
    ports:
      - "8080:8080"
      - "8081:8081"
    environment:
      - PUID=99
      - PGID=100
      - TZ=Europe/London
    volumes:
      - /mnt/cache/appdata/easycopy:/data
      - /mnt/user/web-archives:/data/archiwa
```
