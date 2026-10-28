import { api, requireRole, el, toast, fmt, cap, forecastCards, renderHeader, TYPES, ICON } from './common.js';

requireRole('admin');
renderHeader();
const main = document.getElementById('main');
let tab = 'meals', timer, editId = null;

const local = (t) => new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const $ = (id) => document.getElementById(id);
const ms = (id) => new Date($(id).value).getTime();
const table = (head, rows) => el('div', { class: 'card scroll' },
  el('table', {}, el('tr', {}, head.map((h) => el('th', {}, h))), rows.length ? rows.map((r) => el('tr', {}, r.map((c) => el('td', {}, c)))) : el('tr', {}, el('td', {}, 'Nothing yet'))));

function startEdit(m) {
  editId = m.id;
  $('type').value = m.type; $('menu').value = m.menu;
  $('cut').value = local(m.cutoffAt); $('ss').value = local(m.serveStart); $('se').value = local(m.serveEnd);
  $('ftitle').textContent = 'Edit meal'; $('save').textContent = 'Save changes'; $('cancelEdit').hidden = false;
  $('form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function show() {
  clearInterval(timer);
  const tabs = el('div', { class: 'tabs' }, [['meals', '🍽️ Meals and forecast'], ['ledger', '📒 Ledger'], ['audit', '🧾 Audit log']]
    .map(([k, l]) => el('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; editId = null; show(); } }, l)));
  main.replaceChildren(tabs);
  if (tab === 'meals') {
    const now = Date.now();
    const f = (id, label, t) => el('label', {}, label, el('input', { id, type: 'datetime-local', value: local(t) }));
    const fl = el('div', { style: 'display:contents' });
    main.append(el('div', { class: 'grid' },
      el('div', { class: 'card', id: 'form' }, el('h3', { id: 'ftitle' }, 'Add meal'),
        el('label', {}, 'Meal slot', el('select', { id: 'type' }, TYPES.map((t) => el('option', { value: t }, `${ICON[t]} ${cap(t)}`)))),
        el('label', {}, 'Food menu (students see this)', el('input', { id: 'menu', value: 'Dal, rice, sabzi, roti' })),
        f('cut', 'Cutoff', now + 60000), f('ss', 'Serving starts', now + 120000), f('se', 'Serving ends', now + 7200000),
        el('button', { id: 'save', onclick: save }, 'Add meal'),
        el('button', { id: 'cancelEdit', class: 'ghost', hidden: true, onclick: () => { editId = null; show(); } }, 'Cancel edit')), fl));
    const load = async () => { try { fl.replaceChildren(...forecastCards((await api('/forecast')).meals, startEdit)); } catch {} };
    await load(); timer = setInterval(load, 5000);
  } else if (tab === 'ledger') {
    const d = await api('/admin/ledger');
    main.append(table(['Time', 'Student', 'Meal', 'Food', 'Scanned by'], d.rows.map((r) => [fmt(r.at), r.student, cap(r.meal), r.menu, r.staff])));
  } else {
    const d = await api('/admin/audit');
    main.append(table(['Time', 'Actor', 'Action', 'Details'], d.rows.map((r) => [fmt(r.at), r.actor, r.action, r.details])));
  }
}

async function save() {
  try {
    const body = { type: $('type').value, menu: $('menu').value, cutoffAt: ms('cut'), serveStart: ms('ss'), serveEnd: ms('se') };
    await api(editId ? `/admin/meals/${editId}` : '/admin/meals', { method: editId ? 'PUT' : 'POST', body });
    toast(editId ? 'Meal updated, students see it now' : 'Meal added');
    editId = null; show();
  } catch (e) { toast(e.message, true); }
}
show();
