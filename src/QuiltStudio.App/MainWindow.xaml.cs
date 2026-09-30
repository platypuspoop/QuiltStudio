using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Win32;
using QuiltStudio.App.Controls;
using QuiltStudio.App.Services;
using QuiltStudio.Core.Models;
using QuiltStudio.Core.Services;

namespace QuiltStudio.App;

public partial class MainWindow : Window
{
    private QuiltProject _project = NewProjectModel();
    private string? _currentPath;
    private bool _dirty;
    private bool _loadingUi;

    public MainWindow()
    {
        // XAML controls can raise ValueChanged/SelectionChanged while InitializeComponent
        // is still constructing later named controls. Suppress model/UI handlers until
        // the full visual tree exists.
        _loadingUi = true;
        InitializeComponent();
        _loadingUi = false;
        BlockEditor.ModelChanged += (_, _) => MarkDirty();
        BlockEditor.StatusChanged += (_, message) => SetStatus(message);
        BlockEditor.ColorSampled += color => ApplySampledColor(color);
        QuiltComposer.ModelChanged += (_, _) => MarkDirty();
        QuiltComposer.StatusChanged += (_, message) => SetStatus(message);
        QuiltSizeCombo.ItemsSource = QuiltSizeReference.Defaults;
        FabricBrandCombo.ItemsSource = FabricCatalog.Brands;
        FabricBrandCombo.SelectedIndex = 0;
        Loaded += (_, _) => LoadProjectIntoUi();
        PreviewKeyDown += MainWindow_PreviewKeyDown;
        Closing += MainWindow_Closing;
    }

    private static QuiltProject NewProjectModel() => new()
    {
        Name = "Untitled Quilt",
        Blocks = [new BlockDefinition { Name = "Block 1" }],
        Layout = new QuiltLayout { WidthInches = 90, HeightInches = 108 }
    };

    private BlockDefinition CurrentBlock => BlocksList?.SelectedItem as BlockDefinition ?? _project.Blocks[0];

    private void LoadProjectIntoUi()
    {
        _loadingUi = true;
        BlocksList.ItemsSource = _project.Blocks;
        ComposerBlockCombo.ItemsSource = _project.Blocks;
        BlocksList.SelectedIndex = 0;
        ComposerBlockCombo.SelectedIndex = 0;
        QuiltWidthBox.Text = _project.Layout.WidthInches.ToString("0.###");
        QuiltHeightBox.Text = _project.Layout.HeightInches.ToString("0.###");
        QuiltComposer.Project = _project;
        QuiltComposer.RefreshView();
        _loadingUi = false;
        UpdateBlockPropertyUi();
        UpdateTitle();
    }

    private void UpdateBlockPropertyUi()
    {
        if (_project.Blocks.Count == 0) return;
        var block = CurrentBlock;
        BlockNameBox.Text = block.Name;
        BlockWidthBox.Text = block.WidthInches.ToString("0.###");
        BlockHeightBox.Text = block.HeightInches.ToString("0.###");
        ImageNameText.Text = block.SourceImageFileName ?? "No image loaded";
        ImageOpacitySlider.Value = block.SourceImageOpacity * 100;
        BlockEditor.Block = block;
    }

    private void MarkDirty()
    {
        if (_loadingUi) return;
        _dirty = true;
        DirtyText.Text = "Modified";
        QuiltComposer.RefreshView();
        UpdateTitle();
    }

    private void ClearDirty()
    {
        _dirty = false;
        DirtyText.Text = string.Empty;
        UpdateTitle();
    }

    private void UpdateTitle()
    {
        var name = _currentPath is null ? _project.Name : Path.GetFileNameWithoutExtension(_currentPath);
        Title = $"QuiltStudio - {name}{(_dirty ? " *" : string.Empty)}";
    }

    private void SetStatus(string message) => StatusText.Text = message;

