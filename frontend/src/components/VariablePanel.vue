<template>
  <div class="variable-panel">
    <div class="mb-3">
      <h4 class="text-lg font-semibold">变量卡片</h4>
      <p class="text-sm" style="color: var(--text-muted)">只读展示当前步骤变量，值变化会短暂高亮。</p>
    </div>

    <div v-if="displayKeys.length === 0" class="text-sm" style="color: var(--text-muted)">暂无变量</div>

    <div v-else>
      <!-- Scalars: horizontal small cards -->
      <div v-if="scalarKeys.length" class="scalar-row card p-3 mb-3">
        <transition-group name="scalar" tag="div" class="scalars flex gap-3 overflow-auto">
          <div v-for="key in scalarKeys" :key="key" :data-key="key"
            class="scalar-card p-2 rounded border flex-shrink-0"
            style="background: var(--card-bg); border-color: var(--border)"
            :class="[{ flash: flashKeys[key] }, valueFlashKeys[key] ? 'value-flash' : '']">
            <div class="var-name text-xs" style="color: var(--text-muted)">{{ key }}</div>
            <div class="var-value font-semibold text-lg" style="color: var(--text-h)">{{ pretty(variables[key]) }}</div>
          </div>
        </transition-group>
      </div>

      <!-- Arrays: each occupies its own row, collapsible -->
      <div v-for="key in arrayKeys" :key="key" :data-key="key" class="array-row card p-3 rounded mb-3" :class="{ flash: flashKeys[key] }">
        <div class="flex items-center justify-between mb-2">
          <div class="font-medium text-sm" style="color: var(--text-h)">{{ key }} ({{ (variables[key] || []).length }} 项)</div>
          <button
            class="collapse-btn"
            @click="toggleCollapse(key)"
            :title="collapsedKeys[key] ? '展开' : '折叠'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              :style="{ transform: collapsedKeys[key] ? '' : 'rotate(180deg)', transition: 'transform 0.25s ease' }">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        <ArrayCanvas :arr="variables[key]" :changedIndices="changedIndicesMap[key] || []" :compareIndices="compareIndicesMap[key] || []" :collapsed="!!collapsedKeys[key]" />
      </div>

      <!-- Linked Lists: detect linked list structures -->
      <div v-for="key in linkedListKeys" :key="key" :data-key="key" class="linked-list-row card p-3 rounded mb-3" :class="{ flash: flashKeys[key] }">
        <div class="flex items-center justify-between mb-2">
          <div class="font-medium text-sm text-gray-800 dark:text-gray-100">{{ key }} (链表)</div>
        </div>
        <LinkedListCanvas 
          :nodes="getLinkedListNodes(variables[key])" 
          :highlightedNodeIds="getHighlightedNodes(key)"
          :compareNodeIds="getCompareNodes(key)"
        />
      </div>

      <!-- Recursion Stack: detect recursion stack structures -->
      <div v-if="recursionStack" class="recursion-stack-row card p-3 rounded mb-3" :class="{ flash: flashKeys['_recursionStack_'] }">
        <div class="flex items-center justify-between mb-2">
          <div class="font-medium text-sm text-gray-800 dark:text-gray-100">递归调用栈</div>
        </div>
        <RecursionStackCanvas 
          :stackFrames="recursionStack.frames || []"
          :activeFrameIndex="recursionStack.activeFrameIndex || 0"
          :returningFrameIndices="recursionStack.returningFrameIndices || []"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, watch, nextTick } from 'vue'
import ArrayCanvas from './ArrayCanvas.vue'
import LinkedListCanvas from './LinkedListCanvas.vue'
import RecursionStackCanvas from './RecursionStackCanvas.vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const variables = computed(() => store.currentVariables || {})
// Filter out internal or uninteresting names (e.g. the `args` parameter)

