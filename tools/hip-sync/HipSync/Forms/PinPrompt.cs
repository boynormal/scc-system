using System.Drawing;
using System.Windows.Forms;
using HipSync.Core;

namespace HipSync.Forms
{
    internal sealed class PinPrompt : Form
    {
        private readonly TextBox _pin = new TextBox { UseSystemPasswordChar = true, Width = 200, Margin = new Padding(3, 3, 3, 12) };

        private PinPrompt()
        {
            Text = "ยืนยัน PIN ผู้ดูแล";
            Font = Ui.Font();
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            AutoSize = true;
            AutoSizeMode = AutoSizeMode.GrowAndShrink;

            var ok = new Button { Text = "ตกลง", DialogResult = DialogResult.OK, AutoSize = true };
            var cancel = new Button { Text = "ยกเลิก", DialogResult = DialogResult.Cancel, AutoSize = true };
            AcceptButton = ok;
            CancelButton = cancel;

            var buttons = new FlowLayoutPanel { FlowDirection = FlowDirection.RightToLeft, AutoSize = true, Dock = DockStyle.Fill };
            buttons.Controls.Add(cancel);
            buttons.Controls.Add(ok);

            var root = new TableLayoutPanel { AutoSize = true, ColumnCount = 1, Padding = new Padding(16) };
            root.Controls.Add(new Label { Text = "ใส่ PIN เพื่อเข้าหน้าตั้งค่า", AutoSize = true, Margin = new Padding(3, 3, 3, 8) });
            root.Controls.Add(_pin);
            root.Controls.Add(buttons);
            Controls.Add(root);
            MinimumSize = new Size(280, 0);
        }

        public static bool Verify(IWin32Window owner, AppSettings settings)
        {
            using (var prompt = new PinPrompt())
            {
                if (prompt.ShowDialog(owner) != DialogResult.OK) return false;
                if (settings.CheckPin(prompt._pin.Text)) return true;
                Logger.Info("ใส่ PIN หน้าตั้งค่าผิด");
                Ui.Warn(owner, "PIN ไม่ถูกต้อง");
                return false;
            }
        }
    }
}
