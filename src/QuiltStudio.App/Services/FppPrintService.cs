using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using QuiltStudio.Core.Models;

namespace QuiltStudio.App.Services;

public static class FppPrintService
{
    public static bool Print(BlockDefinition block, Window owner)
    {
        var dialog = new PrintDialog();
        if (dialog.ShowDialog() != true)
            return false;

        var width = Math.Max(300, dialog.PrintableAreaWidth);
        var height = Math.Max(300, dialog.PrintableAreaHeight);
        var paginator = new FppPatternPaginator(block, width, height, mirrorHorizontally: true, seamAllowanceInches: 0.25);

        try
        {
            dialog.PrintDocument(paginator, $"QuiltStudio FPP - {block.Name}");
            return true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(owner, ex.Message, "Could not print FPP pattern", MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
    }
}

internal sealed class FppPatternPaginator : DocumentPaginator
{
    private const double DipsPerInch = 96.0;
    private readonly BlockDefinition _block;
    private readonly double _pageWidth;
    private readonly double _pageHeight;
    private readonly bool _mirror;
    private readonly double _seam;
    private readonly double _pageMargin = 0.18 * DipsPerInch;
    private readonly double _headerHeight = 0.62 * DipsPerInch;
    private readonly double _footerHeight = 1.18 * DipsPerInch;
    private readonly double _patternWidth;
    private readonly double _patternHeight;
    private readonly double _tileWidth;
    private readonly double _tileHeight;
    private readonly int _columns;
    private readonly int _rows;

    public FppPatternPaginator(BlockDefinition block, double pageWidth, double pageHeight, bool mirrorHorizontally, double seamAllowanceInches)
    {
        _block = block;
        _pageWidth = pageWidth;
        _pageHeight = pageHeight;
        _mirror = mirrorHorizontally;
        _seam = seamAllowanceInches * DipsPerInch;
        _patternWidth = block.WidthInches * DipsPerInch + 2 * _seam;
        _patternHeight = block.HeightInches * DipsPerInch + 2 * _seam;
        _tileWidth = Math.Max(DipsPerInch, _pageWidth - 2 * _pageMargin);
        _tileHeight = Math.Max(DipsPerInch, _pageHeight - _headerHeight - _footerHeight - 2 * _pageMargin);
        _columns = Math.Max(1, (int)Math.Ceiling(_patternWidth / _tileWidth));
        _rows = Math.Max(1, (int)Math.Ceiling(_patternHeight / _tileHeight));
    }

    public override bool IsPageCountValid => true;
    public override int PageCount => _columns * _rows;
    public override Size PageSize { get => new(_pageWidth, _pageHeight); set { } }
    public override IDocumentPaginatorSource? Source => null;

    public override DocumentPage GetPage(int pageNumber)
    {
        if (pageNumber < 0 || pageNumber >= PageCount)
            return DocumentPage.Missing;

        var column = pageNumber % _columns;
        var row = pageNumber / _columns;
        var visual = new DrawingVisual();
        using var dc = visual.RenderOpen();

        dc.DrawRectangle(Brushes.White, null, new Rect(0, 0, _pageWidth, _pageHeight));
        DrawHeader(dc, pageNumber, row, column);

        var contentRect = new Rect(_pageMargin, _pageMargin + _headerHeight, _tileWidth, _tileHeight);
        DrawRegistrationMarks(dc, contentRect);
        dc.PushClip(new RectangleGeometry(contentRect));
        dc.PushTransform(new TranslateTransform(
            contentRect.Left - column * _tileWidth,
            contentRect.Top - row * _tileHeight));
        DrawPattern(dc);
        dc.Pop();
        dc.Pop();

        DrawFooter(dc, pageNumber);
        return new DocumentPage(visual, new Size(_pageWidth, _pageHeight), new Rect(0, 0, _pageWidth, _pageHeight), new Rect(0, 0, _pageWidth, _pageHeight));
    }

    private void DrawPattern(DrawingContext dc)
    {
        var cutPen = new Pen(Brushes.Black, 1.2) { DashStyle = DashStyles.Dash };
        var finishedPen = new Pen(Brushes.Black, 1.5);
        var seamPen = new Pen(Brushes.Black, 0.9);

        dc.DrawRectangle(null, cutPen, new Rect(0, 0, _patternWidth, _patternHeight));
        dc.DrawRectangle(null, finishedPen, new Rect(_seam, _seam, _block.WidthInches * DipsPerInch, _block.HeightInches * DipsPerInch));

        foreach (var line in _block.Lines)
        {
            var x1 = _mirror ? _block.WidthInches - line.Start.X : line.Start.X;
            var x2 = _mirror ? _block.WidthInches - line.End.X : line.End.X;
            var p1 = new Point(_seam + x1 * DipsPerInch, _seam + line.Start.Y * DipsPerInch);
            var p2 = new Point(_seam + x2 * DipsPerInch, _seam + line.End.Y * DipsPerInch);
            dc.DrawLine(seamPen, p1, p2);
        }
    }

    private void DrawHeader(DrawingContext dc, int pageNumber, int row, int column)
    {
        var title = $"{_block.Name} - FPP Pattern";
        DrawText(dc, title, 14, FontWeights.Bold, new Point(_pageMargin, _pageMargin));
        DrawText(dc,
            $"Finished: {_block.WidthInches:0.###}\" x {_block.HeightInches:0.###}\"   |   1/4\" seam allowance   |   Mirrored for FPP   |   Tile {row + 1},{column + 1}",
            8.5, FontWeights.Normal, new Point(_pageMargin, _pageMargin + 23));
        DrawText(dc, "Print at 100% / Actual Size. Do not use Fit or Shrink.", 8.5, FontWeights.Bold, new Point(_pageMargin, _pageMargin + 38));
    }

    private void DrawFooter(DrawingContext dc, int pageNumber)
    {
        var top = _pageHeight - _footerHeight - _pageMargin + 4;
        DrawText(dc, $"Page {pageNumber + 1} of {PageCount}", 8.5, FontWeights.Normal, new Point(_pageMargin, top));
        DrawText(dc, "Calibration square must measure exactly 1 inch after printing.", 8, FontWeights.Normal, new Point(_pageMargin + 1.18 * DipsPerInch, top + 13));

        var square = new Rect(_pageMargin, top + 16, DipsPerInch, DipsPerInch);
        dc.DrawRectangle(null, new Pen(Brushes.Black, 1), square);
        DrawText(dc, "1 in", 8, FontWeights.Bold, new Point(square.Left + 34, square.Top + 38));
    }

    private static void DrawRegistrationMarks(DrawingContext dc, Rect rect)
    {
        var pen = new Pen(Brushes.Gray, 0.6);
        const double length = 10;
        foreach (var point in new[]
                 {
                     new Point(rect.Left, rect.Top), new Point(rect.Right, rect.Top),
                     new Point(rect.Left, rect.Bottom), new Point(rect.Right, rect.Bottom)
                 })
        {
            dc.DrawLine(pen, new Point(point.X - length, point.Y), new Point(point.X + length, point.Y));
            dc.DrawLine(pen, new Point(point.X, point.Y - length), new Point(point.X, point.Y + length));
        }
    }

    private static void DrawText(DrawingContext dc, string text, double size, FontWeight weight, Point point)
    {
        var formatted = new FormattedText(
            text,
            CultureInfo.CurrentCulture,
            FlowDirection.LeftToRight,
            new Typeface(new FontFamily("Arial"), FontStyles.Normal, weight, FontStretches.Normal),
            size,
            Brushes.Black,
            1.0);
        dc.DrawText(formatted, point);
    }

    public override void ComputePageCount() { }
}
