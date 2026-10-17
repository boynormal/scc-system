using System;
using System.Collections.Generic;
using System.Data;
using System.Data.OleDb;
using System.Globalization;
using System.IO;
using System.Linq;

namespace HipSync.Core
{
    public sealed class HipUser
    {
        public string BadgeNumber { get; set; }
        public string Name { get; set; }
    }

    public sealed class HipPunch
    {
        public int SourceRowId { get; set; }
        public string BadgeNumber { get; set; }
        public DateTime CheckTime { get; set; }
        public string CheckType { get; set; }
        public int? VerifyCode { get; set; }
    }

    public sealed class MdbStats
    {
        public int Users { get; set; }
        public int Punches { get; set; }
        public DateTime? FirstPunch { get; set; }
        public DateTime? LastPunch { get; set; }
        public string Provider { get; set; }
    }

    /// <summary>
    /// เปิดสำเนาของ Pm2014.mdb (copy ไป %TEMP% ก่อน เพื่อไม่ไปล็อก/แก้ไฟล์ที่ HIP ใช้อยู่) — Dispose แล้วลบสำเนาทิ้ง
    /// </summary>
    public sealed class MdbSnapshot : IDisposable
    {
        private static readonly string[] Providers =
        {
            "Microsoft.Jet.OLEDB.4.0",
            "Microsoft.ACE.OLEDB.12.0",
            "Microsoft.ACE.OLEDB.16.0",
        };

        private static readonly string[] SearchRoots =
        {
            @"C:\Program Files (x86)",
            @"C:\Program Files",
            @"D:\Program Files (x86)",
            @"D:\Program Files",
        };

        private readonly OleDbConnection _connection;
        private readonly string _copyPath;

        public string Provider { get; }

        private MdbSnapshot(OleDbConnection connection, string copyPath, string provider)
        {
            _connection = connection;
            _copyPath = copyPath;
            Provider = provider;
        }

        public static MdbSnapshot Open(string mdbPath, string password)
        {
            if (string.IsNullOrWhiteSpace(mdbPath) || !File.Exists(mdbPath))
                throw new UserFacingException($"ไม่พบไฟล์ฐานข้อมูล HIP:{Environment.NewLine}{mdbPath}{Environment.NewLine}ตรวจที่อยู่ไฟล์ในหน้าตั้งค่า");

            var copyPath = Path.Combine(AppPaths.TempDir, $"Pm2014_{Guid.NewGuid():N}.mdb");
            try
            {
                using (var src = new FileStream(mdbPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                using (var dst = new FileStream(copyPath, FileMode.CreateNew, FileAccess.Write))
                {
                    src.CopyTo(dst);
                }
            }
            catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException)
            {
                TryDelete(copyPath);
                throw new UserFacingException($"คัดลอกไฟล์ฐานข้อมูล HIP ไม่ได้ ({ex.Message}){Environment.NewLine}ลองปิดโปรแกรม HIP แล้วซิงค์ใหม่", ex);
            }

            var missingProviders = new List<string>();
            foreach (var provider in Providers)
            {
                var builder = new OleDbConnectionStringBuilder { Provider = provider, DataSource = copyPath };
                builder["Jet OLEDB:Database Password"] = password ?? "";
                builder["Mode"] = "Share Deny None";
                var connection = new OleDbConnection(builder.ConnectionString);
                try
                {
                    connection.Open();
                    return new MdbSnapshot(connection, copyPath, provider);
                }
                catch (InvalidOperationException)
                {
                    // provider ไม่ได้ติดตั้ง (หรือรันผิด bitness) → ลองตัวถัดไป
                    connection.Dispose();
                    missingProviders.Add(provider);
                }
                catch (OleDbException ex)
                {
                    connection.Dispose();
                    TryDelete(copyPath);
                    if (ex.Message.IndexOf("password", StringComparison.OrdinalIgnoreCase) >= 0)
                        throw new UserFacingException("รหัสผ่านไฟล์ฐานข้อมูล HIP ไม่ถูกต้อง — ตรวจในหน้าตั้งค่า", ex);
                    throw new UserFacingException($"เปิดไฟล์ฐานข้อมูล HIP ไม่ได้: {ex.Message}", ex);
                }
            }

            TryDelete(copyPath);
            throw new UserFacingException(
                "เครื่องนี้ไม่มีไดรเวอร์สำหรับอ่านไฟล์ Access (" + string.Join(", ", missingProviders) + ")" + Environment.NewLine +
                "ติดตั้ง Microsoft Access Database Engine 2010 (32-bit) แล้วลองใหม่");
        }

        public MdbStats GetStats()
        {
            var stats = new MdbStats { Provider = Provider };
            using (var cmd = new OleDbCommand("SELECT COUNT(*) FROM USERINFO", _connection))
                stats.Users = Convert.ToInt32(cmd.ExecuteScalar(), CultureInfo.InvariantCulture);
            using (var cmd = new OleDbCommand("SELECT COUNT(*), MIN(CHECKTIME), MAX(CHECKTIME) FROM CHECKINOUT", _connection))
            using (var reader = cmd.ExecuteReader())
            {
                if (reader.Read())
                {
                    stats.Punches = Convert.ToInt32(reader.GetValue(0), CultureInfo.InvariantCulture);
                    stats.FirstPunch = reader.IsDBNull(1) ? (DateTime?)null : reader.GetDateTime(1);
                    stats.LastPunch = reader.IsDBNull(2) ? (DateTime?)null : reader.GetDateTime(2);
                }
            }
            return stats;
        }

        public int CountPunchesAfter(int lastSourceRowId)
        {
            using (var cmd = new OleDbCommand("SELECT COUNT(*) FROM CHECKINOUT WHERE id > ?", _connection))
            {
                cmd.Parameters.Add("@id", OleDbType.Integer).Value = lastSourceRowId;
                return Convert.ToInt32(cmd.ExecuteScalar(), CultureInfo.InvariantCulture);
            }
        }

        public List<HipUser> ReadUsers()
        {
            var users = new Dictionary<string, HipUser>(StringComparer.Ordinal);
            using (var cmd = new OleDbCommand("SELECT Badgenumber, Name FROM USERINFO", _connection))
            using (var reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    var badge = AsText(reader, 0);
                    if (badge == null || users.ContainsKey(badge)) continue;
                    users[badge] = new HipUser { BadgeNumber = badge, Name = AsText(reader, 1) };
                }
            }
            return users.Values.ToList();
        }

