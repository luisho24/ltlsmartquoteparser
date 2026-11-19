import base64
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from app import Config, FeedbackApp
from admin_app import AdminApp, validate_config

ORIGIN = 'https://luisho24.github.io'
ADMIN = 'https://feedback.test'
CLIENT = 'b' * 32


class AdminTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.now = 2000000.0
        self.fb = FeedbackApp(Config(str(Path(self.temp.name) / 'feedback.sqlite3'), 's' * 64, (ORIGIN,)), lambda: self.now)
        self.app = AdminApp(self.fb, self.temp.name, lambda: self.now)
        self.cookie = ''; self.csrf = ''

    def request(self, path, data=None, method='GET', origin=ADMIN, authenticated=True, csrf=True, query='', app=None):
        raw = json.dumps(data or {}).encode()
        env = {'PATH_INFO': path, 'REQUEST_METHOD': method, 'HTTP_HOST': 'feedback.test', 'HTTP_ORIGIN': origin,
               'REMOTE_ADDR': '192.0.2.10', 'CONTENT_TYPE': 'application/json', 'CONTENT_LENGTH': str(len(raw)),
               'wsgi.input': io.BytesIO(raw), 'QUERY_STRING': query}
        if authenticated: env['HTTP_COOKIE'] = self.cookie
        if csrf: env['HTTP_X_CSRF_TOKEN'] = self.csrf
        result = {}
        def start(status, headers): result.update(status=int(status.split()[0]), headers=dict(headers))
        body = b''.join((app or self.app)(env, start))
        result['body'] = json.loads(body) if body and 'json' in result['headers'].get('Content-Type', '') else body
        return result

    def setup_owner(self):
        token = json.loads(self.app.bootstrap.read_text())['token']
        result = self.request('/admin/api/setup', {'username': 'test-owner', 'password': 'test-only-password-123!', 'token': token}, 'POST')
        self.assertEqual(result['status'], 200, result)
        self.cookie = result['headers']['Set-Cookie'].split(';')[0]; self.csrf = result['body']['csrf']
        return result

    def submit(self, **extra):
        token = self.request('/v1/challenge', {'clientId': CLIENT}, 'POST', ORIGIN)['body']['token']
        self.now += 3
        return self.request('/v1/feedback', {'clientId': CLIENT, 'token': token, 'website': '', 'category': 'bug', 'title': 'Test feedback', 'message': 'A synthetic feedback message.', 'steps': '', 'email': '', 'interface': 'workspace', 'language': 'es', 'quoteId': '', **extra}, 'POST', ORIGIN)

    def test_private_pages_and_no_source_exposure(self):
        for route in ['/admin/', '/admin/admin.css', '/admin/admin.js']:
            self.assertEqual(self.request(route)['status'], 200)
        for route in ['/admin/api/messages', '/admin/api/devices', '/admin/api/config', '/admin/api/audit', '/.state/owner-setup.json', '/.state/feedback.sqlite3', '/admin_app.py']:
            self.assertIn(self.request(route, authenticated=False)['status'], (401, 403, 404))

    def test_setup_once_and_cookie_security(self):
        result = self.setup_owner()
        for flag in ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']:
            self.assertIn(flag, result['headers']['Set-Cookie'])
        self.assertFalse(self.app.bootstrap.exists())
        result = self.request('/admin/api/setup', {'username': 'test-owner', 'password': 'test-only-password-123!', 'token': 'bad'}, 'POST')
        self.assertEqual(result['status'], 409)
        with self.fb.connect() as db:
            self.assertNotIn('test-only-password', db.execute('SELECT password FROM administrators').fetchone()[0])

    def test_bad_bootstrap_and_password(self):
        self.assertEqual(self.request('/admin/api/setup', {'username': 'test-owner', 'password': 'test-only-password-123!', 'token': 'bad'}, 'POST')['status'], 403)
        self.setup_owner()
        self.assertEqual(self.request('/admin/api/login', {'username': 'test-owner', 'password': 'wrong-test-password'}, 'POST')['status'], 401)

    def test_login_logout_and_expiration(self):
        self.setup_owner()
        self.assertEqual(self.request('/admin/api/session')['status'], 200)
        self.assertEqual(self.request('/admin/api/logout', {}, 'POST')['status'], 200)
        self.assertEqual(self.request('/admin/api/session')['status'], 401)
        result = self.request('/admin/api/login', {'username': 'test-owner', 'password': 'test-only-password-123!'}, 'POST')
        self.cookie = result['headers']['Set-Cookie'].split(';')[0]
        self.now += 28801
        self.assertEqual(self.request('/admin/api/session')['status'], 401)

    def test_csrf_and_origin(self):
        self.setup_owner()
        config = self.request('/admin/api/config')['body']
        self.assertEqual(self.request('/admin/api/config', config, 'PUT', csrf=False)['status'], 403)
        self.assertEqual(self.request('/admin/api/config', config, 'PUT', origin='https://evil.test')['status'], 403)
        self.assertEqual(self.request('/admin/api/login', {}, 'POST', origin='https://evil.test')['status'], 403)

    def test_configuration_versioning_and_restore(self):
        self.setup_owner()
        config = self.request('/admin/api/config')['body']
        config['features']['volumeRates'] = False
        result = self.request('/admin/api/config', config, 'PUT')
        self.assertEqual(result['status'], 200, result)
        self.assertEqual(result['body']['revision'], 2)
        self.assertEqual(self.request('/admin/api/config', config, 'PUT')['status'], 409)
        restored = self.request('/admin/api/restore', {'revision': 1, 'currentRevision': 2}, 'POST')
        self.assertEqual(restored['status'], 200, restored)
        self.assertTrue(restored['body']['features']['volumeRates'])
        self.assertEqual(restored['body']['revision'], 3)
        self.assertEqual(len(self.request('/admin/api/audit')['body']['revisions']), 2)

    def test_configuration_rejects_executable_content(self):
        self.setup_owner()
        for mutate in [lambda c: c['carriers'][0].update(logoUrl='javascript:alert(1)'), lambda c: c['carriers'][0].update(name='<img src=x>'), lambda c: c['rules'].update(__proto__={}), lambda c: c['features'].update(feedback='true'), lambda c: c['filters'][0].update(id='constructor')]:
            config = self.request('/admin/api/config')['body']; mutate(config)
            self.assertEqual(self.request('/admin/api/config', config, 'PUT')['status'], 400)

    def test_name_and_stable_device_id(self):
        self.setup_owner()
        registered = self.request('/v1/device', {'clientId': CLIENT}, 'POST', ORIGIN)
        self.assertEqual(registered['status'], 200)
        self.assertEqual(registered['body']['deviceId'], self.request('/v1/device', {'clientId': CLIENT}, 'POST', ORIGIN)['body']['deviceId'])
        submitted = self.submit(name='Persona de prueba')
        self.assertEqual(submitted['status'], 201, submitted)
        messages = self.request('/admin/api/messages')['body']['messages']
        self.assertEqual(messages[0]['payload']['name'], 'Persona de prueba')
        self.assertEqual(messages[0]['displayId'], registered['body']['deviceId'])
        self.assertNotIn(CLIENT, json.dumps(messages))
        self.assertEqual(self.request('/v1/device', {'clientId': 'c' * 32}, 'POST', ORIGIN)['status'], 200)
        self.assertEqual(len(self.request('/admin/api/devices')['body']['devices']), 2)

    def test_anonymous_feedback_and_edit_archive(self):
        self.setup_owner()
        self.assertEqual(self.submit()['status'], 201)
        item = self.request('/admin/api/messages')['body']['messages'][0]
        self.assertNotIn('name', item['payload'])
        data = {'title': 'Updated title', 'message': 'Updated message content.', 'status': 'archived', 'priority': 'high', 'notes': 'Internal note'}
        self.assertEqual(self.request('/admin/api/messages/' + item['id'], data, 'PUT')['status'], 200)
        found = self.request('/admin/api/messages', query='status=archived&q=Updated')['body']
        self.assertEqual(found['total'], 1); self.assertEqual(found['messages'][0]['notes'], 'Internal note')
        self.assertEqual(self.request('/admin/api/messages', query='status=new')['body']['total'], 0)

    def test_device_block_and_unblock(self):
        self.setup_owner(); self.submit()
        device = self.request('/admin/api/devices')['body']['devices'][0]
        self.assertEqual(self.request('/admin/api/devices/' + device['id'], {'name': 'Test browser', 'enabled': False}, 'PUT')['status'], 200)
        self.assertEqual(self.request('/v1/challenge', {'clientId': CLIENT}, 'POST', ORIGIN)['status'], 403)
        self.assertEqual(self.request('/v1/device', {'clientId': CLIENT}, 'POST', ORIGIN)['status'], 403)
        self.assertEqual(self.request('/admin/api/devices/' + device['id'], {'name': 'Test browser', 'enabled': True}, 'PUT')['status'], 200)
        self.assertEqual(self.request('/v1/challenge', {'clientId': CLIENT}, 'POST', ORIGIN)['status'], 200)

    def test_public_configuration_has_no_private_data(self):
        self.setup_owner(); self.submit(name='Private test person')
        result = self.request('/v1/config', origin=ORIGIN)
        self.assertEqual(result['status'], 200)
        serialized = json.dumps(result['body'])
        self.assertNotIn('Private test person', serialized); self.assertNotIn('test-owner', serialized); self.assertNotIn(self.csrf, serialized)
        self.assertEqual(self.request('/v1/config', origin='https://evil.test')['status'], 403)
        self.assertEqual(self.request('/v1/config', method='OPTIONS', origin=ORIGIN)['status'], 204)

    def test_disable_feedback_and_persistence(self):
        self.setup_owner()
        config = self.request('/admin/api/config')['body']; config['features']['feedback'] = False
        self.assertEqual(self.request('/admin/api/config', config, 'PUT')['status'], 200)
        self.assertEqual(self.request('/v1/challenge', {'clientId': CLIENT}, 'POST', ORIGIN)['status'], 503)
        restarted = AdminApp(self.fb, self.temp.name, lambda: self.now)
        self.assertFalse(restarted.config()['features']['feedback'])
        self.assertEqual(self.request('/admin/api/session', app=restarted)['status'], 200)

    def test_admin_uploaded_logo_is_public_but_state_is_private(self):
        self.setup_owner()
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=')
        result = self.request('/admin/api/logos', {'png': base64.b64encode(png).decode()}, 'POST')
        self.assertEqual(result['status'], 201, result)
        path = result['body']['url'].replace(ADMIN, '')
        image = self.request(path, authenticated=False)
        self.assertEqual(image['status'], 200); self.assertEqual(image['body'], png)
        self.assertEqual(self.request('/admin/api/logos', {'png': base64.b64encode(b'<svg/>').decode()}, 'POST')['status'], 400)




    def test_temporary_password_requires_change_and_rejects_old_password(self):
        self.setup_owner()
        with self.fb.connect() as db:
            db.execute('INSERT INTO admin_password_resets VALUES (?)', ('test-owner',))
        self.assertTrue(self.request('/admin/api/session')['body']['requiresPasswordChange'])
        self.assertEqual(self.request('/admin/api/config')['status'], 403)
        wrong = self.request('/admin/api/password', {'currentPassword': 'wrong-password-123', 'newPassword': 'new-test-password-456!'}, 'POST')
        self.assertEqual(wrong['status'], 403)
        self.assertEqual(self.request('/admin/api/password', {'currentPassword': 'test-only-password-123!', 'newPassword': 'new-test-password-456!'}, 'POST', csrf=False)['status'], 403)
        changed = self.request('/admin/api/password', {'currentPassword': 'test-only-password-123!', 'newPassword': 'new-test-password-456!'}, 'POST')
        self.assertEqual(changed['status'], 200, changed)
        self.assertFalse(changed['body']['requiresPasswordChange'])
        self.assertEqual(self.request('/admin/api/config')['status'], 200)
        self.assertEqual(self.request('/admin/api/login', {'username': 'test-owner', 'password': 'test-only-password-123!'}, 'POST')['status'], 401)
        self.assertEqual(self.request('/admin/api/login', {'username': 'test-owner', 'password': 'new-test-password-456!'}, 'POST')['status'], 200)

    def test_password_change_invalidates_other_sessions(self):
        self.setup_owner()
        old_cookie = self.cookie
        result = self.request('/admin/api/login', {'username': 'test-owner', 'password': 'test-only-password-123!'}, 'POST')
        self.cookie = result['headers']['Set-Cookie'].split(';')[0]; self.csrf = result['body']['csrf']
        changed = self.request('/admin/api/password', {'currentPassword': 'test-only-password-123!', 'newPassword': 'new-test-password-456!'}, 'POST')
        self.assertEqual(changed['status'], 200)
        self.assertEqual(self.request('/admin/api/session')['status'], 200)
        self.cookie = old_cookie
        self.assertEqual(self.request('/admin/api/session')['status'], 401)
