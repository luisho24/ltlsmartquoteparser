const assert = require('node:assert/strict');
const core = require('../parser-core');

const card = (price, carrier, service, fields = '') => `$${price}\n${carrier} | TEST\n${service}\n${fields}`;
const grid = (carrier, price, cost, days = 3) => `${carrier}\n${days}\n$${price}\n$${cost}\nNew:\n$5,000.00\nUsed:\n$500.00\n12/31/2026\n20%`;
const header = `Quote: 123456\nCustomer: Example\nFrom:\nDallas, TX 75201\n10/15/2026\nTo:\nMiami, FL 33101\nItems:\nWidgets\nPiece:\n2\nWeight:\n1,200 lbs\nDimensions:\n48 x 40 x 60 in\nGadgets\nPiece:\n1\nWeight:\n500 lbs\nDimensions:\n96 x 40 x 48 in\nTotal weight: 1700 lbs\nAccessorials:\nLiftgate Delivery accepted\nLTL Rates:\n`;
const native = header + card('300.00', 'Estes', 'Standard', 'Transit Days\n3\nCarrier Liability New\n$5,000.00\nCarrier Liability Used\n$500.00\nQuote Id\nEST12345\nQuote Exp. Date\n12/31/2026\n') +
    card('300.00', 'XPO', 'Standard Interline', 'Transit Days\n5\nQuote Id\nXPO12345\n') +
    'LTL Rates:\nCarrier Service Level\nTransit Customer Cost Carrier Cost Liability Expiration Margin\n' +
    grid('Estes Standard', '300.00', '240.00') + '\n' + grid('XPO Standard Interline', '300.00', '225.00', 5) +
    '\nVolume Rates:\n' + grid('Estes StandardVolume', '250.00', '200.00', 4);

const [quote] = core.parseQuoteText(native);
assert.equal(quote.id, '123456');
assert.equal(quote.from, 'Dallas, TX 75201');
assert.equal(quote.to, 'Miami, FL 33101');
assert.equal(quote.items.length, 2);
assert.equal(quote.maxDims.weight, 1200);
assert.equal(quote.maxDims.length, 96);
assert.deepEqual(quote.accessorials, ['Lift Gate Delivery']);
assert.equal(quote.rawRates.length, 3);
const [estes, xpo, volume] = quote.rawRates;
assert.equal(estes.carrier, 'Estes');
assert.equal(estes.carrierCost, 240);
assert.equal(estes.quoteNumber, 'EST12345');
assert.equal(xpo.carrierCost, 225, 'equal customer prices must not mix internal costs');
assert.equal(xpo.quoteNumber, 'XPO12345');
assert.match(xpo.service, /Interline/);
assert.equal(volume.rateType, 'Volume');
assert.equal(volume.cost, 250);
assert.equal(volume.service, 'Standard');
assert.equal(core.validateParsedQuotes([quote]).allowParserSafeExport, true);

const [isolated] = core.parseQuoteText('Quote: 22\nLTL Rates:\n' +
    card('100.00', 'Estes', 'Standard') + card('200.00', 'XPO', 'Standard Interline', 'Transit Days\n7\nQuote Id\nXPO99999\n'));
assert.equal(isolated.rawRates[0].days, 'N/A');
assert.equal(isolated.rawRates[0].quoteNumber, '-');
assert.doesNotMatch(isolated.rawRates[0].service, /Interline/);
assert.equal(isolated.rawRates[1].days, '7');
assert.equal(core.parseQuoteText(native + '\n' + native.replace('Quote: 123456', 'Quote: 999999')).length, 2);

const [braille] = core.parseQuoteText('Quote Id: 88\nLTL Rates:\nEstes⠀$300.00⠀EST12345⠀$5000.00/$500.00⠀Standard Interline⠀3');
assert.equal(braille.rawRates[0].cost, 300);
assert.match(braille.rawRates[0].service, /Interline/);
const [joinedRef] = core.parseQuoteText('Quote Id: 89\nLTL Rates:\nEstes⠀$300.00EST12345⠀$5000.00/$500.00⠀Standard Interline⠀3');
assert.equal(joinedRef.rawRates[0].cost, 300);
assert.equal(joinedRef.rawRates[0].quoteNumber, 'EST12345');
const [roundtrip] = core.parseQuoteText(core.buildParseableQuoteText([quote]));
assert.equal(roundtrip.rawRates.length, 3);
assert.equal(roundtrip.rawRates[1].carrierCost, 225);
const [samePrice] = core.parseQuoteText('Quote: 44\nLTL Rates:\n' + grid('Estes Standard', '300.00', '240.00') +
    '\nVolume Rates:\n' + grid('Estes Standard', '300.00', '210.00'));
assert.deepEqual(samePrice.rawRates.map(rate => rate.rateType), ['LTL', 'Volume']);
assert.deepEqual(samePrice.rawRates.map(rate => rate.carrierCost), [240, 210]);
const [compact] = core.parseQuoteText('Quote: 55\nLTL Rates:\n' + grid('Estes Standard', '300.00', '240.00', 12).replace(/\n/g, ''));
assert.equal(compact.rawRates[0].carrier, 'Estes');
assert.equal(compact.rawRates[0].days, '12');
const [optionalPrice] = core.parseQuoteText('Quote: 66\nLTL Rates:\n' + grid('Estes Standard', '300.00', '240.00').replace('$300.00', '$300.00\n$280.00'));
assert.equal(optionalPrice.rawRates[0].cost, 300);
assert.equal(optionalPrice.rawRates[0].carrierCost, 240);
console.log('Native Priority1 parsing checks passed.');
