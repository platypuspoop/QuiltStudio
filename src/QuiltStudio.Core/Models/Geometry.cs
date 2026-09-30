namespace QuiltStudio.Core.Models;

public sealed class Point2D
{
    public double X { get; set; }
    public double Y { get; set; }

    public Point2D() { }
    public Point2D(double x, double y) { X = x; Y = y; }
    public Point2D Clone() => new(X, Y);
}

public sealed class LineSegmentModel
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Point2D Start { get; set; } = new();
    public Point2D End { get; set; } = new();
}
