using QuiltStudio.Core.Models;

namespace QuiltStudio.Core.Services;

public static class FabricMatcher
{
    public static IReadOnlyList<FabricMatchResult> FindClosest(string targetHex, string? brand = null, int count = 8)
    {
        var target = ParseHex(targetHex);
        var targetLab = RgbToLab(target.r, target.g, target.b);

        IEnumerable<FabricSwatch> source = FabricCatalog.Starter;
        if (!string.IsNullOrWhiteSpace(brand) && !brand.Equals("All brands", StringComparison.OrdinalIgnoreCase))
            source = source.Where(s => s.Brand.Equals(brand, StringComparison.OrdinalIgnoreCase));

        return source
            .Select(s =>
            {
                var rgb = ParseHex(s.Hex);
                var lab = RgbToLab(rgb.r, rgb.g, rgb.b);
                return new FabricMatchResult(s, DeltaE76(targetLab, lab));
            })
            .OrderBy(m => m.DeltaE)
            .Take(Math.Max(1, count))
            .ToList();
    }

    public static bool TryNormalizeHex(string raw, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var value = raw.Trim();
        if (!value.StartsWith('#')) value = "#" + value;
        if (value.Length != 7) return false;
        if (!int.TryParse(value.AsSpan(1), System.Globalization.NumberStyles.HexNumber, null, out _)) return false;
        normalized = value.ToUpperInvariant();
        return true;
    }

    private static (byte r, byte g, byte b) ParseHex(string hex)
    {
        if (!TryNormalizeHex(hex, out var normalized))
            throw new ArgumentException("Color must be a six-digit hex value such as #4A78B2.", nameof(hex));
        return (
            Convert.ToByte(normalized.Substring(1, 2), 16),
            Convert.ToByte(normalized.Substring(3, 2), 16),
            Convert.ToByte(normalized.Substring(5, 2), 16));
    }

    private static (double l, double a, double b) RgbToLab(byte r8, byte g8, byte b8)
    {
        static double Linearize(double c)
        {
            c /= 255.0;
            return c <= 0.04045 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);
        }

        var r = Linearize(r8);
        var g = Linearize(g8);
        var b = Linearize(b8);

        var x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
        var y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
        var z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

        static double F(double t) => t > 0.008856 ? Math.Pow(t, 1.0 / 3.0) : (7.787 * t) + (16.0 / 116.0);
        var fx = F(x);
        var fy = F(y);
        var fz = F(z);

        return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz));
    }

    private static double DeltaE76((double l, double a, double b) x, (double l, double a, double b) y)
    {
        var dl = x.l - y.l;
        var da = x.a - y.a;
        var db = x.b - y.b;
        return Math.Sqrt(dl * dl + da * da + db * db);
    }
}
