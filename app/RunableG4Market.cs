// ============================================================================
// runable_g4market.exe — Ứng dụng nhận diện phần cứng của RunableGames
// Chỉ ĐỌC thông tin phần cứng qua WMI + registry, đo nhanh tốc độ CPU, rồi gửi về
// RunableGames để so với yêu cầu của mọi game. Không cài đặt, không ghi gì vào máy,
// không đọc file cá nhân. Gỡ bỏ: xoá file.
//
// Biên dịch bằng trình biên dịch .NET Framework có sẵn trong Windows: app\build.bat
// ============================================================================
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Management;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

static class Program
{
    // ---- Sửa 2 dòng này cho đúng địa chỉ của bạn (hoặc truyền --page / --api khi chạy) ----
    public static string PageUrl = "https://kasakigaming.github.io/Runable_G4market/";
    public static string BackendUrl = "";          // vd "https://runable-g4market.deno.dev" — để trống thì chỉ mở trang
    public const string Version = "1.0.1";

    // Mã phiên nằm ngay trong tên file: trang web tải về thành "runable_g4market (a1b2c3d4e5f6).exe".
    // Một file exe dùng chung cho mọi người, chỉ đổi tên lúc tải,
    // nên app biết đúng tab web đang chờ mà không cần đoán theo IP.
    public static string SessionId = null;

    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    [STAThread]
    static void Main(string[] args)
    {
        // runable_g4market.exe --page http://localhost:5500/ --api http://localhost:8000   (dùng khi thử nghiệm)
        for (int i = 0; i + 1 < args.Length; i++)
        {
            if (args[i] == "--page") PageUrl = args[i + 1];
            if (args[i] == "--api") BackendUrl = args[i + 1];
            if (args[i] == "--sid") SessionId = args[i + 1];
        }
        if (SessionId == null)
        {
            // Lấy nhóm trong ngoặc ĐẦU TIÊN — trình duyệt có thể thêm " (1)" khi tải trùng tên
            string name = Path.GetFileNameWithoutExtension(Application.ExecutablePath);
            var m = System.Text.RegularExpressions.Regex.Match(name, @"\(([0-9a-f]{8,16})\)");
            if (m.Success) SessionId = m.Groups[1].Value;
        }
        try { SetProcessDPIAware(); } catch { }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new DetectForm());
    }
}

// ============================================================================
// Cửa sổ — bố cục như "Hardware Detection": dải tiêu đề, hình laptop với 3 ô tích,
// dòng trạng thái, nút Huỷ, số phiên bản.
// ============================================================================
class DetectForm : Form
{
    static readonly Color Band = Color.FromArgb(244, 244, 244);
    static readonly Color Ink = Color.FromArgb(51, 51, 51);
    static readonly Color Grey = Color.FromArgb(150, 150, 150);
    static readonly Color Blue = Color.FromArgb(21, 101, 192);
    static readonly Color Green = Color.FromArgb(16, 185, 129);

    readonly Label status = new Label();
    readonly Label detail = new Label();
    readonly Button cancel = new Button();
    readonly Panel art = new DoubleBufferedPanel();
    readonly System.Windows.Forms.Timer anim = new System.Windows.Forms.Timer();
    int checks = 0;       // số ô đã tích (0..3)
    int pulse = 0;        // nhịp nhấp nháy cho ô đang làm
    bool finished = false;
    Thread worker;

