# Utang & piutang

Piutang berarti pihak lain berutang kepada usaha. Utang berarti usaha berutang kepada pihak lain. Semua pengguna yang sudah masuk dapat membuat, melihat, mengubah, menghapus, dan mencatat pembayaran, mengikuti aturan data bersama yang sudah ada.

## Perhitungan

- Dana tersedia = saldo rekening + saldo e-wallet + kas per denominasi yang dicatat manual.
- Sisa per catatan = nominal awal − jumlah seluruh pembayaran.
- Grand total setelah utang / piutang = dana tersedia + sisa piutang − sisa utang. Hasil boleh negatif.
- Catatan terhapus dikeluarkan dari perhitungan. Catatan lunas tetap terlihat dengan sisa nol.
- Nominal awal dan setiap pembayaran harus rupiah bulat positif, maksimal Rp1 triliun. Pembayaran melebihi sisa ditolak, termasuk pada API.
- Catatan utang / piutang mandiri dan pelunasannya tidak masuk penerimaan atau laba transaksi. Piutang dari transaksi mengikuti aturan penerimaan dan laba di bawah.

Contoh: dana tersedia Rp5.000.000, piutang Rp500.000, utang Rp200.000 menghasilkan grand total Rp5.300.000. Dana yang tersedia saat itu tetap Rp5.000.000.

## Pencatatan dan saldo manual

Isi jenis, nama pihak, nominal awal, dan tanggal. Tanggal awal mengikuti hari input WIB. Jatuh tempo dan catatan opsional. Buka Detail untuk mengubah catatan, menghapusnya, atau melunasi seluruh tagihan dalam satu pembayaran, dengan tanggal dan catatan opsional. Pembayaran sebagian dan cicilan tidak tersedia. Status Belum lunas / Lunas mengikuti sisa; tidak ada status manual yang dapat berbeda dari nominal.

Filter daftar menyediakan Semua, Utang, dan Piutang; jumlah catatan dan pesan kosong mengikuti pilihan. Catatan lunas tetap terlihat pada jenisnya. Filter hanya memengaruhi daftar, sedangkan kartu ringkasan tetap menghitung seluruh utang / piutang.

Tombol Lunasi tersedia langsung pada baris yang belum lunas. Konfirmasi menampilkan nama pihak, jenis, dan seluruh sisa sebagai nominal pembayaran tetap. Tanggal pembayaran mengikuti hari ini WIB dan dapat diubah, tetapi tidak boleh sebelum tanggal catatan. Catatan pembayaran opsional. Konfirmasi menambahkan satu pembayaran sebesar sisa tanpa menghapus riwayat sebelumnya, lalu status menjadi Lunas dan tombol Lunasi hilang. Batal tidak menyimpan perubahan. Pelunasan memakai antrean offline dan pemeriksaan versi yang sama dengan pembayaran biasa; tidak memerlukan migrasi baru.

Setiap perpindahan uang tetap memerlukan pembaruan saldo rekening, e-wallet, atau pecahan kas secara manual. Catatan pinjaman lama tidak memindahkan uang lagi. Saat memasukkan saldo terkini, gunakan saldo yang benar-benar ada agar dana yang dipinjamkan tidak dihitung dua kali.

Contoh pelunasan piutang Rp200.000: sisa piutang berkurang Rp200.000 setelah pembayaran dicatat. Perbarui saldo kas/rekening penerima dengan uang yang benar-benar diterima. Setelah kedua catatan benar, grand total tetap sama; dana tersedia bertambah dan piutang berkurang.

Riwayat pembayaran lama dipertahankan saat data pokok diubah. Nominal awal yang sudah memiliki pembayaran tidak dapat diubah; tanggal catatan tidak boleh melewati tanggal pembayaran yang sudah ada. Menghapus catatan juga mengeluarkan seluruh riwayat pembayarannya dari tampilan dan total. Saldo manual tidak berubah.

