// ============================================================================
// RunableGames — Backend (Deno Deploy)
// Việc của backend:
//   1. Tra yêu cầu cấu hình của MỌI game trên Steam (trình duyệt không tự gọi Steam được vì
//      Steam không bật CORS) + danh sách game ngoài Steam (Valorant, LMHT, Genshin...).
//   2. Nhận kết quả quét từ web và từ app runable_g4market.exe (POST /api/check).
//   3. Nối kết quả app về đúng tab web đang chờ (phiên chờ theo IP).
//   4. Đếm điểm mọi máy đã kiểm tra → xếp hạng "mạnh hơn X% người chơi".
//   5. Đếm lượt check từng game → "Top game được check nhiều nhất".
// Không cần secret nào. Dữ liệu lưu ở Deno KV (Deno Deploy → Databases → gắn 1 KV database).
// Env tuỳ chọn: ALLOWED_ORIGINS = "https://clonetest222.github.io,https://evogaming.web.app"
// ============================================================================

import { steamToGame, splitAlts } from "../shared/reqparse.js";
import offsteam from "../data/games-offsteam.json" with { type: "json" };
import { searchEpic, searchMs, searchGog, getEpic, getMs, getGog, type Hit } from "./stores.ts";
import { nameScore, fuzzyFind } from "../shared/fuzzy.js";

// Danh sách tên game Steam (data/steam-index.json, tools/build-index.mjs): [appid, tên] xếp theo độ phổ biến.
// Ô tìm kiếm của Steam không trả game đã gỡ khỏi cửa hàng và không hiểu gõ tắt ("rdr2", "gta 5" → cả bản
// Legacy) — danh sách này đổi tên gõ → appid. Chỉ có tên; yêu cầu cấu hình tra khi mở đúng 1 game.
// Workflow hằng tuần làm mới file trên GitHub → backend tự tải lại mỗi ngày, không cần deploy lại.
const INDEX_URL = "https://raw.githubusercontent.com/kasakigaming/Runable_G4market/refs/heads/main/data/steam-index.json";
let CATALOG: Array<{ appid: number; name: string }> = [];
const useIndex = (j: { games?: Array<[number, string]> }) => {
  if (Array.isArray(j.games) && j.games.length > 1000) CATALOG = j.games.map(([appid, name]) => ({ appid, name }));
};
try { useIndex(JSON.parse(await Deno.readTextFile(new URL("../data/steam-index.json", import.meta.url)))); } catch { /* chưa có file */ }
async function refreshIndex() {
  try {
    const r = await fetch(INDEX_URL, { signal: AbortSignal.timeout(20000) });
    if (r.ok) useIndex(await r.json());
  } catch { /* giữ danh sách đang có */ }
}
refreshIndex();
setInterval(refreshIndex, 24 * 3600e3);

const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map((s) => s.trim()).filter(Boolean);
const STEAM_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// ---- Lưu trữ: Deno KV, không có thì tạm dùng bộ nhớ (mất khi khởi động lại) ----
let kv: Deno.Kv | null = null;
try { kv = await Deno.openKv(); } catch { kv = null; }
const mem = new Map<string, { v: unknown; exp: number }>();

async function kget<T>(key: Deno.KvKey): Promise<T | null> {
  if (kv) return (await kv.get<T>(key)).value;
  const e = mem.get(JSON.stringify(key));
  if (!e || (e.exp && e.exp < Date.now())) return null;
  return e.v as T;
}
async function kset(key: Deno.KvKey, v: unknown, ttlMs = 0) {
  if (kv) { await kv.set(key, v, ttlMs ? { expireIn: ttlMs } : undefined); return; }
  mem.set(JSON.stringify(key), { v, exp: ttlMs ? Date.now() + ttlMs : 0 });
}
async function kinc(key: Deno.KvKey, by = 1) {
  if (kv) { await kv.atomic().sum(key, BigInt(by)).commit(); return; }
  const k = JSON.stringify(key);
  const cur = (mem.get(k)?.v as bigint) ?? 0n;
  mem.set(k, { v: cur + BigInt(by), exp: 0 });
}
async function kcount(key: Deno.KvKey): Promise<number> {
  const v = await kget<Deno.KvU64 | bigint>(key);
  if (v == null) return 0;
  return Number(typeof v === "bigint" ? v : (v as Deno.KvU64).value);
}
async function klist(prefix: Deno.KvKey, limit = 5000): Promise<Array<{ key: Deno.KvKey; value: unknown }>> {
  if (kv) {
    const out = [];
    for await (const e of kv.list({ prefix }, { limit })) out.push({ key: e.key, value: e.value });
    return out;
  }
  const p = JSON.stringify(prefix).slice(0, -1);
  return [...mem.entries()].filter(([k]) => k.startsWith(p)).map(([k, e]) => ({ key: JSON.parse(k), value: e.v }));
}