    public DetectForm()
    {
        Text = "RunableGames — Nhận diện phần cứng";
        Font = new Font("Segoe UI", 9f);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(660, 440);
        BackColor = Color.White;
        Icon = MakeIcon();

        // --- Dải tiêu đề ---
        var head = new Panel { Dock = DockStyle.Top, Height = 84, BackColor = Band };
        head.Paint += (s, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            DrawLogo(g, new Rectangle(28, 18, 48, 48));
            using (var f = new Font("Segoe UI", 22f, FontStyle.Bold))
            using (var b = new SolidBrush(Ink))
                g.DrawString("Nhận diện phần cứng", f, b, new PointF(96, 20));
        };
        Controls.Add(head);

        // --- Dải dưới: nút Huỷ + phiên bản ---
        var foot = new Panel { Dock = DockStyle.Bottom, Height = 52, BackColor = Band };
        cancel.Text = "Huỷ";
        cancel.Size = new Size(104, 30);
        cancel.Anchor = AnchorStyles.None;
        cancel.Click += (s, e) => Close();
        foot.Controls.Add(cancel);
        foot.Resize += (s, e) => cancel.Location = new Point((foot.Width - cancel.Width) / 2, (foot.Height - cancel.Height) / 2);
        var ver = new Label { Text = "v " + Program.Version, ForeColor = Grey, AutoSize = true, BackColor = Band };
        foot.Controls.Add(ver);
        foot.Resize += (s, e) => ver.Location = new Point(foot.Width - ver.Width - 14, foot.Height - ver.Height - 8);
        Controls.Add(foot);

        // --- Giữa: hình minh hoạ + trạng thái ---
        art.Dock = DockStyle.Top;
        art.Height = 190;
        art.BackColor = Color.White;
        art.Paint += PaintArt;
        status.Text = "Đang kiểm tra máy…";
        status.Font = new Font("Segoe UI", 16f, FontStyle.Bold);
        status.ForeColor = Color.FromArgb(110, 110, 110);
        status.TextAlign = ContentAlignment.MiddleCenter;
        status.Dock = DockStyle.Top;
        status.Height = 40;
        detail.Text = "Đang nhận diện phần cứng và phần mềm trên máy bạn.\nKhông thu thập thông tin cá nhân.";
        detail.ForeColor = Grey;
        detail.TextAlign = ContentAlignment.TopCenter;
        detail.Dock = DockStyle.Top;
        detail.Height = 60;
        var body = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(0, 14, 0, 0) };
        body.Controls.Add(detail);
        body.Controls.Add(status);
        body.Controls.Add(art);
        Controls.Add(body);
        body.BringToFront();

