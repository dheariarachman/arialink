# Kredit Barang

Submenu Kredit Barang menyediakan penjualan cicilan mingguan/bulanan, DP sebagai cicilan pertama, jadwal, pembayaran sebagian, pelunasan lebih awal, koreksi pembayaran, serta laporan tersendiri. Kontrak tersimpan terpisah dari transaksi dan Utang & Piutang utama. Dana tersedia tetap menggunakan sumber saldo ARIALink yang sama.

## Aturan

- Total tenor 1–600 kali mencakup DP. Tenor satu harus langsung lunas. Nominal rupiah bulat; selisih pembulatan pada cicilan terakhir.
- Jatuh tempo kedua dipilih eksplisit. Mingguan berjarak tujuh hari. Bulanan mempertahankan tanggal awal, memakai hari terakhir bila tanggal tidak tersedia, lalu kembali ke tanggal awal pada bulan berikutnya.
- Alokasi pembayaran ke cicilan paling awal yang belum lunas. Terlambat berarti masih memiliki tagihan dengan jatuh tempo sebelum tanggal acuan WIB.
- Modal boleh nol. Harga jual dan DP harus positif. Membayar modal sekarang opsional; jangan dipilih jika modal sudah dibayar/dicatat. Modal di versi ini merupakan total biaya langsung barang; masukkan biaya langsung tambahan ke angka modal.
- DP/pembayaran menambah rekening, e-wallet, atau kas. Pembayaran modal mengurangi sumber pilihan. Sumber modal dan penerima DP boleh berbeda. Kas membutuhkan jumlah pecahan setelah transaksi; sistem memverifikasi totalnya.
- Koreksi pembayaran membuat entri pembatalan, mengurangi saldo asal, dan membuka kembali tagihan. Riwayat asli tetap ada. Untuk mengganti nominal/tanggal, batalkan lalu catat pembayaran pengganti. Pembatalan memerlukan saldo asal aktif dan cukup; sumber saldo yang sudah dihapus tidak bisa dipakai.
- Data kontrak dikunci setelah pembuatan. Penyuntingan/pembatalan kontrak dan koreksi pembayaran modal belum tersedia. Periksa data sebelum menyimpan.

## Laporan

Laporan harian/mingguan/bulanan menampilkan penerimaan bersih (DP + cicilan − pembatalan) dan modal dibayar dari saldo pada periode tersebut. Sisa tagihan pelanggan, piutang modal, tunggakan, modal kontrak, potensi profit, dan surplus merupakan posisi akumulasi pada akhir periode; periode berjalan/future dibatasi sampai hari ini agar cicilan mendatang tidak dianggap menunggak.

Potensi profit = harga jual − modal, dengan asumsi seluruh tagihan lunas. Surplus penerimaan atas modal dihitung per kontrak sebagai `max(0, penerimaan bersih − modal)`; ini indikator pemulihan modal, bukan laba akuntansi periode. Modal Kredit Barang yang belum kembali otomatis masuk ke daftar dan ringkasan Utang & Piutang, Beranda, serta snapshot penutupan baru (versi 4). Sisa tagihan pelanggan tetap disimpan dan ditampilkan terpisah, tanpa mengurangi kewajiban pelanggan. Kontrak dibaca langsung tanpa membuat catatan piutang duplikat. Penerimaan dan profit tetap dilaporkan di modul kredit, bukan laporan laba transaksi utama. Saldo aktual dan riwayat perubahan saldo utama tetap mencerminkan mutasi kredit.

## Konsistensi dan offline

Pencatatan kredit baru/pembayaran memerlukan internet, sesi aktif, dan antrean biasa kosong. Kontrak, saldo terkait, audit saldo, dan receipt operasi disimpan atomik dalam batch D1 dengan pemeriksaan versi kontrak dan seluruh sumber saldo. Versi lama ditolak tanpa perubahan sebagian.

Operasi disimpan di IndexedDB sebelum dikirim. Jika respons terputus, sinkronisasi mengirim ulang ID operasi yang sama; receipt mencegah DP/pembayaran/saldo ganda. Cache kredit dan laporan tetap dapat dibaca offline pada PWA yang sudah siap. Ini bukan antrean untuk membuat pembayaran baru saat offline.

