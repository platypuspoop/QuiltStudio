using System.Text.Json;
using QuiltStudio.Core.Models;

namespace QuiltStudio.Core.Services;

public static class ProjectSerializer
{
    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    public static void Save(string path, QuiltProject project)
    {
        var json = JsonSerializer.Serialize(project, Options);
        File.WriteAllText(path, json);
    }

    public static QuiltProject Load(string path)
    {
        var json = File.ReadAllText(path);
        var project = JsonSerializer.Deserialize<QuiltProject>(json, Options)
            ?? throw new InvalidDataException("The project file is empty or invalid.");

        if (project.SchemaVersion > 1)
            throw new InvalidDataException($"This project uses schema version {project.SchemaVersion}, which this build does not support.");

        project.Blocks ??= [];
        if (project.Blocks.Count == 0)
            project.Blocks.Add(new BlockDefinition());
        project.Layout ??= new QuiltLayout();
        project.Layout.Instances ??= [];
        return project;
    }
}
