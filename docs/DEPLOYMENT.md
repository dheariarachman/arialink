# Deployment ARIALink ke Cloudflare

Target: satu Worker Next.js/OpenNext dan satu database Cloudflare D1. VPS tidak dibutuhkan untuk pilihan ini. Panduan tidak membuat resource sampai Anda menjalankan perintahnya sendiri.

## 1. Persiapan

- Akun Cloudflare yang dapat membuat Worker dan D1.
- Node.js 22.16+ (disarankan Node 24 LTS), npm, internet.
- Jalankan `npm ci` dari root project menggunakan `package-lock.json` yang sudah tersedia. File `.node-version` memilih Node 24. Commit lockfile bersama perubahan dependency.
- Jangan commit `.dev.vars`, kredensial, folder `.wrangler`, atau data lokal.

Login CLI:

```sh
npx wrangler login
npx wrangler whoami
```

Siapkan nama/email admin pertama, kata sandi minimal 10 karakter, dan `SETUP_TOKEN` acak minimal 24 karakter di password manager. Token runtime produksi disimpan lewat Wrangler, bukan `.dev.vars`. Akun Cloudflare, ID akun, dan UUID D1 bukan password; API token dan kode setup harus tetap pribadi. Domain kustom opsional; konfigurasi mengaktifkan URL `workers.dev`.

## 2. Buat database

```sh
npx wrangler d1 create arialink-db
```

Salin UUID database yang dikembalikan ke `d1_databases[0].database_id` dalam `wrangler.jsonc`, mengganti `00000000-0000-0000-0000-000000000000`. Pertahankan `binding: "DB"`, `database_name: "arialink-db"`, dan folder migrasi. Bila nama database diganti, sesuaikan script migrasi dalam `package.json`.

Terapkan migrasi ke database remote:

```sh
npm run db:remote
```

Perintah ini berbeda dari `db:local`. Pastikan akun dan database tujuan benar sebelum migrasi remote.

## 3. Build dan deploy awal

```sh
npm test
npm run check
npm run build
npm run cf:deploy
```

`cf:deploy` menjalankan build OpenNext (termasuk build Next) dan deployment Worker. `build` terpisah di atas berguna sebagai pemeriksaan awal; pada pembaruan rutin cukup test/check lalu cf:deploy. Tinjau biaya/kuota akun Cloudflare Anda sebelum menjalankan deployment.

Konfigurasi memuat `nodejs_compat`, aset `.open-next/assets`, entry `.open-next/worker.js`, binding D1, dan referensi Worker ke dirinya sendiri. **Jika nama Worker diubah, ubah juga `services[0].service`** agar sama. Aplikasi ini tidak memakai ISR atau cache data server sehingga tidak membutuhkan R2 untuk cache konten.

Setelah Worker dibuat, simpan kode setup melalui input interaktif Wrangler:

```sh
npx wrangler secret put SETUP_TOKEN
```

Masukkan rahasia acak minimal 24 karakter yang Anda simpan sendiri. Jangan gunakan nilai contoh, menaruh token dalam URL, source, atau argumen command. Worker yang sudah dideploy sebelum secret diisi akan menolak pembuatan admin sampai secret tersedia.

### Alternatif: deployment otomatis dari Git

Setelah database dibuat dan UUID disimpan dalam `wrangler.jsonc`, hubungkan repository GitHub/GitLab ke **Workers Builds**. Gunakan pengaturan berikut:

| Pengaturan | Nilai |
| --- | --- |
| Nama Worker | `arialink` (sama dengan `wrangler.jsonc`) |
| Root directory | Root repository proyek ini |
| Production branch | Branch produksi Anda |
| Build command | `npm test && npm run check && npm run cf:build` |
| Deploy command | `npm run cf:deploy:built` |
| Node version | `NODE_VERSION=24` bila build image tidak membaca `.node-version` |

Workers Builds memasang dependency dari lockfile. Command deploy di atas memakai hasil build yang sama tanpa membangun ulang. Terapkan migrasi D1 remote sebelum deployment yang membutuhkan skema baru. Simpan `SETUP_TOKEN` sebagai secret runtime Worker; build tidak memerlukan nilai token tersebut. Setelah deployment pertama, jalankan `npx wrangler secret put SETUP_TOKEN` sebelum membuat admin.

