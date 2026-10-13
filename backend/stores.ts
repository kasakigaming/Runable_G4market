// ============================================================================
// Kho game ngoài Steam — tra trực tiếp, không cần key:
//   Epic Games Store   GraphQL của Epic Launcher: tìm game + technicalRequirements theo namespace
//   Microsoft Store    storeedgefd (API của app Microsoft Store): tìm + SystemRequirements (game Xbox PC / Game Pass)
//   GOG                catalog.gog.com (tìm) + api.gog.com (yêu cầu cấu hình)
// Mỗi kho trả về đúng dạng game như steamToGame() để engine chấm điểm được.
// ============================================================================
import { parseReq } from "../shared/reqparse.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const TIMEOUT = 5000;   // kho nào chậm thì bỏ qua, không làm chậm cả ô tìm kiếm

export type Hit = { id: string; name: string; image: string | null; source: string };
type Req = ReturnType<typeof parseReq> & { empty?: boolean };

async function getJson(url: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(url, { ...init, headers: { "user-agent": UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(url.split("/")[2] + " " + r.status);
  return r.json();
}

// Nhãn của từng kho → nhãn parseReq hiểu ("Windows Processor", "Graphics Processor", "System:"…)
function canon(label: string): string | null {
  const l = label.toLowerCase();
  if (/video memory|vram|graphics memory/.test(l)) return "VRAM";
  if (/graphic|gpu|video/.test(l)) return "Graphics";   // trước "processor": Microsoft ghi "Graphics Processor"
  if (/processor|cpu/.test(l)) return "Processor";
  if (/memory|ram/.test(l)) return "Memory";
  if (/storage|disk|hard drive|space/.test(l)) return "Storage";
  if (/directx/.test(l)) return "DirectX";
  if (/\bos\b|operating|system/.test(l)) return "OS";
  return null;
}
function toReq(pairs: Array<[string, unknown]>): Req | null {
  const lines = pairs
    .map(([k, v]) => [canon(k), String(v ?? "").trim()] as const)
    .filter(([k, v]) => k && v && !/^not specified$/i.test(v))
    .map(([k, v]) => `${k}: ${v}`);
  const r: Req = parseReq(lines.join("\n"));
  return r.empty ? null : r;
}

const game = (o: Record<string, unknown>) => ({ free: false, genres: [], store: true, ...o });

// ---------------------------------------------------------------------------
// Epic Games Store
// ---------------------------------------------------------------------------
const EPIC = "https://launcher.store.epicgames.com/graphql";
const epicQl = (query: string, variables: Record<string, unknown>) =>
  // Endpoint của Epic Launcher chỉ trả lời user-agent của Launcher (user-agent trình duyệt bị chuyển hướng)
  getJson(EPIC, { method: "POST", headers: { "content-type": "application/json", "user-agent": "EpicGamesLauncher/17.0.0" }, body: JSON.stringify({ query, variables }) });
const EPIC_FIELDS = `title namespace offerType keyImages{type url} offerMappings{pageSlug pageType} catalogNs{mappings(pageType:"productHome"){pageSlug}}`;
const epicImg = (e: any) => {
  const k = e.keyImages || [];
  return (k.find((x: any) => x.type === "OfferImageWide") || k.find((x: any) => x.type === "DieselStoreFrontWide") || k[0] || {}).url || null;
};
const epicSlug = (e: any) => (e.offerMappings || []).find((m: any) => m.pageType === "productHome")?.pageSlug || e.catalogNs?.mappings?.[0]?.pageSlug || null;

export async function searchEpic(q: string): Promise<Hit[]> {
  const j = await epicQl(`query($k:String){Catalog{searchStore(keywords:$k,count:8,category:"games/edition/base",country:"US",locale:"en-US"){elements{${EPIC_FIELDS}}}}}`, { k: q });
  return (j.data?.Catalog?.searchStore?.elements || [])
    .filter((e: any) => e.offerType === "BASE_GAME" || e.offerType === "OTHERS")
    .map((e: any) => ({ id: "epic:" + e.namespace, name: e.title, image: epicImg(e), source: "Epic Games" }));
}

export async function getEpic(ns: string) {
  const [meta, tech] = await Promise.all([
    epicQl(`query($ns:String){Catalog{searchStore(namespace:$ns,count:5,category:"games/edition/base",country:"US",locale:"en-US"){elements{${EPIC_FIELDS} categories{path}}}}}`, { ns }),
    epicQl(`query($ns:String!){Product{sandbox(sandboxId:$ns){configuration{... on StoreConfiguration{configs{technicalRequirements{windows{title minimum recommended}}}}}}}}`, { ns }),
  ]);
  const els = meta.data?.Catalog?.searchStore?.elements || [];
  const e = els.find((x: any) => x.offerType === "BASE_GAME") || els[0];
  if (!e) return null;
  const rows = (tech.data?.Product?.sandbox?.configuration || [])
    .flatMap((c: any) => c?.configs?.technicalRequirements?.windows || []);
  const slug = epicSlug(e);
  return game({
    id: "epic:" + ns, name: e.title, image: epicImg(e),
    min: toReq(rows.map((r: any) => [r.title, r.minimum])),
    rec: toReq(rows.map((r: any) => [r.title, r.recommended])),
    source: "Epic Games Store", sourceUrl: slug ? `https://store.epicgames.com/p/${slug}` : "https://store.epicgames.com/",
  });
}

// ---------------------------------------------------------------------------
// Microsoft Store (game PC trên Xbox app / Game Pass)
// ---------------------------------------------------------------------------
const MS = "https://storeedgefd.dsx.mp.microsoft.com/v9.0";
const MS_Q = "market=US&locale=en-us&deviceFamily=Windows.Desktop";
const msImg = (images: any[] = []) => {
  const i = images.find((x) => x.ImageType === "SuperHeroArt") || images.find((x) => x.ImageType === "BoxArt") || images[0];
  return i?.Url ? (i.Url.startsWith("//") ? "https:" + i.Url : i.Url) : null;
};

export async function searchMs(q: string): Promise<Hit[]> {
  const j = await getJson(`${MS}/search?${MS_Q}&query=${encodeURIComponent(q)}`);
  return (j.Payload?.SearchResults || [])
    // Gói bổ sung (VIP, Car Pack…) cũng nằm trong họ "Games" nhưng có danh mục "Add-on" và không có nút Launch
    .filter((x: any) => x.ProductFamilyName === "Games" && (x.CardActions || []).includes("Launch")
      && !(x.Categories || []).some((c: string) => /add-on|personalization/i.test(c)))
    .slice(0, 8)
    .map((x: any) => ({ id: "ms:" + x.ProductId, name: x.Title, image: msImg(x.Images), source: "Microsoft Store" }));
}

function findKey(o: any, key: string): any {
  if (!o || typeof o !== "object") return null;
  if (key in o) return o[key];
  for (const v of Object.values(o)) { const r = findKey(v, key); if (r) return r; }
  return null;
}

export async function getMs(id: string) {
  if (!/^[0-9A-Z]{12}$/.test(id)) return null;
  const j = await getJson(`${MS}/products/${id}?${MS_Q}`);
  const p = j.Payload;
  if (!p) return null;
  const sr = findKey(p, "SystemRequirements") || {};
  const lvl = (k: string) => toReq((sr[k]?.Items || []).map((i: any) => [i.Name, i.Description]));
  return game({
    id: "ms:" + id, name: p.Title, image: msImg(p.Images),
    genres: p.Categories || (p.CategoryId ? [p.CategoryId] : []),
    min: lvl("Minimum"), rec: lvl("Recommended"),
    source: "Microsoft Store", sourceUrl: `https://apps.microsoft.com/detail/${id}`,
  });
}

// ---------------------------------------------------------------------------
// GOG
// ---------------------------------------------------------------------------
export async function searchGog(q: string): Promise<Hit[]> {
  const j = await getJson(`https://catalog.gog.com/v1/catalog?query=like:${encodeURIComponent(q)}&limit=8&order=desc:score&productType=in:game`);
  return (j.products || []).map((p: any) => ({ id: "gog:" + p.id, name: p.title, image: p.coverHorizontal || null, source: "GOG" }));
}

export async function getGog(id: string) {
  if (!/^\d{5,12}$/.test(id)) return null;
  const j = await getJson(`https://api.gog.com/v2/games/${id}?locale=en-US`);
  const p = j._embedded?.product;
  if (!p) return null;
  const win = (j._embedded.supportedOperatingSystems || []).find((o: any) => o.operatingSystem?.name === "windows");
  const lvl = (t: string) => {
    const s = (win?.systemRequirements || []).find((r: any) => r.type === t);
    return s ? toReq((s.requirements || []).map((r: any) => [String(r.name || r.id).replace(/:$/, ""), r.description])) : null;
  };
  const img = p._links?.image?.href ? String(p._links.image.href).replace("{formatter}", "product_630") : null;
  return game({
    id: "gog:" + id, name: p.title, image: img,
    genres: (j._embedded.tags || []).slice(0, 3).map((t: any) => t.name),
    min: lvl("minimum"), rec: lvl("recommended"),
    source: "GOG", sourceUrl: j._links?.store?.href || "https://www.gog.com/",
  });
}
