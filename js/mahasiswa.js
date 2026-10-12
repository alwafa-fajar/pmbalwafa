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
      delegate(el, 'click', '[data-page]', b => { if (b.disabled) return; st.page = +b.dataset.page; renderList(el); el.querySelector('[data-r="tool"]').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
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
      '<th>No</th><th>Nama Lengkap</th><th>No. HP / WhatsApp</th><th>Status Ujian</th><th class="c">Daftar Ulang</th><th>Pembayaran</th><th>Respon</th><th>Catatan</th><th>Asrama</th><th>Sumber Info</th></tr></thead><tbody>' +
      rows.map((p, i) => '<tr data-id="' + p.id + '" class="clickable ' + (st.sel.has(p.id) ? 'sel' : '') + '">' + (admin ? '<td class="c no-open"><label class="check"><input type="checkbox" data-cek="' + p.id + '" ' + (st.sel.has(p.id) ? 'checked' : '') + '></label></td>' : '') +
        '<td class="r muted">' + String(off + i + 1).padStart(2, '0') + '</td>' +
        '<td><div class="person"><span class="avatar sm">' + esc(F.inisial(p.nama)) + '</span><div><div class="nm">' + esc(p.nama) + (p.f.T ? ' <span class="badge b-info plain">Tahfizh</span>' : '') + '</div><div class="sm">' + p.prodi + ' · ' + esc(p.jalur) + '</div></div></div></td>' +
        '<td class="no-open">' + (hpValid(p.no_hp) ? '<a class="hp" href="' + waLink(p.no_hp) + '" target="_blank" rel="noopener">' + ic('phone', 'sm') + fmtHp(p.no_hp) + '</a> ' + waBadge(p.status_wa) : '<span class="badge b-bad plain">' + esc(p.no_hp || 'kosong') + ' · tidak valid</span>') + '</td>' +
        '<td>' + ujianBadge(p.f) + '</td><td class="c"><span class="tick ' + (p.f.D ? 'y' : 'n') + '">' + ic(p.f.D ? 'check' : 'x', 'sm') + '</span></td>' +
        '<td>' + bayarBadge(p.f) + '</td><td class="no-open">' + respSel(p) + '</td>' +
        '<td>' + (p.catatan ? '<span class="tag-mini clamp2" style="max-width:180px;white-space:normal">' + esc(p.catatan) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td>' + esc(p.asrama || '—') + '</td><td>' + (p.info ? '<span class="tag-mini">' + esc(p.info) + '</span>' : '—') + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="table-foot"><span>Menampilkan <b>' + (off + 1) + '–' + (off + rows.length) + '</b> dari <b>' + F.n(semua.length) + '</b> data · ' + esc(st.jalur === 'Semua' ? 'Semua jalur' : st.jalur) + (st.prodi !== 'Semua' ? ' · ' + st.prodi : '') + '</span>' + pagerHtml(semua.length, st.page, st.per) + '</div></div>';
    const kartu = '<div class="mlist">' + rows.map(p => {
      const b = bayarStatus(p.f);
      return '<div class="mcard" data-id="' + p.id + '"><div class="top"><div data-open style="min-width:0;cursor:pointer"><div class="nm">' + esc(p.nama) + ' ' + (p.respon !== '-' ? responBadge(p.respon) : '') + '</div><div class="sub">' + esc(prodiLabel(p.prodi)) + ' (' + p.prodi + ') · ' + esc(p.jalur) + '</div></div>' +
        '<div class="acts">' + (hpValid(p.no_hp) ? '<a class="round-btn call" href="tel:' + hp08(p.no_hp) + '" aria-label="Telepon">' + ic('phone', 'sm') + '</a><a class="round-btn wa" href="' + waLink(p.no_hp) + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + ic('message-circle', 'sm') + '</a>' : '') + '</div></div>' +
        '<div class="kv" data-open><div><span>Ujian</span><b>' + (p.f.u === '1' ? '<span style="color:var(--ok-fg)">Lulus</span>' : p.f.u === '0' ? '<span style="color:var(--bad-fg)">Tidak lulus</span>' : 'Belum tes') + '</b></div>' +
        '<div><span>Registrasi</span><b>' + esc(p.registrasi || '-') + '</b></div><div><span>Pangkal</span><b>' + esc(p.pangkal || '-') + '</b></div><div><span>UKT / Lunas</span><b class="' + (p.f.L ? '' : '') + '">' + esc([p.ukt, p.lunas].filter(Boolean).join(' / ') || '-') + '</b></div></div>' +
        '<div class="chips"><span class="badge ' + b[1] + '">' + b[0] + '</span>' + (p.asrama ? '<span class="tag-mini">' + ic('house', 'sm') + esc(p.asrama) + '</span>' : '') + (p.info ? '<span class="tag-mini">' + esc(p.info) + '</span>' : '') +
        (p.f.T ? '<span class="tag-mini">' + ic('book-open', 'sm') + 'Tahfizh</span>' : '') + (p.catatan ? '<span class="tag-mini">' + esc(p.catatan.slice(0, 40)) + '</span>' : '') + '</div>' +
        (admin ? '<div class="row mt12"><label class="check"><input type="checkbox" data-cek="' + p.id + '" ' + (st.sel.has(p.id) ? 'checked' : '') + '> Pilih</label><div style="margin-left:auto;max-width:60%">' + respSel(p) + '</div></div>' : '') + '</div>';
    }).join('') + '<div class="row" style="justify-content:center">' + pagerHtml(semua.length, st.page, st.per) + '</div><p class="small muted" style="text-align:center">Menampilkan ' + (off + 1) + '–' + (off + rows.length) + ' dari ' + F.n(semua.length) + ' data</p></div>';
    box.innerHTML = tbl + kartu;
  }
  function renderBulk(el) {
    const box = el.querySelector('[data-r="bulk"]'), n = st.sel.size;
    box.innerHTML = n && isAdmin() ? '<div class="bulkbar"><b>' + n + ' dipilih</b><select class="select" data-act-sel style="width:auto;min-height:36px;color:var(--text)"><option value="">Ubah respon…</option>' +
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
        (isAdmin() ? '<button class="btn btn-soft" data-surat>' + ic('file-pen-line') + 'Buat surat</button><button class="btn btn-primary" data-simpan>Simpan respon</button>' : '') });
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
    const l0 = teks.split('\n')[0] || '', delim = l0.indexOf('\t') > -1 ? '\t' : (l0.split(';').length > l0.split(',').length ? ';' : ',');
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
  function validasi(T) {
    const data = T.header ? T.rows.slice(1) : T.rows, H = T.header ? T.rows[0] : [];
    const items = data.map((r, i) => {
      const src = { ekstra: {} };
      T.peta.forEach((f, c) => { const v = r[c] == null ? '' : r[c]; if (!f) return; if (f === 'ekstra') { if (v) src.ekstra[H[c] || 'kolom_' + (c + 1)] = v; } else src[f] = v; });
      const j = normJalur(src.jalur) || normJalur(T.bJalur), p = normProdi(src.prodi) || normProdi(T.bProdi);
      return { i, src, j, p, nama: String(src.nama || '').trim(), hp: hp08(src.no_hp), st: 'ok', pesan: [] };
    });
    const perNama = {}, perKunci = {}, perHp = {};
    items.forEach(it => { const kn = it.nama.toLowerCase().replace(/[^a-z]/g, ''); (perNama[kn] = perNama[kn] || []).push(it);
      const k = (hpValid(it.hp) ? it.hp : 'x') + '|' + kn; (perKunci[k] = perKunci[k] || []).push(it); if (hpValid(it.hp)) (perHp[it.hp] = perHp[it.hp] || []).push(it); });
    items.forEach(it => {
      const bad = m => { it.st = 'bad'; it.pesan.push(m); }, warn = m => { if (it.st !== 'bad') it.st = 'warn'; it.pesan.push(m); };
      if (!it.nama) bad('Nama kosong');
      if (!it.j) bad('Jalur tidak dikenali' + (it.src.jalur ? ' ("' + it.src.jalur + '")' : ''));
      if (!it.p) bad('Prodi tidak dikenali' + (it.src.prodi ? ' ("' + it.src.prodi + '")' : ''));
      const kn = it.nama.toLowerCase().replace(/[^a-z]/g, ''), k = (hpValid(it.hp) ? it.hp : 'x') + '|' + kn;
      if (it.nama && perKunci[k].length > 1 && perKunci[k][0] !== it) bad('Duplikat baris ' + (perKunci[k][0].i + 1 + (T.header ? 1 : 0)));
      if (!hpValid(it.hp)) warn(it.hp ? 'Nomor HP tidak valid' : 'Nomor HP kosong');
      else if (perHp[it.hp].length > 1 && perHp[it.hp].some(x => x.nama.toLowerCase().replace(/[^a-z]/g, '') !== kn)) warn('Nomor HP dipakai pendaftar lain');
      if (it.nama && perNama[kn].length > 1 && perKunci[k].length === 1) warn('Nama kembar');
      if (it.src.tahfizh && !KOSONG.test(it.src.tahfizh) && it.j && it.j !== 'Sore') warn('Tahfizh di luar kelas Sore');
    });
    return items;
  }
  function bukaTempel() {
    if (!isAdmin()) return;
    const T = { teks: '', rows: [], header: true, peta: [], bJalur: '', bProdi: '', mode: 'timpa', items: [] };
    const m = modal({ title: 'Tempel data pendaftar', sub: 'Salin baris dari Excel/aplikasi pendaftaran (termasuk judul kolom), lalu tempel di bawah.', size: 'xwide', body: '<div data-step></div>', foot: '<div data-foot class="row" style="width:100%;justify-content:flex-end"></div>' });
    const body = m.el.querySelector('[data-step]'), foot = m.el.querySelector('[data-foot]');
    const optJ = v => '<option value="">— dari kolom data —</option>' + JALUR.map(j => '<option ' + (v === j ? 'selected' : '') + '>' + j + '</option>').join('');
    const optP = v => '<option value="">— dari kolom data —</option>' + PRODI.map(p => '<option value="' + p + '" ' + (v === p ? 'selected' : '') + '>' + p + ' — ' + esc(prodiLabel(p)) + '</option>').join('');
    function langkah1() {
      body.innerHTML = '<div class="field"><label>Data dari Excel <span class="opt">Ctrl+A → Ctrl+C di sheet, lalu Ctrl+V di sini</span></label><textarea class="textarea paste-area" id="tTeks" placeholder="NAMA&#9;NO HP&#9;JALUR&#9;PRODI&#9;UJIAN&#9;REGISTRASI&#9;UKT&#9;LUNAS&#9;CATATAN&#9;INFO">' + esc(T.teks) + '</textarea></div>' +
        '<div class="form-grid"><div class="field"><label>Jalur bawaan <span class="opt">bila kolom jalur tidak ada</span></label><select class="select" id="tJ">' + optJ(T.bJalur) + '</select></div>' +
        '<div class="field"><label>Prodi bawaan <span class="opt">mis. menempel isi sheet R-HES</span></label><select class="select" id="tP">' + optP(T.bProdi) + '</select></div></div>' +
        '<div class="callout info">' + ic('info', 'sm') + '<div>Kolom dikenali otomatis dari judulnya (Nama, No HP, Jalur, Prodi, Ujian, Registrasi, Pangkal, UKT, Lunas, Catatan, Depo, Asrama, Info, Tahfizh). Kolom lain tetap disimpan sebagai info tambahan.</div></div>';
      foot.innerHTML = '<button class="btn btn-ghost" data-contoh>' + ic('file-text') + 'Isi contoh</button><button class="btn btn-ghost" data-x>Batal</button><button class="btn btn-primary" data-lanjut>Periksa data ' + ic('arrow-right') + '</button>';
      foot.querySelector('[data-x]').onclick = m.close;
      foot.querySelector('[data-contoh]').onclick = () => { $('#tTeks').value = 'NAMA\tNO HP\tJALUR\tPRODI\tUJIAN\tREGISTRASI\tUKT\tLUNAS\tCATATAN\tINFO\tTAHFIZH\nAhmad Fauzi\t0812-3456-7890\tReguler\tHES\tLulus\tv\tv\t\t\tInstagram\t\nSiti Aminah\t089876543210\tSore\tEI\tLulus\t\t\t\tCICIL UKT\tTeman\tya\nMuhammad Farhan\t085612345678\tReguler\tPAI\t\t\t\t\t\tBrosur\t'; };
      foot.querySelector('[data-lanjut]').onclick = () => {
        T.teks = $('#tTeks').value; T.bJalur = $('#tJ').value; T.bProdi = $('#tP').value;
        T.rows = parseTabel(T.teks);
        if (T.rows.length < 1) return toast('Tempel data terlebih dahulu.', 'warn');
        T.header = T.rows[0].filter(h => Object.keys(ALIAS).some(k => ALIAS[k].indexOf(nh(h)) > -1)).length >= 2;
        T.peta = tebakPeta(T.rows, T.header);
        if (T.rows.length > 6001) return toast('Maksimal 6.000 baris per penempelan.', 'warn');
        langkah2();
      };
    }
    function langkah2() {
      T.items = validasi(T);
      const ok = T.items.filter(x => x.st !== 'bad'), bad = T.items.filter(x => x.st === 'bad'), warn = T.items.filter(x => x.st === 'warn');
      const dist = {}; ok.forEach(x => { const k = x.j + ' · ' + x.p; dist[k] = (dist[k] || 0) + 1; });
      const H = T.header ? T.rows[0] : T.rows[0].map((_, i) => 'Kolom ' + (i + 1)), wajibAda = ['nama'].filter(f => T.peta.indexOf(f) < 0);
      body.innerHTML = '<div class="row-between mb8"><div class="flabel">Pemetaan kolom (' + H.length + ' kolom terbaca)</div><label class="check small"><input type="checkbox" id="tHdr" ' + (T.header ? 'checked' : '') + '> Baris pertama adalah judul kolom</label></div>' +
        '<div class="map-row mb16">' + H.map((h, i) => '<div class="map-col"><div class="h" title="' + esc(h) + '">' + esc(h || '(kosong)') + '</div><select class="select" data-map="' + i + '">' + FIELD.map(f => '<option value="' + f[0] + '" ' + (T.peta[i] === f[0] ? 'selected' : '') + '>' + f[1] + '</option>').join('') + '</select></div>').join('') + '</div>' +
        (wajibAda.length ? '<div class="callout bad mb16">' + ic('circle-x', 'sm') + 'Pilih kolom untuk <b>Nama</b>.</div>' : '') +
        '<div class="stat-row"><div class="stat"><div class="ico">' + ic('list') + '</div><div><div class="lbl">Baris terbaca</div><div class="val">' + F.n(T.items.length) + '</div></div></div>' +
        '<div class="stat"><div class="ico" style="background:var(--ok-bg);color:var(--ok-fg)">' + ic('circle-check') + '</div><div><div class="lbl">Siap disimpan</div><div class="val">' + F.n(ok.length) + '</div></div></div>' +
        '<div class="stat"><div class="ico" style="background:var(--warn-bg);color:var(--warn-fg)">' + ic('triangle-alert') + '</div><div><div class="lbl">Peringatan</div><div class="val">' + F.n(warn.length) + '</div></div></div>' +
        '<div class="stat"><div class="ico" style="background:var(--bad-bg);color:var(--bad-fg)">' + ic('circle-x') + '</div><div><div class="lbl">Tidak disimpan</div><div class="val">' + F.n(bad.length) + '</div></div></div></div>' +
        '<div class="chips mb16"><span class="chip-row-label">Terpisah otomatis:</span>' + Object.keys(dist).sort().map(k => '<span class="chip soft-on">' + esc(k) + ' <span class="n">' + dist[k] + '</span></span>').join('') + '</div>' +
        (bad.length || warn.length ? '<details class="mb16" ' + (bad.length ? 'open' : '') + '><summary class="bold" style="cursor:pointer">Baris bermasalah (' + (bad.length + warn.length) + ') — dilaporkan, bukan diabaikan diam-diam</summary><div class="table-wrap mt8" style="max-height:200px"><table class="t"><tbody>' +
          bad.concat(warn).slice(0, 150).map(x => '<tr class="' + x.st + '"><td class="muted">Baris ' + (x.i + 1 + (T.header ? 1 : 0)) + '</td><td class="bold">' + esc(x.nama || '(tanpa nama)') + '</td><td>' + esc(x.pesan.join(' · ')) + '</td><td>' + (x.st === 'bad' ? '<span class="badge b-bad">Tidak disimpan</span>' : '<span class="badge b-warn">Tetap disimpan</span>') + '</td></tr>').join('') + '</tbody></table></div></details>' : '') +
        '<div class="flabel mb8">Pratinjau 30 baris pertama</div><div class="table-card mb16"><div class="table-wrap" style="max-height:300px"><table class="t"><thead><tr><th>#</th><th>Nama</th><th>No HP</th><th>Jalur</th><th>Prodi</th><th>Ujian</th><th>Registrasi</th><th>UKT</th><th>Lunas</th><th>Catatan</th><th>Info</th></tr></thead><tbody>' +
        T.items.slice(0, 30).map(x => '<tr class="' + (x.st === 'ok' ? '' : x.st) + '"><td class="muted">' + (x.i + 1) + '</td><td class="bold">' + esc(x.nama) + '</td><td>' + esc(x.hp || x.src.no_hp || '') + '</td><td>' + esc(x.j || '?') + '</td><td>' + esc(x.p || '?') + '</td><td>' + esc(x.src.ujian || '') + '</td><td>' + esc(x.src.registrasi || '') + '</td><td>' + esc(x.src.ukt || '') + '</td><td>' + esc(x.src.lunas || '') + '</td><td>' + esc(x.src.catatan || '') + '</td><td>' + esc(x.src.info || '') + '</td></tr>').join('') + '</tbody></table></div></div>' +
        '<div class="grid g2"><label class="card card-pad check" style="align-items:flex-start"><input type="radio" name="tMode" value="timpa" ' + (T.mode === 'timpa' ? 'checked' : '') + '><div><b>Timpa seluruh data</b> <span class="badge b-peach plain">Sinkronisasi penuh</span><div class="help mt8">Data di aplikasi diganti dengan tempelan ini. Pendaftar yang tidak ada di tempelan akan dihapus. Respon manual & status WA tetap dipertahankan (dicocokkan lewat nomor HP).</div></div></label>' +
        '<label class="card card-pad check" style="align-items:flex-start"><input type="radio" name="tMode" value="tambah" ' + (T.mode === 'tambah' ? 'checked' : '') + '><div><b>Tambahkan data baru</b><div class="help mt8">Hanya pendaftar yang belum ada yang ditambahkan. Data lama tidak diubah.</div></div></label></div>' +
        '<label class="check mt16" id="tKonf"><input type="checkbox" id="tYakin"> Saya sudah memeriksa pratinjau' + (App.P.length ? ' dan paham <b>&nbsp;' + F.n(App.P.length) + ' data lama&nbsp;</b> akan disinkronkan' : '') + '.</label>';
      foot.innerHTML = '<button class="btn btn-ghost" data-back>' + ic('arrow-left') + 'Kembali</button><button class="btn btn-primary" data-save ' + (ok.length && !wajibAda.length ? '' : 'disabled') + '>' + ic('cloud-upload') + 'Simpan ' + F.n(ok.length) + ' baris</button>';
      $$('[data-map]', body).forEach(s => s.onchange = () => { T.peta[+s.dataset.map] = s.value; langkah2(); });
      $('#tHdr').onchange = e => { T.header = e.target.checked; T.peta = tebakPeta(T.rows, T.header); langkah2(); };
      $$('[name=tMode]', body).forEach(r => r.onchange = () => { T.mode = r.value; });
      foot.querySelector('[data-back]').onclick = langkah1;
      foot.querySelector('[data-save]').onclick = () => { if (!$('#tYakin').checked) { toast('Centang konfirmasi pemeriksaan terlebih dahulu.', 'warn'); $('#tKonf').scrollIntoView({ block: 'center' }); return; } simpan(ok); };
    }
    async function simpan(ok) {
      const kirim = ok.map(x => Object.assign({}, x.src, { _baris: x.i + 1 + (T.header ? 1 : 0) })), bawaan = { jalur: T.bJalur, prodi: T.bProdi };
      body.innerHTML = '<div class="empty"><span class="spin"></span><b id="tProg">Mengirim data…</b><div class="progress" style="width:min(420px,80vw)"><i id="tBar" style="width:5%"></i></div><div class="help">Jangan tutup halaman ini. Data dikirim bertahap agar aman di jaringan HP.</div></div>';
      foot.innerHTML = '';
      let r;
      if (kirim.length <= 500) { $('#tBar').style.width = '40%'; r = await api('pendaftarSimpan', { mode: T.mode, bawaan, rows: kirim }); }
      else {
        const sid = Date.now().toString(36), PER = 400, parts = Math.ceil(kirim.length / PER);
        for (let i = 0; i < parts; i++) {
          $('#tProg').textContent = 'Mengirim potongan ' + (i + 1) + ' dari ' + parts + '…'; $('#tBar').style.width = Math.round((i + 1) * 80 / parts) + '%';
          const s = await api('pendaftarStage', { sid, part: i, rows: kirim.slice(i * PER, (i + 1) * PER) });
          if (!s.success) { r = s; break; }
        }
        if (!r) { $('#tProg').textContent = 'Menyimpan & menghitung ulang dasbor…'; r = await api('pendaftarSimpan', { mode: T.mode, bawaan, sid, parts }); }
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
  window.MhsTempel = { parseTabel, tebakPeta, validasi };
})();