Untuk CLI lokal gunakan login browser di atas. Untuk CI eksternal, gunakan `CLOUDFLARE_ACCOUNT_ID` dan `CLOUDFLARE_API_TOKEN` pada penyimpanan secret CI. Beri akses Workers Scripts Edit pada akun tujuan, D1 Edit bila job menerapkan migrasi, dan akses zone yang sesuai hanya bila CI mengelola domain/rute.

Panduan resmi: [OpenNext untuk aplikasi yang sudah ada](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/) dan [konfigurasi Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## 4. Setup admin

Buka URL `workers.dev` dari hasil deployment melalui HTTPS. Isi setup admin pertama dengan kode setup, email, nama, dan kata sandi. Setup dikunci setelah satu akun awal berhasil dibuat; dua permintaan setup bersamaan juga dilindungi constraint database.

Simpan kode setup di tempat pribadi. Setelah setup selesai, kode tidak dapat membuat akun lagi karena pemeriksaan server. Pengguna tambahan dibuat oleh admin lewat menu Pengguna. Tidak ada pendaftaran publik.

## 5. Domain dan PWA

Domain kustom opsional: pilih Worker ARIALink di dashboard Cloudflare → Settings → Domains & Routes → Add → Custom Domain, lalu ikuti pengaturan DNS yang ditampilkan Cloudflare. HTTPS diperlukan untuk service worker di luar localhost.

Pilih domain tetap sebelum dipakai operasional. Cache, antrean offline, dan sesi terikat pada origin. Saat pindah dari workers.dev ke domain kustom, sinkronkan semua antrean di domain lama terlebih dahulu.

Pada Chrome/Edge gunakan menu install atau tombol Pasang aplikasi ketika tersedia. Pada iPhone/iPad gunakan Safari → Share → Add to Home Screen. Dukungan tombol instalasi berbeda antar browser.

## 6. Verifikasi sebelum pemakaian

- Buat akun pengguna dari admin. Pastikan pengguna dapat mengubah transaksi/saldo tetapi tidak dapat mengelola akun melalui UI atau API.
- Coba empat jenis transaksi, field kosong, tanggal default WIB, nilai nol, edit dan hapus.
- Tarik tunai Rp505.000 diterima/Rp500.000 cash/admin termasuk → laba Rp5.000.
- Tarik tunai Rp500.000 transfer/Rp500.000 cash/admin terpisah Rp5.000 → laba Rp5.000 dan penerimaan Rp505.000.
- Pastikan perubahan transaksi tidak mengubah saldo kas atau rekening.
- Periksa laporan pada pergantian hari WIB serta batas Minggu/Senin.
- Login online dan tunggu sinkron, muat ulang online, aktifkan mode pesawat, catat transaksi, muat ulang offline, lalu kembali online.
- Uji dua perangkat mengedit catatan yang sama untuk memastikan perbandingan konflik muncul.
- Uji koneksi terputus saat simpan dan sesi habis. Periksa antrean tidak hilang dan tidak ada transaksi ganda.
- Periksa tampilan pada lebar 360px, 390px, tablet, desktop; fokus keyboard, dialog, dan keterbacaan.

## 7. Backup dan pembaruan

Backup database tersinkron (tidak mencakup antrean perangkat yang belum terkirim):

```sh
npx wrangler d1 export arialink-db --remote --output=arialink-backup.sql
```

Simpan hasil backup di tempat pribadi karena berisi data usaha dan hash autentikasi. Jangan commit atau kirimkan sebagai lampiran publik.

Saat update: sinkronkan perangkat aktif, buat backup, jalankan test/build, terapkan migrasi baru jika ada, lalu deploy. Ubah konstanta `CACHE` pada `public/sw.js` saat struktur shell/aset offline berubah. UI menampilkan pemberitahuan bila service worker versi baru menunggu aktivasi.

Periksa log Worker dengan `npx wrangler tail`. Jangan mencatat password, cookie, kode setup, atau payload keuangan ke log. Kode ini hanya mencatat nama kesalahan server.

## Batas MVP

Snapshot data bersama dimuat seluruhnya untuk cache offline; belum ada pagination server untuk volume transaksi besar. Receipt sinkronisasi dan tombstone dipertahankan agar retry/perangkat lama aman. Penghapusan/arsip massal receipt dan pengaturan retensi perlu dirancang sebelum volume besar. UI belum menyediakan pemulihan transaksi yang sudah dihapus.

## Rujukan

[Cloudflare Next.js](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), [OpenNext](https://opennext.js.org/cloudflare/get-started), [OpenNext bindings](https://opennext.js.org/cloudflare/bindings).
