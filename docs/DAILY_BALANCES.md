# Saldo Harian: snapshot Saldo, Utang, dan Piutang

## Pemakaian

1. Periksa nilai terakhir rekening, e-wallet, kas, Utang, dan Piutang melalui menu operasional masing-masing. Saldo tetap dicatat manual; transaksi dan pembayaran tidak otomatis mengubah bank, e-wallet, atau kas.
2. Buka **Laporan → Saldo Harian → Tutup Hari** saat online. Aplikasi menyinkronkan antrean sebelum mengambil tinjauan bersama.
3. Periksa **Dana tersedia**, **Sisa utang**, **Sisa piutang**, dan **Grand total setelah utang/piutang**. Tab Saldo, Utang, dan Piutang memperlihatkan posisi akhir yang akan disimpan. Pastikan perangkat lain sudah tersinkron.
4. Isi penjelasan jika salah satu komponen yang dapat dibandingkan berubah, lalu pilih **Simpan saldo penutupan**. Satu tanggal WIB hanya memiliki satu penutupan; tanggal, pengguna, waktu, dan snapshot tersimpan tidak dapat diubah atau dihapus.

**Grand total = Dana tersedia + Sisa piutang − Sisa utang.** Dana tersedia tetap berarti rekening + e-wallet + kas. Kedua total tersebut tidak boleh dianggap sama.

Jika DANA beberapa kali diedit tetapi nilai akhirnya **Rp 1.000.000** saat konfirmasi, penutupan menyimpan satu baris **DANA Rp 1.000.000**. Detail laporan tidak menampilkan urutan edit atau menyalin semua versi antara penutupan. Snapshot hari sebelumnya tetap dipertahankan.

Penjelasan adalah catatan pengguna, bukan bukti otomatis penyebab perubahan. Misalnya Dana tersedia turun Rp 100.000 dan Utang turun Rp 100.000 sehingga Grand total tetap: penjelasan tetap wajib, tetapi angka tersebut saja tidak membuktikan bahwa uang digunakan membayar utang.

## Membuka data tersimpan

Pilih bulan dan **Detail** pada tanggal yang ingin diperiksa. Dialog menampilkan tanggal/waktu snapshot, pengguna, empat total, penjelasan, dan tiga tab:

- **Saldo**: nilai terakhir per rekening/e-wallet dan kas, perbandingan antarpenutupan, serta pecahan kas tersimpan. Pilih nama sumber untuk melihat detail nilai terakhirnya.
- **Utang**: nama pihak, nominal awal, sudah dibayar, sisa, dan status yang disimpan saat penutupan.
- **Piutang**: posisi setara untuk Piutang langsung dan Piutang dari transaksi, masing-masing dihitung tepat satu kali. Catatan yang sudah lunas tetap dapat diperiksa dengan sisa nol.

Pilih nama pihak untuk membuka detail historisnya, termasuk tanggal, jatuh tempo, catatan, tanggal pelunasan jika tersedia, dan data transaksi asal yang relevan. Tidak ada daftar perubahan per edit atau timeline pembayaran dalam laporan ini. Riwayat pembayaran operasional tetap berada pada menu Utang & Piutang.

**Lihat penutupan terakhir** di menu Saldo membuka tab Saldo pada penutupan terbaru. Menu Utang & Piutang menyediakan shortcut yang membuka tab Utang atau Piutang pada tanggal penutupan terbaru yang sama. Semua tab suatu penutupan berasal dari satu snapshot.

Perubahan nama, nominal, pembayaran, atau penghapusan data saat ini tidak mengganti detail historis. Tidak ada aksi edit, hapus, Bayar, atau Lunasi pada snapshot. Jika sumber masih tersedia, **Buka data saat ini** membuka catatan operasional secara terpisah.

## Tanggal, cakupan lama, dan offline

- Tanggal lampau tanpa konfirmasi tetap **Belum ditutup**; hari ini **Sementara** sampai ditutup. Tidak ada backdating, penutupan otomatis, atau pembukaan ulang.
- Jika hari terlewat, pembanding memakai penutupan terakhir dan tanggalnya ditampilkan. Selisih mencakup seluruh rentang antarpenutupan.
- Snapshot berarti nilai saat konfirmasi, bukan jaminan nilai tidak berubah lagi sampai tengah malam. Perubahan berikutnya terlihat di data saat ini dan penutupan berikutnya, tanpa menimpa snapshot lama.
- Penutupan versi lama hanya berisi Saldo. Utang, Piutang, serta Grand total ditampilkan **Tidak direkam**, bukan nol atau nilai saat ini. Saldo tetap bisa dibandingkan; penutupan lengkap pertama menjadi baseline untuk komponen baru.
- Jika hari ini sudah ditutup memakai versi lama, snapshot lengkap mulai pada penutupan berikutnya yang tersedia. Sistem tidak menambahkan data utang saat ini ke snapshot lama.
- Closing tetap online-only, tanpa antrean penutupan. Perubahan baru/konflik harus disinkronkan sebelum meninjau ulang. Revisi juga mencakup perubahan Utang dan Piutang, sehingga pembayaran saat tinjauan terbuka membatalkan konfirmasi lama.
- Laporan tersinkron disimpan di IndexedDB per akun. Setelah app shell siap offline, snapshot dan detail dapat dibaca kembali tanpa koneksi. Waktu sinkronisasi terakhir tetap ditampilkan. Data belum tersinkron dari perangkat lain tidak dapat dimasukkan secara otomatis.
- Jika respons konfirmasi hilang, retry ID yang sama mengembalikan hasil semula. Setelah dialog ditutup, sinkronkan laporan untuk memeriksa hasil sebelum mencoba lagi.

