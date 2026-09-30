# Fabric matching design note

QuiltStudio 0.02 ships with a starter catalog rather than attempting to scrape retailer inventory at runtime.

## Matching method

1. Sample RGB from the imported source image or accept a typed hex value.
2. Convert sRGB to CIE XYZ (D65).
3. Convert XYZ to CIE Lab.
4. Compare to starter-catalog swatches using Delta E 1976.
5. Rank the lowest Delta E values as closest perceptual screen matches.

## Catalog identity sources

The starter catalog uses product names and SKU identifiers from the manufacturers' published catalogs/product pages:

- Robert Kaufman, Kona Cotton: https://www.robertkaufman.com/fabrics/kona_cotton/
- Moda Fabrics, Bella Solids: https://shop.modafabrics.com/category/bella-solids-102401
- Riley Blake Designs, Confetti Cotton Solids: https://www.rileyblakedesigns.com/Fabric/Basics/Confetti-Cottons

## Important limitation

Hex values in the starter catalog are approximate screen representations. They are not manufacturer-certified Lab/RGB measurements. Lighting, photography, displays, printer profiles, and fabric dye lots can all change apparent color. Use QuiltStudio to narrow the search, then verify with a current physical manufacturer color card or physical fabric sample.

## Next catalog milestone

- Import/export catalog CSV.
- Allow users to photograph and calibrate their own physical color cards.
- Add personal stash fabrics.
- Store manufacturer URLs and catalog revision dates.
- Support larger official catalogs when reliable colorimetric values are available.
