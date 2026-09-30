namespace QuiltStudio.Core.Models;

public sealed record FabricSwatch(
    string Brand,
    string Line,
    string ColorName,
    string Sku,
    string Hex)
{
    public string DisplayName => $"{Brand} {Line} - {ColorName}";
}

public sealed record FabricMatchResult(FabricSwatch Swatch, double DeltaE)
{
    public string Brand => Swatch.Brand;
    public string Line => Swatch.Line;
    public string ColorName => Swatch.ColorName;
    public string Sku => Swatch.Sku;
    public string Hex => Swatch.Hex;
    public string MatchText => $"ΔE {DeltaE:0.0}";
}
