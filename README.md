# ARIALink MVP

Satu aplikasi **Next.js responsive PWA** untuk pencatatan usaha. Target deployment **Cloudflare Workers + D1**, menggunakan adapter OpenNext. Tidak mengeksekusi transfer, topup, pembayaran PPOB, atau penarikan uang sungguhan.

## Isi MVP

- PPOB, topup e-wallet, transfer, dan tarik tunai; tambah, lihat, ubah, hapus.
- Seluruh field transaksi opsional, termasuk jenis dan tanggal. Tanggal kosong menjadi hari input dalam **Asia/Jakarta (WIB)**, termasuk saat offline.
- Laba transaksi umum = diterima − modal.
- Tarik tunai: switch admin sudah termasuk transfer. Jika ya: transfer − cash; jika tidak: transfer + admin tunai terpisah − cash.
- Nilai kosong berbeda dari nol. Laba yang belum dapat dihitung tampil “—”. Laporan menjumlahkan nilai yang tersedia dan memberi tahu jumlah transaksi dengan laba belum lengkap. Admin tunai terpisah yang diisi termasuk penerimaan pelanggan dan tidak dihitung dua kali.
- Saldo rekening/e-wallet dicatat manual; kas dicatat per denominasi. **Transaksi tidak mengubah saldo apa pun.** Saldo dan jumlah pecahan tidak boleh negatif.
- Dashboard total saldo, penerimaan, laba, transaksi terbaru.
- Utang & piutang: nama pihak, nominal awal, tanggal, jatuh tempo opsional, catatan, pembayaran sebagian/penuh, dan riwayat pembayaran. Status lunas dihitung otomatis.
- Dana tersedia = rekening + e-wallet + kas. **Grand total setelah utang / piutang = dana tersedia + sisa piutang − sisa utang**; dapat negatif. Pencatatan/pembayaran utang tidak mengubah saldo manual atau laba transaksi. Lihat [aturan utang & piutang](docs/DEBTS.md).
- Laporan harian/mingguan/bulanan; minggu Senin–Minggu, WIB, rincian di aplikasi.
- Data digunakan bersama oleh semua pengguna. Semua boleh mengubah/menghapus transaksi dan mengubah saldo. Hanya admin dapat menambah akun, menonaktifkan akun lain, dan mengatur ulang kata sandi akun lain.
- Antrean offline tersimpan di IndexedDB, pengiriman ulang idempotent, deteksi konflik dengan pilihan data server/perangkat. Pencatatan offline hanya setelah login online pada perangkat tersebut.

## Menjalankan lokal

Prasyarat: Node.js **22.16+** (disarankan Node 24 LTS) dan npm; internet untuk pemasangan paket. Pengujian server memakai `node:sqlite` sehingga Node lama tidak didukung.

Dari folder project ini:

```sh
npm install
```

Salin `.dev.vars.example` menjadi `.dev.vars`. Ganti nilai `SETUP_TOKEN` dengan rahasia acak minimal 24 karakter. Nilai contoh tidak diterima aplikasi. Contoh membuat kode lokal (simpan pribadi, jangan commit):

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Jalankan migrasi database lokal dan aplikasi:

