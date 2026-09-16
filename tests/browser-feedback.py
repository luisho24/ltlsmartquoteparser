"""Integration tests: real browser + real local WSGI service; no mocked responses.
Run: python tests/browser-feedback.py (requires playwright + Chromium).
"""
import functools
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from socketserver import ThreadingMixIn
from wsgiref.simple_server import make_server, WSGIServer, WSGIRequestHandler
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'feedback-service'))
from app import Config, FeedbackApp

SAMPLE = '''Quote Id: 10000001
From: Dallas, Texas 75201 US
To: Atlanta, Georgia 30301 US
Accessorials:
Limited Access Delivery
Items:
1 Pallet(s) - 500lbs - 48" x 40" x 48" - Class: 85
LTL Rates:
Carrier\tCustomer Rate\tCarrier Quote Number\tNew/Used Liability\tService\tTransit Days
XPO\t$210.15\tTEST100\t$500/$100\tStandard Rate\t3
Saia\t$299.90\tTEST101\t$500/$100\tStandard Rate\t2
ABF Freight\t$400.00\tTEST102\t$500/$100\tStandard Rate\t5
'''

class Static(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
class QuietWSGI(WSGIRequestHandler):
    def log_message(self, *_): pass
class ThreadedWSGI(ThreadingMixIn, WSGIServer):
    daemon_threads = True

checks = []
def check(value, label):
    assert value, label
    checks.append(label)

with tempfile.TemporaryDirectory() as tmp:
    static = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Static, directory=ROOT))
    base = f'http://127.0.0.1:{static.server_port}'
    service = FeedbackApp(Config(str(Path(tmp) / 'feedback.sqlite3'), secrets.token_hex(32), (base,)))
    api = make_server('127.0.0.1', 0, service, server_class=ThreadedWSGI, handler_class=QuietWSGI)
    api_url = f'http://127.0.0.1:{api.server_port}'
    for server in (static, api): threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 1440, 'height': 1100}, permissions=['clipboard-read', 'clipboard-write'])
            context.route('https://**/*', lambda route: route.abort())
            context.route('**/feedback-config.js', lambda route: route.fulfill(content_type='application/javascript', body=f'window.LTL_FEEDBACK_CONFIG={{endpoint:{json.dumps(api_url)}}};'))
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base + '/index.html')
            page.wait_for_selector('#interfaceInvite[open]')
            check('/classic.html' in page.url, 'New visitors start in classic')
            page.locator('[data-choice="later"]').click()
            page.reload(); page.wait_for_timeout(550)
            check(page.locator('#interfaceInvite[open]').count() == 0, 'Later snoozes the invitation')
            page.evaluate("localStorage.removeItem('ltl-interface-invite-after-v1')")
            page.reload(); page.wait_for_selector('#interfaceInvite[open]')
            page.keyboard.press('Escape'); page.reload(); page.wait_for_timeout(550)
            check(page.locator('#interfaceInvite[open]').count() == 0, 'Escape dismisses without forcing migration')
            page.evaluate("localStorage.removeItem('ltl-interface-invite-after-v1')")
            page.reload(); page.wait_for_selector('#interfaceInvite[open]')
            page.locator('[data-choice="keep"]').click()
            check(page.evaluate("localStorage.getItem('ltl-interface-v1')") == 'classic', 'Keep classic remembers the choice')
            page.locator('#inputData').fill(SAMPLE)
            page.locator('#analyzeBtn').click()
            check(page.evaluate('appQuotes[0].processedRates.length') == 3, 'Classic parses all sample rates')
            page.evaluate("toggleCarrierSelection({checked:false, closest:()=>document.querySelector('#quotesTable tbody tr:last-child')},0,appQuotes[0].rawRates[2].id)")
            page.locator('#sortFilter').select_option('fastest')
            page.locator('#interfaceSwitch').click()
            page.wait_for_url('**/index.html?ui=workspace'); page.wait_for_selector('#interfaceSwitch')
            check(page.evaluate("appQuotes[0].id") == '10000001', 'Quote survives classic to workspace switch')
            check(page.locator('#inputData').input_value() == SAMPLE, 'Pasted source survives switch')
            check(page.locator('#sortFilter').input_value() == 'fastest', 'Sort preference survives switch')
            check(page.evaluate('appQuotes[0].processedRates.filter(r=>r.isSelected!==false).length') == 2, 'Carrier selection survives switch')
            check(page.evaluate("getReportHTML(false).includes('Estimated Transit time')"), 'Email retains estimated transit label')
            check('TEST102' not in page.evaluate('getReportHTML(false)'), 'Deselected carrier stays out of exported email')
            # Test feedback through the actual button and actual API in workspace.
            page.locator('.feedback-button').click()
            page.wait_for_selector('#ltlFeedback[open]')
            check(not page.locator('[name="includeQuote"]').is_checked(), 'Quote-ID inclusion defaults to off')
            page.locator('[name="title"]').fill('Workspace test feedback')
            page.locator('[name="message"]').fill('Testing the shared feedback flow from the redesigned interface.')
            page.locator('#ltlFeedbackForm [type="submit"]').click()
            page.wait_for_selector('.ltl-feedback-status[data-success="true"]')
            receipt = page.locator('.ltl-feedback-status').inner_text()
            check('FB-' in receipt, 'Workspace receives a real stored receipt')
            with service.connect() as db:
                payload = json.loads(db.execute('SELECT payload FROM feedback').fetchone()[0])
                check(payload['interface'] == 'workspace' and payload['quoteId'] == '', 'Stored payload excludes quote data by default')
                check('Dallas' not in json.dumps(payload) and '210.15' not in json.dumps(payload), 'No automatic addresses, prices, or raw input sent')
            page.locator('.ltl-close').click()
            page.locator('#interfaceSwitch').click()
            page.wait_for_url('**/classic.html?ui=classic'); page.wait_for_selector('#interfaceSwitch')
            check(page.evaluate('appQuotes[0].processedRates.length') == 3, 'Quote survives return to classic')
            page.evaluate('openBugReport()')
            page.locator('[name="title"]').fill('Classic test feedback')
            page.locator('[name="message"]').fill('Testing the same shared feedback flow from the classic interface.')
            page.locator('[name="includeQuote"]').check()
            page.locator('#ltlFeedbackForm [type="submit"]').click()
            page.wait_for_selector('.ltl-feedback-status[data-success="true"]')
            with service.connect() as db:
                rows = [json.loads(r[0]) for r in db.execute('SELECT payload FROM feedback ORDER BY created')]
                check(len(rows) == 2 and rows[1]['interface'] == 'classic', 'Both interfaces write into the same inbox')
                check(rows[1]['quoteId'] == '10000001', 'Quote ID is included only after explicit opt-in')
            page.locator('.ltl-close').click()
            page.evaluate("setLang('es')")
            page.evaluate('openBugReport()')
            check(page.locator('#ltlFeedbackTitle').inner_text() == 'Ayúdanos a mejorar Smart LTL', 'Feedback supports Spanish')
            page.keyboard.press('Escape')
            page.evaluate("setLang('en')")
            # Test automatic parse/copy still runs on paste.
            page.locator('#inputData').fill(SAMPLE.replace('10000001', '10000002'))
            page.locator('#autoCopyPaste').check()
            page.evaluate("document.getElementById('inputData').dispatchEvent(new ClipboardEvent('paste',{bubbles:true}))")
            page.wait_for_function("appQuotes[0]?.id === '10000002'")
            check(True, 'Automatic parsing still runs on paste')
            # Actual outage: stop API, verify retained fields and honest error.
            page.evaluate('openBugReport()')
            page.locator('[name="title"]').fill('Report while offline')
            page.locator('[name="message"]').fill('This draft must survive a failed network request.')
            api.shutdown(); api.server_close()
            page.locator('#ltlFeedbackForm [type="submit"]').click()
            page.wait_for_function("document.querySelector('.ltl-feedback-status').textContent.includes('could not confirm')")
            check(page.locator('[name="title"]').input_value() == 'Report while offline', 'Failed delivery keeps the draft')
            check(page.locator('.ltl-feedback-status[data-success="true"]').count() == 0, 'No false success on network failure')
            page.keyboard.press('Escape')
            # Mobile and keyboard dialog behavior.
            for mode in ('classic', 'workspace'):
                page.goto(base + ('/classic.html?ui=classic' if mode == 'classic' else '/index.html?ui=workspace'))
                page.wait_for_selector('#interfaceSwitch'); page.set_viewport_size({'width': 390, 'height': 844})
                page.evaluate('openBugReport()')
                box = page.locator('#ltlFeedback').bounding_box()
                check(box['x'] >= 0 and box['x'] + box['width'] <= 390, f'{mode}: feedback fits mobile viewport')
                page.keyboard.press('Escape')
                check(not page.locator('#ltlFeedback').evaluate('(el)=>el.open'), f'{mode}: feedback closes with Escape')
            # Unconfigured deployment is explicitly disabled, not a fake successful form.
            page.evaluate("window.LTL_FEEDBACK_CONFIG = {endpoint:''}; openBugReport()")
            check(page.locator('#ltlFeedbackForm [type="submit"]').is_disabled(), 'Unconfigured production endpoint disables submission')
            check('not connected' in page.locator('.ltl-feedback-status').inner_text(), 'Unconfigured service displays an honest explanation')
            check(not errors, 'No uncaught browser JavaScript errors: ' + str(errors))
            browser.close()
    finally:
        static.shutdown(); static.server_close()
        api.server_close()

print(json.dumps({'passed': len(checks), 'checks': checks}, indent=2))
