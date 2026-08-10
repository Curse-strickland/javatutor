import { extractDataStructures } from './dataStructureExtract.js'

const POINTER_NAMES = [
  'left', 'right', 'l', 'r', 'mid', 'i', 'j',
  'low', 'high', 'start', 'end',
]

const MERGE_PATTERN = /mergeSort|merge\s*\(/i
const BINARY_PATTERN = /binarySearch|二分/i
const INSERTION_PATTERN = /insertionSort|insertSort|insertion\s+sort/i
const HEAP_PATTERN = /heapSort|heap\s*sort|PriorityQueue/i
const QUICK_PATTERN = /quickSort|partition/i
const SHELL_PATTERN = /shellSort|shell\s*sort|希尔/i
const TMP_ARRAY_PATTERN = /^(tmp|temp|aux)$/i
const MERGE_METHOD_PATTERN = /mergeSort|^merge$/i

/**
 * @deprecated Kept for tests / fallback — prefer buildMergeSortDynamic.
 * Build top-down divide levels for merge-sort tree display.
 */
export function buildMergeLevels(arr) {
  if (!arr || arr.length === 0) {
    return [{ segments: [[]] }]
  }

  const levels = [{ segments: [arr.slice()] }]
  let current = [arr.slice()]

  while (current.some((seg) => seg.length > 1)) {
    const next = []
    for (const seg of current) {
      if (seg.length <= 1) {
        next.push(seg.slice())
      } else {
        const mid = Math.floor(seg.length / 2)
        next.push(seg.slice(0, mid))
        next.push(seg.slice(mid))
      }
    }
    levels.push({ segments: next.map((s) => s.slice()) })
    current = next
  }

  return levels
}

function isNumericArray(values) {
  if (!values.length) return false
  return values.every((v) => typeof v === 'number' && Number.isFinite(v))
}

/**
 * Prefer the live array snapshot from the deepest stack frame.
 * TraceEngine keys heap slots by variable name (`arr` in main vs `a` in mergeSort);
 * only the name used in the current frame is updated after in-place writes — so
 * reading a stale `arr` heap entry would freeze the merge-sort diagram.
 */
function findPrimaryIntArray(heap, stackFrames) {
  for (let fi = (stackFrames || []).length - 1; fi >= 0; fi--) {
    const frame = stackFrames[fi]
    for (const bucket of [frame.locals || {}, frame.args || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (TMP_ARRAY_PATTERN.test(name)) continue
        if (Array.isArray(val) && isNumericArray(val)) {
          return { values: val.slice(), label: name }
        }
      }
    }
  }

  const { arrays } = extractDataStructures(heap, stackFrames)
  const liveKeys = new Set()
  for (const frame of stackFrames || []) {
    for (const bucket of [frame.locals || {}, frame.args || {}]) {
      for (const name of Object.keys(bucket)) {
        if (!TMP_ARRAY_PATTERN.test(name)) liveKeys.add(name.toLowerCase())
      }
    }
  }

  const ranked = []
  for (const arr of arrays) {
    if (arr.dims === 2) continue
    if (!isNumericArray(arr.values)) continue
    const name = String(arr.sourceVar || arr.label || arr.id || '')
    if (TMP_ARRAY_PATTERN.test(name)) continue
    let score = 1
    if (liveKeys.has(name.toLowerCase())) score += 10
    if (liveKeys.has(String(arr.id || '').toLowerCase())) score += 5
    ranked.push({ score, arr, name })
  }
  ranked.sort((a, b) => b.score - a.score)
  if (!ranked.length) return null
  const best = ranked[0].arr
  return { values: best.values.slice(), label: best.sourceVar || best.label || 'array' }
}

/** Temp / aux buffer used by classic merge sort (`tmp` / `temp` / `aux`). */
function findTempIntArray(heap, stackFrames) {
  for (let fi = (stackFrames || []).length - 1; fi >= 0; fi--) {
    const frame = stackFrames[fi]
    for (const bucket of [frame.locals || {}, frame.args || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (!TMP_ARRAY_PATTERN.test(name)) continue
        if (Array.isArray(val) && isNumericArray(val)) {
          return val.slice()
        }
      }
    }
  }

  const { arrays } = extractDataStructures(heap, stackFrames)
  for (const arr of arrays) {
    if (arr.dims === 2) continue
    if (!isNumericArray(arr.values)) continue
    const name = String(arr.sourceVar || arr.label || arr.id || '')
    if (TMP_ARRAY_PATTERN.test(name)) return arr.values.slice()
  }
  return null
}

function collectMethodNames(stackFrames) {
  const names = []
  for (const frame of stackFrames || []) {
    if (frame?.method) names.push(String(frame.method))
  }
  return names.join(' ')
}

function collectIntegerPointers(stackFrames, arrayLength) {
  const pointers = {}
  const seen = new Set()

  for (let fi = (stackFrames || []).length - 1; fi >= 0; fi--) {
    const frame = stackFrames[fi]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        if (!POINTER_NAMES.includes(key)) continue
        if (typeof val !== 'number' || !Number.isInteger(val)) continue
        if (val < 0 || val >= arrayLength) continue
        seen.add(key)
        pointers[key] = val
      }
    }
  }

  return pointers
}

