"""Private administration and public, bounded feedback/configuration API."""
from __future__ import annotations
import base64
import copy
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import sqlite3
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from app import Config, FeedbackApp, Problem

HERE = Path(__file__).parent
STATUSES = ('new', 'reviewing', 'resolved', 'archived')
FEATURES = ('feedback', 'expeditedRates', 'volumeRates', 'batchMode', 'exportEmail', 'referenceLibrary', 'insurance', 'carrierLogos')
ADMIN_SCHEMA = '''
CREATE TABLE IF NOT EXISTS administrators(username TEXT PRIMARY KEY, salt TEXT NOT NULL, password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions(token TEXT PRIMARY KEY, username TEXT NOT NULL, expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, first_seen REAL NOT NULL, last_seen REAL NOT NULL, name TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS configuration(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS configuration_history(revision INTEGER PRIMARY KEY, created REAL NOT NULL, actor TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, created REAL NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS feedback_annotations(id TEXT PRIMARY KEY, notes TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'normal', edited REAL);
'''


def clean_text(value, maximum=200, minimum=0):
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value):
        raise Problem(400, 'invalid_text')
    return value.strip()


def public_text(value, maximum=200, minimum=0):
    value = clean_text(value, maximum, minimum)
    # These fields enter the parser's existing HTML export. Keep configuration text-only.
    if re.search(r'<\s*[A-Za-z!/?]|`', value):
        raise Problem(400, 'configuration_must_be_plain_text')
    return value


def string_list(value):
    if not isinstance(value, list) or len(value) > 300:
        raise Problem(400, 'invalid_list')
    return list(dict.fromkeys(public_text(v, 150, 1) for v in value))


def validate_config(value):
    if not isinstance(value, dict) or set(value) != {'revision', 'features', 'filters', 'carriers', 'rules'}:
        raise Problem(400, 'invalid_configuration')
    if not isinstance(value['revision'], int) or isinstance(value['revision'], bool):
        raise Problem(400, 'invalid_revision')
    features = value['features']
    if not isinstance(features, dict) or set(features) != set(FEATURES) or any(type(v) is not bool for v in features.values()):
        raise Problem(400, 'invalid_features')
    for group, limit in [('filters', 40), ('carriers', 300)]:
        if not isinstance(value[group], list) or len(value[group]) > limit:
            raise Problem(400, 'invalid_' + group)
        ids = set()
        for item in value[group]:
            expected = {'id', 'label', 'enabled', 'allowed', 'blocked', 'notes'} if group == 'filters' else {'id', 'name', 'aliases', 'logoUrl', 'enabled'}
            if not isinstance(item, dict) or set(item) != expected or type(item['enabled']) is not bool:
                raise Problem(400, 'invalid_' + group)
            if not isinstance(item['id'], str) or not re.fullmatch(r'[a-z][a-z0-9-]{0,49}', item['id']) or item['id'] in ids or item['id'] in ('standard', '__proto__', 'constructor', 'prototype'):
                raise Problem(400, 'invalid_id')
            ids.add(item['id'])
            if group == 'filters':
                item['label'] = public_text(item['label'], 60, 1)
                item['allowed'], item['blocked'] = string_list(item['allowed']), string_list(item['blocked'])
                if not isinstance(item['notes'], dict) or len(item['notes']) > 300:
                    raise Problem(400, 'invalid_notes')
                item['notes'] = {public_text(k, 150, 1): public_text(v, 1000) for k, v in item['notes'].items()}
            else:
                item['name'], item['aliases'] = public_text(item['name'], 150, 1), string_list(item['aliases'])
                logo = clean_text(item['logoUrl'], 2000)
                if logo:
                    u = urlsplit(logo)
                    if u.scheme != 'https' or not u.netloc or u.username or u.password or re.search(r'[<>"\s`]', logo):
                        raise Problem(400, 'logo_requires_https')
                item['logoUrl'] = logo
    # Rules are structured data, never executable code. Bound and validate every leaf.
    if not isinstance(value['rules'], dict) or set(value['rules']) != {'amazon', 'walmart', 'tobacco', 'alcohol', 'vape', 'firearms', 'liftgate', 'cubic'}:
        raise Problem(400, 'invalid_rules')
    def walk(node, depth=0):
        if depth > 5:
            raise Problem(400, 'rules_too_deep')
        if isinstance(node, dict):
            if len(node) > 300:
                raise Problem(400, 'rules_too_large')
            for k, v in node.items():
                public_text(k, 150, 1)
                if k in ('__proto__', 'constructor', 'prototype'):
                    raise Problem(400, 'invalid_rule_key')
                walk(v, depth + 1)
        elif isinstance(node, list):
            string_list(node)
        elif isinstance(node, str):
            public_text(node, 2000)
        elif type(node) in (int, float):
            if not 0 <= node <= 1000000:
                raise Problem(400, 'invalid_rule_number')
        else:
            raise Problem(400, 'invalid_rule_value')
    walk(value['rules'])
    for kind, rule in value['rules'].items():
        expected = {'allowed', 'notes'} if kind in ('amazon', 'walmart', 'firearms') else {'banned', 'restricted', 'notes'} if kind == 'tobacco' else {'allowed', 'banned', 'notes'} if kind == 'vape' else {'limits'} if kind == 'liftgate' else {'defaultNote', 'notes'} if kind == 'cubic' else {'notes'}
        if not isinstance(rule, dict) or set(rule) != expected:
            raise Problem(400, 'invalid_rule_shape')
        for key in ('allowed', 'banned', 'restricted'):
            if key in rule:
                string_list(rule[key])
        if 'notes' in rule and (not isinstance(rule['notes'], dict) or any(not isinstance(v, str) for v in rule['notes'].values())):
            raise Problem(400, 'invalid_rule_notes')
        if kind == 'liftgate':
            if not isinstance(rule['limits'], dict):
                raise Problem(400, 'invalid_liftgate')
            for bounds in rule['limits'].values():
                if not isinstance(bounds, dict) or set(bounds) - {'l', 'wid', 'h', 'w', 'note', 'warnL', 'warnW', 'warnH', 'warnWeight', 'resiW'}:
                    raise Problem(400, 'invalid_liftgate')
                if any(type(v) not in (int, float) for k, v in bounds.items() if k != 'note') or not isinstance(bounds.get('note', ''), str):
                    raise Problem(400, 'invalid_liftgate')
    if len(json.dumps(value).encode()) > 180000:
        raise Problem(413, 'configuration_too_large')
    return value


