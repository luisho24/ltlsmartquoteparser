/* Administration uses same-origin, HttpOnly sessions. User content is text, never HTML. */
'use strict';
const $ = id => document.getElementById(id);
const state = { csrf: '', config: null, view: 'messages', page: 1, messages: [], query: {}, devices: [], dirty: false };
const titles = {
    messages: ['Mensajes', 'Escucha a tus usuarios y da seguimiento a cada comentario.'],
    devices: ['Dispositivos', 'Un ID por navegador. Consulta su última conexión y administra su acceso.'],
    carriers: ['Carriers y logos', 'Administra nombres, códigos, alias y la imagen de cada transportista.'],
    filters: ['Filtros de destino', 'Define qué carriers están permitidos en cada tipo de destino.'],
    rules: ['Reglas y límites', 'Edita reglas de mercancías, advertencias y límites de liftgate.'],
    features: ['Funciones', 'Controla qué funciones están disponibles en la herramienta.'],
    audit: ['Historial', 'Revisa los cambios administrativos y restaura configuraciones anteriores.']
};
const statusNames = { new: 'Nuevo', reviewing: 'En revisión', resolved: 'Resuelto', archived: 'Archivado' };
function node(tag, text, cls) { const el = document.createElement(tag); if (text !== undefined && text !== null) el.textContent = text; if (cls) el.className = cls; return el; }
function button(text, action, cls = '') { const el = node('button', text, cls); el.type = 'button'; el.onclick = action; return el; }
function toast(message, error = false) { $('toast').textContent = message; $('toast').className = error ? 'visible error-toast' : 'visible'; setTimeout(() => $('toast').className = '', 6000); }
async function api(path, method = 'GET', data) {
    const response = await fetch('/admin/api/' + path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRF-Token': state.csrf } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) {
        if (response.status === 401 && !['login', 'setup'].includes(path)) showAuth();
        const errors = { login_required: 'Inicia sesión para continuar.', invalid_credentials: 'Usuario o contraseña incorrectos.', invalid_setup_link: 'El enlace inicial no es válido o ya venció.', already_configured: 'La cuenta inicial ya existe. Ingresa con tu usuario y contraseña.', configuration_changed_reload: 'Otra sesión modificó la configuración. Actualiza antes de volver a guardar.', logo_requires_https: 'El logo debe ser una URL HTTPS.', configuration_must_be_plain_text: 'Las reglas y nombres deben ser texto sin etiquetas HTML.', rate_limited: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.', invalid_text: 'Revisa la longitud de los campos. La contraseña requiere al menos 12 caracteres.' };
        throw new Error(errors[result.error] || 'No se pudo guardar: ' + (result.error || response.status));
    }
    return result;
}
const formatDate = seconds => new Date(seconds * 1000).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const dateShort = seconds => new Date(seconds * 1000).toLocaleDateString('es-CO');
function badge(text, cls) { return node('span', text, 'status ' + (cls || '')); }
function empty(title, description) { const wrap = node('div', null, 'empty'); wrap.append(node('h2', title), node('p', description)); return wrap; }
function table(headers) { const scroll = node('div', null, 'table-scroll'), grid = node('table'), head = node('thead'), tr = node('tr'), body = node('tbody'); headers.forEach(text => tr.append(node('th', text))); head.append(tr); grid.append(head, body); scroll.append(grid); return { scroll, body, labels: headers }; }
function appendRow(grid, tr) { [...tr.children].forEach((td, index) => td.dataset.label = grid.labels[index] || ''); grid.body.append(tr); }
function cell(tr, ...items) { const td = node('td'); items.forEach(item => td.append(typeof item === 'string' ? document.createTextNode(item) : item)); tr.append(td); return td; }
function panel() { const el = node('section', null, 'panel'); $('content').replaceChildren(el); return el; }
function toolbarAction(description, label, action) { const el = node('div', null, 'actions-row'); el.append(node('p', description), button(label, action, 'primary')); $('content').append(el); }
function inputField(parent, label, value = '', type = 'text') { const wrap = node('label', label), input = node(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input'); if (!['textarea', 'select'].includes(type)) input.type = type; if (type === 'checkbox') input.checked = !!value; else input.value = value; wrap.append(input); parent.append(wrap); return input; }
function choose(parent, label, choices, selected) { const input = inputField(parent, label, '', 'select'); choices.forEach(([value, text]) => { const option = node('option', text); option.value = value; input.append(option); }); input.value = selected; return input; }
function openEditor(title, build, save) {
    $('editor-title').textContent = title; $('editor-fields').replaceChildren(); $('editor-error').textContent = '';
    const fields = build($('editor-fields'));
    $('editor-form').onsubmit = async event => {
        event.preventDefault(); const submit = event.submitter; if (submit) submit.disabled = true;
        try { await save(fields); $('editor').close(); toast('Cambios guardados.'); await renderView(); }
        catch (error) { $('editor-error').textContent = error.message; }
        finally { if (submit) submit.disabled = false; }
    };
    $('editor').showModal();
}
function showAuth() {
    $('auth').hidden = false; $('app').hidden = true; $('logout').hidden = true;
    const setup = new URLSearchParams(location.hash.slice(1)).has('setup');
    $('auth-title').textContent = setup ? 'Configura tu acceso privado' : 'Tu espacio de administración';
    $('auth-intro').textContent = setup ? 'Crea la cuenta que administrará Smart LTL. Tú eliges la contraseña.' : 'Ingresa para revisar comentarios y administrar Smart LTL.';
    $('setup-note').hidden = !setup; $('password').autocomplete = setup ? 'new-password' : 'current-password';
    $('login-submit').textContent = setup ? 'Crear cuenta y entrar' : 'Entrar al panel';
}
async function startSession(session) {
    state.csrf = session.csrf; state.config = await api('config');
    $('auth').hidden = true; $('app').hidden = false; $('logout').hidden = false;
    if (location.hash) history.replaceState(null, '', location.pathname);
    await renderView();
}
$('login-form').onsubmit = async event => {
    event.preventDefault(); $('login-submit').disabled = true; $('login-error').textContent = '';
    const token = new URLSearchParams(location.hash.slice(1)).get('setup');
    try { const session = await api(token ? 'setup' : 'login', 'POST', { username: $('username').value, password: $('password').value, ...(token ? { token } : {}) }); $('password').value = ''; await startSession(session); }
    catch (error) { $('login-error').textContent = error.message; }
    finally { $('login-submit').disabled = false; }
};
$('logout').onclick = async () => { try { await api('logout', 'POST', {}); state.csrf = ''; state.messages = []; $('content').replaceChildren(); showAuth(); } catch (error) { toast(error.message, true); } };
document.querySelectorAll('[data-view]').forEach(item => item.onclick = async () => { state.view = item.dataset.view; state.page = 1; await renderView(); });
$('mobile-nav').onchange = async event => { state.view = event.target.value; state.page = 1; await renderView(); };
$('refresh').onclick = async () => { try { state.config = await api('config'); await renderView(); } catch (error) { toast(error.message, true); } };
$('editor-close').onclick = $('editor-cancel').onclick = () => $('editor').close();

async function renderView() {
    $('mobile-nav').value = state.view;
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === state.view));
    $('page-title').textContent = titles[state.view][0]; $('page-subtitle').textContent = titles[state.view][1];
    $('revision').textContent = 'Configuración · revisión ' + state.config.revision;
    try { await ({ messages: renderMessages, devices: renderDevices, carriers: renderCarriers, filters: renderFilters, rules: renderRules, features: renderFeatures, audit: renderAudit }[state.view])(); }
    catch (error) { toast(error.message, true); }
}
async function renderMessages() {
    const query = new URLSearchParams({ ...state.query, page: state.page });
    const result = await api('messages?' + query); state.messages = result.messages;
    const wrap = panel(), controls = node('form', null, 'toolbar');
    const search = inputField(controls, 'Buscar mensajes', state.query.q || '', 'search'); search.parentElement.className = 'search-label'; search.placeholder = 'Texto, nombre o referencia';
    const status = choose(controls, 'Estado', [['', 'Todos'], ...Object.entries(statusNames)], state.query.status || '');
    const category = choose(controls, 'Tipo', [['', 'Todos'], ['bug', 'Error'], ['idea', 'Sugerencia'], ['other', 'Otro']], state.query.category || '');
    const after = inputField(controls, 'Desde', state.query.after ? new Date(Number(state.query.after) * 1000).toISOString().slice(0, 10) : '', 'date');
    const before = inputField(controls, 'Hasta', state.query.before ? new Date(Number(state.query.before) * 1000).toISOString().slice(0, 10) : '', 'date');
    const submit = node('button', 'Aplicar'); submit.type = 'submit'; controls.append(submit);
    controls.onsubmit = async event => { event.preventDefault(); state.query = { q: search.value, status: status.value, category: category.value }; if (after.value) state.query.after = String(new Date(after.value + 'T00:00:00').getTime() / 1000); if (before.value) state.query.before = String(new Date(before.value + 'T23:59:59').getTime() / 1000); state.page = 1; await renderMessages(); };
    if (state.query.device) controls.append(button('Quitar filtro de dispositivo', async () => { delete state.query.device; await renderMessages(); }));
    wrap.append(controls);
    if (!result.messages.length) { wrap.append(empty('No hay mensajes en esta vista', 'Los comentarios aparecerán aquí cuando alguien los envíe desde la herramienta. También puedes ajustar los filtros.')); }
    else {
        const grid = table(['Comentario', 'Persona / dispositivo', 'Estado', 'Recibido', '']);
        for (const message of result.messages) {
            const tr = node('tr'), summary = node('div', null, 'wrap'); summary.append(node('strong', message.payload.title), node('div', ({ bug: 'Error', idea: 'Sugerencia', other: 'Otro' })[message.payload.category], 'sub'));
            cell(tr, summary); const author = node('div'); author.append(node('span', message.payload.name || 'Sin nombre'), node('div', message.displayId, 'sub code-id')); cell(tr, author);
            cell(tr, badge(statusNames[message.status], message.status)); cell(tr, formatDate(message.created));
            cell(tr, button('Abrir', () => editMessage(message))); appendRow(grid, tr);
        }
        wrap.append(grid.scroll);
    }
    const pager = node('div', null, 'pagination'), buttons = node('div', null, 'table-actions');
    const previous = button('Anterior', async () => { state.page--; await renderMessages(); }); previous.disabled = state.page <= 1;
    const next = button('Siguiente', async () => { state.page++; await renderMessages(); }); next.disabled = state.page * 50 >= result.total;
    buttons.append(previous, next); pager.append(node('span', result.total + ' mensajes · página ' + result.page), buttons); wrap.append(pager);
}
function editMessage(message) {
    openEditor(message.id, parent => {
        parent.append(node('p', (message.payload.name || 'Sin nombre') + ' · ' + message.displayId + ' · ' + formatDate(message.created), 'detail'));
        if (message.payload.email) parent.append(node('p', message.payload.email, 'detail'));
        if (message.payload.quoteId) parent.append(node('p', 'Cotización: ' + message.payload.quoteId, 'detail'));
        if (message.payload.steps) parent.append(node('p', 'Pasos: ' + message.payload.steps, 'detail'));
        return { title: inputField(parent, 'Resumen', message.payload.title), message: inputField(parent, 'Mensaje', message.payload.message, 'textarea'), status: choose(parent, 'Estado', Object.entries(statusNames), message.status), priority: choose(parent, 'Prioridad', [['low', 'Baja'], ['normal', 'Normal'], ['high', 'Alta']], message.priority), notes: inputField(parent, 'Notas internas (no se publican)', message.notes, 'textarea') };
    }, async fields => { await api('messages/' + message.id, 'PUT', Object.fromEntries(Object.entries(fields).map(([key, el]) => [key, el.value]))); });
}
async function renderDevices() {
    const result = await api('devices'); state.devices = result.devices;
    const wrap = panel();
    if (!result.devices.length) { wrap.append(empty('Todavía no hay dispositivos', 'Cada navegador recibe un ID al abrir la herramienta conectada. El nombre es opcional y no se recopilan identificadores del equipo.')); return; }
    const grid = table(['Dispositivo', 'Nombre', 'Actividad', 'Acceso', '']);
    for (const device of result.devices) {
        const tr = node('tr'); cell(tr, node('span', device.displayId, 'code-id')); cell(tr, device.name || 'Sin nombre');
        const activity = node('div'); activity.append(badge(Date.now() / 1000 - device.lastSeen < 180 ? 'Reciente' : 'Sin actividad reciente'), node('div', formatDate(device.lastSeen), 'sub')); cell(tr, activity);
        cell(tr, badge(device.enabled ? 'Activo' : 'Bloqueado', device.enabled ? '' : 'blocked'));
        const actions = node('div', null, 'table-actions'); actions.append(button('Editar', () => openEditor(device.displayId, parent => ({ name: inputField(parent, 'Nombre del dispositivo', device.name), enabled: inputField(parent, 'Permitir acceso', device.enabled, 'checkbox') }), async fields => api('devices/' + device.id, 'PUT', { name: fields.name.value, enabled: fields.enabled.checked }))), button('Mensajes', async () => { state.query = { device: device.id }; state.view = 'messages'; state.page = 1; await renderView(); }));
        cell(tr, actions); appendRow(grid, tr);
    }
    wrap.append(grid.scroll);
}
async function saveConfig(candidate) { state.config = await api('config', 'PUT', candidate); }
function renderCarriers() {
    $('content').replaceChildren(); toolbarAction('Los alias relacionan nombres o códigos con el mismo carrier. Desactivar un carrier lo excluye de las opciones de envío.', 'Agregar carrier', () => editCarrier());
    const wrap = node('section', null, 'panel'), controls = node('div', null, 'toolbar');
    const search = inputField(controls, 'Buscar carrier o alias', '', 'search'); search.parentElement.className = 'search-label'; wrap.append(controls); $('content').append(wrap);
    const grid = table(['Logo', 'Carrier / alias', 'Disponibilidad', '']); wrap.append(grid.scroll);
    function rows() {
        grid.body.replaceChildren();
        for (const carrier of state.config.carriers.filter(c => (c.name + ' ' + c.aliases.join(' ')).toLowerCase().includes(search.value.toLowerCase()))) {
            const tr = node('tr'), imageCell = cell(tr, '');
            if (carrier.logoUrl) { const img = node('img'); img.src = carrier.logoUrl; img.alt = carrier.name; img.className = 'carrier-logo'; img.referrerPolicy = 'no-referrer'; img.onerror = () => img.replaceWith(node('span', 'Sin imagen', 'sub')); imageCell.append(img); }
            const info = node('div'); info.append(node('strong', carrier.name), node('div', carrier.aliases.join(' · ') || 'Sin alias adicionales', 'sub wrap')); cell(tr, info); cell(tr, badge(carrier.enabled ? 'Activo' : 'Desactivado', carrier.enabled ? '' : 'off'));
            cell(tr, button('Editar', () => editCarrier(carrier))); appendRow(grid, tr);
        }
    }
    search.oninput = rows; rows();
}
function editCarrier(carrier) {
    openEditor(carrier ? 'Editar carrier' : 'Agregar carrier', parent => {
        const fields = { name: inputField(parent, 'Nombre', carrier?.name || ''), aliases: inputField(parent, 'Códigos y alias (uno por línea)', (carrier?.aliases || []).join('\n'), 'textarea'), logoUrl: inputField(parent, 'URL HTTPS del logo', carrier?.logoUrl || '', 'url'), enabled: inputField(parent, 'Carrier activo', carrier?.enabled !== false, 'checkbox') };
        const upload = inputField(parent, 'O subir un logo PNG (hasta 60 KB, máximo 512 × 512 px)', '', 'file'); upload.accept = 'image/png';
        upload.onchange = async () => { try { const file = upload.files[0]; if (!file) return; if (file.size > 60000) throw new Error('La imagen debe pesar menos de 60 KB.'); const raw = new Uint8Array(await file.arrayBuffer()); let binary = ''; raw.forEach(v => binary += String.fromCharCode(v)); const result = await api('logos', 'POST', { png: btoa(binary) }); fields.logoUrl.value = result.url; toast('Logo subido. Guarda el carrier para aplicarlo.'); } catch (error) { $('editor-error').textContent = error.message; } };
        return fields;
    }, async fields => {
        const candidate = structuredClone(state.config), next = { id: carrier?.id || 'carrier-' + crypto.randomUUID(), name: fields.name.value, aliases: fields.aliases.value.split('\n').map(v => v.trim()).filter(Boolean), logoUrl: fields.logoUrl.value, enabled: fields.enabled.checked };
        if (carrier && carrier.name !== next.name && !next.aliases.includes(carrier.name)) next.aliases.push(carrier.name);
        if (carrier) candidate.carriers[candidate.carriers.findIndex(c => c.id === carrier.id)] = next; else candidate.carriers.push(next);
        await saveConfig(candidate);
    });
}
function renderFilters() {
    $('content').replaceChildren(); toolbarAction('Solo se permiten los carriers de cada lista. Las exclusiones tienen prioridad. Puedes desactivar un filtro sin perder su configuración.', 'Agregar filtro', () => editFilter());
    const wrap = node('section', null, 'panel'), grid = table(['Destino', 'Carriers permitidos', 'Excluidos', 'Estado', '']); $('content').append(wrap);
    for (const filter of state.config.filters) {
        const tr = node('tr'); cell(tr, node('strong', filter.label)); cell(tr, node('span', filter.allowed.join(', ') || 'Ninguno', 'wrap')); cell(tr, node('span', filter.blocked.join(', ') || 'Ninguno', 'wrap')); cell(tr, badge(filter.enabled ? 'Activo' : 'Desactivado', filter.enabled ? '' : 'off')); cell(tr, button('Editar', () => editFilter(filter))); appendRow(grid, tr);
    }
    wrap.append(grid.scroll);
}
function editFilter(filter) {
    openEditor(filter ? 'Editar filtro de destino' : 'Agregar filtro de destino', parent => ({ label: inputField(parent, 'Nombre', filter?.label || ''), allowed: inputField(parent, 'Carriers permitidos (nombre, alias o código; uno por línea)', (filter?.allowed || []).join('\n'), 'textarea'), blocked: inputField(parent, 'Carriers excluidos (uno por línea)', (filter?.blocked || []).join('\n'), 'textarea'), notes: inputField(parent, 'Notas por carrier (JSON)', JSON.stringify(filter?.notes || {}, null, 2), 'textarea'), enabled: inputField(parent, 'Filtro activo', filter?.enabled !== false, 'checkbox') }), async fields => {
        const candidate = structuredClone(state.config), next = { id: filter?.id || 'dest-' + crypto.randomUUID(), label: fields.label.value, allowed: fields.allowed.value.split('\n').map(v => v.trim()).filter(Boolean), blocked: fields.blocked.value.split('\n').map(v => v.trim()).filter(Boolean), notes: JSON.parse(fields.notes.value), enabled: fields.enabled.checked };
        if (filter) candidate.filters[candidate.filters.findIndex(f => f.id === filter.id)] = next; else candidate.filters.push(next);
        await saveConfig(candidate);
    });
}
function renderRules() {
    const wrap = panel(), editor = node('div', null, 'rule-editor'); wrap.append(editor);
    editor.append(node('p', 'Edición avanzada de las reglas existentes. Las listas y límites se validan antes de publicar; cada cambio conserva una versión anterior en Historial.', 'helper'));
    const names = { tobacco: 'Tabaco', alcohol: 'Alcohol', vape: 'Vape', firearms: 'Armas y municiones', liftgate: 'Liftgate: dimensiones y peso', cubic: 'Capacidad cúbica y sobrelargo' };
    const group = choose(editor, 'Grupo de reglas', Object.entries(names), 'liftgate');
    const text = inputField(editor, 'Configuración JSON', JSON.stringify(state.config.rules.liftgate, null, 2), 'textarea');
    group.onchange = () => text.value = JSON.stringify(state.config.rules[group.value], null, 2);
    editor.append(button('Guardar reglas', async () => { try { const candidate = structuredClone(state.config); candidate.rules[group.value] = JSON.parse(text.value); await saveConfig(candidate); toast('Reglas publicadas.'); } catch (error) { toast(error.message, true); } }, 'primary'));
}
function renderFeatures() {
    const wrap = panel(), list = node('div', null, 'feature-list'), switches = {};
    const names = { feedback: ['Recepción de feedback', 'Permite enviar nuevos mensajes. Los comentarios existentes se conservan.'], expeditedRates: ['Tarifas Expedited', 'Muestra las tarifas de camión completo urgente.'], volumeRates: ['Tarifas Volume', 'Muestra las alternativas de volumen.'], batchMode: ['Modo lote', 'Permite comparar y exportar varias cotizaciones.'], exportEmail: ['Exportación de correo', 'Permite copiar y previsualizar las tarifas para enviar.'], referenceLibrary: ['Biblioteca de referencia', 'Muestra la biblioteca de mercancías y referencias.'], insurance: ['Seguro adicional', 'Permite agregar la prima de seguro a la cotización.'], carrierLogos: ['Logos de carriers', 'Muestra los logos en la comparación y la exportación.'] };
    for (const [key, [title, description]] of Object.entries(names)) {
        const row = node('label', null, 'feature-row'), desc = node('div'); desc.append(node('h3', title), node('p', description)); const toggle = node('input'); toggle.type = 'checkbox'; toggle.checked = state.config.features[key]; switches[key] = toggle; row.append(desc, toggle); list.append(row);
    }
    const actions = node('div', null, 'feature-actions'); actions.append(button('Guardar funciones', async () => { try { const candidate = structuredClone(state.config); for (const [key, toggle] of Object.entries(switches)) candidate.features[key] = toggle.checked; await saveConfig(candidate); toast('Funciones actualizadas.'); } catch (error) { toast(error.message, true); } }, 'primary'));
    wrap.append(list, actions);
}
async function renderAudit() {
    const data = await api('audit'), wrap = panel(), grid = table(['Fecha', 'Administrador', 'Acción', 'Referencia']);
    if (!data.events.length) wrap.append(empty('Sin cambios todavía', 'Las acciones administrativas aparecerán aquí.'));
    for (const item of data.events) { const tr = node('tr'); cell(tr, formatDate(item.created)); cell(tr, item.actor); cell(tr, item.action); cell(tr, item.target); appendRow(grid, tr); }
    wrap.append(grid.scroll);
    if (data.revisions.length) {
        const history = node('div', null, 'rule-editor'); history.append(node('h2', 'Versiones anteriores'), node('p', 'Restaurar una versión crea una revisión nueva. No borra el historial.', 'helper'));
        const select = choose(history, 'Configuración guardada', data.revisions.map(r => [String(r.revision), 'Revisión ' + r.revision + ' · ' + formatDate(r.created)]), String(data.revisions[0].revision));
        history.append(button('Restaurar configuración', async () => { if (!confirm('¿Restaurar esta configuración para todos los dispositivos?')) return; try { state.config = await api('restore', 'POST', { revision: Number(select.value), currentRevision: state.config.revision }); toast('Configuración restaurada.'); await renderView(); } catch (error) { toast(error.message, true); } })); wrap.append(history);
    }
}
api('session').then(startSession).catch(showAuth);
