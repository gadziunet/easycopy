# Rozwój

[English](Development) · **Polski**

## Wymagania

- Node.js 22.13 lub nowszy – **bez zależności z npm**, tylko wbudowane moduły
  (baza to wbudowany `node:sqlite`).
- Docker do budowania obrazu (opcjonalnie).

```bash
git clone https://github.com/gadziunet/easycopy.git
cd easycopy
npm test                  # testy – używają lokalnej strony testowej, bez internetu
node src/cli.js start     # panel i archiwa na http://localhost:8080 i :8081
docker build -t easycopy .
```

## Budowa kodu

| Katalog | Co tam jest |
|---------|-------------|
| `src/worker/` | crawler: pobieranie, przepisywanie HTML/CSS, `robots.txt`, wykrywanie blokad, układ archiwów |
| `src/server/` | serwer archiwów |
| `src/panel/` | panel WWW: serwer HTTP, widoki, baza, konta, harmonogram, powiadomienia |
| `src/shared/` | mapowanie URL → ścieżka, tłumaczenia, SQLite, ciasteczka, PUID/PGID |
| `test/` | testy (`node --test`) z lokalną stroną testową |
| `docs/` | ta wiki |

## Zasady

- Bez zależności z npm.
- Wszystkie testy muszą przechodzić: `npm test`.
- Każdy tekst widoczny dla użytkownika idzie przez słowniki `src/shared/locales/en.js` i `pl.js`
  (te same klucze w obu – sprawdza to test). Teksty zapisywane w bazie (dziennik, błędy)
  zapisuje się przez `msg()` i tłumaczy przy wyświetlaniu.
- Adresy panelu (`/zadania`, `/harmonogram`, …) i katalog `archiwa` zostają bez zmian,
  dla zgodności z istniejącymi instalacjami.
- Crawler nigdy nie obchodzi zabezpieczeń – tylko zwalnia albo wstrzymuje pobieranie.
- Kod, komentarze, commity i changelog są po angielsku.

## Obrazy

GitHub Actions budują obraz `ghcr.io/gadziunet/easycopy` (amd64 i arm64):
gałąź `main` → tag `edge`, tag `v1.2.3` → `1.2.3`, `1.2` i `latest`.

## Edycja tej wiki

Strony wiki są w repozytorium, w katalogu `docs/`. Po pushu na `main` GitHub Action kopiuje je
do wiki. Zmieniaj strony w `docs/`, nie w edytorze wiki – zmiany zrobione tylko w wiki zostaną nadpisane.

- Nazwa pliku = nazwa strony (`Korzystanie-z-panelu.md` → strona „Korzystanie z panelu”).
- Do innych stron linkuj po nazwie: `[Instalacja](Instalacja)`.
- Każda strona angielska ma polski odpowiednik i odwrotnie.
- Używaj tylko przykładowych danych: `example.com`, `192.168.1.x`.

## Jak powstaje ten projekt

EasyCopy powstaje z pomocą Claude (asystenta AI firmy Anthropic).
Autor sprawdza i testuje każdą zmianę, zanim zostanie opublikowana.

## Licencja

[GNU AGPL-3.0](https://github.com/gadziunet/easycopy/blob/main/LICENSE). Jeśli udostępniasz
zmienioną wersję innym – także jako usługę przez sieć – musisz udostępnić jej kod źródłowy.
Forki mogą ustawić własny link do kodu źródłowego zmienną `EASYCOPY_PROJECT_URL`.
