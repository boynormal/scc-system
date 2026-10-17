using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using HipSync.Core;
using HipSync.Forms;

namespace HipSync
{
    internal static class Program
    {
        [DllImport("kernel32.dll")]
        private static extern bool AttachConsole(int processId);

        [STAThread]
        private static int Main(string[] args)
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            Logger.PurgeOld();
            MdbSnapshot.CleanupStaleCopies();

            if (args.Any(a => string.Equals(a, "--sync", StringComparison.OrdinalIgnoreCase)))
                return RunHeadless();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += (s, e) => ShowFatal(e.Exception);
            AppDomain.CurrentDomain.UnhandledException += (s, e) => ShowFatal(e.ExceptionObject as Exception);

            using (var mutex = new Mutex(true, @"Local\SCC.HipSync", out var createdNew))
            {
                if (!createdNew)
                {
                    MessageBox.Show("โปรแกรม HIP Sync เปิดอยู่แล้ว", Ui.AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return 0;
                }
                Logger.Info($"เปิดโปรแกรม v{AppPaths.AppVersionText}");
                Application.Run(new MainForm());
                return 0;
            }
        }

        /// <summary>
        /// HipSync.exe --sync : ซิงค์ด้วยค่าที่บันทึกไว้โดยไม่เปิดหน้าต่าง (ใช้กับ Task Scheduler). exit 0 = สำเร็จ, 1 = ผิดพลาด, 2 = ยังไม่ได้ตั้งค่า
        /// ตัวแปรแวดล้อม HIPSYNC_SERVER_URL / HIPSYNC_DEVICE_KEY / HIPSYNC_MDB_PATH ใช้แทนค่าที่บันทึกไว้ได้ (สำหรับทดสอบ)
        /// </summary>
        private static int RunHeadless()
        {
            AttachConsole(-1);
            try
            {
                Console.OutputEncoding = new UTF8Encoding(false);
            }
            catch (IOException)
            {
            }
            var settings = AppSettings.Load();
            var url = Environment.GetEnvironmentVariable("HIPSYNC_SERVER_URL");
            var key = Environment.GetEnvironmentVariable("HIPSYNC_DEVICE_KEY");
            var mdb = Environment.GetEnvironmentVariable("HIPSYNC_MDB_PATH");
            if (!string.IsNullOrWhiteSpace(url)) settings.ServerUrl = url;
            if (!string.IsNullOrWhiteSpace(key)) settings.DeviceKey = key;
            if (!string.IsNullOrWhiteSpace(mdb)) settings.MdbPath = mdb;

            if (!settings.IsComplete)
            {
                Console.Error.WriteLine("ยังไม่ได้ตั้งค่า — เปิดโปรแกรมแบบปกติเพื่อตั้งค่าก่อน");
                Logger.Error("--sync: ยังไม่ได้ตั้งค่า");
                return 2;
            }

            try
            {
                var summary = SyncService.RunAsync(settings, null, CancellationToken.None).GetAwaiter().GetResult();
                Console.WriteLine($"OK sent={summary.Sent} inserted={summary.Inserted} duplicates={summary.Duplicates} " +
                                  $"newBadges={summary.NewBadges} unmapped={summary.UnmappedBadges} skipped={summary.Skipped} " +
                                  $"lastSourceRowId={summary.LastSourceRowId} seconds={summary.Elapsed.TotalSeconds:F1}");
                if (string.IsNullOrWhiteSpace(key) && string.IsNullOrWhiteSpace(url) && string.IsNullOrWhiteSpace(mdb))
                {
                    var saved = AppSettings.Load();
                    saved.RecordSync(summary);
                    saved.Save();
                }
                return 0;
            }
            catch (Exception ex)
            {
                var message = ex is UserFacingException ? ex.Message : ex.ToString();
                Logger.Error("--sync ล้มเหลว: " + message, ex is UserFacingException ? null : ex);
                Console.Error.WriteLine("ERROR " + message);
                return 1;
            }
        }

        private static void ShowFatal(Exception ex)
        {
            Logger.Error("ข้อผิดพลาดที่ไม่ได้จัดการ", ex);
            MessageBox.Show("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + ex?.Message + Environment.NewLine + "ดูรายละเอียดในไฟล์ log",
                Ui.AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
