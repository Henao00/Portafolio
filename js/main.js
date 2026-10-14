
import Lenis from 'lenis';

/* ============================================================
   SMOOTH SCROLL (Lenis) + SCROLL LOCK MODEL
   ============================================================ */
window.scrollTo(0, 0);
const lenis = new Lenis({ smoothWheel: true });
function raf(t){ lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

let scrollEnabled = true;

function stopScroll(){
  if(!scrollEnabled) return;
  scrollEnabled = false;
  lenis.stop();
  document.documentElement.style.position = 'relative';
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.height = '100%';
}
function startScroll(){
  if(scrollEnabled) return;
  scrollEnabled = true;
  lenis.start();
  document.documentElement.style.removeProperty('position');
  document.documentElement.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('height');
}
function scrollToId(id){
  const el = document.getElementById(id);
  if(!el) return;
  const target = el.getBoundingClientRect().top + window.pageYOffset;
  // Lenis is the scroll driver: route through it so the scroll is not fought/overridden.
  if(!lenis.isStopped){ lenis.scrollTo(target, { duration: 1.1 }); }
  else { window.scrollTo({ top: target, behavior: 'smooth' }); }
}

/* ============================================================
   ADAPTIVE GRID (scale-up above 1920px)
   ============================================================ */
function applyAdaptiveGrid(){
  const FONT_BASE = 16, baseWidth = 1920, coef = 0.6666;
  const w = window.innerWidth;
  const widthReduction = ((baseWidth - w) / baseWidth) * 100; // negative when w > baseWidth
  const size = FONT_BASE - (FONT_BASE * (widthReduction * coef)) / 100;
  if(size > FONT_BASE) document.documentElement.style.fontSize = size + 'px';
  else document.documentElement.style.removeProperty('font-size');
}
applyAdaptiveGrid();
addEventListener('resize', applyAdaptiveGrid);

/* ============================================================
   TINY SPRING HELPER (rAF, mass = 1)
   tension/friction -> accel = tension*(target-x) - friction*v
   ============================================================ */
function runSpring(from, to, tension, friction, onUpdate, onDone){
  let x = from, v = 0, last = performance.now();
  function step(now){
    let dt = (now - last) / 1000; last = now;
    if(dt > 0.1) dt = 0.1;
    let remaining = dt;
    while(remaining > 0){
      const h = Math.min(remaining, 1/60); remaining -= h;
      const a = tension * (to - x) - friction * v;
      v += a * h; x += v * h;
    }
    onUpdate(x);
    if(Math.abs(to - x) < 0.001 && Math.abs(v) < 0.001){ onUpdate(to); if(onDone) onDone(); return; }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ============================================================
   TEXT / ENTRANCE REVEAL SYSTEM
   ============================================================ */
let ready = false;
const pendingReady = new Set();

function splitWords(root){
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = []; let n;
  while((n = walker.nextNode())){ if(n.nodeValue && n.nodeValue.trim()) nodes.push(n); }
  nodes.forEach(node => {
    const parts = node.nodeValue.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    parts.forEach(part => {
      if(part === '') return;
      if(/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(' ')); }
      else {
        const w = document.createElement('span'); w.className = 'word';
        w.textContent = part; frag.appendChild(w);
      }
    });
    node.parentNode.replaceChild(frag, node);
  });
}

document.querySelectorAll('[data-reveal="word"]').forEach(splitWords);

function playReveal(el){
  if(el.dataset.rvDone === '1') return;
  el.dataset.rvDone = '1';
  const type = el.dataset.reveal;
  const base = parseInt(el.dataset.delay || '0', 10);
  const stagger = parseInt(el.dataset.stagger || '0', 10);
  if(type === 'line'){
    el.querySelectorAll('.line-reveal').forEach((line, i) => {
      const inner = line.querySelector('.line-inner');
      if(inner) inner.style.transitionDelay = (base + i * stagger) + 'ms';
      line.classList.add('is-in');
    });
  } else if(type === 'word'){
    el.querySelectorAll('.word').forEach((w, i) => {
      w.style.transitionDelay = (base + i * stagger) + 'ms';
      w.classList.add('is-in');
    });
  } else {
    el.style.transitionDelay = base + 'ms';
    el.classList.add('is-in');
  }
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    const el = entry.target;
    if(el.dataset.gate === 'ready' && !ready){ pendingReady.add(el); return; }
    playReveal(el);
    revealObserver.unobserve(el);
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

function flushReadyReveals(){
  pendingReady.forEach(el => { playReveal(el); revealObserver.unobserve(el); });
  pendingReady.clear();
  // Fallback: reveal any gated element that is currently inside the viewport even if
  // the observer has not reported it yet (guards against IO timing races).
  document.querySelectorAll('[data-reveal][data-gate="ready"]').forEach(el => {
    const r = el.getBoundingClientRect();
    if(r.top < window.innerHeight && r.bottom > 0){ playReveal(el); revealObserver.unobserve(el); }
  });
}

/* ============================================================
   LIVE CLOCK
   ============================================================ */
const MONTHS = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  es: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
};
function currentLang(){ return (localStorage.getItem('lumora-lang') || 'en') === 'es' ? 'es' : 'en'; }
function monthName(d){ return (MONTHS[currentLang()] || MONTHS.en)[d.getMonth()]; }
function updateClock(){
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes();
  const mer = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  const time = h + ':' + String(m).padStart(2, '0') + mer;
  const date = d.getDate() + ' ' + monthName(d) + ', ' + d.getFullYear();
  document.querySelectorAll('[data-clock-time]').forEach(e => e.textContent = time);
  document.querySelectorAll('[data-clock-date]').forEach(e => e.textContent = date);
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   LIQUID REVEAL (before/after cursor brush)
   ============================================================ */
(function liquidReveal(){
  const container = document.getElementById('liquidStage');
  const canvas = document.getElementById('liquidCanvas');
  if(!container || !canvas) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    canvas.style.display = 'none';
    return;
  }
  const ctx = canvas.getContext('2d');

  // Mapping: base (always visible / LCP) = perfil.png (transparent), brush paint (revealed on hover) = perfilgafas.png (transparent)
  const beforeSrc = 'Imagenes/perfil.png?v=4';
  const afterSrc  = 'Imagenes/perfilgafas.png?v=4';

  const BRUSH_RADIUS = 143;
  const DECAY = 0.016;
  const FADE_FRAMES = 120;

  const img = new Image();
  let imgReady = false;

  const cover = document.createElement('canvas');
  const coverCtx = cover.getContext('2d');
  const brush = document.createElement('canvas');
  const brushCtx = brush.getContext('2d');

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let radius = BRUSH_RADIUS * dpr;
  let cw = 1, ch = 1;

  const points = [];
  let last = null;
  let idle = 0;

  function buildCover(){
    cover.width = canvas.width;
    cover.height = canvas.height;
    if(!imgReady) return;
    const W = cover.width, H = cover.height;
    const s = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    coverCtx.clearRect(0, 0, W, H);
    coverCtx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  function measure(){
    const rect = container.getBoundingClientRect();
    cw = Math.max(1, Math.round(rect.width));
    ch = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    radius = BRUSH_RADIUS * dpr;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const diam = Math.ceil(radius * 2);
    brush.width = diam;
    brush.height = diam;
    buildCover();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function stamp(x, y){
    const diam = brush.width;
    const half = diam / 2;
    brushCtx.globalCompositeOperation = 'source-over';
    brushCtx.clearRect(0, 0, diam, diam);
    const g = brushCtx.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.82)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    brushCtx.fillStyle = g;
    brushCtx.fillRect(0, 0, diam, diam);
    brushCtx.globalCompositeOperation = 'source-in';
    brushCtx.drawImage(cover, x - half, y - half, diam, diam, 0, 0, diam, diam);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(brush, x - half, y - half);
  }

  window.addEventListener('pointermove', (e) => {
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) * dpr;
    const y = (e.clientY - rect.top) * dpr;
    const r = radius;
    if(x < -r || y < -r || x > canvas.width + r || y > canvas.height + r){ last = null; return; }
    if(last){
      const dx = x - last.x, dy = y - last.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(r * 0.3, 1);
      const n = Math.min(Math.ceil(dist / step), 60);
      for(let i = 1; i <= n; i++) points.push({ x: last.x + dx * i / n, y: last.y + dy * i / n });
    } else {
      points.push({ x, y });
    }
    last = { x, y };
  });

  function tick(){
    requestAnimationFrame(tick);
    const drawing = points.length > 0;
    if(drawing) idle = 0; else idle++;
    if(!drawing && idle > FADE_FRAMES){
      if(idle === FADE_FRAMES + 1){
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const fade = drawing ? DECAY : Math.min(DECAY + idle * 0.004, 0.5);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,' + fade + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if(drawing){
      for(const p of points) stamp(p.x, p.y);
      points.length = 0;
    }
  }

  img.addEventListener('load', () => { imgReady = true; buildCover(); });
  img.src = afterSrc;

  if('ResizeObserver' in window) new ResizeObserver(measure).observe(container);
  window.addEventListener('resize', measure);
  measure();
  requestAnimationFrame(tick);
})();

/* ============================================================
   HERO CARD CAROUSEL
   ============================================================ */
(function heroCard(){
  const root = document.getElementById('heroCard');
  const slot = document.getElementById('heroCardSlot');
  const dotsWrap = document.getElementById('heroCardDots');
  if(!root || !slot || !dotsWrap) return;

  const HERO_CARDS = {
    en: [
      { caption: 'Conversion design', title: 'Crafted to convert.' },
      { caption: 'Engineering',       title: 'Built to scale.' },
      { caption: 'Brand systems',     title: 'Designed to last.' }
    ],
    es: [
      { caption: 'Diseño de conversión', title: 'Hecho para convertir.' },
      { caption: 'Ingeniería',           title: 'Construido para escalar.' },
      { caption: 'Sistemas de marca',    title: 'Diseñado para durar.' }
    ]
  };
  let i = 0;

  HERO_CARDS.en.forEach(() => {
    const d = document.createElement('span');
    d.className = 'hero-card-dot';
    dotsWrap.appendChild(d);
  });
  const dots = Array.from(dotsWrap.children);

  function cards(){ return HERO_CARDS[currentLang()] || HERO_CARDS.en; }
  function markup(){ const c = cards()[i]; return '<div class="hero-card-caption">' + c.caption + '</div>' + '<div class="hero-card-title">' + c.title + '</div>'; }
  function syncDots(){ dots.forEach((d, k) => d.classList.toggle('is-active', k === i)); }

  function render(){
    slot.querySelectorAll('.hero-card-item').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'hero-card-item';
    el.innerHTML = markup();
    slot.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    syncDots();
  }
  render();

  function go(step){
    const prev = slot.querySelector('.hero-card-item');
    i = (i + step + HERO_CARDS.en.length) % HERO_CARDS.en.length;
    const next = document.createElement('div');
    next.className = 'hero-card-item ' + (step > 0 ? 'from-down' : 'from-up');
    next.innerHTML = markup();
    slot.appendChild(next);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      next.classList.remove('from-down', 'from-up');
      next.classList.add('is-in');
    }));
    if(prev){
      prev.classList.remove('is-in');
      prev.classList.add(step > 0 ? 'to-up' : 'to-down');
      setTimeout(() => prev.remove(), 400);
    }
    syncDots();
  }

  root.querySelector('.hero-card-inner').addEventListener('click', () => go(1));
  root.querySelectorAll('.hero-card-arrow').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      go(parseInt(btn.dataset.step, 10));
    });
  });
  window.addEventListener('lux:langchange', () => { i = 0; render(); });
})();

