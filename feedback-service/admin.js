/* Administration uses same-origin, HttpOnly sessions. User content is text, never HTML. */
'use strict';
let adminLanguage = 'en';
try { if (localStorage.getItem('ltl-admin-language') === 'es') adminLanguage = 'es'; } catch {}
const requestedLanguage = new URLSearchParams(location.search).get('lang');
if (['en', 'es'].includes(requestedLanguage)) adminLanguage = requestedLanguage;
const adminSpanish = {"Messages": "Mensajes", "Listen to your users and follow up on every comment.": "Escucha a tus usuarios y da seguimiento a cada comentario.", "Devices": "Dispositivos", "One ID per browser. View recent activity and manage access.": "Un ID por navegador. Consulta su última conexión y administra su acceso.", "Carriers and logos": "Carriers y logos", "Manage carrier names, codes, aliases, and logos.": "Administra nombres, códigos, alias y la imagen de cada transportista.", "Destination filters": "Filtros de destino", "Choose which carriers are allowed for each destination type.": "Define qué carriers están permitidos en cada tipo de destino.", "Rules and limits": "Reglas y límites", "Edit commodity rules, warnings, and liftgate limits.": "Edita reglas de mercancías, advertencias y límites de liftgate.", "Features": "Funciones", "Control which features are available in the tool.": "Controla qué funciones están disponibles en la herramienta.", "History": "Historial", "Review administrative changes and restore previous configurations.": "Revisa los cambios administrativos y restaura configuraciones anteriores.", "New": "Nuevo", "In review": "En revisión", "Resolved": "Resuelto", "Archived": "Archivado", "Sign in to continue.": "Inicia sesión para continuar.", "Incorrect username or password.": "Usuario o contraseña incorrectos.", "The setup link is invalid or has expired.": "El enlace inicial no es válido o ya venció.", "The initial account already exists. Sign in with your username and password.": "La cuenta inicial ya existe. Ingresa con tu usuario y contraseña.", "Another session changed the configuration. Refresh before saving again.": "Otra sesión modificó la configuración. Actualiza antes de volver a guardar.", "The logo must use an HTTPS URL.": "El logo debe ser una URL HTTPS.", "Rules and names must be plain text without HTML tags.": "Las reglas y nombres deben ser texto sin etiquetas HTML.", "Too many attempts. Wait a few minutes and try again.": "Demasiados intentos. Espera unos minutos y vuelve a intentar.", "Check the field lengths. Your password needs at least 12 characters.": "Revisa la longitud de los campos. La contraseña requiere al menos 12 caracteres.", "Could not save: ": "No se pudo guardar: ", "Changes saved.": "Cambios guardados.", "Set up your private access": "Configura tu acceso privado", "Your administration workspace": "Tu espacio de administración", "Create the account that will manage Smart LTL. Choose your own password.": "Crea la cuenta que administrará Smart LTL. Tú eliges la contraseña.", "Sign in to review feedback and manage Smart LTL.": "Ingresa para revisar comentarios y administrar Smart LTL.", "Create account and sign in": "Crear cuenta y entrar", "Sign in": "Entrar al panel", "Configuration · revision ": "Configuración · revisión ", "Search messages": "Buscar mensajes", "Text, name, or reference": "Texto, nombre o referencia", "Status": "Estado", "All": "Todos", "Type": "Tipo", "Suggestion": "Sugerencia", "Other": "Otro", "From": "Desde", "To": "Hasta", "Apply": "Aplicar", "Clear device filter": "Quitar filtro de dispositivo", "No messages in this view": "No hay mensajes en esta vista", "Feedback will appear here when someone submits it from the tool. You can also adjust the filters.": "Los comentarios aparecerán aquí cuando alguien los envíe desde la herramienta. También puedes ajustar los filtros.", "Feedback": "Comentario", "Person / device": "Persona / dispositivo", "Received": "Recibido", "Unnamed": "Sin nombre", "Open": "Abrir", "Previous": "Anterior", "Next": "Siguiente", " messages · page ": " mensajes · página ", "Quote: ": "Cotización: ", "Steps: ": "Pasos: ", "Summary": "Resumen", "Message": "Mensaje", "Priority": "Prioridad", "Low": "Baja", "High": "Alta", "Internal notes (private)": "Notas internas (no se publican)", "No devices yet": "Todavía no hay dispositivos", "Each browser receives an ID when it opens the connected tool. Names are optional; hardware identifiers are not collected.": "Cada navegador recibe un ID al abrir la herramienta conectada. El nombre es opcional y no se recopilan identificadores del equipo.", "Device": "Dispositivo", "Name": "Nombre", "Activity": "Actividad", "Access": "Acceso", "Recent": "Reciente", "No recent activity": "Sin actividad reciente", "Active": "Activo", "Blocked": "Bloqueado", "Edit": "Editar", "Device name": "Nombre del dispositivo", "Allow access": "Permitir acceso", "Aliases match names or codes to the same carrier. Disabling a carrier excludes it from email options.": "Los alias relacionan nombres o códigos con el mismo carrier. Desactivar un carrier lo excluye de las opciones de envío.", "Add carrier": "Agregar carrier", "Search carrier or alias": "Buscar carrier o alias", "Availability": "Disponibilidad", "No image": "Sin imagen", "No additional aliases": "Sin alias adicionales", "Disabled": "Desactivado", "Edit carrier": "Editar carrier", "Codes and aliases (one per line)": "Códigos y alias (uno por línea)", "Logo HTTPS URL": "URL HTTPS del logo", "Carrier enabled": "Carrier activo", "Or upload a PNG logo (up to 60 KB, maximum 512 × 512 px)": "O subir un logo PNG (hasta 60 KB, máximo 512 × 512 px)", "The image must be smaller than 60 KB.": "La imagen debe pesar menos de 60 KB.", "Logo uploaded. Save the carrier to apply it.": "Logo subido. Guarda el carrier para aplicarlo.", "Only listed carriers are allowed. Exclusions take priority. Disable a filter without losing its settings.": "Solo se permiten los carriers de cada lista. Las exclusiones tienen prioridad. Puedes desactivar un filtro sin perder su configuración.", "Add filter": "Agregar filtro", "Destination": "Destino", "Allowed carriers": "Carriers permitidos", "Excluded": "Excluidos", "None": "Ninguno", "Edit destination filter": "Editar filtro de destino", "Add destination filter": "Agregar filtro de destino", "Allowed carriers (name, alias, or code; one per line)": "Carriers permitidos (nombre, alias o código; uno por línea)", "Excluded carriers (one per line)": "Carriers excluidos (uno por línea)", "Carrier notes (JSON)": "Notas por carrier (JSON)", "Filter enabled": "Filtro activo", "Advanced editing of existing rules. Lists and limits are validated before publishing; each change preserves a previous version in History.": "Edición avanzada de las reglas existentes. Las listas y límites se validan antes de publicar; cada cambio conserva una versión anterior en Historial.", "Tobacco": "Tabaco", "Firearms and ammunition": "Armas y municiones", "Liftgate: dimensions and weight": "Liftgate: dimensiones y peso", "Cubic capacity and overlength": "Capacidad cúbica y sobrelargo", "Rule group": "Grupo de reglas", "JSON configuration": "Configuración JSON", "Save rules": "Guardar reglas", "Rules published.": "Reglas publicadas.", "Feedback submissions": "Recepción de feedback", "Allow new feedback submissions. Existing messages are retained.": "Permite enviar nuevos mensajes. Los comentarios existentes se conservan.", "Expedited rates": "Tarifas Expedited", "Show expedited truckload rates.": "Muestra las tarifas de camión completo urgente.", "Volume rates": "Tarifas Volume", "Show volume rate options.": "Muestra las alternativas de volumen.", "Batch mode": "Modo lote", "Compare and export multiple quotes.": "Permite comparar y exportar varias cotizaciones.", "Email export": "Exportación de correo", "Copy and preview rates for email.": "Permite copiar y previsualizar las tarifas para enviar.", "Reference library": "Biblioteca de referencia", "Show the commodity and reference library.": "Muestra la biblioteca de mercancías y referencias.", "Additional insurance": "Seguro adicional", "Add an insurance premium to the quote.": "Permite agregar la prima de seguro a la cotización.", "Carrier logos": "Logos de carriers", "Show logos in comparisons and exports.": "Muestra los logos en la comparación y la exportación.", "Save features": "Guardar funciones", "Features updated.": "Funciones actualizadas.", "Date": "Fecha", "Administrator": "Administrador", "Action": "Acción", "Reference": "Referencia", "No changes yet": "Sin cambios todavía", "Administrative actions will appear here.": "Las acciones administrativas aparecerán aquí.", "Previous versions": "Versiones anteriores", "Restoring a version creates a new revision and preserves history.": "Restaurar una versión crea una revisión nueva. No borra el historial.", "Saved configuration": "Configuración guardada", "Revision ": "Revisión ", "Restore configuration": "Restaurar configuración", "Restore this configuration for all devices?": "¿Restaurar esta configuración para todos los dispositivos?", "Configuration restored.": "Configuración restaurada.", "Administration": "Administración", "Skip to content": "Saltar al contenido", "Open tool ↗": "Abrir herramienta ↗", "Sign out": "Cerrar sesión", "Username": "Usuario", "Password": "Contraseña", "Choose a password with at least 12 characters. This link can only create the initial account once.": "Elige una contraseña de al menos 12 caracteres. Este enlace solo permite crear la cuenta inicial una vez.", "Messages and device details are only available after signing in.": "Los mensajes y datos de los dispositivos solo están disponibles después de iniciar sesión.", "Section": "Sección", "Panel section": "Sección del panel", "Connected to PartsPilot": "Conectado a PartsPilot", "Published changes sync with the tool.": "Los cambios publicados se sincronizan con la herramienta.", "Refresh": "Actualizar", "Close editor": "Cerrar editor", "Cancel": "Cancelar", "Save changes": "Guardar cambios"};
Object.assign(adminSpanish, {'Change password':'Cambiar contraseña','Change your password':'Cambia tu contraseña','Choose a private password with at least 12 characters.':'Elige una contraseña privada de al menos 12 caracteres.','Current password':'Contraseña actual','New password':'Nueva contraseña','Confirm new password':'Confirma la nueva contraseña','Save password':'Guardar contraseña','Replace the temporary password before using the panel.':'Reemplaza la contraseña provisional antes de usar el panel.','Passwords do not match.':'Las contraseñas no coinciden.','Current password is incorrect.':'La contraseña actual es incorrecta.','Choose a different password.':'Elige una contraseña diferente.','Password updated.':'Contraseña actualizada.'});
function T(text) { return adminLanguage === 'es' ? (adminSpanish[text] || text) : text; }
document.documentElement.lang = adminLanguage;
document.title = 'Smart LTL · ' + T('Administration');
const staticText = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (staticText.nextNode()) {
    const item = staticText.currentNode, value = item.nodeValue.trim();
    if (adminSpanish[value]) item.nodeValue = item.nodeValue.replace(value, T(value));
}
for (const element of document.querySelectorAll('[aria-label]')) element.setAttribute('aria-label', T(element.getAttribute('aria-label')));
const languagePicker = document.getElementById('admin-language');
languagePicker.value = adminLanguage;
languagePicker.onchange = () => {
    try { localStorage.setItem('ltl-admin-language', languagePicker.value); } catch {}
    const next = new URL(location.href); next.searchParams.set('lang', languagePicker.value); location.href = next.href;
};

