const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const context = {};
vm.runInNewContext(source.slice(source.indexOf('function getExpeditedLogoHtml()'), source.indexOf('function getCarrierLogo(')), context);
for (const [name, file, width, height] of [
    ['getExpeditedLogoHtml', 'expedited-arrows.png', 21, 16]
]) {
    const html = context[name]();
    assert(html.includes('width="' + width + '" height="' + height + '"'));
    const image = Buffer.from(html.match(/base64,([^"]+)/)[1], 'base64');
    assert.equal(image.readUInt32BE(16), width);
    assert.equal(image.readUInt32BE(20), height);
    assert(image.equals(fs.readFileSync(path.join(root, 'logos', file))));
}
assert(!source.includes('priority1-partner-email.png'));
assert.equal(source.split('let p1Logo = `<img src="https://dashboard.priority1.com/Images/logo-transparent-mini.png"').length - 1, 3);
console.log('Original P1 headers restored; expedited arrows match 21 x 16 dimensions.');