/* ============================================================
   NAV MENU
   ============================================================ */
const navMenu = document.getElementById('navMenu');
function openMenu(){ navMenu.classList.add('is-open'); navMenu.setAttribute('aria-hidden', 'false'); stopScroll(); }
function closeMenu(){ navMenu.classList.remove('is-open'); navMenu.setAttribute('aria-hidden', 'true'); startScroll(); }
document.getElementById('menuOpen').addEventListener('click', openMenu);
document.getElementById('menuClose').addEventListener('click', closeMenu);

/* ============================================================
   CONTACT EMAIL (obfuscated) + CAPTCHA (Cloudflare Turnstile)
   ============================================================ */
function contactEmail(){
  const m = document.querySelector('meta[name="em"]');
  const v = m ? (m.getAttribute('content') || '') : '';
  return v.split('').reverse().join('');
}
(function applyContactEmail(){
  const addr = contactEmail();
  if(!addr) return;
  document.querySelectorAll('[data-em]').forEach(a => a.setAttribute('href', 'mailto:' + addr));
})();

let turnstileToken = '';
let turnstileWidgetId = null;
function turnstileSiteKey(){
  const m = document.querySelector('meta[name="turnstile-site-key"]');
  return m ? (m.getAttribute('content') || '').trim() : '';
}
function resetTurnstile(){
  if(window.turnstile && turnstileWidgetId !== null){
    try { window.turnstile.reset(turnstileWidgetId); } catch(_){}
  }
  turnstileToken = '';
}
(function initTurnstile(){
  const key = turnstileSiteKey();
  const slot = document.getElementById('turnstileSlot');
  if(!key || !slot) return; // no captcha configured: form still works
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true; s.defer = true;
  s.onload = function(){
    if(!window.turnstile || !slot) return;
    turnstileWidgetId = window.turnstile.render(slot, {
      sitekey: key,
      theme: 'dark',
      size: 'flexible',
      callback: function(tok){ turnstileToken = tok; },
      'expired-callback': function(){ turnstileToken = ''; },
      'error-callback': function(){ turnstileToken = ''; }
    });
    slot.hidden = false;
  };
  document.head.appendChild(s);
})();

