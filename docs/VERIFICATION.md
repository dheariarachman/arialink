# Status verifikasi — 1 November 2026

## Snapshot akhir Saldo, Utang, dan Piutang — 1 November 2026

- Scope: satu nilai terakhir per sumber saat **Tutup Hari**. Tidak ada daftar edit satu per satu pada detail Saldo Harian, tidak ada timeline pembayaran baru, dan tidak ada log mutasi utang/piutang baru. Audit Saldo internal yang sudah ada tetap dipertahankan.
- `npm test`: **43 kasus lulus**; `npm run check` dan `npm run cf:build` lulus. Kasus baru mencakup beberapa edit DANA yang menghasilkan satu nilai akhir Rp 1.000.000, gabungan Piutang langsung/transaksi, admin terpisah, sumber lunas/dihapus, angka nol, batas integer, dan detail lama tetap sama setelah settlement/edit/delete.
- `0004_financial_snapshots.sql` diuji dengan membandingkan kolom lama penutupan, record, receipt, dan audit sebelum/sesudah migrasi. Tidak ada perubahan nilai lama, semua foreign key valid, dan proteksi immutable mencakup kolom snapshot baru.
- Tinjauan lama tanpa versi 2/revisi keuangan ditolak dengan instruksi pembaruan. Replay ID penutupan lama yang sudah berhasil tetap mengembalikan hasil semula. Piutang/Utang yang berubah saat tinjauan terbuka, termasuk race setelah pembacaan server, menggagalkan konfirmasi; transaksi biasa tanpa Piutang tidak membatalkan tinjauan keuangan.
- Penjelasan tetap wajib saat Dana tersedia dan Utang sama-sama turun meskipun Grand total tetap. Penutupan lengkap pertama setelah penutupan legacy menampilkan baseline komponen baru, bukan perbandingan dengan nol.
- **18 pemeriksaan fixture browser lulus**, termasuk snapshot lengkap di IndexedDB, respons konfirmasi hilang setelah commit dan retry, isolasi akun, snapshot Piutang tetap setelah settlement, dan regresi sinkronisasi/antrean lama.
- Worker produksi OpenNext dengan D1 lokal terisolasi: review empat total, tiga tab, konfirmasi, stale debt review dan refresh, detail Saldo/Utang/Piutang, shortcut penutupan terakhir, navigasi data saat ini, serta cakupan legacy lulus. DANA tersimpan Rp 1.000.000 sementara data saat ini berubah menjadi Rp 900.000; Utang/Piutang tersimpan masing-masing Rp 200.000 meskipun data saat ini sudah dilunasi.
- Reload offline dengan service worker mempertahankan detail Piutang historis yang belum lunas. Tombol edit/Bayar/Lunasi tidak tersedia pada snapshot. Link data saat ini membuka versi baru tanpa mengganti snapshot lama.
- Dokumen tidak meluap pada 360 / 390 / 720 / 768 / 1440 CSS px; tabel lebar tetap dapat digeser. Dialog 390 px berada dalam viewport, Tab menuju dialog, Escape menutup. Ini bukan bukti pengujian zoom browser asli, screen reader, Safari, atau perangkat Android/iOS nyata.
- Migration 0004 diterapkan ke D1 lokal normal dan produksi setelah backup privat terverifikasi. Jumlah record/receipt/closing produksi tetap sama dengan backup dan foreign-key check kosong; tidak ada penutupan uji di produksi. Version rilis: `19190a78-4bcb-4a20-88dd-2c44a0e8ee56`; versi sebelumnya: `99631fba-2c19-4f3b-9869-8e4f0faae630`. Pemeriksaan Chromium produksi memastikan BUILD_ID cocok dengan build lokal, bundle snapshot lengkap/shortcut terbaru termuat tanpa panel perubahan per-edit, service worker v7 tersedia, dan state/review tanpa sesi tetap 401. Pengujian detail berautentikasi dilakukan di fixture lokal; tidak membuat penutupan produksi.

Bukti fixture: [laporan desktop](screenshots/financial-snapshot-desktop.png), [detail Piutang mobile](screenshots/financial-snapshot-mobile.png), dan [panduan snapshot lengkap](DAILY_BALANCES.md).

## Rilis produksi Saldo Harian — 1 November 2026

