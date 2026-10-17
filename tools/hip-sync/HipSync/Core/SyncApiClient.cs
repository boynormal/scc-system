using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace HipSync.Core
{
    [DataContract]
    public sealed class DeviceInfo
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
    }

    [DataContract]
    public sealed class BranchInfo
    {
        [DataMember(Name = "code")] public string Code { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
        [DataMember(Name = "timezone")] public string Timezone { get; set; }

        public string Display => string.IsNullOrEmpty(Code) ? Name : $"{Code} — {Name}";
    }

    [DataContract]
    public sealed class SyncState
    {
        [DataMember(Name = "device")] public DeviceInfo Device { get; set; }
        [DataMember(Name = "branch")] public BranchInfo Branch { get; set; }
        [DataMember(Name = "lastSourceRowId")] public int LastSourceRowId { get; set; }
        [DataMember(Name = "unmappedBadges")] public int UnmappedBadges { get; set; }
        [DataMember(Name = "latestClientVersion")] public string LatestClientVersion { get; set; }
    }

    [DataContract]
    public sealed class BatchUser
    {
        [DataMember(Name = "badgeNumber")] public string BadgeNumber { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
    }

    [DataContract]
    public sealed class BatchPunch
    {
        [DataMember(Name = "sourceRowId")] public int SourceRowId { get; set; }
        [DataMember(Name = "badgeNumber")] public string BadgeNumber { get; set; }
        [DataMember(Name = "checkTime")] public string CheckTime { get; set; }
        [DataMember(Name = "checkType")] public string CheckType { get; set; }
        [DataMember(Name = "verifyCode")] public int? VerifyCode { get; set; }
    }

    [DataContract]
    public sealed class BatchRequest
    {
        [DataMember(Name = "clientVersion")] public string ClientVersion { get; set; }
        [DataMember(Name = "users")] public List<BatchUser> Users { get; set; } = new List<BatchUser>();
        [DataMember(Name = "punches")] public List<BatchPunch> Punches { get; set; } = new List<BatchPunch>();
    }

    [DataContract]
    public sealed class BatchResult
    {
        [DataMember(Name = "syncRunId")] public string SyncRunId { get; set; }
        [DataMember(Name = "received")] public int Received { get; set; }
        [DataMember(Name = "inserted")] public int Inserted { get; set; }
        [DataMember(Name = "duplicates")] public int Duplicates { get; set; }
        [DataMember(Name = "newBadges")] public int NewBadges { get; set; }
        [DataMember(Name = "unmappedBadges")] public int UnmappedBadges { get; set; }
        [DataMember(Name = "daysUpdated")] public int DaysUpdated { get; set; }
        [DataMember(Name = "lastSourceRowId")] public int LastSourceRowId { get; set; }
        [DataMember(Name = "latestClientVersion")] public string LatestClientVersion { get; set; }
    }

    [DataContract]
    internal sealed class Envelope<T>
    {
        [DataMember(Name = "data")] public T Data { get; set; }
        [DataMember(Name = "error")] public string Error { get; set; }
        [DataMember(Name = "code")] public string Code { get; set; }
    }

    public sealed class SyncApiClient : IDisposable
    {
        private static readonly Regex KeyFormat = new Regex(@"^hip_[A-Za-z0-9_-]{12}_[A-Za-z0-9_-]{16,}$", RegexOptions.Compiled);

        private readonly HttpClient _http;
        private readonly Uri _baseUri;

        public SyncApiClient(string serverUrl, string deviceKey)
        {
            _baseUri = ParseServerUrl(serverUrl);
            if (string.IsNullOrWhiteSpace(deviceKey))
                throw new UserFacingException("ยังไม่ได้ใส่ Device API key — ตั้งค่าในหน้าตั้งค่า");

            _http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(120) };
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", deviceKey.Trim());
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("HipSync/" + AppPaths.AppVersionText);
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        public static bool LooksLikeDeviceKey(string key) => key != null && KeyFormat.IsMatch(key.Trim());

        public static Uri ParseServerUrl(string serverUrl)
        {
            if (!Uri.TryCreate((serverUrl ?? "").Trim().TrimEnd('/') + "/", UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                throw new UserFacingException("URL เซิร์ฟเวอร์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https://)");
            return uri;
        }

        public static bool IsInsecureRemote(string serverUrl)
        {
            if (!Uri.TryCreate((serverUrl ?? "").Trim(), UriKind.Absolute, out var uri)) return false;
            return uri.Scheme == Uri.UriSchemeHttp && !uri.IsLoopback;
        }

        public Task<SyncState> GetStateAsync(CancellationToken ct) =>
            SendAsync<SyncState>(new HttpRequestMessage(HttpMethod.Get, new Uri(_baseUri, "api/device-sync/hip/state")), ct);

        public Task<BatchResult> PostBatchAsync(BatchRequest batch, CancellationToken ct)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, new Uri(_baseUri, "api/device-sync/hip/batch"))
            {
                Content = new ByteArrayContent(Serialize(batch)),
            };
            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };
            return SendAsync<BatchResult>(request, ct);
        }

        private async Task<T> SendAsync<T>(HttpRequestMessage request, CancellationToken ct) where T : class
        {
            HttpResponseMessage response;
            try
            {
                response = await _http.SendAsync(request, ct).ConfigureAwait(false);
            }
            catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
            {
                throw new UserFacingException("เซิร์ฟเวอร์ตอบช้าเกินไป (timeout) — ตรวจอินเทอร์เน็ตแล้วลองใหม่", ex);
            }
            catch (HttpRequestException ex)
            {
                throw new UserFacingException($"เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ({_baseUri.Host}) — ตรวจอินเทอร์เน็ตหรือ URL ในหน้าตั้งค่า", ex);
            }

            using (response)
            {
                var body = await response.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
                var envelope = TryDeserialize<Envelope<T>>(body);
                var status = (int)response.StatusCode;

                if (response.IsSuccessStatusCode && envelope?.Data != null) return envelope.Data;

                var serverMessage = envelope?.Error;
                Logger.Error($"{request.Method} {request.RequestUri} → HTTP {status} {envelope?.Code} {serverMessage}");

                if (status == 401 || status == 403)
                    throw new UserFacingException("Device API key ไม่ถูกต้อง หรือถูกยกเลิกแล้ว — ขอ key ใหม่จากผู้ดูแลระบบ (หน้าเว็บ HR > บันทึกเวลา)");
                if (status == 400)
                    throw new UserFacingException("เซิร์ฟเวอร์ไม่รับข้อมูล: " + (serverMessage ?? "ข้อมูลไม่ถูกต้อง"));
                if (status >= 300 && status < 400 || status == 404 || (response.IsSuccessStatusCode && envelope == null))
                    throw new UserFacingException("ไม่พบ API ซิงค์ที่ URL นี้ — ตรวจ URL เซิร์ฟเวอร์ในหน้าตั้งค่า");
                if (status >= 500)
                    throw new UserFacingException($"เซิร์ฟเวอร์ผิดพลาด (HTTP {status}) — ลองใหม่ภายหลัง" +
                                                  (serverMessage != null ? Environment.NewLine + serverMessage : ""));
                throw new UserFacingException($"เซิร์ฟเวอร์ตอบกลับผิดปกติ (HTTP {status}) {serverMessage}");
            }
        }

        private static byte[] Serialize<T>(T value)
        {
            using (var stream = new MemoryStream())
            {
                new DataContractJsonSerializer(typeof(T)).WriteObject(stream, value);
                return stream.ToArray();
            }
        }

        private static T TryDeserialize<T>(byte[] body) where T : class
        {
            if (body == null || body.Length == 0) return null;
            try
            {
                using (var stream = new MemoryStream(body))
                {
                    return (T)new DataContractJsonSerializer(typeof(T)).ReadObject(stream);
                }
            }
            catch (Exception ex) when (ex is SerializationException || ex is InvalidCastException || ex is ArgumentException)
            {
                var preview = Encoding.UTF8.GetString(body, 0, Math.Min(body.Length, 200));
                Logger.Error("แปลง JSON จากเซิร์ฟเวอร์ไม่ได้: " + preview);
                return null;
            }
        }

        public void Dispose() => _http.Dispose();
    }
}
