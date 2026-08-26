# SIRT 022 Portal Warga

Portal warga RT 022 Blok G-H Griya Budiman Asri.

## Deploy ke Vercel
1. Upload folder ini ke GitHub, atau gunakan Vercel untuk import project.
2. Setelah project dibuat, portal bisa langsung dibuka.
3. Untuk tahap koneksi database, isi `public/config.js` dengan:
   - Supabase Project URL
   - Supabase Publishable Key
4. Jangan pernah memasukkan Secret key/service_role ke file browser.

## Supabase
Database yang sudah dibuat:
- warga
- kartu_keluarga
- kas_rt
- iuran
- pengumuman
- kegiatan
- laporan_warga

RLS sudah diaktifkan pada tabel-tabel tersebut.
