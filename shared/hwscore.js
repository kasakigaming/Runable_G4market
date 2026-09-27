// ============================================================================
// Bảng phần cứng + bộ chấm điểm — dùng chung cho web (trình duyệt) và công cụ (Node).
// Thang điểm: RTX 3060 = 100 (GPU) · Core i5-12400F = 100 (CPU, hiệu năng chơi game).
// GPU tầm trung đã đối chiếu 3DMark Steel Nomad + PassMark G3D (lệch trong ~10%).
// Chuỗi phần cứng không có trong bảng → giải mã số hiệu model (đời, hạng, hậu tố).
// ============================================================================

// [khoá, điểm, VRAM GB, tên hiển thị?, cờ?]   cờ: hh = máy cầm tay, dc = máy chủ, vd = card ảo
export const GPUS = [
  // --- NVIDIA RTX 50 ---
  ["rtx 5090",550,32],["rtx 5080",356,16],["rtx 5070 ti",305,16],["rtx 5070",247,12],
  ["rtx 5060 ti",178,16],["rtx 5060",144,8],["rtx 5050",105,8],
  ["rtx 5090 laptop",300,24],["rtx 5080 laptop",250,16],["rtx 5070 ti laptop",200,12],
  ["rtx 5070 laptop",172,8],["rtx 5060 laptop",132,8],["rtx 5050 laptop",95,8],
  // --- NVIDIA RTX 40 ---
  ["rtx 4090",414,24],["rtx 4080 super",328,16],["rtx 4080",316,16],
  ["rtx 4070 ti super",264,16],["rtx 4070 ti",252,12],["rtx 4070 super",226,12],["rtx 4070",194,12],
  ["rtx 4060 ti",147,8],["rtx 4060",117,8],
  ["rtx 4090 laptop",247,16],["rtx 4080 laptop",213,12],["rtx 4070 laptop",155,8],
  ["rtx 4060 laptop",121,8],["rtx 4050 laptop",90,6],
  // --- NVIDIA RTX 30 ---
  ["rtx 3090 ti",247,24],["rtx 3090",218,24],["rtx 3080 ti",213,12],["rtx 3080",199,10],
  ["rtx 3070 ti",170,8],["rtx 3070",161,8],["rtx 3060 ti",136,8],["rtx 3060",100,12],
  ["rtx 3050 ti",75,4],["rtx 3050",68,8],
  ["rtx 3080 ti laptop",150,16],["rtx 3080 laptop",138,16],["rtx 3070 ti laptop",122,8],
  ["rtx 3070 laptop",115,8],["rtx 3060 laptop",94,6],["rtx 3050 ti laptop",66,4],["rtx 3050 laptop",60,4],
  // --- NVIDIA RTX 20 / GTX 16 ---
  ["rtx 2080 ti",163,11],["rtx 2080 super",132,8],["rtx 2080",124,8],["rtx 2070 super",118,8],
  ["rtx 2070",106,8],["rtx 2060 super",99,8],["rtx 2060",86,6],
  ["rtx 2070 laptop",88,8],["rtx 2060 laptop",75,6],
  ["gtx 1660 ti",68,6],["gtx 1660 super",66,6],["gtx 1660",61,6],
  ["gtx 1650 super",57,4],["gtx 1650",41,4],["gtx 1630",26,4],
  ["gtx 1660 ti laptop",60,6],["gtx 1650 ti laptop",42,4],["gtx 1650 laptop",38,4],
  // --- NVIDIA GTX 10 & cũ ---
  ["gtx 1080 ti",113,11],["gtx 1080",84,8],["gtx 1070 ti",76,8],["gtx 1070",70,8],
  ["gtx 1060 6gb",49,6],["gtx 1060 3gb",46,3],["gtx 1060",48,6],["gtx 1050 ti",29,4],["gtx 1050",23,2],
  ["gtx 980 ti",73,6],["gtx 980",63,4],["gtx 970",49,3.5],["gtx 960",30,2],["gtx 950",26,2],
  ["gtx 780",38,3],["gtx 770",33,2],["gtx 760",26,2],["gtx 750 ti",16,2],["gtx 750",13,1],
  ["gtx 680",30,2],["gtx 660",19,2],["gt 1030",15,2],["gt 730",5,2],["gt 710",3,1],
  ["quadro p1000",22,4],["quadro t1000",45,4],["tesla",60,8],
  // --- AMD RX 9000 / 7000 ---
  ["rx 9070 xt",282,16],["rx 9070",247,16],["rx 9060 xt",155,16],
  ["rx 7900 xtx",345,24],["rx 7900 xt",293,20],["rx 7900 gre",241,16],
  ["rx 7800 xt",207,16],["rx 7700 xt",172,12],["rx 7650 gre",124,8],["rx 7600 xt",124,16],["rx 7600",117,8],
  // --- AMD RX 6000 ---
  ["rx 6950 xt",232,16],["rx 6900 xt",218,16],["rx 6800 xt",201,16],["rx 6800",178,16],
  ["rx 6750 xt",144,12],["rx 6700 xt",132,12],["rx 6700",118,10],["rx 6650 xt",106,8],
  ["rx 6600 xt",95,8],["rx 6600",80,8],["rx 6500 xt",49,4],["rx 6400",37,4],
  // --- AMD RX 5000 & cũ ---
  ["rx 5700 xt",103,8],["rx 5700",92,8],["rx 5600 xt",80,6],["rx 5500 xt",54,8],
  ["rx 590",53,8],["rx 580",49,8],["rx 570",43,8],["rx 560",22,4],["rx 550",15,2],
  ["rx 480",47,8],["rx 470",41,4],["rx 460",20,2],
  ["r9 390",44,8],["r9 380",31,4],["r9 290",38,4],["r7 370",24,2],["r7 260",14,2],["vega 64",73,8],["vega 56",63,8],
  // --- Intel Arc ---
  ["arc b580",167,12],["arc b570",144,10],["arc a770",147,16],["arc a750",132,8],
  ["arc a580",109,8],["arc a380",52,6],["arc a310",30,4],
  // --- Máy chơi game cầm tay (điểm tính ở mức TDP mặc định) ---
  ["z2 extreme",48,0,"AMD Ryzen Z2 Extreme — ROG Ally 2 / Legion Go 2","hh"],
  ["z1 extreme",33,0,"AMD Ryzen Z1 Extreme — ROG Ally, Ally X, Legion Go","hh"],
  ["z2 go",25,0,"AMD Ryzen Z2 Go — Legion Go S","hh"],
  ["z1 non",14,0,"AMD Ryzen Z1 — ROG Ally bản thường","hh"],
  ["steam deck",15,0,"Steam Deck / Steam Deck OLED","hh"],
  ["msi claw",24,0,"MSI Claw — Intel Arc iGPU","hh"],
  // --- iGPU ---
  ["radeon 890m",48,0],["radeon 880m",41,0],["radeon 780m",40,0],["radeon 760m",31,0],
  ["radeon 740m",22,0],["radeon 680m",33,0],["radeon 660m",22,0],["radeon 610m",6,0],
  ["vega 11",16,0],["vega 8",13,0],["vega 7",12,0],["vega 6",10,0],["vega 3",6,0],
  ["radeon graphics",12,0],
  ["arc 140v",45,0],["arc 130v",36,0],["arc graphics",38,0],
  ["iris xe",18,0],["iris plus",10,0],["iris pro",7,0],
  ["uhd graphics 770",8,0],["uhd graphics 750",7,0],["uhd graphics 730",6,0],
  ["uhd graphics 630",5,0],["uhd graphics 620",4.5,0],["uhd graphics 600",2.5,0],["uhd graphics",5,0],
  ["hd graphics 630",5,0],["hd graphics 620",4.5,0],["hd graphics 530",4,0],
  ["hd graphics 520",3.5,0],["hd graphics 4600",2.6,0],["hd graphics 4000",2,0],["hd graphics",2,0],
  // --- Apple ---
  ["m4 max",276,24],["m4 pro",161,16],["m4",92,10],
  ["m3 max",241,24],["m3 pro",132,12],["m3",80,10],
  ["m2 max",218,20],["m2 pro",126,12],["m2",71,10],
  ["m1 ultra",260,32],["m1 max",195,20],["m1 pro",109,12],["m1",61,8],
  // --- GPU trung tâm dữ liệu & chuyên dụng (hay gặp khi passthrough vào máy ảo) ---
  ["l40s",290,48,"NVIDIA L40S — máy chủ","dc"],
  ["rtx 6000 ada",330,48,"NVIDIA RTX 6000 Ada","dc"],
  ["rtx 5000 ada",250,32,"NVIDIA RTX 5000 Ada","dc"],
  ["rtx 4000 ada",170,20,"NVIDIA RTX 4000 Ada","dc"],
  ["a100",165,40,"NVIDIA A100 — máy chủ","dc"],
  ["a10g",150,24,"NVIDIA A10G — AWS G5","dc"],
  ["a10",150,24,"NVIDIA A10 — máy chủ","dc"],
  ["a16",70,16,"NVIDIA A16 — vGPU","dc"],
  ["l4",125,24,"NVIDIA L4 — máy chủ","dc"],
  ["rtx a6000",215,48,"NVIDIA RTX A6000","dc"],
  ["rtx a5000",190,24,"NVIDIA RTX A5000","dc"],
  ["rtx a4000",140,16,"NVIDIA RTX A4000","dc"],
  ["rtx a2000",95,12,"NVIDIA RTX A2000","dc"],
  ["tesla v100",135,16,"NVIDIA Tesla V100","dc"],
  ["tesla p100",85,16,"NVIDIA Tesla P100","dc"],
  ["tesla t4",75,16,"NVIDIA Tesla T4","dc"],
  ["tesla p40",70,24,"NVIDIA Tesla P40","dc"],
  ["tesla p4",45,8,"NVIDIA Tesla P4","dc"],
  ["tesla m60",45,8,"NVIDIA Tesla M60","dc"],
  ["grid k520",25,4,"NVIDIA GRID K520","dc"],
  ["quadro rtx 5000",150,16,"NVIDIA Quadro RTX 5000","dc"],
  ["quadro rtx 4000",110,8,"NVIDIA Quadro RTX 4000","dc"],
  ["quadro p4000",70,8,"NVIDIA Quadro P4000","dc"],
  ["quadro m4000",40,8,"NVIDIA Quadro M4000","dc"],
  ["radeon pro v520",80,8,"AMD Radeon Pro V520 — AWS","dc"],
  ["radeon pro w6800",150,32,"AMD Radeon Pro W6800","dc"],
  ["instinct mi25",90,16,"AMD Instinct MI25","dc"],
  // --- Card màn hình ảo: không có GPU thật, chỉ dựng hình bằng CPU ---
  ["vmware svga",1,1,"VMware SVGA — không có GPU thật","vd"],
  ["virtualbox graphics",1,1,"VirtualBox — không có GPU thật","vd"],
  ["virgl",2,1,"VirGL / QEMU — GPU ảo","vd"],
  ["qxl",1,1,"QXL / SPICE — không có GPU thật","vd"],
  ["hyper-v video",1,1,"Hyper-V — không có GPU thật","vd"],
  ["remote display",1,1,"Remote Desktop — không có GPU thật","vd"],
  ["parsec virtual display",1,1,"Parsec Virtual Display","vd"],
  // --- fallback: dựng hình bằng phần mềm ---
  ["swiftshader",1,1,"SwiftShader — dựng hình bằng CPU","vd"],
  ["llvmpipe",1,1,"llvmpipe — dựng hình bằng CPU","vd"],
  ["microsoft basic render",1,1,"Microsoft Basic Render — không có GPU","vd"],
  // --- Card đời cũ hay xuất hiện trong yêu cầu cấu hình game ---
  ["gtx titan x",70,12],["gtx 690",30,4],["gtx 670",25,2],["gtx 660 ti",22,2],
  ["gtx 650 ti boost",17,2],["gtx 650 ti",12,1],["gtx 650",9,1],["gt 640",6,2],["gt 630",4,1],
  ["gt 440",3,1],["gt 430",2.5,1],["gt 1010",7,2],
  ["gtx 590",20,3],["gtx 580",17,1.5],["gtx 570",15,1.25],["gtx 560 ti",13,1],["gtx 560",11,1],
  ["gtx 550 ti",8,1],["gts 450",6,1],["gtx 480",15,1.5],["gtx 470",13,1.25],["gtx 465",11,1],
  ["gtx 460",10,1],["gts 250",4,0.5],["gtx 285",5,1],["gtx 280",4.5,1],["gtx 260",4,0.9],
  ["9800 gt",3,0.5],["9600 gt",2,0.5],["8800 gt",3,0.5],["8600",1,0.25],
  ["r9 fury x",60,4],["r9 fury",55,4],["r9 nano",52,4],["r9 390x",47,8],["r9 380x",34,4],
  ["r9 290x",42,4],["r9 285",30,2],["r9 280x",30,3],["r9 280",27,3],["r9 270x",22,2],["r9 270",20,2],
  ["r7 265",17,2],["r7 260x",14,2],["r7 250",8,1],["r7 240",5,1],["r5 230",2,1],["r5 200",3,1],
  ["radeon vii",95,16],
  ["hd 7990",50,6],["hd 7970",28,3],["hd 7950",24,3],["hd 7870",20,2],["hd 7850",17,2],
  ["hd 7790",13,1],["hd 7770",11,1],["hd 7750",8,1],["hd 7670",5,1],
  ["hd 6990",25,4],["hd 6970",14,2],["hd 6950",13,2],["hd 6870",11,1],["hd 6850",10,1],
  ["hd 6770",7,1],["hd 6750",6.5,1],["hd 6670",5,1],["hd 6570",3.5,1],
  ["hd 5970",20,2],["hd 5870",13,1],["hd 5850",11,1],["hd 5770",7,1],["hd 5750",6,1],["hd 5670",3.5,0.5],
  ["hd 4870",5,0.5],["hd 4850",4.5,0.5],["hd 3600",1,0.25],["hd 2600",1,0.25],["x800",0.5,0.25],
  ["hd graphics 3000",1.2,0],["hd graphics 2000",0.8,0],["hd graphics 4400",2.3,0],
  ["hd graphics 5500",3,0],["hd graphics 6000",3.5,0],["iris pro 580",8,0],
  ["adreno x1",18,0],["adreno x2",30,0]
];

