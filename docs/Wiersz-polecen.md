# Wiersz poleceń

[English](Command-line) · **Polski**

W Dockerze polecenia uruchamiasz w kontenerze:

```bash
docker compose exec easycopy easycopy <polecenie albo adres> [opcje]
```

Bez Dockera zamiast `easycopy` użyj `node src/cli.js`.
Pliki zapisują się jako użytkownik z `PUID`/`PGID`, nie jako root. Komunikaty są po angielsku
albo po polsku (`EASYCOPY_LANG=en|pl`, inaczej język systemu).

## Polecenia

| Polecenie | Co robi |
|-----------|---------|
| `easycopy <adres> [opcje]` | robi jedną kopię strony |
| `easycopy start [opcje]` | uruchamia panel, serwer archiwów i workera |
| `easycopy serve [opcje]` | uruchamia sam serwer archiwów |
| `easycopy reset-password` | ustawia nowe hasło do panelu |

## Robienie kopii: `easycopy <adres>`

Kopia zrobiona w kontenerze trafia do `/data/archiwa/<nazwa>/<data>/` i od razu jest widoczna w panelu.

### Podstawowe

| Opcja | Opis |
|-------|------|
| `-o, --out <katalog>` | katalog archiwów (`ARCHIVE_DIR`, domyślnie `./archiwa`) |
| `-n, --name <nazwa>` | nazwa archiwum (domyślnie z domeny) |
| `-p, --preset <nazwa>` | tempo: `delikatny`, `normalny`, `szybki` (domyślnie `normalny`); działają też nazwy angielskie |
| `-d, --depth <n>` | ile kliknięć od strony startowej (domyślnie `3`, `bez-limitu` albo `all` = bez limitu) |
| `--max-pages <n>` | maks. liczba stron (domyślnie `500`, `0` = bez limitu) |
| `--max-size <rozmiar>` | maks. rozmiar kopii, np. `500MB`, `2GB` (domyślnie bez limitu) |

### Zakres

| Opcja | Opis |
|-------|------|
| `--subdomains` | pobieraj też subdomeny (np. `blog.example.com`) |
| `--skip <lista>` | pomijaj typy plików, np. `mp4,zip,iso` |
| `--exclude <wzorce>` | pomijaj adresy, np. `"/koszyk/*,/konto/*"` |
| `--no-robots` | ignoruj `robots.txt` (tylko dla własnych stron!) |

### Zachowanie kopii

| Opcja | Opis |
|-------|------|
| `--external-new-tab` | linki do innych stron otwieraj w nowej karcie |
| `--allow-js` | oznacz kopię jako „z JavaScriptem” (serwer archiwów pozwoli działać skryptom) |

### Identyfikacja

| Opcja | Opis |
|-------|------|
| `--ua <przeglądarka>` | `easycopy`, `chrome`, `firefox`, `safari`, `edge` (domyślnie `easycopy`) |
| `--os <system>` | `win`, `mac`, `linux`, `android`, `ios` (domyślnie `win`) |
| `--user-agent <tekst>` | własny nagłówek User-Agent |

### Inne

| Opcja | Opis |
|-------|------|
| `-q, --quiet` | wypisuj tylko podsumowanie |
| `-h, --help` | pomoc |
| `-v, --version` | wersja |

### Przykłady

```bash
# cudza strona – wolno i ostrożnie, bez filmów i archiwów
easycopy https://www.example.com/ --preset delikatny --depth 2 --skip mp4,zip,iso

# własna strona – szybko, pełna kopia, bez robots.txt
easycopy https://www.example.com/ --preset szybki --depth bez-limitu --max-pages 0 --no-robots

# wersja mobilna strony
easycopy https://www.example.com/ --ua safari --os ios
```

## `easycopy start`

| Opcja | Zmienna | Domyślnie |
|-------|---------|-----------|
| `--data-dir <katalog>` | `DATA_DIR` | `./data` (w Dockerze `/data`) |
| `--archive-dir <katalog>` | `ARCHIVE_DIR` | `<data-dir>/archiwa` |
| `--panel-port <port>` | `PANEL_PORT` | `8080` |
| `--archive-port <port>` | `ARCHIVE_PORT` | `8081` (`0` = archiwa w panelu pod `/a/…`) |
| `--host <adres>` | `HOST` | `0.0.0.0` |

## `easycopy serve`

Uruchamia sam serwer archiwów, np. na innej maszynie z kopią katalogu archiwów.

| Opcja | Zmienna | Domyślnie |
|-------|---------|-----------|
| `-d, --dir <katalog>` | `ARCHIVE_DIR` | `./archiwa` |
| `-p, --port <port>` | `ARCHIVE_PORT` | `8081` |
| `--host <adres>` | `ARCHIVE_HOST` | `0.0.0.0` (cała sieć lokalna) |
| `--password <hasło>` | `ARCHIVE_PASSWORD` | brak |
| `-q, --quiet` | | bez dziennika zapytań |

## `easycopy reset-password`

```bash
docker compose exec easycopy easycopy reset-password
```

Ustawia nowe, losowe hasło, wypisuje je na ekranie i wylogowuje wszystkie urządzenia.
Własne hasło:

```bash
docker compose exec easycopy easycopy reset-password admin --password nowe-haslo
```
