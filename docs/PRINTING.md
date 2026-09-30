# Verify an actual-size FPP print

The PDF exporter uses vector lines, with 72 PDF points per inch. It does not use screenshots or rely on browser page-print scaling.

## First physical check

1. Download `examples/print-scale-check-letter.pdf`, or open a 4 × 4 inch block in the app and download its pattern using US Letter paper.
2. Open the PDF in a reader such as Adobe Acrobat Reader or your browser's PDF viewer.
3. Choose the matching paper size. Select **Actual size** or **100%**. Turn off **Fit**, **Shrink oversized pages**, **Scale to fit**, and equivalent printer-driver options. Print one PDF page per sheet, without booklet or multiple-page layouts.
4. Measure the test square horizontally and vertically. Each side is 1 inch / 25.4 mm. The check PDF's horizontal seam is 2 inches long. The finished block is 4 × 4 inches, with a 4½ × 4½ inch outside cutting outline.
5. If either dimension is wrong, correct the print settings and reprint. Do not compensate by changing block dimensions in the editor.

**A physical printer test has not been performed in the cloud environment.** Automated checks inspect PDF coordinates and physical page size; they cannot inspect your printer's output.

## Assemble tiled patterns

Blocks larger than the pattern area use multiple pages. Each page has a row and column number, a calibration square, and **¼ inch of repeated geometry** at joins.

1. Check the calibration square on every sheet.
2. Lay the sheets out by row and column number.
3. On a page to the right, trim the blank left margin to the pattern area's left corner marks. Place that edge onto the previous page's vertical dotted overlap guide. The previous page extends another ¼ inch beyond that guide; repeated seam lines must coincide.
4. For a page below, trim the blank top margin to its top pattern-area corner marks. Place that edge onto the previous row's horizontal dotted overlap guide.
5. Tape the sheets together and verify repeated seam lines align. Avoid stretching the paper.
6. Measure the finished outline. For the 12-inch sample it must be 12 × 12 inches; the cutting outline is 12½ × 12½ inches.

Corner marks identify page boundaries. **Do not simply butt corner marks together:** that retains the overlap twice and enlarges the pattern. Dotted overlap guides show the next page's origin.

## What the lines mean

- Solid outside rectangle: finished block boundary.
- Solid interior lines: the seams you drew, mirrored horizontally for foundation printing.
- Dashed outside rectangle: cutting outline, ¼ inch beyond the finished boundary.
- Fine dotted lines near joins: page overlap guides, not sewing lines.
- Reference images and editor grids are excluded from printing.

This version does not generate piece labels or validate sewing order. The outer allowance is around the block, not a separate offset around each interior piece.
