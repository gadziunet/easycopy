// Tłumaczenia polskie.

export default {
  common: {
    back: '← Wróć',
    cancel: 'Anuluj',
    save: 'Zapisz',
    delete: 'Usuń',
    edit: 'Edytuj',
    open: 'Otwórz',
    details: 'Szczegóły',
    newCopy: 'Nowa kopia',
    logout: 'Wyloguj',
    sourceCode: 'Kod źródłowy',
    license: '(licencja AGPL-3.0)',
    backToArchives: '← Archiwa',
    language: 'Język',
    paused: 'wstrzymany',
  },
  units: {
    pages: { one: 'strona', few: 'strony', many: 'stron' },
    files: { one: 'plik', few: 'pliki', many: 'plików' },
    archives: { one: 'archiwum', few: 'archiwa', many: 'archiwów' },
    versions: { one: 'wersja', few: 'wersje', many: 'wersji' },
  },
  nav: { archives: 'Archiwa', jobs: 'Zadania', schedule: 'Harmonogram', notifications: 'Powiadomienia', main: 'Główne' },
  status: {
    queued: 'W kolejce',
    running: 'Pobieranie',
    complete: 'Gotowe',
    limit: 'Gotowe (limit)',
    paused: 'Wstrzymane',
    error: 'Błąd',
    aborted: 'Przerwane',
    cancelled: 'Zatrzymane',
    unknown: '—',
    scheduleActive: 'Aktywny',
    schedulePaused: 'Wstrzymany',
  },
  presets: {
    delikatny: { label: 'Delikatny', rate: '1 zapytanie / 2 s', desc: 'Cudze strony, małe serwery' },
    normalny: { label: 'Normalny', rate: '2 zapytania / s', desc: 'Dobry wybór na start' },
    szybki: { label: 'Szybki', rate: '5 zapytań / s', desc: 'Tylko własne strony' },
  },
  browsers: { easycopy: 'EasyCopy (domyślny, uczciwy)', chrome: 'Chrome', firefox: 'Firefox', safari: 'Safari', edge: 'Edge', custom: 'Własny…' },
  systems: { win: 'Windows', mac: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS' },
  frequencies: { none: 'Jednorazowo', daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc' },
  weekdays: {
    1: { long: 'poniedziałek', short: 'pon.' },
    2: { long: 'wtorek', short: 'wt.' },
    3: { long: 'środa', short: 'śr.' },
    4: { long: 'czwartek', short: 'czw.' },
    5: { long: 'piątek', short: 'pt.' },
    6: { long: 'sobota', short: 'sob.' },
    0: { long: 'niedziela', short: 'niedz.' },
  },
  scheduleText: {
    once: 'Jednorazowo',
    daily: 'Codziennie, {time}',
    weekly: 'Co tydzień, {day} {time}',
    monthly: 'Co miesiąc, {day}. dnia, {time}',
  },
  depth: { 0: 'Tylko ta strona (0)', 1: '1 poziom', 2: '2 poziomy', 3: '3 poziomy', 5: '5 poziomów', all: 'Cała witryna (bez limitu)' },
  sizeLimit: { none: 'Bez limitu' },

  archives: {
    title: 'Archiwa',
    lead: 'Kopie stron zapisane na tym serwerze. Otwierają się w nowej karcie.',
    used: 'zajęte',
    inProgress: 'W toku',
    empty: 'Nie masz jeszcze żadnych kopii.',
    firstCopy: 'Zrób pierwszą kopię',
    colSite: 'Strona',
    colLastCopy: 'Ostatnia kopia',
    colVersions: 'Wersje',
    colPages: 'Strony',
    colSize: 'Rozmiar',
    colStatus: 'Status',
    colActions: 'Akcje',
    older: 'starsze',
    newVersion: 'Nowa wersja',
    deleteConfirm: 'Usunąć archiwum „{name}” – wszystkie wersje ({count}), historię zadań i harmonogram? Tego nie da się cofnąć.',
    availableAt: 'Archiwa są dostępne w sieci lokalnej pod adresem {url}.',
    availableSamePort: 'Archiwa są dostępne pod tym samym adresem co panel, w ścieżce {path}.',
    allArchives: 'Wszystkie archiwa',
  },
  active: {
    scheduledFor: 'Zaplanowane na {date}',
    waiting: 'Czeka na swoją kolej',
    queued: 'w kolejce {count}',
    preset: 'Preset: {name}',
    stop: 'Zatrzymaj',
    stopConfirm: 'Zatrzymać pobieranie? To, co już pobrano, zostanie w kopii.',
    removeQueued: 'Usuń z kolejki',
    removeQueuedConfirm: 'Usunąć to zadanie z kolejki?',
    progress: 'Postęp',
  },

  form: {
    modes: {
      new: { title: 'Nowa kopia strony', lead: 'Podaj adres i wybierz tempo. Resztę możesz zostawić domyślną.', submit: 'Rozpocznij pobieranie' },
      retry: { title: 'Popraw ustawienia i pobierz ponownie', lead: 'Zmień, co trzeba – zapisze się nowa wersja kopii.', submit: 'Pobierz ponownie' },
      editJob: { title: 'Popraw ustawienia zadania', lead: 'Zadanie jeszcze czeka w kolejce – zmiany zadziałają przy jego starcie.', submit: 'Zapisz zmiany' },
      schedule: { title: 'Edytuj harmonogram', lead: 'Ustawienia dla kolejnych kopii z harmonogramu.', submit: 'Zapisz harmonogram' },
    },
    fixErrors: 'Popraw zaznaczone pola.',
    url: 'Adres strony',
    name: 'Nazwa w panelu',
    namePlaceholder: 'np. Strona firmy',
    nameHint: 'Puste = nazwa z domeny. Adres archiwum: /a/<nazwa>/',
    speed: 'Tempo pobierania',
    speedHint: 'Wolniej = mniejsze ryzyko blokady (np. Cloudflare).',
    scope: 'Zakres',
    depth: 'Jak daleko w głąb',
    depthHint: 'Ile kliknięć od strony startowej',
    maxPages: 'Limit stron',
    maxPagesHint: '0 = bez limitu',
    maxSize: 'Limit rozmiaru',
    sameDomain: 'Tylko ta domena',
    sameDomainHint: '(linki do innych stron prowadzą do oryginału)',
    repeat: 'Powtarzaj',
    repeatHint: 'Kolejne kopie zapisują się jako nowe wersje tego samego archiwum.',
    frequency: 'Jak często',
    weekday: 'Dzień tygodnia',
    monthday: 'Dzień miesiąca',
    time: 'Godzina',
    advanced: 'Ustawienia zaawansowane',
    expand: 'Rozwiń',
    collapse: 'Zwiń',
    identification: 'Identyfikacja (User-Agent)',
    browser: 'Przeglądarka',
    system: 'System',
    customUa: 'Własny ciąg User-Agent',
    uaHint: 'Zmiana przydaje się, gdy strona pokazuje inną wersję (np. mobilną) zależnie od przeglądarki. Nie omija zabezpieczeń typu Cloudflare – limity tempa działają zawsze.',
    respectRobots: 'Respektuj robots.txt',
    allowJs: 'Zezwól na JavaScript w archiwum',
    allowJsHint: '(skrypty i tak działają w izolacji)',
    externalNewTab: 'Zewnętrzne linki otwieraj w nowej karcie',
    skip: 'Pomijaj typy plików',
    exclude: 'Wyklucz adresy (wzorce)',
  },
  errors: {
    url: 'Podaj pełny adres strony, np. https://www.example.com/',
    preset: 'Wybierz tempo pobierania',
    depth: 'Nieprawidłowa głębokość',
    maxPages: 'Podaj liczbę od 0 (bez limitu) do 1 000 000',
    maxSize: 'Nieprawidłowy limit rozmiaru',
    ua: 'Nieznana przeglądarka',
    os: 'Nieznany system',
    customUa: 'Wpisz własny nagłówek User-Agent',
    customUaLong: 'Nagłówek User-Agent jest za długi',
    repeat: 'Nieznana częstotliwość',
    repeatRequired: 'Wybierz, jak często robić kopię',
    time: 'Podaj godzinę w formacie GG:MM, np. 03:00',
    weekday: 'Wybierz dzień tygodnia',
    monthday: 'Wybierz dzień miesiąca (1–28)',
    username: 'Login: 3–32 znaki, litery bez polskich znaków, cyfry, kropka, myślnik lub podkreślenie.',
    passwordShort: 'Hasło musi mieć co najmniej {min} znaków.',
    passwordLong: 'Hasło jest za długie.',
    passwordMismatch: 'Hasła nie są takie same.',
    currentPassword: 'Obecne hasło jest nieprawidłowe.',
    login: 'Nieprawidłowy login lub hasło.',
  },

  jobs: {
    title: 'Zadania',
    lead: 'Kolejka i historia pobierania (ostatnie 100).',
    colAdded: 'Dodane',
    colTime: 'Czas',
    empty: 'Nie ma jeszcze żadnych zadań.',
  },
  job: {
    back: '← Zadania',
    openCopy: 'Otwórz kopię',
    stop: 'Zatrzymaj',
    stopping: 'Zatrzymywanie…',
    changeSettings: 'Popraw ustawienia',
    deleteHistory: 'Usuń z historii',
    deleteHistoryConfirm: 'Usunąć to zadanie z historii? Pobrane pliki kopii zostaną.',
    progress: 'Postęp',
    statPages: 'Strony',
    statFiles: 'Pliki',
    statSize: 'Rozmiar',
    statErrors: 'Błędy',
    statQueued: 'W kolejce',
    statTime: 'Czas',
    log: 'Dziennik',
    show: 'Pokaż',
    showAll: 'Wszystko',
    showProblems: 'Tylko problemy',
    noEntries: 'Brak wpisów.',
    settings: 'Ustawienia',
    schedule: 'Harmonogram',
    nextRun: 'Następna kopia: {date}',
    schedulePaused: 'Kopie cykliczne są wstrzymane.',
    editSchedule: 'Edytuj harmonogram',
    once: 'Jednorazowo.',
    setRepeat: 'Ustaw powtarzanie',
    versions: 'Wersje',
    noVersions: 'Jeszcze brak.',
    deleteVersionConfirm: 'Usunąć wersję {version}? Tego nie da się cofnąć.',
    info: 'Informacje',
    added: 'Dodane',
    start: 'Start',
    end: 'Koniec',
    version: 'Wersja',
    retryOf: 'Ponowienie',
    source: 'Źródło',
    fromSchedule: 'Harmonogram',
    pausedTitle: 'Zadanie wstrzymane – {reason}',
    reasonChallenge: 'strona wymaga weryfikacji przeglądarki',
    reasonRate: 'serwer ogranicza zapytania',
    pausedText: 'Pobieranie zatrzymano, żeby nie doprowadzić do blokady Twojego adresu IP. To, co już pobrano, jest w kopii.',
    retryGentle: 'Ponów jako „Delikatny”',
    retryLater: 'Ponów za 10 min',
    retry: 'Ponów',
  },
  settingsList: {
    speed: 'Tempo',
    depth: 'Głębokość',
    noLimit: 'bez limitu',
    limit: 'Limit',
    noPageLimit: 'bez limitu stron',
    noSizeLimit: 'bez limitu rozmiaru',
    scope: 'Zakres',
    withSubdomains: 'Domena z subdomenami',
    thisDomain: 'Tylko ta domena',
    robots: 'robots.txt',
    respected: 'Respektowany',
    ignored: 'Ignorowany',
    js: 'JavaScript',
    jsOn: 'Włączony w archiwum',
    jsOff: 'Wyłączony w archiwum',
    ua: 'User-Agent',
    uaCustom: 'Własny',
    skipped: 'Pomijane typy',
    excluded: 'Wykluczenia',
  },

  log: {
    labels: {
      page: '✓ Pobrano',
      failed: '✗ Błąd',
      skipped: '– Pominięto',
      block: '⏸ Zwolnienie',
      paused: '⏸ Pauza',
      limit: '■ Limit',
      done: '■ Koniec',
      schedule: '↻ Harmonogram',
      error: '✗ Błąd',
      stop: '■ Zatrzymano',
      notify: '✉ Powiadomienie',
      info: '· Info',
    },
    start: 'Start pobierania: {url}',
    tempo: 'Tempo: {preset} ({rps} zapytań/s, {concurrency} naraz) · wersja {version}',
    page: 'strona, {size} · {url}',
    failed: '{what} – {reason} · {url}',
    whatPage: 'Strona',
    whatFile: 'Plik',
    skipped: '{reason} · {url}',
    block: '{message} ({host}). Czekam {seconds} s i zwalniam.',
    paused: '{message} ({host}). Pobieranie wstrzymane – EasyCopy nie obchodzi takich zabezpieczeń.',
    limit: 'Osiągnięto limit rozmiaru kopii – kończę.',
    done: '{status}: {pages}, {files}, {size}',
    doneErrors: '{text}, błędy: {count}',
    error: 'Błąd: {message}',
    fromSchedule: 'Uruchomione z harmonogramu ({schedule})',
    stopRequested: 'Zatrzymywanie na prośbę z panelu…',
    notifySent: 'Wysłano powiadomienie: {channels}',
    notifyFailed: 'Nie udało się wysłać powiadomienia ({channel}): {error}',
  },
  failure: {
    tooLarge: 'plik większy niż dozwolony limit',
    noConnection: 'brak połączenia',
    noConnectionDetail: 'brak połączenia ({detail})',
    notFound: 'nie ma go na serwerze (404)',
    gone: 'został usunięty z serwera (410)',
    forbidden: 'serwer nie daje dostępu ({status})',
    server: 'błąd serwera ({status})',
    rejected: 'serwer odrzucił zapytanie ({status})',
  },
  statusWords: {
    complete: 'Gotowe',
    limit: 'Gotowe – osiągnięto limit',
    paused: 'Wstrzymane przez blokadę serwera',
    cancelled: 'Zatrzymane w panelu',
    aborted: 'Przerwane',
    error: 'Błąd',
  },
  jobErrors: {
    cancelled: 'Zatrzymane w panelu',
    aborted: 'Przerwane przez zamknięcie aplikacji',
    restart: 'Przerwane przez restart aplikacji',
    startFailed: 'Nie udało się pobrać strony startowej',
    startFailedHttp: 'Nie udało się pobrać strony startowej (HTTP {status})',
    startFailedDetail: 'Nie udało się pobrać strony startowej ({detail})',
  },
  block: {
    rate429: 'Serwer ogranicza liczbę zapytań (HTTP 429)',
    challengeCf: 'Cloudflare: {kind} (HTTP {status})',
    challengePage: 'Strona weryfikacji przeglądarki (HTTP {status})',
    unavailable503: 'Serwer chwilowo niedostępny (HTTP 503 z Retry-After)',
  },
  missing: {
    glebokosc: 'Strona leży głębiej, niż pozwalało ustawienie głębokości.',
    limit: 'Osiągnięto limit stron lub rozmiaru kopii.',
    typ: 'Ten typ pliku był pominięty w ustawieniach.',
    wykluczone: 'Adres pasował do wzorca wykluczeń.',
    robots: 'Plik robots.txt witryny nie pozwala pobierać tej strony.',
    blad: 'Nie udało się pobrać strony (błąd serwera lub brak strony).',
    pauza: 'Pobieranie zostało wstrzymane, zanim doszło do tej strony.',
  },

  missingPage: {
    title: 'Strona nie została zarchiwizowana',
    heading: 'Ta strona nie została zarchiwizowana',
    reasonDefault: 'Ta podstrona nie jest częścią kopii.',
    open: 'Otwórz oryginał',
    home: 'Strona główna kopii',
    noscript: 'Włącz JavaScript, żeby zobaczyć adres oryginalnej strony.',
  },
  redirect: {
    title: 'Przekierowanie',
    external: 'Ta strona przekierowuje poza archiwizowaną witrynę',
    openFile: 'Otwórz plik',
    notArchived: 'Ta strona nie została zarchiwizowana',
    toCopy: 'Przejdź do kopii strony',
  },

  schedules: {
    title: 'Harmonogram',
    lead: 'Kopie robione automatycznie o ustalonej porze. Każda zapisuje się jako nowa wersja archiwum.',
    saved: 'Harmonogram zapisany.',
    deleted: 'Harmonogram usunięty.',
    colRepeat: 'Powtarzanie',
    colNext: 'Następna kopia',
    colLast: 'Ostatnie zadanie',
    pause: 'Wstrzymaj',
    resume: 'Wznów',
    deleteConfirm: 'Usunąć harmonogram „{name}”? Archiwum i jego wersje zostaną.',
    empty: 'Nie masz jeszcze kopii cyklicznych.',
    emptyHint: 'Ustawisz je w formularzu nowej kopii, w sekcji „Powtarzaj”.',
  },

  notifications: {
    title: 'Powiadomienia',
    lead: 'Wiadomość, gdy kopia się skończy, zostanie wstrzymana przez blokadę serwera albo zakończy się błędem.',
    general: 'Ogólne',
    panelUrl: 'Adres panelu w wiadomościach',
    panelUrlHint: 'np. https://easycopy.example.com – do linków w powiadomieniach (opcjonalnie)',
    events: 'Kiedy powiadamiać',
    evComplete: 'Kopia gotowa',
    evLimit: 'Kopia gotowa – osiągnięto limit',
    evPaused: 'Wstrzymanie przez blokadę serwera',
    evError: 'Błąd albo przerwanie',
    scheduledOnly: 'Tylko dla kopii z harmonogramu',
    channels: 'Kanały',
    enabled: 'Włączony',
    secretKept: 'zapisany – zostaw puste, żeby zachować',
    ntfyUrl: 'Adres tematu',
    ntfyUrlHint: 'np. https://ntfy.sh/moj-temat albo własny serwer ntfy',
    ntfyToken: 'Token dostępu (opcjonalnie)',
    gotifyUrl: 'Adres serwera',
    gotifyToken: 'Token aplikacji',
    pushoverUser: 'Klucz użytkownika',
    pushoverToken: 'Token API aplikacji',
    discordUrl: 'Adres webhooka',
    webhookTitle: 'Webhook (JSON)',
    webhookUrl: 'Adres',
    webhookHint: 'POST z JSON-em: event, job (id, name, url, status), stats, link',
    save: 'Zapisz ustawienia',
    test: 'Wyślij powiadomienie testowe',
    savedOk: 'Ustawienia zapisane.',
    testOk: 'Wysłano powiadomienie testowe: {channels}.',
    testNone: 'Żaden kanał nie jest włączony.',
    testFailed: 'Nie udało się wysłać – {errors}',
    tokensNote: 'Tokeny są zapisane w bazie panelu.',
    invalidUrl: 'Podaj pełny adres http(s)',
    required: 'Wymagane, gdy kanał jest włączony',
    msgTitle: 'EasyCopy: {name} – {status}',
    msgBody: '{pages}, {files}, {size} · {duration}',
    msgTestTitle: 'EasyCopy – test',
    msgTestBody: 'Powiadomienia działają.',
    msgOpen: 'Otwórz zadanie',
  },

  setup: {
    title: 'Instalacja',
    step: 'Pierwsze uruchomienie',
    heading: 'Utwórz konto administratora',
    lead: 'To konto będzie potrzebne do logowania w panelu. Hasło zapisuje się w bazie w postaci zaszyfrowanej (scrypt).',
    username: 'Login',
    usernameHint: '3–32 znaki: litery, cyfry, kropka, myślnik',
    password: 'Hasło',
    passwordHint: 'Co najmniej 8 znaków',
    repeat: 'Powtórz hasło',
    submit: 'Utwórz konto i przejdź do panelu',
    forgot: 'Zapomniane hasło zresetujesz poleceniem {cmd}.',
  },
  login: { title: 'Logowanie', submit: 'Zaloguj' },
  account: {
    title: 'Konto',
    signedInAs: 'Zalogowano jako {user}.',
    changed: 'Hasło zmienione. Inne urządzenia zostały wylogowane.',
    languageSaved: 'Język zapisany.',
    changePassword: 'Zmiana hasła',
    current: 'Obecne hasło',
    newPassword: 'Nowe hasło',
    repeatNew: 'Powtórz nowe hasło',
    submit: 'Zmień hasło',
    info: 'Konto',
    created: 'Utworzone',
    lastLogin: 'Ostatnie logowanie',
    languageHint: 'Język panelu dla tego konta.',
  },
  messages: {
    notFoundTitle: 'Nie ma takiej strony',
    notFoundText: 'Sprawdź adres albo wróć do listy archiwów.',
    forbiddenTitle: 'Odrzucone żądanie',
    forbiddenText: 'Formularz nie pochodzi z tego panelu.',
    serverErrorTitle: 'Błąd serwera',
    serverErrorText: 'Coś poszło nie tak. Szczegóły są w logu.',
    cannotDelete: 'Nie można usunąć',
    versionBusyTitle: 'Ta wersja właśnie się pobiera',
    versionBusyText: 'Najpierw zatrzymaj zadanie, potem usuń wersję.',
    archiveBusyTitle: 'To archiwum właśnie się pobiera',
    archiveBusyText: 'Najpierw zatrzymaj zadanie (albo usuń je z kolejki), potem usuń archiwum.',
    jobBusyTitle: 'Zadanie jest w toku',
    jobBusyText: 'Najpierw je zatrzymaj, potem usuń z historii.',
    fsWarning: 'Katalog z bazą ({dir}) leży na systemie plików {fs}. SQLite może tam uszkodzić bazę – przenieś DATA_DIR na dysk lokalny (w Unraid: /mnt/cache/appdata/…, nie /mnt/user/…).',
  },

  cli: {
    help: `EasyCopy {version} – kopia strony WWW do przeglądania offline

Użycie:
  easycopy <adres> [opcje]      zrób kopię strony
  easycopy start [opcje]        uruchom panel, serwer archiwów i workera (easycopy start --help)
  easycopy serve [opcje]        uruchom sam serwer archiwów (easycopy serve --help)
  easycopy reset-password       nowe hasło do panelu (easycopy reset-password --help)

Podstawowe:
  -o, --out <katalog>        katalog archiwów (ARCHIVE_DIR, domyślnie ./archiwa)
  -n, --name <nazwa>         nazwa archiwum (domyślnie z domeny)
  -p, --preset <nazwa>       tempo: delikatny | normalny | szybki (domyślnie normalny)
  -d, --depth <n>            głębokość: ile kliknięć od strony startowej (domyślnie 3, „bez-limitu”)
      --max-pages <n>        maks. liczba stron (domyślnie 500, 0 = bez limitu)
      --max-size <rozmiar>   maks. rozmiar kopii, np. 500MB, 2GB (domyślnie bez limitu)

Zakres:
      --subdomains           pobieraj też subdomeny (np. blog.example.com)
      --skip <lista>         pomijaj typy plików, np. mp4,zip,iso
      --exclude <wzorce>     pomijaj adresy, np. "/koszyk/*,/konto/*"
      --no-robots            ignoruj robots.txt (tylko dla własnych stron!)

Zachowanie kopii:
      --external-new-tab     linki do innych stron otwieraj w nowej karcie
      --allow-js             oznacz kopię jako „z JavaScriptem” (dla serwera archiwów)

Identyfikacja:
      --ua <przeglądarka>    {browsers} (domyślnie easycopy)
      --os <system>          {systems} (domyślnie win)
      --user-agent <tekst>   własny nagłówek User-Agent

Inne:
  -q, --quiet                wypisuj tylko podsumowanie
  -h, --help                 ta pomoc
  -v, --version              wersja

Język komunikatów: EASYCOPY_LANG=en|pl (domyślnie język systemu, potem angielski).

Przykład:
  easycopy https://www.example.com/ --preset delikatny --depth 2 --skip mp4,zip
`,
    startHelp: `EasyCopy {version} – panel, serwer archiwów i worker

Użycie:
  easycopy start [opcje]

Opcje (w nawiasie zmienna środowiskowa):
      --data-dir <katalog>      baza i ustawienia (DATA_DIR, domyślnie ./data)
      --archive-dir <katalog>   archiwa (ARCHIVE_DIR, domyślnie <data-dir>/archiwa)
      --panel-port <port>       port panelu (PANEL_PORT, domyślnie 8080)
      --archive-port <port>     port serwera archiwów (ARCHIVE_PORT, domyślnie 8081;
                                0 = jeden port: archiwa w panelu pod /a/…)
      --host <adres>            adres nasłuchu (HOST, domyślnie 0.0.0.0)
  -h, --help                    ta pomoc

Przy pierwszym uruchomieniu panel poprosi o utworzenie konta administratora.
Zapomniane hasło: easycopy reset-password

Inne zmienne środowiskowe:
  ARCHIVE_PASSWORD   hasło do archiwów (domyślnie brak)
  ARCHIVE_BASE_URL   adres archiwów w linkach panelu, np. za reverse proxy
                     (domyślnie http://<host panelu>:<port archiwów>)
  EASYCOPY_LANG      domyślny język panelu: en | pl (domyślnie język przeglądarki)
`,
    serveHelp: `EasyCopy {version} – serwer archiwów

Użycie:
  easycopy serve [opcje]

Opcje (w nawiasie zmienna środowiskowa):
  -d, --dir <katalog>      katalog archiwów (ARCHIVE_DIR, domyślnie ./archiwa)
  -p, --port <port>        port (ARCHIVE_PORT, domyślnie 8081)
      --host <adres>       adres nasłuchu (ARCHIVE_HOST, domyślnie 0.0.0.0 – cała sieć lokalna)
      --password <hasło>   hasło do archiwów (ARCHIVE_PASSWORD, domyślnie brak)
  -q, --quiet              bez logu żądań
  -h, --help               ta pomoc

Archiwa są pod adresem http://<serwer>:<port>/a/<nazwa>/ (najnowsza kopia)
oraz http://<serwer>:<port>/a/<nazwa>/<wersja>/.
`,
    resetHelp: `Użycie:
  easycopy reset-password [login] [--password <nowe hasło>]

Ustawia nowe hasło do panelu i wylogowuje wszystkie urządzenia. Bez --password
generuje losowe hasło i wypisuje je na ekranie. Bez loginu – jedyne konto w panelu.

W Dockerze:
  docker compose exec easycopy easycopy reset-password
`,
    error: 'Błąd: {message}',
    seeHelp: 'Uruchom „{cmd} --help”, żeby zobaczyć opcje.',
    privileges: 'Błąd przy zmianie użytkownika (PUID/PGID): {message}',
    badInt: '{label}: oczekiwana liczba całkowita ≥ 0, podano „{value}”',
    badPort: '{name}: nieprawidłowy port „{value}”',
    portBusy: 'Błąd: port {port} jest zajęty.',
    interrupting: '\nPrzerywam… (kopia zostanie domknięta tym, co już pobrano; Ctrl+C ponownie = natychmiast)',
    preset: 'Preset: {preset} ({rps}/s, {concurrency} naraz) · katalog: {dir}',
    block: '  ⏸  {message} – {host}, czekam {seconds} s i zwalniam',
    paused: '\n  Wstrzymano pobieranie: {message} ({host}).\n  EasyCopy nie obchodzi takich zabezpieczeń. Spróbuj później z presetem „delikatny”.',
    limit: '  Osiągnięto limit rozmiaru – kończę.',
    status: {
      complete: 'Gotowe',
      limit: 'Gotowe – osiągnięto limit',
      paused: 'Wstrzymane – serwer ogranicza lub blokuje pobieranie',
      aborted: 'Przerwane',
      error: 'Błąd – nie udało się pobrać strony startowej',
    },
    summary: '  Strony: {pages} · pliki: {files} · rozmiar: {size} · błędy: {failed} · niepobrane: {missing}',
    time: '  Czas: {seconds} s',
    copy: '  Kopia: {path}',
    serveTitle: 'EasyCopy {version} – serwer archiwów',
    address: '  Adres:    {url}',
    archives: '  Archiwa:  {dir}',
    password: '  Hasło:    {state}',
    on: 'włączone',
    off: 'wyłączone',
    stoppingServer: 'Zatrzymuję serwer…',
    panel: '  Panel:     {url}',
    archivesAt: '  Archiwa:   {url}',
    onePort: '(jeden port)',
    withPassword: ' (z hasłem)',
    data: '  Dane:      {dir}',
    copies: '  Kopie:     {dir}',
    firstRun: '  Pierwsze uruchomienie: otwórz panel i utwórz konto administratora.',
    noAccounts: 'W panelu nie ma jeszcze kont – otwórz panel w przeglądarce i utwórz konto administratora.',
    noSuchAccount: 'Nie ma konta „{name}”. Konta: {list}',
    giveUsername: 'Podaj login. Konta: {list}',
    passwordSet: 'Nowe hasło dla „{name}” zostało ustawione. Wszystkie urządzenia zostały wylogowane.',
    passwordShown: 'Hasło: {password}\nZmień je po zalogowaniu w zakładce Konto.',
  },

  archiveServer: {
    title: 'Archiwa',
    summary: '{count} · {size} (najnowsze wersje)',
    colSite: 'Strona',
    colLastCopy: 'Ostatnia kopia',
    colVersions: 'Wersje',
    colPages: 'Strony',
    colSize: 'Rozmiar',
    colStatus: 'Status',
    colActions: 'Akcje',
    olderVersions: 'Starsze wersje ({count})',
    open: 'Otwórz',
    empty: 'Nie ma jeszcze żadnych kopii. Zrób pierwszą poleceniem {cmd}',
    listLabel: 'Lista archiwów',
    backToList: '← Lista archiwów',
    invalidTitle: 'Nieprawidłowy adres',
    invalidText: 'Ten adres zawiera niedozwolone znaki.',
    noArchiveTitle: 'Nie ma takiego archiwum',
    noArchiveText: 'Sprawdź adres albo wróć do listy archiwów.',
    noVersionTitle: 'Nie ma takiej wersji',
    noVersionText: 'Ta wersja kopii nie istnieje.',
    noFileTitle: 'Nie ma takiego pliku',
    noFileText: 'Tego pliku nie ma w kopii.',
    noPageTitle: 'Nie ma takiej strony',
    noPageText: 'Ten katalog kopii nie ma strony index.html.',
    loginRequired: 'Wymagane logowanie',
    serverErrorTitle: 'Błąd serwera',
    serverErrorText: 'Coś poszło nie tak. Szczegóły są w logu.',
  },
};