## Piutang dari transaksi

Pada Catat transaksi, pilih Status pembayaran → Belum dibayar (Piutang). Nama pelanggan dan seluruh nominal tagihan wajib diisi; jatuh tempo opsional. Modal tetap boleh kosong, dan laba ditampilkan “—” sampai modal diketahui. Transaksi biasa yang dipilih Lunas tetap mendukung field kosong seperti sebelumnya. Tidak ada pembayaran awal sebagian.

Piutang transaksi disimpan pada payload transaksi yang sama melalui `credit: {name, dueDate, settlement}`. `settlement` kosong sampai lunas, kemudian berisi satu `{id, date, note}` tanpa nominal yang bisa diketik. Daftar Utang & Piutang memproyeksikan catatan ini sebagai Piutang, memakai ID dan versi transaksi yang sama; tidak membuat record `debt` tambahan. Pembuatan, perubahan, penghapusan sebelum lunas, dan pelunasan selalu satu mutasi sehingga kedua tampilan tetap konsisten saat offline atau retry. Tidak memerlukan migrasi SQL baru.

Field `received` pada transaksi berpiutang menyimpan nominal yang ditagihkan, bukan uang yang sudah diterima. Untuk Tarik Tunai dengan admin terpisah, isi nominal admin lengkap, termasuk nol bila tidak ada; total piutang adalah transfer ditagihkan + admin terpisah. Seluruh tagihan tersebut dibayar sekaligus. Piutang transaksi hanya mendukung pelanggan berutang kepada usaha; Utang mandiri tetap tersedia dari menu Utang & Piutang.

- Sebelum lunas: penerimaan nol, sisa piutang sebesar seluruh tagihan, dan laba = tagihan termasuk admin − modal pada tanggal transaksi.
- Setelah lunas: penerimaan sebesar seluruh tagihan pada tanggal pelunasan, sisa piutang nol, dan laba tidak dihitung ulang. Laporan menampilkan pelunasan pada periode penerimaannya walaupun transaksi berasal dari periode lain.
- Contoh: tagihan Rp105.000, modal Rp100.000 pada 29 Oktober, dilunasi pada 30 Oktober. Laba 29 Oktober Rp5.000 dan penerimaan nol; penerimaan 30 Oktober Rp105.000 tanpa tambahan laba.
- Lunasi tersedia di Detail transaksi maupun Utang & Piutang. Konfirmasi menetapkan nominal penuh, tanggal pembayaran, dan catatan opsional. Batal tidak menyimpan perubahan. Tanggal pelunasan tidak boleh sebelum tanggal transaksi.
- Piutang transaksi yang sudah disimpan tidak dapat diubah menjadi transaksi biasa melalui pilihan status; gunakan Lunasi. Sebelum lunas, nominal dan tanggal masih bisa dikoreksi dari Ubah transaksi. Penghapusan transaksi belum lunas juga menghapus piutang dari tampilan dan total.
- Setelah lunas, nominal, modal, jenis, tanggal transaksi, serta pelunasan tidak dapat diubah dan transaksi tidak dapat dihapus. Sumber saldo dan metode pembayaran masih dapat diperbarui. Koreksi keuangan setelah pelunasan belum tersedia.
- Saldo rekening, e-wallet, dan kas tetap diperbarui manual ketika uang benar-benar berpindah.

## Offline dan konflik

Catatan memakai `kind: debt`. Payload memuat `type`, `name`, `amount`, `date`, `dueDate`, `notes`, dan `payments` (masing-masing memiliki `id`, `date`, `amount`, `note`). Pembayaran berada pada satu catatan induk, sehingga perubahan bersamaan memakai pemeriksaan versi yang sama dengan catatan lain. Validasi perubahan di IndexedDB dan API mempertahankan riwayat lama dan hanya menerima satu pembayaran baru sebesar seluruh sisa. Riwayat pembayaran lama yang sudah sebagian tetap dapat dibaca; pelunasan berikutnya harus menutup seluruh sisa sekaligus. Sisa dan status selalu dihitung; keduanya tidak disimpan sebagai field yang dapat diubah.