        /// <summary>อ่านแถวสแกนที่ id มากกว่า afterId เรียงตาม id. lastIdRead = id สูงสุดที่อ่าน (รวมแถวที่ข้ามเพราะไม่มี badge)</summary>
        public List<HipPunch> ReadPunchesAfter(int afterId, int limit, out int lastIdRead, out int skipped)
        {
            var punches = new List<HipPunch>(limit);
            lastIdRead = afterId;
            skipped = 0;
            var sql = $"SELECT TOP {limit} id, Badgenumber, CHECKTIME, CHECKTYPE, VERIFYCODE FROM CHECKINOUT WHERE id > ? ORDER BY id";
            using (var cmd = new OleDbCommand(sql, _connection))
            {
                cmd.Parameters.Add("@id", OleDbType.Integer).Value = afterId;
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var id = Convert.ToInt32(reader.GetValue(0), CultureInfo.InvariantCulture);
                        lastIdRead = Math.Max(lastIdRead, id);
                        var badge = AsText(reader, 1);
                        if (badge == null || reader.IsDBNull(2))
                        {
                            skipped++;
                            continue;
                        }
                        punches.Add(new HipPunch
                        {
                            SourceRowId = id,
                            BadgeNumber = badge,
                            CheckTime = Convert.ToDateTime(reader.GetValue(2), CultureInfo.InvariantCulture),
                            CheckType = AsText(reader, 3),
                            VerifyCode = reader.IsDBNull(4) ? (int?)null : Convert.ToInt32(reader.GetValue(4), CultureInfo.InvariantCulture),
                        });
                    }
                }
            }
            return punches;
        }

        private static string AsText(IDataRecord reader, int ordinal)
        {
            if (reader.IsDBNull(ordinal)) return null;
            var text = Convert.ToString(reader.GetValue(ordinal), CultureInfo.InvariantCulture)?.Trim();
            return string.IsNullOrEmpty(text) ? null : text;
        }

        public static string FindDefaultMdb()
        {
            foreach (var root in SearchRoots)
            {
                try
                {
                    if (!Directory.Exists(root)) continue;
                    foreach (var dir in Directory.GetDirectories(root, "HIP PremiumTime*").OrderByDescending(d => d, StringComparer.OrdinalIgnoreCase))
                    {
                        var candidate = Path.Combine(dir, "db", "Pm2014.mdb");
                        if (File.Exists(candidate)) return candidate;
                    }
                }
                catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException)
                {
                }
            }
            return null;
        }

        public void Dispose()
        {
            _connection.Dispose();
            OleDbConnection.ReleaseObjectPool();
            TryDelete(_copyPath);
        }

        private static void TryDelete(string path)
        {
            try
            {
                if (File.Exists(path)) File.Delete(path);
            }
            catch
            {
                // สำเนาค้างใน %TEMP% ไม่เป็นปัญหา — ลบรอบหน้า
            }
        }

        public static void CleanupStaleCopies()
        {
            try
            {
                foreach (var file in Directory.GetFiles(AppPaths.TempDir, "Pm2014_*.mdb")) TryDelete(file);
                foreach (var file in Directory.GetFiles(AppPaths.TempDir, "Pm2014_*.ldb")) TryDelete(file);
            }
            catch
            {
            }
        }
    }
}
