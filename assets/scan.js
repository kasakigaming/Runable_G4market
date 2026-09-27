// ============================================================================
// Quét cấu hình bằng trình duyệt — không cài gì.
// Các hàm đo (GPU, số nhân thật, cache, SMT) giữ nguyên từ bản đã chạy thử trên
// Ryzen Z1 Extreme và Core i5-11400H + RTX 3060 Laptop.
// ============================================================================
import { CPUS, matchGpu, coreScale, isServerCpu, cpuScore, GPU_BY_KEY } from "../shared/hwscore.js";

const CPU_T = 2, CPU_CORES = 3, CPU_ST = 4, CPU_L2 = 5, CPU_L3 = 6, CPU_FLAG = 7;
const CPU_HINTS = {
  "z1 extreme":   ["Ryzen Z1 Extreme — ROG Ally / Legion Go","Ryzen 7 7840U","Ryzen 7 8840U"],
  "radeon 780m":  ["Ryzen Z1 Extreme — ROG Ally / Legion Go","Ryzen 7 7840U","Ryzen 7 8840U","Ryzen 7 7840HS","Ryzen 7 8845HS","Ryzen 9 7940HS","Ryzen 9 8945HS"],
  "radeon 760m":  ["Ryzen 5 7640HS"],
  "radeon 740m":  ["Ryzen Z1 — ROG Ally bản thường"],
  "radeon 890m":  ["Ryzen AI 9 HX 370","Ryzen AI 9 365"],
  "radeon 880m":  ["Ryzen AI 9 365","Ryzen AI 9 HX 370"],
  "z2 extreme":   ["Ryzen Z2 Extreme — ROG Ally 2"],
  "z2 go":        ["Ryzen Z2 Go — Legion Go S"],
  "z1 non":       ["Ryzen Z1 — ROG Ally bản thường"],
  "steam deck":   ["Steam Deck APU (Van Gogh)"],
  "msi claw":     ["Core Ultra 7 155H — MSI Claw"],
  "radeon 680m":  ["Ryzen 7 6800H"],
  "vega 8":       ["Ryzen 7 5800H","Ryzen 5 5600H","Ryzen 7 4800H"],
  "vega 7":       ["Ryzen 5 5600H","Ryzen 5 7535HS"],
  "vega 11":      ["Ryzen 5 3600"],
  "arc 140v":     ["Core Ultra 7 258V"],
  "arc 130v":     ["Core Ultra 7 258V"],
  "arc graphics": ["Core Ultra 7 155H — MSI Claw"],
  "iris xe":      ["Core i7-11800H","Core i5-12450H","Core i7-12700H"],
  "uhd graphics 770":["Core i5-12400F","Core i5-13400F","Core i9-13900K","Core i5-12600K"],
  "uhd graphics 750":["Core i7-11700"],
  "uhd graphics 730":["Core i5-12400F","Core i5-13400F"],
  "uhd graphics 630":["Core i5-9400F","Core i7-9700K","Core i7-8700K","Core i5-8400","Core i9-9900K"],
  "uhd graphics 620":["Core i5-10300H"],
  "hd graphics 630": ["Core i7-7700","Core i5-7500"],
  "hd graphics 530": ["Core i7-6700","Core i5-6500"],
  "hd graphics 4600":["Core i7-4790","Core i5-4460"]
};

function detectVM(raw){
  const s = String(raw || "").toLowerCase();
  const virtualDisplay = /vmware|virtualbox|virgl|qxl|hyper-?v|basic render|remote display|swiftshader|llvmpipe|parallels|microsoft rdp/.test(s);
  const datacenter = /tesla|grid|\bvgpu\b|quadro|\ba100\b|\ba10g?\b|\bl4\b|\bl40s?\b|rtx a\d|instinct|radeon pro v/.test(s);
  const hv = /vmware|virtualbox|qemu|kvm|hyper-?v|xen|parallels|virtio|red hat/.test(s);
  return {
    isVM: virtualDisplay || datacenter || hv,
    virtualDisplay,
    passthrough: datacenter && !virtualDisplay,
    kind: virtualDisplay ? "vd" : datacenter ? "dc" : hv ? "hv" : null
  };
}

/* Lấy TÊN THẬT driver trả về, không qua bảng tra.
   "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002520) Direct3D11 ..., D3D11)"
   → "NVIDIA GeForce RTX 3060 Laptop GPU" */
