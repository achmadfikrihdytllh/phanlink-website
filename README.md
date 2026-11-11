# Phanlink Web (frontend)

Antarmuka web **Phantom Messenger**, dibangun dengan Angular 22. Backend-nya ada di repo [`phanlink`](https://github.com/achmadfikrihdytllh/phanlink) (Laravel).

## Fitur

Enam halaman dalam satu shell:

- **Messages:** daftar percakapan, chat realtime, pesan baru, lampiran.
- **Groups:** daftar grup, buat grup, undang anggota, file bersama, bisukan dan sematkan.
- **Saved:** pesan tersimpan, koleksi, unduh file, lompat ke chat.
- **Contacts:** daftar kontak, tambah kontak, nickname dan catatan, profil kontak.
- **Search:** pencarian pesan dan file dengan filter percakapan.
- **Settings:** tema (Phantom, Midnight, Paper), kepadatan pesan, notifikasi, privasi, hapus data lokal.
- **Profil:** ganti foto, nama, username, bio, dan nomor HP (buka dari avatar di rail atau footer daftar).

**Responsif:** desktop tiga kolom, tablet dua panel dengan laci info, HP satu panel dengan bar tab di bawah dan tombol kembali. Mendukung PWA (manifest ada di `public/`).

## Kebutuhan

- Node.js **22.22.3 atau lebih baru** (atau 24.15.0 atau lebih baru). Cek dengan `node -v`.
- Backend `phanlink` sudah berjalan (lihat README-nya).

## Menjalankan di lokal

```bash
npm install
npm start          # ng serve -> http://localhost:4200
```

Di PowerShell yang memblokir skrip, pakai `npm.cmd install` dan `npm.cmd start`.

### Alamat backend

`npm start` memakai `src/environments/environment.development.ts`:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000/api',   // ubah bila backend memakai port lain, mis. 8001
  reverbAppKey: 'a1int0v4sq8h21egbyfk',  // sama dengan REVERB_APP_KEY di backend
  reverbHost: 'localhost',
  reverbPort: 8080,
  reverbScheme: 'http',
};
```

`src/environments/environment.ts` dipakai untuk build produksi. Isi `apiUrl` dan `reverbHost` dengan alamat backend yang sudah online.

### Login demo

Setelah backend di-seed: `joker` / `password` (akun lain: `skull`, `panther`, `queen`, `oracle`, `fox`, `mona`, semuanya `password`).

## Build

```bash
npm run build      # hasil di dist/
```

Hasil build berupa situs statis, jadi bisa di-host di Firebase Hosting, Netlify, Cloudflare Pages, atau disajikan langsung oleh Laravel dari folder `public/`. Atur fallback ke `index.html` untuk semua rute (single-page app).

## Menguji tampilan HP

Di Chrome: F12, lalu Ctrl+Shift+M, dan pilih ukuran HP.

## Struktur

```
src/app/
  core/       model, service API, auth, guard, interceptor
  features/   shell, messages, groups, saved, contacts, search, settings, profile, auth
  shared/     page-frame (tata letak 3 panel), icon, avatar, new-dialog
src/environments/   alamat backend dev dan produksi
public/             manifest PWA dan ikon
```

## Menjadikan aplikasi Android

Setelah frontend dan backend online (HTTPS), bisa dibungkus dengan Capacitor atau PWABuilder tanpa biaya. Untuk PWABuilder, ikon manifest perlu PNG 192 dan 512.

## Perintah lain

```bash
ng test       # unit test (Vitest)
ng generate component nama-komponen
```
