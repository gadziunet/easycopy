# EasyCopy

Prosty archiwizator stron WWW do homelabu. Robi kopię witryny do przeglądania offline,
w stylu SiteSuckera albo WebCopy, z prostymi presetami zamiast dziesiątek opcji.
Działa w jednym kontenerze Docker.

> **Status:** wersja rozwojowa – pierwsze wydanie (0.1.0) jeszcze nie powstało.
> Działa panel WWW, robienie kopii i serwer archiwów. Harmonogram (kopie cykliczne)
> i powiadomienia są w przygotowaniu. Do czasu wydania obraz ma tylko tag `edge`
> (bieżąca gałąź `main`).

## Co potrafi

- Pobiera stronę razem z podstronami do ustawionej głębokości, z limitem stron i rozmiaru.
- Przepisuje linki na względne już w trakcie pobierania – kopię można otworzyć prosto z dysku
  (`index.html`), z pendrive’a albo przez wbudowany serwer, pod dowolną ścieżką.
- Pobiera też zasoby z innych domen (CSS, czcionki, obrazki, skrypty z CDN) do `_ext/`.
- Linki do innych stron prowadzą do oryginału. Niepobrane podstrony archiwizowanej witryny
  prowadzą do strony `_brak.html` z powodem i przyciskiem „Otwórz oryginał”.
- Zamienia kodowanie znaków na UTF-8 (polskie znaki ze starych stron w ISO-8859-2 / Windows-1250).
- Jest „grzecznym crawlerem”: pilnuje tempa dla każdego hosta, respektuje `robots.txt`
  i `Crawl-delay`, a przy sygnałach blokady (HTTP 429, 503 z `Retry-After`, strona weryfikacji
  Cloudflare) zwalnia albo wstrzymuje pobieranie. **Nie próbuje obchodzić zabezpieczeń.**
- Trzyma kolejne wersje kopii i serwuje je z bezpiecznymi nagłówkami (sandbox).
- Ma prosty panel WWW: nowa kopia w kilku kliknięciach, kolejka zadań, postęp na żywo, dziennik.
- Bez zależności z npm – wystarczy Node.js 22.13 lub nowszy albo Docker.

## Instalacja: Docker Compose

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
      # - ARCHIVE_PASSWORD=zmien-to-haslo
    volumes:
      - ./data:/data
```

```bash
docker compose up -d
```

- **Panel:** `http://<adres-serwera>:8080/` – tu dodajesz kopie i śledzisz postęp.
  Przy pierwszym otwarciu panel poprosi o utworzenie konta administratora (login i hasło).
- **Archiwa:** `http://<adres-serwera>:8081/` – tu otwierają się gotowe kopie (panel linkuje do nich).

Panel i archiwa działają na osobnych portach celowo: zarchiwizowane strony to cudzy kod,
a osobny port oznacza dla przeglądarki osobne źródło – kopia nie ma dostępu do sesji panelu.

### Jeden port zamiast dwóch

Ustaw `ARCHIVE_PORT=0` i zostaw w `ports` tylko panel (np. `"8080:8080"`). Panel sam wyda
wtedy archiwa pod `http://<adres-serwera>:8080/a/<nazwa>/`.

Kopie nadal są odizolowane nagłówkiem `sandbox` (bez dostępu do ciasteczek panelu), ale tracisz
dodatkową warstwę ochrony, jaką daje osobny port – złośliwa zarchiwizowana strona wyświetla się
pod tym samym adresem co panel. Archiwa w tym trybie nie wymagają logowania do panelu;
zabezpieczysz je zmienną `ARCHIVE_PASSWORD`.

### Zapomniane hasło

```bash
docker compose exec easycopy easycopy reset-password
```

Polecenie ustawia nowe, losowe hasło, wypisuje je na ekranie i wylogowuje wszystkie urządzenia.
Własne hasło: `easycopy reset-password admin --password nowe-haslo`.

### Robienie kopii z wiersza poleceń

Zamiast panelu możesz też użyć polecenia:

```bash
docker compose exec easycopy easycopy https://www.example.com/ --preset delikatny --depth 2
```

Kopia trafia do `./data/archiwa/example-com/<data>/` i od razu jest widoczna w panelu.
Pliki zapisują się jako użytkownik z `PUID`/`PGID`, nie jako root.

### Zmienne środowiskowe

| Zmienna            | Domyślnie       | Opis                                                       |
|--------------------|-----------------|------------------------------------------------------------|
| `PUID`, `PGID`     | `1000`          | właściciel plików (Unraid: `99` i `100`)                   |
| `TZ`               | UTC             | strefa czasowa dat w panelu i na liście archiwów           |
| `ARCHIVE_PASSWORD` | brak            | hasło do archiwów (nazwa użytkownika dowolna)              |
| `ARCHIVE_BASE_URL` | `http://<host panelu>:8081` | adres archiwów w linkach panelu (np. za reverse proxy) |
| `PANEL_PORT`       | `8080`          | port panelu w kontenerze                                   |
| `ARCHIVE_PORT`     | `8081`          | port serwera archiwów w kontenerze (`0` = jeden port, archiwa w panelu) |
| `DATA_DIR`         | `/data`         | baza panelu (SQLite)                                       |
| `ARCHIVE_DIR`      | `/data/archiwa` | katalog archiwów                                           |

