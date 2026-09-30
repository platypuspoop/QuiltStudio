using QuiltStudio.Core.Models;

namespace QuiltStudio.Core.Services;

public static class FabricCatalog
{
    // Starter catalog. Product names/SKUs are real manufacturer catalog identifiers.
    // Hex values are screen approximations only; physical swatches and dye lots vary.
    public static IReadOnlyList<FabricSwatch> Starter { get; } = new List<FabricSwatch>
    {
        // Robert Kaufman - Kona Cotton
        new("Robert Kaufman", "Kona Cotton", "Black", "K001-1019", "#171717"),
        new("Robert Kaufman", "Kona Cotton", "White", "K001-1387", "#F7F5EF"),
        new("Robert Kaufman", "Kona Cotton", "Snow", "K001-1339", "#F0EEE4"),
        new("Robert Kaufman", "Kona Cotton", "Red", "K001-1308", "#B5212D"),
        new("Robert Kaufman", "Kona Cotton", "Navy", "K001-1243", "#24324B"),
        new("Robert Kaufman", "Kona Cotton", "Aqua", "K001-1005", "#62B8B5"),
        new("Robert Kaufman", "Kona Cotton", "Azure", "K001-1009", "#468CBF"),
        new("Robert Kaufman", "Kona Cotton", "Blue", "K001-1028", "#315A9B"),
        new("Robert Kaufman", "Kona Cotton", "Peacock", "K001-1282", "#006E72"),
        new("Robert Kaufman", "Kona Cotton", "Poppy", "K001-1296", "#E84A3C"),
        new("Robert Kaufman", "Kona Cotton", "Wisteria", "K001-1392", "#8B77A6"),
        new("Robert Kaufman", "Kona Cotton", "Cheddar", "K001-350", "#E88A22"),

        // Moda - Bella Solids
        new("Moda Fabrics", "Bella Solids", "Snow", "9900 11", "#F3F0E6"),
        new("Moda Fabrics", "Bella Solids", "Natural", "9900 12", "#E9E1D0"),
        new("Moda Fabrics", "Bella Solids", "Christmas Red", "9900 16", "#B4202A"),
        new("Moda Fabrics", "Bella Solids", "Country Red", "9900 17", "#9E2A2F"),
        new("Moda Fabrics", "Bella Solids", "Navy", "9900 20", "#263349"),
        new("Moda Fabrics", "Bella Solids", "Purple", "9900 21", "#6C4A85"),
        new("Moda Fabrics", "Bella Solids", "Aqua", "9900 34", "#62B8B0"),
        new("Moda Fabrics", "Bella Solids", "Kelly", "9900 76", "#3A8A50"),
        new("Moda Fabrics", "Bella Solids", "Gray", "9900 83", "#8C8C88"),
        new("Moda Fabrics", "Bella Solids", "White Bleached", "9900 98", "#FBFBF7"),
        new("Moda Fabrics", "Bella Solids", "Black", "9900 99", "#191919"),
        new("Moda Fabrics", "Bella Solids", "Turquoise", "9900 107", "#2B9EA4"),
        new("Moda Fabrics", "Bella Solids", "Jade", "9900 108", "#3C8E78"),
        new("Moda Fabrics", "Bella Solids", "Kansas Red", "9900 150", "#A82D34"),

        // Riley Blake Designs - Confetti Cotton
        new("Riley Blake Designs", "Confetti Cotton", "Ballerina", "C120-BALLERINA", "#F4CDD0"),
        new("Riley Blake Designs", "Confetti Cotton", "Frosting", "C120-FROSTING", "#F7E5E4"),
        new("Riley Blake Designs", "Confetti Cotton", "Riley Baby Pink", "C120-RILEYBABYPINK", "#F3BFC5"),
        new("Riley Blake Designs", "Confetti Cotton", "Rouge", "C120-ROUGE", "#C94C61"),
        new("Riley Blake Designs", "Confetti Cotton", "Cayenne", "C120-CAYENNE", "#B94437"),
        new("Riley Blake Designs", "Confetti Cotton", "Riley Red", "C120-RILEYRED", "#C52D34"),
        new("Riley Blake Designs", "Confetti Cotton", "Barn Red", "C120-BARNRED", "#8D3032"),
        new("Riley Blake Designs", "Confetti Cotton", "Golden", "C120-GOLDEN", "#DAA62A"),
        new("Riley Blake Designs", "Confetti Cotton", "Daffodil", "C120-DAFFODIL", "#E5C83A"),
        new("Riley Blake Designs", "Confetti Cotton", "Riley Yellow", "C120-RILEYYELLOW", "#F1D34A")
    };

    public static IReadOnlyList<string> Brands { get; } =
        new[] { "All brands" }.Concat(Starter.Select(s => s.Brand).Distinct().OrderBy(s => s)).ToList();
}
