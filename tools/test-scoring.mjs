// Kiểm tra bộ chấm điểm trên toàn bộ yêu cầu cấu hình thật trong data/
// Chạy: node tools/test-scoring.mjs
import { readFileSync } from "node:fs";
import { reqGpu, reqCpu, gpuScore, cpuScore } from "../shared/hwscore.js";
import { splitAlts } from "../shared/reqparse.js";

const steam = JSON.parse(readFileSync(new URL("../data/steam-popular.json", import.meta.url))).games;
const off = JSON.parse(readFileSync(new URL("../data/games-offsteam.json", import.meta.url))).games;
for (const g of off) for (const k of ["min", "rec", "high"]) if (g[k]) {
  g[k].cpuAlts = splitAlts(g[k].cpu); g[k].gpuAlts = splitAlts(g[k].gpu);
}
const all = [...steam, ...off];

let gTot = 0, gHit = 0, cTot = 0, cHit = 0;
const missG = new Set(), missC = new Set();
const rows = [];
for (const g of all) {
  for (const k of ["min", "rec"]) {
    const r = g[k]; if (!r) continue;
    for (const a of r.gpuAlts || []) { gTot++; if (gpuScore(a)) gHit++; else missG.add(a); }
    for (const a of r.cpuAlts || []) { cTot++; if (cpuScore(a)) cHit++; else missC.add(a); }
  }
  const f = (x) => (x ? String(Math.round(x.idx)).padStart(3) + " " + x.via.padEnd(5) : "  ? -    ");
  rows.push(g.name.slice(0, 34).padEnd(35) + "GPU min " + f(reqGpu(g.min)) + " rec " + f(reqGpu(g.rec))
    + " | CPU min " + f(reqCpu(g.min)) + " rec " + f(reqCpu(g.rec)));
}
console.log(rows.join("\n"));
console.log(`\nNhận ra GPU: ${gHit}/${gTot} (${Math.round(gHit / gTot * 100)}%) · CPU: ${cHit}/${cTot} (${Math.round(cHit / cTot * 100)}%)`);
console.log("\nChuỗi GPU không hiểu:"); for (const s of missG) console.log("  -", s);
console.log("\nChuỗi CPU không hiểu:"); for (const s of missC) console.log("  -", s);
