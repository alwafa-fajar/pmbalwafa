/* kontak.js — CRM Kontak (skill gas-notifikasi-wa-crm): Nama · Email · WhatsApp */
'use strict';
(function () {
  const st = { q: '', segmen: '', statusWA: '', optOut: '', dup: false, masalah: false, tag: '', halaman: 1, sel: new Set(), data: null, memuat: false };
  const cacheQ = new Map();

  registerPage('kontak', {
    title: 'CRM Kontak', roles: ['ADMIN'], deps: [],
    template: () => '<div data-r="head"></div><div class="stat-row" data-r="kpi"></div><div class="filter-card" data-r="filter"></div><div data-r="list"></div><div data-r="bulk"></div>',
    mount(el) {
      delegate(el, 'click', '[data-act]', b => aksi(el, b));
      delegate(el, 'click', '[data-kpi]', b => { const k = b.dataset.kpi; Object.assign(st, { statusWA: '', optOut: '', dup: false, masalah: false });
        if (k === 'wa') st.statusWA = 'Terdaftar'; if (k === 'belum') st.statusWA = 'belum'; if (k === 'opt') st.optOut = 'ya'; if (k === 'dup') st.dup = true; if (k === 'masalah') st.masalah = true; st.halaman = 1; muat(el); });
      delegate(el, 'click', '[data-seg]', b => { st.segmen = st.segmen === b.dataset.seg ? '' : b.dataset.seg; st.halaman = 1; muat(el); });
      delegate(el, 'click', '[data-page]', b => { if (!b.disabled) { st.halaman = +b.dataset.page; muat(el); } });
      delegate(el, 'change', '[data-f]', s => { st[s.dataset.f] = s.value; st.halaman = 1; muat(el); });
      delegate(el, 'change', '[data-cek]', c => { c.checked ? st.sel.add(c.dataset.cek) : st.sel.delete(c.dataset.cek); renderBulk(el); });
      delegate(el, 'change', '[data-cekall]', c => { (st.data ? st.data.rows : []).forEach(k => c.checked ? st.sel.add(k.id) : st.sel.delete(k.id)); renderList(el); renderBulk(el); });
      delegate(el, 'click', '[data-detail]', b => detail(el, b.dataset.detail));
      el.addEventListener('input', debounce(e => { if (e.target.matches('[data-q]')) { st.q = e.target.value; st.halaman = 1; muat(el); } }, 350));
    },
    render(el) {
      el.querySelector('[data-r="head"]').innerHTML = pageHead({ pill: 'CRM Kontak', eyebrow: ['Nama · Email · WhatsApp'], title: 'Kontak & Status WhatsApp',
        lead: 'Satu layar untuk memantau kualitas kontak pendaftar: nomor valid, terdaftar WhatsApp, opt-out, duplikat, dan riwayat dihubungi.',
        actions: '<button class="btn btn-white" data-act="sync">' + ic('refresh-cw') + 'Sinkron sekarang</button><button class="btn btn-white" data-act="impor">' + ic('import') + 'Impor CSV</button><button class="btn btn-soft" data-act="ekspor">' + ic('download') + 'Ekspor Excel</button>' });
      if (!st.data) muat(el); else { renderKpi(el); renderFilter(el); renderList(el); renderBulk(el); }
    }
  });
  const kunci = () => JSON.stringify([st.q, st.segmen, st.statusWA, st.optOut, st.dup, st.masalah, st.tag, st.halaman]);
  async function muat(el, paksa) {
    const k = kunci();
    if (cacheQ.has(k) && !paksa) { st.data = cacheQ.get(k); renderKpi(el); renderFilter(el); renderList(el); }
    else if (!st.data) el.querySelector('[data-r="list"]').innerHTML = '<div class="card">' + emptyBox('contact', 'Memuat kontak…', 'Menyinkronkan dari data pendaftar bila perlu.') + '</div>';
    const r = await api('crmList', { cari: st.q, segmen: st.segmen, statusWA: st.statusWA, optOut: st.optOut, dup: st.dup, masalah: st.masalah, tag: st.tag, halaman: st.halaman, per: 50 });
    if (!r.success) return toast(r.message, 'err');
    if (k !== kunci()) return;                       // pengguna sudah mengubah filter
    cacheQ.set(k, r.data); st.data = r.data;
    renderKpi(el); renderFilter(el); renderList(el); renderBulk(el);
  }
  function renderKpi(el) {
    const s = st.data.stats, on = (x) => (x === 'wa' && st.statusWA === 'Terdaftar') || (x === 'belum' && st.statusWA === 'belum') || (x === 'opt' && st.optOut === 'ya') || (x === 'dup' && st.dup) || (x === 'masalah' && st.masalah);
    el.querySelector('[data-r="kpi"]').innerHTML = [['semua', 'Total kontak', 'contact', s.total], ['wa', 'WA terverifikasi', 'badge-check', s.waTerdaftar], ['belum', 'Belum dicek WA', 'circle-dashed', s.belumCek],
      ['opt', 'Opt-out', 'ban', s.optOut], ['dup', 'Duplikat nomor', 'git-merge', s.duplikat], ['masalah', 'Tanpa kontak valid', 'triangle-alert', s.tanpaKontak]]
      .map(k => '<button class="stat clickable ' + (on(k[0]) ? 'on' : '') + '" data-kpi="' + k[0] + '" style="text-align:left"><div class="ico">' + ic(k[2]) + '</div><div><div class="lbl">' + k[1] + '</div><div class="val">' + F.n(k[3]) + '</div></div></button>').join('');
  }
  function renderFilter(el) {
    const f = st.data.facet;
    el.querySelector('[data-r="filter"]').innerHTML = '<div class="chips mb16"><span class="chip-row-label">Segmen:</span>' + Object.keys(f.segmen).sort().map(s => '<button class="chip ' + (st.segmen === s ? 'on' : '') + '" data-seg="' + esc(s) + '">' + esc(s) + ' <span class="n">' + f.segmen[s] + '</span></button>').join('') + '</div>' +
      '<div class="toolbar"><div class="input-ico grow">' + ic('search') + '<input class="input" data-q placeholder="Cari nama, nomor, email, tag…" value="' + esc(st.q) + '"></div>' +
      '<select class="select" data-f="statusWA" style="width:auto"><option value="">Semua status WA</option>' + [['Terdaftar', 'Terdaftar WA'], ['Tidak Terdaftar', 'Bukan WA'], ['belum', 'Belum dicek']].map(o => '<option value="' + o[0] + '" ' + (st.statusWA === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<select class="select" data-f="tag" style="width:auto"><option value="">Semua tag</option>' + Object.keys(f.tag).sort().map(t => '<option ' + (st.tag === t ? 'selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' +
      '<span class="small muted">' + (st.data.syncTerakhir ? 'Sinkron ' + F.rel(new Date(st.data.syncTerakhir)) : '') + '</span></div>';
  }
  function renderList(el) {
    const d = st.data, box = el.querySelector('[data-r="list"]');
    if (!d.rows.length) { box.innerHTML = '<div class="card">' + emptyBox('contact', 'Tidak ada kontak', 'Ubah filter, atau tempel data pendaftar lalu tekan Sinkron sekarang.') + '</div>'; return; }
    const wa = k => k.validWA ? '<a class="hp" href="' + waLink(k.no_wa) + '" target="_blank" rel="noopener">' + esc(fmtHp(k.no_wa)) + '</a> ' + (waBadge(k.status_wa) || '<span class="badge b-mute plain">? belum dicek</span>') : '<span class="badge b-bad plain">' + esc(k.no_wa || 'tanpa nomor') + '</span>';
    box.innerHTML = '<div class="table-card"><div class="table-wrap desk-only"><table class="t"><thead><tr><th class="c"><label class="check"><input type="checkbox" data-cekall aria-label="Pilih semua"></label></th><th>Nama & segmen</th><th>WhatsApp</th><th>Email</th><th>Tag</th><th>Terakhir dihubungi</th><th class="r">Pesan</th><th></th></tr></thead><tbody>' +
      d.rows.map(k => '<tr class="' + (st.sel.has(k.id) ? 'sel' : '') + (!k.validWA || k.dup ? ' warn' : '') + '"><td class="c"><label class="check"><input type="checkbox" data-cek="' + k.id + '" ' + (st.sel.has(k.id) ? 'checked' : '') + '></label></td>' +
        '<td><div class="person"><span class="avatar sm soft">' + esc(F.inisial(k.nama)) + '</span><div><div class="nm">' + esc(k.nama) + (k.opt_out ? ' <span class="badge b-bad plain">opt-out</span>' : '') + (k.dup ? ' <span class="badge b-warn plain">duplikat</span>' : '') + '</div><div class="sm">' + esc(k.segmen) + (k.info && k.info.prodi ? ' · ' + esc(k.info.prodi) : '') + (k.info && k.info.respon && k.info.respon !== '-' ? ' · ' + esc(k.info.respon) : '') + '</div></div></div></td>' +
        '<td>' + wa(k) + '</td><td class="small">' + (k.email ? esc(k.email) : '<span class="muted">—</span>') + '</td><td>' + String(k.tag || '').split(',').filter(t => t.trim()).map(t => '<span class="tag-mini">' + esc(t.trim()) + '</span>').join(' ') + '</td>' +
        '<td class="small">' + (k.terakhir ? F.rel(k.terakhir) : '—') + '</td><td class="r">' + k.jumlah_pesan + '</td><td><button class="btn btn-ghost btn-sm" data-detail="' + k.id + '">Detail</button></td></tr>').join('') + '</tbody></table></div>' +
      '<div class="mlist" style="padding:12px">' + d.rows.map(k => '<div class="mcard"><div class="top"><label class="check"><input type="checkbox" data-cek="' + k.id + '" ' + (st.sel.has(k.id) ? 'checked' : '') + '></label><div style="flex:1;min-width:0" data-detail="' + k.id + '"><div class="nm" style="font-size:15px">' + esc(k.nama) + '</div><div class="sub">' + esc(k.segmen) + '</div></div>' +
        (k.validWA ? '<a class="round-btn wa" href="' + waLink(k.no_wa) + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + ic('message-circle', 'sm') + '</a>' : '') + '</div><div class="mt8">' + wa(k) + (k.opt_out ? ' <span class="badge b-bad plain">opt-out</span>' : '') + '</div></div>').join('') + '</div>' +
      '<div class="table-foot"><span>' + F.n(d.total) + ' kontak · halaman ' + d.halaman + '</span>' + pagerHtml(d.total, d.halaman, d.per) + '</div></div>';
  }
  function renderBulk(el) {
    const n = st.sel.size;
    el.querySelector('[data-r="bulk"]').innerHTML = n ? '<div class="bulkbar"><b>' + n + ' kontak dipilih</b><button class="btn btn-soft btn-sm" data-act="deteksi">' + ic('scan-line', 'sm') + 'Deteksi WA</button><button class="btn btn-soft btn-sm" data-act="tag">' + ic('tag', 'sm') + 'Beri tag</button>' +
      '<button class="btn btn-soft btn-sm" data-act="blast">' + ic('send', 'sm') + 'Blast ke terpilih</button><button class="btn btn-soft btn-sm" data-act="optout">' + ic('ban', 'sm') + 'Opt-out</button><button class="btn btn-soft btn-sm" data-act="optin">Opt-in</button>' +
      '<button class="btn btn-danger btn-sm" data-act="hapus">Hapus (manual)</button><button class="btn btn-ghost btn-sm" style="color:#fff" data-act="batal">Batal</button></div>' : '';
  }
  const terpilih = () => (st.data ? st.data.rows : []).filter(k => st.sel.has(k.id));
  async function bulk(el, aksiB, nilai) {
    const r = await api('crmBulk', { ids: Array.from(st.sel), aksi: aksiB, nilai });
    toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { cacheQ.clear(); st.sel.clear(); muat(el, true); renderBulk(el); }
  }
  async function aksi(el, b) {
    const a = b.dataset.act;
    if (a === 'batal') { st.sel.clear(); renderList(el); renderBulk(el); }
    if (a === 'sync') { busy(b, true, 'Sinkron…'); const r = await api('crmSync', {}); busy(b, false); toast(r.message, r.success ? 'ok' : 'err'); cacheQ.clear(); muat(el, true); }
    if (a === 'optout' || a === 'optin') bulk(el, a);
    if (a === 'hapus') { if (await confirmBox({ title: 'Hapus kontak manual?', pesan: 'Hanya kontak hasil impor manual yang dihapus. Kontak pendaftar tidak terhapus (ikuti data pendaftar).', ok: 'Hapus', danger: true })) bulk(el, 'hapusManual'); }
    if (a === 'tag') { const t = await confirmBox({ title: 'Beri tag', alasan: 'Nama tag (mis. Prioritas, Sekolah Mitra)', ok: 'Terapkan' }); if (t) bulk(el, 'tag', t); }
    if (a === 'blast') { App.prefill.blast = { kontak: terpilih(), respon: 'Umum' }; go('blast'); }
    if (a === 'deteksi') {
      const nomor = Array.from(new Set(terpilih().filter(k => k.validWA).map(k => k.no_wa))); if (!nomor.length) return toast('Tidak ada nomor valid di pilihan.', 'warn');
      let cek = 0, gagal = '';
      for (let i = 0; i < nomor.length; i += 50) { b.innerHTML = '<span class="spin sm"></span> Mengecek ' + Math.min(i + 50, nomor.length) + '/' + nomor.length; const r = await api('waValidasi', { nomor: nomor.slice(i, i + 50) }); if (!r.success) { gagal = r.message; break; } cek += r.data.dicek; }
      toast(gagal || cek + ' nomor dicek.', gagal ? 'err' : 'ok'); cacheQ.clear(); st.sel.clear(); muat(el, true); renderBulk(el);
    }
    if (a === 'ekspor') {
      busy(b, true, 'Menyiapkan…'); const r = await api('crmEkspor', { cari: st.q, segmen: st.segmen, statusWA: st.statusWA, optOut: st.optOut, dup: st.dup, masalah: st.masalah, tag: st.tag }); busy(b, false);
      if (!r.success) return toast(r.message, 'err');
      unduhXlsx('CRM-Kontak-' + tglFile() + '.xlsx', [{ nama: 'Kontak', aoa: [['Nama', 'No WA', 'Email', 'Segmen', 'Sumber', 'Status WA', 'Opt-out', 'Tag', 'Jumlah Pesan', 'Terakhir Dihubungi', 'Prodi', 'Jalur', 'Respon', 'Catatan']]
        .concat(r.data.map(k => [k.nama, k.no_wa, k.email, k.segmen, k.sumber, k.status_wa, k.opt_out ? 'YA' : 'TIDAK', k.tag, k.jumlah_pesan, k.terakhir ? F.tglJam(k.terakhir) : '', (k.info || {}).prodi || '', (k.info || {}).jalur || '', (k.info || {}).respon || '', k.catatan])) }], 'Ekspor CRM');
    }
    if (a === 'impor') impor(el);
  }
  function impor(el) {
    const m = modal({ title: 'Impor kontak manual', sub: 'Untuk kontak di luar data pendaftar: guru BK sekolah mitra, peserta expo, alumni.', size: 'wide',
      body: '<div class="field"><label>Tempel CSV / dari Excel <span class="opt">kolom: nama, wa, email, segmen, tag</span></label><textarea class="textarea paste-area" id="iT" placeholder="nama,wa,email,segmen,tag&#10;Ust. Zaid,081311112222,,Sekolah Mitra,Jabar"></textarea></div>' +
        '<div class="row"><button class="btn btn-ghost btn-sm" id="iTpl">' + ic('download', 'sm') + 'Unduh templat CSV</button><input type="file" accept=".csv,text/csv" id="iF" hidden><button class="btn btn-ghost btn-sm" id="iFb">' + ic('cloud-upload', 'sm') + 'Pilih berkas .csv</button></div>',
      foot: '<button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" id="iOk">Impor</button>' });
    $('#iTpl').onclick = () => { const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('nama,wa,email,segmen,tag\nUst. Zaid,081311112222,zaid@contoh.sch.id,Sekolah Mitra,Jabar\n'); a.download = 'templat-kontak.csv'; a.click(); };
    $('#iFb').onclick = () => $('#iF').click();
    $('#iF').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#iT').value = r.result; }; r.readAsText(f); };
    $('#iOk').onclick = async () => {
      const rows = window.MhsTempel.parseTabel($('#iT').value); if (rows.length < 2) return toast('Minimal satu baris data di bawah judul kolom.', 'warn');
      const h = rows[0].map(x => x.toLowerCase().replace(/[^a-z]/g, '')), idx = n => h.findIndex(x => n.indexOf(x) > -1);
      const iN = idx(['nama', 'name']), iW = idx(['wa', 'nowa', 'hp', 'nohp', 'whatsapp', 'telepon']), iE = idx(['email']), iS = idx(['segmen']), iG = idx(['tag']);
      if (iN < 0 || iW < 0) return toast('Kolom nama dan wa wajib ada di judul.', 'warn');
      busy($('#iOk'), true, 'Mengimpor…');
      const r = await api('crmImport', { rows: rows.slice(1).map(x => ({ nama: x[iN], wa: x[iW], email: iE > -1 ? x[iE] : '', segmen: iS > -1 ? x[iS] : '', tag: iG > -1 ? x[iG] : '' })) });
      busy($('#iOk'), false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { m.close(); cacheQ.clear(); muat(el, true); }
    };
  }
  async function detail(el, id) {
    const m = modal({ drawer: true, title: 'Detail kontak', body: '<div class="empty"><span class="spin"></span></div>' });
    const r = await api('crmDetail', { id }); if (!r.success) { m.el.querySelector('.modal-body').innerHTML = '<div class="callout bad">' + esc(r.message) + '</div>'; return; }
    const k = r.data.kontak, manual = k.sumber === 'manual';
    m.el.querySelector('.modal-head h3').textContent = k.nama;
    m.el.querySelector('.modal-body').innerHTML = '<div class="row mb16">' + (k.validWA ? '<a class="btn btn-ok btn-sm" href="' + waLink(k.no_wa) + '" target="_blank" rel="noopener">' + ic('message-circle', 'sm') + 'WhatsApp</a><a class="btn btn-white btn-sm" href="tel:' + k.no_wa + '">' + ic('phone', 'sm') + 'Telepon</a><button class="btn btn-ghost btn-sm" id="kSalin">' + ic('copy', 'sm') + 'Salin nomor</button>' : '') + '</div>' +
      '<dl class="kv-list mb16"><dt>Segmen</dt><dd>' + esc(k.segmen) + '</dd><dt>Sumber</dt><dd>' + (manual ? 'Impor manual' : 'Data pendaftar (ubah lewat tempel data)') + '</dd><dt>Status WA</dt><dd>' + esc(k.status_wa || 'Belum dicek') + '</dd><dt>Pesan terkirim</dt><dd>' + k.jumlah_pesan + '</dd>' +
      (k.info && k.info.prodi ? '<dt>Prodi / jalur</dt><dd>' + esc(k.info.prodi + ' · ' + k.info.jalur) + '</dd><dt>Respon</dt><dd>' + esc(k.info.respon || '-') + '</dd>' : '') + '</dl>' +
      (manual ? '<div class="form-grid"><div class="field"><label>Nama</label><input class="input" id="kNm" value="' + esc(k.nama) + '"></div><div class="field"><label>No WA</label><input class="input" id="kWa" value="' + esc(k.no_wa) + '"></div></div><div class="field"><label>Email</label><input class="input" id="kEm" value="' + esc(k.email || '') + '"></div>' : '') +
      '<div class="field"><label>Tag <span class="opt">pisahkan koma</span></label><input class="input" id="kTag" value="' + esc(k.tag || '') + '"></div>' +
      '<div class="field"><label>Catatan</label><textarea class="textarea" id="kCat" rows="2">' + esc(k.catatan || '') + '</textarea></div>' +
      '<label class="check mb16"><span class="switch"><input type="checkbox" id="kOpt" ' + (k.opt_out ? 'checked' : '') + '></span> Opt-out — jangan pernah sertakan di blast</label>' +
      '<button class="btn btn-primary btn-block mb22" id="kSave">Simpan kontak</button>' +
      '<div class="flabel mb8">Catat interaksi</div><div class="row mb16"><select class="select" id="kKan" style="width:auto"><option>Telepon</option><option>WA Manual</option><option>Kunjungan</option><option>Catatan</option></select><input class="input" id="kRing" placeholder="Ringkasan…" style="flex:1"><button class="btn btn-soft" id="kInt">Catat</button></div>' +
      '<div class="flabel mb8">Linimasa</div><div class="timeline">' + (r.data.timeline.length ? r.data.timeline.map(t => '<div class="tl"><span class="tdot">' + ic(t.kanal === 'WA' ? 'message-circle' : t.kanal === 'Telepon' ? 'phone' : 'notebook-pen', 'sm') + '</span><div><div class="tm">' + F.tglJam(t.waktu) + ' · ' + esc(t.kanal) + (t.status ? ' · ' + esc(t.status) : '') + (t.oleh ? ' · ' + esc(t.oleh) : '') + '</div><div>' + esc(t.ringkasan) + '</div></div></div>').join('') : '<p class="small muted">Belum ada interaksi.</p>') + '</div>';
    const sl = $('#kSalin'); if (sl) sl.onclick = () => salin(k.no_wa);
    $('#kSave').onclick = async () => { const kontak = { id: k.id, tag: $('#kTag').value, catatan: $('#kCat').value, opt_out: $('#kOpt').checked };
      if (manual) Object.assign(kontak, { nama: $('#kNm').value, no_wa: $('#kWa').value, email: $('#kEm').value });
      busy($('#kSave'), true); const x = await api('crmSimpan', { kontak }); busy($('#kSave'), false); toast(x.message, x.success ? 'ok' : 'err'); if (x.success) { m.close(); cacheQ.clear(); muat(el, true); } };
    $('#kInt').onclick = async () => { const x = await api('crmInteraksi', { kontakId: k.id, kanal: $('#kKan').value, ringkasan: $('#kRing').value }); toast(x.message, x.success ? 'ok' : 'err'); if (x.success) { m.close(); detail(el, id); } };
  }
  on('data', n => { if (n.indexOf('pendaftar') > -1 || n.indexOf('wa') > -1) cacheQ.clear(); });
})();
