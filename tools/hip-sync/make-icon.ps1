# สร้าง HipSync\app.ico (ไอคอนลายนิ้วมือ + ลูกศรซิงค์) — รันใหม่เมื่อต้องการแก้ไอคอนเท่านั้น
Add-Type -AssemblyName System.Drawing

$sizes = 16, 32, 48, 256
$images = foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 101, 52))
  $g.FillEllipse($bg, 0, 0, $s - 1, $s - 1)
  $w = [Math]::Max(1, $s / 16)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $w
  $c = $s / 2
  foreach ($r in @(0.16, 0.26, 0.36)) {
    $d = $s * $r
    $g.DrawArc($pen, $c - $d, $c - $d, 2 * $d, 2 * $d, 200, 300)
  }
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  , $ms.ToArray()
}

$out = Join-Path $PSScriptRoot 'HipSync\app.ico'
$fs = [System.IO.File]::Create($out)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]
  $dim = if ($s -ge 256) { 0 } else { $s }
  $bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$images[$i].Length); $bw.Write([UInt32]$offset)
  $offset += $images[$i].Length
}
foreach ($img in $images) { $bw.Write($img) }
$bw.Close()
Write-Output "wrote $out"
