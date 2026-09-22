/* ==========================================================================
   Umbral · interfaz
   Scroll suave, navegación, entrada del hero, revelados, panel en vivo,
   botones magnéticos, acordeón y enlace de WhatsApp.
   ========================================================================== */

(() => {
'use strict';

/* Abrir siempre desde el inicio: sin #ancla heredada y sin restaurar la posición de scroll (móvil). */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
window.scrollTo(0, 0);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = typeof window.gsap !== 'undefined';
const hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
if (hasST) gsap.registerPlugin(ScrollTrigger);

/* --------------------------------------------------------------------------
   WhatsApp: número de Umbral y mensaje listo
   -------------------------------------------------------------------------- */

const WA_NUM = '525521455256';
const WA_MSG = 'Hola, vi Umbral y me interesa una demo de control de acceso para mi empresa.';
const waUrl = `https://wa.me/${WA_NUM}?text=${encodeURIComponent(WA_MSG)}`;
$$('[data-demo]').forEach((a) => {
  a.href = waUrl;
  a.target = '_blank';
  a.rel = 'noopener';
});

/* --------------------------------------------------------------------------
   Scroll suave (Lenis) + anclas
   -------------------------------------------------------------------------- */

let lenis = null;
if (typeof window.Lenis !== 'undefined' && !reduced && hasGsap) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
  if (hasST) lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(el) {
  if (lenis) lenis.scrollTo(el, { offset: -72, duration: 1.5 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const hash = a.getAttribute('href');
    if (!hash || hash.length < 2) return;
    const target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(target);
  });
});

/* --------------------------------------------------------------------------
   Navegación: estado al hacer scroll, progreso, menú móvil
   -------------------------------------------------------------------------- */

const nav = $('.nav');
const progress = $('.progress');
const toggle = $('.nav__toggle');
const menu = $('.nav__menu');

function onScrollUI() {
  const y = window.scrollY || 0;
  nav.classList.toggle('is-scrolled', y > 40);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
}
window.addEventListener('scroll', onScrollUI, { passive: true });
onScrollUI();

function closeMenu() {
  if (!menu.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Abrir menú');
}
toggle.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open');
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* --------------------------------------------------------------------------
   Loader y entrada del hero
   -------------------------------------------------------------------------- */

const loader = $('#loader');
let introDone = false;

function splitWords(el) {
  Array.from(el.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = part;
        frag.appendChild(span);
      });
      node.replaceWith(frag);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      splitWords(node);
    }
  });
}

function runIntro() {
  if (introDone) return;
  introDone = true;
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');

  if (!hasGsap || reduced) return;

  const title = $('[data-hero-title]');
  splitWords(title);

  const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, delay: 0.25 });
  tl.from('.h1 .word', { y: 60, opacity: 0, rotateX: -30, duration: 1.2, stagger: 0.05, transformOrigin: '50% 100%' })
    .from('[data-hero]', { y: 26, opacity: 0, duration: 1, stagger: 0.1 }, '-=0.8')
    .from('.scroll-hint', { opacity: 0, duration: 1 }, '-=0.4')
    .from('.nav', { y: -20, opacity: 0, duration: .9 }, '-=1.1');
}

window.addEventListener('umbral:ready', () => setTimeout(runIntro, 250), { once: true });
window.setTimeout(runIntro, 3200);

/* --------------------------------------------------------------------------
   Revelados al hacer scroll
   -------------------------------------------------------------------------- */

if (hasST && !reduced) {
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 30, opacity: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
  $$('[data-reveal-group]').forEach((group) => {
    gsap.from(group.children, {
      y: 34, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    });
  });
}

/* --------------------------------------------------------------------------
   Botones magnéticos
   -------------------------------------------------------------------------- */

if (hasGsap && !reduced && window.matchMedia('(hover: hover)').matches) {
  $$('.btn-magnetic').forEach((btn) => {
    const strength = 0.28;
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * strength;
      const y = (e.clientY - r.top - r.height / 2) * strength;
      gsap.to(btn, { x, y, duration: 0.5, ease: 'power3.out' });
    });
    btn.addEventListener('pointerleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    });
  });
}

/* --------------------------------------------------------------------------
   Panel en vivo: reloj y movimiento de ejemplo
   -------------------------------------------------------------------------- */

const clock = $('[data-clock]');
const rows = $('[data-rows]');
const insideCounters = $$('[data-inside]');

function hhmm(date = new Date()) {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function tickClock() {
  if (clock) {
    const now = new Date();
    clock.textContent = hhmm(now);
    clock.setAttribute('datetime', now.toISOString());
  }
}
tickClock();
setInterval(tickClock, 15000);

function updateInside() {
  const n = rows ? rows.querySelectorAll('.status.in').length : 0;
  insideCounters.forEach((el) => { el.textContent = String(n); });
}
updateInside();

const POOL = [
  { who: 'Ana G.', where: 'Ventas' },
  { who: 'Visitante · cita', where: 'Dirección' },
  { who: 'Jorge P.', where: 'Mantenimiento' },
  { who: 'Paquetería', where: 'Recepción' },
  { who: 'Sofía L.', where: 'Contabilidad' },
  { who: 'Proveedor · QR', where: 'Almacén' },
  { who: 'Diego H.', where: 'Sistemas' },
];
let poolIndex = 0;

function simulateEntry() {
  if (!rows) return;
  const entry = POOL[poolIndex % POOL.length];
  poolIndex++;
  const now = hhmm();

  const inRows = Array.from(rows.querySelectorAll('li')).filter((li) => li.querySelector('.status.in'));
  if (inRows.length >= 4) {
    const leaving = inRows[inRows.length - 1];
    const when = leaving.querySelector('.when');
    const status = leaving.querySelector('.status');
    when.textContent = `${when.textContent} → ${now}`;
    status.textContent = 'Salió';
    status.classList.remove('in');
    status.classList.add('out');
  }

  const li = document.createElement('li');
  li.innerHTML = `<span class="who"></span><span class="where"></span><span class="when"></span><span class="status in">Dentro</span>`;
  li.querySelector('.who').textContent = entry.who;
  li.querySelector('.where').textContent = entry.where;
  li.querySelector('.when').textContent = now;
  rows.prepend(li);

  const all = rows.querySelectorAll('li');
  if (all.length > 5) all[all.length - 1].remove();
  updateInside();
}

if (!reduced) {
  setInterval(simulateEntry, 7000);
}

/* --------------------------------------------------------------------------
   FAQ: una pregunta abierta a la vez
   -------------------------------------------------------------------------- */

const faq = $('[data-faq]');
if (faq) {
  faq.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open) return;
    $$('details[open]', faq).forEach((o) => { if (o !== d) o.open = false; });
  }, true);
}

})();
