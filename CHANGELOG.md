# Zmiany

## Niewydane (powstaje 0.1.0)

- Kopia strony z wiersza poleceń: presety tempa, głębokość, limity stron i rozmiaru,
  pomijanie typów plików i wzorców adresów, wybór User-Agenta.
- Przepisywanie linków na względne w trakcie pobierania, zasoby z CDN w `_ext/`,
  strona `_brak.html` dla niepobranych podstron, konwersja kodowania na UTF-8.
- Grzeczny crawler: tempo na host, `robots.txt`, `Crawl-delay`, reakcja na 429/503
  i strony weryfikacji Cloudflare (zwolnienie, pauza – bez obchodzenia zabezpieczeń).
- Wersje kopii z datą i dowiązaniem `latest`, `manifest.json` w każdej kopii.
- Serwer archiwów: lista kopii, `/a/<nazwa>/`, nagłówek CSP sandbox, ochrona przed
  wyjściem poza katalog, Range, gzip/brotli, ETag, opcjonalne hasło.
- Panel WWW (`easycopy start`): lista archiwów, nowa kopia z presetami i ustawieniami
  zaawansowanymi, kolejka i historia zadań, postęp i dziennik na żywo, anulowanie, ponowienie
  (także „jako Delikatny” lub za 10 minut), ochrona formularzy.
- Kreator pierwszego uruchomienia: konto administratora zakładane w przeglądarce, hasła
  hashowane scryptem, zmiana hasła w zakładce Konto (wylogowuje inne urządzenia),
  `easycopy reset-password` na wypadek zapomnianego hasła.
- Harmonogram kopii (codziennie, co tydzień, co miesiąc o wybranej godzinie) ze stroną do
  wstrzymywania, edycji i usuwania; terminy pomijane, gdy poprzednia kopia jeszcze trwa.
- Zatrzymanie trwającego pobierania, poprawa ustawień zadania w kolejce, „Popraw ustawienia”
  dla zakończonych zadań; usuwanie archiwum, pojedynczej wersji i wpisu z historii.
- Czytelny dziennik zadania: etykiety, opisy błędów HTTP po polsku, filtr „Tylko problemy”.
- Worker w osobnym procesie, kolejka w bazie SQLite (wbudowany `node:sqlite`), ostrzeżenie
  o bazie na udziale sieciowym.
- Obraz Docker (amd64, arm64) z PUID/PGID i healthcheckiem, przykładowy `docker-compose.yml`.
