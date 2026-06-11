<template>
  <div class="variable-panel">
    <div class="mb-3">
      <h4 class="text-lg font-semibold">变量卡片</h4>
      <p class="text-sm" style="color: var(--text-muted)">只读展示当前步骤变量，值变化会短暂高亮。</p>
    </div>

    <div v-if="displayKeys.length === 0 && liveLLGroups.length === 0" class="text-sm" style="color: var(--text-muted)">暂无变量</div>

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

      <!-- Linked Lists: live-tracked — panels persist while list nodes exist in heap -->
      <div v-for="group in liveLLGroups" :key="group.key" :data-key="group.key" class="card p-3 mb-3" :class="{ flash: flashKeys[group.key] }">
        <div class="ll-header" @click="toggleLinkedListCollapse(group.key)">
          <div class="flex items-center gap-2">
            <span class="ll-dot" />
            <span class="text-sm font-semibold" style="color: var(--text-h)">{{ group.displayName }} (链表)</span>
            <span class="text-xs" style="color: var(--text-muted)">{{ group.nodes.length }} 个节点</span>
          </div>
          <svg
            class="ll-chevron"
            :class="{ rotated: !collapsedLinkedLists[group.key] }"
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-show="!collapsedLinkedLists[group.key]" class="mt-3">
          <LinkedListCanvas
            v-if="group.nodes.length > 0"
            :nodes="group.nodes"
            :pointerLabels="group.pointerLabels"
          />
          <div v-else class="text-xs" style="color: var(--text-muted); padding: 8px 0; text-align: center;">（当前步骤链表为空）</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, watch, nextTick } from 'vue'
import ArrayCanvas from './ArrayCanvas.vue'
import LinkedListCanvas from './LinkedListCanvas.vue'

import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const variables = computed(() => store.currentVariables || {})
const heap = computed(() => store.currentHeap || {})

const displayKeys = computed(() => Object.keys(variables.value).filter(k => k !== 'args' && k !== '_recursionStack_' && k !== 'recursionStack'))

// ===== Live tracking: panels persist while data still exists =====
// Once a linked-list/recursion-stack appears, keep it until the backend
// confirms the data is truly gone (root ref no longer in heap).

// Linked-list live state: key → { displayName, headRef, nodes, pointerLabels }
const liveLLMap = reactive(new Map())

// Reset on new run
watch(() => store.runId, () => {
  liveLLMap.clear()
})

// --- Linked list: ALL nodes in ONE panel, no component splitting ---
// 算法（反转、删除等）会临时断链再重连。如果按连通分量拆面板，
// 每次断连都多出一个面板。正解：所有链表节点始终放在一个面板里。
const LL_KEY = '_ll'  // constant identity — always one panel

const linkedListGroups = computed(() => {
  const h = heap.value
  const vars = variables.value
  if (!h || Object.keys(h).length === 0) return []

  // Collect all linked-list-typed nodes from heap (val + next present in fields)
  const allNodeRefs = new Set()
  for (const ref of Object.keys(h)) {
    const entry = h[ref]
    const f = entry.fields || entry
    if (f.hasOwnProperty('val') && f.hasOwnProperty('next')) {
      allNodeRefs.add(ref)
    }
  }
  if (allNodeRefs.size === 0) return []

  // Map variables to the heap refs they point to
  const refToVarNames = {}
  for (const key of displayKeys.value) {
    const val = vars[key]
    if (typeof val !== 'string') continue
    if (!allNodeRefs.has(val)) continue
    if (!refToVarNames[val]) refToVarNames[val] = []
    refToVarNames[val].push(key)
  }
  if (Object.keys(refToVarNames).length === 0) return []

  // Build pointerLabels for every node that has a variable pointing at it
  const pointerLabels = {}
  const allVarNames = []
  for (const ref of allNodeRefs) {
    const names = refToVarNames[ref]
    if (names && names.length > 0) {
      pointerLabels[ref] = names
      for (const n of names) { if (!allVarNames.includes(n)) allVarNames.push(n) }
    }
  }

  // Helper: get next ref from a heap entry (handles both {ref: "h1"} and flat string)
  const getNextRef = (entry) => {
    const n = (entry.fields || entry).next
    if (!n) return null
    return typeof n === 'string' ? n : n.ref
  }

  // Find head refs: nodes NOT pointed to by any other node's next pointer
  const pointedTo = new Set()
  for (const ref of allNodeRefs) {
    const nextRef = getNextRef(h[ref])
    if (nextRef && allNodeRefs.has(nextRef)) {
      pointedTo.add(nextRef)
    }
  }
  let headRefs = [...allNodeRefs].filter(ref => !pointedTo.has(ref))

  // Cycle case: every node is pointed to — pick a variable-referenced node as entry
  const isCycle = headRefs.length === 0 && allNodeRefs.size > 0
  if (isCycle) {
    const varRefs = Object.keys(refToVarNames)
    if (varRefs.length > 0) headRefs = [varRefs[0]]
    else headRefs = [[...allNodeRefs][0]]
  }

  // Build ordered node list: follow next from each head ref
  const nodes = []
  const visited = new Set()
  for (const headRef of headRefs) {
    let ref = headRef
    while (ref && h[ref] && !visited.has(ref)) {
      visited.add(ref)
      const entry = h[ref]
      const fields = entry.fields || entry
      nodes.push({ id: ref, val: fields.val, next: getNextRef(entry) })
      ref = getNextRef(entry)
    }
    // If traversal stopped because next points back to an already-visited node,
    // mark that node as the cycle closure point
    if (ref && visited.has(ref)) {
      const cycleNode = nodes.find(n => n.id === ref)
      if (cycleNode) cycleNode._cycle = true
    }
  }

  // Display name: head variables first, then other pointer variables
  const headVarNames = []
  const otherVarNames = []
  for (const ref of Object.keys(refToVarNames)) {
    for (const n of refToVarNames[ref]) {
      if (headRefs.includes(ref)) {
        if (!headVarNames.includes(n)) headVarNames.push(n)
      } else {
        if (!otherVarNames.includes(n) && !headVarNames.includes(n)) otherVarNames.push(n)
      }
    }
  }
  const displayParts = [...headVarNames, ...otherVarNames]
  const displayName = displayParts.length > 0 ? displayParts.join(' · ') : '链表'

  return [{
    key: LL_KEY,
    displayName,
    headRef: headRefs[0] || null,
    nodes,
    pointerLabels,
  }]
})