function cleanGpuName(raw){
  let s = String(raw || "").trim();
  const m = /^ANGLE\s*\(([\s\S]*)\)$/.exec(s);
  if(m){
    s = m[1];
    const i = s.indexOf(",");
    if(i > -1) s = s.slice(i + 1);
    s = s.replace(/,\s*(D3D\d+|Vulkan|OpenGL|Metal)[^,]*$/i, "");
  }
  s = s.replace(/\(0x[0-9a-fA-F]+\)/g, " ")
       .replace(/\bDirect3D\d*\b[\s\S]*$/i, " ")
       .replace(/\bvs_\d_\d\b|\bps_\d_\d\b/gi, " ")
       .replace(/\/PCIe\/SSE2|\/SSE2|\/PCIe/gi, " ")
       .replace(/ANGLE Metal Renderer:\s*/i, " ")
       .replace(/,\s*[^,]*version[^,]*$/i, "")
       .replace(/\(R\)|\(TM\)|®|™/g, " ")
       .replace(/\s*,\s*$/, "")
       .replace(/\s{2,}/g, " ")
       .trim();
  return s;
}

/* Laptop có 2 GPU: trình duyệt mặc định dùng card onboard cho đỡ tốn pin.
   Hỏi riêng adapter "high-performance" và "low-power" để lòi ra cả hai. */
async function enumerateGpus(){
  const found = new Map();
  const vendorOf = s => /nvidia|geforce|rtx|gtx|quadro|tesla/i.test(s) ? "NVIDIA"
                      : /radeon|\bamd\b|\brx \d/i.test(s) ? "AMD"
                      : /intel|arc|iris|uhd graphics|hd graphics/i.test(s) ? "Intel"
                      : /apple/i.test(s) ? "Apple" : null;
  const archOf = s => (/ada|lovelace/i.test(s) && "Ada") || (/ampere/i.test(s) && "Ampere")
                    || (/turing/i.test(s) && "Turing") || (/pascal/i.test(s) && "Pascal")
                    || (/blackwell/i.test(s) && "Blackwell")
                    || (/rdna-?3/i.test(s) && "RDNA 3") || (/rdna-?2/i.test(s) && "RDNA 2") || null;

  const add = (raw, source) => {
    const s = String(raw || "").trim();
    if(!s) return;
    const entry = matchGpu(s);
    const key = entry ? entry[0] : "?" + (vendorOf(s) || s.slice(0,24));
    if(found.has(key)){ found.get(key).sources.push(source); return; }
    found.set(key, {entry, raw:s, clean:cleanGpuName(s), vendor:vendorOf(s), arch:archOf(s), sources:[source]});
  };

  for(const pref of ["high-performance","low-power"]){
    try{
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2", {powerPreference:pref})
              || c.getContext("webgl",  {powerPreference:pref});
      if(gl){
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        add(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), "WebGL/" + pref);
        const lose = gl.getExtension("WEBGL_lose_context");
        if(lose && pref !== "high-performance") lose.loseContext();
      }
    }catch(e){}
    try{
      if(navigator.gpu){
        const ad = await navigator.gpu.requestAdapter({powerPreference:pref});
        if(ad){
          const info = ad.info || (ad.requestAdapterInfo ? await ad.requestAdapterInfo() : null);
          if(info){
            const s = [info.description, info.device, info.architecture, info.vendor].filter(Boolean).join(" ");
            add(s, "WebGPU/" + pref);
          }
        }
      }
    }catch(e){}
  }
  // Ưu tiên CARD RỜI trước, rồi mới tới điểm mạnh — đó mới là card dùng để chơi game.
  // Card chưa nhận ra tên nhưng là NVIDIA/AMD thì gần như chắc chắn là card rời.
  const rank = g => {
    const discrete = g.entry ? (g.entry[2] > 0 && !g.entry[4])
                             : (g.vendor === "NVIDIA" || g.vendor === "AMD");
    return (discrete ? 100000 : 0) + (g.entry ? g.entry[1] : 60);
  };
  return [...found.values()].sort((a,b) => rank(b) - rank(a));
}

function measureHz(){
  return new Promise(res=>{
    const t = []; let stop = false;
    setTimeout(()=>{stop=true;}, 1200);
    function frame(ts){
      t.push(ts);
      if(t.length < 45 && !stop) requestAnimationFrame(frame);
      else{
        if(t.length < 6) return res(60);
        const d = [];
        for(let i=1;i<t.length;i++) d.push(t[i]-t[i-1]);
        d.sort((a,b)=>a-b);
        const med = d[Math.floor(d.length/2)] || 16.67;
        const hz = 1000/med;
        const common = [30,50,60,75,90,100,120,144,165,170,180,200,240,280,360,480,540];
        let nearest = common.reduce((p,x)=>Math.abs(x-hz)<Math.abs(p-hz)?x:p, 60);
        res(Math.abs(nearest-hz) < hz*0.12 ? nearest : Math.round(hz));
      }
    }
    requestAnimationFrame(frame);
  });
}

