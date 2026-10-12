/* =====================================================================
 * app.js — boot, login, kerangka aplikasi, menu berbasis peran
 * Boot instan: bila token & cache perangkat ada, layar langsung tampil
 * dari cache lalu disegarkan di latar (satu panggilan sync).
 * ===================================================================== */
'use strict';
const MENU = [
  { grp: 'Menu Administrasi', items: [['dasbor', 'Dasbor', 'layout-dashboard'], ['mahasiswa', 'Data Mahasiswa', 'users'], ['program', 'Program PMB', 'megaphone'], ['rapat', 'Catatan Rapat', 'file-text']] },
  { grp: 'Komunikasi', items: [['blast', 'Blast WA', 'send', 'ADMIN'], ['pesan', 'Pesan & Riwayat', 'message-circle'], ['kontak', 'CRM Kontak', 'contact', 'ADMIN']] },
  { grp: 'Dokumen & Data', items: [['dokumen', 'Dokumen & TTD', 'file-pen-line'], ['migrasi', 'Migrasi Data', 'database', 'ADMIN']] },
  { grp: 'Sistem', items: [['pengaturan', 'Pengaturan', 'settings', 'ADMIN']] }
];
const BOTTOM = [['dasbor', 'Dasbor', 'layout-dashboard'], ['mahasiswa', 'Mahasiswa', 'graduation-cap'], ['program', 'Program', 'megaphone'], ['rapat', 'Catatan', 'file-text']];
const LOGO = () => ic('graduation-cap', 'lg');

document.addEventListener('DOMContentLoaded', boot);

function boot() {
  warmUp();
  const a = Auth.load();
  if (a && a.token && a.exp > Date.now()) {
    App.token = a.token; App.user = a.user; App.tetapMasuk = a.tetapMasuk; App.exp = a.exp;
    muatCache();
    tampilShell();
    if (App.data.meta && App.data.pendaftar) { route(); syncNow(null, true); }
    else { $('#main').innerHTML = '<div class="empty"><span class="spin"></span><div>Memuat data pertama kali…</div></div>';
      syncNow().then(r => { $('#main').innerHTML = ''; if (r.success) route(); }); }
  } else tampilLogin();
  $('#boot').hidden = true;
}

/* -------------------------------- LOGIN -------------------------------- */
function tampilLogin(pesan) {
  $('#shell').hidden = true;
  const el = $('#login'); el.hidden = false;
  const belumSet = !window.GAS_URL || /XXXX/.test(window.GAS_URL);
  el.innerHTML = '<div class="login-art"><div class="brand"><div class="brand-logo">' + LOGO() + '</div><div><div class="brand-name">PMB STIS</div><div class="brand-sub">Al Wafa</div></div></div>' +
    '<div><h1>Laporan PMB siap dikirim ke pimpinan kurang dari satu menit.</h1><p class="lead">Tempel data dari Excel, angka dasbor per jalur dan prodi terhitung otomatis, lalu tindak lanjuti pendaftar lewat WhatsApp — semuanya dari HP.</p></div>' +
    '<div class="stat-grid"><div class="stat"><b>4 × 4</b>jalur dan prodi terpisah otomatis</div><div class="stat"><b>.xlsx</b>semua laporan siap unduh</div></div></div>' +
    '<div class="login-form-wrap"><form class="login-card" id="fLogin" novalidate>' +
    '<div class="brand mob-only mb22"><div class="brand-logo">' + LOGO() + '</div><div><div class="brand-name">PMB STIS</div><div class="brand-sub">Al Wafa</div></div></div>' +
    '<h2>Masuk ke Laporan PMB</h2><p class="sub">Gunakan akun Admin atau Tim PMB.</p>' +
    (belumSet ? '<div class="login-err">' + ic('triangle-alert') + '<div>Alamat server belum diatur. Isi <b>GAS_URL</b> di berkas <b>js/config.js</b> dengan URL /exec dari Apps Script.</div></div>' : '') +
    '<div class="login-err" id="lErr" ' + (pesan ? '' : 'hidden') + '>' + ic('circle-x') + '<div>' + esc(pesan || '') + '</div></div>' +
    '<div class="field"><label for="lUser">Username</label><div class="input-ico">' + ic('user') + '<input class="input" id="lUser" autocomplete="username" autocapitalize="none" required placeholder="admin / timpmb"></div></div>' +
    '<div class="field"><label for="lPass">Password</label><div class="input-ico">' + ic('lock') + '<input class="input" id="lPass" type="password" autocomplete="current-password" required>' +
    '<button type="button" class="btn btn-ghost btn-icon sm trail" id="lEye" aria-label="Tampilkan password">' + ic('eye') + '</button></div></div>' +
    '<label class="check mb16"><input type="checkbox" id="lIngat" checked> Tetap masuk di perangkat ini (' + esc(S().MASA_TETAP_MASUK_HARI || '30') + ' hari)</label>' +
    '<button class="btn btn-primary btn-block" id="lBtn" type="submit">Masuk ' + ic('arrow-right') + '</button>' +
    '<p class="help mt16">Lupa password? Hubungi Admin PMB untuk menyetel ulang.</p></form></div>';
  $('#lEye').onclick = () => { const p = $('#lPass'); p.type = p.type === 'password' ? 'text' : 'password'; };
  $('#fLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const u = $('#lUser').value.trim(), p = $('#lPass').value, err = $('#lErr');
    if (!u || !p) { err.hidden = false; err.lastChild.textContent = 'Isi username dan password.'; return; }
    busy($('#lBtn'), true, 'Memeriksa…'); err.hidden = true;
    const prevUser = App.user; App.user = { username: u.toLowerCase() };
    muatCache();                                      // kirim versi cache lama milik akun ini → login hanya membawa data yang berubah
    const r = await api('login', { username: u, password: p, tetapMasuk: $('#lIngat').checked, perangkat: navigator.userAgent.slice(0, 120), have: App.vers });
    busy($('#lBtn'), false);
    if (!r.success) { App.user = prevUser; err.hidden = false; err.lastChild.textContent = r.message; return; }
    masuk(r.data);
  });
  setTimeout(() => $('#lUser') && $('#lUser').focus(), 50);
}