        anim.Interval = 60;
        anim.Tick += (s, e) => { pulse++; art.Invalidate(); };
        Shown += (s, e) => { anim.Start(); worker = new Thread(Work) { IsBackground = true }; worker.Start(); };
    }

    // ---------------------------------------------------------------------
    // Công việc chạy nền
    // ---------------------------------------------------------------------
    void Work()
    {
        var f = new List<string>();
        // Báo ngay cho tab web: "app đã mở" — trang chuyển từ "đang chờ" sang "đang kiểm tra"
        Net.Ping();
        try
        {
            Hw.ReadCpu(f); Hw.ReadCpuFeatures(f); Hw.ReadMemory(f); Hw.ReadGpu(f); Hw.ReadDirectX(f);
            Hw.ReadOs(f); Hw.ReadDisk(f); Hw.ReadDiskType(f);
            Step(1, "Đang đo tốc độ CPU…", "Chạy thử vài giây để biết sức mạnh thật của CPU.");
            Hw.Benchmark(f);
            Step(2, "Đang gửi kết quả…", "Gửi cấu hình về RunableGames để so với yêu cầu của từng game.");
            string specs = string.Join("; ", f);
            string checkId = Net.PostCheck(specs);
            string url = Program.PageUrl + "#/app?specs=" + Uri.EscapeDataString(specs)
                + (checkId != null ? "&id=" + checkId : "");
            Step(3, "Hoàn tất!", "Đang mở kết quả trong trình duyệt. Bạn có thể xoá file này.");
            try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
            Done();
        }
        catch (Exception ex)
        {
            UI(() =>
            {
                status.Text = "Không đọc được cấu hình";
                detail.Text = ex.Message;
                cancel.Text = "Đóng";
                finished = true;
            });
        }
    }

    void Step(int n, string s, string d) { UI(() => { checks = n; status.Text = s; detail.Text = d; }); }
    void Done()
    {
        UI(() =>
        {
            finished = true;
            status.ForeColor = Green;
            cancel.Text = "Đóng";
            var t = new System.Windows.Forms.Timer { Interval = 4000 };
            t.Tick += (s, e) => { t.Stop(); Close(); };
            t.Start();
        });
    }
    void UI(Action a) { try { if (IsHandleCreated) BeginInvoke(a); } catch { } }

    // ---------------------------------------------------------------------
    // Vẽ laptop với 3 ô tích
    // ---------------------------------------------------------------------
    void PaintArt(object sender, PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        int w = art.Width;
        var screen = new Rectangle(w / 2 - 105, 16, 210, 128);
        using (var pen = new Pen(Grey, 7f))
        using (var path = Round(screen, 10))
            g.DrawPath(pen, path);
        using (var b = new SolidBrush(Grey))
        using (var baseBar = Round(new Rectangle(w / 2 - 125, 156, 250, 10), 5))
            g.FillPath(b, baseBar);

        for (int i = 0; i < 3; i++)
        {
            var box = new Rectangle(w / 2 - 78 + i * 56, 56, 44, 44);
            bool on = i < checks || finished;
            bool working = i == checks && !finished;
            int alpha = working ? 110 + (int)(90 * (0.5 + 0.5 * Math.Sin(pulse / 3.0))) : 255;
            using (var pen = new Pen(Color.FromArgb(alpha, Blue), 4f))
            using (var p = Round(box, 5))
                g.DrawPath(pen, p);
            if (on)
            {
                using (var pen = new Pen(Blue, 7f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
                    g.DrawLines(pen, new[] {
                        new Point(box.X + 9, box.Y + 22), new Point(box.X + 20, box.Y + 34), new Point(box.X + 42, box.Y + 2) });
            }
        }
    }

    static GraphicsPath Round(Rectangle r, int rad)
    {
        var p = new GraphicsPath();
        int d = rad * 2;
        p.AddArc(r.X, r.Y, d, d, 180, 90);
        p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    static void DrawLogo(Graphics g, Rectangle r)
    {
        using (var b = new SolidBrush(Color.FromArgb(10, 14, 19)))
        using (var p = Round(r, 10))
            g.FillPath(b, p);
        using (var f = new Font("Segoe UI", r.Height * 0.36f, FontStyle.Bold, GraphicsUnit.Pixel))
        {
            var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            using (var gb = new SolidBrush(Green))
                g.DrawString("RG", f, gb, r, sf);
        }
    }

    static Icon MakeIcon()
    {
        try
        {
            var bmp = new Bitmap(64, 64);
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
                DrawLogo(g, new Rectangle(0, 0, 64, 64));
            }
            return Icon.FromHandle(bmp.GetHicon());
        }
        catch { return SystemIcons.Application; }
    }

    class DoubleBufferedPanel : Panel { public DoubleBufferedPanel() { DoubleBuffered = true; ResizeRedraw = true; } }
}

// ============================================================================
// Gửi kết quả về backend (nếu đã cấu hình)
// ============================================================================
static class Net
{
    static string Sid() { return Program.SessionId != null ? ",\"sid\":" + Json(Program.SessionId) : ""; }

    // Báo "app đã mở" — chạy nền, lỗi thì bỏ qua
    public static void Ping()
    {
        if (string.IsNullOrEmpty(Program.BackendUrl)) return;
        new Thread(() => { try { Post("/api/ping", "{\"source\":\"app\"" + Sid() + "}", 5000); } catch { } }) { IsBackground = true }.Start();
    }

    public static string PostCheck(string specs)
    {
        if (string.IsNullOrEmpty(Program.BackendUrl)) return null;
        try
        {
            string txt = Post("/api/check", "{\"source\":\"app\"" + Sid() + ",\"specs\":" + Json(specs) + "}", 8000);
            var m = System.Text.RegularExpressions.Regex.Match(txt, "\"id\"\\s*:\\s*\"([a-z0-9]+)\"");
            return m.Success ? m.Groups[1].Value : null;
        }
        catch { return null; }   // không có mạng/backend → vẫn mở trang kèm cấu hình
    }

    static string Post(string path, string json, int timeout)
    {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        var req = (HttpWebRequest)WebRequest.Create(Program.BackendUrl.TrimEnd('/') + path);
        req.Method = "POST";
        req.ContentType = "application/json; charset=utf-8";
        req.UserAgent = "runable_g4market/" + Program.Version;
        req.Timeout = timeout;
        byte[] body = Encoding.UTF8.GetBytes(json);
        using (var s = req.GetRequestStream()) s.Write(body, 0, body.Length);
        using (var res = (HttpWebResponse)req.GetResponse())
        using (var rd = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
            return rd.ReadToEnd();
    }

    static string Json(string s)
    {
        var sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '"' || c == '\\') sb.Append('\\').Append(c);
            else if (c < 0x20) sb.AppendFormat("\\u{0:x4}", (int)c);
            else sb.Append(c);
        }
        return sb.Append('"').ToString();
    }
}

