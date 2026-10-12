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
      '<div class="grid g-side-wide"><div><div class="row-between mb16"><div class="section-title" style="margin:0">Daftar Pertemuan <span class="badge b-peach plain" data-r="jml"></span></div><span class="small muted">Urutkan: terbaru</span></div><div data-r="list"></div></div>' +
      '<div class="desk-only"><div class="card card-pad sticky" data-r="form"></div></div></div><button class="btn btn-primary fab" data-act="baru">' + ic('notebook-pen') + 'Tulis Catatan</button>',
    mount(el) {
      delegate(el, 'click', '[data-act]', b => aksi(el, b));
      delegate(el, 'click', '[data-page]', b => { if (!b.disabled) { st.page = +b.dataset.page; renderList(el); } });
      el.addEventListener('input', debounce(e => { if (e.target.matches('[data-q]')) { st.q = e.target.value; st.page = 1; renderList(el); } }, 250));
      delegate(el, 'change', '[data-tgl]', i => { st[i.dataset.tgl] = i.value; st.page = 1; renderList(el); });
      isiForm(el.querySelector('[data-r="form"]'), null, el);
    },
    render(el) {
      el.querySelector('[data-r="head"]').innerHTML = pageHead({ pill: 'Administrasi Internal PMB', eyebrow: ['TA ' + (S().TAHUN_AKADEMIK || '')], title: 'Catatan Rapat PMB',
        lead: 'Notula resmi, agenda pekanan, dan rekap tindak lanjut panitia penerimaan mahasiswa baru.',
        actions: '<button class="btn btn-white" data-act="excel">' + ic('file-spreadsheet') + 'Download Excel (.xlsx)</button><button class="btn btn-primary desk-only" data-act="baru">' + ic('plus') + 'Tulis Catatan Baru</button>' });
      const L = list(), belum = L.filter(c => c.keputusan_tindak_lanjut && c.status_tindak_lanjut !== 'Selesai').length;
      el.querySelector('[data-r="stats"]').innerHTML = '<div class="stat"><div class="ico">' + ic('flag') + '</div><div><div class="lbl">Siklus berjalan</div><div class="val">' + esc(S().GELOMBANG_AKTIF || '-') + ' <span class="badge b-peach plain">Aktif</span></div></div></div>' +
        '<div class="stat"><div class="ico">' + ic('book-open') + '</div><div><div class="lbl">Total notula</div><div class="val">' + L.length + ' <small>dokumen tersimpan</small></div></div></div>' +
        '<div class="stat"><div class="ico" style="background:var(--bad-bg);color:var(--bad-fg)">' + ic('list-checks') + '</div><div><div class="lbl">Belum terealisasi</div><div class="val" style="color:var(--bad-fg)">' + belum + ' <small>tindak lanjut</small></div></div></div>';
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
      (c.keputusan_tindak_lanjut ? '<div class="decision"><div class="dh">' + ic('circle-check', 'sm') + 'Keputusan & tindak lanjut <span class="badge ' + (c.status_tindak_lanjut === 'Selesai' ? 'b-ok' : 'b-warn') + '" style="margin-left:auto">' + esc(c.status_tindak_lanjut || 'Belum Terealisasi') + '</span></div><div class="dbody">' + esc(c.keputusan_tindak_lanjut) + '</div></div>' : '') +
      '<div class="note-foot"><span>' + ic('user', 'sm') + ' PJ: <b style="color:var(--text)">' + esc(c.penanggung_jawab || '-') + '</b></span>' +
      (c.lampiran_file_id ? '<button class="attach" data-act="lampiran" data-id="' + esc(c.lampiran_file_id) + '" data-nama="' + esc(c.lampiran_nama) + '">' + ic('paperclip', 'sm') + esc(c.lampiran_nama) + '</button>' : '<span class="small muted">Tanpa lampiran</span>') +
      '<span>' + ic('clock', 'sm') + ' ' + F.jam(c.dibuat) + ' WIB</span></div></article>').join('') + '<div class="row-between"><span class="small muted">Menampilkan ' + rows.length + ' dari ' + L.length + ' catatan rapat</span>' + pagerHtml(L.length, st.page, st.per) + '</div>'
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
    if (a === 'excel') {
      const L = saring(); if (!L.length) return toast('Tidak ada catatan pada filter ini.', 'warn');
      unduhXlsx('Catatan-Rapat-PMB-' + (st.dari || 'awal') + '_' + (st.sampai || tglFile()) + '.xlsx', [{ nama: 'Catatan Rapat', aoa: [['No', 'Tanggal', 'Judul', 'Kategori', 'Isi Pembahasan', 'Keputusan / Tindak Lanjut', 'Status', 'Penanggung Jawab', 'Lampiran', 'Dibuat Oleh']]
        .concat(L.map((c, i) => [i + 1, c.tanggal, c.judul, c.kategori, c.isi, c.keputusan_tindak_lanjut, c.status_tindak_lanjut, c.penanggung_jawab, c.lampiran_nama || '-', nama(c.dibuat_oleh)])) }], 'Catatan Rapat');
    }
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
      '<div class="field"><label>Tanggal rapat *</label><input class="input tinted" type="date" data-i="tanggal" value="' + esc(c.tanggal || F.iso(new Date())) + '"></div>' +
      '<div class="field"><label>Judul catatan rapat *</label><input class="input tinted" data-i="judul" value="' + esc(c.judul || '') + '" placeholder="mis. Evaluasi Pendaftaran Gelombang 1"></div>' +
      '<div class="field"><label>Kategori</label><input class="input tinted" data-i="kategori" list="rKat" value="' + esc(c.kategori || '') + '" placeholder="Rapat Evaluasi"><datalist id="rKat">' + KATEGORI.map(k => '<option>' + k + '</option>').join('') + '</datalist></div>' +
      '<div class="field"><label>Isi pembahasan *</label><textarea class="textarea tinted" data-i="isi" rows="5">' + esc(c.isi || '') + '</textarea></div>' +
      '<div class="field"><label>Keputusan / tindak lanjut <span class="opt">poin terstruktur</span></label><textarea class="textarea tinted" data-i="keputusan_tindak_lanjut" rows="4" placeholder="1. …&#10;2. …">' + esc(c.keputusan_tindak_lanjut || '') + '</textarea></div>' +
      '<div class="form-grid"><div class="field"><label>Penanggung jawab *</label><div class="input-ico">' + ic('user') + '<input class="input tinted" data-i="penanggung_jawab" value="' + esc(c.penanggung_jawab || '') + '"></div></div>' +
      '<div class="field"><label>Status tindak lanjut</label><select class="select tinted" data-i="status_tindak_lanjut"><option ' + (c.status_tindak_lanjut !== 'Selesai' ? 'selected' : '') + '>Belum Terealisasi</option><option ' + (c.status_tindak_lanjut === 'Selesai' ? 'selected' : '') + '>Selesai</option></select></div></div>' +
      '<div class="field"><label>Lampiran file <span class="opt">opsional, maks. 5 MB</span></label><div data-dz></div><div data-pill class="mt8"></div></div>' +
      '<div class="callout mb16">' + ic('shield-check', 'sm') + '<div><b>Info kewenangan:</b> Tim PMB dapat mengubah/menghapus catatan buatannya sendiri. Admin memiliki akses penuh.</div></div>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" data-f="batal">Batal</button>' + (c.id && bolehUbah(c) ? '<button class="btn btn-danger" data-f="hapus">' + ic('trash-2') + 'Hapus</button>' : '') +
      '<button class="btn btn-primary" data-f="simpan">' + ic('check') + 'Simpan Catatan</button></div>';
    const pill = () => { const p = box.querySelector('[data-pill]');
      p.innerHTML = berkas ? '<div class="file-pill">' + ic('paperclip', 'sm') + '<span class="grow">' + esc(berkas.nama) + ' · ' + Math.round(berkas.ukuran / 1024) + ' KB</span><button class="btn btn-ghost btn-icon sm" data-rm aria-label="Batalkan lampiran">' + ic('x', 'sm') + '</button></div>'
        : c.lampiran_file_id && !hapusLamp ? '<div class="file-pill">' + ic('paperclip', 'sm') + '<span class="grow">' + esc(c.lampiran_nama) + '</span><button class="btn btn-ghost btn-icon sm" data-rm aria-label="Hapus lampiran">' + ic('x', 'sm') + '</button></div>' : '';
      const rm = p.querySelector('[data-rm]'); if (rm) rm.onclick = () => { if (berkas) berkas = null; else hapusLamp = true; pill(); }; };
    pill();
    dropzone(box.querySelector('[data-dz]'), { accept: 'image/*,application/pdf,.docx,.xlsx', info: 'Mendukung PDF, DOCX, XLSX, gambar (hingga 5 MB)' }, async f => { try { berkas = await bacaBerkas(f); hapusLamp = false; pill(); } catch (e) { toast(e.message, 'err'); } });
    box.querySelector('[data-f="batal"]').onclick = () => { if (m) m.close(); else isiForm(box, null, el); };
    const h = box.querySelector('[data-f="hapus"]'); if (h) h.onclick = async () => { if (await hapus(c)) { if (m) m.close(); else isiForm(box, null, el); } };
    box.querySelector('[data-f="simpan"]').onclick = async e => {
      const d = { id: c.id || '' }; $$('[data-i]', box).forEach(i => { d[i.dataset.i] = i.value; });
      if (!d.judul.trim() || !d.isi.trim() || !d.tanggal) return toast('Tanggal, judul, dan isi pembahasan wajib diisi.', 'warn');
      const payload = { rapat: d, hapusLampiran: hapusLamp }; if (berkas) payload.file = berkas;
      busy(e.currentTarget, true, berkas ? 'Mengunggah…' : 'Menyimpan…');
      const r = await api('rapatSimpan', payload, { timeout: 120000 });
      busy(box.querySelector('[data-f="simpan"]'), false); toast(r.message, r.success ? 'ok' : 'err');
      if (r.success) { if (m) m.close(); else isiForm(box, null, el); }
    };
  }
})();
