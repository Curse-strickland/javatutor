/**
 * Shared pointer / focus role colors for DS visualization.
 *
 * mid/cur (焦点) → yellow
 * root (树根) → red
 * next / right 侧 → blue
 * prev / left 侧 → grey
 */
export const POINTER_ROLE = {
  MID: 'mid',
  NEXT: 'next',
  PREV: 'prev',
  INSERT: 'insert',
  ROOT: 'root',
  NEUTRAL: 'neutral',
}

export const POINTER_ROLE_COLORS = {
  mid: '#eab308',
  next: '#3b82f6',
  prev: '#6b7280',
  root: '#ef476f',
  insert: '#d946ef',
  neutral: '#f59e0b',
}

const MID_NAMES = /^(mid|cur|curr|current|node|key|pivot|i)$/i
const NEXT_NAMES = /^(next|fast|right|r|high|end|tail|j|rear)$/i
const PREV_NAMES = /^(prev|slow|left|l|low|start|head|front)$/i
const INSERT_NAMES = /^(insert|orphan|new)$/i
const ROOT_NAMES = /^(root)$/i

const ROLE_PRIORITY = {
  mid: 5,
  root: 4,
  insert: 3,
  next: 2,
  prev: 1,
}

/**
 * Infer a visual role from a pointer / variable name.
 * @param {string} name
 * @returns {'mid'|'next'|'prev'|'insert'|'root'|null}
 */
export function inferPointerRole(name) {
  if (name == null) return null
  const n = String(name).trim()
  if (!n) return null
  if (MID_NAMES.test(n)) return POINTER_ROLE.MID
  if (ROOT_NAMES.test(n)) return POINTER_ROLE.ROOT
  if (INSERT_NAMES.test(n)) return POINTER_ROLE.INSERT
  if (NEXT_NAMES.test(n)) return POINTER_ROLE.NEXT
  if (PREV_NAMES.test(n)) return POINTER_ROLE.PREV
  return null
}

/**
 * @param {string|null|undefined} role
 * @returns {string|null} hex color
 */
export function colorForRole(role) {
  if (!role) return null
  return POINTER_ROLE_COLORS[role] || null
}

/**
 * @param {string} name
 * @returns {string|null}
 */
export function colorForPointerName(name) {
  return colorForRole(inferPointerRole(name))
}

/**
 * Pick the strongest role among labels (cur/mid beats root).
 * @param {string[]} labels
 * @returns {'mid'|'next'|'prev'|'insert'|'root'|null}
 */
export function primaryRoleFromLabels(labels) {
  let best = null
  let bestScore = 0
  for (const label of labels || []) {
    const role = inferPointerRole(label)
    if (!role) continue
    const score = ROLE_PRIORITY[role] || 0
    if (score > bestScore) {
      best = role
      bestScore = score
    }
  }
  return best
}

/**
 * CSS-friendly style bits for a role-colored chip / border.
 * 背景不透明（叠加时上层 chip 完全遮住下层，避免半透明混合模糊），保留描边。
 * @param {string|null} role
 */
export function roleStyle(role) {
  const color = colorForRole(role)
  if (!color) return {}
  return {
    color,
    borderColor: `${color}66`,
    background: 'var(--card-bg)',
    fill: color,
  }
}
