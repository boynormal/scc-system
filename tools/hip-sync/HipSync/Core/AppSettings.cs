using System;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;

namespace HipSync.Core
{
    [DataContract]
    public class AppSettings
    {
        public const string DefaultMdbPassword = "hippmforyou";
        public const string DefaultServerUrl = "http://localhost:3000";
        public const int MaxBatchSize = 2000;

        [DataMember(Name = "mdbPath")] public string MdbPath { get; set; }
        [DataMember(Name = "mdbPasswordProtected")] public string MdbPasswordProtected { get; set; }
        [DataMember(Name = "serverUrl")] public string ServerUrl { get; set; }
        [DataMember(Name = "deviceKeyProtected")] public string DeviceKeyProtected { get; set; }
        [DataMember(Name = "autoSyncOnStart")] public bool AutoSyncOnStart { get; set; }
        [DataMember(Name = "batchSize")] public int BatchSize { get; set; }
        [DataMember(Name = "pinSalt")] public string PinSalt { get; set; }
        [DataMember(Name = "pinHash")] public string PinHash { get; set; }

        [DataMember(Name = "lastBranch")] public string LastBranch { get; set; }
        [DataMember(Name = "lastDevice")] public string LastDevice { get; set; }
        [DataMember(Name = "lastSyncAt")] public string LastSyncAt { get; set; }
        [DataMember(Name = "lastSyncSummary")] public string LastSyncSummary { get; set; }

        public string MdbPassword
        {
            get => SecretProtector.Unprotect(MdbPasswordProtected) ?? DefaultMdbPassword;
            set => MdbPasswordProtected = SecretProtector.Protect(value);
        }

        public string DeviceKey
        {
            get => SecretProtector.Unprotect(DeviceKeyProtected);
            set => DeviceKeyProtected = SecretProtector.Protect(value);
        }

        public bool HasPin => !string.IsNullOrEmpty(PinHash) && !string.IsNullOrEmpty(PinSalt);

        public bool IsComplete =>
            !string.IsNullOrWhiteSpace(MdbPath) && !string.IsNullOrWhiteSpace(ServerUrl) && !string.IsNullOrEmpty(DeviceKey);

        public int EffectiveBatchSize => BatchSize <= 0 ? MaxBatchSize : Math.Min(BatchSize, MaxBatchSize);

        public void SetPin(string pin)
        {
            if (string.IsNullOrEmpty(pin))
            {
                PinSalt = null;
                PinHash = null;
                return;
            }
            PinSalt = SecretProtector.NewSalt();
            PinHash = SecretProtector.HashPin(pin, PinSalt);
        }

        public bool CheckPin(string pin) => HasPin && SecretProtector.HashPin(pin ?? "", PinSalt) == PinHash;

        public void RecordSync(SyncSummary summary)
        {
            LastBranch = summary.State?.Branch?.Display;
            LastDevice = summary.State?.Device?.Name;
            LastSyncAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture);
            LastSyncSummary = summary.ToShortText();
        }

        public static AppSettings Load()
        {
            AppSettings settings = null;
            try
            {
                if (File.Exists(AppPaths.SettingsFile))
                {
                    using (var stream = File.OpenRead(AppPaths.SettingsFile))
                    {
                        settings = (AppSettings)new DataContractJsonSerializer(typeof(AppSettings)).ReadObject(stream);
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.Error("อ่านไฟล์ตั้งค่าไม่ได้ ใช้ค่าเริ่มต้นแทน", ex);
            }
            settings = settings ?? new AppSettings();
            if (string.IsNullOrWhiteSpace(settings.ServerUrl)) settings.ServerUrl = DefaultServerUrl;
            if (settings.BatchSize <= 0) settings.BatchSize = MaxBatchSize;
            return settings;
        }

        public void Save()
        {
            var tmp = AppPaths.SettingsFile + ".tmp";
            using (var stream = new MemoryStream())
            {
                using (var writer = JsonReaderWriterFactory.CreateJsonWriter(stream, Encoding.UTF8, false, true))
                {
                    new DataContractJsonSerializer(typeof(AppSettings)).WriteObject(writer, this);
                }
                File.WriteAllBytes(tmp, stream.ToArray());
            }
            if (File.Exists(AppPaths.SettingsFile)) File.Replace(tmp, AppPaths.SettingsFile, null);
            else File.Move(tmp, AppPaths.SettingsFile);
        }
    }
}
