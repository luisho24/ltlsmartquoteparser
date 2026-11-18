/* Public configuration only: no admin credentials, reports or private device names. */
(() => {
    'use strict';
    const KEY = 'ltl-feedback-client-v1';
    let id;
    try { id = localStorage.getItem(KEY); } catch { /* Browser memory fallback. */ }
    if (!/^[a-f0-9]{32}$/.test(id || '')) {
        id = [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('');
        try { localStorage.setItem(KEY, id); } catch { /* Per-tab identity when storage is unavailable. */ }
    }
    let displayId = '';
    window.LTLDevice = Object.freeze({ id: () => id, displayId: () => displayId });
    let config = null, disabledDevice = false, revision = -1;
    const key = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const feature = name => !disabledDevice && config?.features?.[name] !== false;
    function carrier(name) {
        return config?.carriers?.find(item => [item.name, ...item.aliases].some(alias => key(alias) === key(name))) || null;
    }
    function matches(names, original, normalized) {
        const record = carrier(original) || carrier(normalized);
        const candidates = [original, normalized, ...(record ? [record.name, ...record.aliases] : [])].map(key);
        return names.some(name => candidates.includes(key(name)));
    }
    function assess(rate, destination) {
        if (disabledDevice) return { allowed: false, reason: 'Dispositivo desactivado' };
        const record = carrier(rate.carrier) || carrier(rate.normalizedName);
        if (record?.enabled === false) return { allowed: false, reason: 'Carrier desactivado' };
        if (rate.rateType === 'Expedited' && !feature('expeditedRates')) return { allowed: false, reason: 'Expedited desactivado' };
        if (rate.rateType === 'Volume' && !feature('volumeRates')) return { allowed: false, reason: 'Volume desactivado' };
        if (destination && destination !== 'standard' && config) {
            const filter = config.filters.find(item => item.id === destination);
            if (!filter || !filter.enabled) return { allowed: false, reason: 'Filtro desactivado' };
            const normalized = typeof normalizeCarrierName === 'function' ? normalizeCarrierName(rate.carrier) : rate.carrier;
            if (matches(filter.blocked, rate.carrier, normalized) || !matches(filter.allowed, rate.carrier, normalized)) return { allowed: false, reason: 'No permitido: ' + filter.label };
            const note = filter.notes[record?.name] || filter.notes[normalized] || filter.notes[rate.carrier];
            return { allowed: true, note: note || '' };
        }
        return null;
    }
    function controls() {
        if (!config) return;
        const filter = document.getElementById('destFilter');
        if (filter) {
            const selected = filter.value;
            [...filter.options].filter(option => option.value !== 'standard').forEach(option => option.remove());
            config.filters.filter(item => item.enabled).forEach(item => {
                const option = document.createElement('option'); option.value = item.id; option.textContent = item.label; filter.append(option);
            });
            filter.value = [...filter.options].some(option => option.value === selected) ? selected : 'standard';
        }
        const bindings = { batchMode: ['batchMode'], referenceLibrary: ['btn-tab-extras'], insurance: ['insuranceInput'], exportEmail: ['copyBtn', 'previewEmailBtn'] };
        for (const [name, ids] of Object.entries(bindings)) for (const id of ids) {
            const element = document.getElementById(id); if (!element) continue;
            if (!feature(name)) {
                element.disabled = true; element.title = 'Desactivado por administración';
                if (element.type === 'checkbox') element.checked = false;
                if (id === 'insuranceInput') element.value = '';
            } else if (element.title === 'Desactivado por administración') {
                element.disabled = false; element.removeAttribute('title');
            }
        }
    }
    function endpoint() {
        try {
            const url = new URL(window.LTL_FEEDBACK_CONFIG?.endpoint || '');
            return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) ? url.origin : null;
        } catch { return null; }
    }
    async function refresh() {
        const base = endpoint(); if (!base) return;
        try {
            const response = await fetch(base + '/v1/config', { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000) });
            if (!response.ok) return;
            const next = await response.json();
            if (!next || !Number.isInteger(next.revision) || !next.features || !Array.isArray(next.filters) || !Array.isArray(next.carriers)) return;
            if (next.revision !== revision) {
                config = next; revision = next.revision;
                if (typeof rules !== 'undefined' && next.rules) for (const [group, value] of Object.entries(next.rules)) if (Object.hasOwn(rules, group)) rules[group] = value;
                // Custom destination filters replace the legacy destination branches.
                controls();
                if (typeof renderTable === 'function') renderTable();
                controls();
            }
            const deviceResponse = await fetch(base + '/v1/device', { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: id }), signal: AbortSignal.timeout(10000) });
            const wasDisabled = disabledDevice;
            if (deviceResponse.status === 403) disabledDevice = true;
            else if (deviceResponse.ok) { disabledDevice = false; displayId = (await deviceResponse.json()).deviceId || ''; document.dispatchEvent(new Event('ltl-device-ready')); }
            if (wasDisabled !== disabledDevice && typeof renderTable === 'function') renderTable();
            controls();
        } catch { /* Keep the last known configuration; do not interrupt quote entry. */ }
    }
    window.LTLRemote = { feature, carrier, assess, controls, refresh, get config() { return config; }, get disabledDevice() { return disabledDevice; } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh); else refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
