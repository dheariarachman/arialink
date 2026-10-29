# Utang & piutang

Piutang berarti pihak lain berutang kepada usaha. Utang berarti usaha berutang kepada pihak lain. Semua pengguna yang sudah masuk dapat membuat, melihat, mengubah, menghapus, dan mencatat pembayaran, mengikuti aturan data bersama yang sudah ada.

## Perhitungan

- Dana tersedia = saldo rekening + saldo e-wallet + kas per denominasi yang dicatat manual.
- Sisa per catatan = nominal awal − jumlah seluruh pembayaran.
- Grand total setelah utang / piutang = dana tersedia + sisa piutang − sisa utang. Hasil boleh negatif.
- Catatan terhapus dikeluarkan dari perhitungan. Catatan lunas tetap terlihat dengan sisa nol.
- Nominal awal dan setiap pembayaran harus rupiah bulat positif, maksimal Rp1 triliun. Pembayaran melebihi sisa ditolak, termasuk pada API.
- Pembayaran, pencatatan pinjaman, dan pelunasan tidak dimasukkan ke penerimaan atau laba transaksi.

Contoh: dana tersedia Rp5.000.000, piutang Rp500.000, utang Rp200.000 menghasilkan grand total Rp5.300.000. Dana yang tersedia saat itu tetap Rp5.000.000.

## Pencatatan dan saldo manual

Isi jenis, nama pihak, nominal awal, dan tanggal. Tanggal awal mengikuti hari input WIB. Jatuh tempo dan catatan opsional. Buka Detail untuk mengubah catatan, menghapusnya, atau mencatat pembayaran sebagian/penuh dengan tanggal dan catatan opsional. Status Belum lunas / Lunas mengikuti sisa; tidak ada status manual yang dapat berbeda dari nominal.

Setiap perpindahan uang tetap memerlukan pembaruan saldo rekening, e-wallet, atau pecahan kas secara manual. Catatan pinjaman lama tidak memindahkan uang lagi. Saat memasukkan saldo terkini, gunakan saldo yang benar-benar ada agar dana yang dipinjamkan tidak dihitung dua kali.

Contoh pelunasan piutang Rp200.000: sisa piutang berkurang Rp200.000 setelah pembayaran dicatat. Perbarui saldo kas/rekening penerima dengan uang yang benar-benar diterima. Setelah kedua catatan benar, grand total tetap sama; dana tersedia bertambah dan piutang berkurang.

Riwayat pembayaran dipertahankan saat data pokok diubah. Nominal awal tidak boleh diturunkan di bawah jumlah yang telah dibayar; tanggal catatan tidak boleh melewati tanggal pembayaran yang sudah ada. Menghapus catatan juga mengeluarkan seluruh riwayat pembayarannya dari tampilan dan total. Saldo manual tidak berubah.

## Offline dan konflik

Catatan memakai `kind: debt`. Payload memuat `type`, `name`, `amount`, `date`, `dueDate`, `notes`, dan `payments` (masing-masing memiliki `id`, `date`, `amount`, `note`). Pembayaran berada pada satu catatan induk, sehingga perubahan bersamaan memakai pemeriksaan versi yang sama dengan catatan lain. Sisa dan status selalu dihitung; keduanya tidak disimpan sebagai field yang dapat diubah.

Antrean IndexedDB diproyeksikan ke dashboard saat offline. Pengiriman ulang mutasi yang sama memakai receipt sehingga tidak menambahkan pembayaran dua kali. Konflik menampilkan kedua riwayat untuk ditinjau. Pilihan server/perangkat mempertahankan satu versi lengkap; tidak menggabungkan pembayaran otomatis. Untuk mempertahankan dua pembayaran berbeda, pilih data server, lalu catat ulang pembayaran perangkat yang belum ada pada riwayat server.

Login pertama memerlukan internet. Sinkronkan sebelum berpindah perangkat, membersihkan penyimpanan browser, atau memperbarui deployment. Batas ukuran payload API yang sudah ada (50.000 karakter per mutasi) juga berlaku pada catatan beserta riwayatnya.

## Migrasi dan rollback

`0002_debts.sql` memperluas jenis catatan dengan membangun ulang tabel `records` dalam satu migrasi. Semua kolom disalin, termasuk versi, tombstone, penulis, timestamp, dan `last_mutation`. Tabel receipt tidak diubah. Uji migrasi membuktikan data lama identik dan penulisan jenis lama/baru serta retry tetap bekerja setelah migrasi.

Urutan rollout: sinkronkan perangkat, buat backup pribadi, terapkan migrasi lokal/remote sesuai target, lalu deploy build baru. Terapkan migrasi sebelum Worker baru menerima penulisan utang / piutang. Buka kembali aplikasi dan aktifkan pembaruan service worker agar perangkat memakai UI baru. Klien lama tetap dapat menulis transaksi/saldo/kas; UI lama tidak menampilkan utang / piutang.

Rollback aplikasi: sinkronkan antrean utang / piutang selagi build baru masih berjalan, lalu kembalikan build aplikasi sebelumnya sambil mempertahankan skema yang diperluas, record utang, dan receipt. UI sebelumnya mengabaikan record utang dan tidak menyediakan total yang disesuaikan. Antrean utang pada perangkat yang belum tersinkron akan ditolak API lama dan tetap menunggu; gunakan kembali build baru untuk mengirimnya. Tidak ada migrasi turun yang membuang data utang. Pemulihan total dari backup merupakan prosedur terpisah dan memerlukan pemeriksaan data yang masuk setelah backup.

## Batas versi pertama

Belum ada bunga, jadwal cicilan, pengingat, perubahan otomatis saldo, atau penyuntingan masing-masing pembayaran yang sudah tersimpan. Riwayat pembayaran ditampilkan untuk peninjauan. Status pemeriksaan tercatat di [VERIFICATION.md](VERIFICATION.md).
