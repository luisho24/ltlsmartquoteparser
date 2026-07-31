/* Smart LTL Quote Parser UI/UX enhancement layer. */
(() => {
  const COPY = {
    en: { subtitle:'Paste a Priority1 quote, review carrier fit, and export a client-ready comparison.', settings:'Settings', support:'Support', branding:'Branding', appearance:'Appearance', language:'Language', theme:'Theme', report:'Report issue', emailBranding:'Email branding', light:'Light', dark:'Dark', close:'Close', shortcut:'Ctrl + Enter to parse', chars:'characters', input:'Priority1 quote data', table:'Carrier quote comparison results', sections:'Application sections' },
    es: { subtitle:'Pega una cotización de Priority1, revisa la compatibilidad de carriers y exporta una comparación lista para el cliente.', settings:'Ajustes', support:'Soporte', branding:'Marca', appearance:'Apariencia', language:'Idioma', theme:'Tema', report:'Reportar problema', emailBranding:'Diseño del correo', light:'Claro', dark:'Oscuro', close:'Cerrar', shortcut:'Ctrl + Enter para analizar', chars:'caracteres', input:'Datos de la cotización de Priority1', table:'Resultados comparativos de carriers', sections:'Secciones de la aplicación' }
  };
  const previousFocus = new WeakMap();
  let modalObserver;
  const lang = () => (typeof window.currentLang === 'string' && COPY[window.currentLang]) ? window.currentLang : 'en';
  const copy = (value = lang()) => COPY[value] || COPY.en;
  const clean = value => String(value || '').replace(/^[\s\u200d\ufe0f\u20e3\u2600-\u27ff\ud83c-\udbff\udc00-\udfff]+/u, '').trimStart();
  const visibleModals = () => [...document.querySelectorAll('.modal-overlay')].filter(el => getComputedStyle(el).display !== 'none').sort((a,b)=>(parseInt(getComputedStyle(a).zIndex)||0)-(parseInt(getComputedStyle(b).zIndex)||0));
  const focusables = root => [...root.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');

  function countInput(language = lang()) {
    const input = document.getElementById('inputData');
    const counter = document.getElementById('uxInputCount');
    if (input && counter) counter.textContent = `${input.value.length.toLocaleString(language === 'es' ? 'es-CO' : 'en-US')} ${copy(language).chars}`;
  }

  function syncTabs(activeId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const id = btn.id.replace('btn-tab-','');
      const selected = id === activeId || btn.classList.contains('active');
      btn.setAttribute('role','tab');
      btn.setAttribute('aria-selected', String(selected));
      btn.setAttribute('aria-controls',`view-${id}`);
      btn.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      const id = pane.id.replace('view-','');
      const selected = id === activeId || pane.classList.contains('active');
      pane.setAttribute('role','tabpanel');
      pane.setAttribute('aria-labelledby',`btn-tab-${id}`);
      pane.setAttribute('aria-hidden', String(!selected));
      pane.tabIndex = selected ? 0 : -1;
    });
  }

  function refreshChrome(language = lang()) {
    const t = copy(language);
    const subtitle = document.getElementById('uxHeroSubtitle');
    if (subtitle) subtitle.textContent = t.subtitle;
    const title = document.getElementById('mainTitle');
    if (title) title.textContent = clean(title.textContent);
    const settings = document.querySelector('.hero-settings-btn');
    if (settings) Object.assign(settings,{textContent:t.settings,title:t.settings}), settings.setAttribute('aria-label',t.settings);
    const light = document.getElementById('btn-light');
    const dark = document.getElementById('btn-dark');
    if (light) Object.assign(light,{textContent:t.light,title:t.light});
    if (dark) Object.assign(dark,{textContent:t.dark,title:t.dark});
    document.querySelectorAll('.control-card').forEach(card => {
      const label = card.querySelector('.control-card-label'); if (!label) return;
      if (card.querySelector('[onclick*="openBugReport"]')) label.textContent=t.support;
      else if (card.querySelector('[onclick*="openBranding"]')) label.textContent=t.branding;
      else if (card.querySelector('#btn-light')) label.textContent=t.appearance;
      else if (card.querySelector('#btn-es')) label.textContent=t.language;
      else if (card.querySelector('#appThemeSelect')) label.textContent=t.theme;
    });
    const report = document.querySelector('.hero-action-btn[onclick*="openBugReport"]');
    const branding = document.querySelector('.hero-action-btn[onclick*="openBranding"]');
    if (report) report.textContent=t.report;
    if (branding) branding.textContent=t.emailBranding;
    const titles={settingsModal:t.settings,brandingModal:t.emailBranding,emailPreviewModal:t.emailBranding,bugReportModal:t.report};
    Object.entries(titles).forEach(([id,text])=>{
      const modal=document.getElementById(id); if(!modal)return;
      const heading=modal.querySelector('.modal-content > h3:first-child > span'); if(heading)heading.textContent=text;
      const close=modal.querySelector('.modal-content > h3:first-child > button'); if(close){close.textContent=t.close;close.title=t.close;close.setAttribute('aria-label',t.close);}
    });
    document.querySelectorAll('button').forEach(btn=>{if(![settings,light,dark,report,branding].includes(btn)){const text=clean(btn.textContent);if(text)btn.textContent=text;}});
    document.querySelectorAll('option').forEach(option=>{const text=clean(option.textContent);if(text)option.textContent=text;});
    const haz=document.getElementById('extHazTitle'); if(haz)haz.textContent=clean(haz.textContent);
    const hint=document.getElementById('uxInputHint'); if(hint)hint.innerHTML=t.shortcut.replace('Ctrl + Enter','<kbd>Ctrl</kbd> + <kbd>Enter</kbd>');
    const input=document.getElementById('inputData'); if(input)input.setAttribute('aria-label',t.input);
    const tabs=document.querySelector('.tabs-nav'); if(tabs)tabs.setAttribute('aria-label',t.sections);
    const caption=document.querySelector('#quotesTable caption'); if(caption)caption.textContent=t.table;
    countInput(language);
  }

  function closeModal(modal) {
    const handlers={settingsModal:'closeSettings',brandingModal:'closeBranding',emailPreviewModal:'closeEmailPreview',bugReportModal:'closeBugReport'};
    const fn=window[handlers[modal?.id]]; if(typeof fn==='function')fn();
  }

  function updateModal(modal) {
    const shown=getComputedStyle(modal).display!=='none';
    modal.setAttribute('aria-hidden',String(!shown));
    if(shown){
      if(!previousFocus.has(modal))previousFocus.set(modal,document.activeElement instanceof HTMLElement?document.activeElement:null);
      document.body.classList.add('ux-modal-open');
      requestAnimationFrame(()=>{const first=focusables(modal)[0];if(first&&!modal.contains(document.activeElement))first.focus({preventScroll:true});});
    } else {
      const prior=previousFocus.get(modal); previousFocus.delete(modal);
      const remaining=visibleModals(); if(!remaining.length)document.body.classList.remove('ux-modal-open');
      const top=remaining.at(-1); if(top)focusables(top)[0]?.focus({preventScroll:true}); else if(prior&&document.contains(prior))prior.focus({preventScroll:true});
    }
  }

  function initModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal=>{
      modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
      const heading=modal.querySelector('.modal-content > h3:first-child'); if(heading){heading.id ||= `${modal.id}-title`;modal.setAttribute('aria-labelledby',heading.id);}
      modal.setAttribute('aria-hidden',String(getComputedStyle(modal).display==='none'));
      modal.addEventListener('mousedown',event=>{if(event.target===modal)closeModal(modal);});
    });
    modalObserver ||= new MutationObserver(records=>records.forEach(record=>record.target.classList.contains('modal-overlay')&&updateModal(record.target)));
    document.querySelectorAll('.modal-overlay').forEach(modal=>modalObserver.observe(modal,{attributes:true,attributeFilter:['style','class']}));
    document.addEventListener('keydown',event=>{
      const modal=visibleModals().at(-1); if(!modal)return;
      if(event.key==='Escape'){event.preventDefault();closeModal(modal);return;}
      if(event.key==='Tab'){const list=focusables(modal);if(!list.length)return;const first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    });
  }

  function wrapApp() {
    if(typeof window.switchTab==='function'&&!window.switchTab.__ux){const original=window.switchTab;window.switchTab=function(id){const result=original.apply(this,arguments);syncTabs(id);return result;};window.switchTab.__ux=true;}
    if(typeof window.setLang==='function'&&!window.setLang.__ux){const original=window.setLang;window.setLang=function(language){const result=original.apply(this,arguments);refreshChrome(language);return result;};window.setLang.__ux=true;}
  }

  function init() {
    if(document.body.classList.contains('ux-refreshed'))return;
    document.body.classList.add('ux-refreshed'); wrapApp();
    const title=document.getElementById('mainTitle')?.parentElement;
    if(title&&!document.getElementById('uxHeroSubtitle')){const subtitle=document.createElement('p');subtitle.id='uxHeroSubtitle';subtitle.className='ux-hero-subtitle';title.appendChild(subtitle);}
    const input=document.getElementById('inputData'),wrapper=document.getElementById('inputDataWrapper');
    if(input&&wrapper&&!document.getElementById('uxInputMeta')){const meta=document.createElement('div');meta.id='uxInputMeta';meta.className='ux-input-meta';meta.innerHTML='<span id="uxInputHint"></span><span id="uxInputCount"></span>';wrapper.after(meta);input.setAttribute('aria-describedby','uxInputMeta');input.addEventListener('input',()=>countInput());input.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();document.getElementById('analyzeBtn')?.click();}});}
    const tabs=document.querySelector('.tabs-nav'); if(tabs){tabs.setAttribute('role','tablist');tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const items=[...tabs.querySelectorAll('.tab-btn')].filter(tab=>getComputedStyle(tab).display!=='none');const index=items.indexOf(document.activeElement);if(index<0)return;event.preventDefault();let next=index;if(event.key==='ArrowLeft')next=(index-1+items.length)%items.length;if(event.key==='ArrowRight')next=(index+1)%items.length;if(event.key==='Home')next=0;if(event.key==='End')next=items.length-1;items[next].focus();items[next].click();});}
    const table=document.getElementById('quotesTable'); if(table&&!table.querySelector('caption')){const caption=document.createElement('caption');caption.className='ux-sr-only';table.prepend(caption);}
    ['parseFeedback','resultCount','copyToast','updateToast'].forEach(id=>{const el=document.getElementById(id);if(el){el.setAttribute('role','status');el.setAttribute('aria-live','polite');}});
    document.querySelectorAll('button:not([type])').forEach(button=>button.type='button');
    initModals(); syncTabs(document.querySelector('.tab-btn.active')?.id.replace('btn-tab-','')||'analyzer'); refreshChrome();
  }
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
