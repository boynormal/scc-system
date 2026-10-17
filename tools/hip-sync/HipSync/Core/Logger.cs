using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;

namespace HipSync.Core
{
    public static class Logger
    {
        private const int KeepDays = 60;
        private static readonly object Gate = new object();

        public static void Info(string message) => Write("INFO", message);

        public static void Error(string message, Exception ex = null) =>
            Write("ERROR", ex == null ? message : $"{message}{Environment.NewLine}{ex}");

        private static void Write(string level, string message)
        {
            try
            {
                var now = DateTime.Now;
                var file = Path.Combine(AppPaths.LogDir, now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + ".log");
                var line = $"{now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)} [{level}] {message}{Environment.NewLine}";
                lock (Gate)
                {
                    File.AppendAllText(file, line, new UTF8Encoding(false));
                }
            }
            catch
            {
                // การเขียน log ต้องไม่ทำให้โปรแกรมล้ม
            }
        }

        public static void PurgeOld()
        {
            try
            {
                var cutoff = DateTime.Now.AddDays(-KeepDays);
                foreach (var file in new DirectoryInfo(AppPaths.LogDir).GetFiles("*.log").Where(f => f.LastWriteTime < cutoff))
                {
                    file.Delete();
                }
            }
            catch
            {
            }
        }
    }
}