/* --- Nhân benchmark, dùng chung cho luồng chính và worker --- */
function kernel(iters){
  var x = 123456789 >>> 0, y = 362436069 >>> 0, acc = 0.0;
  for(var i=0;i<iters;i++){
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    y = (y * 1664525 + 1013904223) >>> 0;
    acc += (x ^ y) * 2.3283064365386963e-10;
    acc = acc - (acc | 0);
  }
  return acc;
}

/* Đo đơn luồng trên luồng chính: lấy lần nhanh nhất trong 3 lần để bớt nhiễu */
function benchSingle(){
  kernel(3e5); // hâm nóng JIT
  let iters = 1e6, ms = 0;
  for(let i=0;i<8 && ms<60;i++){ iters *= 2; const t0 = performance.now(); kernel(iters); ms = performance.now()-t0; }
  let best = iters/(ms/1000);
  for(let r=0;r<2;r++){
    const t0 = performance.now(); kernel(iters); const m = performance.now()-t0;
    best = Math.max(best, iters/(m/1000));
  }
  return best;
}

/* Nhân thứ hai: 4 chuỗi độc lập nên một luồng đã lấp đầy đơn vị tính của nhân.
   Siêu phân luồng gần như không giúp gì → mốc gãy khi vượt số nhân thật rất rõ. */
function kernelILP(iters){
  var a=1,b=2,c=3,d=4,s0=0,s1=0,s2=0,s3=0;
  for(var i=0;i<iters;i++){
    a ^= a<<13; a>>>=0; a ^= a>>>17; a ^= a<<5; a>>>=0;
    b ^= b<<13; b>>>=0; b ^= b>>>17; b ^= b<<5; b>>>=0;
    c ^= c<<13; c>>>=0; c ^= c>>>17; c ^= c<<5; c>>>=0;
    d ^= d<<13; d>>>=0; d ^= d>>>17; d ^= d<<5; d>>>=0;
    s0 = (s0 + (a&255))|0; s1 = (s1 + (b&255))|0;
    s2 = (s2 + (c&255))|0; s3 = (s3 + (d&255))|0;
  }
  return (s0^s1^s2^s3)>>>0;
}

/* --- Đo đa luồng bằng Web Worker: suy ra SMT và nhân lớn/nhỏ --- */
const WORKER_SRC = kernel.toString() + kernelILP.toString() + `
self.onmessage = function(e){
  var f = e.data.ilp ? kernelILP : kernel;
  var t0 = performance.now();
  var a = f(e.data.iters);
  self.postMessage({ms: performance.now() - t0, a: a});
};`;

let workerUrl = null;
function getWorkerUrl(){
  if(workerUrl === null){
    try{ workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], {type:"text/javascript"})); }
    catch(e){ workerUrl = false; }
  }
  return workerUrl;
}

async function runParallel(n, iters, ilp){
  const url = getWorkerUrl();
  if(!url) return null;
  const ws = [];
  try{
    for(let i=0;i<n;i++) ws.push(new Worker(url));
    // hâm nóng từng worker trước khi bấm giờ
    await Promise.all(ws.map(w => new Promise(res => { w.onmessage = () => res(); w.postMessage({iters:2e5, ilp}); })));
    const t0 = performance.now();
    const times = await Promise.all(ws.map(w => new Promise(res => { w.onmessage = ev => res(ev.data.ms); w.postMessage({iters, ilp}); })));
    const wall = performance.now() - t0;
    return {throughput: n*iters/(wall/1000), times};
  }catch(e){
    return null;
  }finally{
    ws.forEach(w => { try{ w.terminate(); }catch(e){} });
  }
}

/* Chạy 1 luồng → T/2 luồng → T luồng và đọc cấu trúc CPU từ tỉ lệ tăng */
async function probeTopology(threads, stOps){
  // Dùng nhân 4 chuỗi độc lập: một luồng đã bão hòa nhân, nên vượt số nhân thật là gãy rõ
  const iters = Math.max(1e6, Math.round(stOps * 0.06));
  const one  = await runParallel(1, iters, true);
  if(!one) return {ok:false};
  const half = threads >= 4 ? await runParallel(Math.floor(threads/2), iters, true) : one;
  const full = await runParallel(threads, iters, true);
  if(!half || !full) return {ok:false};

  // Nhân lớn/nhỏ: chạy đầy tải thì worker nhanh nhất và chậm nhất lệch hẳn nhau
  const ts = full.times.slice().sort((a,b)=>a-b);
  const fast = ts[Math.floor(ts.length*0.2)], slow = ts[Math.floor(ts.length*0.8)];
  const spread = slow/fast;

  // Từ T/2 lên T luồng: gần gấp đôi = nhân thật; chỉ nhích lên = hai luồng chung một nhân
  const smtRatio = full.throughput / half.throughput;

  const hybrid = spread > 1.5;
  const smt = !hybrid && threads >= 4 && smtRatio < 1.62;
  const cores = hybrid ? null : (smt ? threads/2 : threads);

  return {
    ok:true, hybrid, smt, cores, spread, smtRatio,
    mtOps: full.throughput,
    scaling: full.throughput / one.throughput
  };
}