// ---- Tiện ích HTTP ----
function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  const allow = ORIGINS.includes("*") ? "*" : (ORIGINS.includes(o) ? o : ORIGINS[0] || "");
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "origin",
  };
}
const json = (req: Request, o: unknown, s = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...cors(req), ...extra } });

function clientIp(req: Request, info?: Deno.ServeHandlerInfo): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || (info?.remoteAddr as Deno.NetAddr | undefined)?.hostname || "unknown";
}

// Rate limit theo IP
const memHits = new Map<string, number>();
async function allow(ip: string, max: number, windowSec: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  if (kv) {
    const key = ["rl", ip, bucket];
    const cur = (await kv.get<Deno.KvU64>(key)).value?.value ?? 0n;
    if (cur >= BigInt(max)) return false;
    await kv.set(key, new Deno.KvU64(cur + 1n), { expireIn: windowSec * 1000 });
    return true;
  }
  const k = `${ip}:${bucket}`;
  const cur = memHits.get(k) ?? 0;
  if (cur >= max) return false;
  memHits.set(k, cur + 1);
  if (memHits.size > 5000) for (const x of memHits.keys()) if (!x.endsWith(`:${bucket}`)) memHits.delete(x);
  return true;
}

// ---- Steam ----
async function steamJson(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: { "user-agent": STEAM_UA, "accept-language": "en-US" } });
  if (!r.ok) throw new Error("steam " + r.status);
  return r.json();
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();

type OffGame = { id: string; name: string; alias?: string[]; [k: string]: unknown };
const OFF: OffGame[] = (offsteam as { games: OffGame[] }).games.map((g) => {
  for (const k of ["min", "rec", "high"]) {
    const r = g[k] as Record<string, unknown> | null;
    if (r) { r.cpuAlts = splitAlts(r.cpu as string); r.gpuAlts = splitAlts(r.gpu as string); }
  }
  return g;
});

const SEARCH_JUNK = /soundtrack|\bost\b|\bdlc\b|season pass|upgrade|\bdemo\b|artbook|benchmark tool|wallpaper|\bskin\b|costume|\bbundle\b/i;

