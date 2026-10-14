/* =====================================================================
 * core.js — fondasi SPA (gas-instant-ux-pro)
 * API: fetch POST text/plain (tanpa preflight CORS), timeout, retry baca,
 *      reqId untuk tulis (aman diulang), respons tulis membawa sinkron delta.
 * Cache: dataset disimpan di localStorage per pengguna → layar tampil instan,
 *        server hanya mengirim dataset yang versinya berubah.
 * Router: hash (#/halaman/param); halaman tidak dibuang saat berpindah.
 * ===================================================================== */
'use strict';
const App = { token: null, user: null, tetapMasuk: false, exp: 0, data: {}, vers: {}, P: [], lastSync: 0, syncing: null, cur: null, prefill: {}, waStatus: null };
const DS = ['meta', 'pendaftar', 'ringkasan', 'snapshot', 'program', 'rapat', 'wa', 'de'];
const LS = 'pmb:v1:';

/* ------------------------------ Util DOM ------------------------------ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls) => { const b = (window.ICONS || {})[n]; if (!b) { console.warn('Ikon hilang:', n); return ''; }
  return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>'; };
function delegate(root, type, sel, fn) { root.addEventListener(type, e => { const t = e.target.closest(sel); if (t && t !== root && root.contains(t)) fn(t, e); }); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const bus = {};
function on(ev, fn) { (bus[ev] = bus[ev] || []).push(fn); }
function emit(ev, d) { (bus[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } }); }
const isAdmin = () => !!(App.user && App.user.peran === 'ADMIN');
const S = () => ((App.data.meta || {}).pengaturan || {});
const jsonS = (k, d) => { try { return JSON.parse(S()[k] || '') || d; } catch (e) { return d; } };
const JALUR = ['Reguler', 'Sore', 'Inter Ikhwan', 'Inter Akhwat'];
const PRODI = ['HES', 'EI', 'PAI', 'IAT'];
const prodiLabel = p => (jsonS('PRODI_LABEL', {})[p] || p);

/* ------------------------------ Format -------------------------------- */
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BLN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
function tglObj(s) {
  if (!s) return null; if (s instanceof Date) return s;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  return isNaN(d) ? null : d;
}
const F = {
  n: x => (Number(x) || 0).toLocaleString('id-ID'),
  rp: x => 'Rp ' + (Math.round(Number(x) || 0)).toLocaleString('id-ID'),
  pct: (a, b, d) => b ? (a * 100 / b).toFixed(d === undefined ? 1 : d).replace('.', ',') + '%' : '0%',
  tgl: s => { const d = tglObj(s); return d ? d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() : '-'; },
  tglP: s => { const d = tglObj(s); return d ? d.getDate() + ' ' + BLN_P[d.getMonth()] + ' ' + d.getFullYear() : '-'; },
  jam: s => { const d = tglObj(s); return d ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : ''; },
  tglJam: s => { const d = tglObj(s); return d ? F.tgl(d) + ', ' + F.jam(d) + ' WIB' : '-'; },
  rel: s => { const d = tglObj(s); if (!d) return '-'; const m = (Date.now() - d) / 60000;
    if (m < 1) return 'baru saja'; if (m < 60) return Math.round(m) + ' mnt lalu'; if (m < 1440) return Math.round(m / 60) + ' jam lalu';
    if (m < 2880) return 'kemarin'; return F.tgl(d); },
  inisial: n => String(n || '?').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?',
  iso: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
};
function hp08(v) { let s = String(v == null ? '' : v).trim().replace(/\.0+$/, '').replace(/[^0-9+]/g, '').replace(/^\+/, ''); if (!s) return '';
  if (s.indexOf('62') === 0) s = '0' + s.slice(2); else if (s[0] === '8') s = '0' + s; return s; }
const hp62 = v => { const s = hp08(v); return s ? '62' + s.slice(1) : ''; };
const hpValid = v => /^08\d{8,12}$/.test(hp08(v));
const fmtHp = v => { const s = hp08(v); return s ? s.replace(/^0(\d{3})(\d{4})(\d+)$/, '+62 $1-$2-$3') : '-'; };
const waLink = (hp, teks) => 'https://wa.me/' + hp62(hp) + (teks ? '?text=' + encodeURIComponent(teks) : '');