/* Deliver the request: prefer the site's own serverless endpoint; fall back to
   the legacy FormSubmit relay until the endpoint is configured (env vars set). */
async function deliverRequest(p){
  const json = JSON.stringify({ name: p.name, email: p.email, project: p.project, token: turnstileToken, lang: currentLang() });
  let fallback = false;
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: json
    });
    let data = {};
    try { data = await res.json(); } catch(_){}
    if(res.ok && data.ok) return { ok: true };
    if(data.error === 'captcha' || res.status === 403) return { ok: false, error: 'captcha' };
    if(res.status === 404 || res.status === 405 || res.status === 501 || res.status === 503 || data.error === 'not_configured') fallback = true;
    else return { ok: false, error: data.error || ('http_' + res.status) };
  } catch(_){
    fallback = true; // endpoint unreachable → try the legacy relay
  }
  if(!fallback) return { ok: false, error: 'send_failed' };

  const addr = contactEmail();
  if(!addr) return { ok: false, error: 'send_failed' };
  const res = await fetch('https://formsubmit.co/ajax/' + addr, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ name: p.name, email: p.email, project: p.project, _subject: 'New project request — ' + p.name, _template: 'table' })
  });
  let data = {};
  try { data = await res.json(); } catch(_){}
  if(!res.ok || String(data.success) !== 'true') throw new Error(data.message || 'send failed');
  return { ok: true };
}

