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
- Obraz Docker (amd64, arm64) z PUID/PGID i healthcheckiem, przykładowy `docker-compose.yml`.
