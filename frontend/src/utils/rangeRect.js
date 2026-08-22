/**
 * 计算 range / sorted 高亮框与每列左边缘，考虑 grid gap。
 * `cellWidths` 既支持单宽（number，向后兼容）也支持每列宽（Array<number>，Excel 式单列扩宽）。
 */

function widthAt(cellWidths, i) {
  return Array.isArray(cellWidths) ? cellWidths[i] : cellWidths
}

/**
 * 每列左边缘坐标（含 gap）。
 * @param {number|Array<number>} cellWidths
 * @param {number} gap
 * @returns {Array<number>} lefts[i] = 第 i 列左边缘
 */
export function columnLefts(cellWidths, gap = 0) {
  const widths = Array.isArray(cellWidths) ? cellWidths : []
  const lefts = []
  let x = 0
  for (const w of widths) {
    lefts.push(x)
    x += w + gap
  }
  return lefts
}

/**
 * @param {number} lo - 起始 index
 * @param {number} hi - 结束 index（含）
 * @param {number|Array<number>} cellWidths
 * @param {number} gap - 列间距
 * @returns {{ left: number, width: number }}
 */
export function rangeRect(lo, hi, cellWidths, gap = 0) {
  let left = 0
  for (let i = 0; i < lo; i++) left += widthAt(cellWidths, i) + gap
  let width = 0
  for (let i = lo; i <= hi; i++) width += widthAt(cellWidths, i) + (i > lo ? gap : 0)
  return { left, width }
}
