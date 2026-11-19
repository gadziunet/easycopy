# Troubleshooting

**English** · [Polski](Rozwiazywanie-problemow)

## “No connection” / “Could not download the start page”

The log describes the reason in brackets:

| Message | What it means | What to check |
|---------|---------------|---------------|
| address not found – check DNS | the address could not be resolved | the address is correct; DNS works on the server and in the container |
| the DNS server is not responding | DNS did not answer | the DNS server (e.g. Pi-hole, AdGuard Home) is running |
| connection timed out | the server did not answer in time | the site works in a browser; firewall, VPN |
| connection refused | nothing is listening at that address and port | the address and port |
| connection interrupted | the connection was closed in the middle | try again, choose a slower preset |
| server unreachable | no route to the server | network, VPN, firewall |
| certificate error (…) | the HTTPS certificate is invalid or expired | the site in a browser |

Check DNS from inside the container:

```bash
docker compose exec easycopy nslookup www.example.com
```

The container uses the DNS settings of the host. If your DNS server (e.g. AdGuard Home) runs on
the same machine, give its LAN address to the container – not `127.0.0.1`, which inside
the container means the container itself:

```yaml
    dns:
      - 192.168.1.10
```

DNS ad blockers also block some assets (ads, trackers, sometimes scripts from CDNs) – they
show up as errors in the log, while the pages themselves are fine.

## The download was paused

The server limited or blocked EasyCopy (HTTP 429, 503 with `Retry-After`, or a Cloudflare
verification page). EasyCopy **does not bypass protections** – it slows down and, after three
blocks in a row or a verification page, pauses. What has been downloaded stays.

- Click **Retry as “Gentle”** or **Retry in 10 min**.
- Use the **Gentle** preset for other people’s sites from the start.
- If the site shows a verification page every time, it does not allow automated copies.

## Pages are missing in the copy

Open the missing page in the copy – `_brak.html` shows the reason:

- **depth** – the page is further than the set depth; increase **How deep**,
- **limit** – the page limit was reached; increase **Page limit**,
- **robots.txt** – the site does not allow it; respect it, or turn it off only for your own sites,
- **file type skipped** – it matches **Skip file types**,
- **excluded** – it matches **Exclude addresses**,
- **error** – see the log of the job,
- **paused** – the download was paused before it reached the page.

Pages that build their content only with JavaScript may be empty in the copy.

## `ERR_SSL_PROTOCOL_ERROR` when opening the panel

The browser forces HTTPS for that address (HSTS), often because a domain was used with HTTPS
before. Open the panel by IP address (`http://192.168.1.10:8080/`) or put it behind a reverse
proxy with HTTPS (see [Installation](Installation#behind-a-reverse-proxy)).

## “ARCHIVE_PORT: invalid port 0”

The container runs an old image that doesn’t support single-port mode yet. Update it:

```bash
docker compose pull
docker compose up -d
```

## Warning about the file system

The database is on a network share or a FUSE file system (e.g. `/mnt/user` on Unraid), where
SQLite can get corrupted. Move `/data` to a local disk or the cache pool – see [Unraid](Unraid).

## Forgotten password

```bash
docker compose exec easycopy easycopy reset-password
```

## Files belong to root or can’t be written

Set `PUID` and `PGID` to your user (`id` on the server shows them) and restart the container.
The container fixes the owner of its main folders on start.
