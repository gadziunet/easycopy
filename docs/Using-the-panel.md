# Using the panel

**English** · [Polski](Korzystanie-z-panelu)

The panel is at `http://<server-address>:8080/`. The menu has four pages: **Archives**, **Jobs**,
**Schedule** and **Notifications**. Your account settings are under your username.

## A new copy

Click **New copy**, enter the website address (e.g. `https://www.example.com/`) and pick a speed.
You can leave the rest as it is and click **Start downloading**.

### Download speed (presets)

| Preset | Requests per second (per host) | In parallel | For |
|--------|--------------------------------|-------------|-----|
| Gentle | 0.5 (1 request every 2 s) | 1 | other people’s sites, small servers |
| Normal | 2 | 2 | a good place to start |
| Fast | 5 | 4 | your own sites only |

Slower means less risk of being blocked. After the first block the rate for that host drops to
the “Gentle” level. Three blocks in a row, or a browser verification page (e.g. Cloudflare),
end the download with the **Paused** status – what has already been downloaded stays and works.

### Scope

- **How deep** – the number of clicks from the start page. `0` = only the start page,
  `1` = plus the pages it links to, and so on. Files needed to display a page (CSS, images,
  fonts) don’t count as a level.
- **Page limit** – the maximum number of pages (`0` = no limit). Pages over the limit are
  replaced by `_brak.html` in the copy.
- **Size limit** – the maximum size of the copy.
- **This domain only** – without it, subdomains (e.g. `blog.example.com`) are downloaded too.
  Links to other sites always lead to the original.

### Advanced settings

- **Identification (User-Agent)** – by default EasyCopy introduces itself honestly. You can
  pretend to be a browser and system, e.g. to get the mobile version of a site.
  This does **not** bypass protections – speed limits always apply.
- **Respect robots.txt** – on by default. Turn it off only for your own sites.
- **Allow JavaScript in the archive** – scripts in the copy run (still isolated in a sandbox).
- **Open external links in a new tab**.
- **Skip file types** – e.g. `mp4,zip,iso`.
- **Exclude addresses (patterns)** – e.g. `/cart/*,/account/*`.

## Jobs and the log

The **Jobs** page shows the queue and the history (last 100 jobs). A job page shows live progress
(pages, files, size, errors, queued, time) and the **log**.

- Log entries have labels: “✓ Downloaded”, “✗ Error”, “– Skipped”.
- Errors are described in words, e.g. “not on the server (404)”, “the server denies access (403)”,
  “no connection (address not found – check DNS)” – see [Troubleshooting](Troubleshooting).
- **Problems only** hides the successful entries.

What you can do with a job:

- **Stop** – stops a running download; what has been downloaded stays in the copy.
- **Remove from queue** – for a job that hasn’t started.
- A queued job can be changed before it starts.
- **Change settings** (finished job) – opens the form with the previous settings and makes a new version.
- **Retry** – after an error or an interruption, with the same settings.
- **Retry as “Gentle”** or **Retry in 10 min** – when the download was paused by a server block.
- **Delete from history** – removes the job entry; the downloaded files stay.

## Versions and deleting

Every copy of the same site is saved as a new **version** (folder named by date).
On the **Archives** page you can open the latest version or an older one, and delete:

- a single version (if it was the newest, `latest` moves to the previous one),
- the whole archive – all versions, its job history and schedule.

An archive that is being downloaded has to be stopped first.

## Schedule (recurring copies)

In the new copy form, in the **Repeat** section, choose **Daily**, **Weekly** or **Monthly**
and a time. Every copy is saved as a new version of the same archive.

- Times use the `TZ` time zone of the container (e.g. `TZ=Europe/London`).
- The **Schedule** page lets you pause, resume, change or delete schedules.
- If the previous copy is still running, the next run is skipped – jobs don’t pile up.

## Notifications

On the **Notifications** page you enable channels:

- **ntfy**, **Gotify**, **Pushover**, **Discord**,
- **webhook** – any address that accepts JSON in a POST request.

Choose when to send a message: copy finished, limit reached, paused by a server block, error.
You can limit notifications to copies made by the schedule. **Send a test notification** checks
the settings right away, and the result of every send goes to the job log.
If you enter the panel address, the message links to the job.

Tokens and webhook addresses are stored in the panel database and aren’t shown again
(an empty field keeps the saved value). Stopping a job in the panel does not send a notification.

## Language

The panel works in English and Polish. It takes the language from your account settings, then
from the browser. Change it on the sign-in page or on the **Account** page.
`EASYCOPY_LANG=pl` sets the default for everyone (see [Configuration](Configuration)).

## Account and password

On the **Account** page you can change your password – other devices are signed out.
A forgotten password is reset from the command line:

```bash
docker compose exec easycopy easycopy reset-password
```