function normalizeLoHi(pointers) {
  const lo = pointers.l ?? pointers.left ?? pointers.low ?? pointers.start
  const hi = pointers.r ?? pointers.right ?? pointers.high ?? pointers.end
  if (lo == null || hi == null) return null
  if (lo > hi) return { lo: hi, hi: lo }
  return { lo, hi }
}

function inferActiveIndex(mode, pointers) {
  if (mode === 'bars') {
    return pointers.i ?? pointers.j ?? null
  }
  if (mode === 'array-pointers') {
    return pointers.mid ?? pointers.i ?? pointers.j ?? null
  }
  return pointers.i ?? pointers.j ?? null
}

function inferMode(methodAndHint, pointers, valuesLength, codeHint) {
  const ctx = `${methodAndHint} ${codeHint}`

  if (MERGE_PATTERN.test(ctx)) return 'merge-tree'
  if (BINARY_PATTERN.test(ctx)) return 'array-pointers'
  if (HEAP_PATTERN.test(ctx)) return 'heap'
  if (INSERTION_PATTERN.test(ctx)) return 'bars'
  if (QUICK_PATTERN.test(ctx)) return 'array-pointers'
  if (SHELL_PATTERN.test(ctx)) return 'array'

  const hasMid = pointers.mid != null
  const hasL = pointers.l != null || pointers.left != null || pointers.low != null
  const hasR = pointers.r != null || pointers.right != null || pointers.high != null
  const hasI = pointers.i != null
  const hasJ = pointers.j != null

  if (hasMid && hasL && hasR) return 'array-pointers'
  if (hasL && hasR && !hasMid) return 'array-pointers'
  if (hasI && hasJ && !hasMid && valuesLength <= 20) return 'bars'

  const hasAnyPointer = Object.keys(pointers).length > 0
  if (hasAnyPointer) return 'array-pointers'

  if (/sort|Sort|排序/.test(ctx)) return 'array'

  return null
}

function modeLabel(mode) {
  switch (mode) {
    case 'merge-tree': return '归并排序'
    case 'array-pointers': return '数组 + 指针'
    case 'bars': return '插入排序'
    case 'heap': return '堆排序'
    case 'array': return '希尔：数组视图'
    default: return '排序'
  }
}

function readInt(bucket, names) {
  for (const n of names) {
    const v = bucket[n]
    if (typeof v === 'number' && Number.isInteger(v)) return v
  }
  return null
}

function rangeIndices(left, right) {
  const out = []
  for (let i = left; i <= right; i++) out.push(i)
  return out
}

/**
 * Full theoretical divide ranges by level (PDF 上半：一层层对半拆).
 * Level 0 = whole array; last level = singles.
 */
