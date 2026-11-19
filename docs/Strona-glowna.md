# EasyCopy

[English](Home) · **Polski**

EasyCopy to prosty archiwizator stron WWW do homelabu. Robi kopię witryny, którą możesz
przeglądać offline – w stylu SiteSuckera albo WebCopy, z kilkoma prostymi presetami zamiast
dziesiątek opcji. Działa jako jedna aplikacja w jednym kontenerze Docker:

- **panel WWW** (port 8080) – dodajesz kopie, śledzisz postęp, ustawiasz harmonogram i powiadomienia,
- **serwer archiwów** (port 8081) – tu otwierają się gotowe kopie,
- **worker** – pobiera strony w tle.

> **Status:** wersja rozwojowa. Pierwsze wydanie (0.1.0) jeszcze nie powstało,
> więc obraz Docker ma tylko tag `edge` (bieżąca gałąź `main`).

## Od czego zacząć

1. [Instalacja](Instalacja) – Docker Compose, pierwsze uruchomienie, aktualizacja, praca bez Dockera.
2. [Korzystanie z panelu](Korzystanie-z-panelu) – nowa kopia, dziennik zadania, harmonogram, powiadomienia.
3. [Serwer archiwów](Serwer-archiwow) – gdzie są kopie, jak są chronione, układ archiwów.

## Wszystkie strony

| Strona | Co tam znajdziesz |
|--------|-------------------|
| [Instalacja](Instalacja) | Docker Compose, aktualizacja, reverse proxy, bez Dockera |
| [Unraid](Unraid-PL) | PUID/PGID, gdzie trzymać bazę i archiwa |
| [Korzystanie z panelu](Korzystanie-z-panelu) | nowa kopia, presety, głębokość, zadania, dziennik, harmonogram, usuwanie, powiadomienia, język |
| [Wiersz poleceń](Wiersz-polecen) | `easycopy <adres>` i wszystkie opcje, `start`, `serve`, `reset-password` |
| [Serwer archiwów](Serwer-archiwow) | adresy, bezpieczeństwo (osobny port, sandbox), tryb jednego portu, układ archiwów |
| [Konfiguracja](Konfiguracja) | wszystkie zmienne środowiskowe |
| [Rozwiązywanie problemów](Rozwiazywanie-problemow) | błędy połączenia, blokady, błędy HTTPS, systemy plików |
| [Rozwój](Rozwoj) | testy, budowa kodu, tłumaczenia, edycja tej wiki |

## Co EasyCopy robi – a czego nie

- Pobiera stronę razem z podstronami do ustawionej głębokości, z limitem stron i rozmiaru.
- Przepisuje linki na względne już w trakcie pobierania, więc kopia otwiera się też prosto z dysku.
- Pobiera zasoby z innych domen (CSS, czcionki, obrazki, skrypty z CDN) do `_ext/`.
- Zamienia stare kodowania znaków na UTF-8 (polskie znaki ze starych stron).
- Jest **grzecznym crawlerem**: pilnuje tempa dla każdego hosta, respektuje `robots.txt`
  i `Crawl-delay`, a przy sygnałach blokady zwalnia albo wstrzymuje pobieranie.
- **Nigdy nie obchodzi zabezpieczeń** takich jak Cloudflare. Jeśli strona nie chce być kopiowana,
  EasyCopy się zatrzymuje.
- Nie jest pełną przeglądarką: strony, które budują treść wyłącznie JavaScriptem, mogą być
  w kopii niekompletne.