### Unraid

- Ustaw `PUID=99` i `PGID=100`.
- Katalog `/data` trzymaj na puli cache, np. `/mnt/cache/appdata/easycopy` – nie w `/mnt/user/…`.
  Jest tam baza panelu (SQLite), a SQLite na udziałach sieciowych (NFS, SMB) i w `/mnt/user` (FUSE)
  może się uszkodzić. Jeśli EasyCopy wykryje taki system plików, pokaże ostrzeżenie w panelu.
- Duże archiwa możesz trzymać na macierzy, podpinając je osobno:

```yaml
    volumes:
      - /mnt/cache/appdata/easycopy:/data
      - /mnt/user/archiwa-www:/data/archiwa
```

## Bez Dockera

```bash
git clone https://github.com/gadziunet/easycopy.git
cd easycopy
node src/cli.js start                             # panel (8080), archiwa (8081) i worker, dane w ./data
node src/cli.js https://www.example.com/          # albo sama kopia z wiersza poleceń do ./archiwa
node src/cli.js serve                             # albo sam serwer archiwów
```

## Przykłady

```bash
# cudza strona – wolno i ostrożnie, bez filmów i archiwów
easycopy https://www.example.com/ --preset delikatny --depth 2 --skip mp4,zip,iso

# własna strona – szybko, pełna kopia, bez robots.txt
easycopy https://www.example.com/ --preset szybki --depth bez-limitu --max-pages 0 --no-robots

# wersja mobilna strony
easycopy https://www.example.com/ --ua safari --os ios
```

Wszystkie opcje: `easycopy --help`, `easycopy start --help` i `easycopy serve --help`.

## Presety tempa

| Preset    | Zapytania na sekundę (na host) | Równolegle | Do czego                    |
|-----------|--------------------------------|------------|-----------------------------|
| delikatny | 0,5                            | 1          | cudze strony, małe serwery  |
| normalny  | 2                              | 2          | domyślny                    |
| szybki    | 5                              | 4          | własne strony               |

Po pierwszej blokadzie tempo dla danego hosta spada do poziomu „delikatnego”.
Trzy blokady z rzędu albo strona weryfikacji przeglądarki kończą pobieranie ze statusem
„wstrzymane” – to, co już pobrano, zostaje i działa.

## Głębokość

Głębokość to liczba kliknięć od strony startowej: `0` – tylko strona startowa,
`1` – plus strony, do których prowadzą z niej linki, i tak dalej. Pliki potrzebne do wyświetlenia
strony (CSS, obrazki, czcionki) nie liczą się jako poziom.

## Serwer archiwów

- `http://<serwer>:8081/` – lista kopii,
- `http://<serwer>:8081/a/<nazwa>/` – najnowsza kopia,
- `http://<serwer>:8081/a/<nazwa>/<wersja>/` – konkretna wersja, np. `/a/example-com/2026-11-04/`.

Zarchiwizowane strony to cudzy kod, więc serwer:

- działa na osobnym porcie – dla przeglądarki to inne źródło niż przyszły panel,
- wysyła każdą kopię z nagłówkiem `Content-Security-Policy: sandbox`, więc strona nie ma dostępu
  do ciasteczek ani danych innych stron; JavaScript w kopii jest domyślnie wyłączony
  (włącza go opcja `--allow-js` przy robieniu kopii),
- nie pozwala wyjść poza katalog kopii i nie listuje katalogów,
- obsługuje przewijanie wideo (Range), kompresję gzip/brotli i nagłówki cache.

## Układ archiwów

```
data/archiwa/
  example-com/
    2026-11-04/
      index.html
      o-nas/index.html
      css/style.css
      _ext/fonts.googleapis.com/…
      _brak.html
      manifest.json
    latest -> 2026-11-04
```

## Rozwój

```bash
npm test                 # testy – używają lokalnej strony testowej, bez internetu
docker build -t easycopy .
```

Obraz w `ghcr.io` budują GitHub Actions: gałąź `main` → tag `edge`,
tag `v1.2.3` → `1.2.3`, `1.2` i `latest` (amd64 i arm64).

## Licencja

[GNU AGPL-3.0](LICENSE). Możesz używać, zmieniać i rozpowszechniać EasyCopy, ale jeśli
udostępniasz zmienioną wersję innym – także jako usługę przez sieć – musisz udostępnić
jej kod źródłowy na tej samej licencji.