export function buildMergeRangeLevels(length) {
  if (length <= 0) return [[{ left: 0, right: -1 }]]
  let segs = [{ left: 0, right: length - 1 }]
  const levels = [segs.map((s) => ({ ...s }))]
  while (segs.some((s) => s.left < s.right)) {
    const next = []
    for (const s of segs) {
      if (s.left >= s.right) {
        next.push({ left: s.left, right: s.right })
      } else {
        const mid = s.left + Math.floor((s.right - s.left) / 2)
        next.push({ left: s.left, right: mid })
        next.push({ left: mid + 1, right: s.right })
      }
    }
    levels.push(next)
    segs = next
  }
  return levels
}

function findSegmentDepth(rangeLevels, left, right) {
  for (let d = 0; d < rangeLevels.length; d++) {
    if (rangeLevels[d].some((s) => s.left === left && s.right === right)) return d
  }
  return 0
}

function cellConsumed(idx, current, phase) {
  if (phase !== 'merge' || !current || current.mid == null) return false
  // Left half already taken into tmp when i advances past idx
  if (idx <= current.mid && current.i != null && idx < current.i) return true
  // Right half already taken when j advances past idx
  if (idx > current.mid && current.j != null && idx < current.j) return true
  return false
}

function annotateSegment(s, values, current, phase) {
  const vals = values.slice(s.left, s.right + 1)
  const active = !!(current && s.left === current.left && s.right === current.right)
  const covers = !!(current && s.left <= current.left && s.right >= current.right)
  const inside = !!(current && s.left >= current.left && s.right <= current.right)
  const consumed = vals.map((_, ci) => cellConsumed(s.left + ci, current, phase))
  return {
    left: s.left,
    right: s.right,
    values: vals,
    indices: rangeIndices(s.left, s.right),
    consumed,
    active,
    onPath: active || covers || inside,
    merging: active && phase === 'merge',
  }
}

/**
 * Merge-result row: fill from tmp[left..k) as the two-pointer merge writes.
 * Unfilled slots stay null so both source halves + the growing result update each step.
 */
function annotateMergeResult(left, right, aValues, tmpValues, current) {
  const values = []
  const filled = []
  for (let idx = left; idx <= right; idx++) {
    if (tmpValues && current?.k != null && idx < current.k) {
      values.push(tmpValues[idx])
      filled.push(true)
    } else if (!tmpValues) {
      // Fallback when no temp buffer is visible: show working array
      values.push(aValues[idx])
      filled.push(true)
    } else {
      values.push(null)
      filled.push(false)
    }
  }
  return {
    left,
    right,
    values,
    indices: rangeIndices(left, right),
    filled,
    consumed: values.map(() => false),
    merging: true,
    active: true,
    onPath: true,
  }
}

/**
 * PDF-style live merge-sort model:
 * - levels[]: vertical rows of array boxes (divide then merge)
 * - arrows between rows
 * - reveal / highlight driven by mergeSort call stack
 * - merge row reads tmp (progressive), source halves read working array a
 */
