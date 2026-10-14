/* rapat.js — Catatan Rapat Pekanan (PRD F6) */
'use strict';
(function () {
  const st = { q: '', dari: '', sampai: '', page: 1, per: 5, edit: null, buka: {} };
  const KATEGORI = ['Rapat Evaluasi', 'Koordinasi', 'Publikasi', 'Kick-off', 'Keuangan', 'Lainnya'];
  const list = () => App.data.rapat || [];
  const bolehUbah = c => isAdmin() || c.dibuat_oleh === App.user.username;
  const nama = u => { const x = ((App.data.meta || {}).users || []).find(v => v.username === u); return x ? x.nama : u; };

  registerPage('rapat', {
    title: 'Catatan Rapat', deps: ['rapat'],
    template: () => '<div data-r="head"></div><div class="stat-row" data-r="stats"></div><div class="filter-card" data-r="filter"></div>' +
      '<div class="grid g-half"><div><div class="row-between mb16"><div class="section-title" style="margin:0">Daftar Pertemuan <span class="badge b-peach plain" data-r="jml"></span></div><span class="small muted">Urutkan: terbaru</span></div><div data-r="list"></div></div>' +
      '<div class="desk-only"><div class="card card-pad sticky" data-r="form"></div></div></div><button class="btn btn-primary fab" data-act="baru">' + ic('notebook-pen') + 'Tulis Catatan</button>',
    mount(el) {
      delegate(el, 'click', '[data-act]', b => aksi(el, b));
      delegate(el, 'click', '[data-pg]', b => { if (!b.disabled) { st.page = +b.dataset.pg; renderList(el); } });
      el.addEventListener('input', debounce(e => { if (e.target.matches('[data-q]')) { st.q = e.target.value; st.page = 1; renderList(el); } }, 250));
      delegate(el, 'change', '[data-poin]', c => { const x = c.dataset.poin.split('|'); window.RapatPoin.toggle(x[0], x[1], c.checked); });
      delegate(el, 'change', '[data-tgl]', i => { st[i.dataset.tgl] = i.value; st.page = 1; renderList(el); });
      isiForm(el.querySelector('[data-r="form"]'), null, el);
    },
    render(el) {
      el.querySelector('[data-r="head"]').innerHTML = pageHead({ pill: 'Administrasi Internal PMB', eyebrow: ['TA ' + (S().TAHUN_AKADEMIK || '')], title: 'Catatan Rapat PMB',
        lead: 'Notula resmi, agenda pekanan, dan rekap tindak lanjut panitia penerimaan mahasiswa baru.',
        actions: '<button class="btn btn-white" data-act="notulen">' + ic('file-text') + 'Unduh Notulen (Word/PDF)</button><button class="btn btn-primary desk-only" data-act="baru">' + ic('plus') + 'Tulis Catatan Baru</button>' });
      const L = list(), belum = L.reduce((a, c) => a + (c.poin || []).filter(p => !p.selesai).length, 0);
      el.querySelector('[data-r="stats"]').innerHTML = '<div class="stat"><div class="ico">' + ic('flag') + '</div><div><div class="lbl">Siklus berjalan</div><div class="val">' + esc(S().GELOMBANG_AKTIF || '-') + ' <span class="badge b-peach plain">Aktif</span></div></div></div>' +
        '<div class="stat"><div class="ico">' + ic('book-open') + '</div><div><div class="lbl">Total notula</div><div class="val">' + L.length + ' <small>dokumen tersimpan</small></div></div></div>' +
        '<div class="stat"><div class="ico" style="background:var(--bad-bg);color:var(--bad-fg)">' + ic('list-checks') + '</div><div><div class="lbl">Belum terealisasi</div><div class="val" style="color:var(--bad-fg)">' + belum + ' <small>poin tindak lanjut</small></div></div></div>';
      el.querySelector('[data-r="filter"]').innerHTML = '<div class="toolbar"><div class="input-ico grow">' + ic('search') + '<input class="input" data-q placeholder="Cari kata kunci rapat atau PJ…" value="' + esc(st.q) + '"></div>' +
        '<input class="input" type="date" data-tgl="dari" value="' + esc(st.dari) + '" style="width:auto" aria-label="Dari tanggal"><span class="muted">s.d.</span><input class="input" type="date" data-tgl="sampai" value="' + esc(st.sampai) + '" style="width:auto" aria-label="Sampai tanggal">' +
        '<button class="btn btn-white btn-icon" data-act="reset" title="Reset filter" aria-label="Reset filter">' + ic('rotate-ccw') + '</button></div>' +
        '<div class="callout mt12">' + ic('shield-check', 'sm') + '<div><b>Hak akses:</b> Tim PMB dapat menulis dan mengubah catatan buatannya sendiri. Admin dapat mengubah dan menghapus semua notula.</div></div>';
      renderList(el);
    }
  });
  function saring() {
    const q = st.q.toLowerCase();
    return list().filter(c => (!st.dari || c.tanggal >= st.dari) && (!st.sampai || c.tanggal <= st.sampai) &&
      (!q || [c.judul, c.isi, c.keputusan_tindak_lanjut, c.penanggung_jawab, c.kategori].join(' ').toLowerCase().indexOf(q) > -1));
  }
  function renderList(el) {
    const L = saring(), rows = L.slice((st.page - 1) * st.per, st.page * st.per);
    el.querySelector('[data-r="jml"]').textContent = L.length + ' catatan';
    el.querySelector('[data-r="list"]').innerHTML = rows.length ? rows.map(c => '<article class="note"><div class="row-between"><div class="row"><span class="date-chip">' + ic('calendar', 'sm') + F.tgl(c.tanggal) + '</span>' +
      '<span class="small muted">Dibuat oleh: <b>' + esc(nama(c.dibuat_oleh)) + '</b></span>' + (c.kategori ? '<span class="badge b-peach plain">' + esc(c.kategori) + '</span>' : '') + '</div>' +
      '<div class="row" style="gap:2px"><button class="btn btn-ghost btn-icon sm" data-act="notula" data-id="' + c.id + '" title="Cetak notula PDF" aria-label="Cetak notula">' + ic('file-pen-line', 'sm') + '</button>' +
      (bolehUbah(c) ? '<button class="btn btn-ghost btn-icon sm" data-act="edit" data-id="' + c.id + '" aria-label="Ubah">' + ic('pencil', 'sm') + '</button><button class="btn btn-ghost btn-icon sm" data-act="hapus" data-id="' + c.id + '" aria-label="Hapus" style="color:var(--bad-fg)">' + ic('trash-2', 'sm') + '</button>' : '') + '</div></div>' +
      '<h3>' + esc(c.judul) + '</h3><div class="body ' + (st.buka[c.id] ? 'open' : '') + '">' + esc(c.isi) + '</div>' + (String(c.isi).length > 260 ? '<button class="btn btn-ghost btn-sm" data-act="buka" data-id="' + c.id + '">' + (st.buka[c.id] ? 'Ringkas' : 'Baca selengkapnya') + '</button>' : '') +
      ((c.poin || []).length ? (() => { const sel = c.poin.filter(p => p.selesai).length;
        return '<div class="decision"><div class="dh">' + ic('circle-check', 'sm') + 'Keputusan & tindak lanjut <span class="badge ' + (sel === c.poin.length ? 'b-ok' : 'b-warn') + '" style="margin-left:auto">' + sel + '/' + c.poin.length + ' terealisasi</span></div><div class="todo-list">' +
          c.poin.map(p => '<label class="todo' + (p.selesai ? ' done' : '') + '"><span class="check"><input type="checkbox" data-poin="' + c.id + '|' + esc(p.id) + '" ' + (p.selesai ? 'checked' : '') + '></span><span><span class="tt">' + esc(p.teks) + '</span>' +
            (p.selesai ? '<small>✓ ' + esc(nama(p.selesai_oleh)) + (p.selesai_pada ? ' · ' + F.tglJam(p.selesai_pada) : '') + '</small>' : '') + '</span></label>').join('') + '</div></div>'; })() : '') +
      '<div class="note-foot"><span>' + ic('user', 'sm') + ' PJ: <b style="color:var(--text)">' + esc(c.penanggung_jawab || '-') + '</b></span>' +
      (c.lampiran_file_id ? '<button class="attach" data-act="lampiran" data-id="' + esc(c.lampiran_file_id) + '" data-nama="' + esc(c.lampiran_nama) + '">' + ic('paperclip', 'sm') + esc(c.lampiran_nama) + '</button>' : '<span class="small muted">Tanpa lampiran</span>') +
      '<span>' + ic('clock', 'sm') + ' ' + (c.jam || F.jam(c.dibuat)) + ' WIB</span></div></article>').join('') + '<div class="row-between"><span class="small muted">Menampilkan ' + rows.length + ' dari ' + L.length + ' catatan rapat</span>' + pagerHtml(L.length, st.page, st.per) + '</div>'
      : '<div class="card">' + emptyBox('notebook-pen', list().length ? 'Tidak ada yang cocok' : 'Belum ada catatan rapat', list().length ? 'Ubah kata kunci atau rentang tanggal.' : 'Tulis notula rapat pertama panitia PMB.') + '</div>';
  }
  async function aksi(el, b) {
    const a = b.dataset.act, id = b.dataset.id, c = list().find(x => x.id === id);
    if (a === 'baru') bukaForm(el, null);
    if (a === 'edit') bukaForm(el, c);
    if (a === 'buka') { st.buka[id] = !st.buka[id]; renderList(el); }
    if (a === 'lampiran') lihatBerkas(id, b.dataset.nama);
    if (a === 'notula') { if (window.Dok) Dok.buatDari('rapat', id); }
    if (a === 'reset') { st.q = ''; st.dari = ''; st.sampai = ''; st.page = 1; Pages.rapat.render(el); }
    if (a === 'hapus') hapus(c);
    if (a === 'notulen') pilihNotulen(saring());
  }
  async function hapus(c) {
    if (!c || !(await confirmBox({ title: 'Hapus catatan rapat?', pesan: '"' + c.judul + '" (' + F.tgl(c.tanggal) + ') akan dihapus permanen.', ok: 'Hapus', danger: true }))) return false;
    const r = await api('rapatHapus', { id: c.id }); toast(r.message, r.success ? 'ok' : 'err'); return r.success;
  }
  function bukaForm(el, c) {
    if (matchMedia('(min-width: 769px)').matches) { isiForm(el.querySelector('[data-r="form"]'), c, el); el.querySelector('[data-r="form"]').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const m = modal({ title: c ? 'Ubah catatan rapat' : 'Tulis catatan rapat', body: '<div data-f></div>' });
    isiForm(m.el.querySelector('[data-f]'), c, el, m);
  }
  /** Formulir dipakai di panel desktop dan lembar HP. */
  function isiForm(box, c, el, m) {
    c = c || {}; let berkas = null, hapusLamp = false;
    box.innerHTML = (m ? '' : '<div class="row-between mb16"><div><h3 class="h3">' + (c.id ? 'Ubah' : 'Tulis') + ' Catatan Rapat</h3><p class="sub">Tersimpan langsung ke database internal.</p></div><span class="badge b-peach">' + (c.id ? 'Mode ubah' : 'Mode form aktif') + '</span></div>') +
      '<div class="form-grid"><div class="field"><label>Tanggal rapat *</label><input class="input tinted" type="date" data-i="tanggal" value="' + esc(c.tanggal || F.iso(new Date())) + '"></div>' +
      '<div class="field"><label>Waktu (jam) rapat</label><input class="input tinted" type="time" data-i="jam" value="' + esc(c.jam || (c.id ? '' : F.jam(new Date()))) + '"></div></div>' +
      '<div class="field"><label>Judul catatan rapat *</label><input class="input tinted" data-i="judul" value="' + esc(c.judul || '') + '" placeholder="mis. Evaluasi Pendaftaran Gelombang 1"></div>' +
      '<div class="field"><label>Kategori</label><input class="input tinted" data-i="kategori" list="rKat" value="' + esc(c.kategori || '') + '" placeholder="Rapat Evaluasi"><datalist id="rKat">' + KATEGORI.map(k => '<option>' + k + '</option>').join('') + '</datalist></div>' +
      '<div class="field"><label>Isi pembahasan *</label><textarea class="textarea tinted" data-i="isi" rows="9">' + esc(c.isi || '') + '</textarea></div>' +
      '<div class="field"><label>Keputusan & tindakan <span class="opt">centang bila terealisasi</span></label><div class="poin-ed" data-poin-ed></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-f="tambah-poin">' + ic('plus', 'sm') + 'Tambah poin</button></div>' +
      '<div class="field"><label>Penanggung jawab *</label><div class="input-ico">' + ic('user') + '<input class="input tinted" data-i="penanggung_jawab" value="' + esc(c.penanggung_jawab || '') + '"></div></div>' +
      '<div class="field"><label>Lampiran file <span class="opt">opsional, maks. 5 MB</span></label><div data-dz></div><div data-pill class="mt8"></div></div>' +
      '<div class="callout mb16">' + ic('shield-check', 'sm') + '<div><b>Info kewenangan:</b> Tim PMB dapat mengubah/menghapus catatan buatannya sendiri. Admin memiliki akses penuh.</div></div>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-f="batal">Batal</button>' + (c.id && bolehUbah(c) ? '<button class="btn btn-danger" data-f="hapus">' + ic('trash-2') + 'Hapus</button>' : '') +
      '<button class="btn btn-primary" data-f="simpan">' + ic('check') + 'Simpan Catatan</button></div>';
    const pill = () => { const p = box.querySelector('[data-pill]');
      p.innerHTML = berkas ? '<div class="file-pill">' + ic('paperclip', 'sm') + '<span class="grow">' + esc(berkas.nama) + ' · ' + Math.round(berkas.ukuran / 1024) + ' KB</span><button class="btn btn-ghost btn-icon sm" data-rm aria-label="Batalkan lampiran">' + ic('x', 'sm') + '</button></div>'
        : c.lampiran_file_id && !hapusLamp ? '<div class="file-pill">' + ic('paperclip', 'sm') + '<span class="grow">' + esc(c.lampiran_nama) + '</span><button class="btn btn-ghost btn-icon sm" data-rm aria-label="Hapus lampiran">' + ic('x', 'sm') + '</button></div>' : '';
      const rm = p.querySelector('[data-rm]'); if (rm) rm.onclick = () => { if (berkas) berkas = null; else hapusLamp = true; pill(); }; };
    pill();
    const ed = box.querySelector('[data-poin-ed]');
    const barisPoin = p => '<div class="poin-row" data-pid="' + esc(p.id || '') + '"><span class="check"><input type="checkbox" data-pc ' + (p.selesai ? 'checked' : '') + ' aria-label="Terealisasi"></span>' +
      '<input class="input tinted" data-pt value="' + esc(p.teks || '') + '" placeholder="mis. Cetak 2.500 brosur sebelum 10 Maret"><button type="button" class="btn btn-ghost btn-icon sm" data-f="hapus-poin" aria-label="Hapus poin">' + ic('x', 'sm') + '</button></div>';
    ed.innerHTML = ((c.poin && c.poin.length) ? c.poin : [{}]).map(barisPoin).join('');
    const tambahPoin = (setelah, teks) => { const t = document.createElement('div'); t.innerHTML = barisPoin({ teks: teks || '' }); const row = t.firstChild;
      if (setelah) setelah.after(row); else ed.appendChild(row); row.querySelector('[data-pt]').focus(); return row; };
    box.querySelector('[data-f="tambah-poin"]').onclick = () => tambahPoin(null);
    ed.addEventListener('click', e => { const b = e.target.closest('[data-f="hapus-poin"]'); if (!b) return; const r = b.closest('.poin-row'); if (ed.children.length > 1) r.remove(); else r.querySelector('[data-pt]').value = ''; });
    ed.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-pt]')) { e.preventDefault(); tambahPoin(e.target.closest('.poin-row')); } });
    ed.addEventListener('paste', e => {          // menempel daftar bernomor → otomatis jadi beberapa poin
      if (!e.target.matches('[data-pt]')) return;
      const baris = (e.clipboardData || window.clipboardData).getData('text').split(/\r?\n/).map(x => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean);
      if (baris.length < 2) return; e.preventDefault();
      let row = e.target.closest('.poin-row'); e.target.value = baris[0]; baris.slice(1).forEach(t => { row = tambahPoin(row, t); });
    });
    dropzone(box.querySelector('[data-dz]'), { accept: 'image/*,application/pdf,.docx,.xlsx', info: 'Mendukung PDF, DOCX, XLSX, gambar (hingga 5 MB)' }, async f => { try { berkas = await bacaBerkas(f); hapusLamp = false; pill(); } catch (e) { toast(e.message, 'err'); } });
    box.querySelector('[data-f="batal"]').onclick = () => { if (m) m.close(); else isiForm(box, null, el); };
    const h = box.querySelector('[data-f="hapus"]'); if (h) h.onclick = async () => { if (await hapus(c)) { if (m) m.close(); else isiForm(box, null, el); } };
    box.querySelector('[data-f="simpan"]').onclick = async e => {
      const d = { id: c.id || '' }; $$('[data-i]', box).forEach(i => { d[i.dataset.i] = i.value; });
      d.poin = $$('.poin-row', ed).map(r => ({ id: r.dataset.pid, teks: r.querySelector('[data-pt]').value.trim(), selesai: r.querySelector('[data-pc]').checked })).filter(p => p.teks);
      if (!d.judul.trim() || !d.isi.trim() || !d.tanggal) return toast('Tanggal, judul, dan isi pembahasan wajib diisi.', 'warn');
      const payload = { rapat: d, hapusLampiran: hapusLamp }; if (berkas) payload.file = berkas;
      busy(e.currentTarget, true, berkas ? 'Mengunggah…' : 'Menyimpan…');
      const r = await api('rapatSimpan', payload, { timeout: 120000 });
      busy(box.querySelector('[data-f="simpan"]'), false); toast(r.message, r.success ? 'ok' : 'err');
      if (r.success) { if (m) m.close(); else isiForm(box, null, el); }
    };
  }
})();

