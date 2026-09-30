using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using QuiltStudio.Core.Models;

namespace QuiltStudio.App.Controls;

public enum EditorTool
{
    Select,
    Line,
    Vertex,
    ColorPicker
}

public partial class BlockEditorControl : UserControl
{
    private const double BasePixelsPerInch = 52.0;
    private const double HitRadiusPixels = 9.0;

    private BlockDefinition? _block;
    private EditorTool _tool = EditorTool.Line;
    private double _zoom = 1.0;
    private bool _snapEnabled = true;
    private Point2D? _pendingLineStart;
    private LineSegmentModel? _selectedLine;
    private int _selectedEndpoint = -1;
    private bool _draggingEndpoint;
    private Point2D? _dragStartModelPoint;
    private readonly Stack<IEditorAction> _undo = new();
    private readonly Stack<IEditorAction> _redo = new();

    public event EventHandler? ModelChanged;
    public event EventHandler<string>? StatusChanged;
    public event Action<Color>? ColorSampled;

    public BlockEditorControl()
    {
        InitializeComponent();
        SizeChanged += (_, _) => Render();
        KeyDown += BlockEditorControl_OnKeyDown;
    }

    public BlockDefinition? Block
    {
        get => _block;
        set
        {
            _block = value;
            _pendingLineStart = null;
            _selectedLine = null;
            _selectedEndpoint = -1;
            _undo.Clear();
            _redo.Clear();
            Render();
        }
    }

    public EditorTool Tool
    {
        get => _tool;
        set
        {
            _tool = value;
            _pendingLineStart = null;
            StatusChanged?.Invoke(this, $"Tool: {_tool}");
            Render();
        }
    }

    public bool SnapEnabled
    {
        get => _snapEnabled;
        set { _snapEnabled = value; Render(); }
    }

    public double Zoom
    {
        get => _zoom;
        set
        {
            _zoom = Math.Clamp(value, 0.25, 6.0);
            Render();
        }
    }

    public bool CanUndo => _undo.Count > 0;
    public bool CanRedo => _redo.Count > 0;

    public void Undo()
    {
        if (_undo.TryPop(out var action))
        {
            action.Undo();
            _redo.Push(action);
            _selectedLine = null;
            Render();
            NotifyChanged("Undo");
        }
    }

    public void Redo()
    {
        if (_redo.TryPop(out var action))
        {
            action.Redo();
            _undo.Push(action);
            _selectedLine = null;
            Render();
            NotifyChanged("Redo");
        }
    }

    public void DeleteSelection()
    {
        if (_block is null || _selectedLine is null)
            return;

        var index = _block.Lines.IndexOf(_selectedLine);
        if (index < 0)
            return;

        Execute(new DeleteLineAction(_block, _selectedLine, index));
        _selectedLine = null;
        _selectedEndpoint = -1;
        NotifyChanged("Line deleted");
    }

    public void RefreshImage() => Render();

    private double Ppi => BasePixelsPerInch * _zoom;

    private void Render()
    {
        Surface.Children.Clear();
        if (_block is null)
        {
            Surface.Width = 640;
            Surface.Height = 480;
            return;
        }

        Surface.Width = Math.Max(100, _block.WidthInches * Ppi);
        Surface.Height = Math.Max(100, _block.HeightInches * Ppi);

        DrawSourceImage();
        DrawGrid();
        DrawLines();

        if (_pendingLineStart is not null)
        {
            var p = ToScreen(_pendingLineStart);
            var marker = new Ellipse
            {
                Width = 10,
                Height = 10,
                Stroke = Brushes.DarkOrange,
                StrokeThickness = 2,
                Fill = Brushes.White
            };
            Canvas.SetLeft(marker, p.X - 5);
            Canvas.SetTop(marker, p.Y - 5);
            Surface.Children.Add(marker);
        }
    }