    private bool ConfirmDiscardChanges()
    {
        if (!_dirty) return true;
        var result = MessageBox.Show("Save changes to the current project?", "QuiltStudio", MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
        if (result == MessageBoxResult.Cancel) return false;
        if (result == MessageBoxResult.Yes) return SaveProject();
        return true;
    }

    private void NewProject_Click(object sender, RoutedEventArgs e)
    {
        if (!ConfirmDiscardChanges()) return;
        _project = NewProjectModel();
        _currentPath = null;
        ClearDirty();
        LoadProjectIntoUi();
        SetStatus("New project created");
    }

    private void OpenProject_Click(object sender, RoutedEventArgs e)
    {
        if (!ConfirmDiscardChanges()) return;
        var dialog = new OpenFileDialog { Filter = "QuiltStudio Project (*.quiltstudio)|*.quiltstudio|JSON (*.json)|*.json|All files (*.*)|*.*" };
        if (dialog.ShowDialog() != true) return;
        try
        {
            _project = ProjectSerializer.Load(dialog.FileName);
            _currentPath = dialog.FileName;
            ClearDirty();
            LoadProjectIntoUi();
            SetStatus($"Opened {Path.GetFileName(dialog.FileName)}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Could not open project", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void SaveProject_Click(object sender, RoutedEventArgs e) => SaveProject();

    private void SaveProjectAs_Click(object sender, RoutedEventArgs e) => SaveProjectAs();

    private bool SaveProject()
    {
        CommitAllTextFields();
        if (_currentPath is null) return SaveProjectAs();
        try
        {
            ProjectSerializer.Save(_currentPath, _project);
            ClearDirty();
            SetStatus($"Saved {Path.GetFileName(_currentPath)}");
            return true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Could not save project", MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
    }

    private bool SaveProjectAs()
    {
        CommitAllTextFields();
        var dialog = new SaveFileDialog
        {
            Filter = "QuiltStudio Project (*.quiltstudio)|*.quiltstudio",
            DefaultExt = ".quiltstudio",
            FileName = string.IsNullOrWhiteSpace(_project.Name) ? "Untitled Quilt" : _project.Name
        };
        if (dialog.ShowDialog() != true) return false;
        _currentPath = dialog.FileName;
        return SaveProject();
    }

    private void Exit_Click(object sender, RoutedEventArgs e) => Close();

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (!ConfirmDiscardChanges()) e.Cancel = true;
    }

    private void Tool_Checked(object sender, RoutedEventArgs e)
    {
        if (BlockEditor is null || sender is not RadioButton button || button.Tag is not string tag) return;
        BlockEditor.Tool = tag switch
        {
            "Select" => EditorTool.Select,
            "Vertex" => EditorTool.Vertex,
            "ColorPicker" => EditorTool.ColorPicker,
            _ => EditorTool.Line
        };
    }

    private void SnapCheck_Changed(object sender, RoutedEventArgs e)
    {
        if (BlockEditor is not null) BlockEditor.SnapEnabled = SnapCheck.IsChecked == true;
    }

    private void ZoomSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
    {
        if (BlockEditor is null || ZoomLabel is null) return;
        BlockEditor.Zoom = e.NewValue / 100.0;
        ZoomLabel.Text = $"{e.NewValue:0}%";
    }

    private void Undo_Click(object sender, RoutedEventArgs e)
    {
        if (MainTabs.SelectedIndex == 0) BlockEditor.Undo();
    }

    private void Redo_Click(object sender, RoutedEventArgs e)
    {
        if (MainTabs.SelectedIndex == 0) BlockEditor.Redo();
    }

    private void Delete_Click(object sender, RoutedEventArgs e)
    {
        if (MainTabs.SelectedIndex == 0) BlockEditor.DeleteSelection();
        else QuiltComposer.DeleteSelected();
    }

    private void BlocksList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_loadingUi || BlocksList.SelectedItem is not BlockDefinition block) return;
        BlockEditor.Block = block;
        UpdateBlockPropertyUi();
    }

    private void BlockProperties_LostFocus(object sender, RoutedEventArgs e)
    {
        if (_loadingUi || _project.Blocks.Count == 0) return;
        var block = CurrentBlock;
        var changed = false;
        if (!string.IsNullOrWhiteSpace(BlockNameBox.Text) && BlockNameBox.Text != block.Name)
        {
            block.Name = BlockNameBox.Text.Trim(); changed = true;
        }
        if (double.TryParse(BlockWidthBox.Text, out var width) && width > 0 && Math.Abs(width - block.WidthInches) > 0.0001)
        {
            block.WidthInches = width; changed = true;
        }
        if (double.TryParse(BlockHeightBox.Text, out var height) && height > 0 && Math.Abs(height - block.HeightInches) > 0.0001)
        {
            block.HeightInches = height; changed = true;
        }
        if (changed)
        {
            BlocksList.Items.Refresh();
            ComposerBlockCombo.Items.Refresh();
            BlockEditor.Block = block;
            MarkDirty();
        }
    }

    private void GridSizeCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_loadingUi || BlockEditor is null || GridSizeCombo.SelectedItem is not ComboBoxItem item || item.Tag is not string raw || !double.TryParse(raw, out var size)) return;
        CurrentBlock.GridSizeInches = size;
        BlockEditor.Block = CurrentBlock;
        MarkDirty();
    }

