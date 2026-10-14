/* wa.js — Blast WhatsApp via Fonnte (PRD F9) + Templat & Riwayat (PRD F10) */
'use strict';
(function () {
  const RESP = [['Belum Tes', 'Prioritas 1', 'Belum Ikut Tes', '--butter-bg', '--butter-fg'], ['Belum Daftar Ulang', 'Tahap 2', 'Belum Registrasi', '--blue-bg', '--blue-fg'],
    ['Mengundurkan Diri', 'Follow-up', 'Undur Diri', '--rose-bg', '--rose-fg'], ['Sudah Registrasi', 'Grup & Bayar', 'Sudah Registrasi', '--sage-bg', '--sage-fg'],
    ['Umum', 'Semua', 'Semua Pendaftar', '--cream-bg', '--cream-fg']];
  /* v1.1: kelompok "Sudah Registrasi" = registrasi bertanda & bukan undur diri; sub-filter status bayar untuk pengingat */
  const BAYAR = [['', 'Semua'], ['pangkal', 'Belum Uang Pangkal'], ['ukt', 'Belum bayar UKT'], ['lunas', 'Belum lunas']];
  const cocokRespon = (p, r) => r === 'Umum' || (r === 'Sudah Registrasi' ? (p.f.D && !p.f.U && (!B.bayar || (B.bayar === 'pangkal' && !p.f.P) || (B.bayar === 'ukt' && !p.f.K) || (B.bayar === 'lunas' && !p.f.L))) : p.respon === r);
  const varKosong = t => Array.from(new Set((String(t || '').match(/\{(\w+)\}/g) || [])));
  const B = { respon: 'Belum Tes', jalur: new Set(), prodi: new Set(), ids: null, kontak: null, hanyaWA: false, kecuali: new Set(), templatId: '', pesan: '', judul: '',
    batch: 0, jeda: '', konfirmasi: false, yakin: false, auto: true, next: 0, lihat: false, bayar: '' };
  const W = () => App.data.wa || { templat: [], blast: [], optout: [], kuota: {} };
  const vars = p => Object.assign({}, jsonS('VARIABEL_PESAN', {}), { institusi: S().NAMA_INSTITUSI, tahun_akademik: S().TAHUN_AKADEMIK, gelombang: S().GELOMBANG_AKTIF, link: S().APP_URL,
    nama: p.nama || 'Bapak/Ibu', prodi: p.prodi || '', prodi_lengkap: prodiLabel(p.prodi), jalur: p.jalur || '', respon: p.respon || '', asrama: p.asrama || '' });
  const isiVar = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => v[k] == null ? m : String(v[k]));
  const waFmtTanda = t => { const ada = []; const s = String(t || '').replace(/\{(\w+)\}/g, (m, k) => { ada.push(k); return '\u0001' + (ada.length - 1) + '\u0002'; });
    return waFmt(s).replace(/\u0001(\d+)\u0002/g, (m, i) => '<mark title="Belum ada nilai">{' + esc(ada[+i]) + '}</mark>'); };
  const waFmt = t => esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>').replace(/~([^~\n]+)~/g, '<s>$1</s>');
  const rataJeda = j => { const p = String(j || '8-15').split('-').map(Number); return p.length > 1 ? (p[0] + p[1]) / 2 : (p[0] || 5); };
  const blastAktif = () => W().blast.find(b => b.status === 'Berjalan');
  const stBlast = s => '<span class="badge ' + ({ Berjalan: 'b-info', Selesai: 'b-ok', 'Sebagian Gagal': 'b-warn', Dihentikan: 'b-mute' }[s] || 'b-mute') + '">' + esc(s === 'Berjalan' ? 'Mengirim…' : s) + '</span>';
  async function muatStatusWa(paksa) {
    if (!isAdmin() || (!paksa && App.waStatus && Date.now() - App.waStatus._t < 300000)) return;
    const r = await api('waStatus', {}); if (r.success) { App.waStatus = Object.assign(r.data, { _t: Date.now() }); emit('data', ['waStatus']); }
  }
  function kartuFonnte() {
    const s = App.waStatus, siap = (App.data.meta || {}).waSiap;
    if (!siap) return '<a class="card card-pad row" href="#/pengaturan" style="gap:12px;text-decoration:none;color:inherit">' + ic('triangle-alert') + '<div><b>Fonnte belum terhubung</b><div class="small muted">Isi token di Pengaturan → WhatsApp</div></div></a>';
    const d = s && s.perangkat, on = d && d.status === 'connect';
    return '<div class="card card-pad row" style="gap:12px"><span class="dot-st" style="width:12px;height:12px;background:' + (on ? '#3BD16F' : s ? '#E5A11A' : '#C8B8AA') + '"></span><div style="min-width:0"><b>' + (on ? 'Fonnte terhubung' : s ? 'Perangkat Fonnte ' + esc((d && d.status) || 'tidak terbaca') : 'Memeriksa Fonnte…') + '</b>' +
      (on ? ' <span class="badge b-ok plain">Aktif</span><div class="small muted">' + esc(fmtHp(d.nomor)) + ' · Kuota: ' + esc(d.kuota || '-') + ' msg · Terkirim hari ini ' + F.n(s.terkirimHariIni) + '/' + F.n(s.batasHarian) + '</div>' : '') + '</div></div>';
  }

  /* ============================== BLAST ============================== */
  registerPage('blast', {
    title: 'Blast WhatsApp', roles: ['ADMIN'], deps: ['pendaftar', 'waStatus', 'meta'],
    template: () => '<div data-r="head"></div><div data-r="progres"></div><div class="stepper" data-r="step"></div><div class="grid g-side-wide"><div class="stack" style="gap:22px" data-r="kiri"></div><div class="stack sticky" style="gap:16px" data-r="kanan"></div></div>',
    mount(el) {
      delegate(el, 'click', '[data-act]', b => aksi(el, b));
      delegate(el, 'click', '[data-bayar]', b => { B.bayar = b.dataset.bayar; B.kecuali.clear(); renderKiri(el); renderKanan(el); });
      delegate(el, 'click', '[data-resp]', b => { B.respon = b.dataset.resp; B.bayar = ''; B.ids = null; B.kontak = null; B.kecuali.clear(); pilihTemplatBawaan(); renderKiri(el); renderKanan(el); });
      delegate(el, 'click', '[data-jalur]', b => { tog(B.jalur, b.dataset.jalur); renderKiri(el); renderKanan(el); });
      delegate(el, 'click', '[data-prodi]', b => { tog(B.prodi, b.dataset.prodi); renderKiri(el); renderKanan(el); });
      delegate(el, 'click', '[data-var]', b => { const t = $('#bPesan'); const s = t.selectionStart || t.value.length; t.value = t.value.slice(0, s) + b.dataset.var + t.value.slice(t.selectionEnd || s); t.focus(); t.selectionStart = t.selectionEnd = s + b.dataset.var.length; B.pesan = t.value; renderPrev(el); });
      delegate(el, 'change', '[data-kec]', c => { c.checked ? B.kecuali.delete(c.dataset.kec) : B.kecuali.add(c.dataset.kec); renderRingkas(el); renderPrev(el); });
      el.addEventListener('input', e => {
        if (e.target.id === 'bPesan') { B.pesan = e.target.value; renderPrev(el); const c = $('#bCount'); if (c) c.textContent = B.pesan.length + ' karakter'; }
        if (e.target.id === 'bJudul') B.judul = e.target.value;
        if (e.target.id === 'bJeda') { B.jeda = e.target.value; renderRingkas(el); }
      });
      el.addEventListener('change', e => {
        if (e.target.id === 'bTpl') { B.templatId = e.target.value; const t = W().templat.find(x => x.id === B.templatId); if (t) B.pesan = t.isi_pesan; renderKiri(el); renderKanan(el); }
        if (e.target.id === 'bHanyaWA') { B.hanyaWA = e.target.checked; renderKiri(el); renderKanan(el); }
        if (e.target.id === 'bYakin') B.yakin = e.target.checked;
        if (e.target.id === 'bAuto') { B.auto = e.target.checked; jadwal(); }
      });
      setInterval(() => tikOtomatis(el), 1000);
    },
    render(el) {
      el.querySelector('[data-r="head"]').innerHTML = pageHead({ pill: 'Modul Komunikasi', eyebrow: ['Fonnte API'], title: 'Blast WhatsApp',
        lead: 'Kirim pesan broadcast ke kelompok pendaftar terfilter melalui gateway Fonnte, dengan jeda acak dan batas harian agar nomor kampus tetap aman.',
        actions: '<div style="min-width:260px">' + kartuFonnte() + '</div>' });
      renderProgres(el); renderKiri(el); renderKanan(el);
    },
    show(el) {
      const pf = App.prefill.blast;
      if (pf) {
        App.prefill.blast = null; B.kecuali.clear(); B.konfirmasi = false;
        B.respon = pf.respon || 'Umum'; B.jalur = new Set(pf.jalur || []); B.prodi = new Set(pf.prodi || []); B.ids = pf.ids || null; B.kontak = pf.kontak || null;
        if (pf.templatId) { const t = W().templat.find(x => x.id === pf.templatId); if (t) { B.templatId = t.id; B.pesan = t.isi_pesan; if (t.untuk_respon !== 'Umum' && !pf.respon) B.respon = t.untuk_respon; } }
        else pilihTemplatBawaan(true);
        Pages.blast.render(el);
      } else if (!B.pesan) { pilihTemplatBawaan(); renderKiri(el); renderKanan(el); }
      muatStatusWa(); jadwal();
    }
  });
  function tog(set, v) { if (set.has(v)) set.delete(v); else set.add(v); B.ids = null; }
  function pilihTemplatBawaan(paksa) {
    const t = W().templat.find(x => x.untuk_respon === B.respon) || W().templat.find(x => x.untuk_respon === 'Umum');
    if (t && (paksa || !B.pesan || W().templat.some(x => x.isi_pesan === B.pesan))) { B.templatId = t.id; B.pesan = t.isi_pesan; }
  }
  function kandidat() {
    if (B.kontak) return B.kontak.map(k => ({ id: k.id, nama: k.nama, no_hp: k.no_wa, status_wa: k.status_wa, prodi: (k.info || {}).prodi || '', jalur: (k.info || {}).jalur || '', respon: (k.info || {}).respon || '', optout: k.opt_out }));
    if (B.ids) { const s = new Set(B.ids); return App.P.filter(p => s.has(p.id)); }
    return App.P.filter(p => cocokRespon(p, B.respon) && (!B.jalur.size || B.jalur.has(p.jalur)) && (!B.prodi.size || B.prodi.has(p.prodi)));
  }
  function analisa() {
    const opt = new Set(W().optout || []), seen = new Set(), ok = [], lewat = [];
    kandidat().forEach(p => { const hp = hp08(p.no_hp); let a = '';
      if (!hpValid(hp)) a = 'Nomor tidak valid'; else if (seen.has(hp)) a = 'Nomor ganda'; else if (opt.has(hp) || p.optout) a = 'Opt-out (minta berhenti)';
      else if (B.hanyaWA && p.status_wa === 'Tidak Terdaftar') a = 'Bukan nomor WhatsApp'; else if (B.kecuali.has(p.id)) a = 'Dikecualikan manual';
      if (a) lewat.push({ p, a }); else { seen.add(hp); ok.push(p); } });
    return { ok, lewat };
  }
  function renderProgres(el) {
    const b = blastAktif(), box = el.querySelector('[data-r="progres"]');
    if (!b) { box.innerHTML = ''; return; }
    const sel = b.terkirim + b.gagal, pct = b.target ? Math.round(sel * 100 / b.target) : 0;
    box.innerHTML = '<div class="card card-pad mb22" style="border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-ring)"><div class="row-between"><div><div class="eyebrow" style="margin:0"><span class="pill">' + esc(b.id) + '</span><span class="dot"></span><span>' + esc(b.respon) + ' · ' + esc(b.filter || '') + '</span></div>' +
      '<h3 class="h3 mt8">Blast sedang berjalan — ' + pct + '%</h3></div>' + stBlast(b.status) + '</div><div class="progress" style="height:12px"><i style="width:' + pct + '%"></i></div>' +
      '<div class="row small"><span><b class="terracotta">' + F.n(b.terkirim) + '</b> terkirim</span><span>·</span><span><b style="color:var(--bad-fg)">' + F.n(b.gagal) + '</b> gagal</span><span>·</span><span><b>' + F.n(b.sisa) + '</b> menunggu</span><span>·</span><span>batch ' + b.batch + ', jeda ' + esc(b.jeda) + ' dtk</span></div>' +
      '<div class="row mt12"><button class="btn btn-primary btn-sm" data-act="proses" data-id="' + b.id + '">' + ic('play', 'sm') + 'Kirim batch berikutnya sekarang</button>' +
      '<label class="check small"><span class="switch"><input type="checkbox" id="bAuto" ' + (B.auto ? 'checked' : '') + '></span> Otomatis <span class="muted" id="bCd"></span></label>' +
      '<button class="btn btn-ghost btn-sm" data-act="rincian" data-id="' + b.id + '">' + ic('list', 'sm') + 'Rincian</button><button class="btn btn-danger btn-sm" data-act="stop" data-id="' + b.id + '" style="margin-left:auto">' + ic('square', 'sm') + 'Hentikan</button></div>' +
      '<p class="help mt8">Server tetap mengirim satu batch per menit walau halaman ini ditutup. Mode otomatis di sini hanya mempercepat.</p></div>';
  }
  function renderKiri(el) {
    const A = analisa(), tpl = W().templat, filt = tpl.filter(t => t.untuk_respon === B.respon || t.untuk_respon === 'Umum' || B.respon === 'Umum');
    const hit = r => App.P.filter(p => cocokRespon(p, r) && (!B.jalur.size || B.jalur.has(p.jalur)) && (!B.prodi.size || B.prodi.has(p.prodi))).length;
    const g = Object.keys(jsonS('VARIABEL_PESAN', {}));
    const step = B.konfirmasi ? 3 : (A.ok.length ? 2 : 1);
    el.querySelector('[data-r="step"]').innerHTML = [['Pilih Penerima Target', 1], ['Tulis Pesan & Variabel', 2], ['Konfirmasi & Pengiriman', 3]].map(s =>
      '<button class="step ' + (step > s[1] ? 'done' : step === s[1] ? 'on' : '') + '" data-act="ke" data-n="' + s[1] + '"><span class="sn">' + (step > s[1] ? ic('check', 'sm') : s[1]) + '</span><span style="min-width:0"><span class="sl">Langkah ' + s[1] + '</span><div class="st">' + s[0] + '</div></span></button>').join('');
    const mode = B.kontak ? 'Kontak CRM terpilih (' + B.kontak.length + ')' : B.ids ? 'Pilihan dari Data Mahasiswa (' + B.ids.length + ' orang)' : '';
    el.querySelector('[data-r="kiri"]').innerHTML =
      '<div class="card card-pad" id="kart1"><div class="row-between mb16"><div class="section-title" style="margin:0"><span class="bar"></span>1. Kelompok Penerima</div><span class="badge b-peach plain">Wajib diisi</span></div>' +
      (mode ? '<div class="callout info mb16">' + ic('info', 'sm') + '<div>' + esc(mode) + '. <button class="btn btn-ghost btn-sm" data-act="lepas">Gunakan filter respon</button></div></div>' : '') +
      '<div class="rcards mb16" ' + (mode ? 'style="opacity:.5"' : '') + '>' + RESP.map(r => '<button class="rcard ' + (B.respon === r[0] && !mode ? 'on' : '') + '" data-resp="' + r[0] + '" style="--tint:var(' + r[3] + ');--fg:var(' + r[4] + ')"><div class="rt"><span class="rdot">' + (B.respon === r[0] && !mode ? ic('check', 'sm') : '') + '</span><span class="badge plain" style="background:#fff;color:var(' + r[4] + ')">' + r[1] + '</span></div><div class="rn">' + r[2] + '</div><div class="rv">' + F.n(hit(r[0])) + '<small>pendaftar</small></div></button>').join('') + '</div>' +
      '<div class="chips mb8"><span class="chip-row-label">Filter jalur:</span><button class="chip ' + (!B.jalur.size ? 'on' : '') + '" data-act="semua-jalur">Semua jalur</button>' + JALUR.map(j => '<button class="chip ' + (B.jalur.has(j) ? 'on' : '') + '" data-jalur="' + j + '">' + j + ' <span class="n">' + App.P.filter(p => p.jalur === j && cocokRespon(p, B.respon)).length + '</span></button>').join('') + '</div>' +
      (B.respon === 'Sudah Registrasi' && !mode ? '<div class="chips mb8"><span class="chip-row-label">Status bayar:</span>' + BAYAR.map(x => '<button class="chip ' + (B.bayar === x[0] ? 'on' : '') + '" data-bayar="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' : '') +
      '<div class="chips mb16"><span class="chip-row-label">Program studi:</span><button class="chip ' + (!B.prodi.size ? 'on' : '') + '" data-act="semua-prodi">Semua prodi</button>' + PRODI.map(p => '<button class="chip ' + (B.prodi.has(p) ? 'on' : '') + '" data-prodi="' + p + '">' + p + ' (' + esc(prodiLabel(p)) + ')</button>').join('') + '</div>' +
      '<label class="check mb16"><span class="switch"><input type="checkbox" id="bHanyaWA" ' + (B.hanyaWA ? 'checked' : '') + '></span> Lewati nomor yang terdeteksi bukan WhatsApp</label>' +
      '<div style="background:#FFF6EE;border-radius:16px;padding:14px" data-r="ringkas"></div></div>' +
      '<div class="card card-pad" id="kart2"><div class="row-between mb16"><div class="section-title" style="margin:0"><span class="bar"></span>2. Susun Pesan WhatsApp</div><span class="small muted">Format WhatsApp: *tebal*, _miring_</span></div>' +
      '<div class="form-grid"><div class="field"><label>Gunakan templat pesan</label><select class="select tinted" id="bTpl"><option value="">— Tulis sendiri —</option>' + filt.map(t => '<option value="' + t.id + '" ' + (B.templatId === t.id ? 'selected' : '') + '>' + esc(t.nama_templat) + ' (' + esc(t.untuk_respon) + ')</option>').join('') + '</select></div>' +
      '<div class="field"><label>Judul internal <span class="opt">opsional</span></label><input class="input tinted" id="bJudul" value="' + esc(B.judul) + '" placeholder="mis. Pengingat tes 28 Maret"></div></div>' +
      '<div class="row-between mb8"><span class="flabel">Sisipkan variabel data personal</span><span class="small terracotta">Klik chip untuk menyisipkan</span></div>' +
      '<div class="chips mb16">' + ['nama', 'prodi', 'prodi_lengkap', 'jalur', 'institusi', 'gelombang'].concat(g).map(v => '<button class="var-chip" data-var="{' + v + '}">+ {' + v + '}</button>').join('') + '</div>' +
      '<div class="field"><label>Isi konten pesan</label><textarea class="textarea tinted" id="bPesan" rows="11">' + esc(B.pesan) + '</textarea>' +
      '<div class="row-between small muted">' + ic('message-circle', 'sm') + '<span id="bCount" style="margin-right:auto;margin-left:6px">' + B.pesan.length + ' karakter</span>' + (B.templatId ? '<button class="btn btn-ghost btn-sm" data-act="reset-tpl" style="color:var(--bad-fg)">Reset ke templat awal</button>' : '') + '</div></div>' +
      (B.konfirmasi ? '' : '<div class="grid g2"><button class="btn btn-soft" data-act="uji">' + ic('smartphone') + 'Kirim uji ke nomor saya' + (S().WA_NOMOR_ADMIN ? ' (' + esc(S().WA_NOMOR_ADMIN) + ')' : '') + '</button><button class="btn btn-primary" data-act="lanjut">Lanjut ke Konfirmasi ' + ic('arrow-right') + '</button></div>') + '</div>' +
      (B.konfirmasi ? kartuKonfirmasi(A) : '');
    renderRingkas(el);
  }
  function renderRingkas(el) {
    const box = el.querySelector('[data-r="ringkas"]'); if (!box) return;
    const A = analisa(), semua = kandidat(), tampil = B.lihat ? semua.slice(0, 200) : semua.slice(0, 5), cnt = {};
    A.lewat.forEach(x => { if (x.a !== 'Dikecualikan manual') cnt[x.a] = (cnt[x.a] || 0) + 1; });
    box.innerHTML = '<div class="row-between"><div class="row"><span class="ci" style="width:40px;height:40px;border-radius:12px;background:#fff;display:grid;place-items:center;color:var(--primary-dark)">' + ic('users') + '</span><div><b>' + F.n(A.ok.length) + ' penerima terpilih</b><div class="small muted">Target pesan terverifikasi sistem</div></div></div>' +
      '<button class="btn btn-white btn-sm" data-act="lihat">' + (B.lihat ? 'Ringkas' : 'Tinjau daftar') + ' ' + ic(B.lihat ? 'chevron-left' : 'chevron-down', 'sm') + '</button></div>' +
      (Object.keys(cnt).length ? '<div class="callout warn mt12">' + ic('triangle-alert', 'sm') + '<div><b>Catatan:</b> ' + Object.keys(cnt).map(k => cnt[k] + ' ' + k.toLowerCase()).join(', ') + ' — akan dilewati otomatis saat antrean.</div></div>' : '') +
      (semua.length ? '<div class="flabel mt12 mb8" style="color:var(--muted)">' + (B.lihat ? 'Daftar penerima (maks. 200 tampil)' : 'Sampel penerima (5 teratas)') + '</div><div class="stack" style="gap:6px;max-height:' + (B.lihat ? '420px' : 'none') + ';overflow:auto">' +
        tampil.map(p => { const lw = A.lewat.find(x => x.p === p);
          return '<label class="row" style="background:#fff;border-radius:10px;padding:8px 10px;gap:10px;flex-wrap:nowrap' + (lw && lw.a !== 'Dikecualikan manual' ? ';opacity:.55' : '') + '"><span class="check"><input type="checkbox" data-kec="' + p.id + '" ' + (B.kecuali.has(p.id) ? '' : 'checked') + (lw && lw.a !== 'Dikecualikan manual' ? ' disabled' : '') + '></span>' +
            '<span class="bold ellipsis" style="flex:1;min-width:0">' + esc(p.nama) + '</span>' + (p.prodi ? '<span class="badge b-peach plain">' + esc(p.prodi + ' • ' + (p.jalur || '')) + '</span>' : '') +
            '<span class="small muted" style="white-space:nowrap">' + (lw && lw.a !== 'Dikecualikan manual' ? esc(lw.a) : esc(fmtHp(p.no_hp))) + '</span></label>'; }).join('') + '</div>' : '<p class="small muted mt12">Tidak ada pendaftar pada kelompok & filter ini.</p>');
  }
  function kartuKonfirmasi(A) {
    const k = W().kuota || {}, batch = B.batch || Number(S().WA_BATCH) || 20, jeda = B.jeda || S().WA_JEDA || '8-15', menit = Math.ceil(A.ok.length * rataJeda(jeda) / 60), sisa = (k.batas || 500) - (k.terkirim || 0);
    return '<div class="card card-pad" id="kart3" style="border-color:var(--primary)"><div class="section-title"><span class="bar"></span>3. Konfirmasi & Pengiriman</div>' +
      '<div class="stat-row" style="margin-bottom:16px"><div class="stat"><div class="ico">' + ic('users') + '</div><div><div class="lbl">Penerima</div><div class="val">' + F.n(A.ok.length) + '</div></div></div>' +
      '<div class="stat"><div class="ico">' + ic('ban') + '</div><div><div class="lbl">Dilewati</div><div class="val">' + F.n(A.lewat.length) + '</div></div></div>' +
      '<div class="stat"><div class="ico">' + ic('hourglass') + '</div><div><div class="lbl">Perkiraan lama</div><div class="val">±' + menit + ' <small>menit</small></div></div></div>' +
      '<div class="stat"><div class="ico">' + ic('zap') + '</div><div><div class="lbl">Sisa kuota hari ini</div><div class="val">' + F.n(Math.max(0, sisa)) + '</div></div></div></div>' +
      (A.ok.length > sisa ? '<div class="callout warn mb16">' + ic('triangle-alert', 'sm') + 'Jumlah penerima melebihi sisa kuota harian. Sisanya otomatis dikirim besok.</div>' : '') +
      (A.ok.length > (k.batasBlast || 300) ? '<div class="callout bad mb16">' + ic('circle-x', 'sm') + 'Melebihi batas ' + (k.batasBlast || 300) + ' penerima per blast. Persempit filter jalur/prodi.</div>' : '') +
      '<div class="form-grid"><div class="field"><label>Ukuran batch</label><div class="seg">' + [10, 20, 50].map(n => '<button class="' + (batch === n ? 'on' : '') + '" data-act="batch" data-n="' + n + '">' + n + '</button>').join('') + '</div><div class="help">Mulai dari 10 untuk nomor yang baru dipakai blast.</div></div>' +
      '<div class="field"><label>Jeda antarpesan (detik)</label><input class="input" id="bJeda" value="' + esc(jeda) + '" placeholder="8-15"><div class="help">Rentang acak, mis. 8-15.</div></div></div>' +
      '<div class="flabel mb8">Contoh pesan untuk ' + esc((A.ok[0] || {}).nama || '-') + '</div><div class="bubble mb16" style="margin-left:0">' + waFmtTanda(isiVar(B.pesan, vars(A.ok[0] || {}))) + '</div>' +
      (varKosong(isiVar(B.pesan, vars(A.ok[0] || {}))).length ? '<div class="callout bad mb16">' + ic('circle-x', 'sm') + '<div>Variabel <b>' + esc(varKosong(isiVar(B.pesan, vars(A.ok[0] || {}))).join(', ')) + '</b> belum punya nilai sehingga akan terkirim apa adanya. Isi di <a href="#/pengaturan">Pengaturan → Variabel pesan global</a> atau hapus dari pesan.</div></div>' : '') +
      '<label class="check mb16"><input type="checkbox" id="bYakin" ' + (B.yakin ? 'checked' : '') + '> Saya sudah memeriksa penerima dan isi pesan. Pesan relevan dengan pendaftaran dan memberi cara berhenti.</label>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-act="kembali">' + ic('arrow-left') + 'Ubah pesan</button><button class="btn btn-primary" data-act="mulai" ' + (A.ok.length && !varKosong(isiVar(B.pesan, vars(A.ok[0] || {}))).length ? '' : 'disabled') + '>' + ic('send') + 'Mulai Blast (' + F.n(A.ok.length) + ' nomor)</button></div></div>';
  }
  function renderKanan(el) {
    const box = el.querySelector('[data-r="kanan"]'); if (!box) return;
    const p = analisa().ok[0] || {};
    box.innerHTML = '<div class="row-between"><b>' + ic('eye', 'sm') + ' Live preview penerima</b><span class="small muted">Data: <b>' + esc(p.nama || '-') + '</b></span></div>' +
      '<div class="phone"><div class="phone-head">' + ic('arrow-left', 'sm') + '<span class="pa">' + ic('graduation-cap', 'sm') + '</span><div style="flex:1"><b>PMB ' + esc(S().NAMA_INSTITUSI || 'STIS AL WAFA').toUpperCase() + '</b><span>Online · Akun Resmi</span></div>' + ic('phone', 'sm') + '</div>' +
      '<div class="phone-body"><span class="day-pill">HARI INI</span><div class="bubble" data-r="prev"></div></div><div class="phone-foot"><span class="pin">Pesan</span><span class="mic">' + ic('send', 'sm') + '</span></div></div>' +
      '<div class="card card-pad"><div class="row" style="align-items:flex-start;flex-wrap:nowrap">' + ic('shield-check') + '<div><b>Protokol keamanan gateway Fonnte</b><p class="small muted mt8">Sistem memakai <i>jeda acak</i> ' + esc(S().WA_JEDA || '8-15') + ' detik antarpesan, batas ' + esc(S().WA_BATAS_HARIAN || '500') + ' pesan/hari, dan maksimal ' + esc(S().WA_BATAS_BLAST || '300') + ' penerima per blast untuk mengurangi risiko nomor dibatasi WhatsApp. Kontak yang minta berhenti (opt-out) selalu dilewati.</p></div></div></div>';
    renderPrev(el);
  }
  function renderPrev(el) {
    const b = el.querySelector('[data-r="prev"]'); if (!b) return;
    const p = analisa().ok[0] || { nama: 'Ahmad Fauzi', prodi: 'HES', jalur: 'Reguler' };
    const kosong = varKosong(isiVar(B.pesan, vars(p)));
    b.innerHTML = (B.pesan ? waFmtTanda(isiVar(B.pesan, vars(p))) : '<span class="muted">Pesan akan tampil di sini…</span>') + '<div class="bt">' + F.jam(new Date()) + ' ✓✓</div>' +
      (kosong.length ? '<div class="small" style="color:var(--bad-fg);margin-top:6px">⚠ ' + esc(kosong.join(', ')) + ' belum diisi</div>' : '');
  }
  async function aksi(el, b) {
    const a = b.dataset.act;
    if (a === 'semua-jalur') { B.jalur.clear(); B.ids = null; renderKiri(el); renderKanan(el); }
    if (a === 'semua-prodi') { B.prodi.clear(); B.ids = null; renderKiri(el); renderKanan(el); }
    if (a === 'lepas') { B.ids = null; B.kontak = null; renderKiri(el); renderKanan(el); }
    if (a === 'lihat') { B.lihat = !B.lihat; renderRingkas(el); }
    if (a === 'ke') { const n = +b.dataset.n; if (n === 3) return aksi(el, { dataset: { act: 'lanjut' } }); B.konfirmasi = false; renderKiri(el); const t = $('#kart' + n); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (a === 'reset-tpl') { const t = W().templat.find(x => x.id === B.templatId); if (t) { B.pesan = t.isi_pesan; renderKiri(el); renderPrev(el); } }
    if (a === 'batch') { B.batch = +b.dataset.n; renderKiri(el); $('#kart3') && $('#kart3').scrollIntoView({ block: 'nearest' }); }
    if (a === 'kembali') { B.konfirmasi = false; renderKiri(el); $('#kart2').scrollIntoView({ behavior: 'smooth' }); }
    if (a === 'lanjut') {
      if (!analisa().ok.length) return toast('Belum ada penerima yang valid.', 'warn');
      if (!B.pesan.trim()) return toast('Isi pesan masih kosong.', 'warn');
      B.konfirmasi = true; renderKiri(el); setTimeout(() => $('#kart3') && $('#kart3').scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    }
    if (a === 'uji') {
      if (!B.pesan.trim()) return toast('Tulis pesan terlebih dahulu.', 'warn');
      let nomor = S().WA_NOMOR_ADMIN;
      if (!nomor) { const v = await confirmBox({ title: 'Nomor uji', html: 'Masukkan nomor WhatsApp Anda (tersimpan nanti di Pengaturan).', alasan: 'Nomor WhatsApp' }); if (!v) return; nomor = v; }
      busy(b, true, 'Mengirim uji…'); const p = analisa().ok[0] || {};
      const r = await api('waTes', { nomor, pesan: B.pesan, contoh: { nama: p.nama, prodi: p.prodi, jalur: p.jalur } }); busy(b, false); toast(r.message, r.success ? 'ok' : 'err');
    }
    if (a === 'mulai') {
      if (!B.yakin) return toast('Centang konfirmasi pemeriksaan terlebih dahulu.', 'warn');
      const A = analisa();
      if (!(await confirmBox({ title: 'Kirim ke ' + A.ok.length + ' nomor?', pesan: 'Pesan masuk antrean dan dikirim bertahap per batch ' + (B.batch || S().WA_BATCH || 20) + ' dengan jeda ' + (B.jeda || S().WA_JEDA) + ' detik. Blast bisa dihentikan kapan saja.', ok: 'Ya, mulai blast' }))) return;
      busy(b, true, 'Membuat antrean…');
      const r = await api('blastBuat', { judul: B.judul, pesan: B.pesan, templatId: B.templatId, respon: B.kontak || B.ids ? 'Pilihan manual' : B.respon + (B.respon === 'Sudah Registrasi' && B.bayar ? ' • ' + BAYAR.find(x => x[0] === B.bayar)[1] : ''),
        filter: { jalur: Array.from(B.jalur), prodi: Array.from(B.prodi) }, ids: B.kontak ? [] : A.ok.map(p => p.id), kontakIds: B.kontak ? A.ok.map(p => p.id) : [],
        hanyaWA: B.hanyaWA, ukuranBatch: B.batch || Number(S().WA_BATCH) || 20, jeda: B.jeda || S().WA_JEDA });
      busy(b, false);
      if (!r.success) return toast(r.message, 'err');
      toast(r.message); B.konfirmasi = false; B.yakin = false; B.auto = true;
      Pages.blast.render(el); window.scrollTo({ top: 0, behavior: 'smooth' });
      proses(el, r.data.blastId);
    }
    if (a === 'proses') proses(el, b.dataset.id, b);
    if (a === 'rincian') rincianBlast(b.dataset.id);
    if (a === 'stop') {
      if (!(await confirmBox({ title: 'Hentikan blast?', pesan: 'Pesan yang belum terkirim akan dibatalkan. Pesan yang sudah terkirim tidak bisa ditarik.', ok: 'Hentikan', danger: true }))) return;
      const r = await api('blastHentikan', { blastId: b.dataset.id }); toast(r.message, r.success ? 'ok' : 'err');
    }
  }
  let _proses = false;
  async function proses(el, id, btn) {
    if (_proses) return; _proses = true; if (btn) busy(btn, true, 'Mengirim…');
    const r = await api('blastProses', { blastId: id });
    _proses = false; if (btn) busy(btn, false);
    if (!r.success) toast(r.message, 'err');
    else if (r.data.info && r.data.info.info && r.data.info.info !== 'tidak ada yang perlu dikirim') toast(r.data.info.info, 'warn');
    if (r.success && r.data.blast && r.data.blast.status !== 'Berjalan') toast('Blast ' + id + ' selesai: ' + r.data.blast.terkirim + ' terkirim, ' + r.data.blast.gagal + ' gagal.');
    jadwal();
  }
  function jadwal() {
    const b = blastAktif();
    if (!b || !B.auto) { B.next = 0; return; }
    B.next = Date.now() + Math.max(30, Math.round((b.batch || 20) * rataJeda(b.jeda))) * 1000;
  }
  let _poll = 0;
  function tikOtomatis(el) {
    if (App.cur !== 'blast' || document.hidden) return;
    const b = blastAktif(), cd = $('#bCd');
    if (b && Activity.due('blastPoll', 15000, 60000)) syncNow(['wa'], true);
    if (!b || !B.auto || !B.next) { if (cd) cd.textContent = ''; return; }
    const s = Math.max(0, Math.round((B.next - Date.now()) / 1000));
    if (cd) cd.textContent = '· batch berikutnya ' + s + ' dtk';
    if (s === 0) { B.next = 0; proses(el, b.id); }
  }
  on('data', n => { if (n.indexOf('wa') > -1) { const el = $('.page[data-page="blast"]'); if (el && !el.hidden) { renderProgres(el); if (!B.next) jadwal(); } } });

  /* ==================== RINCIAN BLAST (dipakai 2 halaman) ==================== */
  async function rincianBlast(id) {
    const m = modal({ title: 'Rincian blast ' + esc(id), size: 'wide', body: '<div class="empty"><span class="spin"></span></div>' });
    const r = await api('blastDetail', { blastId: id });
    if (!r.success) { m.el.querySelector('.modal-body').innerHTML = '<div class="callout bad">' + esc(r.message) + '</div>'; return; }
    const d = r.data, hit = {}; d.pesan.forEach(x => { hit[x.status] = (hit[x.status] || 0) + 1; });
    m.el.querySelector('.modal-body').innerHTML = '<div class="chips mb16">' + Object.keys(hit).map(k => '<span class="chip soft-on">' + esc(k) + ' <span class="n">' + hit[k] + '</span></span>').join('') + (d.dilewati.length ? '<span class="chip">Dilewati <span class="n">' + d.dilewati.length + '</span></span>' : '') + '</div>' +
      '<div class="bubble mb16" style="margin-left:0">' + waFmt(d.blast.isi_pesan) + '</div>' +
      '<div class="table-card"><div class="table-wrap" style="max-height:50vh"><table class="t"><thead><tr><th>Nama</th><th>Nomor</th><th>Status</th><th>Keterangan</th><th>Waktu</th></tr></thead><tbody>' +
      d.pesan.map(x => '<tr><td class="bold">' + esc(x.nama) + '</td><td class="tabnum">' + esc(x.tujuan) + '</td><td><span class="badge ' + ({ Terkirim: 'b-ok', Gagal: 'b-bad', Antri: 'b-info', Proses: 'b-warn', Batal: 'b-mute' }[x.status] || 'b-mute') + '">' + esc(x.status) + '</span></td><td class="small">' + esc(x.respon || '') + '</td><td class="small">' + (x.dikirim ? F.tglJam(x.dikirim) : '-') + '</td></tr>').join('') +
      d.dilewati.map(x => '<tr class="warn"><td class="bold">' + esc(x.nama) + '</td><td>' + esc(x.hp) + '</td><td><span class="badge b-mute">Dilewati</span></td><td class="small">' + esc(x.alasan) + '</td><td></td></tr>').join('') + '</tbody></table></div></div>';
  }
  window.rincianBlast = rincianBlast;

  /* ======================= PESAN & RIWAYAT ======================= */
  const P = { tab: 'templat', antre: null };
  registerPage('pesan', {
    title: 'Pesan & Riwayat', deps: ['wa', 'pendaftar', 'waStatus'],
    template: () => '<div data-r="head"></div><div class="stat-row" data-r="kpi"></div><div class="row mb22" data-r="tabs"></div><div data-r="isi"></div>',
    mount(el) {
      delegate(el, 'click', '[data-tab]', b => { P.tab = b.dataset.tab; Pages.pesan.render(el); if (P.tab === 'antrean') muatAntre(el); });
      delegate(el, 'click', '[data-act]', b => aksiP(el, b));
    },
    render(el) {
      const w = W(), admin = isAdmin(), k = w.kuota || {}, inval = App.P.filter(p => !hpValid(p.no_hp)).length, s = App.waStatus, on = s && s.perangkat && s.perangkat.status === 'connect';
      el.querySelector('[data-r="head"]').innerHTML = pageHead({ pill: 'Broadcast Gateway • Fonnte', title: 'Pesan & Riwayat Blast WA', lead: 'Kelola draf templat pesan broadcast dan pantau status pengiriman Fonnte secara menyeluruh.',
        actions: '<button class="btn btn-white" data-act="ekspor">' + ic('download') + 'Ekspor Riwayat (.xlsx)</button>' + (admin ? '<button class="btn btn-primary" data-act="tpl-baru">' + ic('plus') + 'Templat Baru</button>' : '') });
      el.querySelector('[data-r="kpi"]').innerHTML = '<div class="stat"><div class="ico">' + ic('send') + '</div><div><div class="lbl">Kuota blast hari ini</div><div class="val">' + F.n(k.terkirim || 0) + ' <small>/ ' + F.n(k.batas || 500) + '</small></div></div></div>' +
        '<div class="stat"><div class="ico">' + ic('check') + '</div><div><div class="lbl">Tingkat pengiriman</div><div class="val">' + (w.tingkat == null ? '—' : String(w.tingkat).replace('.', ',') + '%') + '</div></div></div>' +
        '<div class="stat"><div class="ico" style="background:var(--bad-bg);color:var(--bad-fg)">' + ic('triangle-alert') + '</div><div><div class="lbl">Nomor tidak valid</div><div class="val">' + F.n(inval) + ' <small>pendaftar</small></div></div></div>' +
        '<div class="stat" style="background:var(--primary-tint)"><span class="dot-st" style="width:10px;height:10px;background:' + (on ? '#3BD16F' : (App.data.meta || {}).waSiap ? '#E5A11A' : '#C8B8AA') + '"></span><div><div class="lbl">Status server Fonnte</div><div class="val" style="font-size:15px">' + (on ? 'Terhubung • Aktif' : (App.data.meta || {}).waSiap ? 'Token terpasang' : 'Belum diatur') + '</div></div></div>';
      el.querySelector('[data-r="tabs"]').innerHTML = '<div class="tabs">' + [['templat', 'Templat Pesan', 'message-square', w.templat.length], ['riwayat', 'Riwayat Blast', 'history', w.blast.length]].concat(admin ? [['antrean', 'Antrean', 'list', '']] : [])
        .map(t => '<button class="tab ' + (P.tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '">' + ic(t[2], 'sm') + t[1] + (t[3] !== '' ? ' <span class="n">' + t[3] + '</span>' : '') + '</button>').join('') + '</div>' +
        '<span class="small muted" style="max-width:420px">' + ic('info', 'sm') + ' Variabel seperti {nama} dan {prodi} diisi otomatis dari database calon mahasiswa.</span>';
      const isi = el.querySelector('[data-r="isi"]');
      if (P.tab === 'templat') isi.innerHTML = w.templat.length ? '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">' + w.templat.map(t => {
        const v = Array.from(new Set((t.isi_pesan.match(/\{\w+\}/g) || []))), c = ({ 'Belum Tes': 'b-warn', 'Belum Daftar Ulang': 'b-info', 'Mengundurkan Diri': 'b-bad', 'Sudah Registrasi': 'b-ok' }[t.untuk_respon] || 'b-peach');
        return '<div class="tpl-card"><div class="row-between"><span class="badge plain ' + c + '">' + esc(t.untuk_respon) + '</span>' + ic('message-square', 'sm') + '</div><h4>' + esc(t.nama_templat) + '</h4><div class="tpl-prev">' + esc(t.isi_pesan) + '</div>' +
          '<div><div class="flabel" style="color:var(--muted)">Variabel aktif</div><div class="chips mt8">' + v.map(x => '<span class="tag-mini">' + esc(x) + '</span>').join('') + '</div></div>' +
          '<div class="row-between small muted" style="margin-top:auto"><span>Dibuat: ' + F.tgl(t.dibuat) + '</span><span class="terracotta">Terpakai ' + t.dipakai + 'x</span></div>' +
          (admin ? '<button class="btn btn-primary btn-sm" data-act="pakai" data-id="' + t.id + '">' + ic('send', 'sm') + 'Gunakan di Blast</button><div class="grid g2" style="gap:8px"><button class="btn btn-white btn-sm" data-act="tpl-edit" data-id="' + t.id + '">Edit</button><button class="btn btn-white btn-sm" data-act="tpl-hapus" data-id="' + t.id + '">Hapus</button></div>' : '') + '</div>';
      }).join('') + '</div>' : '<div class="card">' + emptyBox('message-square', 'Belum ada templat', 'Buat templat untuk setiap kelompok respon.') + '</div>';
      if (P.tab === 'riwayat') isi.innerHTML = riwayatHtml(w.blast);
      if (P.tab === 'antrean') isi.innerHTML = antreHtml();
    },
    show() { muatStatusWa(); }
  });
  function riwayatHtml(L) {
    if (!L.length) return '<div class="card">' + emptyBox('history', 'Belum ada riwayat blast', 'Riwayat muncul setelah Admin mengirim blast pertama.') + '</div>';
    const admin = isAdmin(), hasil = b => '<div class="small"><span class="terracotta">' + F.n(b.terkirim) + ' terkirim</span> • ' + F.n(b.gagal) + ' gagal' + (b.sisa ? ' • ' + F.n(b.sisa) + ' menunggu' : '') + (b.dilewati ? ' • ' + b.dilewati + ' dilewati' : '') + '</div><div class="progress thin dark"><i style="width:' + (b.target ? (b.terkirim + b.gagal) * 100 / b.target : 0) + '%"></i></div>';
    const tombol = b => '<button class="btn btn-ghost btn-sm" data-act="rincian" data-id="' + b.id + '">Lihat detail</button>' + (admin && b.status === 'Berjalan' ? '<button class="btn btn-danger btn-sm" data-act="stop" data-id="' + b.id + '">Hentikan</button>' : '') + (admin && b.gagal ? '<button class="btn btn-soft btn-sm" data-act="ulang" data-id="' + b.id + '">Ulangi gagal</button>' : '');
    return '<div class="table-card"><div class="card-head" style="padding-bottom:12px"><h3>Riwayat Blast Terakhir <span class="badge b-peach plain">Sinkronisasi otomatis</span></h3><span class="small muted">' + L.length + ' aktivitas terakhir</span></div>' +
      '<div class="table-wrap desk-only"><table class="t"><thead><tr><th>Waktu pengiriman</th><th>Kelompok respon & target</th><th class="r">Jumlah target</th><th style="min-width:220px">Hasil pengiriman</th><th>Status</th><th>Log / detail</th></tr></thead><tbody>' +
      L.map(b => '<tr><td><div class="nm">' + F.tglJam(b.waktu) + '</div><div class="sm">ID: ' + esc(b.id) + ' · ' + esc(b.oleh) + '</div></td><td><div class="bold">' + esc(b.respon) + '</div><div class="sm">' + esc(b.filter || '') + (b.judul ? ' · ' + esc(b.judul) : '') + '</div></td>' +
        '<td class="r"><b>' + F.n(b.target) + '</b><div class="sm">nomor</div></td><td>' + hasil(b) + '</td><td>' + stBlast(b.status) + '</td><td style="white-space:nowrap">' + tombol(b) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="mlist" style="padding:0 12px 12px">' + L.map(b => '<div class="mcard"><div class="top"><div><div class="nm" style="font-size:15px">' + esc(b.respon) + '</div><div class="sub">' + F.tglJam(b.waktu) + ' · ' + F.n(b.target) + ' nomor</div></div>' + stBlast(b.status) + '</div><div class="mt12">' + hasil(b) + '</div><div class="row mt8">' + tombol(b) + '</div></div>').join('') + '</div></div>';
  }
  function antreHtml() {
    if (!P.antre) return '<div class="card">' + emptyBox('list', 'Memuat antrean…', '') + '</div>';
    const h = P.antre.hitung;
    return '<div class="chips mb16">' + Object.keys(h).map(k => '<span class="chip soft-on">' + k + ' <span class="n">' + h[k] + '</span></span>').join('') + '<button class="btn btn-soft btn-sm" data-act="ulang-semua">' + ic('rotate-ccw', 'sm') + 'Ulangi semua yang gagal</button><button class="btn btn-ghost btn-sm" data-act="muat-antre">' + ic('refresh-cw', 'sm') + 'Muat ulang</button></div>' +
      '<div class="table-card"><div class="table-wrap"><table class="t"><thead><tr><th>Waktu</th><th>Tujuan</th><th>Jenis</th><th>Pesan</th><th>Status</th></tr></thead><tbody>' +
      P.antre.list.map(x => '<tr><td class="small">' + F.tglJam(x.dikirim || x.dibuat) + '</td><td><b>' + esc(x.nama) + '</b><div class="sm tabnum">' + esc(x.tujuan) + '</div></td><td class="small">' + esc(x.blast_id || x.event) + '</td><td class="small" style="max-width:320px">' + esc(x.pesan) + '</td>' +
        '<td><span class="badge ' + ({ Terkirim: 'b-ok', Gagal: 'b-bad', Antri: 'b-info', Proses: 'b-warn', Batal: 'b-mute' }[x.status] || 'b-mute') + '">' + esc(x.status) + '</span><div class="sm">' + esc(x.respon || '') + '</div></td></tr>').join('') + '</tbody></table></div></div>';
  }
  async function muatAntre(el) { const r = await api('antrianList', {}); if (r.success) { P.antre = r.data; if (P.tab === 'antrean') el.querySelector('[data-r="isi"]').innerHTML = antreHtml(); } else toast(r.message, 'err'); }
  async function aksiP(el, b) {
    const a = b.dataset.act, id = b.dataset.id;
    if (a === 'tpl-baru') formTemplat({});
    if (a === 'tpl-edit') formTemplat(W().templat.find(t => t.id === id));
    if (a === 'pakai') { const t = W().templat.find(x => x.id === id); App.prefill.blast = { templatId: id, respon: t && t.untuk_respon }; go('blast'); }
    if (a === 'tpl-hapus') { if (!(await confirmBox({ title: 'Hapus templat?', pesan: 'Templat ini tidak bisa dipulihkan.', ok: 'Hapus', danger: true }))) return; const r = await api('templatHapus', { id }); toast(r.message, r.success ? 'ok' : 'err'); }
    if (a === 'rincian') rincianBlast(id);
    if (a === 'stop') { if (!(await confirmBox({ title: 'Hentikan blast?', pesan: 'Pesan yang belum terkirim dibatalkan.', ok: 'Hentikan', danger: true }))) return; const r = await api('blastHentikan', { blastId: id }); toast(r.message, r.success ? 'ok' : 'err'); }
    if (a === 'ulang') { const r = await api('antrianUlangi', { blastId: id }); toast(r.message, r.success ? 'ok' : 'err'); }
    if (a === 'ulang-semua') { const r = await api('antrianUlangi', {}); toast(r.message, r.success ? 'ok' : 'err'); muatAntre(el); }
    if (a === 'muat-antre') muatAntre(el);
    if (a === 'ekspor') unduhXlsx('Riwayat-Blast-WA-' + tglFile() + '.xlsx', [{ nama: 'Riwayat Blast', aoa: [['ID', 'Waktu', 'Pengirim', 'Kelompok Respon', 'Filter', 'Judul', 'Target', 'Terkirim', 'Gagal', 'Dilewati', 'Status', 'Batch', 'Jeda', 'Isi Pesan']]
      .concat(W().blast.map(b => [b.id, F.tglJam(b.waktu), b.oleh, b.respon, b.filter, b.judul, b.target, b.terkirim, b.gagal, b.dilewati, b.status, b.batch, b.jeda, b.pesan])) }], 'Riwayat Blast WA');
  }
  function formTemplat(t) {
    t = t || {};
    const g = Object.keys(jsonS('VARIABEL_PESAN', {}));
    const m = modal({ title: t.id ? 'Ubah templat' : 'Templat baru', size: 'wide',
      body: '<div class="form-grid"><div class="field"><label>Nama templat *</label><input class="input" id="tN" value="' + esc(t.nama_templat || '') + '"></div>' +
        '<div class="field"><label>Untuk kelompok respon</label><select class="select" id="tR">' + ['Belum Tes', 'Belum Daftar Ulang', 'Mengundurkan Diri', 'Sudah Registrasi', 'Umum'].map(r => '<option ' + (t.untuk_respon === r ? 'selected' : '') + '>' + r + '</option>').join('') + '</select></div></div>' +
        '<div class="chips mb8">' + ['nama', 'prodi', 'prodi_lengkap', 'jalur', 'institusi', 'gelombang'].concat(g).map(v => '<button class="var-chip" data-v="{' + v + '}">+ {' + v + '}</button>').join('') + '</div>' +
        '<div class="grid g2"><div class="field"><label>Isi pesan *</label><textarea class="textarea" id="tI" rows="10">' + esc(t.isi_pesan || '') + '</textarea></div><div><div class="flabel mb8">Pratinjau</div><div class="bubble" id="tP" style="margin-left:0"></div></div></div>',
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" id="tOk">Simpan Templat</button>' });
    const prev = () => { $('#tP').innerHTML = waFmt(isiVar($('#tI').value, vars(App.P[0] || { nama: 'Ahmad Fauzi', prodi: 'HES', jalur: 'Reguler' }))); };
    prev(); $('#tI').addEventListener('input', prev);
    delegate(m.el, 'click', '[data-v]', b => { const x = $('#tI'), s = x.selectionStart; x.value = x.value.slice(0, s) + b.dataset.v + x.value.slice(x.selectionEnd); x.focus(); prev(); });
    $('#tOk').onclick = async () => { busy($('#tOk'), true); const r = await api('templatSimpan', { templat: { id: t.id || '', nama_templat: $('#tN').value, untuk_respon: $('#tR').value, isi_pesan: $('#tI').value } });
      busy($('#tOk'), false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close(); };
  }
})();