// Tìm cùng lúc trên Steam, Epic, Microsoft Store, GOG. Game có ở nhiều kho chỉ giữ 1 dòng
// (ưu tiên Steam → Epic → Microsoft → GOG); tên khớp đầu chuỗi gõ được xếp lên trước.
async function searchGames(q: string) {
  const nq = norm(q);
  const off = OFF.filter((g) => nameScore(q, g.name) < Infinity || (g.alias || []).some((a) => norm(a).includes(nq) || nq.includes(norm(a))))
    .map((g) => ({ id: g.id, name: g.name, image: null, source: g.source }));
  // Gõ thẳng appid (vd 241560) → mở đúng game đó, kể cả game đã gỡ khỏi cửa hàng
  if (/^\d{2,8}$/.test(q.trim())) {
    const g = await getGame("steam:" + q.trim()).catch(() => null) as Record<string, unknown> | null;
    if (g) return [{ id: g.id, name: g.name, image: g.image, source: g.delisted ? "Steam · ngừng bán" : "Steam" }];
  }
  const [steam, others] = await Promise.all([searchSteam(q, nq).catch(() => [] as Hit[]), searchOtherStores(q, nq)]);
  // Danh sách tên có cả game đã gỡ khỏi Steam — ô tìm kiếm của Steam không bao giờ trả những game này
  const popular: Hit[] = fuzzyFind(q, CATALOG, 6).map((g) => ({ id: "steam:" + g.appid, name: g.name, source: "Steam",
    image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.appid}/capsule_231x87.jpg` }));
  const key = (n: string) => norm(n).replace(EDITION_WORDS, "").replace(/ /g, "");
  const seen = new Set(off.map((g) => key(g.name)));
  const all: Array<Hit & { dlc?: boolean }> = [];
  for (const h of [...popular, ...steam, ...others] as Array<Hit & { dlc?: boolean }>) {
    const k = key(h.name);
    if (!k || seen.has(k)) continue;
    seen.add(k); all.push(h);
  }
  // Xếp theo độ khớp tên (hiểu viết tắt, số La Mã); cùng mức thì giữ thứ tự: kho phổ biến → Steam → kho khác
  const score = (n: string) => Math.min(9, Math.floor(nameScore(q, n)));
  all.sort((a, b) => score(a.name) - score(b.name));
  return [...off, ...all].slice(0, 15);
}
const EDITION_WORDS = /\b(standard|deluxe|premium|ultimate|gold|complete|definitive|edition|for pc|pc|windows)\b/g;

async function searchOtherStores(q: string, nq: string): Promise<Hit[]> {
  const ck = ["search-stores3", nq];
  const cached = await kget<Hit[]>(ck);
  if (cached) return cached;
  const lists = await Promise.allSettled([searchEpic(q), searchMs(q), searchGog(q)]);
  const words = nq.split(" ").filter((w) => !STOP.has(w));
  const out = lists.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    // Tên phải khớp phần lớn các chữ đã gõ ("forza horizon 5" không kéo theo "Gears 5")
    .filter((h) => {
      if (SEARCH_JUNK.test(h.name)) return false;
      if (nameScore(q, h.name) < Infinity) return true;
      const name = norm(h.name).split(" ");
      return words.filter((t) => name.some((w) => w.startsWith(t))).length >= Math.ceil(words.length * 0.6);
    });
  // Chỉ lưu khi cả 3 kho đều trả lời — kho nào lỗi tạm thời thì lần sau tra lại
  if (lists.every((r) => r.status === "fulfilled")) await kset(ck, out, 24 * 3600e3);
  return out;
}

async function searchSteam(q: string, nq: string): Promise<Hit[]> {
  const ck = ["search2", nq];
  let steam = await kget<unknown[]>(ck);
  if (!steam) {
    const j = await steamJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=us`) as { items?: Array<Record<string, unknown>> };
    const items = (j.items || []).filter((i) => i.type === "app");
    const kinds = await steamKinds(items.map((i) => Number(i.id)));
    steam = items.filter((i) => {
      const k = kinds?.get(Number(i.id));
      // Không hỏi được loại → đoán theo tên như cũ
      if (!k) return !SEARCH_JUNK.test(String(i.name));
      if (k.type === 0) return true;
      // DLC chỉ hiện khi người dùng gõ đủ phần tên riêng của nó ("iceborne", "shadow of the erdtree")
      if (k.type === 4) return dlcWanted(nq, String(i.name), k.parentName);
      return false;   // nhạc nền, demo, video, phần mềm…
    }).slice(0, 12).map((i) => ({
      id: "steam:" + i.id, appid: i.id, name: i.name, image: i.tiny_image || null, source: "Steam",
      ...(kinds?.get(Number(i.id))?.type === 4 ? { dlc: true } : {}),
    }));
    await kset(ck, steam, 24 * 3600e3);
  }
  return steam as Hit[];
}

