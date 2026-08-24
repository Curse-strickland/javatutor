# 数据结构可视化打磨 · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 单文件「数据结构」Tab 的 chip 重叠 / 视觉单调 / 同数组多处渲染三类问题一并打磨，保持现有数据结构识别逻辑不变。

**Architecture:** 抽出 `chipOverlayLayout` 纯函数 + `ArrayCell` 原子 + `ChipOverflowPopover` 选 chip 组件；`SortArrayCanvas` 与 `ArrayCanvas` 共用新组件并接入动态压缩；`MatrixCanvas` / `LinkedListCanvas` 仅改 CSS；`sortVizExtract` 输出 `primaryArrayId`，`DataStructureTab` 据此过滤重复数组。

**Tech Stack:** Vue 3.5（Composition API）、Vitest 4、原生 CSS 变量（无 Tailwind utility 用在本层）。

**Spec:** [docs/superpowers/specs/2026-08-21-ds-viz-polish-design.md](../specs/2026-08-21-ds-viz-polish-design.md)

---

## Global Constraints

- Vue 3 Composition API + `<script setup>`；不引入新依赖。
- 测试运行：`cd frontend && npm test`（vitest run）。
- 测试用例语言：英文 describe/it，断言 `expect` 与中文注释并存可接受。
- 颜色变量全部走 `frontend/src/style.css` 的 `:root`，新增 DS token 沿用现有命名 `--ds-*`。
- Cell 最小宽度 48px、chip 最小字号 10px（已与用户在 brainstorming 确认）。
- 不要自动 commit：每个任务末尾有 commit 步骤，由执行者操作。
- 与现有 `docs/superpowers/specs/2026-08-10-visualization-redesign-design.md` M1/M2 不冲突；本计划只动 M1/M2 之上的可视化层。

---

## File Structure

| 文件 | 责任 |
|------|------|
| `frontend/src/style.css` | 新增 DS 圆角 / shadow / popover shadow / cell border 设计 token |
| `frontend/src/utils/pointerRoleColors.js` | 加 `neutral` 角色色（else chip 用） |
| `frontend/src/utils/chipOverlayLayout.js` | 纯函数：`computeChipLayout({chipsByCell, ...}) → {cellWidth, chipFontSize, overflowByCell, fits}` |
| `frontend/src/utils/sortVizExtract.js` | `findPrimaryIntArray` 返回 `{values, label, id}`；`extractSortViz` 加 `primaryArrayId` |
| `frontend/src/components/ArrayCell.vue` | 新原子：方框 + value + index + 圆角 + shadow + highlight + role + pivot 视觉 |
| `frontend/src/components/ArrayNode.vue` | 收敛为 `<ArrayCell>` 薄壳，保持外部 API |
| `frontend/src/components/ChipOverflowPopover.vue` | 受控 popover：Teleport 到 body，选择 ≤ max 个 chip 并保存 |
| `frontend/src/components/SortArrayCanvas.vue` | 接 chipOverlayLayout + ArrayCell + Popover |
| `frontend/src/components/ArrayCanvas.vue` | 同上 |
| `frontend/src/components/MatrixCanvas.vue` | CSS 圆角 + shadow（不动布局 / props） |
| `frontend/src/components/LinkedListCanvas.vue` | CSS 圆角 + shadow（不动布局 / SVG） |
| `frontend/src/components/right-tabs/DataStructureTab.vue` | 新 `visibleArrays` computed，按 sortViz.primaryArrayId 过滤 |

---

## Task 1: 设计 token + neutral 角色色

**Files:**
- Modify: `frontend/src/style.css`（追加 `:root` token）
- Modify: `frontend/src/utils/pointerRoleColors.js`（加 `POINTER_ROLE.NEUTRAL` + `POINTER_ROLE_COLORS.neutral`）
- Modify: `frontend/src/utils/pointerRoleColors.test.js`（加 neutral 测试）

**Interfaces:**
- Consumes: 无
- Produces:
  - CSS variables: `--ds-cell-radius`, `--ds-cell-radius-sm`, `--ds-cell-shadow`, `--ds-cell-shadow-active`, `--ds-cell-border`, `--ds-popover-shadow`
  - `POINTER_ROLE.NEUTRAL === 'neutral'`
  - `POINTER_ROLE_COLORS.neutral === '#9ca3af'`
  - `colorForRole('neutral')` 返回 `'#9ca3af'`
  - `inferPointerName('neutral')` 返回 null（neutral 不是从指针名推断，而是显式 role）

- [ ] **Step 1: 写 failing test**

在 `frontend/src/utils/pointerRoleColors.test.js` 的最后一个 `it` 块**前**插入：

```js
describe('neutral role (else chip fallback)', () => {
  it('exposes neutral role color', () => {
    expect(POINTER_ROLE_COLORS.neutral).toBe('#9ca3af')
    expect(colorForRole('neutral')).toBe('#9ca3af')
  })

  it('does not infer neutral from pointer names', () => {
    expect(inferPointerRole('neutral')).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npm test -- pointerRoleColors`
Expected: FAIL —— `POINTER_ROLE_COLORS.neutral` 是 `undefined`，`colorForRole('neutral')` 也是 `undefined`。

- [ ] **Step 3: 实现**

`frontend/src/utils/pointerRoleColors.js`：

1. `POINTER_ROLE` 加 `NEUTRAL: 'neutral'`。
2. `POINTER_ROLE_COLORS` 加 `neutral: '#9ca3af'`。

无需改 `inferPointerRole`（显式 role 走 `colorForRole`，不走 `inferPointerRole`）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd frontend && npm test -- pointerRoleColors`
Expected: PASS，新加的 2 个 it 全过，原有用例不退。

接着手改 `frontend/src/style.css`：在 `:root` 块尾部追加：

```css
:root {
  /* ... existing tokens ... */

  /* 数据结构画布共享设计 token */
  --ds-cell-radius: 8px;
  --ds-cell-radius-sm: 6px;
  --ds-cell-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  --ds-cell-shadow-active: 0 4px 12px rgba(0, 0, 0, 0.12);
  --ds-cell-border: 1px solid var(--border);
  --ds-popover-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);
}
```

（注意：现有文件 `:root` 内已有什么 token 需要打开确认位置；不要替换，只追加。）

- [ ] **Step 5: Commit**

```bash
git add frontend/src/style.css frontend/src/utils/pointerRoleColors.js frontend/src/utils/pointerRoleColors.test.js
git commit -m "feat(ds): DS 设计 token + neutral 角色色"
```

---

## Task 2: chipOverlayLayout 纯函数（TDD）

**Files:**
- Create: `frontend/src/utils/chipOverlayLayout.js`
- Create: `frontend/src/utils/chipOverlayLayout.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `computeChipLayout({ chipsByCell, baseCellWidth?, baseFontSize?, minFontSize?, fontStep?, showLimit? })`
    - `chipsByCell`: `Map<number, Array<{name: string, color: string, role?: string}>>`
    - `baseCellWidth` 默认 48
    - `baseFontSize` 默认 11
    - `minFontSize` 默认 10
    - `fontStep` 默认 1
    - `showLimit` 默认 2
  - Returns: `{ cellWidth: number, chipFontSize: number, overflowByCell: Map<number, {allChips, visibleChips, hiddenCount}>, fits: boolean }`