## Migrasi dan verifikasi

Terapkan migrasi berurutan sampai `0007_capital_first_receivables.sql` sebelum menjalankan versi aplikasi ini. Migrasi menambah `goods_credits` dan `goods_credit_operations` tanpa mengubah data lama. Ikuti `DEPLOYMENT.md` untuk target lokal/produksi; implementasi ini belum diterapkan ke produksi.

Pengujian: `npm test`, `npm run check`, `npm run build`, `npm run cf:build`; fixture IndexedDB `npm run test:browser`. Runtime D1 diuji menggunakan preview Cloudflare lokal dengan database terisolasi `/tmp/arialink-goods-credit-preview`, bukan database produksi.

Bukti visual: [desktop](screenshots/goods-credit-desktop.png), [detail mobile](screenshots/goods-credit-mobile-detail.png).

## Integrasi Piutang

- Filter sumber pada Utang & Piutang: Catatan langsung, Transaksi, Kredit Barang. Dua kontrak pelanggan yang sama tetap terpisah. Piutang manual yang kebetulan mewakili kontrak sama tidak digabung otomatis.
- Detail dan Catat cicilan membuka kontrak/form Kredit Barang yang sama; pembayaran tidak melalui pelunasan piutang biasa. Pembayaran mengembalikan modal terlebih dahulu. Sampai modal tertutup, penerimaan memindahkan nilai piutang ke saldo. Bagian penerimaan yang melewati modal menambah saldo dan grand total, sedangkan piutang modal tetap nol.
- Migrasi `0006_credit_receivables.sql` diperlukan sebelum menjalankan versi integrasi. Migrasi menambahkan deteksi perubahan kontrak untuk penutupan; tidak memindahkan data kontrak atau mengubah penutupan lama.
- Snapshot versi 1/2/3 tidak diisi ulang. Versi 1/2 belum mencakup Kredit Barang; versi 3 memakai seluruh sisa harga jual. Perbandingan piutang/grand total antardasar ditandai perubahan dasar, tanpa delta langsung yang menyesatkan. Saldo dan utang tetap dapat dibandingkan.

## Modal kembali terlebih dahulu (versi 4)

- Pembayaran bersih adalah DP + cicilan − pembatalan. Modal kembali = `min(modal, pembayaran bersih)`. Piutang modal = `min(sisa tagihan, max(0, modal − pembayaran bersih))`. Batas sisa tagihan mencegah piutang melebihi kewajiban pelanggan pada penjualan di bawah modal.
- Surplus atas modal = `max(0, pembayaran bersih − modal)`. Surplus tambahan periode adalah perubahan surplus kumulatif antara sebelum awal dan akhir periode. Nilainya dapat negatif akibat koreksi. Modal kembali periode juga bersih setelah koreksi.
- Jika harga jual di bawah modal, piutang menjadi nol setelah harga jual dilunasi; kekurangan modal menjadi kerugian kontrak lunas. Pembatalan pembayaran dapat membuka kembali piutang dan membalik pengakuan kerugian pada periode koreksi.
- Modal nol tidak menghasilkan piutang modal, tetapi kontrak tetap berjalan sampai seluruh tagihan lunas. Status dan filter lunas mengacu pada pelunasan harga jual, bukan piutang modal nol.
- Informasi profit/surplus/kerugian hanya ditampilkan di Laporan kredit. Daftar dan detail operasional menyimpan sisa tagihan utuh, jadwal, modal kembali, serta piutang modal.
- Migrasi 0007 menambahkan penanda `credit_basis` dan menaikkan revisi keuangan. Kontrak, riwayat pembayaran, saldo, receipt, dan snapshot lama tidak ditulis ulang. Snapshot baru menyimpan `creditBasis: capital-first` dan rincian sisa tagihan kontrak. Klien dengan tinjauan versi 3 harus memuat ulang.
- Rollback aplikasi: jangan kembali memakai penutupan versi 3 pada database yang sudah menyimpan versi 4. Riwayat lama harus tetap dibaca sesuai versinya; jangan mengubah data snapshot untuk rollback. Saldo/pembayaran asli tetap dapat dipakai untuk rekalkulasi tampilan setelah pembaruan aplikasi.
