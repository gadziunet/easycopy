# Serwer archiwów

[English](Archive-server) · **Polski**

## Adresy

- `http://<serwer>:8081/` – lista kopii,
- `http://<serwer>:8081/a/<nazwa>/` – najnowsza kopia,
- `http://<serwer>:8081/a/<nazwa>/<wersja>/` – konkretna wersja, np. `/a/example-com/2026-11-04/`.

Panel linkuje do archiwów. Jeśli są za reverse proxy albo pod innym adresem, ustaw
`ARCHIVE_BASE_URL` (zobacz [Instalacja](Instalacja#za-reverse-proxy)).

## Bezpieczeństwo

Zarchiwizowane strony to cudzy kod, dlatego serwer archiwów:

- działa na **osobnym porcie** – dla przeglądarki to inne źródło niż panel, więc kopia nie ma
  dostępu do sesji panelu,
- wysyła każdą kopię z nagłówkiem `Content-Security-Policy: sandbox` – strona nie ma dostępu
  do ciasteczek ani danych innych stron,
- domyślnie ma **wyłączony JavaScript**; „Zezwól na JavaScript w archiwum” (`--allow-js`) włącza
  go dla jednej kopii, a skrypty i tak działają w izolacji,
- nie pozwala wyjść poza katalog kopii i nie listuje katalogów.

Obsługuje też przewijanie wideo (Range), kompresję gzip/brotli i nagłówki cache (ETag).

## Hasło do archiwów

Ustaw `ARCHIVE_PASSWORD`, żeby chronić archiwa hasłem (Basic Auth, nazwa użytkownika dowolna).
Sprawdzanie stanu `/healthz` i czcionki pobierane przez kopie w sandboxie działają bez hasła.

## Tryb jednego portu

Ustaw `ARCHIVE_PORT=0` i wystaw tylko port panelu:

```yaml
    ports:
      - "8080:8080"
    environment:
      - ARCHIVE_PORT=0
```

Panel sam wyda wtedy archiwa pod `http://<serwer>:8080/a/<nazwa>/`.
Kopie nadal są odizolowane nagłówkiem `sandbox`, ale tracisz dodatkową ochronę osobnego źródła
– złośliwa zarchiwizowana strona wyświetla się pod tym samym adresem co panel.
Archiwa w tym trybie nie wymagają logowania do panelu; zabezpieczysz je zmienną `ARCHIVE_PASSWORD`.

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
    2026-11-04-2/        ← druga kopia zrobiona tego samego dnia
    latest -> 2026-11-04-2
```

- Każda kopia to **wersja** w katalogu nazwanym datą. `latest` wskazuje najnowszą.
- `_ext/` – zasoby z innych domen (CDN, czcionki).
- `_brak.html` – pokazuje się dla podstron witryny, których nie pobrano (głębokość, limit,
  `robots.txt`, błędy). Podaje powód i ma przycisk **Otwórz oryginał**, w języku przeglądarki
  odwiedzającego.
- `manifest.json` – opis kopii (adres, ustawienia, lista plików, błędy).

## Otwieranie kopii bez serwera

Linki w kopii są względne, więc możesz też otworzyć `index.html` prosto z dysku, skopiować katalog
na pendrive’a albo wrzucić go na dowolny serwer WWW. Niektóre strony potrzebują serwera, żeby
działać w pełni (np. przeglądarki blokują czcionki dla adresów `file://`).
