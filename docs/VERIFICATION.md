# Status verifikasi — 29 Oktober 2026

## Pemeriksaan otomatis

- `npm test`: seluruh 5 file uji lulus (20 kasus yang didefinisikan), termasuk domain, API, migrasi, dan service worker.
- `npm run check`: syntax JavaScript dan package JSON lulus.
- `npm run build`: kompilasi JSX, build produksi Next.js, dan pembuatan halaman statis lulus.
- `npm run cf:build`: build produksi Next.js dan bundling Worker OpenNext lulus.
- Uji migrasi membandingkan seluruh kolom record dan receipt sebelum/sesudah `0002_debts.sql`; versi, tombstone, timestamp, penulis, payload, dan penanda retry tetap identik. Penulisan jenis lama/baru, retry, serta pemeriksaan foreign key lulus.
- Uji utang / piutang mencakup kedua jenis, tanggal WIB, pembayaran sebagian/penuh, nominal tidak valid, pembayaran berlebih, ID pembayaran berulang, edit yang melanggar riwayat, penghapusan, total negatif, saldo manual tetap, dan laporan laba yang tidak memasukkan pembayaran utang.
- Uji API mencakup pengguna bersama, validasi server, retry idempotent, konflik pembayaran bersamaan, dan penolakan edit/hapus dengan versi lama.

## Browser dan runtime Cloudflare lokal

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
