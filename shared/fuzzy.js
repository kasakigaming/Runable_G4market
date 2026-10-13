// So tên game kiểu người chơi hay gõ — dùng chung cho backend và trang web.
//   "gta 5"    → Grand Theft Auto V        (viết tắt chữ đầu + số ↔ số La Mã)
//   "rdr2"     → Red Dead Redemption 2     (chữ và số dính liền)
//   "cod bo3"  → Call of Duty: Black Ops III
//   "forza 5"  → Forza Horizon 5           (được bỏ qua chữ ở giữa)
//   "da"       → Dark Souls III            (đang gõ dở → khớp đầu chữ, game phổ biến lên trước)
//   "darksoul" → Dark Souls III            (gõ dính liền không cách)
// nameScore() trả về điểm (càng nhỏ càng khớp) hoặc Infinity nếu không khớp.

const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];
const toNum = (w) => (/^\d+$/.test(w) ? Number(w) : ROMAN.indexOf(w) > 0 ? ROMAN.indexOf(w) : null);

export const normName = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/[®™©'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// "rdr2" → ["rdr","2"] · "bo3" → ["bo","3"] · "gta" → ["gta"]; j = cả tên viết liền ("darksoulsiii")
const prep = (s) => { const t = normName(s).split(" ").flatMap((w) => w.match(/[a-z]+|\d+/g) || []); return { t, j: t.join("") }; };

function score(Q, W) {
  const q = Q.t, w = W.t;
  if (!q.length || !w.length) return Infinity;
  let i = 0, cost = 0;
  for (let k = 0; k < q.length; k++) {
    const t = q[k], last = k === q.length - 1;
    let hit = -1, span = 1, how = 0;
    for (let j = i; j < w.length && hit < 0; j++) {
      const n = toNum(t), m = toNum(w[j]);
      // Chữ cuối ngắn gõ trùng khít ("el") vẫn có thể đang gõ dở ("elden") → tính như khớp đầu chữ
      if (w[j] === t || (n != null && n === m)) { hit = j; how = last && n == null && t.length <= 3 ? 1 : 0; }
      // chữ cuối đang gõ dở → khớp đầu chữ; chữ giữa câu thì cần ≥ 3 ký tự mới tính là gõ dở
      else if (/^[a-z]/.test(t) && w[j].startsWith(t) && (last || t.length >= 3)) { hit = j; how = 1; }
      // viết tắt: mỗi chữ cái là chữ đầu của 1 từ liên tiếp ("gta", "cod", "rdr", "bo").
      // Gõ đúng 2 chữ cái một mình ("da", "cs") thường là đang gõ dở đầu tên → viết tắt xếp sau ("cs" → CS2D rồi mới Counter-Strike)
      else if (/^[a-z]{2,6}$/.test(t) && j + t.length <= w.length && [...t].every((c, x) => w[j + x][0] === c && /^[a-z]/.test(w[j + x]))) {
        hit = j; span = t.length; how = t.length === 2 && q.length === 1 ? 2 : 0.3;
      }
    }
    if (hit < 0) {
      // Gõ dính liền / thiếu dấu cách: so cả tên viết liền ("darksoul", "eldenring")
      if (Q.j.length >= 4 && W.j.startsWith(Q.j)) return 1.9;   // xếp sau khớp từng chữ ("dark s" → Dark Souls trước Darksiders)
      if (Q.j.length >= 5 && W.j.includes(Q.j)) return 2.5;
      return Infinity;
    }
    cost += (hit - i) * 1.5 + how;   // bỏ qua từ ở giữa thì bị trừ điểm
    i = hit + span;
  }
  // Thừa từ ở cuối chỉ bị trừ nhẹ (tối đa 0,5) — để "gta" vẫn ưu tiên GTA V phổ biến hơn GTA III tên ngắn hơn
  return cost + Math.min(0.5, (w.length - i) * 0.15) + (q.length === 1 && w.length > 3 ? 0.2 : 0);
}

export const nameScore = (query, name) => score(prep(query), prep(name));

// Lọc + xếp danh sách [{name,...}] theo độ khớp; cùng mức giữ nguyên thứ tự (danh sách đã xếp theo độ phổ biến).
// Chữ của từng tên được tách sẵn 1 lần (lưu ở x._fz) → mỗi phím gõ quét ~10.000 tên chỉ vài mili-giây.
export function fuzzyFind(query, list, limit = 8, getName = (x) => x.name) {
  const Q = prep(query);
  if (!Q.t.length) return [];
  const out = [];
  for (const x of list) {
    const s = score(Q, x._fz || (x._fz = prep(getName(x))));
    if (s < Infinity) out.push({ x, s });
  }
  // Làm tròn điểm để game phổ biến hơn (đứng trước trong danh sách) không bị game ít người chơi khớp "đẹp" hơn chút đè lên
  return out.sort((a, b) => Math.floor(a.s) - Math.floor(b.s)).slice(0, limit).map((o) => o.x);
}
