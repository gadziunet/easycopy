# Konfiguracja

[English](Configuration) · **Polski**

EasyCopy konfigurujesz zmiennymi środowiskowymi (w Dockerze: sekcja `environment` w
`docker-compose.yml`). Ustawienia panelu, takie jak powiadomienia i konta, są zapisane w bazie.

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `PUID`, `PGID` | `1000` | właściciel zapisanych plików (Unraid: `99` i `100`) |
| `TZ` | `UTC` | strefa czasowa dat w panelu i harmonogramu, np. `Europe/Warsaw` |
| `EASYCOPY_LANG` | brak | język domyślny: `en` albo `pl` (bez tego – język przeglądarki, potem angielski) |
| `ARCHIVE_PASSWORD` | brak | hasło do archiwów (Basic Auth, nazwa użytkownika dowolna) |
| `ARCHIVE_BASE_URL` | `http://<host panelu>:8081` | adres archiwów w linkach panelu, np. za reverse proxy |
| `PANEL_PORT` | `8080` | port panelu w kontenerze |
| `ARCHIVE_PORT` | `8081` | port serwera archiwów w kontenerze; `0` = jeden port, archiwa w panelu |
| `HOST` | `0.0.0.0` | adres nasłuchu `easycopy start` |
| `ARCHIVE_HOST` | `0.0.0.0` | adres nasłuchu `easycopy serve` |
| `DATA_DIR` | `/data` | baza panelu (SQLite) i ustawienia |
| `ARCHIVE_DIR` | `/data/archiwa` | katalog archiwów |
| `EASYCOPY_PROJECT_URL` | repozytorium na GitHubie | link „Kod źródłowy” i adres w User-Agencie; dla forków (AGPL) |

## Język

Kolejność, w jakiej panel wybiera język:

1. język zapisany w koncie użytkownika,
2. ciasteczko języka (wybór na stronie logowania),
3. `EASYCOPY_LANG`,
4. język przeglądarki (`Accept-Language`),
5. angielski.

Powiadomienia wysyłane są w języku osoby, która ostatnio zapisała ich ustawienia.

## Porty w Dockerze

`PANEL_PORT` i `ARCHIVE_PORT` zmieniają porty **wewnątrz** kontenera. Żeby użyć innych portów
na serwerze, zmień tylko lewą stronę w `ports`, np. `"9080:8080"`.
