# NSIS needs opaque BMP artwork at fixed sizes, not the web SVG assets.
Add-Type -AssemblyName System.Drawing
$assetDir = Join-Path $PSScriptRoot '../src-tauri/installer'
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null
$ink = [Drawing.ColorTranslator]::FromHtml('#050505')
$lime = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#bafa61'))
$white = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#f2f5f0'))
$muted = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#949b95'))
foreach ($size in @(@(164,314,'sidebar'), @(150,57,'header'))) {
    $bitmap = [Drawing.Bitmap]::new($size[0], $size[1], [Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [Drawing.Graphics]::FromImage($bitmap)
    $g.Clear($ink)
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $sidebar = $size[2] -eq 'sidebar'
    $scale = if ($sidebar) { 1.35 } else { 0.65 }
    $x = if ($sidebar) { 28 } else { 10 }
    $y = if ($sidebar) { 46 } else { 7 }
    $g.TranslateTransform($x, $y)
    $g.ScaleTransform($scale, $scale)
    $ring = [Drawing.Drawing2D.GraphicsPath]::new()
    $ring.AddArc(6,14,24,24,180,90); $ring.AddArc(30,14,24,24,270,90)
    $ring.AddArc(30,38,24,24,0,90); $ring.AddArc(6,38,24,24,90,90); $ring.CloseFigure()
    $ring.AddRectangle([Drawing.RectangleF]::new(20,29,18,18))
    $g.FillPath($white, $ring)
    $star = [Drawing.Drawing2D.GraphicsPath]::new()
    $star.AddBezier(51,0,51,11,48,15,38,17)
    $star.AddBezier(38,17,48,19,51,23,51,34)
    $star.AddBezier(51,34,51,23,54,19,64,17)
    $star.AddBezier(64,17,54,15,51,11,51,0)
    $g.FillPath($lime, $star)
    $g.ResetTransform()
    $font = [Drawing.Font]::new('Segoe UI', $(if ($sidebar) { 14 } else { 10 }), [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
    if ($sidebar) {
        $g.DrawString('Localization', $font, $white, 20, 162)
        $g.DrawString('Hub', $font, $lime, 20, 183)
        $small = [Drawing.Font]::new('Segoe UI', 11, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
        $g.FillRectangle($lime,20,226,30,2)
        $g.DrawString("Your words.`nYour workspace.", $small, $muted, 20, 246)
        $small.Dispose()
    } else {
        $g.DrawString('Localization', $font, $white, 56, 15)
        $g.DrawString('Hub', $font, $lime, 56, 29)
    }
    $bitmap.Save((Join-Path $assetDir ($size[2] + '.bmp')), [Drawing.Imaging.ImageFormat]::Bmp)
    $font.Dispose(); $ring.Dispose(); $star.Dispose(); $g.Dispose(); $bitmap.Dispose()
}
$lime.Dispose(); $white.Dispose(); $muted.Dispose()
