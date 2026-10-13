// So tên game kiểu người chơi hay gõ — dùng chung cho backend và trang web.
//   "gta 5"   → Grand Theft Auto V        (viết tắt chữ đầu + số ↔ số La Mã)
//   "rdr2"    → Red Dead Redemption 2     (chữ và số dính liền)
//   "cod bo3" → Call of Duty: Black Ops III
//   "forza 5" → Forza Horizon 5           (được bỏ qua chữ ở giữa)
// nameScore() trả về điểm (càng nhỏ càng khớp) hoặc Infinity nếu không khớp.

const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];
const toNum = (w) => (/^\d+$/.test(w) ? Number(w) : ROMAN.indexOf(w) > 0 ? ROMAN.indexOf(w) : null);

export const normName = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/[®™©'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// "rdr2" → ["rdr","2"] · "bo3" → ["bo","3"] · "gta" → ["gta"]
const tokens = (s) => normName(s).split(" ").flatMap((w) => w.match(/[a-z]+|\d+/g) || []);

export function nameScore(query, name) {
  const q = tokens(query), w = tokens(name);
  if (!q.length || !w.length) return Infinity;
  let i = 0, cost = 0;
  for (let k = 0; k < q.length; k++) {
    const t = q[k], last = k === q.length - 1;
    let hit = -1, span = 1, how = 0;
    for (let j = i; j < w.length && hit < 0; j++) {
      const n = toNum(t), m = toNum(w[j]);
      if (w[j] === t || (n != null && n === m)) { hit = j; how = 0; }
      // chữ cuối đang gõ dở → khớp đầu chữ; chữ giữa câu thì cần ≥ 3 ký tự mới tính là gõ dở
      else if (/^[a-z]/.test(t) && w[j].startsWith(t) && (last || t.length >= 3)) { hit = j; how = 1; }
      // viết tắt: mỗi chữ cái là chữ đầu của 1 từ liên tiếp ("gta", "cod", "rdr", "bo")
      else if (/^[a-z]{2,6}$/.test(t) && j + t.length <= w.length && [...t].every((c, x) => w[j + x][0] === c && /^[a-z]/.test(w[j + x]))) {
        hit = j; span = t.length; how = 0.3;
      }
    }
    if (hit < 0) return Infinity;
    cost += (hit - i) * 1.5 + how;   // bỏ qua từ ở giữa thì bị trừ điểm
    i = hit + span;
  }
  // Thừa từ ở cuối chỉ bị trừ nhẹ (tối đa 0,5) — để "gta" vẫn ưu tiên GTA V phổ biến hơn GTA III tên ngắn hơn
  return cost + Math.min(0.5, (w.length - i) * 0.15) + (q.length === 1 && w.length > 3 ? 0.2 : 0);
}

// Lọc + xếp danh sách [{name,...}] theo nameScore; cùng điểm giữ nguyên thứ tự (danh sách đã xếp theo độ phổ biến)
export function fuzzyFind(query, list, limit = 8, getName = (x) => x.name) {
  const out = [];
  for (const x of list) {
    const s = nameScore(query, getName(x));
    if (s < Infinity) out.push({ x, s });
  }
  // Làm tròn điểm để game phổ biến hơn (đứng trước trong danh sách) không bị game ít người chơi khớp "đẹp" hơn chút đè lên
  return out.sort((a, b) => Math.floor(a.s) - Math.floor(b.s)).slice(0, limit).map((o) => o.x);
}