// ============================================================================
// Đọc phần cứng — WMI + registry. Chỉ đọc.
// ============================================================================
static class Hw
{
    // ---- Tập lệnh CPU: game mới hay đòi AVX2, CPU đời cũ thiếu là game văng ngay khi mở ----
    [DllImport("kernel32.dll")] static extern bool IsProcessorFeaturePresent(uint feature);
    public static void ReadCpuFeatures(List<string> f)
    {
        var have = new List<string>();
        try
        {
            if (IsProcessorFeaturePresent(38)) have.Add("SSE4.2");   // PF_SSE4_2_INSTRUCTIONS_AVAILABLE
            if (IsProcessorFeaturePresent(39)) have.Add("AVX");      // PF_AVX_INSTRUCTIONS_AVAILABLE
            if (IsProcessorFeaturePresent(40)) have.Add("AVX2");     // PF_AVX2_INSTRUCTIONS_AVAILABLE
            if (IsProcessorFeaturePresent(41)) have.Add("AVX512");   // PF_AVX512F_INSTRUCTIONS_AVAILABLE
        }
        catch { }
        if (have.Count > 0) Add(f, "ISA", string.Join(",", have));
    }

    // ---- Mức DirectX thật của card (feature level) — hỏi thẳng driver qua d3d11.dll ----
    [DllImport("d3d11.dll")]
    static extern int D3D11CreateDevice(IntPtr adapter, int driverType, IntPtr software, uint flags,
        int[] levels, uint numLevels, uint sdkVersion, out IntPtr device, out int level, out IntPtr context);
    public static void ReadDirectX(List<string> f)
    {
        // 12_2 = DirectX 12 Ultimate · 12_1 · 12_0 · 11_1 · 11_0 · 10_1 · 10_0
        var all = new[] { 0xc200, 0xc100, 0xc000, 0xb100, 0xb000, 0xa100, 0xa000 };
        foreach (int skip in new[] { 0, 3 })   // Windows cũ không hiểu mức 12_x → thử lại từ 11_1
        {
            try
            {
                var lv = all.Skip(skip).ToArray();
                IntPtr dev, ctx; int got;
                int hr = D3D11CreateDevice(IntPtr.Zero, 1 /* HARDWARE */, IntPtr.Zero, 0, lv, (uint)lv.Length, 7, out dev, out got, out ctx);
                if (hr >= 0)
                {
                    if (ctx != IntPtr.Zero) Marshal.Release(ctx);
                    if (dev != IntPtr.Zero) Marshal.Release(dev);
                    // d3d11 chỉ báo tối đa 12_1 — muốn biết 12_2 (DirectX 12 Ultimate) phải hỏi d3d12
                    if (got == 0xc100 && Supports12_2()) got = 0xc200;
                    Add(f, "DXFL", ((got >> 12) & 0xF) + "_" + ((got >> 8) & 0xF));
                    return;
                }
            }
            catch { }
        }
    }

    // Truyền con trỏ thiết bị rỗng = chỉ HỎI có hỗ trợ không, không tạo thiết bị thật.
    // Trả S_FALSE (1) nghĩa là hỗ trợ.
    [DllImport("d3d12.dll")]
    static extern int D3D12CreateDevice(IntPtr adapter, int minLevel, ref Guid riid, IntPtr device);
    static bool Supports12_2()
    {
        try
        {
            var iid = new Guid("189819f1-1db6-4b57-be54-1821339b85f7");   // IID_ID3D12Device
            return D3D12CreateDevice(IntPtr.Zero, 0xc200, ref iid, IntPtr.Zero) == 1;
        }
        catch { return false; }   // Windows không có d3d12.dll
    }

    // ---- SSD hay HDD: nhiều game mới ghi "SSD required" ----
    public static void ReadDiskType(List<string> f)
    {
        bool ssd = false, nvme = false, any = false;
        try
        {
            var scope = new ManagementScope(@"\\.\ROOT\Microsoft\Windows\Storage");
            using (var s = new ManagementObjectSearcher(scope, new ObjectQuery("SELECT MediaType, BusType FROM MSFT_PhysicalDisk")))
                foreach (ManagementObject o in s.Get())
                {
                    any = true;
                    int media = (int)D(o["MediaType"]), bus = (int)D(o["BusType"]);
                    if (media == 4 || bus == 17) ssd = true;   // 4 = SSD · BusType 17 = NVMe
                    if (bus == 17) nvme = true;
                }
        }
        catch { }
        if (any) Add(f, "SSD", ssd ? (nvme ? "NVMe" : "SATA") : "none", true);
    }

