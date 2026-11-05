// English translations (default language).

export default {
  common: {
    back: '← Back',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    open: 'Open',
    details: 'Details',
    newCopy: 'New copy',
    logout: 'Sign out',
    sourceCode: 'Source code',
    license: '(AGPL-3.0 licence)',
    backToArchives: '← Archives',
    language: 'Language',
    paused: 'paused',
  },
  units: {
    pages: { one: 'page', other: 'pages' },
    files: { one: 'file', other: 'files' },
    archives: { one: 'archive', other: 'archives' },
    versions: { one: 'version', other: 'versions' },
  },
  nav: { archives: 'Archives', jobs: 'Jobs', schedule: 'Schedule', notifications: 'Notifications', main: 'Main' },
  status: {
    queued: 'Queued',
    running: 'Downloading',
    complete: 'Done',
    limit: 'Done (limit)',
    paused: 'Paused',
    error: 'Error',
    aborted: 'Interrupted',
    cancelled: 'Stopped',
    unknown: '—',
    scheduleActive: 'Active',
    schedulePaused: 'Paused',
  },
  presets: {
    delikatny: { label: 'Gentle', rate: '1 request / 2 s', desc: 'Other people’s sites, small servers' },
    normalny: { label: 'Normal', rate: '2 requests / s', desc: 'A good place to start' },
    szybki: { label: 'Fast', rate: '5 requests / s', desc: 'Your own sites only' },
  },
  browsers: { easycopy: 'EasyCopy (default, honest)', chrome: 'Chrome', firefox: 'Firefox', safari: 'Safari', edge: 'Edge', custom: 'Custom…' },
  systems: { win: 'Windows', mac: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS' },
  frequencies: { none: 'Once', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' },
  weekdays: {
    1: { long: 'Monday', short: 'Mon' },
    2: { long: 'Tuesday', short: 'Tue' },
    3: { long: 'Wednesday', short: 'Wed' },
    4: { long: 'Thursday', short: 'Thu' },
    5: { long: 'Friday', short: 'Fri' },
    6: { long: 'Saturday', short: 'Sat' },
    0: { long: 'Sunday', short: 'Sun' },
  },
  scheduleText: {
    once: 'Once',
    daily: 'Daily, {time}',
    weekly: 'Weekly, {day} {time}',
    monthly: 'Monthly, day {day}, {time}',
  },
  depth: { 0: 'This page only (0)', 1: '1 level', 2: '2 levels', 3: '3 levels', 5: '5 levels', all: 'Whole site (no limit)' },
  sizeLimit: { none: 'No limit' },

  archives: {
    title: 'Archives',
    lead: 'Copies of websites saved on this server. They open in a new tab.',
    used: 'used',
    inProgress: 'In progress',
    empty: 'You don’t have any copies yet.',
    firstCopy: 'Make your first copy',
    colSite: 'Website',
    colLastCopy: 'Last copy',
    colVersions: 'Versions',
    colPages: 'Pages',
    colSize: 'Size',
    colStatus: 'Status',
    colActions: 'Actions',
    older: 'older',
    newVersion: 'New version',
    deleteConfirm: 'Delete the archive “{name}” – all versions ({count}), its job history and schedule? This cannot be undone.',
    availableAt: 'Archives are available in your local network at {url}.',
    availableSamePort: 'Archives are available at the same address as the panel, under {path}.',
    allArchives: 'All archives',
  },
  active: {
    scheduledFor: 'Scheduled for {date}',
    waiting: 'Waiting for its turn',
    queued: 'queued: {count}',
    preset: 'Preset: {name}',
    stop: 'Stop',
    stopConfirm: 'Stop the download? Whatever has been downloaded stays in the copy.',
    removeQueued: 'Remove from queue',
    removeQueuedConfirm: 'Remove this job from the queue?',
    progress: 'Progress',
  },

  form: {
    modes: {
      new: { title: 'New website copy', lead: 'Enter the address and pick a speed. You can leave the rest as it is.', submit: 'Start downloading' },
      retry: { title: 'Change settings and download again', lead: 'Change what you need – a new version of the copy will be saved.', submit: 'Download again' },
      editJob: { title: 'Change job settings', lead: 'The job is still waiting in the queue – changes apply when it starts.', submit: 'Save changes' },
      schedule: { title: 'Edit schedule', lead: 'Settings for the next copies made by the schedule.', submit: 'Save schedule' },
    },
    fixErrors: 'Please correct the highlighted fields.',
    url: 'Website address',
    name: 'Name in the panel',
    namePlaceholder: 'e.g. Company website',
    nameHint: 'Empty = name from the domain. Archive address: /a/<name>/',
    speed: 'Download speed',
    speedHint: 'Slower = less risk of being blocked (e.g. by Cloudflare).',
    scope: 'Scope',
    depth: 'How deep',
    depthHint: 'Clicks away from the start page',
    maxPages: 'Page limit',
    maxPagesHint: '0 = no limit',
    maxSize: 'Size limit',
    sameDomain: 'This domain only',
    sameDomainHint: '(links to other sites lead to the original)',
    repeat: 'Repeat',
    repeatHint: 'Each copy is saved as a new version of the same archive.',
    frequency: 'How often',
    weekday: 'Day of the week',
    monthday: 'Day of the month',
    time: 'Time',
    advanced: 'Advanced settings',
    expand: 'Expand',
    collapse: 'Collapse',
    identification: 'Identification (User-Agent)',
    browser: 'Browser',
    system: 'System',
    customUa: 'Custom User-Agent string',
    uaHint: 'Useful when a site shows a different version (e.g. mobile) depending on the browser. It does not bypass protections such as Cloudflare – speed limits always apply.',
    respectRobots: 'Respect robots.txt',
    allowJs: 'Allow JavaScript in the archive',
    allowJsHint: '(scripts still run isolated)',
    externalNewTab: 'Open external links in a new tab',
    skip: 'Skip file types',
    exclude: 'Exclude addresses (patterns)',
  },
  errors: {
    url: 'Enter the full website address, e.g. https://www.example.com/',
    preset: 'Choose a download speed',
    depth: 'Invalid depth',
    maxPages: 'Enter a number from 0 (no limit) to 1,000,000',
    maxSize: 'Invalid size limit',
    ua: 'Unknown browser',
    os: 'Unknown system',
    customUa: 'Enter a custom User-Agent header',
    customUaLong: 'The User-Agent header is too long',
    repeat: 'Unknown frequency',
    repeatRequired: 'Choose how often to make a copy',
    time: 'Enter the time as HH:MM, e.g. 03:00',
    weekday: 'Choose a day of the week',
    monthday: 'Choose a day of the month (1–28)',
    username: 'Username: 3–32 characters – letters without accents, digits, dot, hyphen or underscore.',
    passwordShort: 'The password must be at least {min} characters long.',
    passwordLong: 'The password is too long.',
    passwordMismatch: 'The passwords don’t match.',
    currentPassword: 'The current password is incorrect.',
    login: 'Wrong username or password.',
  },

  jobs: {
    title: 'Jobs',
    lead: 'Download queue and history (last 100).',
    colAdded: 'Added',
    colTime: 'Time',
    empty: 'There are no jobs yet.',
  },
  job: {
    back: '← Jobs',
    openCopy: 'Open copy',
    stop: 'Stop',
    stopping: 'Stopping…',
    changeSettings: 'Change settings',
    deleteHistory: 'Delete from history',
    deleteHistoryConfirm: 'Delete this job from the history? The downloaded files stay.',
    progress: 'Progress',
    statPages: 'Pages',
    statFiles: 'Files',
    statSize: 'Size',
    statErrors: 'Errors',
    statQueued: 'Queued',
    statTime: 'Time',
    log: 'Log',
    show: 'Show',
    showAll: 'Everything',
    showProblems: 'Problems only',
    noEntries: 'No entries.',
    settings: 'Settings',
    schedule: 'Schedule',
    nextRun: 'Next copy: {date}',
    schedulePaused: 'Recurring copies are paused.',
    editSchedule: 'Edit schedule',
    once: 'One-off.',
    setRepeat: 'Set up repeating',
    versions: 'Versions',
    noVersions: 'None yet.',
    deleteVersionConfirm: 'Delete version {version}? This cannot be undone.',
    info: 'Details',
    added: 'Added',
    start: 'Start',
    end: 'End',
    version: 'Version',
    retryOf: 'Retry of',
    source: 'Source',
    fromSchedule: 'Schedule',
    pausedTitle: 'Job paused – {reason}',
    reasonChallenge: 'the site requires a browser check',
    reasonRate: 'the server is limiting requests',
    pausedText: 'The download was stopped so your IP address doesn’t get blocked. Everything downloaded so far is in the copy.',
    retryGentle: 'Retry as “Gentle”',
    retryLater: 'Retry in 10 min',
    retry: 'Retry',
  },
  settingsList: {
    speed: 'Speed',
    depth: 'Depth',
    noLimit: 'no limit',
    limit: 'Limit',
    noPageLimit: 'no page limit',
    noSizeLimit: 'no size limit',
    scope: 'Scope',
    withSubdomains: 'Domain with subdomains',
    thisDomain: 'This domain only',
    robots: 'robots.txt',
    respected: 'Respected',
    ignored: 'Ignored',
    js: 'JavaScript',
    jsOn: 'Enabled in the archive',
    jsOff: 'Disabled in the archive',
    ua: 'User-Agent',
    uaCustom: 'Custom',
    skipped: 'Skipped types',
    excluded: 'Exclusions',
  },

  log: {
    labels: {
      page: '✓ Downloaded',
      failed: '✗ Error',
      skipped: '– Skipped',
      block: '⏸ Slowing down',
      paused: '⏸ Paused',
      limit: '■ Limit',
      done: '■ Finished',
      schedule: '↻ Schedule',
      error: '✗ Error',
      stop: '■ Stopping',
      notify: '✉ Notification',
      info: '· Info',
    },
    start: 'Download started: {url}',
    tempo: 'Speed: {preset} ({rps} requests/s, {concurrency} at once) · version {version}',
    page: 'page, {size} · {url}',
    failed: '{what} – {reason} · {url}',
    whatPage: 'Page',
    whatFile: 'File',
    skipped: '{reason} · {url}',
    block: '{message} ({host}). Waiting {seconds} s and slowing down.',
    paused: '{message} ({host}). Download paused – EasyCopy doesn’t bypass such protections.',
    limit: 'Copy size limit reached – finishing.',
    done: '{status}: {pages}, {files}, {size}',
    doneErrors: '{text}, errors: {count}',
    error: 'Error: {message}',
    fromSchedule: 'Started by the schedule ({schedule})',
    stopRequested: 'Stopping at the panel’s request…',
    notifySent: 'Notification sent: {channels}',
    notifyFailed: 'Notification failed ({channel}): {error}',
  },
  failure: {
    tooLarge: 'file larger than the allowed limit',
    noConnection: 'no connection',
    noConnectionDetail: 'no connection ({detail})',
    notFound: 'not on the server (404)',
    gone: 'removed from the server (410)',
    forbidden: 'the server denies access ({status})',
    server: 'server error ({status})',
    rejected: 'the server rejected the request ({status})',
  },
  statusWords: {
    complete: 'Done',
    limit: 'Done – limit reached',
    paused: 'Paused by a server block',
    cancelled: 'Stopped in the panel',
    aborted: 'Interrupted',
    error: 'Error',
  },
  jobErrors: {
    cancelled: 'Stopped in the panel',
    aborted: 'Interrupted by application shutdown',
    restart: 'Interrupted by an application restart',
    startFailed: 'Could not download the start page',
    startFailedHttp: 'Could not download the start page (HTTP {status})',
    startFailedDetail: 'Could not download the start page ({detail})',
  },
  block: {
    rate429: 'The server is limiting requests (HTTP 429)',
    challengeCf: 'Cloudflare: {kind} (HTTP {status})',
    challengePage: 'Browser verification page (HTTP {status})',
    unavailable503: 'Server temporarily unavailable (HTTP 503 with Retry-After)',
  },
  missing: {
    glebokosc: 'The page is deeper than the depth setting allowed.',
    limit: 'The page or size limit of the copy was reached.',
    typ: 'This file type was skipped in the settings.',
    wykluczone: 'The address matched an exclusion pattern.',
    robots: 'The site’s robots.txt does not allow downloading this page.',
    blad: 'The page could not be downloaded (server error or missing page).',
    pauza: 'The download was paused before it reached this page.',
  },

  missingPage: {
    title: 'Page not archived',
    heading: 'This page was not archived',
    reasonDefault: 'This subpage is not part of the copy.',
    open: 'Open the original',
    home: 'Home page of the copy',
    noscript: 'Enable JavaScript to see the address of the original page.',
  },
  redirect: {
    title: 'Redirect',
    external: 'This page redirects outside the archived site',
    openFile: 'Open the file',
    notArchived: 'This page was not archived',
    toCopy: 'Go to the copy of the site',
  },

  schedules: {
    title: 'Schedule',
    lead: 'Copies made automatically at a set time. Each is saved as a new version of the archive.',
    saved: 'Schedule saved.',
    deleted: 'Schedule deleted.',
    colRepeat: 'Repeats',
    colNext: 'Next copy',
    colLast: 'Last job',
    pause: 'Pause',
    resume: 'Resume',
    deleteConfirm: 'Delete the schedule “{name}”? The archive and its versions stay.',
    empty: 'You don’t have any recurring copies yet.',
    emptyHint: 'Set them up in the new copy form, in the “Repeat” section.',
  },

  notifications: {
    title: 'Notifications',
    lead: 'Get a message when a copy finishes, is paused by a server block or fails.',
    general: 'General',
    panelUrl: 'Panel address in messages',
    panelUrlHint: 'e.g. https://easycopy.example.com – used for links in notifications (optional)',
    events: 'When to notify',
    evComplete: 'Copy finished',
    evLimit: 'Copy finished – limit reached',
    evPaused: 'Paused by a server block',
    evError: 'Error or interruption',
    scheduledOnly: 'Only for copies made by the schedule',
    channels: 'Channels',
    enabled: 'Enabled',
    secretKept: 'saved – leave empty to keep',
    ntfyUrl: 'Topic address',
    ntfyUrlHint: 'e.g. https://ntfy.sh/my-topic or your own ntfy server',
    ntfyToken: 'Access token (optional)',
    gotifyUrl: 'Server address',
    gotifyToken: 'Application token',
    pushoverUser: 'User key',
    pushoverToken: 'Application API token',
    discordUrl: 'Webhook address',
    webhookTitle: 'Webhook (JSON)',
    webhookUrl: 'Address',
    webhookHint: 'POST with JSON: event, job (id, name, url, status), stats, link',
    save: 'Save settings',
    test: 'Send a test notification',
    savedOk: 'Settings saved.',
    testOk: 'Test notification sent: {channels}.',
    testNone: 'No channel is enabled.',
    testFailed: 'Sending failed – {errors}',
    tokensNote: 'Tokens are stored in the panel database.',
    invalidUrl: 'Enter a full http(s) address',
    required: 'Required when the channel is enabled',
    msgTitle: 'EasyCopy: {name} – {status}',
    msgBody: '{pages}, {files}, {size} · {duration}',
    msgTestTitle: 'EasyCopy – test',
    msgTestBody: 'Notifications are working.',
    msgOpen: 'Open the job',
  },

  setup: {
    title: 'Setup',
    step: 'First run',
    heading: 'Create the administrator account',
    lead: 'You’ll use this account to sign in to the panel. The password is stored hashed (scrypt).',
    username: 'Username',
    usernameHint: '3–32 characters: letters, digits, dot, hyphen',
    password: 'Password',
    passwordHint: 'At least 8 characters',
    repeat: 'Repeat password',
    submit: 'Create account and open the panel',
    forgot: 'Forgot your password? Reset it with {cmd}.',
  },
  login: { title: 'Sign in', submit: 'Sign in' },
  account: {
    title: 'Account',
    signedInAs: 'Signed in as {user}.',
    changed: 'Password changed. Other devices have been signed out.',
    languageSaved: 'Language saved.',
    changePassword: 'Change password',
    current: 'Current password',
    newPassword: 'New password',
    repeatNew: 'Repeat new password',
    submit: 'Change password',
    info: 'Account',
    created: 'Created',
    lastLogin: 'Last sign-in',
    languageHint: 'Language of the panel for this account.',
  },
  messages: {
    notFoundTitle: 'Page not found',
    notFoundText: 'Check the address or go back to the archive list.',
    forbiddenTitle: 'Request rejected',
    forbiddenText: 'The form did not come from this panel.',
    serverErrorTitle: 'Server error',
    serverErrorText: 'Something went wrong. Details are in the log.',
    cannotDelete: 'Cannot delete',
    versionBusyTitle: 'This version is being downloaded right now',
    versionBusyText: 'Stop the job first, then delete the version.',
    archiveBusyTitle: 'This archive is being downloaded right now',
    archiveBusyText: 'Stop the job (or remove it from the queue) first, then delete the archive.',
    jobBusyTitle: 'The job is in progress',
    jobBusyText: 'Stop it first, then delete it from the history.',
    fsWarning: 'The database folder ({dir}) is on a {fs} file system. SQLite may corrupt the database there – move DATA_DIR to a local disk (on Unraid: /mnt/cache/appdata/…, not /mnt/user/…).',
  },

  cli: {
    help: `EasyCopy {version} – a copy of a website for offline browsing

Usage:
  easycopy <address> [options]   make a copy of a website
  easycopy start [options]       run the panel, archive server and worker (easycopy start --help)
  easycopy serve [options]       run only the archive server (easycopy serve --help)
  easycopy reset-password        new panel password (easycopy reset-password --help)

Basics:
  -o, --out <dir>            archive folder (ARCHIVE_DIR, default ./archiwa)
  -n, --name <name>          archive name (default: from the domain)
  -p, --preset <name>        speed: gentle | normal | fast (default normal)
  -d, --depth <n>            depth: clicks away from the start page (default 3, "all" = no limit)
      --max-pages <n>        max. number of pages (default 500, 0 = no limit)
      --max-size <size>      max. size of the copy, e.g. 500MB, 2GB (default: no limit)

Scope:
      --subdomains           also download subdomains (e.g. blog.example.com)
      --skip <list>          skip file types, e.g. mp4,zip,iso
      --exclude <patterns>   skip addresses, e.g. "/cart/*,/account/*"
      --no-robots            ignore robots.txt (only for your own sites!)

The copy:
      --external-new-tab     open links to other sites in a new tab
      --allow-js             mark the copy as "with JavaScript" (for the archive server)

Identification:
      --ua <browser>         {browsers} (default easycopy)
      --os <system>          {systems} (default win)
      --user-agent <text>    custom User-Agent header

Other:
  -q, --quiet                print only the summary
  -h, --help                 this help
  -v, --version              version

Language of messages: EASYCOPY_LANG=en|pl (default: system language, then English).

Example:
  easycopy https://www.example.com/ --preset gentle --depth 2 --skip mp4,zip
`,
    startHelp: `EasyCopy {version} – panel, archive server and worker

Usage:
  easycopy start [options]

Options (environment variable in brackets):
      --data-dir <dir>          database and settings (DATA_DIR, default ./data)
      --archive-dir <dir>       archives (ARCHIVE_DIR, default <data-dir>/archiwa)
      --panel-port <port>       panel port (PANEL_PORT, default 8080)
      --archive-port <port>     archive server port (ARCHIVE_PORT, default 8081;
                                0 = one port: archives in the panel under /a/…)
      --host <address>          listen address (HOST, default 0.0.0.0)
  -h, --help                    this help

On the first run the panel asks you to create the administrator account.
Forgotten password: easycopy reset-password

Other environment variables:
  ARCHIVE_PASSWORD   password for the archives (default: none)
  ARCHIVE_BASE_URL   address of the archives in panel links, e.g. behind a reverse proxy
                     (default http://<panel host>:<archive port>)
  EASYCOPY_LANG      default language of the panel: en | pl (default: browser language)
`,
    serveHelp: `EasyCopy {version} – archive server

Usage:
  easycopy serve [options]

Options (environment variable in brackets):
  -d, --dir <dir>          archive folder (ARCHIVE_DIR, default ./archiwa)
  -p, --port <port>        port (ARCHIVE_PORT, default 8081)
      --host <address>     listen address (ARCHIVE_HOST, default 0.0.0.0 – whole local network)
      --password <pass>    password for the archives (ARCHIVE_PASSWORD, default: none)
  -q, --quiet              no request log
  -h, --help               this help

Archives are at http://<server>:<port>/a/<name>/ (latest copy)
and http://<server>:<port>/a/<name>/<version>/.
`,
    resetHelp: `Usage:
  easycopy reset-password [username] [--password <new password>]

Sets a new panel password and signs out all devices. Without --password
it generates a random password and prints it. Without a username – the only account in the panel.

In Docker:
  docker compose exec easycopy easycopy reset-password
`,
    error: 'Error: {message}',
    seeHelp: 'Run "{cmd} --help" to see the options.',
    privileges: 'Error while switching user (PUID/PGID): {message}',
    badInt: '{label}: expected a whole number ≥ 0, got "{value}"',
    badPort: '{name}: invalid port "{value}"',
    portBusy: 'Error: port {port} is already in use.',
    interrupting: '\nStopping… (the copy will be finished with what has been downloaded; Ctrl+C again = right now)',
    preset: 'Preset: {preset} ({rps}/s, {concurrency} at once) · folder: {dir}',
    block: '  ⏸  {message} – {host}, waiting {seconds} s and slowing down',
    paused: '\n  Download paused: {message} ({host}).\n  EasyCopy doesn’t bypass such protections. Try again later with the "gentle" preset.',
    limit: '  Size limit reached – finishing.',
    status: {
      complete: 'Done',
      limit: 'Done – limit reached',
      paused: 'Paused – the server is limiting or blocking downloads',
      aborted: 'Interrupted',
      error: 'Error – the start page could not be downloaded',
    },
    summary: '  Pages: {pages} · files: {files} · size: {size} · errors: {failed} · not downloaded: {missing}',
    time: '  Time: {seconds} s',
    copy: '  Copy: {path}',
    serveTitle: 'EasyCopy {version} – archive server',
    address: '  Address:   {url}',
    archives: '  Archives:  {dir}',
    password: '  Password:  {state}',
    on: 'on',
    off: 'off',
    stoppingServer: 'Stopping the server…',
    panel: '  Panel:     {url}',
    archivesAt: '  Archives:  {url}',
    onePort: '(one port)',
    withPassword: ' (with password)',
    data: '  Data:      {dir}',
    copies: '  Copies:    {dir}',
    firstRun: '  First run: open the panel and create the administrator account.',
    noAccounts: 'There are no accounts in the panel yet – open the panel in a browser and create the administrator account.',
    noSuchAccount: 'There is no account "{name}". Accounts: {list}',
    giveUsername: 'Give a username. Accounts: {list}',
    passwordSet: 'A new password for "{name}" has been set. All devices have been signed out.',
    passwordShown: 'Password: {password}\nChange it after signing in, on the Account page.',
  },

  archiveServer: {
    title: 'Archives',
    summary: '{count} · {size} (latest versions)',
    colSite: 'Website',
    colLastCopy: 'Last copy',
    colVersions: 'Versions',
    colPages: 'Pages',
    colSize: 'Size',
    colStatus: 'Status',
    colActions: 'Actions',
    olderVersions: 'Older versions ({count})',
    open: 'Open',
    empty: 'There are no copies yet. Make the first one with {cmd}',
    listLabel: 'Archive list',
    backToList: '← Archive list',
    invalidTitle: 'Invalid address',
    invalidText: 'This address contains characters that are not allowed.',
    noArchiveTitle: 'No such archive',
    noArchiveText: 'Check the address or go back to the archive list.',
    noVersionTitle: 'No such version',
    noVersionText: 'This version of the copy doesn’t exist.',
    noFileTitle: 'No such file',
    noFileText: 'This file is not in the copy.',
    noPageTitle: 'No such page',
    noPageText: 'This folder of the copy has no index.html page.',
    loginRequired: 'Sign-in required',
    serverErrorTitle: 'Server error',
    serverErrorText: 'Something went wrong. Details are in the log.',
  },
};
