function updateGPS() {
  const url = "https://gps.thaigpstracker.co.th/api2/map/getRealTimeData";
  
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Basic TmpRNU5DNVVSMVF1Y3k1amFHRnliMlZ1WTJoaGFTNVVSMVF1TkM1VVIxUXVkR2d1VkVkVUxqRjBhQ1J6Y0djcVprTE1weDJR"
    },
    payload: JSON.stringify({
      asset: 2013 // ตัวเลขนี้ต้องมั่นใจว่าระบบรองรับรูปแบบนี้ หรือตรวจสอบว่าเป็นสตริง "2013" หรือไม่
    }),
    muteHttpExceptions: true // เปิดไว้เพื่อไม่ให้โค้ดหยุดทำงานเวลามี Error จาก API และจะยอมให้เราดูข้อความ Error ได้
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log("Response Code: " + responseCode);
    Logger.log("Response Text: " + responseText); // ดูว่า API ส่งอะไรกลับมา
    
    if (responseCode !== 200) {
      Logger.log("API เกิดข้อผิดพลาด รหัสสถานะ: " + responseCode);
      return;
    }
    
    const result = JSON.parse(responseText);
    const ss = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/1tkAnE4C4uJSUO18nv6bp3EybO-1UYvRkv7XVFsMnkFE/edit");
    const sheet = ss.getSheetByName("GPSDATA");
    
    if (!sheet) {
      Logger.log("ไม่พบชีตที่ชื่อ 'GPSDATA' กรุณาตรวจสอบชื่อชีตใน Google Sheets");
      return;
    }
    
// เคลียร์ข้อมูลเก่าและสร้างหัวตาราง (Header)
    sheet.clearContents();
    sheet.appendRow([
      "id",
      "imei",
      "asset",
      "object_magnetic_reader",
      "lat",
      "lng",
      "latlng",
      "speed",
      "status",
      //"timestamp",
      "time",
      "driver_id",
      "driver_name",
      "number",
      "color",
      "mileage",
      "categories",
      "statusonline",
      "car_rotation",
      "address",
      "near",
      "distance",
      "sat",
      "gsm",
      //"temperature",
      //"isMagnetic",
      //"isEngine",
      //"isRfid",
      //"overdriveHour",
      //"overdriveTen",
      //"oi",
      "overtemp",
      "lastUpdate",
      "datetime",
      "battery",
      "isEngineOn",
      "object_over_engine_alert",
      "object_over_park_alert",
      "object_alert_of_running_delay_from_plan",
      "object_off_route_alert",
      "object_over_speed_alert",
      "object_check_zone"
    ]);
    
    // วนลูปบันทึกข้อมูลจาก API ลง Sheet
    if (result && result.data && Array.isArray(result.data)) {
      result.data.forEach(car => {
        sheet.appendRow([
          car.id || "",
          car.imei || "",
          car.asset || "",
          car.object_magnetic_reader || "",
          car.lat || "",
          car.lng || "",
          car.latlng || "",
          car.speed || "",
          car.status || "",
          //car.timestamp || "",
          car.time || "",
          car.driver_id || "",
          car.driver_name || "",
          car.number || "",
          car.color || "",
          car.mileage || "",
          car.categories || "",
          car.statusonline || "",
          car.car_rotation || "",
          car.address || "",
          car.near || "",
          car.distance || "",
          car.sat || "",
          car.gsm || "",
          //car.temperature || "",
          //car.isMagnetic || "",
          //car.isEngine || "",
          //car.isRfid || "",
          //car.overdriveHour || "",
          //car.overdriveTen || "",
          //car.oi || "",
          car.overtemp || "",
          car.lastUpdate || "",
          car.datetime || "",
          car.battery || "",
          car.isEngineOn || "",
          car.object_over_engine_alert || "",
          car.object_over_park_alert || "",
          car.object_alert_of_running_delay_from_plan || "",
          car.object_off_route_alert || "",
          car.object_over_speed_alert || "",
          car.object_check_zone || ""
        ]);
      });
      Logger.log("บันทึกข้อมูลทั้งหมดเรียบร้อยแล้ว!");
    } else {
      Logger.log("โครงสร้างข้อมูล 'data' ไม่ตรงตามที่คาดไว้ หรือไม่มีข้อมูลส่งกลับมา");
    }
    
  } catch (error) {
    Logger.log("เกิดข้อผิดพลาดในการทำงาน: " + error.toString());
  }
}

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('GPS Realtime Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}