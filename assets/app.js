// ============================================================================
// RunableGames — giao diện. Trang đơn, đổi trang bằng dấu # (chạy được trên GitHub Pages).
//   #/            trang chủ: tìm game, máy của bạn, sức mạnh, top game, máy tôi chạy được gì
//   #/game/<id>   chi tiết một game: so từng linh kiện, FPS ước lượng, gợi ý nâng cấp
//   #/detect      4 bước chạy ứng dụng nhận diện (như Can You Run It)
//   #/app?specs=… ứng dụng mở trang kèm cấu hình chính xác
// ============================================================================
import { CONFIG } from "./config.js";
import { scanBrowser, profileFromApp } from "./scan.js";
import { checkGame, power, TIERS, VERDICT, kd, PTS, upgradesFor, bestLibraryUpgrade, ramGb, prettyGpu, setMeasurements } from "./engine.js";
import { CPUS, cpuScore } from "../shared/hwscore.js";
import { splitAlts } from "../shared/reqparse.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => (n == null ? "?" : Math.round(n).toLocaleString("vi-VN"));
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
const view = () => $("#view");

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

const S = {
  profile: null, scanning: false, pct: 0, pctText: "", measurements: [],
  library: [], check: null, stats: null, top: null, filter: "all", banner: null,
};

// ---------------------------------------------------------------------------
// Máy chủ
// ---------------------------------------------------------------------------
const hasBackend = () => !!CONFIG.BACKEND_URL;
async function api(path, opts) {
  if (!hasBackend()) throw new Error("no-backend");
  const r = await fetch(CONFIG.BACKEND_URL.replace(/\/+$/, "") + path, opts);
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}

// ---------------------------------------------------------------------------
// Thư viện game có sẵn (chạy được cả khi chưa có máy chủ)
// ---------------------------------------------------------------------------
async function loadLibrary() {
  if (S.library.length) return;
  const [steam, off, meas] = await Promise.all([
    fetch("data/steam-popular.json").then((r) => r.json()).catch(() => ({ games: [] })),
    fetch("data/games-offsteam.json").then((r) => r.json()).catch(() => ({ games: [] })),
    fetch("data/fps-measurements.json").then((r) => r.json()).catch(() => ({ measurements: [] })),
  ]);
  S.measurements = meas.measurements || [];
  setMeasurements(S.measurements);   // game đã có số đo thật → công thức neo theo số đo
  for (const g of off.games) for (const k of ["min", "rec", "high"]) if (g[k]) {
    g[k].cpuAlts = splitAlts(g[k].cpu); g[k].gpuAlts = splitAlts(g[k].gpu);
  }
  S.library = [...off.games, ...steam.games];
}
const findLocal = (id) => S.library.find((g) => g.id === id) || null;

// ---------------------------------------------------------------------------
// Hồ sơ máy
// ---------------------------------------------------------------------------
async function runScan() {
  if (S.scanning) return;
  S.scanning = true; S.pct = 0; S.pctText = "Đang chuẩn bị…"; S.check = null;
  renderRoute();
  const p = await scanBrowser((pct, text) => {
    S.pct = pct; S.pctText = text;
    const bar = $("#scanbar i"), t = $("#scantext");
    if (bar) bar.style.width = pct + "%";
    if (t) t.textContent = text;
  });
  // Giữ lại những gì người dùng đã tự xác nhận trước đó
  const old = store.get("rg_confirm") || {};
  if (old.cpu) applyCpuChoice(p, old.cpu);
  if (old.ram) { p.ram = { gb: old.ram, exact: false, confirmed: true }; }
  if (old.disk) p.disk = old.disk;
  S.profile = p;
  S.scanning = false;
  store.set("rg_profile", p);
  renderRoute();
  submitCheck();
}

function applyCpuChoice(p, name) {
  const c = CPUS.find((x) => x[0] === name);
  const sc = c ? null : cpuScore(name, p.threads);
  p.cpu = { ...(p.cpu || {}), name, confirmed: true, conf: "ok",
    idx: c ? c[1] : (sc ? sc.idx : (p.cpu && p.cpu.measuredIdx) || 60), alts: [] };
}

function useAppProfile(specs, checkId) {
  const p = profileFromApp(specs);
  S.profile = p;
  store.set("rg_profile", p);
  S.banner = { kind: "good", text: "Đã nhận cấu hình chính xác từ ứng dụng nhận diện — mọi thông số bên dưới là số đọc thẳng từ Windows." };
  // App không có bảng điểm nên không tự tính sức mạnh → trang tính rồi gửi để xếp hạng
  submitCheck();
  return p;
}

// Gửi điểm lên máy chủ để xếp hạng (mỗi IP chỉ tính 1 lần/ngày)
async function submitCheck() {
  if (!hasBackend() || !S.profile) return;
  const pw = power(S.profile);
  try {
    S.check = await api("/api/check", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        power: pw.total, gpuPts: pw.gpuPts, cpuPts: pw.cpuPts, ramPts: pw.ramPts,
        gpu: S.profile.gpu && S.profile.gpu.name, cpu: S.profile.cpu && S.profile.cpu.name,
        ram: ramGb(S.profile), source: S.profile.source,
      }),
    });
  } catch (e) { S.check = null; }
  await loadStats();
}
async function loadStats() {
  if (!hasBackend()) return;
  try { S.stats = await api("/api/stats"); } catch (e) { S.stats = null; }
  try { S.top = await api("/api/top?limit=10"); } catch (e) { S.top = null; }
  if (!location.hash.startsWith("#/game") && !location.hash.startsWith("#/detect")) renderHome();
}

