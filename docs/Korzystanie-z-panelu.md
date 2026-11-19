# Korzystanie z panelu

[English](Using-the-panel) · **Polski**

Panel jest pod adresem `http://<adres-serwera>:8080/`. Menu ma cztery zakładki: **Archiwa**,
**Zadania**, **Harmonogram** i **Powiadomienia**. Ustawienia konta otwierasz, klikając swój login.

## Nowa kopia

Kliknij **Nowa kopia**, wpisz adres strony (np. `https://www.example.com/`) i wybierz tempo.
Resztę możesz zostawić bez zmian i kliknąć **Rozpocznij pobieranie**.

### Tempo pobierania (presety)

| Preset | Zapytania na sekundę (na host) | Naraz | Do czego |
|--------|-------------------------------|-------|----------|
| Delikatny | 0,5 (1 zapytanie co 2 s) | 1 | cudze strony, małe serwery |
| Normalny | 2 | 2 | dobry wybór na start |
| Szybki | 5 | 4 | tylko własne strony |

Wolniej oznacza mniejsze ryzyko blokady. Po pierwszej blokadzie tempo dla tego hosta spada do
poziomu „Delikatny”. Trzy blokady z rzędu albo strona weryfikacji przeglądarki (np. Cloudflare)
kończą pobieranie ze statusem **Wstrzymane** – to, co już pobrano, zostaje i działa.

### Zakres

- **Jak daleko w głąb** – liczba kliknięć od strony startowej. `0` = tylko strona startowa,
  `1` = plus strony, do których ona linkuje, i tak dalej. Pliki potrzebne do wyświetlenia strony
  (CSS, obrazki, czcionki) nie liczą się jako poziom.
- **Limit stron** – największa liczba stron (`0` = bez limitu). Strony ponad limit prowadzą
  w kopii do `_brak.html`.
- **Limit rozmiaru** – największy rozmiar kopii.
- **Tylko ta domena** – bez tej opcji pobierane są też subdomeny (np. `blog.example.com`).
  Linki do innych stron zawsze prowadzą do oryginału.

### Ustawienia zaawansowane

- **Identyfikacja (User-Agent)** – domyślnie EasyCopy przedstawia się uczciwie. Możesz udawać
  przeglądarkę i system, np. żeby dostać mobilną wersję strony. To **nie** omija zabezpieczeń –
  limity tempa działają zawsze.
- **Respektuj robots.txt** – domyślnie włączone. Wyłączaj tylko dla własnych stron.
- **Zezwól na JavaScript w archiwum** – skrypty w kopii działają (nadal w izolacji, w sandboxie).
- **Zewnętrzne linki otwieraj w nowej karcie**.
- **Pomijaj typy plików** – np. `mp4,zip,iso`.
- **Wyklucz adresy (wzorce)** – np. `/koszyk/*,/konto/*`.

## Zadania i dziennik

Zakładka **Zadania** pokazuje kolejkę i historię (ostatnie 100 zadań). Strona zadania pokazuje
postęp na żywo (strony, pliki, rozmiar, błędy, w kolejce, czas) i **dziennik**.

- Wpisy w dzienniku mają etykiety: „✓ Pobrano”, „✗ Błąd”, „– Pominięto”.
- Błędy są opisane słowami, np. „nie ma go na serwerze (404)”, „serwer nie daje dostępu (403)”,
  „brak połączenia (nie znaleziono adresu – sprawdź DNS)” – zobacz [Rozwiązywanie problemów](Rozwiazywanie-problemow).
- Filtr **Tylko problemy** ukrywa udane wpisy.

Co możesz zrobić z zadaniem:

- **Zatrzymaj** – zatrzymuje trwające pobieranie; to, co pobrano, zostaje w kopii.
- **Usuń z kolejki** – dla zadania, które jeszcze nie ruszyło.
- Zadanie w kolejce możesz poprawić, zanim wystartuje.
- **Popraw ustawienia** (zadanie zakończone) – otwiera formularz z dotychczasowymi ustawieniami i robi nową wersję.
- **Ponów** – po błędzie albo przerwaniu, z tymi samymi ustawieniami.
- **Ponów jako „Delikatny”** albo **Ponów za 10 min** – gdy pobieranie wstrzymała blokada serwera.
- **Usuń z historii** – usuwa wpis zadania; pobrane pliki zostają.

## Wersje i usuwanie

Każda kopia tej samej strony zapisuje się jako nowa **wersja** (katalog nazwany datą).
W zakładce **Archiwa** otworzysz najnowszą albo starszą wersję i usuniesz:

- pojedynczą wersję (jeśli była najnowsza, `latest` przechodzi na poprzednią),
- całe archiwum – wszystkie wersje, historię zadań i harmonogram.

Archiwum, które właśnie się pobiera, trzeba najpierw zatrzymać.

## Harmonogram (kopie cykliczne)

W formularzu nowej kopii, w sekcji **Powtarzaj**, wybierz **Codziennie**, **Co tydzień** albo
**Co miesiąc** i godzinę. Każda kopia zapisuje się jako nowa wersja tego samego archiwum.

- Godziny liczone są w strefie `TZ` kontenera (np. `TZ=Europe/Warsaw`).
- W zakładce **Harmonogram** wstrzymasz, wznowisz, zmienisz albo usuniesz harmonogram.
- Gdy poprzednia kopia jeszcze trwa, kolejny termin jest pomijany – zadania się nie piętrzą.

## Powiadomienia

W zakładce **Powiadomienia** włączasz kanały:

- **ntfy**, **Gotify**, **Pushover**, **Discord**,
- **webhook** – dowolny adres, który przyjmuje JSON w zapytaniu POST.

Wybierz, kiedy wysłać wiadomość: kopia gotowa, osiągnięty limit, wstrzymanie przez blokadę
serwera, błąd. Możesz ograniczyć powiadomienia do kopii z harmonogramu. Przycisk
**Wyślij powiadomienie testowe** od razu sprawdza ustawienia, a wynik każdej wysyłki trafia do
dziennika zadania. Jeśli podasz adres panelu, wiadomość zawiera link do zadania.

Tokeny i adresy webhooków są zapisane w bazie panelu i nie są potem pokazywane
(puste pole = zostaw zapisaną wartość). Zatrzymanie zadania w panelu nie wysyła powiadomienia.

## Język

Panel działa po angielsku i po polsku. Język bierze z ustawień konta, potem z przeglądarki.
Zmienisz go na stronie logowania albo w zakładce **Konto**.
`EASYCOPY_LANG=pl` ustawia język domyślny dla wszystkich (zobacz [Konfiguracja](Konfiguracja)).

## Konto i hasło

W zakładce **Konto** zmienisz hasło – pozostałe urządzenia zostaną wylogowane.
Zapomniane hasło zresetujesz z wiersza poleceń:

```bash
docker compose exec easycopy easycopy reset-password
```
