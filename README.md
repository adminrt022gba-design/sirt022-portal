# SIRT 022 Portal Warga - Vercel Ready

Struktur:
- index.html
- style.css
- app.js
- config.js
- profiles.sql

Catatan:
- `profiles.sql` adalah SQL Supabase, bukan JavaScript.
- `config.js` hanya boleh berisi Supabase Project URL dan Publishable/Anon key.
- Tambahkan `logo.png` ke folder project jika ingin logo tampil.
- `app.js` memakai nama tabel yang dirujuk oleh halaman: profiles, wilayah_rt022, warga, pengumuman, kegiatan, laporan_warga, pengurus, adart, dan pengaturan.

Deploy:
1. Upload semua file ke repository GitHub.
2. Import repository tersebut ke Vercel.
3. Framework Preset: Other.
4. Build Command: kosong.
5. Output Directory: `.`.
6. Deploy.

PENTING:
SQL yang ada di `profiles.sql` tetap dijalankan di Supabase SQL Editor, bukan di Vercel.