## Penyimpanan dan integritas

`0003_daily_closings.sql` menyimpan snapshot Saldo dan audit saldo internal. `0004_financial_snapshots.sql` menambah kolom versi snapshot, revisi keuangan, JSON posisi akhir Utang/Piutang beserta empat total, dan counter `financial_state`. Tidak ada penulisan ulang baris penutupan lama atau penambahan log per-edit untuk utang/piutang.

Satu INSERT bersyarat menyimpan Saldo dan posisi keuangan lengkap secara atomik. Nilai, sumber, versi, dan total berasal dari pembacaan server yang konsisten. Statement memeriksa revisi Saldo, revisi keuangan, penutupan sebelumnya, dan tanggal WIB saat dieksekusi. Constraint unik tanggal dan ID permintaan melindungi retry/konkurensi; trigger menolak UPDATE/DELETE penutupan, termasuk kolom baru.

Perubahan relevan pada rekening, kas, utang, dan transaksi berpiutang memperbarui counter revisi dalam transaksi yang sama. Tidak ada timeline mutasi baru untuk fitur ini. Audit Saldo yang sudah ada dipertahankan secara internal dan tidak ditampilkan sebagai daftar edit di detail laporan.

API tetap:

- `GET /api/state`: record bersama, snapshot penutupan, dan data kompatibilitas cache.
- `GET /api/closings/review`: tinjauan versi 2 dengan `financialRevision`, nilai akhir, dan pembanding.
- `POST /api/closings`: ID permintaan, ID akun aktif, tanggal, revisi Saldo/keuangan, `snapshotVersion: 2`, pembanding, dan penjelasan. Total dari klien tidak dipercaya.

Semua endpoint memerlukan sesi aktif dan POST mengikuti pemeriksaan origin. Anggota dan admin berbagi akses laporan/penutupan sesuai akses keuangan aplikasi. Tinjauan lama yang belum mendukung snapshot lengkap diminta memperbarui aplikasi; replay ID penutupan yang sudah sukses tetap mengembalikan hasil asli.

## Migrasi dan rilis

```sh
npm test
npm run check
npm run cf:build
npm run db:local
```

Untuk produksi: sinkronkan perangkat, buat backup privat, periksa akun/database, terapkan migrasi remote sebelum deploy, lalu gunakan workflow deployment proyek. Lihat [VERIFICATION.md](VERIFICATION.md) untuk bukti dan versi rilis. Service worker menggunakan cache shell v7; pengguna PWA lama dapat memilih **Perbarui aplikasi** atau reload.

Rollback kode dapat mempertahankan skema baru. Jangan menghapus snapshot, audit, atau receipt. Versi lama dapat membaca Saldo tetapi tidak menampilkan komponen lengkap; update kembali ke versi baru untuk membaca semuanya. Backup memuat data keuangan dan autentikasi: simpan privat dan jangan commit database/SQL dump.

## Batas awal

Belum ada koreksi/reopening, notifikasi, ekspor laporan, atau penutupan otomatis. Snapshot dan laporan masih dimuat penuh mengikuti model cache aplikasi saat ini; pagination/retensi perlu dirancang sebelum volume tinggi. Tidak ada backfill Utang/Piutang untuk penutupan lama atau pembuktian otomatis hubungan pembayaran utang dengan perubahan kas.

Rujukan implementasi: [D1 database bindings](https://developers.cloudflare.com/d1/worker-api/d1-database/), [SQL dan JSON D1](https://developers.cloudflare.com/d1/sql-api/sql-statements/), [migrasi Wrangler](https://developers.cloudflare.com/d1/wrangler-commands/#migrations-apply).

## Snapshot versi 4: modal kredit kembali terlebih dahulu

Piutang Kredit Barang hanya menghitung modal belum kembali, dibatasi sisa tagihan pelanggan. Penutupan menyimpan modal awal, modal kembali, piutang modal, dan sisa tagihan kontrak secara terpisah. Piutang modal nol tidak berarti kontrak lunas. Versi 3 tetap menyimpan seluruh sisa harga jual; versi 1/2 belum mencakup Kredit Barang. Data lama tidak diisi ulang. Selisih piutang/grand total antardasar tidak ditampilkan sebagai delta langsung; saldo dan utang tetap dapat dibandingkan. Terapkan migrasi 0007 sebelum menjalankan kode versi ini.
