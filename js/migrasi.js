/* migrasi.js — Impor data dari Excel laporan lama / app versi sebelumnya (skill gas-migrasi-database) */
'use strict';
(function () {
  const st = { sumber: '', peta: 'R=Reguler, H=Sore, S=Sore', prodiInter: 'HES', timpa: false, sheets: null, pilih: {}, hasil: null };
  registerPage('migrasi', {
    title: 'Migrasi Data', roles: ['ADMIN'], deps: [],
    template: () => '<div data-r="isi"></div>',
    mount(el) { delegate(el, 'click', '[data-act]', b => aksi(el, b)); },
    render(el) {
      el.querySelector('[data-r="isi"]').innerHTML = pageHead({ pill: 'Migrasi Database', eyebrow: ['Sumber hanya dibaca'], title: 'Impor Data Lama',
        lead: 'Pindahkan data dari Excel laporan manual (sheet R-HES, H-PAI, Inter Ikhwan, …) atau dari database aplikasi versi sebelumnya — aman diulang, tanpa data dobel.' }) +
        '<div class="grid g-side"><div class="card card-pad">' +
        '<div class="field"><label>URL atau ID Google Spreadsheet sumber *</label><input class="input" id="mgS" value="' + esc(st.sumber) + '" placeholder="https://docs.google.com/spreadsheets/d/…"><div class="help">Berkas .xlsx perlu dibuka dengan Google Spreadsheet lalu <b>File → Simpan sebagai Google Spreadsheet</b> dahulu. Harus dimiliki/dibagikan ke akun pemilik aplikasi.</div></div>' +
        '<div class="form-grid"><div class="field"><label>Arti awalan nama sheet <span class="opt">Excel lama</span></label><input class="input" id="mgP" value="' + esc(st.peta) + '"><div class="help">Contoh: sheet <b>H-HES</b> → jalur Sore, prodi HES. ES dibaca sebagai EI.</div></div>' +
        '<div class="field"><label>Prodi untuk sheet Inter tanpa kolom prodi</label><select class="select" id="mgI">' + PRODI.map(p => '<option ' + (st.prodiInter === p ? 'selected' : '') + '>' + p + '</option>').join('') + '</select></div></div>' +
        (st.sheets ? '<div class="field"><label>Sheet yang diimpor <span class="opt">profil app lama</span></label><div class="chips">' + st.sheets.map(s => '<label class="check chip"><input type="checkbox" data-sh="' + s + '" ' + (st.pilih[s] !== false ? 'checked' : '') + '> ' + s + '</label>').join('') + '</div></div>' : '') +
        '<label class="check mb16"><input type="checkbox" id="mgT" ' + (st.timpa ? 'checked' : '') + '> Timpa data yang sudah ada (bawaan: hanya menambah yang baru). Respon manual & status WA tidak pernah ditimpa.</label>' +
        '<div class="row"><button class="btn btn-white" data-act="pindai">' + ic('scan-search') + 'Pindai (dry-run)</button><button class="btn btn-primary" data-act="jalan">' + ic('database') + 'Jalankan impor</button></div>' +
        '<div data-r="hasil" class="mt22">' + hasilHtml() + '</div></div>' +
        '<div class="card card-pad"><h3 class="h3 mb16">Langkah cutover</h3><ol class="small" style="padding-left:18px;line-height:24px;margin:0">' +
        '<li>Siapkan sumber sebagai Google Spreadsheet (akun Google yang sama).</li><li><b>Pindai</b> dulu — tidak ada data yang ditulis; periksa jumlah & peringatan.</li><li><b>Jalankan impor</b> lalu cocokkan angka dasbor dengan Excel lama.</li>' +
        '<li>Tepat sebelum pindah total, jalankan impor <b>sekali lagi</b> (delta) untuk menangkap data baru.</li><li>Umumkan alamat aplikasi baru ke Tim PMB.</li></ol>' +
        '<div class="callout info mt16">' + ic('info', 'sm') + '<div>Akun & sesi tidak dimigrasi. Berkas Drive lama (bukti, lampiran) tetap terbaca bila memakai akun Google yang sama.</div></div></div></div>';
    }
  });
  function hasilHtml() {
    const h = st.hasil; if (!h) return '';
    const L = h.laporan;
    return '<div class="callout ' + (h.dryRun ? 'info' : 'ok') + ' mb16">' + ic(h.dryRun ? 'scan-search' : 'circle-check', 'sm') + '<div><b>' + esc(h.sumber.nama) + '</b> — profil ' + (h.profil === 'excel' ? 'Excel laporan lama' : 'database app lama') + (h.dryRun ? ' · <b>DRY-RUN</b> (belum ditulis)' : ' · impor selesai') + '</div></div>' +
      '<div class="table-card mb16"><div class="table-wrap"><table class="t"><thead><tr><th>Data</th><th class="r">Di sumber</th><th class="r">Ditambah</th><th class="r">Diperbarui</th><th class="r">Dilewati</th></tr></thead><tbody>' +
      Object.keys(L).map(k => '<tr><td class="bold">' + esc(k) + '</td><td class="r">' + F.n(L[k].sumber) + '</td><td class="r terracotta bold">' + F.n(L[k].ditambah) + '</td><td class="r">' + F.n(L[k].diperbarui) + '</td><td class="r muted">' + F.n(L[k].dilewati) + '</td></tr>').join('') + '</tbody></table></div></div>' +
      (h.perSheet ? '<div class="flabel mb8">Pemetaan sheet → jalur/prodi</div><div class="table-card mb16"><div class="table-wrap"><table class="t"><thead><tr><th>Sheet</th><th>Jalur</th><th>Prodi</th><th class="r">Baris</th></tr></thead><tbody>' +
        Object.keys(h.perSheet).map(s => '<tr><td>' + esc(s) + '</td><td>' + esc(h.perSheet[s].jalur) + '</td><td>' + esc(h.perSheet[s].prodi) + '</td><td class="r">' + h.perSheet[s].baris + '</td></tr>').join('') + '</tbody></table></div></div>' : '') +
      (h.peringatan.length ? '<div class="callout warn mb16">' + ic('triangle-alert', 'sm') + '<ul style="margin:0;padding-left:18px">' + h.peringatan.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul></div>' : '') +
      Object.keys(L).filter(k => L[k].contohMasalah.length).map(k => '<details><summary class="small bold" style="cursor:pointer">Contoh baris dilewati (' + esc(k) + ')</summary><ul class="small">' + L[k].contohMasalah.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></details>').join('');
  }
  async function aksi(el, b) {
    st.sumber = $('#mgS').value.trim(); st.peta = $('#mgP').value; st.prodiInter = $('#mgI').value; st.timpa = $('#mgT').checked;
    $$('[data-sh]', el).forEach(c => { st.pilih[c.dataset.sh] = c.checked; });
    if (!st.sumber) return toast('Tempel URL spreadsheet sumber.', 'warn');
    const peta = {}; st.peta.split(',').forEach(x => { const m = x.split('='); if (m[1]) peta[m[0].trim().toUpperCase()] = m[1].trim(); });
    const d = { sumber: st.sumber, peta, prodiInter: st.prodiInter, timpa: st.timpa, sheets: st.sheets ? st.sheets.filter(s => st.pilih[s] !== false) : null };
    if (b.dataset.act === 'jalan' && !(await confirmBox({ title: 'Jalankan impor?', pesan: 'Data dari sumber ditulis ke database aplikasi. Aman diulang — data yang sama tidak akan dobel.', ok: 'Jalankan impor' }))) return;
    busy(b, true, b.dataset.act === 'pindai' ? 'Memindai…' : 'Mengimpor…');
    const r = await api(b.dataset.act === 'pindai' ? 'migrasiPindai' : 'migrasiJalankan', d, { timeout: 330000 });
    busy(b, false);
    if (!r.success) return toast(r.message, 'err');
    st.hasil = r.data; if (r.data.sheetTersedia) st.sheets = r.data.sheetTersedia;
    toast(r.message); Pages.migrasi.render(el);
  }
})();
