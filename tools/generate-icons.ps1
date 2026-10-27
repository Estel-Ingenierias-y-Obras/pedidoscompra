Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
public static class IconBounds {
    public static Rectangle Find(Bitmap image) {
        int left = image.Width, top = image.Height, right = -1, bottom = -1;
        for (int y = 0; y < image.Height; y++) {
            for (int x = 0; x < image.Width; x++) {
                Color pixel = image.GetPixel(x, y);
                if (pixel.A > 16 && (pixel.R < 245 || pixel.G < 245 || pixel.B < 245)) {
                    left = Math.Min(left, x); top = Math.Min(top, y);
                    right = Math.Max(right, x); bottom = Math.Max(bottom, y);
                }
            }
        }
        if (right < left) throw new InvalidOperationException("La imagen no contiene un logotipo visible");
        return Rectangle.FromLTRB(left, top, right + 1, bottom + 1);
    }
}
'@

$publicPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../frontend/public'))
$source = [Drawing.Bitmap]::new((Join-Path $publicPath 'ESTEL_RGB_ISOTIPO POSITIVO.png'))
try {
    $bounds = [IconBounds]::Find($source)
    $outputs = @{
        16 = 'favicon-16x16.png'
        32 = 'favicon-32x32.png'
        48 = $null
        180 = 'apple-touch-icon.png'
        192 = 'android-chrome-192x192.png'
        512 = 'android-chrome-512x512.png'
    }
    $icoFrames = @{}
    foreach ($size in ($outputs.Keys | Sort-Object)) {
        $bitmap = [Drawing.Bitmap]::new($size, $size)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $stream = [IO.MemoryStream]::new()
        try {
            $graphics.Clear([Drawing.Color]::White)
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $scale = ($size * 0.92) / [Math]::Max($bounds.Width, $bounds.Height)
            $width = [single]($bounds.Width * $scale)
            $height = [single]($bounds.Height * $scale)
            $target = [Drawing.RectangleF]::new(($size - $width) / 2, ($size - $height) / 2, $width, $height)
            $graphics.DrawImage($source, $target, $bounds, [Drawing.GraphicsUnit]::Pixel)
            $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
            $bytes = $stream.ToArray()
            if ($outputs[$size]) {
                [IO.File]::WriteAllBytes((Join-Path $publicPath $outputs[$size]), $bytes)
            }
            if ($size -le 48) { $icoFrames[$size] = $bytes }
        } finally {
            $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
        }
    }
    $ico = [IO.File]::Create((Join-Path $publicPath 'favicon.ico'))
    $writer = [IO.BinaryWriter]::new($ico)
    try {
        $sizes = @($icoFrames.Keys | Sort-Object)
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
        $offset = 6 + 16 * $sizes.Count
        foreach ($size in $sizes) {
            $writer.Write([byte]$size); $writer.Write([byte]$size)
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$icoFrames[$size].Length); $writer.Write([uint32]$offset)
            $offset += $icoFrames[$size].Length
        }
        foreach ($size in $sizes) { $writer.Write([byte[]]$icoFrames[$size]) }
    } finally { $writer.Dispose() }
} finally { $source.Dispose() }
