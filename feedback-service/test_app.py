import io
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from app import Config, FeedbackApp

ORIGIN = 'https://luisho24.github.io'
CLIENT = 'a' * 32


class FeedbackTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.now = 1000000.0
        self.config = Config(str(Path(self.tmp.name) / 'data' / 'feedback.sqlite3'), 's' * 64, (ORIGIN,))
        self.app = FeedbackApp(self.config, lambda: self.now)

    def request(self, path, data=None, method='POST', origin=ORIGIN, ip='198.51.100.20', extra=None, app=None):
        raw = json.dumps(data).encode()
        env = {'PATH_INFO': path, 'REQUEST_METHOD': method, 'HTTP_ORIGIN': origin,
               'REMOTE_ADDR': ip, 'CONTENT_TYPE': 'application/json',
               'CONTENT_LENGTH': str(len(raw)), 'wsgi.input': io.BytesIO(raw)}
        env.update(extra or {})
        result = {}
        def start(status, headers):
            result['status'] = int(status.split()[0]); result['headers'] = dict(headers)
        body = b''.join((app or self.app)(env, start))
        result['body'] = json.loads(body) if body else None
        return result

    def token(self, client=CLIENT, ip='198.51.100.20'):
        result = self.request('/v1/challenge', {'clientId': client}, ip=ip)
        self.assertEqual(result['status'], 200, result)
        self.now += 3
        return result['body']['token']

    def payload(self, token=None, **changes):
        data = dict(clientId=CLIENT, token=token or self.token(), website='', category='bug',
                    title='Test report', message='A reproduction of the display problem.', steps='', email='',
                    interface='classic', language='en', quoteId='')
        data.update(changes)
        return data

    def count(self):
        with closing(sqlite3.connect(self.config.database)) as db:
            return db.execute('SELECT count(*) FROM feedback').fetchone()[0]

    def test_success_and_private_storage(self):
        result = self.request('/v1/feedback', self.payload())
        self.assertEqual(result['status'], 201)
        self.assertRegex(result['body']['id'], r'^FB-[A-F0-9]{16}$')
        with closing(sqlite3.connect(self.config.database)) as db:
            payload = json.loads(db.execute('SELECT payload FROM feedback').fetchone()[0])
            self.assertNotIn('token', payload); self.assertNotIn('clientId', payload)
            self.assertEqual(payload['quoteId'], '')
        self.assertEqual(Path(self.config.database).stat().st_mode & 0o777, 0o600)

    def test_both_interfaces(self):
        for mode in ('classic', 'workspace'):
            self.assertEqual(self.request('/v1/feedback', self.payload(interface=mode))['status'], 201)

    def test_retries_are_idempotent(self):
        payload = self.payload()
        first = self.request('/v1/feedback', payload)
        second = self.request('/v1/feedback', payload)
        self.assertEqual(second['body']['id'], first['body']['id'])
        self.assertTrue(second['body']['duplicate']); self.assertEqual(self.count(), 1)

    def test_duplicate_with_fresh_token(self):
        self.request('/v1/feedback', self.payload())
        result = self.request('/v1/feedback', self.payload())
        self.assertEqual(result['status'], 200); self.assertEqual(self.count(), 1)

    def test_replay_with_changed_message_rejected(self):
        payload = self.payload(); self.request('/v1/feedback', payload)
        payload['message'] = 'A different reproduction attempt.'
        self.assertEqual(self.request('/v1/feedback', payload)['status'], 409)

    def test_hourly_limits_survive_restart(self):
        for i in range(5):
            self.assertEqual(self.request('/v1/feedback', self.payload(title=f'Report {i}'))['status'], 201)
        self.app = FeedbackApp(self.config, lambda: self.now)
        result = self.request('/v1/feedback', self.payload(title='Sixth report'))
        self.assertEqual(result['status'], 429); self.assertIn('Retry-After', result['headers'])
        self.now += 3601
        self.assertEqual(self.request('/v1/feedback', self.payload(title='After the hour'))['status'], 201)

    def test_daily_limit(self):
        for period in range(3):
            for i in range(5):
                self.assertEqual(self.request('/v1/feedback', self.payload(title=f'Report {period}-{i}'))['status'], 201)
            self.now += 3601
        self.assertEqual(self.request('/v1/feedback', self.payload(title='Daily overflow'))['status'], 429)

    def test_network_limit_survives_client_reset(self):
        self.app = FeedbackApp(replace(self.config, network_hour=2), lambda: self.now)
        for client in ('b' * 32, 'c' * 32):
            data = self.payload(self.token(client), clientId=client)
            self.assertEqual(self.request('/v1/feedback', data)['status'], 201)
        data = self.payload(self.token('d' * 32), clientId='d' * 32)
        self.assertEqual(self.request('/v1/feedback', data)['status'], 429)

    def test_global_cap(self):
        self.app = FeedbackApp(replace(self.config, global_day=1), lambda: self.now)
        self.request('/v1/feedback', self.payload())
        ip = '203.0.113.5'
        data = self.payload(self.token('b' * 32, ip), clientId='b' * 32)
        self.assertEqual(self.request('/v1/feedback', data, ip=ip)['status'], 429)

    def test_spoofed_forwarded_header_is_ignored(self):
        data = self.payload()
        result = self.request('/v1/feedback', data, extra={'HTTP_X_FORWARDED_FOR': '1.2.3.4'})
        self.assertEqual(result['status'], 201)

    def test_only_explicit_proxy_is_trusted(self):
        self.app = FeedbackApp(replace(self.config, trusted_proxies=('127.0.0.1/32',)), lambda: self.now)
        headers = {'HTTP_X_FORWARDED_FOR': '198.51.100.20'}
        token = self.request('/v1/challenge', {'clientId': CLIENT}, ip='127.0.0.1', extra=headers)['body']['token']
        self.now += 3
        self.assertEqual(self.request('/v1/feedback', self.payload(token), ip='127.0.0.1', extra=headers)['status'], 201)

    def test_token_bound_to_network_client_and_origin(self):
        data = self.payload()
        self.assertEqual(self.request('/v1/feedback', data, ip='198.51.100.21')['status'], 400)
        data['clientId'] = 'b' * 32
        self.assertEqual(self.request('/v1/feedback', data)['status'], 400)

    def test_ipv6_prefix_grouping(self):
        token = self.token(ip='2001:db8:1:2::1')
        self.assertEqual(self.request('/v1/feedback', self.payload(token), ip='2001:db8:1:2::9')['status'], 201)

    def test_minimum_delay_and_expiry(self):
        token = self.request('/v1/challenge', {'clientId': CLIENT})['body']['token']
        self.assertEqual(self.request('/v1/feedback', self.payload(token))['status'], 429)
        self.now += 601
        self.assertEqual(self.request('/v1/feedback', self.payload(token))['status'], 400)

    def test_forged_token(self):
        data = self.payload(); data['token'] += 'x'
        self.assertEqual(self.request('/v1/feedback', data)['status'], 400)

    def test_honeypot(self):
        self.assertEqual(self.request('/v1/feedback', self.payload(website='bot.example'))['status'], 400)
        self.assertEqual(self.count(), 0)

    def test_origin_allowlist_and_no_public_inbox(self):
        for origin in ('null', '', 'https://evil.example'):
            result = self.request('/v1/challenge', {'clientId': CLIENT}, origin=origin)
            self.assertEqual(result['status'], 403)
            self.assertNotIn('Access-Control-Allow-Origin', result['headers'])
        self.assertEqual(self.request('/v1/feedback', method='GET')['status'], 405)
        self.assertEqual(self.request('/admin', method='GET')['status'], 404)

    def test_preflight(self):
        result = self.request('/v1/feedback', method='OPTIONS', extra={'HTTP_ACCESS_CONTROL_REQUEST_METHOD': 'POST', 'HTTP_ACCESS_CONTROL_REQUEST_HEADERS': 'content-type'})
        self.assertEqual(result['status'], 204)
        self.assertEqual(result['headers']['Access-Control-Allow-Origin'], ORIGIN)

    def test_body_and_field_validation(self):
        self.assertEqual(self.request('/v1/feedback', self.payload(), extra={'CONTENT_LENGTH': '99999'})['status'], 413)
        self.assertEqual(self.request('/v1/feedback', self.payload(), extra={'CONTENT_TYPE': 'text/plain'})['status'], 415)
        self.assertEqual(self.request('/v1/feedback', self.payload(), extra={'CONTENT_LENGTH': ''})['status'], 411)
        for changes in ({'message': 'short'}, {'email': 'invalid'}, {'title': 8}, {'quoteId': '<script>'}, {'rawQuote': 'private'}):
            self.assertEqual(self.request('/v1/feedback', self.payload(**changes))['status'], 400)
        self.assertEqual(self.count(), 0)

    def test_invalid_requests_have_a_separate_budget(self):
        self.app = FeedbackApp(replace(self.config, request_minute=2), lambda: self.now)
        for _ in range(2): self.request('/v1/challenge', {})
        self.assertEqual(self.request('/v1/challenge', {})['status'], 429)

    def test_retention_and_capacity(self):
        self.app = FeedbackApp(replace(self.config, max_records=1), lambda: self.now)
        self.request('/v1/feedback', self.payload())
        self.assertEqual(self.request('/v1/feedback', self.payload(title='Second report'))['status'], 503)
        self.now += 91 * 86400
        self.assertEqual(self.request('/v1/feedback', self.payload(title='New report'))['status'], 201)
        self.assertEqual(self.count(), 1)

    def test_concurrent_retries_store_only_once(self):
        data = self.payload()
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.request('/v1/feedback', data), range(8)))
        self.assertTrue(all(r['status'] in (200, 201) for r in results), results)
        self.assertEqual(self.count(), 1)

    def test_secret_and_origin_configuration_fail_closed(self):
        for config in (replace(self.config, secret=''), replace(self.config, origins=()), replace(self.config, origins=('http://public.example',))):
            with self.assertRaises(ValueError): FeedbackApp(config)


if __name__ == '__main__':
    unittest.main(verbosity=2)