```sh
npm run db:local
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Bila port berbeda, gunakan alamat yang tercetak di terminal. Isi layar setup pertama dengan kode dari `.dev.vars`, nama, email, dan kata sandi minimal 10 karakter. Admin berikutnya dibuat lewat menu Pengguna. Tidak ada akun atau password produksi bawaan.

D1 lokal disimpan Wrangler di `.wrangler/state`. Binding development menggunakan D1 lokal, bukan database remote. ID database nol di konfigurasi adalah placeholder untuk development; ganti dengan ID asli sebelum deployment.

**Mode dev tidak mendaftarkan service worker.** Untuk menguji offline dan instalasi PWA, gunakan build produksi/preview di bawah.

## Pemeriksaan

```sh
npm test
npm run check
npm run build
npm run cf:preview
```

`npm test` dapat berjalan tanpa `npm install` karena menggunakan modul bawaan Node. `check` memeriksa JavaScript dan JSON; kompilasi JSX/framework dilakukan `build`. `cf:preview` membangun adapter dan menjalankan aplikasi pada runtime lokal Cloudflare. Jangan gunakan `npm start` untuk API D1: mode itu bukan runtime binding Cloudflare.

Untuk pengujian IndexedDB/outbox dengan browser sungguhan, tersedia fixture lokal **terpisah** dari aplikasi:

```sh
npm run test:browser
```

Buka [http://127.0.0.1:4178](http://127.0.0.1:4178). Fixture menggunakan SQLite memory, akun dan data pengujian sendiri, serta tidak mengakses D1 produksi. Layar menampilkan hasil 12 pengujian, termasuk pembayaran utang / piutang, respons hilang, dan konflik pembayaran. Ini menguji IndexedDB, respons jaringan hilang, konflik, dan isolasi akun; bukan pengganti pengujian build Next.js/PWA. Hentikan server dengan Ctrl+C.

Lihat [status verifikasi](docs/VERIFICATION.md) untuk pemeriksaan yang benar-benar telah dijalankan pada paket ini.

## Offline

1. Buka build produksi/Cloudflare lewat HTTPS (atau localhost saat preview).
2. Login online, tunggu sinkronisasi selesai dan service worker siap. Muat ulang sekali saat online sebelum mencoba mode pesawat.
3. Putuskan koneksi, tambahkan/ubah transaksi. Penanda “perubahan menunggu sinkronisasi” menunjukkan data belum dikonfirmasi server.
4. Muat ulang offline; catatan dan antrean tetap ada pada browser/perangkat yang sama.
5. Kembali online dengan aplikasi terbuka; antrean dikirim berurutan, lalu data bersama dimuat ulang. Ada sinkronisasi otomatis setiap 20 detik dan tombol sinkron manual.
6. Bila sesi habis, login kembali dengan akun yang sama untuk mengirim antrean. Akun lain tidak dapat mengirim antrean tersebut.
7. Bila ada edit bersamaan, tinjau perbandingan, lalu pilih data server atau perangkat. Tidak ada penimpaan otomatis. Jika catatan server sudah dihapus, perubahan lokal dapat disimpan sebagai catatan baru.

Login, setup, dan pengelolaan akun memerlukan internet. Sinkronisasi ketika aplikasi tertutup belum tersedia. Browser private mode, pembersihan data situs, pergantian domain, atau penghapusan aplikasi dapat menghilangkan data offline yang belum terkirim. Logout tidak menghapus antrean; antrean diisolasi berdasarkan ID akun. Data yang telah di-cache tersedia offline untuk akun terakhir pada perangkat ini; gunakan perangkat/browser pribadi. Penonaktifan akun berlaku saat mengakses server, dan tidak dapat mencabut salinan offline dari perangkat yang sedang terputus.

## Deployment

Ikuti [panduan Cloudflare](docs/DEPLOYMENT.md). File deployment sudah disiapkan, tetapi **tidak ada deployment yang dilakukan otomatis** dan tidak ada akun Cloudflare yang diubah dalam pengerjaan ini.

## Struktur

- `app/`, `components/`: aplikasi responsive, form, dashboard dan laporan.
- `lib/domain.mjs`: rumus, validasi, WIB, periode laporan.
- `lib/api.mjs`, `lib/auth.mjs`, `lib/data.mjs`: API, sesi, akses admin, penyimpanan D1.
- `lib/offline.mjs`: snapshot per akun, antrean IndexedDB, sinkronisasi dan resolusi konflik.
- `public/sw.js`: cache shell/aset PWA; API tidak di-cache oleh service worker.
- `migrations/`: skema D1, termasuk receipt pengiriman ulang dan tombstone.
- `tests/`: domain, API di SQLite lokal, simulasi service worker, fixture IndexedDB browser.

Transaksi dihapus dari tampilan/perhitungan menggunakan tombstone internal agar perangkat offline tidak menghidupkannya kembali tanpa tinjauan. Ini bukan status bisnis transaksi. MVP belum memiliki layar pemulihan transaksi.

## Roadmap yang telah diminta

Multi-cabang dan ekspor laporan. Integrasi eksekusi transaksi belum menjadi bagian MVP.

## Referensi teknis

- [Next.js pada Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Setup OpenNext](https://opennext.js.org/cloudflare/get-started)
- [Binding D1/OpenNext](https://opennext.js.org/cloudflare/bindings)
- [Panduan PWA Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)
# arialink
