/* pengaturan.js — Pengaturan Sistem & Integrasi (PRD F8) — khusus Admin */
'use strict';
(function () {
  const st = { draft: null, dirty: false, akun: 'admin', vars: null, matriks: null };
  const TEKS = [['NAMA_INSTITUSI', 'Nama institusi'], ['ALAMAT_INSTITUSI', 'Alamat (kop dokumen)'], ['TAHUN_AKADEMIK', 'Tahun akademik aktif'], ['GELOMBANG_AKTIF', 'Status gelombang'],
    ['GELOMBANG_BERAKHIR', 'Gelombang berakhir', 'date'], ['TARGET_TOTAL', 'Target total pendaftar', 'number']];

  registerPage('pengaturan', {
    title: 'Pengaturan', roles: ['ADMIN'], deps: ['meta', 'wa'],
    template: () => '<div data-r="isi"></div>',
    mount(el) {
      el.addEventListener('input', e => {
        const t = e.target;
        if (t.dataset.s) { st.draft[t.dataset.s] = t.type === 'checkbox' ? (t.checked ? 'YA' : 'TIDAK') : t.value; tandai(el); }
        if (t.dataset.kj || t.dataset.kp || t.dataset.lp) { const k = t.dataset.kj ? 'KUOTA_JALUR' : t.dataset.kp ? 'KUOTA_PRODI' : 'PRODI_LABEL', o = jsonParse(st.draft[k]);
          o[t.dataset.kj || t.dataset.kp || t.dataset.lp] = t.dataset.lp ? t.value : Number(t.value) || 0; st.draft[k] = JSON.stringify(o); tandai(el); }
        if (t.dataset.vk !== undefined || t.dataset.vv !== undefined) { simpanVars(el); tandai(el); }
      });
      el.addEventListener('change', e => { if (e.target.dataset.s && e.target.type === 'checkbox') { st.draft[e.target.dataset.s] = e.target.checked ? 'YA' : 'TIDAK'; tandai(el); } });
      delegate(el, 'click', '[data-act]', b => aksi(el, b));
      delegate(el, 'click', '[data-batch]', b => { st.draft.WA_BATCH = b.dataset.batch; $$('[data-batch]', el).forEach(x => x.classList.toggle('on', x === b)); tandai(el); });
      delegate(el, 'click', '[data-akun]', b => { st.akun = b.dataset.akun; renderAkun(el); });
    },
    render(el) {
      if (st.dirty && el.querySelector('.save-bar')) { renderStatus(el); return; }     // jangan hapus isian yang belum disimpan
      st.draft = Object.assign({}, S()); st.dirty = false; st.vars = Object.entries(jsonParse(st.draft.VARIABEL_PESAN));
      st.matriks = ((App.data.wa || {}).events || []).map(e => Object.assign({}, e));
      const d = st.draft, inp = (k, l, type, help) => '<div class="field"><label for="s_' + k + '">' + l + '</label><input class="input" id="s_' + k + '" data-s="' + k + '" type="' + (type || 'text') + '" value="' + esc(d[k] || '') + '">' + (help ? '<div class="help">' + help + '</div>' : '') + '</div>';
      const kuotaJ = jsonParse(d.KUOTA_JALUR), kuotaP = jsonParse(d.KUOTA_PRODI), lbl = jsonParse(d.PRODI_LABEL);
      el.querySelector('[data-r="isi"]').innerHTML = pageHead({ pill: 'Hak akses khusus Admin', title: 'Pengaturan Sistem & Integrasi',
        lead: 'Konfigurasi akun, sesi keamanan, master data pendaftaran, dan integrasi WhatsApp Fonnte.', actions: '<span class="badge b-peach">Backend v' + esc(((App.data.meta || {}).app || {}).VERSI || '1.0') + '</span>' }) +
        '<div class="grid g-side-wide"><div class="stack" style="gap:22px">' +
        // ------------------ FONNTE
        '<div class="card card-pad"><div class="row-between mb16"><div class="row" style="flex-wrap:nowrap"><span class="phase-ico">' + ic('message-circle') + '</span><div><h3 class="h3">Koneksi WhatsApp (Fonnte API)</h3><p class="sub">Gerbang pengiriman blast dan notifikasi otomatis.</p></div></div><span data-r="wabadge"></span></div>' +
        '<div data-r="perangkat" class="mb16"></div>' +
        '<div class="field"><label>Token API Fonnte <a class="opt" href="https://md.fonnte.com/new/device.php" target="_blank" rel="noopener">Buka konsol Fonnte ' + ic('external-link', 'sm') + '</a></label><div class="row" style="flex-wrap:nowrap"><input class="input" id="sTok" type="password" autocomplete="off" placeholder="' + esc((App.waStatus && App.waStatus.token) || 'Tempel token dari menu Device di Fonnte') + '">' +
        '<button class="btn btn-soft" data-act="tok-simpan">Simpan</button>' + ((App.data.meta || {}).waSiap ? '<button class="btn btn-ghost btn-icon" data-act="tok-hapus" title="Hapus token" aria-label="Hapus token">' + ic('trash-2') + '</button>' : '') + '</div>' +
        '<div class="help">Disimpan di Script Properties server — tidak pernah tertulis di spreadsheet atau dikirim ke browser.</div></div>' +
        '<div class="form-grid"><div class="field"><label>Jeda antarpesan (detik) <span class="badge b-peach plain">Acak adaptif</span></label><input class="input" data-s="WA_JEDA" value="' + esc(d.WA_JEDA) + '"><div class="help">Rekomendasi aman: minimal 5 detik, mis. 8-15.</div></div>' +
        '<div class="field"><label>Ukuran batch bawaan</label><div class="seg">' + ['10', '20', '50'].map(n => '<button class="' + (String(d.WA_BATCH) === n ? 'on' : '') + '" data-batch="' + n + '">' + n + '</button>').join('') + '</div></div>' +
        inp('WA_BATAS_HARIAN', 'Batas maksimal harian', 'number', '<span data-r="kuota"></span>') + inp('WA_BATAS_BLAST', 'Batas penerima per blast', 'number') + '</div>' +
        '<div class="field"><label>Nomor uji admin & diagnostik</label><div class="row" style="flex-wrap:nowrap"><input class="input" data-s="WA_NOMOR_ADMIN" value="' + esc(d.WA_NOMOR_ADMIN) + '" placeholder="0812…"><button class="btn btn-soft" data-act="uji">' + ic('send') + 'Uji koneksi</button></div><div data-r="ujiHasil"></div></div>' +
        inp('WA_NOMOR_PIMPINAN', 'Nomor pimpinan penerima ringkasan', 'text', 'Pisahkan dengan koma. Dipakai tombol "Kirim ke pimpinan" di Dasbor.') +
        '<label class="check mb8"><span class="switch"><input type="checkbox" data-s="WA_AKTIF" ' + (d.WA_AKTIF === 'YA' ? 'checked' : '') + '></span> <b>Notifikasi WhatsApp otomatis aktif</b></label>' +
        '<label class="check mb16"><span class="switch"><input type="checkbox" data-s="WA_DETEKSI_OTOMATIS" ' + (d.WA_DETEKSI_OTOMATIS === 'YA' ? 'checked' : '') + '></span> Cek otomatis apakah nomor pendaftar baru terdaftar WhatsApp</label>' +
        '<div class="callout">' + ic('shield-alert', 'sm') + '<div><b>Kepatuhan gateway WhatsApp.</b> Kirim pesan PMB hanya ke pendaftar yang memberikan nomornya pada formulir pendaftaran, isi relevan, dan beri cara berhenti (balas STOP). Nomor kampus yang dikirimi blast acak bisa dibatasi WhatsApp.</div></div></div>' +
        // ------------------ MATRIKS
        '<div class="card card-pad"><div class="row-between mb16"><div><h3 class="h3">Notifikasi otomatis</h3><p class="sub">Semua bawaan nonaktif. Berlaku bila saklar utama di atas aktif.</p></div><button class="btn btn-soft btn-sm" data-act="matriks">Simpan notifikasi</button></div>' +
        st.matriks.map((m, i) => '<div class="card-pad" style="border:1px solid var(--border);border-radius:14px;margin-bottom:10px;padding:14px"><div class="row-between"><label class="check" style="flex:1"><span class="switch"><input type="checkbox" data-mx="' + i + '" ' + (m.wa ? 'checked' : '') + '></span> <span><b>' + esc(m.label) + '</b><div class="small muted">' + m.kode + '</div></span></label>' +
          (m.kode !== 'RINGKASAN_PIMPINAN' ? '<button class="btn btn-ghost btn-sm" data-act="mx-edit" data-i="' + i + '">' + ic('pencil', 'sm') + 'Ubah pesan</button>' : '') + '</div><div data-mxp="' + i + '" hidden><textarea class="textarea mt8" data-mxt="' + i + '" rows="5">' + esc(m.pesan) + '</textarea><button class="btn btn-ghost btn-sm" data-act="mx-reset" data-i="' + i + '">↺ Kembalikan bawaan</button></div></div>').join('') + '</div>' +
        // ------------------ VARIABEL
        '<div class="card card-pad"><div class="row-between mb16"><div><h3 class="h3">Variabel pesan global</h3><p class="sub">Dipakai di templat sebagai {nama_variabel}, mis. {tanggal_ujian}.</p></div><button class="btn btn-ghost btn-sm" data-act="var-tambah">' + ic('plus', 'sm') + 'Tambah</button></div><div data-r="vars"></div></div>' +
        // ------------------ MASTER DATA
        '<div class="card card-pad"><div class="row mb16" style="flex-wrap:nowrap"><span class="phase-ico">' + ic('calendar-range') + '</span><div><h3 class="h3">Master data & tahun akademik</h3><p class="sub">Periode aktif, target, dan alokasi kuota.</p></div></div>' +
        '<div class="form-grid">' + TEKS.map(t => inp(t[0], t[1], t[2])).join('') +
        '<div class="field"><label for="s_PRODI_INTER">Prodi jalur Internasional</label><select class="select" id="s_PRODI_INTER" data-s="PRODI_INTER">' + PRODI.map(p => '<option value="' + p + '" ' + ((d.PRODI_INTER || 'HES') === p ? 'selected' : '') + '>' + p + ' — ' + esc(lbl[p] || p) + '</option>').join('') + '</select><div class="help">Internasional hanya 1 prodi; dipakai bila data tempel tanpa kolom prodi.</div></div></div>' +
        inp('APP_URL', 'Alamat aplikasi (GitHub Pages)', 'url', 'Dipakai untuk {link} di pesan dan QR verifikasi dokumen, mis. https://akun.github.io/laporan-pmb/') +
        '<div class="flabel mb8">Alokasi kuota per jalur</div><div class="table-card mb16"><table class="t"><thead><tr><th>Jalur</th><th class="r">Kuota</th><th class="r">Pendaftar</th></tr></thead><tbody>' +
        JALUR.map(j => '<tr><td class="bold">' + j + '</td><td class="r"><input class="input" style="min-height:36px;width:110px;text-align:right" type="number" min="0" data-kj="' + j + '" value="' + (kuotaJ[j] || 0) + '"></td><td class="r">' + App.P.filter(p => p.jalur === j).length + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="flabel mb8">Program studi</div><div class="table-card"><div class="table-wrap"><table class="t"><thead><tr><th>Kode</th><th>Nama lengkap</th><th class="r">Kuota</th></tr></thead><tbody>' +
        PRODI.map(p => '<tr><td class="bold">' + p + '</td><td><input class="input" style="min-height:36px" data-lp="' + p + '" value="' + esc(lbl[p] || '') + '"></td><td class="r"><input class="input" style="min-height:36px;width:100px;text-align:right" type="number" min="0" data-kp="' + p + '" value="' + (kuotaP[p] || 0) + '"></td></tr>').join('') + '</tbody></table></div></div></div>' +
        '</div><div class="stack sticky" style="gap:22px">' +
        // ------------------ AKUN
        '<div class="card card-pad"><div class="row mb16" style="flex-wrap:nowrap"><span class="phase-ico">' + ic('user-round-cog') + '</span><div><h3 class="h3">Manajemen akun & hak akses</h3><p class="sub">Dua akun bersama operasional PMB.</p></div></div><div data-r="akun"></div></div>' +
        // ------------------ SESI
        '<div class="card card-pad"><div class="row mb16" style="flex-wrap:nowrap"><span class="phase-ico">' + ic('shield-check') + '</span><div><h3 class="h3">Sesi & keamanan</h3><p class="sub">Masa "tetap masuk" dan perlindungan login.</p></div></div>' +
        '<div class="field"><label>Masa berlaku "tetap masuk"</label><select class="select" data-s="MASA_TETAP_MASUK_HARI">' + [7, 14, 30, 60, 90].map(n => '<option value="' + n + '" ' + (String(d.MASA_TETAP_MASUK_HARI) === String(n) ? 'selected' : '') + '>' + n + ' hari' + (n === 30 ? ' (bawaan)' : '') + '</option>').join('') + '</select><div class="help">Tanpa centang "tetap masuk", sesi berakhir 12 jam atau saat browser ditutup.</div></div>' +
        '<div class="callout mb16">' + ic('lock', 'sm') + '<div><b>Proteksi brute-force aktif.</b> Akun dikunci 5 menit setelah 5 kali salah password. Password disimpan dalam bentuk hash bergaram.</div></div>' +
        '<div class="field"><label>Interval sinkron otomatis CRM (menit)</label><input class="input" type="number" min="5" data-s="CRM_SYNC_MENIT" value="' + esc(d.CRM_SYNC_MENIT) + '"></div>' +
        '<div class="grid g2" style="gap:10px"><button class="btn btn-white" data-act="log">' + ic('history') + 'Log aktivitas</button><button class="btn btn-danger" data-act="keluar-semua">' + ic('smartphone') + 'Keluar semua perangkat</button></div></div>' +
        '<a class="card card-pad row" href="#/program" style="text-decoration:none;color:inherit;flex-wrap:nowrap">' + ic('megaphone') + '<div><b>Jenis program PMB</b><div class="small muted">Kelola kategori & anggaran di Program PMB Hub</div></div>' + ic('chevron-right', 'sm') + '</a>' +
        '</div></div><div class="save-bar" data-r="save" hidden><div class="row" style="flex-wrap:nowrap">' + ic('database') + '<div><b>Perubahan belum disimpan</b><div class="small muted">Berlaku untuk permintaan berikutnya setelah disimpan.</div></div></div><div class="row"><button class="btn btn-ghost" data-act="batal">Batal</button><button class="btn btn-primary" data-act="simpan">' + ic('check') + 'Simpan semua perubahan</button></div></div>';
      renderVars(el); renderAkun(el); renderStatus(el);
    },
    show() { muatStatus(); }
  });
  function jsonParse(s) { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } }
  function tandai(el) { st.dirty = true; el.querySelector('[data-r="save"]').hidden = false; }
  async function muatStatus(paksa) { if (!paksa && App.waStatus && Date.now() - App.waStatus._t < 120000) return; const r = await api('waStatus', {}); if (r.success) { App.waStatus = Object.assign(r.data, { _t: Date.now() }); const el = $('.page[data-page="pengaturan"]'); if (el) renderStatus(el); } }
  function renderStatus(el) {
    const s = App.waStatus, box = el.querySelector('[data-r="perangkat"]'); if (!box) return;
    const d = s && s.perangkat, on = d && d.status === 'connect';
    el.querySelector('[data-r="wabadge"]').innerHTML = '<span class="badge ' + (on ? 'b-ok' : s && s.adaToken ? 'b-warn' : 'b-mute') + '">' + (on ? 'Gateway terhubung' : s && s.adaToken ? 'Periksa perangkat' : 'Belum diatur') + '</span>';
    box.innerHTML = !s ? '<div class="skel" style="height:64px"></div>' : !s.adaToken ? '<div class="callout warn">' + ic('triangle-alert', 'sm') + '<div>Token Fonnte belum diisi. Daftar di fonnte.com → Device → hubungkan nomor WA kampus (scan QR) → salin token ke sini.</div></div>' :
      '<div class="row-between" style="background:var(--primary-tint);border-radius:14px;padding:14px"><div class="row" style="flex-wrap:nowrap">' + ic('smartphone') + '<div><b>' + esc(d && d.nomor ? fmtHp(d.nomor) : 'Perangkat') + '</b><div class="small muted">' + esc(d ? (d.status === 'connect' ? 'Tersambung' : d.status || d.pesan || '') : '') + (d && d.kedaluwarsa ? ' · aktif s.d. ' + esc(d.kedaluwarsa) : '') + '</div></div></div>' +
        '<div style="text-align:right"><span class="badge b-peach plain">' + esc(d && d.paket ? 'Paket ' + d.paket : 'Fonnte') + '</span><div class="small muted">Kuota ' + esc(d && d.kuota || '-') + ' · trigger ' + (s.triggerAktif ? 'aktif' : 'mati') + '</div></div></div>' +
        '<div class="row mt8 small muted">Terkirim hari ini <b>&nbsp;' + F.n(s.terkirimHariIni) + '/' + F.n(s.batasHarian) + '</b><button class="btn btn-ghost btn-sm" data-act="cek" style="margin-left:auto">' + ic('refresh-cw', 'sm') + 'Cek perangkat</button></div>';
    const k = el.querySelector('[data-r="kuota"]'); if (k && s) k.innerHTML = '<div class="progress thin"><i style="width:' + Math.min(100, s.batasHarian ? s.terkirimHariIni * 100 / s.batasHarian : 0) + '%"></i></div>Terpakai ' + F.pct(s.terkirimHariIni, s.batasHarian) + ' hari ini';
  }
  function renderVars(el) {
    el.querySelector('[data-r="vars"]').innerHTML = st.vars.length ? st.vars.map((v, i) => '<div class="row mb8" style="flex-wrap:nowrap"><span class="var-chip" style="cursor:default">{</span><input class="input" style="max-width:180px" data-vk="' + i + '" value="' + esc(v[0]) + '" placeholder="nama_variabel"><span class="var-chip" style="cursor:default">}</span><input class="input" data-vv="' + i + '" value="' + esc(v[1]) + '" placeholder="isi"><button class="btn btn-ghost btn-icon sm" data-act="var-hapus" data-i="' + i + '" aria-label="Hapus">' + ic('x', 'sm') + '</button></div>').join('') : '<p class="small muted">Belum ada variabel.</p>';
  }
  function simpanVars(el) {
    st.vars = $$('[data-vk]', el).map(i => [i.value.trim().replace(/[^\w]/g, '_'), (el.querySelector('[data-vv="' + i.dataset.vk + '"]') || {}).value || '']);
    const o = {}; st.vars.forEach(v => { if (v[0]) o[v[0]] = v[1]; }); st.draft.VARIABEL_PESAN = JSON.stringify(o);
  }
  function renderAkun(el) {
    const U = (App.data.meta || {}).users || [], u = U.find(x => x.username === st.akun) || U[0] || {};
    el.querySelector('[data-r="akun"]').innerHTML = '<div class="tabs mb16">' + U.map(x => '<button class="tab ' + (x.username === st.akun ? 'on' : '') + '" data-akun="' + x.username + '">' + ic(x.peran === 'ADMIN' ? 'shield-check' : 'users-round', 'sm') + (x.peran === 'ADMIN' ? 'Akun Admin' : 'Akun Tim PMB') + '</button>').join('') + '</div>' +
      '<div style="background:var(--canvas);border-radius:14px;padding:14px" class="mb16"><div class="row-between"><b>' + esc(u.nama) + '</b><span class="badge b-peach plain">' + (u.peran === 'ADMIN' ? 'Akses penuh' : 'Lihat & catat') + '</span></div><div class="small muted">Username: <b>' + esc(u.username) + '</b></div>' +
      '<div class="chips mt8">' + (u.peran === 'ADMIN' ? ['Tempel data', 'Blast WA', 'Program PMB', 'Pengaturan'] : ['Lihat dasbor', 'Unduh Excel', 'Tulis catatan rapat', 'Lihat riwayat blast']).map(t => '<span class="tag-mini">' + t + '</span>').join('') + '</div></div>' +
      '<div class="form-grid"><div class="field"><label>Nama tampilan</label><input class="input" id="aNm" value="' + esc(u.nama) + '"></div><div class="field"><label>Jabatan</label><input class="input" id="aJb" value="' + esc(u.jabatan) + '"></div></div>' +
      '<button class="btn btn-soft btn-block mb16" data-act="akun-simpan" data-u="' + esc(u.username) + '">Simpan profil akun</button>' +
      '<div class="field"><label>Ganti password akun <button type="button" class="btn btn-ghost btn-sm" data-act="gen" style="min-height:24px">' + ic('wand-sparkles', 'sm') + 'Buat acak</button></label><input class="input" id="aPw" type="text" autocomplete="new-password" placeholder="Password baru">' +
      '<div class="pw-meter" id="aMeter"><i></i><i></i><i></i><i></i></div><div class="help">Minimal 8 karakter, huruf dan angka. ' + (u.username !== App.user.username ? 'Pengguna wajib menggantinya saat login berikutnya.' : '') + '</div></div>' +
      '<button class="btn btn-white btn-block" data-act="reset-pw" data-u="' + esc(u.username) + '">' + ic('key-round') + 'Setel password ' + esc(u.username) + '</button>';
    const pw = $('#aPw'); pw.addEventListener('input', () => { $('#aMeter').className = 'pw-meter s' + kekuatan(pw.value); });
  }
  async function aksi(el, b) {
    const a = b.dataset.act;
    if (a === 'batal') { st.dirty = false; Pages.pengaturan.render(el); }
    if (a === 'simpan') {
      const set = {}; Object.keys(st.draft).forEach(k => { if (String(st.draft[k] == null ? '' : st.draft[k]) !== String(S()[k] == null ? '' : S()[k])) set[k] = st.draft[k]; });
      if (!Object.keys(set).length) { st.dirty = false; el.querySelector('[data-r="save"]').hidden = true; return; }
      busy(b, true, 'Menyimpan…'); const r = await api('pengaturanSimpan', { set }); busy(b, false);
      toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { st.dirty = false; Pages.pengaturan.render(el); }
    }
    if (a === 'cek') { busy(b, true); await muatStatus(true); busy(b, false); }
    if (a === 'tok-simpan') { const t = $('#sTok').value.trim(); if (!t) return toast('Tempel token Fonnte.', 'warn'); busy(b, true); const r = await api('waKonfigSimpan', { token: t }); busy(b, false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { $('#sTok').value = ''; muatStatus(true); } }
    if (a === 'tok-hapus') { if (!(await confirmBox({ title: 'Hapus token Fonnte?', pesan: 'Blast dan notifikasi WhatsApp berhenti sampai token diisi lagi.', ok: 'Hapus token', danger: true }))) return; const r = await api('waKonfigSimpan', { token: '__HAPUS__' }); toast(r.message, r.success ? 'ok' : 'err'); muatStatus(true); }
    if (a === 'uji') { const n = el.querySelector('[data-s="WA_NOMOR_ADMIN"]').value; busy(b, true, 'Mengirim…'); const r = await api('waTes', { nomor: n }); busy(b, false);
      el.querySelector('[data-r="ujiHasil"]').innerHTML = '<div class="callout ' + (r.success ? 'ok' : 'bad') + ' mt8">' + ic(r.success ? 'circle-check' : 'circle-x', 'sm') + esc(r.message) + '</div>'; }
    if (a === 'mx-edit') { const p = el.querySelector('[data-mxp="' + b.dataset.i + '"]'); p.hidden = !p.hidden; }
    if (a === 'mx-reset') { const i = +b.dataset.i; el.querySelector('[data-mxt="' + i + '"]').value = st.matriks[i].pesanBawaan; }
    if (a === 'matriks') {
      const mx = {}; st.matriks.forEach((m, i) => { const t = el.querySelector('[data-mxt="' + i + '"]'); mx[m.kode] = { wa: el.querySelector('[data-mx="' + i + '"]').checked, pesan: t ? t.value : m.pesan }; });
      busy(b, true); const r = await api('waKonfigSimpan', { matriks: mx }); busy(b, false); toast(r.message, r.success ? 'ok' : 'err');
      if (r.success && Object.values(mx).some(x => x.wa) && S().WA_AKTIF !== 'YA') toast('Ingat: nyalakan juga saklar "Notifikasi WhatsApp otomatis aktif".', 'warn', 6000);
    }
    if (a === 'var-tambah') { simpanVars(el); st.vars.push(['', '']); renderVars(el); }
    if (a === 'var-hapus') { simpanVars(el); st.vars.splice(+b.dataset.i, 1); const o = {}; st.vars.forEach(v => { if (v[0]) o[v[0]] = v[1]; }); st.draft.VARIABEL_PESAN = JSON.stringify(o); renderVars(el); tandai(el); }
    if (a === 'akun-simpan') { busy(b, true); const r = await api('akunSimpan', { username: b.dataset.u, nama: $('#aNm').value, jabatan: $('#aJb').value }); busy(b, false); toast(r.message, r.success ? 'ok' : 'err');
      if (r.success && b.dataset.u === App.user.username) { App.user.nama = $('#aNm').value; App.user.jabatan = $('#aJb').value; Auth.save({ token: App.token, user: App.user, exp: App.exp, tetapMasuk: App.tetapMasuk }); tampilShell(); route(); } }
    if (a === 'gen') { const s = sandiAcak(); $('#aPw').value = s; $('#aMeter').className = 'pw-meter s' + kekuatan(s); salin(s); }
    if (a === 'reset-pw') {
      const pw = $('#aPw').value; if (!pw) return toast('Isi password baru.', 'warn');
      if (!(await confirmBox({ title: 'Setel password ' + b.dataset.u + '?', pesan: 'Semua perangkat yang memakai akun ini akan keluar' + (b.dataset.u === App.user.username ? ', termasuk perangkat ini.' : '.'), ok: 'Setel password' }))) return;
      const r = await api('akunResetPassword', { username: b.dataset.u, baru: pw }); toast(r.message, r.success ? 'ok' : 'err');
      if (r.success && b.dataset.u === App.user.username) keluar('Password diganti. Silakan masuk dengan password baru.');
    }
    if (a === 'keluar-semua') { if (!(await confirmBox({ title: 'Keluar dari semua perangkat?', pesan: 'Semua perangkat akun Admin, termasuk perangkat ini, diminta login ulang.', ok: 'Keluarkan semua', danger: true }))) return; const r = await api('keluarSemua', {}); if (r.success) keluar(r.message); }
    if (a === 'log') {
      const m = modal({ title: 'Log aktivitas', sub: '200 aktivitas terakhir (login, tempel data, hapus, download, blast).', size: 'xwide', body: '<div class="empty"><span class="spin"></span></div>' });
      const r = await api('logList', { n: 200 });
      m.el.querySelector('.modal-body').innerHTML = r.success ? '<div class="table-card"><div class="table-wrap" style="max-height:65vh"><table class="t"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>' +
        r.data.map(x => '<tr><td class="small" style="white-space:nowrap">' + F.tglJam(x.waktu) + '</td><td>' + esc(x.pengguna) + '</td><td><span class="badge b-peach plain">' + esc(x.aksi) + '</span></td><td class="small">' + esc(x.detail) + '</td></tr>').join('') + '</tbody></table></div></div>' : '<div class="callout bad">' + esc(r.message) + '</div>';
    }
  }
  on('data', n => { if (n.indexOf('waStatus') > -1) { const el = $('.page[data-page="pengaturan"]'); if (el && !el.hidden) renderStatus(el); } });
})();
