/* mahasiswa.js — Data Mahasiswa: tempel, pisah otomatis, cari, filter, respon (PRD F3, F4) */
'use strict';
(function () {
  const st = { jalur: 'Semua', prodi: 'Semua', q: '', respon: '', bayar: '', adv: {}, page: 1, per: 20, sel: new Set() };
  const RESPON_OPS = [['', 'Semua Respon'], ['Belum Tes', 'Belum Tes'], ['Belum Daftar Ulang', 'Belum Daftar Ulang'], ['Mengundurkan Diri', 'Mengundurkan Diri'], ['-', 'Tuntas (tanpa tindak lanjut)']];
  const BAYAR_OPS = [['', 'Semua Status Pembayaran'], ['lunas', 'Lunas UKT'], ['ukt', 'Sudah bayar UKT'], ['cicil', 'Cicil UKT'], ['pangkal', 'Uang pangkal'], ['belum', 'Belum bayar'], ['undur', 'Undur diri / tidak lolos']];

  registerPage('mahasiswa', {
    title: 'Data Mahasiswa', deps: ['pendaftar', 'meta'],
    template: () => '<div data-r="head"></div><div class="utabs mb16" data-r="tabs"></div><div class="filter-card" data-r="filters"></div>' +
      '<div class="filter-card" data-r="tool"></div><div data-r="list"></div><div data-r="bulk"></div><div data-r="danger"></div>',
    mount(el) {
      delegate(el, 'click', '[data-jalur]', b => { st.jalur = b.dataset.jalur; st.page = 1; st.sel.clear(); Pages.mahasiswa.render(el); });
      delegate(el, 'click', '[data-prodi]', b => { st.prodi = b.dataset.prodi; st.page = 1; st.sel.clear(); Pages.mahasiswa.render(el); });
      delegate(el, 'click', '[data-pg]', b => { if (b.disabled) return; st.page = +b.dataset.pg; renderList(el); el.querySelector('[data-r="tool"]').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      delegate(el, 'click', '[data-act]', (b, e) => aksi(el, b, e));
      delegate(el, 'change', '[data-resp]', s => ubahRespon([s.dataset.resp], s.value));
      delegate(el, 'change', '[data-cek]', c => { c.checked ? st.sel.add(c.dataset.cek) : st.sel.delete(c.dataset.cek); renderBulk(el); c.closest('tr') && c.closest('tr').classList.toggle('sel', c.checked); });
      delegate(el, 'change', '[data-cekall]', c => { halaman().forEach(p => c.checked ? st.sel.add(p.id) : st.sel.delete(p.id)); renderList(el); renderBulk(el); });
      delegate(el, 'change', '[data-f]', s => { st[s.dataset.f] = s.value; st.page = 1; renderList(el); renderKpi(el); });
      el.addEventListener('input', debounce(e => { if (e.target.matches('[data-q]')) { st.q = e.target.value; st.page = 1; renderList(el); } }, 250));
      delegate(el, 'click', 'tr[data-id] td:not(.no-open), .mcard [data-open]', t => { const id = (t.closest('[data-id]') || {}).dataset; if (id && id.id) detail(id.id); });
    },
    render(el) {
      const admin = isAdmin(), s = S();
      el.querySelector('[data-r="head"]').innerHTML = pageHead({
        pill: 'Sistem PMB ' + (s.TAHUN_AKADEMIK || ''), eyebrow: [s.GELOMBANG_AKTIF || ''], title: 'Data Mahasiswa',
        lead: 'Kelola data pendaftar, pencarian, respon tindak lanjut, dan status pembayaran calon mahasiswa baru.',
        actions: '<button class="btn btn-white" data-act="excel">' + ic('file-spreadsheet') + 'Unduh Excel (.xlsx)</button>' +
          (admin ? '<button class="btn btn-soft" data-act="wa">' + ic('send') + 'Kirim WA</button><button class="btn btn-primary" data-act="tempel">' + ic('clipboard-paste') + '+ Tempel Data <span class="admin-tag">ADMIN</span></button>' : '')
      });
      const hit = j => j === 'Semua' ? App.P.length : App.P.filter(p => p.jalur === j).length;
      el.querySelector('[data-r="tabs"]').innerHTML = ['Semua'].concat(JALUR).map(j => '<button class="utab ' + (st.jalur === j ? 'on' : '') + '" data-jalur="' + j + '">' + (j === 'Semua' ? 'Semua Jalur' : j === 'Sore' ? 'Sore / Karyawan' : j) + ' <span class="tab-n badge b-peach plain">' + hit(j) + '</span></button>').join('');
      const kuota = jsonS('KUOTA_PRODI', {});
      el.querySelector('[data-r="filters"]').innerHTML = '<div class="chips mb16"><span class="chip-row-label">Prodi:</span>' +
        ['Semua'].concat(PRODI).map(p => '<button class="chip ' + (st.prodi === p ? 'on' : '') + '" data-prodi="' + p + '">' + (p === 'Semua' ? 'Semua' : '<span class="desk-only">' + esc(prodiLabel(p)) + ' (' + p + ')</span><span class="mob-only">' + p + '</span>') + '</button>').join('') +
        (st.prodi !== 'Semua' && kuota[st.prodi] ? '<span class="chip soft-on">' + ic('circle-check', 'sm') + 'Target kuota ' + st.prodi + ': ' + kuota[st.prodi] + ' kursi</span>' : '') + '</div><div class="mini-kpis" data-r="kpi"></div>';
      el.querySelector('[data-r="tool"]').innerHTML = '<div class="toolbar"><div class="input-ico grow">' + ic('search') + '<input class="input" data-q placeholder="Cari nama atau nomor HP…" value="' + esc(st.q) + '" aria-label="Cari"></div>' +
        '<select class="select" data-f="respon" style="width:auto" aria-label="Filter respon">' + RESPON_OPS.map(o => '<option value="' + o[0] + '" ' + (st.respon === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
        '<select class="select" data-f="bayar" style="width:auto" aria-label="Filter pembayaran">' + BAYAR_OPS.map(o => '<option value="' + o[0] + '" ' + (st.bayar === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
        '<button class="btn btn-soft" data-act="adv">' + ic('sliders-horizontal') + 'Filter Lanjutan' + (Object.values(st.adv).some(Boolean) ? ' •' : '') + '</button>' +
        '<button class="btn btn-white btn-icon" data-act="refresh" title="Segarkan" aria-label="Segarkan">' + ic('refresh-cw') + '</button></div>';
      el.querySelector('[data-r="danger"]').innerHTML = admin && App.P.length ? '<div class="row mt22" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-act="kosongkan">' + ic('trash-2', 'sm') + 'Kosongkan semua data pendaftar</button></div>' : '';
      renderKpi(el); renderList(el); renderBulk(el);
    },
    show(el) { if (App.prefill.tempel) { App.prefill.tempel = false; bukaTempel(); } }
  });

  const dasar = () => App.P.filter(p => (st.jalur === 'Semua' || p.jalur === st.jalur) && (st.prodi === 'Semua' || p.prodi === st.prodi));
  function saring() {
    const q = st.q.trim().toLowerCase(), qd = q.replace(/\D/g, ''), a = st.adv;
    return dasar().filter(p => {
      if (q && p.nama.toLowerCase().indexOf(q) < 0 && !(qd.length >= 3 && hp08(p.no_hp).indexOf(hp08(qd) || qd) > -1)) return false;
      if (st.respon && p.respon !== st.respon) return false;
      const f = p.f;
      if (st.bayar === 'lunas' && !f.L) return false; if (st.bayar === 'ukt' && !f.K) return false; if (st.bayar === 'cicil' && !(f.C && !f.U)) return false;
      if (st.bayar === 'pangkal' && !f.P) return false; if (st.bayar === 'belum' && (f.K || f.P || f.U)) return false; if (st.bayar === 'undur' && !f.U) return false;
      if (a.info && p.info !== a.info) return false;
      if (a.tahfizh === 'ya' && !f.T) return false; if (a.tahfizh === 'tidak' && f.T) return false;
      if (a.asrama === 'isi' && !p.asrama) return false; if (a.asrama === 'kosong' && p.asrama) return false;
      if (a.wa === 'Terdaftar' && p.status_wa !== 'Terdaftar') return false; if (a.wa === 'Tidak Terdaftar' && p.status_wa !== 'Tidak Terdaftar') return false;
      if (a.wa === 'belum' && p.status_wa) return false; if (a.wa === 'invalid' && hpValid(p.no_hp)) return false;
      if (a.du === 'ya' && !f.D) return false; if (a.du === 'tidak' && f.D) return false;
      return true;
    });
  }
  const halaman = () => saring().slice((st.page - 1) * st.per, st.page * st.per);
  function renderKpi(el) {
    const b = dasar(), n = k => b.filter(p => p.f[k]).length, tot = b.length;
    const K = [['k1', 'Jumlah Pendaftar|Jumlah', 'users', tot, 'mhs'], ['k2', 'Registrasi Form|Registrasi', 'user-check', n('D'), 'berkas'], ['k3', 'Uang Pangkal|Pangkal', 'wallet', n('P'), 'mhs'],
      ['k4', 'Bayar UKT|UKT', 'banknote', n('K'), 'mhs'], ['k5', 'Lunas Total|Lunas', 'circle-check', n('L'), F.pct(n('L'), tot)], ['k6', 'Undur Diri|Undur Diri', 'user-x', n('U'), 'mundur']];
    const box = el.querySelector('[data-r="kpi"]');
    if (box) box.innerHTML = K.map(k => '<div class="mk ' + k[0] + '"><div class="l"><span class="desk-only">' + k[1].split('|')[0] + '</span><span class="mob-only">' + k[1].split('|')[1] + '</span>' + ic(k[2], 'sm') + '</div><div class="v">' + F.n(k[3]) + '<small class="desk-only">' + k[4] + '</small></div></div>').join('');
  }
  function renderList(el) {
    const semua = saring(), rows = halaman(), admin = isAdmin(), off = (st.page - 1) * st.per;
    const box = el.querySelector('[data-r="list"]');
    if (!App.P.length) { box.innerHTML = '<div class="card">' + emptyBox('clipboard-paste', 'Belum ada data pendaftar', 'Tempel data dari Excel atau aplikasi pendaftaran. Aplikasi memisahkan jalur dan prodi secara otomatis.', admin ? '<button class="btn btn-primary" data-act="tempel">' + ic('clipboard-paste') + 'Tempel Data</button>' : '') + '</div>'; return; }
    if (!semua.length) { box.innerHTML = '<div class="card">' + emptyBox('search', 'Tidak ada yang cocok', 'Ubah kata kunci atau filter untuk melihat data lain.', '<button class="btn btn-soft" data-act="reset">Reset filter</button>') + '</div>'; return; }
    const respSel = p => admin ? '<select class="select resp-sel badge ' + (RESPON_STYLE[p.respon] || 'b-mute') + '" data-resp="' + p.id + '" aria-label="Ubah respon ' + esc(p.nama) + '">' +
      [['', 'Otomatis' + (p.respon_manual ? '' : ': ' + (p.respon === '-' ? 'Tuntas' : p.respon))], ['Belum Tes', 'Belum Tes'], ['Belum Daftar Ulang', 'Belum Daftar Ulang'], ['Mengundurkan Diri', 'Mengundurkan Diri'], ['-', 'Tuntas']]
        .map(o => '<option value="' + o[0] + '" ' + ((p.respon_manual || '') === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' : responBadge(p.respon);
    const tbl = '<div class="table-card desk-only"><div class="table-wrap"><table class="t"><thead><tr>' + (admin ? '<th class="c"><label class="check"><input type="checkbox" data-cekall aria-label="Pilih semua di halaman"></label></th>' : '') +
      '<th>No</th><th>Nama Lengkap</th><th>No. HP / WhatsApp</th><th>Status Ujian</th><th class="c">Daftar Ulang</th><th>Pembayaran</th><th>Respon</th><th>Catatan</th><th>Asrama</th><th>Sumber Info</th>' + (admin ? '<th class="c">Aksi</th>' : '') + '</tr></thead><tbody>' +
      rows.map((p, i) => '<tr data-id="' + p.id + '" class="clickable ' + (st.sel.has(p.id) ? 'sel' : '') + '">' + (admin ? '<td class="c no-open"><label class="check"><input type="checkbox" data-cek="' + p.id + '" ' + (st.sel.has(p.id) ? 'checked' : '') + '></label></td>' : '') +
        '<td class="r muted">' + String(off + i + 1).padStart(2, '0') + '</td>' +
        '<td><div class="person"><span class="avatar sm">' + esc(F.inisial(p.nama)) + '</span><div><div class="nm">' + esc(p.nama) + (p.f.T ? ' <span class="badge b-info plain">Tahfizh</span>' : '') + '</div><div class="sm">' + p.prodi + ' · ' + esc(p.jalur) + '</div></div></div></td>' +
        '<td class="no-open">' + (hpValid(p.no_hp) ? '<a class="hp" href="' + waLink(p.no_hp) + '" target="_blank" rel="noopener">' + ic('phone', 'sm') + fmtHp(p.no_hp) + '</a> ' + waBadge(p.status_wa) : '<span class="badge b-bad plain">' + esc(p.no_hp || 'kosong') + ' · tidak valid</span>') + '</td>' +
        '<td>' + ujianBadge(p.f) + '</td><td class="c"><span class="tick ' + (p.f.D ? 'y' : 'n') + '">' + ic(p.f.D ? 'check' : 'x', 'sm') + '</span></td>' +
        '<td>' + bayarBadge(p.f) + '</td><td class="no-open">' + respSel(p) + '</td>' +
        '<td>' + (p.catatan ? '<span class="tag-mini clamp2" style="max-width:180px;white-space:normal">' + esc(p.catatan) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td>' + esc(p.asrama || '—') + '</td><td>' + (p.info ? '<span class="tag-mini">' + esc(p.info) + '</span>' : '—') + '</td>' +
        (admin ? '<td class="c no-open"><button class="btn btn-ghost btn-icon sm" data-act="ubah" data-id="' + p.id + '" title="Ubah data" aria-label="Ubah data ' + esc(p.nama) + '">' + ic('pencil', 'sm') + '</button></td>' : '') + '</tr>').join('') + '</tbody></table></div>' +
      '<div class="table-foot"><span>Menampilkan <b>' + (off + 1) + '–' + (off + rows.length) + '</b> dari <b>' + F.n(semua.length) + '</b> data · ' + esc(st.jalur === 'Semua' ? 'Semua jalur' : st.jalur) + (st.prodi !== 'Semua' ? ' · ' + st.prodi : '') + '</span>' + pagerHtml(semua.length, st.page, st.per) + '</div></div>';
    const kartu = '<div class="mlist">' + rows.map(p => {
      const b = bayarStatus(p.f);
      return '<div class="mcard" data-id="' + p.id + '"><div class="top"><div data-open style="min-width:0;cursor:pointer"><div class="nm">' + esc(p.nama) + ' ' + (p.respon !== '-' ? responBadge(p.respon) : '') + '</div><div class="sub">' + esc(prodiLabel(p.prodi)) + ' (' + p.prodi + ') · ' + esc(p.jalur) + '</div></div>' +
        '<div class="acts">' + (hpValid(p.no_hp) ? '<a class="round-btn call" href="tel:' + hp08(p.no_hp) + '" aria-label="Telepon">' + ic('phone', 'sm') + '</a><a class="round-btn wa" href="' + waLink(p.no_hp) + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + ic('message-circle', 'sm') + '</a>' : '') + '</div></div>' +
        '<div class="kv" data-open><div><span>Ujian</span><b>' + (p.f.u === '1' ? '<span style="color:var(--ok-fg)">Lulus</span>' : p.f.u === '0' ? '<span style="color:var(--bad-fg)">Tidak lulus</span>' : 'Belum tes') + '</b></div>' +
        '<div><span>Registrasi</span><b>' + esc(p.registrasi || '-') + '</b></div><div><span>Pangkal</span><b>' + esc(p.pangkal || '-') + '</b></div><div><span>UKT / Lunas</span><b class="' + (p.f.L ? '' : '') + '">' + esc([p.ukt, p.lunas].filter(Boolean).join(' / ') || '-') + '</b></div></div>' +
        '<div class="chips"><span class="badge ' + b[1] + '">' + b[0] + '</span>' + (p.asrama ? '<span class="tag-mini">' + ic('house', 'sm') + esc(p.asrama) + '</span>' : '') + (p.info ? '<span class="tag-mini">' + esc(p.info) + '</span>' : '') +
        (p.f.T ? '<span class="tag-mini">' + ic('book-open', 'sm') + 'Tahfizh</span>' : '') + (p.catatan ? '<span class="tag-mini">' + esc(p.catatan.slice(0, 40)) + '</span>' : '') + '</div>' +
        (admin ? '<div class="row mt12"><label class="check"><input type="checkbox" data-cek="' + p.id + '" ' + (st.sel.has(p.id) ? 'checked' : '') + '> Pilih</label><button class="btn btn-soft btn-sm" data-act="ubah" data-id="' + p.id + '">' + ic('pencil', 'sm') + 'Ubah</button><div style="margin-left:auto;max-width:52%">' + respSel(p) + '</div></div>' : '') + '</div>';
    }).join('') + '<div class="row" style="justify-content:center">' + pagerHtml(semua.length, st.page, st.per) + '</div><p class="small muted" style="text-align:center">Menampilkan ' + (off + 1) + '–' + (off + rows.length) + ' dari ' + F.n(semua.length) + ' data</p></div>';
    box.innerHTML = tbl + kartu;
  }
  function renderBulk(el) {
    const box = el.querySelector('[data-r="bulk"]'), n = st.sel.size;
    const total = saring().length;
    box.innerHTML = n && isAdmin() ? '<div class="bulkbar"><b>' + n + ' dipilih</b>' + (n < total ? '<button class="btn btn-ghost btn-sm" style="color:#fff;text-decoration:underline" data-act="pilih-semua">Pilih semua ' + F.n(total) + ' hasil filter</button>' : '') + '<select class="select" data-act-sel style="width:auto;min-height:36px;color:var(--text)"><option value="">Ubah respon…</option>' +
      RESPON_OPS.slice(1).map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '<option value="__auto">Kembalikan otomatis</option></select>' +
      '<button class="btn btn-soft btn-sm" data-act="wa-sel">' + ic('send', 'sm') + 'Kirim WA</button><button class="btn btn-soft btn-sm" data-act="surat-sel">' + ic('file-pen-line', 'sm') + 'Buat surat</button>' +
      '<button class="btn btn-danger btn-sm" data-act="hapus-sel">' + ic('trash-2', 'sm') + 'Hapus</button><button class="btn btn-ghost btn-sm" style="color:#fff" data-act="batal-sel">Batal</button></div>' : '';
    const s = box.querySelector('[data-act-sel]');
    if (s) s.onchange = () => { if (s.value) ubahRespon(Array.from(st.sel), s.value === '__auto' ? '' : s.value); };
  }
  async function aksi(el, b) {
    const a = b.dataset.act;
    if (a === 'tempel') bukaTempel();
    if (a === 'excel') eksporData();
    if (a === 'refresh') syncNow().then(r => r.success && toast('Data sudah terbaru.'));
    if (a === 'adv') filterLanjutan(el);
    if (a === 'reset') { st.q = ''; st.respon = ''; st.bayar = ''; st.adv = {}; st.page = 1; Pages.mahasiswa.render(el); }
    if (a === 'wa' || a === 'wa-sel') {
      const ids = a === 'wa-sel' ? Array.from(st.sel) : saring().map(p => p.id);
      if (!ids.length) return toast('Tidak ada penerima pada filter ini.', 'warn');
      App.prefill.blast = { respon: st.respon && st.respon !== '-' ? st.respon : 'Umum', jalur: st.jalur !== 'Semua' ? [st.jalur] : [], prodi: st.prodi !== 'Semua' ? [st.prodi] : [], ids: a === 'wa-sel' || st.q || st.bayar || Object.values(st.adv).some(Boolean) ? ids : null };
      go('blast');
    }
    if (a === 'surat-sel') { App.prefill.massal = { ids: Array.from(st.sel) }; go('dokumen', 'massal'); }
    if (a === 'batal-sel') { st.sel.clear(); renderList(el); renderBulk(el); }
    if (a === 'pilih-semua') { saring().forEach(p => st.sel.add(p.id)); renderList(el); renderBulk(el); }
    if (a === 'ubah') formUbah(App.P.find(p => p.id === b.dataset.id));
    if (a === 'hapus-sel') {
      if (!(await confirmBox({ title: 'Hapus ' + st.sel.size + ' pendaftar?', pesan: 'Data terpilih dihapus permanen dari database. Tindakan ini tercatat di log.', ok: 'Hapus', danger: true }))) return;
      const r = await api('pendaftarHapus', { ids: Array.from(st.sel) }); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { st.sel.clear(); renderBulk(el); }
    }
    if (a === 'kosongkan') {
      if (!(await confirmBox({ title: 'Kosongkan semua data pendaftar?', pesan: 'Seluruh ' + App.P.length + ' baris akan dihapus. Snapshot grafik lama tetap tersimpan.', ketik: 'HAPUS SEMUA', ok: 'Kosongkan', danger: true }))) return;
      const r = await api('pendaftarHapus', { semua: true, konfirmasi: 'HAPUS SEMUA' }); toast(r.message, r.success ? 'ok' : 'err');
    }
  }
  async function ubahRespon(ids, nilai) {
    const simpan = ids.map(id => { const p = App.P.find(x => x.id === id); return p && [p, p.respon, p.respon_manual]; }).filter(Boolean);
    simpan.forEach(([p]) => { p.respon_manual = nilai; if (nilai) p.respon = nilai; });
    const el = $('.page[data-page="mahasiswa"]'); if (el) renderList(el);
    const r = await api('pendaftarRespon', { ids, respon: nilai });
    if (!r.success) { simpan.forEach(([p, a, b]) => { p.respon = a; p.respon_manual = b; }); if (el) renderList(el); toast(r.message, 'err'); }
    else toast(r.message);
  }
  function filterLanjutan(el) {
    const a = st.adv, kat = (App.data.meta || {}).infoKat || [];
    const sel = (k, ops) => '<select class="select" data-adv="' + k + '">' + ops.map(o => '<option value="' + o[0] + '" ' + ((a[k] || '') === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
    const m = modal({ title: 'Filter lanjutan', size: 'narrow',
      body: '<div class="field"><label>Sumber informasi</label>' + sel('info', [['', 'Semua']].concat(kat.map(k => [k, k]))) + '</div>' +
        '<div class="field"><label>Daftar ulang</label>' + sel('du', [['', 'Semua'], ['ya', 'Sudah'], ['tidak', 'Belum']]) + '</div>' +
        '<div class="field"><label>Program Tahfizh</label>' + sel('tahfizh', [['', 'Semua'], ['ya', 'Ikut Tahfizh'], ['tidak', 'Tidak ikut']]) + '</div>' +
        '<div class="field"><label>Asrama</label>' + sel('asrama', [['', 'Semua'], ['isi', 'Terisi'], ['kosong', 'Kosong']]) + '</div>' +
        '<div class="field"><label>Status nomor WhatsApp</label>' + sel('wa', [['', 'Semua'], ['Terdaftar', 'Terdaftar WA'], ['Tidak Terdaftar', 'Bukan WA'], ['belum', 'Belum dicek'], ['invalid', 'Nomor tidak valid']]) + '</div>',
      foot: '<button class="btn btn-ghost" data-r>Reset</button><button class="btn btn-primary" data-ok>Terapkan</button>' });
    m.el.querySelector('[data-r]').onclick = () => { st.adv = {}; m.close(); st.page = 1; Pages.mahasiswa.render(el); };
    m.el.querySelector('[data-ok]').onclick = () => { $$('[data-adv]', m.el).forEach(s => { st.adv[s.dataset.adv] = s.value; }); m.close(); st.page = 1; Pages.mahasiswa.render(el); };
  }
  function detail(id) {
    const p = App.P.find(x => x.id === id); if (!p) return;
    let ek = {}; try { ek = p.ekstra ? JSON.parse(p.ekstra) : {}; } catch (e) { }
    const baris = [['Jalur', p.jalur], ['Prodi', prodiLabel(p.prodi) + ' (' + p.prodi + ')'], ['No HP', fmtHp(p.no_hp) + (hpValid(p.no_hp) ? '' : ' (tidak valid)')], ['Status WA', p.status_wa || 'Belum dicek'],
      ['Ujian', p.ujian || '-'], ['Registrasi', p.registrasi || '-'], ['Uang pangkal', p.pangkal || '-'], ['UKT', p.ukt || '-'], ['Lunas', p.lunas || '-'], ['Depo', p.depo || '-'],
      ['Asrama', p.asrama || '-'], ['Sumber info', p.info || '-'], ['Tahfizh', p.tahfizh || '-'], ['Tanggal daftar', p.tanggal_daftar ? F.tgl(p.tanggal_daftar) : '-'], ['Catatan', p.catatan || '-'],
      ['Respon', (p.respon === '-' ? 'Tuntas' : p.respon) + (p.respon_manual ? ' (diubah manual)' : ' (otomatis)')], ['Diperbarui', F.tglJam(p.diperbarui)]]
      .concat(Object.keys(ek).map(k => [k.replace(/_/g, ' '), ek[k]]));
    const m = modal({ drawer: true, title: esc(p.nama), sub: bayarBadge(p.f) + ' ' + responBadge(p.respon),
      body: '<dl class="kv-list">' + baris.map(b => '<dt>' + esc(b[0]) + '</dt><dd>' + esc(b[1]) + '</dd>').join('') + '</dl>' +
        (isAdmin() ? '<hr class="divider"><div class="field"><label>Ubah respon tindak lanjut</label><select class="select" id="dResp">' +
          [['', 'Otomatis (ikuti data)'], ['Belum Tes', 'Belum Tes'], ['Belum Daftar Ulang', 'Belum Daftar Ulang'], ['Mengundurkan Diri', 'Mengundurkan Diri'], ['-', 'Tuntas']].map(o => '<option value="' + o[0] + '" ' + ((p.respon_manual || '') === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') +
          '</select><div class="help">Respon manual tetap dipertahankan saat data ditempel ulang (dicocokkan lewat nomor HP).</div></div>' : ''),
      foot: (hpValid(p.no_hp) ? '<a class="btn btn-white" href="tel:' + hp08(p.no_hp) + '">' + ic('phone') + 'Telepon</a><a class="btn btn-ok" href="' + waLink(p.no_hp, "Assalamu'alaikum " + p.nama + ',') + '" target="_blank" rel="noopener">' + ic('message-circle') + 'WhatsApp</a>' : '') +
        (isAdmin() ? '<button class="btn btn-soft" data-surat>' + ic('file-pen-line') + 'Buat surat</button><button class="btn btn-soft" data-simpan>Simpan respon</button><button class="btn btn-primary" data-ubah>' + ic('pencil') + 'Ubah data</button>' : '') });
    const ub = m.el.querySelector('[data-ubah]'); if (ub) ub.onclick = () => { m.close(); formUbah(p); };
    const sv = m.el.querySelector('[data-simpan]'); if (sv) sv.onclick = () => { ubahRespon([p.id], $('#dResp').value); m.close(); };
    const su = m.el.querySelector('[data-surat]'); if (su) su.onclick = () => { m.close(); if (window.Dok) Dok.buatDari('pendaftar', p.id); };
  }
  function eksporData() {
    const rows = saring(); if (!rows.length) return toast('Tidak ada data pada filter ini.', 'warn');
    const KOL = ['No', 'Jalur', 'Prodi', 'Nama', 'No HP', 'Ujian', 'Registrasi', 'Pangkal', 'UKT', 'Lunas', 'Catatan', 'Depo', 'Asrama', 'Info', 'Tahfizh', 'Respon', 'Respon Manual', 'Status WA', 'Tanggal Daftar', 'Diperbarui'];
    const aoa = [KOL].concat(rows.map((p, i) => [i + 1, p.jalur, p.prodi, p.nama, p.no_hp, p.ujian, p.registrasi, p.pangkal, p.ukt, p.lunas, p.catatan, p.depo, p.asrama, p.info, p.tahfizh, p.respon, p.respon_manual, p.status_wa, p.tanggal_daftar, F.tglJam(p.diperbarui)]));
    const nama = 'Data-Mahasiswa-' + (st.jalur === 'Semua' ? 'Semua' : st.jalur.replace(/ /g, '')) + (st.prodi !== 'Semua' ? '-' + st.prodi : '') + '-' + tglFile() + '.xlsx';
    unduhXlsx(nama, [{ nama: 'Data Mahasiswa', aoa }], 'Data Mahasiswa (' + rows.length + ' baris, filter aktif)');
  }

  /* =========================== TEMPEL DATA =========================== */
  const ALIAS = {
    nama: ['nama', 'namalengkap', 'name', 'namamahasiswa', 'namacalon', 'namapendaftar', 'namacalonmahasiswa', 'namasiswa'],
    no_hp: ['nohp', 'hp', 'nomorhp', 'nowa', 'wa', 'whatsapp', 'notelp', 'telepon', 'telp', 'nomorwa', 'nohpwa', 'kontak', 'nomorwhatsapp', 'hpwa', 'notlp', 'nohandphone'],
    jalur: ['jalur', 'kelas', 'programkelas', 'jeniskelas', 'jalurmasuk', 'kelaskuliah', 'waktukuliah', 'jalurkelas'],
    prodi: ['prodi', 'programstudi', 'jurusan', 'studi', 'pilihanprodi'],
    ujian: ['ujian', 'tes', 'test', 'statusujian', 'hasiltes', 'hasilujian', 'seleksi', 'hasilseleksi', 'statustes', 'nilaiujian'],
    registrasi: ['registrasi', 'daftarulang', 'reg', 'herregistrasi', 'regis', 'du', 'statusregistrasi'],
    pangkal: ['pangkal', 'uangpangkal', 'up', 'uangmasuk'], ukt: ['ukt', 'spp', 'uangkuliah', 'bayarukt', 'pembayaranukt'],
    lunas: ['lunas', 'statuslunas', 'pelunasan', 'statuspembayaran'], catatan: ['catatan', 'keterangan', 'ket', 'note', 'notes', 'status'],
    depo: ['depo', 'deposit', 'dp', 'nominaldepo'], asrama: ['asrama', 'kamar', 'pilihanasrama'],
    info: ['info', 'sumberinfo', 'sumberinformasi', 'tahudari', 'informasi', 'sumber', 'infodari'],
    tahfizh: ['tahfizh', 'tahfidz', 'tahfiz', 'programtahfizh', 'tahfidzh', 'hafalan'],
    tanggal_daftar: ['tanggaldaftar', 'tgldaftar', 'tanggal', 'waktudaftar', 'timestamp', 'tglpendaftaran', 'tanggalpendaftaran', 'tgl']
  };
  const FIELD = [['', '(abaikan kolom)'], ['nama', 'Nama'], ['no_hp', 'No HP / WA'], ['jalur', 'Jalur'], ['prodi', 'Prodi'], ['ujian', 'Ujian'], ['registrasi', 'Registrasi'], ['pangkal', 'Uang Pangkal'],
    ['ukt', 'UKT'], ['lunas', 'Lunas'], ['catatan', 'Catatan'], ['depo', 'Depo'], ['asrama', 'Asrama'], ['info', 'Sumber Info'], ['tahfizh', 'Tahfizh'], ['tanggal_daftar', 'Tanggal Daftar'], ['ekstra', 'Simpan sebagai info tambahan']];
  const nh = h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function normJalur(v) { const s = String(v || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); if (!s) return '';
    if (/akhwat|putri|perempuan|banat/.test(s)) return 'Inter Akhwat'; if (/ikhwan|putra|laki|banin/.test(s)) return 'Inter Ikhwan';
    if (/sore|karyawan|malam|eksekutif|^h$|^s$|hybrid/.test(s)) return 'Sore'; if (/reg|pagi|siang|^r$|^a$/.test(s)) return 'Reguler'; return ''; }
  function normProdi(v) { const s = String(v || '').toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim(); if (!s) return '';
    if (s === 'hes' || /hukum ekonomi|muamalah|hukum bisnis/.test(s)) return 'HES'; if (s === 'ei' || s === 'es' || /ekonomi (islam|syariah)|perbankan/.test(s)) return 'EI';
    if (s === 'pai' || /pendidikan agama|tarbiyah/.test(s)) return 'PAI'; if (s === 'iat' || /tafsir|al ?qur|quran/.test(s)) return 'IAT'; return ''; }
  const KOSONG = /^(|0|-|–|—|x|no|n|tidak|tdk|belum|blm|false|kosong|tidak ada|batal|null)$/i;

  function parseTabel(teks) {
    teks = String(teks || '').replace(/\r\n?/g, '\n');
    const awal = teks.split('\n').slice(0, 20), adaTab = awal.some(l => l.indexOf('\t') > -1), l0 = awal.find(l => /[;,]/.test(l)) || '';   // judul tanpa tab di baris 1 tidak boleh menentukan pemisah
    const delim = adaTab ? '\t' : (l0.split(';').length > l0.split(',').length ? ';' : ',');
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < teks.length; i++) {
      const c = teks[i];
      if (q) { if (c === '"') { if (teks[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"' && cell === '') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(x => String(x).trim())).filter(r => r.some(x => x !== ''));
  }
  function tebakPeta(rows, adaHeader) {
    const lebar = Math.max(...rows.map(r => r.length)), peta = new Array(lebar).fill(''), dipakai = {};
    if (adaHeader) rows[0].forEach((h, i) => { const n = nh(h); const f = Object.keys(ALIAS).find(k => !dipakai[k] && ALIAS[k].indexOf(n) > -1); if (f) { peta[i] = f; dipakai[f] = 1; } else if (n && !/^no$|^nomor$/.test(n)) peta[i] = 'ekstra'; });
    else {
      const contoh = rows.slice(0, 30);
      for (let i = 0; i < lebar; i++) {
        const v = contoh.map(r => r[i] || '').filter(Boolean), r = fn => v.length && v.filter(fn).length / v.length >= .6;
        if (!dipakai.no_hp && r(x => hpValid(x))) { peta[i] = 'no_hp'; dipakai.no_hp = 1; }
        else if (!dipakai.prodi && r(x => normProdi(x))) { peta[i] = 'prodi'; dipakai.prodi = 1; }
        else if (!dipakai.jalur && r(x => normJalur(x) && x.length > 2)) { peta[i] = 'jalur'; dipakai.jalur = 1; }
        else if (!dipakai.nama && r(x => /^[A-Za-z][A-Za-z.' ]{3,}$/.test(x))) { peta[i] = 'nama'; dipakai.nama = 1; }
      }
    }
    return peta;
  }
  /* =============== v1.1: UBAH DATA SATU PENDAFTAR =============== */
  const tertanda = v => { const s = String(v == null ? '' : v).trim(); return !!s && !KOSONG.test(s); };
  function ujianSt(v) { const s = String(v || '').trim().toLowerCase(); if (!s || KOSONG.test(s)) return 'BELUM'; if (/tidak\s*lulus|tdk\s*lulus|gagal|^tl$|tidak lolos|ditolak/.test(s)) return 'TL'; return 'LULUS'; }
  function responAuto(d) {
    if (/(mengundurkan|undur)\s*diri|mundur|resign|batal\s*(daftar|kuliah)/i.test(d.catatan || '')) return 'Mengundurkan Diri';
    const u = ujianSt(d.ujian); if (u === 'BELUM') return 'Belum Tes'; if (u === 'LULUS' && !tertanda(d.registrasi)) return 'Belum Daftar Ulang'; return '-';
  }
  function formUbah(p) {
    if (!p || !isAdmin()) return;
    const OPU = ['Lulus', 'Tidak Lulus'], lain = p.ujian && OPU.indexOf(p.ujian) < 0 && ujianSt(p.ujian) !== 'BELUM' ? p.ujian : '';
    const inp = (f, l, t) => '<div class="field"><label for="u_' + f + '">' + l + '</label><input class="input" id="u_' + f + '" data-u="' + f + '" type="' + (t || 'text') + '" value="' + esc(p[f] || '') + '"></div>';
    const tg = (f, l, h) => '<div class="field"><label>' + l + '</label><div class="row" style="flex-wrap:nowrap"><span class="switch"><input type="checkbox" data-sw="' + f + '" ' + (tertanda(p[f]) ? 'checked' : '') + ' aria-label="' + l + ' sudah"></span>' +
      '<input class="input" data-u="' + f + '" value="' + esc(p[f] || '') + '" placeholder="' + h + '"></div></div>';
    const kat = (App.data.meta || {}).infoKat || [];
    const m = modal({ drawer: true, title: 'Ubah data pendaftar', sub: esc(p.nama),
      body: '<div class="form-grid">' + inp('nama', 'Nama lengkap *') + inp('no_hp', 'No HP / WhatsApp', 'tel') +
        '<div class="field"><label>Jalur *</label><select class="select" data-u="jalur">' + JALUR.map(j => '<option ' + (p.jalur === j ? 'selected' : '') + '>' + j + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Prodi *</label><select class="select" data-u="prodi">' + PRODI.map(x => '<option value="' + x + '" ' + (p.prodi === x ? 'selected' : '') + '>' + x + ' — ' + esc(prodiLabel(x)) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Status ujian</label><select class="select" data-u="ujian"><option value="">Belum tes</option>' + OPU.map(o => '<option ' + (p.ujian === o ? 'selected' : '') + '>' + o + '</option>').join('') +
        (lain ? '<option selected value="' + esc(lain) + '">' + esc(lain) + ' (nilai tersimpan)</option>' : '') + '</select></div>' + inp('tanggal_daftar', 'Tanggal daftar', 'date') + '</div>' +
        '<hr class="divider"><div class="flabel mb8">Registrasi & pembayaran <span class="opt">nyalakan bila sudah · keterangan boleh nominal, mis. Rp 2,5 jt / cicil 2x</span></div>' +
        '<div class="form-grid">' + tg('registrasi', 'Registrasi / daftar ulang', 'v') + tg('pangkal', 'Uang pangkal', 'nominal / v') + tg('ukt', 'UKT', 'nominal / cicil') + tg('lunas', 'Lunas', 'v') + tg('tahfizh', 'Program Tahfizh', 'ya') + inp('depo', 'Depo') + '</div>' +
        '<hr class="divider"><div class="form-grid">' + inp('asrama', 'Asrama') + '<div class="field"><label>Sumber informasi</label><select class="select" data-u="info"><option value="">—</option>' + kat.map(k => '<option ' + (p.info === k ? 'selected' : '') + '>' + esc(k) + '</option>').join('') + '</select></div></div>' +
        '<div class="field"><label>Catatan</label><textarea class="textarea" data-u="catatan" rows="3">' + esc(p.catatan || '') + '</textarea><div class="help">Tulis "mengundurkan diri" agar status otomatis menjadi Mengundurkan Diri.</div></div>' +
        '<div class="field"><label>Respon tindak lanjut</label><select class="select" data-u-resp>' + [['', 'Otomatis (ikuti data)'], ['Belum Tes', 'Belum Tes'], ['Belum Daftar Ulang', 'Belum Daftar Ulang'], ['Mengundurkan Diri', 'Mengundurkan Diri'], ['-', 'Tuntas']]
          .map(o => '<option value="' + o[0] + '" ' + ((p.respon_manual || '') === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select><div class="help" id="uPrev"></div></div>',
      foot: '<button class="btn btn-danger" data-hapus>' + ic('trash-2') + 'Hapus</button><button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" data-simpan>' + ic('check') + 'Simpan perubahan</button>' });
    const ambil = () => { const d = {}; $$('[data-u]', m.el).forEach(i => { d[i.dataset.u] = i.value.trim(); }); return d; };
    const prev = () => { const d = ambil(), man = m.el.querySelector('[data-u-resp]').value, auto = responAuto(d);
      $('#uPrev').innerHTML = 'Respon setelah disimpan: ' + responBadge(man || auto) + (man ? ' <span class="muted">(manual)</span>' : ' <span class="muted">(otomatis dari data)</span>'); };
    m.el.addEventListener('change', e => {
      const sw = e.target.closest('[data-sw]');
      if (sw) { const i = m.el.querySelector('input[data-u="' + sw.dataset.sw + '"]'); if (sw.checked && !tertanda(i.value)) i.value = sw.dataset.sw === 'tahfizh' ? 'ya' : 'v'; if (!sw.checked) i.value = ''; }
      prev();
    });
    m.el.addEventListener('input', e => { const f = e.target.dataset.u, sw = f && m.el.querySelector('[data-sw="' + f + '"]'); if (sw) sw.checked = tertanda(e.target.value); prev(); });
    prev();
    m.el.querySelector('[data-simpan]').onclick = async e => {
      const d = ambil(); if (!d.nama) return toast('Nama wajib diisi.', 'warn');
      busy(e.currentTarget, true, 'Menyimpan…');
      const r = await api('pendaftarUbah', { id: p.id, data: d, respon_manual: m.el.querySelector('[data-u-resp]').value });
      busy(m.el.querySelector('[data-simpan]'), false); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) m.close();
    };
    m.el.querySelector('[data-hapus]').onclick = async () => {
      if (!(await confirmBox({ title: 'Hapus ' + p.nama + '?', pesan: 'Data pendaftar ini dihapus permanen dari database. Tindakan ini tercatat di log.', ok: 'Hapus', danger: true }))) return;
      const r = await api('pendaftarHapus', { ids: [p.id] }); toast(r.message, r.success ? 'ok' : 'err'); if (r.success) { st.sel.delete(p.id); m.close(); }
    };
  }

  /* =============== v1.1: TEMPEL DATA — PER KOLOM ATAU TABEL =============== */
  const KOLOM = [['nama', 'Nama *'], ['no_hp', 'No HP / WA'], ['jalur', 'Jalur'], ['prodi', 'Prodi'], ['ujian', 'Ujian'], ['registrasi', 'Registrasi'], ['pangkal', 'Uang Pangkal'],
    ['ukt', 'UKT'], ['lunas', 'Lunas'], ['catatan', 'Catatan'], ['depo', 'Depo'], ['asrama', 'Asrama'], ['info', 'Sumber Info'], ['tahfizh', 'Tahfizh'], ['tanggal_daftar', 'Tgl Daftar']];
  /** Satu kolom dari Excel → array nilai. Sel kosong DIPERTAHANKAN agar baris tetap sejajar antarkolom. */
  function parseKolom(teks) {
    teks = String(teks || '').replace(/\r\n?/g, '\n');
    const out = []; let cell = '', q = false;
    for (let i = 0; i < teks.length; i++) {
      const c = teks[i];
      if (q) { if (c === '"') { if (teks[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"' && cell === '') q = true;
      else if (c === '\n') { out.push(cell); cell = ''; }
      else cell += c;
    }
    out.push(cell);
    if (out.length && out[out.length - 1] === '') out.pop();              // hanya baris baru penutup dari Excel
    if (out.every(x => !x.trim())) return [];
    return out.map(x => x.replace(/\t/g, ' ').replace(/\s*\n\s*/g, ' ').trim());
  }
  /** Tabel utuh (dengan/tanpa judul, judul boleh di baris ke-2/3) → isi per kolom + kolom lain yang perlu dipilih tujuannya. */
  function tabelKeKolom(teks) {
    const rows = parseTabel(teks); if (!rows.length) return null;
    let hi = -1;
    for (let i = 0; i < Math.min(15, rows.length); i++) if (rows[i].filter(h => Object.keys(ALIAS).some(k => ALIAS[k].indexOf(nh(h)) > -1)).length >= 2) { hi = i; break; }
    const data = hi >= 0 ? rows.slice(hi + 1) : rows, H = hi >= 0 ? rows[hi] : [], lebar = Math.max(...rows.map(r => r.length));
    const peta = hi >= 0 ? tebakPeta([H].concat(data), true) : tebakPeta(data, false), kol = {}, ekstra = [];
    for (let c = 0; c < lebar; c++) {
      const nilai = data.map(r => (r[c] == null ? '' : String(r[c]).replace(/\s*\n\s*/g, ' '))), f = peta[c];
      if (f && f !== 'ekstra' && !kol[f]) kol[f] = nilai.join('\n');
      else if (nilai.some(v => v.trim())) { const judul = String(H[c] || '').trim() || 'Kolom ' + (c + 1); ekstra.push({ judul, teks: nilai.join('\n'), tujuan: /^no\.?$|^nomor$|^#$/i.test(judul) ? 'abaikan' : 'ekstra' }); }
    }
    return { kol, ekstra, judulBaris: hi + 1, baris: data.length };
  }
  function nilaiItems(list, bJ, bP) {
    const items = list.map(({ i, src }) => {
      const j = normJalur(src.jalur) || normJalur(bJ), p = normProdi(src.prodi) || normProdi(bP) || (/^Inter/.test(j) ? normProdi(S().PRODI_INTER || 'HES') : '');
      return { i, src, j, p, nama: String(src.nama || '').trim(), hp: hp08(src.no_hp), st: 'ok', pesan: [] };
    });
    const perNama = {}, perKunci = {}, perHp = {};
    items.forEach(it => { const kn = it.nama.toLowerCase().replace(/[^a-z]/g, ''); (perNama[kn] = perNama[kn] || []).push(it);
      const k = (hpValid(it.hp) ? it.hp : 'x') + '|' + kn; (perKunci[k] = perKunci[k] || []).push(it); if (hpValid(it.hp)) (perHp[it.hp] = perHp[it.hp] || []).push(it); });
    items.forEach(it => {
      const bad = m => { it.st = 'bad'; it.pesan.push(m); }, warn = m => { if (it.st !== 'bad') it.st = 'warn'; it.pesan.push(m); };
      if (!it.nama) bad('Nama kosong'); else if (/^(jumlah|total|sub ?total|rekap)$/i.test(it.nama)) bad('Baris jumlah/total');
      if (!it.j) bad('Jalur tidak dikenali' + (it.src.jalur ? ' ("' + it.src.jalur + '")' : ' — isi kolom Jalur atau pilih Jalur bawaan'));
      if (!it.p) bad('Prodi tidak dikenali' + (it.src.prodi ? ' ("' + it.src.prodi + '")' : ' — isi kolom Prodi atau pilih Prodi bawaan'));
      const kn = it.nama.toLowerCase().replace(/[^a-z]/g, ''), k = (hpValid(it.hp) ? it.hp : 'x') + '|' + kn;
      if (it.nama && perKunci[k].length > 1 && perKunci[k][0] !== it) bad('Duplikat baris ' + (perKunci[k][0].i + 1));
      if (!hpValid(it.hp)) warn(it.hp ? 'Nomor HP tidak valid' : 'Nomor HP kosong');
      else if (perHp[it.hp].length > 1 && perHp[it.hp].some(x => x.nama.toLowerCase().replace(/[^a-z]/g, '') !== kn)) warn('Nomor HP dipakai pendaftar lain');
      if (it.nama && perNama[kn].length > 1 && perKunci[k].length === 1) warn('Nama kembar');
      if (it.src.tahfizh && !KOSONG.test(it.src.tahfizh) && it.j && it.j !== 'Sore') warn('Tahfizh di luar kelas Sore');
    });
    return items;
  }
  function bukaTempel() {
    if (!isAdmin()) return;
    const T = { mode: 'kolom', kol: {}, ekstra: [], tabel: '', bJalur: '', bProdi: '', simpan: 'timpa', items: [] };
    const m = modal({ title: 'Tempel data pendaftar', sub: 'Salin dari Excel per kolom (paling aman) atau satu tabel sekaligus.', size: 'xwide', body: '<div data-step></div>', foot: '<div data-foot class="row" style="width:100%;justify-content:flex-end"></div>' });
    const body = m.el.querySelector('[data-step]'), foot = m.el.querySelector('[data-foot]');
    const optJ = v => '<option value="">— dari kolom Jalur —</option>' + JALUR.map(j => '<option ' + (v === j ? 'selected' : '') + '>' + j + '</option>').join('');
    const optP = v => '<option value="">— dari kolom Prodi —</option>' + PRODI.map(p => '<option value="' + p + '" ' + (v === p ? 'selected' : '') + '>' + p + ' — ' + esc(prodiLabel(p)) + '</option>').join('');
    const jumlah = () => { let n = 0; KOLOM.forEach(([f]) => { n = Math.max(n, parseKolom(T.kol[f]).length); }); T.ekstra.filter(e => e.tujuan === 'ekstra').forEach(e => { n = Math.max(n, parseKolom(e.teks).length); }); return n; };
    function infoBaris() {
      const n = jumlah(), box = body.querySelector('[data-r="jml"]'); if (!box) return;
      const beda = KOLOM.filter(([f]) => { const c = parseKolom(T.kol[f]).length; return c && c !== n; }).map(([f, l]) => l.replace(' *', '') + ' (' + parseKolom(T.kol[f]).length + ')');
      KOLOM.forEach(([f]) => { const c = parseKolom(T.kol[f]).length, b = body.querySelector('[data-n="' + f + '"]'), card = b && b.closest('.kol-card');
        if (b) b.textContent = c ? c + ' baris' : 'kosong'; if (card) { card.classList.toggle('isi', !!c); card.classList.toggle('beda', !!c && c !== n); } });
      box.innerHTML = '<b>' + F.n(n) + '</b> baris terdeteksi' + (beda.length ? ' <span class="badge b-warn plain">Jumlah baris berbeda: ' + esc(beda.join(', ')) + ' — periksa sel yang terlewat</span>' : (n ? ' <span class="badge b-ok plain">semua kolom sejajar</span>' : ''));
    }
    function langkah1() {
      body.innerHTML = '<div class="tabs mb16"><button class="tab ' + (T.mode === 'kolom' ? 'on' : '') + '" data-mode="kolom">' + ic('layers', 'sm') + 'Isi per kolom</button><button class="tab ' + (T.mode === 'tabel' ? 'on' : '') + '" data-mode="tabel">' + ic('clipboard-paste', 'sm') + 'Tempel tabel sekaligus</button></div>' +
        '<div class="form-grid"><div class="field"><label>Jalur bawaan <span class="opt">bila kolom Jalur dikosongkan</span></label><select class="select" id="tJ">' + optJ(T.bJalur) + '</select></div>' +
        '<div class="field"><label>Prodi bawaan <span class="opt">mis. menempel isi sheet R-HES</span></label><select class="select" id="tP">' + optP(T.bProdi) + '</select></div></div>' +
        (T.mode === 'tabel' ? '<div class="field"><label>Tabel dari Excel <span class="opt">blok tabel termasuk judul kolom → Ctrl+C → Ctrl+V</span></label><textarea class="textarea paste-area" id="tTabel" placeholder="NAMA&#9;NO HP&#9;JALUR&#9;PRODI&#9;UJIAN&#9;…">' + esc(T.tabel) + '</textarea></div>' +
          '<div class="callout info">' + ic('info', 'sm') + '<div>Setelah dibaca, setiap kolom dipindahkan ke kotak per kolom. Kolom yang tidak dikenali bisa Anda arahkan sendiri, dan kolom yang kurang bisa ditempel terpisah.</div></div>'
          : '<div class="callout info mb16">' + ic('info', 'sm') + '<div><b>Cara:</b> di Excel blok <b>isi satu kolom</b> (mis. semua nama, tanpa judul) → Ctrl+C → klik kotak <b>Nama</b> → Ctrl+V. Ulangi untuk kolom lain. Baris ke-1 di setiap kotak adalah orang yang sama, jadi salin dari baris awal yang sama.</div></div>' +
            (T.ekstra.length ? '<div class="card card-pad mb16" style="background:var(--canvas)"><div class="flabel mb8">Kolom lain dari tabel — pilih tujuannya</div>' + T.ekstra.map((e, k) => { const v = parseKolom(e.teks);
              return '<div class="row mb8" style="flex-wrap:nowrap"><span style="flex:1;min-width:0"><b>' + esc(e.judul) + '</b> <span class="small muted">' + v.length + ' baris · contoh: ' + esc(v.filter(Boolean).slice(0, 2).join(', ').slice(0, 60)) + '</span></span>' +
                '<select class="select" style="max-width:240px" data-ek="' + k + '"><option value="ekstra" ' + (e.tujuan === 'ekstra' ? 'selected' : '') + '>Simpan sebagai info tambahan</option><option value="abaikan" ' + (e.tujuan === 'abaikan' ? 'selected' : '') + '>Abaikan</option>' +
                KOLOM.map(([f, l]) => '<option value="' + f + '">→ Masukkan ke ' + l.replace(' *', '') + '</option>').join('') + '</select></div>'; }).join('') + '</div>' : '') +
            '<div class="kol-grid">' + KOLOM.map(([f, l]) => '<div class="kol-card"><div class="row-between"><label for="k_' + f + '">' + l + '</label><span class="small muted" data-n="' + f + '"></span></div>' +
              '<textarea class="textarea paste-area" id="k_' + f + '" data-kol="' + f + '" rows="6" spellcheck="false" placeholder="Tempel kolom ' + esc(l.replace(' *', '')) + '…">' + esc(T.kol[f] || '') + '</textarea></div>').join('') + '</div>' +
            '<div class="row mt12 small" data-r="jml"></div>');
      foot.innerHTML = (T.mode === 'kolom' ? '<button class="btn btn-ghost" data-b="contoh">' + ic('file-text') + 'Isi contoh</button><button class="btn btn-ghost" data-b="kosong">' + ic('rotate-ccw') + 'Kosongkan</button>' : '') +
        '<button class="btn btn-ghost" data-b="batal">Batal</button>' + (T.mode === 'tabel' ? '<button class="btn btn-primary" data-b="baca">Baca tabel ' + ic('arrow-right') + '</button>' : '<button class="btn btn-primary" data-b="periksa">Periksa data ' + ic('arrow-right') + '</button>');
      $('#tJ').onchange = e => { T.bJalur = e.target.value; }; $('#tP').onchange = e => { T.bProdi = e.target.value; };
      $$('[data-mode]', body).forEach(b => b.onclick = () => { if (T.mode === 'tabel') T.tabel = $('#tTabel').value; T.mode = b.dataset.mode; langkah1(); });
      $$('[data-ek]', body).forEach(s => s.onchange = async () => {
        const e = T.ekstra[+s.dataset.ek], v = s.value;
        if (v === 'ekstra' || v === 'abaikan') { e.tujuan = v; infoBaris(); return; }
        if ((T.kol[v] || '').trim() && !(await confirmBox({ title: 'Ganti isi kolom?', pesan: 'Kotak ' + v + ' sudah berisi data. Ganti dengan kolom "' + e.judul + '"?', ok: 'Ganti' }))) { s.value = e.tujuan; return; }
        T.kol[v] = e.teks; T.ekstra.splice(+s.dataset.ek, 1); langkah1();
      });
      $$('[data-kol]', body).forEach(t => {
        t.addEventListener('input', () => { T.kol[t.dataset.kol] = t.value; infoBaris(); });
        t.addEventListener('paste', e => {
          const txt = (e.clipboardData || window.clipboardData).getData('text');
          if (/\t/.test(txt.split(/\r?\n/)[0] || '')) {             // yang ditempel ternyata beberapa kolom → baca sebagai tabel
            e.preventDefault(); bacaTabel(txt, t.dataset.kol); return;
          }
          setTimeout(() => {                                        // buang judul kolom bila ikut tersalin
            const baris = t.value.split(/\r?\n/), f = t.dataset.kol, h = nh(baris[0]);
            if (baris.length > 1 && h && ((ALIAS[f] || []).indexOf(h) > -1 || h === nh((KOLOM.find(k => k[0] === f) || [])[1]))) { t.value = baris.slice(1).join('\n'); toast('Judul kolom "' + baris[0] + '" dibuang otomatis.', 'info', 2500); }
            T.kol[f] = t.value; infoBaris();
          }, 0);
        });
      });
      foot.querySelector('[data-b="batal"]').onclick = m.close;
      const bb = foot.querySelector('[data-b="baca"]'); if (bb) bb.onclick = () => bacaTabel($('#tTabel').value);
      const bp = foot.querySelector('[data-b="periksa"]'); if (bp) bp.onclick = langkah2;
      const bc = foot.querySelector('[data-b="contoh"]'); if (bc) bc.onclick = () => { Object.assign(T.kol, { nama: 'Ahmad Fauzi\nSiti Aminah\nMuhammad Farhan', no_hp: '0812-3456-7890\n089876543210\n085612345678', jalur: 'Reguler\nSore\nReguler', prodi: 'HES\nEI\nPAI', ujian: 'Lulus\nLulus\n', registrasi: 'v\n\n', ukt: 'v\ncicil 2x\n', info: 'Instagram\nTeman\nBrosur' }); langkah1(); };
      const bk = foot.querySelector('[data-b="kosong"]'); if (bk) bk.onclick = () => { T.kol = {}; T.ekstra = []; langkah1(); };
      infoBaris();
    }
    function bacaTabel(teks, mulaiDari) {
      const h = tabelKeKolom(teks); if (!h) return toast('Tempel tabel terlebih dahulu.', 'warn');
      if (mulaiDari && h.judulBaris === 0) {                        // tanpa judul: kolom ke-1 masuk kotak yang diklik, berikutnya ke kotak di sebelahnya
        const awal = KOLOM.findIndex(k => k[0] === mulaiDari), rows = parseTabel(teks); h.kol = {}; h.ekstra = [];
        const lebar = Math.max(...rows.map(r => r.length));
        for (let c = 0; c < lebar; c++) { const k = KOLOM[awal + c]; const v = rows.map(r => r[c] || '').join('\n'); if (k) h.kol[k[0]] = v; else h.ekstra.push({ judul: 'Kolom ' + (c + 1), teks: v, tujuan: 'ekstra' }); }
      }
      Object.keys(h.kol).forEach(f => { T.kol[f] = h.kol[f]; }); T.ekstra = h.ekstra; T.mode = 'kolom';
      langkah1();
      const dibaca = Object.keys(h.kol).map(f => (KOLOM.find(k => k[0] === f) || [f, f])[1].replace(' *', ''));
      toast('Terbaca ' + dibaca.length + ' kolom' + (h.judulBaris ? ' (judul di baris ' + h.judulBaris + ')' : '') + ': ' + dibaca.join(', ') + (h.ekstra.length ? '. ' + h.ekstra.length + ' kolom lain perlu dipilih tujuannya.' : '.'), h.ekstra.length ? 'warn' : 'ok', 7000);
    }
    function daftarSrc() {
      const L = {}; let n = 0;
      KOLOM.forEach(([f]) => { L[f] = parseKolom(T.kol[f]); n = Math.max(n, L[f].length); });
      const ek = T.ekstra.filter(e => e.tujuan === 'ekstra').map(e => ({ j: e.judul, v: parseKolom(e.teks) })); ek.forEach(e => { n = Math.max(n, e.v.length); });
      const out = [];
      for (let i = 0; i < n; i++) {
        const src = { ekstra: {} }; let isi = false;
        KOLOM.forEach(([f]) => { if (L[f][i]) { src[f] = L[f][i]; isi = true; } }); ek.forEach(e => { if (e.v[i]) { src.ekstra[e.j] = e.v[i]; isi = true; } });
        if (isi) out.push({ i, src });
      }
      return out;
    }
    function langkah2() {
      const list = daftarSrc(); if (!list.length) return toast('Belum ada data. Tempel minimal kolom Nama.', 'warn');
      if (!parseKolom(T.kol.nama).length) return toast('Kolom Nama masih kosong.', 'warn');
      T.items = nilaiItems(list, T.bJalur, T.bProdi);
      const ok = T.items.filter(x => x.st !== 'bad'), bad = T.items.filter(x => x.st === 'bad'), warn = T.items.filter(x => x.st === 'warn'), dist = {};
      ok.forEach(x => { const k = x.j + ' · ' + x.p; dist[k] = (dist[k] || 0) + 1; });
      body.innerHTML = '<div class="stat-row"><div class="stat"><div class="ico">' + ic('list') + '</div><div><div class="lbl">Baris terbaca</div><div class="val">' + F.n(T.items.length) + '</div></div></div>' +
        '<div class="stat"><div class="ico" style="background:var(--ok-bg);color:var(--ok-fg)">' + ic('circle-check') + '</div><div><div class="lbl">Siap disimpan</div><div class="val">' + F.n(ok.length) + '</div></div></div>' +
        '<div class="stat"><div class="ico" style="background:var(--warn-bg);color:var(--warn-fg)">' + ic('triangle-alert') + '</div><div><div class="lbl">Peringatan</div><div class="val">' + F.n(warn.length) + '</div></div></div>' +
        '<div class="stat"><div class="ico" style="background:var(--bad-bg);color:var(--bad-fg)">' + ic('circle-x') + '</div><div><div class="lbl">Tidak disimpan</div><div class="val">' + F.n(bad.length) + '</div></div></div></div>' +
        '<div class="chips mb16"><span class="chip-row-label">Terpisah otomatis:</span>' + Object.keys(dist).sort().map(k => '<span class="chip soft-on">' + esc(k) + ' <span class="n">' + dist[k] + '</span></span>').join('') + '</div>' +
        (bad.length || warn.length ? '<details class="mb16" ' + (bad.length ? 'open' : '') + '><summary class="bold" style="cursor:pointer">Baris bermasalah (' + (bad.length + warn.length) + ') — perbaiki di kotak kolom lalu periksa ulang</summary><div class="table-wrap mt8" style="max-height:200px"><table class="t"><tbody>' +
          bad.concat(warn).slice(0, 150).map(x => '<tr class="' + x.st + '"><td class="muted">Baris ' + (x.i + 1) + '</td><td class="bold">' + esc(x.nama || '(tanpa nama)') + '</td><td>' + esc(x.pesan.join(' · ')) + '</td><td>' + (x.st === 'bad' ? '<span class="badge b-bad">Tidak disimpan</span>' : '<span class="badge b-warn">Tetap disimpan</span>') + '</td></tr>').join('') + '</tbody></table></div></details>' : '') +
        '<div class="flabel mb8">Pratinjau 30 baris pertama</div><div class="table-card mb16"><div class="table-wrap" style="max-height:300px"><table class="t"><thead><tr><th>#</th><th>Nama</th><th>No HP</th><th>Jalur</th><th>Prodi</th><th>Ujian</th><th>Registrasi</th><th>Pangkal</th><th>UKT</th><th>Lunas</th><th>Catatan</th><th>Info</th></tr></thead><tbody>' +
        T.items.slice(0, 30).map(x => '<tr class="' + (x.st === 'ok' ? '' : x.st) + '"><td class="muted">' + (x.i + 1) + '</td><td class="bold">' + esc(x.nama) + '</td><td>' + esc(x.hp || x.src.no_hp || '') + '</td><td>' + esc(x.j || '?') + '</td><td>' + esc(x.p || '?') + '</td>' +
          ['ujian', 'registrasi', 'pangkal', 'ukt', 'lunas', 'catatan', 'info'].map(f => '<td>' + esc(x.src[f] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></div>' +
        '<div class="grid g2"><label class="card card-pad check" style="align-items:flex-start"><input type="radio" name="tMode" value="timpa" ' + (T.simpan === 'timpa' ? 'checked' : '') + '><div><b>Timpa seluruh data</b> <span class="badge b-peach plain">Sinkronisasi penuh</span><div class="help mt8">Data di aplikasi diganti dengan tempelan ini. Pendaftar yang tidak ada di tempelan akan dihapus. Respon manual & status WA tetap dipertahankan (dicocokkan lewat nomor HP).</div></div></label>' +
        '<label class="card card-pad check" style="align-items:flex-start"><input type="radio" name="tMode" value="tambah" ' + (T.simpan === 'tambah' ? 'checked' : '') + '><div><b>Tambahkan data baru</b><div class="help mt8">Hanya pendaftar yang belum ada yang ditambahkan. Data lama tidak diubah.</div></div></label></div>' +
        '<label class="check mt16" id="tKonf"><input type="checkbox" id="tYakin"> Saya sudah memeriksa pratinjau' + (App.P.length ? ' dan paham <b>&nbsp;' + F.n(App.P.length) + ' data lama&nbsp;</b> akan disinkronkan' : '') + '.</label>';
      foot.innerHTML = '<button class="btn btn-ghost" data-back>' + ic('arrow-left') + 'Kembali ke kolom</button><button class="btn btn-primary" data-save ' + (ok.length ? '' : 'disabled') + '>' + ic('cloud-upload') + 'Simpan ' + F.n(ok.length) + ' baris</button>';
      $$('[name=tMode]', body).forEach(r => r.onchange = () => { T.simpan = r.value; });
      foot.querySelector('[data-back]').onclick = langkah1;
      foot.querySelector('[data-save]').onclick = () => { if (!$('#tYakin').checked) { toast('Centang konfirmasi pemeriksaan terlebih dahulu.', 'warn'); $('#tKonf').scrollIntoView({ block: 'center' }); return; } simpan(ok); };
    }
    async function simpan(ok) {
      const kirim = ok.map(x => Object.assign({}, x.src, { _baris: x.i + 1 })), bawaan = { jalur: T.bJalur, prodi: T.bProdi };
      body.innerHTML = '<div class="empty"><span class="spin"></span><b id="tProg">Mengirim data…</b><div class="progress" style="width:min(420px,80vw)"><i id="tBar" style="width:5%"></i></div><div class="help">Jangan tutup halaman ini. Data dikirim bertahap agar aman di jaringan HP.</div></div>';
      foot.innerHTML = '';
      let r;
      if (kirim.length <= 500) { $('#tBar').style.width = '40%'; r = await api('pendaftarSimpan', { mode: T.simpan, bawaan, rows: kirim }); }
      else {
        const sid = Date.now().toString(36), PER = 400, parts = Math.ceil(kirim.length / PER);
        for (let i = 0; i < parts; i++) {
          $('#tProg').textContent = 'Mengirim potongan ' + (i + 1) + ' dari ' + parts + '…'; $('#tBar').style.width = Math.round((i + 1) * 80 / parts) + '%';
          const s = await api('pendaftarStage', { sid, part: i, rows: kirim.slice(i * PER, (i + 1) * PER) });
          if (!s.success) { r = s; break; }
        }
        if (!r) { $('#tProg').textContent = 'Menyimpan & menghitung ulang dasbor…'; r = await api('pendaftarSimpan', { mode: T.simpan, bawaan, sid, parts }); }
      }
      $('#tBar').style.width = '100%';
      if (!r.success) { body.innerHTML = '<div class="callout bad">' + ic('circle-x') + '<div><b>Gagal menyimpan.</b> ' + esc(r.message) + '</div></div>'; foot.innerHTML = '<button class="btn btn-ghost" data-back>Kembali ke pratinjau</button>'; foot.querySelector('[data-back]').onclick = langkah2; return; }
      const d = r.data;
      body.innerHTML = '<div class="callout ok mb16">' + ic('circle-check') + '<div><b>' + esc(r.message) + '</b><div class="help">Dasbor, grafik, dan snapshot harian sudah diperbarui.</div></div></div>' +
        '<div class="stat-row">' + [['Ditambah', d.ditambah, 'user-check'], ['Diperbarui', d.diperbarui, 'refresh-cw'], ['Tidak berubah', d.tetap, 'check'], ['Dihapus', d.dihapus, 'trash-2'], ['Dilewati server', d.dilewati, 'ban']]
          .map(s => '<div class="stat"><div class="ico">' + ic(s[2]) + '</div><div><div class="lbl">' + s[0] + '</div><div class="val">' + F.n(s[1]) + '</div></div></div>').join('') + '</div>' +
        (d.masalah && d.masalah.length ? '<div class="flabel mb8">Catatan server</div><ul class="small">' + d.masalah.slice(0, 50).map(x => '<li>Baris ' + x.baris + ': ' + esc(x.pesan) + '</li>').join('') + '</ul>' : '');
      foot.innerHTML = '<button class="btn btn-white" data-dash>' + ic('layout-dashboard') + 'Lihat Dasbor</button><button class="btn btn-primary" data-x>Selesai</button>';
      foot.querySelector('[data-x]').onclick = m.close; foot.querySelector('[data-dash]').onclick = () => { m.close(); go('dasbor'); };
    }
    langkah1();
  }
  window.MhsTempel = { parseTabel, tebakPeta, nilaiItems, parseKolom };
})();
