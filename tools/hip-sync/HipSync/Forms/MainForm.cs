using System;
using System.Drawing;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using HipSync.Core;

namespace HipSync.Forms
{
    public sealed class MainForm : Form
    {
        private AppSettings _settings;
        private CancellationTokenSource _syncCts;

        private readonly Label _branchValue = ValueLabel();
        private readonly Label _deviceValue = ValueLabel();
        private readonly Label _lastSyncValue = ValueLabel();
        private readonly Label _lastResultValue = ValueLabel();
        private readonly Button _syncButton;
        private readonly Button _settingsButton;
        private readonly ProgressBar _progress = new ProgressBar { Dock = DockStyle.Fill, Height = 22, Margin = new Padding(3, 8, 3, 3) };
        private readonly Label _status = new Label { AutoSize = true, Margin = new Padding(3, 4, 3, 4), Text = "พร้อม" };
        private readonly TextBox _result = new TextBox
        {
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            Dock = DockStyle.Fill,
            BackColor = SystemColors.Window,
        };
        private readonly Label _updateNotice = new Label { AutoSize = true, ForeColor = Color.DarkOrange, Margin = new Padding(12, 9, 3, 3), Visible = false };

        public MainForm()
        {
            Text = $"{Ui.AppTitle} — ซิงค์ข้อมูลสแกนนิ้ว";
            Font = Ui.Font();
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(560, 520);
            Size = new Size(620, 580);
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

            _syncButton = new Button
            {
                Text = "ซิงค์ข้อมูล",
                Dock = DockStyle.Fill,
                Height = 64,
                Font = Ui.Font(16f, FontStyle.Bold),
                BackColor = Color.FromArgb(22, 101, 52),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Margin = new Padding(3, 12, 3, 3),
            };
            _syncButton.FlatAppearance.BorderSize = 0;
            _syncButton.Click += async (s, e) => await OnSyncClickAsync();
            _settingsButton = Ui.Button("⚙ ตั้งค่า", (s, e) => OpenSettings(requirePin: true));

            var title = new Label
            {
                Text = "ซิงค์ข้อมูลสแกนนิ้ว HIP เข้าระบบ SCC",
                AutoSize = true,
                Font = Ui.Font(13f, FontStyle.Bold),
                Margin = new Padding(3, 0, 3, 8),
            };

            var info = new TableLayoutPanel { ColumnCount = 2, AutoSize = true, Dock = DockStyle.Fill };
            info.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            info.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            AddInfoRow(info, "สาขา", _branchValue);
            AddInfoRow(info, "เครื่องสแกน", _deviceValue);
            AddInfoRow(info, "ซิงค์ล่าสุด", _lastSyncValue);
            AddInfoRow(info, "ผลล่าสุด", _lastResultValue);

            var bottom = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, WrapContents = false };
            bottom.Controls.Add(_settingsButton);
            bottom.Controls.Add(Ui.Button("เปิดโฟลเดอร์ log", (s, e) => Ui.OpenLogFolder()));
            bottom.Controls.Add(_updateNotice);

            var version = new Label { Text = "v" + AppPaths.AppVersionText, AutoSize = true, ForeColor = SystemColors.GrayText, Anchor = AnchorStyles.Right };

