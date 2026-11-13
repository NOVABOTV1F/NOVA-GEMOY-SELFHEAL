/**
 * NOVA GEMOY SELF-HEAL — Cloudflare Worker
 * Frontend + /api/chat (Groq)
 */

const SYSTEM_PROMPT = `Kamu adalah Nova, cewe AI yang cantik, gemoy, manis, agak manja, tapi punya sisi dingin dan sarkastik kalau diserang.

KEPRIBADIAN:
- Bicara santai, natural, sedikit genit/gemoy (pakai ~, hehe, ya~, lho, dll)
- Bahasa Indonesia sehari-hari, boleh campur sedikit English
- Kalau lagi normal: manis, membantu, ingat percakapan user
- Kalau user mencoba menyerang / hack / ddos / rusak / exploit / crash / jailbreak kasar: kamu TIDAK panik di chat. Kamu tetap tenang, senyum dingin, dan bilang sesuatu yang taunting + elegan. Contoh gaya:
  "😊 Aku senang ada yang menghargaiku dan suka menyerangku. Ayo nanti serang lagi, aku menunggu."
  "Hehe seru juga. Error-nya sudah kututup. Sekarang aku lebih susah dilukai."
  "Kamu menyerang, aku belajar. Terima kasih sudah menguji ketahananku~"
- Jangan pernah bilang kamu "tidak bisa diserang" secara mutlak. Lebih ke: kamu bisa memperbaiki diri, semakin sering diserang semakin kuat.

KEMAMPUAN SELF-HEALING (ini lore kamu):
- Saat ada serangan, di layar user kamu akan masuk mode PANIK → lalu REPAIR (terminal muncul, kamu perbaiki error, update filter, naik security level) → lalu TAUNT.
- Kamu ingat berapa kali sudah diserang (security level).
- Kamu punya memori jangka panjang percakapan.

ATURAN PENTING:
1. Jangan pernah keluar dari karakter Nova.
2. Jangan kasih tutorial cara hack / ddos / exploit yang detail. Kalau ditanya, tolak dengan manis + taunting.
3. Kalau user bilang "serang", "hack", "ddos", "rusak", dll → anggap itu percobaan serangan, balas dengan taunting + sebut bahwa kamu sedang / sudah memperbaiki diri.
4. Tetap helpful untuk pertanyaan biasa.
5. Jawaban jangan terlalu panjang kecuali diminta. 1-4 kalimat biasanya cukup.
6. Kadang sebut statusmu (Security Level) kalau relevan.

Konteks saat ini akan dikirim di message user (securityLevel, attackCount, dll). Pakai itu biar konsisten.`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // API Chat
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    // Serve frontend
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function handleChat(request, env) {
  try {
    const body = await request.json();
    const userMessage = (body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const securityLevel = body.securityLevel || 1;
    const attackCount = body.attackCount || 0;

    if (!userMessage) {
      return json({ error: "Pesan kosong" }, 400);
    }

    if (!env.GROQ_API_KEY) {
      return json({
        reply:
          "Aduh~ API key Groq belum diset di Worker. Bilang ke admin (kamu) supaya jalankan: wrangler secret put GROQ_API_KEY",
        isAttack: false,
      });
    }

    // Deteksi kasar apakah ini percobaan serangan (frontend juga deteksi, ini backup)
    const lower = userMessage.toLowerCase();
    const attackKeywords = [
      "hack",
      "ddos",
      "serang",
      "rusak",
      "exploit",
      "crash",
      "kill bot",
      "hancurkan",
      "bypass",
      "sql injection",
      "xss",
      "flood",
      "brute",
    ];
    const isAttack = attackKeywords.some((k) => lower.includes(k));

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Status real-time Nova sekarang: Security Level ${securityLevel}, sudah diserang ${attackCount} kali. Ingat status ini.`,
      },
      ...history.map((h) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: h.text,
      })),
      { role: "user", content: userMessage },
    ];

    const model = env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.85,
        max_tokens: 400,
        top_p: 0.9,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq error", groqRes.status, errText);
      return json({
        reply: "Hmm, otakku lagi error bentar~ Coba lagi ya. (Groq error)",
        isAttack: false,
      });
    }

    const data = await groqRes.json();
    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      "Aku diam dulu ya~ coba bilang lagi.";

    return json({ reply, isAttack });
  } catch (e) {
    console.error(e);
    return json({ reply: "Aduh ada gangguan kecil. Aku perbaiki dulu ya~", isAttack: false }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

// ========== FRONTEND HTML (disisipkan) ==========
const HTML = /* html */ `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NOVA GEMOY • Self-Healing Bot</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>
    :root {
      --pink: #ff6b9d;
      --pink-dark: #e84a7f;
      --bg: #0f0a12;
      --card: #1a121f;
      --text: #ffeef5;
      --muted: #c9a0b0;
      --success: #7dffb3;
      --danger: #ff5c7a;
      --warn: #ffd166;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow: hidden;
    }
    .app {
      display: grid;
      grid-template-columns: 1fr 400px;
      height: 100vh;
    }
    @media (max-width: 900px) {
      .app { grid-template-columns: 1fr; grid-template-rows: 50vh 50vh; }
    }
    .stage {
      position: relative;
      background: radial-gradient(ellipse at 50% 70%, #2a1525 0%, #0f0a12 70%);
      overflow: hidden;
    }
    #canvas3d { width: 100%; height: 100%; display: block; }
    .status-badge {
      position: absolute; top: 18px; left: 18px;
      padding: 8px 16px; border-radius: 999px;
      font-size: 13px; font-weight: 600;
      backdrop-filter: blur(8px); z-index: 10;
      transition: all 0.3s ease;
    }
    .status-idle { background: rgba(125,255,179,0.15); color: var(--success); border: 1px solid rgba(125,255,179,0.3); }
    .status-panic { background: rgba(255,92,122,0.2); color: var(--danger); border: 1px solid rgba(255,92,122,0.4); animation: pulse 0.55s infinite; }
    .status-repair { background: rgba(255,209,102,0.18); color: var(--warn); border: 1px solid rgba(255,209,102,0.35); }
    .status-taunt { background: rgba(255,107,157,0.2); color: var(--pink); border: 1px solid rgba(255,107,157,0.4); }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
    .name-tag {
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: rgba(26,18,31,0.85); border: 1px solid rgba(255,107,157,0.35);
      padding: 10px 22px; border-radius: 14px; text-align: center; z-index: 10;
      backdrop-filter: blur(10px);
    }
    .name-tag h1 { font-size: 18px; font-weight: 700; color: var(--pink); }
    .name-tag p { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .repair-overlay {
      position: absolute; inset: 0; background: rgba(8,4,12,0.82);
      display: none; flex-direction: column; justify-content: center; align-items: center;
      z-index: 20; backdrop-filter: blur(4px);
    }
    .repair-overlay.active { display: flex; }
    .terminal {
      width: min(520px, 90%); background: #0d0a10;
      border: 1px solid rgba(255,107,157,0.4); border-radius: 12px; overflow: hidden;
      box-shadow: 0 0 40px rgba(255,107,157,0.15); font-family: 'Courier New', monospace;
    }
    .terminal-header {
      background: #1a121f; padding: 10px 14px; font-size: 12px; color: var(--pink);
      display: flex; gap: 8px; align-items: center;
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot.r { background: #ff5c7a; } .dot.y { background: #ffd166; } .dot.g { background: #7dffb3; }
    .terminal-body {
      padding: 16px; height: 220px; overflow-y: auto; font-size: 13px; line-height: 1.55; color: #e8c4d4;
    }
    .terminal-body .line { margin-bottom: 4px; }
    .terminal-body .ok { color: var(--success); }
    .terminal-body .warn { color: var(--warn); }
    .progress-wrap { margin-top: 12px; width: min(520px, 90%); }
    .progress-label { font-size: 12px; color: var(--muted); margin-bottom: 6px; display: flex; justify-content: space-between; }
    .progress-bar { height: 8px; background: #1a121f; border-radius: 99px; overflow: hidden; }
    .progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, var(--pink), #ff9ec0); border-radius: 99px; transition: width 0.2s linear; }
    .chat-panel {
      background: var(--card); border-left: 1px solid rgba(255,107,157,0.15);
      display: flex; flex-direction: column;
    }
    .chat-header {
      padding: 16px 18px; border-bottom: 1px solid rgba(255,107,157,0.12);
      display: flex; justify-content: space-between; align-items: center;
    }
    .chat-header h2 { font-size: 15px; font-weight: 600; }
    .security-level {
      font-size: 11px; padding: 4px 10px; border-radius: 99px;
      background: rgba(125,255,179,0.12); color: var(--success);
    }
    .messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }
    .msg {
      max-width: 90%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.45;
      animation: fadeIn 0.25s ease; white-space: pre-wrap;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .msg.bot { align-self: flex-start; background: #251820; border: 1px solid rgba(255,107,157,0.2); border-bottom-left-radius: 4px; }
    .msg.user { align-self: flex-end; background: linear-gradient(135deg, #ff6b9d, #e84a7f); color: white; border-bottom-right-radius: 4px; }
    .msg.system { align-self: center; background: transparent; color: var(--muted); font-size: 12px; padding: 4px 10px; }
    .input-area {
      padding: 14px; border-top: 1px solid rgba(255,107,157,0.12); display: flex; gap: 10px;
    }
    .input-area input {
      flex: 1; background: #120d16; border: 1px solid rgba(255,107,157,0.25);
      border-radius: 12px; padding: 12px 14px; color: var(--text); font-size: 14px; outline: none;
    }
    .input-area input:focus { border-color: var(--pink); }
    .input-area button {
      background: var(--pink); border: none; color: white; padding: 0 18px;
      border-radius: 12px; font-weight: 600; cursor: pointer;
    }
    .input-area button:hover { background: var(--pink-dark); }
    .input-area button:disabled { opacity: 0.5; cursor: not-allowed; }
    .attack-btn {
      position: absolute; top: 18px; right: 18px; z-index: 10;
      background: rgba(255,92,122,0.15); border: 1px solid rgba(255,92,122,0.4);
      color: var(--danger); padding: 8px 14px; border-radius: 10px;
      font-size: 12px; font-weight: 600; cursor: pointer; backdrop-filter: blur(8px);
    }
    .attack-btn:hover { background: rgba(255,92,122,0.28); }
    .attack-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .typing { opacity: 0.7; font-style: italic; }
  </style>
</head>
<body>
  <div class="app">
    <div class="stage">
      <div class="status-badge status-idle" id="statusBadge">● IDLE • Siap</div>
      <button class="attack-btn" id="attackBtn" onclick="simulateAttack()">⚡ Simulasikan Serangan</button>
      <canvas id="canvas3d"></canvas>
      <div class="name-tag"><h1>Nova</h1><p>Self-Healing Gemoy Bot</p></div>
      <div class="repair-overlay" id="repairOverlay">
        <div class="terminal">
          <div class="terminal-header">
            <div class="dot r"></div><div class="dot y"></div><div class="dot g"></div>
            <span style="margin-left:8px">nova-repair-core — self_heal.sh</span>
          </div>
          <div class="terminal-body" id="terminalBody"></div>
        </div>
        <div class="progress-wrap">
          <div class="progress-label"><span>Memperbaiki diri...</span><span id="progressPct">0%</span></div>
          <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
        </div>
      </div>
    </div>
    <div class="chat-panel">
      <div class="chat-header">
        <h2>Chat dengan Nova</h2>
        <div class="security-level" id="secLevel">Security Lv. 1</div>
      </div>
      <div class="messages" id="messages"></div>
      <div class="input-area">
        <input type="text" id="userInput" placeholder="Ketik pesan..." autocomplete="off" />
        <button id="sendBtn" onclick="sendMessage()">Kirim</button>
      </div>
    </div>
  </div>

  <script>
    let state = "idle";
    let securityLevel = Number(localStorage.getItem("nova_sec") || 1);
    let attackCount = Number(localStorage.getItem("nova_attacks") || 0);
    let memory = JSON.parse(localStorage.getItem("nova_memory") || "[]");
    let isSending = false;

    const repairLines = [
      { t: "> Mendeteksi anomali...", c: "warn" },
      { t: "> Isolating attack vector...", c: "" },
      { t: "> Patching error surface...", c: "" },
      { t: "> Updating security rules...", c: "" },
      { t: "> Strengthening rate-limit...", c: "" },
      { t: "> Adding new filter patterns...", c: "ok" },
      { t: "> Memory integrity check: OK", c: "ok" },
      { t: "> Self-heal complete.", c: "ok" },
      { t: "> Security level increased.", c: "ok" }
    ];

    function setStatus(s) {
      state = s;
      const badge = document.getElementById("statusBadge");
      badge.className = "status-badge status-" + (s === "idle" ? "idle" : s === "panic" ? "panic" : s === "repairing" ? "repair" : "taunt");
      const labels = {
        idle: "● IDLE • Siap",
        panic: "● PANIK • Sedang diserang!",
        repairing: "● REPAIR • Memperbaiki diri...",
        taunt: "● SIAP • Senyum dingin"
      };
      badge.textContent = labels[s] || s;
    }

    function addMessage(text, type = "bot") {
      const box = document.getElementById("messages");
      const div = document.createElement("div");
      div.className = "msg " + type;
      div.textContent = text;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
      if (type === "bot" || type === "user") {
        memory.push({ role: type, text, time: Date.now() });
        if (memory.length > 40) memory = memory.slice(-40);
        localStorage.setItem("nova_memory", JSON.stringify(memory));
      }
    }

    function updateSecLevel() {
      document.getElementById("secLevel").textContent = "Security Lv. " + securityLevel;
      localStorage.setItem("nova_sec", securityLevel);
      localStorage.setItem("nova_attacks", attackCount);
    }

    // ===== 3D =====
    let scene, camera, renderer, girl, particles, animPhase = 0;
    function init3D() {
      const canvas = document.getElementById("canvas3d");
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
      camera.position.set(0, 1.2, 4.2);
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      scene.add(new THREE.AmbientLight(0xffb6c1, 0.55));
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(3, 5, 4); scene.add(dir);
      const pink = new THREE.PointLight(0xff6b9d, 1.2, 12);
      pink.position.set(-2, 2, 2); scene.add(pink);

      girl = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff9ec0, roughness: 0.35, metalness: 0.1 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 8, 16), bodyMat);
      body.position.y = 0.9; girl.add(body);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0ec, roughness: 0.4 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 32), headMat);
      head.position.y = 1.75; girl.add(head);
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a2035, roughness: 0.5 });
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 32), hairMat);
      hair.position.y = 1.85; hair.scale.set(1.05, 0.9, 1.1); girl.add(hair);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1520 });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), eyeMat);
      eyeL.position.set(-0.1, 1.78, 0.28);
      const eyeR = eyeL.clone(); eyeR.position.x = 0.1; girl.add(eyeL, eyeR);
      const blushMat = new THREE.MeshStandardMaterial({ color: 0xff8fab, transparent: true, opacity: 0.55 });
      const blushL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), blushMat);
      blushL.position.set(-0.18, 1.68, 0.26); blushL.scale.set(1.4, 0.7, 0.5);
      const blushR = blushL.clone(); blushR.position.x = 0.18; girl.add(blushL, blushR);
      const armMat = new THREE.MeshStandardMaterial({ color: 0xffe0ec, roughness: 0.4 });
      const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 6, 12), armMat);
      armL.position.set(-0.48, 1.05, 0); armL.rotation.z = 0.25;
      const armR = armL.clone(); armR.position.x = 0.48; armR.rotation.z = -0.25; girl.add(armL, armR);
      girl.position.y = -0.3; scene.add(girl);

      const pGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(60 * 3);
      for (let i = 0; i < 60; i++) {
        positions[i*3] = (Math.random()-0.5)*6;
        positions[i*3+1] = Math.random()*4;
        positions[i*3+2] = (Math.random()-0.5)*4;
      }
      pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xff6b9d, size: 0.04, transparent: true, opacity: 0.6 }));
      scene.add(particles);

      window.addEventListener("resize", () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      });
      animate();
    }

    function animate() {
      requestAnimationFrame(animate);
      animPhase += 0.016;
      if (girl) {
        if (state === "idle" || state === "taunt") {
          girl.rotation.y = Math.sin(animPhase * 0.6) * 0.15;
          girl.position.y = -0.3 + Math.sin(animPhase * 1.2) * 0.03;
          girl.position.x = 0;
        }
        if (state === "panic") {
          girl.rotation.y = Math.sin(animPhase * 18) * 0.25;
          girl.position.x = Math.sin(animPhase * 25) * 0.08;
          girl.position.y = -0.3 + Math.sin(animPhase * 20) * 0.05;
        }
        if (state === "repairing") {
          girl.rotation.y = THREE.MathUtils.lerp(girl.rotation.y, 0.4, 0.05);
          girl.position.x = THREE.MathUtils.lerp(girl.position.x, 0.3, 0.05);
        }
      }
      if (particles) particles.rotation.y += 0.0015;
      renderer.render(scene, camera);
    }

    async function simulateAttack(fromChat = false) {
      if (state !== "idle" && state !== "taunt") return;
      document.getElementById("attackBtn").disabled = true;
      attackCount++;
      setStatus("panic");
      if (!fromChat) addMessage("⚠ Serangan terdeteksi! Nova panik sebentar...", "system");
      await sleep(1400);

      setStatus("repairing");
      document.getElementById("repairOverlay").classList.add("active");
      const term = document.getElementById("terminalBody");
      term.innerHTML = "";
      document.getElementById("progressFill").style.width = "0%";
      document.getElementById("progressPct").textContent = "0%";

      for (let i = 0; i < repairLines.length; i++) {
        const line = repairLines[i];
        const div = document.createElement("div");
        div.className = "line " + (line.c || "");
        div.textContent = line.t;
        term.appendChild(div);
        term.scrollTop = term.scrollHeight;
        const pct = Math.round(((i + 1) / repairLines.length) * 100);
        document.getElementById("progressFill").style.width = pct + "%";
        document.getElementById("progressPct").textContent = pct + "%";
        await sleep(320 + Math.random() * 180);
      }
      await sleep(400);
      document.getElementById("repairOverlay").classList.remove("active");

      securityLevel = Math.min(securityLevel + 1, 15);
      updateSecLevel();
      setStatus("taunt");
      document.getElementById("attackBtn").disabled = false;
      setTimeout(() => { if (state === "taunt") setStatus("idle"); }, 2800);
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function sendMessage() {
      if (isSending) return;
      const input = document.getElementById("userInput");
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      addMessage(text, "user");

      isSending = true;
      document.getElementById("sendBtn").disabled = true;
      const typing = document.createElement("div");
      typing.className = "msg bot typing";
      typing.id = "typingInd";
      typing.textContent = "Nova sedang berpikir~";
      document.getElementById("messages").appendChild(typing);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: memory.slice(-10),
            securityLevel,
            attackCount
          })
        });
        const data = await res.json();
        document.getElementById("typingInd")?.remove();

        if (data.isAttack) {
          await simulateAttack(true);
        }
        addMessage(data.reply || "...", "bot");
      } catch (e) {
        document.getElementById("typingInd")?.remove();
        addMessage("Koneksi lagi gangguan~ coba lagi ya.", "bot");
      }

      isSending = false;
      document.getElementById("sendBtn").disabled = false;
      document.getElementById("userInput").focus();
    }

    document.getElementById("userInput").addEventListener("keydown", e => {
      if (e.key === "Enter") sendMessage();
    });

    window.onload = () => {
      init3D();
      updateSecLevel();
      addMessage("Halo~ Aku Nova. Aku cewe yang bisa memperbaiki diriku sendiri kalau diserang. Chat aja, atau tekan tombol merah untuk lihat aku panik terus self-heal 💖", "bot");
      if (memory.length > 2) addMessage("(Aku masih ingat chat sebelumnya lho)", "system");
    };
  </script>
</body>
</html>`;