/* ===== v1.1 — centang poin tindak lanjut (dipakai Catatan Rapat & Dasbor) ===== */
window.RapatPoin = {
  async toggle(cid, pid, selesai) {
    const c = (App.data.rapat || []).find(x => x.id === cid), p = c && (c.poin || []).find(x => x.id === pid); if (!p) return;
    const lama = Object.assign({}, p);
    Object.assign(p, { selesai, selesai_oleh: selesai ? App.user.username : '', selesai_pada: selesai ? new Date().toISOString() : '' });
    emit('data', ['rapat']);                                   // tampilan langsung berubah (optimistis)
    const r = await api('rapatPoin', { id: cid, poinId: pid, selesai });
    if (!r.success) { Object.assign(p, lama); emit('data', ['rapat']); toast(r.message, 'err'); }
  }
};
/* ===== v1.1 — Notulen rapi dalam Word (.doc) / PDF (cetak) ===== */
function pilihNotulen(L) {
  if (!L.length) return toast('Tidak ada catatan pada filter ini.', 'warn');
  const m = modal({ title: 'Unduh notulen rapat', sub: L.length + ' catatan sesuai filter saat ini', size: 'narrow',
    body: '<label class="check mb8"><input type="checkbox" id="nIsi" checked> Sertakan isi pembahasan</label>' +
      '<p class="help mb16">Notulen memuat hari/tanggal, waktu, kategori, penanggung jawab, isi pembahasan, serta poin keputusan dengan status dan keterangan realisasinya.</p>' +
      '<div class="grid g2" style="gap:10px"><button class="btn btn-white" data-n="doc">' + ic('file-text') + 'Word (.doc)</button><button class="btn btn-primary" data-n="pdf">' + ic('printer') + 'PDF / Cetak</button></div>' });
  m.el.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (!b) return; buatNotulen(L, b.dataset.n, $('#nIsi').checked); m.close(); });
}
function buatNotulen(L, fmt, denganIsi) {
  const s = S(), HR = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
  const nm = u => { const x = ((App.data.meta || {}).users || []).find(v => v.username === u); return x ? x.nama : u; };
  const urut = L.slice().sort((a, b) => String(a.tanggal + (a.jam || '')).localeCompare(String(b.tanggal + (b.jam || ''))));
  const periode = F.tglP(urut[0].tanggal) + (urut.length > 1 ? ' – ' + F.tglP(urut[urut.length - 1].tanggal) : '');
  const isi = urut.map((c, i) => {
    const d = tglObj(c.tanggal), poin = c.poin || [];
    return '<div class="rapat"><h2>' + (i + 1) + '. ' + esc(c.judul) + '</h2><table class="meta">' +
      '<tr><td>Hari / tanggal</td><td>: ' + (d ? HR[d.getDay()] + ', ' + F.tglP(d) : '-') + '</td></tr><tr><td>Waktu</td><td>: ' + esc(c.jam || F.jam(c.dibuat)) + ' WIB</td></tr>' +
      (c.kategori ? '<tr><td>Kategori</td><td>: ' + esc(c.kategori) + '</td></tr>' : '') + '<tr><td>Penanggung jawab</td><td>: ' + esc(c.penanggung_jawab || '-') + '</td></tr>' +
      '<tr><td>Notulis</td><td>: ' + esc(nm(c.dibuat_oleh)) + '</td></tr>' + (c.lampiran_nama ? '<tr><td>Lampiran</td><td>: ' + esc(c.lampiran_nama) + '</td></tr>' : '') + '</table>' +
      (denganIsi ? '<h3>Pembahasan</h3><p class="isi">' + esc(c.isi).replace(/\n/g, '<br>') + '</p>' : '') +
      '<h3>Keputusan &amp; Tindak Lanjut</h3>' + (poin.length ? '<table class="poin"><tr><th style="width:28px">No</th><th>Keputusan / tindakan</th><th style="width:96px">Status</th><th style="width:170px">Keterangan</th></tr>' +
        poin.map((p, j) => '<tr><td style="text-align:center">' + (j + 1) + '</td><td>' + esc(p.teks) + '</td><td>' + (p.selesai ? '✔ Terealisasi' : '☐ Belum') + '</td><td>' +
          (p.selesai ? 'Selesai ' + (p.selesai_pada ? F.tglJam(p.selesai_pada) : '') + (p.selesai_oleh ? ' oleh ' + esc(nm(p.selesai_oleh)) : '') : 'Menunggu realisasi') + '</td></tr>').join('') + '</table>' : '<p>-</p>') + '</div>';
  }).join('');
  const css = '@page{size:A4;margin:2cm}body{font-family:"Times New Roman",serif;font-size:12pt;color:#000;line-height:1.45}h1{font-size:15pt;text-align:center;margin:0}.sub{text-align:center;margin:2pt 0 14pt;font-size:11pt}' +
    'hr{border:0;border-top:2px solid #000;margin:6pt 0 14pt}h2{font-size:13pt;margin:16pt 0 6pt}h3{font-size:12pt;margin:10pt 0 4pt}table{border-collapse:collapse;width:100%}.meta td{padding:1pt 4pt;vertical-align:top}.meta td:first-child{width:130px}' +
    '.poin td,.poin th{border:1px solid #000;padding:4pt 6pt;vertical-align:top;font-size:11pt}.poin th{background:#eee}.isi{text-align:justify;margin:0}.rapat{page-break-inside:avoid}.kaki{margin-top:24pt;font-size:9pt;color:#555}';
  const html = '<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Notulen Rapat PMB</title><style>' + css + '</style></head><body>' +
    '<h1>NOTULEN RAPAT PANITIA PMB</h1><h1>' + esc(String(s.NAMA_INSTITUSI || '').toUpperCase()) + '</h1><p class="sub">Tahun Akademik ' + esc(s.TAHUN_AKADEMIK || '') + ' · Periode ' + periode + '</p><hr>' + isi +
    '<p class="kaki">Dicetak dari Laporan Admin PMB pada ' + F.tglJam(new Date()) + ' oleh ' + esc(App.user.nama) + '.</p></body></html>';
  const nama = 'Notulen-Rapat-PMB-' + urut[0].tanggal + (urut.length > 1 ? '_' + urut[urut.length - 1].tanggal : '');
  if (fmt === 'doc') {
    const url = URL.createObjectURL(new Blob(['\ufeff' + html], { type: 'application/msword' })), a = document.createElement('a');
    a.href = url; a.download = nama + '.doc'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Notulen Word diunduh: ' + nama + '.doc');
  } else {
    const w = window.open('', '_blank');
    if (!w) return toast('Izinkan pop-up untuk mencetak / menyimpan PDF.', 'warn');
    w.document.write(html.replace('</body>', '<script>setTimeout(function(){window.print()},300)<\/script></body>')); w.document.close();
  }
  api('logDownload', { jenis: 'Notulen rapat (' + fmt.toUpperCase() + ')', baris: L.length }).catch(() => { });
}