/* ============================================================
   REQUEST MODAL
   ============================================================ */
const modal = document.getElementById('requestModal');
const modalForm = document.getElementById('modalForm');
const modalSuccess = document.getElementById('modalSuccess');
const requestForm = document.getElementById('requestForm');
const sendBtn = document.getElementById('sendBtn');
const sendLabel = document.getElementById('sendLabel');
const modalError = document.getElementById('modalError');
const fName = document.getElementById('fName');
const fEmail = document.getElementById('fEmail');
const fProject = document.getElementById('fProject');

function openModal(){ modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); stopScroll(); }
function closeModal(){
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  startScroll();
  setTimeout(resetModal, 300);
}
const SEND_TEXT = { en: 'Send request', es: 'Enviar solicitud' };
const SENDING_TEXT = { en: 'Sending\u2026', es: 'Enviando\u2026' };
function sendTextNow(){ return (SEND_TEXT[currentLang()] || SEND_TEXT.en); }
function sendingTextNow(){ return (SENDING_TEXT[currentLang()] || SENDING_TEXT.en); }

function resetModal(){
  requestForm.reset();
  modalError.classList.remove('is-visible');
  requestForm.querySelectorAll('.field-input--error').forEach(i => i.classList.remove('field-input--error'));
  modalSuccess.classList.remove('is-visible');
  modalForm.classList.remove('modal-hidden');
  sendLabel.textContent = sendTextNow();
  sendBtn.disabled = false;
  resetTurnstile();
}
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('successClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
document.getElementById('modalPanel').addEventListener('click', (e) => e.stopPropagation());

const FIELD_ERROR_TEXT = { en: 'Please fill in all fields and use a valid email.', es: 'Completa todos los campos y usa un correo válido.' };
const SEND_ERROR_TEXT = { en: "Couldn't send the message. Please try again, or email me directly at " + contactEmail() + ".", es: 'No se pudo enviar el mensaje. Inténtalo de nuevo o escríbeme a ' + contactEmail() + '.' };
const CAPTCHA_ERROR_TEXT = { en: 'Please complete the verification below and try again.', es: 'Completa la verificación de abajo e inténtalo de nuevo.' };
const ACTIVATION_ERROR_TEXT = {
  en: 'The form is awaiting activation. FormSubmit just emailed you an “Activate Form” link — click it, then send again.',
  es: 'El formulario está pendiente de activación: FormSubmit te envió un correo con el enlace “Activate Form”. Haz clic en él y vuelve a enviar.'
};
function fieldErrorTextNow(){ return FIELD_ERROR_TEXT[currentLang()] || FIELD_ERROR_TEXT.en; }
function sendErrorTextNow(){ return SEND_ERROR_TEXT[currentLang()] || SEND_ERROR_TEXT.en; }
function activationErrorTextNow(){ return ACTIVATION_ERROR_TEXT[currentLang()] || ACTIVATION_ERROR_TEXT.en; }
function captchaErrorTextNow(){ return CAPTCHA_ERROR_TEXT[currentLang()] || CAPTCHA_ERROR_TEXT.en; }
function toggleFieldError(input, on){ input.classList.toggle('field-input--error', on); }

requestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalError.classList.remove('is-visible');
  const name = fName.value.trim();
  const email = fEmail.value.trim();
  const project = fProject.value.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  toggleFieldError(fName, !name);
  toggleFieldError(fEmail, !emailOk);
  toggleFieldError(fProject, !project);
  if(!name || !emailOk || !project){
    modalError.textContent = fieldErrorTextNow();
    modalError.classList.add('is-visible');
    const f = [fName, fEmail, fProject].find(i => i.classList.contains('field-input--error'));
    if(f) f.focus();
    return;
  }
  sendLabel.textContent = sendingTextNow();
  sendBtn.disabled = true;
  try {
    const result = await deliverRequest({ name, email, project });
    if(result.ok){
      modalForm.classList.add('modal-hidden');
      modalSuccess.classList.add('is-visible');
    } else {
      const errMsg = result.error || '';
      modalError.textContent = (/captcha/i.test(errMsg)) ? captchaErrorTextNow() : sendErrorTextNow();
      modalError.classList.add('is-visible');
      sendBtn.focus();
    }
  } catch(_err){
    const errMsg = (_err && _err.message) || '';
    modalError.textContent = (/ctivation/i.test(errMsg)) ? activationErrorTextNow() : sendErrorTextNow();
    modalError.classList.add('is-visible');
    sendBtn.focus();
  } finally {
    sendLabel.textContent = sendTextNow();
    sendBtn.disabled = false;
  }
});

