const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'feedback-service/default-config.json')));
let config = structuredClone(defaults), deviceBlocked = false;
const stored = new Map(), requests = [], controls = {};
function select() {
    const el = { options: [], value: 'bestbuy', append(option) { this.options.push(option); option.remove = () => this.options.splice(this.options.indexOf(option), 1); } };
    el.append({ value: 'standard' }); el.append({ value: 'bestbuy' }); return el;
}
controls.destFilter = select();
for (const id of ['copyBtn', 'previewEmailBtn', 'btn-tab-extras', 'insuranceInput', 'batchMode']) controls[id] = { disabled: false, title: '', type: id === 'batchMode' ? 'checkbox' : 'text', checked: true, value: '25', removeAttribute(key) { delete this[key]; } };
const context = {
    crypto: webcrypto, AbortSignal, Event, URL,
    localStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
    document: { readyState: 'loading', hidden: false, addEventListener() {}, dispatchEvent() {}, getElementById: id => controls[id] || null, createElement: () => ({}) },
    setInterval() {}, renderTable() {}, rules: structuredClone(defaults.rules),
    LTL_FEEDBACK_CONFIG: { endpoint: 'https://feedback.test' },
    fetch: async (url, options = {}) => {
        requests.push({ url, options });
        if (url.endsWith('/v1/config')) return { ok: true, json: async () => structuredClone(config) };
        return { ok: !deviceBlocked, status: deviceBlocked ? 403 : 200, json: async () => ({ deviceId: 'DEV-TEST', enabled: true }) };
    }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'admin-client.js'), 'utf8'), context);
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
vm.runInContext(source.slice(source.indexOf('function normalizeCarrierName('), source.indexOf('function normalizePriority1Text(')), context);
vm.runInContext(source.slice(source.indexOf('function getExportRatesForQuote('), source.indexOf('function buildBatchInlineTable(')), context);
(async () => {
    await context.LTLRemote.refresh();
    const id = context.LTLDevice.id(); assert.match(id, /^[a-f0-9]{32}$/);
    assert.equal(stored.get('ltl-feedback-client-v1'), id);
    assert.equal(context.LTLDevice.displayId(), 'DEV-TEST');
    assert.equal(context.LTLRemote.assess({ carrier: 'ABFS', rateType: 'LTL' }, 'bestbuy').allowed, true);
    assert.equal(context.LTLRemote.assess({ carrier: 'R&L Carriers', rateType: 'LTL' }, 'bestbuy').allowed, false);
    assert.equal(context.normalizeCarrierName('FXNL'), 'FedEx Economy');
    config.revision++; config.features.volumeRates = false; config.features.exportEmail = false; config.features.batchMode = false;
    const abf = config.carriers.find(c => c.name === 'ABF'); abf.name = 'ABF Freight Updated'; abf.aliases.push('ABF', 'ABF Freight'); abf.logoUrl = 'https://example.test/new-logo.png';
    config.filters.push({ id: 'custom-dc', label: 'Custom DC', allowed: ['ABF'], blocked: [], notes: { 'ABF Freight Updated': 'Call first' }, enabled: true });
    await context.LTLRemote.refresh();
    assert.equal(context.LTLDevice.id(), id);
    assert.equal(context.LTLRemote.feature('exportEmail'), false);
    assert.equal(controls.copyBtn.disabled, true); assert.equal(controls.batchMode.checked, false);
    assert.equal(context.LTLRemote.assess({ carrier: 'FedEx Economy', rateType: 'Volume' }, 'standard').allowed, false);
    assert.equal(context.normalizeCarrierName('ABFS'), 'ABF Freight Updated');
    assert.equal(context.LTLRemote.carrier('ABF').logoUrl, 'https://example.test/new-logo.png');
    assert(controls.destFilter.options.some(option => option.value === 'custom-dc'));
    assert.equal(context.LTLRemote.assess({ carrier: 'ABFS', rateType: 'LTL' }, 'custom-dc').note, 'Call first');
    config.revision++; abf.enabled = false; await context.LTLRemote.refresh();
    assert.equal(context.LTLRemote.assess({ carrier: 'ABFS', rateType: 'LTL' }, 'standard').allowed, false);
    const rates = context.getExportRatesForQuote({ destType: 'standard', processedRates: [{ carrier: 'ABF', isAllowed: true, isSelected: true, rateType: 'LTL' }] }, {});
    assert.equal(rates.length, 0, 'Disabled carrier cannot leak into export after a configuration change');
    deviceBlocked = true; await context.LTLRemote.refresh();
    assert.equal(context.LTLRemote.feature('feedback'), false);
    assert.equal(context.LTLRemote.assess({ carrier: 'XPO', rateType: 'LTL' }, 'standard').allowed, false);
    deviceBlocked = false; await context.LTLRemote.refresh(); assert.equal(context.LTLRemote.disabledDevice, false);
    for (const request of requests.filter(r => r.url.endsWith('/v1/device'))) assert.deepEqual(Object.keys(JSON.parse(request.options.body)), ['clientId']);
    for (const file of ['index.html', 'classic.html']) assert(fs.readFileSync(path.join(root, file), 'utf8').includes('src="./admin-client.js"'));
    console.log('Admin client integration passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