    public static void ReadCpu(List<string> f)
    {
        foreach (ManagementObject o in Q("SELECT * FROM Win32_Processor"))
        {
            Add(f, "CPU", Str(o["Name"]).Trim());
            Add(f, "CORES", Str(o["NumberOfCores"]));
            Add(f, "THREADS", Str(o["NumberOfLogicalProcessors"]));
            Add(f, "MHZ", Str(o["MaxClockSpeed"]));
            Add(f, "L2KB", Str(o["L2CacheSize"]));
            Add(f, "L3KB", Str(o["L3CacheSize"]));
            break;
        }
    }

    public static void ReadMemory(List<string> f)
    {
        foreach (ManagementObject o in Q("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem"))
        {
            Add(f, "USABLE", (D(o["TotalPhysicalMemory"]) / 1073741824.0).ToString("0.0", CultureInfo.InvariantCulture) + " GB");
            break;
        }
        double total = 0; int sticks = 0; uint speed = 0;
        foreach (ManagementObject o in Q("SELECT Capacity, Speed FROM Win32_PhysicalMemory"))
        {
            total += D(o["Capacity"]); sticks++;
            uint s = (uint)D(o["Speed"]); if (s > speed) speed = s;
        }
        if (total > 0)
        {
            Add(f, "RAM", Math.Round(total / 1073741824.0).ToString(CultureInfo.InvariantCulture) + " GB");
            Add(f, "SLOTS", sticks.ToString(CultureInfo.InvariantCulture));
            if (speed > 0) Add(f, "RAMMHZ", speed.ToString(CultureInfo.InvariantCulture));
        }
    }

    public static void ReadGpu(List<string> f)
    {
        var vramByName = VramFromRegistry();
        var parts = new List<string>();
        foreach (ManagementObject o in Q("SELECT Name, AdapterRAM, PNPDeviceID, DriverVersion, CurrentRefreshRate, CurrentHorizontalResolution, CurrentVerticalResolution FROM Win32_VideoController"))
        {
            string name = Str(o["Name"]).Trim();
            if (name.Length == 0) continue;
            // AdapterRAM là số 32-bit nên tối đa 4 GB — registry mới có số thật
            long vram = 0;
            foreach (var kv in vramByName)
                if (string.Equals(kv.Key, name, StringComparison.OrdinalIgnoreCase)) { vram = kv.Value; break; }
            if (vram <= 0) vram = (long)D(o["AdapterRAM"]);
            int mb = vram > 0 ? (int)(vram / 1048576) : 0;
            // Mã thiết bị PCI (vd DEV_15BF): Windows hay chỉ ghi "AMD Radeon Graphics" chung chung,
            // mã này mới cho biết đúng đời chip
            var dev = System.Text.RegularExpressions.Regex.Match(Str(o["PNPDeviceID"]), @"DEV_([0-9A-Fa-f]{4})");
            // Dạng: tên|VRAM MB|mã PCI|phiên bản driver
            parts.Add(name + "|" + mb + "|" + (dev.Success ? dev.Groups[1].Value.ToLowerInvariant() : "") + "|" + Str(o["DriverVersion"]).Replace("|", ""));
            int hz = (int)D(o["CurrentRefreshRate"]), w = (int)D(o["CurrentHorizontalResolution"]), h = (int)D(o["CurrentVerticalResolution"]);
            if (hz > 0 && !f.Any(x => x.StartsWith("HZ=", StringComparison.Ordinal)))
            {
                Add(f, "HZ", hz.ToString(CultureInfo.InvariantCulture));
                if (w > 0 && h > 0) Add(f, "RES", w + "x" + h);
            }
        }
        if (parts.Count > 0) Add(f, "GPU", string.Join(" + ", parts));
    }

