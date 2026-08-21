/**
 * Compute cell width, chip font size, and per-cell overflow entries.
 * Pure function — no Vue / DOM dependencies.
 */
export function computeChipLayout({
  chipsByCell,
  baseCellWidth = 48,
  baseFontSize = 11,
  minFontSize = 10,
  fontStep = 1,
  showLimit = 2,
} = {}) {
  const map = chipsByCell instanceof Map ? chipsByCell : new Map()
  let maxC = 0
  for (const chips of map.values()) {
    if (chips && chips.length > maxC) maxC = chips.length
  }

  // font: clamp into [minFontSize, baseFontSize]
  let chipFontSize = baseFontSize - Math.max(0, maxC - 1) * fontStep
  if (chipFontSize < minFontSize) chipFontSize = minFontSize

  // cell width: max(48, maxC * (font + 8))
  const cellWidth = Math.max(baseCellWidth, maxC * (chipFontSize + 8))

  const overflowByCell = new Map()
  for (const [index, chips] of map.entries()) {
    if (!chips || chips.length <= showLimit) continue
    overflowByCell.set(index, {
      allChips: chips.slice(),
      visibleChips: chips.slice(0, showLimit),
      hiddenCount: chips.length - showLimit,
    })
  }

  const fits = cellWidth <= baseCellWidth * 3

  return { cellWidth, chipFontSize, overflowByCell, fits }
}
