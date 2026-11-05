(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.QuoteParserCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const MONEY_TOKEN_REGEX = /^[$€£]?\s*[0-9][0-9\s.,']*$/;
    const MAX_REASONABLE_RATE = 100000;

    function normalizePriority1Text(value) {
        return String(value || '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/\s*(div|p|tr|table|thead|tbody|ul|ol|li|h\d)\s*>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[\u2800\u00a0]/g, ' ')
            .replace(/[\u2000-\u200f\u2028\u2029\u202f\u205f\u2060]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function parseLocaleNumber(value) {
        if (value === null || value === undefined) return null;
        let raw = String(value).trim();
        if (!raw) return null;

        raw = raw
            .replace(/&nbsp;/gi, ' ')
            .replace(/[$€£]/g, '')
            .replace(/\s+/g, '')
            .replace(/'/g, '');

        if (!raw || !/[0-9]/.test(raw)) return null;

        const commaCount = (raw.match(/,/g) || []).length;
        const dotCount = (raw.match(/\./g) || []).length;
        const lastComma = raw.lastIndexOf(',');
        const lastDot = raw.lastIndexOf('.');

        if (commaCount > 0 && dotCount > 0) {
            const decimalSep = lastComma > lastDot ? ',' : '.';
            const thousandSep = decimalSep === ',' ? /\./g : /,/g;
            raw = raw.replace(thousandSep, '');
            if (decimalSep === ',') raw = raw.replace(/,/g, '.');
        } else if (commaCount > 0) {
            const parts = raw.split(',');
            const lastPart = parts[parts.length - 1] || '';
            const useDecimal = parts.length === 2
                ? lastPart.length > 0 && lastPart.length <= 2
                : (lastPart.length > 0 && lastPart.length <= 2 && parts.slice(0, -1).every(part => part.length === 3 || part.length <= 3));
            raw = useDecimal ? `${parts.slice(0, -1).join('')}.${lastPart}` : parts.join('');
        } else if (dotCount > 0) {
            const parts = raw.split('.');
            const lastPart = parts[parts.length - 1] || '';
            const useDecimal = parts.length === 2
                ? lastPart.length > 0 && lastPart.length <= 2
                : (lastPart.length > 0 && lastPart.length <= 2 && parts.slice(0, -1).every(part => part.length === 3 || part.length <= 3));
            raw = useDecimal ? `${parts.slice(0, -1).join('')}.${lastPart}` : parts.join('');
        }

        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function parsePercentValue(value) {
        const parsed = parseLocaleNumber(String(value || '').replace(/%/g, ''));
        return parsed === null ? '-' : `${parsed}%`;
    }

    function isMoneyLikeToken(value) {
        return MONEY_TOKEN_REGEX.test(normalizePriority1Text(value));
    }

    function getMoneyTokensFromLine(line) {
        return [...String(line || '').matchAll(/[$€£]\s*[0-9][0-9\s.,']*/g)]
            .map(match => match[0].trim())
            .filter(Boolean);
    }

    function isCarrierMalformed(name) {
        const normalized = normalizePriority1Text(name);
        if (!normalized) return true;
        const lower = normalized.toLowerCase();
        if (lower === 'unknown') return true;
        if (/[$€£]/.test(normalized)) return true;
        if (/^\d+$/.test(normalized)) return true;
        if (/^(quote|from|to|ltl rates|volume rates|customer cost|carrier cost|margin|transit)/i.test(normalized)) return true;
        const alphaCount = (normalized.match(/[a-z]/gi) || []).length;
        const digitCount = (normalized.match(/\d/g) || []).length;
        return alphaCount < 2 || digitCount > alphaCount;
    }

    function isRateSuspicious(rate) {
        if (!rate || !Number.isFinite(rate.cost)) return true;
        if (rate.cost <= 0 || rate.cost > MAX_REASONABLE_RATE) return true;
        if (rate.carrierCost !== '' && (!Number.isFinite(rate.carrierCost) || rate.carrierCost < 0 || rate.carrierCost > MAX_REASONABLE_RATE)) return true;
        return false;
    }

    function validateParsedQuotes(quotes) {
        const issues = [];
        let malformedCarrierCount = 0;
        let suspiciousRateCount = 0;
        let totalRates = 0;

        (quotes || []).forEach((quote, quoteIndex) => {
            (quote.rawRates || []).forEach((rate, rateIndex) => {
                totalRates += 1;
                if (isCarrierMalformed(rate.carrier)) {
                    malformedCarrierCount += 1;
                    issues.push(`Quote ${quoteIndex + 1}, rate ${rateIndex + 1}: malformed carrier name.`);
                }
                if (isRateSuspicious(rate)) {
                    suspiciousRateCount += 1;
                    issues.push(`Quote ${quoteIndex + 1}, rate ${rateIndex + 1}: suspicious rate value (${rate.rawCostText || rate.cost}).`);
                }
            });
        });

        const blockParsing = totalRates > 0 && (suspiciousRateCount === totalRates || malformedCarrierCount === totalRates);
        const allowParserSafeExport = totalRates > 0 && malformedCarrierCount === 0 && suspiciousRateCount === 0;

        return {
            totalRates,
            malformedCarrierCount,
            suspiciousRateCount,
            issues,
            blockParsing,
            allowParserSafeExport
        };
    }

    function extractTransitDays(line) {
        const normalizedLine = normalizePriority1Text(line);
        const plainNumberMatch = normalizedLine.match(/^(\d{1,3})$/);
        if (plainNumberMatch) return plainNumberMatch[1];
        const dayKeywordMatch = normalizedLine.match(/(?:\b|\$)(\d{1,3})\s*Days?\b/i);
        if (dayKeywordMatch) return dayKeywordMatch[1];
        const explicit = normalizedLine.match(/\bTransit\s*[:\-]?\s*(\d{1,3})\b/i);
        if (explicit) return explicit[1];
        return 'N/A';
    }

    function parseTabSeparatedRateLine(line, rateType, hasInternalCols) {
        const cols = line.split('\t').map(part => normalizePriority1Text(part)).filter(Boolean);
        if (cols.length < 5 || !cols.some(col => col.includes('$'))) return null;

        const carrier = cols[0] || 'Unknown';
        const customerRateCol = cols.find(col => isMoneyLikeToken(col));
        if (!customerRateCol) return null;

        const customerCost = parseLocaleNumber(customerRateCol);
        const moneyCols = cols.filter(col => isMoneyLikeToken(col));
        const carrierCost = hasInternalCols && moneyCols.length > 1 ? parseLocaleNumber(moneyCols[1]) : '';
        if (!Number.isFinite(customerCost)) return null;

        const quoteNumber = cols.find((col, idx) => idx > 0 && /[A-Z0-9_-]{5,}/i.test(col) && /\d/.test(col) && !col.includes('$') && !col.includes('/')) || '-';

        const liabilityCol = cols.find(col => /^\$[0-9,.]+\s*\/\s*\$[0-9,.]+$/i.test(col) || /^NEW:/i.test(col)) || '-';
        let liability = '-';
        if (liabilityCol !== '-') {
            const slashMatch = liabilityCol.match(/\$?([0-9,.]+)\s*\/\s*\$?([0-9,.]+)/);
            if (slashMatch) {
                liability = `${slashMatch[1]}/${slashMatch[2]}`;
            } else {
                const newLiabMatch = liabilityCol.match(/NEW:\s*\$?([0-9,.]+)/i);
                const usedLiabMatch = liabilityCol.match(/USED:\s*\$?([0-9,.]+)/i);
                if (newLiabMatch) liability = newLiabMatch[1] + (usedLiabMatch ? `/${usedLiabMatch[1]}` : '');
            }
        }

        const service = cols.slice(1).find(col => /(Truckload Expedited Team|Truckload Expedited Solo|Truckload Expedited|Volume and Truckload Basic|Standard Rate|Economy|Priority|LTL Standard Transit|Market Rate|Standard Service|Standard|Interline|TLX|TLS|EXCL|Guaranteed|One Rate One Time)/i.test(col)) || 'Standard';
        const expiration = cols.find(col => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(col)) || '-';
        const margin = parsePercentValue(cols.find(col => /^\d+(?:[.,]\d+)?%$/.test(col)) || '-');
        const daysCol = [...cols].reverse().find(col => /^\d{1,3}$/.test(col) || /^\d{1,3}\s*Days?$/i.test(col));
        const days = daysCol ? extractTransitDays(daysCol) : extractTransitDays(line);

        return {
            id: Math.random().toString(36).substr(2, 9),
            carrier,
            cost: customerCost,
            carrierCost,
            rawCostText: customerRateCol,
            rawCarrierCostText: hasInternalCols && moneyCols.length > 1 ? moneyCols[1] : '',
            margin,
            expiration,
            quoteNumber,
            liability,
            service,
            days,
            rateType,
            isSelected: true
        };
    }

    function sanitizeQuoteInputText(rawText) {
        let text = String(rawText || '');
        text = text.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value) => {
            const code = /^x/i.test(value) ? parseInt(value.slice(1), 16) : Number(value);
            return code <= 0x10ffff ? String.fromCodePoint(code) : '';
        }).replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\*\*/g, '');
        text = text.split(/\r?\n/).map(line => {
            if (!/^\s*\|.*\|\s*$/.test(line)) return line;
            const cols = line.trim().slice(1, -1).split('|').map(col => col.replace(/⠀/g, '').trim());
            if (cols.every(col => /^:?-+:?$/.test(col))) return '';
            return cols.map(col => col || '-').join('\t');
        }).join('\n');
        text = text.replace(/⠀/g, '\t');
        // Some CRM copies join the carrier reference directly to the customer price.
        text = text.replace(/(\$[\d,]+\.\d{2})([A-Z0-9_-]+)(?=\t)/gi, '$1\t$2');
        text = text.replace(/Quote Id:\s*([A-Za-z0-9_-]+)(From:)/gi, 'Quote Id: $1\n$2');
        text = text.replace(/(\$[0-9,]+\.\d{2})(\d{1,3})\s*(Day|Days)\b/gi, '$1 $2 $3');
        text = text.replace(/LTL Rates:/gi, '\nLTL Rates:\n').replace(/Volume Rates:/gi, '\nVolume Rates:\n');
        text = text.replace(/<br\s*\/?>/gi, '\n');
        text = text.replace(/<\/\s*(div|p|tr|table|thead|tbody|ul|ol|li|h\d)\s*>/gi, '\n');
        text = text.replace(/<[^>]+>/g, ' ');
        return text;
    }

    function splitQuoteBlocks(rawText) {
        const lines = sanitizeQuoteInputText(rawText)
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean);

        const blocks = [];
        let current = [];
        let seenQuoteId = false;

        lines.forEach(line => {
            if (/^(?:quote id|quote):/i.test(line) && seenQuoteId && current.length) {
                blocks.push(current.join('\n'));
                current = [];
            }

            current.push(line);
            if (/^(?:quote id|quote):/i.test(line)) seenQuoteId = true;
        });

        if (current.length) blocks.push(current.join('\n'));
        return blocks;
    }

    function createQuote(defaults, index) {
        return {
            label: defaults.label || (index > 0 ? `Quote #${index + 1}` : 'Priority 1 Quote'),
            id: '-',
            from: '-',
            to: '-',
            items: [],
            accessorials: [],
            maxDims: { weight: 0, length: 0, width: 0, height: 0 },
            rawRates: [],
            processedRates: [],
            destType: defaults.destType || 'standard',
            prodType: defaults.prodType || 'none',
            checkLiftgate: !!defaults.checkLiftgate,
            checkCubic: !!defaults.checkCubic,
            insurance: Number(defaults.insurance || 0),
            hasInternalCols: false
        };
    }

    // Convert native dashboard cards and grids into the same input used by CRM exports.
    function convertNativePriority1Text(text) {
        text = String(text || '').replace(/\r\n?/g, '\n');
        const money = '[\\d,]+\\.\\d{2}';
        const cards = [...text.matchAll(new RegExp(`^\\$(${money})[ \\t]*\\n([^\\n]+?)\\s*\\|\\s*[A-Z0-9]{2,4}[ \\t]*\\n([^\\n]+)`, 'gm'))];
        const grids = [...text.matchAll(new RegExp(`^([^\\n$]+?(?:\\n[^\\n$]+?)?)[ \\t\\n]*(\\d{1,3})\\s*\\$(${money})\\s*(?:\\x24${money}\\s*)?\\$(${money})\\s*New:\\s*\\$(${money})\\s*Used:\\s*\\$(${money})\\s*(\\d{1,2}/\\d{1,2}/\\d{4})\\s*(\\d+(?:\\.\\d+)?)%`, 'gmi'))];
        if (!cards.length && !grids.length) return text;

        const canonical = name => name.trim().replace(/^(?:randl|r&l)(?: carriers)?$/i, 'R&L Carriers');
        const classify = (service, position) => {
            const headings = [...text.slice(0, position).matchAll(/\b(Expedited(?: Truckload)?|LTL|Volume)\s+Rates\s*:?/gi)];
            const heading = headings.length ? headings[headings.length - 1][1] : 'LTL';
            if (/expedited/i.test(service) || /^expedited/i.test(heading)) return 'Expedited';
            return /volume|truckload/i.test(service) || /^volume$/i.test(heading) ? 'Volume' : 'LTL';
        };
        const rates = cards.map((match, index) => {
            // Stop at the next card or summary heading; fields cannot leak between carriers.
            const end = index + 1 < cards.length ? cards[index + 1].index : text.length;
            const block = text.slice(match.index + match[0].length, end).split(/\b(?:Expedited(?: Truckload)?|LTL|Volume)\s+Rates\s*:?/i)[0];
            const field = label => block.match(new RegExp(`${label}\\s*\\n([^\\n]+)`, 'i'))?.[1].trim() || '-';
            return { carrier: canonical(match[2]), cost: match[1], service: match[3].trim(),
                rateType: classify(match[3], match.index), days: field('Transit Days'),
                liability: `${field('Carrier Liability New').replace(/\$/g, '')}/${field('Carrier Liability Used').replace(/\$/g, '')}`,
                quoteNumber: field('Quote Id'), expiration: field('Quote Exp\\. Date'), carrierCost: '', margin: '-' };
        });
        const names = [...new Set([...rates.map(rate => rate.carrier),
            'Old Dominion Freight Line', 'Saia LTL Freight', 'Dayton Freight Lines', 'R&L Carriers',
            'FedEx Economy', 'FedEx Priority', 'Central Transport', 'TForce Freight', 'ABF Freight',
            'AAA Cooper', 'Custom Companies', 'Moran Transportation', 'Diamond Line Delivery',
            'N&M Transfer', 'Go2 Logistics', 'Estes', 'Old Dominion', 'Saia', 'XPO', 'Averitt',
            'Ward', 'Pitt Ohio', 'Double D Express', 'Tax Airfreight', 'Forward', 'Magnum', 'Roadrunner', 'WARP'])]
            .sort((a, b) => b.length - a.length);
        for (const match of grids) {
            let combined = match[1].replace(/.*Margin\s*/i, '').replace(/^(?:Expedited(?: Truckload)?|LTL|Volume)\s+Rates\s*:?\s*/i, '').replace(/\n/g, ' ').trim();
            const name = names.find(name => combined.toLowerCase().startsWith(name.toLowerCase()));
            // Unknown carriers remain intact when service is on its own line.
            const parts = combined.split(/\s+(?=Standard|Economy|Priority|Guaranteed|Market|Interline)/i);
            const carrier = canonical(name || parts.shift());
            const service = name ? combined.slice(name.length).trim() || 'Standard' : parts.join(' ') || 'Standard';
            const rateType = classify(service, match.index + match[1].length);
            const matching = rates.filter(rate => rate.carrier.toLowerCase() === carrier.toLowerCase() && rate.cost === match[3]);
            const existing = matching.find(rate => rate.rateType === rateType) || (matching.length === 1 && !matching[0].fromGrid ? matching[0] : null);
            const data = { carrier, cost: match[3], carrierCost: match[4], liability: `${match[5]}/${match[6]}`,
                days: match[2], expiration: match[7], margin: `${match[8]}%`, rateType, fromGrid: true,
                service: /interline/i.test(service) && existing && !/interline/i.test(existing.service) ? `${existing.service} Interline` : existing?.service || service };
            if (existing) Object.assign(existing, data);
            else rates.push({ ...data, quoteNumber: '-' });
        }
        const lines = [];
        const id = text.match(/(?:Quote Id|Quote):\s*([\w-]+)/i)?.[1] || '-';
        lines.push(`Quote Id: ${id}`);
        for (const [label, aliases, end] of [
            ['From', 'From|Shipper', '\\n(?:\\d{1,2}/\\d{1,2}/\\d{4}|To:|Consignee:|Items:?|Accessorials:?)'],
            ['To', 'To|Consignee', '\\n(?:Items:?|Accessorials:?|Total weight:|Carriers search|LTL\\b)']
        ]) {
            const value = text.match(new RegExp(`(?:${aliases}):[ \\t]*\\n?([\\s\\S]*?)(?=${end}|$)`, 'i'))?.[1];
            lines.push(`${label}: ${value ? value.trim().replace(/\n+/g, ', ') : '-'}`);
        }
        lines.push('Items:');
        const items = text.match(/Items:?\s*\n([\s\S]*?)(?=Total weight:|Accessorials:?|Carriers search|Expedited\b|LTL\b|\n\$|$)/i)?.[1] || '';
        if (/^Weight:/im.test(items)) {
            const itemLines = items.split('\n').map(line => line.trim()).filter(Boolean);
            let item = null;
            const flush = () => { if (item) lines.push(`${item.title} - ${item.pieces} Piece(s) - ${item.weight} - ${item.dims}`); };
            for (let i = 0; i < itemLines.length; i++) {
                const line = itemLines[i];
                if (/^Piece/i.test(line)) {
                    flush(); item = { title: itemLines[i - 1] || 'Item', pieces: itemLines[i + 1] || '1', weight: '', dims: '' };
                } else if (/^Weight:/i.test(line)) {
                    if (!item) item = { title: itemLines[i - 1] || 'Item', pieces: '1', dims: '' };
                    item.weight = line.slice(7).trim() || itemLines[i + 1] || '';
                } else if (/^Dimensions:/i.test(line) && item) item.dims = line.slice(11).trim() || itemLines[i + 1] || '';
            }
            flush();
        } else lines.push(items.trim());
        const accessorials = text.match(/Accessorials:?\s*\n([\s\S]*?)(?=Total weight:|Carriers search|Expedited\b|LTL\b|Volume\b|Sort by|Items:?|\n\$|$)/i)?.[1];
        if (accessorials) lines.push('Accessorials:', accessorials.replace(/accepted/gi, '').split('\n').filter(line => !/HARDCODED/i.test(line)).join('\n'));
        for (const type of ['Expedited', 'LTL', 'Volume']) {
            const group = rates.filter(rate => rate.rateType === type);
            if (!group.length) continue;
            lines.push(`${type === 'Expedited' ? 'Expedited Truckload' : type} Rates:`, 'Carrier\tCustomer Cost\tCarrier Cost\tQuote #\tLiability\tService\tExpiration\tMargin\tTransit');
            for (const rate of group) lines.push([rate.carrier, '$' + rate.cost, rate.carrierCost ? '$' + rate.carrierCost : '-', rate.quoteNumber,
                'NEW: $' + rate.liability.replace('/', ' USED: $'), rate.service.replace(/Volume$/i, '').trim() || 'Standard', rate.expiration, rate.margin, `${rate.days} Days`].join('\t'));
        }
        return lines.join('\n');
    }

    function parseSingleQuoteText(blockText, defaults, index) {
        blockText = convertNativePriority1Text(blockText);
        const lines = sanitizeQuoteInputText(blockText)
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean);

        const q = createQuote(defaults, index);
        const handlingUnits = ['pallet', 'skid', 'bag', 'bale', 'box', 'bucket', 'bundle', 'can', 'carton', 'case', 'coil', 'crate', 'cylinder', 'drum', 'pail', 'piece', 'reel', 'roll', 'tube', 'tote'];
        let currentRateType = 'LTL';
        let mode = 'header';
        let isAdvancedFormat = lines.some(l => l.toLowerCase().includes('carrier cost') || l.toLowerCase().includes('margin'));
        if (isAdvancedFormat) q.hasInternalCols = true;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let lowerLine = normalizePriority1Text(line).toLowerCase();

            if (lowerLine === 'accessorials' || lowerLine === 'accessorials:') { mode = 'accessorials'; continue; }
            if (lowerLine === 'items' || lowerLine.startsWith('items / pallets') || lowerLine === 'items:' || lowerLine === 'items / details') { mode = 'items'; continue; }
            if (lowerLine.includes('ltl rates') || lowerLine.includes('ltl rates:')) { mode = 'rates'; currentRateType = 'LTL'; continue; }
            if (lowerLine.includes('volume rates') || lowerLine.includes('volume rates:')) { mode = 'rates'; currentRateType = 'Volume'; continue; }
            if (/^expedited(?: truckload)? rates:?$/i.test(lowerLine)) { mode = 'rates'; currentRateType = 'Expedited'; continue; }

            if (mode === 'header') {
                if (lowerLine.startsWith('quote id:') || lowerLine.startsWith('quote:')) {
                    let val = line.replace(/quote id:|quote:/i, '').trim();
                    q.id = val ? val : (lines[i + 1] ? lines[i + 1].trim() : '-');
                } else if (lowerLine.startsWith('from:') || lowerLine.startsWith('origin (from):')) {
                    let val = line.replace(/from:|origin \(from\):/i, '').trim();
                    q.from = val ? val : (lines[i + 1] ? lines[i + 1].trim() : '-');
                } else if (lowerLine.startsWith('to:') || lowerLine.startsWith('destination (to):')) {
                    let val = line.replace(/to:|destination \(to\):/i, '').trim();
                    q.to = val ? val : (lines[i + 1] ? lines[i + 1].trim() : '-');
                }
            } else if (mode === 'accessorials') {
                let parts = line.includes(',') ? line.split(',') : [line];
                parts.forEach(part => {
                    let cleanPart = part.trim();
                    let lowerPart = cleanPart.toLowerCase();
                    if (!cleanPart || cleanPart.includes('$') || cleanPart === '-') return;

                    const isExcessiveLengthMatch = /\b(?:excessive\s+length|overlength|(?:[7-9]|1\d|2\d)\s*(?:ft|feet|foot))\b/i.test(cleanPart);

                    const accRules = [
                        { name: 'Delivery Appointment', keywords: ['delivery appointment', 'appt del', 'appointment del', 'notify before delivery'] },
                        { name: 'Pickup Appointment', keywords: ['pickup appointment', 'appt pu', 'appointment pu', 'notify before pickup'] },
                        { name: 'Appointment / Notify', keywords: ['appointment', 'appt', 'notify', 'notification'] },
                        { name: 'Residential Delivery', keywords: ['residential delivery', 'residence delivery', 'residential del'] },
                        { name: 'Residential Pickup', keywords: ['residential pickup', 'residence pickup', 'residential pu'] },
                        { name: 'Residential', keywords: ['residential', 'residence'] },
                        { name: 'Lift Gate Delivery', keywords: ['lift gate delivery', 'liftgate delivery', 'lift-gate delivery', 'liftgate del', 'lift gate del'] },
                        { name: 'Lift Gate Pickup', keywords: ['lift gate pickup', 'liftgate pickup', 'lift-gate pickup', 'liftgate pu', 'lift gate pu'] },
                        { name: 'Lift Gate', keywords: ['lift gate', 'liftgate', 'lift-gate'] },
                        { name: 'Inside Delivery', keywords: ['inside delivery', 'inside del'] },
                        { name: 'Inside Pickup', keywords: ['inside pickup', 'inside pu'] },
                        { name: 'Inside', keywords: ['inside'] },
                        { name: 'Limited Access Delivery', keywords: ['limited access delivery', 'limited access del'] },
                        { name: 'Limited Access Pickup', keywords: ['limited access pickup', 'limited access pu'] },
                        { name: 'Limited Access', keywords: ['limited access'] },
                        { name: 'Hazmat', keywords: ['hazardous', 'hazmat'] },
                        { name: 'Protect From Freeze', keywords: ['protect from freeze', 'freeze'] }
                    ];

                    let matchedRule = accRules.find(r => r.keywords.some(kw => lowerPart.includes(kw)));
                    let finalName = isExcessiveLengthMatch ? 'Excessive Length' : (matchedRule ? matchedRule.name : cleanPart);
                    let countExisting = q.accessorials.filter(a => a === finalName).length;
                    let maxAllowed = finalName === 'Excessive Length' ? 1 : ((finalName.includes('Delivery') || finalName.includes('Pickup')) ? 1 : 2);
                    if (finalName.length < 40 && countExisting < maxAllowed) q.accessorials.push(finalName);
                });
            } else if (mode === 'items') {
                if (handlingUnits.some(unit => lowerLine.includes(unit)) && /\d/.test(line)) {
                    let isSubItem = line.startsWith('-');
                    let cleanLine = line.replace(/^"|"$/g, '');
                    let itemObj;
                    if (isSubItem) {
                        let noDimsLine = cleanLine.replace(/\s*-\s*[\d.]+\s*(?:in|"|cm|”|'')?\s*x\s*[\d.]+\s*(?:in|"|cm|”|'')?\s*x\s*[\d.]+\s*(?:in|"|cm|”|'')?/gi, '');
                        itemObj = { text: noDimsLine.replace(/^\s*-\s*/, '').trim(), isSub: true };
                    } else {
                        itemObj = { text: cleanLine, isSub: false };
                        const wMatch = line.match(/([\d.,]+)\s*(lbs|kg)/i);
                        if (wMatch) {
                            let w = parseLocaleNumber(wMatch[1]);
                            if (!Number.isFinite(w)) w = 0;
                            if (wMatch[2].toLowerCase() === 'kg') w *= 2.20462;
                            if (w > q.maxDims.weight) q.maxDims.weight = w;
                        }
                        const dMatch = line.match(/([\d.,]+)\s*(in|"|cm|”|'')?\s*x\s*([\d.,]+)\s*(in|"|cm|”|'')?\s*x\s*([\d.,]+)/i);
                        if (dMatch) {
                            let l = parseLocaleNumber(dMatch[1]), w = parseLocaleNumber(dMatch[3]), h = parseLocaleNumber(dMatch[5]), unit = (dMatch[2] || dMatch[4] || dMatch[6] || '').toLowerCase();
                            if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(h)) continue;
                            if (unit === 'cm') { l /= 2.54; w /= 2.54; h /= 2.54; }
                            if (l > q.maxDims.length) q.maxDims.length = l;
                            if (w > q.maxDims.width) q.maxDims.width = w;
                            if (h > q.maxDims.height) q.maxDims.height = h;
                        }
                    }
                    q.items.push(itemObj);
                }
            } else if (mode === 'rates') {
                if (/carrier\s*service\s*level/i.test(lowerLine) || /customer\s*cost/i.test(lowerLine) || /carrier\s*quote/i.test(lowerLine) || (lowerLine.includes('carrier') && lowerLine.includes('rate'))) continue;

                const tabParsedRate = parseTabSeparatedRateLine(line, currentRateType, q.hasInternalCols);
                if (tabParsedRate) {
                    q.rawRates.push(tabParsedRate);
                    continue;
                }

                if (line.includes('$')) {
                    line = line.replace(/(\$[0-9,]+\.\d{2})(\d{1,3})(?=\s*Days?\b)/i, '$1 $2');

                    let liability = '-';
                    let newLiabMatch = line.match(/NEW:\s*\$?([0-9,.]+)/i);
                    let usedLiabMatch = line.match(/USED:\s*\$?([0-9,.]+)/i);
                    let slashLiabMatch = line.match(/\$?([0-9,.]+)\s*\/\s*\$?([0-9,.]+)/);
                    if (newLiabMatch) {
                        liability = newLiabMatch[1];
                        if (usedLiabMatch) liability += '/' + usedLiabMatch[1];
                        line = line.replace(/NEW:\s*\$?[0-9,.]+/i, '').replace(/USED:\s*\$?[0-9,.]+/i, '');
                    } else if (slashLiabMatch) {
                        liability = slashLiabMatch[1] + '/' + slashLiabMatch[2];
                        line = line.replace(slashLiabMatch[0], '');
                    } else {
                        let rawNumbers = [...line.matchAll(/(?<!\$)\b(\d+(?:[\.,]\d+)?)\b/g)].map(m => parseLocaleNumber(m[1])).filter(Number.isFinite);
                        let liabNumbers = rawNumbers.filter(n => n > 50 && n % 1 === 0);
                        if (liabNumbers.length > 0) liability = liabNumbers.join('/');
                    }

                    let carrier = 'Unknown';
                    let firstDollarIdx = line.indexOf('$');
                    if (firstDollarIdx !== -1) {
                        let prefix = line.substring(0, firstDollarIdx).trim().replace(/[\t]+/g, ' ');
                        carrier = prefix.replace(/\s*(LTL|Volume)$/i, '').trim();
                    }

                    let moneyTokens = getMoneyTokensFromLine(line);
                    let dollarPrices = moneyTokens.map(token => parseLocaleNumber(token)).filter(Number.isFinite);
                    let customerCost = dollarPrices[0] || 0;
                    let carrierCost = '';
                    if (q.hasInternalCols && dollarPrices.length >= 2) carrierCost = dollarPrices[1];

                    let service = 'Standard';
                    let serviceMatch = line.match(/(Truckload Expedited Team|Truckload Expedited Solo|Truckload Expedited|Volume and Truckload Basic|Standard Rate|Economy|Priority|LTL Standard Transit|Market Rate|Standard Service|Standard|Interline|TLX|TLS|EXCL|Guaranteed|One Rate One Time)/i);
                    if (serviceMatch) service = serviceMatch[1];

                    let days = extractTransitDays(line);
                    let expMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
                    let expiration = expMatch ? expMatch[1] : '-';
                    let marginMatch = line.match(/(\d+(?:[\.,]\d+)?)%/);
                    let margin = marginMatch ? parsePercentValue(marginMatch[1] + '%') : '-';

                    let quoteNum = '-';
                    let tokens = line.split(/[\s\t]+/);
                    let rateFound = false;
                    for (let token of tokens) {
                        if (!rateFound) { if (token.includes('$')) rateFound = true; continue; }
                        if (token.length >= 6 && /^[A-Z0-9_-]+$/i.test(token) && /\d/.test(token) && !/^(Standard|Economy|Priority|Market|Interline|Guaranteed)$/i.test(token)) { quoteNum = token; break; }
                    }

                    q.rawRates.push({ id: Math.random().toString(36).substr(2, 9), carrier, cost: customerCost, carrierCost, rawCostText: moneyTokens[0] || '', rawCarrierCostText: moneyTokens[1] || '', margin, expiration, quoteNumber: quoteNum, liability, service, days, rateType: currentRateType, isSelected: true });
                } else if (q.rawRates.length > 0) {
                    let lastRate = q.rawRates[q.rawRates.length - 1];
                    let expMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
                    if (expMatch && lastRate.expiration === '-') lastRate.expiration = expMatch[1];
                    let marginMatch = line.match(/(\d+(?:[\.,]\d+)?)%/);
                    if (marginMatch && lastRate.margin === '-') lastRate.margin = parsePercentValue(marginMatch[1] + '%');
                }
            }
        }

        return q.rawRates.length > 0 ? q : null;
    }

    function parseQuoteText(rawText, defaults = {}) {
        return splitQuoteBlocks(rawText)
            .map((block, index) => parseSingleQuoteText(block, defaults, index))
            .filter(Boolean);
    }

    function formatMoney(value) {
        const num = Number(value);
        return Number.isFinite(num) ? `$${num.toFixed(2)}` : '$0.00';
    }

    function formatRateLine(rate, includeInternalCols) {
        const cols = [
            rate.carrier || rate.normalizedName || 'Unknown',
            formatMoney(rate.cost)
        ];

        if (includeInternalCols) cols.push(formatMoney(rate.carrierCost || 0));
        cols.push(rate.quoteNumber || '-');
        cols.push(rate.liability && rate.liability !== '-' ? rate.liability : '-');
        cols.push(rate.service || 'Standard');
        if (includeInternalCols) cols.push(rate.expiration || '-');
        if (includeInternalCols) cols.push(rate.margin || '-');
        cols.push(`${rate.days || 'N/A'} Days`);
        return cols.join('\t');
    }

    function buildParseableQuoteText(quotes) {
        return (quotes || []).map((quote, index) => {
            const q = quote || {};
            const rates = q.processedRates && q.processedRates.length ? q.processedRates : (q.rawRates || []);
            const expeditedRates = rates.filter(rate => rate.rateType === 'Expedited');
            const ltlRates = rates.filter(rate => rate.rateType !== 'Volume' && rate.rateType !== 'Expedited');
            const volumeRates = rates.filter(rate => rate.rateType === 'Volume');
            const hasInternalCols = !!q.hasInternalCols || rates.some(rate => rate.carrierCost || (rate.margin && rate.margin !== '-'));
            const lines = [q.label || (index > 0 ? `Quote #${index + 1}` : 'Priority 1 Quote')];

            lines.push(`Quote Id: ${q.id || '-'}`);
            lines.push(`From: ${q.from || '-'}`);
            lines.push(`To: ${q.to || '-'}`);
            lines.push('Items:');
            if ((q.items || []).length) {
                q.items.forEach(item => lines.push(item && item.text ? item.text : String(item || '').trim()));
            } else {
                lines.push('-');
            }

            if ((q.accessorials || []).length) {
                lines.push('Accessorials:');
                lines.push(q.accessorials.join(', '));
            }

            const appendRateGroup = (title, groupRates) => {
                if (!groupRates.length) return;
                lines.push(`${title}:`);
                if (hasInternalCols) lines.push('Carrier\tCustomer Cost\tCarrier Cost\tQuote #\tLiability\tService\tExpiration\tMargin\tTransit');
                groupRates.forEach(rate => lines.push(formatRateLine(rate, hasInternalCols)));
            };

            appendRateGroup('Expedited Truckload Rates', expeditedRates);
            appendRateGroup('LTL Rates', ltlRates);
            appendRateGroup('Volume Rates', volumeRates);
            return lines.join('\n');
        }).join('\n\n');
    }

    return {
        normalizePriority1Text,
        parseLocaleNumber,
        extractTransitDays,
        validateParsedQuotes,
        parseTabSeparatedRateLine,
        parseQuoteText,
        buildParseableQuoteText
    };
});
