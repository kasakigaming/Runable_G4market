// ============================================================================
// Bộ não RunableGames: so máy với yêu cầu game, chấm sức mạnh, xếp cảnh giới,
// gợi ý nâng cấp. Không đụng DOM — app.js lo phần hiển thị.
// ============================================================================
import { reqGpu, reqCpu, GPU_BY_KEY, CPUS } from "../shared/hwscore.js";
import { splitAlts } from "../shared/reqparse.js";

// ---------------------------------------------------------------------------
// Điểm sức mạnh — gộp CPU, GPU, RAM thành một con số
// ---------------------------------------------------------------------------
export const PTS = { gpu: 223, cpu: 300, ram: 400 };   // RTX 3060 Ti → ~30.300 · i5-12400F → 30.000 · 16 GB → 6.400
const r100 = (x) => Math.round(x / 100) * 100;
export const kd = (idx, per = PTS.gpu) => (idx == null ? "?" : (r100(idx * per) / 1000).toFixed(1) + "kđ");

export const TIERS = [
  { n: "I",    name: "Luyện Khí",       min: 0,      color: "#64748b", desc: "Mới nhập môn — hợp game nhẹ, game online đời cũ." },
  { n: "II",   name: "Trúc Cơ",         min: 16000,  color: "#0d9488", desc: "Nền móng đã vững — eSports mượt, game AAA phải hạ hết cài đặt." },
  { n: "III",  name: "Kim Đan",         min: 28000,  color: "#16a34a", desc: "Kết đan thành công — đa số game chạy ổn ở 1080p mức Thấp đến Trung bình." },
  { n: "IV",   name: "Nguyên Anh",      min: 40000,  color: "#22c55e", desc: "Nguyên anh thành hình — AAA mới chơi được 1080p mức Trung bình." },
  { n: "V",    name: "Hóa Thần",        min: 52000,  color: "#2563eb", desc: "Thần thức lan tỏa — 1080p mức Cao ổn định ở hầu hết game." },
  { n: "VI",   name: "Luyện Hư",        min: 64000,  color: "#0891b2", desc: "Nội lực hùng hậu — game AAA nặng vẫn mượt ở 1440p." },
  { n: "VII",  name: "Hợp Thể",         min: 76000,  color: "#7c3aed", desc: "Thân tâm hợp nhất — 1440p mức Rất cao, bật được Ray Tracing." },
  { n: "VIII", name: "Độ Kiếp",         min: 88000,  color: "#db2777", desc: "Vượt thiên kiếp — 4K chơi được, 1440p tần số quét cao." },
  { n: "IX",   name: "Đại La Kim Tiên", min: 100000, color: "#d97706", desc: "Đỉnh phong tu tiên giới — không game nào làm khó được." },
];
export const tierOf = (p) => [...TIERS].reverse().find((t) => p >= t.min) || TIERS[0];

export function power(profile) {
  const g = profile.gpu && profile.gpu.idx ? profile.gpu.idx : 0;
  const c = profile.cpu && profile.cpu.idx ? profile.cpu.idx : 0;
  const ram = ramGb(profile);
  const gpuPts = r100(g * PTS.gpu), cpuPts = r100(c * PTS.cpu), ramPts = r100(Math.min(64, ram || 0) * PTS.ram);
  const total = gpuPts + cpuPts + ramPts;
  return { total, gpuPts, cpuPts, ramPts, tier: tierOf(total) };
}

// RAM thật sự dùng được cho game (máy cầm tay/iGPU bị BIOS cắt một phần làm VRAM)
export function ramGb(profile) {
  const r = profile.ram || {};
  return r.usable || r.gb || null;
}

// ---------------------------------------------------------------------------
// So máy với yêu cầu của một game
// ---------------------------------------------------------------------------
function prep(req) {
  if (!req) return null;
  if (!req.cpuAlts) req.cpuAlts = splitAlts(req.cpu);
  if (!req.gpuAlts) req.gpuAlts = splitAlts(req.gpu);
  return req;
}

const TOL = 0.95;   // lệch 5% coi như ngang nhau — sai số của bảng điểm

function cmp(have, need) {
  if (need == null) return "na";         // game không ghi mức này
  if (have == null) return "unknown";    // không biết máy mình có gì
  return have >= need * TOL ? "pass" : "fail";
}

