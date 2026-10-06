// Indonesian translation of the privacy policy in ./privacy.js.
//
// A convenience translation: the English and Korean texts in privacy.js are
// authoritative. `sections` mirrors privacyPolicy.en.sections one to one
// (same order, same text/items shape, same item counts). If privacy.js
// changes, this file must change with it.
//
// Quoted UI labels follow src/i18n/locales/id.js: profile.signInGoogle
// (“Masuk dengan Google”), map.locate (“Tampilkan lokasi saya”),
// profile.deleteRecords (“Hapus tempat tersimpan saya”).

import { PRIVACY_EFFECTIVE_DATE, LEAD_EMAIL_RETENTION_DAYS } from './privacy.js';

export default {
  title: 'Kebijakan Privasi',
  effective: `Berlaku sejak ${PRIVACY_EFFECTIVE_DATE}`,
  contactPending: 'Alamat kontak untuk permintaan terkait privasi akan dicantumkan di sini.',
  translationNote: 'Ini adalah terjemahan yang disediakan untuk memudahkan Anda; versi bahasa Inggris dan bahasa Korea di bawah ini adalah teks yang berlaku.',
  sections: [
    {
      heading: 'Ringkasan',
      items: [
        'Anda dapat menggunakan K-Food Map tanpa akun. Jika Anda tidak masuk, hal-hal di bawah ini tentang akun atau proses masuk tidak berlaku — bagian lain halaman ini tetap berlaku, karena pengiriman laporan, hosting, dan gambar peta tidak bergantung pada akun.',
        'Kami tidak menjalankan analitik, tidak menampilkan iklan, dan tidak memasang cookie. Lokasi Anda hanya digunakan jika Anda menekan “Tampilkan lokasi saya” di peta, dan itu pun hanya di dalam browser Anda, untuk memusatkan peta dan menampilkan jarak dari Anda — lokasi itu tidak disimpan dan tidak dikirim kepada kami.',
        'Jika Anda masuk dengan Google, Supabase (penyedia autentikasi kami) menyimpan alamat email dan ID akun Anda, dan akun Anda memuat tempat mana yang Anda simpan atau tandai sudah dikunjungi, beserta waktunya — tidak pernah nama, koordinat, foto, atau lokasi Anda.',
        'Kami juga menerima informasi pribadi jika Anda memilih mengirim laporan dan mencantumkan alamat email Anda.',
      ],
    },
    {
      heading: 'Yang disimpan di perangkat Anda',
      items: [
        'Saat Anda tidak masuk, aplikasi menyimpan empat hal di penyimpanan lokal browser Anda: tempat yang Anda simpan atau tandai sudah dikunjungi, beserta tanggal Anda melakukannya — mengeluarkan suatu tempat dari simpanan tidak menghapus entri ini, melainkan tetap menandainya sebagai dikeluarkan dari simpanan agar tempat itu tidak diam-diam muncul lagi nanti; apakah Anda sudah menyelesaikan layar sambutan; pilihan bahasa dan ukuran teks Anda; dan, jika sesi masuk di perangkat ini pernah berakhir dengan sendirinya — sesi masuk yang kedaluwarsa atau dicabut, atau keluar di tab lain — sebuah penanda yang mencatat hal itu, yang disimpan hanya agar aplikasi dapat menjelaskan mengapa tempat tersimpan Anda hilang, dan dihapus saat Anda masuk lagi. Tidak satu pun dari hal itu dikirim kepada kami.',
        'Menekan “Masuk dengan Google” menuliskan hal kelima sebelum sesi akun apa pun ada: kode berumur pendek yang diperlukan oleh pertukaran proses masuk (`kfm-auth-code-verifier`), yang dihapus ketika proses masuk selesai dan tertinggal sampai percobaan berikutnya jika Anda membatalkannya di tengah jalan.',
        'Setelah Anda masuk, dua hal lagi ditambahkan: sesi Supabase Anda, dan tempat milik akun mana yang ada di perangkat ini — dan catatan tempat, kunjungan, serta tempat yang dikeluarkan dari simpanan yang Anda miliki kemudian dijaga tetap sinkron dengan akun Anda, sehingga keluar akan menghapusnya dari perangkat tersebut sementara akun Anda tetap menyimpannya.',
        'Menghapus data situs ini di browser Anda akan menghapus semua yang ada di penyimpanan lokal, baik Anda sedang masuk maupun tidak.',
        'Untuk penggunaan offline, browser juga menyimpan berkas aplikasi itu sendiri, rincian lengkap tempat yang telah Anda buka atau simpan, serta gambar peta yang telah Anda lihat (disimpan paling lama dua minggu), sehingga halaman-halaman dan bagian peta itu dapat berfungsi tanpa koneksi. Halaman-halaman ini sama dengan halaman publik yang dapat dibuka siapa saja; semuanya tetap berada di perangkat Anda dan tidak pernah dikirim kepada kami, meskipun secara keseluruhan menunjukkan tempat mana saja dan bagian peta mana saja yang Anda lihat — menghapus data situs ini akan menghapusnya.',
      ],
    },
    {
      heading: 'Masuk',
      text: 'Masuk bersifat opsional dan menggunakan akun Google Anda, melalui Supabase Auth. Supabase menyimpan alamat email dan ID akun yang diberikan Google kepada kami. Selama Anda masuk, akun Anda memuat tempat mana yang Anda simpan atau tandai sudah dikunjungi, beserta waktunya — tidak ada yang lain: tanpa nama, tanpa koordinat, tanpa foto, tanpa lokasi. Jika Anda menyimpan tempat di perangkat ini sebelum masuk, tempat-tempat itu bergabung ke akun Anda saat pertama kali Anda masuk — itu juga alasan mengapa keluar mengosongkan perangkat: di perangkat bersama atau pinjaman, tanpa hal itu, orang berikutnya yang masuk akan ikut mewarisinya. Mengeluarkan suatu tempat dari simpanan tidak menghapusnya dari akun Anda: akun tetap menyimpan satu baris yang mencatat bahwa Anda mengeluarkannya dari simpanan, dan kapan, agar tempat itu tidak dapat diam-diam muncul lagi nanti — baris itu disimpan sampai Anda menghapusnya. Keluar, baik di perangkat ini maupun karena sesi berakhir begitu saja (sesi masuk yang kedaluwarsa atau dicabut, atau keluar di tab atau perangkat lain), menghapus tempat-tempat itu dari perangkat ini; akun Anda tetap menyimpannya sampai Anda menghapusnya. “Hapus tempat tersimpan saya” di Profil menghapus setiap catatan tempat yang disimpan, dikunjungi, dan dikeluarkan dari simpanan yang dimiliki akun Anda, serta mengosongkan perangkat ini. Tindakan itu tidak dapat menjangkau perangkat lain: perangkat tempat Anda masih masuk tetap menyimpan salinannya sendiri dan akan mengunggahnya ke akun Anda pada sinkronisasi berikutnya, jadi keluarlah dulu di perangkat itu jika Anda ingin akun tetap kosong. Tindakan ini tidak menghapus akun Google Anda, dan tidak menghapus catatan masuk yang disimpan aplikasi ini untuk akun tersebut (alamat email dan ID akun Anda): untuk meminta catatan itu dihapus, kirimkan pesan ke alamat di bawah ini.',
    },
    {
      heading: 'Saat Anda mengirim laporan',
      text: 'Jika Anda mengusulkan restoran atau melaporkan informasi yang salah, kami menerima apa yang Anda ketik: restoran dan kira-kira di mana letaknya, tentang apa laporan itu, pesan Anda, tautan opsional, dan alamat email opsional, beserta bahasa aplikasi dan waktu pengiriman. Selama Anda mengetik nama restoran, mulai dari dua karakter, teks yang telah Anda ketik sejauh itu dikirim ke Kakao Map untuk mengambil tempat yang cocok — baik Anda memilih salah satunya maupun tidak. Jika Anda memilih salah satu saran, laporan juga memuat alamat dan koordinat tempat itu sebagaimana tercatat di Kakao Map. Kami menggunakannya hanya untuk memeriksa dan mengoreksi informasi restoran. Laporan tidak pernah dipublikasikan apa adanya — seseorang memverifikasi setiap laporan sebelum ada yang berubah di peta. Alamat email Anda hanya digunakan untuk mengajukan pertanyaan lanjutan kepada Anda, tidak pernah ditampilkan kepada publik, dan tidak pernah dijual atau dibagikan untuk pemasaran.',
    },
    {
      heading: 'Berapa lama kami menyimpannya',
      text: `Kami menyimpan isi laporan dan keputusan kami atasnya sebagai bagian dari catatan tentang bagaimana informasi restoran diperiksa. Alamat email Anda dihapus ${LEAD_EMAIL_RETENTION_DAYS / 365 === 1 ? 'satu tahun' : `${LEAD_EMAIL_RETENTION_DAYS} hari`} setelah Anda mengirim laporan, atau lebih awal jika Anda memintanya.`,
    },
    {
      heading: 'Layanan yang terlibat',
      items: [
        'Vercel Inc. (Amerika Serikat) menjadi host aplikasi ini. Seperti host web mana pun, Vercel menerima data teknis permintaan seperti alamat IP Anda ketika Anda membuka situs.',
        'Kakao Corp. (Republik Korea) menyediakan pencarian restoran yang ditampilkan selama Anda mengetik nama di formulir laporan. Teks yang telah Anda ketik diteruskan ke Kakao oleh server kami, bukan dikirim langsung dari browser Anda, sehingga Kakao tidak menerima alamat IP Anda.',
        'Supabase Inc. (Amerika Serikat) menyimpan laporan yang Anda kirim, dan — jika Anda masuk — akun Anda (alamat email, ID akun) serta tempat yang Anda simpan atau tandai sudah dikunjungi. Browser Anda juga menanyakan langsung kepada Supabase, bahkan saat Anda tidak masuk, apakah proses masuk dengan Google diaktifkan, yang mengirimkan alamat IP Anda ke Supabase tetapi tidak mengirimkan informasi lain tentang Anda.',
        'Google LLC (Amerika Serikat), melalui Supabase, adalah pihak yang Anda gunakan untuk masuk jika Anda memilih masuk. Google memberikan alamat email dan ID akun Anda kepada Supabase; kami tidak pernah melihat kata sandi Google Anda.',
        'OpenStreetMap menyediakan gambar peta. Browser Anda memintanya secara langsung, yang mengirimkan alamat IP Anda ke OpenStreetMap dan, seperti pada peta mana pun, area mana yang sedang Anda lihat — setelah “Tampilkan lokasi saya”, area itu adalah area di sekitar Anda. Jenis huruf (Pretendard GOV) disajikan dari situs ini sendiri, bukan dari layanan font.',
        'Tautan ke Google Maps, Naver Map, Kakao Map, dan situs web restoran membawa Anda ke layanan-layanan tersebut; di sana berlaku kebijakan privasi masing-masing layanan.',
      ],
    },
    {
      heading: 'Pilihan Anda',
      text: 'Anda dapat meminta kami untuk menunjukkan, mengoreksi, atau menghapus laporan yang Anda kirim atau alamat email yang terlampir padanya. Anda dapat menghapus sendiri semua yang tersimpan di perangkat Anda kapan saja. Jika Anda sedang masuk, “Hapus tempat tersimpan saya” di Profil menghapus catatan tempat yang Anda simpan, kunjungi, dan keluarkan dari simpanan dari akun Anda dan dari perangkat ini — tetapi perangkat lain tempat Anda masih masuk dapat mengunggah data yang masih dimilikinya, jadi keluarlah dulu di perangkat itu. Tindakan itu tidak menghapus akun Google Anda, dan tidak menghapus catatan masuk yang disimpan aplikasi ini untuk akun tersebut (alamat email dan ID akun Anda): untuk meminta catatan itu dihapus, kirimkan pesan ke alamat di bawah ini.',
    },
    {
      heading: 'Perubahan',
      text: 'Jika apa yang dikumpulkan aplikasi berubah, halaman ini akan diperbarui terlebih dahulu, dengan tanggal berlaku yang baru.',
    },
  ],
};
