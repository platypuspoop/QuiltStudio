using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;
using QuiltStudio.Core.Models;

namespace QuiltStudio.App.Controls;

public partial class QuiltComposerControl : UserControl
{
    private QuiltProject? _project;
    private BlockInstance? _selected;
    private BlockInstance? _clipboard;
    private const double Ppi = 6.0;

    public event EventHandler? ModelChanged;
    public event EventHandler<string>? StatusChanged;

    public QuiltComposerControl()
    {
        InitializeComponent();
        KeyDown += QuiltComposerControl_OnKeyDown;
    }

    public QuiltProject? Project
    {
        get => _project;
        set { _project = value; _selected = null; Render(); }
    }

    public BlockInstance? SelectedInstance => _selected;

    public void AddInstance(BlockDefinition block)
    {
        if (_project is null) return;
        var instance = new BlockInstance
        {
            BlockDefinitionId = block.Id,
            XInches = 0,
            YInches = 0
        };
        _project.Layout.Instances.Add(instance);
        _selected = instance;
        Changed("Block added to quilt");
    }

    public void BuildGrid(BlockDefinition block, int rows, int columns, double gapInches = 0)
    {
        if (_project is null) return;
        rows = Math.Clamp(rows, 1, 100);
        columns = Math.Clamp(columns, 1, 100);
        _project.Layout.Instances.Clear();
        for (var r = 0; r < rows; r++)
        for (var c = 0; c < columns; c++)
        {
            _project.Layout.Instances.Add(new BlockInstance
            {
                BlockDefinitionId = block.Id,
                XInches = c * (block.WidthInches + gapInches),
                YInches = r * (block.HeightInches + gapInches)
            });
        }
        _selected = _project.Layout.Instances.LastOrDefault();
        Changed($"Created {rows} x {columns} block layout");
    }

    public void CopySelected()
    {
        if (_selected is null) return;
        _clipboard = Clone(_selected);
        StatusChanged?.Invoke(this, "Block instance copied");
    }

    public void Paste()
    {
        if (_project is null || _clipboard is null) return;
        var pasted = Clone(_clipboard);
        pasted.Id = Guid.NewGuid();
        pasted.XInches += 1;
        pasted.YInches += 1;
        _project.Layout.Instances.Add(pasted);
        _selected = pasted;
        Changed("Block instance pasted");
    }

    public void DuplicateSelected()
    {
        CopySelected();
        Paste();
    }

    public void RotateSelected()
    {
        if (_selected is null) return;
        _selected.RotationDegrees = (_selected.RotationDegrees + 90) % 360;
        Changed("Block rotated 90 degrees");
    }

    public void MirrorHorizontal()
    {
        if (_selected is null) return;
        _selected.MirrorHorizontal = !_selected.MirrorHorizontal;
        Changed("Horizontal mirror toggled");
    }

    public void MirrorVertical()
    {
        if (_selected is null) return;
        _selected.MirrorVertical = !_selected.MirrorVertical;
        Changed("Vertical mirror toggled");
    }

    public void DeleteSelected()
    {
        if (_project is null || _selected is null) return;
        _project.Layout.Instances.Remove(_selected);
        _selected = null;
        Changed("Block removed from quilt");
    }

    public void RefreshView() => Render();

    private void Render()
    {
        Surface.Children.Clear();
        if (_project is null) return;

        Surface.Width = Math.Max(300, _project.Layout.WidthInches * Ppi);
        Surface.Height = Math.Max(300, _project.Layout.HeightInches * Ppi);

        foreach (var instance in _project.Layout.Instances)
        {
            var block = _project.Blocks.FirstOrDefault(b => b.Id == instance.BlockDefinitionId);
            if (block is null) continue;
            DrawBlockInstance(instance, block);
        }
    }

    private void DrawBlockInstance(BlockInstance instance, BlockDefinition block)
    {
        var group = new Canvas
        {
            Width = block.WidthInches * Ppi * instance.Scale,
            Height = block.HeightInches * Ppi * instance.Scale,
            Background = ReferenceEquals(instance, _selected) ? Brushes.AliceBlue : Brushes.White,
            Tag = instance
        };

        group.Children.Add(new Rectangle
        {
            Width = group.Width,
            Height = group.Height,
            Stroke = ReferenceEquals(instance, _selected) ? Brushes.DodgerBlue : Brushes.DimGray,
            StrokeThickness = ReferenceEquals(instance, _selected) ? 2.2 : 1.0,
            IsHitTestVisible = false
        });

        foreach (var line in block.Lines)
        {
            group.Children.Add(new Line
            {
                X1 = line.Start.X * Ppi * instance.Scale,
                Y1 = line.Start.Y * Ppi * instance.Scale,
                X2 = line.End.X * Ppi * instance.Scale,
                Y2 = line.End.Y * Ppi * instance.Scale,
                Stroke = Brushes.Black,
                StrokeThickness = 1,
                IsHitTestVisible = false
            });
        }

        var transforms = new TransformGroup();
        transforms.Children.Add(new ScaleTransform(instance.MirrorHorizontal ? -1 : 1, instance.MirrorVertical ? -1 : 1,
            group.Width / 2, group.Height / 2));
        transforms.Children.Add(new RotateTransform(instance.RotationDegrees, group.Width / 2, group.Height / 2));
        group.RenderTransform = transforms;
        group.MouseLeftButtonDown += (_, e) =>
        {
            _selected = instance;
            Focus();
            e.Handled = true;
            Render();
            StatusChanged?.Invoke(this, $"Selected: {block.Name}");
        };

        Canvas.SetLeft(group, instance.XInches * Ppi);
        Canvas.SetTop(group, instance.YInches * Ppi);
        Surface.Children.Add(group);
    }

    private void Surface_OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        _selected = null;
        Focus();
        Render();
    }

    private void QuiltComposerControl_OnKeyDown(object sender, KeyEventArgs e)
    {
        if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control) && e.Key == Key.C)
        {
            CopySelected(); e.Handled = true;
        }
        else if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control) && e.Key == Key.V)
        {
            Paste(); e.Handled = true;
        }
        else if (e.Key == Key.Delete)
        {
            DeleteSelected(); e.Handled = true;
        }
    }

    private void Changed(string status)
    {
        Render();
        ModelChanged?.Invoke(this, EventArgs.Empty);
        StatusChanged?.Invoke(this, status);
    }

    private static BlockInstance Clone(BlockInstance value) => new()
    {
        Id = value.Id,
        BlockDefinitionId = value.BlockDefinitionId,
        XInches = value.XInches,
        YInches = value.YInches,
        Scale = value.Scale,
        RotationDegrees = value.RotationDegrees,
        MirrorHorizontal = value.MirrorHorizontal,
        MirrorVertical = value.MirrorVertical
    };
}