/* ============================================================
   GLOBAL CLICK DELEGATION (scroll + modal triggers)
   ============================================================ */
document.addEventListener('click', (e) => {
  const modalTrigger = e.target.closest('[data-modal-open]');
  if(modalTrigger){
    e.preventDefault();
    if(modalTrigger.closest('#navMenu')) closeMenu();
    openModal();
    return;
  }
  const scrollTrigger = e.target.closest('[data-scroll]');
  if(scrollTrigger){
    const id = scrollTrigger.dataset.scroll;
    if(!document.getElementById(id)) return;
    e.preventDefault();
    if(scrollTrigger.closest('#navMenu')) closeMenu();
    scrollToId(id);
  }
});

/* Escape closes overlays */
addEventListener('keydown', (e) => {
  if(e.key !== 'Escape') return;
  if(lightbox.classList.contains('is-open')){ closeLightbox(); return; }
  if(modal.classList.contains('is-open')){ closeModal(); return; }
  if(navMenu.classList.contains('is-open')) closeMenu();
});

/* ============================================================
   APP SCREENS LIGHTBOX
   ============================================================ */
const GALLERIES = {
  tmc: [
    'Imagenes/T&MCotizador/a1.jpg',
    'Imagenes/T&MCotizador/a2.jpg',
    'Imagenes/T&MCotizador/a3.jpg',
    'Imagenes/T&MCotizador/a4.jpg',
    'Imagenes/T&MCotizador/a5.jpg',
    'Imagenes/T&MCotizador/a6.jpg',
    'Imagenes/T&MCotizador/a7.jpg',
    'Imagenes/T&MCotizador/a8.jpg'
  ],
  tucontacto: [
    'Imagenes/TuContacto/b1.jpg',
    'Imagenes/TuContacto/b2.jpg',
    'Imagenes/TuContacto/b3.jpg',
    'Imagenes/TuContacto/b4.jpg',
    'Imagenes/TuContacto/b5.jpg',
    'Imagenes/TuContacto/b6.jpg',
    'Imagenes/TuContacto/b7.jpg',
    'Imagenes/TuContacto/b8.jpg'
  ]
};
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCount = document.getElementById('lightboxCount');
let lbList = [];
let lbIndex = 0;

function renderLightbox(){
  lightboxImg.src = lbList[lbIndex];
  lightboxCount.textContent = (lbIndex + 1) + ' / ' + lbList.length;
}
function openLightbox(name){
  lbList = GALLERIES[name] || [];
  if(!lbList.length) return;
  lbIndex = 0;
  renderLightbox();
  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden', 'false');
  stopScroll();
}
function closeLightbox(){
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden', 'true');
  startScroll();
}
function lbStep(d){ if(!lbList.length) return; lbIndex = (lbIndex + d + lbList.length) % lbList.length; renderLightbox(); }

document.querySelectorAll('[data-gallery]').forEach(btn => {
  btn.addEventListener('click', () => openLightbox(btn.getAttribute('data-gallery')));
});
document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxPrev').addEventListener('click', () => lbStep(-1));
document.getElementById('lightboxNext').addEventListener('click', () => lbStep(1));
lightbox.addEventListener('click', (e) => { if(e.target === lightbox) closeLightbox(); });
addEventListener('keydown', (e) => {
  if(!lightbox.classList.contains('is-open')) return;
  if(e.key === 'ArrowLeft') lbStep(-1);
  else if(e.key === 'ArrowRight') lbStep(1);
});

/* ============================================================
   STATS SCROLL COUNT-UP
   ============================================================ */
