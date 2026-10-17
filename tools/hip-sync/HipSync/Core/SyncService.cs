using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace HipSync.Core
{
    public sealed class SyncProgress
    {
        public int Done { get; set; }
        public int Total { get; set; }
        public string Message { get; set; }
    }

    public sealed class SyncSummary
    {
        public SyncState State { get; set; }
        public int Batches { get; set; }
        public int Sent { get; set; }
        public int Inserted { get; set; }
        public int Duplicates { get; set; }
        public int NewBadges { get; set; }
        public int UnmappedBadges { get; set; }
        public int DaysUpdated { get; set; }
        public int Skipped { get; set; }
        public int LastSourceRowId { get; set; }
        public string LatestClientVersion { get; set; }
        public TimeSpan Elapsed { get; set; }

        public bool HasNewerVersion => IsNewer(LatestClientVersion);

        public static bool IsNewer(string latest) =>
            Version.TryParse(latest ?? "", out var v) && v > AppPaths.AppVersion;

        public string ToShortText() =>
            $"ใหม่ {Inserted:N0} · ซ้ำ {Duplicates:N0} · badge ยังไม่ผูก {UnmappedBadges:N0}";
    }

    public static class SyncService
    {
        private const int MaxUsersPerBatch = 5000;
        private const int MaxBadgeLength = 30;
        private const int MaxNameLength = 255;
        private const int MaxCheckTypeLength = 5;

        public static async Task<SyncState> TestConnectionAsync(AppSettings settings, CancellationToken ct)
        {
            using (var api = new SyncApiClient(settings.ServerUrl, settings.DeviceKey))
            {
                return await api.GetStateAsync(ct).ConfigureAwait(false);
            }
        }

        public static Task<MdbStats> TestMdbAsync(string path, string password) =>
            Task.Run(() =>
            {
                using (var mdb = MdbSnapshot.Open(path, password)) return mdb.GetStats();
            });

        /// <summary>
        /// ซิงค์ต่อจาก lastSourceRowId ที่เซิร์ฟเวอร์จำไว้ — ส่งซ้ำได้ปลอดภัย (เซิร์ฟเวอร์ตัดแถวซ้ำด้วย deviceId+sourceRowId)
        /// </summary>
        public static async Task<SyncSummary> RunAsync(AppSettings settings, IProgress<SyncProgress> progress, CancellationToken ct)
        {
            var started = DateTime.UtcNow;
            var batchSize = settings.EffectiveBatchSize;
            var summary = new SyncSummary();

            using (var api = new SyncApiClient(settings.ServerUrl, settings.DeviceKey))
            {
                Report(progress, 0, 0, "กำลังตรวจสอบกับเซิร์ฟเวอร์...");
                var state = await api.GetStateAsync(ct).ConfigureAwait(false);
                summary.State = state;
                summary.LastSourceRowId = state.LastSourceRowId;
                summary.UnmappedBadges = state.UnmappedBadges;
                summary.LatestClientVersion = state.LatestClientVersion;
                Logger.Info($"เริ่มซิงค์ สาขา {state.Branch?.Display} เครื่อง {state.Device?.Name} ต่อจากแถว {state.LastSourceRowId}");

                Report(progress, 0, 0, "กำลังเปิดไฟล์ HIP...");
                using (var mdb = await Task.Run(() => MdbSnapshot.Open(settings.MdbPath, settings.MdbPassword), ct).ConfigureAwait(false))
                {
                    var total = await Task.Run(() => mdb.CountPunchesAfter(state.LastSourceRowId), ct).ConfigureAwait(false);
                    var users = await Task.Run(() => mdb.ReadUsers(), ct).ConfigureAwait(false);
                    var batchUsers = users
                        .Where(u => u.BadgeNumber.Length <= MaxBadgeLength)
                        .Select(u => new BatchUser { BadgeNumber = u.BadgeNumber, Name = Truncate(u.Name, MaxNameLength) })
                        .Take(MaxUsersPerBatch)
                        .ToList();

                    Logger.Info($"พบพนักงานในเครื่อง {users.Count:N0} คน, แถวสแกนใหม่ {total:N0} แถว (provider {mdb.Provider})");
                    Report(progress, 0, total, total == 0 ? "ไม่มีข้อมูลสแกนใหม่ — อัปเดตรายชื่อ" : $"พบข้อมูลใหม่ {total:N0} แถว");

                    var cursor = state.LastSourceRowId;
                    var done = 0;
                    var first = true;
                    while (true)
                    {
                        ct.ThrowIfCancellationRequested();
                        var rows = await Task.Run(() =>
                        {
                            var list = mdb.ReadPunchesAfter(cursor, batchSize, out var lastId, out var skippedRows);
                            return Tuple.Create(list, lastId, skippedRows);
                        }, ct).ConfigureAwait(false);

                        var punches = rows.Item1;
                        var readUpTo = rows.Item2;
                        var skipped = rows.Item3 + punches.RemoveAll(p => p.BadgeNumber.Length > MaxBadgeLength);
                        summary.Skipped += skipped;
                        if (readUpTo == cursor && !first) break;

                        if (punches.Count > 0 || first)
                        {
                            var request = new BatchRequest
                            {
                                ClientVersion = AppPaths.AppVersionText,
                                Users = first ? batchUsers : new List<BatchUser>(),
                                Punches = punches.Select(ToBatchPunch).ToList(),
                            };
                            var result = await api.PostBatchAsync(request, ct).ConfigureAwait(false);
                            summary.Batches++;
                            summary.Sent += result.Received;
                            summary.Inserted += result.Inserted;
                            summary.Duplicates += result.Duplicates;
                            summary.NewBadges += result.NewBadges;
                            summary.DaysUpdated += result.DaysUpdated;
                            summary.UnmappedBadges = result.UnmappedBadges;
                            summary.LastSourceRowId = result.LastSourceRowId;
                            summary.LatestClientVersion = result.LatestClientVersion ?? summary.LatestClientVersion;
                            Logger.Info($"batch {summary.Batches}: ส่ง {result.Received} ใหม่ {result.Inserted} ซ้ำ {result.Duplicates} ถึงแถว {result.LastSourceRowId}");
                        }

                        first = false;
                        done += punches.Count + skipped;
                        Report(progress, Math.Min(done, total), total, $"ส่งแล้ว {Math.Min(done, total):N0} / {total:N0} แถว");
                        if (readUpTo == cursor) break;
                        cursor = readUpTo;
                    }
                }
            }

            summary.Elapsed = DateTime.UtcNow - started;
            if (summary.Skipped > 0) Logger.Info($"ข้ามแถวที่ไม่มีเลข badge หรือเวลา {summary.Skipped:N0} แถว");
            Logger.Info($"ซิงค์เสร็จ {summary.ToShortText()} ใช้เวลา {summary.Elapsed.TotalSeconds:N1} วินาที");
            return summary;
        }

        internal static BatchPunch ToBatchPunch(HipPunch p) => new BatchPunch
        {
            SourceRowId = p.SourceRowId,
            BadgeNumber = p.BadgeNumber,
            CheckTime = FormatLocalTime(p.CheckTime),
            CheckType = Truncate(p.CheckType, MaxCheckTypeLength),
            VerifyCode = p.VerifyCode,
        };

        /// <summary>HIP เก็บเวลาท้องถิ่นของเครื่องสาขา (ไม่มี timezone) → ใส่ offset ของเครื่องนี้ ณ เวลานั้น เช่น 2026-10-17T08:02:14+07:00</summary>
        public static string FormatLocalTime(DateTime local)
        {
            var unspecified = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
            var offset = TimeZoneInfo.Local.GetUtcOffset(unspecified);
            return new DateTimeOffset(unspecified, offset).ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture);
        }

        private static string Truncate(string value, int max) =>
            value == null ? null : value.Length <= max ? value : value.Substring(0, max);

        private static void Report(IProgress<SyncProgress> progress, int done, int total, string message) =>
            progress?.Report(new SyncProgress { Done = done, Total = total, Message = message });
    }
}
