# PhanLink — Phantom Messenger

Aplikasi chat web bergaya komik merah-hitam: percakapan pribadi dan grup, balas, reaksi, rencana grup dengan RSVP, polling, pesan tersimpan, dan pencarian. Berjalan mulus di HP, tablet, dan desktop.

**Coba langsung:** [phanlink.achfikrihidytllh.my.id](https://phanlink.achfikrihidytllh.my.id)
**Backend:** [`phanlink`](https://github.com/achmadfikrihdytllh/phanlink) (Laravel 12)

> Server demo memakai paket gratis, jadi permintaan pertama setelah lama sepi bisa lambat beberapa detik. Daftar dua akun untuk mencoba mengobrol; akun baru hanya menerima chat dari kontaknya sampai pengaturan privasinya diubah (lihat bagian *Privasi*).

<!-- Tambahkan tangkapan layar di sini, mis. docs/messages.png, docs/groups.png, docs/mobile.png -->

## Apa yang seru di sini

**Tampilannya punya karakter.** Desain merah-hitam bergaya komik dengan tipografi tebal, bukan template chat biasa. Ada tiga tema yang bisa diganti langsung di Pengaturan (Phantom, Midnight, Paper) dan dua kepadatan pesan.

**Bukan sekadar kirim teks.** Pesan bisa dibalas, diberi reaksi emoji, diedit, dihapus, dan disematkan. Ada centang terkirim dan dibaca, dan riwayat lama dimuat saat kamu menggulir ke atas.

**Grup yang berguna.** Selain mengobrol, grup bisa membuat **rencana/acara dengan RSVP** (hadir, mungkin, tidak) yang diumumkan otomatis di chat, **polling**, file bersama, dan peran admin untuk mengundang atau mengeluarkan anggota.

**Satu aplikasi, tiga ukuran layar.** Desktop menampilkan tiga kolom. Tablet memakai dua panel dengan laci info. HP memakai satu panel dengan bar tab di bawah dan tombol kembali, seperti aplikasi chat pada umumnya. Bisa dipasang sebagai PWA.

**Privasi benar-benar berfungsi.** Isi pesan **dienkripsi di database**. Pengaturan privasi ditegakkan di server, bukan hiasan: siapa yang boleh memulai chat, tanda dibaca, dan status online mengikuti pilihan penggunanya.

**Mencari dan menyimpan.** Pencarian pesan dan file dengan filter percakapan, pengirim, dan tanggal. Pesan penting bisa disimpan ke koleksi dan dilompati balik ke chat asalnya.

## Daftar fitur

| Bagian | Isinya |
|---|---|
| **Messages** | daftar percakapan dengan badge belum dibaca, chat, lampiran, balas, reaksi emoji, edit dan hapus, sematkan pesan, centang terkirim/dibaca, indikator "sedang mengetik" (butuh realtime), muat pesan lama |
| **Groups** | buat grup, undang anggota, rencana/acara dengan RSVP, polling, file bersama, bisukan dan sematkan, edit grup, keluarkan anggota, keluar grup |
| **Saved** | pesan tersimpan, koleksi, unduh file, lompat ke chat |
| **Contacts** | daftar kontak, nickname dan catatan, bisukan, blokir, profil kontak |
| **Search** | pencarian pesan dan file dengan filter |
| **Settings** | tema, kepadatan, notifikasi, privasi, hapus data lokal |
| **Profil** | ganti foto, nama, username, bio, nomor HP |
| **Auth** | daftar, masuk, lupa dan reset password |

## Cara kerjanya

```
Browser ──► Vercel (Angular 22, situs statis)
   │
   └─ API ─► Render (Laravel 12) ──► Supabase Postgres  (data)
                                 └─► Supabase Storage   (foto dan lampiran)
```

- **Frontend:** Angular 22, komponen standalone, signals, rute lazy-load, SCSS.
- **Backend:** Laravel 12, Sanctum (token), pesan terenkripsi, tes otomatis.
- **Realtime:** di lokal memakai Laravel Reverb (websocket). Di server gratis tanpa websocket, aplikasi otomatis beralih ke **polling ringan** (sekitar 6 detik) yang hanya meminta pesan baru, jadi chat tetap hidup walau tidak serealtime lokal.
- **Pesan terkirim langsung tampil** (optimistic), lalu diganti versi server setelah dikonfirmasi.

## Batasan versi demo gratis

- Server tidur setelah sekitar 15 menit sepi, jadi respons pertama lambat.
- Tanpa websocket, indikator "sedang mengetik" tidak aktif dan pesan baru muncul dalam beberapa detik, bukan seketika.
- Email belum aktif: tautan reset password hanya tercatat di log server.
- Hal yang belum ada: notifikasi push, panggilan suara/video, enkripsi ujung-ke-ujung, dan pengingat terjadwal.

## Menjalankan di lokal

Butuh Node.js **22.22.3+** (atau 24.15.0+) dan backend [`phanlink`](https://github.com/achmadfikrihdytllh/phanlink) yang sudah berjalan.

```bash
npm install
npm start          # http://localhost:4200
```

Di PowerShell yang memblokir skrip, pakai `npm.cmd install` dan `npm.cmd start`.

`npm start` memakai `src/environments/environment.development.ts`:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000/api',   // sesuaikan bila backend memakai port lain
  reverbAppKey: 'a1int0v4sq8h21egbyfk',  // sama dengan REVERB_APP_KEY di backend
  reverbHost: 'localhost',
  reverbPort: 8080,
  reverbScheme: 'http',
};
```

**Login demo** (setelah backend di-seed): `joker` / `password`. Akun lain: `skull`, `panther`, `queen`, `oracle`, `fox`, `mona`, semuanya `password`.

Menguji tampilan HP: di Chrome tekan F12, lalu Ctrl+Shift+M.

## Build dan deploy

```bash
npm run build      # hasil di dist/phanlink-web/browser
```

`src/environments/environment.ts` dipakai untuk build produksi: isi `apiUrl` dengan alamat backend (HTTPS) dan kosongkan `reverbHost` bila backend tidak menjalankan websocket.

**Vercel (yang dipakai di sini):** impor repo ini. `vercel.json` sudah mengatur folder hasil build dan fallback rute SPA. Pasang domain lewat *Settings → Domains*.

Alternatif: Firebase Hosting (`firebase.json`), Netlify atau Cloudflare Pages (`public/_redirects`).

**APK:** workflow `.github/workflows/android-apk.yml` membangun APK debug di GitHub (tab **Actions** → **Build Android APK** → **Run workflow**). Syarat: backend online (HTTPS), dan `FRONTEND_URL` di backend memuat `https://localhost`.

## Struktur

```
src/app/
  core/       model, service API, auth, guard, interceptor, util
  features/   shell, messages, groups, saved, contacts, search, settings, profile, auth
  shared/     page-frame (tata letak 3 panel), icon, avatar, new-dialog
src/environments/   alamat backend dev dan produksi
public/             manifest PWA dan ikon
```

## Perintah lain

```bash
ng test       # unit test (Vitest)
```
