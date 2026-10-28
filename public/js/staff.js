import { api, requireRole, el, toast, forecastCards, renderHeader } from './common.js';

requireRole('staff', 'admin');
renderHeader();
const main = document.getElementById('main');
const ov = document.getElementById('ov');
const start = el('button', { id: 'start', onclick: startCam }, 'Start camera');
const man = el('input', { placeholder: 'Or paste a token', style: 'flex:1' });
const fl = el('div', { class: 'grid', style: 'grid-template-columns:1fr' });
main.append(el('div', { class: 'grid' },
  el('div', { class: 'card', style: 'align-items:center;text-align:center' },
    el('h2', {}, 'Scan meal QR'),
    el('div', { id: 'reader' }),
    el('p', { class: 'mut' }, 'The camera switches off after each scan. Press Start camera for the next student.'),
    start,
    el('div', { class: 'row', style: 'width:100%' }, man, el('button', { class: 'ghost', onclick: () => man.value && check(man.value) }, 'Check'))),
  el('div', {}, el('h2', {}, 'Head-count'), fl)));

let scanner = null, busy = false;

async function startCam() {
  ov.className = 'ov'; busy = false;
  try {
    scanner = new Html5Qrcode('reader');
    await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, onScan, () => {});
    start.disabled = true;
  } catch { scanner = null; toast('Camera not available. Use HTTPS, allow the camera, or paste the token.', true); }
}

async function onScan(text) {
  if (busy) return;
  busy = true;
  try { await scanner.stop(); scanner.clear(); } catch {}
  scanner = null; start.disabled = false;
  await check(text);
}

async function check(token) {
  let r;
  try { r = await api('/scan', { method: 'POST', body: { token } }); }
  catch (e) { r = { ok: false, reason: e.message }; }
  ov.className = 'ov ' + (r.ok ? 'ok' : 'bad');
  ov.replaceChildren(
    el('div', { class: 'big' }, r.ok ? '✓' : '✕'),
    el('b', {}, r.ok ? 'SCANNED' : 'REJECTED'),
    el('div', {}, r.ok ? `${r.student} · ${r.meal} · ${r.menu}` : r.reason),
    el('button', { class: 'ghost', style: 'color:#fff;border-color:#fff', onclick: startCam }, 'Start camera'));
  man.value = '';
  loadForecast();
}

async function loadForecast() {
  try { fl.replaceChildren(...forecastCards((await api('/forecast')).meals)); } catch {}
}
loadForecast(); setInterval(loadForecast, 5000);