/* ----------------------------- Penyimpanan ---------------------------- */
const Store = {
  get(k, d) { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) {
    const s = JSON.stringify(v);
    try { localStorage.setItem(LS + k, s); }
    catch (e) {   // kuota penuh → buang cache pengguna lain lalu coba sekali lagi
      Object.keys(localStorage).filter(x => x.indexOf(LS + 'u:') === 0 && x.indexOf(LS + ukey('')) !== 0).forEach(x => localStorage.removeItem(x));
      try { localStorage.setItem(LS + k, s); } catch (e2) { }
    }
  },
  del(k) { try { localStorage.removeItem(LS + k); } catch (e) { } }
};
const ukey = k => 'u:' + (App.user ? App.user.username : 'anon') + ':' + k;
const Auth = {
  load() { try { const s = localStorage.getItem(LS + 'auth') || sessionStorage.getItem(LS + 'auth'); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  save(a) { const s = JSON.stringify(a); try { (a.tetapMasuk ? localStorage : sessionStorage).setItem(LS + 'auth', s); } catch (e) { } },
  clear() { try { localStorage.removeItem(LS + 'auth'); sessionStorage.removeItem(LS + 'auth'); } catch (e) { } }
};
function muatCache() {
  App.vers = Store.get(ukey('vers'), {});
  DS.forEach(n => { const c = Store.get(ukey('ds:' + n), null); if (c) { App.data[n] = c; if (n === 'pendaftar') App.P = decodeP(c); } else delete App.vers[n]; });
  App.lastSync = Store.get(ukey('lastSync'), 0);
}
function hapusCacheUser() { Object.keys(localStorage).filter(x => x.indexOf(LS + ukey('')) === 0).forEach(x => localStorage.removeItem(x)); }

/* ------------------------------- Perf --------------------------------- */
const Perf = { rows: [], summary() { const g = {}; this.rows.forEach(r => { const x = g[r.aksi] = g[r.aksi] || { n: 0, total: 0, server: 0 }; x.n++; x.total += r.total; x.server += r.server || 0; }); console.table(Object.keys(g).map(k => ({ aksi: k, panggilan: g[k].n, rata_total: Math.round(g[k].total / g[k].n), rata_server: Math.round(g[k].server / g[k].n) }))); }, add(a, t, s) { this.rows.push({ aksi: a, total: t, server: s, jaringan: s != null ? t - s : null }); if (this.rows.length > 200) this.rows.shift(); }, table() { console.table(this.rows.slice(-30)); } };
window.Perf = Perf;

/* -------------------------------- API --------------------------------- */
const READ = /^(sync|batch|berkasAmbil|waStatus|blastDetail|antrianList|crmList|crmDetail|crmEkspor|logList|migrasiPindai|deUnduh|deMassalZip|logDownload|pendaftarStage)$/;
const NO_RETRY = /^(waTes|blastProses|waValidasi)$/;
async function apiOnce(action, data, timeout, reqId) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  try {
    const body = { action, token: App.token || '', reqId, data: data || {} };
    if (!READ.test(action) && App.user) body.have = App.vers;
    const res = await fetch(window.GAS_URL, { method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const text = await res.text();
    try { const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms); return j; }
    catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429 || res.status === 200,
      message: /<html/i.test(text) ? 'Server Apps Script membalas halaman, bukan data. Pastikan deployment "Who has access: Anyone".' : 'Server membalas HTTP ' + res.status + '.' }; }
  } catch (err) {
    return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons. Periksa koneksi lalu coba lagi.' : 'Koneksi terputus. Periksa internet Anda.' };
  } finally { clearTimeout(timer); }
}
function waitOnline(ms) { return new Promise(r => { if (navigator.onLine !== false) return r(); const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); }); }
/* gas-scale-turbo 4.2–4.3: baca identik yang sedang berjalan menumpang (epoch tulis mencegah data basi),
   baca berbeda di tik yang sama digabung menjadi satu eksekusi 'batch'. */