- URL: [ARIALink](https://arialink.dheariarachman.workers.dev).
- Sebelum rilis, export D1 disimpan privat di folder `.wrangler/backups/` yang diabaikan Git. Restore ke SQLite in-memory lulus integrity check dan foreign-key check. Versi Worker sebelumnya dicatat untuk rollback kode.
- Migration `0003_daily_closings.sql` diterapkan ke D1 produksi `arialink`. Jumlah record dan receipt setelah migrasi sama dengan backup; foreign-key check kosong. Tidak ada data penutupan uji yang dibuat di produksi.
- `wrangler deploy --dry-run` lulus, kemudian `npm run cf:deploy:built` merilis build OpenNext yang sudah diuji. Version ID: `99631fba-2c19-4f3b-9869-8e4f0faae630`; versi sebelumnya: `3abcfb95-898d-4698-a123-bc7c2b2ad1e1`.
- Pemeriksaan Chromium pada URL produksi: login tampil, BUILD_ID cocok dengan build lokal, bundle Saldo Harian/konfirmasi baru termuat, service worker memakai cache v6, dan GET state serta closing review tanpa sesi sama-sama menghasilkan 401.
- Uji end-to-end dengan akun dan penutupan dilakukan pada database lokal terisolasi, bukan melalui penutupan keuangan produksi. Pengguna perlu masuk dan melakukan Tutup Hari untuk membuat snapshot produksi pertama. Pengguna PWA lama mungkin perlu memilih **Perbarui aplikasi** atau memuat ulang.
- Rollback hanya kode bila diperlukan; pertahankan tabel, riwayat, dan snapshot penutupan sesuai [panduan rollback](DAILY_BALANCES.md).

## Saldo Harian dan Tutup Hari — 1 November 2026

- `npm test`: **36 kasus lulus**, termasuk total dan snapshot server, perbandingan ID sumber, saldo nol, tanggal WIB, hari terlewat, alasan, autentikasi, origin, retry, konkurensi, dan preservasi migrasi.
- `npm run check` dan `npm run cf:build` lulus pada source akhir. Build OpenNext mencakup kompilasi JSX dan build produksi Next.js.
- `0003_daily_closings.sql` lulus di D1 lokal terisolasi. Migrasi yang sama diterapkan ke database lokal normal proyek; tidak ada penutupan uji yang dibuat di database normal. Pada tahap pengujian lokal belum ada migrasi remote atau deployment produksi; rilis berikutnya dicatat di atas.
- Chromium dengan Worker OpenNext dan D1 lokal terisolasi: Laporan → Saldo Harian, tinjauan Rp 15.000 → Rp 14.000, alasan wajib, konfirmasi, nama/waktu penutup, perbandingan rekening/kas, dan riwayat alasan lulus. Semua nilai pada screenshot adalah fixture pengujian.
- Perubahan rekening saat tinjauan terbuka menghasilkan penolakan stale review. Muat ulang tinjauan dan konfirmasi menyimpan tepat satu penutupan. Uji SQL juga menyisipkan perubahan setelah pembacaan server dan mensimulasikan pergantian tanggal sebelum conditional INSERT; keduanya menolak konfirmasi lama.
- Dua penutup bersamaan menghasilkan satu penutupan. Retry ID yang sama mengembalikan hasil yang sama. UPDATE/DELETE snapshot ditolak oleh database. Input total, nama penutup, dan snapshot dari klien tidak mengubah hasil server.
- Setelah penutupan Rp 14.000, perubahan rekening menurunkan saldo terkini menjadi Rp 13.000; UI menampilkan keduanya dan snapshot tetap Rp 14.000. Recovery antrean lama berikutnya mengubah saldo terkini menjadi Rp 12.000 tanpa menimpa penutupan.
- PWA produksi: service worker siap, jaringan browser diputus, reload offline, navigasi kembali ke Saldo Harian, dan pembacaan detail/alasan penutupan lulus. Tutup Hari tetap online saja.
- **17 pemeriksaan fixture browser lulus**, mencakup regresi IndexedDB/sinkronisasi sebelumnya serta alasan offline, respons penutupan hilang setelah commit dan retry, isolasi cache per akun, dan perbaikan antrean versi lama yang belum memiliki alasan. Dialog recovery juga diuji pada UI produksi lokal.
- Lebar 360 / 390 / 720 / 768 / 1440 CSS px tidak meluapkan dokumen; tabel dapat digeser horizontal. Dialog pada 390 px berada dalam viewport. Tab menempatkan fokus di dialog dan Escape menutupnya. Pengujian ini tidak membuktikan zoom browser asli, perangkat iOS/Android nyata, Safari, atau screen reader.
- Audit receipt saldo pada salinan lokal menemukan versi berurutan; receipt tidak dipakai untuk membuat penutupan historis karena tidak membuktikan konfirmasi pengguna. Riwayat pendukung baru mulai dari migrasi dan waktu awalnya ditampilkan pada detail.

Bukti: [laporan desktop](screenshots/daily-balance-desktop.png), [detail mobile](screenshots/daily-balance-mobile-detail.png), dan [aturan pemakaian, migrasi, serta rollback](DAILY_BALANCES.md). Bagian di bawah mencatat pemeriksaan versi sebelumnya.

## Piutang transaksi dan pelunasan penuh — 30 Oktober 2026

- `npm test` lulus pada 6 file uji. `node --test --test-isolation=none --test-reporter=spec tests/*.test.mjs` membuktikan **27 kasus lulus**: domain, API, migrasi, PWA, dan piutang transaksi.
- `npm run check`, `npm run build`, dan `npm run cf:build` lulus. Worker diuji dari build OpenNext dengan D1 lokal terisolasi; tidak memakai database produksi.
- **9 kelompok pemeriksaan Chromium lulus**, termasuk pembuatan transaksi Belum dibayar, penolakan tagihan nol, perubahan dari detail piutang ke transaksi asal, pelunasan dari Detail transaksi maupun Utang & Piutang, Batal, validasi tanggal, dan dua submit bersamaan yang hanya menyimpan satu pelunasan.
- Penerimaan nol sebelum lunas; laba mengikuti tanggal transaksi. Pelunasan penuh masuk penerimaan pada tanggal pembayaran tanpa menghitung laba lagi. Laporan menampilkan pelunasan yang transaksinya berasal dari periode lain. Saldo rekening manual tetap sama.
- PWA produksi: service worker aktif, pembuatan transaksi offline, reload offline, pelunasan penuh offline, reload lagi, respons sinkronisasi hilang setelah server commit, lalu retry lulus. Server menyimpan satu transaksi versi 2 dengan satu pelunasan, tanpa record piutang terpisah.
- Konflik dua pelunasan penuh menampilkan kedua versi dan memblokir pilihan menimpa pelunasan server. Menggunakan data server mempertahankan satu pelunasan. API dan IndexedDB juga menolak cicilan serta penghapusan / perubahan pelunasan tersimpan.
- Lebar 360 / 390 / 768 / 1440 CSS px dan viewport 720 CSS px dengan device scale factor 2 tidak meluapkan halaman. Dialog mobile berada dalam viewport; Tab tetap di dialog dan Escape membatalkan. Ini bukan pengujian zoom browser asli atau perangkat Android/iOS nyata.
- Fixture IndexedDB: **15 kasus browser lulus**, termasuk isolasi akun, versi lama, respons hilang, pembayaran penuh, konflik, pembatalan catatan, dan transaksi berpiutang.
- Histori cicilan lama diuji melalui fixture database langsung: riwayat tidak dihapus / ditulis ulang dan hanya pelunasan seluruh sisa yang dapat ditambahkan. Sinkronkan antrean versi lama sebelum rollout; [aturan pembaruan](DEBTS.md) menjelaskan kompatibilitas klien dan rollback.

Bukti: [hasil browser](screenshots/transaction-credit-browser-results.json), [form mobile](screenshots/transaction-credit-mobile-form.png), [konfirmasi pelunasan mobile](screenshots/transaction-credit-mobile-settle.png), [daftar desktop](screenshots/transaction-credit-desktop-debts.png), [detail mobile](screenshots/transaction-credit-mobile-detail.png), dan [laporan penerimaan](screenshots/transaction-credit-report.png).

Tidak ada migrasi SQL baru atau deployment produksi. Koreksi nominal / tanggal dan penghapusan transaksi setelah pelunasan tidak tersedia. Bagian di bawah merupakan bukti historis versi sebelumnya; pembayaran sebagian kini digantikan aturan pelunasan penuh.


## Filter jenis dan pelunasan langsung — 30 Oktober 2026

- `npm test`, `npm run check`, dan `npm run cf:build` lulus; build Cloudflare juga mengompilasi JSX dan build produksi Next.js.
- Chromium pada Worker OpenNext dan D1 lokal terisolasi: filter Semua / Utang / Piutang, jumlah hasil, pesan kosong per jenis, catatan lunas tetap terlihat, dan ringkasan global tetap sama saat filter berubah lulus.
- Tombol Lunasi membuka konfirmasi langsung tanpa Detail. Pelunasan kedua jenis, sisa setelah pembayaran sebagian, riwayat tetap lengkap, catatan pembayaran, Batal, tanggal WIB, serta tanggal pembayaran sebelum catatan ditolak lulus. Catatan bertanggal masa depan memerlukan tanggal pembayaran yang sesuai.
- Dua submit pada giliran event yang sama hanya menyimpan satu pembayaran. Versi lokal berubah saat konfirmasi terbuka ditolak. Konflik dengan pembayaran perangkat lain tetap meminta peninjauan; setelah memilih server, pelunasan hanya memakai sisa terbaru. Saldo bank manual tetap sama.
- PWA produksi: pelunasan sebagian yang diselesaikan offline, reload offline, dan sambung ulang menghasilkan tepat satu pembayaran akhir pada server. Tidak mengakses database produksi.
- Lebar 360 / 390 / 768 / 1440 CSS px dan viewport setara zoom 200% tidak meluapkan halaman. Tabel tetap digeser horizontal untuk tindakan di layar kecil. Target sentuh mobile minimal 44 px, fokus terjaga di dialog, Escape membatalkan, dan fokus kembali ke filter terpilih setelah tombol Lunasi hilang.
- Fixture IndexedDB: **13 pengujian browser lulus**, termasuk regresi pelunasan versi lama, kirim ganda, dan pelunasan sebesar sisa terbaru.

Bukti terbaru: [hasil browser](screenshots/debt-view-browser-results.json), [filter Utang](screenshots/debt-views-utang.png), [filter Piutang](screenshots/debt-views-piutang.png), [daftar mobile](screenshots/debt-views-mobile.png), dan [konfirmasi mobile](screenshots/debt-views-mobile-settle.png). Tidak ada migrasi database baru atau deployment produksi. Pengujian Android/iOS nyata dan Safari tetap belum dilakukan.

## Pemeriksaan otomatis

- `npm test`: seluruh 5 file uji lulus (20 kasus yang didefinisikan), termasuk domain, API, migrasi, dan service worker.
- `npm run check`: syntax JavaScript dan package JSON lulus.
- `npm run build`: kompilasi JSX, build produksi Next.js, dan pembuatan halaman statis lulus.
- `npm run cf:build`: build produksi Next.js dan bundling Worker OpenNext lulus.
- Uji migrasi membandingkan seluruh kolom record dan receipt sebelum/sesudah `0002_debts.sql`; versi, tombstone, timestamp, penulis, payload, dan penanda retry tetap identik. Penulisan jenis lama/baru, retry, serta pemeriksaan foreign key lulus.
- Uji utang / piutang mencakup kedua jenis, tanggal WIB, pembayaran sebagian/penuh, nominal tidak valid, pembayaran berlebih, ID pembayaran berulang, edit yang melanggar riwayat, penghapusan, total negatif, saldo manual tetap, dan laporan laba yang tidak memasukkan pembayaran utang.
- Uji API mencakup pengguna bersama, validasi server, retry idempotent, konflik pembayaran bersamaan, dan penolakan edit/hapus dengan versi lama.

## Browser dan runtime Cloudflare lokal — fitur awal, 29 Oktober 2026

Dijalankan dengan Chromium headless melalui Chrome DevTools Protocol, Worker hasil OpenNext, dan D1 lokal terisolasi pada folder sementara. Kredensial/data fixture dibuat khusus pengujian; database remote dan data usaha tidak diakses.

- Migrasi diterapkan melalui Wrangler ke D1 lokal terisolasi.
- UI: pembuatan Piutang/Utang, pembayaran sebagian/penuh, penolakan pembayaran berlebih, edit nominal, status Lunas, hapus, dan grand total sesuai rumus lulus.
- Layout pada lebar 360, 390, 768, dan 1440 CSS px tidak meluapkan halaman. Tabel tetap dapat digeser horizontal. Dialog formulir pada 390 px tetap di dalam viewport.
- Layout setara pembesaran 200% diuji dengan viewport 720 CSS px dan device scale factor 2. Ini bukan pengujian pengaturan zoom asli browser atau semua pengaturan pembesaran teks.
- Tab mempertahankan fokus di dalam dialog utang / piutang; Escape menutup dialog.
- PWA produksi: login online, service worker aktif, reload online, pemutusan jaringan browser, pencatatan piutang dan pembayaran offline, reload offline, lalu penyambungan ulang lulus. Server menyimpan tepat satu record dengan satu pembayaran dan versi yang sesuai; saldo rekening manual tetap sama.
- Konflik pembayaran bersamaan ditampilkan dengan kedua riwayat. Memilih data server lalu memasukkan ulang pembayaran lokal mempertahankan kedua pembayaran.
- Fixture `npm run test:browser`: **12 pengujian browser lulus**, termasuk IndexedDB, respons hilang setelah commit, retry, isolasi akun, konflik, pelunasan, dan tombstone utang / piutang.

Hasil ringkas tersimpan pada [debt-browser-results.json](screenshots/debt-browser-results.json). Untuk preview OpenNext lokal, gunakan hostname `localhost`; permintaan mutasi dari alamat IP `127.0.0.1` ditolak pemeriksaan origin pada konfigurasi preview yang diuji.

## Screenshot data fixture

- [Dashboard dan grand total](screenshots/debts-dashboard.png)
- [Utang & piutang desktop](screenshots/debts-desktop.png)
- [Utang & piutang mobile](screenshots/debts-mobile.png)
- [Formulir mobile](screenshots/debts-mobile-form.png)
- [Perbandingan konflik pembayaran](screenshots/debts-conflict.png)

## Batas pemeriksaan

Instalasi PWA pada perangkat Android/iOS nyata, Safari, pengujian screen reader, dan akses database D1 remote belum diuji. Tidak ada migrasi remote, resource cloud, atau deployment produksi yang dilakukan. Terapkan migrasi baru sebelum deployment sesuai [DEPLOYMENT.md](DEPLOYMENT.md) dan [aturan utang / piutang](DEBTS.md).

## Kredit Barang — 7 November 2026

- `npm test`: 53/53 lulus, termasuk jadwal mingguan/bulanan, DP, akhir bulan/tahun kabisat, pembulatan, pembayaran sebagian, pelunasan, pembatalan, laporan historis, periode berjalan, konflik versi, validasi sumber saldo, rollback batch, dan saldo kas.
- `npm run check`, `npm run build`, dan `npm run cf:build`: lulus.
- Fixture IndexedDB: 19 skenario browser lulus, termasuk respons operasi kredit hilang, retry menggunakan ID sama, dan isolasi operasi per akun.
- Preview Cloudflare lokal port 8791 memakai database D1 terisolasi `/tmp/arialink-goods-credit-preview`; migrasi 0001–0005 berhasil. Tidak memakai database produksi.
- Alur UI terverifikasi: membuat kredit modal Rp2.000.000/harga Rp3.000.000/DP Rp300.000/10 kali; saldo awal Rp5.000.000 menjadi Rp3.300.000 setelah modal dan DP; pembayaran Rp150.000 menambah saldo dan pembatalannya mengembalikan saldo menjadi Rp3.300.000. Riwayat pembayaran dan pembatalan tetap tersimpan.
- Desktop 1440 px dan mobile 390 px diperiksa. Lebar dokumen mobile 390 px; detail dialog berada dalam viewport dan tabel dapat digeser.
- PWA produksi lokal: service worker aktif; reload tanpa jaringan tetap menampilkan kredit tersimpan dan tombol pencatatan baru dinonaktifkan.
- Bukti: [desktop Kredit Barang](screenshots/goods-credit-desktop.png), [detail mobile](screenshots/goods-credit-mobile-detail.png).
- Batasan: pencatatan baru memerlukan internet; kontrak dan pembayaran modal belum dapat disunting/dibatalkan. Koreksi pembayaran cicilan memakai pembatalan dan pembayaran pengganti. Belum migrasi/deploy produksi.

Panduan: [GOODS_CREDIT.md](GOODS_CREDIT.md).

## Integrasi Kredit Barang ke Piutang — 7 November 2026

- `npm test`: 58/58 lulus; `npm run check`, `npm run build`, `npm run cf:build`, dan `git diff --check` lulus.
- Piutang menggunakan proyeksi kontrak asli. Tidak dibuat record debt baru. Tes mencakup DP, pembayaran sebagian, retry, pembatalan, lunas, dua kontrak pelanggan sama, sumber manual/transaksi, dan kesesuaian total live dengan snapshot.
- Migrasi 0006 diuji mempertahankan kontrak dan snapshot versi 2. Snapshot baru versi 3 menyimpan piutang kredit dan menolak tinjauan versi lama/perubahan data saat konfirmasi, termasuk perubahan kontrak tanpa mutasi saldo.
- Browser pada Cloudflare preview lokal (database uji terisolasi): filter sumber Kredit Barang, detail kontrak, Catat cicilan dari menu Piutang, pembayaran Rp150.000 dan koreksi berhasil. Piutang Rp2.700.000 menjadi Rp2.550.000 dan kembali; grand total tetap Rp6.000.000.
- Tutup Hari berhasil menyimpan piutang Kredit Barang Rp2.700.000. Dari detail snapshot, Buka data saat ini membuka kontrak asli. Pelunasan berikutnya menurunkan piutang live ke nol, sementara snapshot tersimpan tetap Rp2.700.000. Filter sembunyikan lunas bekerja.
- Desktop 1440 px dan mobile 390 px diperiksa, tanpa overflow halaman mobile. Bukti: [desktop](screenshots/credit-receivables-desktop.png), [mobile](screenshots/credit-receivables-mobile.png).
- Migrasi 0006 diterapkan pada D1 lokal default dan database preview terisolasi. Database/deployment produksi tidak diubah.

- PWA preview: setelah update service worker, reload offline masih dapat membuka piutang kredit yang lunas dan detail kontrak dari cache.

## Modal kembali terlebih dahulu — 8 November 2026

- `npm test`: 63/63 lulus. `npm run check`, `npm run cf:build` (termasuk build Next.js), dan `git diff --check` lulus.
- Regresi mencakup DP, batas modal tepat, pembayaran melewati modal, surplus per periode, koreksi yang membuka kembali piutang modal, modal nol, penjualan rugi, pelunasan, tanggal historis, periode masa depan, serta retry pembayaran.
- Piutang manual/transaksi biasa tidak berubah. Saldo tetap mengikuti penerimaan penuh. Kontrak, pembayaran, rekening, receipt, dan snapshot versi 3 tidak ditulis ulang oleh migrasi 0007; pengujian membandingkan seluruh baris sebelum/sesudah.
- Cloudflare preview lokal memakai database uji terisolasi `/tmp/arialink-goods-credit-preview`. Kontrak uji modal Rp2.000.000, harga Rp3.000.000, DP Rp300.000: piutang modal Rp1.700.000, sisa tagihan Rp2.700.000. Setelah pembayaran bersih Rp1.900.000: piutang modal Rp100.000. Setelah Rp2.200.000: piutang modal nol, sisa tagihan Rp800.000, status Modal kembali · Cicilan berjalan, tombol cicilan tetap tersedia meskipun filter sembunyikan lunas aktif.
- Laporan menampilkan surplus Rp200.000 untuk kontrak tersebut. Daftar/detail operasional tidak menampilkan angka potensi profit/surplus. Desktop 1440 px dan mobile 390 px diperiksa; lebar dokumen mobile tetap 390 px.
- Tutup Hari versi 4 menyimpan `capital-first`, modal awal/kembali, piutang modal nol, dan sisa tagihan Rp800.000. Perbandingan terhadap versi 3 menampilkan perubahan dasar dan meniadakan delta langsung piutang/grand total. Koreksi pembayaran Rp300.000 membuka piutang modal Rp100.000; snapshot versi 4 tetap identik.
- PWA diperbarui lalu dimuat ulang tanpa jaringan: piutang modal Rp100.000 dan sisa tagihan Rp1.100.000 tetap terbaca dari cache; pencatatan kredit baru dinonaktifkan.
- Migrasi 0007 diterapkan pada database lokal default dan preview terisolasi. Tidak ada migrasi/deployment produksi.
- Bukti: [piutang desktop](screenshots/capital-first-receivables-desktop.png), [piutang mobile](screenshots/capital-first-receivables-mobile.png), [laporan kredit](screenshots/capital-first-report-desktop.png), [penutupan versi 4](screenshots/capital-first-closing-desktop.png).
