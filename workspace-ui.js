/*
 * Presentation adapter for the existing vanilla-JS application.
 * The parser, carrier rules, prices, selection state and email HTML remain owned
 * by script.js. These small view hooks run after its renderers; they do not
 * replace quote-processing or export logic. Load after script.js, before initApp.
 */
(() => {
    'use strict';
    const text = {
        en: {
            workspace: 'WORKSPACE', ltlQuotes: 'LTL QUOTES',
            intro: 'Compare your carrier options. Send a clear quote.',
            feedback: 'Feedback', emailAppearance: 'Email appearance',
            appearance: 'Interface appearance', colorMode: 'Color mode', accent: 'Accent',
            sourceEyebrow: 'QUOTE SOURCE', sourceDescription: 'Paste the complete quote from Priority1.',
            inputCaption: 'Quote details + carrier table', rulesOptions: 'Shipment rules & options',
            sourceNoteTitle: 'BEFORE YOU SEND',
            sourceNote: 'Review service, liability, and accessorials with the carrier. Transit times are estimates.',
            preview: 'Preview email', sortBy: 'Sort by', displayOptions: 'Display options',
            exportHint: 'Only selected carriers are included in the email.', customerRates: 'Customer rates',
            footerDesk: 'Quote desk', footerStorage: 'Quote processing runs in your browser.',
            options: 'Carrier options', selected: 'selected for email', loaded: 'carrier rates loaded',
            quote: 'QUOTE', source: 'Source quote', origin: 'Origin', destination: 'Destination',
            shipment: 'Shipment', accessorials: 'Accessorials', lowest: 'Lowest rate',
            selectAll: 'Select all carriers', selectCarrier: 'Include in email:',
            emptyTitle: 'Your next quote starts here',
            emptyBody: 'Paste a Priority1 quote to compare carrier rates, review service details, and prepare your email.',
            emptyHint: 'Select the carriers you want to share.',
            ready: 'Ready when you are',
            warning: '<strong>Before booking:</strong> Verify requirements with your client and confirm current carrier tariffs. Rule checks are guidance, not a service guarantee.'
        },
        es: {
            workspace: 'ESPACIO DE TRABAJO', ltlQuotes: 'COTIZACIONES LTL',
            intro: 'Compara las opciones de transporte. Envía una cotización clara.',
            feedback: 'Comentarios', emailAppearance: 'Diseño del correo',
            appearance: 'Apariencia de la interfaz', colorMode: 'Modo de color', accent: 'Color principal',
            sourceEyebrow: 'COTIZACIÓN DE ORIGEN', sourceDescription: 'Pega la cotización completa de Priority1.',
            inputCaption: 'Detalles + tabla de transportistas', rulesOptions: 'Reglas y opciones del envío',
            sourceNoteTitle: 'ANTES DE ENVIAR',
            sourceNote: 'Confirma servicio, responsabilidad y servicios adicionales con el transportista. El tránsito es estimado.',
            preview: 'Ver correo', sortBy: 'Ordenar', displayOptions: 'Opciones de vista',
            exportHint: 'Solo los transportistas seleccionados se incluyen en el correo.', customerRates: 'Tarifas al cliente',
            footerDesk: 'Cotizaciones', footerStorage: 'Las cotizaciones se procesan en tu navegador.',
            options: 'Transportistas', selected: 'seleccionados para el correo', loaded: 'tarifas cargadas',
            quote: 'COTIZACIÓN', source: 'Cotización de origen', origin: 'Origen', destination: 'Destino',
            shipment: 'Envío', accessorials: 'Servicios adicionales', lowest: 'Menor tarifa',
            selectAll: 'Seleccionar todos los transportistas', selectCarrier: 'Incluir en el correo:',
            emptyTitle: 'Tu próxima cotización empieza aquí',
            emptyBody: 'Pega una cotización de Priority1 para comparar tarifas, revisar servicios y preparar tu correo.',
            emptyHint: 'Selecciona los transportistas que deseas compartir.',
            ready: 'Listo para empezar',
            warning: '<strong>Antes de reservar:</strong> Verifica los requisitos con el cliente y confirma las tarifas vigentes del transportista. Las reglas son orientativas, no una garantía de servicio.'
        }
    };
    const copy = () => text[currentLang] || text.en;
    const el = (tag, className, content) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    };

    // Remove decorative icons from control text, without changing email labels.
    for (const lang of ['en', 'es']) {
        for (const key of Object.keys(dict[lang])) {
            if (/^(appThm|thm|opt)/.test(key)) {
                dict[lang][key] = dict[lang][key].replace(/^[^\p{L}\p{N}]+/u, '');
            }
        }
    }
    Object.assign(dict.en, {
        mainTitle: 'Quote workspace', step1Title: 'Quote input', analyzeBtn: 'Analyze quote',
        step2Title: 'Shipment rules', copyBtn: 'Copy for email', clearBtn: 'Clear',
        autoCopy: 'Auto-parse & copy on paste', optSortCheap: 'Lowest rate', optSortFast: 'Fastest transit',
        'btn-tab-analyzer': 'Quote workspace', 'btn-tab-extras': 'Reference library',
        extHazTitle: 'Hazmat / NMFC reference', lblEmailTheme: 'Email theme',
        placeholder: 'Quote Id: …\n\nFrom: …\nTo: …\n\nItems:\n…\n\nLTL Rates:\n…',
        disclaimerMsg: text.en.warning
    });
    Object.assign(dict.es, {
        mainTitle: 'Espacio de cotizaciones', step1Title: 'Datos de la cotización', analyzeBtn: 'Analizar cotización',
        step2Title: 'Reglas del envío', copyBtn: 'Copiar para correo', clearBtn: 'Limpiar',
        autoCopy: 'Analizar y copiar al pegar', optSortCheap: 'Menor tarifa', optSortFast: 'Menor tránsito',
        'btn-tab-analyzer': 'Cotizaciones', 'btn-tab-extras': 'Referencias',
        extHazTitle: 'Referencia Hazmat / NMFC', lblEmailTheme: 'Tema del correo',
        placeholder: 'Quote Id: …\n\nFrom: …\nTo: …\n\nItems:\n…\n\nLTL Rates:\n…',
        disclaimerMsg: text.es.warning
    });

    function applyLabels() {
        const t = copy();
        document.documentElement.lang = currentLang;
        document.querySelectorAll('[data-ui-text]').forEach(node => {
            const value = t[node.dataset.uiText];
            if (value !== undefined) node.textContent = value;
        });
        const appearance = document.querySelector('.appearance-button');
        appearance?.setAttribute('aria-label', t.emailAppearance);
        appearance?.setAttribute('title', t.emailAppearance);
        document.getElementById('inputData')?.setAttribute('aria-label', dict[currentLang].step1Title);
        document.getElementById('sortFilter')?.setAttribute('aria-label', t.sortBy);
        document.querySelectorAll('.tab-btn').forEach(node => {
            node.setAttribute('aria-current', node.classList.contains('active') ? 'page' : 'false');
        });
        for (const id of ['btn-en', 'btn-es', 'btn-light', 'btn-dark']) {
            const button = document.getElementById(id);
            button?.setAttribute('aria-pressed', String(button.classList.contains('active')));
        }
    }

    function updateSelection() {
        const rates = appQuotes.flatMap(q => q.processedRates || []);
        const selected = rates.filter(r => r.isAllowed && r.isSelected !== false).length;
        const summary = document.getElementById('selectionSummary');
        if (summary) summary.textContent = rates.length ? `${selected} / ${rates.length} ${copy().selected}` : copy().ready;
        for (const id of ['copyBtn', 'previewEmailBtn']) {
            const button = document.getElementById(id);
            if (button) button.disabled = selected === 0;
        }
        const all = document.getElementById('selectAllRates');
        if (all) {
            const included = rates.filter(r => r.isSelected !== false).length;
            all.checked = included === rates.length;
            all.indeterminate = included > 0 && included < rates.length;
        }
    }

    function decorateSummary() {
        const t = copy();
        document.querySelectorAll('#quoteSummaryContainer .quote-summary').forEach((card, index) => {
            const q = appQuotes[index];
            const grid = card.querySelector('.summary-grid');
            if (!q || !grid) return;
            const parts = Array.from(grid.children);
            const [heading, origin, destination, items, accessorials] = parts;
            if (!heading || !origin || !destination || !items || !accessorials) return;
            const actions = heading.querySelector('.batch-summary-actions');
            heading.classList.add('shipment-heading');
            heading.replaceChildren();
            const record = el('div', 'record-number');
            record.append(el('span', '', t.quote));
            if (q.id && q.id !== '-') {
                const link = el('a', '', `#${q.id}`);
                link.href = `https://dashboard.priority1.com/ltl/quotes/details/${encodeURIComponent(q.id)}`;
                link.target = '_blank'; link.rel = 'noopener noreferrer';
                record.append(link);
            } else record.append(el('span', '', q.label || '—'));
            heading.append(record, el('span', 'record-source', t.source));
            if (actions) {
                actions.style.gridColumn = '1 / -1';
                grid.insertBefore(actions, origin);
            }
            for (const [node, label, location, className] of [
                [origin, t.origin, q.from, 'route-origin'],
                [destination, t.destination, q.to, 'route-destination']
            ]) {
                const clock = node.querySelector('.live-clock');
                node.classList.add('route-location', className);
                node.replaceChildren(el('span', 'summary-label', label));
                const value = String(location || 'N/A');
                const comma = value.indexOf(',');
                const city = comma < 0 ? value : value.slice(0, comma);
                const detail = comma < 0 ? '' : value.slice(comma + 1).trim();
                node.append(el('span', 'location-city', city));
                if (detail) node.append(el('div', 'location-detail', detail));
                if (clock) node.append(clock);
            }
            items.classList.add('shipment-items');
            accessorials.classList.add('shipment-accessorials');
            items.querySelector('.summary-label').textContent = t.shipment;
            accessorials.querySelector('.summary-label').textContent = t.accessorials;
        });
    }

    function decorateTable() {
        const table = document.getElementById('quotesTable');
        if (!table) return;
        const t = copy();
        const rates = appQuotes.flatMap(q => q.processedRates || []);
        table.classList.toggle('single-quote', appQuotes.length === 1);
        table.classList.toggle('single-rate-type', new Set(rates.map(r => r.rateType)).size <= 1);
        table.classList.toggle('empty-table', appQuotes.length === 0);
        const heading = document.getElementById('resultCount');
        heading.replaceChildren(document.createTextNode(t.options));
        if (rates.length) heading.append(el('span', 'option-count', String(rates.length)));
        const status = document.getElementById('sourceStatus');
        if (status) status.textContent = rates.length ? `${rates.length} ${t.loaded}` : '';
        if (!appQuotes.length) {
            const empty = table.querySelector('.empty-state');
            if (empty) {
                empty.innerHTML = '<svg class="empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M12 5h16l9 9v29H12Z"/><path d="M28 5v10h9M18 23h13M18 29h13M18 35h8"/></svg>';
                empty.append(el('strong', '', t.emptyTitle), el('p', '', t.emptyBody), el('span', '', t.emptyHint));
            }
            updateSelection();
            return;
        }
        if (appQuotes.length === 1) {
            const carrierHeader = document.getElementById('thCarrier');
            if (carrierHeader && !document.getElementById('selectAllRates')) {
                const checkbox = el('input');
                checkbox.type = 'checkbox'; checkbox.id = 'selectAllRates';
                checkbox.setAttribute('aria-label', t.selectAll);
                checkbox.addEventListener('change', () => window.toggleAllCarriers(checkbox, 0));
                carrierHeader.prepend(checkbox);
            }
        }
        const allowed = rates.filter(r => r.isAllowed && Number.isFinite(r.cost));
        const minimum = allowed.length ? Math.min(...allowed.map(r => r.cost)) : NaN;
        table.querySelectorAll('tbody tr').forEach(row => {
            const name = row.querySelector('.carrier-name');
            if (!name) return;
            name.title = name.textContent;
            const checkbox = row.querySelector('input[type="checkbox"]');
            checkbox?.setAttribute('aria-label', `${t.selectCarrier} ${name.textContent}`);
            // The legacy renderer emits a spare cost cell when internal columns
            // exist but neither cost nor margin is selected. Align the view only.
            const headers = document.getElementById('tableHeadersRow').children.length;
            if (!document.getElementById('exportCarrierCost').checked &&
                !document.getElementById('exportMargin').checked &&
                row.cells.length === headers + 1 && row.cells[2]?.textContent.trim() === '-') {
                row.deleteCell(2);
            }
            const refs = row.cells[0].querySelectorAll(':scope > div');
            if (refs.length > 1) refs[refs.length - 1].classList.add('carrier-ref');
            const price = row.querySelector('.price');
            const amount = Number.parseFloat((price?.firstChild?.textContent || '').replace(/[$,]/g, ''));
            if (amount === minimum && !row.classList.contains('disabled-row')) {
                row.classList.add('lowest-rate-row');
                price.append(el('span', 'lowest-rate-note', t.lowest));
            }
        });
        updateSelection();
    }

    // Explicit hooks keep the original processing/rendering entry points usable.
    const originalSummary = window.updateSummaryUI;
    window.updateSummaryUI = function (...args) {
        const result = originalSummary.apply(this, args);
        decorateSummary();
        return result;
    };
    const originalTable = window.renderTable;
    window.renderTable = function (...args) {
        // Hiding the comparison must not hide its export actions or prevent
        // rate processing. Restore the user's checkbox immediately afterwards.
        const toggle = document.getElementById('batchShowTableView');
        const hideTable = document.getElementById('batchMode').checked && !toggle.checked;
        const checked = toggle.checked;
        let result;
        try {
            if (hideTable) toggle.checked = true;
            result = originalTable.apply(this, args);
        } finally {
            toggle.checked = checked;
        }
        document.querySelector('#resultsPanel .table-container').hidden = hideTable;
        document.querySelector('#resultsPanel .table-footer').hidden = hideTable;
        decorateTable();
        return result;
    };
    for (const name of ['setLang', 'setTheme', 'switchTab']) {
        const original = window[name];
        window[name] = function (...args) {
            const result = original.apply(this, args);
            applyLabels();
            return result;
        };
    }
    const originalSelection = window.toggleCarrierSelection;
    window.toggleCarrierSelection = function (...args) {
        const result = originalSelection.apply(this, args);
        updateSelection();
        return result;
    };

    // Keyboard-operable dialogs; return focus to the control that opened them.
    const dialogs = [
        ['settingsModal', 'openSettings', 'closeSettings'],
        ['brandingModal', 'openBranding', 'closeBranding'],
        ['emailPreviewModal', 'openEmailPreview', 'closeEmailPreview'],
        ['bugReportModal', 'openBugReport', 'closeBugReport']
    ];
    const returnFocus = new Map();
    const focusables = modal => Array.from(modal.querySelectorAll('button, a[href], input, select, textarea, iframe, [tabindex="0"]'))
        .filter(node => !node.disabled && node.getClientRects().length);
    for (const [id, open, close] of dialogs) {
        const originalOpen = window[open];
        const originalClose = window[close];
        window[open] = function (...args) {
            const modal = document.getElementById(id);
            if (modal.style.display === 'none') returnFocus.set(id, document.activeElement);
            const result = originalOpen.apply(this, args);
            modal.setAttribute('aria-hidden', 'false');
            focusables(modal)[0]?.focus();
            return result;
        };
        window[close] = function (...args) {
            const result = originalClose.apply(this, args);
            document.getElementById(id).setAttribute('aria-hidden', 'true');
            returnFocus.get(id)?.focus();
            return result;
        };
    }
    document.addEventListener('keydown', event => {
        const visible = dialogs.filter(([id]) => document.getElementById(id).style.display !== 'none')
            .sort((a, b) => Number(getComputedStyle(document.getElementById(b[0])).zIndex) - Number(getComputedStyle(document.getElementById(a[0])).zIndex));
        if (visible.length) {
            const [id, , close] = visible[0];
            if (event.key === 'Escape') { event.preventDefault(); window[close](); }
            if (event.key === 'Tab') {
                const items = focusables(document.getElementById(id));
                const first = items[0], last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && event.target.id === 'inputData') {
            event.preventDefault(); processData();
        }
    });
    document.addEventListener('click', event => {
        document.querySelectorAll('.view-options[open]').forEach(menu => {
            if (!menu.contains(event.target)) menu.open = false;
        });
    });
    document.addEventListener('DOMContentLoaded', () => {
        applyLabels();
        dialogs.forEach(([id, , close]) => {
            const modal = document.getElementById(id);
            modal.setAttribute('aria-hidden', 'true');
            modal.addEventListener('click', event => { if (event.target === modal) window[close](); });
        });
    });
})();
