using System;
using System.IO;
using System.Reflection;

namespace HipSync.Core
{
    public static class AppPaths
    {
        public static string DataDir
        {
            get
            {
                var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "HipSync");
                Directory.CreateDirectory(dir);
                return dir;
            }
        }

        public static string SettingsFile => Path.Combine(DataDir, "settings.json");

        public static string LogDir
        {
            get
            {
                var dir = Path.Combine(DataDir, "logs");
                Directory.CreateDirectory(dir);
                return dir;
            }
        }

        public static string TempDir
        {
            get
            {
                var dir = Path.Combine(Path.GetTempPath(), "HipSync");
                Directory.CreateDirectory(dir);
                return dir;
            }
        }

        public static Version AppVersion => Assembly.GetExecutingAssembly().GetName().Version;

        public static string AppVersionText
        {
            get
            {
                var v = AppVersion;
                return $"{v.Major}.{v.Minor}.{v.Build}";
            }
        }
    }
}
