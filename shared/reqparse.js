// Đọc khối yêu cầu cấu hình (HTML) của Steam thành dữ liệu có cấu trúc.
// Dùng chung cho: script tạo dữ liệu (Node), backend (Deno) và trang web (trình duyệt).
// Không phụ thuộc thư viện nào.

const LABELS = [
  ["vram",  /^(video\s*(ram|memory)|vram|graphics\s*memory|dedicated\s*video\s*ram)$/i],
  ["cpu",   /^(processors?|cpu)$/i],
  ["gpu",   /^(graphics|video\s*card|graphics\s*card|gpu|video|graphics\s*cards?)$/i],
  ["ram",   /^(memory|ram|system\s*memory|system\s*ram)$/i],
  ["disk",  /^(storage|hard\s*(disk|drive)(\s*space)?|disk\s*space|hdd|ssd|free\s*disk\s*space|hard\s*disk\s*space|available\s*space)$/i],
  ["os",    /^(os|operating\s*system|windows|os\s*version)$/i],
  ["dx",    /^(directx|direct\s*x|dx)$/i],
  ["notes", /^(additional\s*notes|notes|other(\s*requirements)?|additional)$/i],
];

const ENTITIES = { "&nbsp;":" ", "&amp;":"&", "&quot;":"\"", "&#39;":"'", "&apos;":"'", "&lt;":"<", "&gt;":">", "&reg;":"", "&trade;":"", "&copy;":"" };