const $ = id => document.getElementById(id);
const state = { csrf: '', config: null, view: 'messages', page: 1, messages: [], query: {}, devices: [], dirty: false };
const titles = {
    messages: [T("Messages"), T("Listen to your users and follow up on every comment.")],
    devices: [T("Devices"), T("One ID per browser. View recent activity and manage access.")],
    carriers: [T("Carriers and logos"), T("Manage carrier names, codes, aliases, and logos.")],
    filters: [T("Destination filters"), T("Choose which carriers are allowed for each destination type.")],
    rules: [T("Rules and limits"), T("Edit commodity rules, warnings, and liftgate limits.")],
    features: [T("Features"), T("Control which features are available in the tool.")],
    audit: [T("History"), T("Review administrative changes and restore previous configurations.")]
};
const statusNames = { new: T("New"), reviewing: T("In review"), resolved: T("Resolved"), archived: T("Archived") };
function node(tag, text, cls) { const el = document.createElement(tag); if (text !== undefined && text !== null) el.textContent = text; if (cls) el.className = cls; return el; }
function button(text, action, cls = '') { const el = node('button', text, cls); el.type = 'button'; el.onclick = action; return el; }
function toast(message, error = false) { $('toast').textContent = message; $('toast').className = error ? 'visible error-toast' : 'visible'; setTimeout(() => $('toast').className = '', 6000); }
async function api(path, method = 'GET', data) {
    const response = await fetch('/admin/api/' + path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRF-Token': state.csrf } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) {
        if (response.status === 401 && !['login', 'setup'].includes(path)) showAuth();
        const errors = { login_required: T("Sign in to continue."), invalid_credentials: T("Incorrect username or password."), invalid_setup_link: T("The setup link is invalid or has expired."), already_configured: T("The initial account already exists. Sign in with your username and password."), configuration_changed_reload: T("Another session changed the configuration. Refresh before saving again."), logo_requires_https: T("The logo must use an HTTPS URL."), configuration_must_be_plain_text: T("Rules and names must be plain text without HTML tags."), rate_limited: T("Too many attempts. Wait a few minutes and try again."), invalid_text: T("Check the field lengths. Your password needs at least 12 characters.") };
        const failure = new Error(errors[result.error] || T("Could not save: ") + (result.error || response.status)); failure.code = result.error; throw failure;
    }
    return result;
}
const formatDate = seconds => new Date(seconds * 1000).toLocaleString(adminLanguage === 'es' ? 'es-CO' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
const dateShort = seconds => new Date(seconds * 1000).toLocaleDateString(adminLanguage === 'es' ? 'es-CO' : 'en-US');
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
        try { await save(fields); $('editor').close(); toast(T("Changes saved.")); await renderView(); }
        catch (error) { $('editor-error').textContent = error.message; }
        finally { if (submit) submit.disabled = false; }
    };
    $('editor').showModal();
}
function showAuth() {
    $('auth').hidden = false; $('app').hidden = true; $('password-panel').hidden = true; $('change-password').hidden = true; $('logout').hidden = true;
    const setup = new URLSearchParams(location.hash.slice(1)).has('setup');
    $('auth-title').textContent = setup ? T("Set up your private access") : T("Your administration workspace");
    $('auth-intro').textContent = setup ? T("Create the account that will manage Smart LTL. Choose your own password.") : T("Sign in to review feedback and manage Smart LTL.");
    $('setup-note').hidden = !setup; $('password').autocomplete = setup ? 'new-password' : 'current-password';
    $('login-submit').textContent = setup ? T("Create account and sign in") : T("Sign in");
}
async function startSession(session) {
    state.csrf = session.csrf;
    if (session.requiresPasswordChange) { showPasswordChange(true); return; }
    $('password-panel').hidden = true; $('change-password').hidden = false;
    state.config = await api('config');
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
    $('revision').textContent = T("Configuration · revision ") + state.config.revision;
    try { await ({ messages: renderMessages, devices: renderDevices, carriers: renderCarriers, filters: renderFilters, rules: renderRules, features: renderFeatures, audit: renderAudit }[state.view])(); }
    catch (error) { toast(error.message, true); }
}
async function renderMessages() {
    const query = new URLSearchParams({ ...state.query, page: state.page });
    const result = await api('messages?' + query); state.messages = result.messages;
    const wrap = panel(), controls = node('form', null, 'toolbar');
    const search = inputField(controls, T("Search messages"), state.query.q || '', 'search'); search.parentElement.className = 'search-label'; search.placeholder = T("Text, name, or reference");
    const status = choose(controls, T("Status"), [['', T("All")], ...Object.entries(statusNames)], state.query.status || '');
    const category = choose(controls, T("Type"), [['', T("All")], ['bug', 'Error'], ['idea', T("Suggestion")], ['other', T("Other")]], state.query.category || '');
    const after = inputField(controls, T("From"), state.query.after ? new Date(Number(state.query.after) * 1000).toISOString().slice(0, 10) : '', 'date');
    const before = inputField(controls, T("To"), state.query.before ? new Date(Number(state.query.before) * 1000).toISOString().slice(0, 10) : '', 'date');
    const submit = node('button', T("Apply")); submit.type = 'submit'; controls.append(submit);
    controls.onsubmit = async event => { event.preventDefault(); state.query = { q: search.value, status: status.value, category: category.value }; if (after.value) state.query.after = String(new Date(after.value + 'T00:00:00').getTime() / 1000); if (before.value) state.query.before = String(new Date(before.value + 'T23:59:59').getTime() / 1000); state.page = 1; await renderMessages(); };
    if (state.query.device) controls.append(button(T("Clear device filter"), async () => { delete state.query.device; await renderMessages(); }));
    wrap.append(controls);
    if (!result.messages.length) { wrap.append(empty(T("No messages in this view"), T("Feedback will appear here when someone submits it from the tool. You can also adjust the filters."))); }
    else {
        const grid = table([T("Feedback"), T("Person / device"), T("Status"), T("Received"), '']);
        for (const message of result.messages) {
            const tr = node('tr'), summary = node('div', null, 'wrap'); summary.append(node('strong', message.payload.title), node('div', ({ bug: 'Error', idea: T("Suggestion"), other: T("Other") })[message.payload.category], 'sub'));
            cell(tr, summary); const author = node('div'); author.append(node('span', message.payload.name || T("Unnamed")), node('div', message.displayId, 'sub code-id')); cell(tr, author);
            cell(tr, badge(statusNames[message.status], message.status)); cell(tr, formatDate(message.created));
            cell(tr, button(T("Open"), () => editMessage(message))); appendRow(grid, tr);
        }
        wrap.append(grid.scroll);
    }
    const pager = node('div', null, 'pagination'), buttons = node('div', null, 'table-actions');
    const previous = button(T("Previous"), async () => { state.page--; await renderMessages(); }); previous.disabled = state.page <= 1;
    const next = button(T("Next"), async () => { state.page++; await renderMessages(); }); next.disabled = state.page * 50 >= result.total;
    buttons.append(previous, next); pager.append(node('span', result.total + T(" messages · page ") + result.page), buttons); wrap.append(pager);
}
function editMessage(message) {
    openEditor(message.id, parent => {
        parent.append(node('p', (message.payload.name || T("Unnamed")) + ' · ' + message.displayId + ' · ' + formatDate(message.created), 'detail'));
        if (message.payload.email) parent.append(node('p', message.payload.email, 'detail'));
        if (message.payload.quoteId) parent.append(node('p', T("Quote: ") + message.payload.quoteId, 'detail'));
        if (message.payload.steps) parent.append(node('p', T("Steps: ") + message.payload.steps, 'detail'));
        return { title: inputField(parent, T("Summary"), message.payload.title), message: inputField(parent, T("Message"), message.payload.message, 'textarea'), status: choose(parent, T("Status"), Object.entries(statusNames), message.status), priority: choose(parent, T("Priority"), [['low', T("Low")], ['normal', 'Normal'], ['high', T("High")]], message.priority), notes: inputField(parent, T("Internal notes (private)"), message.notes, 'textarea') };
    }, async fields => { await api('messages/' + message.id, 'PUT', Object.fromEntries(Object.entries(fields).map(([key, el]) => [key, el.value]))); });
}
async function renderDevices() {
    const result = await api('devices'); state.devices = result.devices;
    const wrap = panel();
    if (!result.devices.length) { wrap.append(empty(T("No devices yet"), T("Each browser receives an ID when it opens the connected tool. Names are optional; hardware identifiers are not collected."))); return; }
    const grid = table([T("Device"), T("Name"), T("Activity"), T("Access"), '']);
    for (const device of result.devices) {
        const tr = node('tr'); cell(tr, node('span', device.displayId, 'code-id')); cell(tr, device.name || T("Unnamed"));
        const activity = node('div'); activity.append(badge(Date.now() / 1000 - device.lastSeen < 180 ? T("Recent") : T("No recent activity")), node('div', formatDate(device.lastSeen), 'sub')); cell(tr, activity);
        cell(tr, badge(device.enabled ? T("Active") : T("Blocked"), device.enabled ? '' : 'blocked'));
        const actions = node('div', null, 'table-actions'); actions.append(button(T("Edit"), () => openEditor(device.displayId, parent => ({ name: inputField(parent, T("Device name"), device.name), enabled: inputField(parent, T("Allow access"), device.enabled, 'checkbox') }), async fields => api('devices/' + device.id, 'PUT', { name: fields.name.value, enabled: fields.enabled.checked }))), button(T("Messages"), async () => { state.query = { device: device.id }; state.view = 'messages'; state.page = 1; await renderView(); }));
        cell(tr, actions); appendRow(grid, tr);
    }
    wrap.append(grid.scroll);
}
async function saveConfig(candidate) { state.config = await api('config', 'PUT', candidate); }
function renderCarriers() {
    $('content').replaceChildren(); toolbarAction(T("Aliases match names or codes to the same carrier. Disabling a carrier excludes it from email options."), T("Add carrier"), () => editCarrier());
    const wrap = node('section', null, 'panel'), controls = node('div', null, 'toolbar');
    const search = inputField(controls, T("Search carrier or alias"), '', 'search'); search.parentElement.className = 'search-label'; wrap.append(controls); $('content').append(wrap);
    const grid = table(['Logo', 'Carrier / alias', T("Availability"), '']); wrap.append(grid.scroll);
    function rows() {
        grid.body.replaceChildren();
        for (const carrier of state.config.carriers.filter(c => (c.name + ' ' + c.aliases.join(' ')).toLowerCase().includes(search.value.toLowerCase()))) {
            const tr = node('tr'), imageCell = cell(tr, '');
            if (carrier.logoUrl) { const img = node('img'); img.src = carrier.logoUrl; img.alt = carrier.name; img.className = 'carrier-logo'; img.referrerPolicy = 'no-referrer'; img.onerror = () => img.replaceWith(node('span', T("No image"), 'sub')); imageCell.append(img); }
            const info = node('div'); info.append(node('strong', carrier.name), node('div', carrier.aliases.join(' · ') || T("No additional aliases"), 'sub wrap')); cell(tr, info); cell(tr, badge(carrier.enabled ? T("Active") : T("Disabled"), carrier.enabled ? '' : 'off'));
            cell(tr, button(T("Edit"), () => editCarrier(carrier))); appendRow(grid, tr);
        }
    }
    search.oninput = rows; rows();
}
function editCarrier(carrier) {
    openEditor(carrier ? T("Edit carrier") : T("Add carrier"), parent => {
        const fields = { name: inputField(parent, T("Name"), carrier?.name || ''), aliases: inputField(parent, T("Codes and aliases (one per line)"), (carrier?.aliases || []).join('\n'), 'textarea'), logoUrl: inputField(parent, T("Logo HTTPS URL"), carrier?.logoUrl || '', 'url'), enabled: inputField(parent, T("Carrier enabled"), carrier?.enabled !== false, 'checkbox') };
        const upload = inputField(parent, T("Or upload a PNG logo (up to 60 KB, maximum 512 × 512 px)"), '', 'file'); upload.accept = 'image/png';
        upload.onchange = async () => { try { const file = upload.files[0]; if (!file) return; if (file.size > 60000) throw new Error(T("The image must be smaller than 60 KB.")); const raw = new Uint8Array(await file.arrayBuffer()); let binary = ''; raw.forEach(v => binary += String.fromCharCode(v)); const result = await api('logos', 'POST', { png: btoa(binary) }); fields.logoUrl.value = result.url; toast(T("Logo uploaded. Save the carrier to apply it.")); } catch (error) { $('editor-error').textContent = error.message; } };
        return fields;
    }, async fields => {
        const candidate = structuredClone(state.config), next = { id: carrier?.id || 'carrier-' + crypto.randomUUID(), name: fields.name.value, aliases: fields.aliases.value.split('\n').map(v => v.trim()).filter(Boolean), logoUrl: fields.logoUrl.value, enabled: fields.enabled.checked };
        if (carrier && carrier.name !== next.name && !next.aliases.includes(carrier.name)) next.aliases.push(carrier.name);
        if (carrier) candidate.carriers[candidate.carriers.findIndex(c => c.id === carrier.id)] = next; else candidate.carriers.push(next);
        await saveConfig(candidate);
    });
}
function renderFilters() {
    $('content').replaceChildren(); toolbarAction(T("Only listed carriers are allowed. Exclusions take priority. Disable a filter without losing its settings."), T("Add filter"), () => editFilter());
    const wrap = node('section', null, 'panel'), grid = table([T("Destination"), T("Allowed carriers"), T("Excluded"), T("Status"), '']); $('content').append(wrap);
    for (const filter of state.config.filters) {
        const tr = node('tr'); cell(tr, node('strong', filter.label)); cell(tr, node('span', filter.allowed.join(', ') || T("None"), 'wrap')); cell(tr, node('span', filter.blocked.join(', ') || T("None"), 'wrap')); cell(tr, badge(filter.enabled ? T("Active") : T("Disabled"), filter.enabled ? '' : 'off')); cell(tr, button(T("Edit"), () => editFilter(filter))); appendRow(grid, tr);
    }
    wrap.append(grid.scroll);
}
function editFilter(filter) {
    openEditor(filter ? T("Edit destination filter") : T("Add destination filter"), parent => ({ label: inputField(parent, T("Name"), filter?.label || ''), allowed: inputField(parent, T("Allowed carriers (name, alias, or code; one per line)"), (filter?.allowed || []).join('\n'), 'textarea'), blocked: inputField(parent, T("Excluded carriers (one per line)"), (filter?.blocked || []).join('\n'), 'textarea'), notes: inputField(parent, T("Carrier notes (JSON)"), JSON.stringify(filter?.notes || {}, null, 2), 'textarea'), enabled: inputField(parent, T("Filter enabled"), filter?.enabled !== false, 'checkbox') }), async fields => {
        const candidate = structuredClone(state.config), next = { id: filter?.id || 'dest-' + crypto.randomUUID(), label: fields.label.value, allowed: fields.allowed.value.split('\n').map(v => v.trim()).filter(Boolean), blocked: fields.blocked.value.split('\n').map(v => v.trim()).filter(Boolean), notes: JSON.parse(fields.notes.value), enabled: fields.enabled.checked };
        if (filter) candidate.filters[candidate.filters.findIndex(f => f.id === filter.id)] = next; else candidate.filters.push(next);
        await saveConfig(candidate);
    });
}
function renderRules() {
    const wrap = panel(), editor = node('div', null, 'rule-editor'); wrap.append(editor);
    editor.append(node('p', T("Advanced editing of existing rules. Lists and limits are validated before publishing; each change preserves a previous version in History."), 'helper'));
    const names = { tobacco: T("Tobacco"), alcohol: 'Alcohol', vape: 'Vape', firearms: T("Firearms and ammunition"), liftgate: T("Liftgate: dimensions and weight"), cubic: T("Cubic capacity and overlength") };
    const group = choose(editor, T("Rule group"), Object.entries(names), 'liftgate');
    const text = inputField(editor, T("JSON configuration"), JSON.stringify(state.config.rules.liftgate, null, 2), 'textarea');
    group.onchange = () => text.value = JSON.stringify(state.config.rules[group.value], null, 2);
    editor.append(button(T("Save rules"), async () => { try { const candidate = structuredClone(state.config); candidate.rules[group.value] = JSON.parse(text.value); await saveConfig(candidate); toast(T("Rules published.")); } catch (error) { toast(error.message, true); } }, 'primary'));
}
function renderFeatures() {
    const wrap = panel(), list = node('div', null, 'feature-list'), switches = {};
    const names = { feedback: [T("Feedback submissions"), T("Allow new feedback submissions. Existing messages are retained.")], expeditedRates: [T("Expedited rates"), T("Show expedited truckload rates.")], volumeRates: [T("Volume rates"), T("Show volume rate options.")], batchMode: [T("Batch mode"), T("Compare and export multiple quotes.")], exportEmail: [T("Email export"), T("Copy and preview rates for email.")], referenceLibrary: [T("Reference library"), T("Show the commodity and reference library.")], insurance: [T("Additional insurance"), T("Add an insurance premium to the quote.")], carrierLogos: [T("Carrier logos"), T("Show logos in comparisons and exports.")] };
    for (const [key, [title, description]] of Object.entries(names)) {
        const row = node('label', null, 'feature-row'), desc = node('div'); desc.append(node('h3', title), node('p', description)); const toggle = node('input'); toggle.type = 'checkbox'; toggle.checked = state.config.features[key]; switches[key] = toggle; row.append(desc, toggle); list.append(row);
    }
    const actions = node('div', null, 'feature-actions'); actions.append(button(T("Save features"), async () => { try { const candidate = structuredClone(state.config); for (const [key, toggle] of Object.entries(switches)) candidate.features[key] = toggle.checked; await saveConfig(candidate); toast(T("Features updated.")); } catch (error) { toast(error.message, true); } }, 'primary'));
    wrap.append(list, actions);
}
async function renderAudit() {
    const data = await api('audit'), wrap = panel(), grid = table([T("Date"), T("Administrator"), T("Action"), T("Reference")]);
    if (!data.events.length) wrap.append(empty(T("No changes yet"), T("Administrative actions will appear here.")));
    for (const item of data.events) { const tr = node('tr'); cell(tr, formatDate(item.created)); cell(tr, item.actor); cell(tr, item.action); cell(tr, item.target); appendRow(grid, tr); }
    wrap.append(grid.scroll);
    if (data.revisions.length) {
        const history = node('div', null, 'rule-editor'); history.append(node('h2', T("Previous versions")), node('p', T("Restoring a version creates a new revision and preserves history."), 'helper'));
        const select = choose(history, T("Saved configuration"), data.revisions.map(r => [String(r.revision), T("Revision ") + r.revision + ' · ' + formatDate(r.created)]), String(data.revisions[0].revision));
        history.append(button(T("Restore configuration"), async () => { if (!confirm(T("Restore this configuration for all devices?"))) return; try { state.config = await api('restore', 'POST', { revision: Number(select.value), currentRevision: state.config.revision }); toast(T("Configuration restored.")); await renderView(); } catch (error) { toast(error.message, true); } })); wrap.append(history);
    }
}
function showPasswordChange(required = false) {
    $('auth').hidden = true; $('app').hidden = true; $('password-panel').hidden = false;
    $('logout').hidden = false; $('change-password').hidden = true; $('password-cancel').hidden = required;
    $('password-intro').textContent = T(required ? 'Replace the temporary password before using the panel.' : 'Choose a private password with at least 12 characters.');
    $('password-form').reset(); $('password-error').textContent = '';
}
$('change-password').onclick = () => showPasswordChange(false);
$('password-cancel').onclick = async () => { try { await startSession(await api('session')); } catch (error) { toast(error.message, true); } };
$('password-form').onsubmit = async event => {
    event.preventDefault(); $('password-error').textContent = '';
    if ($('new-password').value !== $('confirm-password').value) { $('password-error').textContent = T('Passwords do not match.'); return; }
    $('password-submit').disabled = true;
    try {
        const session = await api('password', 'POST', { currentPassword: $('current-password').value, newPassword: $('new-password').value });
        $('password-form').reset(); await startSession(session); toast(T('Password updated.'));
    } catch (error) {
        const errors = { current_password_incorrect: T('Current password is incorrect.'), password_must_change: T('Choose a different password.') };
        $('password-error').textContent = errors[error.code] || error.message;
    } finally { $('password-submit').disabled = false; }
};
api('session').then(startSession).catch(showAuth);
