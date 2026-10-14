/* dasbor.js — Dasbor Pendaftar (PRD F2, 7.3) */
'use strict';
(function () {
  const st = { tab: 'semua', mode: 'harian', tl: 'pekan' };
  const TAB = { semua: JALUR, Reguler: ['Reguler'], Sore: ['Sore'], Inter: ['Inter Ikhwan', 'Inter Akhwat'] };
  const WARNA = { calon: ['--rose-bg', '--rose-fg', '#E7998F'], du: ['--butter-bg', '--butter-fg', '#E9C25A'], ukt: ['--sage-bg', '--sage-fg', '#7FB894'],
    real: ['--cream-bg', '--cream-fg', '#F28C4B'], tdu: ['--blue-bg', '--blue-fg', '#7FA9CF'] };
  const sty = k => 'style="--tint:var(' + WARNA[k][0] + ');--fg:var(' + WARNA[k][1] + ');--accent:' + WARNA[k][2] + '"';

  registerPage('dasbor', {
    title: 'Dasbor', deps: ['ringkasan', 'snapshot', 'meta', 'rapat'],
    template: () => '<div data-r="head"></div><div class="row mb22" data-r="tabs"></div><div class="dash-grid" data-r="grid"></div><div class="card mt22" data-r="chart"></div><div data-r="foot"></div>',
    mount(el) {
      delegate(el, 'click', '[data-tab]', b => { st.tab = b.dataset.tab; Pages.dasbor.render(el); });
      delegate(el, 'click', '[data-mode]', b => { st.mode = b.dataset.mode; gambarGrafik(el); });
      delegate(el, 'click', '[data-tl]', b => { st.tl = b.dataset.tl; const k = el.querySelector('[data-r="tl"]'); if (k) k.outerHTML = kartuTL(); });
      delegate(el, 'change', '[data-poin]', c => { const x = c.dataset.poin.split('|'); window.RapatPoin.toggle(x[0], x[1], c.checked); });
      delegate(el, 'click', '[data-act]', b => {
        const a = b.dataset.act;
        if (a === 'excel') eksporDasbor();
        if (a === 'bagikan') bagikan();
        if (a === 'tempel') { App.prefill.tempel = true; go('mahasiswa'); }
      });
    },
    render(el) {
      const R = App.data.ringkasan, s = S();
      el.querySelector('[data-r="head"]').innerHTML = pageHead({
        pill: s.GELOMBANG_AKTIF || 'Gelombang 1', eyebrow: ['Biro Admisi & Akademik'],
        title: 'Calon Mahasiswa ' + (s.TAHUN_AKADEMIK || ''),
        meta: ic('clock', 'sm') + ' Terakhir diperbarui: <b>' + (R && R.diperbarui ? F.tglJam(R.diperbarui) : 'belum ada data') + '</b>',
        actions: '<button class="btn btn-white" data-act="bagikan">' + ic('share-2') + 'Bagikan</button>' +
          '<button class="btn btn-white" data-act="excel">' + ic('file-spreadsheet') + 'Download Excel (.xlsx)</button>' +
          (isAdmin() ? '<button class="btn btn-primary" data-act="tempel">' + ic('clipboard-paste') + 'Tempel Data Baru <span class="admin-tag">ADMIN</span></button>' : '')
      });
      el.querySelector('[data-r="tabs"]').innerHTML = '<div class="tabs">' + [['semua', 'Semua Jalur'], ['Reguler', 'Reguler'], ['Sore', 'Kelas Sore'], ['Inter', 'Internasional']]
        .map(t => '<button class="tab ' + (st.tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
        '<span class="badge b-peach" style="margin-left:auto">' + (App.lastSync ? 'Sinkron ' + F.rel(new Date(App.lastSync)) : 'Data perangkat') + '</span>';
      const g = el.querySelector('[data-r="grid"]');
      if (!R || !R.total) {
        g.innerHTML = '<div class="card card-pad" style="grid-column:1/-1">' + emptyBox('clipboard-paste', 'Belum ada data pendaftar', 'Tempel data dari Excel di menu Data Mahasiswa untuk mengisi dasbor.',
          isAdmin() ? '<button class="btn btn-primary" data-act="tempel">' + ic('clipboard-paste') + 'Tempel Data</button>' : '') + '</div>' + kartuTL();
      } else g.innerHTML = kartuCalon(R) + kartuDU(R) + kartuUKT(R) + kartuReal(R) + kartuTahfizh(R) + kartuTL();
      el.querySelector('[data-r="foot"]').innerHTML = '<div class="foot-note"><span>' + ic('cloud-upload', 'sm') + ' Angka dihitung di server dari sheet PENDAFTAR dan disimpan sementara agar cepat.</span><span>Otoritas: PMB ' + esc(s.NAMA_INSTITUSI || 'STIS Al Wafa') + '</span></div>';
      gambarGrafik(el);
    }
  });

  const J = () => TAB[st.tab];
  const tot = (R, k) => ringkasMatriks(R, k, J());
  const jumJ = (R, k, j) => PRODI.reduce((a, p) => a + R.m[k][j][p], 0);
  function kotakJalur(R, k) {
    const kotak = J().filter(j => !/^Inter/.test(j)).map(j => '<div class="jbox"><div class="jh"><span>' + esc(j) + '</span><b>' + F.n(jumJ(R, k, j)) + '</b></div>' +
      '<div class="pgrid">' + PRODI.map(p => '<div class="pcell">' + p + ' <b>' + F.n(R.m[k][j][p]) + '</b></div>').join('') + '</div></div>');
    const inter = J().filter(j => /^Inter/.test(j));            // Internasional hanya 1 prodi → cukup Ikhwan & Akhwat
    if (inter.length) kotak.push('<div class="jbox"><div class="jh"><span>Internasional</span><b>' + F.n(inter.reduce((a, j) => a + jumJ(R, k, j), 0)) + '</b></div>' +
      '<div class="irows">' + inter.map(j => '<div class="pcell">' + (j === 'Inter Ikhwan' ? 'Ikhwan' : 'Akhwat') + ' <b>' + F.n(jumJ(R, k, j)) + '</b></div>').join('') + '</div></div>');
    return '<div class="jalur-grid n' + kotak.length + '">' + kotak.join('') + '</div>';
  }
  /* ------------------ Tindak lanjut rapat (pengingat Tim) ------------------ */
  function periodeTL() {
    const n = new Date(), a = st.tl === 'pekan' ? new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7)) : new Date(n.getFullYear(), n.getMonth(), 1);
    const b = st.tl === 'pekan' ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7) : new Date(n.getFullYear(), n.getMonth() + 1, 1);
    return [a, b];
  }
  function kartuTL() {
    const [a, b] = periodeTL(), item = [];
    (App.data.rapat || []).forEach(c => { const d = tglObj(c.tanggal); if (d && d >= a && d < b) (c.poin || []).forEach(p => item.push({ c, p })); });
    item.sort((x, y) => (x.p.selesai - y.p.selesai) || String(y.c.tanggal).localeCompare(String(x.c.tanggal)));
    const sel = item.filter(x => x.p.selesai).length, tampil = item.slice(0, 8);
    const nama = u => { const x = ((App.data.meta || {}).users || []).find(v => v.username === u); return x ? x.nama : u; };
    return '<div class="phase tl-card" data-r="tl" style="--tint:var(--primary-tint);--fg:var(--primary-dark);--accent:#B8531F">' +
      '<div class="phase-top"><div class="phase-label"><span class="fase">Pengingat</span>Tindak lanjut rapat</div>' +
      '<div class="seg"><button class="' + (st.tl === 'pekan' ? 'on' : '') + '" data-tl="pekan">Pekan ini</button><button class="' + (st.tl === 'bulan' ? 'on' : '') + '" data-tl="bulan">Bulan ini</button></div></div>' +
      (item.length ? '<div class="row-between mt12"><span class="small muted"><b class="terracotta">' + sel + '</b> dari ' + item.length + ' poin terealisasi</span><span class="small bold">' + F.pct(sel, item.length, 0) + '</span></div>' +
        '<div class="progress ok"><i style="width:' + (sel * 100 / item.length) + '%"></i></div><div class="todo-list">' +
        tampil.map(x => '<label class="todo' + (x.p.selesai ? ' done' : '') + '"><span class="check"><input type="checkbox" data-poin="' + x.c.id + '|' + esc(x.p.id) + '" ' + (x.p.selesai ? 'checked' : '') + '></span>' +
          '<span><span class="tt">' + esc(x.p.teks) + '</span><small>' + esc(x.c.judul) + ' · ' + F.tgl(x.c.tanggal) + (x.p.selesai ? ' · ✓ ' + esc(nama(x.p.selesai_oleh)) : (x.c.penanggung_jawab ? ' · PJ ' + esc(x.c.penanggung_jawab) : '')) + '</small></span></label>').join('') + '</div>' +
        (item.length > tampil.length ? '<p class="small muted mt8">+' + (item.length - tampil.length) + ' poin lainnya</p>' : '')
        : '<div class="empty" style="padding:22px 8px">' + ic('list-checks', 'lg') + '<div>Belum ada keputusan rapat ' + (st.tl === 'pekan' ? 'pekan' : 'bulan') + ' ini.</div></div>') +
      '<a class="btn btn-soft btn-sm mt12" href="#/rapat">' + ic('notebook-pen', 'sm') + 'Buka Catatan Rapat</a></div>';
  }
  function kepala(fase, label, ikon) {
    return '<div class="phase-top"><div class="phase-label"><span class="fase">' + fase + '</span>' + label + '</div><div class="phase-ico">' + ic(ikon, 'lg') + '</div></div>';
  }
  function kartuCalon(R) {
    const u = tot(R, 'undur');
    return '<div class="phase" ' + sty('calon') + '>' + kepala('Fase 01', '1. Calon Mahasiswa', 'user-check') +
      '<div class="hero-num"><b>' + F.n(tot(R, 'calon')) + '</b><span>Pendaftar terverifikasi</span></div>' + kotakJalur(R, 'calon') +
      '<div class="undur-box"><div class="uh"><span>' + ic('circle-x', 'sm') + ' Mengundurkan diri / tidak lolos</span><span class="tot">Total: ' + F.n(u) + ' orang</span></div>' + kotakJalur(R, 'undur') + '</div></div>';
  }
  function kartuDU(R) {
    const c = tot(R, 'calon'), d = tot(R, 'du');
    return '<div class="phase" ' + sty('du') + '>' + kepala('Fase 02', '2. Daftar Ulang', 'clipboard-check') +
      '<div class="hero-num"><b>' + F.n(d) + '</b><span>Mahasiswa terdaftar ulang</span></div>' + kotakJalur(R, 'du') +
      '<div class="conv"><div class="ch"><span>Tingkat konversi daftar ulang (dari ' + F.n(c) + ' pendaftar)</span><b>' + F.pct(d, c) + '</b></div><div class="progress"><i style="width:' + (c ? d * 100 / c : 0) + '%"></i></div>' +
      '<div class="ch small"><span>Belum tes: <b class="terracotta">' + F.n(tot(R, 'belumTes')) + '</b></span><span>Lulus belum daftar ulang: <b class="terracotta">' + F.n(tot(R, 'belumDU')) + '</b></span></div></div></div>';
  }
  function kartuUKT(R) {
    const d = tot(R, 'du'), k = tot(R, 'ukt');
    return '<div class="phase" ' + sty('ukt') + '>' + kepala('Fase 03', '3. Membayar UKT', 'wallet') +
      '<div class="hero-num"><b>' + F.n(k) + '</b><span>Mahasiswa membayar UKT · ' + F.n(tot(R, 'lunas')) + ' lunas</span></div>' + kotakJalur(R, 'ukt') +
      '<div class="conv"><div class="ch"><span>Persentase bayar UKT dari daftar ulang</span><b>' + F.pct(k, d) + '</b></div><div class="progress ok"><i style="width:' + (d ? Math.min(100, k * 100 / d) : 0) + '%"></i></div>' +
      '<div class="ch small"><span>Uang pangkal: <b>' + F.n(tot(R, 'pangkal')) + '</b></span><span>Cicil: <b>' + F.n(tot(R, 'cicil')) + '</b></span></div></div></div>';
  }
  function kartuReal(R) {
    const info = {}; let n = 0;
    (App.data.meta ? App.data.meta.infoKat : []).forEach(kat => { info[kat] = J().reduce((a, j) => a + ((R.info[j] || {})[kat] || 0), 0); n += info[kat]; });
    const urut = Object.keys(info).sort((a, b) => info[b] - info[a]);
    return '<div class="phase" ' + sty('real') + '>' + kepala('Fase 04', '4. Total Real Calon Mahasiswa', 'chart-pie') +
      '<div class="hero-num"><b>' + F.n(tot(R, 'real')) + '</b><span>= ' + F.n(tot(R, 'calon')) + ' pendaftar − ' + F.n(tot(R, 'undur')) + ' undur diri/tidak lolos</span></div>' +
      '<div class="row-between mb16"><div class="phase-label">Sumber informasi pendaftar</div><span class="small muted"><b class="terracotta">' + F.n(n) + '</b> responden valid</span></div>' +
      (n ? urut.map(k => '<div class="info-row"><span><i class="dot"></i>' + esc(k) + '</span><b class="num">' + F.n(info[k]) + ' <span class="muted small">(' + F.pct(info[k], n) + ')</span></b><div class="progress thin"><i style="width:' + (info[k] * 100 / n) + '%"></i></div></div>').join('')
        : '<p class="muted small">Kolom info belum terisi pada data yang ditempel.</p>') + '</div>';
  }
  function kartuTahfizh(R) {
    const t = tot(R, 'tdu');
    return '<div class="phase" ' + sty('tdu') + '>' + kepala('Unggulan', '5. Daftar Ulang Tahfizh + S1', 'book-open') +
      '<div class="hero-num"><b>' + F.n(t) + '</b><span>Mahasiswa tahfizh terdaftar ulang · ' + F.n(tot(R, 'tahfizh')) + ' peminat</span></div>' +
      '<div class="thf-grid">' + PRODI.map(p => { const v = J().reduce((a, j) => a + R.m.tdu[j][p], 0);
        return '<div class="thf"><div class="t">' + p + '<span>' + F.pct(v, t) + '</span></div><div class="s">' + esc(prodiLabel(p)) + '</div><div class="v"><b>' + F.n(v) + '</b><span>Mahasiswa</span></div></div>'; }).join('') + '</div>' +
      '<div class="callout info mt16">' + ic('circle-check', 'sm') + 'Tahfizh adalah program tambahan yang dapat dipilih pendaftar kelas Sore.</div></div>';
  }

  /* ----------------------------- Grafik ----------------------------- */
  function seri() {
    const snap = (App.data.snapshot || []).slice().sort((a, b) => String(a.w).localeCompare(String(b.w)));
    const nilaiPada = batas => { let v = null; for (const s of snap) { if (String(s.w) <= batas) v = s; else break; } return v; };
    const titik = [], hari = new Date(); hari.setHours(23, 59, 59, 999);
    if (st.mode === 'harian') {
      for (let i = 6; i >= 0; i--) { const d = new Date(hari); d.setDate(d.getDate() - i); const v = nilaiPada(d.toISOString());
        titik.push({ l: i === 0 ? 'Hari ini' : HARI[d.getDay()], ket: F.tgl(d), v }); }
    } else {
      for (let i = 7; i >= 0; i--) { const d = new Date(hari); d.setDate(d.getDate() - i * 7); const v = nilaiPada(d.toISOString());
        titik.push({ l: i === 0 ? 'Pekan ini' : d.getDate() + ' ' + BLN[d.getMonth()], ket: 's.d. ' + F.tgl(d), v }); }
    }
    return titik.map(t => ({ l: t.l, ket: t.ket, n: t.v ? t.v.n : 0, du: t.v ? t.v.du : 0, ukt: t.v ? t.v.ukt : 0 }));
  }
  function gambarGrafik(el) {
    const box = el.querySelector('[data-r="chart"]'), data = seri(), W = 1000, H = 300, pl = 44, pr = 24, pt = 24, pb = 40;
    const maks = Math.max(10, ...data.map(d => d.n)) * 1.12, x = i => pl + i * (W - pl - pr) / (data.length - 1), y = v => pt + (H - pt - pb) * (1 - v / maks);
    const SERI = [['n', 'Pendaftar', '#F28C4B', ''], ['du', 'Daftar Ulang', '#C9672A', '6 5'], ['ukt', 'Membayar UKT', '#5C3317', '']];
    const garis = k => data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[k]).toFixed(1)).join(' ');
    const grid = [0, .25, .5, .75, 1].map(f => { const v = Math.round(maks * f / 1.12); return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#F1DFD0" stroke-dasharray="4 6"/><text x="' + (pl - 10) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="12" fill="#A08F82">' + v + '</text>'; }).join('');
    const naik = data.length ? data[data.length - 1].n - data[0].n : 0;
    box.innerHTML = '<div class="card-head"><div><h3>' + ic('trending-up') + ' Analitik Tren: Kenaikan Pendaftar</h3><p class="sub">Laju pendaftaran, daftar ulang, dan pembayaran UKT dari setiap penempelan data' + (naik ? ' · <b class="terracotta">+' + F.n(naik) + '</b> pendaftar pada periode ini' : '') + '</p></div>' +
      '<div class="seg"><button class="' + (st.mode === 'harian' ? 'on' : '') + '" data-mode="harian">Harian</button><button class="' + (st.mode === 'mingguan' ? 'on' : '') + '" data-mode="mingguan">Mingguan</button></div></div>' +
      '<div class="card-pad"><div class="chart-wrap"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafik kenaikan pendaftar ' + st.mode + '"><defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F28C4B" stop-opacity=".28"/><stop offset="1" stop-color="#F28C4B" stop-opacity="0"/></linearGradient></defs>' + grid +
      '<path d="' + garis('n') + ' L' + x(data.length - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + 'Z" fill="url(#gA)"/>' +
      SERI.map(s => '<path d="' + garis(s[0]) + '" fill="none" stroke="' + s[2] + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" ' + (s[3] ? 'stroke-dasharray="' + s[3] + '"' : '') + '/>' +
        '<circle cx="' + x(data.length - 1) + '" cy="' + y(data[data.length - 1][s[0]]) + '" r="6" fill="' + s[2] + '" stroke="#fff" stroke-width="2"/>').join('') +
      data.map((d, i) => '<text x="' + x(i) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="12" fill="' + (i === data.length - 1 ? '#B8531F' : '#7A6A5D') + '" font-weight="' + (i === data.length - 1 ? 700 : 500) + '">' + esc(d.l) + '</text>' +
        '<rect x="' + (x(i) - (W - pl - pr) / (data.length - 1) / 2) + '" y="0" width="' + ((W - pl - pr) / (data.length - 1)) + '" height="' + (H - pb) + '" fill="transparent" data-i="' + i + '"/>').join('') +
      '</svg><div class="chart-tip" hidden></div></div><div class="legend">' + SERI.map(s => '<span><i style="background:' + s[2] + '"></i>' + s[1] + ' (' + F.n(data[data.length - 1][s[0]]) + ')</span>').join('') + '</div>' +
      (!(App.data.snapshot || []).length ? '<p class="help mt12" style="text-align:center">Grafik terbentuk dari setiap penempelan data. Tempel data beberapa hari berturut-turut untuk melihat tren.</p>' : '') + '</div>';
    const svg = box.querySelector('svg'), tip = box.querySelector('.chart-tip');
    svg.addEventListener('mousemove', e => { const r = e.target.closest('rect[data-i]'); if (!r) { tip.hidden = true; return; } const d = data[r.dataset.i], b = svg.getBoundingClientRect();
      tip.hidden = false; tip.innerHTML = '<b>' + esc(d.ket) + '</b><br>Pendaftar ' + F.n(d.n) + ' · Daftar ulang ' + F.n(d.du) + ' · UKT ' + F.n(d.ukt);
      tip.style.left = (x(+r.dataset.i) / W * b.width) + 'px'; tip.style.top = (y(d.n) / H * b.height) + 'px'; });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; });
  }

  /* ------------------------- Ekspor & bagikan ------------------------ */
  function eksporDasbor() {
    const R = App.data.ringkasan; if (!R) return toast('Belum ada data.', 'warn');
    const s = S(), MET = [['calon', 'Calon Mahasiswa'], ['undur', 'Undur Diri / Tidak Lolos'], ['du', 'Daftar Ulang'], ['ukt', 'Membayar UKT'], ['lunas', 'Lunas'], ['real', 'Total Real Calon Mahasiswa'], ['tdu', 'Daftar Ulang Tahfizh + S1'], ['belumTes', 'Belum Tes'], ['belumDU', 'Belum Daftar Ulang']];
    const aoa = [['LAPORAN JUMLAH PENDAFTAR — PMB ' + (s.NAMA_INSTITUSI || '') + ' ' + (s.TAHUN_AKADEMIK || '')], ['Posisi data: ' + F.tglJam(R.diperbarui) + ' · ' + (s.GELOMBANG_AKTIF || '')], [],
      ['Kategori', 'Jalur'].concat(PRODI, ['Total'])];
    MET.forEach(m => {
      JALUR.forEach(j => aoa.push([m[1], j].concat(PRODI.map(p => R.m[m[0]][j][p]), [jumJ(R, m[0], j)])));
      aoa.push([m[1], 'TOTAL'].concat(PRODI.map(p => JALUR.reduce((a, j) => a + R.m[m[0]][j][p], 0)), [ringkasMatriks(R, m[0])]), []);
    });
    const info = [['Sumber Informasi'].concat(JALUR, ['Total'])];
    (App.data.meta.infoKat || []).forEach(k => { const r = JALUR.map(j => (R.info[j] || {})[k] || 0); info.push([k].concat(r, [r.reduce((a, b) => a + b, 0)])); });
    const sheets = [{ nama: 'Dasbor', aoa, head: 3 }, { nama: 'Info', aoa: info }];
    const KOL = ['No', 'Nama', 'No HP', 'Ujian', 'Registrasi', 'Pangkal', 'UKT', 'Lunas', 'Catatan', 'Depo', 'Asrama', 'Info', 'Tahfizh', 'Respon'];
    JALUR.forEach(j => PRODI.forEach(p => {
      const rows = App.P.filter(x => x.jalur === j && x.prodi === p); if (!rows.length) return;
      sheets.push({ nama: j.replace('Inter ', 'I-') + '-' + p, aoa: [KOL].concat(rows.map((x, i) => [i + 1, x.nama, x.no_hp, x.ujian, x.registrasi, x.pangkal, x.ukt, x.lunas, x.catatan, x.depo, x.asrama, x.info, x.tahfizh, x.respon])) });
    }));
    unduhXlsx('Laporan-Jumlah-Pendaftar-' + tglFile() + '.xlsx', sheets, 'Laporan Jumlah Pendaftar');
  }
  function teksRingkas() {
    const R = App.data.ringkasan, s = S(), sum = k => ringkasMatriks(R, k);
    return '*Laporan PMB ' + (s.NAMA_INSTITUSI || '') + ' ' + (s.TAHUN_AKADEMIK || '') + '*\n' + F.tglJam(new Date()) + '\n\n' +
      '• Calon Mahasiswa: *' + F.n(sum('calon')) + '*\n  ' + JALUR.map(j => j.replace('Inter ', 'I-') + ' ' + jumJ(R, 'calon', j)).join(' · ') + '\n' +
      '• Daftar Ulang: *' + F.n(sum('du')) + '*\n• Membayar UKT: *' + F.n(sum('ukt')) + '*\n• Undur Diri / Tidak Lolos: *' + F.n(sum('undur')) + '*\n' +
      '• Total Real: *' + F.n(sum('real')) + '*\n• Daftar Ulang Tahfizh + S1: *' + F.n(sum('tdu')) + '*';
  }
  function bagikan() {
    if (!App.data.ringkasan || !App.data.ringkasan.total) return toast('Belum ada data untuk dibagikan.', 'warn');
    const teks = teksRingkas(), adaPimpinan = (S().WA_NOMOR_PIMPINAN || '').trim() && App.data.meta.waSiap;
    const m = modal({ title: 'Bagikan ringkasan laporan', sub: 'Kirim angka dasbor ke pimpinan atau grup panitia.',
      body: '<div class="bubble" style="margin:0">' + esc(teks).replace(/\*([^*\n]+)\*/g, '<b>$1</b>') + '</div>',
      foot: '<button class="btn btn-ghost" data-b="salin">' + ic('copy') + 'Salin teks</button>' +
        (navigator.share ? '<button class="btn btn-white" data-b="share">' + ic('share-2') + 'Bagikan…</button>' : '') +
        (isAdmin() && adaPimpinan ? '<button class="btn btn-soft" data-b="fonnte">' + ic('send') + 'Kirim ke pimpinan (Fonnte)</button>' : '') +
        '<a class="btn btn-primary" href="https://wa.me/?text=' + encodeURIComponent(teks) + '" target="_blank" rel="noopener">' + ic('message-circle') + 'Buka WhatsApp</a>' });
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-b]'); if (!b) return;
      if (b.dataset.b === 'salin') salin(teks);
      if (b.dataset.b === 'share') navigator.share({ text: teks }).catch(() => { });
      if (b.dataset.b === 'fonnte') { busy(b, true, 'Mengirim…'); const r = await api('ringkasanKirim', {}); busy(b, false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close(); }
    });
  }
})();