    private void DrawSourceImage()
    {
        if (_block?.SourceImageBase64 is null)
            return;

        try
        {
            var bytes = Convert.FromBase64String(_block.SourceImageBase64);
            using var stream = new MemoryStream(bytes);
            var bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.StreamSource = stream;
            bitmap.EndInit();
            bitmap.Freeze();

            Surface.Children.Add(new Image
            {
                Source = bitmap,
                Width = Surface.Width,
                Height = Surface.Height,
                Stretch = Stretch.Uniform,
                Opacity = Math.Clamp(_block.SourceImageOpacity, 0, 1),
                IsHitTestVisible = false
            });
        }
        catch
        {
            StatusChanged?.Invoke(this, "The embedded source image could not be rendered.");
        }
    }

    private void DrawGrid()
    {
        if (_block is null)
            return;

        var step = Math.Max(0.0625, _block.GridSizeInches) * Ppi;
        var majorEvery = Math.Max(1, (int)Math.Round(1.0 / Math.Max(0.0625, _block.GridSizeInches)));
        var index = 0;

        for (double x = 0; x <= Surface.Width + 0.5; x += step, index++)
        {
            var major = index % majorEvery == 0;
            Surface.Children.Add(new Line
            {
                X1 = x, Y1 = 0, X2 = x, Y2 = Surface.Height,
                Stroke = major ? Brushes.LightSlateGray : Brushes.Gainsboro,
                StrokeThickness = major ? 0.8 : 0.45,
                IsHitTestVisible = false
            });
        }

        index = 0;
        for (double y = 0; y <= Surface.Height + 0.5; y += step, index++)
        {
            var major = index % majorEvery == 0;
            Surface.Children.Add(new Line
            {
                X1 = 0, Y1 = y, X2 = Surface.Width, Y2 = y,
                Stroke = major ? Brushes.LightSlateGray : Brushes.Gainsboro,
                StrokeThickness = major ? 0.8 : 0.45,
                IsHitTestVisible = false
            });
        }
    }

    private void DrawLines()
    {
        if (_block is null)
            return;

        foreach (var model in _block.Lines)
        {
            var a = ToScreen(model.Start);
            var b = ToScreen(model.End);
            var selected = ReferenceEquals(model, _selectedLine);
            Surface.Children.Add(new Line
            {
                X1 = a.X, Y1 = a.Y, X2 = b.X, Y2 = b.Y,
                Stroke = selected ? Brushes.DodgerBlue : Brushes.Black,
                StrokeThickness = selected ? 2.6 : 1.8,
                IsHitTestVisible = false
            });

            if (selected || _tool == EditorTool.Vertex)
            {
                DrawVertex(a, selected && _selectedEndpoint == 0);
                DrawVertex(b, selected && _selectedEndpoint == 1);
            }
        }
    }

    private void DrawVertex(Point point, bool active)
    {
        var size = active ? 10.0 : 7.0;
        var dot = new Ellipse
        {
            Width = size,
            Height = size,
            Fill = active ? Brushes.DodgerBlue : Brushes.White,
            Stroke = Brushes.DimGray,
            StrokeThickness = 1.2,
            IsHitTestVisible = false
        };
        Canvas.SetLeft(dot, point.X - size / 2);
        Canvas.SetTop(dot, point.Y - size / 2);
        Surface.Children.Add(dot);
    }