// --- Live tracking watcher (simplified — key is always constant LL_KEY) ---
watch(linkedListGroups, (groups) => {
  if (groups.length === 0) {
    liveLLMap.clear()
    return
  }
  const g = groups[0]
  liveLLMap.set(g.key, { ...g })
}, { deep: true })

// liveLLGroups as array for template
const liveLLGroups = computed(() => [...liveLLMap.values()])

// Scalars: non-array, non-linked-list variables
const scalarKeys = computed(() => {
  const llVarNames = new Set()
  for (const g of liveLLGroups.value) {
    for (const names of Object.values(g.pointerLabels)) {
      for (const n of names) llVarNames.add(n)
    }
  }
  return displayKeys.value.filter(k => !Array.isArray(variables.value[k]) && !llVarNames.has(k))
})

const arrayKeys = computed(() => displayKeys.value.filter(k => Array.isArray(variables.value[k])))

const flashKeys = reactive({})
const valueFlashKeys = reactive({})
const changedIndicesMap = reactive({})
const compareIndicesMap = reactive({})
const collapsedKeys = reactive({})
const collapsedLinkedLists = reactive({})
const FLASH_MS = 520

function toggleCollapse(key) {
  collapsedKeys[key] = !collapsedKeys[key]
}

function toggleLinkedListCollapse(key) {
  collapsedLinkedLists[key] = !collapsedLinkedLists[key]
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
      if (!visible.has(k)) return
      const a = JSON.stringify(oldObj[k])
      const b = JSON.stringify(newObj[k])
      if (!isInitial && a !== b) {
        flashKeys[k] = true
        valueFlashKeys[k] = true
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
        nextTick(() => {
          try {
            const el = document.querySelector(`[data-key="${k}"]`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          } catch (e) { /* ignore selector issues */ }
        })
      }
    })
  },
  { deep: true }
)

watch([() => variables.value, () => arrayKeys.value], () => {
  try {
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
    if (typeof v === 'string' && heap.value && heap.value[v]) {
      const h = heap.value[v]
      return `${h.id || v} | val:${h.val}`
    }
    if (typeof v === 'string') return v
    if (Array.isArray(v)) return JSON.stringify(v)
    if (v && typeof v === 'object') return JSON.stringify(v, null, 2)
    return String(v)
  } catch (e) {
    return String(v)
  }
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
.scalar-card .var-name { color: var(--text); font-size: 13px }
.scalar-card .var-value { font-size: 17px }

.scalar-card.value-flash {
  border-color: var(--accent-border);
  box-shadow: 0 6px 14px rgba(37,99,235,0.10);
  transform: none;
}

.scalar-enter-from { transform: translateX(-16px); opacity: 0 }
.scalar-enter-active { transition: transform 320ms cubic-bezier(.22,.9,.27,1), opacity 320ms }
.scalar-leave-to { transform: translateX(12px); opacity: 0 }
.scalar-leave-active { transition: transform 280ms cubic-bezier(.22,.9,.27,1), opacity 280ms }

/* Linked List — collapsible header, same pattern as HeapStackPanel */
.ll-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.ll-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.8;
}
.ll-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.ll-chevron.rotated { transform: rotate(180deg) }

.card.flash {
  border-color: var(--accent-border);
  box-shadow: 0 6px 14px rgba(37,99,235,0.10);
}

@keyframes slideBar {
  from { transform: translateX(-6px); opacity: 0 }
  to { transform: translateX(0); opacity: 1 }
}
</style>
