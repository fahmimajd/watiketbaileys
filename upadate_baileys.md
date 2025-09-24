# Migrasi ke Baileys (@whiskeysockets/baileys) — Checklist

Dokumen ini merangkum langkah-langkah yang perlu dilakukan untuk memigrasi backend dari `whatsapp-web.js` ke `@whiskeysockets/baileys` dengan gangguan minimal, mempertahankan API internal seperti `initWbot/getWbot/removeWbot`.

## 1) Dependensi
- Hapus: `whatsapp-web.js`, `qrcode-terminal`, dan konfigurasi/opsi `puppeteer` terkait wweb.
- Tambah: `@whiskeysockets/baileys`, `pino` (logger). Opsional: store (gunakan pola internal atau package komunitas sesuai kebutuhan).
- Update `backend/package.json` (dependencies, types jika ada import tipe wweb).

## 2) Adapter Session (libs/wbot)
- Ubah `backend/src/libs/wbot.ts` untuk memakai Baileys:
  - Inisialisasi: `useMultiFileAuthState`, `makeWASocket({ auth: state })`.
  - Pertahankan API: `initWbot(whatsapp)`, `getWbot(id)`, `removeWbot(id)`; simpan instance per `whatsapp.id` seperti sebelumnya.
  - Siapkan `loadMessage` callback (ambil pesan dari DB/store) untuk dukung quote/delete.
- Pastikan emisi event ke frontend (`io.emit('whatsappSession', ...)`) tetap kompatibel.

## 3) QR & Status Koneksi
- Dengarkan `sock.ev.on('connection.update', ({ qr, connection, lastDisconnect }))`.
- Mapping ke DB `Whatsapp` dan event socket:
  - QR: simpan `qrcode` saat tersedia; kosongkan saat connected.
  - Status: connecting → `OPENING`, open → `CONNECTED`, close → `DISCONNECTED`/`TIMEOUT`.
- Hapus `qrcode-terminal`; frontend tetap membaca `qrcode` dari DB seperti sekarang.

## 4) Listener Pesan Masuk
- Ganti `backend/src/services/WbotServices/wbotMessageListener.ts` untuk konsumsi event Baileys:
  - `sock.ev.on('messages.upsert', ({ messages, type }))` → proses pesan baru.
  - `sock.ev.on('messages.update')`, `sock.ev.on('message-receipt.update')` → update status/ACK.
- Normalisasi struktur Baileys (JID, key.id, fromMe, body, media, quoted) ke bentuk internal yang dipakai service/ticketing.

## 5) Kirim Pesan (Teks & Media)
- `backend/src/services/WbotServices/SendWhatsAppMessage.ts`:
  - Ubah ke `sock.sendMessage(jid, { text }, { quoted })`.
  - Bangun `quoted` dari pesan DB atau `loadMessage` (key: { remoteJid, id, fromMe }).
- `backend/src/services/WbotServices/SendWhatsAppMedia.ts`:
  - Map payload ke `{ image|video|audio|document, caption, mimetype, fileName }`.

## 6) Kontak & Profil
- `CheckNumber.ts` / `CheckIsValidContact.ts`: gunakan `sock.onWhatsApp(jid)` untuk validasi nomor.
- `GetProfilePicUrl.ts`: gunakan `sock.profilePictureUrl(jid, 'image')` (fallback bila tidak ada).
- `ImportContactsService.ts`: dengarkan `contacts.upsert`/`contacts.update` atau lakukan import on-demand sesuai kebutuhan aplikasi.

## 7) Helper & Tipe Internal
- `backend/src/helpers/GetTicketWbot.ts`: ubah return type ke instance socket Baileys (bukan `Client`).
- `backend/src/helpers/GetWbotMessage.ts`: ganti strategi ambil pesan (Baileys tidak expose fetch history seperti wweb); gunakan store/DB atau `loadMessage`.
- `backend/src/helpers/SerializeWbotMsgId.ts`: sesuaikan ke `msg.key.id` (tambahkan `remoteJid` jika diperlukan untuk unik).
- `backend/src/helpers/SetTicketMessagesAsRead.ts`: gunakan `sock.readMessages([key])` atau `sendPresenceUpdate` sesuai kebutuhan.

