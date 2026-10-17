using System;
using System.Drawing;
using System.Drawing.Text;
using System.Linq;
using System.Windows.Forms;
using HipSync.Core;

namespace HipSync.Forms
{
    internal static class Ui
    {
        public const string AppTitle = "HIP Sync";

        private static readonly Lazy<string> FontFamilyName = new Lazy<string>(() =>
        {
            using (var fonts = new InstalledFontCollection())
            {
                var installed = fonts.Families.Select(f => f.Name).ToList();
                return new[] { "Leelawadee UI", "Leelawadee", "Tahoma" }.FirstOrDefault(installed.Contains) ?? "Tahoma";
            }
        });

        public static Font Font(float size = 10f, FontStyle style = FontStyle.Regular) => new Font(FontFamilyName.Value, size, style);

        public static void Info(IWin32Window owner, string message) =>
            MessageBox.Show(owner, message, AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Information);

        public static void Warn(IWin32Window owner, string message) =>
            MessageBox.Show(owner, message, AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Warning);

        public static bool Confirm(IWin32Window owner, string message) =>
            MessageBox.Show(owner, message, AppTitle, MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) == DialogResult.Yes;

        /// <summary>ข้อความ error สำหรับผู้ใช้ — exception ที่ไม่คาดคิดจะถูกเขียน log เต็ม ๆ</summary>
        public static string Describe(Exception ex)
        {
            if (ex is AggregateException agg && agg.InnerExceptions.Count == 1) ex = agg.InnerException;
            if (ex is UserFacingException) return ex.Message;
            if (ex is OperationCanceledException) return "ยกเลิกแล้ว";
            Logger.Error("ข้อผิดพลาดที่ไม่คาดคิด", ex);
            return "เกิดข้อผิดพลาดที่ไม่คาดคิด: " + ex.Message + Environment.NewLine + "ดูรายละเอียดในไฟล์ log";
        }

        public static void OpenLogFolder()
        {
            try
            {
                System.Diagnostics.Process.Start("explorer.exe", "\"" + AppPaths.LogDir + "\"");
            }
            catch (Exception ex)
            {
                Logger.Error("เปิดโฟลเดอร์ log ไม่ได้", ex);
            }
        }

        public static Label FieldLabel(string text) => new Label
        {
            Text = text,
            AutoSize = true,
            Anchor = AnchorStyles.Left,
            Margin = new Padding(3, 8, 8, 3),
            MinimumSize = new Size(150, 0),
        };

        public static Button Button(string text, EventHandler onClick, int width = 0)
        {
            var button = new Button { Text = text, AutoSize = width == 0, Height = 30, Margin = new Padding(3), UseVisualStyleBackColor = true };
            if (width > 0) button.Width = width;
            if (width == 0) button.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            button.Padding = new Padding(8, 0, 8, 0);
            button.Click += onClick;
            return button;
        }
    }
}