/* Mã thiết bị PCI → nhận diện iGPU khi Windows chỉ báo "AMD Radeon Graphics" */
export const DEVICE_IDS = {
  "15bf":"radeon 780m",  // Phoenix1 — cũng chính là Z1 Extreme / 7840U / 8840U
  "15c8":"radeon 740m",  // Phoenix2
  "150e":"radeon 890m",  // Strix Point
  "164e":"radeon 610m",  // Raphael (2 CU)
  "163f":"steam deck",   // Van Gogh
  "1681":"radeon 680m",  // Rembrandt
  "1638":"vega 8",       // Cezanne
  "1636":"vega 8",       // Renoir
  "164c":"vega 8"        // Lucienne
};

// [tên, điểm game, luồng, nhân, điểm đơn nhân, L2 KB/nhân, L3 MB, cờ]  cờ: h = nhân lớn/nhỏ, s = máy chủ, arm
export const CPUS = [
  // ---- AMD để bàn ----
  ["Ryzen 9 9950X3D",168,32,16,125,1024,64],
  ["Ryzen 9 9950X",150,32,16,124,1024,64],
  ["Ryzen 7 9800X3D",165,16,8,122,1024,96],
  ["Ryzen 7 9700X",132,16,8,122,1024,32],
  ["Ryzen 5 9600X",130,12,6,120,1024,32],
  ["Ryzen 9 7950X3D",152,32,16,118,1024,128],
  ["Ryzen 9 7950X",135,32,16,120,1024,64],
  ["Ryzen 9 7900X",130,24,12,119,1024,64],
  ["Ryzen 7 7800X3D",150,16,8,112,1024,96],
  ["Ryzen 7 7700X",125,16,8,118,1024,32],
  ["Ryzen 5 7600X",122,12,6,117,1024,32],
  ["Ryzen 5 7600",120,12,6,115,1024,32],
  ["Ryzen 5 7500F",118,12,6,113,1024,32],
  ["Ryzen 7 5800X3D",125,16,8,100,512,96],
  ["Ryzen 7 5700X3D",118,16,8,96,512,96],
  ["Ryzen 9 5900X",105,24,12,105,512,64],
  ["Ryzen 7 5800X",102,16,8,102,512,32],
  ["Ryzen 7 5700X",100,16,8,96,512,32],
  ["Ryzen 5 5600X",100,12,6,98,512,32],
  ["Ryzen 5 5600",98,12,6,96,512,32],
  ["Ryzen 5 5500",82,12,6,92,512,16],
  ["Ryzen 7 3700X",82,16,8,82,512,32],
  ["Ryzen 5 3600",78,12,6,82,512,32],
  ["Ryzen 3 3100",62,8,4,80,512,16],
  ["Ryzen 5 2600",60,12,6,72,512,16],
  ["Ryzen 5 1600",52,12,6,65,512,16],
  ["FX-8300",28,8,8,42,2048,8],
  // ---- AMD laptop & máy cầm tay ----
  ["Ryzen AI 9 HX 370",120,24,12,118,1024,24,"h"],
  ["Ryzen AI 9 365",112,20,10,115,1024,24,"h"],
  ["Ryzen Z2 Extreme — ROG Ally 2",105,16,8,115,1024,24,"h"],
  ["Ryzen 9 8945HS",116,16,8,113,1024,16],
  ["Ryzen 9 7940HS",115,16,8,112,1024,16],
  ["Ryzen 7 8845HS",112,16,8,110,1024,16],
  ["Ryzen 7 7840HS",110,16,8,110,1024,16],
  ["Ryzen 7 8840U",96,16,8,108,1024,16],
  ["Ryzen 7 7840U",95,16,8,107,1024,16],
  ["Ryzen Z1 Extreme — ROG Ally / Legion Go",92,16,8,106,1024,16],
  ["Ryzen 7 7735HS",100,16,8,100,512,16],
  ["Ryzen 7 6800H",98,16,8,100,512,16],
  ["Ryzen 7 5800H",92,16,8,92,512,16],
  ["Ryzen 7 4800H",80,16,8,80,512,8],
  ["Ryzen 5 7640HS",95,12,6,105,1024,16],
  ["Ryzen 5 7535HS",90,12,6,98,512,16],
  ["Ryzen 5 5600H",85,12,6,92,512,16],
  ["Ryzen Z1 — ROG Ally bản thường",68,12,6,100,1024,16],
  ["Ryzen Z2 Go — Legion Go S",72,8,4,95,512,16],
  ["Steam Deck APU (Van Gogh)",45,8,4,62,512,4],
  // ---- Intel để bàn ----
  ["Core i9-14900K",145,32,24,135,2048,36,"h"],
  ["Core i7-14700K",138,28,20,130,2048,33,"h"],
  ["Core i5-14600K",130,20,14,122,2048,24,"h"],
  ["Core i5-14400F",112,16,10,112,2048,20,"h"],
  ["Core i9-13900K",140,32,24,130,2048,36,"h"],
  ["Core i7-13700K",133,24,16,126,2048,30,"h"],
  ["Core i5-13600K",125,20,14,120,2048,24,"h"],
  ["Core i5-13400F",110,16,10,110,1280,20,"h"],
  ["Core i9-12900K",128,24,16,118,1280,30,"h"],
  ["Core i7-12700K",120,20,12,115,1280,25,"h"],
  ["Core i5-12600K",115,16,10,113,1280,20,"h"],
  ["Core i5-12400F",100,12,6,100,1280,18],
  ["Core i3-12100F",88,8,4,102,1280,12],
  ["Core Ultra 9 285K",140,24,24,132,3072,36,"h"],
  ["Core Ultra 7 265K",135,20,20,128,3072,30,"h"],
  ["Core Ultra 5 245K",125,14,14,124,3072,24,"h"],
  ["Core i7-11700",92,16,8,98,512,16],
  ["Core i5-11400F",84,12,6,92,512,12],
  ["Core i9-10900K",100,20,10,100,256,20],
  ["Core i7-10700K",92,16,8,97,256,16],
  ["Core i5-10400F",74,12,6,88,256,12],
  ["Core i3-10100",62,8,4,88,256,6],
  ["Core i9-9900K",95,16,8,95,256,16],
  ["Core i7-9700K",80,8,8,95,256,12],
  ["Core i5-9400F",66,6,6,85,256,9],
  ["Core i3-9100F",55,4,4,88,256,6],
  ["Core i7-8700K",85,12,6,92,256,12],
  ["Core i5-8400",68,6,6,85,256,9],
  ["Core i7-7700",70,8,4,86,256,8],
  ["Core i5-7500",50,4,4,82,256,6],
  ["Core i7-6700",62,8,4,80,256,8],
  ["Core i5-6500",45,4,4,78,256,6],
  ["Core i7-4790",55,8,4,76,256,8],
  ["Core i5-4460",38,4,4,68,256,6],
  ["Pentium G4560",32,4,2,70,256,3],
  ["Celeron / Pentium đời cũ",18,2,2,45,256,2],
  // ---- Intel laptop ----
  ["Core i9-14900HX",140,32,24,128,2048,36,"h"],
  ["Core i7-14650HX",125,24,16,120,2048,30,"h"],
  ["Core i7-13700H",108,20,14,115,1280,24,"h"],
  ["Core i7-13620H",105,16,10,115,1280,24,"h"],
  ["Core i5-13420H",88,12,8,105,1280,12,"h"],
  ["Core i7-12700H",105,20,14,110,1280,24,"h"],
  ["Core i5-12500H",98,16,12,108,1280,18,"h"],
  ["Core i5-12450H",85,12,8,100,1280,12,"h"],
  ["Core Ultra 7 155H — MSI Claw",90,22,16,108,2048,24,"h"],
  ["Core Ultra 7 258V",92,8,8,112,2560,12,"h"],
  ["Core i9-11980HK",98,16,8,102,1280,24],
  ["Core i7-11800H",90,16,8,95,1280,24],
  ["Core i7-11600H",86,12,6,97,1280,18],
  ["Core i5-11400H",84,12,6,93,1280,12],
  ["Core i5-11320H",76,8,4,95,1280,8],
  ["Core i5-11300H",74,8,4,94,1280,8],
  ["Core i7-11370H",82,8,4,98,1280,12],
  ["Core i5-11260H",80,12,6,90,1280,12],
  ["Core i7-10870H",84,16,8,92,256,16],
  ["Core i7-10750H",78,12,6,90,256,12],
  ["Core i5-10500H",72,12,6,89,256,12],
  ["Core i5-10300H",65,8,4,88,256,8],
  ["Core i7-9750H",72,12,6,88,256,12],
  ["Core i5-9300H",60,8,4,84,256,8],
  ["Core i7-8750H",68,12,6,84,256,9],
  ["Core i5-8300H",56,8,4,82,256,8],
  ["Core i7-7700HQ",55,8,4,78,256,6],
  ["Ryzen 7 6800HS",95,16,8,99,512,16],
  ["Ryzen 5 6600H",82,12,6,95,512,16],
  ["Ryzen 5 4600H",70,12,6,78,512,8],
  ["Ryzen 9 5900HX",96,16,8,95,512,16],
  ["Ryzen 7 5800HS",90,16,8,91,512,16],
  ["Ryzen 5 5500H",72,8,4,84,512,8],
  // ---- ARM ----
  ["Snapdragon X Elite",85,12,12,100,12288,6,"arm"],
  ["Apple M-series",110,10,10,120,4096,8,"arm"],
  // ---- CPU máy chủ / máy ảo ----
  // Số luồng để 0 = tuỳ ý, vì máy ảo chỉ cấp một lát cắt của con chip thật.
  // Điểm game tính động: điểm đơn nhân × hệ số theo số nhân được cấp.
  ["Xeon Platinum 8488C (Sapphire Rapids)",0,0,0,105,2048,105,"s"],
  ["Xeon Platinum 8375C (Ice Lake)",0,0,0,88,1280,54,"s"],
  ["Xeon Platinum 8370C (Ice Lake)",0,0,0,86,1280,48,"s"],
  ["Xeon Platinum 8272CL (Cascade Lake)",0,0,0,72,1024,36,"s"],
  ["Xeon Platinum 8171M (Skylake-SP)",0,0,0,68,1024,35,"s"],
  ["Xeon Platinum 8168 (Skylake-SP)",0,0,0,66,1024,33,"s"],
  ["Xeon Gold 6248R (Cascade Lake)",0,0,0,76,1024,35,"s"],
  ["Xeon Gold 6230 (Cascade Lake)",0,0,0,66,1024,28,"s"],
  ["Xeon Silver 4210 (Cascade Lake)",0,0,0,60,1024,14,"s"],
  ["Xeon E5-2699 v4 (Broadwell)",0,0,0,52,256,55,"s"],
  ["Xeon E5-2680 v4 (Broadwell)",0,0,0,52,256,35,"s"],
  ["Xeon E5-2673 v4 (Broadwell)",0,0,0,54,256,50,"s"],
  ["Xeon E5-2690 v3 (Haswell)",0,0,0,50,256,30,"s"],
  ["Xeon E5-2680 v3 (Haswell)",0,0,0,48,256,30,"s"],
  ["Xeon E5-2680 v2 (Ivy Bridge)",0,0,0,45,256,25,"s"],
  ["Xeon E5-2670 (Sandy Bridge)",0,0,0,42,256,20,"s"],
  ["Xeon W-2295 (Cascade Lake)",0,0,0,82,1024,24,"s"],
  ["Xeon E-2288G (Coffee Lake)",0,0,0,92,256,16,"s"],
  ["EPYC Genoa 9004 (Zen 4)",0,0,0,100,1024,384,"s"],
  ["EPYC Milan-X 7003X (Zen 3 + 3D cache)",0,0,0,80,512,768,"s"],
  ["EPYC Milan 7003 (Zen 3)",0,0,0,82,512,256,"s"],
  ["EPYC 7V13 (Azure, Zen 3)",0,0,0,80,512,256,"s"],
  ["EPYC Rome 7002 (Zen 2)",0,0,0,68,512,256,"s"],
  ["EPYC Naples 7001 (Zen 1)",0,0,0,52,512,64,"s"],
  ["Threadripper 7980X (Zen 4)",0,0,0,118,1024,256,"s"],
  ["Threadripper 5975WX (Zen 3)",0,0,0,105,512,128,"s"],
  ["Threadripper 3970X (Zen 2)",0,0,0,95,512,128,"s"],
  ["CPU máy ảo không rõ đời",0,0,0,70,512,32,"s"]
];