export function checkGame(profile, game) {
  const min = prep(game.min), rec = prep(game.rec), high = prep(game.high);
  const lv = (req) => req ? {
    gpu: reqGpu(req), cpu: reqCpu(req), ram: req.ram || null, vram: req.vram || null, disk: req.disk || null,
  } : null;
  const L = { min: lv(min), rec: lv(rec), high: lv(high) };

  const gpu = profile.gpu || {};
  const have = {
    gpu: gpu.idx ?? null,
    cpu: profile.cpu ? profile.cpu.idx : null,
    ram: ramGb(profile),
    // card onboard mượn RAM hệ thống → coi VRAM ≈ một nửa RAM, tối đa 8 GB
    vram: gpu.vram != null ? gpu.vram : (gpu.integrated && ramGb(profile) ? Math.min(8, ramGb(profile) / 2) : null),
    disk: profile.disk ?? null,
  };
  // RAM đo từ trình duyệt chỉ là mức sàn (bị chặn ở 8 GB) → không được đánh trượt oan
  const ramUnsure = profile.ram && !profile.ram.exact && !profile.ram.confirmed;

  const rows = ["gpu", "cpu", "ram", "vram", "disk"].map((k) => {
    const need = { min: L.min && L.min[k], rec: L.rec && L.rec[k] };
    const val = (x) => (x && typeof x === "object" ? x.idx : x);
    let sMin = cmp(have[k], val(need.min)), sRec = cmp(have[k], val(need.rec));
    if (k === "ram" && ramUnsure && (sMin === "fail" || sRec === "fail")) {
      if (sMin === "fail") sMin = "unknown";
      if (sRec === "fail") sRec = "unknown";
    }
    return { k, have: have[k], min: need.min, rec: need.rec, sMin, sRec };
  });

  // --- Dung lượng trống: dọn ổ là xong, không phải chuyện cấu hình → chỉ nhắc, không tính vào phán đoán
  for (const r of rows) if (r.k === "disk") {
    r.info = true;
    if (r.sMin === "fail") r.sMin = "warn";
    if (r.sRec === "fail") r.sRec = "warn";
  }

  // --- SSD: 25/65 game Steam phổ biến ghi "SSD required". Ổ HDD vẫn chạy được nhưng giật lúc tải
  //     cảnh, nên thiếu SSD chỉ chặn mức "Chạy mượt", không đánh "Chưa đủ". Chỉ app mới biết máy có SSD.
  const wantsSsd = (req) => !!req && /\bssd\b/i.test([req.notes, req.diskText, req.os].filter(Boolean).join(" "));
  const needSsd = wantsSsd(min) || wantsSsd(rec);
  if (needSsd) {
    const s = profile.ssd == null ? "unknown" : profile.ssd ? "pass" : "fail";
    rows.push({ k: "ssd", have: profile.ssd, min: wantsSsd(min) ? "SSD" : null, rec: "SSD", sMin: wantsSsd(min) ? s : "na", sRec: s, soft: true });
  }
  // --- DirectX: hỏi thẳng driver mức feature level. Game DX11/DX12 cần card từ mức 11_0 trở lên.
  const dxNeed = Math.max((min && min.dx) || 0, (rec && rec.dx) || 0);
  if (dxNeed >= 11 && profile.dxfl != null) {
    const s = profile.dxfl >= 11 ? "pass" : "fail";
    rows.push({ k: "dx", have: profile.dxfl, min: min && min.dx ? min.dx : null, rec: rec && rec.dx ? rec.dx : null, sMin: s, sRec: s });
  }

  const known = !!(L.min && (L.min.gpu || L.min.cpu || L.min.ram)) || !!(L.rec && (L.rec.gpu || L.rec.cpu));
  // Thiếu SSD (soft) không đánh "Chưa đủ" — HDD vẫn chạy, chỉ giật khi tải cảnh
  const failMin = rows.filter((r) => r.sMin === "fail" && !r.soft && !r.info);
  const failRec = rows.filter((r) => r.sRec === "fail" && !r.info);
  // Thiếu chỗ trống để cài (chỉ app mới biết) — trang hiện lời nhắc riêng
  const diskRow = rows.find((r) => r.k === "disk");
  const diskShort = diskRow && diskRow.have != null && diskRow.min != null && diskRow.have < diskRow.min
    ? Math.ceil(diskRow.min - diskRow.have) : 0;
  const hasRec = !!(L.rec && (L.rec.gpu || L.rec.cpu || L.rec.ram));

  let verdict;
  if (!known) verdict = "unknown";
  else if (failMin.length) verdict = "bad";
  else if (hasRec ? !failRec.length : marginOk(have, L.min, 1.8)) verdict = "great";
  else verdict = "ok";

  return { verdict, rows, levels: L, failMin, failRec, diskShort, fps: estimateFps(have, L, FPS_CAPS[game.id]), bottleneck: bottleneck(have, L) };
}

function marginOk(have, lvl, k) {
  if (!lvl) return false;
  const g = lvl.gpu ? have.gpu >= lvl.gpu.idx * k : true;
  const c = lvl.cpu ? have.cpu >= lvl.cpu.idx * k * 0.8 : true;
  return g && c;
}

