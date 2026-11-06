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

Laporan harian/mingguan/bulanan menampilkan penerimaan bersih (DP + cicilan − pembatalan) dan modal dibayar dari saldo pada periode tersebut. Sisa piutang, tunggakan, modal kontrak, potensi profit, dan surplus merupakan posisi akumulasi pada akhir periode; periode berjalan/future dibatasi sampai hari ini agar cicilan mendatang tidak dianggap menunggak.

Potensi profit = harga jual − modal, dengan asumsi seluruh tagihan lunas. Surplus penerimaan atas modal dihitung per kontrak sebagai `max(0, penerimaan bersih − modal)`; ini indikator pemulihan modal, bukan laba akuntansi periode. Piutang Kredit Barang tidak ditambahkan ke ringkasan Utang & Piutang atau laporan laba transaksi utama. Saldo aktual dan riwayat perubahan saldo utama tetap mencerminkan mutasi kredit.

## Konsistensi dan offline

Pencatatan kredit baru/pembayaran memerlukan internet, sesi aktif, dan antrean biasa kosong. Kontrak, saldo terkait, audit saldo, dan receipt operasi disimpan atomik dalam batch D1 dengan pemeriksaan versi kontrak dan seluruh sumber saldo. Versi lama ditolak tanpa perubahan sebagian.

Operasi disimpan di IndexedDB sebelum dikirim. Jika respons terputus, sinkronisasi mengirim ulang ID operasi yang sama; receipt mencegah DP/pembayaran/saldo ganda. Cache kredit dan laporan tetap dapat dibaca offline pada PWA yang sudah siap. Ini bukan antrean untuk membuat pembayaran baru saat offline.

## Migrasi dan verifikasi

Terapkan `0005_goods_credit.sql` sebelum menjalankan versi aplikasi ini. Migrasi menambah `goods_credits` dan `goods_credit_operations` tanpa mengubah data lama. Ikuti `DEPLOYMENT.md` untuk target lokal/produksi; implementasi ini belum diterapkan ke produksi.

Pengujian: `npm test`, `npm run check`, `npm run build`, `npm run cf:build`; fixture IndexedDB `npm run test:browser`. Runtime D1 diuji menggunakan preview Cloudflare lokal dengan database terisolasi `/tmp/arialink-goods-credit-preview`, bukan database produksi.

Bukti visual: [desktop](screenshots/goods-credit-desktop.png), [detail mobile](screenshots/goods-credit-mobile-detail.png).
