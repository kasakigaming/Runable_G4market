# RunableGames

**Dùng thử:** https://kasakigaming.github.io/Runable_G4market/

**Tải ứng dụng nhận diện:** [runable_g4market.exe](https://github.com/kasakigaming/Runable_G4market/releases/latest/download/runable_g4market.exe) — mục [Releases](https://github.com/kasakigaming/Runable_G4market/releases) có mã SHA-256 để kiểm tra file. Mã nguồn app nằm ở [`app/RunableG4Market.cs`](app/RunableG4Market.cs), tự build được bằng `app\build.bat`.

Máy của bạn có chạy nổi game này không? Quét cấu hình, so với **yêu cầu chính thức của nhà phát hành**, chấm điểm sức mạnh, xếp hạng với người chơi khác và gợi ý nâng cấp.

## 5 tính năng

| # | Tính năng | Chạy ở đâu | Độ chính xác |
|---|---|---|---|
| 1 | Quét bằng trình duyệt — GPU (cả 2 card trên laptop), số nhân thật, cache, pin, màn hình; CPU và RAM người dùng xác nhận nhanh | `assets/scan.js` | ~80% |
| 2 | Quét bằng `runable_g4market.exe` — tên CPU/GPU, RAM gắn thật và RAM Windows thấy, VRAM từ registry, số thanh RAM, bus, ổ trống | `app/` | ~100% |
| 3 | Chỉ số sức mạnh + cảnh giới (Luyện Khí → Đại La Kim Tiên) + "mạnh hơn X% người chơi" | `assets/engine.js` + backend | xếp hạng từ lượt kiểm tra thật |
| 4 | Tra **mọi game trên Steam, Epic Games Store, Microsoft Store (Xbox PC) và GOG** qua backend — không cần key nào; khi backend lỗi vẫn còn kho **~5.000 game Steam** có sẵn + game ngoài Steam (LMHT, Valorant, Genshin, FC Online, Đột Kích…) + **mọi game khác bằng cách dán yêu cầu cấu hình** → Chạy mượt / Chạy được / Chưa đủ, FPS ước lượng, linh kiện nghẽn | `data/catalog` + `shared/` | yêu cầu cấu hình chính thức |
| 5 | Gợi ý nâng cấp — linh kiện yếu nhất vẫn đủ đạt mức, kèm link mua (gắn affiliate được) | `assets/engine.js` | cần bạn điền giá để ra "rẻ nhất" |

## Cấu trúc

```
index.html, assets/        trang web (một trang, đổi trang bằng dấu #)
shared/hwscore.js          bảng ~300 GPU + ~150 CPU và bộ chấm điểm chuỗi phần cứng
shared/reqparse.js         đọc khối yêu cầu cấu hình của Steam, và chữ người dùng tự dán (cả nhãn tiếng Việt)
data/steam-popular.json    65 game Steam phổ biến nhất — dùng cho mục "Máy tôi chạy được game gì"
data/catalog/              kho ~5.000 game Steam: index.json (để tìm) + 64 mảnh sXX.json (yêu cầu từng game)
data/games-offsteam.json   game ngoài Steam — thêm game mới vào đây
backend/main.ts            backend Deno Deploy
backend/stores.ts          tìm game + đọc yêu cầu cấu hình trên Epic, Microsoft Store, GOG
app/RunableG4Market.cs     mã nguồn ứng dụng nhận diện
runable_g4market.exe       ứng dụng đã biên dịch (để cạnh trang cho người dùng tải)
tools/                     script lấy dữ liệu Steam và kiểm tra bộ chấm điểm
```

## Triển khai

### 1. Trang web — GitHub Pages (đã tự động)
Settings → Pages → Source: **GitHub Actions**. Workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) chạy mỗi lần đẩy lên `main` hoặc phát hành Release mới: gom file của trang, **lấy `runable_g4market.exe` từ Release mới nhất đặt cạnh `index.html`**, rồi deploy.
Exe phải cùng tên miền với trang thì trình duyệt mới cho đổi tên lúc tải — đó là cách mã phiên đi vào tên file. Vì vậy phát hành exe mới là trang tự cập nhật theo, không phải chép tay.
Không bật được backend thì trang vẫn chạy đủ: quét máy, tra ~5.000 game có sẵn, dán yêu cầu cho game khác, chấm điểm, gợi ý nâng cấp. Chỉ thiếu xếp hạng so với người khác và tra game Steam ít người chơi nằm ngoài kho.

### 2. Backend — Deno Deploy
1. dash.deno.com → **New Project** → link repo này → **Entry point: `backend/main.ts`**.
2. Tab **Databases** → tạo và gắn **1 KV database** (lưu lượt kiểm tra và bảng xếp hạng).
3. Tuỳ chọn, Settings → Environment Variables: `ALLOWED_ORIGINS = https://clonetest222.github.io` (không đặt thì cho mọi trang gọi).
4. Deploy → nhận địa chỉ dạng `https://<tên>.deno.dev`. Kiểm tra: mở `/health` phải ra `{"ok":true,"kv":true}`.

Backend **không cần secret nào**.

