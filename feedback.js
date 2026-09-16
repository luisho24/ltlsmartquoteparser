/* Shared feedback UI for classic and workspace. No quote data is sent by default. */
(() => {
    'use strict';
    const copy = {
        en: {
            heading: 'Help improve Smart LTL', intro: 'Report an issue or suggest an improvement.',
            category: 'Feedback type', bug: 'Bug report', idea: 'Suggestion', other: 'Other',
            title: 'Short summary', message: 'What happened, or what would you change?',
            steps: 'Steps to reproduce (optional)', email: 'Email for a reply (optional)',
            include: 'Include the current quote ID only', send: 'Send feedback', close: 'Close',
            privacy: 'Do not include customer names, addresses, rates, passwords, or other sensitive details. We send only this form, your interface/language, and the quote ID if selected. Reports are kept for up to 90 days.',
            limits: 'Up to 5 reports per hour and 15 per day per browser. Additional shared-network and service limits apply.',
            unavailable: 'The feedback service is not connected yet. Nothing has been sent.',
            sending: 'Sending…', failed: 'We could not confirm delivery. Your text is still here; please retry.',
            success: 'Feedback received. Reference:', duplicate: 'Already received. Reference:',
            rate: 'The feedback limit has been reached. Try again in', seconds: 'seconds.',
            expired: 'The security check expired. Please press Send feedback again.',
            invalid: 'Please check the form fields and try again.', busy: 'Feedback is temporarily unavailable. Your text has been kept.'
        },
        es: {
            heading: 'Ayúdanos a mejorar Smart LTL', intro: 'Reporta un problema o sugiere una mejora.',
            category: 'Tipo de comentario', bug: 'Error', idea: 'Sugerencia', other: 'Otro',
            title: 'Resumen breve', message: '¿Qué ocurrió o qué cambiarías?',
            steps: 'Pasos para reproducir (opcional)', email: 'Correo para responder (opcional)',
            include: 'Incluir solo el ID de la cotización actual', send: 'Enviar comentario', close: 'Cerrar',
            privacy: 'No incluyas nombres, direcciones, tarifas, contraseñas ni datos sensibles. Solo enviamos este formulario, la interfaz/idioma y el ID si lo seleccionas. Los reportes se conservan hasta 90 días.',
            limits: 'Hasta 5 reportes por hora y 15 por día por navegador. También hay límites por red compartida y del servicio.',
            unavailable: 'El servicio de comentarios aún no está conectado. No se ha enviado nada.',
            sending: 'Enviando…', failed: 'No pudimos confirmar el envío. El texto sigue aquí; vuelve a intentarlo.',
            success: 'Comentario recibido. Referencia:', duplicate: 'Ya fue recibido. Referencia:',
            rate: 'Se alcanzó el límite de comentarios. Intenta de nuevo en', seconds: 'segundos.',
            expired: 'La verificación expiró. Vuelve a pulsar Enviar comentario.',
            invalid: 'Revisa los campos del formulario e intenta de nuevo.', busy: 'El servicio no está disponible temporalmente. Tu texto se conservó.'
        }
    };
    let dialog, form, status, send, challenge, inflight = false, returnFocus, clientId;
    const lang = () => typeof currentLang !== 'undefined' && currentLang === 'es' ? 'es' : 'en';
    const text = () => copy[lang()];
    function endpoint() {
        try {
            const value = window.LTL_FEEDBACK_CONFIG?.endpoint;
            if (!value) return null;
            const url = new URL(value);
            if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return null;
            if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
            return url.origin;
        } catch { return null; }
    }
    function identity() {
        if (clientId) return clientId;
        try { clientId = localStorage.getItem('ltl-feedback-client-v1'); } catch { /* Storage unavailable. */ }
        if (!/^[a-f0-9]{32}$/.test(clientId || '')) {
            clientId = [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
            try { localStorage.setItem('ltl-feedback-client-v1', clientId); } catch { /* Network limits remain enforced. */ }
        }
        return clientId;
    }
    async function request(path, body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(endpoint() + path, { method: 'POST', mode: 'cors', credentials: 'omit',
                referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body), signal: controller.signal });
            const data = await response.json();
            if (!response.ok) {
                const error = new Error(data.error || 'failed');
                error.status = response.status;
                error.retry = Number(response.headers.get('Retry-After') || data.retryAfter || 0);
                throw error;
            }
            return data;
        } finally { clearTimeout(timeout); }
    }
    async function getChallenge() {
        if (challenge && challenge.expires > Date.now()) return challenge;
        const data = await request('/v1/challenge', { clientId: identity() });
        if (typeof data.token !== 'string' || !Number.isFinite(data.waitSeconds) || !Number.isFinite(data.expiresIn)) throw new Error('bad_challenge');
        challenge = { token: data.token, ready: Date.now() + Math.max(0, Math.min(10, data.waitSeconds)) * 1000,
            expires: Date.now() + Math.min(600, data.expiresIn) * 1000 };
        return challenge;
    }
    function label() {
        const t = text();
        dialog.querySelectorAll('[data-feedback-copy]').forEach(el => { el.textContent = t[el.dataset.feedbackCopy]; });
        send.textContent = inflight ? t.sending : t.send;
        if (!endpoint()) { status.textContent = t.unavailable; send.disabled = true; }
    }
    function create() {
        dialog = document.createElement('dialog'); dialog.id = 'ltlFeedback'; dialog.className = 'ltl-dialog';
        dialog.setAttribute('aria-labelledby', 'ltlFeedbackTitle');
        dialog.innerHTML = `<div class="ltl-dialog-head"><div><span class="ltl-eyebrow">SMART LTL / FEEDBACK</span>
            <h2 id="ltlFeedbackTitle" data-feedback-copy="heading"></h2></div><button type="button" class="ltl-close" data-feedback-copy="close"></button></div>
            <p data-feedback-copy="intro"></p><form id="ltlFeedbackForm">
            <label><span data-feedback-copy="category"></span><select name="category"><option value="bug" data-feedback-copy="bug"></option><option value="idea" data-feedback-copy="idea"></option><option value="other" data-feedback-copy="other"></option></select></label>
            <label><span data-feedback-copy="title"></span><input name="title" required minlength="5" maxlength="120" autocomplete="off"></label>
            <label><span data-feedback-copy="message"></span><textarea name="message" required minlength="10" maxlength="3000" rows="4"></textarea></label>
            <details><summary data-feedback-copy="steps"></summary><textarea name="steps" maxlength="2000" rows="3" aria-label="Steps / Pasos"></textarea></details>
            <label><span data-feedback-copy="email"></span><input name="email" type="email" maxlength="254" autocomplete="email"></label>
            <label class="ltl-check"><input name="includeQuote" type="checkbox"><span data-feedback-copy="include"></span></label>
            <div class="ltl-honeypot" aria-hidden="true"><label>Leave empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
            <p class="ltl-small" data-feedback-copy="privacy"></p><p class="ltl-small" data-feedback-copy="limits"></p>
            <p class="ltl-feedback-status" role="status" aria-live="polite"></p>
            <div class="ltl-actions"><button class="ltl-primary" type="submit" data-feedback-copy="send"></button></div></form>`;
        document.body.append(dialog);
        form = dialog.querySelector('form'); status = dialog.querySelector('[role="status"]'); send = form.querySelector('[type="submit"]');
        dialog.querySelector('.ltl-close').onclick = () => dialog.close();
        dialog.addEventListener('close', () => returnFocus?.focus());
        form.addEventListener('submit', submit);
    }
    async function submit(event) {
        event.preventDefault();
        if (inflight || !form.reportValidity()) return;
        if (!endpoint()) { status.textContent = text().unavailable; return; }
        inflight = true; send.disabled = true; send.textContent = text().sending;
        status.textContent = ''; status.removeAttribute('data-success');
        try {
            const values = new FormData(form);
            const token = await getChallenge();
            const wait = Math.max(0, token.ready - Date.now());
            if (wait) await new Promise(resolve => setTimeout(resolve, wait));
            const quoteId = values.get('includeQuote') && typeof appQuotes !== 'undefined' && /^\d{1,20}$/.test(appQuotes[0]?.id || '') ? String(appQuotes[0].id) : '';
            const data = await request('/v1/feedback', { clientId: identity(), token: token.token,
                category: values.get('category'), title: values.get('title'), message: values.get('message'),
                steps: values.get('steps'), email: values.get('email'), website: values.get('website'),
                interface: window.LTLInterface?.current || 'workspace', language: lang(), quoteId });
            if (!/^FB-[A-F0-9]{16}$/.test(data.id || '')) throw new Error('invalid_receipt');
            status.textContent = `${data.duplicate ? text().duplicate : text().success} ${data.id}`;
            status.dataset.success = 'true';
            form.reset(); challenge = null;
        } catch (error) {
            const t = text();
            if (error.status === 429) status.textContent = `${t.rate} ${Math.max(1, Math.ceil(error.retry))} ${t.seconds}`;
            else if (error.message === 'expired_or_invalid_challenge' || error.status === 409) { challenge = null; status.textContent = t.expired; }
            else if (error.status === 400 || error.status === 413) status.textContent = t.invalid;
            else if (error.status === 503) status.textContent = t.busy;
            else status.textContent = t.failed;
        } finally { inflight = false; send.disabled = !endpoint(); send.textContent = text().send; }
    }
    function open() {
        if (!dialog) create();
        returnFocus = document.activeElement;
        label();
        if (!dialog.open) dialog.showModal();
    }
    window.openBugReport = open;
    window.closeBugReport = () => dialog?.close();
    window.openBugForm = open; // Retire the unrestricted external Google Form path in both UIs.
    window.LTLFeedback = { open };
})();
