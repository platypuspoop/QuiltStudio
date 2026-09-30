# QuiltStudio Prototype 0.02

QuiltStudio is a Windows-first foundation paper piecing (FPP) design prototype built in C# / WPF on .NET 10.

## New in 0.02

### Fabric color matching

- New **Fabric color eyedropper** tool samples a color directly from an imported source image.
- A color can also be entered manually as a six-digit hex value.
- QuiltStudio converts the target and catalog colors to CIE Lab and ranks candidates by Delta E perceptual distance.
- Starter catalog includes representative solids from:
  - Robert Kaufman **Kona Cotton**
  - Moda **Bella Solids**
  - Riley Blake Designs **Confetti Cotton**
- Brand filtering is available.
- Product names and SKUs use manufacturer catalog identifiers.
- On-screen RGB/hex values are approximations only. Always verify against a current physical manufacturer color card and the actual dye lot before buying fabric.

### Create & Print FPP Pattern

A clearly labeled **CREATE & PRINT FPP PATTERN** button now converts the current block geometry into a printer-ready foundation template.

The print engine:

- Mirrors the block horizontally for foundation paper piecing.
- Prints pattern geometry at 100% / actual size.
- Adds a 1/4-inch seam allowance around the finished block.
- Automatically tiles blocks that are larger than the printable page area.
- Adds registration marks for tiled pages.
- Adds a 1-inch calibration square.
- Adds block name, finished dimensions, page/tile number, and print-scale warnings.
- Uses the standard Windows print dialog. Choose **Microsoft Print to PDF** to create a PDF.

Automatic FPP section/piece numbering and sewing-order validation remain a later milestone. The 0.02 print output is the full-size mirrored foundation template generated from the seam geometry she draws.

## Existing capabilities

- Create reusable FPP block definitions.
- Draw straight pattern lines on an inch-based canvas.
- Grid snapping at 1", 1/2", 1/4", 1/8", or 1/16".
- Select and drag line endpoints/vertices.
- Undo and redo line creation, deletion, and vertex movement.
- Import PNG/JPEG/BMP/TIFF images as embedded tracing underlays.
- Adjust tracing-image opacity.
- Save and reopen `.quiltstudio` projects as readable JSON.
- Duplicate an entire block definition.
- Create quilt layouts from reusable block instances.
- Build repeated row x column layouts.
- Copy/paste, duplicate, rotate, and mirror block instances.
- Pick common quilt dimensions as editable reference sizes.

## Build on Windows

### Requirements

- Windows 10/11 x64.
- .NET 10 SDK with Windows Desktop support, or Visual Studio with **.NET desktop development**.

### PowerShell

From this folder:

```powershell
$env:Path = "C:\Program Files\dotnet;" + $env:Path
Set-ExecutionPolicy -Scope Process Bypass
.\build-windows.ps1
```

The executable will be written to:

`publish\win-x64\QuiltStudio.exe`

## First 0.02 acceptance test

1. Create a 12" x 12" block and import a source image.
2. Select **Fabric color eyedropper** and click a visible fabric/color region.
3. Confirm that the Fabric Color Match list updates and can be filtered by manufacturer.
4. Draw several FPP seam lines over the image.
5. Click **CREATE & PRINT FPP PATTERN**.
6. Select **Microsoft Print to PDF** for a non-destructive test.
7. Open the resulting PDF and verify the 1-inch calibration square with a ruler after printing on paper.
8. Confirm the block is horizontally mirrored relative to the design view.

## Color-data note

Manufacturer names and SKU/color names in the starter catalog were selected from current manufacturer catalogs. The embedded hex values are display approximations intended for ranking likely matches, not digital color standards. Manufacturer sites themselves warn that monitor/printed representations may not match physical fabric exactly.