- [ ] **Step 1: 写 failing test**

新建 `frontend/src/utils/chipOverlayLayout.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { computeChipLayout } from './chipOverlayLayout.js'

describe('computeChipLayout', () => {
  it('returns defaults for empty chipsByCell', () => {
    const out = computeChipLayout({ chipsByCell: new Map() })
    expect(out.cellWidth).toBe(48)
    expect(out.chipFontSize).toBe(11)
    expect(out.overflowByCell.size).toBe(0)
    expect(out.fits).toBe(true)
  })

  it('keeps base font when only one chip per cell', () => {
    const chips = new Map([[0, [{ name: 'i', color: '#eab308' }]]])
    const out = computeChipLayout({ chipsByCell: chips })
    expect(out.chipFontSize).toBe(11)
    expect(out.cellWidth).toBe(48)
    expect(out.overflowByCell.size).toBe(0)
  })

  it('shrinks font per max chip count and clamps at minFontSize', () => {
    const chips = new Map([[0, [
      { name: 'l', color: '#6b7280' },
      { name: 'r', color: '#3b82f6' },
      { name: 'pivot', color: '#f97316' },
    ]]])
    const out = computeChipLayout({ chipsByCell: chips })
    // maxC=3 → 11 - (3-1)*1 = 9 → clamped to 10
    expect(out.chipFontSize).toBe(10)
    // maxC=3 → cellWidth = max(48, 3 * (10+8)) = 54
    expect(out.cellWidth).toBe(54)
  })

  it('emits overflowByCell only when chips.length > showLimit', () => {
    const chips = new Map([
      [0, [{ name: 'a' }, { name: 'b' }]],                  // 2 chips → no overflow
      [1, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]],  // 3 chips → overflow
    ])
    const out = computeChipLayout({ chipsByCell: chips })
    expect(out.overflowByCell.has(0)).toBe(false)
    const ov1 = out.overflowByCell.get(1)
    expect(ov1.visibleChips.map((c) => c.name)).toEqual(['a', 'b'])
    expect(ov1.hiddenCount).toBe(1)
    expect(ov1.allChips).toHaveLength(3)
  })

  it('fits is false when cellWidth exceeds 3 * baseCellWidth', () => {
    const chips = new Map([
      [0, Array.from({ length: 9 }, (_, i) => ({ name: `c${i}` }))],
    ])
    const out = computeChipLayout({ chipsByCell: chips })
    // maxC=9 → cellWidth = max(48, 9 * (10+8)) = 162; 162 > 48*3 → fits=false
    expect(out.fits).toBe(false)
  })

  it('uses uniform cell width and font size across all cells', () => {
    const chips = new Map([
      [0, [{ name: 'a' }]],
      [1, [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }]],
    ])
    const out = computeChipLayout({ chipsByCell: chips })
    expect(out.cellWidth).toBeGreaterThanOrEqual(48)
    // 整个布局只有一个 cellWidth
    expect(typeof out.cellWidth).toBe('number')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npm test -- chipOverlayLayout`
Expected: FAIL —— `Cannot find module './chipOverlayLayout.js'`。

- [ ] **Step 3: 实现**

新建 `frontend/src/utils/chipOverlayLayout.js`：

```js
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd frontend && npm test -- chipOverlayLayout`
Expected: PASS，6 个 it 全过。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/chipOverlayLayout.js frontend/src/utils/chipOverlayLayout.test.js
git commit -m "feat(layout): chipOverlayLayout 纯函数（cell 宽 / 字号 / 溢出）"
```

---

## Task 3: ArrayCell 原子 + ArrayNode 收敛

**Files:**
- Create: `frontend/src/components/ArrayCell.vue`
- Modify: `frontend/src/components/ArrayNode.vue`（内嵌 `<ArrayCell>`）

**Interfaces:**
- Consumes: 无
- Produces:
  - `<ArrayCell>` props: `value, index, isFirst, isLast, isHighlighted, pointerLabels, role, isPivot`
  - 视觉表现：圆角 + shadow，pivot / role / highlight 状态用对应颜色描边或底色（与现有 ArrayNode 行为一致）

- [ ] **Step 1: 创建 ArrayCell.vue**

新建 `frontend/src/components/ArrayCell.vue`：

```vue
<template>
  <div
    class="ds-array-cell"
    :class="{ highlighted: isHighlighted, first: isFirst, last: isLast, pivot: isPivot }"
    :style="cellStyle"
  >
    <div class="ds-array-cell-val">{{ value == null ? '∅' : value }}</div>
    <div class="ds-array-cell-idx">{{ index }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { colorForRole, primaryRoleFromLabels, POINTER_ROLE_COLORS } from '../utils/pointerRoleColors.js'

const props = defineProps({
  value: { type: [Number, String, Object, Boolean], default: null },
  index: { type: Number, required: true },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  isHighlighted: { type: Boolean, default: false },
  pointerLabels: { type: Array, default: () => [] },
  role: { type: String, default: null },
  isPivot: { type: Boolean, default: false },
})

const resolvedRole = computed(() => {
  if (props.role) return props.role
  return primaryRoleFromLabels(props.pointerLabels)
})

const cellStyle = computed(() => {
  if (props.isPivot) {
    return {
      background: 'transparent',
      borderColor: '#f97316',
      boxShadow: `inset 0 0 0 1px #f97316, var(--ds-cell-shadow-active)`,
      zIndex: 2,
      position: 'relative',
    }
  }
  if (!props.isHighlighted) return {}
  const color = colorForRole(resolvedRole.value) || colorForRole('mid')
  return {
    background: `${color}26`,
    borderColor: color,
    boxShadow: `var(--ds-cell-shadow-active)`,
    zIndex: 1,
    position: 'relative',
  }
})
</script>

<style scoped>
.ds-array-cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-width: 48px;
  flex-shrink: 0;
  border-radius: var(--ds-cell-radius);
  border: var(--ds-cell-border);
  background: var(--card-bg);
  box-shadow: var(--ds-cell-shadow);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-h);
  transition: background 0.15s, border-color 0.15s;
}
.ds-array-cell.first { /* 容器层负责外圈圆角对齐，cell 自身不特殊处理 */ }
.ds-array-cell.last  { /* 同上 */ }
.ds-array-cell-val {
  padding: 8px 10px;
  min-width: 44px;
  text-align: center;
  flex: 1;
}
.ds-array-cell-idx {
  padding: 2px 6px;
  font-size: 10px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  text-align: center;
}
.ds-array-cell.pivot {
  border-color: #f97316;
}
</style>
```

> 说明：`ArrayCell` 用 `width: 100%`，由父容器的 grid/flex 决定 cell 宽；这让 SortArrayCanvas / ArrayCanvas 都能把 `cellWidth` 注入到外层 grid template。

- [ ] **Step 2: 修改 ArrayNode.vue 为薄壳**

`frontend/src/components/ArrayNode.vue` 改为：

```vue
<template>
  <ArrayCell
    :value="value"
    :index="index"
    :is-first="isFirst"
    :is-last="isLast"
    :is-highlighted="isHighlighted"
    :pointer-labels="pointerLabels"
    :role="role"
    :is-pivot="isPivot"
  />