### 3. Nối mọi thứ lại
- `assets/config.js` → `BACKEND_URL: "https://<tên>.deno.dev"`
- `app/RunableG4Market.cs` → `PageUrl` (địa chỉ trang) và `BackendUrl` → chạy `app\build.bat` → ra `runable_g4market.exe` mới ở thư mục gốc.

## Cập nhật dữ liệu game
```
node tools/build-catalog.mjs                    # kho ~5.000 game (lần đầu ~2,5 giờ; chạy lại chỉ tra game mới/cũ quá 90 ngày)
node tools/build-catalog.mjs --pages 10         # mở rộng lên ~10.000 game
node tools/fetch-steam.mjs                      # lấy lại 65 game của mục "Máy tôi chạy được game gì" (~3 phút)
node tools/fetch-steam.mjs --add 2357570 "Hades II"   # thêm game theo appid hoặc tên
node tools/test-scoring.mjs                     # xem bộ chấm điểm hiểu được bao nhiêu % chuỗi phần cứng
```
Kho game tự cập nhật mỗi tuần qua workflow **Cập nhật kho game** (`.github/workflows/catalog.yml`): tra game mới nổi trên Steam, commit `data/catalog` rồi deploy lại trang. Muốn chạy ngay: tab Actions → Cập nhật kho game → Run workflow.

Game ngoài Steam: thêm vào `data/games-offsteam.json`. Game không có ở đâu cả: người dùng bấm **"Dán yêu cầu cấu hình"** ngay trong ô tìm kiếm — yêu cầu nằm luôn trong link kết quả nên gửi cho người khác được.

## Chạy thử trên máy
```
npx -y deno run -A --unstable-kv backend/main.ts     # backend ở http://localhost:8000
npx -y http-server -p 5500 -c-1 .                    # trang ở http://localhost:5500
```
Mở `http://localhost:5500/?api=http://localhost:8000`. Chạy app trỏ về máy mình:
`runable_g4market.exe --page "http://localhost:5500/?api=http://localhost:8000" --api http://localhost:8000`

## Luồng ứng dụng nhận diện

1. Web vào bước 3 → backend cấp `sid` → trang **tự tải** file với tên `runable_g4market (<sid>).exe` (thuộc tính `download`). Một file exe dùng chung cho mọi người, chỉ khác tên.
2. App đọc **chính tên file của nó** lấy `sid` (trình duyệt thêm " (1)" khi tải trùng vẫn đọc được). Không có `sid` thì backend mới đoán theo IP.
3. App vừa mở → `POST /api/ping` → web chuyển "đang chờ" sang "đang kiểm tra".
4. App đọc xong → `POST /api/check` → web hỏi mỗi 3 giây, nhận kết quả, sang bước Hoàn tất.
5. Hết giờ: app phải mở trong **60 giây**, chạy xong trong **90 giây**; sau 5 giây chưa thấy app thì hiện nhắc và mũi tên chỉ vào khu tải xuống.

App đọc: tên CPU, nhân/luồng, cache, **tập lệnh AVX/AVX2/AVX-512**, RAM gắn thật/Windows thấy/số thanh/bus, GPU + VRAM (registry) + **mã PCI** + **phiên bản driver**, **mức DirectX thật** (d3d11 + d3d12, nhận ra 12_2 Ultimate), **SSD/HDD/NVMe**, ổ trống, Windows + build, màn hình, có pin không. **Không** đọc phần mềm diệt virus, bản quyền Windows, trình duyệt, phần mềm đã cài hay bất kỳ file cá nhân nào.

Việc chấm "chạy được không" dựa trên **nhận dạng đúng linh kiện**, không dựa trên đo hiệu năng — biết chắc tên card thì tra bảng chính xác hơn mọi bài đo vài giây. Bài đo CPU trong app chỉ là dự phòng cho CPU lạ chưa có trong bảng (~1,5 giây).

## Giấy phép
[MIT](LICENSE). Dữ liệu yêu cầu cấu hình trong `data/` thuộc về các nhà phát hành game; tên và logo game thuộc chủ sở hữu tương ứng.

## Giới hạn cần biết
- **FPS là ước lượng**, neo theo yêu cầu của nhà phát hành (mức Đề xuất ≈ 1080p Cao 60 FPS, Tối thiểu ≈ 1080p Thấp 30 FPS). Muốn biết FPS thật thì chỉ có chạy game.
- Game ngoài Steam: chỉ **Liên Minh Huyền Thoại** đã đối chiếu trực tiếp với trang Riot. Valorant, Genshin, Fortnite, Minecraft, Honkai: Star Rail, Roblox lấy theo công bố của hãng nhưng trang gốc chặn đọc tự động — mở `sourceUrl` trong `data/games-offsteam.json` để kiểm lại.
- Xếp hạng "mạnh hơn X%" chỉ hiện khi đã có từ 10 lượt kiểm tra; mỗi IP tính 1 lần/ngày.
- App chưa có chữ ký số → Windows SmartScreen sẽ cảnh báo. Chứng thư ký số OV khoảng 200–400 USD/năm.
- Bảng điểm GPU tầm trung đã đối chiếu 3DMark Steel Nomad và PassMark (lệch trong ~10%); CPU và card đời cũ chấm theo đời + hạng của số hiệu model.
