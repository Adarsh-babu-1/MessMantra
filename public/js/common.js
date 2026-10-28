// Shared helpers. The JWT lives in sessionStorage (cleared when the tab closes); all real data is in the server database.
const KEY = 'mm_session';
export const session = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; } };
export const saveSession = (s) => sessionStorage.setItem(KEY, JSON.stringify(s));
export const home = { student: '/student.html', staff: '/staff.html', admin: '/admin.html' };

export function logout() { sessionStorage.removeItem(KEY); location.href = '/'; }

export function requireRole(...roles) {
  const s = session();
  if (!s || !roles.includes(s.user.role)) { location.href = '/'; throw new Error('redirecting'); }
  return s;
}

export async function api(path, { method = 'GET', body } = {}) {
  const s = session();
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: 'Bearer ' + s.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && s) logout();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}

// Builds DOM safely (text is never parsed as HTML, so no XSS).
export function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) e.append(c instanceof Node ? c : document.createTextNode(c ?? ''));
  return e;
}

export const fmt = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export function cd(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return (s >= 3600 ? Math.floor(s / 3600) + 'h ' : '') + Math.floor((s % 3600) / 60) + 'm ' + (s % 60) + 's';
}
export const TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'];
export const ICON = { breakfast: '🌅', lunch: '🍛', snacks: '🍪', dinner: '🌙' };
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let tt;
export function toast(msg, bad = false) {
  let t = document.getElementById('toast');
  if (!t) { t = el('div', { id: 'toast' }); document.body.append(t); }
  t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(tt); tt = setTimeout(() => (t.className = ''), 2800);
}

export function renderHeader() {
  const s = session();
  document.getElementById('top').replaceChildren(
    el('b', {}, 'Mess', el('span', {}, 'Mantra')),
    s ? el('div', { class: 'nav' }, `${s.user.name} (${s.user.role})`, el('button', { class: 'ghost', onclick: logout }, 'Logout')) : '',
  );
}

// Projected vs consumed cards, used by the staff and admin dashboards. onEdit (admin only) adds an Edit button.
export function forecastCards(meals, onEdit) {
  if (!meals.length) return [el('p', { class: 'mut' }, 'No meals yet.')];
  return meals.map((m) => {
    const max = Math.max(m.projected, 1);
    return el('div', { class: 'card' },
      el('div', { class: 'row' }, el('h3', {}, `${ICON[m.type] || ''} ${cap(m.type)}`), el('span', { class: 'pill' }, Date.now() < m.cutoffAt ? 'Open' : 'Locked')),
      el('p', { class: 'menu' }, m.menu),
      el('p', { class: 'mut' }, `Cutoff ${fmt(m.cutoffAt)} · serving ${fmt(m.serveStart)}`),
      el('p', {}, 'Head-count forecast: ', el('b', {}, m.projected)),
      el('div', { class: 'bar' }, el('i', { style: 'width:100%' })),
      el('p', {}, 'Consumed: ', el('b', {}, m.consumed)),
      el('div', { class: 'bar' }, el('i', { class: 'c', style: `width:${(m.consumed / max) * 100}%` })),
      onEdit ? el('button', { class: 'ghost', onclick: () => onEdit(m) }, '✏️ Edit meal') : '',
    );
  });
}
