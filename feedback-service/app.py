"""Private, bounded feedback inbox. Production entry: gunicorn 'app:create_app()'."""
from __future__ import annotations
import base64
import hashlib
import hmac
import ipaddress
import json
import math
import os
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass
from contextlib import contextmanager
from http import HTTPStatus
from pathlib import Path
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Config:
    database: str
    secret: str
    origins: tuple[str, ...]
    trusted_proxies: tuple[str, ...] = ()
    minimum_age: int = 2
    token_ttl: int = 600
    client_hour: int = 5
    client_day: int = 15
    network_hour: int = 30
    network_day: int = 100
    global_day: int = 250
    request_minute: int = 60
    global_requests_day: int = 10000
    max_records: int = 5000
    retention_days: int = 90
    max_body: int = 16384

    @classmethod
    def from_env(cls):
        def csv(key):
            return tuple(v.strip() for v in os.environ.get(key, '').split(',') if v.strip())
        return cls(os.environ.get('FEEDBACK_DB', '/data/feedback.sqlite3'),
                   os.environ.get('FEEDBACK_SECRET', ''), csv('ALLOWED_ORIGINS'),
                   csv('TRUSTED_PROXIES'))


class Problem(Exception):
    def __init__(self, status, code, retry=0):
        self.status, self.code, self.retry = status, code, retry


SCHEMA = '''
CREATE TABLE IF NOT EXISTS feedback (
 id TEXT PRIMARY KEY, created REAL NOT NULL, client TEXT NOT NULL,
 digest TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new');
CREATE INDEX IF NOT EXISTS feedback_digest ON feedback(client, digest, created);
CREATE TABLE IF NOT EXISTS events (
 created REAL NOT NULL, kind TEXT NOT NULL, network TEXT NOT NULL, client TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_time ON events(kind, created);
CREATE INDEX IF NOT EXISTS events_network ON events(kind, network, created);
CREATE INDEX IF NOT EXISTS events_client ON events(kind, client, created);
CREATE TABLE IF NOT EXISTS used_tokens (
 nonce TEXT PRIMARY KEY, created REAL NOT NULL, digest TEXT NOT NULL, receipt TEXT NOT NULL);
'''


