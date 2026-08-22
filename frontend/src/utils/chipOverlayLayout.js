/**
 * Compute per-column cell widths for Excel-style single-column expansion.
 * Pure function — no Vue / DOM dependencies.
 *
 * Each cell keeps a fixed minimum width (baseCellWidth); when a single
 * column's pointer chips are wider than that, only that column grows —
 * neighbouring columns stay at their own width.
 */

/**
 * Rough monospace-ish width estimate for a chip label at `fontSize`.
 * No DOM measurement is available here; ~0.62em per char is a stable
 * approximation that keeps the layout deterministic and testable.
 */
function estimatedChipWidth(name, fontSize) {
  const text = name == null ? '' : String(name)
  return text.length * fontSize * 0.62
}

function maxIndex(map) {
  let m = -1
  for (const k of map.keys()) if (k > m) m = k
  return m
}

/**
 * @param {{
 *   chipsByCell: Map<number, Array<{name:string}>>,
 *   length?: number,          // number of array cells (grid columns)
 *   baseCellWidth?: number,   // fixed minimum column width
 *   baseFontSize?: number,
 *   chipPadX?: number,        // horizontal padding around the widest chip
 * }} opts
 * @returns {{
 *   chipFontSize: number,
 *   cellWidths: Array<number>,
 *   gridTemplate: string,
 * }}
 */
export function computeChipLayout({
  chipsByCell,
  length = 0,
  baseCellWidth = 48,
  baseFontSize = 11,
  chipPadX = 14,
} = {}) {
  const map = chipsByCell instanceof Map ? chipsByCell : new Map()
  const n = Math.max(0, length, maxIndex(map) + 1)
  const cellWidths = []
  for (let i = 0; i < n; i++) {
    const chips = map.get(i) || []
    let widest = baseCellWidth
    for (const chip of chips) {
      const w = estimatedChipWidth(chip.name, baseFontSize) + chipPadX
      if (w > widest) widest = w
    }
    cellWidths.push(Math.ceil(widest))
  }
  return {
    chipFontSize: baseFontSize,
    cellWidths,
    gridTemplate: cellWidths.map((w) => `${w}px`).join(' '),
  }
}