## 8) Operasi Pesan Lain
- `DeleteWhatsAppMessage.ts`: gunakan `sock.sendMessage(jid, { delete: key })`.
- Mapping ACK/status: gunakan event `message-receipt.update`/`messages.update` untuk memetakan ke enum ACK internal (mis. sent, delivered, read).

## 9) Monitor/Status Device
- `backend/src/services/WbotServices/wbotMonitor.ts`:
  - Fokus pada status koneksi dari `connection.update`.
  - Field `battery`/`plugged` umumnya tidak tersedia langsung di Baileys → set `null`/stop update pada field tersebut atau sembunyikan di UI.

## 10) Controller & Routes
- Audit pemanggilan di controller berikut dan pastikan impor ke `../libs/wbot` tetap valid:
  - `backend/src/controllers/WhatsAppController.ts`
  - `backend/src/controllers/WhatsAppSessionController.ts`
  - `backend/src/controllers/MessageController.ts`
  - `backend/src/controllers/ApiController.ts`
  - `backend/src/controllers/TicketController.ts`
- Hapus impor langsung tipe/kelas dari `whatsapp-web.js` di service/controller.

## 11) Model & Database
- Pertahankan field: `qrcode`, `status`, `session` (auth state Baileys disimpan di filesystem via `useMultiFileAuthState`).
- Tinjau field `battery`, `plugged`: hentikan update jika tidak didukung; sesuaikan tampilan frontend bila perlu.

## 12) Pencarian & Penggantian Import
- Cari dan ganti semua impor dari `whatsapp-web.js`:
  - `Client`, `LocalAuth`, `Message`, `Contact`, `MessageMedia`, `MessageAck`.
  - Metode spesifik wweb: `sendSeen`, `getChatById`, `getMessages` → sediakan padanan atau adaptasi.
- Gunakan tipe internal adapter agar Baileys tidak “bocor” ke seluruh codebase.

## 13) Store Pesan (Disarankan)
- Tambahkan store sederhana (in-memory/DB) untuk cache pesan guna mendukung quote/delete/receipt:
  - Populate via `sock.ev.on('messages.upsert')`.
  - Sediakan helper `getMessageKeyByInternalId` bila perlu.

## 14) Pembersihan
- Hapus opsi `puppeteer` dan utilitas khusus wweb di `libs/wbot.ts`.
- Hapus ketergantungan `qrcode-terminal`.
- Perbarui README singkat tentang kebutuhan Node dan Baileys.

## 15) Pengujian Alur Penting
- Inisialisasi + QR tampil di frontend; status berubah dari `OPENING` → `CONNECTED`.
- Menerima pesan teks/media; tiket otomatis terbentuk dan ter-update.
- Mengirim teks/media; quote balasan; hapus pesan terkirim.
- Read receipt/ACK ter-update sesuai event Baileys.
- Reconnect setelah restart (auth tersimpan via `useMultiFileAuthState`).
- Logging memadai (gunakan `pino`) untuk `connection.update` dan `messages.*`.

## Catatan Implementasi Cepat
- Skeleton inisialisasi:

```ts
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'

const { state, saveCreds } = await useMultiFileAuthState('.baileys')
const sock = makeWASocket({ auth: state, printQRInTerminal: false })
sock.ev.on('creds.update', saveCreds)
sock.ev.on('connection.update', ({ qr, connection }) => { /* update DB + emit */ })
sock.ev.on('messages.upsert', ({ messages }) => { /* handleMessage adapter */ })
```

- Kirim pesan:

```ts
await sock.sendMessage(jid, { text }, { quoted })
// media: await sock.sendMessage(jid, { image|video|audio|document: buffer/stream, caption, mimetype, fileName })
```

npx sequelize db:seed --seed 20250911000100-add-out-of-hours-settings.js