// ---------------------------------------------------------------------------
// Mảnh giao diện dùng chung
// ---------------------------------------------------------------------------
// Ô chữ viết tắt thay ảnh bìa: 2 chữ đầu của tên, màu cố định theo tên
function initials(name, cls = "ini") {
  const w = String(name).replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  const t = (w[0] || "??").slice(0, 2).toUpperCase();
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<span class="${cls}" style="background:hsl(${h % 360} 45% 38%)" aria-hidden="true">${esc(t)}</span>`;
}
const cover = (g, cls = "cover") => g.image ? `<img class="${cls}" src="${esc(g.image)}" alt="" data-name="${esc(g.name)}" loading="lazy">` : initials(g.name);
const pill = (v) => `<span class="pill ${VERDICT[v].cls}">${VERDICT[v].label}</span>`;
const shopUrl = (q) => CONFIG.SHOP_SEARCH.replace("{q}", encodeURIComponent(q));

function searchLocal(q) {
  const nq = norm(q);
  if (nq.length < 2) return [];
  return S.library.filter((g) => norm(g.name).includes(nq) || (g.alias || []).some((a) => norm(a).includes(nq)))
    .slice(0, 8).map((g) => ({ id: g.id, name: g.name, image: g.image, source: g.source }));
}

// ---------------------------------------------------------------------------
// TRANG CHỦ
// ---------------------------------------------------------------------------
function renderHome() {
  const p = S.profile;
  view().innerHTML = `
    ${S.banner ? `<div class="note ${S.banner.kind}" style="margin-top:22px">${esc(S.banner.text)}</div>` : ""}
    <section class="card hero">
      <h1>Máy của bạn có <em>chạy nổi</em> game này không?</h1>
      <p>RunableGames tự quét cấu hình máy bạn và so với yêu cầu chính thức của từng game — biết ngay chạy được hay không, và cần nâng cấp gì. Miễn phí, không cần cài đặt.</p>
      <div class="steps"><span class="step"><b>1</b> Nhập tên game</span><span class="step"><b>2</b> Máy tự quét cấu hình</span><span class="step"><b>3</b> Xem kết quả + gợi ý</span></div>
    </section>

    <section class="sec" aria-labelledby="h-check">
      <p class="eyebrow">Kiểm tra ngay</p>
      <h2 class="sec-h" id="h-check">Nhập tên game để check cấu hình</h2>
      <p class="sec-sub">${hasBackend() ? "Gõ tên bất kỳ game nào trên Steam, hoặc game ngoài Steam như LMHT, Valorant, Genshin." : `Đang có sẵn ${S.library.length} game. Khi bật máy chủ, tra được mọi game trên Steam.`}</p>
      <form class="search" id="searchform" role="search" autocomplete="off">
        <div class="search-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="q" type="search" placeholder="Ví dụ: Cyberpunk 2077, Elden Ring, Valorant…" aria-label="Tên game" aria-autocomplete="list" aria-controls="suggest">
          <div class="card suggest" id="suggest" role="listbox" hidden></div>
        </div>
        <button class="btn primary" type="submit">Kiểm tra</button>
      </form>
      <div class="pop">Phổ biến:
        ${["x:valorant:Valorant", "steam:1091500:Cyberpunk 2077", "steam:1245620:Elden Ring", "x:league-of-legends:LMHT", "x:genshin-impact:Genshin"]
          .map((s) => { const i = s.lastIndexOf(":"); return `<a class="chip" href="#/game/${s.slice(0, i)}">${s.slice(i + 1)}</a>`; }).join("")}
      </div>
    </section>

    <section class="sec" aria-labelledby="h-rig">
      <p class="eyebrow">Máy của bạn</p>
      <h2 class="sec-h" id="h-rig">Cấu hình đang dùng để so</h2>
      ${rigCard()}
    </section>

    ${p ? powerSection() : ""}
    ${topSection()}
    ${p ? mineSection() : ""}
    ${p ? upgradeSection() : ""}
  `;
  wireHome();
}

function rigCard() {
  const p = S.profile;
  if (S.scanning || !p) {
    return `<div class="card rig">
      <div class="rig-top"><div class="grow"><b id="scantext">${esc(S.pctText || "Đang chuẩn bị quét…")}</b>
      <p class="muted" style="font-size:13px;margin-top:2px">Trình duyệt đang đọc card đồ họa, số nhân CPU, bộ nhớ đệm, pin và màn hình. Khoảng 5 giây.</p></div></div>
      <div class="progress" id="scanbar"><i style="width:${S.pct}%"></i></div></div>`;
  }
  const g = p.gpu || {}, c = p.cpu || {}, pw = power(p);
  const isApp = p.source === "app";
  const cpuOpts = cpuChoices(p).map((n) => `<option ${n === c.name ? "selected" : ""}>${esc(n)}</option>`).join("");
  const ramNow = ramGb(p);
  const ramOpts = [4, 6, 8, 12, 16, 24, 32, 48, 64].map((v) => `<option value="${v}" ${v === (p.ram && p.ram.gb) ? "selected" : ""}>${v} GB</option>`).join("");
  const others = (p.gpus || []).slice(1).map((x) => x.name).join(" · ");
  return `<div class="card rig">
    <div class="rig-top">
      <span class="srcbadge ${isApp ? "app" : "web"}">${isApp ? "ỨNG DỤNG · CHÍNH XÁC ~100%" : "TRÌNH DUYỆT · ƯỚC LƯỢNG ~80%"}</span>
      <div class="grow muted" style="font-size:13px">${isApp ? "Số đọc thẳng từ Windows." : "Tên CPU và RAM trình duyệt không cho biết — xác nhận nhanh ở ô bên dưới."}</div>
      <button class="btn sm" id="rescan" type="button">Quét lại</button>
      ${isApp ? "" : `<a class="btn sm" href="#/detect">Quét chính xác bằng app</a>`}
    </div>
    ${g.browserOnIgpu ? `<div class="note">Trình duyệt đang vẽ bằng <b>card onboard</b> để tiết kiệm pin, nhưng máy bạn có <b>${esc(g.name)}</b>. Trang đã tính theo card rời — đó mới là card chơi game.</div>` : ""}
    <div class="parts">
      <div class="part"><div class="k">Card đồ họa</div><div class="v">${esc(g.name || "Không đọc được")}</div>
        <div class="s">${g.vram ? g.vram + " GB VRAM · " : g.integrated ? "dùng chung RAM · " : ""}${kd(g.idx)}${p.dxfl ? " · DirectX " + String(p.dxfl).replace(".", "_") + (p.dxfl >= 12.2 ? " Ultimate" : "") : ""}${g.driver ? " · driver " + esc(g.driver) : ""}${others ? " · máy còn: " + esc(others) : ""}</div></div>
      <div class="part"><div class="k">CPU</div><div class="v">${esc(c.name || "?")}</div>
        <div class="s">${c.cores ? c.cores + " nhân · " : ""}${c.threads ? c.threads + " luồng · " : ""}${kd(c.idx, PTS.cpu)}${p.isa ? " · " + esc(p.isa.filter((x) => /AVX/.test(x)).join(", ") || "không có AVX") : ""}${!isApp && !c.confirmed ? " · đoán, hãy xác nhận" : ""}</div>
        ${isApp ? "" : `<label class="muted" style="font-size:12px;display:block;margin-top:6px" for="cpusel">CPU của bạn là:</label><select id="cpusel">${cpuOpts}</select>`}</div>
      <div class="part"><div class="k">RAM</div><div class="v">${ramNow ? ramNow + " GB" : "?"}${p.ram && p.ram.usable && p.ram.gb && p.ram.usable < p.ram.gb - 0.5 ? ` <span class="muted" style="font-weight:400">/ gắn ${p.ram.gb} GB</span>` : ""}</div>
        <div class="s">${isApp ? `${p.ram.slots ? p.ram.slots + " thanh · " : ""}${p.ram.mhz ? "bus " + p.ram.mhz : ""}` : (p.ram.confirmed ? "bạn đã xác nhận" : "trình duyệt chỉ thấy ≥ " + (p.ram.floor || 8) + " GB — hãy xác nhận")}</div>
        ${isApp ? "" : `<select id="ramsel" aria-label="Dung lượng RAM">${ramOpts}</select>`}</div>
      <div class="part"><div class="k">Hệ điều hành · màn hình</div><div class="v">${esc((p.os && p.os.name) || "?")}</div>
        <div class="s">${p.screen ? `${p.screen.w} × ${p.screen.h}${p.screen.hz ? " · " + p.screen.hz + " Hz" : ""}` : ""}${p.laptop === true ? " · laptop" : ""}${isApp && p.disk ? " · ổ trống " + p.disk + " GB" : ""}${p.ssd != null ? " · " + (p.ssd ? "có SSD " + esc(p.ssdKind) : "chỉ có HDD") : ""}</div></div>
    </div>
  </div>`;
}

function cpuChoices(p) {
  const c = p.cpu || {};
  const same = CPUS.filter((x) => !x[7] || !x[7].includes("s")).filter((x) => !p.threads || x[2] === p.threads).map((x) => x[0]);
  const list = [c.name, ...(c.alts || []), ...same].filter(Boolean);
  return [...new Set(list)].slice(0, 60);
}

function powerSection() {
  const pw = power(S.profile);
  const t = pw.tier;
  const total = S.check ? S.check.total : 0;
  // Dưới 10 lượt thì phần trăm chẳng nói lên gì — không hiện
  const pct = S.check && total >= 10 && S.check.percentile != null ? S.check.percentile : null;
  let hist = "";
  if (S.stats && S.stats.total > 0) {
    // gộp cột 4.000 điểm của máy chủ thành 15 cột 8.000 điểm (0 → 120.000+)
    const bars = new Array(15).fill(0);
    S.stats.hist.forEach((v, i) => { bars[Math.min(14, Math.floor(i * S.stats.bucket / 8000))] += v; });
    const max = Math.max(1, ...bars);
    const me = Math.min(14, Math.floor(pw.total / 8000));
    hist = `<div class="hist" role="img" aria-label="Phân bố điểm của ${fmt(S.stats.total)} máy đã kiểm tra">
      ${bars.map((v, i) => `<div class="${i === me ? "me" : ""}" style="height:${Math.max(3, v / max * 100)}%" title="${fmt(v)} máy"></div>`).join("")}</div>
      <div class="hist-axis"><span>Yếu</span><span>Trung bình</span><span>Mạnh</span><span>Đỉnh</span></div>`;
  }
  return `<section class="sec" aria-labelledby="h-power">
    <h2 class="sec-h" id="h-power"><span aria-hidden="true">⚡</span> Sức mạnh máy của bạn là bao nhiêu?</h2>
    <p class="sec-sub">Gộp CPU, GPU và RAM thành một chỉ số sức mạnh, rồi xếp hạng với tất cả người đã kiểm tra.</p>
    <div class="card power" style="margin-top:18px">
      <div class="power-head">
        <div class="k">CHỈ SỐ SỨC MẠNH</div>
        <div class="power-num">${pw.total.toLocaleString("en-US")}</div>
        <div class="lvl">POWER LEVEL</div>
        <span class="tier-badge" style="background:${t.color}">${t.n} · ${t.name}</span>
        <p class="desc">${esc(t.desc)}</p>
        <p class="pct">${pct != null
          ? `Mạnh hơn <b>${pct}%</b> người chơi đã kiểm tra${total < 50 ? ` <span class="muted" style="font-weight:400;font-size:13px">(mới có ${fmt(total)} lượt — sẽ chính xác dần)</span>` : ""}`
          : `<span class="muted" style="font-weight:400;font-size:14px">${!hasBackend() ? "Xếp hạng so với người dùng khác cần bật máy chủ."
              : S.check ? `Mới có ${fmt(total)} lượt kiểm tra — cần ít nhất 10 lượt mới xếp hạng được.` : "Đang lấy xếp hạng…"}</span>`}</p>
      </div>
      <div class="power-body">
        <div class="tiles">
          <div class="tile"><div class="k">GPU</div><div class="n">${esc(S.profile.gpu && S.profile.gpu.name)}</div><div class="p">+${pw.gpuPts.toLocaleString("en-US")} <small>điểm</small></div></div>
          <div class="tile"><div class="k">CPU</div><div class="n">${esc(S.profile.cpu && S.profile.cpu.name)}</div><div class="p">+${pw.cpuPts.toLocaleString("en-US")} <small>điểm</small></div></div>
          <div class="tile"><div class="k">RAM</div><div class="n">${ramGb(S.profile) || "?"} GB</div><div class="p">+${pw.ramPts.toLocaleString("en-US")} <small>điểm</small></div></div>
        </div>
        ${hist}
        <div class="ladder">
          ${[...TIERS].reverse().filter((x) => x.min >= 40000 || x === t || x.min <= t.min + 12000).map((x) => `
            <div class="rung ${x === t ? "me" : ""}"><span class="n" style="background:${x.color}">${x.n}</span>
              <div><div class="t">${x.name}${x === t ? '<span class="me-tag">MÁY BẠN</span>' : ""}</div><div class="m">${x.min.toLocaleString("en-US")}+ điểm</div></div></div>`).join("")}
        </div>
      </div>
    </div>
  </section>`;
}

const POPULAR = ["x:valorant", "x:league-of-legends", "steam:3240220", "steam:730", "x:genshin-impact", "steam:1245620", "x:fortnite", "steam:1091500", "x:minecraft-java", "steam:578080"];

function topSection() {
  const real = S.top && S.top.length >= 3;
  const rows = real ? S.top.slice(0, 10).map((t) => ({ ...(findLocal(t.id) || {}), id: t.id, name: t.name, image: t.image, count: t.count }))
    : POPULAR.map(findLocal).filter(Boolean);
  if (!rows.length) return "";
  return `<section class="sec" aria-labelledby="h-top">
    <p class="eyebrow">Thịnh hành</p>
    <h2 class="sec-h" id="h-top"><span aria-hidden="true">🔥</span> ${real ? "Top 10 game được check nhiều nhất" : "Game được nhiều người chơi"}</h2>
    <p class="sec-sub">${real ? "Đếm theo lượt kiểm tra thật trên RunableGames." : "Khi có đủ lượt kiểm tra, mục này sẽ tự chuyển sang xếp hạng theo lượt check thật."}</p>
    <div class="grid2">
      ${rows.map((g, i) => {
        const v = S.profile && g.min !== undefined ? checkGame(S.profile, g).verdict : null;
        return `<a class="grow-row" href="#/game/${esc(g.id)}"><span class="rank ${i < 3 ? "hot" : ""}">${i + 1}</span>${cover(g)}
          <div class="body"><div class="nm">${esc(g.name)}</div><div class="sub">${real ? fmt(g.count) + " lượt check" : esc((g.genres || []).slice(0, 2).join(" · ") || g.source || "")}</div></div>
          ${v ? pill(v) : ""}</a>`;
      }).join("")}
    </div>
  </section>`;
}

function mineSection() {
  const res = S.library.map((g) => ({ g, r: checkGame(S.profile, g) })).filter((x) => x.r.verdict !== "unknown");
  const c = { great: 0, ok: 0, bad: 0 };
  res.forEach((x) => c[x.r.verdict]++);
  const recG = (x) => (x.r.levels.rec && x.r.levels.rec.gpu ? x.r.levels.rec.gpu.idx : x.r.levels.min && x.r.levels.min.gpu ? x.r.levels.min.gpu.idx : 0);
  const list = res.filter((x) => S.filter === "all" || x.r.verdict === S.filter).sort((a, b) => recG(b) - recG(a));
  const g = S.profile.gpu || {};
  const btn = (k, label) => `<button class="count ${k}" type="button" data-filter="${k}" aria-pressed="${S.filter === k}"><div class="n">${c[k]}</div><div class="l">${label}</div></button>`;
  return `<section class="sec" aria-labelledby="h-mine">
    <p class="eyebrow">Cá nhân hóa</p>
    <h2 class="sec-h" id="h-mine"><span aria-hidden="true">💻</span> Máy của tôi chạy được game gì?</h2>
    <p class="sec-sub">So cấu hình của bạn với yêu cầu chính thức của ${res.length} game trong thư viện. Bấm ô số để lọc.</p>
    <div class="card mine">
      <div class="mine-head">
        <span class="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h5M14 14h3"/></svg></span>
        <div class="grow"><div class="muted mono" style="font-size:11px;letter-spacing:.12em">CARD ĐỒ HỌA CỦA BẠN</div><div class="mono" style="font-weight:700;margin-top:2px">${esc(g.name)}</div></div>
        <button class="btn sm" id="rescan2" type="button">↻ Quét lại</button>
      </div>
      <div class="counts">${btn("great", "Chạy mượt")}${btn("ok", "Chạy được")}${btn("bad", "Chưa đủ")}</div>
      <div class="scroll">
        ${list.map(({ g: game, r }) => `<a class="grow-row" href="#/game/${esc(game.id)}">${cover(game)}
          <div class="body"><div class="nm">${esc(game.name)}</div>
            <div class="sub">Cần GPU ~${kd(r.levels.min && r.levels.min.gpu ? r.levels.min.gpu.idx : null)} · đề xuất ${kd(r.levels.rec && r.levels.rec.gpu ? r.levels.rec.gpu.idx : null)}${r.fps ? " · ~" + r.fps.high + " FPS" : ""}</div></div>
          ${pill(r.verdict)} <span class="muted" aria-hidden="true">›</span></a>`).join("") || `<p class="muted" style="padding:12px">Không có game nào ở mức này.</p>`}
      </div>
    </div>
  </section>`;
}

function upgradeSection() {
  const p = S.profile;
  if (p.laptop === true) {
    return `<section class="sec"><p class="eyebrow">Gợi ý nâng cấp</p><h2 class="sec-h">Nâng cấp máy</h2>
      <div class="note" style="margin-top:14px">Máy bạn là <b>laptop hoặc máy cầm tay</b> — card đồ họa và CPU hàn chết trên bo mạch nên không thay được. Việc làm được: nâng RAM (nếu còn khe), cắm sạc khi chơi, và bật FSR/DLSS trong game.</div></section>`;
  }
  const best = bestLibraryUpgrade(p, S.library, CONFIG.PRICES);
  if (!best) return "";
  const price = CONFIG.PRICES[best.part.key];
  return `<section class="sec" aria-labelledby="h-up">
    <p class="eyebrow">Gợi ý nâng cấp</p>
    <h2 class="sec-h" id="h-up">Nâng cấp đáng tiền nhất cho máy bạn</h2>
    <div class="card up" style="margin-top:18px">
      <h3>Lên <span style="color:var(--green)">${esc(best.part.name)}</span> → thêm <b>${best.gain}</b> game chạy mượt (tổng ${best.total})</h3>
      <p class="muted" style="margin-top:6px">Đây là card yếu nhất trong đời hiện tại mà vẫn mở khoá được gần hết số game đó — nên cũng thường là lựa chọn rẻ nhất. Nhớ kiểm tra nguồn máy đủ công suất.</p>
      <div class="opts"><a class="opt" href="${esc(shopUrl(best.part.name))}" target="_blank" rel="noopener sponsored">
        <b>${esc(best.part.name)}</b><span>${kd(best.part.idx)} · ${best.part.vram} GB VRAM</span><em>${price ? price.toLocaleString("vi-VN") + " đ →" : "Xem giá →"}</em></a></div>
    </div>
  </section>`;
}

function wireHome() {
  const rs = () => runScan();
  $("#rescan") && $("#rescan").addEventListener("click", rs);
  $("#rescan2") && $("#rescan2").addEventListener("click", rs);
  const cpusel = $("#cpusel");
  if (cpusel) cpusel.addEventListener("change", () => {
    applyCpuChoice(S.profile, cpusel.value);
    const conf = store.get("rg_confirm") || {}; conf.cpu = cpusel.value; store.set("rg_confirm", conf);
    store.set("rg_profile", S.profile); renderHome(); submitCheck();
  });
  const ramsel = $("#ramsel");
  if (ramsel) ramsel.addEventListener("change", () => {
    S.profile.ram = { gb: +ramsel.value, exact: false, confirmed: true };
    const conf = store.get("rg_confirm") || {}; conf.ram = +ramsel.value; store.set("rg_confirm", conf);
    store.set("rg_profile", S.profile); renderHome(); submitCheck();
  });
  document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
    S.filter = S.filter === b.dataset.filter ? "all" : b.dataset.filter;
    const y = window.scrollY; renderHome(); window.scrollTo(0, y);
  }));
  wireSearch();
}

// ---------------------------------------------------------------------------
// Ô tìm game — gợi ý khi gõ
// ---------------------------------------------------------------------------
function wireSearch() {
  const q = $("#q"), box = $("#suggest"), form = $("#searchform");
  if (!q) return;
  let items = [], on = -1, timer = null, seq = 0;
  const draw = () => {
    if (!items.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = items.map((g, i) => `<a class="sg ${i === on ? "on" : ""}" role="option" href="#/game/${esc(g.id)}">
      ${g.image ? `<img src="${esc(g.image)}" alt="" data-name="${esc(g.name)}">` : initials(g.name, "ini")}<span>${esc(g.name)}</span><small>${esc(g.source || "")}</small></a>`).join("");
  };
  q.addEventListener("input", () => {
    clearTimeout(timer);
    const v = q.value.trim();
    items = searchLocal(v); on = -1; draw();
    if (!hasBackend() || v.length < 2) return;
    const my = ++seq;
    timer = setTimeout(async () => {
      try {
        const r = await api("/api/search?q=" + encodeURIComponent(v));
        if (my !== seq) return;
        const seen = new Set(items.map((x) => x.id));
        items = [...items, ...r.filter((x) => !seen.has(x.id))].slice(0, 12);
        draw();
      } catch (e) {}
    }, 250);
  });
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { on = Math.min(items.length - 1, on + 1); draw(); e.preventDefault(); }
    if (e.key === "ArrowUp") { on = Math.max(0, on - 1); draw(); e.preventDefault(); }
    if (e.key === "Escape") { box.hidden = true; }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const pick = items[on >= 0 ? on : 0];
    if (pick) location.hash = "#/game/" + pick.id;
  });
}

// ---------------------------------------------------------------------------
// TRANG CHI TIẾT GAME
// ---------------------------------------------------------------------------
async function renderGame(id) {
  let g = findLocal(id);
  view().innerHTML = `<a class="back" href="#/">← Trang chủ</a><p class="muted" style="margin-top:24px">Đang tải yêu cầu cấu hình…</p>`;
  if (hasBackend()) {
    try { const remote = await api("/api/game?id=" + encodeURIComponent(id)); if (remote && !remote.error) g = remote; } catch (e) {}
  }
  if (!g) {
    view().innerHTML = `<a class="back" href="#/">← Trang chủ</a><div class="note" style="margin-top:18px">Không tìm thấy game này${hasBackend() ? "" : " trong thư viện có sẵn — cần bật máy chủ để tra mọi game trên Steam"}.</div>`;
    return;
  }
  for (const k of ["min", "rec", "high"]) if (g[k] && !g[k].gpuAlts) { g[k].cpuAlts = splitAlts(g[k].cpu); g[k].gpuAlts = splitAlts(g[k].gpu); }
  if (!S.profile) {
    view().innerHTML = `<a class="back" href="#/">← Trang chủ</a><p class="muted" style="margin-top:24px">Đang quét máy của bạn để so…</p>`;
    await new Promise((res) => { const t = setInterval(() => { if (S.profile) { clearInterval(t); res(); } }, 200); });
  }
  const p = S.profile;
  const r = checkGame(p, g);
  const L = r.levels;
  const vlabel = VERDICT[r.verdict].label;
  const cell = (lvl, key) => {
    const req = key === "min" ? g.min : g.rec;
    if (!req) return `<span class="muted">—</span>`;
    if (lvl === "gpu") return `${esc(req.gpu || "—")}${L[key] && L[key].gpu ? `<span class="sc">≈ ${kd(L[key].gpu.idx)}${L[key].gpu.via === "vram" ? " (đoán theo VRAM)" : ""}</span>` : ""}`;
    if (lvl === "cpu") return `${esc(req.cpu || "—")}${L[key] && L[key].cpu ? `<span class="sc">≈ ${kd(L[key].cpu.idx, PTS.cpu)}</span>` : ""}`;
    if (lvl === "ram") return req.ram ? req.ram + " GB" : "—";
    if (lvl === "vram") return req.vram ? req.vram + " GB" : "—";
    if (lvl === "disk") return req.disk ? req.disk + " GB" : "—";
    if (lvl === "ssd") return /\bssd\b/i.test([req.notes, req.diskText, req.os].filter(Boolean).join(" ")) ? "Cần SSD" : "—";
    if (lvl === "dx") return req.dx ? "DirectX " + req.dx : "—";
    return "—";
  };
  const icon = (s) => `<span class="st ${s}" aria-label="${s === "pass" ? "đạt" : s === "fail" ? "chưa đạt" : s === "warn" ? "cần dọn thêm chỗ" : "không rõ"}">${s === "pass" ? "✓" : s === "fail" ? "✕" : s === "warn" ? "!" : "?"}</span>`;
  const mine = {
    gpu: `${esc(p.gpu && p.gpu.name)}<span class="sc">≈ ${kd(p.gpu && p.gpu.idx)}</span>`,
    cpu: `${esc(p.cpu && p.cpu.name)}<span class="sc">≈ ${kd(p.cpu && p.cpu.idx, PTS.cpu)}${p.source === "web" && !(p.cpu && p.cpu.confirmed) ? " · đoán" : ""}</span>`,
    ram: `${ramGb(p) || "?"} GB${p.source === "web" && !(p.ram && p.ram.confirmed) ? '<span class="sc">trình duyệt chỉ thấy ≥ 8 GB</span>' : ""}`,
    vram: p.gpu && p.gpu.vram ? p.gpu.vram + " GB" : p.gpu && p.gpu.integrated ? "dùng chung RAM" : "?",
    disk: p.disk ? p.disk + " GB trống" : '<span class="muted">chỉ app mới đọc được</span>',
    ssd: p.ssd == null ? '<span class="muted">chỉ app mới đọc được</span>' : p.ssd ? `Có SSD (${esc(p.ssdKind)})` : "Chỉ có HDD",
    dx: p.dxfl ? `Card hỗ trợ mức ${String(p.dxfl).replace(".", "_")}${p.dxfl >= 12.2 ? " (DirectX 12 Ultimate)" : ""}` : "?",
  };
  const names = { gpu: "Card đồ họa", cpu: "CPU", ram: "RAM", vram: "VRAM", disk: "Ổ đĩa", ssd: "Ổ SSD", dx: "DirectX" };
  const rows = r.rows.filter((x) => x.min != null || x.rec != null);
  const target = r.verdict === "bad" ? "min" : "rec";
  const ups = r.verdict === "great" ? [] : upgradesFor(p, r, target, CONFIG.PRICES);
  const fps = r.fps;
  // Số đo thật trên máy CÙNG card (nếu có) — hiện cạnh con số ước lượng
  const measured = (S.measurements || []).find((m) => m.game === g.id && p.gpu && m.gpuKey === p.gpu.key) || null;
  const weakButOk720 = r.verdict === "bad" && fps && fps.low720 >= 28;
  const srcNote = g.source === "Steam"
    ? `Yêu cầu cấu hình chính thức trên <a href="${esc(g.sourceUrl)}" target="_blank" rel="noopener">trang Steam của game</a>.`
    : `Yêu cầu cấu hình từ ${esc(g.source)} — <a href="${esc(g.sourceUrl)}" target="_blank" rel="noopener">trang chính thức</a>${g.verified ? " (đã đối chiếu)" : " (trang gốc chặn đọc tự động, hãy tự kiểm tra lại)"}.`;

  view().innerHTML = `
    <a class="back" href="#/">← Trang chủ</a>
    <div class="ghead">
      ${g.image ? `<img src="${esc(g.image)}" alt="Ảnh bìa ${esc(g.name)}" data-name="${esc(g.name)}" data-big="1">` : initials(g.name, "ini big")}
      <div>
        <h1>${esc(g.name)}</h1>
        <div class="gmeta">${(g.genres || []).map((x) => `<span class="tag">${esc(x)}</span>`).join("")}${g.free ? '<span class="tag">Miễn phí</span>' : ""}<span class="tag">${esc(g.source)}</span></div>
        <div class="verdict"><span class="big ${VERDICT[r.verdict].cls}">${vlabel}</span>
          <span class="muted">${verdictText(r, g)}</span></div>
      </div>
    </div>

    ${measured ? `<div class="note good" style="margin-top:22px">
      <b>Đo thật: ${measured.avg} FPS</b> trung bình ở ${esc(measured.resolution.replace("x", "×"))} mức ${esc(measured.preset)} — máy cùng card
      (${esc(measured.gpu)}), đo bằng ${esc(measured.tool)} trong ${measured.seconds} giây đang chơi.
      Trung vị ${measured.median} FPS · 1% chậm nhất ${measured.low1} FPS · ${measured.under30Pct}% thời gian dưới 30 FPS.
      Ước lượng của trang cho mức này: ${measured.predictedHigh} FPS.</div>` : ""}
    ${fps ? `<div class="fps">
      <div class="tile"><div class="k">1080P · MỨC CAO</div><div class="p">~${fps.high} <small>FPS</small></div></div>
      <div class="tile"><div class="k">1080P · MỨC THẤP</div><div class="p">~${fps.low} <small>FPS</small></div></div>
      ${r.verdict === "bad" || fps.high < 45 ? `<div class="tile"><div class="k">720P · MỨC THẤP</div><div class="p">~${fps.low720} <small>FPS</small></div></div>` : ""}
      <div class="tile"><div class="k">ĐANG NGHẼN Ở</div><div class="p" style="font-size:20px">${fps.limitedBy === "cpu" ? "CPU" : "Card đồ họa"}</div></div>
    </div>
    <p class="muted" style="font-size:12.5px;margin-top:8px">${fps.anchor === "measured"
      ? `FPS neo theo <b>số đo thật</b> của game này trên ${esc(fps.measuredOn)}, rồi nhân theo tỉ lệ sức mạnh card của bạn — chính xác hơn nhiều so với đoán từ yêu cầu cấu hình.`
      : `FPS là ước lượng neo theo yêu cầu của nhà phát hành${fps.anchor === 144 ? " (mức High ≈ 144 FPS)" : fps.anchor === 60 ? " (mức Đề xuất ≈ 1080p Cao 60 FPS)" : " (mức Tối thiểu ≈ 1080p Thấp 30 FPS)"}, chưa có số đo thật cho game này — có thể lệch nhiều.`}${p.screen && p.screen.hz && fps.high > p.screen.hz ? ` Màn hình bạn <b>${p.screen.hz} Hz</b>: bật vsync thì hiển thị tối đa ${p.screen.hz} FPS.` : ""}${fps.cap ? ` Game khoá cứng tối đa <b>${fps.cap} FPS</b>${fps.capped ? " — máy bạn chạm trần ở mức thấp, nên không lên cao hơn được" : ""}.` : ""}</p>` : ""}

    ${r.diskShort ? `<div class="note" style="margin-top:14px">Máy chạy được, nhưng ổ đĩa còn trống <b>${p.disk} GB</b> trong khi game cần <b>${p.disk + r.diskShort} GB</b> — dọn thêm khoảng <b>${r.diskShort} GB</b> trước khi cài.</div>` : ""}
    ${weakButOk720 ? `<div class="note" style="margin-top:14px">Chưa đạt mức tối thiểu ở 1080p, nhưng hạ xuống <b>720p mức Thấp</b> (hoặc bật FSR) thì vẫn có thể chơi được khoảng <b>${fps.low720} FPS</b>.</div>` : ""}
    ${p.source === "web" && !(p.ram && p.ram.confirmed) && L.rec && L.rec.ram > 8 ? `<div class="note" style="margin-top:14px">Game đề xuất <b>${L.rec.ram} GB RAM</b>, mà trình duyệt chỉ thấy tối đa 8 GB. <a href="#/">Xác nhận RAM của bạn</a> ở trang chủ để kết quả đúng.</div>` : ""}

    <div class="tbl-wrap"><table class="req">
      <thead><tr><th scope="col">Thành phần</th><th scope="col">Tối thiểu</th><th scope="col">Đề xuất</th><th scope="col">Máy bạn</th></tr></thead>
      <tbody>${rows.map((x) => `<tr><td class="k">${names[x.k]}</td>
        <td>${icon(x.sMin)}${cell(x.k, "min")}</td><td>${icon(x.sRec)}${cell(x.k, "rec")}</td><td>${mine[x.k]}</td></tr>`).join("")}</tbody>
    </table></div>

    ${ups.length ? `<h2 class="sec-h" style="margin-top:36px;font-size:22px">Cần nâng gì để đạt mức ${target === "min" ? "Tối thiểu" : "Đề xuất"}?</h2>
      <div class="ups">${ups.map(upCard).join("")}</div>` : ""}

    ${p.source === "web" ? `<div class="note good" style="margin-top:22px">Kết quả này dựa trên quét bằng trình duyệt. <a href="#/detect">Chạy ứng dụng nhận diện</a> để có tên CPU, RAM và VRAM chính xác tuyệt đối.</div>` : ""}
    <p class="src">${srcNote}</p>`;
  window.scrollTo(0, 0);
}

function verdictText(r, g) {
  if (r.verdict === "unknown") return "Nhà phát hành chưa công bố yêu cầu cấu hình rõ ràng.";
  const names = { gpu: "card đồ họa", cpu: "CPU", ram: "RAM", vram: "VRAM", disk: "ổ đĩa", ssd: "ổ SSD (máy chỉ có HDD — vẫn chạy nhưng giật khi tải cảnh)", dx: "DirectX" };
  if (r.verdict === "bad") return "Còn thiếu: " + r.failMin.map((x) => names[x.k]).join(", ") + ".";
  if (r.verdict === "ok") return r.failRec.length ? "Đạt tối thiểu, chưa đạt mức đề xuất về " + r.failRec.map((x) => names[x.k]).join(", ") + "." : "Đạt mức tối thiểu.";
  return g.rec ? "Vượt mức đề xuất của nhà phát hành." : "Vượt xa mức tối thiểu.";
}

function upCard(u) {
  const names = { gpu: "Card đồ họa", cpu: "CPU", ram: "RAM" };
  const needName = u.type === "gpu" && /^[a-z0-9 ]+$/.test(u.need.name) ? prettyGpu(u.need.name) : u.need.name;
  const need = u.type === "ram" ? u.need.name : `${esc(needName)} (≈ ${u.type === "cpu" ? kd(u.need.idx, PTS.cpu) : kd(u.need.idx)})`;
  return `<div class="card up"><h3>${names[u.type]} — cần tối thiểu cỡ ${need}</h3>
    ${u.blocked ? `<p class="muted" style="margin-top:6px">${esc(u.blocked)}</p>` : ""}
    ${u.note ? `<p class="muted" style="margin-top:6px;font-size:13px">${esc(u.note)}</p>` : ""}
    ${u.options.length ? `<div class="opts">${u.options.map((o) => {
      const price = CONFIG.PRICES[o.key];
      return `<a class="opt" href="${esc(shopUrl(o.name))}" target="_blank" rel="noopener sponsored"><b>${esc(o.name)}</b>
        <span>${o.type === "ram" ? "" : (o.type === "cpu" ? kd(o.idx, PTS.cpu) : kd(o.idx) + (o.vram ? " · " + o.vram + " GB" : ""))}</span>
        <em>${price ? price.toLocaleString("vi-VN") + " đ →" : "Xem giá →"}</em></a>`;
    }).join("")}</div>` : ""}</div>`;
}

// ---------------------------------------------------------------------------
// 4 BƯỚC CHẠY ỨNG DỤNG NHẬN DIỆN
// ---------------------------------------------------------------------------
let pollTimer = null;
async function renderDetect() {
  clearInterval(pollTimer);
  const step = (n, label, state) => `<div class="ws ${state}"><span class="dot">${state === "done" ? "✓" : n}</span>${label}</div>`;
  const draw = (cur, main) => {
    view().innerHTML = `<div class="card wiz">
      <div class="wiz-steps">
        ${step(1, "Bắt đầu", "done")}
        ${step(2, "Thu thập dữ liệu", cur >= 2 ? (cur > 2 ? "done" : "cur") : "")}
        ${step(3, "Ứng dụng nhận diện", cur > 3 ? "done" : cur === 3 ? "cur" : "")}
        ${step(4, "Hoàn tất", cur === 4 ? "cur" : "")}
      </div>
      <div class="wiz-main">${main}</div></div>`;
  };
  if (!S.profile) {
    draw(2, `<h2>Đang thu thập dữ liệu từ trình duyệt…</h2><p class="muted"><span class="spin"></span>Khoảng 5 giây.</p>`);
    await new Promise((res) => { const t = setInterval(() => { if (S.profile) { clearInterval(t); res(); } }, 200); });
  }
  let sid = null;
  if (hasBackend()) {
    try { sid = (await api("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gpu: S.profile.gpu && S.profile.gpu.name }) })).sid; } catch (e) {}
  }
  // Tên file mang mã phiên — app đọc chính tên mình để biết gửi kết quả về tab nào.
  // Một file exe dùng chung cho mọi người, chỉ đổi tên lúc tải (thuộc tính download).
  const fileName = sid ? `runable_g4market (${sid}).exe` : "runable_g4market.exe";
  // Nhịp chờ: hỏi mỗi 3 giây, app phải mở trong 60 giây, chạy xong trong 90 giây
  const CHECK_EVERY = 3000, WARN_AFTER = 5000, LOAD_TIMEOUT = 60000, RUN_TIMEOUT = 90000;
  draw(3, `
    <h2>Hãy chạy Ứng dụng nhận diện để hoàn tất phân tích máy của bạn.</h2>
    <div><b>Ứng dụng nhận diện:</b>
      <ul style="margin-top:8px">
        <li>Hoàn toàn an toàn — chỉ đọc thông tin phần cứng, không cài đặt, không thu thập thông tin cá nhân.</li>
        <li>Gỡ bỏ dễ dàng — chỉ cần xoá file.</li>
        <li>Nhỏ gọn — khoảng 30 KB, chạy xong trong vài giây.</li>
      </ul></div>
    <div><a class="btn primary" id="dl" href="${esc(CONFIG.APP_URL)}" download="${esc(fileName)}">Tải lại runable_g4market.exe</a></div>
    <p class="muted" style="font-size:13px">File đã tự tải về — mở nó ở <b>góc trên bên phải</b> trình duyệt. Windows có thể hiện <b>“Windows protected your PC”</b> vì file chưa có chữ ký số: bấm <b>More info</b> rồi <b>Run anyway</b>.</p>
    <div id="waitbox"></div>`);
  // Tự bấm tải ngay khi vào bước này — người dùng chỉ còn việc mở file
  setTimeout(() => { const a = $("#dl"); if (a) a.click(); }, 400);
  showArrow(true);

  const box = () => $("#waitbox");
  if (!sid) {
    box().innerHTML = `<p>Chạy xong, ứng dụng sẽ tự mở trang kết quả trong tab mới.</p>`;
    return;
  }
  const t0 = Date.now();
  let runningSince = null;
  const say = (html, warn) => { if (box()) box().innerHTML = warn ? `<div class="note">${html}</div>` : `<p>${html}</p>`; };
  say(`<span class="spin"></span>Đang chờ ứng dụng…`);

  pollTimer = setInterval(async () => {
    if (location.hash !== "#/detect") { clearInterval(pollTimer); showArrow(false); return; }
    let s;
    try { s = await api("/api/session?sid=" + sid); } catch (e) { return; }
    const waited = Date.now() - t0;

    if (s.status === "done" && s.checkId) {
      clearInterval(pollTimer); showArrow(false);
      const c = await api("/api/check?id=" + encodeURIComponent(s.checkId));
      if (c.specs) useAppProfile(c.specs, s.checkId);
      const pw = power(S.profile);
      draw(4, `<h2>Hoàn tất!</h2>
        <p>Đã nhận cấu hình chính xác: <b>${esc(S.profile.cpu && S.profile.cpu.name)}</b> · <b>${esc(S.profile.gpu && S.profile.gpu.name)}</b> · <b>${ramGb(S.profile)} GB RAM</b>${S.profile.ssd != null ? ` · <b>${S.profile.ssd ? "có SSD" : "chỉ có HDD"}</b>` : ""}.</p>
        <p>Chỉ số sức mạnh <b style="color:var(--green)">${pw.total.toLocaleString("en-US")}</b> — cảnh giới <b>${pw.tier.name}</b>.</p>
        <div><a class="btn primary" href="#/">Xem máy tôi chạy được game gì</a></div>`);
      return;
    }
    if (s.status === "expired") {
      clearInterval(pollTimer); showArrow(false);
      say(`Phiên chờ đã hết hạn. <a href="#/detect" onclick="location.reload()">Thử lại</a>.`, true);
      return;
    }
    if (s.status === "running") {
      // App đã mở — thôi chỉ mũi tên, chuyển sang "đang kiểm tra"
      if (!runningSince) { runningSince = Date.now(); showArrow(false); }
      if (Date.now() - runningSince > RUN_TIMEOUT) {
        clearInterval(pollTimer);
        say(`Ứng dụng đã mở nhưng chạy quá lâu mà chưa gửi được kết quả — có thể mạng bị chặn. Tắt ứng dụng rồi chạy lại file vừa tải.`, true);
      } else say(`<span class="spin"></span>Ứng dụng đang kiểm tra máy của bạn…`);
      return;
    }
    // Vẫn chưa thấy app mở
    if (waited > LOAD_TIMEOUT) {
      say(`<b>Chưa thấy ứng dụng chạy.</b> Kiểm tra: file đã tải xong chưa · Windows SmartScreen có chặn không (bấm More info → Run anyway) · phần mềm diệt virus có cách ly file không. Không thấy file thì bấm <b>Tải lại</b> ở trên.`, true);
    } else if (waited > WARN_AFTER) {
      say(`<b>Đang chờ ứng dụng.</b> Mở file <b>${esc(fileName)}</b> vừa tải để tiếp tục.`, true);
    }
  }, CHECK_EVERY);
}

// Mũi tên nhún nhảy chỉ vào khu tải xuống của trình duyệt (Chrome, Edge, Firefox đều ở góc trên bên phải)
function showArrow(on) {
  let el = document.getElementById("dlarrow");
  if (!on) { if (el) el.remove(); return; }
  if (el) return;
  el = document.createElement("div");
  el.id = "dlarrow";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<span>↑</span><b>Mở file vừa tải ở đây</b>`;
  document.body.appendChild(el);
}