// Loại của từng appid trên Steam (0 game, 4 DLC, 11 nhạc nền…) + tên game gốc của DLC — 1–2 lượt gọi cho cả trang kết quả
async function steamKinds(ids: number[]): Promise<Map<number, { type: number; parentName?: string }> | null> {
  const get = async (list: number[]) => {
    const input = { ids: list.map((appid) => ({ appid })), context: { language: "english", country_code: "US" },
      data_request: { include_basic_info: true, include_related_items: true } };
    const j = await steamJson("https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=" + encodeURIComponent(JSON.stringify(input))) as
      { response?: { store_items?: Array<{ appid: number; type?: number; name?: string; related_items?: { parent_appid?: number } }> } };
    return j.response?.store_items || [];
  };
  try {
    if (!ids.length) return new Map();
    const got = await get(ids);
    const out = new Map(got.map((x) => [x.appid, { type: x.type ?? 0, parent: x.related_items?.parent_appid, name: x.name }]));
    const missing = [...new Set(got.map((x) => x.related_items?.parent_appid).filter((p): p is number => !!p && !out.has(p)))];
    const parents = new Map((missing.length ? await get(missing) : []).map((x) => [x.appid, x.name]));
    return new Map([...out].map(([id, x]) => [id, { type: x.type, parentName: x.parent ? (out.get(x.parent)?.name || parents.get(x.parent)) : undefined }]));
  } catch {
    return null;
  }
}

const STOP = new Set(["the", "of", "a", "an", "and", "edition", "dlc", "pack", "expansion"]);
function dlcWanted(nq: string, dlcName: string, parentName?: string): boolean {
  const base = new Set(norm(parentName || "").split(" "));
  const own = norm(dlcName).split(" ").filter((w) => w && !base.has(w) && !STOP.has(w));
  if (!own.length) return false;
  const typed = nq.split(" ");
  const last = typed[typed.length - 1];
  // Mọi chữ riêng của DLC đều phải có trong ô tìm; chữ cuối đang gõ dở thì khớp đầu chữ là đủ
  return own.every((w) => typed.includes(w) || (last.length >= 3 && w.startsWith(last)));
}

async function getGame(id: string) {
  if (id.startsWith("x:")) return OFF.find((g) => g.id === id) || null;
  const store = /^(epic|ms|gog):([0-9A-Za-z]{5,40})$/.exec(id);
  if (store) {
    const ck = ["game", id];
    const cached = await kget<unknown>(ck);
    if (cached) return cached;
    const g = store[1] === "epic" ? await getEpic(store[2]) : store[1] === "ms" ? await getMs(store[2]) : await getGog(store[2]);
    if (g) await kset(ck, g, 7 * 24 * 3600e3);
    return g;
  }
  const m =/^steam:(\d{1,9})$/.exec(id);
  if (!m) return null;
  const appid = Number(m[1]);
  const ck = ["game", appid];
  const cached = await kget<unknown>(ck);
  if (cached) return cached;
  const j = await steamJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=english&cc=us`) as Record<string, { success?: boolean; data?: Record<string, unknown> }>;
  // Steam đôi khi trả dữ liệu dưới một khoá KHÁC appid được hỏi
  const entries = Object.values(j || {}).filter((e) => e && e.success && e.data);
  const hit = entries.find((e) => e.data!.steam_appid === appid) || entries[0];
  if (!hit) return null;
  const g = steamToGame(hit.data) as Record<string, unknown>;
  if (await isDelisted(hit.data!)) g.delisted = true;
  await kset(ck, g, 7 * 24 * 3600e3);
  return g;
}

// Game đã gỡ khỏi cửa hàng Steam: trang appdetails vẫn còn (kèm yêu cầu cấu hình) nhưng không bán.
// Chỉ hỏi api.steamcmd.net (bản sao dữ liệu PICS của Steam) khi trang không có giá, không miễn phí
// và không phải game sắp ra — PICS ghi app_retired_publisher_request = "1" cho game đã gỡ.
async function isDelisted(d: Record<string, any>): Promise<boolean> {
  if (d.is_free || d.price_overview || d.release_date?.coming_soon) return false;
  try {
    const r = await fetch(`https://api.steamcmd.net/v1/info/${d.steam_appid}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return false;
    const a = (await r.json())?.data?.[d.steam_appid];
    return a?.common?.app_retired_publisher_request === "1";
  } catch {
    return false;
  }
}