// ---------------------------------------------------------------------------
// GPU
// ---------------------------------------------------------------------------
export function normGpu(s) {
  return String(s || "").toLowerCase()
    .replace(/\(r\)|\(tm\)|®|™|\btm\b/g, " ")
    // Intel HD/UHD viết tắt → đúng khoá trong bảng (làm TRƯỚC khi bỏ chữ "intel")
    .replace(/intel\s*(?:uhd)\s*(?:graphics\s*)?(\d{3})/g, " uhd graphics $1 ")
    .replace(/intel\s*hd\s*(?:graphics\s*)?(\d{3,4})/g, " hd graphics $1 ")
    // "2080RTX" viết ngược → "rtx 2080"
    .replace(/\b(\d{4})\s*(rtx|gtx)\b/g, "$2 $1")
    .replace(/\(0x[0-9a-f]+\)/g, " ")
    .replace(/angle|direct3d\d*|vs_\d_\d|ps_\d_\d|opengl|metal renderer|d3d\d*|vulkan|pcie|sse2/g, " ")
    .replace(/nvidia|advanced micro devices|\bamd\b|\bati\b|intel|apple|corporation|inc\.?|geforce|qualcomm/g, " ")
    .replace(/\bradeon\b(?= *(rx|r9|r7|r5|hd|vega|pro|vii))/g, " ")
    .replace(/laptop gpu|mobile|max-?q( design)?/g, " laptop ")
    .replace(/(\d)\s*(ti|super|xt|xtx|gre)\b/g, "$1 $2")          // 750ti → 750 ti
    .replace(/\b(gtx|rtx|gts|gt|rx|hd|r9|r7|r5)(\d)/g, "$1 $2")   // gtx1060 → gtx 1060
    .replace(/\brx-(\d)/g, "rx $1")
    // AMD hay ghi thiếu "RX": "Radeon 5600XT" · "Radeon 6700 XT" → "rx 5600 xt"
    .replace(/\bradeon\s+(?=[5-9]\d{3}\b)/g, "rx ")
    .replace(/[^a-z0-9 .]/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Chuỗi có nhắc tới một model card cụ thể (dù chưa nhận ra) — khi đó KHÔNG được đoán theo VRAM
const NAMES_A_MODEL = /\b(gtx|rtx|gts|gt|rx|r[579]|hd|arc|iris|uhd|quadro|radeon|geforce|vega)\b\s*-?\s*[a-z]?\d{2,4}/i;

export const GPU_BY_KEY = new Map(GPUS.map((g) => [g[0], g]));

export function matchGpu(raw) {
  const n = " " + normGpu(raw) + " ";
  let best = null;
  for (const g of GPUS) {
    if (n.includes(" " + g[0] + " ") && (!best || g[0].length > best[0].length)) best = g;
  }
  if (!best) {
    for (const g of GPUS) {
      if (g[0].length > 4 && n.includes(g[0]) && (!best || g[0].length > best[0].length)) best = g;
    }
  }
  const generic = !best || ["radeon graphics", "arc graphics", "uhd graphics", "hd graphics"].includes(best[0]);
  if (generic) {
    const m = /0x0*([0-9a-f]{4})\b/i.exec(String(raw));
    if (m && DEVICE_IDS[m[1].toLowerCase()]) return GPU_BY_KEY.get(DEVICE_IDS[m[1].toLowerCase()]) || best;
  }
  return best;
}

// Điểm chuẩn hạng xx60 theo từng đời GeForce, hiệu chỉnh khớp bảng
const NV_BASE = { 4: 10, 5: 12, 6: 19, 7: 26, 9: 30, 10: 48, 16: 61, 20: 86, 30: 100, 40: 117, 50: 144 };
const NV_TIER = { 10: 0.14, 20: 0.2, 30: 0.3, 40: 0.42, 50: 0.58, 60: 1, 70: 1.45, 80: 1.8, 90: 2.3 };

function gpuHeuristic(s) {
  const n = normGpu(s);
  // "GTX 600 series", "GeForce 400 Series", "HD 7000 series": lấy card phổ thông nhất của dòng
  let m = /\b(?:gtx|gt|gts)?\s*(\d)00\s*series/.exec(n);
  if (m) { const g = +m[1]; if (NV_BASE[g]) return Math.round(NV_BASE[g] * 0.5 * 10) / 10; }
  m = /\bhd\s*(\d)000\s*series/.exec(n);
  if (m) return { 5: 5, 6: 5, 7: 8, 8: 9 }[m[1]] || 5;
  // GeForce theo số: 1060 · 2070 super · 960 · 560 ti
  m = /\b(?:gtx|rtx|gts|gt)?\s*(\d{3,4})\s*(ti|super)?\b/.exec(n);
  if (m && /gtx|rtx|gts|\bgt\b|nvidia|geforce/i.test(s)) {
    const num = m[1];
    let gen, tier;
    if (num.length === 4 && /^(10|16|20|30|40|50)/.test(num)) { gen = +num.slice(0, 2); tier = +num.slice(2); }
    else if (num.length === 3) { gen = +num[0]; tier = +num.slice(1); }
    else if (num.length === 4 && /^[6-9]/.test(num)) return 1.5;               // GeForce 6xxx–9xxx đời 2004–2008
    if (gen && NV_BASE[gen] && NV_TIER[tier]) {
      let v = NV_BASE[gen] * NV_TIER[tier];
      if (m[2] === "ti") v *= 1.18;
      if (m[2] === "super") v *= 1.1;
      return Math.round(v * 10) / 10;
    }
  }
  // Radeon HD cũ theo số: 7870 → đời 7, hạng 8
  m = /\bhd\s*(\d)(\d)(\d)0\b/.exec(n);
  if (m) {
    const gen = +m[1], cls = +m[2];
    const base = { 4: 2, 5: 5, 6: 6, 7: 10, 8: 10 }[gen] || 5;
    return Math.round(base * ({ 5: 0.4, 6: 0.55, 7: 0.8, 8: 1.4, 9: 2 }[cls] || 1) * 10) / 10;
  }
  // "Radeon 77XX" kiểu ghi đại khái
  m = /\b(\d)(\d)xx\b/.exec(n);
  if (m) return +m[1] >= 7 ? 9 : 5;
  // "AMD Radeon R5 series" — dòng card onboard của APU đời cũ
  m = /\br([579])\s*series/.exec(n);
  if (m) return { 5: 3, 7: 6, 9: 20 }[m[1]];
  return null;
}

// Số trơn sau khi tách "GTX 970 / 1060" · "GeForce 1080 Ti": thử lại với tiền tố gtx/rtx
function gpuBareNumber(s) {
  const m = /^\s*(?:nvidia\s*)?(?:geforce\s*)?(\d{3,4})\s*(ti|super)?\s*(?:\(?\d+\s*gb\)?)?\s*$/i.exec(s);
  if (!m) return null;
  for (const p of ["rtx ", "gtx "]) {
    const e = GPU_BY_KEY.get((p + m[1] + (m[2] ? " " + m[2].toLowerCase() : "")).trim());
    if (e) return e;
  }
  return null;
}

// Chỉ ghi VRAM hoặc DirectX, không ghi card cụ thể
function gpuFromVram(s, vram) {
  const v = vram || (() => {
    const m = /(\d+(?:\.\d+)?)\s*(gb|mb)/i.exec(s || "");
    return m ? (m[2].toLowerCase() === "mb" ? parseFloat(m[1]) / 1024 : parseFloat(m[1])) : null;
  })();
  if (v) {
    const t = [[0.25, 1], [0.5, 2], [1, 4], [2, 10], [3, 18], [4, 25], [6, 40], [8, 55], [12, 90]];
    for (const [lim, idx] of t) if (v <= lim) return idx;
    return 120;
  }
  if (/directx\s*12|dx\s*12/i.test(s)) return 10;
  if (/directx\s*11|dx\s*11/i.test(s)) return 5;
  if (/directx|shader model/i.test(s)) return 1.5;
  return null;
}

// Chấm điểm MỘT chuỗi card → { idx, via, name }
export function gpuScore(str) {
  if (!str || /^\s*(tbd|-|n\/a|none)\s*$/i.test(str)) return null;
  const e = matchGpu(str);
  if (e && e[0] !== "hd graphics" && e[0] !== "uhd graphics" && e[0] !== "radeon graphics")
    return { idx: e[1], via: "db", name: e[3] || e[0] };
  const bare = gpuBareNumber(str);
  if (bare) return { idx: bare[1], via: "db", name: bare[3] || bare[0] };
  const h = gpuHeuristic(str);
  if (h != null) return { idx: h, via: "model", name: str };
  if (e) return { idx: e[1], via: "db", name: e[3] || e[0] };
  // Có nhắc tên model mà không hiểu → thà bỏ qua còn hơn đoán bừa theo VRAM
  if (NAMES_A_MODEL.test(str)) return null;
  const v = gpuFromVram(str);
  if (v != null) return { idx: v, via: "vram", name: str };
  return null;
}

// ---------------------------------------------------------------------------
// CPU
// ---------------------------------------------------------------------------
const INTEL_I5 = { 1: 28, 2: 38, 3: 42, 4: 46, 5: 47, 6: 50, 7: 53, 8: 67, 9: 67, 10: 74, 11: 84, 12: 100, 13: 110, 14: 114 };
const RYZEN_R5 = { 1: 52, 2: 60, 3: 78, 4: 72, 5: 96, 6: 86, 7: 118, 8: 108, 9: 130 };

// Mã model: "i5-12400f" · "ryzen 5 3600x" · "fx-8350" → khoá để khớp chính xác
function cpuModelKey(s) {
  const n = String(s).toLowerCase().replace(/\(r\)|\(tm\)|®|™/g, " ")
    .replace(/\bamd\s+r([3579])\s+(\d{4})/g, "ryzen $1 $2");   // "AMD r5 3600" → ryzen 5 3600
  let m = /\bi([3579])[- ]?(\d{3,5})([a-z]{0,2})\b/.exec(n);
  if (m) return "i" + m[1] + "-" + m[2] + m[3].replace(/f$/, "");
  m = /ryzen\s*(?:ai\s*)?(\d)\s*(?:pro\s*)?(\d{4})\s*([a-z0-9]{0,4})\b/.exec(n);
  if (m) return "r" + m[1] + "-" + m[2] + m[3];
  m = /core\s*ultra\s*(\d)\s*(\d{3})([a-z]{0,2})/.exec(n);
  if (m) return "u" + m[1] + "-" + m[2] + m[3];
  return null;
}
const CPU_BY_MODEL = new Map();
for (const c of CPUS) { const k = cpuModelKey(c[0]); if (k && !CPU_BY_MODEL.has(k)) CPU_BY_MODEL.set(k, c); }

export const isServerCpu = (c) => (c[7] || "").includes("s");

// Game chỉ dùng được vài nhân đầu — thêm nhân nữa gần như không tăng FPS
export function coreScale(n) {
  if (!n || n < 1) return 1;
  if (n <= 1) return 0.38; if (n <= 2) return 0.62; if (n <= 3) return 0.76; if (n <= 4) return 0.87;
  if (n <= 5) return 0.95; if (n <= 7) return 1.0; if (n <= 11) return 1.05; return 1.1;
}

function cpuHeuristic(s) {
  const n = String(s).toLowerCase().replace(/\(r\)|\(tm\)|®|™/g, " ").replace(/\s+/g, " ")
    .replace(/\bamd\s+r([3579])\s+(\d{4})/g, "ryzen $1 $2");
  // Intel Core iN-XXXX
  let m = /\bi([3579])[- ]?(\d{3,5})([a-z]{0,2})\b/.exec(n);
  if (m) {
    const tier = +m[1], num = m[2], suf = m[3];
    const gen = num.length === 5 ? +num.slice(0, 2) : num.length === 4 ? +num[0] : 1;
    let v = INTEL_I5[gen] || 45;
    v *= tier === 3 ? (gen <= 7 ? 0.72 : 0.84) : tier === 7 ? 1.12 : tier === 9 ? 1.18 : 1;
    if (/^k/.test(suf)) v *= 1.05; else if (suf === "t") v *= 0.9; else if (suf === "u") v *= 0.72;
    else if (suf === "hx") v *= 1.03; else if (/^h/.test(suf)) v *= 0.92; else if (suf === "p") v *= 0.85;
    else if (/^g\d?$/.test(suf)) v *= 0.75;
    return Math.round(v);
  }
  // "6th Generation Intel Core i5" · "Intel Core i7 11th gen"
  m = /(\d{1,2})(?:th|st|nd|rd)\s*gen(?:eration)?[^,;/]*?\bi([3579])\b|\bi([3579])\b[^,;/]*?(\d{1,2})(?:th|st|nd|rd)\s*gen/.exec(n);
  if (m) {
    const gen = +(m[1] || m[4]), tier = +(m[2] || m[3]);
    let v = INTEL_I5[gen] || 45;
    v *= tier === 3 ? (gen <= 7 ? 0.72 : 0.84) : tier === 7 ? 1.12 : tier === 9 ? 1.18 : 1;
    return Math.round(v);
  }
  // Ryzen N XXXX
  m = /ryzen\s*(\d)\s*(?:pro\s*)?(\d)(\d{3})\s*([a-z0-9]{0,4})\b/.exec(n);
  if (m) {
    const tier = +m[1], gen = +m[2], suf = m[4];
    let v = RYZEN_R5[gen] || 70;
    v *= tier === 3 ? 0.8 : tier === 7 ? 1.07 : tier === 9 ? 1.12 : 1;
    if (suf === "x3d") v *= 1.22; else if (suf === "x") v *= 1.03; else if (suf === "ge") v *= 0.85;
    else if (suf === "g") v *= 0.9; else if (suf === "u") v *= 0.75; else if (suf === "hx") v *= 1.02;
    else if (/^h/.test(suf)) v *= 0.9;
    return Math.round(v);
  }
  // Chỉ ghi hạng, không ghi model: "Intel Core i3" · "AMD Ryzen 5" · "Intel Core i7 or equivalent"
  m = /\bcore\s*i([3579])\b/.exec(n) || /\bi([3579])\b(?!-)/.exec(n);
  if (m) return Math.round(46 * ({ 3: 0.72, 5: 1, 7: 1.12, 9: 1.18 })[+m[1]]);
  m = /ryzen\s*([3579])\b/.exec(n);
  if (m) return Math.round(60 * ({ 3: 0.8, 5: 1, 7: 1.07, 9: 1.12 })[+m[1]]);
  if (/ryzen/.test(n)) return 52;
  // AMD đời cũ
  m = /\bfx[- ]?(\d)\d{3}/.exec(n);
  if (m) return { 4: 20, 6: 24, 8: 28, 9: 31 }[m[1]] || 24;
  if (/phenom\s*ii\s*x6/.test(n)) return 22;
  if (/phenom\s*ii/.test(n)) return 17;
  if (/phenom/.test(n)) return 9;
  m = /athlon\s*(\d{3,4})ge/.exec(n); if (m) return 26;
  if (/athlon\s*(\d{4})g/.test(n)) return 28;
  if (/athlon\s*ii|athlon\s*x2|athlon\s*64/.test(n)) return 9;
  m = /\ba(4|6|8|10|12)[- ](\d{4})/.exec(n);
  if (m) return { 4: 8, 6: 11, 8: 16, 10: 18, 12: 20 }[m[1]] || 14;
  // Intel đời rất cũ
  if (/core\s*2\s*quad|q6600|q9\d{3}/.test(n)) return 12;
  if (/core\s*2\s*duo|e8\d{3}|e7\d{3}|e6\d{3}/.test(n)) return 11;
  m = /pentium\s*(?:gold\s*)?g(\d)\d{3}/.exec(n);
  if (m) return { 3: 22, 4: 32, 5: 35, 6: 40, 7: 55 }[m[1]] || 30;
  if (/pentium\s*4|celeron|atom/.test(n)) return 5;
  if (/snapdragon\s*x/.test(n)) return 85;
  // Chỉ ghi xung + số nhân: "Quad-core 2.5 GHz" · "1.6 GHz processor"
  m = /(\d(?:\.\d+)?)\s*ghz/.exec(n);
  if (m) {
    const ghz = parseFloat(m[1]);
    const cores = /octa|8[- ]?core/.test(n) ? 8 : /hexa|6[- ]?core/.test(n) ? 6 : /quad|4[- ]?core/.test(n) ? 4
      : /dual|2[- ]?core/.test(n) ? 2 : 1;
    return Math.round(ghz * (cores >= 6 ? 10 : cores >= 4 ? 8 : cores >= 2 ? 5 : 3.5));
  }
  if (/quad[- ]?core/.test(n)) return 22;
  if (/dual[- ]?core/.test(n)) return 11;
  return null;
}

// Chấm điểm MỘT chuỗi CPU → { idx, via, name }
export function cpuScore(str, threadsForServer) {
  if (!str || /^\s*(tbd|-|n\/a|none)\s*$/i.test(str)) return null;
  const k = cpuModelKey(str);
  if (k && CPU_BY_MODEL.has(k)) {
    const c = CPU_BY_MODEL.get(k);
    return { idx: isServerCpu(c) ? Math.round(c[4] * coreScale(threadsForServer || 4)) : c[1], via: "db", name: c[0] };
  }
  // khớp tên có trong bảng (vd "Ryzen Z1 Extreme")
  const n = String(str).toLowerCase();
  let best = null;
  for (const c of CPUS) {
    const key = c[0].split(/[—(]/)[0].trim().toLowerCase();
    if (key.length > 5 && n.includes(key) && (!best || key.length > best[0].split(/[—(]/)[0].trim().length)) best = c;
  }
  if (best) return { idx: isServerCpu(best) ? Math.round(best[4] * coreScale(threadsForServer || 4)) : best[1], via: "db", name: best[0] };
  const h = cpuHeuristic(str);
  if (h != null) return { idx: h, via: "model", name: str };
  return null;
}

// ---------------------------------------------------------------------------
// Yêu cầu của game: nhiều lựa chọn "tương đương" ("GTX 1060 / RX 580 / Arc A380").
// Hãng ghi chúng như ngang nhau, nhưng thực tế lệch nhau: có game ghi kèm card onboard
// yếu hơn nhiều, có game ghi Intel Arc mạnh hơn hẳn (vì driver Arc kém ở game cũ).
// → Lấy TRUNG VỊ (nghiêng về thấp khi số lượng chẵn) để không bị một lựa chọn lạc lõng kéo lệch.
// ---------------------------------------------------------------------------
function reqLevel(scores) {
  const ok = scores.filter(Boolean).sort((a, b) => a.idx - b.idx);
  if (!ok.length) return null;
  return ok[Math.floor((ok.length - 1) / 2)];
}

export function reqGpu(req) {
  if (!req) return null;
  const alts = req.gpuAlts && req.gpuAlts.length ? req.gpuAlts : (req.gpu ? [req.gpu] : []);
  const lvl = reqLevel(alts.map(gpuScore));
  if (lvl) return lvl;
  const v = gpuFromVram(req.gpu || "", req.vram);
  return v != null ? { idx: v, via: "vram", name: req.gpu || (req.vram + " GB VRAM") } : null;
}

export function reqCpu(req) {
  if (!req) return null;
  const alts = req.cpuAlts && req.cpuAlts.length ? req.cpuAlts : (req.cpu ? [req.cpu] : []);
  return reqLevel(alts.map((a) => cpuScore(a)));
}