    static Dictionary<string, long> VramFromRegistry()
    {
        var map = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        const string root = @"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
        try
        {
            using (var key = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64).OpenSubKey(root))
            {
                if (key == null) return map;
                foreach (string sub in key.GetSubKeyNames())
                {
                    if (sub.Length != 4) continue;
                    using (var k = key.OpenSubKey(sub))
                    {
                        if (k == null) continue;
                        object desc = k.GetValue("DriverDesc"), mem = k.GetValue("HardwareInformation.qwMemorySize");
                        if (desc == null || mem == null) continue;
                        long bytes = 0;
                        if (mem is long) bytes = (long)mem;
                        else if (mem is int) bytes = (int)mem;
                        else if (mem is byte[]) { var b = (byte[])mem; if (b.Length >= 8) bytes = BitConverter.ToInt64(b, 0); }
                        if (bytes > 0) map[desc.ToString()] = bytes;
                    }
                }
            }
        }
        catch { }
        return map;
    }

    public static void ReadOs(List<string> f)
    {
        foreach (ManagementObject o in Q("SELECT Caption, OSArchitecture, BuildNumber FROM Win32_OperatingSystem"))
        {
            Add(f, "OS", Str(o["Caption"]).Replace("Microsoft ", "").Trim());
            Add(f, "ARCH", Str(o["OSArchitecture"]));
            Add(f, "OSBUILD", Str(o["BuildNumber"]));   // vài game đòi Windows 10 bản 1903+ …
            break;
        }
        bool battery = false;
        foreach (ManagementObject o in Q("SELECT Name FROM Win32_Battery")) { battery = true; break; }
        Add(f, "BATTERY", battery ? "1" : "0", true);
    }

    public static void ReadDisk(List<string> f)
    {
        double free = 0;
        foreach (ManagementObject o in Q("SELECT FreeSpace FROM Win32_LogicalDisk WHERE DriveType=3")) free += D(o["FreeSpace"]);
        if (free > 0) Add(f, "DISK", Math.Round(free / 1073741824.0).ToString(CultureInfo.InvariantCulture) + " GB");
    }

    // Đơn nhân + đa nhân. Tỉ lệ đa/đơn cho biết số nhân thật (SMT chỉ thêm ~20-30%).
    public static void Benchmark(List<string> f)
    {
        long st = Kernel(1), mt = Kernel(Environment.ProcessorCount);
        Add(f, "ST", st.ToString(CultureInfo.InvariantCulture));
        Add(f, "MT", mt.ToString(CultureInfo.InvariantCulture));
    }

    static long Kernel(int threads)
    {
        // Tên linh kiện đã đủ để chấm. Bài đo này chỉ là phương án dự phòng
        // cho CPU lạ chưa có trong bảng, nên rút ngắn còn ~1,5 giây.
        const long iters = 30000000;
        var done = new long[threads];
        var ts = new Thread[threads];
        var sw = Stopwatch.StartNew();
        for (int t = 0; t < threads; t++)
        {
            int idx = t;
            ts[t] = new Thread(() =>
            {
                uint a = 1, b = 2, c = 3, d = 4; int s = 0;
                for (long i = 0; i < iters; i++)
                {
                    a ^= a << 13; a ^= a >> 17; a ^= a << 5;
                    b ^= b << 13; b ^= b >> 17; b ^= b << 5;
                    c ^= c << 13; c ^= c >> 17; c ^= c << 5;
                    d ^= d << 13; d ^= d >> 17; d ^= d << 5;
                    s += (int)((a ^ b ^ c ^ d) & 255);
                }
                done[idx] = s == int.MinValue ? 1 : iters;
            }, 1 << 20) { IsBackground = true };
            ts[t].Start();
        }
        foreach (var th in ts) th.Join();
        return (long)(done.Sum() / Math.Max(sw.Elapsed.TotalSeconds, 0.001) / 1000000.0);
    }

    static ManagementObjectCollection Q(string wql) { return new ManagementObjectSearcher(new ObjectQuery(wql)).Get(); }
    static void Add(List<string> f, string k, string v, bool allowZero = false)
    {
        if (!string.IsNullOrEmpty(v) && (allowZero || v != "0")) f.Add(k + "=" + v.Replace(";", ","));
    }
    static string Str(object o) { return o == null ? "" : o.ToString(); }
    static double D(object o)
    {
        if (o == null) return 0;
        double d; return double.TryParse(o.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out d) ? d : 0;
    }
}