/* --- Đo dung lượng cache bằng pointer-chase: L2/L3 phân biệt được đời chip --- */
function probeCache(){
  const sizesKB = [8,16,24,32,48,64,96,128,192,256,384,512,768,1024,1536,2048,3072,4096,6144,8192,12288,16384,24576,32768];
  const line = 16;            // 16 × Int32 = 64 byte = 1 dòng cache
  const curve = [];
  try{
    for(const kb of sizesKB){
      const n = kb*256;                      // số phần tử Int32
      const m = Math.floor(n/line);
      if(m < 8) continue;
      const a = new Int32Array(n);
      const idx = new Int32Array(m);
      for(let i=0;i<m;i++) idx[i] = i;
      // xáo trộn để chặn bộ tiên đoán nạp trước
      let s = 88675123 >>> 0;
      for(let i=m-1;i>0;i--){
        s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
        const j = s % (i+1);
        const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
      }
      for(let i=0;i<m;i++) a[idx[i]*line] = idx[(i+1)%m]*line;
      const steps = kb <= 1024 ? 1500000 : 400000;
      let p = 0;
      for(let i=0;i<m;i++) p = a[p];          // hâm nóng
      const t0 = performance.now();
      for(let i=0;i<steps;i++) p = a[p];
      const ns = (performance.now()-t0)*1e6/steps;
      if(p === -1) console.log(p);            // chặn trình tối ưu bỏ luôn vòng lặp
      curve.push([kb, ns]);
    }
  }catch(e){ return null; }
  const pts = curve.filter(Boolean);
  if(pts.length < 6) return null;

  // Bậc nhảy = ranh giới một mức cache. Bậc đầu là L1, rồi L2, rồi L3.
  // Gộp các bậc liền nhau vì có mức chuyển dần chứ không dứt khoát.
  const steps = [];
  for(let i=1;i<pts.length;i++){
    const r = pts[i][1] / pts[i-1][1];
    if(r > 1.35){
      if(steps.length && pts[i-1][0] <= steps[steps.length-1]*2) steps[steps.length-1] = pts[i-1][0];
      else steps.push(pts[i-1][0]);
    }
  }
  const ok = (v,lo,hi) => (v != null && v >= lo && v <= hi) ? v : null;
  const l1 = ok(steps[0], 8, 128);                                      // KB
  const l2 = ok(steps[1], 192, 8192);                                   // KB
  const l3 = steps[2] ? ok(Math.round(steps[2]/1024), 2, 256) : null;   // MB
  return {curve:pts, l1, l2, l3, steps, dram: pts[pts.length-1][1]};
}