const BATCHABLE = /^(sync|waStatus|crmList|antrianList|logList|blastDetail)$/;
const _inflight = {}; let _writeEpoch = 0;
const Batcher = {
  q: null,
  add(action, data, opt) { return new Promise(res => { if (!this.q) { this.q = []; setTimeout(() => this.flush(), 0); } this.q.push({ action, data, opt, res }); }); },
  async flush() {
    const q = this.q; this.q = null; const perAksi = {}, sendiri = [];
    q.forEach(it => { if (!perAksi[it.action]) perAksi[it.action] = it; else sendiri.push(it); });
    const grup = Object.values(perAksi);
    if (grup.length > 1 && App.token) {
      const r = await apiRun('batch', { calls: grup.map(u => ({ action: u.action, data: u.data || {} })) }, {});
      grup.forEach(u => u.res(r.success && r.data[u.action] ? r.data[u.action] : (r.success ? { success: false, message: 'Tidak ada hasil batch.' } : r)));
    } else sendiri.push(...grup);
    sendiri.forEach(u => apiRun(u.action, u.data, u.opt).then(u.res));
  }
};
async function api(action, data, opt) {
  opt = opt || {};
  if (!READ.test(action)) { _writeEpoch++; return apiRun(action, data, opt); }
  const k = _writeEpoch + '|' + action + '|' + JSON.stringify(data || {});
  if (_inflight[k]) return _inflight[k];
  const p = BATCHABLE.test(action) && opt.batch !== false ? Batcher.add(action, data, opt).then(r => { if (r.sync) applySync(r.sync); if (!r.success && r.code === 'AUTH') emit('auth-expired', r); return r; }) : apiRun(action, data, opt);
  _inflight[k] = p; p.then(() => delete _inflight[k], () => delete _inflight[k]);
  return p;
}
async function apiRun(action, data, opt) {
  opt = opt || {};
  if (!window.GAS_URL || /XXXX/.test(window.GAS_URL)) return { success: false, message: 'GAS_URL di js/config.js belum diisi.' };
  const isRead = READ.test(action), reqId = isRead ? '' : (opt.reqId || (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()));
  const tries = NO_RETRY.test(action) ? 1 : (isRead ? 3 : 2);
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await new Promise(r => setTimeout(r, 1200 * i)); if (navigator.onLine === false) await waitOnline(15000); }
    res = await apiOnce(action, data, opt.timeout || (isRead ? (i ? 40000 : 25000) : 90000), reqId);
    if (res.success || !res.retryable) break;
  }
  if (res.v) App.serverV = res.v;
  if (res.sync) applySync(res.sync);
  if (!res.success && res.code === 'AUTH' && action !== 'login') emit('auth-expired', res);
  return res;
}
function warmUp(scope) {
  scope = scope || 'admin';
  if (!window.GAS_URL || /XXXX/.test(window.GAS_URL)) return;
  try { const k = LS + 'warm_' + scope; if (Date.now() - Number(sessionStorage.getItem(k) || 0) < 240000) return; sessionStorage.setItem(k, String(Date.now())); } catch (e) { }
  fetch(window.GAS_URL + (window.GAS_URL.indexOf('?') > -1 ? '&' : '?') + 'w=' + scope + '&t=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => { });
}
const Activity = {
  at: Date.now(), last: {},
  init() { ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'].forEach(ev => addEventListener(ev, () => { this.at = Date.now(); }, { passive: true })); },
  idle() { return Date.now() - this.at > 120000; },
  /** true bila sudah waktunya: aktif = activeMs, diam > 2 menit = idleMs, tab tersembunyi = tidak pernah */
  due(key, activeMs, idleMs) {
    if (document.visibilityState !== 'visible') return false;
    if (Date.now() - (this.last[key] || 0) < (this.idle() ? idleMs : activeMs) - 500) return false;
    this.last[key] = Date.now(); return true;
  }
};
Activity.init();

/* ---------------------------- Sinkron data ---------------------------- */
function decodeP(ds) {
  if (!ds || !ds.c) return [];
  const c = ds.c;
  return ds.r.map(r => { const o = {}; c.forEach((k, i) => o[k] = r[i]); o.f = parseFlags(o.flags || ''); return o; });
}
function parseFlags(s) { return { U: s.includes('U'), D: s.includes('D'), K: s.includes('K'), L: s.includes('L'), P: s.includes('P'), T: s.includes('T'), C: s.includes('C'), u: s.slice(-1) }; }
function applySync(s) {
  if (!s) return;
  const changed = Object.keys(s.data || {});
  if (s.data && Array.isArray(s.data.rapat)) s.data.rapat.forEach(c => { if (!Array.isArray(c.poin)) c.poin = String(c.keputusan_tindak_lanjut || '').split(/\r?\n/).map(x => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean).map((t, i) => ({ id: 'L' + (i + 1), teks: t, selesai: c.status_tindak_lanjut === 'Selesai' })); });
  changed.forEach(n => { App.data[n] = s.data[n]; if (n === 'pendaftar') App.P = decodeP(s.data[n]); Store.set(ukey('ds:' + n), s.data[n]); });
  Object.assign(App.vers, s.vers || {});
  App.lastSync = Date.now();
  Store.set(ukey('vers'), App.vers); Store.set(ukey('lastSync'), App.lastSync);
  if (changed.length) emit('data', changed);
  emit('synced', changed);
}
/** Satu panggilan untuk semua dataset; server hanya mengirim yang berubah. */
function syncNow(want, quiet) {
  if (App.syncing && !want) return App.syncing;
  emit('sync-start');
  const p = api('sync', { have: App.vers, want: want || null }).then(r => {
    if (r.success) applySync(r.data);
    else if (!quiet && r.code !== 'AUTH') toast(r.message, 'err');
    emit('sync-end', r);
    return r;
  });
  if (!want) { App.syncing = p; p.finally(() => { App.syncing = null; }); }
  return p;
}

/* ------------------------------- Router ------------------------------- */
const Pages = {};
function registerPage(name, def) { Pages[name] = Object.assign({ roles: null, deps: [], dirty: true, title: name }, def); }
function go(name, param) { const h = '#/' + name + (param ? '/' + encodeURIComponent(param) : ''); if (location.hash === h) route(); else location.hash = h; }
function route() {
  if (!App.user) return;
  let [name, param] = location.hash.replace(/^#\/?/, '').split('/');
  if (!Pages[name]) name = 'dasbor';
  let def = Pages[name];
  if (def.roles && def.roles.indexOf(App.user.peran) < 0) { toast('Halaman ini khusus Admin.', 'warn'); name = 'dasbor'; def = Pages.dasbor; param = ''; }
  let el = $('.page[data-page="' + name + '"]');
  if (!el) {
    el = document.createElement('section'); el.className = 'page'; el.dataset.page = name;
    el.innerHTML = def.template ? def.template() : '';
    $('#main').appendChild(el);
    if (def.mount) def.mount(el);
  }
  $$('.page').forEach(p => { p.hidden = p !== el; });
  const prm = param ? decodeURIComponent(param) : '', ganti = App.cur !== name || def._param !== prm;
  def._param = prm; App.cur = name;
  if (def.dirty || ganti) { def.render(el, prm); def.dirty = false; }
  if (def.show) def.show(el, prm);
  emit('route', name);
  document.title = def.title + ' · Laporan PMB STIS Al Wafa';
  if (ganti) window.scrollTo(0, 0);
  if (Date.now() - App.lastSync > 60000) syncNow(null, true);
}
on('data', names => {
  Object.keys(Pages).forEach(k => { if (Pages[k].deps.some(x => names.indexOf(x) > -1)) Pages[k].dirty = true; });
  const d = Pages[App.cur];
  if (d && d.dirty) { const el = $('.page[data-page="' + App.cur + '"]'); if (el && !el.hidden) { d.render(el, d._param); d.dirty = false; } }
});

/* -------------------------------- UI ---------------------------------- */
function toast(msg, type, ms) {
  const box = $('#toasts'); if (!box || !msg) return;
  const t = document.createElement('div'); t.className = 'toast ' + (type || 'ok');
  t.innerHTML = ic(type === 'err' ? 'circle-x' : type === 'warn' ? 'triangle-alert' : type === 'info' ? 'info' : 'circle-check') + '<div>' + esc(msg) + '</div>';
  box.appendChild(t); setTimeout(() => t.remove(), ms || (type === 'err' ? 6000 : 3500));
}
function modal(o) {
  const ov = document.createElement('div');
  ov.className = 'overlay' + (o.drawer ? ' drawer-ov' : '');
  ov.innerHTML = '<div class="modal ' + (o.size || '') + (o.drawer ? ' drawer' : '') + '" role="dialog" aria-modal="true">' +
    '<div class="modal-head"><div><h3>' + (o.title || '') + '</h3>' + (o.sub ? '<p class="sub">' + o.sub + '</p>' : '') + '</div>' +
    (o.dismiss === false ? '' : '<button class="btn btn-ghost btn-icon sm" data-x aria-label="Tutup">' + ic('x') + '</button>') + '</div>' +
    '<div class="modal-body">' + (o.body || '') + '</div>' + (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') + '</div>';
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  const m = { el: ov.querySelector('.modal'), ov, dismiss: o.dismiss !== false,
    close() { ov.remove(); if (!$('.overlay')) document.body.style.overflow = ''; if (o.onClose) o.onClose(); } };
  ov._m = m;
  if (m.dismiss) ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-x]')) m.close(); });
  const f = m.el.querySelector('input:not([type=hidden]):not([readonly]), select, textarea');
  if (f && matchMedia('(pointer: fine)').matches) setTimeout(() => f.focus(), 50);
  return m;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const ovs = $$('.overlay'), top = ovs[ovs.length - 1]; if (top && top._m && top._m.dismiss) top._m.close(); } });
function confirmBox(o) {
  return new Promise(res => {
    let jawab = false;
    const m = modal({ title: esc(o.title || 'Konfirmasi'), size: 'narrow', onClose: () => res(jawab),
      body: '<p style="line-height:22px">' + (o.html || esc(o.pesan || '')) + '</p>' +
        (o.ketik ? '<div class="field mt16"><label>Ketik <b>' + esc(o.ketik) + '</b> untuk melanjutkan</label><input class="input" data-k autocomplete="off"></div>' : '') +
        (o.alasan ? '<div class="field mt16"><label>' + esc(o.alasan) + '</label><textarea class="textarea" data-a rows="3"></textarea></div>' : ''),
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(o.ok || 'Ya, lanjutkan') + '</button>' });
    const okb = m.el.querySelector('[data-ok]'), k = m.el.querySelector('[data-k]');
    if (k) { okb.disabled = true; k.addEventListener('input', () => { okb.disabled = k.value.trim() !== o.ketik; }); }
    okb.addEventListener('click', () => { jawab = o.alasan ? (m.el.querySelector('[data-a]').value.trim() || false) : true; if (o.alasan && !jawab) { toast('Isi alasan terlebih dahulu.', 'warn'); return; } m.close(); });
  });
}
function busy(btn, on, teks) {
  if (!btn) return;
  if (on) { btn._h = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin sm"></span>' + (teks ? ' ' + esc(teks) : ''); }
  else { btn.disabled = false; if (btn._h) btn.innerHTML = btn._h; }
}
function pageHead(o) {
  return '<div class="page-head"><div class="ttl"><div class="eyebrow">' + (o.pill ? '<span class="pill">' + esc(o.pill) + '</span>' : '') +
    (o.eyebrow || []).map(t => '<span class="dot"></span><span>' + esc(t) + '</span>').join('') + '</div>' +
    '<h1 class="h1">' + esc(o.title) + '</h1>' + (o.lead ? '<p class="lead">' + esc(o.lead) + '</p>' : '') +
    (o.meta ? '<div class="meta-line">' + o.meta + '</div>' : '') + '</div><div class="head-actions">' + (o.actions || '') + '</div></div>';
}
function emptyBox(ikon, judul, teks, aksi) { return '<div class="empty"><div class="ei">' + ic(ikon, 'lg') + '</div><b>' + esc(judul) + '</b><div>' + esc(teks || '') + '</div>' + (aksi || '') + '</div>'; }
function pagerHtml(total, page, per) {
  const n = Math.max(1, Math.ceil(total / per)); if (n <= 1) return '';
  const set = new Set([1, n, page - 1, page, page + 1].filter(x => x >= 1 && x <= n)), arr = Array.from(set).sort((a, b) => a - b);
  let out = '<div class="pager"><button data-pg="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="Sebelumnya">' + ic('chevron-left', 'sm') + '</button>', prev = 0;
  arr.forEach(p => { if (p - prev > 1) out += '<span class="muted">…</span>'; out += '<button data-pg="' + p + '" class="' + (p === page ? 'on' : '') + '">' + p + '</button>'; prev = p; });
  return out + '<button data-pg="' + (page + 1) + '" ' + (page >= n ? 'disabled' : '') + ' aria-label="Berikutnya">' + ic('chevron-right', 'sm') + '</button></div>';
}

/* ------------------------- Label status pendaftar ---------------------- */
const RESPON_STYLE = { 'Belum Tes': 'b-info', 'Belum Daftar Ulang': 'b-warn', 'Mengundurkan Diri': 'b-bad', '-': 'b-mute' };
const responBadge = r => '<span class="badge ' + (RESPON_STYLE[r] || 'b-mute') + '">' + esc(r && r !== '-' ? r : 'Tuntas') + '</span>';
function ujianBadge(f) { return f.u === '1' ? '<span class="badge b-ok">Lulus</span>' : f.u === '0' ? '<span class="badge b-bad">Tidak Lulus</span>' : '<span class="badge b-mute">Belum Tes</span>'; }
function bayarStatus(f) {
  if (f.U) return ['Undur Diri', 'b-bad']; if (f.L) return ['Lunas UKT', 'b-ok']; if (f.K && f.C) return ['Cicil UKT', 'b-warn'];
  if (f.K) return ['Bayar UKT', 'b-ok']; if (f.P) return ['Uang Pangkal', 'b-info']; if (f.D) return ['Registrasi', 'b-peach']; return ['Belum Bayar', 'b-mute'];
}
const bayarBadge = f => { const b = bayarStatus(f); return '<span class="badge ' + b[1] + '">' + b[0] + '</span>'; };
const waBadge = s => s === 'Terdaftar' ? '<span class="badge b-ok plain">✓ WA</span>' : s === 'Tidak Terdaftar' ? '<span class="badge b-bad plain">✕ bukan WA</span>' : '';

/* ---------------------------- Berkas & Excel --------------------------- */
function loadScript(src) { return new Promise((res, rej) => { if ($('script[src="' + src + '"]')) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src)); document.head.appendChild(s); }); }
async function unduhXlsx(namaFile, sheets, jenisLog) {
  try {
    if (!window.XLSX) { toast('Menyiapkan Excel…', 'info', 2000); await loadScript(window.XLSX_URL || 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'); }
    const wb = XLSX.utils.book_new(), dipakai = {};
    let baris = 0;
    sheets.forEach(s => {
      const ws = XLSX.utils.aoa_to_sheet(s.aoa);
      (s.links || []).forEach(l => { const a = XLSX.utils.encode_cell({ r: l.r, c: l.c }); if (ws[a]) ws[a].l = { Target: l.url, Tooltip: l.tip || 'Buka' }; });
      ws['!cols'] = (s.aoa[s.head || 0] || []).map((_, ci) => ({ wch: Math.min(48, Math.max(6, ...s.aoa.slice(0, 300).map(r => String(r[ci] == null ? '' : r[ci]).length + 2))) }));
      let nm = String(s.nama).replace(/[\\\/?*\[\]:]/g, '-').slice(0, 31) || 'Sheet';
      while (dipakai[nm]) nm = nm.slice(0, 28) + '-' + Math.floor(Math.random() * 99);
      dipakai[nm] = 1; baris += Math.max(0, s.aoa.length - 1);
      XLSX.utils.book_append_sheet(wb, ws, nm);
    });
    XLSX.writeFile(wb, namaFile);
    api('logDownload', { jenis: jenisLog || namaFile, baris }).catch(() => { });
    toast('Excel diunduh: ' + namaFile);
  } catch (e) { toast('Gagal membuat Excel: ' + e.message, 'err'); }
}
const tglFile = () => F.iso(new Date());
function b64Blob(b64, mime) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); }
function unduhB64(nama, mime, b64) { const url = URL.createObjectURL(b64Blob(b64, mime)), a = document.createElement('a'); a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
/** Baca berkas → base64. Gambar besar dikompres di perangkat (maks 1600 px, JPEG 82%) agar unggah cepat. */
function bacaBerkas(file, opt) {
  opt = opt || {};
  return new Promise((res, rej) => {
    if (!file) return rej(new Error('Tidak ada berkas.'));
    const r = new FileReader();
    r.onerror = () => rej(new Error('Berkas tidak bisa dibaca.'));
    r.onload = () => {
      const url = r.result;
      const selesai = (dataUrl, mime) => {
        const b64 = dataUrl.split(',')[1], ukuran = Math.floor(b64.length * 3 / 4);
        if (ukuran > 5 * 1024 * 1024) return rej(new Error('Ukuran berkas melebihi 5 MB setelah dikompres.'));
        res({ base64: b64, mime, nama: file.name.replace(/\.(png|webp|heic)$/i, mime === 'image/jpeg' ? '.jpg' : '.$1'), ukuran });
      };
      if (opt.kompres !== false && /^image\/(jpeg|png|webp)$/.test(file.type) && file.size > 250 * 1024) {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, (opt.maks || 1600) / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          selesai(c.toDataURL('image/jpeg', 0.82), 'image/jpeg');
        };
        img.onerror = () => selesai(url, file.type);
        img.src = url;
      } else selesai(url, file.type || 'application/octet-stream');
    };
    r.readAsDataURL(file);
  });
}
/** Tampilkan berkas privat (bukti/lampiran) — diambil lewat server, disimpan sementara di memori. */
const _berkasCache = new Map();
async function lihatBerkas(id, nama) {
  if (!id) return;
  const m = modal({ title: esc(nama || 'Berkas'), size: 'wide', body: '<div class="empty"><span class="spin"></span><div>Memuat berkas…</div></div>' });
  let d = _berkasCache.get(id);
  if (!d) { const r = await api('berkasAmbil', { id }); if (!r.success) { m.el.querySelector('.modal-body').innerHTML = '<div class="callout bad">' + ic('circle-x') + esc(r.message) + '</div>'; return; } d = r.data; _berkasCache.set(id, d); }
  const url = URL.createObjectURL(b64Blob(d.base64, d.mime));
  m.el.querySelector('.modal-body').innerHTML = /^image\//.test(d.mime) ? '<img class="preview-img" src="' + url + '" alt="' + esc(d.nama) + '">' :
    d.mime === 'application/pdf' ? '<iframe class="preview-pdf" src="' + url + '" title="' + esc(d.nama) + '"></iframe>' :
      '<div class="callout info">' + ic('info') + 'Pratinjau tidak tersedia untuk jenis berkas ini. Gunakan tombol unduh.</div>';
  const foot = document.createElement('div'); foot.className = 'modal-foot';
  foot.innerHTML = '<button class="btn btn-soft">' + ic('download') + 'Unduh</button>';
  foot.querySelector('button').onclick = () => unduhB64(d.nama, d.mime, d.base64);
  m.el.appendChild(foot);
}
/** Dropzone berkas sederhana. el = elemen wadah; opsi.accept; cb(fileTerpilih) */
function dropzone(el, opsi, cb) {
  el.innerHTML = '<div class="dropzone" tabindex="0" role="button">' + ic('cloud-upload', 'lg') + '<b>Klik untuk unggah atau seret berkas</b><span>' + esc(opsi.info || 'PDF / gambar, maks. 5 MB') + '</span>' +
    '<input type="file" hidden accept="' + esc(opsi.accept || 'image/*,application/pdf') + '"></div>';
  const dz = el.querySelector('.dropzone'), inp = el.querySelector('input');
  dz.addEventListener('click', () => inp.click());
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) cb(e.dataTransfer.files[0]); });
  inp.addEventListener('change', () => { if (inp.files[0]) cb(inp.files[0]); inp.value = ''; });
}
async function salin(teks) { try { await navigator.clipboard.writeText(teks); toast('Disalin ke clipboard.'); } catch (e) { toast('Tidak bisa menyalin otomatis.', 'warn'); } }
function ringkasMatriks(R, metrik, jalurList) {
  let t = 0; (jalurList || JALUR).forEach(j => PRODI.forEach(p => { t += ((R.m[metrik] || {})[j] || {})[p] || 0; })); return t;
}
