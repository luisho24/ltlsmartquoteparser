const assert = require('node:assert/strict');
const core = require('../parser-core');

const ltl = [
    ['ABF Freight', '1,053.43', 'LTJKP63096', '6,250.00/500.00', 'Market Rate', 6],
    ['Frontline Freight', '1,183.51', '155845787', '10,000.00/500.00', 'Standard Rate', 9],
    ['WARP', '1,352.04', 'W01M6P1JQ55JYTHX73HQESN0WMF', '1,000.00/0.00', 'Standard Rate', 4],
    ['Roadrunner Transportation Systems', '1,517.63', '116379261', '50,000.00/500.00', 'Standard Rate', 3],
    ['AAA Cooper', '1,697.52', '0284238822', '50,000.00/500.00', 'Standard Rate', 4],
    ['TForce Freight', '1,766.10', '806009395', '50,000.00/5,000.00', 'Standard Rate', 5],
    ['Old Dominion Freight Line', '1,818.15', '1281074134', '25,000.00/500.00', 'Standard Rate', 3],
    ['Forward', '1,841.46', '', '35,000.00/2,500.00', 'Standard Rate', 3],
    ['Go2 Logistics', '1,889.81', '38053583', '25,000.00/500.00', 'Standard Rate', 5],
    ['CEVA Freight', '1,997.95', '130373333', '2,500.00/2,500.00', 'Standard Rate', 5],
    ['Central Transport', '2,172.57', '61735492', '35,000.00/500.00', 'Standard Rate', 5],
    ['Daylight Transport', '2,185.32', 'CQ291352621', '25,000.00/2,500.00', 'Standard Rate', 2],
    ['R&L Carriers', '2,281.30', '147970111', '100,000.00/500.00', 'Standard Service', 4],
    ['Saia LTL Freight', '2,311.66', '768293847', '25,000.00/500.00', 'Standard Rate', 3],
    ['XPO', '2,456.67', '10000474462482', '25,000.00/500.00', 'Standard Rate', 4],
    ['Estes', '2,635.52', 'L62JKZL', '25,000.00/500.00', 'LTL Standard Transit', 5],
    ['FedEx Economy', '2,816.94', '1680290393', '100,000.00/2,500.00', 'Economy', 6],
    ['FedEx Priority', '3,046.06', '1680290757', '100,000.00/2,500.00', 'Priority', 3]
];
const volume = [
    ['FedEx Economy', '621.00', 'F8094826CM06', '10,000.00/2,500.00', 'TLX', 8],
    ['FedEx Economy', '674.00', 'F8094826CM06', '10,000.00/2,500.00', 'TLS', 6],
    ['Estes', '1,042.00', 'V62JK34', '10,000.00/500.00', 'Volume and Truckload Basic', 5],
    ['Roadrunner Transportation Systems', '1,150.16', '116379289', '5,000.00/500.00', 'Standard Rate', 4],
    ['Go2 Logistics', '1,889.81', '38053584', '9,000.00/500.00', 'Standard Rate', 5],
    ['ABF Freight', '2,179.50', 'V289LK3096', '6,250.00/500.00', 'Market Rate', 4],
    ['Saia LTL Freight', '2,616.00', 'E768293890', '5,000.00/500.00', 'Standard Rate', 4],
    ['Old Dominion Freight Line', '2,821.93', '1281074144', '5,000.00/500.00', 'Standard Rate', 3],
    ['FedEx Economy', '9,735.00', 'F8094826CM06', '10,000.00/2,500.00', 'EXCL', 3]
];
const expedited = [['Priority1 - Expedited Truckload', '4,068.10', '1415780', '0.00/0.00', 'Truckload Expedited Team', 2]];
const row = values => [values[0], '$' + values[1], values[2], '$' + values[3].replace('/', '/$'), values[4], values[5]];
const section = (name, rows, markdown) => `${name}:\n` + (markdown
    ? '| Carrier⠀ | Customer Rate w/ S&H⠀ | Carrier Quote Number⠀ | New/Used Liability⠀ | Service⠀ | Transit Days⠀ |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n' + rows.map(values => '| ' + row(values).join('⠀ | ') + ' |').join('\n')
    : rows.map(values => row(values).join('⠀')).join('\n'));
function sample(markdown) {
    return '**Quote Id:&#xA0;**&#x34;9222594\nFrom: Fayetteville, Georgia 30215 US\nTo: Los Angeles, California 90001 US\nAccessorials:\nExcessive Length, 7ft\nItems:\n1 Pallet(s) - 5000lbs - 95" x 40" x 40" - Class: 125\n' +
        [['Expedited Truckload Rates', expedited], ['LTL Rates', ltl], ['Volume Rates', volume]].map(([name, rows]) => section(name, rows, markdown)).join('\n');
}
for (const markdown of [true, false]) {
    const [quote] = core.parseQuoteText(sample(markdown));
    assert.equal(quote.id, '49222594');
    assert.equal(quote.items.length, 1);
    assert.equal(quote.rawRates.length, 28);
    assert.equal(quote.rawRates.filter(rate => rate.rateType === 'Expedited').length, 1);
    assert.equal(quote.rawRates.filter(rate => rate.rateType === 'LTL').length, 18);
    assert.equal(quote.rawRates.filter(rate => rate.rateType === 'Volume').length, 9);
    assert.equal(quote.rawRates[0].carrier, expedited[0][0]);
    assert.equal(quote.rawRates[0].cost, 4068.10);
    assert.equal(quote.rawRates[0].service, 'Truckload Expedited Team');
    assert.equal(quote.rawRates[0].liability, '0.00/0.00');
    assert.equal(quote.rawRates[0].quoteNumber, '1415780');
    assert.equal(quote.rawRates.find(rate => rate.carrier === 'Forward').quoteNumber, '-');
    const [roundtrip] = core.parseQuoteText(core.buildParseableQuoteText([quote]));
    assert.deepEqual(roundtrip.rawRates.map(rate => [rate.carrier, rate.cost, rate.service, rate.rateType]),
        quote.rawRates.map(rate => [rate.carrier, rate.cost, rate.service, rate.rateType]));
    assert.equal(core.validateParsedQuotes([quote]).allowParserSafeExport, true);
}
module.exports = { sample };
const [onlyExpedited] = core.parseQuoteText('Quote Id: 123\n' + section('Expedited Truckload Rates', expedited, true));
assert.equal(onlyExpedited.rawRates[0].rateType, 'Expedited');
const [nativeExpedited] = core.parseQuoteText('Quote: 123\nExpedited Truckload Rates:\n$4,068.10\nPriority1 - Expedited Truckload | TEST\nTruckload Expedited Team\nTransit Days\n2\nQuote Id\n1415780\nLTL Rates:\n$100.00\nEstes | EXLA\nStandard\nTransit Days\n3');
assert.deepEqual(nativeExpedited.rawRates.map(rate => rate.rateType), ['Expedited', 'LTL']);
console.log('Expedited sample passed: 1 expedited, 18 LTL, 9 Volume; Markdown, CRM, and round-trip.');
