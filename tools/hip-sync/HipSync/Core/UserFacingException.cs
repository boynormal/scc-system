using System;

namespace HipSync.Core
{
    /// <summary>ข้อผิดพลาดที่ข้อความพร้อมแสดงให้ผู้ใช้สาขาอ่าน (ภาษาไทย)</summary>
    public class UserFacingException : Exception
    {
        public UserFacingException(string message, Exception inner = null) : base(message, inner)
        {
        }
    }
}