// ---------------------------------------------------------------------------
// Điều hướng
// ---------------------------------------------------------------------------
function renderRoute() {
  const h = location.hash || "#/";
  if (h !== "#/detect") showArrow(false);
  if (h.startsWith("#/game/")) return renderGame(decodeURIComponent(h.slice(7)));
  if (h === "#/detect") return renderDetect();
  return renderHome();
}

function handleIncoming() {
  const h = location.hash || "";
  // Ứng dụng mở: #/app?specs=...&id=...   ·   bản EvoCheck cũ: #specs=...
  const m = /[?#&]specs=([^&]+)/.exec(h);
  if (m) {
    const specs = decodeURIComponent(m[1]);
    const id = (/[?&]id=([^&]+)/.exec(h) || [])[1] || null;
    useAppProfile(specs, id);
    history.replaceState(null, "", location.pathname + location.search + "#/");
    return true;
  }
  return false;
}

function wireTheme() {
  const b = $("#theme");
  const draw = () => { b.textContent = document.documentElement.dataset.theme === "light" ? "🌙 Tối" : "🌞 Sáng"; };
  b.addEventListener("click", () => {
    const light = document.documentElement.dataset.theme !== "light";
    if (light) document.documentElement.dataset.theme = "light"; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem("rg_theme", light ? "light" : "dark"); } catch (e) {}
    draw();
  });
  draw();
}

async function boot() {
  wireTheme();
  await loadLibrary();
  const fromApp = handleIncoming();
  if (!fromApp) {
    // Kết quả từ app còn mới (dưới 30 ngày) thì dùng lại, khỏi quét bằng trình duyệt
    const saved = store.get("rg_profile");
    if (saved && saved.source === "app" && Date.now() - saved.at < 30 * 86400e3) { S.profile = saved; submitCheck(); }
  }
  window.addEventListener("hashchange", () => { handleIncoming(); renderRoute(); });
  // Ảnh bìa không tải được (mất mạng, bị chặn) → thay bằng ô chữ viết tắt
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!img || img.tagName !== "IMG" || img.dataset.fb) return;
    img.dataset.fb = "1";
    const t = document.createElement("template");
    t.innerHTML = initials(img.dataset.name || "?", img.dataset.big ? "ini big" : "ini");
    img.replaceWith(t.content.firstChild);
  }, true);
  // Bấm ra ngoài ô tìm kiếm thì đóng danh sách gợi ý
  document.addEventListener("click", (e) => {
    const box = $("#suggest");
    if (box && !e.target.closest(".search-box")) box.hidden = true;
  });
  renderRoute();
  if (!S.profile) runScan(); else loadStats();
}
boot();
