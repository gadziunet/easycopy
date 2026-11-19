# Unraid

[English](Unraid) · **Polski**

## Ustawienia

- `PUID=99` i `PGID=100` (użytkownik `nobody:users`, jak w innych kontenerach na Unraid).
- Porty: `8080` (panel) i `8081` (archiwa).

## Gdzie trzymać dane

**Katalog `/data` trzymaj na puli cache**, np. `/mnt/cache/appdata/easycopy` – **nie** w `/mnt/user/…`
i nie na udziale sieciowym (NFS, SMB).

W `/data` jest baza panelu (SQLite). SQLite potrzebuje niezawodnych blokad plików, a te nie działają
poprawnie w `/mnt/user` (FUSE) ani na udziałach sieciowych – baza mogłaby się uszkodzić.
Jeśli EasyCopy wykryje taki system plików, pokaże ostrzeżenie w panelu.

Duże archiwa możesz trzymać na macierzy. Podepnij je jako osobny wolumen:

```yaml
    volumes:
      - /mnt/cache/appdata/easycopy:/data
      - /mnt/user/archiwa-www:/data/archiwa
```

Archiwa to zwykłe pliki (HTML, CSS, obrazki), więc na macierzy nic im nie grozi.

## Przykładowy `docker-compose.yml`

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
      - TZ=Europe/Warsaw
    volumes:
      - /mnt/cache/appdata/easycopy:/data
      - /mnt/user/archiwa-www:/data/archiwa
```