class AdminApp:
    def __init__(self, feedback, state_dir=None, clock=time.time):
        self.fb, self.clock = feedback, clock
        self.state_dir = Path(state_dir or Path(feedback.c.database).parent)
        self.state_dir.mkdir(exist_ok=True, parents=True, mode=0o700)
        self.bootstrap = self.state_dir / 'owner-setup.json'
        with self.fb.connect() as db:
            db.executescript(ADMIN_SCHEMA)
            default = json.loads((HERE / 'default-config.json').read_text('utf8'))
            db.execute('INSERT OR IGNORE INTO configuration VALUES (1,1,?)', (json.dumps(default),))
            if not db.execute('SELECT 1 FROM administrators').fetchone() and not self.bootstrap.exists():
                self.bootstrap.write_text(json.dumps({'token': secrets.token_urlsafe(32), 'created': self.clock()}))
                os.chmod(self.bootstrap, 0o600)

    def config(self, db=None):
        if db is None:
            with self.fb.connect() as connection:
                return self.config(connection)
        return json.loads(db.execute('SELECT body FROM configuration WHERE id=1').fetchone()[0])

    def audit(self, db, actor, action, target):
        db.execute('INSERT INTO audit(created,actor,action,target) VALUES (?,?,?,?)', (self.clock(), actor, action, target))

    def self_origin(self, env):
        expected = os.environ.get('ADMIN_ORIGIN') or ('https://' + env.get('HTTP_HOST', ''))
        if env.get('HTTP_ORIGIN') != expected and not (env.get('HTTP_ORIGIN') in ('http://127.0.0.1:5501', 'http://localhost:5501') and env.get('HTTP_HOST') in ('127.0.0.1:5501', 'localhost:5501')):
            raise Problem(403, 'admin_origin_required')

    def read(self, env, limit=200000):
        length = env.get('CONTENT_LENGTH', '')
        if not length.isdigit() or not 0 < int(length) <= limit or env.get('CONTENT_TYPE', '').split(';')[0] != 'application/json':
            raise Problem(400, 'invalid_request')
        try:
            data = json.loads(env['wsgi.input'].read(int(length)))
            if not isinstance(data, dict):
                raise ValueError()
            return data
        except (ValueError, UnicodeError):
            raise Problem(400, 'invalid_json') from None

    def session(self, env, mutate=False):
        cookie = SimpleCookie()
        try:
            cookie.load(env.get('HTTP_COOKIE', ''))
            raw = cookie['__Host-ltl-admin'].value
        except (KeyError, Exception):
            raise Problem(401, 'login_required') from None
        if not re.fullmatch(r'[A-Za-z0-9_-]{40,100}', raw):
            raise Problem(401, 'login_required')
        with self.fb.connect() as db:
            row = db.execute('SELECT username FROM admin_sessions WHERE token=? AND expires>?', (self.fb.digest('session:' + raw), self.clock())).fetchone()
        if not row:
            raise Problem(401, 'login_required')
        csrf = self.fb.digest('csrf:' + raw)
        if mutate:
            self.self_origin(env)
            if not hmac.compare_digest(env.get('HTTP_X_CSRF_TOKEN', ''), csrf):
                raise Problem(403, 'csrf_required')
        return row[0], csrf, raw

    @staticmethod
    def password(value, salt):
        return hashlib.pbkdf2_hmac('sha256', value.encode(), bytes.fromhex(salt), 600000).hex()

    def login(self, env, setup=False):
        self.self_origin(env)
        network, now = self.fb.network(env), self.clock()
        self.fb.request_budget(network, now)
        with self.fb.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self.fb.quota(db, 'auth', now, 900, 10, 'network', network)
            db.execute('INSERT INTO events VALUES (?,?,?,?)', (now, 'auth', network, ''))
            db.commit()
        data = self.read(env, 4096)
        username = clean_text(data.get('username', ''), 60, 3)
        password = clean_text(data.get('password', ''), 200, 12)
        if not re.fullmatch(r'[a-zA-Z0-9_.@-]{3,60}', username):
            raise Problem(400, 'invalid_username')
        with self.fb.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if setup:
                if db.execute('SELECT 1 FROM administrators').fetchone() or not self.bootstrap.exists():
                    raise Problem(409, 'already_configured')
                bootstrap = json.loads(self.bootstrap.read_text())
                if self.clock() - bootstrap['created'] > 86400 or not hmac.compare_digest(str(data.get('token', '')), bootstrap['token']):
                    raise Problem(403, 'invalid_setup_link')
                salt = secrets.token_hex(16)
                db.execute('INSERT INTO administrators VALUES (?,?,?)', (username, salt, self.password(password, salt)))
                self.audit(db, username, 'owner.created', username)
            else:
                row = db.execute('SELECT salt,password FROM administrators WHERE username=?', (username,)).fetchone()
                hashed = self.password(password, row[0] if row else '0' * 32)
                if not row or not hmac.compare_digest(hashed, row[1]):
                    raise Problem(401, 'invalid_credentials')
            token = secrets.token_urlsafe(32)
            db.execute('DELETE FROM admin_sessions WHERE expires<?', (now,))
            db.execute('INSERT INTO admin_sessions VALUES (?,?,?)', (self.fb.digest('session:' + token), username, now + 28800))
            self.audit(db, username, 'session.started', username)
            db.commit()
        if setup:
            self.bootstrap.unlink(missing_ok=True)
        return {'username': username, 'csrf': self.fb.digest('csrf:' + token)}, [('Set-Cookie', '__Host-ltl-admin=' + token + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800')]

    def touch_device(self, data):
        identity = self.fb.client(data)
        now = self.clock()
        with self.fb.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT enabled FROM devices WHERE id=?', (identity,)).fetchone()
            if row and not row[0]:
                raise Problem(403, 'device_disabled')
            if not row and db.execute('SELECT count(*) FROM devices').fetchone()[0] >= 10000:
                raise Problem(503, 'device_registry_full')
            db.execute('INSERT INTO devices(id,first_seen,last_seen) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen', (identity, now, now))
            name = clean_text(data.get('name', ''), 100)
            if name:
                db.execute('UPDATE devices SET name=? WHERE id=?', (name, identity))
            db.commit()
        return 'DEV-' + identity[:12].upper()

    def admin_api(self, env, path, method):
        actor, csrf, raw = self.session(env, method != 'GET')
        if path == '/admin/api/session' and method == 'GET':
            return 200, {'username': actor, 'csrf': csrf}, []
        if path == '/admin/api/logout' and method == 'POST':
            with self.fb.connect() as db:
                db.execute('DELETE FROM admin_sessions WHERE token=?', (self.fb.digest('session:' + raw),))
            return 200, {'ok': True}, [('Set-Cookie', '__Host-ltl-admin=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0')]
        if path == '/admin/api/config' and method == 'GET':
            return 200, self.config(), []
        if path == '/admin/api/logos' and method == 'POST':
            data = self.read(env, 85000)
            try:
                image = base64.b64decode(data.get('png', ''), validate=True)
            except (ValueError, TypeError):
                raise Problem(400, 'invalid_png') from None
            if not 24 <= len(image) <= 60000 or image[:8] != b'\x89PNG\r\n\x1a\n' or image[12:16] != b'IHDR' or not (1 <= int.from_bytes(image[16:20], 'big') <= 512 and 1 <= int.from_bytes(image[20:24], 'big') <= 512):
                raise Problem(400, 'invalid_png_size')
            folder = self.state_dir / 'logos'; folder.mkdir(exist_ok=True, mode=0o700)
            filename = hashlib.sha256(image).hexdigest() + '.png'
            if not (folder / filename).exists() and len(list(folder.glob('*.png'))) >= 300:
                raise Problem(400, 'logo_storage_full')
            (folder / filename).write_bytes(image)
            with self.fb.connect() as db:
                self.audit(db, actor, 'logo.uploaded', filename[:12])
            host = os.environ.get('ADMIN_ORIGIN') or 'https://' + env.get('HTTP_HOST', '')
            return 201, {'url': host + '/logos/' + filename}, []
        if path == '/admin/api/config' and method == 'PUT':
            candidate = validate_config(self.read(env))
            with self.fb.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                previous = self.config(db)
                if candidate['revision'] != previous['revision']:
                    raise Problem(409, 'configuration_changed_reload')
                db.execute('INSERT INTO configuration_history VALUES (?,?,?,?)', (previous['revision'], self.clock(), actor, json.dumps(previous)))
                candidate['revision'] += 1
                db.execute('UPDATE configuration SET revision=?,body=? WHERE id=1', (candidate['revision'], json.dumps(candidate)))
                self.audit(db, actor, 'configuration.updated', str(candidate['revision']))
                db.commit()
            return 200, candidate, []
        if path == '/admin/api/restore' and method == 'POST':
            data = self.read(env, 4096)
            with self.fb.connect() as db:
                row = db.execute('SELECT body FROM configuration_history WHERE revision=?', (data.get('revision'),)).fetchone()
            if not row:
                raise Problem(404, 'revision_not_found')
            candidate = json.loads(row[0])
            candidate['revision'] = data.get('currentRevision')
            encoded = json.dumps(candidate).encode()
            return self.admin_api({**env, 'REQUEST_METHOD': 'PUT', 'wsgi.input': io.BytesIO(encoded), 'CONTENT_LENGTH': str(len(encoded))}, '/admin/api/config', 'PUT')
        if path == '/admin/api/audit' and method == 'GET':
            with self.fb.connect() as db:
                rows = db.execute('SELECT created,actor,action,target FROM audit ORDER BY id DESC LIMIT 200').fetchall()
                history = db.execute('SELECT revision,created,actor FROM configuration_history ORDER BY revision DESC LIMIT 50').fetchall()
            return 200, {'events': [dict(zip(('created', 'actor', 'action', 'target'), row)) for row in rows], 'revisions': [dict(zip(('revision', 'created', 'actor'), row)) for row in history]}, []
        if path == '/admin/api/devices' and method == 'GET':
            with self.fb.connect() as db:
                rows = db.execute('SELECT id,first_seen,last_seen,name,enabled FROM devices ORDER BY last_seen DESC LIMIT 1000').fetchall()
            return 200, {'devices': [dict(id=row[0], displayId='DEV-' + row[0][:12].upper(), firstSeen=row[1], lastSeen=row[2], name=row[3], enabled=bool(row[4])) for row in rows]}, []
        if path.startswith('/admin/api/devices/') and method == 'PUT':
            device = path.rsplit('/', 1)[-1]
            data = self.read(env, 4096)
            name = clean_text(data.get('name', ''), 100)
            if type(data.get('enabled')) is not bool:
                raise Problem(400, 'invalid_enabled')
            with self.fb.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                changed = db.execute('UPDATE devices SET name=?,enabled=? WHERE id=?', (name, int(data['enabled']), device)).rowcount
                if not changed:
                    raise Problem(404, 'device_not_found')
                self.audit(db, actor, 'device.updated', device[:12])
                db.commit()
            return 200, {'ok': True}, []
        if path == '/admin/api/messages' and method == 'GET':
            query = parse_qs(env.get('QUERY_STRING', ''), max_num_fields=20)
            clauses, args = [], []
            for key, column in [('status', 'f.status'), ('device', 'f.client')]:
                if query.get(key, [''])[0]:
                    clauses.append(column + '=?'); args.append(query[key][0])
            for key in ('category', 'name'):
                if query.get(key, [''])[0]:
                    clauses.append("json_extract(f.payload,'$." + key + "')=?"); args.append(query[key][0])
            if query.get('q', [''])[0]:
                clauses.append('(f.payload LIKE ? OR f.id LIKE ? OR f.client LIKE ?)')
                args += ['%' + clean_text(query['q'][0], 200) + '%'] * 3
            for key, op in [('after', '>='), ('before', '<=')]:
                if query.get(key, [''])[0]:
                    try:
                        value = float(query[key][0])
                    except ValueError:
                        raise Problem(400, 'invalid_date') from None
                    clauses.append('f.created' + op + '?'); args.append(value)
            try:
                page = max(1, min(10000, int(query.get('page', ['1'])[0])))
            except ValueError:
                raise Problem(400, 'invalid_page') from None
            where = ' WHERE ' + ' AND '.join(clauses) if clauses else ''
            with self.fb.connect() as db:
                self.fb.prune(db, self.clock())
                count = db.execute('SELECT count(*) FROM feedback f' + where, args).fetchone()[0]
                rows = db.execute('SELECT f.id,f.created,f.client,f.status,f.payload,coalesce(a.notes,\'\'),coalesce(a.priority,\'normal\') FROM feedback f LEFT JOIN feedback_annotations a ON a.id=f.id' + where + ' ORDER BY f.created DESC LIMIT 50 OFFSET ?', args + [(page - 1) * 50]).fetchall()
            return 200, {'total': count, 'page': page, 'messages': [dict(id=r[0], created=r[1], device=r[2], displayId='DEV-' + r[2][:12].upper(), status=r[3], payload=json.loads(r[4]), notes=r[5], priority=r[6]) for r in rows]}, []
        if path.startswith('/admin/api/messages/') and method == 'PUT':
            identity = path.rsplit('/', 1)[-1]
            data = self.read(env, 16000)
            if data.get('status') not in STATUSES or data.get('priority') not in ('low', 'normal', 'high'):
                raise Problem(400, 'invalid_status')
            title, message = clean_text(data.get('title', ''), 120, 5), clean_text(data.get('message', ''), 3000, 10)
            notes = clean_text(data.get('notes', ''), 3000)
            with self.fb.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                row = db.execute('SELECT payload FROM feedback WHERE id=?', (identity,)).fetchone()
                if not row:
                    raise Problem(404, 'message_not_found')
                payload = json.loads(row[0]); payload.update(title=title, message=message)
                db.execute('UPDATE feedback SET status=?,payload=? WHERE id=?', (data['status'], json.dumps(payload), identity))
                db.execute('INSERT INTO feedback_annotations VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET notes=excluded.notes,priority=excluded.priority,edited=excluded.edited', (identity, notes, data['priority'], self.clock()))
                self.audit(db, actor, 'message.updated', identity)
                db.commit()
            return 200, {'ok': True}, []
        raise Problem(404, 'not_found')

    def __call__(self, env, start_response):
        path, method = env.get('PATH_INFO', ''), env.get('REQUEST_METHOD', 'GET')
        origin = env.get('HTTP_ORIGIN', '')
        headers = [('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'), ('Referrer-Policy', 'no-referrer'), ('X-Frame-Options', 'DENY'),
                   ('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src https: data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")]
        if re.fullmatch(r'/logos/[a-f0-9]{64}\.png', path) and method == 'GET':
            image_file = self.state_dir / 'logos' / path.rsplit('/', 1)[-1]
            if image_file.is_file():
                raw = image_file.read_bytes()
                start_response('200 OK', headers + [('Content-Type', 'image/png'), ('Content-Length', str(len(raw)))])
                return [raw]
        if path in ('/', '/admin', '/admin/', '/admin/admin.css', '/admin/admin.js') and method == 'GET':
            filename = 'admin.css' if path.endswith('.css') else 'admin.js' if path.endswith('.js') else 'admin.html'
            mime = 'text/css' if filename.endswith('css') else 'application/javascript' if filename.endswith('js') else 'text/html'
            raw = (HERE / filename).read_bytes()
            start_response('200 OK', headers + [('Content-Type', mime + '; charset=utf-8'), ('Content-Length', str(len(raw)))])
            return [raw]
        headers.append(('Content-Type', 'application/json; charset=utf-8'))
        try:
            extra = []
            if path in ('/admin/api/login', '/admin/api/setup') and method == 'POST':
                body, extra = self.login(env, path.endswith('/setup')); status = 200
            elif path.startswith('/admin/api/'):
                status, body, extra = self.admin_api(env, path, method)
            elif path in ('/v1/config', '/v1/device'):
                if origin not in self.fb.c.origins:
                    raise Problem(403, 'origin_not_allowed')
                headers += [('Access-Control-Allow-Origin', origin), ('Vary', 'Origin')]
                if method == 'OPTIONS':
                    status, body = 204, None
                    headers += [('Access-Control-Allow-Methods', 'GET, POST'), ('Access-Control-Allow-Headers', 'Content-Type')]
                elif path == '/v1/config' and method == 'GET':
                    status, body = 200, self.config()
                elif path == '/v1/device' and method == 'POST':
                    self.fb.request_budget(self.fb.network(env), self.clock())
                    data = self.read(env, 4096)
                    if set(data) - {'clientId', 'name'}:
                        raise Problem(400, 'unknown_fields')
                    status, body = 200, {'deviceId': self.touch_device(data), 'enabled': True}
                else:
                    raise Problem(405, 'method_not_allowed')
            elif path in ('/v1/challenge', '/v1/feedback') and method == 'POST':
                if origin not in self.fb.c.origins:
                    raise Problem(403, 'origin_not_allowed')
                headers += [('Access-Control-Allow-Origin', origin), ('Vary', 'Origin')]
                if not self.config()['features']['feedback']:
                    raise Problem(503, 'feedback_disabled')
                length = env.get('CONTENT_LENGTH', '')
                if not length.isdigit() or not 0 < int(length) <= self.fb.c.max_body:
                    raise Problem(413, 'body_too_large')
                raw = env['wsgi.input'].read(int(length))
                try:
                    data = json.loads(raw)
                    if not isinstance(data, dict):
                        raise ValueError()
                except (ValueError, UnicodeError):
                    raise Problem(400, 'invalid_json') from None
                self.touch_device(data)
                env = {**env, 'wsgi.input': io.BytesIO(raw)}
                return self.fb(env, start_response)
            else:
                return self.fb(env, start_response)
            headers += extra
        except Problem as error:
            status, body = error.status, {'error': error.code}
            if error.retry:
                headers.append(('Retry-After', str(error.retry)))
        except sqlite3.Error:
            status, body = 503, {'error': 'temporarily_unavailable'}
        except Exception:
            status, body = 500, {'error': 'internal_error'}
        raw = b'' if body is None else json.dumps(body).encode()
        start_response(f'{status} {HTTPStatus(status).phrase}', headers + [('Content-Length', str(len(raw)))])
        return [raw]


def create_app():
    state = Path(os.environ.get('FEEDBACK_STATE', '.state'))
    state.mkdir(exist_ok=True, parents=True, mode=0o700)
    secret_file = state / 'service-secret'
    if not secret_file.exists():
        try:
            with secret_file.open('x') as file:
                file.write(secrets.token_hex(32))
            os.chmod(secret_file, 0o600)
        except FileExistsError:
            pass
    config = Config(str(state / 'feedback.sqlite3'), secret_file.read_text().strip(), tuple(os.environ.get('ALLOWED_ORIGINS', 'https://luisho24.github.io,http://127.0.0.1:5500,http://localhost:5500').split(',')))
    return AdminApp(FeedbackApp(config), state)