function masuk(d) {
  App.token = d.token; App.user = d.user; App.tetapMasuk = d.tetapMasuk; App.exp = d.exp;
  Auth.save({ token: d.token, user: d.user, exp: d.exp, tetapMasuk: d.tetapMasuk });
  applySync(d.sync);
  tampilShell();
  if (!location.hash || location.hash === '#/') location.hash = '#/dasbor'; else route();
  toast('Selamat datang, ' + d.user.nama + '.');
  if (d.wajibGanti) gantiPassword(true);
  setTimeout(() => syncNow(['de'], true), 3500);         // prefetch modul dokumen saat idle
}

function keluar(pesan) {
  hapusCacheUser(); Auth.clear();
  App.token = null; App.user = null; App.data = {}; App.vers = {}; App.P = []; App.cur = null;
  Object.keys(Pages).forEach(k => { Pages[k].dirty = true; });
  $('#main').innerHTML = ''; $$('.overlay').forEach(o => o.remove()); document.body.style.overflow = '';
  location.hash = '';
  tampilLogin(pesan);
}
on('auth-expired', () => { if (App.user) keluar('Sesi berakhir atau Anda dikeluarkan dari perangkat lain. Silakan masuk kembali.'); });

/* ------------------------------- KERANGKA ------------------------------ */
function tampilShell() {
  $('#login').hidden = true; $('#shell').hidden = false;
  const u = App.user, admin = isAdmin(), ta = String(S().TAHUN_AKADEMIK || '2026/2027').replace(/20(\d\d)\/20(\d\d)/, '$1/$2');
  const item = (it, cls) => (it[3] && it[3] !== u.peran) ? '' :
    '<a class="' + cls + '" href="#/' + it[0] + '" data-nav="' + it[0] + '">' + ic(it[2]) + '<span>' + esc(it[1]) + '</span>' + (it[3] === 'ADMIN' && cls === 'side-link' ? '<span class="tag">Admin</span>' : '') + '</a>';
  $('#sidebar').innerHTML = '<div class="brand"><div class="brand-logo">' + LOGO() + '</div><div style="min-width:0"><div class="brand-name">PMB STIS</div><div class="brand-sub">Al Wafa</div></div><span class="ta-chip" style="margin-left:auto">TA ' + esc(ta) + '</span></div>' +
    '<nav class="side-scroll" aria-label="Menu utama">' + MENU.map(g => { const isi = g.items.map(it => item(it, 'side-link')).join(''); return isi ? '<div class="side-group"><div class="side-label">' + g.grp + '</div>' + isi + '</div>' : ''; }).join('') + '</nav>' +
    '<div class="side-foot"><button class="side-link" data-act="keluar">' + ic('log-out') + '<span>Keluar Sesi</span></button></div>';
  $('#topbar').innerHTML = '<div class="brand mbrand"><div class="brand-logo" style="width:36px;height:36px">' + ic('graduation-cap') + '</div><div style="min-width:0"><div class="brand-name ellipsis" id="mTitle">Dasbor</div><div class="small muted ellipsis">Laporan Admin PMB</div></div></div>' +
    '<div class="crumb">' + ic('building-2', 'sm') + ' STIS Al Wafa <span>/</span> <b>Sistem PMB</b></div>' +
    '<span class="role-chip">' + (admin ? 'Admin PMB • Akses Penuh' : 'Tim PMB • Lihat & Catat') + '</span>' +
    '<button class="sync-chip" id="syncChip" title="Segarkan data">' + ic('refresh-cw', 'sm') + '<span class="txt" id="syncTxt">Sinkron…</span></button>' +
    '<div class="top-spacer"></div><span class="ta-chip mob-only">' + esc(ta) + '</span>' +
    '<button class="user-btn" id="userBtn" aria-haspopup="menu"><span class="who-txt"><div class="nm">' + esc(u.nama) + '</div><div class="jb">' + esc(u.jabatan || (admin ? 'Admin' : 'Tim PMB')) + '</div></span>' +
    '<span class="avatar">' + esc(F.inisial(u.nama)) + '</span>' + ic('chevron-down', 'sm desk-only') + '</button>';
  $('#bottomnav').innerHTML = BOTTOM.map(b => '<a class="bn" href="#/' + b[0] + '" data-nav="' + b[0] + '">' + ic(b[1] === 'Mahasiswa' ? 'graduation-cap' : b[2]) + '<span>' + b[1] + '</span></a>').join('');
  $('#syncChip').onclick = () => syncNow().then(r => { if (r.success) toast('Data sudah terbaru.'); });
  $('#userBtn').onclick = e => { e.stopPropagation(); menuUser(); };
  $('#sidebar').querySelector('[data-act="keluar"]').onclick = konfirmasiKeluar;
  updateSyncChip();
}
function konfirmasiKeluar() { confirmBox({ title: 'Keluar dari aplikasi?', pesan: 'Data tersimpan di server. Cache di perangkat ini akan dihapus.', ok: 'Keluar' }).then(y => { if (y) keluar(); }); }
function menuUser() {
  const ada = $('.menu-pop'); if (ada) { ada.remove(); return; }
  const u = App.user, pop = document.createElement('div'); pop.className = 'menu-pop'; pop.setAttribute('role', 'menu');
  const lain = MENU.flatMap(g => g.items).filter(it => !it[3] || it[3] === u.peran);
  pop.innerHTML = '<div class="who"><div class="bold">' + esc(u.nama) + '</div><div class="small muted">' + esc(u.username) + ' · ' + (isAdmin() ? 'Admin' : 'Tim PMB') + '</div></div>' +
    '<div class="mob-only">' + lain.map(it => '<a class="side-link" href="#/' + it[0] + '">' + ic(it[2]) + '<span>' + esc(it[1]) + '</span></a>').join('') + '<hr></div>' +
    '<button class="side-link" data-m="pw">' + ic('key-round') + '<span>Ganti Password</span></button>' +
    '<button class="side-link" data-m="semua">' + ic('smartphone') + '<span>Keluar dari semua perangkat</span></button>' +
    '<button class="side-link" data-m="keluar">' + ic('log-out') + '<span>Keluar Sesi</span></button>';
  document.body.appendChild(pop);
  const tutup = () => { pop.remove(); document.removeEventListener('click', luar); };
  const luar = e => { if (!pop.contains(e.target)) tutup(); };
  setTimeout(() => document.addEventListener('click', luar), 0);
  pop.addEventListener('click', async e => {
    const b = e.target.closest('[data-m],a'); if (!b) return; tutup();
    if (b.dataset.m === 'pw') gantiPassword(false);
    if (b.dataset.m === 'keluar') konfirmasiKeluar();
    if (b.dataset.m === 'semua') {
      if (!(await confirmBox({ title: 'Keluar dari semua perangkat?', pesan: 'Semua HP/komputer yang memakai akun ' + App.user.username + ' akan diminta login ulang, termasuk perangkat ini.', ok: 'Keluarkan semua', danger: true }))) return;
      const r = await api('keluarSemua', {}); if (r.success) keluar(r.message); else toast(r.message, 'err');
    }
  });
}
on('route', name => {
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name || (a.dataset.nav === 'program' && name === 'program')));
  $$('.side-link[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name));
  $$('.bn[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name));
  const t = $('#mTitle'); if (t && Pages[name]) t.textContent = Pages[name].title;
  const pop = $('.menu-pop'); if (pop) pop.remove();
});
function updateSyncChip() { const t = $('#syncTxt'); if (t) t.textContent = App.lastSync ? 'Terakhir sinkron: ' + F.tglJam(new Date(App.lastSync)) : 'Belum sinkron'; }
on('synced', updateSyncChip);
on('sync-start', () => { const c = $('#syncChip'); if (c) c.classList.add('busy'); });
on('sync-end', () => { const c = $('#syncChip'); if (c) c.classList.remove('busy'); });
window.addEventListener('hashchange', route);
let _tersembunyi = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { _tersembunyi = Date.now(); return; }
  if (App.user && _tersembunyi && Date.now() - _tersembunyi > 120000) { warmUp(); syncNow(null, true); }
});