/* Benchmark GPU: shader nặng render vào framebuffer ngoài màn hình */
function benchGpu(){
  try{
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const gl = c.getContext("webgl", {antialias:false, powerPreference:"high-performance", preserveDrawingBuffer:false});
    if(!gl) return null;
    const vs = `attribute vec2 p; varying vec2 uv; void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;
    const fs = `precision highp float; varying vec2 uv;
      void main(){
        vec2 c = uv*2.6 - vec2(1.8,1.3);
        vec2 z = vec2(0.0); float m = 0.0;
        for(int i=0;i<128;i++){
          z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
          m += dot(z,z)*1e-4;
        }
        gl_FragColor = vec4(fract(m), fract(m*0.7), 0.5, 1.0);
      }`;
    function sh(type,src){ const s = gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error("shader"); return s; }
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER,vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog,"p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0,0,256,256);
    const px = new Uint8Array(4);
    const flush = ()=> gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);

    for(let i=0;i<3;i++) gl.drawArrays(gl.TRIANGLES,0,3);
    flush();

    let draws = 8, elapsed = 0;
    for(let pass=0; pass<9; pass++){
      const t0 = performance.now();
      for(let i=0;i<draws;i++) gl.drawArrays(gl.TRIANGLES,0,3);
      flush();
      elapsed = performance.now() - t0;
      if(elapsed > 120) break;
      draws = Math.max(draws*2, Math.ceil(draws * 160 / Math.max(elapsed,0.4)));
      if(draws > 400000) break;
    }
    if(elapsed <= 0) return null;
    // tỉ pixel-vòng lặp mỗi giây
    return (draws * 256 * 256 * 128) / (elapsed/1000) / 1e9;
  }catch(e){ return null; }
}

/* ===================================================================
   ĐIỂM TỪ SỐ ĐO THẬT — không cần có tên trong bảng tra.
   Hai hằng số dưới đây khớp từ máy thật đã biết điểm chuẩn:
     GPU  Radeon 780M  đo 333 → điểm 40   ·  Intel UHD (Tiger Lake) đo 18 → điểm 8
     CPU  Z1 Extreme   260 Mops → 118     ·  Core i5-11400H  190 Mops → 86
   =================================================================== */
const GPU_BENCH_K = 1.594, GPU_BENCH_P = 0.555;
function gpuIdxFromBench(u){
  if(!u || u <= 0) return null;
  return Math.max(1, Math.round(GPU_BENCH_K * Math.pow(u, GPU_BENCH_P)));
}

/* Chip dành cho laptop: đuôi H/HS/HX/HQ/U/P/V, hoặc chip máy cầm tay và ARM */
function isMobileCpu(name){
  if(/\bZ[12]\b|Steam Deck|Apple M|Snapdragon/i.test(name)) return true;
  return /\d{3,5}(HQ|HK|HX|HS|H|US|U|P|V)\b/i.test(name);
}

function identifyCpu(ev){
  const hints = CPU_HINTS[ev.gpuKey] || [];
  const hintSet = new Set(hints);
  const scored = [];

  for(const c of CPUS){
    let penalty = 0;
    const flag = c[CPU_FLAG] || "";
    const server = isServerCpu(c);

    // 1. Số luồng — bằng chứng chắc chắn nhất, TRỪ khi đang chạy máy ảo:
    //    máy ảo chỉ cấp một lát cắt nên số luồng không khớp con chip thật.
    if(ev.threads && !server){
      if(c[CPU_T] !== ev.threads) penalty += (ev.vm ? 120 : 900) + Math.abs(c[CPU_T]-ev.threads)*8;
    }
    // CPU máy chủ chỉ hợp lý khi thật sự đang ở trong máy ảo
    if(server) penalty += ev.vm ? -260 : 420;
    // 1b. Laptop hay máy bàn — dấu hiệu rất mạnh mà web đọc được:
    //     có pin, hoặc card rời mang chữ "Laptop"
    if(ev.laptop != null && !server){
      const mob = isMobileCpu(c[0]);
      if(ev.laptop && !mob) penalty += 300;
      if(!ev.laptop && mob) penalty += 220;
    }
    // 2. Chip ARM hay x86
    if(ev.arch === "arm" && flag !== "arm") penalty += 800;
    if(ev.arch === "x86" && flag === "arm") penalty += 800;
    // 3. Nhân lớn/nhỏ (máy ảo che mất cấu trúc này nên bỏ qua)
    if(!server && !ev.vm){
      if(ev.hybrid === true  && flag !== "h") penalty += 260;
      if(ev.hybrid === false && flag === "h") penalty += 260;
      // 4. Số nhân vật lý suy ra từ SMT
      if(ev.cores && !ev.hybrid && c[CPU_CORES] !== ev.cores) penalty += 200;
    }
    // 5. Cache — phân biệt đời chip rất tốt (Zen4 L2 1 MB, Raptor 2 MB, Skylake 256 KB)
    if(ev.l2) penalty += Math.min(180, Math.abs(Math.log2(c[CPU_L2]/ev.l2)) * 110);
    if(ev.l3) penalty += Math.min(90,  Math.abs(Math.log2(c[CPU_L3]/ev.l3)) * 55);
    // 6. Gợi ý từ iGPU: Radeon 780M ⇒ chắc chắn là chip AMD Phoenix
    if(hintSet.size){
      if(hintSet.has(c[0])) penalty -= 500 - hints.indexOf(c[0])*15;
      else penalty += 220;
    }
    // 7. Điểm đo — chỉ để xếp hạng trong nhóm đã lọc
    if(ev.stIndex) penalty += Math.min(120, Math.abs(c[CPU_ST] - ev.stIndex) * 1.4);

    scored.push({c, penalty});
  }
  scored.sort((a,b)=>a.penalty-b.penalty);

  const top = scored[0];
  // Ứng viên sát nút = cùng loại chip. Chỉ nhận cùng hãng, kẻo liệt kê Ryzen bên cạnh Core.
  const vendor = n => /^(Ryzen|FX|Steam Deck|EPYC|Threadripper)/.test(n) ? "amd"
                    : /^(Core|Pentium|Celeron|Xeon)/.test(n) ? "intel" : "other";
  const topVendor = vendor(top.c[0]);
  const alts = scored.slice(1)
    .filter(s => s.penalty - top.penalty < 120 && vendor(s.c[0]) === topVendor)
    .slice(0,3).map(s => s.c[0]);
  // Độ tin cậy: lọc được đến đâu
  let conf = "est";
  if(ev.threads && hintSet.size && alts.length <= 3) conf = "ok";
  else if(ev.threads && (ev.cores || ev.hybrid !== null) && ev.l2) conf = "ok";

  return {cpu: top.c, alts, conf, spread: scored[1] ? scored[1].penalty - top.penalty : 999};
}

async function readOS(){
  try{
    if(navigator.userAgentData && navigator.userAgentData.getHighEntropyValues){
      const h = await navigator.userAgentData.getHighEntropyValues(["platform","platformVersion","architecture","bitness"]);
      let name = h.platform || "";
      if(name === "Windows"){
        const major = parseInt((h.platformVersion||"0").split(".")[0], 10);
        name = major >= 13 ? "Windows 11" : (major > 0 ? "Windows 10" : "Windows");
      }
      const bits = h.bitness ? h.bitness + "-bit" : "";
      const arch = h.architecture === "arm" ? "ARM" : (h.architecture === "x86" ? "x64" : h.architecture);
      return {name, extra:[arch, bits].filter(Boolean).join(" · "), conf:"ok", arch:h.architecture || null};
    }
  }catch(e){}
  const ua = navigator.userAgent;
  let name = "Không rõ";
  if(/Windows NT 10/.test(ua)) name = "Windows 10 / 11";
  else if(/Windows/.test(ua)) name = "Windows (đời cũ)";
  else if(/Mac OS X/.test(ua)) name = "macOS";
  else if(/Android/.test(ua)) name = "Android";
  else if(/iPhone|iPad/.test(ua)) name = "iOS";
  else if(/Linux/.test(ua)) name = "Linux";
  const arch = /arm|aarch64/i.test(ua) ? "arm" : (/Mac OS X/.test(ua) ? null : "x86");
  return {name, extra:"", conf:"est", arch};
}

// ===========================================================================
// Pin: cắm sạc hay chạy pin — cũng là dấu hiệu laptop/máy bàn
// ===========================================================================
async function readBattery() {
  try {
    if (!navigator.getBattery) return { supported: false };
    const b = await navigator.getBattery();
    return {
      supported: true,
      charging: b.charging,
      level: Math.round(b.level * 100),
      hours: (!b.charging && isFinite(b.dischargingTime)) ? b.dischargingTime / 3600 : null,
      looksFull: b.charging && b.level === 1 && b.dischargingTime === Infinity && b.chargingTime === 0,
    };
  } catch (e) { return { supported: false }; }
}

function detectLaptop(gpuList, battery, handheld) {
  if (handheld) return true;
  if ((gpuList || []).some((g) => /laptop|max-?q/i.test(g.raw || "") || (g.entry && /laptop/.test(g.entry[0])))) return true;
  if (battery && battery.supported) {
    if (!battery.charging || battery.level < 100 || battery.hours != null) return true;
  }
  return null;
}

const GPU_VENDOR = (s) => /nvidia|geforce|rtx|gtx|quadro/i.test(s) ? "NVIDIA" : /radeon|\bamd\b/i.test(s) ? "AMD" : /intel|arc|iris|uhd/i.test(s) ? "Intel" : null;

// ===========================================================================
// QUÉT BẰNG TRÌNH DUYỆT — trả về hồ sơ máy. onStep(phần trăm, chữ) để vẽ tiến độ.
// ===========================================================================
export async function scanBrowser(onStep = () => {}) {
  const P = {
    source: "web", at: Date.now(),
    gpus: [], gpu: null, cpu: null, ram: null, os: null, screen: null, battery: null,
    laptop: null, vm: null, threads: navigator.hardwareConcurrency || null,
  };

  onStep(5, "Đang đọc hệ điều hành…");
  P.os = await readOS();

  onStep(15, "Đang tìm mọi card đồ họa trên máy…");
  const list = await enumerateGpus();
  const raw = list.map((g) => g.raw).join(" | ");
  P.vm = detectVM(raw);
  P.gpus = list.map((g) => ({
    name: g.clean || g.raw,
    idx: g.entry ? g.entry[1] : null,
    vram: g.entry && g.entry[2] ? g.entry[2] : null,
    key: g.entry ? g.entry[0] : null,
    integrated: g.entry ? g.entry[2] === 0 : /uhd|iris|radeon graphics|arc graphics|vega/i.test(g.raw),
    handheld: !!(g.entry && g.entry[4] === "hh"),
    vendor: g.vendor || GPU_VENDOR(g.raw),
  }));

  onStep(30, "Đang đo sức mạnh GPU…");
  await new Promise((r) => setTimeout(r, 30));
  const benchU = benchGpu();
  const measured = gpuIdxFromBench(benchU);
  const top = P.gpus[0] || null;
  P.gpu = top ? { ...top } : { name: "Không đọc được card đồ họa", idx: measured || null, vram: null, integrated: true };
  if (P.gpu.idx == null && measured) { P.gpu.idx = measured; P.gpu.via = "đo"; }
  P.gpu.measured = measured;
  // Trình duyệt đang vẽ bằng card onboard trong khi máy có card rời mạnh hơn nhiều
  P.gpu.browserOnIgpu = !!(measured && P.gpu.idx && !P.gpu.integrated && P.gpu.idx / measured > 2.2);

  onStep(42, "Đang đọc pin…");
  P.battery = await readBattery();
  P.laptop = detectLaptop(list, P.battery, P.gpu.handheld);

  onStep(52, "Đang đo tốc độ một nhân CPU…");
  await new Promise((r) => setTimeout(r, 30));
  const stOps = benchSingle();

  onStep(64, "Đang dò số nhân thật…");
  const topo = await probeTopology(P.threads || 4, stOps);

  onStep(76, "Đang đo bộ nhớ đệm CPU…");
  await new Promise((r) => setTimeout(r, 30));
  const cache = probeCache();

  const ev = {
    threads: P.threads, arch: P.os && P.os.arch, vm: P.vm && P.vm.isVM, laptop: P.laptop,
    hybrid: topo.ok ? topo.hybrid : null, smt: topo.ok ? topo.smt : null, cores: topo.ok ? topo.cores : null,
    l2: cache ? cache.l2 : null, l3: cache ? cache.l3 : null,
    stIndex: Math.max(20, Math.min(200, Math.round(stOps / 2.2e6))),
    gpuKey: (list.find((g) => g.entry && g.entry[2] === 0) || {}).entry?.[0] || (top && top.key) || null,
  };
  const id = identifyCpu(ev);
  const cores = ev.cores || (P.threads ? Math.max(1, Math.round(P.threads / 2)) : 4);
  P.cpu = {
    name: id.cpu[0],
    idx: isServerCpu(id.cpu) ? Math.round(id.cpu[4] * coreScale(P.threads)) : id.cpu[1],
    measuredIdx: Math.round(ev.stIndex * coreScale(cores)),
    alts: id.alts, conf: id.conf,
    threads: P.threads, cores: ev.cores, smt: ev.smt,
  };
  // Nhận dạng chưa chắc → tin số đo trên máy hơn tên đoán
  if (id.conf !== "ok") P.cpu.idx = P.cpu.measuredIdx;

  onStep(88, "Đang đọc RAM và màn hình…");
  const dm = navigator.deviceMemory;
  // deviceMemory bị trình duyệt chặn ở 8 GB → chỉ là mức sàn
  P.ram = { gb: dm ? (dm >= 8 ? 16 : dm) : 8, exact: false, floor: dm || null };
  const dpr = window.devicePixelRatio || 1;
  P.screen = { w: Math.round(screen.width * dpr), h: Math.round(screen.height * dpr), hz: await measureHz() };

  onStep(100, "Xong");
  return P;
}

// ===========================================================================
// Hồ sơ từ app runable_g4market.exe — đọc thẳng từ Windows, chính xác tuyệt đối
// ===========================================================================
const GENERIC_IGPU = new Set(["radeon graphics", "uhd graphics", "hd graphics", "arc graphics"]);
// Card onboard đi liền với con chip — biết tên CPU là biết card
const IGPU_BY_CPU = [
  [/z1 extreme/i, "z1 extreme"], [/z2 extreme/i, "z2 extreme"], [/z2 go/i, "z2 go"], [/\bz1\b/i, "z1 non"],
  [/steam deck|van gogh|custom apu 0405/i, "steam deck"],
  [/ryzen ai 9 hx 3[78]0|ryzen ai 9 hx 375/i, "radeon 890m"], [/ryzen ai (9|7) 36\d/i, "radeon 880m"],
  [/(7840|8840|7940|8845|8945|7840hs|8840hs)/i, "radeon 780m"], [/(7640|8640|8645)/i, "radeon 760m"],
  [/(7440|8440|7545)/i, "radeon 740m"], [/(6800h|6900h|6980h|7735h|7736u)/i, "radeon 680m"],
  [/(6600h|6600u|7535h)/i, "radeon 660m"],
  [/ryzen [357] [45]\d00[hu]/i, "vega 8"],
  [/core ultra [579] 2\d\dv/i, "arc 140v"], [/core ultra [579] 1\d\dh/i, "arc graphics"],
];
function igpuFromCpu(cpu) {
  for (const [re, key] of IGPU_BY_CPU) if (re.test(cpu)) return GPU_BY_KEY.get(key) || null;
  return null;
}

export function profileFromApp(specs) {
  const get = (k) => { const m = new RegExp("(?:^|;\\s*)" + k + "=([^;]*)", "i").exec(specs || ""); return m ? m[1].trim() : null; };
  const numv = (k) => { const v = get(k); return v == null ? null : parseFloat(v); };
  const cpuName0 = get("CPU") || "";
  const gpus = (get("GPU") || "").split(/\s*\+\s*/).filter(Boolean).map((item) => {
    // Dạng "tên|VRAM MB|mã PCI|phiên bản driver" — các phần sau có thể thiếu
    const [nameRaw, mbRaw, dev, driver] = item.split("|");
    const name = nameRaw.trim();
    const mb = parseInt(mbRaw || "0", 10) || 0;
    let e = matchGpu(dev ? `${name} (0x0000${dev})` : name);
    // Card onboard luôn đi theo con chip → tên CPU cụ thể hơn cả mã PCI
    // (mã 15BF dùng chung cho 7840U lẫn Z1 Extreme, nhưng Z1 Extreme bị giới hạn điện hơn)
    if (!e || GENERIC_IGPU.has(e[0]) || e[2] === 0) e = igpuFromCpu(cpuName0) || e;
    return {
      name, key: e ? e[0] : null, idx: e ? e[1] : null,
      vram: mb > 0 ? Math.round(mb / 1024 * 10) / 10 : (e && e[2] ? e[2] : null),
      integrated: e ? e[2] === 0 : /uhd|iris|radeon\(tm\) graphics|radeon graphics|arc graphics|vega/i.test(name),
      handheld: !!(e && e[4] === "hh"), vendor: GPU_VENDOR(name), driver: driver || null,
    };
  });
  // Card rời trước — đó mới là card dùng chơi game
  gpus.sort((a, b) => ((b.integrated ? 0 : 1e5) + (b.idx || 50)) - ((a.integrated ? 0 : 1e5) + (a.idx || 50)));
  const threads = numv("THREADS"), cores = numv("CORES");
  const cpuName = get("CPU") || "";
  const sc = cpuScore(cpuName, threads);
  const st = numv("ST");
  // Điểm đơn nhân đo bằng app (C#) — hiệu chỉnh: Z1 Extreme 485 → 106
  const measuredIdx = st ? Math.round((st / 4.6) * coreScale(cores || (threads ? threads / 2 : 4))) : null;
  const res = /(\d+)\s*x\s*(\d+)/i.exec(get("RES") || "");
  return {
    source: "app", at: Date.now(), specs,
    gpus, gpu: gpus[0] || null,
    cpu: {
      name: cpuName, idx: sc ? sc.idx : measuredIdx, measuredIdx,
      conf: sc && sc.via === "db" ? "ok" : "model", threads, cores, smt: threads && cores ? threads > cores : null,
      l2: numv("L2KB"), l3: numv("L3KB"), mhz: numv("MHZ"),
    },
    ram: { gb: numv("RAM"), usable: numv("USABLE"), exact: true, slots: numv("SLOTS"), mhz: numv("RAMMHZ") },
    os: { name: get("OS"), extra: get("ARCH") || "", build: numv("OSBUILD") },
    disk: numv("DISK"),
    // SSD: "NVMe" / "SATA" / "none" — null nếu Windows không cho đọc
    ssd: get("SSD") ? get("SSD") !== "none" : null,
    ssdKind: get("SSD") && get("SSD") !== "none" ? get("SSD") : null,
    // Mức DirectX thật của card, vd "12_1" → 12.1
    dxfl: get("DXFL") ? parseFloat(get("DXFL").replace("_", ".")) : null,
    isa: get("ISA") ? get("ISA").split(",") : null,
    screen: res ? { w: +res[1], h: +res[2], hz: numv("HZ") } : null,
    laptop: get("BATTERY") === "1" ? true : get("BATTERY") === "0" ? false : null,
    threads,
  };
}
