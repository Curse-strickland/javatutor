import {
  colorForPointerName,
  colorForRole,
  inferPointerRole,
} from './pointerRoleColors.js'

/**
 * Build a Map<cellIndex, chip[]> for an array entry.
 * Deduplicates: if `indexPointers` already contributed a label (by lowercase name),
 * the same label in `pointerLabels` is skipped for that cell.
 */
export function buildArrayChipsByCell(arr) {
  const map = new Map()
  const len = arr.values?.length || 0
  const pointers = arr.indexPointers || {}
  const seenLowercase = new Map() // cellIndex -> Set<lowercaseName>

  for (const [name, idx] of Object.entries(pointers)) {
    if (idx == null || idx < 0 || idx >= len) continue
    const color = colorForPointerName(name) || colorForRole('mid')
    const role = inferPointerRole(name)
    if (!map.has(idx)) map.set(idx, [])
    map.get(idx).push({ name, color, role })
    if (!seenLowercase.has(idx)) seenLowercase.set(idx, new Set())
    seenLowercase.get(idx).add(name.toLowerCase())
  }

  const rec = arr.pointerLabels || {}
  for (const [idxStr, labels] of Object.entries(rec)) {
    const idx = Number(idxStr)
    if (idx < 0 || idx >= len) continue
    for (const label of labels || []) {
      const lower = label.toLowerCase()
      if (seenLowercase.has(idx) && seenLowercase.get(idx).has(lower)) continue
      if (!map.has(idx)) map.set(idx, [])
      map.get(idx).push({
        name: label,
        color: colorForPointerName(label) || colorForRole('mid'),
        role: inferPointerRole(label),
      })
    }
  }

  return map
}

/**
 * Whether an array entry should be treated as the primary array
 * and therefore filtered out from the general array list.
 */
export function matchesPrimaryArray(arr, primaryId) {
  if (primaryId == null) return false
  const pid = String(primaryId)
  return String(arr.id) === pid || String(arr.sourceVar) === pid
}
