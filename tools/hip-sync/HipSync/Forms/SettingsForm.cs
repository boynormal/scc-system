using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using HipSync.Core;

namespace HipSync.Forms
{
    public sealed class SettingsForm : Form
    {
        private const int MinPinLength = 4;

        private readonly AppSettings _settings;

        private readonly TextBox _mdbPath = new TextBox { Dock = DockStyle.Fill };
        private readonly TextBox _mdbPassword = new TextBox { Dock = DockStyle.Fill, UseSystemPasswordChar = true };
        private readonly Label _mdbResult = ResultLabel();
        private readonly TextBox _serverUrl = new TextBox { Dock = DockStyle.Fill };
        private readonly TextBox _deviceKey = new TextBox { Dock = DockStyle.Fill, UseSystemPasswordChar = true };
        private readonly Label _serverResult = ResultLabel();
        private readonly CheckBox _autoSync = new CheckBox { Text = "ซิงค์อัตโนมัติเมื่อเปิดโปรแกรม", AutoSize = true };
        private readonly NumericUpDown _batchSize = new NumericUpDown { Minimum = 100, Maximum = AppSettings.MaxBatchSize, Increment = 100, Width = 90 };
        private readonly CheckBox _usePin = new CheckBox { Text = "ต้องใส่ PIN ก่อนเข้าหน้าตั้งค่า", AutoSize = true };
        private readonly TextBox _pin = new TextBox { Width = 140, UseSystemPasswordChar = true };
        private readonly Button _testMdbButton;
        private readonly Button _testServerButton;

        public SyncState LastState { get; private set; }

        public SettingsForm(AppSettings settings)
        {
            _settings = settings;
            Text = "ตั้งค่า — " + Ui.AppTitle;
            Font = Ui.Font();
            StartPosition = FormStartPosition.CenterParent;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;
            ClientSize = new Size(680, 700);
            AutoScroll = true;

            _testMdbButton = Ui.Button("ทดสอบเปิดไฟล์", async (s, e) => await TestMdbAsync());
            _testServerButton = Ui.Button("ทดสอบการเชื่อมต่อ", async (s, e) => await TestServerAsync());

            var root = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, Padding = new Padding(12), AutoScroll = true };
            root.Controls.Add(BuildMdbGroup());
            root.Controls.Add(BuildServerGroup());
            root.Controls.Add(BuildOptionsGroup());
            root.Controls.Add(BuildButtons());
            Controls.Add(root);

            LoadValues();
            Shown += (s, e) =>
            {
                _mdbPath.SelectionStart = _mdbPath.TextLength;
                _mdbPath.SelectionLength = 0;
            };
        }

        private static Label ResultLabel() => new Label { AutoSize = true, MaximumSize = new Size(560, 0), Margin = new Padding(3, 6, 3, 3) };

