/**
 * 计算 range / sorted 高亮框的 left / width，考虑 grid gap。
 * @param {number} lo - 起始 index
 * @param {number} hi - 结束 index（含）
 * @param {number} cellWidth - 单格宽度
 * @param {number} gap - 列间距
 * @returns {{ left: number, width: number }}
 */
export function rangeRect(lo, hi, cellWidth, gap) {
  return {
    left: lo * (cellWidth + gap),
    width: (hi - lo + 1) * cellWidth + (hi - lo) * gap,
  }
}