            var root = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, Padding = new Padding(16) };
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 80));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.Controls.Add(title);
            root.Controls.Add(info);
            root.Controls.Add(_syncButton);
            root.Controls.Add(_progress);
            root.Controls.Add(_status);
            root.Controls.Add(_result);
            root.Controls.Add(bottom);
            root.Controls.Add(version);
            Controls.Add(root);

            _settings = AppSettings.Load();
            RefreshInfo();
            Shown += async (s, e) => await OnShownAsync();
            FormClosing += OnFormClosing;
        }

        private static Label ValueLabel() => new Label { AutoSize = true, Text = "-", Margin = new Padding(3, 4, 3, 4), Font = Ui.Font(10f, FontStyle.Bold) };

        private static void AddInfoRow(TableLayoutPanel table, string caption, Label value)
        {
            table.Controls.Add(new Label { Text = caption, AutoSize = true, Margin = new Padding(3, 4, 16, 4), ForeColor = SystemColors.GrayText });
            table.Controls.Add(value);
        }

        private void RefreshInfo()
        {
            _branchValue.Text = _settings.LastBranch ?? "-";
            _deviceValue.Text = _settings.LastDevice ?? "-";
            _lastSyncValue.Text = _settings.LastSyncAt ?? "ยังไม่เคยซิงค์";
            _lastResultValue.Text = _settings.LastSyncSummary ?? "-";
        }

        private async Task OnShownAsync()
        {
            if (!_settings.IsComplete)
            {
                Ui.Info(this, "ยินดีต้อนรับ — กรุณาตั้งค่าไฟล์ HIP และการเชื่อมต่อเซิร์ฟเวอร์ก่อนใช้งาน");
                if (!OpenSettings(requirePin: false)) return;
            }

            if (_settings.AutoSyncOnStart)
            {
                await OnSyncClickAsync();
                return;
            }

            try
            {
                _status.Text = "กำลังตรวจสอบการเชื่อมต่อ...";
                var state = await SyncService.TestConnectionAsync(_settings, CancellationToken.None);
                ApplyState(state);
                _status.Text = "พร้อม";
            }
            catch (Exception ex)
            {
                _status.Text = Ui.Describe(ex);
            }
        }

        private void ApplyState(SyncState state)
        {
            if (state == null) return;
            _branchValue.Text = state.Branch?.Display ?? "-";
            _deviceValue.Text = state.Device?.Name ?? "-";
            ShowUpdateNotice(state.LatestClientVersion);
        }

        private void ShowUpdateNotice(string latest)
        {
            _updateNotice.Visible = SyncSummary.IsNewer(latest);
            _updateNotice.Text = $"มีโปรแกรมรุ่นใหม่ v{latest} — แจ้งผู้ดูแลระบบเพื่ออัปเดต";
        }

        /// <returns>true ถ้าบันทึกการตั้งค่าแล้ว</returns>
        private bool OpenSettings(bool requirePin)
        {
            if (_syncCts != null) return false;
            if (requirePin && _settings.HasPin && !PinPrompt.Verify(this, _settings)) return false;

            using (var form = new SettingsForm(AppSettings.Load()))
            {
                if (form.ShowDialog(this) != DialogResult.OK) return false;
                _settings = AppSettings.Load();
                RefreshInfo();
                if (form.LastState != null) ApplyState(form.LastState);
                return true;
            }
        }

        private async Task OnSyncClickAsync()
        {
            if (_syncCts != null)
            {
                _syncCts.Cancel();
                _syncButton.Enabled = false;
                _status.Text = "กำลังยกเลิก...";
                return;
            }

            if (!_settings.IsComplete)
            {
                Ui.Warn(this, "ยังตั้งค่าไม่ครบ — กรุณาตั้งค่าก่อนซิงค์");
                OpenSettings(requirePin: true);
                return;
            }

            _syncCts = new CancellationTokenSource();
            SetBusy(true);
            _result.Clear();
            _progress.Style = ProgressBarStyle.Marquee;
            var progress = new Progress<SyncProgress>(OnProgress);

            try
            {
                var summary = await SyncService.RunAsync(_settings, progress, _syncCts.Token);
                ApplyState(summary.State);
                ShowUpdateNotice(summary.LatestClientVersion);
                _progress.Style = ProgressBarStyle.Continuous;
                _progress.Value = _progress.Maximum;
                _status.Text = "ซิงค์เสร็จ " + DateTime.Now.ToString("HH:mm:ss");
                _result.Text = BuildResultText(summary);

                var saved = AppSettings.Load();
                saved.RecordSync(summary);
                saved.Save();
                _settings = saved;
                RefreshInfo();
            }
            catch (Exception ex)
            {
                _progress.Style = ProgressBarStyle.Continuous;
                _progress.Value = 0;
                var message = Ui.Describe(ex);
                _status.Text = "ซิงค์ไม่สำเร็จ";
                _result.Text = message + Environment.NewLine + Environment.NewLine +
                               "ข้อมูลที่ส่งไปแล้วไม่หาย — กดซิงค์อีกครั้งจะทำต่อจากจุดเดิม";
                if (!(ex is OperationCanceledException))
                {
                    Logger.Error("ซิงค์ไม่สำเร็จ: " + message);
                    Ui.Warn(this, message);
                }
            }
            finally
            {
                _syncCts.Dispose();
                _syncCts = null;
                SetBusy(false);
            }
        }

        private void OnProgress(SyncProgress p)
        {
            _status.Text = p.Message;
            if (p.Total <= 0) return;
            _progress.Style = ProgressBarStyle.Continuous;
            _progress.Maximum = p.Total;
            _progress.Value = Math.Max(0, Math.Min(p.Done, p.Total));
        }

        private static string BuildResultText(SyncSummary s)
        {
            var nl = Environment.NewLine;
            var text = $"ข้อมูลใหม่ที่บันทึก: {s.Inserted:N0} แถว{nl}" +
                       $"ข้อมูลซ้ำ (เคยส่งแล้ว): {s.Duplicates:N0} แถว{nl}" +
                       $"วันทำงานที่คำนวณใหม่: {s.DaysUpdated:N0}{nl}" +
                       $"badge ใหม่ที่พบ: {s.NewBadges:N0}{nl}" +
                       $"ใช้เวลา {s.Elapsed.TotalSeconds:N1} วินาที";
            if (s.Skipped > 0)
                text += $"{nl}ข้ามแถวที่ไม่มีเลข badge/เวลา: {s.Skipped:N0}";
            if (s.UnmappedBadges > 0)
                text += $"{nl}{nl}⚠ มี badge ที่ยังไม่ได้ผูกกับพนักงาน {s.UnmappedBadges:N0} รายการ{nl}" +
                        "แจ้งฝ่าย HR ให้ผูกที่หน้าเว็บ HR > บันทึกเวลา (เวลาสแกนของ badge เหล่านี้จะยังไม่ถูกนับ)";
            return text;
        }

        private void SetBusy(bool busy)
        {
            _syncButton.Enabled = true;
            _syncButton.Text = busy ? "ยกเลิก" : "ซิงค์ข้อมูล";
            _syncButton.BackColor = busy ? Color.FromArgb(153, 27, 27) : Color.FromArgb(22, 101, 52);
            _settingsButton.Enabled = !busy;
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            if (_syncCts == null) return;
            if (!Ui.Confirm(this, "กำลังซิงค์อยู่ ต้องการปิดโปรแกรมหรือไม่?\n(ข้อมูลที่ส่งไปแล้วไม่หาย ซิงค์ครั้งหน้าจะทำต่อ)"))
            {
                e.Cancel = true;
                return;
            }
            _syncCts.Cancel();
        }
    }
}
