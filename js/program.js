/* program.js — Program PMB Hub + halaman per jenis (PRD F5) */
'use strict';
(function () {
  const st = { bulan: '', status: '', q: '', semua: false };
  const IKON = ['megaphone', 'school', 'printer', 'shapes', 'users-round', 'calendar-range', 'flag', 'layers'];
  const LBL_LOKASI = { iklan: 'Platform (mis. Instagram, Facebook)', kunjungan: 'Lokasi / sekolah mitra', cetak: 'Vendor / percetakan' };
  const jenisList = () => (App.data.meta || {}).jenis || [];
  const progList = () => App.data.program || [];
  const stBadge = s => '<span class="badge ' + ({ Berjalan: 'b-info', Selesai: 'b-ok', Direncanakan: 'b-warn' }[s] || 'b-mute') + '">' + esc(s) + '</span>';
  const rentang = p => F.tgl(p.tanggal_mulai) + (p.tanggal_selesai && p.tanggal_selesai !== p.tanggal_mulai ? ' – ' + F.tgl(p.tanggal_selesai) : '');

  registerPage('program', {
    title: 'Program PMB', deps: ['program', 'meta'],
    template: () => '<div data-r="isi"></div>',
    mount(el) {
      delegate(el, 'click', '[data-act]', b => aksi(b, el));
      delegate(el, 'click', '[data-status]', b => { st.status = b.dataset.status; Pages.program.render(el, Pages.program._param); });
      delegate(el, 'change', '[data-bulan]', s => { st.bulan = s.value; Pages.program.render(el, Pages.program._param); });
      el.addEventListener('input', debounce(e => { if (e.target.matches('[data-q]')) { st.q = e.target.value; renderTabel(el, Pages.program._param); } }, 250));
    },
    render(el, param) { const j = jenisList().find(x => x.id === param); if (param && j) detail(el, j); else hub(el); }
  });

  function hub(el) {
    const J = jenisList(), P = progList(), angg = J.reduce((a, j) => a + (Number(j.anggaran) || 0), 0), serap = P.reduce((a, p) => a + p.biaya, 0), admin = isAdmin();
    const terbaru = P.slice(0, st.semua ? 200 : 6);
    el.querySelector('[data-r="isi"]').innerHTML = pageHead({ pill: 'Direktori Kampanye', eyebrow: ['TA ' + (S().TAHUN_AKADEMIK || '')], title: 'Program PMB Hub',
      lead: 'Pantau seluruh kegiatan promosi penerimaan mahasiswa baru — iklan, kunjungan, cetak, dan lainnya — lengkap dengan biaya dan bukti.',
      actions: '<button class="btn btn-white" data-act="excel-semua">' + ic('download') + 'Unduh Laporan</button>' + (admin ? '<button class="btn btn-primary" data-act="jenis-baru">' + ic('plus') + 'Tambah Jenis Program <span class="admin-tag">ADMIN</span></button>' : '') }) +
      '<div class="stat-row"><div class="stat"><div class="ico">' + ic('wallet') + '</div><div><div class="lbl">Total anggaran alokasi</div><div class="val">' + F.rp(angg) + '</div></div></div>' +
      '<div class="stat"><div class="ico">' + ic('chart-pie') + '</div><div style="flex:1;min-width:0"><div class="lbl">Terserap (realisasi)</div><div class="val hero">' + F.rp(serap) + ' <small>' + F.pct(serap, angg) + '</small></div><div class="progress thin"><i style="width:' + Math.min(100, angg ? serap * 100 / angg : 0) + '%"></i></div></div></div>' +
      '<div class="stat"><div class="ico">' + ic('layers') + '</div><div><div class="lbl">Klaster program aktif</div><div class="val">' + J.length + ' klaster <small>' + P.length + ' kegiatan</small></div></div></div>' +
      '<div class="stat"><div class="ico">' + ic('shield-check') + '</div><div><div class="lbl">Status data</div><div class="val" style="font-size:16px">Sinkron ' + (App.lastSync ? F.rel(new Date(App.lastSync)) : '-') + '</div></div></div></div>' +
      '<div class="grid g4 mb22">' + J.map(j => { const k = P.filter(p => p.jenis === j.id), b = k.reduce((a, p) => a + p.biaya, 0);
        return '<div class="cat-card"><div class="row-between"><span class="badge b-peach plain">' + esc(j.label || 'Program') + '</span><span class="ci">' + ic(j.ikon || 'shapes') + '</span></div>' +
          '<h3>' + esc(j.nama) + '</h3><p class="desc clamp2">' + esc(j.deskripsi || '') + '</p><div class="figs"><div class="row-between">Total kegiatan <b>' + k.length + ' kegiatan</b></div>' +
          '<div class="row-between">Akumulasi biaya <b class="rp">' + F.rp(b) + '</b></div>' + (j.anggaran ? '<div class="progress thin"><i style="width:' + Math.min(100, b * 100 / j.anggaran) + '%"></i></div><div class="small">dari anggaran ' + F.rp(j.anggaran) + '</div>' : '') + '</div>' +
          '<div class="row mt8"><a class="btn btn-primary btn-sm" href="#/program/' + encodeURIComponent(j.id) + '" style="flex:1">Buka Hub ' + ic('arrow-right', 'sm') + '</a>' + (admin ? '<button class="btn btn-white btn-icon sm" data-act="jenis-edit" data-id="' + esc(j.id) + '" aria-label="Ubah jenis">' + ic('pencil', 'sm') + '</button>' : '') + '</div></div>'; }).join('') + '</div>' +
      '<div class="table-card"><div class="card-head" style="padding-bottom:14px"><div><h3>' + ic('history') + ' Aktivitas Program Terbaru</h3><p class="sub">Eksekusi anggaran riil yang terakhir dicatat tim PMB.</p></div>' +
      (P.length > 6 ? '<button class="btn btn-ghost btn-sm" data-act="semua">' + (st.semua ? 'Tampilkan ringkas' : 'Lihat semua (' + P.length + ')') + '</button>' : '') + '</div>' +
      (terbaru.length ? tabelProgram(terbaru, true) : emptyBox('megaphone', 'Belum ada kegiatan', 'Buka salah satu kategori lalu tambahkan kegiatan pertama.')) + '</div>';
  }
  function tabelProgram(rows, denganJenis) {
    const admin = true, J = {}; jenisList().forEach(j => { J[j.id] = j; });                 // v1.1: Admin & Tim PMB boleh ubah
    const hapusBtn = p => (isAdmin() || p.dibuat_oleh === App.user.username) ? '<button class="btn btn-ghost btn-icon sm" data-act="hapus" data-id="' + p.id + '" aria-label="Hapus">' + ic('trash-2', 'sm') + '</button>' : '';
    return '<div class="table-wrap desk-only"><table class="t"><thead><tr><th>Nama kegiatan / platform</th>' + (denganJenis ? '<th>Kategori</th>' : '') + '<th>Tanggal</th><th class="r">Biaya</th><th>Hasil / capaian</th><th>Status</th><th>Bukti</th>' + (admin ? '<th></th>' : '') + '</tr></thead><tbody>' +
      rows.map(p => '<tr><td><div class="nm">' + esc(p.nama_kegiatan) + '</div><div class="sm">' + esc(p.platform_atau_lokasi || '') + '</div></td>' + (denganJenis ? '<td><span class="badge b-peach plain">' + esc((J[p.jenis] || {}).label || p.jenis) + '</span></td>' : '') +
        '<td class="small">' + rentang(p) + '</td><td class="r bold">' + F.rp(p.biaya) + '</td><td class="small" style="max-width:240px">' + esc(p.hasil || '-') + '</td><td>' + stBadge(p.status_efektif) + '</td>' +
        '<td>' + (p.bukti_file_id ? '<button class="attach" data-act="bukti" data-id="' + esc(p.bukti_file_id) + '" data-nama="' + esc(p.bukti_nama) + '">' + ic(/pdf/.test(p.bukti_mime) ? 'file-text' : 'image', 'sm') + 'Lihat bukti</button>' : '<span class="muted small">Belum ada</span>') + '</td>' +
        (admin ? '<td class="r" style="white-space:nowrap"><button class="btn btn-ghost btn-icon sm" data-act="edit" data-id="' + p.id + '" aria-label="Ubah">' + ic('pencil', 'sm') + '</button>' + hapusBtn(p) + '</td>' : '') + '</tr>').join('') + '</tbody></table></div>' +
      '<div class="mlist" style="padding:0 12px 12px">' + rows.map(p => '<div class="mcard"><div class="top"><div><div class="nm" style="font-size:15px">' + esc(p.nama_kegiatan) + '</div><div class="sub">' + (denganJenis ? esc((J[p.jenis] || {}).label || '') + ' · ' : '') + rentang(p) + '</div></div>' + stBadge(p.status_efektif) + '</div>' +
        '<div class="kv"><div><span>Biaya</span><b>' + F.rp(p.biaya) + '</b></div><div><span>Platform / lokasi</span><b>' + esc(p.platform_atau_lokasi || '-') + '</b></div><div style="grid-column:1/-1"><span>Hasil</span><b>' + esc(p.hasil || '-') + '</b></div></div>' +
        '<div class="row">' + (p.bukti_file_id ? '<button class="attach" data-act="bukti" data-id="' + esc(p.bukti_file_id) + '" data-nama="' + esc(p.bukti_nama) + '">' + ic('eye', 'sm') + 'Bukti</button>' : '') +
        (admin ? '<span style="margin-left:auto"></span><button class="btn btn-ghost btn-icon sm" data-act="edit" data-id="' + p.id + '" aria-label="Ubah">' + ic('pencil', 'sm') + '</button>' + hapusBtn(p) : '') + '</div></div>').join('') + '</div>';
  }
  function saring(j) {
    const q = st.q.toLowerCase();
    return progList().filter(p => p.jenis === j.id && (!st.bulan || String(p.tanggal_mulai).slice(0, 7) === st.bulan) && (!st.status || p.status_efektif === st.status) &&
      (!q || (p.nama_kegiatan + ' ' + p.platform_atau_lokasi + ' ' + p.hasil).toLowerCase().indexOf(q) > -1));
  }
  function detail(el, j) {
    const semua = progList().filter(p => p.jenis === j.id), b = semua.reduce((a, p) => a + p.biaya, 0), admin = isAdmin();
    const bulan = Array.from(new Set(semua.map(p => String(p.tanggal_mulai).slice(0, 7)).filter(Boolean))).sort().reverse();
    const cnt = s => semua.filter(p => p.status_efektif === s).length;
    el.querySelector('[data-r="isi"]').innerHTML = '<a href="#/program" class="small" style="display:inline-flex;gap:6px;align-items:center;margin-bottom:12px">' + ic('arrow-left', 'sm') + 'Program PMB Hub</a>' +
      pageHead({ pill: j.label || 'Program', eyebrow: ['TA ' + (S().TAHUN_AKADEMIK || '')], title: j.nama, lead: j.deskripsi,
        actions: '<button class="btn btn-white" data-act="excel-jenis" data-id="' + esc(j.id) + '">' + ic('file-spreadsheet') + 'Unduh Excel</button>' + (true ? '<button class="btn btn-primary" data-act="baru" data-id="' + esc(j.id) + '">' + ic('plus') + 'Tambah Kegiatan</button>' : '') }) +
      '<div class="stat-row"><div class="stat"><div class="ico">' + ic(j.ikon || 'shapes') + '</div><div><div class="lbl">Jumlah kegiatan</div><div class="val">' + semua.length + '</div></div></div>' +
      '<div class="stat"><div class="ico">' + ic('wallet') + '</div><div style="flex:1"><div class="lbl">Total biaya</div><div class="val hero">' + F.rp(b) + '</div>' + (j.anggaran ? '<div class="small muted">' + F.pct(b, j.anggaran) + ' dari anggaran ' + F.rp(j.anggaran) + '</div>' : '') + '</div></div>' +
      '<div class="stat"><div class="ico">' + ic('play') + '</div><div><div class="lbl">Berjalan</div><div class="val">' + cnt('Berjalan') + '</div></div></div>' +
      '<div class="stat"><div class="ico">' + ic('circle-check') + '</div><div><div class="lbl">Selesai</div><div class="val">' + cnt('Selesai') + '</div></div></div></div>' +
      '<div class="filter-card"><div class="toolbar"><div class="input-ico grow">' + ic('search') + '<input class="input" data-q placeholder="Cari kegiatan, platform, hasil…" value="' + esc(st.q) + '"></div>' +
      '<select class="select" data-bulan style="width:auto" aria-label="Filter bulan"><option value="">Semua periode</option>' + bulan.map(x => '<option value="' + x + '" ' + (st.bulan === x ? 'selected' : '') + '>' + BLN_P[+x.slice(5, 7) - 1] + ' ' + x.slice(0, 4) + '</option>').join('') + '</select>' +
      '<div class="chips">' + [['', 'Semua'], ['Berjalan', 'Berjalan'], ['Selesai', 'Selesai'], ['Direncanakan', 'Direncanakan']].map(s => '<button class="chip ' + (st.status === s[0] ? 'on' : '') + '" data-status="' + s[0] + '">' + s[1] + '</button>').join('') + '</div></div></div>' +
      '<div class="table-card" data-r="tabel"></div>';
    renderTabel(el, j.id);
  }
  function renderTabel(el, jid) {
    const j = jenisList().find(x => x.id === jid), box = el.querySelector('[data-r="tabel"]'); if (!j || !box) return;
    const rows = saring(j);
    box.innerHTML = rows.length ? tabelProgram(rows, false) + '<div class="table-foot"><span>' + rows.length + ' kegiatan · total ' + F.rp(rows.reduce((a, p) => a + p.biaya, 0)) + '</span></div>'
      : emptyBox(j.ikon || 'shapes', 'Belum ada kegiatan', 'Tambahkan kegiatan ' + j.nama.toLowerCase() + ' beserta bukti pelaksanaannya.', true ? '<button class="btn btn-primary" data-act="baru" data-id="' + esc(j.id) + '">' + ic('plus') + 'Tambah Kegiatan</button>' : '');
  }
  async function aksi(b, el) {
    const a = b.dataset.act, id = b.dataset.id;
    if (a === 'semua') { st.semua = !st.semua; hub(el); }
    if (a === 'bukti') lihatBerkas(id, b.dataset.nama);
    if (a === 'baru') formKegiatan({ jenis: id });
    if (a === 'edit') formKegiatan(progList().find(p => p.id === id));
    if (a === 'jenis-baru') formJenis({});
    if (a === 'jenis-edit') formJenis(jenisList().find(x => x.id === id));
    if (a === 'hapus') {
      const p = progList().find(x => x.id === id);
      if (!(await confirmBox({ title: 'Hapus kegiatan?', pesan: '"' + p.nama_kegiatan + '" beserta berkas buktinya akan dihapus.', ok: 'Hapus', danger: true }))) return;
      const r = await api('programHapus', { id }); toast(r.message, r.success ? 'ok' : 'err');
    }
    if (a === 'excel-jenis' || a === 'excel-semua') {
      const J = a === 'excel-jenis' ? jenisList().filter(x => x.id === id) : jenisList(), KOL = ['No', 'Nama Kegiatan', 'Platform / Lokasi', 'Tanggal Mulai', 'Tanggal Selesai', 'Biaya', 'Hasil', 'Status', 'Catatan', 'Bukti (buka di aplikasi)', 'Bukti di Google Drive', 'Dibuat Oleh'];
      const dasar = (S().APP_URL ? S().APP_URL.replace(/\/?$/, '/') : location.href.split('#')[0]);
      const sheets = J.map(j => { const rows = progList().filter(p => p.jenis === j.id), links = [];
        rows.forEach((p, i) => { if (!p.bukti_file_id) return;
          links.push({ r: i + 1, c: 9, url: dasar + '#/bukti/' + encodeURIComponent(p.bukti_file_id), tip: 'Buka bukti di aplikasi (perlu login)' });
          links.push({ r: i + 1, c: 10, url: 'https://drive.google.com/file/d/' + p.bukti_file_id + '/view', tip: 'Buka di Google Drive (akun pemilik folder)' }); });
        return { nama: j.nama, links, aoa: [KOL].concat(rows.map((p, i) => [i + 1, p.nama_kegiatan, p.platform_atau_lokasi, p.tanggal_mulai, p.tanggal_selesai, p.biaya, p.hasil, p.status_efektif, p.catatan,
          p.bukti_file_id ? '🔗 Lihat bukti — ' + (p.bukti_nama || 'berkas') : '-', p.bukti_file_id ? '🔗 Google Drive' : '-', p.dibuat_oleh]),
          [[], ['', 'TOTAL', '', '', '', rows.reduce((s, p) => s + p.biaya, 0)], ['', 'ANGGARAN', '', '', '', Number(j.anggaran) || 0]]) }; });
      unduhXlsx('Laporan-Program-PMB-' + (a === 'excel-jenis' ? id + '-' : '') + tglFile() + '.xlsx', sheets, 'Laporan Program PMB');
    }
  }
  function formKegiatan(p) {
    p = p || {}; let berkas = null, hapusBukti = false;
    const J = jenisList(), j = J.find(x => x.id === p.jenis) || J[0] || {};
    const m = modal({ title: p.id ? 'Ubah kegiatan' : 'Tambah kegiatan', sub: esc(j.nama || ''), size: 'wide',
      body: '<div class="form-grid"><div class="field"><label>Jenis program</label><select class="select" id="kJ">' + J.map(x => '<option value="' + esc(x.id) + '" ' + (x.id === j.id ? 'selected' : '') + '>' + esc(x.nama) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Nama kegiatan *</label><input class="input" id="kN" value="' + esc(p.nama_kegiatan || '') + '" placeholder="mis. Meta Ads Kampanye Gelombang 1"></div>' +
        '<div class="field"><label id="kLL">' + esc(LBL_LOKASI[j.id] || 'Platform / lokasi') + '</label><input class="input" id="kL" value="' + esc(p.platform_atau_lokasi || '') + '"></div>' +
        '<div class="field"><label>Biaya (Rp)</label><input class="input" id="kB" inputmode="numeric" value="' + (p.biaya ? F.n(p.biaya) : '') + '" placeholder="1.500.000"></div>' +
        '<div class="field"><label>Tanggal mulai *</label><input class="input" type="date" id="kM" value="' + esc(p.tanggal_mulai || F.iso(new Date())) + '"></div>' +
        '<div class="field"><label>Tanggal selesai <span class="opt">kosongkan bila 1 hari</span></label><input class="input" type="date" id="kS" value="' + esc(p.tanggal_selesai || '') + '"></div>' +
        '<div class="field"><label>Hasil / capaian <span class="opt">' + esc(j.label_hasil || '') + '</span></label><input class="input" id="kH" value="' + esc(p.hasil || '') + '" placeholder="mis. 12.450 impresi, 84 pendaftar"></div>' +
        '<div class="field"><label>Status</label><select class="select" id="kSt">' + [['', 'Otomatis dari tanggal'], ['Direncanakan', 'Direncanakan'], ['Berjalan', 'Berjalan'], ['Selesai', 'Selesai']].map(o => '<option value="' + o[0] + '" ' + ((p.status || '') === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div></div>' +
        '<div class="field"><label>Catatan</label><textarea class="textarea" id="kC" rows="2">' + esc(p.catatan || '') + '</textarea></div>' +
        '<div class="field"><label>Bukti kegiatan <span class="opt">foto / tangkapan layar / PDF, maks. 5 MB — gambar dikompres otomatis</span></label><div id="kBukti"></div><div id="kDz"></div></div>',
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" id="kOk">' + ic('check') + 'Simpan Kegiatan</button>' });
    const pill = () => { $('#kBukti').innerHTML = berkas ? '<div class="file-pill">' + ic('paperclip', 'sm') + '<span class="grow">' + esc(berkas.nama) + ' · ' + Math.round(berkas.ukuran / 1024) + ' KB (baru)</span><button class="btn btn-ghost btn-icon sm" data-rm aria-label="Batalkan">' + ic('x', 'sm') + '</button></div>'
      : (p.bukti_file_id && !hapusBukti ? '<div class="file-pill">' + ic('paperclip', 'sm') + '<span class="grow">' + esc(p.bukti_nama) + '</span><button class="btn btn-ghost btn-icon sm" data-rm aria-label="Hapus bukti">' + ic('x', 'sm') + '</button></div>' : '');
      const rm = $('#kBukti [data-rm]'); if (rm) rm.onclick = () => { if (berkas) berkas = null; else hapusBukti = true; pill(); }; };
    pill();
    dropzone($('#kDz'), { accept: 'image/*,application/pdf', info: 'JPG, PNG, WEBP, atau PDF' }, async f => { try { berkas = await bacaBerkas(f); hapusBukti = false; pill(); } catch (e) { toast(e.message, 'err'); } });
    $('#kJ').onchange = e => { $('#kLL').textContent = LBL_LOKASI[e.target.value] || 'Platform / lokasi'; };
    $('#kB').addEventListener('input', e => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d ? Number(d).toLocaleString('id-ID') : ''; });
    $('#kOk').onclick = async () => {
      const data = { program: { id: p.id || '', jenis: $('#kJ').value, nama_kegiatan: $('#kN').value, platform_atau_lokasi: $('#kL').value, biaya: $('#kB').value.replace(/\D/g, ''),
        tanggal_mulai: $('#kM').value, tanggal_selesai: $('#kS').value, hasil: $('#kH').value, status: $('#kSt').value, catatan: $('#kC').value }, hapusBukti };
      if (!data.program.nama_kegiatan.trim()) return toast('Nama kegiatan wajib diisi.', 'warn');
      if (berkas) data.file = berkas;
      busy($('#kOk'), true, berkas ? 'Mengunggah…' : 'Menyimpan…');
      const r = await api('programSimpan', data, { timeout: 120000 });
      busy($('#kOk'), false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close();
    };
  }
  function formJenis(j) {
    j = j || {};
    const m = modal({ title: j.id ? 'Ubah jenis program' : 'Tambah jenis program', size: 'narrow',
      body: '<div class="field"><label>Nama jenis *</label><input class="input" id="jN" value="' + esc(j.nama || '') + '" placeholder="mis. Expo Pendidikan"></div>' +
        '<div class="field"><label>Label kategori</label><input class="input" id="jL" value="' + esc(j.label || '') + '" placeholder="mis. Event"></div>' +
        '<div class="field"><label>Deskripsi</label><textarea class="textarea" id="jD" rows="2">' + esc(j.deskripsi || '') + '</textarea></div>' +
        '<div class="field"><label>Ikon</label><div class="chips" id="jI">' + IKON.map(n => '<button type="button" class="chip ' + ((j.ikon || 'shapes') === n ? 'on' : '') + '" data-ik="' + n + '" aria-label="' + n + '">' + ic(n, 'sm') + '</button>').join('') + '</div></div>' +
        '<div class="form-grid"><div class="field"><label>Anggaran (Rp)</label><input class="input" id="jA" inputmode="numeric" value="' + (j.anggaran ? F.n(j.anggaran) : '') + '"></div>' +
        '<div class="field"><label>Label kolom hasil</label><input class="input" id="jH" value="' + esc(j.label_hasil || 'Hasil') + '"></div></div>',
      foot: (j.id ? '<button class="btn btn-danger" id="jDel">' + ic('trash-2') + 'Nonaktifkan</button>' : '') + '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" id="jOk">Simpan</button>' });
    let ikon = j.ikon || 'shapes';
    delegate(m.el, 'click', '[data-ik]', b => { ikon = b.dataset.ik; $$('[data-ik]', m.el).forEach(x => x.classList.toggle('on', x === b)); });
    $('#jA').addEventListener('input', e => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d ? Number(d).toLocaleString('id-ID') : ''; });
    $('#jOk').onclick = async () => { busy($('#jOk'), true); const r = await api('jenisSimpan', { jenis: { id: j.id || '', nama: $('#jN').value, label: $('#jL').value, deskripsi: $('#jD').value, ikon, anggaran: $('#jA').value.replace(/\D/g, ''), label_hasil: $('#jH').value } });
      busy($('#jOk'), false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close(); };
    if (j.id) $('#jDel').onclick = async () => { const r = await api('jenisHapus', { id: j.id }); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { m.close(); go('program'); } };
  }
})();

/* ===== v1.1 — halaman bukti (tujuan tautan di Excel): #/bukti/<id berkas> ===== */
registerPage('bukti', {
  title: 'Bukti Kegiatan', deps: [],
  template: () => '<div data-r="isi"></div>',
  async render(el, id) {
    const box = el.querySelector('[data-r="isi"]'), p = (App.data.program || []).find(x => x.bukti_file_id === id);
    box.innerHTML = '<a href="#/program' + (p ? '/' + encodeURIComponent(p.jenis) : '') + '" class="small" style="display:inline-flex;gap:6px;align-items:center;margin-bottom:12px">' + ic('arrow-left', 'sm') + 'Kembali ke Program PMB</a>' +
      pageHead({ pill: 'Bukti kegiatan', title: p ? p.nama_kegiatan : 'Bukti kegiatan', lead: p ? [p.platform_atau_lokasi, F.tgl(p.tanggal_mulai), F.rp(p.biaya), p.hasil].filter(Boolean).join(' · ') : '' }) +
      '<div class="card card-pad" data-r="berkas"><div class="empty"><span class="spin"></span><div>Memuat bukti…</div></div></div>';
    const r = await api('berkasAmbil', { id }), b = box.querySelector('[data-r="berkas"]');
    if (!r.success) { b.innerHTML = '<div class="callout bad">' + ic('circle-x') + esc(r.message) + '</div>'; return; }
    const d = r.data, url = URL.createObjectURL(b64Blob(d.base64, d.mime));
    b.innerHTML = (/^image\//.test(d.mime) ? '<img class="preview-img" src="' + url + '" alt="' + esc(d.nama) + '">' : d.mime === 'application/pdf' ? '<iframe class="preview-pdf" src="' + url + '" title="' + esc(d.nama) + '"></iframe>' : '<div class="callout info">' + ic('info') + 'Pratinjau tidak tersedia untuk jenis berkas ini.</div>') +
      '<div class="row mt16"><span class="small muted">' + esc(d.nama) + '</span><button class="btn btn-soft btn-sm" style="margin-left:auto" data-unduh>' + ic('download', 'sm') + 'Unduh</button></div>';
    b.querySelector('[data-unduh]').onclick = () => unduhB64(d.nama, d.mime, d.base64);
  }
});