const displayKeys = computed(() => Object.keys(variables.value).filter(k => k !== 'args'))
const scalarKeys = computed(() => displayKeys.value.filter(k => !Array.isArray(variables.value[k]) && !isLinkedList(variables.value[k])))
const arrayKeys = computed(() => displayKeys.value.filter(k => Array.isArray(variables.value[k])))
const linkedListKeys = computed(() => displayKeys.value.filter(k => isLinkedList(variables.value[k])))

// Detect recursion stack structure
const recursionStack = computed(() => {
  const stackVar = variables.value._recursionStack_ || variables.value.recursionStack
  if (!stackVar || !Array.isArray(stackVar.frames)) return null
  return stackVar
})

const flashKeys = reactive({})
const valueFlashKeys = reactive({})
const changedIndicesMap = reactive({})
const compareIndicesMap = reactive({})
const collapsedKeys = reactive({})
const FLASH_MS = 520

function toggleCollapse(key) {
  collapsedKeys[key] = !collapsedKeys[key]
}

watch(
  variables,
  (newVal, oldVal) => {
    const newObj = newVal || {}
    const oldObj = oldVal || {}
    const all = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
    const isInitial = oldVal === undefined
    const visible = new Set(displayKeys.value || [])
    all.forEach((k) => {
      if (!visible.has(k)) return // 忽略未显示的变量（例如 args）
      const a = JSON.stringify(oldObj[k])
      const b = JSON.stringify(newObj[k])
      if (!isInitial && a !== b) {
        // 卡片整体特效 + 值局部高亮
        flashKeys[k] = true
        valueFlashKeys[k] = true
        // 如果是数组，计算逐项差异并高亮变更的索引
        try {
          const oldArr = Array.isArray(oldObj[k]) ? oldObj[k] : null
          const newArr = Array.isArray(newObj[k]) ? newObj[k] : null
          if (oldArr && newArr) {
            const max = Math.max(oldArr.length || 0, newArr.length || 0)
            const changed = []
            for (let i = 0; i < max; i++) {
              const oa = JSON.stringify(oldArr[i])
              const na = JSON.stringify(newArr[i])
              if (oa !== na) changed.push(i)
            }
            if (changed.length) {
              changedIndicesMap[k] = changed
              setTimeout(() => { changedIndicesMap[k] = [] }, FLASH_MS)
            }
          }
        } catch (e) { /* ignore diff errors */ }
        setTimeout(() => { flashKeys[k] = false }, FLASH_MS)
        setTimeout(() => { valueFlashKeys[k] = false }, FLASH_MS)
        // 让变化的卡片滚动到可见区域（可选）
        nextTick(() => {
          try {
            const el = document.querySelector(`[data-key="${k}"]`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          } catch (e) { /* ignore selector issues */ }
        })
      }
    })
  },
  { deep: true }
)

// Compute compare indices for arrays using common loop variable names (i,j)
watch([() => variables.value, () => arrayKeys.value], () => {
  try {
    // reset
    Object.keys(compareIndicesMap).forEach(k => { compareIndicesMap[k] = [] })
    const iVal = Number(variables.value.i)
    const jVal = Number(variables.value.j)
    arrayKeys.value.forEach((arrKey) => {
      const arr = variables.value[arrKey] || []
      const compares = []
      if (!Number.isNaN(iVal) && iVal >= 0 && iVal < arr.length) compares.push(iVal)
      if (!Number.isNaN(jVal) && jVal >= 0 && jVal < arr.length && jVal !== iVal) compares.push(jVal)
      if (compares.length) compareIndicesMap[arrKey] = compares
    })
  } catch (e) { /* ignore */ }
}, { immediate: true })

function pretty(v) {
  if (v === undefined) return ''
  try {
    if (typeof v === 'string') return v
    if (Array.isArray(v)) return JSON.stringify(v)
    if (v && typeof v === 'object') return JSON.stringify(v, null, 2)
    return String(v)
  } catch (e) {
    return String(v)
  }
}

// Helper: Check if a value is a linked list node
function isLinkedList(value) {
  if (!value || typeof value !== 'object') return false
  // Check if it has id, val, and next properties (linked list node structure)
  return value.hasOwnProperty('id') && value.hasOwnProperty('val') && value.hasOwnProperty('next')
}

// Helper: Convert linked list to array of nodes for visualization
function getLinkedListNodes(head) {
  if (!head) return []
  
  const nodes = []
  const visited = new Set()
  let current = head
  
  // Traverse the linked list
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    nodes.push({
      id: current.id,
      val: current.val,
      next: current.next
    })
    // If next is a string (node id), we need to find that node
    // For now, assume the backend provides the full chain
    if (typeof current.next === 'string') {
      // This would require the backend to provide all nodes
      // For MVP, we'll just show what we have
      break
    }
    current = current.next
  }
  
  return nodes
}

