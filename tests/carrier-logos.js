const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const context = {};
vm.runInNewContext(source.slice(source.indexOf('function getCarrierLogo('), source.indexOf('\nconst rules =')), context);
const logo = context.getCarrierLogo;
assert.equal(logo('Priority1 - Expedited Truckload'), './logos/expedited-arrows.png');
for (const carrier of ['CEVA', 'CEVA Freight', 'CEVA Logistics', '  ceva   LOGISTICS ']) {
    assert.equal(logo(carrier), './logos/ceva-logistics.png');
}
const mapping = source.match(/const iconMap = \{([\s\S]*?)\n    \};/)[1];
for (const [, carrier] of mapping.matchAll(/'([^']+)':/g)) {
    const file = logo(carrier);
    assert(file, `Missing mapped logo for ${carrier}`);
    assert(fs.existsSync(path.join(root, file)), `Missing bundled asset for ${carrier}`);
}
assert.equal(logo('Oak Harbor Freight'), './logos/oak-harbor-freight.png');
assert.equal(logo('Numark Transportation'), './logos/numark-transportation.png');
assert.equal(logo('Unknown Carrier'), '');
assert.equal(logo(null), '');
const ceva = fs.readFileSync(path.join(root, logo('CEVA')));
assert.equal(ceva.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
console.log('Carrier logo aliases, bundled paths, fallback lookup, and CEVA PNG passed.');
