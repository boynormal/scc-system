; ตัวติดตั้ง HIP Sync — คอมไพล์ด้วย Inno Setup 6 (ใช้ ..\build.ps1 จะ build โปรแกรมก่อนแล้วคอมไพล์ไฟล์นี้)
; ติดตั้งแบบต่อผู้ใช้ (ไม่ต้องใช้สิทธิ์ admin) ไปที่ %LOCALAPPDATA%\Programs\HipSync

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#define AppName "HIP Sync"
#define AppExe "HipSync.exe"
#define BuildDir "..\HipSync\bin\Release\net48"

[Setup]
AppId={{6F0C3E8A-4B71-4C55-9C3E-5B2D7B8E1A41}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=SCC
AppComments=ซิงค์ข้อมูลสแกนนิ้วจาก HIP PremiumTime เข้าระบบ SCC
DefaultDirName={localappdata}\Programs\HipSync
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=HipSync-Setup-{#AppVersion}
SetupIconFile=..\HipSync\app.ico
UninstallDisplayIcon={app}\{#AppExe}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
MinVersion=6.1sp1
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#BuildDir}\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#BuildDir}\{#AppExe}.config"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[Code]
function IsDotNet48Installed(): Boolean;
var
  Release: Cardinal;
begin
  Result := RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full', 'Release', Release) and (Release >= 528040);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not IsDotNet48Installed() then
  begin
    MsgBox('เครื่องนี้ยังไม่มี .NET Framework 4.8' #13#10 'กรุณาติดตั้งจาก https://dotnet.microsoft.com/download/dotnet-framework/net48 แล้วรันตัวติดตั้งนี้อีกครั้ง', mbError, MB_OK);
    Result := False;
  end;
end;
