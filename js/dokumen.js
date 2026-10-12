/* dokumen.js — Doc Engine: templat, form otomatis, TTD PIN + QR, arsip, generate massal (skill gas-doc-engine) */
'use strict';
(function () {
  const st = { tab: 'buat', filter: '', q: '', m: { tpl: '', respon: '', jalur: new Set(), prodi: new Set(), ids: null } };
  const D = () => App.data.de || { templat: [], pejabat: [], dokumen: [], jobs: [], kunciSumber: {} };
  const MODUL = { rapat: 'Dari catatan rapat', ringkasan: 'Dari angka dasbor', pendaftar: 'Per pendaftar', umum: 'Isian bebas' };
  const ENG = { docs: 'file-text', sheets: 'file-spreadsheet', slides: 'layers' };
  const ST = { DRAF: ['Draf', 'b-mute'], MENUNGGU_TTD: ['Menunggu TTD', 'b-warn'], MEMPROSES: ['Sedang diterbitkan', 'b-info'], TERBIT: ['Terbit • Sah', 'b-ok'], DITARIK: ['Ditarik', 'b-bad'] };
  const tplNama = id => (D().templat.find(t => t.id === id) || {}).nama || 'Templat';
  const urlVerif = k => { const s = S(), b = s.VERIFIKASI_URL || (s.APP_URL ? s.APP_URL.replace(/\/?$/, '/') + 'verifikasi.html' : ''); return b ? b + (b.indexOf('?') > -1 ? '&' : '?') + 'k=' + k : ''; };

  registerPage('dokumen', {
    title: 'Dokumen & TTD', deps: ['de', 'rapat'],
    template: () => '<div data-r="head"></div><div class="utabs mb22" data-r="tabs"></div><div data-r="isi"></div>',
    mount(el) {
      delegate(el, 'click', '[data-tab]', b => { st.tab = b.dataset.tab; Pages.dokumen.render(el); });
      delegate(el, 'click', '[data-act]', b => aksi(el, b));
      delegate(el, 'click', '[data-f]', b => { st.filter = b.dataset.f; Pages.dokumen.render(el); });
      el.addEventListener('input', debounce(e => { if (e.target.matches('[data-q]')) { st.q = e.target.value; isiArsip(el); } }, 250));
      setInterval(() => { if (App.cur !== 'dokumen' || document.hidden) return; if (D().dokumen.some(d => d.status === 'MEMPROSES') || D().jobs.some(j => j.menunggu)) syncNow(['de'], true); }, 9000);
    },
    render(el, param) {
      if (param && param !== st.tab && ['buat', 'arsip', 'templat', 'pejabat', 'massal'].indexOf(param) > -1) { st.tab = param; Pages.dokumen._param = ''; history.replaceState(null, '', '#/dokumen'); }
      const admin = isAdmin(), d = D(), menunggu = d.dokumen.filter(x => x.status === 'MENUNGGU_TTD').length;
      el.querySelector('[data-r="head"]').innerHTML = pageHead({ pill: 'Doc Engine', eyebrow: ['TTD Pejabat · QR Verifikasi'], title: 'Dokumen & Tanda Tangan',
        lead: 'Terbitkan notula rapat, laporan ringkas untuk pimpinan, dan surat calon mahasiswa dari templat Google Docs — bernomor, bertanda tangan, dan bisa diverifikasi lewat QR.',
        actions: '<button class="btn btn-white" data-act="segar">' + ic('refresh-cw') + 'Segarkan</button>' });
      const tabs = [['buat', 'Buat Dokumen', 'file-pen-line'], ['arsip', 'Arsip & TTD', 'archive', menunggu || '']].concat([['pejabat', 'Pejabat', 'user-round-cog']]).concat(admin ? [['templat', 'Templat', 'layers'], ['massal', 'Generate Massal', 'files']] : []);
      el.querySelector('[data-r="tabs"]').innerHTML = tabs.map(t => '<button class="utab ' + (st.tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '">' + ic(t[2], 'sm') + t[1] + (t[3] ? ' <span class="badge b-warn plain">' + t[3] + '</span>' : '') + '</button>').join('');
      if (!App.data.de) { el.querySelector('[data-r="isi"]').innerHTML = '<div class="card">' + emptyBox('file-pen-line', 'Memuat modul dokumen…', '') + '</div>'; return; }
      const isi = el.querySelector('[data-r="isi"]'), peringatan = d.appUrlKosong ? '<div class="callout warn mb16">' + ic('triangle-alert', 'sm') + '<div>Alamat aplikasi (APP_URL) belum diisi di Pengaturan, sehingga QR hanya berisi kode verifikasi. Isi agar QR membuka halaman verifikasi.</div></div>' : '';
      if (st.tab === 'buat') isi.innerHTML = peringatan + buatHtml();
      else if (st.tab === 'arsip') { isi.innerHTML = '<div data-r="arsip"></div>'; isiArsip(el); }
      else if (st.tab === 'templat' && admin) isi.innerHTML = templatHtml();
      else if (st.tab === 'pejabat') isi.innerHTML = pejabatHtml();
      else if (st.tab === 'massal' && admin) { isi.innerHTML = peringatan + '<div data-r="massal"></div>'; isiMassal(el); }
      else { st.tab = 'buat'; isi.innerHTML = buatHtml(); }
    },
    show() { if (!App.data.de) syncNow(['de']); if (App.prefill.massal) { st.m.ids = App.prefill.massal.ids; App.prefill.massal = null; st.tab = 'massal'; Pages.dokumen.render($('.page[data-page="dokumen"]')); } }
  });

  /* ------------------------------ BUAT ------------------------------ */
  function buatHtml() {
    const T = D().templat;
    if (!T.length) return '<div class="card">' + emptyBox('layers', 'Belum ada templat', isAdmin() ? 'Tambahkan templat di tab Templat.' : 'Minta Admin menambahkan templat.') + '</div>';
    return '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">' + T.map(t => '<div class="cat-card"><div class="row-between"><span class="badge b-peach plain">' + esc(MODUL[t.modul] || t.modul) + '</span><span class="ci">' + ic(ENG[t.engine] || 'file-text') + '</span></div>' +
      '<h3>' + esc(t.nama) + '</h3><p class="desc">' + t.bidang.length + ' kolom isian · ' + t.slot.length + ' penanda tangan · keluaran ' + t.keluaran.join(', ').toUpperCase() + '</p>' +
      '<div class="figs small"><div class="row-between">Kode nomor <b>' + esc(t.kode) + '</b></div><div class="row-between">Format <b class="small">' + esc(t.formatNomor || '-') + '</b></div></div>' +
      '<button class="btn btn-primary btn-sm mt8" data-act="buat" data-id="' + t.id + '">' + ic('plus', 'sm') + 'Buat dokumen</button></div>').join('') + '</div>';
  }
  function inputBidang(b, v) {
    const id = 'de_' + b.kunci, val = v == null ? '' : v, L = '<label for="' + id + '">' + esc(b.label) + (b.wajib ? ' *' : '') + (b.bantu ? ' <span class="opt">' + esc(b.bantu) + '</span>' : '') + '</label>';
    if (b.tipe === 'area' || b.tipe === 'naskah') return '<div class="field" style="grid-column:1/-1">' + L + '<textarea class="textarea" id="' + id + '" rows="' + (b.tipe === 'naskah' ? 7 : 4) + '">' + esc(val) + '</textarea></div>';
    if (b.tipe === 'pilihan') return '<div class="field">' + L + '<select class="select" id="' + id + '">' + (b.opsi || []).map(o => '<option ' + (o === val ? 'selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></div>';
    if (b.tipe === 'daftar') { const rows = Array.isArray(val) && val.length ? val : [{}];
      return '<div class="field" style="grid-column:1/-1">' + L + '<div class="table-card"><div class="table-wrap"><table class="t" id="' + id + '"><thead><tr>' + b.kolom.map(k => '<th>' + esc(k.label) + '</th>').join('') + '<th></th></tr></thead><tbody>' +
        rows.map(r => barisDaftar(b, r)).join('') + '</tbody></table></div></div><button type="button" class="btn btn-ghost btn-sm" data-tambah="' + b.kunci + '">' + ic('plus', 'sm') + 'Tambah baris</button></div>'; }
    if (b.tipe === 'gambar') return '<div class="field">' + L + '<div class="help">Kolom gambar diisi dari templat (belum didukung di form ini).</div></div>';
    return '<div class="field">' + L + '<input class="input" id="' + id + '" type="' + ({ tanggal: 'date', angka: 'number' }[b.tipe] || 'text') + '" value="' + esc(val) + '"></div>';
  }
  const barisDaftar = (b, r) => '<tr>' + b.kolom.map(k => '<td><input class="input" style="min-height:36px" data-k="' + k.kunci + '" value="' + esc(r[k.kunci] || '') + '"></td>').join('') + '<td><button type="button" class="btn btn-ghost btn-icon sm" data-hapus-baris aria-label="Hapus baris">' + ic('x', 'sm') + '</button></td></tr>';
  function kumpulkan(bidang, box) {
    const o = {};
    bidang.forEach(b => {
      const el = box.querySelector('#de_' + b.kunci); if (!el) return;
      if (b.tipe === 'daftar') o[b.kunci] = $$('tbody tr', el).map(tr => { const r = {}; $$('[data-k]', tr).forEach(i => { r[i.dataset.k] = i.value; }); return r; }).filter(r => Object.values(r).some(v => String(v).trim()));
      else if (b.tipe === 'angka') o[b.kunci] = el.value === '' ? '' : Number(el.value);
      else o[b.kunci] = el.value.trim();
    });
    return o;
  }
  function selectPejabat(slot, pilih) {
    return '<select class="select" data-slot="' + slot.slot + '"><option value="">— Pilih pejabat —</option>' + D().pejabat.filter(p => p.aktif).map(p => '<option value="' + p.id + '" ' + (p.id === pilih ? 'selected' : '') + '>' + esc(p.nama + ' — ' + p.jabatan) + (p.adaPin ? '' : ' (belum ada PIN)') + '</option>').join('') + '</select>';
  }
  /** Form pembuatan dokumen. opsi = {sumber:{jenis,ref}, dok} */
  function bukaForm(tpl, opsi) {
    opsi = opsi || {}; const d = opsi.dok, sumber = opsi.sumber || (d && d.sumber) || null;
    const auto = sumber ? (D().kunciSumber[sumber.jenis] || []) : (tpl.modul === 'ringkasan' ? D().kunciSumber.ringkasan : []);
    const bidang = tpl.bidang.filter(b => auto.indexOf(b.kunci) < 0), nilai = (d && d.isian) || {};
    let pilihSumber = '';
    if (tpl.modul === 'rapat') pilihSumber = '<div class="field"><label>Catatan rapat sumber *</label><select class="select" id="dSrc">' + (App.data.rapat || []).map(c => '<option value="' + c.id + '" ' + (sumber && sumber.ref === c.id ? 'selected' : '') + '>' + esc(F.tgl(c.tanggal) + ' — ' + c.judul) + '</option>').join('') + '</select></div>';
    if (tpl.modul === 'pendaftar') {
      const p = sumber && App.P.find(x => x.id === sumber.ref);
      pilihSumber = '<div class="field"><label>Pendaftar *</label><input class="input" id="dCari" placeholder="Ketik nama atau nomor HP…" value="' + esc(p ? p.nama : '') + '" list="dList" autocomplete="off"><datalist id="dList"></datalist><input type="hidden" id="dSrc" value="' + esc(p ? p.id : '') + '"><div class="help">Untuk banyak pendaftar sekaligus gunakan tab Generate Massal.</div></div>';
    }
    const m = modal({ title: esc(tpl.nama), sub: esc(MODUL[tpl.modul] || '') + ' · nomor otomatis ' + esc(tpl.formatNomor || ''), size: 'wide',
      body: pilihSumber + (auto.length ? '<div class="callout info mb16">' + ic('wand-sparkles', 'sm') + '<div>Terisi otomatis dari sumber data: <b>' + auto.map(esc).join(', ') + '</b>. Nomor, tanggal, QR, dan kode verifikasi diisi server saat terbit.</div></div>' : '') +
        '<div class="form-grid" id="dForm">' + bidang.map(b => inputBidang(b, nilai[b.kunci])).join('') + '</div>' +
        (tpl.slot.length ? '<hr class="divider"><div class="flabel mb8">Penanda tangan</div><div class="form-grid">' + tpl.slot.map(s => { const x = d && (d.penandatangan || []).find(t => t.slot === s.slot);
          return '<div class="field"><label>' + esc(s.label) + (s.wajibSetuju ? ' <span class="opt">wajib setuju dengan PIN</span>' : '') + '</label>' + selectPejabat(s, (x && x.pejabatId) || s.pejabatId) + '</div>'; }).join('') + '</div>' : ''),
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-white" data-a="draf">Simpan draf</button><button class="btn btn-primary" data-a="ajukan">' + ic('file-pen-line') + 'Ajukan tanda tangan</button>' });
    const cari = m.el.querySelector('#dCari');
    if (cari) cari.addEventListener('input', () => {
      const q = cari.value.toLowerCase(), hasil = App.P.filter(p => p.nama.toLowerCase().indexOf(q) > -1 || hp08(p.no_hp).indexOf(q) > -1).slice(0, 30);
      $('#dList').innerHTML = hasil.map(p => '<option value="' + esc(p.nama) + '">' + esc(p.prodi + ' · ' + p.jalur + ' · ' + p.no_hp) + '</option>').join('');
      const tepat = App.P.find(p => p.nama === cari.value); $('#dSrc').value = tepat ? tepat.id : '';
    });
    delegate(m.el, 'click', '[data-tambah]', b => { const bd = tpl.bidang.find(x => x.kunci === b.dataset.tambah); $('#de_' + bd.kunci + ' tbody').insertAdjacentHTML('beforeend', barisDaftar(bd, {})); });
    delegate(m.el, 'click', '[data-hapus-baris]', b => b.closest('tr').remove());
    delegate(m.el, 'click', '[data-a]', async b => {
      const src = $('#dSrc', m.el), sumberKirim = tpl.modul === 'ringkasan' ? { jenis: 'ringkasan', ref: '' } : src ? { jenis: tpl.modul, ref: src.value } : null;
      if (src && !src.value) return toast('Pilih ' + (tpl.modul === 'rapat' ? 'catatan rapat' : 'pendaftar') + ' terlebih dahulu.', 'warn');
      const pj = {}; $$('[data-slot]', m.el).forEach(s => { if (s.value) pj[s.dataset.slot] = s.value; });
      busy(b, true, b.dataset.a === 'draf' ? 'Menyimpan…' : 'Mengajukan…');
      const r = await api('deBuat', { id: d ? d.id : '', templateId: tpl.id, isian: kumpulkan(bidang, m.el), pejabat: pj, sumber: sumberKirim, aksi: b.dataset.a }, { timeout: 180000 });
      busy(b, false); toast(r.message, r.success ? 'ok' : 'err');
      if (r.success) { m.close(); st.tab = 'arsip'; if (App.cur === 'dokumen') Pages.dokumen.render($('.page[data-page="dokumen"]')); else go('dokumen'); }
    });
  }

  /* ------------------------------ ARSIP ------------------------------ */
  function isiArsip(el) {
    const box = el.querySelector('[data-r="arsip"]'); if (!box) return;
    const q = st.q.toLowerCase(), L = D().dokumen.filter(d => (!st.filter || d.status === st.filter) && (!q || (d.judul + ' ' + d.nomor + ' ' + tplNama(d.templateId)).toLowerCase().indexOf(q) > -1));
    const cnt = s => D().dokumen.filter(d => d.status === s).length;
    box.innerHTML = '<div class="filter-card"><div class="toolbar"><div class="input-ico grow">' + ic('search') + '<input class="input" data-q placeholder="Cari judul atau nomor…" value="' + esc(st.q) + '"></div><div class="chips">' +
      [['', 'Semua'], ['MENUNGGU_TTD', 'Menunggu TTD'], ['TERBIT', 'Terbit'], ['DRAF', 'Draf'], ['DITARIK', 'Ditarik']].map(f => '<button class="chip ' + (st.filter === f[0] ? 'on' : '') + '" data-f="' + f[0] + '">' + f[1] + (f[0] ? ' <span class="n">' + cnt(f[0]) + '</span>' : '') + '</button>').join('') + '</div></div></div>' +
      (L.length ? L.slice(0, 80).map(d => {
        const s = ST[d.status] || ['?', 'b-mute'], antre = d.penandatangan.find(t => t.status !== 'SETUJU');
        return '<article class="note"><div class="row-between"><div class="row"><span class="badge ' + s[1] + '">' + s[0] + '</span><span class="small muted">' + esc(tplNama(d.templateId)) + '</span>' + (d.nomor ? '<span class="date-chip">' + esc(d.nomor) + '</span>' : '') + '</div><span class="small muted">' + F.tglJam(d.terbit || d.dibuat) + ' · ' + esc(d.oleh) + '</span></div>' +
          '<h3>' + esc(d.judul) + '</h3>' + (d.galat ? '<div class="callout bad mb8">' + ic('circle-x', 'sm') + esc(d.galat) + ' — coba setujui ulang.</div>' : '') +
          '<div class="chips">' + d.penandatangan.map(t => '<span class="tag-mini">' + ic(t.status === 'SETUJU' ? 'circle-check' : 'hourglass', 'sm') + esc(t.label + ': ' + (t.nama || '?')) + (t.metode ? ' · ' + esc(t.metode) : '') + '</span>').join('') + '</div>' +
          '<div class="row mt12">' + (d.status === 'MEMPROSES' ? '<span class="row small muted"><span class="spin sm"></span> Merender & mengekspor dokumen…</span>' : '') +
          (d.status === 'MENUNGGU_TTD' && antre ? '<button class="btn btn-primary btn-sm" data-act="setujui" data-id="' + d.id + '" data-slot="' + antre.slot + '">' + ic('key-round', 'sm') + 'Setujui sebagai ' + esc(antre.nama || antre.label) + '</button>' : '') +
          (d.status === 'DRAF' ? '<button class="btn btn-soft btn-sm" data-act="lanjut" data-id="' + d.id + '">' + ic('pencil', 'sm') + 'Lanjutkan draf</button>' : '') +
          (d.status === 'TERBIT' || d.status === 'DITARIK' ? d.format.map(f => '<button class="btn btn-white btn-sm" data-act="unduh" data-id="' + d.id + '" data-fmt="' + f + '">' + ic('download', 'sm') + f.toUpperCase() + '</button>').join('') +
            '<button class="btn btn-ghost btn-sm" data-act="verif" data-k="' + esc(d.kode) + '">' + ic('qr-code', 'sm') + 'Verifikasi</button>' : '') +
          ((d.status === 'DRAF' || d.status === 'MENUNGGU_TTD') && (isAdmin() || d.oleh === App.user.username) ? '<button class="btn btn-ghost btn-sm" data-act="hapus" data-id="' + d.id + '" style="color:var(--bad-fg)">' + ic('trash-2', 'sm') + 'Hapus</button>' : '') +
          (d.status === 'TERBIT' && isAdmin() ? '<button class="btn btn-ghost btn-sm" data-act="tarik" data-id="' + d.id + '" style="margin-left:auto;color:var(--bad-fg)">Tarik dokumen</button>' : '') + '</div></article>';
      }).join('') : '<div class="card">' + emptyBox('archive', 'Belum ada dokumen', 'Dokumen yang dibuat dan diterbitkan muncul di sini.') + '</div>');
  }
  function setujui(id, slot) {
    const d = D().dokumen.find(x => x.id === id), t = d.penandatangan.find(x => x.slot === +slot);
    const m = modal({ title: 'Setujui & tanda tangani', sub: esc(d.judul), size: 'narrow',
      body: '<div class="callout mb16">' + ic('user-check', 'sm') + '<div><b>' + esc(t.nama) + '</b><br><span class="small">' + esc(t.jabatan || t.label) + '</span></div></div>' +
        '<div class="field"><label>PIN pejabat (6 angka)</label><input class="input pin-input" id="sPin" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>' +
        (isAdmin() ? '<details><summary class="small" style="cursor:pointer">Pejabat berhalangan? Bypass oleh Admin</summary><div class="field mt8"><label>Alasan bypass (tercatat & tampil di verifikasi)</label><textarea class="textarea" id="sAlasan" rows="2"></textarea></div><button class="btn btn-danger btn-sm" id="sByp">Setujui dengan bypass</button></details>' : '') +
        '<p class="help mt12">Setelah semua penanda tangan setuju, dokumen langsung diberi nomor, QR, lalu diekspor ke arsip.</p>',
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" id="sOk">' + ic('check') + 'Setujui</button>' });
    const kirim = async (btn, data) => { busy(btn, true, 'Memproses…'); const r = await api('deSetujui', Object.assign({ dokumenId: id, slot: +slot }, data), { timeout: 240000 }); busy(btn, false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close(); };
    $('#sOk').onclick = e => { const p = $('#sPin').value; if (!/^\d{6}$/.test(p)) return toast('PIN harus 6 angka.', 'warn'); kirim(e.currentTarget, { pin: p }); };
    $('#sPin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#sOk').click(); });
    const bp = $('#sByp'); if (bp) bp.onclick = e => kirim(e.currentTarget, { bypass: true, catatan: $('#sAlasan').value });
  }

  /* ----------------------------- TEMPLAT ----------------------------- */
  function templatHtml() {
    return '<div class="row-between mb16"><p class="muted" style="max-width:720px">Desain templat di Google Docs/Sheets/Slides dengan penanda seperti <code>{{NAMA}}</code>, <code>{{TGL_RAPAT|tanggal}}</code>, <code>{{BIAYA|rupiah}}</code>, baris berulang <code>{{#PESERTA}}</code>, slot tanda tangan <code>{{TTD_1}}</code> <code>{{NAMA_PEJABAT_1}}</code>, dan <code>{{QR}}</code>.</p>' +
      '<button class="btn btn-primary" data-act="tpl-baru">' + ic('plus') + 'Tambah templat</button></div><div class="table-card"><div class="table-wrap"><table class="t"><thead><tr><th>Templat</th><th>Modul</th><th>Isian</th><th>TTD</th><th>Keluaran</th><th>Versi</th><th></th></tr></thead><tbody>' +
      D().templat.map(t => '<tr><td><div class="person">' + ic(ENG[t.engine] || 'file-text') + '<div><div class="nm">' + esc(t.nama) + '</div><div class="sm">Kode ' + esc(t.kode) + ' · ' + esc(t.formatNomor || '') + '</div></div></div></td><td class="small">' + esc(MODUL[t.modul] || t.modul) + '</td><td>' + t.bidang.length + '</td><td>' + t.slot.length + '</td><td class="small">' + t.keluaran.join(', ').toUpperCase() + '</td><td>v' + t.versi + '</td>' +
        '<td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-act="tpl-atur" data-id="' + t.id + '">Atur</button><button class="btn btn-ghost btn-sm" data-act="tpl-pindai" data-id="' + t.id + '">Pindai ulang</button>' +
        '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://docs.google.com/' + ({ docs: 'document', sheets: 'spreadsheets', slides: 'presentation' }[t.engine]) + '/d/' + esc(t.fileId) + '/edit">' + ic('external-link', 'sm') + 'Buka</a>' +
        '<button class="btn btn-ghost btn-sm" data-act="tpl-off" data-id="' + t.id + '" style="color:var(--bad-fg)">Nonaktifkan</button></td></tr>').join('') + '</tbody></table></div></div>';
  }
  function formTemplatBaru() {
    const m = modal({ title: 'Tambah templat dokumen', size: 'narrow',
      body: '<div class="field"><label>URL Google Docs / Sheets / Slides *</label><input class="input" id="nU" placeholder="https://docs.google.com/document/d/…"><div class="help">Berkas di luar folder aplikasi otomatis disalin ke folder DE_TEMPLAT.</div></div>' +
        '<div class="field"><label>Nama templat</label><input class="input" id="nN" placeholder="mis. Surat Undangan Tes"></div><div class="form-grid"><div class="field"><label>Kode nomor</label><input class="input" id="nK" maxlength="8" placeholder="UND"></div>' +
        '<div class="field"><label>Sumber data</label><select class="select" id="nM">' + Object.keys(MODUL).map(k => '<option value="' + k + '">' + MODUL[k] + '</option>').join('') + '</select></div></div>',
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" id="nOk">' + ic('scan-line') + 'Pindai templat</button>' });
    $('#nOk').onclick = async e => { busy(e.currentTarget, true, 'Memindai…'); const r = await api('deTemplatPindai', { url: $('#nU').value, nama: $('#nN').value, kode: $('#nK').value, modul: $('#nM').value }, { timeout: 120000 });
      busy($('#nOk'), false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close(); };
  }
  function aturTemplat(t) {
    const m = modal({ title: 'Atur templat', sub: esc(t.nama), size: 'xwide',
      body: '<div class="form-grid"><div class="field"><label>Nama</label><input class="input" id="aN" value="' + esc(t.nama) + '"></div><div class="field"><label>Sumber data</label><select class="select" id="aM">' + Object.keys(MODUL).map(k => '<option value="' + k + '" ' + (t.modul === k ? 'selected' : '') + '>' + MODUL[k] + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Format nomor <span class="opt">{URUT} {KODE} {BULAN} {TAHUN}</span></label><input class="input" id="aF" value="' + esc(t.formatNomor) + '"></div><div class="field"><label>Keluaran</label><div class="chips">' + t.pilihanKeluaran.map(k => '<label class="check"><input type="checkbox" data-kel="' + k + '" ' + (t.keluaran.indexOf(k) > -1 ? 'checked' : '') + '> ' + k.toUpperCase() + '</label>').join('') + '</div></div></div>' +
        '<label class="check mb16"><span class="switch"><input type="checkbox" id="aQ" ' + (t.qrPerPenandatangan ? 'checked' : '') + '></span> QR per penanda tangan (menggantikan spesimen di {{TTD_n}})</label>' +
        '<div class="flabel mb8">Kolom isian</div><div class="table-card mb16"><div class="table-wrap"><table class="t"><thead><tr><th>Kunci</th><th>Label</th><th>Tipe</th><th class="c">Wajib</th><th>Bantuan</th></tr></thead><tbody>' +
        t.bidang.map((b, i) => '<tr data-b="' + i + '"><td class="small tabnum">' + esc(b.kunci) + '</td><td><input class="input" style="min-height:36px" data-x-label value="' + esc(b.label) + '"></td><td><select class="select" style="min-height:36px" data-x-tipe>' + ['teks', 'area', 'naskah', 'tanggal', 'angka', 'pilihan', 'daftar', 'gambar'].map(x => '<option ' + (b.tipe === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></td>' +
          '<td class="c"><label class="check"><input type="checkbox" data-x-wajib ' + (b.wajib ? 'checked' : '') + '></label></td><td><input class="input" style="min-height:36px" data-x-bantu value="' + esc(b.bantu || '') + '" placeholder="' + (b.tipe === 'pilihan' ? 'opsi: A;B;C' : '') + '"></td></tr>').join('') + '</tbody></table></div></div>' +
        '<div class="flabel mb8">Slot tanda tangan</div><div class="table-card"><div class="table-wrap"><table class="t"><thead><tr><th>Slot</th><th>Label</th><th>Tanda</th><th>Urutan</th><th class="c">Wajib setuju</th><th>Pejabat bawaan</th></tr></thead><tbody>' +
        t.slot.map((s, i) => '<tr data-s="' + i + '"><td>' + s.slot + '</td><td><input class="input" style="min-height:36px" data-y-label value="' + esc(s.label) + '"></td><td><select class="select" style="min-height:36px" data-y-tanda>' + [['spesimen', 'Spesimen (QR bila kosong)'], ['qr', 'QR penanda tangan'], ['kosong', 'Kosong (TTD basah)']].map(o => '<option value="' + o[0] + '" ' + (s.tanda === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select></td>' +
          '<td><input class="input" style="min-height:36px;width:70px" type="number" min="1" data-y-urut value="' + (s.urutan || s.slot) + '"></td><td class="c"><label class="check"><input type="checkbox" data-y-wajib ' + (s.wajibSetuju ? 'checked' : '') + '></label></td><td>' + selectPejabat(s, s.pejabatId).replace('data-slot', 'data-y-pj') + '</td></tr>').join('') + '</tbody></table></div></div>',
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" id="aOk">Simpan pengaturan</button>' });
    $('#aOk').onclick = async e => {
      const bidang = t.bidang.map((b, i) => { const tr = $('[data-b="' + i + '"]', m.el), o = Object.assign({}, b, { label: $('[data-x-label]', tr).value, tipe: $('[data-x-tipe]', tr).value, wajib: $('[data-x-wajib]', tr).checked, bantu: $('[data-x-bantu]', tr).value });
        if (o.tipe === 'pilihan') o.opsi = o.bantu.replace(/^opsi:\s*/i, '').split(';').map(x => x.trim()).filter(Boolean); return o; });
      const slot = t.slot.map((s, i) => { const tr = $('[data-s="' + i + '"]', m.el); return Object.assign({}, s, { label: $('[data-y-label]', tr).value, tanda: $('[data-y-tanda]', tr).value, urutan: +$('[data-y-urut]', tr).value || s.slot, wajibSetuju: $('[data-y-wajib]', tr).checked, pejabatId: $('[data-y-pj]', tr).value }); });
      busy(e.currentTarget, true);
      const r = await api('deTemplatSimpan', { id: t.id, nama: $('#aN').value, modul: $('#aM').value, formatNomor: $('#aF').value, keluaran: $$('[data-kel]', m.el).filter(x => x.checked).map(x => x.dataset.kel), qrPerPenandatangan: $('#aQ').checked, bidang, slot });
      busy($('#aOk'), false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close();
    };
  }

  /* ----------------------------- PEJABAT ----------------------------- */
  function pejabatHtml() {
    const P = D().pejabat;
    return '<div class="row-between mb16"><p class="muted">Pejabat menyetujui dokumen dengan PIN 6 angka. Spesimen tanda tangan (PNG transparan) opsional — tanpa spesimen, QR penanda tangan dipakai.</p>' + (isAdmin() ? '<button class="btn btn-primary" data-act="pj-baru">' + ic('plus') + 'Tambah pejabat</button>' : '') + '</div>' +
      (P.length ? '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">' + P.map(p => '<div class="cat-card"><div class="row"><span class="avatar">' + esc(F.inisial(p.nama)) + '</span><div style="min-width:0"><b>' + esc(p.nama) + (p.gelar ? ', ' + esc(p.gelar) : '') + '</b><div class="small muted">' + esc(p.jabatan) + '</div></div></div>' +
        '<div class="chips">' + (p.adaPin ? '<span class="badge b-ok plain">PIN aktif</span>' : '<span class="badge b-warn plain">Belum ada PIN</span>') + (p.adaSpesimen ? '<span class="badge b-info plain">Spesimen</span>' : '') + (p.aktif ? '' : '<span class="badge b-mute plain">Nonaktif</span>') + (p.nip ? '<span class="tag-mini">NIP/NIDN ' + esc(p.nip) + '</span>' : '') + '</div>' +
        '<div class="row mt8"><button class="btn btn-soft btn-sm" data-act="pj-pin" data-id="' + p.id + '">' + ic('key-round', 'sm') + 'Ganti PIN</button>' + (isAdmin() ? '<button class="btn btn-ghost btn-sm" data-act="pj-edit" data-id="' + p.id + '">' + ic('pencil', 'sm') + 'Ubah</button>' : '') + '</div></div>').join('') + '</div>'
        : '<div class="card">' + emptyBox('user-round-cog', 'Belum ada pejabat', 'Tambahkan pejabat penanda tangan, mis. Kepala Biro PMB atau Ketua STIS.') + '</div>');
  }
  function formPejabat(p) {
    p = p || {}; let spes = null;
    const m = modal({ title: p.id ? 'Ubah pejabat' : 'Tambah pejabat', size: 'narrow',
      body: '<div class="field"><label>Nama *</label><input class="input" id="pN" value="' + esc(p.nama || '') + '"></div><div class="form-grid"><div class="field"><label>Gelar</label><input class="input" id="pG" value="' + esc(p.gelar || '') + '"></div><div class="field"><label>NIP / NIDN</label><input class="input" id="pI" value="' + esc(p.nip || '') + '"></div></div>' +
        '<div class="field"><label>Jabatan *</label><input class="input" id="pJ" value="' + esc(p.jabatan || '') + '" placeholder="Kepala Biro PMB"></div>' +
        '<div class="field"><label>' + (p.id ? 'PIN baru <span class="opt">kosongkan bila tidak diubah</span>' : 'PIN awal (6 angka)') + '</label><input class="input pin-input" id="pP" inputmode="numeric" maxlength="6"></div>' +
        '<div class="field"><label>Spesimen tanda tangan <span class="opt">PNG transparan, opsional</span></label><div id="pDz"></div><div id="pF" class="mt8"></div></div>' +
        (p.id ? '<label class="check"><span class="switch"><input type="checkbox" id="pA" ' + (p.aktif ? 'checked' : '') + '></span> Aktif</label>' : ''),
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" id="pOk">Simpan</button>' });
    dropzone($('#pDz'), { accept: 'image/png', info: 'PNG, maks. 5 MB' }, async f => { try { spes = await bacaBerkas(f, { kompres: false }); $('#pF').innerHTML = '<div class="file-pill">' + ic('signature', 'sm') + '<span class="grow">' + esc(spes.nama) + '</span></div>'; } catch (e) { toast(e.message, 'err'); } });
    $('#pOk').onclick = async e => { const d = { pejabat: { id: p.id || '', nama: $('#pN').value, gelar: $('#pG').value, nip: $('#pI').value, jabatan: $('#pJ').value, aktif: $('#pA') ? $('#pA').checked : true } };
      if ($('#pP').value) d.pin = $('#pP').value; if (spes) d.file = spes;
      busy(e.currentTarget, true); const r = await api('dePejabatSimpan', d, { timeout: 90000 }); busy($('#pOk'), false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close(); };
  }
  function gantiPin(p) {
    const m = modal({ title: 'Ganti PIN', sub: esc(p.nama), size: 'narrow',
      body: (p.adaPin ? '<div class="field"><label>PIN lama' + (isAdmin() ? ' <span class="opt">Admin boleh mengosongkan</span>' : '') + '</label><input class="input pin-input" id="gL" inputmode="numeric" maxlength="6"></div>' : '') +
        '<div class="field"><label>PIN baru</label><input class="input pin-input" id="gB" inputmode="numeric" maxlength="6"></div><div class="field"><label>Ulangi PIN baru</label><input class="input pin-input" id="gU" inputmode="numeric" maxlength="6"></div>',
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" id="gOk">Simpan PIN</button>' });
    $('#gOk').onclick = async e => { if ($('#gB').value !== $('#gU').value) return toast('PIN baru tidak sama.', 'warn');
      busy(e.currentTarget, true); const r = await api('dePejabatPin', { pejabatId: p.id, pinLama: $('#gL') ? $('#gL').value : '', pinBaru: $('#gB').value }); busy($('#gOk'), false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close(); };
  }

  /* ----------------------------- MASSAL ------------------------------ */
  function sasaranMassal() {
    const M = st.m; if (M.ids) { const s = new Set(M.ids); return App.P.filter(p => s.has(p.id)); }
    return App.P.filter(p => (!M.respon || p.respon === M.respon) && (!M.jalur.size || M.jalur.has(p.jalur)) && (!M.prodi.size || M.prodi.has(p.prodi)));
  }
  function isiMassal(el) {
    const box = el.querySelector('[data-r="massal"]'), M = st.m, T = D().templat, tpl = T.find(t => t.id === M.tpl) || T.find(t => t.modul === 'pendaftar') || T[0];
    if (!tpl) { box.innerHTML = '<div class="card">' + emptyBox('layers', 'Belum ada templat', '') + '</div>'; return; }
    M.tpl = tpl.id;
    const auto = D().kunciSumber.pendaftar || [], bidang = tpl.bidang.filter(b => auto.indexOf(b.kunci) < 0), sas = sasaranMassal();
    box.innerHTML = '<div class="grid g-side-wide"><div class="card card-pad"><div class="field"><label>Templat</label><select class="select" id="mT">' + T.map(t => '<option value="' + t.id + '" ' + (t.id === tpl.id ? 'selected' : '') + '>' + esc(t.nama) + ' (' + esc(MODUL[t.modul]) + ')</option>').join('') + '</select></div>' +
      (M.ids ? '<div class="callout info mb16">' + ic('info', 'sm') + '<div>' + M.ids.length + ' pendaftar dipilih dari Data Mahasiswa. <button class="btn btn-ghost btn-sm" data-act="m-lepas">Pakai filter</button></div></div>' :
        '<div class="field"><label>Respon</label><select class="select" id="mR"><option value="">Semua pendaftar</option>' + ['Belum Tes', 'Belum Daftar Ulang', 'Mengundurkan Diri', '-'].map(r => '<option value="' + r + '" ' + (M.respon === r ? 'selected' : '') + '>' + (r === '-' ? 'Tuntas' : r) + '</option>').join('') + '</select></div>' +
        '<div class="chips mb8"><span class="chip-row-label">Jalur:</span>' + JALUR.map(j => '<button class="chip ' + (M.jalur.has(j) ? 'on' : '') + '" data-act="m-j" data-v="' + j + '">' + j + '</button>').join('') + '</div>' +
        '<div class="chips mb16"><span class="chip-row-label">Prodi:</span>' + PRODI.map(p => '<button class="chip ' + (M.prodi.has(p) ? 'on' : '') + '" data-act="m-p" data-v="' + p + '">' + p + '</button>').join('') + '</div>') +
      '<div class="callout mb16">' + ic('users', 'sm') + '<div><b>' + F.n(sas.length) + ' dokumen</b> akan dibuat (satu per pendaftar), diproses bertahap ±20 dokumen per menit di server.</div></div>' +
      '<div class="flabel mb8">Isian yang sama untuk semua dokumen</div><div class="form-grid" id="mForm">' + bidang.map(b => inputBidang(b, '')).join('') + '</div>' +
      '<hr class="divider"><div class="flabel mb8">Penanda tangan (disetujui sekali untuk seluruh batch)</div>' + tpl.slot.map(s => '<div class="form-grid"><div class="field"><label>' + esc(s.label) + '</label>' + selectPejabat(s, s.pejabatId) + '</div><div class="field"><label>PIN pejabat</label><input class="input pin-input" data-pin="' + s.slot + '" inputmode="numeric" maxlength="6"></div></div>').join('') +
      '<details class="mb16"><summary class="small" style="cursor:pointer">Bypass PIN (Admin, alasan wajib)</summary><label class="check mt8"><input type="checkbox" id="mByp"> Gunakan bypass</label><textarea class="textarea mt8" id="mAl" rows="2" placeholder="Alasan…"></textarea></details>' +
      '<button class="btn btn-primary btn-block" data-act="m-mulai" ' + (sas.length ? '' : 'disabled') + '>' + ic('files') + 'Buat ' + F.n(sas.length) + ' dokumen</button></div>' +
      '<div><div class="flabel mb8">Pekerjaan massal</div>' + (D().jobs.length ? D().jobs.map(j => '<div class="card card-pad mb16"><div class="row-between"><b>' + esc(tplNama(j.templateId)) + '</b><span class="small muted">' + esc(j.jobId) + '</span></div><div class="progress"><i style="width:' + (j.total ? j.selesai * 100 / j.total : 0) + '%"></i></div>' +
        '<div class="row small"><span>' + j.selesai + '/' + j.total + ' selesai</span>' + (j.gagal ? '<span style="color:var(--bad-fg)">' + j.gagal + ' gagal</span>' : '') + (j.menunggu ? '<span class="muted"><span class="spin sm"></span> ' + j.menunggu + ' menunggu</span>' : '') + '</div>' +
        (j.selesai ? '<div class="row mt8">' + Array.from({ length: Math.ceil(j.selesai / 25) }, (_, i) => '<button class="btn btn-white btn-sm" data-act="zip" data-id="' + j.jobId + '" data-bag="' + i + '">' + ic('download', 'sm') + 'ZIP ' + (i + 1) + '</button>').join('') + '</div>' : '') + '</div>').join('') : '<p class="small muted">Belum ada pekerjaan.</p>') + '</div></div>';
    const sT = $('#mT'); if (sT) sT.onchange = e => { M.tpl = e.target.value; isiMassal(el); };
    const sR = $('#mR'); if (sR) sR.onchange = e => { M.respon = e.target.value; isiMassal(el); };
  }

  async function aksi(el, b) {
    const a = b.dataset.act, id = b.dataset.id, M = st.m;
    if (a === 'segar') syncNow(['de']).then(r => r.success && toast('Data dokumen terbaru.'));
    if (a === 'buat') bukaForm(D().templat.find(t => t.id === id));
    if (a === 'lanjut') { const d = D().dokumen.find(x => x.id === id); bukaForm(D().templat.find(t => t.id === d.templateId), { dok: d }); }
    if (a === 'setujui') setujui(id, b.dataset.slot);
    if (a === 'unduh') { busy(b, true); const r = await api('deUnduh', { id, format: b.dataset.fmt }, { timeout: 90000 }); busy(b, false); if (r.success) unduhB64(r.data.nama, r.data.mime, r.data.base64); else toast(r.message, 'err'); }
    if (a === 'verif') { const u = urlVerif(b.dataset.k); if (u) window.open(u, '_blank', 'noopener'); else salin(b.dataset.k); }
    if (a === 'hapus') { if (await confirmBox({ title: 'Hapus dokumen?', pesan: 'Draf/pengajuan ini dihapus.', ok: 'Hapus', danger: true })) { const r = await api('deHapus', { id }); toast(r.message, r.success ? 'ok' : 'err'); } }
    if (a === 'tarik') { const al = await confirmBox({ title: 'Tarik dokumen?', pesan: 'Halaman verifikasi akan menampilkan status DITARIK.', alasan: 'Alasan penarikan', ok: 'Tarik', danger: true }); if (al) { const r = await api('deTarik', { id, alasan: al }); toast(r.message, r.success ? 'ok' : 'err'); } }
    if (a === 'tpl-baru') formTemplatBaru();
    if (a === 'tpl-atur') aturTemplat(D().templat.find(t => t.id === id));
    if (a === 'tpl-pindai') { busy(b, true, 'Memindai…'); const r = await api('deTemplatPindai', { id }, { timeout: 120000 }); busy(b, false); toast(r.message, r.success ? 'ok' : 'err'); }
    if (a === 'tpl-off') { if (await confirmBox({ title: 'Nonaktifkan templat?', pesan: 'Dokumen lama tetap aman di arsip.', ok: 'Nonaktifkan', danger: true })) { const r = await api('deTemplatHapus', { id }); toast(r.message, r.success ? 'ok' : 'err'); } }
    if (a === 'pj-baru') formPejabat({});
    if (a === 'pj-edit') formPejabat(D().pejabat.find(p => p.id === id));
    if (a === 'pj-pin') gantiPin(D().pejabat.find(p => p.id === id));
    if (a === 'm-j') { M.ids = null; M.jalur.has(b.dataset.v) ? M.jalur.delete(b.dataset.v) : M.jalur.add(b.dataset.v); isiMassal(el); }
    if (a === 'm-p') { M.ids = null; M.prodi.has(b.dataset.v) ? M.prodi.delete(b.dataset.v) : M.prodi.add(b.dataset.v); isiMassal(el); }
    if (a === 'm-lepas') { M.ids = null; isiMassal(el); }
    if (a === 'zip') { busy(b, true); const r = await api('deMassalZip', { jobId: id, bagian: +b.dataset.bag }, { timeout: 180000 }); busy(b, false); if (r.success) unduhB64(r.data.nama, r.data.mime, r.data.base64); else toast(r.message, 'err'); }
    if (a === 'm-mulai') {
      const tpl = D().templat.find(t => t.id === M.tpl), box = el.querySelector('[data-r="massal"]'), sas = sasaranMassal();
      const auto = D().kunciSumber.pendaftar || [], bidang = tpl.bidang.filter(x => auto.indexOf(x.kunci) < 0), pejabat = {}, pin = {};
      $$('[data-slot]', box).forEach(s => { pejabat[s.dataset.slot] = s.value; }); $$('[data-pin]', box).forEach(i => { pin[i.dataset.pin] = i.value; });
      if (!(await confirmBox({ title: 'Buat ' + sas.length + ' dokumen?', pesan: 'Setiap dokumen mendapat nomor dan QR sendiri. Proses berjalan di server walau halaman ditutup.', ok: 'Mulai' }))) return;
      busy(b, true, 'Mengantre…');
      const r = await api('deMassal', { templateId: tpl.id, ids: sas.map(p => p.id), isian: kumpulkan(bidang, box), pejabat, pin, bypass: $('#mByp').checked, alasan: $('#mAl').value });
      busy(b, false); toast(r.message, r.success ? 'ok' : 'err');
    }
  }
  window.Dok = {
    buatDari(jenis, ref) {
      const buka = () => { const t = D().templat.find(x => x.modul === jenis); if (!t) return toast('Belum ada templat untuk ' + (MODUL[jenis] || jenis).toLowerCase() + '.', 'warn'); bukaForm(t, { sumber: { jenis, ref } }); };
      if (App.data.de) buka(); else { toast('Memuat templat…', 'info', 1500); syncNow(['de']).then(buka); }
    }
  };
})();
