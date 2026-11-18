# Smart LTL administration and feedback

PartsPilot project: `ltl-feedback-admin`. The service runs Gunicorn 27.0.1, a Python WSGI application and SQLite in a private persistent `.state/` directory. No paid API or AI service is required.

## Administration

Open `/admin/`. The first owner creates their own username and password (minimum 12 characters) through a one-use setup link. Retrieve the token from `.state/owner-setup.json` through the authorized workspace, never through the web. Put it in the URL fragment `#setup=TOKEN`; it expires after 24 hours. After owner setup the file is removed. Never commit or share a live setup token publicly.

The panel manages feedback status, priority, text and internal notes; browser devices and blocking; carriers, aliases and HTTPS/PNG logos; destination filters and carrier allow/block lists; commodity, liftgate and cubic rules; feature switches; and configuration history with restore. Configuration updates use revisions to avoid overwriting another open session. Restoring creates a new revision. Saved configuration is polled by visible quote pages every minute and on tab return. Names are optional in feedback.

Sessions use Secure/HttpOnly/SameSite cookies, password hashes, same-origin and CSRF checks. Reports and device names require authentication. Public `/v1/config` exposes only public configuration, never reports or credentials. Public browser clients have no administrator token.

## Deployment

Run `gunicorn --bind 0.0.0.0:8080 --workers 1 --threads 4 'admin_app:create_app()'` behind the PartsPilot HTTPS proxy. Retain `.state/` across restarts. Its generated secret must remain stable. Only public service ports should be exposed by the platform proxy. Set `ALLOWED_ORIGINS` to exact frontend origins; defaults are GitHub Pages plus local development on port 5500. No wildcard CORS is allowed.

The provided Docker/Compose files are an alternative host-Caddy deployment binding loopback port 8787 with persistent `data/`. Use `FEEDBACK_STATE` for state storage. Mount it writable by UID 10001. The entry point is `admin_app:create_app()`. Source assets are allowlisted; state files are never served. Back up private SQLite state and secret together with private access and bounded retention. Do not publish `.state`, `.env`, databases, login cookies or setup tokens.

A random identifier persists per browser profile. Clearing browser storage creates a new identity; it is not a physical-device fingerprint. Heartbeats send only this identifier. Feedback sends the entered fields, optional name/email and interface context, never raw quote text automatically. Submitted text is rendered as text. No automatic email notifications are sent.

## Limits and tests

Feedback defaults: 5 reports per browser/hour, 15/day; 30/network/hour, 100/day; 250/day globally; 5,000 reports retained up to 90 days. Public attempts are limited and challenges are time-bound. Device registry is bounded at 10,000, carrier records at 300, destination filters at 40, uploaded PNG logos at 300. Each logo is at most 60KB and 512 by 512 pixels. These are browser/network quotas, not verified-person quotas. Without explicit trusted-proxy configuration the network quota conservatively groups requests at the proxy address.

Run from this directory: `python -m unittest -v test_admin test_app`. From the repository root: `node tests/admin-client.js`, plus the parser and email comparison suites. CLI `manage.py` remains available for authorized maintenance of the legacy feedback database; set `FEEDBACK_DB`, `FEEDBACK_SECRET` and `ALLOWED_ORIGINS` explicitly when using it.

Owner recovery requires authorized server access: back up state, remove stale administrator/session rows using SQLite, and restart to generate a new one-use setup token. Never reset an account through an unauthenticated public endpoint.