        private static TableLayoutPanel GroupTable()
        {
            var table = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, AutoSize = true };
            table.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            table.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            return table;
        }

        private static GroupBox Group(string title, Control content)
        {
            var box = new GroupBox
            {
                Text = title,
                Dock = DockStyle.Top,
                AutoSize = true,
                Padding = new Padding(10, 6, 10, 8),
                Margin = new Padding(3, 3, 3, 10),
                Font = Ui.Font(10f, FontStyle.Bold),
            };
            content.Font = Ui.Font();
            box.Controls.Add(content);
            return box;
        }

        private Control BuildMdbGroup()
        {
            var t = GroupTable();
            t.Controls.Add(Ui.FieldLabel("ไฟล์ Pm2014.mdb"), 0, 0);
            t.Controls.Add(_mdbPath, 1, 0);
            var pathButtons = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            pathButtons.Controls.Add(Ui.Button("เลือกไฟล์...", (s, e) => BrowseMdb()));
            pathButtons.Controls.Add(Ui.Button("ค้นหาอัตโนมัติ", (s, e) => AutoFindMdb()));
            t.Controls.Add(pathButtons, 2, 0);

            t.Controls.Add(Ui.FieldLabel("รหัสผ่านไฟล์"), 0, 1);
            t.Controls.Add(_mdbPassword, 1, 1);
            t.Controls.Add(ShowToggle(_mdbPassword), 2, 1);

            t.Controls.Add(_testMdbButton, 1, 2);
            t.Controls.Add(_mdbResult, 1, 3);
            t.SetColumnSpan(_mdbResult, 2);
            return Group("ไฟล์ฐานข้อมูล HIP PremiumTime", t);
        }

        private Control BuildServerGroup()
        {
            var t = GroupTable();
            t.Controls.Add(Ui.FieldLabel("URL เซิร์ฟเวอร์"), 0, 0);
            t.Controls.Add(_serverUrl, 1, 0);
            t.SetColumnSpan(_serverUrl, 2);

            t.Controls.Add(Ui.FieldLabel("Device API key"), 0, 1);
            t.Controls.Add(_deviceKey, 1, 1);
            t.Controls.Add(ShowToggle(_deviceKey), 2, 1);

            var hint = new Label
            {
                Text = "ขอ key ได้จากหน้าเว็บ HR > บันทึกเวลา > แท็บเครื่องสแกน (key แสดงครั้งเดียวตอนสร้าง)",
                AutoSize = true,
                ForeColor = SystemColors.GrayText,
                MaximumSize = new Size(460, 0),
            };
            t.Controls.Add(hint, 1, 2);
            t.SetColumnSpan(hint, 2);

            t.Controls.Add(_testServerButton, 1, 3);
            t.Controls.Add(_serverResult, 1, 4);
            t.SetColumnSpan(_serverResult, 2);
            return Group("เซิร์ฟเวอร์ SCC", t);
        }

        private Control BuildOptionsGroup()
        {
            var t = GroupTable();
            t.Controls.Add(_autoSync, 0, 0);
            t.SetColumnSpan(_autoSync, 3);

            t.Controls.Add(Ui.FieldLabel("จำนวนแถวต่อรอบส่ง"), 0, 1);
            t.Controls.Add(_batchSize, 1, 1);

            t.Controls.Add(_usePin, 0, 2);
            t.SetColumnSpan(_usePin, 3);
            t.Controls.Add(Ui.FieldLabel("PIN ใหม่"), 0, 3);
            var pinRow = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            pinRow.Controls.Add(_pin);
            pinRow.Controls.Add(new Label { Text = "(เว้นว่าง = ใช้ PIN เดิม)", AutoSize = true, ForeColor = SystemColors.GrayText, Margin = new Padding(6, 6, 3, 3) });
            t.Controls.Add(pinRow, 1, 3);
            _usePin.CheckedChanged += (s, e) => _pin.Enabled = _usePin.Checked;

            t.Controls.Add(Ui.Button("เปิดโฟลเดอร์ log", (s, e) => Ui.OpenLogFolder()), 1, 4);
            return Group("ตัวเลือก", t);
        }

        private Control BuildButtons()
        {
            var save = Ui.Button("บันทึก", (s, e) => Save(), 100);
            var cancel = Ui.Button("ยกเลิก", (s, e) => { DialogResult = DialogResult.Cancel; }, 100);
            CancelButton = cancel;
            var panel = new FlowLayoutPanel { FlowDirection = FlowDirection.RightToLeft, Dock = DockStyle.Fill, AutoSize = true };
            panel.Controls.Add(cancel);
            panel.Controls.Add(save);
            return panel;
        }

        private static CheckBox ShowToggle(TextBox target)
        {
            var toggle = new CheckBox { Text = "แสดง", AutoSize = true, Margin = new Padding(6, 6, 3, 3) };
            toggle.CheckedChanged += (s, e) => target.UseSystemPasswordChar = !toggle.Checked;
            return toggle;
        }

        private void LoadValues()
        {
            _mdbPath.Text = _settings.MdbPath ?? MdbSnapshot.FindDefaultMdb() ?? "";
            _mdbPassword.Text = _settings.MdbPassword;
            _serverUrl.Text = _settings.ServerUrl ?? AppSettings.DefaultServerUrl;
            _deviceKey.Text = _settings.DeviceKey ?? "";
            _autoSync.Checked = _settings.AutoSyncOnStart;
            _batchSize.Value = Math.Max(_batchSize.Minimum, Math.Min(_batchSize.Maximum, _settings.EffectiveBatchSize));
            _usePin.Checked = _settings.HasPin;
            _pin.Enabled = _usePin.Checked;
        }

        private void BrowseMdb()
        {
            using (var dialog = new OpenFileDialog
            {
                Title = "เลือกไฟล์ฐานข้อมูล HIP (Pm2014.mdb)",
                Filter = "Access database (*.mdb)|*.mdb|ทุกไฟล์ (*.*)|*.*",
                CheckFileExists = true,
            })
            {
                var current = _mdbPath.Text.Trim();
                if (current.Length > 0 && Directory.Exists(Path.GetDirectoryName(current) ?? "")) dialog.InitialDirectory = Path.GetDirectoryName(current);
                if (dialog.ShowDialog(this) == DialogResult.OK) _mdbPath.Text = dialog.FileName;
            }
        }

        private void AutoFindMdb()
        {
            var found = MdbSnapshot.FindDefaultMdb();
            if (found == null)
            {
                Ui.Warn(this, "ไม่พบ Pm2014.mdb ในโฟลเดอร์ติดตั้ง HIP PremiumTime — กรุณากด \"เลือกไฟล์...\"");
                return;
            }
            _mdbPath.Text = found;
            SetResult(_mdbResult, "พบไฟล์: " + found, ok: true);
        }

        private async Task TestMdbAsync()
        {
            _testMdbButton.Enabled = false;
            SetResult(_mdbResult, "กำลังเปิดไฟล์...", ok: null);
            try
            {
                var stats = await SyncService.TestMdbAsync(_mdbPath.Text.Trim(), _mdbPassword.Text);
                var range = stats.FirstPunch.HasValue
                    ? $"{stats.FirstPunch:dd/MM/yyyy} – {stats.LastPunch:dd/MM/yyyy}"
                    : "ยังไม่มีข้อมูลสแกน";
                SetResult(_mdbResult, $"เปิดได้ ✓  พนักงาน {stats.Users:N0} คน · ข้อมูลสแกน {stats.Punches:N0} แถว · ช่วง {range}", ok: true);
            }
            catch (Exception ex)
            {
                SetResult(_mdbResult, Ui.Describe(ex), ok: false);
            }
            finally
            {
                _testMdbButton.Enabled = true;
            }
        }

        private async Task TestServerAsync()
        {
            _testServerButton.Enabled = false;
            SetResult(_serverResult, "กำลังเชื่อมต่อ...", ok: null);
            try
            {
                var probe = new AppSettings { ServerUrl = _serverUrl.Text.Trim(), DeviceKey = _deviceKey.Text.Trim() };
                var state = await SyncService.TestConnectionAsync(probe, CancellationToken.None);
                LastState = state;
                var offset = TimeZoneInfo.Local.GetUtcOffset(DateTime.Now);
                var sign = offset < TimeSpan.Zero ? "-" : "+";
                SetResult(_serverResult,
                    $"เชื่อมต่อได้ ✓  สาขา {state.Branch?.Display} · เครื่อง {state.Device?.Name}{Environment.NewLine}" +
                    $"ส่งข้อมูลแล้วถึงแถว {state.LastSourceRowId:N0} · badge ยังไม่ผูก {state.UnmappedBadges:N0}{Environment.NewLine}" +
                    $"เขตเวลาสาขา {state.Branch?.Timezone} · เครื่องนี้ UTC{sign}{offset:hh\\:mm}",
                    ok: true);
            }
            catch (Exception ex)
            {
                SetResult(_serverResult, Ui.Describe(ex), ok: false);
            }
            finally
            {
                _testServerButton.Enabled = true;
            }
        }

        private static void SetResult(Label label, string text, bool? ok)
        {
            label.Text = text;
            label.ForeColor = ok == null ? SystemColors.ControlText : ok.Value ? Color.DarkGreen : Color.Firebrick;
        }

        private void Save()
        {
            var mdbPath = _mdbPath.Text.Trim();
            var serverUrl = _serverUrl.Text.Trim().TrimEnd('/');
            var deviceKey = _deviceKey.Text.Trim();
            var pin = _pin.Text.Trim();

            if (mdbPath.Length == 0)
            {
                Ui.Warn(this, "กรุณาระบุไฟล์ Pm2014.mdb");
                return;
            }
            if (!File.Exists(mdbPath) && !Ui.Confirm(this, "ไม่พบไฟล์ที่ระบุบนเครื่องนี้ ต้องการบันทึกต่อหรือไม่?"))
                return;

            try
            {
                SyncApiClient.ParseServerUrl(serverUrl);
            }
            catch (UserFacingException ex)
            {
                Ui.Warn(this, ex.Message);
                return;
            }
            if (SyncApiClient.IsInsecureRemote(serverUrl) &&
                !Ui.Confirm(this, "URL ใช้ http:// (ไม่เข้ารหัส) กับเครื่องที่ไม่ใช่เครื่องนี้ — key และข้อมูลอาจถูกดักฟังได้\nแนะนำให้ใช้ https:// ต้องการบันทึกต่อหรือไม่?"))
                return;

            if (!SyncApiClient.LooksLikeDeviceKey(deviceKey))
            {
                Ui.Warn(this, "Device API key ไม่ถูกรูปแบบ (ต้องขึ้นต้นด้วย hip_) — คัดลอกจากหน้าเว็บอีกครั้ง");
                return;
            }

            if (_usePin.Checked && pin.Length == 0 && !_settings.HasPin)
            {
                Ui.Warn(this, "กรุณาตั้ง PIN หรือเอาเครื่องหมายออกจาก \"ต้องใส่ PIN\"");
                return;
            }
            if (_usePin.Checked && pin.Length > 0 && pin.Length < MinPinLength)
            {
                Ui.Warn(this, $"PIN ต้องยาวอย่างน้อย {MinPinLength} ตัวอักษร");
                return;
            }

            _settings.MdbPath = mdbPath;
            _settings.MdbPassword = _mdbPassword.Text;
            _settings.ServerUrl = serverUrl;
            _settings.DeviceKey = deviceKey;
            _settings.AutoSyncOnStart = _autoSync.Checked;
            _settings.BatchSize = (int)_batchSize.Value;
            if (!_usePin.Checked) _settings.SetPin(null);
            else if (pin.Length > 0) _settings.SetPin(pin);

            try
            {
                _settings.Save();
            }
            catch (Exception ex)
            {
                Ui.Warn(this, "บันทึกการตั้งค่าไม่ได้: " + ex.Message);
                Logger.Error("บันทึกการตั้งค่าไม่ได้", ex);
                return;
            }
            Logger.Info($"บันทึกการตั้งค่า mdb={mdbPath} server={serverUrl} batch={_settings.BatchSize} pin={_settings.HasPin}");
            DialogResult = DialogResult.OK;
        }
    }
}