class FeedbackApp:
    def __init__(self, config: Config, clock=time.time):
        self.c, self.clock = config, clock
        if len(config.secret) < 32 or config.secret.startswith('REPLACE_') or not config.origins:
            raise ValueError('Set a random FEEDBACK_SECRET (32+ characters) and ALLOWED_ORIGINS.')
        for origin in config.origins:
            u = urlsplit(origin)
            if (u.scheme not in ('https', 'http') or not u.netloc or u.path or u.query
                    or u.fragment or u.username or (u.scheme != 'https' and u.hostname not in ('localhost', '127.0.0.1'))):
                raise ValueError('Origins must be exact HTTPS origins; HTTP is allowed only on loopback.')
        self.proxies = tuple(ipaddress.ip_network(v) for v in config.trusted_proxies)
        path = Path(config.database)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.executescript(SCHEMA)
        os.chmod(path, 0o600)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.c.database, timeout=3, isolation_level=None)
        db.execute('PRAGMA secure_delete=ON')
        db.execute('PRAGMA wal_autocheckpoint=100')
        db.execute('PRAGMA journal_size_limit=1048576')
        db.execute('PRAGMA max_page_count=32768')
        try:
            yield db
        finally:
            db.close()

    def digest(self, text):
        return hmac.new(self.c.secret.encode(), text.encode(), hashlib.sha256).hexdigest()

    def network(self, env):
        try:
            address = ipaddress.ip_address(env.get('REMOTE_ADDR', ''))
            if any(address in network for network in self.proxies):
                chain = env.get('HTTP_X_FORWARDED_FOR', '').split(',')
                if len(chain) > 10:
                    raise ValueError()
                for part in reversed(chain):
                    if not any(address in network for network in self.proxies):
                        break
                    address = ipaddress.ip_address(part.strip())
            if address.version == 6:
                address = ipaddress.ip_network(f'{address}/64', strict=False).network_address
            return self.digest('network:' + str(address))
        except ValueError:
            raise Problem(400, 'invalid_network') from None

    def prune(self, db, now):
        db.execute('DELETE FROM events WHERE created < ?', (now - 86400,))
        db.execute('DELETE FROM used_tokens WHERE created < ?', (now - self.c.token_ttl,))
        db.execute('DELETE FROM feedback WHERE created < ?', (now - self.c.retention_days * 86400,))

    def quota(self, db, kind, now, seconds, limit, column=None, identity=None):
        # Column names are internal constants, never request data.
        sql = 'SELECT count(*), min(created) FROM events WHERE kind=? AND created>?'
        args = [kind, now - seconds]
        if column:
            sql += f' AND {column}=?'
            args.append(identity)
        count, oldest = db.execute(sql, args).fetchone()
        if count >= limit:
            raise Problem(429, 'rate_limited', max(1, math.ceil(oldest + seconds - now)))

    def request_budget(self, network, now):
        with self.connect() as db:
            try:
                db.execute('BEGIN IMMEDIATE')
                self.prune(db, now)
                self.quota(db, 'request', now, 60, self.c.request_minute, 'network', network)
                self.quota(db, 'request', now, 86400, self.c.global_requests_day)
                db.execute('INSERT INTO events VALUES (?,?,?,?)', (now, 'request', network, ''))
                db.commit()
            except Exception:
                db.rollback()
                raise

    def read_json(self, env):
        if env.get('CONTENT_TYPE', '').split(';')[0].lower() != 'application/json':
            raise Problem(415, 'json_required')
        if env.get('HTTP_CONTENT_ENCODING') not in (None, '', 'identity'):
            raise Problem(415, 'encoding_not_supported')
        try:
            length = int(env.get('CONTENT_LENGTH', ''))
        except ValueError:
            raise Problem(411, 'length_required') from None
        if not 0 < length <= self.c.max_body:
            raise Problem(413, 'body_too_large')
        try:
            data = json.loads(env['wsgi.input'].read(length))
            if not isinstance(data, dict):
                raise ValueError()
            return data
        except (ValueError, UnicodeError, RecursionError):
            raise Problem(400, 'invalid_json') from None

    @staticmethod
    def text(data, key, minimum, maximum):
        value = data.get(key, '')
        if not isinstance(value, str):
            raise Problem(400, 'invalid_' + key)
        value = value.strip()
        if not minimum <= len(value) <= maximum or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value):
            raise Problem(400, 'invalid_' + key)
        return value

    def client(self, data):
        value = self.text(data, 'clientId', 32, 64)
        if not re.fullmatch(r'[a-f0-9-]{32,64}', value):
            raise Problem(400, 'invalid_clientId')
        return self.digest('client:' + value)

    def challenge(self, origin, network, client, now):
        claims = json.dumps({'t': now, 'n': secrets.token_hex(16), 'o': origin,
                             'p': network, 'c': client}, separators=(',', ':'))
        raw = base64.urlsafe_b64encode(claims.encode()).decode().rstrip('=')
        return raw + '.' + self.digest('token:' + raw)

    def verify(self, token, origin, network, client, now):
        try:
            raw, sig = token.split('.')
            if not hmac.compare_digest(sig, self.digest('token:' + raw)):
                raise ValueError()
            claims = json.loads(base64.urlsafe_b64decode(raw + '=' * (-len(raw) % 4)))
            age = now - claims['t']
            if claims['o'] != origin or claims['p'] != network or claims['c'] != client or age < 0 or age > self.c.token_ttl:
                raise ValueError()
            if age < self.c.minimum_age:
                raise Problem(429, 'please_wait', math.ceil(self.c.minimum_age - age))
            return claims['n']
        except (ValueError, KeyError, TypeError, UnicodeError):
            raise Problem(400, 'expired_or_invalid_challenge') from None

    def submit(self, data, origin, network, now):
        allowed = {'clientId', 'token', 'website', 'category', 'title', 'message', 'steps', 'email', 'interface', 'language', 'quoteId'}
        if set(data) - allowed:
            raise Problem(400, 'unknown_fields')
        client = self.client(data)
        if self.text(data, 'website', 0, 200):
            raise Problem(400, 'submission_rejected')
        token = self.text(data, 'token', 1, 2048)
        nonce = self.verify(token, origin, network, client, now)
        payload = {k: self.text(data, k, lo, hi) for k, lo, hi in [
            ('category', 1, 20), ('title', 5, 120), ('message', 10, 3000), ('steps', 0, 2000),
            ('email', 0, 254), ('interface', 1, 20), ('language', 2, 2), ('quoteId', 0, 20)]}
        if payload['category'] not in ('bug', 'idea', 'other') or payload['interface'] not in ('classic', 'workspace') or payload['language'] not in ('en', 'es'):
            raise Problem(400, 'invalid_choice')
        if payload['email'] and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', payload['email']):
            raise Problem(400, 'invalid_email')
        if payload['quoteId'] and not re.fullmatch(r'\d{1,20}', payload['quoteId']):
            raise Problem(400, 'invalid_quoteId')
        packed = json.dumps(payload, ensure_ascii=True, sort_keys=True)
        fingerprint = self.digest(packed)
        with self.connect() as db:
            try:
                db.execute('BEGIN IMMEDIATE')
                used = db.execute('SELECT digest, receipt FROM used_tokens WHERE nonce=?', (nonce,)).fetchone()
                if used:
                    if used[0] != fingerprint:
                        raise Problem(409, 'challenge_already_used')
                    db.commit()
                    return 200, {'id': used[1], 'duplicate': True}
                duplicate = db.execute('SELECT id FROM feedback WHERE client=? AND digest=? AND created>?', (client, fingerprint, now - 900)).fetchone()
                if duplicate:
                    db.execute('INSERT INTO used_tokens VALUES (?,?,?,?)', (nonce, now, fingerprint, duplicate[0]))
                    db.commit()
                    return 200, {'id': duplicate[0], 'duplicate': True}
                for seconds, limit in [(3600, self.c.client_hour), (86400, self.c.client_day)]:
                    self.quota(db, 'submit', now, seconds, limit, 'client', client)
                for seconds, limit in [(3600, self.c.network_hour), (86400, self.c.network_day)]:
                    self.quota(db, 'submit', now, seconds, limit, 'network', network)
                self.quota(db, 'submit', now, 86400, self.c.global_day)
                if db.execute('SELECT count(*) FROM feedback').fetchone()[0] >= self.c.max_records:
                    raise Problem(503, 'inbox_full', 3600)
                receipt = 'FB-' + secrets.token_hex(8).upper()
                db.execute('INSERT INTO feedback(id,created,client,digest,payload) VALUES (?,?,?,?,?)', (receipt, now, client, fingerprint, packed))
                db.execute('INSERT INTO used_tokens VALUES (?,?,?,?)', (nonce, now, fingerprint, receipt))
                db.execute('INSERT INTO events VALUES (?,?,?,?)', (now, 'submit', network, client))
                db.commit()
                return 201, {'id': receipt, 'duplicate': False}
            except Exception:
                db.rollback()
                raise

    def __call__(self, env, start_response):
        origin = env.get('HTTP_ORIGIN', '')
        headers = [('Content-Type', 'application/json; charset=utf-8'), ('Cache-Control', 'no-store'),
                   ('X-Content-Type-Options', 'nosniff'), ('Vary', 'Origin'),
                   ('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")]
        if origin in self.c.origins:
            headers += [('Access-Control-Allow-Origin', origin), ('Access-Control-Expose-Headers', 'Retry-After')]
        try:
            path, method = env.get('PATH_INFO', ''), env.get('REQUEST_METHOD', '')
            if path == '/healthz' and method == 'GET':
                with self.connect() as db:
                    self.prune(db, self.clock())
                    db.execute('SELECT 1').fetchone()
                status, body = 200, {'status': 'ok'}
            else:
                if path not in ('/v1/challenge', '/v1/feedback'):
                    raise Problem(404, 'not_found')
                if origin not in self.c.origins:
                    raise Problem(403, 'origin_not_allowed')
                if method == 'OPTIONS':
                    if env.get('HTTP_ACCESS_CONTROL_REQUEST_METHOD') != 'POST':
                        raise Problem(405, 'method_not_allowed')
                    requested = env.get('HTTP_ACCESS_CONTROL_REQUEST_HEADERS', '').lower().replace(' ', '').split(',')
                    if any(v not in ('', 'content-type') for v in requested):
                        raise Problem(403, 'headers_not_allowed')
                    headers += [('Access-Control-Allow-Methods', 'POST'), ('Access-Control-Allow-Headers', 'Content-Type')]
                    status, body = 204, None
                else:
                    if method != 'POST':
                        raise Problem(405, 'method_not_allowed')
                    now, network = self.clock(), self.network(env)
                    self.request_budget(network, now)
                    data = self.read_json(env)
                    if path == '/v1/challenge':
                        if set(data) != {'clientId'}:
                            raise Problem(400, 'unknown_fields')
                        token = self.challenge(origin, network, self.client(data), now)
                        status, body = 200, {'token': token, 'waitSeconds': self.c.minimum_age, 'expiresIn': self.c.token_ttl}
                    else:
                        status, body = self.submit(data, origin, network, now)
        except Problem as p:
            status, body = p.status, {'error': p.code, 'retryAfter': p.retry}
            if p.retry:
                headers.append(('Retry-After', str(p.retry)))
        except sqlite3.Error:
            status, body = 503, {'error': 'temporarily_unavailable', 'retryAfter': 10}
            headers.append(('Retry-After', '10'))
        except Exception:
            status, body = 500, {'error': 'internal_error'}
        raw = b'' if body is None else json.dumps(body).encode()
        headers.append(('Content-Length', str(len(raw))))
        start_response(f'{status} {HTTPStatus(status).phrase}', headers)
        return [raw]


def create_app():
    return FeedbackApp(Config.from_env())
