const SUPABASE_URL = "https://kwowxdunvwsxwghbdmdk.supabase.co";
const SUPABASE_KEY = "sb_publishable_59rmyjjFN1NmBr0aOhzPNA_igHohm0X";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const stage = document.getElementById("stage");
const token = new URLSearchParams(location.search).get("token");

let items = [];
let idx = 0;
let advanceTimer = null;
let progressStart = null;
let progressRaf = null;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Gömülü video: sunucu (get_published_pano) yalnızca izin listesinden geçen sağlayıcı+video kimliği gönderir; burada yeniden doğrulanır. */
function embedSrc(item) {
  const id = String(item.media_video_id || "");
  if (item.media_provider === "youtube" && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&rel=0`;
  if (item.media_provider === "vimeo" && /^[0-9]{5,12}$/.test(id)) return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1`;
  return null;
}

function clockText() {
  return new Date().toLocaleString("tr-TR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
}

function topbar(schoolName) {
  return `<div class="topbar"><div class="school-name">${esc(schoolName)}</div><div class="clock" id="clock">${clockText()}</div></div>`;
}

let schoolNameCache = "";

function renderSlide(item) {
  let bodyHtml = "";
  let slideClass = "slide active";

  if (item.type === "pekistirec") {
    slideClass += " pekistirec-slide";
    const photo = item.media_path ? panoUrl(item.media_path) : null;
    bodyHtml = `
      <div class="slide-body" style="flex-direction:column">
        <div class="pek-badge">${esc(item.category || "Pekiştireç")}</div>
        ${photo ? `<img class="pek-photo" src="${esc(photo)}">` : ""}
        <h1 class="pek-name">${esc(item.subject_name || item.title)}</h1>
        ${item.period_label ? `<div class="pek-period">${esc(item.period_label)}</div>` : ""}
        ${item.body_text ? `<div class="pek-desc">${esc(item.body_text)}</div>` : ""}
      </div>
    `;
  } else if (item.type === "medya") {
    slideClass += " media-slide";
    let mediaEl = "";
    if (item.media_kind === "embed_video" && embedSrc(item)) {
      mediaEl = `<iframe src="${esc(embedSrc(item))}" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; fullscreen" referrerpolicy="no-referrer" allowfullscreen title="${esc(item.title || "Video")}"></iframe>`;
    } else if (item.media_kind === "embed_video") {
      mediaEl = `<div class="slide-body" style="display:flex;align-items:center;justify-content:center;color:var(--muted)">Video bağlantısı doğrulanamadı</div>`;
    } else if (item.media_kind === "upload_video" && item.media_path) {
      mediaEl = `<video src="${esc(panoUrl(item.media_path))}" autoplay muted playsinline></video>`;
    } else if (item.media_path) {
      mediaEl = `<img src="${esc(panoUrl(item.media_path))}">`;
    }
    bodyHtml = `
      <div class="slide-body" style="position:relative">
        ${mediaEl}
        ${(item.title || item.body_text) ? `<div class="media-caption"><div class="t">${esc(item.title)}</div>${item.body_text ? `<div class="c">${esc(item.body_text)}</div>` : ""}</div>` : ""}
      </div>
    `;
  } else {
    bodyHtml = `
      <div class="slide-body">
        <div>
          <div class="duyuru-title">${esc(item.title)}</div>
          ${item.body_text ? `<div class="duyuru-text">${esc(item.body_text)}</div>` : ""}
        </div>
      </div>
    `;
  }

  stage.innerHTML = `
    <div class="${slideClass}">
      ${topbar(schoolNameCache)}
      ${bodyHtml}
      <div class="progress"><div class="progress-bar" id="progress-bar"></div></div>
    </div>
  `;
  requestAnimationFrame(() => stage.querySelector(".slide").classList.add("active"));
}

function panoUrl(path) {
  return sb.storage.from("pano-media").getPublicUrl(path).data.publicUrl;
}

function startProgress(durationMs) {
  const bar = document.getElementById("progress-bar");
  if (!bar) return;
  progressStart = performance.now();
  cancelAnimationFrame(progressRaf);
  function tick(now) {
    const pct = Math.min(100, ((now - progressStart) / durationMs) * 100);
    bar.style.width = pct + "%";
    if (pct < 100) progressRaf = requestAnimationFrame(tick);
  }
  progressRaf = requestAnimationFrame(tick);
}

function showEmpty(message) {
  stage.innerHTML = `<div class="empty"><h1>${esc(message)}</h1><p>Panel üzerinden içerik ekleyip yayınlayınca burada görünecek.</p></div>`;
}

function advance() {
  clearTimeout(advanceTimer);
  if (!items.length) { showEmpty("Henüz yayında içerik yok"); return; }
  if (idx >= items.length) idx = 0;
  const item = items[idx];
  renderSlide(item);
  startProgress(item.display_seconds * 1000);
  advanceTimer = setTimeout(() => { idx = (idx + 1) % items.length; advance(); }, item.display_seconds * 1000);
}

/* PIN: okul yönetimi panelden belirler; ekran cihazında bir kez girilir ve bu cihazda saklanır (aynı origin olduğu için
   panelin canlı önizlemesi de paylaşır). Yanlış PIN'de içerik dönmez; 15 dakikada 10 hatalı deneme sonrası kilit. */
const PIN_KEY = `pano_pin_${token}`;
let pinRequired = false;
function storedPin() { try { return localStorage.getItem(PIN_KEY) || ""; } catch { return ""; } }
function storePin(p) { try { if (p) localStorage.setItem(PIN_KEY, p); else localStorage.removeItem(PIN_KEY); } catch { /* yoksay */ } }

function showPinScreen(message) {
  clearTimeout(advanceTimer);
  stage.innerHTML = `
    <div class="pin-wrap">
      <h1>${esc(schoolNameCache || "Okul Panosu")}</h1>
      <p>Bu ekran öğrenci ve personel bilgisi içerebilir; görüntülemek için okul yönetiminin belirlediği PIN gerekir. PIN bir kez girilir, bu cihazda kalır.</p>
      <input id="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" autofocus>
      <button id="pin-btn">Kilidi aç</button>
      <div class="pin-err" id="pin-err">${esc(message || "")}</div>
    </div>`;
  const input = document.getElementById("pin-input");
  const submit = async () => {
    const pin = input.value.trim();
    if (!/^[0-9]{4,8}$/.test(pin)) { document.getElementById("pin-err").textContent = "PIN 4–8 rakamdan oluşur."; return; }
    document.getElementById("pin-btn").disabled = true;
    const res = await fetchItems(pin);
    if (res === "ok") { storePin(pin); document.getElementById("lock-btn").style.display = "block"; }
    else { document.getElementById("pin-btn").disabled = false; input.value = ""; input.focus(); document.getElementById("pin-err").textContent = res === "locked" ? "Çok fazla hatalı deneme; 15 dakika sonra tekrar dene." : "PIN hatalı."; }
  };
  document.getElementById("pin-btn").onclick = submit;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  input.focus();
}

/* Dönüş: "ok" | "pin" (PIN gerekli/yanlış) | "locked" | "error" */
async function fetchItems(pinOverride) {
  const pin = pinOverride !== undefined ? pinOverride : (pinRequired ? storedPin() : "");
  const { data, error } = await sb.rpc("get_published_pano", { p_token: token, p_pin: pin || null });
  if (error || !data || !data.status) { if (pinOverride === undefined) showEmpty("İçerik alınamadı"); return "error"; }
  if (data.status === "locked") { if (pinOverride === undefined) showPinScreen("Çok fazla hatalı deneme; 15 dakika sonra tekrar dene."); return "locked"; }
  if (data.status === "pin_required" || data.status === "pin_wrong") {
    if (pinOverride === undefined) { storePin(""); pinRequired = true; showPinScreen(pin ? "PIN değişmiş görünüyor; yeni PIN'i gir." : ""); }
    return "pin";
  }
  if (data.status !== "ok") { if (pinOverride === undefined) showEmpty("Geçersiz bağlantı"); return "error"; }
  const wasEmpty = items.length === 0 || !document.querySelector(".slide");
  items = data.items || [];
  if (wasEmpty && items.length) { idx = 0; advance(); }
  else if (!items.length) { clearTimeout(advanceTimer); showEmpty("Henüz yayında içerik yok"); }
  return "ok";
}

function handleCommand(cmd) {
  if (cmd.type === "refresh") { fetchItems(); return; }
  if (!items.length) return;
  if (cmd.type === "next") {
    idx = (idx + 1) % items.length;
    advance();
  } else if (cmd.type === "prev") {
    idx = (idx - 1 + items.length) % items.length;
    advance();
  } else if (cmd.type === "jump" && cmd.itemId) {
    const i = items.findIndex(it => it.id === cmd.itemId);
    if (i >= 0) { idx = i; advance(); }
  }
}

function setupControlChannel(token) {
  sb.channel(`pano-control-${token}`)
    .on("broadcast", { event: "command" }, (msg) => handleCommand(msg.payload || {}))
    .subscribe();
}

async function boot() {
  if (!token) { showEmpty("Geçersiz bağlantı"); return; }
  const { data: meta, error: metaErr } = await sb.rpc("get_pano_meta", { p_token: token });
  if (metaErr || !meta || !meta.name) { showEmpty("Geçersiz bağlantı"); return; }
  schoolNameCache = meta.name;
  pinRequired = !!meta.pin_required;
  if (pinRequired) {
    document.getElementById("lock-btn").style.display = "block";
    if (!storedPin()) { showPinScreen(""); }
    else { await fetchItems(); }
  } else {
    await fetchItems();
  }
  setupControlChannel(token);
  setInterval(() => fetchItems(), 60000);
  setInterval(() => { const c = document.getElementById("clock"); if (c) c.textContent = clockText(); }, 30000);
}
document.getElementById("lock-btn").onclick = () => {
  if (!confirm("PIN bu cihazdan silinecek ve ekran kilitlenecek. Devam?")) return;
  storePin(""); location.reload();
};

const fsBtn = document.getElementById("fullscreen-btn");
fsBtn.onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
};
document.addEventListener("fullscreenchange", () => {
  fsBtn.textContent = document.fullscreenElement ? "⤢" : "⛶";
  fsBtn.title = document.fullscreenElement ? "Tam ekrandan çık" : "Tam ekran";
});

boot();