    private bool TrySampleSourceImage(Point screen, out Color color)
    {
        color = Colors.Transparent;
        if (_block?.SourceImageBase64 is null)
            return false;

        try
        {
            var bytes = Convert.FromBase64String(_block.SourceImageBase64);
            using var stream = new MemoryStream(bytes);
            var bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.StreamSource = stream;
            bitmap.EndInit();
            bitmap.Freeze();

            var scale = Math.Min(Surface.Width / bitmap.PixelWidth, Surface.Height / bitmap.PixelHeight);
            if (scale <= 0) return false;
            var renderedWidth = bitmap.PixelWidth * scale;
            var renderedHeight = bitmap.PixelHeight * scale;
            var offsetX = (Surface.Width - renderedWidth) / 2.0;
            var offsetY = (Surface.Height - renderedHeight) / 2.0;

            if (screen.X < offsetX || screen.Y < offsetY || screen.X >= offsetX + renderedWidth || screen.Y >= offsetY + renderedHeight)
                return false;

            var px = Math.Clamp((int)((screen.X - offsetX) / scale), 0, bitmap.PixelWidth - 1);
            var py = Math.Clamp((int)((screen.Y - offsetY) / scale), 0, bitmap.PixelHeight - 1);

            var converted = new FormatConvertedBitmap(bitmap, PixelFormats.Bgra32, null, 0);
            var pixel = new byte[4];
            converted.CopyPixels(new Int32Rect(px, py, 1, 1), pixel, 4, 0);
            color = Color.FromArgb(pixel[3], pixel[2], pixel[1], pixel[0]);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private void Surface_OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        Focus();
        if (_block is null)
            return;

        var screen = e.GetPosition(Surface);
        var model = ToModel(screen, snap: _snapEnabled);

        if (_tool == EditorTool.ColorPicker)
        {
            if (TrySampleSourceImage(screen, out var sampled))
            {
                ColorSampled?.Invoke(sampled);
                StatusChanged?.Invoke(this, $"Sampled #{sampled.R:X2}{sampled.G:X2}{sampled.B:X2}");
            }
            else
            {
                StatusChanged?.Invoke(this, "Click directly on the imported source image to sample a fabric color.");
            }
            return;
        }

        if (_tool == EditorTool.Line)
        {
            if (_pendingLineStart is null)
            {
                _pendingLineStart = model;
                StatusChanged?.Invoke(this, $"Line start: {Format(model)}");
            }
            else
            {
                if (DistanceModel(_pendingLineStart, model) > 0.0001)
                {
                    var line = new LineSegmentModel { Start = _pendingLineStart.Clone(), End = model.Clone() };
                    Execute(new AddLineAction(_block, line));
                    _pendingLineStart = null;
                    NotifyChanged("Line added");
                }
            }
            Render();
            return;
        }

        var hit = HitEndpoint(screen);
        if (hit.line is not null && (_tool == EditorTool.Vertex || _tool == EditorTool.Select))
        {
            _selectedLine = hit.line;
            _selectedEndpoint = hit.endpoint;
            _draggingEndpoint = true;
            _dragStartModelPoint = (hit.endpoint == 0 ? hit.line.Start : hit.line.End).Clone();
            Surface.CaptureMouse();
            Render();
            return;
        }

        _selectedLine = HitLine(screen);
        _selectedEndpoint = -1;
        StatusChanged?.Invoke(this, _selectedLine is null ? $"Position: {Format(model)}" : "Line selected");
        Render();
    }

    private void Surface_OnMouseMove(object sender, MouseEventArgs e)
    {
        if (_block is null)
            return;

        var screen = e.GetPosition(Surface);
        var model = ToModel(screen, snap: _snapEnabled);
        StatusChanged?.Invoke(this, $"X {model.X:0.###}\"   Y {model.Y:0.###}\"");

        if (!_draggingEndpoint || _selectedLine is null || _selectedEndpoint < 0 || e.LeftButton != MouseButtonState.Pressed)
            return;

        if (_selectedEndpoint == 0)
            _selectedLine.Start = model;
        else
            _selectedLine.End = model;

        Render();
    }

    private void Surface_OnMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        if (!_draggingEndpoint || _selectedLine is null || _dragStartModelPoint is null || _selectedEndpoint < 0)
            return;

        var current = (_selectedEndpoint == 0 ? _selectedLine.Start : _selectedLine.End).Clone();
        Surface.ReleaseMouseCapture();
        _draggingEndpoint = false;

        if (DistanceModel(_dragStartModelPoint, current) > 0.0001)
        {
            // The drag already changed the model. Record an action that knows the before/after state.
            var action = new MoveEndpointAction(_selectedLine, _selectedEndpoint, _dragStartModelPoint.Clone(), current.Clone());
            _undo.Push(action);
            _redo.Clear();
            NotifyChanged("Vertex moved");
        }

        _dragStartModelPoint = null;
        Render();
    }

    private void Surface_OnMouseRightButtonDown(object sender, MouseButtonEventArgs e)
    {
        _pendingLineStart = null;
        Render();
        StatusChanged?.Invoke(this, "Current line cancelled");
    }