// Helper: Get highlighted nodes for a linked list variable
function getHighlightedNodes(key) {
  // Use common pointer variable names (current, prev, next, etc.)
  const pointerVars = ['current', 'prev', 'next', 'curr', 'head', 'tail', 'p', 'q']
  const highlighted = []
  
  pointerVars.forEach(varName => {
    const value = variables.value[varName]
    if (value && typeof value === 'object' && value.id) {
      highlighted.push(value.id)
    }
  })
  
  return highlighted
}

// Helper: Get compare nodes for a linked list variable
function getCompareNodes(key) {
  // Similar to highlighted but for comparison operations
  const compareVars = ['temp', 'node1', 'node2', 'first', 'second']
  const compared = []
  
  compareVars.forEach(varName => {
    const value = variables.value[varName]
    if (value && typeof value === 'object' && value.id) {
      compared.push(value.id)
    }
  })
  
  return compared
}
</script>

<style scoped>
.variable-panel pre { background: transparent; margin: 0; }
.card { position: relative; overflow: visible; transition: transform .18s ease, box-shadow .22s ease; }
.card .value-wrap pre { margin: 0; background: transparent; }
.card.flash {
  border-color: var(--accent-border);
  box-shadow: 0 6px 14px rgba(37,99,235,0.12);
  z-index: 2;
}

.value-flash {
  background: var(--accent-bg);
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
  color: var(--primary);
}

/* Scalars row */
.scalar-row { overflow-x: auto }
.scalars { display:flex; align-items:center; flex-wrap:wrap; gap:8px }
.scalar-card {
  min-width: 100px;
  max-width: 220px;
  border-radius: 10px;
  padding: 10px;
  display:flex;
  flex-direction:column;
  gap:6px;
  align-items:flex-start;
  transition: background 520ms cubic-bezier(.22,.9,.27,1), transform 320ms cubic-bezier(.22,.9,.27,1), box-shadow 320ms ease, opacity 200ms;
}
.scalar-card .var-name { color: var(--text); font-size: 12px }
.scalar-card .var-value { font-size: 16px }

/* Scalar value change — blue accent like array cell.changed */
.scalar-card.value-flash {
  border-color: var(--accent-border);
  box-shadow: 0 6px 14px rgba(37,99,235,0.10);
  transform: none;
}

/* enter from left, leave to right */
.scalar-enter-from { transform: translateX(-16px); opacity: 0 }
.scalar-enter-active { transition: transform 320ms cubic-bezier(.22,.9,.27,1), opacity 320ms }
.scalar-leave-to { transform: translateX(12px); opacity: 0 }
.scalar-leave-active { transition: transform 280ms cubic-bezier(.22,.9,.27,1), opacity 280ms }

/* Array row minor tweaks */
.array-row { background: transparent }

/* Linked List row */
.linked-list-row { background: transparent }

/* Recursion Stack row */
.recursion-stack-row { background: transparent }

/* When card flash: subtle border + shadow (avoid full background change) */
.card.flash {
  border-color: var(--accent-border);
  box-shadow: 0 6px 14px rgba(37,99,235,0.10);
}

@keyframes slideBar {
  from { transform: translateX(-6px); opacity: 0 }
  to { transform: translateX(0); opacity: 1 }
}
</style>