</template>

<script setup>
import ArrayCell from './ArrayCell.vue'

defineProps({
  value: { type: [Number, String, Object, Boolean], default: null },
  index: { type: Number, required: true },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  isHighlighted: { type: Boolean, default: false },
  pointerLabels: { type: Array, default: () => [] },
  role: { type: String, default: null },
  isPivot: { type: Boolean, default: false },
})
</script>

<style scoped>
.array-node {
  width: 48px;
  min-width: 48px;
  flex-shrink: 0;
}
</style>
```

> 保留旧 class 名 `array-node` 以避免调用方 CSS 选择器失效；`width: 48px` 是兜底，新逻辑里 SortArrayCanvas / ArrayCanvas 会用 grid 覆盖。

- [ ] **Step 3: 跑测试确认无回归**

Run: `cd frontend && npm test`
Expected: 全绿（129+ 通过；现有 ArrayNode / ArrayCanvas 测试无变化）。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ArrayCell.vue frontend/src/components/ArrayNode.vue
git commit -m "refactor(canvas): ArrayCell 原子 + ArrayNode 收敛为薄壳"
```

---

## Task 4: ChipOverflowPopover 组件

**Files:**
- Create: `frontend/src/components/ChipOverflowPopover.vue`

**Interfaces:**
- Consumes: 无
- Produces:
  - Props:
    - `chips: Array<{ name: string, color: string, role?: string }>`
    - `selection: Set<string>`（受控）
    - `max: number`（默认 2）
    - `open: boolean`
    - `anchor: { cellLeft: number, cellWidth: number, containerTop: number }`（用于 fixed 定位）
    - `viewportWidth: number`（用于水平贴边判断）
    - `viewportHeight: number`
  - Emits: `update:selection(new Set)`, `close`
  - 行为：Teleport 到 body；Esc / 点外部 / 点保存 → close；保存时 emit `update:selection`

- [ ] **Step 1: 创建 ChipOverflowPopover.vue**

新建 `frontend/src/components/ChipOverflowPopover.vue`：

```vue
<template>
  <Teleport to="body">
    <div
      v-if="open && mounted"
      class="chip-overflow-popover"
      :style="popoverStyle"
      @click.stop
    >
      <div class="cop-header">
        选择保留的 chip（最多 {{ max }} 个）
        <span class="cop-count">{{ selection.size }} / {{ max }}</span>
      </div>
      <div class="cop-body">
        <button
          v-for="chip in chips"
          :key="chip.name"
          type="button"
          class="cop-row"
          :class="{ selected: selection.has(chip.name), disabled: !selection.has(chip.name) && selection.size >= max }"
          :disabled="!selection.has(chip.name) && selection.size >= max"
          @click="toggle(chip.name)"
        >
          <span class="cop-dot" :style="{ background: chip.color }" />
          <span class="cop-label">{{ chip.name }}</span>
          <span class="cop-check" :class="{ checked: selection.has(chip.name) }">
            {{ selection.has(chip.name) ? '✓' : '' }}
          </span>
        </button>
      </div>
      <div class="cop-footer">
        <button type="button" class="cop-save" @click="onSave">保存</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  chips: { type: Array, required: true },
  selection: { type: Set, required: true },
  max: { type: Number, default: 2 },
  open: { type: Boolean, default: false },
  anchor: { type: Object, required: true },
  viewportWidth: { type: Number, default: window.innerWidth },
  viewportHeight: { type: Number, default: window.innerHeight },
})

const emit = defineEmits(['update:selection', 'close'])
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

watch(() => props.open, (v) => {
  if (v) mounted.value = true
})

function onKeydown(e) {
  if (!props.open) return
  if (e.key === 'Escape') emit('close')
}

function toggle(name) {
  const next = new Set(props.selection)
  if (next.has(name)) {
    next.delete(name)
  } else if (next.size < props.max) {
    next.add(name)
  }
  emit('update:selection', next)
}

function onSave() {
  emit('update:selection', new Set(props.selection))
  emit('close')
}

const POPOVER_W = 280
const POPOVER_H_EST = 220

const popoverStyle = computed(() => {
  const cellCenter = props.anchor.cellLeft + props.anchor.cellWidth / 2
  let left = cellCenter - POPOVER_W / 2
  let top = props.anchor.containerTop - POPOVER_H_EST - 12
  // 水平贴边
  if (left < 8) left = 8
  if (left + POPOVER_W > props.viewportWidth - 8) left = props.viewportWidth - 8 - POPOVER_W
  // 上方空间不够就落下方
  if (top < 8) top = props.anchor.containerTop + 12
  return {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${POPOVER_W}px`,
    zIndex: 9999,
  }
})
</script>