// ---------------------------------------------------------------------------
// FPS ước lượng — neo vào yêu cầu của chính nhà phát hành:
//   mức Đề xuất ≈ 1080p Cao 60 FPS · mức Tối thiểu ≈ 1080p Thấp 30 FPS · mức Cao (nếu có, như Valorant) ≈ 144 FPS
// Đây là ước lượng, không phải đo thật.
// ---------------------------------------------------------------------------
// Game bị khoá FPS cứng — vượt mức này là vô nghĩa dù máy mạnh cỡ nào
export const FPS_CAPS = {
  "steam:1245620": 60,    // ELDEN RING
  "steam:2622380": 60,    // ELDEN RING NIGHTREIGN
  "steam:814380": 60,     // Sekiro
  "steam:374320": 60,     // DARK SOULS III
  "steam:1778820": 60,    // TEKKEN 8
  "steam:1364780": 60,    // Street Fighter 6
  "steam:489830": 60,     // Skyrim Special Edition (vật lý gắn với 60)
  "steam:377160": 60,     // Fallout 4 (vật lý gắn với 60)
  "steam:1888160": 120,   // ARMORED CORE VI
  "x:genshin-impact": 120,
  "x:honkai-star-rail": 120,
};

export function estimateFps(have, L, cap) {
  const anchor = L.high && L.high.gpu ? { lvl: L.high, fps: 144 }
    : L.rec && L.rec.gpu ? { lvl: L.rec, fps: 60 }
    : L.min && L.min.gpu ? { lvl: L.min, fps: 30 } : null;
  if (!anchor || !have.gpu) return null;
  const gr = have.gpu / Math.max(1, anchor.lvl.gpu.idx);
  const cpuNeed = anchor.lvl.cpu ? anchor.lvl.cpu.idx : null;
  const cr = cpuNeed && have.cpu ? have.cpu / Math.max(1, cpuNeed) : null;
  // Khi nghẽn GPU, FPS tăng gần tuyến tính theo sức GPU; CPU thì tăng chậm hơn
  const byGpu = anchor.fps * Math.pow(gr, 0.95);
  const byCpu = cr ? anchor.fps * Math.pow(cr, 0.7) * 1.25 : Infinity;
  let fps = Math.min(byGpu, byCpu);
  // Mức Thấp nhanh hơn mức Cao khoảng 1.4 lần
  const high = anchor.fps === 30 ? fps / 1.4 : fps;
  const low = anchor.fps === 30 ? fps : fps * 1.4;
  const lim = cap || 400;
  const clamp = (x) => Math.max(1, Math.min(lim, Math.round(x)));
  // 720p Thấp — lối thoát cho máy yếu và máy cầm tay. Hạ độ phân giải chỉ đỡ phần GPU;
  // CPU gần như không nhẹ đi, nên vẫn bị chặn bởi giới hạn CPU.
  const gpuLow = anchor.fps === 30 ? byGpu : byGpu * 1.4;
  const cpuLow = anchor.fps === 30 ? byCpu : byCpu * 1.15;
  const low720 = Math.min(gpuLow * 1.45, cpuLow);
  return {
    high: clamp(high), low: clamp(low), low720: clamp(low720),
    limitedBy: byCpu < byGpu ? "cpu" : "gpu", anchor: anchor.fps,
    cap: cap || null, capped: !!cap && low720 > cap,
  };
}

function bottleneck(have, L) {
  const lvl = L.rec || L.min;
  if (!lvl || !lvl.gpu || !lvl.cpu || !have.gpu || !have.cpu) return null;
  const g = have.gpu / lvl.gpu.idx, c = have.cpu / lvl.cpu.idx;
  if (g < c * 0.7) return "gpu";
  if (c < g * 0.7) return "cpu";
  return null;
}

export const VERDICT = {
  great:   { label: "Chạy mượt",   cls: "great" },
  ok:      { label: "Chạy được",   cls: "ok" },
  bad:     { label: "Chưa đủ",     cls: "bad" },
  unknown: { label: "Chưa rõ yêu cầu", cls: "unknown" },
};

