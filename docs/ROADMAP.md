# QuiltStudio engineering roadmap

## 0.01 - Geometry vertical slice
Status: included in this package.

Block editor, reusable block definitions, tracing underlay, persistence, quilt composer, repeated instances.

## 0.02 - FPP authoring core

- Shared-vertex planar graph instead of independent segment endpoints.
- Detect closed regions/pieces.
- Assign palette/fabric IDs to regions.
- Split/merge regions.
- Section definitions (A, B, C...).
- Piece numbering and explicit sewing order.
- Geometry validation tests.

## 0.03 - Print engine

- 1/4" seam allowance generation.
- Mirrored FPP output.
- 1" calibration square.
- US Letter/A4.
- Tiled output with registration marks.
- PDF export at exact physical scale.

## 0.04 - Image-to-design engine

Pipeline:

1. Crop/rotate/contrast controls.
2. Color quantization in perceptual color space.
3. Region segmentation.
4. Contour extraction.
5. Polygon simplification.
6. Straight-line bias for sewable geometry.
7. Tiny/sliver region detection.
8. Convert results into the same core graph used by the manual editor.
9. Keep original image and generated trace as separate project layers.

## 0.05 - FPP intelligence

- Validate whether a section can be constructed in the selected order.
- Highlight impossible or problematic joins.
- Flag acute angles, tiny pieces, and slivers.
- Suggest candidate merge/split operations.

## 0.06 - Fabric system

- Local fabric/stash catalog in SQLite.
- Manufacturer, collection, SKU, width, quantity, image.
- CIELAB representation and Delta E matching.
- Map design palette to commercial fabrics or only to fabrics in the user's stash.

## Prototype 0.02 completed

- Fabric color eyedropper from imported source images.
- Perceptual Lab/Delta E matching against starter manufacturer solids.
- Robert Kaufman Kona Cotton, Moda Bella Solids, and Riley Blake Confetti Cotton starter entries.
- Clearly labeled Create & Print FPP Pattern action.
- True-size mirrored FPP print rendering.
- 1/4-inch outer seam allowance.
- Automatic page tiling and registration marks.
- 1-inch print calibration square.

## Next FPP-output milestone

- Detect closed regions from block geometry.
- Assign piece labels such as A1, A2, A3.
- Create multiple FPP sections when one foundation cannot be sewn as a single section.
- Validate sewing order.
- Place labels automatically without overlapping seam lines.
