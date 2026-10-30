# Status verifikasi — 30 Oktober 2026

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
