const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const context = {};
vm.runInNewContext(source.slice(source.indexOf('function normalizeCarrierName('), source.indexOf('function normalizePriority1Text(')), context);
for (const name of ['AACT', 'ABF', 'ABFS', 'CEVA', 'EXLA', 'FXNL', ' FXFE ', 'FWDN', 'XPOL', 'ODFL', 'RLCA', 'SLSN',
    'AAA Cooper', 'ABF Freight', 'CEVA Freight', 'CEVA Logistics', 'Estes', 'FedEx Economy', 'FedEx Priority',
    'Forward', 'XPO', 'Old Dominion Freight Line', 'R&L Carriers', 'Salson Logistics']) {
    assert.equal(context.isBestBuyCarrierAllowed(name), true, `${name} should be allowed`);
}
for (const name of ['ANCF', 'BEST YET', 'Best Yet Express', 'TOTL', 'Total Transportation Distribution',
    'Saia', 'Roadrunner', 'Go2 Logistics', 'FedEx', 'Unknown', '', null]) {
    assert.equal(context.isBestBuyCarrierAllowed(name), false, `${name} should be excluded`);
}
for (const file of ['index.html', 'classic.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal((html.match(/<option value="bestbuy">Best Buy<\/option>/g) || []).length, 1);
}
assert.match(source, /destType === 'bestbuy'[\s\S]*?!isBestBuyCarrierAllowed\(quote.carrier\)[\s\S]*?isAllowed = false/);
console.log('Best Buy destination: approved SCACs and names accepted; prohibited and unlisted carriers excluded.');
