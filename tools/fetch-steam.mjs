// Lấy yêu cầu cấu hình CHÍNH THỨC của các game phổ biến từ Steam → data/steam-popular.json
// Chạy lại toàn bộ:     node tools/fetch-steam.mjs
// Thêm vài game:        node tools/fetch-steam.mjs --add 2357570 "Hades II"   (appid hoặc tên)
// Dữ liệu này để trang chạy được ngay cả khi chưa có backend; backend sẽ tra thêm mọi game khác.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { steamToGame } from "../shared/reqparse.js";

const ADD_MODE = process.argv[2] === "--add";
const DEFAULT_NAMES = [
  "Counter-Strike 2", "Dota 2", "PUBG: BATTLEGROUNDS", "Apex Legends", "Grand Theft Auto V",
  "ELDEN RING", "Cyberpunk 2077", "Red Dead Redemption 2", "Black Myth: Wukong", "Baldur's Gate 3",
  "Hogwarts Legacy", "The Witcher 3: Wild Hunt", "NARAKA: BLADEPOINT", "Delta Force", "Marvel Rivals",
  "Monster Hunter Wilds", "Palworld", "EA SPORTS FC 26", "Rust", "Stardew Valley",
  "Terraria", "Sekiro: Shadows Die Twice", "God of War Ragnarök", "Ghost of Tsushima", "Marvel's Spider-Man 2",
  "Forza Horizon 5", "Resident Evil 4", "Dying Light 2", "Call of Duty", "Battlefield 6",
  "Rainbow Six Siege", 2357570 /* Overwatch — Steam đã đổi tên */, "Wuthering Waves", "Path of Exile 2", "HELLDIVERS 2",
  "Phasmophobia", "Euro Truck Simulator 2", "Assassin's Creed Shadows", "SILENT HILL 2", "Kingdom Come: Deliverance II",
  "Split Fiction", "It Takes Two", "Valheim", "Sons Of The Forest", "Once Human",
  "THE FINALS", "Street Fighter 6", "TEKKEN 8", "Dead by Daylight", "Warframe",
  "War Thunder", "Lethal Company", "Hollow Knight: Silksong", "Clair Obscur: Expedition 33", "The Elder Scrolls V: Skyrim Special Edition",
  "Fallout 4", "Left 4 Dead 2", "Team Fortress 2", "Among Us", "Cities: Skylines II",
  "FINAL FANTASY VII REBIRTH", "Stellar Blade", "Where Winds Meet", "Dune: Awakening", "Deadlock",
];

const NAMES = ADD_MODE
  ? process.argv.slice(3).map((a) => (/^\d+$/.test(a) ? Number(a) : a))
  : DEFAULT_NAMES;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US" } });
    if (r.status === 429) { await sleep(8000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  throw new Error("rate limited");
}

// Kết quả tìm kiếm hay lẫn DLC, soundtrack, gói nâng cấp — đẩy chúng xuống cuối
const JUNK = /soundtrack|\bost\b|\bdlc\b|\bpack\b|season pass|\bpass\b|bundle|upgrade|skin|coins?|points|demo|artbook|expansion/i;

async function findCandidates(name) {
  const j = await getJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=english&cc=us`);
  const items = (j.items || []).filter((i) => i.type === "app");
  const q = norm(name);
  const score = (i) => {
    const n = norm(i.name);
    return (JUNK.test(i.name) ? 100 : 0) + (n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3);
  };
  return items.sort((a, b) => score(a) - score(b)).slice(0, 4).map((i) => i.id);
}

const OUT_FILE = new URL("../data/steam-popular.json", import.meta.url);
const out = ADD_MODE && existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, "utf8")).games : [];
const missed = [];
for (const name of NAMES) {
  try {
    // Số = appid dùng thẳng; chữ = tìm theo tên
    const ids = typeof name === "number" ? [name] : await findCandidates(name);
    await sleep(900);
    if (!ids.length) { missed.push(name + " (không tìm thấy)"); continue; }
    let g = null;
    // Thử lần lượt từng ứng viên đến khi gặp đúng GAME có ghi yêu cầu cấu hình
    for (const id of ids) {
      const j = await getJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=us`);
      await sleep(1300);
      // Steam giờ trả dữ liệu dưới một khoá KHÁC appid (vd hỏi 730 → khoá "2678630"),
      // nên lấy phần tử có steam_appid khớp, hoặc phần tử đầu tiên
      const entries = Object.values(j || {}).filter((e) => e && e.success && e.data);
      const hit = entries.find((e) => e.data.steam_appid === id) || entries[0];
      const d = hit ? hit.data : null;
      if (!d || d.type !== "game") continue;
      const cand = steamToGame(d);
      if (cand.min || cand.rec) { g = cand; break; }
    }
    if (!g) { missed.push(name + " (không có bản game ghi yêu cầu)"); continue; }
    if (out.some((x) => x.appid === g.appid)) continue;
    out.push(g);
    console.log("✓", g.name.padEnd(42), "| min GPU:", (g.min && g.min.gpu || "-").slice(0, 60));
  } catch (e) {
    missed.push(name + " (" + e.message + ")");
    await sleep(3000);
  }
}

mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
writeFileSync(OUT_FILE,
  JSON.stringify({ fetched: new Date().toISOString(), source: "Steam Store API", games: out }, null, 1));
console.log(`\nXong: ${out.length} game. Thiếu ${missed.length}:`);
for (const m of missed) console.log("  -", m);
