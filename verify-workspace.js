/* Run with: node verify-workspace.js (no dependencies). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
for (const id of ['inputData', 'analyzeBtn', 'quotesTable', 'tableHeadersRow', 'quoteSummaryContainer',
    'batchMode', 'batchShowTableView', 'exportCarrierCost', 'exportMargin', 'emailTheme',
    'copyBtn', 'previewEmailBtn', 'settingsModal', 'brandingModal', 'emailPreviewModal',
    'btn-en', 'btn-es', 'btn-light', 'btn-dark', 'devLockedView', 'hazmatSearch']) {
    assert(ids.includes(id), `Missing control: ${id}`);
}
assert(html.indexOf('src="./script.js"') < html.indexOf('src="./workspace-ui.js"'));
const controls = {};
const context = {
    console,
    document: { addEventListener() {}, getElementById: id => controls[id] || null },
    localStorage: { getItem: () => null, setItem() {} },
    QuoteParserCore: require('./parser-core'),
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'script.js'), 'utf8'), context);
vm.runInContext(`appQuotes = [{
    id: '10000001', label: 'Test quote', from: 'Dallas, Texas 75201 US', to: 'Atlanta, Georgia 30301 US',
    items: [{text: '1 Pallet(s) - 500lbs - 48" x 40" x 48" - Class: 85', isSub: false}],
    accessorials: ['Limited Access Delivery'], insurance: 25, hasInternalCols: true,
    processedRates: [
        {carrier:'XPO', normalizedName:'XPO', cost:210.15, carrierCost:180, margin:'14%', expiration:'12/31/2026', quoteNumber:'TEST100', liability:'500/100', service:'Standard', days:'3', rateType:'LTL', isAllowed:true, isSelected:true},
        {carrier:'Saia', normalizedName:'Saia', cost:299.90, carrierCost:250, margin:'17%', expiration:'12/31/2026', quoteNumber:'TEST101', liability:'500/100', service:'Standard', days:'2', rateType:'Volume', isAllowed:true, isSelected:true},
        {carrier:'ABF', normalizedName:'ABF', cost:400, quoteNumber:'TEST102', liability:'500/100', service:'Standard', days:'5', rateType:'LTL', isAllowed:true, isSelected:false}
    ]
}];`, context);
const themes = ['default', 'monochrome', 'vivid', 'feminine', 'navy', 'corporate', 'forest', 'earth', 'midnight', 'slate', 'custom'];
const cases = [];
for (const lang of ['en', 'es']) for (const theme of themes) for (const pdf of [false, true]) {
    for (const layout of ['single', 'batch', 'inline']) for (const internal of [false, true]) {
        cases.push({ lang, theme, pdf, layout, internal });
    }
}
function report(test) {
    const check = (id, checked) => { controls[id] = { checked }; };
    check('batchMode', test.layout !== 'single');
    check('exportCarrierCost', test.internal);
    check('exportMargin', test.internal);
    check('batchInlineLayout', test.layout === 'inline');
    check('batchCheapestOnly', false);
    check('batchSpreadsheetRates', true);
    controls.batchInlineRateCount = { value: '2' };
    controls.emailTheme = { value: test.theme };
    controls.insuranceInput = { value: '25' };
    for (const [id, value] of Object.entries({ cBg:'#ffffff', cHeader:'#eeeeee', cBorder:'#dddddd', cText:'#222222', cPrimary:'#245b4d', cAcc:'#245b4d' })) controls[id] = { value };
    vm.runInContext(`currentLang = '${test.lang}'`, context);
    return vm.runInContext(`getReportHTML(${test.pdf})`, context);
}
const baseline = cases.map(report);
vm.runInContext(fs.readFileSync(path.join(root, 'workspace-ui.js'), 'utf8'), context);
cases.forEach((test, index) => {
    const actual = report(test);
    assert.equal(actual, baseline[index], `Export changed: ${JSON.stringify(test)}`);
    assert(!actual.includes('TEST102'), 'An excluded rate leaked into the HTML export');
    if (test.layout !== 'inline') {
        const label = test.pdf ? (test.lang === 'en' ? 'Transit' : 'Tránsito')
            : (test.lang === 'en' ? 'Estimated Transit time' : 'Tiempo de tránsito estimado');
        assert(actual.includes(`>${label}</th>`), `Missing export label: ${label}`);
    }
});
console.log(`Workspace verification passed: ${ids.length} unique IDs and ${cases.length} unchanged email/PDF HTML outputs.`);
