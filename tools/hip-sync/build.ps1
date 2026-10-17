# Build HipSync.exe (Release, net48 x86) แล้วสร้างตัวติดตั้ง dist\HipSync-Setup-<version>.exe
# ต้องมี .NET SDK 8 (เครื่อง dev เท่านั้น) และ Inno Setup 6
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$dotnet = 'dotnet'
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { $dotnet = 'C:\Program Files\dotnet\dotnet.exe' }
& $dotnet build HipSync.sln -c Release -nologo
if ($LASTEXITCODE -ne 0) { throw "dotnet build failed" }

$version = ([xml](Get-Content HipSync\HipSync.csproj)).Project.PropertyGroup.Version | Where-Object { $_ } | Select-Object -First 1
$iscc = @(
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
  "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "ไม่พบ Inno Setup 6 (ISCC.exe)" }

& $iscc "/DAppVersion=$version" installer\HipSync.iss
if ($LASTEXITCODE -ne 0) { throw "ISCC failed" }
Get-Item "dist\HipSync-Setup-$version.exe"