    private void ImportImage_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog { Filter = "Images|*.png;*.jpg;*.jpeg;*.bmp;*.tif;*.tiff|All files (*.*)|*.*" };
        if (dialog.ShowDialog() != true) return;
        try
        {
            var info = new FileInfo(dialog.FileName);
            if (info.Length > 50 * 1024 * 1024)
            {
                MessageBox.Show("For this prototype, source images are limited to 50 MB.", "Image too large", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            var bytes = File.ReadAllBytes(dialog.FileName);
            var block = CurrentBlock;
            block.SourceImageBase64 = Convert.ToBase64String(bytes);
            block.SourceImageFileName = Path.GetFileName(dialog.FileName);
            ImageNameText.Text = block.SourceImageFileName;
            BlockEditor.RefreshImage();
            MarkDirty();
            SetStatus("Image embedded in project. Use the Line tool to trace over it.");
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Could not import image", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void RemoveImage_Click(object sender, RoutedEventArgs e)
    {
        var block = CurrentBlock;
        block.SourceImageBase64 = null;
        block.SourceImageFileName = null;
        ImageNameText.Text = "No image loaded";
        BlockEditor.RefreshImage();
        MarkDirty();
    }

    private void ImageOpacitySlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
    {
        if (_loadingUi || BlockEditor is null || _project.Blocks.Count == 0) return;
        CurrentBlock.SourceImageOpacity = e.NewValue / 100.0;
        BlockEditor.RefreshImage();
    }

    private void ApplySampledColor(Color color)
    {
        var hex = $"#{color.R:X2}{color.G:X2}{color.B:X2}";
        TargetHexBox.Text = hex;
        TargetColorSwatch.Background = new SolidColorBrush(color);
        RunFabricMatch();
    }

    private void TargetHexBox_LostFocus(object sender, RoutedEventArgs e)
    {
        if (FabricMatcher.TryNormalizeHex(TargetHexBox.Text, out var hex))
        {
            TargetHexBox.Text = hex;
            TargetColorSwatch.Background = (Brush)new BrushConverter().ConvertFromString(hex)!;
        }
    }

    private void MatchFabric_Click(object sender, RoutedEventArgs e) => RunFabricMatch();

    private void FabricBrandCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_loadingUi || FabricBrandCombo?.SelectedItem is null) return;
        RunFabricMatch();
    }

    private void RunFabricMatch()
    {
        if (!FabricMatcher.TryNormalizeHex(TargetHexBox.Text, out var hex))
        {
            MessageBox.Show("Enter a six-digit color such as #4A78B2, or use the Fabric color eyedropper on an imported image.", "Invalid color", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        TargetHexBox.Text = hex;
        TargetColorSwatch.Background = (Brush)new BrushConverter().ConvertFromString(hex)!;
        var brand = FabricBrandCombo.SelectedItem as string ?? "All brands";
        FabricMatchList.ItemsSource = FabricMatcher.FindClosest(hex, brand, 8);
        SetStatus($"Fabric matches calculated for {hex}. Verify physical swatches before purchase.");
    }

    private void PrintFpp_Click(object sender, RoutedEventArgs e)
    {
        CommitAllTextFields();
        var block = CurrentBlock;
        if (block.Lines.Count == 0)
        {
            var choice = MessageBox.Show(
                "This block does not contain any seam lines yet. Print the blank FPP block template anyway?",
                "No pattern lines", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (choice != MessageBoxResult.Yes) return;
        }

        if (FppPrintService.Print(block, this))
            SetStatus("FPP pattern sent to the selected printer. Check the 1-inch calibration square before sewing.");
    }

    private void AddBlock_Click(object sender, RoutedEventArgs e)
    {
        var block = new BlockDefinition { Name = $"Block {_project.Blocks.Count + 1}" };
        _project.Blocks.Add(block);
        BlocksList.Items.Refresh();
        ComposerBlockCombo.Items.Refresh();
        BlocksList.SelectedItem = block;
        ComposerBlockCombo.SelectedItem = block;
        MarkDirty();
    }

    private void DuplicateBlock_Click(object sender, RoutedEventArgs e)
    {
        var source = CurrentBlock;
        var copy = new BlockDefinition
        {
            Name = source.Name + " Copy",
            WidthInches = source.WidthInches,
            HeightInches = source.HeightInches,
            GridSizeInches = source.GridSizeInches,
            SourceImageFileName = source.SourceImageFileName,
            SourceImageBase64 = source.SourceImageBase64,
            SourceImageOpacity = source.SourceImageOpacity,
            Lines = source.Lines.Select(l => new LineSegmentModel { Start = l.Start.Clone(), End = l.End.Clone() }).ToList()
        };
        _project.Blocks.Add(copy);
        BlocksList.Items.Refresh();
        ComposerBlockCombo.Items.Refresh();
        BlocksList.SelectedItem = copy;
        ComposerBlockCombo.SelectedItem = copy;
        MarkDirty();
    }

    private void QuiltSizeCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_loadingUi || QuiltSizeCombo.SelectedItem is not QuiltSizeReference size) return;
        _project.Layout.WidthInches = size.WidthInches;
        _project.Layout.HeightInches = size.HeightInches;
        QuiltWidthBox.Text = size.WidthInches.ToString("0.###");
        QuiltHeightBox.Text = size.HeightInches.ToString("0.###");
        QuiltComposer.RefreshView();
        MarkDirty();
    }

    private void QuiltDimensions_LostFocus(object sender, RoutedEventArgs e)
    {
        if (_loadingUi) return;
        var changed = false;
        if (double.TryParse(QuiltWidthBox.Text, out var width) && width > 0 && Math.Abs(width - _project.Layout.WidthInches) > 0.0001)
        {
            _project.Layout.WidthInches = width; changed = true;
        }
        if (double.TryParse(QuiltHeightBox.Text, out var height) && height > 0 && Math.Abs(height - _project.Layout.HeightInches) > 0.0001)
        {
            _project.Layout.HeightInches = height; changed = true;
        }
        if (changed) { QuiltComposer.RefreshView(); MarkDirty(); }
    }

    private BlockDefinition? ComposerBlock => ComposerBlockCombo.SelectedItem as BlockDefinition;

    private void AddInstance_Click(object sender, RoutedEventArgs e)
    {
        if (ComposerBlock is not null) QuiltComposer.AddInstance(ComposerBlock);
    }

    private void BuildGrid_Click(object sender, RoutedEventArgs e)
    {
        if (ComposerBlock is null) return;
        if (!int.TryParse(RowsBox.Text, out var rows) || !int.TryParse(ColumnsBox.Text, out var columns))
        {
            MessageBox.Show("Rows and columns must be whole numbers.", "Invalid layout", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        QuiltComposer.BuildGrid(ComposerBlock, rows, columns);
    }

    private void CopyInstance_Click(object sender, RoutedEventArgs e) => QuiltComposer.CopySelected();
    private void PasteInstance_Click(object sender, RoutedEventArgs e) => QuiltComposer.Paste();
    private void DuplicateInstance_Click(object sender, RoutedEventArgs e) => QuiltComposer.DuplicateSelected();
    private void RotateInstance_Click(object sender, RoutedEventArgs e) => QuiltComposer.RotateSelected();
    private void MirrorH_Click(object sender, RoutedEventArgs e) => QuiltComposer.MirrorHorizontal();
    private void MirrorV_Click(object sender, RoutedEventArgs e) => QuiltComposer.MirrorVertical();
    private void DeleteInstance_Click(object sender, RoutedEventArgs e) => QuiltComposer.DeleteSelected();

    private void CommitAllTextFields()
    {
        BlockProperties_LostFocus(this, new RoutedEventArgs());
        QuiltDimensions_LostFocus(this, new RoutedEventArgs());
    }

    private void MainWindow_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control) && e.Key == Key.S)
        {
            SaveProject(); e.Handled = true;
        }
        else if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control) && e.Key == Key.O)
        {
            OpenProject_Click(this, new RoutedEventArgs()); e.Handled = true;
        }
        else if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control) && e.Key == Key.N)
        {
            NewProject_Click(this, new RoutedEventArgs()); e.Handled = true;
        }
    }

    private void About_Click(object sender, RoutedEventArgs e)
    {
        MessageBox.Show("QuiltStudio Prototype 0.02\n\nFoundation paper piecing designer with fabric color matching and true-scale FPP printing.", "About QuiltStudio", MessageBoxButton.OK, MessageBoxImage.Information);
    }
}
