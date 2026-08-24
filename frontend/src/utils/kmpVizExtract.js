/**
 * KMP 字符串匹配可视化抽取层。
 *
 * 复用「运行 → TraceEngine 追踪 → 从堆/栈帧抽取」的现有管线：TraceEngine 把 String
 * 当普通值写入 frame.locals，把 int[] 存为数组，i/j 存为整数，方法名进 stackFrames[].method。
 * 因此 KMP 的两阶段天然可区分：任一帧 method 命中 buildNext/failure 类名字 → 构建 next；
 * 否则 → 匹配阶段。失配跳转（j 变小）通过与上一步栈帧比较得出，用于渲染「为什么跳」。
 */
const NEXT_BUILD_METHOD = /buildNext|computeNext|prefixFunc|computeLPS|failure|lps/i
const KMP_CODE_HINT = /buildNext|computeNext|prefixFunc|failure|kmp|charAt/i

const TEXT_NAMES = /^(text|haystack|s|str|t|txt)$/i
const PATTERN_NAMES = /^(pattern|needle|p|pat)$/i
const NEXT_ARRAY_NAMES = /^(next|lps|pi|prefix|fail|failure)$/i

function isStr(v) {
  return typeof v === 'string' && v.length > 0
}

function isIntArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === 'number')
}

/** 从栈帧（最深优先）读取名为 `i`/`j` 的整数指针。 */
function readIntPointers(stackFrames) {
  let i = null
  let j = null
  for (let fi = (stackFrames || []).length - 1; fi >= 0; fi--) {
    const frame = stackFrames[fi]
    for (const bucket of [frame.locals || {}, frame.args || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (typeof val !== 'number' || !Number.isInteger(val)) continue
        if (name === 'i' && i == null) i = val
        else if (name === 'j' && j == null) j = val
      }
    }
  }
  return { i, j }
}

function readPrevJ(prevStackFrames) {
  return readIntPointers(prevStackFrames).j
}

function buildExplanation(mode, s) {
  const { text, pattern, next, i, j, jumpInfo } = s
  const m = pattern.length

  if (mode === 'next-build') {
    if (i == null) return '构建 next 数组：正在扫描 pattern。'
    const filled = next.slice(0, i)
    const filledStr = filled.length ? `[${filled.join(', ')}]` : '[]'
    const cur = i < next.length ? `，next[${i}] = ${next[i]}` : ''
    return `构建 next[${i}]：i=${i}，j=${j}，已填 next[0..${i - 1}] = ${filledStr}${cur}`
  }

  // matching
  if (jumpInfo) {
    return `失配：已匹配 "${jumpInfo.matched}"，其最长相同前后缀为 "${jumpInfo.lcp}"（长度 ${jumpInfo.lcpLen}），故 j: ${jumpInfo.from} → ${jumpInfo.to}`
  }
  if (j != null && i != null && j >= m) {
    return `在位置 ${i - m + 1} 找到完整匹配！`
  }
  if (i != null && j != null && i < text.length && j < m && text[i] === pattern[j]) {
    return `text[${i}] 与 pattern[${j}] 相等（'${text[i]}'），i、j 同时前进`
  }
  if (i != null && j != null && i < text.length && j >= 0) {
    const pc = j < m ? pattern[j] : '∅'
    return `text[${i}]（'${text[i]}'）与 pattern[${j}]（'${pc}'）不匹配`
  }
  return '比较 text 与 pattern 当前字符'
}

/**
 * @param {object} heap                当前步骤堆
 * @param {Array}  stackFrames         当前步骤栈帧
 * @param {string} codeHint            源代码（用于识别 KMP）
 * @param {Array|null} prevStackFrames 上一步栈帧（用于识别失配跳转）
 * @returns {object|null} KMP 快照，非 KMP 时返回 null
 */
export function extractKmpViz(heap, stackFrames, codeHint = '', prevStackFrames = null) {
  const frames = stackFrames || []
  if (!frames.length) return null

  let text = null
  let pattern = null
  let nextArr = null
  let nextName = null

  // 最深帧优先：buildNext 帧内是构建中的 next 数组 / 形参 p
  for (let fi = frames.length - 1; fi >= 0; fi--) {
    const frame = frames[fi]
    for (const bucket of [frame.locals || {}, frame.args || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (isStr(val)) {
          if (text == null && TEXT_NAMES.test(name)) text = val
          if (pattern == null && PATTERN_NAMES.test(name)) pattern = val
        } else if (nextArr == null && isIntArray(val) && NEXT_ARRAY_NAMES.test(name)) {
          nextArr = val
          nextName = name
        }
      }
    }
  }

  const methodStr = frames.map((f) => String(f?.method || '')).join(' ')
  const code = String(codeHint || '')
  const isBuildMethod = NEXT_BUILD_METHOD.test(methodStr)
  const isKmpHint = KMP_CODE_HINT.test(code)

  // 识别门槛：必须有 pattern 字符串 + next 数组，且命中 KMP 特征
  if (pattern == null || nextArr == null) return null
  if (!isBuildMethod && !isKmpHint) return null

  const mode = isBuildMethod ? 'next-build' : 'matching'
  const { i, j } = readIntPointers(frames)

  let alignOffset = null
  if (mode === 'matching' && i != null && j != null) alignOffset = i - j

  let jumpInfo = null
  if (mode === 'matching' && prevStackFrames) {
    const prevJ = readPrevJ(prevStackFrames)
    if (prevJ != null && j != null && prevJ > j && prevJ <= pattern.length) {
      jumpInfo = {
        from: prevJ,
        to: j,
        matched: pattern.slice(0, prevJ),
        lcpLen: j,
        lcp: pattern.slice(0, j),
      }
    }
  }

  const explanation = buildExplanation(mode, { text, pattern, next: nextArr, i, j, jumpInfo })

  return {
    mode,
    text,
    pattern,
    next: nextArr,
    nextName,
    i,
    j,
    alignOffset,
    jumpInfo,
    explanation,
    phaseLabel: mode === 'next-build' ? '构建 next 数组' : '字符串匹配',
    primaryArrayId: nextName,
  }
}