    private void BlockEditorControl_OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Delete)
        {
            DeleteSelection();
            e.Handled = true;
        }
        else if (e.Key == Key.Z && Keyboard.Modifiers.HasFlag(ModifierKeys.Control))
        {
            Undo();
            e.Handled = true;
        }
        else if (e.Key == Key.Y && Keyboard.Modifiers.HasFlag(ModifierKeys.Control))
        {
            Redo();
            e.Handled = true;
        }
        else if (e.Key == Key.Escape)
        {
            _pendingLineStart = null;
            _draggingEndpoint = false;
            Surface.ReleaseMouseCapture();
            Render();
        }
    }

    private void Scroller_OnPreviewMouseWheel(object sender, MouseWheelEventArgs e)
    {
        if (!Keyboard.Modifiers.HasFlag(ModifierKeys.Control))
            return;
        Zoom *= e.Delta > 0 ? 1.1 : 0.9;
        e.Handled = true;
        StatusChanged?.Invoke(this, $"Zoom: {Zoom:P0}");
    }

    private void Execute(IEditorAction action)
    {
        action.Redo();
        _undo.Push(action);
        _redo.Clear();
        Render();
    }

    private void NotifyChanged(string status)
    {
        ModelChanged?.Invoke(this, EventArgs.Empty);
        StatusChanged?.Invoke(this, status);
    }

    private Point ToScreen(Point2D p) => new(p.X * Ppi, p.Y * Ppi);

    private Point2D ToModel(Point p, bool snap)
    {
        if (_block is null)
            return new Point2D();

        var x = Math.Clamp(p.X / Ppi, 0, _block.WidthInches);
        var y = Math.Clamp(p.Y / Ppi, 0, _block.HeightInches);
        if (snap)
        {
            var step = Math.Max(0.0625, _block.GridSizeInches);
            x = Math.Round(x / step) * step;
            y = Math.Round(y / step) * step;
        }
        return new Point2D(x, y);
    }

    private (LineSegmentModel? line, int endpoint) HitEndpoint(Point screen)
    {
        if (_block is null)
            return (null, -1);

        foreach (var line in _block.Lines.AsEnumerable().Reverse())
        {
            if ((ToScreen(line.Start) - screen).Length <= HitRadiusPixels)
                return (line, 0);
            if ((ToScreen(line.End) - screen).Length <= HitRadiusPixels)
                return (line, 1);
        }
        return (null, -1);
    }

    private LineSegmentModel? HitLine(Point screen)
    {
        if (_block is null)
            return null;

        return _block.Lines.AsEnumerable().Reverse()
            .FirstOrDefault(line => DistanceToSegment(screen, ToScreen(line.Start), ToScreen(line.End)) <= HitRadiusPixels);
    }

    private static double DistanceToSegment(Point p, Point a, Point b)
    {
        var ab = b - a;
        var ap = p - a;
        var denom = ab.X * ab.X + ab.Y * ab.Y;
        if (denom <= double.Epsilon)
            return ap.Length;
        var t = Math.Clamp((ap.X * ab.X + ap.Y * ab.Y) / denom, 0, 1);
        var nearest = a + ab * t;
        return (p - nearest).Length;
    }

    private static double DistanceModel(Point2D a, Point2D b)
    {
        var dx = a.X - b.X;
        var dy = a.Y - b.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    private static string Format(Point2D p) => $"{p.X:0.###}\", {p.Y:0.###}\"";

    private interface IEditorAction
    {
        void Undo();
        void Redo();
    }

    private sealed class AddLineAction(BlockDefinition block, LineSegmentModel line) : IEditorAction
    {
        public void Undo() => block.Lines.Remove(line);
        public void Redo()
        {
            if (!block.Lines.Contains(line)) block.Lines.Add(line);
        }
    }

    private sealed class DeleteLineAction(BlockDefinition block, LineSegmentModel line, int index) : IEditorAction
    {
        public void Undo()
        {
            var safeIndex = Math.Clamp(index, 0, block.Lines.Count);
            block.Lines.Insert(safeIndex, line);
        }
        public void Redo() => block.Lines.Remove(line);
    }

    private sealed class MoveEndpointAction(LineSegmentModel line, int endpoint, Point2D before, Point2D after) : IEditorAction
    {
        public void Undo() => Set(before);
        public void Redo() => Set(after);
        private void Set(Point2D p)
        {
            if (endpoint == 0) line.Start = p.Clone();
            else line.End = p.Clone();
        }
    }
}
