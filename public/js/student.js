import { api, requireRole, el, toast, fmt, cd, cap, renderHeader, ICON, TYPES } from './common.js';

requireRole('student');
renderHeader();

let tab = 'meals', day = sod(new Date()), meals = [], offset = 0, last = '', hist = [], filter = 'all';
const qr = {}; // mealId -> latest QR image
const tabs = el('div', { class: 'tabs' }), view = el('div');
document.getElementById('main').append(tabs, view);

function sod(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const label = (d) => d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
const STATE = { open: 'Open for opt-in', locked: 'Locked', serving: 'Serving now', ended: 'Ended' };

function renderTabs() {
  tabs.replaceChildren(...[['meals', '🍽️ Meals'], ['history', '📜 History']].map(([k, l]) =>
    el('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; last = ''; renderTabs(); k === 'meals' ? load() : loadHistory(); } }, l)));
}

/* ---------- Meals for one day: breakfast, lunch, snacks, dinner ---------- */
async function load() {
  if (tab !== 'meals') return;
  try {
    const next = new Date(day); next.setDate(next.getDate() + 1);
    const d = await api(`/meals?from=${day.getTime()}&to=${next.getTime()}`);
    offset = d.serverTime - Date.now(); // server clock vs browser clock, only used for the countdown
    meals = d.meals;
    const sig = day.getTime() + JSON.stringify(d.meals);
    if (sig !== last) { last = sig; draw(); }
  } catch (e) { if (e.status !== 401) toast(e.message, true); }
}

function pick(d) { day = sod(d); last = ''; load(); }

function draw() {
  const strip = el('div', { class: 'strip' }, [-3, -2, -1, 0, 1, 2, 3].map((i) => {
    const d = new Date(day); d.setDate(d.getDate() + i);
    return el('button', { class: 'day' + (i === 0 ? ' on' : ''), onclick: () => pick(d) },
      el('small', {}, d.toLocaleDateString([], { weekday: 'short' })), el('b', {}, d.getDate()));
  }));
  const picker = el('div', { class: 'row', style: 'justify-content:flex-start' },
    el('input', { type: 'date', value: ymd(day), style: 'width:auto', onchange: (e) => e.target.value && pick(new Date(e.target.value + 'T00:00')) }),
    el('button', { class: 'ghost', onclick: () => pick(new Date()) }, 'Today'));
  const slots = TYPES.map((t) => {
    const m = meals.filter((x) => x.type === t).sort((a, b) => b.id - a.id)[0]; // newest update for that slot
    return m ? card(m) : empty(t);
  });
  view.replaceChildren(el('h2', {}, label(day)), picker, strip, el('div', { class: 'grid slots' }, slots));
}

function empty(t) {
  return el('div', { class: 'card empty' },
    el('h3', {}, `${ICON[t]} ${cap(t)}`),
    el('p', {}, 'Not published yet. It appears here as soon as the admin adds it.'));
}

function card(m) {
  const on = m.status === 'opted_in', open = m.state === 'open';
  const badge = m.eaten ? 'Eaten ✓' : on ? (m.state === 'ended' ? 'Not collected' : 'Opted in') : 'Not eating';
  const kids = [
    el('div', { class: 'row' }, el('h3', {}, `${ICON[m.type]} ${cap(m.type)}`), el('span', { class: 'pill ' + m.state }, STATE[m.state])),
    el('p', { class: 'menu' }, m.menu),
    el('p', { class: 'mut' }, `Serving ${fmt(m.serveStart)} to ${fmt(m.serveEnd)}`),
    el('div', { class: 'row' }, el('span', { class: 'pill' + (on ? ' ok' : '') }, badge),
      open ? el('span', {}, '⏳ ', el('b', { 'data-cut': m.cutoffAt }, '')) : el('span', { class: 'mut' }, '🔒 No more changes')),
    el('div', { class: 'row' },
      el('button', { disabled: !open || on, onclick: () => choose(m, 'optin') }, 'Opt in'),
      el('button', { class: 'ghost', disabled: !open || !on, onclick: () => choose(m, 'cancel') }, 'Cancel')),
  ];
  if (on && !m.eaten && m.state !== 'ended') {
    kids.push(el('div', { class: 'qr' },
      el('img', { id: 'qr-' + m.id, alt: 'Your meal QR code', src: qr[m.id] || false }),
      el('p', { class: 'mut' }, m.state === 'serving' ? 'Show this to the staff. Changes every 30 s, works once.' : `Ready. Show it when serving starts at ${fmt(m.serveStart)}.`)));
    if (!qr[m.id]) refreshQr(m);
  }
  if (m.eaten) kids.push(el('p', { class: 'mut' }, 'Enjoy your meal. This QR is now used. See it in History.'));
  return el('div', { class: 'card' }, kids);
}

async function refreshQr(m) {
  try {
    const d = await api(`/meals/${m.id}/qr`);
    qr[m.id] = d.image;
    const img = document.getElementById('qr-' + m.id);
    if (img) img.src = d.image;
  } catch (e) { if (e.status === 409 || e.status === 410) load(); }
}

async function choose(m, action) {
  try {
    await api(`/meals/${m.id}/${action}`, { method: 'POST' });
    toast(action === 'optin' ? `You are in for ${m.type}. Your QR is ready.` : `Cancelled ${m.type}`);
    if (action === 'cancel') delete qr[m.id];
  } catch (e) { toast(e.message, true); }
  last = ''; load();
}

/* ---------- History: what the student actually ate ---------- */
async function loadHistory() {
  try { hist = (await api('/meals/history')).rows; drawHistory(); } catch (e) { if (e.status !== 401) toast(e.message, true); }
}

function drawHistory() {
  const count = (t) => hist.filter((h) => h.type === t).length;
  const chips = el('div', { class: 'chips' }, ['all', ...TYPES].map((t) =>
    el('button', { class: 'chipb' + (filter === t ? ' on' : ''), onclick: () => { filter = t; drawHistory(); } },
      t === 'all' ? `All (${hist.length})` : `${ICON[t]} ${cap(t)} (${count(t)})`)));
  const rows = hist.filter((h) => filter === 'all' || h.type === filter);
  const body = [];
  let lastDay = '', n = 0;
  for (const h of rows) {
    const k = new Date(h.at).toDateString();
    if (k !== lastDay) { lastDay = k; body.push(el('h3', { class: 'dayhead' }, label(new Date(h.at)))); }
    body.push(el('div', { class: 'hrow', style: `animation-delay:${Math.min(n++, 12) * 40}ms` },
      el('span', { class: 'hic' }, ICON[h.type] || '🍽️'),
      el('div', { style: 'flex:1' }, el('b', {}, cap(h.type || '')), el('p', { class: 'mut' }, h.menu || '')),
      el('span', { class: 'mut' }, new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))));
  }
  view.replaceChildren(el('h2', {}, 'Your meal history'),
    el('p', { class: 'mut' }, hist.length ? `You have had ${hist.length} meals through MessMantra.` : ''), chips,
    ...(body.length ? body : [el('p', { class: 'mut' }, 'Nothing here yet. Meals appear after the staff scan your QR.')]));
}

setInterval(() => { // countdown, and re-sync the moment a cutoff is reached
  document.querySelectorAll('[data-cut]').forEach((n) => {
    const left = Number(n.dataset.cut) - (Date.now() + offset);
    n.textContent = cd(left);
    if (left <= 0) { last = ''; load(); }
  });
}, 1000);
setInterval(() => meals.filter((m) => m.status === 'opted_in' && !m.eaten && m.state !== 'ended').forEach(refreshQr), 30000);
setInterval(load, 4000);
renderTabs(); load();
