# Watiket

Platform tiket berbasis WhatsApp yang membantu tim layanan mengelola percakapan pelanggan dalam satu tempat. Proyek ini merupakan penerus Whaticket dengan backend yang telah dimigrasikan ke [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) sehingga tidak lagi membutuhkan Chromium/puppeteer.

## Pembaruan Terbaru
- Integrasi resmi dengan Baileys multi-device (lebih ringan, tanpa browser headless).
- Struktur penyimpanan sesi baru (`.baileys-*`) dan dukungan variabel `BAILEYS_AUTH_DIR`.
- Skrip pengembangan: `npm run dev` (hot reload) dan `npm run build && npm start` untuk mode produksi.
- Penyesuaian env frontend: `REACT_APP_BACKEND_URL` dan `REACT_APP_HOURS_CLOSE_TICKETS_AUTO`.

## Fitur Utama
- Multi pengguna dalam satu atau banyak nomor WhatsApp.
- Tiket otomatis untuk setiap percakapan masuk.
- Entri kontak manual serta dukungan kirim/terima teks, media, dan balasan terkutip.
- Notifikasi dan pembaruan status percakapan secara real time via WebSocket.

## Tumpukan Teknologi
- **Backend:** Node.js, Express, Sequelize, MySQL/MariaDB, Baileys.
- **Frontend:** React (Create React App + Material UI).
- **Database:** MySQL/MariaDB (disarankan ≥ 10.5) atau kompatibel dengan konfigurasi Sequelize.

## Prasyarat
- Node.js 20 LTS (minimal 20, Baileys 7 membutuhkan Node.js ≥ 20). Repositori menyertakan file `.nvmrc` agar `nvm use` otomatis memilih versi tersebut.
- npm 8+ atau yarn setara.
- MySQL/MariaDB dengan akses `utf8mb4`.
- Git.

## Struktur Proyek
- `backend/` – API, worker, dan integrasi Baileys.
- `frontend/` – aplikasi React.
- `docker-compose.yaml` – orkestrasi backend, frontend, dan database untuk pengujian cepat.
- `images/` – materi promosi & tangkapan layar.

## Menjalankan secara Lokal

### 1. Kloning repositori
```
git clone <repo-url>
cd watiket
```

### 2. Siapkan database
Gunakan instalasi MySQL/MariaDB lokal atau jalankan kontainer sederhana:
```
docker run --name watiket-mysql \
  -e MYSQL_ROOT_PASSWORD=strongpassword \
  -e MYSQL_DATABASE=waticket \
  -p 3306:3306 \
  -d mariadb:10.6 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_bin
```
Sesuai kebutuhan, buat user tambahan dan berikan hak akses ke database `waticket`.

### 3. Konfigurasi backend
```
cd backend
cp .env.example .env
```
Isi `.env` sesuai kebutuhan:
```
NODE_ENV=development
BACKEND_URL=http://localhost
FRONTEND_URL=http://localhost:3000
PROXY_PORT=8080
PORT=8080

DB_DIALECT=mysql
DB_HOST=127.0.0.1
DB_USER=waticket
DB_PASS=waticket
DB_NAME=waticket
DB_PORT=3306

JWT_SECRET=ubah_ini
JWT_REFRESH_SECRET=ubah_ini_juga
# Opsional: override folder penyimpanan kredensial Baileys
BAILEYS_AUTH_DIR=.baileys
```
Instal dependensi dan siapkan database (kompilasi diperlukan agar migration/seed tersedia di `dist/`):
```
npm install
npm run build
npx sequelize db:migrate
npx sequelize db:seed:all
```
Selama pengembangan gunakan hot reload:
```
npm run dev
```
Untuk menjalankan build hasil kompilasi:
```
npm start
```

### 4. Konfigurasi frontend
```
cd ../frontend
cp .env.example .env
```
Perbarui nilai sesuai backend yang berjalan, contohnya:
```
REACT_APP_BACKEND_URL=http://localhost:8080/
REACT_APP_HOURS_CLOSE_TICKETS_AUTO=48
```
Lalu install dan jalankan:
```
npm install
npm start
```
Aplikasi akan tersedia di http://localhost:3000.

### 5. Langkah pertama di aplikasi
1. Buka `http://localhost:3000/signup`, buat akun admin pertama.
2. Masuk, buka menu **Connections**, tambah koneksi WhatsApp baru.
3. Tekan tombol QR Code, pindai menggunakan aplikasi WhatsApp.
4. Setelah status **CONNECTED**, pesan masuk akan otomatis membuat tiket.

## Menjalankan dengan Docker Compose
Project ini menyediakan `docker-compose.yaml` untuk eksplorasi cepat.

```
# Jalankan semua layanan (backend, frontend, mysql)
docker compose up -d
```

Sebelum menjalankan, Anda dapat menyiapkan file `.env` di root untuk menimpa nilai default berikut:
```
BACKEND_PORT=8080
FRONTEND_PORT=3000
FRONTEND_SSL_PORT=3001
MYSQL_PORT=3306
MYSQL_DATABASE=waticket
MYSQL_ROOT_PASSWORD=strongpassword
BACKEND_URL=http://localhost
FRONTEND_URL=http://localhost:3000
PROXY_PORT=8080
BAILEYS_AUTH_DIR=/usr/src/app/.baileys
```
Simpan kredensial Baileys pada volume persisten agar sesi tidak hilang saat kontainer di-restart:
```
mkdir -p backend/.baileys
```
Lalu tambahkan volume tersebut ke service backend pada `docker-compose.yaml` jika diperlukan.

## Variabel Lingkungan Penting
- `BACKEND_URL` – URL publik backend untuk keperluan CORS.
- `FRONTEND_URL` – URL publik frontend.
- `PROXY_PORT` – port yang digunakan reverse proxy atau frontend untuk mengakses backend.
- `PORT` – port dengar backend (default 8080).
- `JWT_SECRET` & `JWT_REFRESH_SECRET` – ganti dengan nilai acak dan aman.
- `BAILEYS_AUTH_DIR` – folder kredensial sesi WhatsApp (default `.baileys-{id}` di root backend).
- `REACT_APP_BACKEND_URL` – base URL API untuk frontend.
- `REACT_APP_HOURS_CLOSE_TICKETS_AUTO` – durasi auto-close tiket (jam).

## Tips & Troubleshooting
- **Sesi logout** – pastikan `BAILEYS_AUTH_DIR` berada pada volume/direktori persisten.
- **Database migration gagal** – cek kredensial DB dan pastikan karakter set `utf8mb4` diaktifkan.
- **Port bentrok** – ubah `PORT`, `BACKEND_PORT`, atau `FRONTEND_PORT` pada `.env` root.
- **Node versi lama** – Baileys membutuhkan Node.js ≥16. Disarankan upgrade ke 18 LTS.

## Catatan Penting
- Penggunaan integrasi WhatsApp non-resmi selalu memiliki risiko pemblokiran akun. Gunakan dengan tanggung jawab Anda sendiri.
- Proyek ini tidak berafiliasi dengan WhatsApp Inc. atau Meta Platforms.
- Pastikan untuk mematuhi hukum dan kebijakan privasi setempat saat mengelola data pelanggan.


