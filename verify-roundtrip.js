const assert = require('assert');
const core = require('./parser-core');

assert.equal(core.parseLocaleNumber('$1,234.56'), 1234.56);
assert.equal(core.parseLocaleNumber('$1.234,56'), 1234.56);
assert.equal(core.parseLocaleNumber('1234,56'), 1234.56);
assert.equal(core.parseLocaleNumber('1 234,56'), 1234.56);

const sampleQuotes = [
  {
    label: 'Priority 1 Quote',
    id: '38927499',
    from: 'Los Angeles, California 90001 US',
    to: 'Miami, Florida 33101 US',
    items: [
      { text: '1 Pallet(s) - 1500lbs - 48" x 40" x 60" - Class: 70', isSub: false }
    ],
    accessorials: ['Lift Gate Delivery', 'Residential Delivery'],
    hasInternalCols: true,
    processedRates: [
      { carrier: 'FedEx Priority', cost: 580.45, carrierCost: 450, margin: '22%', expiration: '12/31/2026', quoteNumber: 'FX192384', liability: '1000/200', service: 'Priority', days: '2', rateType: 'LTL' },
      { carrier: 'Saia', cost: 410.15, carrierCost: 310, margin: '24%', expiration: '12/31/2026', quoteNumber: 'SA99231', liability: '500/100', service: 'Standard Rate', days: '4', rateType: 'Volume' }
    ]
  },
  {
    label: 'Quote #2',
    id: '50000222',
    from: 'Dallas, Texas 75201 US',
    to: 'Atlanta, Georgia 30301 US',
    items: [
      { text: '2 Pallet(s) - 900lbs - 48" x 40" x 48" - Class: 85', isSub: false }
    ],
    accessorials: [],
    processedRates: [
      { carrier: 'ABF', cost: 299.99, quoteNumber: 'AB123456', liability: '500/100', service: 'Standard', days: '3', rateType: 'LTL' }
    ]
  }
];

const exported = core.buildParseableQuoteText(sampleQuotes);
const reparsed = core.parseQuoteText(exported);

assert.equal(reparsed.length, 2);
assert.equal(reparsed[0].id, '38927499');
assert.equal(reparsed[0].from, 'Los Angeles, California 90001 US');
assert.equal(reparsed[0].to, 'Miami, Florida 33101 US');
assert.equal(reparsed[0].items.length, 1);
assert.equal(reparsed[0].accessorials.length, 2);
assert.equal(reparsed[0].rawRates.length, 2);
assert.equal(reparsed[0].rawRates[0].carrier, 'FedEx Priority');
assert.equal(reparsed[0].rawRates[0].carrierCost, 450);
assert.equal(reparsed[0].rawRates[1].rateType, 'Volume');
assert.equal(reparsed[1].id, '50000222');
assert.equal(reparsed[1].rawRates.length, 1);
assert.equal(reparsed[1].rawRates[0].quoteNumber, 'AB123456');

const validation = core.validateParsedQuotes(reparsed);
assert.equal(validation.allowParserSafeExport, true);

const malformedValidation = core.validateParsedQuotes([{ rawRates: [{ carrier: '12345', cost: 999999 }] }]);
assert.equal(malformedValidation.allowParserSafeExport, false);
assert.equal(malformedValidation.blockParsing, true);

console.log('Round-trip parser verification passed.');
