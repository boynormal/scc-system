using System;
using System.Security.Cryptography;
using System.Text;

namespace HipSync.Core
{
    /// <summary>เข้ารหัสค่าลับด้วย DPAPI (CurrentUser) — ถอดได้เฉพาะ Windows user เดิมบนเครื่องเดิม</summary>
    public static class SecretProtector
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("SCC.HipSync.v1");

        public static string Protect(string plain)
        {
            if (string.IsNullOrEmpty(plain)) return null;
            var bytes = ProtectedData.Protect(Encoding.UTF8.GetBytes(plain), Entropy, DataProtectionScope.CurrentUser);
            return Convert.ToBase64String(bytes);
        }

        public static string Unprotect(string protectedValue)
        {
            if (string.IsNullOrEmpty(protectedValue)) return null;
            try
            {
                var bytes = ProtectedData.Unprotect(Convert.FromBase64String(protectedValue), Entropy, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(bytes);
            }
            catch (Exception ex) when (ex is CryptographicException || ex is FormatException)
            {
                Logger.Error("ถอดรหัสค่าที่บันทึกไว้ไม่ได้ (อาจย้ายเครื่องหรือเปลี่ยน Windows user) — ต้องตั้งค่าใหม่");
                return null;
            }
        }

        public static string HashPin(string pin, string salt)
        {
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(salt + ":" + pin));
                return Convert.ToBase64String(hash);
            }
        }

        public static string NewSalt()
        {
            var bytes = new byte[16];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes);
        }
    }
}