// ---- Xếp hạng máy ----
const BUCKET = 4000, NBUCKETS = 50;   // mỗi cột 4.000 điểm, 0 → 200.000

async function histogram(): Promise<number[]> {
  const h = new Array(NBUCKETS).fill(0);
  for (const e of await klist(["hist"], 200)) {
    const b = Number(e.key[1]);
    const v = e.value as Deno.KvU64 | bigint;
    if (b >= 0 && b < NBUCKETS) h[b] = Number(typeof v === "bigint" ? v : (v as Deno.KvU64).value);
  }
  return h;
}
function percentileOf(h: number[], power: number): number {
  const total = h.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const b = Math.min(NBUCKETS - 1, Math.floor(power / BUCKET));
  let below = 0;
  for (let i = 0; i < b; i++) below += h[i];
  return Math.round(((below + h[b] / 2) / total) * 100);
}

// ---- Top game được check ----
let topCache: { at: number; data: unknown[] } | null = null;
async function topGames(limit: number) {
  if (topCache && Date.now() - topCache.at < 10 * 60e3) return topCache.data.slice(0, limit);
  const rows = [];
  for (const e of await klist(["cnt"], 5000)) {
    const id = String(e.key[1]);
    const v = e.value as Deno.KvU64 | bigint;
    rows.push({ id, count: Number(typeof v === "bigint" ? v : (v as Deno.KvU64).value) });
  }
  rows.sort((a, b) => b.count - a.count);
  const top = [];
  for (const r of rows.slice(0, 30)) {
    const meta = await kget<{ name: string; image: string | null }>(["meta", r.id]);
    if (meta) top.push({ ...r, ...meta });
  }
  topCache = { at: Date.now(), data: top };
  return top.slice(0, limit);
}

const num = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};
const str = (v: unknown, max = 120) => (typeof v === "string" ? v.slice(0, max) : null);
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

