# Rozwiązywanie problemów

[English](Troubleshooting) · **Polski**

## „Brak połączenia” / „Nie udało się pobrać strony startowej”

Dziennik podaje przyczynę w nawiasie:

| Komunikat | Co oznacza | Co sprawdzić |
|-----------|------------|--------------|
| nie znaleziono adresu – sprawdź DNS | nie udało się zamienić adresu na IP | czy adres jest poprawny; czy DNS działa na serwerze i w kontenerze |
| serwer DNS nie odpowiada | DNS nie odpowiedział | czy serwer DNS (np. Pi-hole, AdGuard Home) działa |
| przekroczony czas połączenia | serwer nie odpowiedział na czas | czy strona działa w przeglądarce; zapora, VPN |
| połączenie odrzucone | pod tym adresem i portem nic nie nasłuchuje | adres i port |
| połączenie przerwane | połączenie zamknięto w trakcie | spróbuj ponownie, wybierz wolniejszy preset |
| serwer nieosiągalny | brak trasy do serwera | sieć, VPN, zapora |
| błąd certyfikatu (…) | certyfikat HTTPS jest nieważny albo wygasł | strona w przeglądarce |

Sprawdzenie DNS z wnętrza kontenera:

```bash
docker compose exec easycopy nslookup www.example.com
```

Kontener korzysta z ustawień DNS hosta. Jeśli Twój serwer DNS (np. AdGuard Home) działa na tej
samej maszynie, podaj kontenerowi jego adres w sieci LAN – nie `127.0.0.1`, bo wewnątrz kontenera
oznacza to sam kontener:

```yaml
    dns:
      - 192.168.1.10
```

Blokery reklam w DNS blokują też część zasobów (reklamy, trackery, czasem skrypty z CDN) – widać
je w dzienniku jako błędy, a same strony są w porządku.

## Pobieranie zostało wstrzymane

Serwer ograniczył albo zablokował EasyCopy (HTTP 429, 503 z `Retry-After` albo strona weryfikacji
Cloudflare). EasyCopy **nie obchodzi zabezpieczeń** – zwalnia, a po trzech blokadach z rzędu albo
przy stronie weryfikacji wstrzymuje pobieranie. To, co już pobrano, zostaje.

- Kliknij **Ponów jako „Delikatny”** albo **Ponów za 10 min**.
- Dla cudzych stron od początku używaj presetu **Delikatny**.
- Jeśli strona za każdym razem pokazuje weryfikację, nie pozwala na automatyczne kopie.

## W kopii brakuje stron

Otwórz brakującą stronę w kopii – `_brak.html` pokaże powód:

- **głębokość** – strona jest dalej niż ustawiona głębokość; zwiększ **Jak daleko w głąb**,
- **limit** – osiągnięto limit stron; zwiększ **Limit stron**,
- **robots.txt** – witryna na to nie pozwala; uszanuj to albo wyłącz tylko dla własnych stron,
- **pominięty typ pliku** – pasuje do **Pomijaj typy plików**,
- **wykluczenie** – pasuje do **Wyklucz adresy**,
- **błąd** – zobacz dziennik zadania,
- **pauza** – pobieranie wstrzymano, zanim doszło do tej strony.

Strony, które budują treść wyłącznie JavaScriptem, mogą być w kopii puste.

## `ERR_SSL_PROTOCOL_ERROR` przy otwieraniu panelu

Przeglądarka wymusza HTTPS dla tego adresu (HSTS), często dlatego, że domena była wcześniej
używana z HTTPS. Otwórz panel po adresie IP (`http://192.168.1.10:8080/`) albo postaw go za
reverse proxy z HTTPS (zobacz [Instalacja](Instalacja#za-reverse-proxy)).

## „ARCHIVE_PORT: nieprawidłowy port 0”

Kontener działa na starym obrazie, który nie obsługuje jeszcze trybu jednego portu. Zaktualizuj go:

```bash
docker compose pull
docker compose up -d
```

## Ostrzeżenie o systemie plików

Baza leży na udziale sieciowym albo w systemie plików FUSE (np. `/mnt/user` na Unraid), gdzie
SQLite może się uszkodzić. Przenieś `/data` na dysk lokalny albo pulę cache – zobacz [Unraid](Unraid-PL).

## Zapomniane hasło

```bash
docker compose exec easycopy easycopy reset-password
```

## Pliki należą do roota albo nie da się ich zapisać

Ustaw `PUID` i `PGID` na swojego użytkownika (pokaże je polecenie `id` na serwerze) i uruchom
kontener ponownie. Przy starcie kontener poprawia właściciela swoich głównych katalogów.