export function buildMergeSortDynamic(values, stackFrames, tmpValues = null) {
  const len = values?.length || 0
  const frames = []

  for (const frame of stackFrames || []) {
    if (!MERGE_METHOD_PATTERN.test(String(frame?.method || ''))) continue
    const bucket = { ...(frame.args || {}), ...(frame.locals || {}) }
    const left = readInt(bucket, ['left', 'l', 'low', 'start'])
    const right = readInt(bucket, ['right', 'r', 'high', 'end'])
    if (left == null || right == null) continue
    if (left < 0 || right >= len || left > right) continue

    const mid = readInt(bucket, ['mid'])
    const i = readInt(bucket, ['i'])
    const j = readInt(bucket, ['j'])
    const k = readInt(bucket, ['k'])
    const merging = i != null || j != null || k != null

    let phase = 'enter'
    if (left === right) phase = 'base'
    else if (merging) phase = 'merge'
    else if (mid != null) phase = 'divide'

    frames.push({
      depth: frames.length,
      left,
      right,
      mid,
      i,
      j,
      k,
      phase,
      segment: values.slice(left, right + 1),
      leftSeg: mid != null && mid >= left && mid < right
        ? values.slice(left, mid + 1)
        : null,
      rightSeg: mid != null && mid >= left && mid < right
        ? values.slice(mid + 1, right + 1)
        : null,
    })
  }

  const current = frames.length ? frames[frames.length - 1] : null
  const phase = current?.phase || (len ? 'enter' : 'empty')
  const rangeLevels = buildMergeRangeLevels(len)
  const levels = []

  if (len === 0) {
    return {
      values: [],
      tmpValues: tmpValues ? tmpValues.slice() : null,
      frames,
      current,
      phase,
      phaseLabel: phaseLabel(phase),
      levels: [],
    }
  }

  if (!current) {
    // 尚未进入递归：只显示顶层整段（PDF 第一行）
    levels.push({
      kind: 'divide',
      depth: 0,
      segments: rangeLevels[0].map((s) => annotateSegment(s, values, null, phase)),
    })
  } else if (phase === 'merge' && current.mid != null && current.left < current.right) {
    // PDF 下半：拆分层 + 左右源半区（a）+ 合并结果（tmp 逐步写入）
    const curDepth = findSegmentDepth(rangeLevels, current.left, current.right)
    for (let d = 0; d <= curDepth; d++) {
      levels.push({
        kind: 'divide',
        depth: d,
        segments: rangeLevels[d].map((s) => annotateSegment(s, values, current, 'divide')),
      })
    }
    const leftChild = { left: current.left, right: current.mid }
    const rightChild = { left: current.mid + 1, right: current.right }
    levels.push({
      kind: 'divide',
      depth: curDepth + 1,
      segments: [
        annotateSegment(leftChild, values, current, 'merge'),
        annotateSegment(rightChild, values, current, 'merge'),
      ],
    })
    levels.push({
      kind: 'merge',
      depth: curDepth,
      segments: [
        annotateMergeResult(current.left, current.right, values, tmpValues, current),
      ],
    })
  } else {
    // PDF 上半：分解——展开到当前深度，若已算 mid 再露出下一层左右半
    const curDepth = findSegmentDepth(rangeLevels, current.left, current.right)
    const showChild = phase === 'divide' && current.mid != null && current.left < current.right
    const maxD = Math.min(rangeLevels.length - 1, curDepth + (showChild ? 1 : 0))
    for (let d = 0; d <= maxD; d++) {
      levels.push({
        kind: 'divide',
        depth: d,
        segments: rangeLevels[d].map((s) => annotateSegment(s, values, current, phase)),
      })
    }
  }

  return {
    values: values.slice(),
    tmpValues: tmpValues ? tmpValues.slice() : null,
    frames,
    current,
    phase,
    phaseLabel: phaseLabel(phase),
    levels,
  }
}

function phaseLabel(phase) {
  switch (phase) {
    case 'divide': return '分解'
    case 'merge': return '合并'
    case 'base': return '到达单元素'
    case 'enter': return '进入区间'
    default: return '归并'
  }
}

/**
 * Extract sort-algorithm visualization snapshot from runtime heap + stack.
 * Returns null when no numeric array is found or mode cannot be inferred.
 */
export function extractSortViz(heap, stackFrames, codeHint = '') {
  const primary = findPrimaryIntArray(heap, stackFrames)
  if (!primary) return null

  const { values, label: arrayLabel } = primary
  const pointers = collectIntegerPointers(stackFrames, values.length)
  const methodAndHint = collectMethodNames(stackFrames)
  const mode = inferMode(methodAndHint, pointers, values.length, codeHint)

  if (!mode) return null

  const range = normalizeLoHi(pointers)
  const activeIndex = inferActiveIndex(mode, pointers)
  const label = mode === 'array' && SHELL_PATTERN.test(`${methodAndHint} ${codeHint}`)
    ? '希尔：数组视图'
    : modeLabel(mode)

  const result = {
    mode,
    values,
    pointers,
    range,
    activeIndex,
    label,
    arrayLabel,
  }

  if (mode === 'merge-tree') {
    const tmpValues = findTempIntArray(heap, stackFrames)
    result.mergeDynamic = buildMergeSortDynamic(values, stackFrames, tmpValues)
    result.mergeLevels = null
  }

  return result
}