const countEls = Array.from(document.querySelectorAll('[data-count]'));
let countLock = false;
function updateCounts(){
  const vh = window.innerHeight;
  countEls.forEach(el => {
    const target = parseFloat(el.dataset.count);
    const rect = el.getBoundingClientRect();
    const start = vh;
    const end = vh / 2 - rect.height / 2;
    let p = (start - rect.top) / (start - end);
    p = Math.max(0, Math.min(1, p));
    el.textContent = String(Math.round(p * target));
  });
  countLock = false;
}
function scheduleCounts(){
  if(countLock) return;
  countLock = true;
  setTimeout(updateCounts, 30);
}
addEventListener('scroll', scheduleCounts, { passive: true });
addEventListener('resize', scheduleCounts);
updateCounts();

/* ============================================================
   PAGE LOADER + INTRO SEQUENCE
   ============================================================ */
const loader = document.getElementById('pageLoader');
const loaderFill = document.getElementById('loaderFill');
const loaderCount = document.getElementById('loaderCount');

stopScroll();

const FILL_MS = 1300;
function easeInOutCubic(t){ return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

let fillStart = null;
function countFrame(ts){
  if(fillStart === null) fillStart = ts;
  const t = Math.min((ts - fillStart) / FILL_MS, 1);
  const p = Math.round(easeInOutCubic(t) * 100);
  loaderFill.style.width = p + '%';
  loaderCount.textContent = String(p).padStart(3, '0');
  if(t < 1) requestAnimationFrame(countFrame);
  else exitLoader();
}
requestAnimationFrame(countFrame);

function exitLoader(){
  loader.classList.add('is-exiting');
  runSpring(0, -100, 220, 30, (v) => {
    loader.style.transform = 'translateY(' + v + '%)';
  }, () => {
    loader.style.transform = 'translateY(-100%)';
    ready = true;
    window.__luxReady = true;
    startScroll();
    flushReadyReveals();
    loader.remove();
  });
}

/* ============================================================
   BILINGUAL ES/EN — default: English
   ============================================================ */
const I18N_ES = {
  'Skip to content': 'Saltar al contenido',
  'Loading': 'Cargando',
  'I turn bold ideas into high-impact code.': 'Transformo ideas audaces en código de alto impacto.',
  'Home': 'Inicio',
  'Work': 'Proyectos',
  'Services': 'Servicios',
  'About': 'Acerca de',
  'Contact': 'Contacto',
  'Local time': 'Hora local',
  'Menu': 'Menú',
  'Open menu': 'Abrir menú',
  'Software Engineer': 'Ingeniero de Software',
  'I turn bold ideas': 'Transformo ideas',
  'into high-impact': 'audaces en código',
  'code.': 'de alto impacto.',
  'Available for work': 'Disponible para trabajar',
  "Let's Talk": 'Hablemos',
  'View Work': 'Ver proyectos',
  'Download CV': 'Descargar CV',
  'View screens': 'Ver capturas',
  '8 screens': '8 capturas',
  'Previous': 'Anterior',
  'Next': 'Siguiente',
  'Tech I work with': 'Tecnologías que uso',
  'Building since 2025': 'Construyendo desde 2025',
  'Remote, worldwide': 'Remoto, global',
  'Scroll to explore': 'Desliza para explorar',
  'About me': 'Sobre mí',
  'Software engineer building digital products from anywhere in the world.': 'Ingeniero de Software construyendo productos digitales desde cualquier lugar del mundo.',
  'I help ambitious teams ship': 'Ayudo a equipos ambiciosos a lanzar',
  'digital products, scalable systems, and the engineering that holds them together.': 'productos digitales, sistemas escalables y la ingeniería que los sostiene.',
  'Find me online': 'Encuéntrame en línea',
  'Software Developer | Python, SQL, FastAPI | PostgreSQL | APIs & Microservices | AI Integration': 'Desarrollador de Software | Python, SQL, FastAPI | PostgreSQL | APIs & Microservices | AI Integration',
  "I'm a software developer based in Colombia, focused on backend engineering. I build REST APIs and microservices with Python and FastAPI, model and query relational databases with SQL and PostgreSQL, and integrate AI into real products.": 'Soy desarrollador de software radicado en Colombia, enfocado en backend. Construyo APIs REST y microservicios con Python y FastAPI, modelo y consulto bases de datos relacionales con SQL y PostgreSQL, e integro IA en productos reales.',
  'I care about clean architecture, well-documented APIs and reliable, scalable services — turning complex problems into simple, maintainable solutions.': 'Me importan la arquitectura limpia, las APIs bien documentadas y los servicios fiables y escalables: convierto problemas complejos en soluciones simples y mantenibles.',
  'We': 'Yo',
  'Build': 'Construyo',
  'Better': 'Mejor',
  'Portfolio': 'Portafolio',
  'Selected Work': 'Proyectos seleccionados',
  'Mobile — 2026': 'Móvil — 2026',
  'Mobile — 2025': 'Móvil — 2025',
  'Backend — 2026': 'Backend — 2026',
  'Offline': 'Sin conexión',
  'Performance': 'Rendimiento',
  'A Flutter app built on a clean data model and business rules: it converts area to volume by thickness, manages an editable price catalog and quote history with local persistence, and generates professional PDF quotes — 100% offline.': 'App en Flutter construida sobre un modelo de datos y reglas de negocio claros: convierte área en volumen según el grosor, gestiona un catálogo de precios editable y un historial de cotizaciones con persistencia local, y genera cotizaciones profesionales en PDF, todo 100% sin conexión.',
  'A contacts platform with a serverless Firebase backend: authentication, Firestore data modeling with security rules and indexes, and Cloud Storage for images — consumed by a native Expo app.': 'Plataforma de contactos con backend serverless en Firebase: autenticación, modelado de datos en Firestore con reglas de seguridad e índices, y almacenamiento de imágenes en Cloud Storage, consumida por una app nativa en Expo.',
  'A marketplace whose core is an Express REST API over PostgreSQL: JWT authentication, product and transaction services, a hybrid escrow flow with unique 8-character release codes, Jest unit and integration tests, and Docker Compose — plus a React + Vite frontend.': 'Marketplace cuyo núcleo es una API REST en Express sobre PostgreSQL: autenticación con JWT, servicios de productos y transacciones, un flujo híbrido en custodia (escrow) con códigos de liberación únicos de 8 caracteres, pruebas unitarias y de integración con Jest, y Docker Compose, además de un frontend en React + Vite.',
  'A technical web audit for Ubux, a technology company: I reviewed user flows, performance and accessibility, then turned the findings into prioritized, actionable improvements.': 'Auditoría web técnica para Ubux, una empresa de tecnología: revisé los flujos de usuario, el rendimiento y la accesibilidad, y convertí los hallazgos en mejoras priorizadas y accionables.',
  'Audit — 2026': 'Auditoría — 2026',
  'What I do best': 'Lo que mejor hago',
  'Backend Development': 'Desarrollo Backend',
  'Backend services and business logic with Python and FastAPI, structured for clarity, testing and long-term maintenance.': 'Servicios backend y lógica de negocio con Python y FastAPI, estructurados para la claridad, las pruebas y el mantenimiento a largo plazo.',
  'REST APIs': 'APIs REST',
  'Well-documented REST APIs with authentication, validation, versioning and predictable error handling.': 'APIs REST bien documentadas con autenticación, validación, versionado y manejo de errores predecible.',
  'Microservices': 'Microservicios',
  'Decoupled, independently deployable services that communicate over clear contracts and scale on demand.': 'Servicios desacoplados y desplegables de forma independiente que se comunican mediante contratos claros y escalan según la demanda.',
  'Databases & SQL': 'Bases de datos y SQL',
  'Relational data modeling, SQL queries, migrations and performance tuning with PostgreSQL.': 'Modelado de datos relacional, consultas SQL, migraciones y optimización de rendimiento con PostgreSQL.',
  'AI Integration': 'Integración de IA',
  'LLMs, embeddings and AI-powered features integrated into real products and automated workflows.': 'LLMs, embeddings y funciones con IA integradas en productos reales y flujos de trabajo automatizados.',
  'Docker & Deployment': 'Docker y despliegue',
  'Containerized services, reproducible environments and CI/CD pipelines for reliable releases.': 'Servicios en contenedores, entornos reproducibles y pipelines de CI/CD para lanzamientos fiables.',
  'Technical Consulting': 'Consultoría técnica',
  'Architecture decisions, API design and code reviews to help teams build solid systems with confidence.': 'Decisiones de arquitectura, diseño de APIs y revisiones de código para que los equipos construyan sistemas sólidos con confianza.',
  'By the numbers': 'En números',
  'Proof in the work, not the words.': 'Hechos, no palabras.',
  'Featured projects': 'Proyectos destacados',
  'Core technologies': 'Tecnologías principales',
  'Public repositories': 'Repositorios públicos',
  'Building since': 'Construyendo desde',
  'Have a project in mind?': '¿Tienes un proyecto en mente?',
  "Let's get to work.": 'Pongámonos a trabajar.',
  'Start a project': 'Iniciar un proyecto',
  'Software engineer building digital products, systems and the engineering that holds them together.': 'Ingeniero de Software construyendo productos digitales, sistemas y la ingeniería que los sostiene.',
  'Navigation': 'Navegación',
  'Social': 'Redes',
  'Primary': 'Principal',
  'All rights reserved.': 'Todos los derechos reservados.',
  'Privacy': 'Privacidad',
  'Terms': 'Términos',
  'Email': 'Correo',
  'Close': 'Cerrar',
  "Tell me what you're building.": 'Cuéntame qué estás construyendo.',
  'Name': 'Nombre',
  'Your name': 'Tu nombre',
  'you@company.com': 'tu@empresa.com',
  'Project': 'Proyecto',
  'A few words about your project, timeline, and budget.': 'Algunas palabras sobre tu proyecto, plazos y presupuesto.',
  'I reply within one business day.': 'Respondo en un día hábil.',
  'Request received': 'Solicitud recibida',
  'Send request': 'Enviar solicitud',
  "Thanks for reaching out — I'll get back to you within one business day.": 'Gracias por escribir — te responderé en un día hábil.',
  'Switch language': 'Cambiar idioma',
  'I am a software developer based in Colombia, focused on backend development, services, and cloud solutions. I build REST APIs and microservices using Python and FastAPI, design and query relational databases with SQL and PostgreSQL, and integrate AI capabilities into real-world products and solutions.': 'Soy desarrollador de software con base en Colombia, enfocado al desarrollo backend, servicios y soluciones en la nube. Construyo APIs REST y microservicios con Python y FastAPI, diseño y consulto bases de datos relacionales con SQL y PostgreSQL, e integro capacidades de IA en productos y soluciones del mundo real.',
  'I also work with Microsoft technologies, including Windows Server and Azure, with a strong interest in developing, deploying, managing, and scaling services across on-premises and cloud environments.': 'También trabajo con tecnologías de Microsoft, incluyendo Windows Server y Azure, con un gran interés en desarrollar, desplegar, administrar y escalar servicios tanto en entornos on-premises como en la nube.',
  'I am passionate about clean architecture, well-documented APIs, automation, and building reliable, secure, and scalable services. I enjoy turning complex problems into simple, efficient, and maintainable solutions by combining software development, infrastructure, cloud technologies, and artificial intelligence.': 'Me apasiona la arquitectura limpia, las APIs bien documentadas, la automatización y la construcción de servicios confiables, seguros y escalables. Disfruto transformar problemas complejos en soluciones simples, eficientes y mantenibles, combinando desarrollo de software, infraestructura, tecnologías cloud e inteligencia artificial.',
};
const I18N_REV = {};
Object.keys(I18N_ES).forEach(k => { I18N_REV[I18N_ES[k]] = k; });

function applyLang(next){
  const goingES = next === 'es';
  const dict = goingES ? I18N_ES : I18N_REV;
  localStorage.setItem('lumora-lang', goingES ? 'es' : 'en');
  document.documentElement.setAttribute('lang', goingES ? 'es' : 'en');

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if(!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if(!p || /^(SCRIPT|STYLE|PRE|CODE)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let node;
  while((node = walker.nextNode())) nodes.push(node);
  nodes.forEach(n => {
    const raw = n.nodeValue;
    const t = raw.trim();
    const hit = dict[t];
    if(hit) n.nodeValue = raw.replace(t, hit);
  });

  document.querySelectorAll('[aria-label],[placeholder]').forEach(el => {
    if(el.hasAttribute('aria-label')){
      const v = el.getAttribute('aria-label');
      const hit = dict[v];
      if(hit) el.setAttribute('aria-label', hit);
    }
    if(el.hasAttribute('placeholder')){
      const v = el.getAttribute('placeholder');
      const hit = dict[v];
      if(hit) el.setAttribute('placeholder', hit);
    }
  });

  document.querySelectorAll('[data-lang-toggle]').forEach(b => {
    b.textContent = goingES ? 'EN' : 'ES';
  });

  updateClock();
  window.dispatchEvent(new CustomEvent('lux:langchange'));
}

document.querySelectorAll('[data-lang-toggle]').forEach(b => {
  b.addEventListener('click', () => applyLang(currentLang() === 'es' ? 'en' : 'es'));
});

/* CV download follows the current page language (EN -> CV.pdf, ES -> CV-es.pdf) */
const cvDownloadLink = document.getElementById('cvDownload');
function updateCvDownload(){
  if(!cvDownloadLink) return;
  const es = currentLang() === 'es';
  cvDownloadLink.setAttribute('href', es ? 'CV-es.pdf' : 'CV.pdf');
  cvDownloadLink.setAttribute('download', es ? 'Juan-Esteban-Henao-CV-ES.pdf' : 'Juan-Esteban-Henao-CV-EN.pdf');
}
updateCvDownload();
window.addEventListener('lux:langchange', updateCvDownload);

/* Dynamic footer year */
document.querySelectorAll('[data-year]').forEach(e => e.textContent = new Date().getFullYear());

/* Restore persisted language */
if(localStorage.getItem('lumora-lang') === 'es') applyLang('es');