/* ---------------------------- GANTI PASSWORD --------------------------- */
function kekuatan(pw) { let s = 0; if (pw.length >= 8) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++; return s; }
function sandiAcak() { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ', b = 'abcdefghjkmnpqrstuvwxyz', d = '23456789', x = '#@!%'; let s = ''; const r = n => n[crypto.getRandomValues(new Uint32Array(1))[0] % n.length];
  for (let i = 0; i < 4; i++) s += r(a) + r(b); return 'Pmb' + s + r(d) + r(d) + r(x); }
function gantiPassword(wajib) {
  const m = modal({ title: wajib ? 'Ganti password sementara' : 'Ganti password', sub: wajib ? 'Demi keamanan, password sementara wajib diganti sebelum memakai aplikasi.' : 'Perangkat lain yang memakai akun ini akan otomatis keluar.',
    dismiss: !wajib, size: 'narrow',
    body: '<div class="field"><label>Password saat ini</label><input class="input" type="password" id="pwL" autocomplete="current-password"></div>' +
      '<div class="field"><label>Password baru <button type="button" class="btn btn-ghost btn-sm" id="pwGen" style="min-height:24px">' + ic('wand-sparkles', 'sm') + 'Buat acak</button></label><input class="input" type="text" id="pwB" autocomplete="new-password">' +
      '<div class="pw-meter" id="pwM"><i></i><i></i><i></i><i></i></div><div class="help">Minimal 8 karakter, berisi huruf dan angka.</div></div>' +
      '<div class="field"><label>Ulangi password baru</label><input class="input" type="text" id="pwU" autocomplete="new-password"></div>',
    foot: (wajib ? '<button class="btn btn-ghost" id="pwOut">Keluar</button>' : '<button class="btn btn-ghost" data-x>Batal</button>') + '<button class="btn btn-primary" id="pwOk">Simpan Password</button>' });
  const meter = () => { $('#pwM').className = 'pw-meter s' + kekuatan($('#pwB').value); };
  $('#pwB').addEventListener('input', meter);
  $('#pwGen').onclick = () => { const s = sandiAcak(); $('#pwB').value = s; $('#pwU').value = s; meter(); salin(s); };
  if (wajib) $('#pwOut').onclick = () => { m.close(); keluar(); };
  $('#pwOk').onclick = async () => {
    const lama = $('#pwL').value, baru = $('#pwB').value;
    if (baru !== $('#pwU').value) return toast('Ulangi password tidak sama.', 'warn');
    busy($('#pwOk'), true, 'Menyimpan…');
    const r = await api('gantiPassword', { lama, baru, tetapMasuk: App.tetapMasuk });
    busy($('#pwOk'), false);
    if (!r.success) return toast(r.message, 'err');
    App.token = r.data.token; App.exp = r.data.exp; Auth.save({ token: App.token, user: App.user, exp: App.exp, tetapMasuk: App.tetapMasuk });
    m.close(); toast(r.message);
  };
}
