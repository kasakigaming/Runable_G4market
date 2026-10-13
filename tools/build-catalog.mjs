// Tạo KHO GAME lớn cho trang web (không cần backend): data/catalog/
//   index.json  — [appid, tên, 1 nếu đã ngừng bán] của mọi game, xếp theo độ phổ biến → ô tìm kiếm dùng
//   sXX.json    — yêu cầu cấu hình đầy đủ, chia 64 mảnh theo appid % 64 → trang game chỉ tải 1 mảnh
//   skip.json   — appid đã tra mà không phải game / không ghi yêu cầu cấu hình (khỏi tra lại)
//
// Danh sách game lấy từ SteamSpy (xếp theo số người sở hữu, 1000 game mỗi trang) + game đang hot
// 2 tuần qua + bảng xếp hạng người chơi của Steam. Yêu cầu cấu hình lấy từ trang Steam của từng game.
//
// Chạy:   node tools/build-catalog.mjs                 (mặc định 5 trang SteamSpy ≈ 5000 game)
//         node tools/build-catalog.mjs --pages 10      (≈ 10000 game)
//         node tools/build-catalog.mjs --max 1500      (chỉ tra tối đa 1500 game trong lượt này)
//         node tools/build-catalog.mjs --pages 0 --retry-skipped --mark-delisted
//              (tra lại appid từng bị bỏ qua + đánh dấu game đã gỡ khỏi Steam cho cả kho)
// Chạy lại được bất cứ lúc nào: game đã có thì giữ, chỉ tra game mới hoặc dữ liệu cũ quá --days ngày.
// Game đã gỡ khỏi cửa hàng Steam vẫn còn trang appdetails (kèm yêu cầu cấu hình) nhưng ô tìm kiếm của
// Steam không trả về → kho này là chỗ duy nhất tìm được chúng theo tên.
// Steam cho khoảng 200 lượt tra / 5 phút → ~1,5 giây mỗi game.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { steamToGame } from "../shared/reqparse.js";

const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > 0 ? Number(process.argv[i + 1]) : def; };
const PAGES = arg("pages", 5), MAX = arg("max", Infinity), DAYS = arg("days", 90);
const RETRY_SKIPPED = process.argv.includes("--retry-skipped"), MARK_DELISTED = process.argv.includes("--mark-delisted");
const SHARDS = 64;
const DIR = new URL("../data/catalog/", import.meta.url);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = Math.floor(Date.now() / 86400000);
const SOFTWARE = /^(utilities|software training|animation & modeling|design & illustration|audio production|video production|photo editing|web publishing|game development|accounting|education)$/i;
const shardOf = (appid) => (appid % SHARDS).toString(16).padStart(2, "0");

