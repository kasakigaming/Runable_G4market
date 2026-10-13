// Tạo DANH SÁCH TÊN game Steam cho backend: data/steam-index.json = [[appid, tên], ...] xếp theo độ phổ biến.
//
// Vì sao cần: ô tìm kiếm của Steam (cả cửa hàng lẫn Community) không trả game đã gỡ khỏi cửa hàng
// (Spec Ops: The Line, Forza Horizon 4…) và không hiểu gõ tắt ("rdr2", "cod bo3"); API lấy toàn bộ
// danh sách app của Steam đã bị tắt. Danh sách tên này là cách duy nhất đổi "tên gõ" → appid.
// Chỉ lưu tên — yêu cầu cấu hình backend tra ngay lúc người dùng mở đúng 1 game.
//
// Nguồn: SteamSpy (1000 game mỗi trang, xếp theo số người sở hữu, gồm cả game đã gỡ)
//        + game đang hot 2 tuần + bảng xếp hạng người chơi của Steam. Không gọi Steam cho từng game.
// Chạy:  node tools/build-index.mjs              (10 trang ≈ 10.000 game, ~10 phút vì SteamSpy cho 1 trang/phút)
//        node tools/build-index.mjs --pages 20

import { writeFileSync } from "node:fs";

const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > 0 ? Number(process.argv[i + 1]) : def; };
const PAGES = arg("pages", 10);
const OUT = new URL("../data/steam-index.json", import.meta.url);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(90000) });
      if (r.ok) return await r.json();
    } catch { /* thử lại */ }
    await sleep(20000 * (attempt + 1));
  }
  throw new Error("không tải được " + url);
}

const rank = new Map();   // appid → [điểm phổ biến, tên]
const put = (appid, score, name) => {
  appid = Number(appid);
  const old = rank.get(appid);
  if (!old || old[0] > score) rank.set(appid, [score, name || (old && old[1])]);
};
// Kết quả lẫn phần mềm / công cụ — bỏ những cái tên rõ ràng không phải game
const NOT_GAME = /soundtrack|\bost\b|dedicated server|\bsdk\b|wallpaper engine|benchmark|playtest/i;

const most = await getJson("https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/").catch(() => null);
const top = (most?.response?.ranks || []).map((x) => x.appid);
const hot = await getJson("https://steamspy.com/api.php?request=top100in2weeks").catch(() => ({}));
Object.values(hot).sort((a, b) => b.ccu - a.ccu).forEach((x, i) => put(x.appid, 100 + i, x.name));

const owners = (s) => Number(String(s || "0").split("..")[0].replace(/[^\d]/g, "")) || 0;
for (let p = 0; p < PAGES; p++) {
  const page = await getJson(`https://steamspy.com/api.php?request=all&page=${p}`).catch(() => ({}));
  // SteamSpy trả object nên JS tự xếp theo appid — xếp lại theo người sở hữu rồi người đang chơi
  Object.values(page).sort((a, b) => owners(b.owners) - owners(a.owners) || b.ccu - a.ccu)
    .forEach((x, i) => put(x.appid, 200 + p * 1000 + i, x.name));
  console.log(`SteamSpy trang ${p}: ${Object.keys(page).length} game`);
  if (p < PAGES - 1) await sleep(61000);   // SteamSpy cho 1 lượt "all" mỗi phút
}
// Bảng xếp hạng người chơi của Steam không kèm tên → chỉ đẩy hạng những game đã có tên
top.forEach((appid, i) => { if (rank.has(appid)) put(appid, i, null); });

// SteamSpy hay giữ tên cũ (730 vẫn là "Counter-Strike: Global Offensive") và lẫn phần mềm.
// Hỏi Steam (IStoreBrowseService/GetItems, 100 appid mỗi lượt, có cả game đã gỡ khỏi cửa hàng):
// lấy tên hiện tại, chỉ giữ loại 0 = game (6 = phần mềm, 4 = DLC, 11 = nhạc nền…).
const ids = [...rank.keys()];
let checked = 0;
for (let i = 0; i < ids.length; i += 100) {
  const input = { ids: ids.slice(i, i + 100).map((appid) => ({ appid })), context: { language: "english", country_code: "US" }, data_request: {} };
  const j = await getJson("https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=" + encodeURIComponent(JSON.stringify(input))).catch(() => null);
  for (const it of j?.response?.store_items || []) {
    const cur = rank.get(it.appid);
    if (!cur || it.success !== 1) continue;
    checked++;
    if (it.type !== 0) rank.delete(it.appid);
    else if (it.name) cur[1] = it.name;
  }
  await sleep(400);
}
console.log(`Steam xác nhận ${checked} appid, còn ${rank.size} game`);

const games = [...rank.entries()]
  .filter(([, [, name]]) => name && !NOT_GAME.test(name))
  .sort((a, b) => a[1][0] - b[1][0])
  .map(([appid, [, name]]) => [appid, String(name).replace(/[®™]/g, "").trim()]);
writeFileSync(OUT, JSON.stringify({
  note: "Tạo bởi tools/build-index.mjs. Mỗi dòng: [appid, tên], xếp theo độ phổ biến. Chỉ để đổi tên gõ → appid; yêu cầu cấu hình backend tra khi mở game.",
  built: new Date().toISOString().slice(0, 10),
  games,
}));
console.log(`Xong: ${games.length} game → data/steam-index.json`);