export function htmlToLines(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(li|p|div|ul|tr|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (e) => (e in ENTITIES ? ENTITIES[e] : " "))
    .replace(/[®™©]/g, "")
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// "12 GB RAM" → 12 · "8192 MB" → 8 · "1 TB" → 1024
export function toGB(s) {
  if (!s) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*(tb|gb|go|mb|mo)\b/i.exec(s);
  if (!m) return null;
  let v = parseFloat(m[1].replace(",", "."));
  const u = m[2].toLowerCase();
  if (u === "tb") v *= 1024;
  if (u === "mb" || u === "mo") v /= 1024;
  return Math.round(v * 10) / 10;
}

// VRAM thường nằm lẫn trong dòng card: "GTX 1060 3 GB" · "2GB VRAM"
function vramFromGpu(s) {
  if (!s) return null;
  const all = [...String(s).matchAll(/(\d+(?:\.\d+)?)\s*(gb|mb)\b/gi)]
    .map((m) => (m[2].toLowerCase() === "mb" ? parseFloat(m[1]) / 1024 : parseFloat(m[1])))
    .filter((v) => v >= 0.25 && v <= 48);
  return all.length ? Math.min(...all) : null;
}

// Tách các lựa chọn tương đương: "GTX 1060 or RX 580" · "i5-8400 / Ryzen 3 3300X"
export function splitAlts(s) {
  if (!s) return [];
  return String(s)
    .split(/\s+or\s+|\s*\/\s*(?=\D)|\s*\|\s*|;\s*|,\s*(?=(?:amd|intel|nvidia|geforce|radeon|arc|apple)\b)/i)
    .map((x) => x.replace(/^(or|and)\s+/i, "").trim())
    .filter((x) => x.length > 1);
}

// Game đời cũ ghi một dòng không nhãn: "500 mhz processor, 96mb ram, 16mb video card, Windows XP, Mouse"
// → tách theo dấu phẩy rồi đoán từng mẩu là gì
function unlabeled(lines) {
  const text = lines.join(", ").replace(/^\s*(minimum|recommended)\s*:?\s*/i, "");
  const out = {};
  for (const raw of text.split(/\s*[,;]\s*/)) {
    const p = raw.replace(/^(minimum|recommended)\s*:\s*/i, "").trim();
    if (!p) continue;
    if (!out.ram && /\d\s*(mb|gb)\s*(of\s*)?(system\s*)?(ram|memory)\b/i.test(p)) out.ram = p;
    else if (!out.gpu && /video|graphics|\bvram\b|geforce|radeon|\b3-?d\b|opengl|directx.*(card|level)/i.test(p)) out.gpu = p;
    else if (!out.cpu && /\d\s*[gm]hz|processor|\bcpu\b|pentium|athlon|core\s*(2|i\d)|celeron|phenom/i.test(p)) out.cpu = p;
    else if (!out.disk && /\d\s*(mb|gb)\s*(of\s*)?(free\s*|available\s*)?(hdd|hard|disk|space)/i.test(p)) out.disk = p;
    else if (!out.os && /windows|\bxp\b|vista/i.test(p)) out.os = p;
  }
  return out;
}

export function parseReq(html) {
  const found = {};
  const lines = htmlToLines(html);
  for (const line of lines) {
    const m = /^([A-Za-z][A-Za-z \/]{1,34}?)\s*\*?\s*[:：]\s*(.+)$/.exec(line);
    if (!m) continue;
    const label = m[1].trim();
    for (const [key, re] of LABELS) {
      if (re.test(label)) { if (!found[key]) found[key] = m[2].trim(); break; }
    }
  }
  if (!found.cpu && !found.gpu && !found.ram) Object.assign(found, unlabeled(lines));
  const dx = found.dx ? parseFloat((/(\d+(?:\.\d+)?)/.exec(found.dx) || [])[1]) || null : null;
  const out = {
    os: found.os || null,
    cpu: found.cpu || null,
    gpu: found.gpu || null,
    ram: toGB(found.ram),
    vram: toGB(found.vram) || vramFromGpu(found.gpu),
    disk: toGB(found.disk),
    diskText: found.disk || null,   // giữ nguyên chữ — hay có "SSD required"
    dx,
    notes: found.notes || null,
  };
  out.cpuAlts = splitAlts(out.cpu);
  out.gpuAlts = splitAlts(out.gpu);
  out.empty = !out.cpu && !out.gpu && !out.ram;
  return out;
}

// Chữ người dùng tự dán (từ Epic, trang nhà phát hành, diễn đàn…): nhãn có thể là tiếng Việt,
// cả khối có thể dính liền một dòng "OS: Win 10 Processor: i5 Memory: 8 GB".
const VI_LABELS = [   // thứ tự quan trọng: "bộ nhớ đồ họa" phải thay trước "đồ họa" và "bộ nhớ"
  [/(bộ nhớ đồ họa|bộ nhớ đồ hoạ|bộ nhớ card)\s*[:：]/gi, "VRAM:"],
  [/(hệ điều hành|he dieu hanh|hđh)\s*[:：]/gi, "OS:"],
  [/(bộ vi xử lý|bộ xử lý|vi xử lý|bo xu ly|vi xu ly|chip xử lý)\s*[:：]/gi, "Processor:"],
  [/(card đồ họa|card đồ hoạ|card màn hình|đồ họa|đồ hoạ|card do hoa|vga)\s*[:：]/gi, "Graphics:"],
  [/(bộ nhớ|bo nho)\s*[:：]/gi, "Memory:"],
  [/(lưu trữ|ổ cứng|ổ đĩa|dung lượng|dung luong|o cung)\s*[:：]/gi, "Storage:"],
  [/(ghi chú|ghi chu|lưu ý)\s*[:：]/gi, "Notes:"],
];
const INLINE_LABEL = /\s*\b(Operating System|OS|Processor|CPU|Video RAM|Video Memory|VRAM|System Memory|Memory|RAM|Graphics Card|Video Card|Graphics|GPU|DirectX|Storage|Hard Drive|Disk Space|Additional Notes|Notes|Network|Sound Card)\s*[:：]/gi;

export function parsePasted(text) {
  let t = String(text || "").normalize("NFC");
  for (const [re, to] of VI_LABELS) t = t.replace(re, to);
  t = t.replace(INLINE_LABEL, "\n$1:");
  return parseReq(t.replace(/</g, " "));
}

// Tách khối dán có cả "Minimum" lẫn "Recommended" thành 2 phần
export function splitMinRec(text) {
  const t = String(text || "").normalize("NFC");
  // Tiêu đề phải đứng đầu dòng hoặc có dấu ":" — tránh cắt nhầm câu kiểu "(đề xuất dùng SSD)"
  const H = "(recommended(?: requirements| specs| system requirements)?|cấu hình đề (?:xuất|nghị)|cấu hình khuyến nghị|đề xuất|đề nghị|khuyến nghị|khuyên dùng)";
  const m = new RegExp(`(?:^|\\n)[ \\t]*${H}[ \\t]*[:：]?|\\s${H}[ \\t]*[:：]`, "i").exec(t);
  return m ? [t.slice(0, m.index), t.slice(m.index + m[0].length)] : [t, ""];
}

// Gói gọn cho một game Steam (appdetails.data)
export function steamToGame(d) {
  const pc = d.pc_requirements && !Array.isArray(d.pc_requirements) ? d.pc_requirements : {};
  const min = parseReq(pc.minimum);
  const rec = parseReq(pc.recommended);
  return {
    id: "steam:" + d.steam_appid,
    appid: d.steam_appid,
    name: d.name,
    image: d.header_image || null,
    free: !!d.is_free,
    genres: (d.genres || []).map((g) => g.description).slice(0, 4),
    released: d.release_date && d.release_date.date || null,
    metacritic: d.metacritic && d.metacritic.score || null,
    min: min.empty ? null : min,
    rec: rec.empty ? null : rec,
    source: "Steam",
    sourceUrl: "https://store.steampowered.com/app/" + d.steam_appid,
  };
}
