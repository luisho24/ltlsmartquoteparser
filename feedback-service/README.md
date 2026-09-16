# Smart LTL Feedback — PartsPilot deployment package

**Status:** implemented and locally tested; no PartsPilot project, DNS record, container, or public endpoint has been created. PartsPilot was not available in this chat. The frontend endpoint is deliberately empty until deployment is verified. Do not merge the dual-interface rollout to `main` before completing the checks below.

Desired PartsPilot project name: `ltl-feedback`. This directory is the independent project payload, not a claim that a project already exists. It does not require an LLM, an email provider, a paid API, or a public GitHub-issue inbox.

## Components

- Python WSGI JSON API; Gunicorn 26.2.2 in production.
- SQLite WAL database in a private persistent volume, outside the website root.
- Shared `feedback.js` client used by both HTML interfaces.
- Local-only management CLI for listing, resolving and deleting reports. There is intentionally no public inbox or administration API.

## Default limits

All acceptance limits use rolling windows and a transaction in SQLite; they survive worker restarts and apply across workers when the same database and secret are retained.

| Scope | Limit |
| --- | --- |
| Browser identifier | 5 accepted reports/hour; 15/day |
| Shared network/IP (IPv6 grouped by /64) | 30 accepted reports/hour; 100/day |
| Entire service | 250 accepted reports/day |
| Challenge + submission attempts | 60/minute/network; 10,000/day globally |
| Stored reports | 5,000 maximum; logical expiration at 90 days |
| Request body | 16 KiB |
| Text | title 120, message 3,000, reproduction steps 2,000 characters |
| Attachments | Not supported |

A duplicate from the same browser within 15 minutes returns the existing receipt. Exact retries with the same challenge are idempotent; replay with changed contents is rejected. Limits return HTTP 429 and `Retry-After`. A full inbox returns 503 without dropping old reports to make space.

These are **browser/network limits, not verified-person quotas**. A reset browser can change its identifier, but network and global limits still apply. Signed, short-lived, network/origin/client-bound challenges, minimum completion time, a honeypot, strict validation, and duplicate protection add friction; they do not prove a human is submitting. Sophisticated distributed abuse or volumetric DDoS still needs ingress protection and potentially a CAPTCHA. The global cap bounds writes at the cost of availability when exhausted. CORS is not authentication: non-browser clients can forge Origin.

## Privacy and administration

The server stores the submitted form, selected interface/language, and an optional quote ID. The client never automatically sends raw quote text, addresses, prices, browser fingerprints, or user-agent strings. It sends no cookies, uses no-referrer requests, and keeps credentials out of frontend code. Users are warned not to enter sensitive information themselves.

Network identifiers are keyed hashes, not raw IP addresses. Temporary quota events expire after 24 hours. Challenge replay entries expire after 10 minutes. Expired feedback is removed on requests and health checks (normally every 30 seconds in Compose); an offline service performs cleanup when restarted/checked. Configure any independent backups with their own short retention and access controls.

The `.env` secret and `data/` volume must never be committed, served by a static web server, or copied into a public deployment artifact. File permissions are restricted. Reports are plain text/JSON, never interpreted as HTML or executed as instructions.

## Deploy when PartsPilot is connected

1. Create an isolated PartsPilot project named `ltl-feedback`, copy this directory into it, and confirm that the Linux VPS has capacity and Docker Compose. Do not stop or overwrite existing PartsPilot services.
2. Verify that host port **127.0.0.1:8787** is unused. This Compose configuration assumes **Caddy runs on the host**. A containerized reverse proxy needs a dedicated private Docker network and a matching explicit `TRUSTED_PROXIES` configuration instead; do not trust every proxy or publish the API on 0.0.0.0.
3. Create private runtime files:

```bash
umask 077
python3 - <<'PY'
from pathlib import Path
import secrets
p = Path('.env')
if p.exists():
    raise SystemExit('.env already exists; keep the existing stable secret.')
p.write_text('FEEDBACK_SECRET=' + secrets.token_hex(32) + '\nALLOWED_ORIGINS=https://luisho24.github.io\n')
PY
mkdir -p data
sudo chown 10001:10001 data
sudo chmod 700 data
docker compose config --quiet
docker compose up -d --build
curl --fail http://127.0.0.1:8787/healthz
```

4. Provision and verify a dedicated DNS hostname. `feedback.partspilot.lat` in `Caddyfile.example` is only a proposal, not an existing endpoint. Merge the standalone block into the existing host Caddy configuration, validate it, then reload Caddy. Never replace the existing platform configuration. The proxy must overwrite the forwarded client-address header as shown, rather than trusting a browser-supplied header. The application port remains loopback-only.
5. Verify HTTPS, health, allowed-origin preflight, one stored receipt, an invalid-origin rejection, an oversized-body rejection, and a 429 response. Confirm quotas survive a container restart and that `/admin` and GET `/v1/feedback` cannot disclose reports. Test an external forged X-Forwarded-For header against the deployed proxy.
6. Set only the verified HTTPS origin in the website's `feedback-config.js`. Add exact frontend origins to `ALLOWED_ORIGINS` as required; never allow `*` or opaque `null` origins. A normal iframe embedding the GitHub Pages URL keeps that URL's origin; copied HTML with an opaque origin is intentionally rejected.
7. Run `tests/browser-feedback.py` in an unrestricted local/CI Chromium environment, validate both public interfaces against the live service, and only then merge/release the branch to `main`.

The backend does not send email notifications automatically. Optional reporter email addresses are available to the owner for follow-up through the private inbox.

## Private inbox commands

Run from this project directory on the authorized VPS:

```bash
docker compose exec feedback python manage.py list --limit 50
docker compose exec feedback python manage.py resolve --id FB-0123456789ABCDEF
docker compose exec feedback python manage.py delete --id FB-0123456789ABCDEF
docker compose exec feedback python manage.py prune
```

`list` writes JSON lines (not CSV or executable markup). Limit is capped at 500. Keep exported reports private. No admin secret is exposed to website visitors.

## Tests and coverage limits

```bash
cd feedback-service
python -m unittest -v test_app
# From the repository root:
node verify-roundtrip.js
node verify-workspace.js
python tests/browser-feedback.py
```

The 23 WSGI/SQLite tests passed locally, including concurrent retries, durable quotas, validation, retention, proxy handling and no-public-inbox checks. The existing parser test and 264 email/PDF HTML comparisons passed. A separate 32-check in-memory Chromium harness passed for shared forms, preference/prompt behavior, quote-state transfer, mobile dialog layout, service errors, and real SQLite receipts through a WSGI test bridge. Navigation/storage were simulated and clipboard writing mocked in that harness.

**Not yet validated:** Docker image build, Gunicorn runtime, actual PartsPilot infrastructure, DNS/TLS, real reverse-proxy IP handling, or end-to-end browser HTTP/CORS. The full browser integration test is included, but this environment's browser navigation policy blocked running it. Do not describe these outstanding checks as passed.

References: OWASP REST Security Cheat Sheet (request validation, size limits, origin policy, status codes); official Gunicorn release 26.2.2. These are design references, not a security audit.