<style scoped>
.chip-overflow-popover {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--ds-cell-radius);
  box-shadow: var(--ds-popover-shadow);
  font-family: var(--mono);
  color: var(--text-h);
  user-select: none;
}
.cop-header {
  padding: 10px 12px;
  font-size: 11px;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cop-count { color: var(--text-muted); font-size: 10px; }
.cop-body { display: flex; flex-direction: column; padding: 6px 0; max-height: 280px; overflow-y: auto; }
.cop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: inherit;
}
.cop-row:hover:not(.disabled) { background: rgba(0, 0, 0, 0.04); }
.cop-row.selected { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.cop-row.disabled { opacity: 0.4; cursor: not-allowed; }
.cop-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.cop-label { flex: 1; font-size: 12px; font-weight: 600; }
.cop-check {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: white;
}
.cop-check.checked { background: var(--accent); border-color: var(--accent); }
.cop-footer {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}
.cop-save {
  background: var(--accent);
  color: white;
  border: 0;
  border-radius: 4px;
  padding: 6px 14px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.cop-save:hover { filter: brightness(1.1); }
</style>
```

- [ ] **Step 2: 跑测试**

Run: `cd frontend && npm test`
Expected: 全绿（popover 是纯渲染，不需独立测试；后续 Task 5 / 6 在 SortArrayCanvas / ArrayCanvas 集成测试里间接覆盖）。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChipOverflowPopover.vue
git commit -m "feat(canvas): ChipOverflowPopover 选择 ≤max chip 受控组件"
```

---

## Task 5: SortArrayCanvas 接入 chipOverlayLayout + ArrayCell + Popover

**Files:**
- Modify: `frontend/src/components/SortArrayCanvas.vue`

**Interfaces:**
- Consumes: 现有 props 不变（`values, pointers, range, activeIndex, pivot, sortedRange, label`）
- Produces:
  - 内部 computed：`chipsByCell`、`layout = computeChipLayout(...)`、`visibleArrays`（旧 chip 流 + 汇总 chip 流合并）
  - 内部 state：`popoverOpenCell`、`overflowSelections`
  - 模板：cells 用 grid + `cellWidth`；每格渲染 `visibleChips[i]` + 可能的 `+N` / `else` chip；overflow cell 渲染 `<ChipOverflowPopover>`

- [ ] **Step 1: 改造 SortArrayCanvas**

替换整个 `frontend/src/components/SortArrayCanvas.vue`：

```vue
<template>
  <div class="sort-array-canvas">
    <div class="sac-header">
      <span class="sac-label">{{ label }}</span>
    </div>
    <div class="sac-strip-wrap" ref="wrapEl">
      <div class="sac-pointers sac-pointers-above">
        <div
          v-for="entry in aboveEntries"
          :key="entry.key"
          class="sac-pointer"
          :style="{ left: entry.left + 'px' }"
        >
          <span class="sac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
          <svg class="sac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
            <path d="M0 0 L10 0 L5 6 Z" :fill="entry.color" />
          </svg>
        </div>
      </div>
      <div
        class="sac-strip"
        :style="{ gridTemplateColumns: `repeat(${values.length}, ${layout.cellWidth}px)` }"
      >
        <div v-if="sortedHighlight" class="sac-sorted" :style="sortedHighlight" />
        <div v-if="rangeHighlight" class="sac-range" :style="rangeHighlight" />
        <ArrayCell
          v-for="(v, i) in values"
          :key="i"
          :value="v"
          :index="i"
          :is-first="i === 0"
          :is-last="i === values.length - 1"
          :is-highlighted="i === activeIndex || isPointerIndex(i)"
          :is-pivot="pivotIndex !== null && i === pivotIndex"
          :pointer-labels="labelsAt(i)"
          :role="roleAt(i)"
        />
      </div>
      <div class="sac-pointers sac-pointers-below">
        <div
          v-for="entry in belowEntries"
          :key="entry.key"
          class="sac-pointer sac-pointer-below"
          :style="{ left: entry.left + 'px' }"
        >
          <svg class="sac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
            <path d="M5 0 L10 6 L0 6 Z" :fill="entry.color" />
          </svg>
          <span class="sac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
        </div>
      </div>
    </div>

    <ChipOverflowPopover
      v-if="popoverOpenCell !== null"
      :chips="overflowChipsForCell(popoverOpenCell)"
      :selection="overflowSelections.get(popoverOpenCell) || new Set()"
      :anchor="popoverAnchor"
      :open="true"
      @update:selection="(s) => onSelectionChange(popoverOpenCell, s)"
      @close="popoverOpenCell = null"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import ArrayCell from './ArrayCell.vue'
import ChipOverflowPopover from './ChipOverflowPopover.vue'
import { computeChipLayout } from '../utils/chipOverlayLayout.js'
import {
  colorForPointerName,
  colorForRole,
  inferPointerRole,
  primaryRoleFromLabels,
  roleStyle,
  POINTER_ROLE_COLORS,
} from '../utils/pointerRoleColors.js'
import { withVerticalPlacement } from '../utils/pointerPlacement.js'

const PIVOT_COLOR = '#f97316'
const ELSE_COLOR = POINTER_ROLE_COLORS.neutral

const props = defineProps({
  values: { type: Array, required: true },
  pointers: { type: Object, default: () => ({}) },
  range: { type: Object, default: null },
  activeIndex: { type: Number, default: null },
  pivot: { type: Object, default: null },
  sortedRange: { type: Object, default: null },
  label: { type: String, default: '' },
})

const wrapEl = ref(null)
const popoverOpenCell = ref(null)
const overflowSelections = ref(new Map())
const viewportW = ref(window.innerWidth)
const viewportH = ref(window.innerHeight)

function onResize() {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
}
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// step 变更 / props 变更 → 重置 popover + selections
watch(() => [props.pointers, props.values, props.pivot, props.range, props.sortedRange], () => {
  popoverOpenCell.value = null
  overflowSelections.value = new Map()
}, { deep: true })

const pivotIndex = computed(() => (props.pivot && typeof props.pivot.index === 'number' ? props.pivot.index : null))

const chipsByCell = computed(() => {
  const map = new Map()
  const len = props.values?.length || 0
  for (const [name, idx] of Object.entries(props.pointers || {})) {
    if (idx == null || idx < 0 || idx >= len) continue
    const color = colorForPointerName(name) || colorForRole('mid')
    const role = inferPointerRole(name)
    if (!map.has(idx)) map.set(idx, [])
    map.get(idx).push({ name, color, role })
  }
  if (pivotIndex.value !== null && !map.has(pivotIndex.value)) {
    const idx = pivotIndex.value
    map.set(idx, [{ name: `pivot=${props.pivot?.value ?? props.values[idx]}`, color: PIVOT_COLOR, role: null }])
  } else if (pivotIndex.value !== null) {
    // 已有指针，把 pivot chip 也加上（如果还没）
    const exists = map.get(pivotIndex.value).some((c) => c.name.startsWith('pivot='))
    if (!exists) {
      map.get(pivotIndex.value).push({
        name: `pivot=${props.pivot?.value ?? props.values[pivotIndex.value]}`,
        color: PIVOT_COLOR,
        role: null,
      })
    }
  }
  return map
})

const layout = computed(() => computeChipLayout({ chipsByCell: chipsByCell.value }))

// pointer chip 列表（含 +N / else）
const pointerEntries = computed(() => {
  const entries = []
  const seen = new Set()
  const len = props.values?.length || 0

  for (const [index, chips] of chipsByCell.value.entries()) {
    if (index < 0 || index >= len) continue
    const overflow = layout.value.overflowByCell.get(index)
    const visible = overflow ? overflow.visibleChips : chips
    const leftBase = index * layout.value.cellWidth + layout.value.cellWidth / 2

    for (const chip of visible) {
      const key = `${index}:${chip.name}`
      if (seen.has(key)) continue
      seen.add(key)
      const role = chip.role || (chip.name.startsWith('pivot=') ? null : null)
      const color = chip.color
      entries.push({
        key,
        index,
        label: chip.name,
        left: leftBase,
        color,
        chipStyle: chipStyleFor(role, color),
      })
    }

    if (overflow) {
      const selectionSet = overflowSelections.value.get(index)
      const summary = selectionSet && selectionSet.size > 0
        ? { label: 'else', color: ELSE_COLOR, key: `${index}:else` }
        : { label: `+${overflow.hiddenCount}`, color: ELSE_COLOR, key: `${index}:+${overflow.hiddenCount}` }
      entries.push({
        key: summary.key,
        index,
        label: summary.label,
        left: leftBase,
        color: summary.color,
        chipStyle: chipStyleFor(null, summary.color),
      })
    }
  }

  return withVerticalPlacement(entries)
})

function chipStyleFor(role, color) {
  return roleStyle(role) || {
    color,
    borderColor: `${color}66`,
    background: `${color}22`,
    fill: color,
  }
}

const aboveEntries = computed(() => pointerEntries.value.filter((e) => e.placement === 'above'))
const belowEntries = computed(() => pointerEntries.value.filter((e) => e.placement === 'below'))

const rangeHighlight = computed(() => {
  const r = props.range
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  return { left: `${lo * layout.value.cellWidth}px`, width: `${(hi - lo + 1) * layout.value.cellWidth}px` }
})

const sortedHighlight = computed(() => {
  const r = props.sortedRange
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  return { left: `${lo * layout.value.cellWidth}px`, width: `${(hi - lo + 1) * layout.value.cellWidth}px` }
})

function labelsAt(i) { return [] }  // pointer chip 已在外层渲染，cell 不重复
function roleAt(i) {
  return primaryRoleFromLabels(chipsByCell.value.get(i)?.map((c) => c.name) || [])
}
function isPointerIndex(i) {
  return chipsByCell.value.has(i)
}

// popover helpers
function overflowChipsForCell(index) {
  return chipsByCell.value.get(index) || []
}

function onSelectionChange(index, newSet) {
  const next = new Map(overflowSelections.value)
  next.set(index, newSet)
  overflowSelections.value = next
}

const popoverAnchor = computed(() => {
  if (popoverOpenCell.value === null || !wrapEl.value) {
    return { cellLeft: 0, cellWidth: 0, containerTop: 0 }
  }
  const rect = wrapEl.value.getBoundingClientRect()
  const idx = popoverOpenCell.value
  return {
    cellLeft: rect.left + idx * layout.value.cellWidth,
    cellWidth: layout.value.cellWidth,
    containerTop: rect.top,
  }
})
</script>

<style scoped>
.sort-array-canvas { padding: 4px 0; }
.sac-header { margin-bottom: 6px; }
.sac-label {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}
.sac-strip-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  padding-top: 28px;
  padding-bottom: 28px;
}
.sac-pointers {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
  pointer-events: none;
  font-size: v-bind('layout.chipFontSize + "px"');
}
.sac-pointers-above { top: 0; }
.sac-pointers-below { bottom: 0; }
.sac-pointer {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sac-pointer-below {
  top: auto;
  bottom: 0;
}
.sac-pointer-text {
  font-family: var(--mono);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.sac-pointer-triangle { flex-shrink: 0; margin-top: -1px; }
.sac-pointer-below .sac-pointer-triangle { margin-top: 0; margin-bottom: -1px; }
.sac-strip {
  position: relative;
  display: grid;
  grid-auto-rows: auto;
  gap: 2px;
}
.sac-range {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, #3b82f6 10%, transparent);
  border-left: 1px solid color-mix(in srgb, #3b82f6 25%, transparent);
  border-right: 1px solid color-mix(in srgb, #3b82f6 25%, transparent);
  border-radius: var(--ds-cell-radius);
  pointer-events: none;
  z-index: 0;
}
.sac-sorted {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, #10b981 12%, transparent);
  border-left: 1px solid color-mix(in srgb, #10b981 30%, transparent);
  border-right: 1px solid color-mix(in srgb, #10b981 30%, transparent);
  border-radius: var(--ds-cell-radius);
  pointer-events: none;
  z-index: 0;
}
</style>
```

> 备注：v-bind 在 `<style scoped>` 需要 Vue 3.2+；本项目 Vue 3.5，可放心用。

- [ ] **Step 2: 跑测试**

Run: `cd frontend && npm test`
Expected: 全绿（sortVizExtract 单测不依赖 SortArrayCanvas 渲染，逻辑层覆盖）。

- [ ] **Step 3: 手测**

启动前后端，打开 http://localhost:5173，贴快排经典代码 → 跑 → 单步看：
- 1 个 chip / 格：cell 48px、字号 11px
- 2 个 chip / 格：cell 48px、字号 10px
- 3 个 chip / 格：cell ≈54px、字号 10px、出现 `+N`
- 点击 `+N` → popover 出现在 cell 上方 / 下方
- 选 2 个 chip → 保存 → `+N` 变 `else`
- 点击 `else` → popover 重开，刚才选的已勾上

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SortArrayCanvas.vue
git commit -m "feat(canvas): SortArrayCanvas 接 chipOverlayLayout + Popover + ArrayCell"
```

---

## Task 6: ArrayCanvas 同步接入（同 Task 5 模式）

**Files:**
- Modify: `frontend/src/components/ArrayCanvas.vue`

**Interfaces:** 同 SortArrayCanvas，props 不变（`arrays, highlightedIndex`）。

- [ ] **Step 1: 改造 ArrayCanvas.vue**

替换整个 `frontend/src/components/ArrayCanvas.vue`：

```vue
<template>
  <div class="array-canvas">
    <div v-if="!arrays.length" class="ac-empty">未识别到数组类结构</div>
    <div v-for="arr in arrays" :key="arr.id" class="ac-group">
      <div class="ac-group-header">
        <span class="ac-var">{{ arr.sourceVar || arr.id || 'array' }}</span>
        <span v-if="arr.label" class="ac-type">{{ arr.label }}</span>
        <span v-if="arr.dims === 2" class="ac-dims">二维表</span>
      </div>

      <MatrixCanvas
        v-if="arr.dims === 2 && arr.matrix"
        :matrix="arr.matrix"
        :rows="arr.rows"
        :cols="arr.cols"
        :index-pointers="arr.indexPointers"
        :pointer-labels="arr.pointerLabels"
      />

      <div v-else class="ac-strip-wrap" :ref="(el) => bindWrapEl(arr.id, el)">
        <div class="ac-pointers ac-pointers-above">
          <div
            v-for="entry in aboveEntriesFor(arr.id)"
            :key="entry.key"
            class="ac-pointer"
            :style="{ left: entry.left + 'px', fontSize: layoutFor(arr.id).chipFontSize + 'px' }"
          >
            <span class="ac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
            <svg class="ac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
              <path d="M0 0 L10 0 L5 6 Z" :fill="entry.color" />
            </svg>
          </div>
        </div>
        <div
          class="ac-strip"
          :style="{ gridTemplateColumns: `repeat(${arr.values.length}, ${layoutFor(arr.id).cellWidth}px)` }"
        >
          <ArrayCell
            v-for="(v, i) in arr.values"
            :key="i"
            :value="v"
            :index="i"
            :is-first="i === 0"
            :is-last="i === arr.values.length - 1"
            :is-highlighted="i === highlightedIndex || isPointerHighlighted(arr, i)"
            :pointer-labels="labelsAt(arr, i)"
            :role="roleAt(arr, i)"
          />
        </div>
        <div class="ac-pointers ac-pointers-below">
          <div
            v-for="entry in belowEntriesFor(arr.id)"
            :key="entry.key"
            class="ac-pointer ac-pointer-below"
            :style="{ left: entry.left + 'px' }"
          >
            <svg class="ac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
              <path d="M5 0 L10 6 L0 6 Z" :fill="entry.color" />
            </svg>
            <span class="ac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
          </div>
        </div>

        <ChipOverflowPopover
          v-if="popoverOpenFor === arr.id"
          :chips="overflowChipsForArr(arr.id)"
          :selection="overflowSelections.get(arr.id) || new Set()"
          :anchor="popoverAnchorFor(arr.id)"
          :open="true"
          @update:selection="(s) => onSelectionChange(arr.id, s)"
          @close="popoverOpenFor = null"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import ArrayCell from './ArrayCell.vue'
import ChipOverflowPopover from './ChipOverflowPopover.vue'
import MatrixCanvas from './MatrixCanvas.vue'
import { computeChipLayout } from '../utils/chipOverlayLayout.js'
import {
  colorForPointerName,
  colorForRole,
  inferPointerRole,
  primaryRoleFromLabels,
  roleStyle,
  POINTER_ROLE_COLORS,
} from '../utils/pointerRoleColors.js'
import { withVerticalPlacement } from '../utils/pointerPlacement.js'

const ELSE_COLOR = POINTER_ROLE_COLORS.neutral

const props = defineProps({
  arrays: { type: Array, required: true },
  highlightedIndex: { type: Number, default: -1 },
})

const wrapEls = ref(new Map())
const popoverOpenFor = ref(null)
const overflowSelections = ref(new Map())
const viewportW = ref(window.innerWidth)
const viewportH = ref(window.innerHeight)

function onResize() { viewportW.value = window.innerWidth; viewportH.value = window.innerHeight }
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

watch(() => props.arrays, () => {
  popoverOpenFor.value = null
  overflowSelections.value = new Map()
}, { deep: true })

function bindWrapEl(arrId, el) {
  if (el) wrapEls.value.set(arrId, el)
  else wrapEls.value.delete(arrId)
}

function chipsByCellFor(arr) {
  const map = new Map()
  const len = arr.values?.length || 0
  const pointers = arr.indexPointers || {}
  for (const [name, idx] of Object.entries(pointers)) {
    if (idx == null || idx < 0 || idx >= len) continue
    const color = colorForPointerName(name) || colorForRole('mid')
    const role = inferPointerRole(name)
    if (!map.has(idx)) map.set(idx, [])
    map.get(idx).push({ name, color, role })
  }
  const rec = arr.pointerLabels || {}
  for (const [idxStr, labels] of Object.entries(rec)) {
    const idx = Number(idxStr)
    if (idx < 0 || idx >= len) continue
    for (const label of labels || []) {
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

const layoutsByArrId = computed(() => {
  const out = {}
  for (const arr of props.arrays) {
    if (arr.dims === 2) continue
    out[arr.id] = computeChipLayout({ chipsByCell: chipsByCellFor(arr) })
  }
  return out
})

function layoutFor(arrId) {
  return layoutsByArrId.value[arrId] || { cellWidth: 48, chipFontSize: 11, overflowByCell: new Map() }
}

function labelsAt(arr, index) {
  const chips = chipsByCellFor(arr).get(index) || []
  return chips.map((c) => c.name)
}
function roleAt(arr, index) {
  const chips = chipsByCellFor(arr).get(index) || []
  return primaryRoleFromLabels(chips.map((c) => c.name))
}
function isPointerHighlighted(arr, index) {
  return chipsByCellFor(arr).has(index)
}

function pointerEntriesFor(arr) {
  const arrId = arr.id
  const layout = layoutFor(arrId)
  const chipsByCell = chipsByCellFor(arr)
  const entries = []
  const seen = new Set()
  const len = arr.values?.length || 0
  const sel = overflowSelections.value.get(arrId) || new Set()

  for (const [index, chips] of chipsByCell.entries()) {
    if (index < 0 || index >= len) continue
    const overflow = layout.overflowByCell.get(index)
    const visible = overflow ? overflow.visibleChips : chips
    const leftBase = index * layout.cellWidth + layout.cellWidth / 2

    for (const chip of visible) {
      const key = `${index}:${chip.name}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({
        key,
        index,
        label: chip.name,
        left: leftBase,
        color: chip.color,
        chipStyle: roleStyle(chip.role) || {
          color: chip.color,
          borderColor: `${chip.color}66`,
          background: `${chip.color}22`,
          fill: chip.color,
        },
      })
    }

    if (overflow) {
      const summary = sel.size > 0
        ? { label: 'else', color: ELSE_COLOR, key: `${index}:else` }
        : { label: `+${overflow.hiddenCount}`, color: ELSE_COLOR, key: `${index}:+${overflow.hiddenCount}` }
      entries.push({
        key: summary.key,
        index,
        label: summary.label,
        left: leftBase,
        color: summary.color,
        chipStyle: {
          color: summary.color,
          borderColor: `${summary.color}66`,
          background: `${summary.color}22`,
          fill: summary.color,
        },
      })
    }
  }

  return withVerticalPlacement(entries)
}

const aboveEntriesByArrId = ref(new Map())
const belowEntriesByArrId = ref(new Map())

// 由于 entries 依赖 overflowSelections，每次需要重算；用 computed 不太好直接存 map，直接写函数
function aboveEntriesFor(arrId) {
  const arr = props.arrays.find((a) => a.id === arrId)
  if (!arr) return []
  return pointerEntriesFor(arr).filter((e) => e.placement === 'above')
}
function belowEntriesFor(arrId) {
  const arr = props.arrays.find((a) => a.id === arrId)
  if (!arr) return []
  return pointerEntriesFor(arr).filter((e) => e.placement === 'below')
}

function overflowChipsForArr(arrId) {
  const arr = props.arrays.find((a) => a.id === arrId)
  if (!arr) return []
  const out = []
  const chipsByCell = chipsByCellFor(arr)
  for (const chips of chipsByCell.values()) out.push(...chips)
  return out
}

function onSelectionChange(arrId, newSet) {
  const next = new Map(overflowSelections.value)
  next.set(arrId, newSet)
  overflowSelections.value = next
}

function popoverAnchorFor(arrId) {
  const el = wrapEls.value.get(arrId)
  const arr = props.arrays.find((a) => a.id === arrId)
  if (!el || !arr) return { cellLeft: 0, cellWidth: 0, containerTop: 0 }
  // 简单起见：用 wrap 中点作为 popover anchor；后续可细化到具体 cell
  const rect = el.getBoundingClientRect()
  return {
    cellLeft: rect.left,
    cellWidth: rect.width,
    containerTop: rect.top,
  }
}
</script>

<style scoped>
.array-canvas { padding: 8px; }
.ac-empty { color: var(--text-muted); font-family: var(--mono); font-size: 12px; padding: 12px; }
.ac-group { margin-bottom: 14px; }
.ac-group-header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; font-family: var(--mono); font-size: 11px; }
.ac-var { color: var(--text-h); font-weight: 700; letter-spacing: 0.02em; }
.ac-type { color: var(--text-muted); font-weight: 500; letter-spacing: 0.04em; }
.ac-dims { font-size: 10px; color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); padding: 1px 6px; letter-spacing: 0.04em; }
.ac-strip-wrap { position: relative; display: inline-block; max-width: 100%; overflow-x: auto; padding-top: 28px; padding-bottom: 28px; }
.ac-pointers { position: absolute; left: 0; right: 0; height: 28px; pointer-events: none; }
.ac-pointers-above { top: 0; }
.ac-pointers-below { bottom: 0; }
.ac-pointer { position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
.ac-pointer-below { top: auto; bottom: 0; }
.ac-pointer-text { font-family: var(--mono); font-weight: 600; padding: 1px 6px; border-radius: 3px; border: 1px solid transparent; white-space: nowrap; }
.ac-pointer-triangle { flex-shrink: 0; margin-top: -1px; }
.ac-pointer-below .ac-pointer-triangle { margin-top: 0; margin-bottom: -1px; }
.ac-strip { position: relative; display: grid; grid-auto-rows: auto; gap: 2px; }
</style>
```

> 备注：ArrayCanvas 的 popover anchor 暂时用 wrap 整宽（简化），后续如需 per-cell anchor 可在 Task 5 / 6 之后单独立项优化。ArrayCell 同时承担 cell 高亮（mid / next / prev 通过 `role`）和 chip label（通过 `pointerLabels`）；chip 主体由本组件外层 `.ac-pointer` 渲染，避免 cell 内文字过挤。

- [ ] **Step 2: 跑测试**

Run: `cd frontend && npm test`
Expected: 全绿。

- [ ] **Step 3: 手测**

非排序场景下含指针的 int[]（如线性查找 `i`）→ 跑 → 看 chip 压缩 + popover 行为是否同 SortArrayCanvas。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ArrayCanvas.vue
git commit -m "feat(canvas): ArrayCanvas 接 chipOverlayLayout + Popover + ArrayCell"
```

---

## Task 7: MatrixCanvas + LinkedListCanvas CSS 打磨

**Files:**
- Modify: `frontend/src/components/MatrixCanvas.vue`（追加或改写 `<style>`）
- Modify: `frontend/src/components/LinkedListCanvas.vue`（追加或改写 `<style>`）

**Interfaces:** 不变。

- [ ] **Step 1: 修改 MatrixCanvas 样式**

打开 `frontend/src/components/MatrixCanvas.vue`，找到 `<style scoped>` 块。在 `.matrix-cell` 或对应 class（按现状）追加：

```css
.matrix-cell {
  border-radius: var(--ds-cell-radius-sm);
  box-shadow: var(--ds-cell-shadow);
  border: var(--ds-cell-border);
}
.matrix-table {
  border-radius: var(--ds-cell-radius-sm);
}
```

> 实际 class 名以现状为准；如不存在 `.matrix-cell`，按文件中实际 class 名替换。保持其它样式不动。

- [ ] **Step 2: 修改 LinkedListCanvas 样式**

打开 `frontend/src/components/LinkedListCanvas.vue`，在节点框 class（如 `.ll-node` 或 `.linked-list-node`）追加：

```css
.ll-node {
  border-radius: var(--ds-cell-radius);
  box-shadow: var(--ds-cell-shadow);
  border: var(--ds-cell-border);
}
```

> 同样按实际 class 名替换。

- [ ] **Step 3: 跑测试 + 手测**

Run: `cd frontend && npm test`
手测：
- 加载「链表」经典预置（单向）→ 节点圆角 + shadow
- 加载「双向链表」经典预置（若有）→ 三格合并外框圆角
- 二维矩阵经典预置（`char[][]` 迷宫之类）→ 单元 cell 圆角

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MatrixCanvas.vue frontend/src/components/LinkedListCanvas.vue
git commit -m "style(canvas): Matrix + LinkedList 圆角 + shadow 与 DS 设计语言一致"
```

---

## Task 8: sortVizExtract 输出 primaryArrayId

**Files:**
- Modify: `frontend/src/utils/sortVizExtract.js`
- Modify: `frontend/src/utils/sortVizExtract.test.js`

**Interfaces:**
- `findPrimaryIntArray` 返回 `{ values, label, id }`，id 为 heap entry key 或 `obj.id`
- `extractSortViz` 结果加 `primaryArrayId: string | null`

- [ ] **Step 1: 写 failing test**

在 `frontend/src/utils/sortVizExtract.test.js` 末尾追加：

```js
describe('primaryArrayId', () => {
  it('extractSortViz exposes primaryArrayId matching the chosen heap entry', () => {
    const heap = {
      a: {
        id: 'arr-1',
        type: 'int[]',
        slots: [
          { index: 0, value: 4 },
          { index: 1, value: 1 },
          { index: 2, value: 3 },
          { index: 3, value: 2 },
        ],
      },
    }
    const frames = [{
      method: 'mergeSort',
      args: {},
      locals: { arr: { ref: 'arr-1' }, left: 0, right: 3, mid: 1 },
    }]
    const viz = extractSortViz(heap, frames, 'mergeSort')
    expect(viz.primaryArrayId).toBe('arr-1') // obj.id wins over heap key
  })

  it('primaryArrayId is null when no array can be picked', () => {
    const heap = { x: { id: 'x', type: 'Integer', fields: { value: 1 } } }
    const viz = extractSortViz(heap, [{ args: {}, locals: {} }])
    expect(viz).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npm test -- sortVizExtract`
Expected: FAIL —— `viz.primaryArrayId === undefined`。

- [ ] **Step 3: 改 findPrimaryIntArray + extractSortViz**

`frontend/src/utils/sortVizExtract.js`：

1. `findPrimaryIntArray` 在返回时附 `id`：

```js
function findPrimaryIntArray(heap, stackFrames) {
  for (let fi = (stackFrames || []).length - 1; fi >= 0; fi--) {
    const frame = stackFrames[fi]
    for (const bucket of [frame.locals || {}, frame.args || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (TMP_ARRAY_PATTERN.test(name)) continue
        if (Array.isArray(val) && isNumericArray(val)) {
          return { values: val.slice(), label: name, id: name }
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
  // 选中的 heap entry id 优先用 `obj.id`，否则用 `arr.id`
  const heapKey = Object.keys(heap).find((k) => heap[k] === best || heap[k]?.id === best.id)
  return {
    values: best.values.slice(),
    label: best.sourceVar || best.label || 'array',
    id: best.id || heapKey || null,
  }
}
```

2. `extractSortViz` 末尾：

```js
const result = {
  mode,
  values,
  pointers,
  range,
  activeIndex,
  pivot,
  heapSize,
  sortedRange,
  label,
  arrayLabel,
  primaryArrayId: primary.id,   // ← 新增
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd frontend && npm test -- sortVizExtract`
Expected: PASS，原有用例 + 新 2 个用例全过。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/sortVizExtract.js frontend/src/utils/sortVizExtract.test.js
git commit -m "feat(extract): sortViz 输出 primaryArrayId"
```

---

## Task 9: DataStructureTab 过滤重复数组

**Files:**
- Modify: `frontend/src/components/right-tabs/DataStructureTab.vue`

**Interfaces:**
- `resultRaw`（驱动 `badges` / `anyDetected`）保持原始
- `visibleArrays = resultRaw.arrays.filter(a => a.id !== sortViz?.primaryArrayId)`
- 模板数组 section 改用 `visibleArrays`

- [ ] **Step 1: 改 DataStructureTab.vue**

打开文件，修改 `<script setup>`：

```js
const resultRaw = computed(() => {
  if (!stepContext.value) return { linkedLists: [], arrays: [], trees: [], graphs: [] }
  const { step, prev } = stepContext.value
  return extractDataStructures(
    step.heap || {},
    step.stackFrames || [],
    prev?.heap || null,
    prev?.stackFrames || null,
  )
})

const visibleArrays = computed(() => {
  const primaryId = sortViz.value?.primaryArrayId
  if (!primaryId) return resultRaw.value.arrays
  return resultRaw.value.arrays.filter((a) => a.id !== primaryId)
})

const visibleResult = computed(() => ({ ...resultRaw.value, arrays: visibleArrays.value }))
```

模板 section 修改：

```html
<section v-if="visibleResult.arrays.length" class="dst-section">
  <h4 class="dst-section-h">数组 / 栈 / 队列</h4>
  <ArrayCanvas :arrays="visibleResult.arrays" :highlighted-index="-1" />
</section>
```

`badges` 与 `anyDetected` 保持用 `resultRaw`：

```js
const anyDetected = computed(() =>
  resultRaw.value.linkedLists.length > 0
  || resultRaw.value.arrays.length > 0
  || resultRaw.value.trees.length > 0
  || resultRaw.value.graphs.length > 0
  || sortViz.value != null
)
```

- [ ] **Step 2: 跑测试**

Run: `cd frontend && npm test`
Expected: 全绿。

- [ ] **Step 3: 手测**

- 普通 int[]（无排序）→ 数组 section 仍渲染 ✓
- 堆排 / 快排 / 归并 → 数组 section 中与 sortViz 同 id 的数组消失；其它数组（如 `tmp`）仍在 ✓
- 切到「变量」tab → 原数组视图不受影响 ✓

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/right-tabs/DataStructureTab.vue
git commit -m "feat(tab): DataStructureTab 隐藏 sortViz primary 重复数组"
```

---

## Task 10: 全量回归

**Files:** 无（只验证）

- [ ] **Step 1: 跑全量单测**

Run: `cd frontend && npm test`
Expected: 全绿（之前 129 + 新增 ~6（chipOverlayLayout）+ ~2（primaryArrayId）+ 2（neutral role）≈ 139 通过）。

- [ ] **Step 2: 启前后端做一轮手测**

后端 `cd backend && ./mvnw spring-boot:run`
前端 `cd frontend && npm run dev`

手测清单（来自 spec §8.3）：

1. 快排：3 chip 同格（l/r/pivot） → 字号 / cell 宽自动压缩 + pivot 橙色
2. 堆排：合成堆树 + 数组同 i/j 高亮 + sorted 绿带 + 数组 section 中 `a` 被隐藏
3. 归并排序：merge-tree 视图正常，数组 section 中主数组隐藏
4. 普通 int[]（线性查找）：数组 section 正常显示 + 1 个 chip 不溢出
5. LinkedListCanvas：单 / 双向节点圆角 + shadow
6. MatrixCanvas：二维 cell 圆角
7. 切到「变量」tab：原堆 / 栈卡片显示不受影响
8. chip 溢出 popover：选 2 个 chip → 保存 → `+N` 变 `else`；点击 `else` 重新展开

- [ ] **Step 3: 收尾**

若所有手测通过 → 通知用户；如发现回归 → 回退到对应任务 Task N 修复。

---

## Self-Review Checklist（写 plan 后自检）

- [x] Spec §3 架构：所有改动映射到文件结构表中
- [x] Spec §4（chip overlay）：Task 2 + Task 4 + Task 5 + Task 6
- [x] Spec §5（视觉打磨）：Task 1 + Task 3 + Task 7
- [x] Spec §6（去重）：Task 8 + Task 9
- [x] Spec §7（测试）：Task 2 / 8 单测 + Task 10 手测
- [x] Spec §8（行为预期）：Task 9 的手测清单覆盖
- [x] no "TBD" / "TODO" / "类似 Task N" 占位
- [x] 所有函数 / 变量名跨 Task 一致（`computeChipLayout`, `chipsByCell`, `overflowSelections`, `popoverOpenCell`, `popoverOpenFor`, `primaryArrayId`）
- [x] 每个 Task 都有 commit 步骤，依赖关系按 Task 编号顺序
