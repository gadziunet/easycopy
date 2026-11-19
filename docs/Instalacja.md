# Instalacja

[English](Installation) · **Polski**

## Docker Compose (zalecane)

Utwórz katalog, np. `easycopy`, a w nim plik `docker-compose.yml`:

```yaml
services:
  easycopy:
    image: ghcr.io/gadziunet/easycopy:edge   # po wydaniu 0.1.0: :latest
    container_name: easycopy
    restart: unless-stopped
    init: true
    ports:
      - "8080:8080"   # panel
      - "8081:8081"   # archiwa
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Warsaw
      # - EASYCOPY_LANG=pl
      # - ARCHIVE_PASSWORD=zmien-to-haslo
    volumes:
      - ./data:/data
```

Uruchom:

```bash
docker compose up -d
```

Obraz działa na amd64 i arm64 (np. Raspberry Pi 4/5).

## Pierwsze uruchomienie

1. Otwórz panel: `http://<adres-serwera>:8080/`, np. `http://192.168.1.10:8080/`.
2. Panel poprosi o utworzenie **konta administratora** (login i hasło).
   Od razu zostaniesz zalogowany.
3. Kliknij **Nowa kopia**, wpisz adres i wybierz tempo – zobacz [Korzystanie z panelu](Korzystanie-z-panelu).
4. Gotowe kopie otwierają się na serwerze archiwów: `http://<adres-serwera>:8081/`.

`PUID` i `PGID` decydują, kto jest właścicielem zapisanych plików. Swojego użytkownika sprawdzisz
poleceniem `id` na serwerze (w większości systemów Linux to `1000`). Na Unraid ustaw `99` i `100`
– zobacz [Unraid](Unraid-PL).

## Aktualizacja

```bash
docker compose pull
docker compose up -d
```

Dane (baza i archiwa) są w katalogu `./data` i zostają bez zmian.
Zmiany w bazie wprowadzają się same przy starcie.

## Za reverse proxy

EasyCopy działa po zwykłym HTTP. Dla HTTPS postaw je za reverse proxy (Nginx Proxy Manager,
Caddy, Traefik, Nginx). Użyj **dwóch adresów** – jednego dla panelu, drugiego dla archiwów,
np. `easycopy.example.com` → port 8080 i `archiwa.example.com` → port 8081.
Osobne adresy zachowują dodatkową ochronę osobnego źródła (zobacz [Serwer archiwów](Serwer-archiwow)).

Wymagania wobec proxy:

- przekazuje oryginalny nagłówek `Host` (większość proxy robi to domyślnie) – formularze panelu
  są przyjmowane tylko wtedy, gdy `Origin` zapytania zgadza się z `Host`,
- wysyła `X-Forwarded-Proto: https` – ciasteczko sesji dostaje wtedy flagę `Secure`.

Podaj panelowi adres archiwów, żeby jego linki prowadziły we właściwe miejsce:

```yaml
    environment:
      - ARCHIVE_BASE_URL=https://archiwa.example.com
```

## Bez Dockera

Potrzebujesz Node.js 22.13 lub nowszego. EasyCopy nie ma zależności z npm, więc nic nie instalujesz.

```bash
git clone https://github.com/gadziunet/easycopy.git
cd easycopy
node src/cli.js start                       # panel (8080), archiwa (8081) i worker, dane w ./data
node src/cli.js https://www.example.com/    # albo jedna kopia z wiersza poleceń do ./archiwa
node src/cli.js serve                       # albo sam serwer archiwów
```

Wszystkie polecenia i opcje: [Wiersz poleceń](Wiersz-polecen).
