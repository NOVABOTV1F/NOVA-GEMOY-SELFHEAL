# NOVA GEMOY SELF-HEAL

Bot web **cewe cantik & gemoy** yang hidup (pakai Groq) + **self-healing**.

Saat diserang → panik → terminal repair → security level naik → senyum dingin + taunting.

Live (setelah deploy): https://nova.aminaputra6.workers.dev/

## Fitur sekarang

- Chat **benar-benar hidup** lewat Groq API
- System prompt lengkap: kepribadian gemoy + taunting saat diserang + self-heal lore
- Mode visual: **Panic → Repair (terminal) → Taunt**
- Security Level naik setiap berhasil self-heal
- Memori percakapan (localStorage)
- Deteksi kata serangan (hack, ddos, serang, dll) → trigger animasi + jawaban taunting dari AI

## Deploy / Update ke Cloudflare Worker

1. Install Wrangler (kalau belum):
   ```bash
   npm i -g wrangler
   ```

2. Login:
   ```bash
   wrangler login
   ```

3. Masuk folder repo, set secret API key Groq:
   ```bash
   wrangler secret put GROQ_API_KEY
   ```
   (paste token Groq-mu, dapat di https://console.groq.com )

4. Deploy:
   ```bash
   wrangler deploy
   ```

Kalau nama worker-nya sudah `nova` dan domain-nya `nova.aminaputra6.workers.dev`, langsung ke situ.

## File penting

| File | Fungsi |
|------|--------|
| `src/worker.js` | Worker + HTML + endpoint `/api/chat` + system prompt Nova |
| `wrangler.toml` | Config Worker |
| `index.html` | Versi static lama (boleh diabaikan, sekarang HTML di dalam worker) |

## Yang masih bisa ditambah nanti

- Model 3D cewe yang lebih cantik (glTF / VRM)
- Animasi repair lebih cinematic
- Cloudflare KV untuk memori lintas device
- Rate limit adaptif di Worker

---
Dibuat untuk **NOVABOTV1F**