Deno.serve(async (req, info) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const qs = url.searchParams;

  try {
    if (p === "/health") return json(req, { ok: true, kv: !!kv });

    const ip = clientIp(req, info);
    const heavy = p === "/api/search" || p === "/api/game";
    if (!(await allow(ip, heavy ? 60 : 120, 60))) return json(req, { error: "rate_limited" }, 429);

    // ---------- Tìm game ----------
    if (p === "/api/search" && req.method === "GET") {
      const q = (qs.get("q") || "").trim().slice(0, 60);
      if (q.length < 2) return json(req, []);
      return json(req, await searchGames(q), 200, { "cache-control": "public, max-age=600" });
    }

    // ---------- Yêu cầu cấu hình 1 game (+ đếm lượt check) ----------
    if (p === "/api/game" && req.method === "GET") {
      const id = (qs.get("id") || "").slice(0, 40);
      const g = await getGame(id) as Record<string, unknown> | null;
      if (!g) return json(req, { error: "not_found" }, 404);
      if (qs.get("count") !== "0") {
        await kinc(["cnt", id]);
        await kset(["meta", id], { name: g.name, image: g.image || null });
      }
      return json(req, g, 200, { "cache-control": "public, max-age=300" });
    }

    // ---------- Top game được check nhiều nhất ----------
    if (p === "/api/top" && req.method === "GET") {
      return json(req, await topGames(num(qs.get("limit"), 1, 30) || 10), 200, { "cache-control": "public, max-age=120" });
    }

    // ---------- Web đăng ký phiên chờ kết quả từ app ----------
    if (p === "/api/session" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      const sid = rid();
      await kset(["sess", sid], { status: "waiting", ip, gpu: str(b.gpu, 80), at: Date.now() }, 30 * 60e3);
      await kset(["sess_ip", ip], sid, 30 * 60e3);
      return json(req, { sid });
    }
    if (p === "/api/session" && req.method === "GET") {
      const s = await kget<Record<string, unknown>>(["sess", (qs.get("sid") || "").slice(0, 20)]);
      if (!s) return json(req, { status: "expired" });
      return json(req, { status: s.status, checkId: s.checkId || null, runningAt: s.runningAt || null });
    }

    // ---------- App vừa mở: web chuyển từ "đang chờ" sang "đang kiểm tra" ----------
    // (mã phiên app đọc từ chính tên file tải về: "runable_g4market (<sid>).exe")
    if (p === "/api/ping" && req.method === "POST") {
      const b = await req.json().catch(() => ({})) as Record<string, unknown>;
      const sid = typeof b.sid === "string" && b.sid ? b.sid.slice(0, 20) : await kget<string>(["sess_ip", ip]);
      if (sid) {
        const s = await kget<Record<string, unknown>>(["sess", sid]);
        if (s && s.status === "waiting") await kset(["sess", sid], { ...s, status: "running", runningAt: Date.now() }, 30 * 60e3);
      }
      return json(req, { ok: true });
    }

    // ---------- Nhận kết quả quét (web hoặc app) ----------
    if (p === "/api/check" && req.method === "POST") {
      const b = await req.json().catch(() => ({})) as Record<string, unknown>;
      const source = b.source === "app" ? "app" : "web";
      // App chỉ gửi cấu hình thô (không có bảng điểm) → trang web tính điểm rồi gửi lại.
      // Vì vậy từ app thì cho phép thiếu điểm, nhưng không tính vào bảng xếp hạng.
      const power = num(b.power, 0, 400000);
      if (power == null && !(source === "app" && typeof b.specs === "string")) return json(req, { error: "bad_request" }, 400);
      const rec = {
        power, source,
        gpu: str(b.gpu), cpu: str(b.cpu), ram: num(b.ram, 0, 1024),
        gpuPts: num(b.gpuPts, 0, 400000), cpuPts: num(b.cpuPts, 0, 400000), ramPts: num(b.ramPts, 0, 100000),
        specs: typeof b.specs === "string" ? b.specs.slice(0, 2000) : null,
        at: Date.now(),
      };
      const id = rid();
      await kset(["check", id], rec, 30 * 24 * 3600e3);
      // Mỗi IP chỉ được tính vào bảng xếp hạng 1 lần/ngày — chống bơm điểm
      const day = Math.floor(Date.now() / 86400e3);
      if (power != null && power > 0 && !(await kget(["counted", ip, day]))) {
        await kset(["counted", ip, day], 1, 86400e3);
        await kinc(["hist", Math.min(NBUCKETS - 1, Math.floor(power / BUCKET))]);
      }
      // App gửi về → gắn vào tab web đang chờ trên cùng máy (cùng IP, trong 30 phút)
      if (source === "app") {
        const sid = typeof b.sid === "string" && b.sid ? b.sid.slice(0, 20) : await kget<string>(["sess_ip", ip]);
        if (sid) {
          const s = await kget<Record<string, unknown>>(["sess", sid]);
          if (s && (s.status === "waiting" || s.status === "running")) await kset(["sess", sid], { ...s, status: "done", checkId: id }, 30 * 60e3);
        }
      }
      const h = await histogram();
      return json(req, { id, percentile: power ? percentileOf(h, power) : null, total: h.reduce((a, c) => a + c, 0) });
    }
    if (p === "/api/check" && req.method === "GET") {
      const c = await kget<Record<string, unknown>>(["check", (qs.get("id") || "").slice(0, 20)]);
      if (!c) return json(req, { error: "not_found" }, 404);
      const h = await histogram();
      return json(req, { ...c, percentile: c.power ? percentileOf(h, c.power as number) : null, total: h.reduce((a, x) => a + x, 0) });
    }

    // ---------- Phân bố điểm (vẽ biểu đồ) ----------
    if (p === "/api/stats" && req.method === "GET") {
      const h = await histogram();
      return json(req, { bucket: BUCKET, hist: h, total: h.reduce((a, b) => a + b, 0) }, 200, { "cache-control": "public, max-age=60" });
    }

    return json(req, { error: "not_found" }, 404);
  } catch (_err) {
    return json(req, { error: "server_error" }, 500);   // không lộ chi tiết
  }
});