// ---------------------------------------------------------------------------
// Gợi ý nâng cấp — chọn linh kiện YẾU NHẤT vẫn đủ đạt mức yêu cầu
// (linh kiện yếu nhất vừa đủ thường cũng là rẻ nhất trong cùng đời).
// Có giá thật trong CONFIG.PRICES thì sắp theo giá.
// ---------------------------------------------------------------------------
export const PARTS = {
  gpu: ["rtx 3050", "rx 6600", "rtx 3060", "rx 7600", "rtx 5060", "arc b580", "rx 9060 xt", "rtx 5060 ti",
        "rtx 5070", "rx 9070", "rx 9070 xt", "rtx 5070 ti", "rtx 5080", "rtx 5090"]
    .map((k) => GPU_BY_KEY.get(k)).filter(Boolean)
    .map((g) => ({ type: "gpu", key: g[0], name: g[3] || prettyGpu(g[0]), idx: g[1], vram: g[2] })),
  cpu: ["Core i3-12100F", "Ryzen 5 5600", "Core i5-12400F", "Core i5-14400F", "Ryzen 5 7500F", "Ryzen 7 5700X3D",
        "Ryzen 5 7600", "Core i5-14600K", "Ryzen 5 9600X", "Ryzen 7 7800X3D", "Ryzen 7 9800X3D"]
    .map((n) => CPUS.find((c) => c[0] === n)).filter(Boolean)
    .map((c) => ({ type: "cpu", key: c[0], name: c[0], idx: c[1] })),
  ram: [16, 32, 64].map((gb) => ({ type: "ram", key: "ram" + gb, name: `RAM ${gb} GB (2 thanh)`, idx: gb })),
};

export function prettyGpu(key) {
  const p = String(key).replace(/\b(rtx|gtx|rx|xt|xtx|gre|ti)\b/g, (m) => m.toUpperCase().replace("TI", "Ti"))
    .replace(/\barc\b/, "Arc").replace(/\bb(\d{3})\b/, "B$1").replace(/\bsuper\b/, "Super");
  if (/^(RTX|GTX)/.test(p)) return "NVIDIA GeForce " + p;
  if (/^RX/.test(p)) return "AMD Radeon " + p;
  if (/^Arc/.test(p)) return "Intel " + p;
  return p;
}

function byPrice(prices) {
  return (a, b) => {
    const pa = prices[a.key], pb = prices[b.key];
    if (pa && pb) return pa - pb;
    return a.idx - b.idx;
  };
}

export function upgradesFor(profile, check, target = "rec", prices = {}) {
  const L = check.levels[target] || check.levels.min;
  if (!L) return [];
  const out = [];
  const laptop = profile.laptop === true;
  const have = { gpu: profile.gpu && profile.gpu.idx, cpu: profile.cpu && profile.cpu.idx, ram: ramGb(profile) };
  if (L.gpu && have.gpu != null && have.gpu < L.gpu.idx * TOL) {
    const opts = PARTS.gpu.filter((p) => p.idx >= L.gpu.idx && p.idx > have.gpu * 1.15).sort(byPrice(prices)).slice(0, 3);
    out.push({ type: "gpu", need: L.gpu, options: laptop ? [] : opts, blocked: laptop ? "Laptop không thay được card đồ họa." : null });
  }
  if (L.cpu && have.cpu != null && have.cpu < L.cpu.idx * TOL) {
    const opts = PARTS.cpu.filter((p) => p.idx >= L.cpu.idx && p.idx > have.cpu * 1.1).sort(byPrice(prices)).slice(0, 3);
    out.push({ type: "cpu", need: L.cpu, options: laptop ? [] : opts,
      blocked: laptop ? "Laptop không thay được CPU." : null,
      note: laptop ? null : "Đổi CPU khác đời thường phải đổi luôn mainboard (và RAM nếu lên DDR5)." });
  }
  if (L.ram && have.ram != null && have.ram < L.ram * TOL) {
    const opts = PARTS.ram.filter((p) => p.idx >= L.ram).slice(0, 2);
    out.push({ type: "ram", need: { idx: L.ram, name: L.ram + " GB" }, options: opts,
      note: laptop ? "Nhiều laptop hàn chết RAM — kiểm tra máy còn khe trống không." : null });
  }
  return out;
}

// Nâng cấp ĐƠN LẺ đáng tiền nhất cho cả thư viện: mở khoá được nhiều game "Chạy mượt" nhất
export function bestLibraryUpgrade(profile, games, prices = {}) {
  if (profile.laptop === true || !profile.gpu || profile.gpu.idx == null) return null;
  const baseGreat = games.filter((g) => checkGame(profile, g).verdict === "great").length;
  let best = null;
  const cands = [...PARTS.gpu].filter((p) => p.idx > profile.gpu.idx * 1.2).sort(byPrice(prices)).slice(0, 6);
  for (const p of cands) {
    const trial = { ...profile, gpu: { ...profile.gpu, idx: p.idx, vram: p.vram, integrated: false } };
    const great = games.filter((g) => checkGame(trial, g).verdict === "great").length;
    const gain = great - baseGreat;
    // ưu tiên linh kiện yếu nhất cho mức cải thiện gần tối đa
    if (gain > 0 && (!best || gain > best.gain * 1.25)) best = { part: p, gain, total: great };
  }
  return best;
}