// Đã gỡ khỏi cửa hàng? Chỉ hỏi api.steamcmd.net (bản sao dữ liệu PICS của Steam) khi trang không có giá,
// không miễn phí, không phải sắp ra — PICS ghi app_retired_publisher_request = "1" cho game đã gỡ.
async function retired(appid) {
  try {
    const r = await fetch(`https://api.steamcmd.net/v1/info/${appid}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return (await r.json())?.data?.[appid]?.common?.app_retired_publisher_request === "1";
  } catch { return null; }
}
async function isDelisted(d) {
  if (d.is_free || d.price_overview || d.release_date?.coming_soon) return false;
  return (await retired(d.steam_appid)) === true;
}

async function getJson(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let r;
    try { r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US" } }); }
    catch (e) { await sleep(5000); continue; }
    if (r.status === 429 || r.status === 403 || r.status >= 500) { await sleep(30000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  throw new Error("Steam chặn quá nhiều lần: " + url);
}

// ---- 1. Danh sách game, xếp theo độ phổ biến ----
const rank = new Map();   // appid → điểm phổ biến (càng nhỏ càng hot)
const put = (appid, score) => { appid = Number(appid); if (!rank.has(appid) || rank.get(appid) > score) rank.set(appid, score); };

const most = await getJson("https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/").catch(() => null);
(most?.response?.ranks || []).forEach((x) => put(x.appid, x.rank));                       // 1..100
const hot = await getJson("https://steamspy.com/api.php?request=top100in2weeks").catch(() => ({}));
Object.values(hot).sort((a, b) => b.ccu - a.ccu).forEach((x, i) => put(x.appid, 100 + i));  // 100..199
for (let p = 0; p < PAGES; p++) {
  const page = await getJson(`https://steamspy.com/api.php?request=all&page=${p}`).catch(() => ({}));
  // SteamSpy trả object nên JS tự xếp theo appid — xếp lại theo người sở hữu rồi người đang chơi
  const owners = (s) => Number(String(s || "0").split("..")[0].replace(/[^\d]/g, "")) || 0;
  Object.values(page).sort((a, b) => owners(b.owners) - owners(a.owners) || b.ccu - a.ccu)
    .forEach((x, i) => put(x.appid, 200 + p * 1000 + i));
  console.log(`SteamSpy trang ${p}: ${Object.keys(page).length} game`);
  await sleep(61000);   // SteamSpy cho 1 lượt "all" mỗi phút
}
console.log(`Danh sách: ${rank.size} appid`);

// ---- 2. Kho cũ (để chạy tiếp, không tra lại từ đầu) ----
mkdirSync(DIR, { recursive: true });
const readJson = (name, def) => existsSync(new URL(name, DIR)) ? JSON.parse(readFileSync(new URL(name, DIR), "utf8")) : def;
const games = new Map();
for (let s = 0; s < SHARDS; s++) for (const g of readJson(`s${shardOf(s)}.json`, { games: [] }).games) games.set(g.appid, g);
const skip = readJson("skip.json", {});
// Thứ tự phổ biến của lần chạy trước — để lượt chạy ít trang SteamSpy không làm xáo trộn mục lục
readJson("index.json", { games: [] }).games.forEach(([appid], i) => { if (!rank.has(appid)) rank.set(appid, 1e6 + i); });
if (RETRY_SKIPPED) for (const id of Object.keys(skip)) if (!rank.has(Number(id))) rank.set(Number(id), 2e6);
console.log(`Kho cũ: ${games.size} game, ${Object.keys(skip).length} appid bỏ qua`);

// ---- 3. Tra yêu cầu cấu hình từng game ----
const compact = (r) => {
  if (!r) return null;
  const o = {};
  for (const k of ["os", "cpu", "gpu", "ram", "vram", "disk", "diskText", "dx", "notes"]) if (r[k] != null) o[k] = r[k];
  return o;
};
const todo = [...rank.keys()].sort((a, b) => rank.get(a) - rank.get(b)).filter((id) => {
  const g = games.get(id);
  if (g) return today - (g.t || 0) > DAYS;
  return !(id in skip) || RETRY_SKIPPED || today - skip[id] > DAYS * 2;
}).slice(0, MAX);
console.log(`Cần tra: ${todo.length} game (~${Math.ceil(todo.length * 1.6 / 60)} phút)`);

let done = 0, added = 0;
const save = () => {
  const by = Array.from({ length: SHARDS }, () => []);
  for (const g of games.values()) by[g.appid % SHARDS].push(g);
  by.forEach((list, s) => writeFileSync(new URL(`s${shardOf(s)}.json`, DIR),
    JSON.stringify({ games: list.sort((a, b) => a.appid - b.appid) })));
  writeFileSync(new URL("skip.json", DIR), JSON.stringify(skip));
  // Mục lục: game trong danh sách phổ biến trước, rồi các game còn lại trong kho
  const order = [...games.keys()].sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
  writeFileSync(new URL("index.json", DIR), JSON.stringify({
    note: "Tạo bởi tools/build-catalog.mjs. Mỗi dòng: [appid, tên]. Chi tiết nằm ở s{appid % 64, hex 2 chữ số}.json",
    built: new Date().toISOString().slice(0, 10), shards: SHARDS,
    games: order.map((id) => (games.get(id).dl ? [id, games.get(id).name, 1] : [id, games.get(id).name])),
  }));
};

for (const id of todo) {
  try {
    const j = await getJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=us`);
    const entries = Object.values(j || {}).filter((e) => e && e.success && e.data);
    const d = (entries.find((e) => e.data.steam_appid === id) || entries[0] || {}).data;
    // Steam xếp cả phần mềm (Wallpaper Engine, RPG Maker...) vào loại "game" — loại theo thể loại
    const ok = d && d.type === "game" && d.platforms && d.platforms.windows
      && !(d.genres || []).some((x) => SOFTWARE.test(x.description));
    const g = ok ? steamToGame(d) : null;
    if (g && (g.min || g.rec)) {
      // appdetails có khi trả game gốc khi hỏi bản cũ (vd 730) — lưu theo appid thật của trang
      const rec = { appid: g.appid, name: g.name, image: g.image, free: g.free || undefined, genres: g.genres,
        released: g.released || undefined, min: compact(g.min), rec: compact(g.rec), t: today,
        dl: (await isDelisted(d)) ? 1 : 0 };
      if (!games.has(g.appid)) added++;
      games.set(g.appid, rec);
      if (g.appid !== id) { skip[id] = today; put(g.appid, rank.get(id)); }
    } else {
      skip[id] = today;
      games.delete(id);
    }
  } catch (e) {
    console.log(`  ${id}: ${e.message}`);
  }
  done++;
  if (done % 50 === 0) { save(); console.log(`  ${done}/${todo.length} — kho ${games.size} game (+${added})`); }
  await sleep(1500);
}
// Đánh dấu ngừng bán cho game trong kho chưa được kiểm tra (bản ghi từ lượt chạy cũ không có trường dl)
if (MARK_DELISTED) {
  const list = [...games.values()].filter((g) => g.dl === undefined);
  console.log(`Kiểm tra ngừng bán: ${list.length} game`);
  let i = 0, found = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < list.length) {
      const g = list[i++];
      const r = await retired(g.appid);
      if (r !== null) { g.dl = r ? 1 : 0; if (r) found++; }
      if (i % 200 === 0) { console.log(`  ${i}/${list.length} — ${found} game ngừng bán`); save(); }
      await sleep(250);
    }
  }));
  console.log(`Ngừng bán: ${found} game`);
}
save();
console.log(`Xong: kho có ${games.size} game (+${added} mới), bỏ qua ${Object.keys(skip).length} appid`);
