/* One preference; two real pages; one unchanged quote engine. */
(() => {
    'use strict';
    const preferenceKey = 'ltl-interface-v1';
    const snoozeKey = 'ltl-interface-invite-after-v1';
    const transferKey = 'ltl-interface-transfer-v1';
    const classic = location.pathname.endsWith('/classic.html');
    const current = classic ? 'classic' : 'workspace';
    const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
    const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Private browsing. */ } };
    const query = new URLSearchParams(location.search);
    const explicit = query.get('ui');
    const saved = read(preferenceKey);
    const preferred = ['classic', 'workspace'].includes(explicit) ? explicit
        : (['classic', 'workspace'].includes(saved) ? saved : 'classic');
    const destination = mode => {
        const url = new URL(mode === 'classic' ? './classic.html' : './index.html', location.href);
        url.search = location.search;
        url.hash = location.hash;
        url.searchParams.set('ui', mode);
        return url;
    };
    window.LTLInterface = { current };
    if (preferred !== current) {
        document.documentElement.style.visibility = 'hidden';
        const next = destination(preferred);
        if (!['classic', 'workspace'].includes(explicit)) next.searchParams.delete('ui');
        location.replace(next);
        return;
    }
    if (['classic', 'workspace'].includes(explicit)) write(preferenceKey, current);
    const fields = ['inputData', 'sortFilter', 'destFilter', 'productFilter', 'insuranceInput',
        'liftgateFilter', 'cubicFilter', 'batchMode', 'batchShowTableView', 'batchInlineLayout',
        'batchCheapestOnly', 'batchSpreadsheetRates', 'batchInlineRateCount', 'separateRateTypes',
        'exportCarrierCost', 'exportMargin', 'emailTheme', 'autoCopyPaste', 'expToggle',
        'roundTripClipboardToggle', 'pasteAnywhereToggle'];
    const spanish = () => typeof currentLang !== 'undefined' && currentLang === 'es';
    let switchButton;
    function switchTo(mode) {
        if (!['classic', 'workspace'].includes(mode) || mode === current) return;
        const values = {};
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) values[id] = el.type === 'checkbox' ? el.checked : el.value;
        });
        const snapshot = { expires: Date.now() + 300000, target: mode, values,
            quotes: appQuotes, raw: lastParsedText, counter: batchQuoteCounter, lang: currentLang };
        try {
            const data = JSON.stringify(snapshot);
            if (data.length > 1500000) throw new Error('Quote too large');
            sessionStorage.setItem(transferKey, data);
        } catch {
            if (appQuotes.length || values.inputData) {
                alert(spanish() ? 'No se pudo conservar la cotización. Guarda una copia antes de cambiar.'
                    : 'Your browser could not preserve this quote. Save a copy before switching.');
                return;
            }
        }
        write(preferenceKey, mode);
        location.assign(destination(mode));
    }
    window.LTLInterface.switchTo = switchTo;
    function restore() {
        let state;
        try {
            state = JSON.parse(sessionStorage.getItem(transferKey) || 'null');
            sessionStorage.removeItem(transferKey);
        } catch { return; }
        if (!state || state.expires < Date.now() || state.target !== current || !Array.isArray(state.quotes)) return;
        for (const [id, value] of Object.entries(state.values || {})) {
            if (!fields.includes(id)) continue;
            const el = document.getElementById(id);
            if (el) { if (el.type === 'checkbox') el.checked = !!value; else el.value = value; }
        }
        // Enable rules before restoring the exact quote; never re-paste or auto-copy.
        toggleExperimental(!!state.values.expToggle);
        appQuotes = state.quotes;
        lastParsedText = state.raw || '';
        batchQuoteCounter = state.counter || 0;
        applyPasteAnywhereMode(!!state.values.pasteAnywhereToggle);
        toggleBatchMode();
        setLang(state.lang === 'es' ? 'es' : 'en');
        updateSummaryUI();
        renderTable();
        startLiveClocks();
    }
    function invite() {
        if (!classic || ['classic', 'workspace'].includes(read(preferenceKey)) || Number(read(snoozeKey)) > Date.now()) return;
        const es = spanish();
        const dialog = document.createElement('dialog');
        dialog.className = 'ltl-dialog'; dialog.id = 'interfaceInvite';
        dialog.setAttribute('aria-labelledby', 'interfaceInviteTitle');
        dialog.innerHTML = `<span class="ltl-eyebrow">SMART LTL</span>
            <h2 id="interfaceInviteTitle">${es ? 'Prueba el nuevo espacio de cotizaciones' : 'Meet your new quote workspace'}</h2>
            <p>${es ? 'Una interfaz más clara, con las mismas cotizaciones y funciones. Puedes volver al diseño clásico cuando quieras.' : 'A cleaner interface, with the same quotes and tools. You can return to the classic look at any time.'}</p>
            <div class="ltl-actions"><button type="button" data-choice="new" class="ltl-primary">${es ? 'Probar nuevo diseño' : 'Try the new look'}</button>
            <button type="button" data-choice="keep">${es ? 'Mantener el clásico' : 'Keep the classic look'}</button></div>
            <button type="button" data-choice="later" class="ltl-link">${es ? 'Recordarme en 7 días' : 'Remind me in 7 days'}</button>`;
        document.body.append(dialog);
        const dismiss = () => { write(snoozeKey, String(Date.now() + 7 * 86400000)); dialog.close(); };
        dialog.querySelector('[data-choice="new"]').onclick = () => switchTo('workspace');
        dialog.querySelector('[data-choice="keep"]').onclick = () => { write(preferenceKey, 'classic'); dialog.close(); };
        dialog.querySelector('[data-choice="later"]').onclick = dismiss;
        dialog.addEventListener('cancel', dismiss);
        dialog.addEventListener('close', () => { dialog.remove(); switchButton?.focus(); }, { once: true });
        if (!document.querySelector('dialog[open]')) dialog.showModal();
    }
    document.addEventListener('DOMContentLoaded', () => {
        const baseInit = window.initApp;
        const baseLang = window.setLang;
        const labels = () => {
            if (switchButton) switchButton.textContent = classic
                ? (spanish() ? 'Probar nuevo diseño' : 'Try new look')
                : (spanish() ? 'Volver al clásico' : 'Classic look');
        };
        window.setLang = function (...args) { const result = baseLang.apply(this, args); labels(); return result; };
        dict.en.emptyText = 'Paste quote data in the left panel.';
        dict.es.emptyText = 'Pega los datos en el panel izquierdo.';
        window.initApp = function (...args) {
            const result = baseInit.apply(this, args);
            restore();
            if (!document.getElementById('interfaceSwitch')) {
                switchButton = document.createElement('button');
                switchButton.type = 'button'; switchButton.id = 'interfaceSwitch';
                switchButton.className = 'ltl-switch';
                switchButton.onclick = () => switchTo(classic ? 'workspace' : 'classic');
                const anchor = document.querySelector('.header-utilities') || document.querySelector('.tabs-nav');
                (anchor || document.body).append(switchButton);
                labels();
                setTimeout(invite, 400);
            }
            return result;
        };
    });
})();