Antrean IndexedDB diproyeksikan ke dashboard saat offline. Pengiriman ulang mutasi yang sama memakai receipt sehingga tidak menambahkan pembayaran dua kali. Konflik menampilkan kedua riwayat untuk ditinjau. Pilihan server/perangkat mempertahankan satu versi lengkap; tidak menggabungkan pembayaran otomatis. Riwayat pelunasan yang sudah tersimpan di server tidak dapat ditimpa oleh versi lokal. Pilih data server bila pelunasan telah dicatat perangkat lain. Pembayaran baru harus melunasi seluruh sisa; tidak menggabungkan atau menambahkan cicilan.

Login pertama memerlukan internet. Sinkronkan sebelum berpindah perangkat, membersihkan penyimpanan browser, atau memperbarui deployment. Batas ukuran payload API yang sudah ada (50.000 karakter per mutasi) juga berlaku pada catatan beserta riwayatnya.

## Pembaruan aturan pembayaran penuh

Sinkronkan seluruh perangkat sebelum memperbarui dari versi yang mendukung cicilan. Pembayaran sebagian lama yang sudah tersimpan tetap dipertahankan. Antrean cicilan lama yang belum dikirim akan ditolak aturan baru dan tetap tersimpan pada perangkat; selesaikan sinkronisasinya sebelum rollout. Jangan membersihkan IndexedDB untuk menghilangkan antrean yang belum ditinjau.

Perbarui service worker dan semua perangkat agar piutang transaksi serta tanggal penerimaan ditampilkan dengan benar. Server baru menolak penulisan klien lama yang menghapus data `credit` pada transaksi. Rollback ke API lama yang belum memahami `credit` tidak aman untuk penyuntingan transaksi berpiutang; pertahankan API yang mendukung fitur ini sampai semua catatan dan antrean ditinjau.

## Migrasi dan rollback

`0002_debts.sql` memperluas jenis catatan dengan membangun ulang tabel `records` dalam satu migrasi. Semua kolom disalin, termasuk versi, tombstone, penulis, timestamp, dan `last_mutation`. Tabel receipt tidak diubah. Uji migrasi membuktikan data lama identik dan penulisan jenis lama/baru serta retry tetap bekerja setelah migrasi.

Urutan rollout: sinkronkan perangkat, buat backup pribadi, terapkan migrasi lokal/remote sesuai target, lalu deploy build baru. Terapkan migrasi sebelum Worker baru menerima penulisan utang / piutang. Buka kembali aplikasi dan aktifkan pembaruan service worker agar perangkat memakai UI baru. Klien lama tetap dapat menulis transaksi/saldo/kas; UI lama tidak menampilkan utang / piutang.

Rollback aplikasi: sinkronkan antrean utang / piutang selagi build baru masih berjalan, lalu kembalikan build aplikasi sebelumnya sambil mempertahankan skema yang diperluas, record utang, dan receipt. UI sebelumnya mengabaikan record utang dan tidak menyediakan total yang disesuaikan. Antrean utang pada perangkat yang belum tersinkron akan ditolak API lama dan tetap menunggu; gunakan kembali build baru untuk mengirimnya. Tidak ada migrasi turun yang membuang data utang. Pemulihan total dari backup merupakan prosedur terpisah dan memerlukan pemeriksaan data yang masuk setelah backup.

## Batas versi pertama

Belum ada bunga, jadwal cicilan, pengingat, perubahan otomatis saldo, atau penyuntingan masing-masing pembayaran yang sudah tersimpan. Riwayat pembayaran ditampilkan untuk peninjauan. Status pemeriksaan tercatat di [VERIFICATION.md](VERIFICATION.md).
