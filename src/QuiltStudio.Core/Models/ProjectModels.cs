namespace QuiltStudio.Core.Models;

public sealed class QuiltProject
{
    public int SchemaVersion { get; set; } = 1;
    public string Name { get; set; } = "Untitled Quilt";
    public List<BlockDefinition> Blocks { get; set; } = [new BlockDefinition()];
    public QuiltLayout Layout { get; set; } = new();
}

public sealed class BlockDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "Block 1";
    public double WidthInches { get; set; } = 12.0;
    public double HeightInches { get; set; } = 12.0;
    public double GridSizeInches { get; set; } = 0.25;
    public List<LineSegmentModel> Lines { get; set; } = [];
    public string? SourceImageFileName { get; set; }
    public string? SourceImageBase64 { get; set; }
    public double SourceImageOpacity { get; set; } = 0.45;
}

public sealed class QuiltLayout
{
    public double WidthInches { get; set; } = 90.0;
    public double HeightInches { get; set; } = 108.0;
    public List<BlockInstance> Instances { get; set; } = [];
}

public sealed class BlockInstance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BlockDefinitionId { get; set; }
    public double XInches { get; set; }
    public double YInches { get; set; }
    public double Scale { get; set; } = 1.0;
    public int RotationDegrees { get; set; }
    public bool MirrorHorizontal { get; set; }
    public bool MirrorVertical { get; set; }
}

public sealed record QuiltSizeReference(string Name, double WidthInches, double HeightInches)
{
    public static IReadOnlyList<QuiltSizeReference> Defaults { get; } =
    [
        new("Baby / Crib (reference)", 36, 52),
        new("Lap (reference)", 50, 65),
        new("Throw (reference)", 60, 72),
        new("Twin (reference)", 70, 90),
        new("Full / Double (reference)", 84, 96),
        new("Queen (reference)", 90, 108),
        new("King (reference)", 108, 108),
        new("California King (reference)", 104, 114)
    ];
}
