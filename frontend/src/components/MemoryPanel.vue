<template>
  <div class="memory-panel card p-3 mb-3">
    <div class="mp-header" @click="isOpen = !isOpen">
      <div class="flex items-center gap-2">
        <span class="mp-dot" />
        <span class="text-sm font-semibold" style="color: var(--text-h)">内存监控</span>
      </div>
      <svg class="mp-chevron" :class="{ rotated: isOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>

    <div v-show="isOpen" class="mp-body">
      <!-- Left: STACK -->
      <div class="mp-stack">
        <div class="mp-section-header" @click="toggleAllFrames">
          <span class="mp-section-label">栈区</span>
          <svg class="mp-section-chevron" :class="{ rotated: collapsedFrames.size === 0 }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-if="stackItemGroups.length === 0" class="mp-empty">暂无变量</div>
        <div v-else class="mp-stack-scroll">
          <TransitionGroup name="mp-frame" tag="div">
            <div v-for="(group, gi) in stackItemGroups" :key="'g'+gi" class="mp-frame">
              <div class="mp-frame-title">
                <svg class="mp-frame-chevron" :class="{ rotated: !collapsedFrames.has(gi) }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" @click.stop="toggleFrame(gi)">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span class="mp-frame-method">{{ group.method }}</span>
                <span class="mp-frame-paren-l">(</span>
                <template v-for="(arg, ai) in group.args" :key="'a'+ai">
                  <span v-if="arg.isRef" class="mp-frame-arg-ref" :style="frameArgStyle(arg)" @mouseenter="onFrameArgEnter(arg)" @mouseleave="onStackLeave()">{{ arg.label }}</span>
                  <span v-else class="mp-frame-arg-val">{{ arg.display }}</span>
                  <span v-if="ai < group.args.length - 1" class="mp-frame-arg-sep">, </span>
                </template>
                <span v-if="group.args.length === 0" class="mp-frame-arg-empty">..</span>
                <span class="mp-frame-paren-r">)</span>
              </div>
              <div v-show="!collapsedFrames.has(gi)" class="mp-frame-body">
                <!-- Primitive variables: two per row, compact cards -->
                <div v-if="group.primitiveItems.length" class="mp-primitive-row">
                  <TransitionGroup name="mp-card" tag="div" class="mp-primitive-inner">
                    <div
                      v-for="item in group.primitiveItems"
                      :key="item.name"
                      class="mp-var-card mp-var-card-sm"
                      :class="{
                        'mp-stack-hovered': hoverState.src === 'stack' && (item.refId ? hoverState.refId === item.refId : hoverState.itemName === item.name),
                        'mp-var-flash': flashVarNames.has(item.name)
                      }"
                      :style="flashVarNames.has(item.name) ? { '--flash-color': item.isRef ? (item.refColor || '#0a84ff') : '#0a84ff' } : {}"
                      @mouseenter="onStackEnter(item)"
                      @mouseleave="onStackLeave()"
                    >
                      <div class="mp-var-name">{{ item.name }}</div>
                      <div class="mp-var-value">
                        <span class="mp-var-primitive">{{ item.value }}</span>
                      </div>
                    </div>
                  </TransitionGroup>
                </div>
                <!-- Reference variables: full-width, colored cards -->
                <TransitionGroup name="mp-card" tag="div" class="mp-ref-stack">
                  <div
                    v-for="item in group.refItems"
                    :key="item.name"
                    class="mp-var-card is-ref"
                    :class="{
                      'mp-stack-hovered': hoverState.src === 'stack' && hoverState.refId === item.refId,
                      'mp-stack-lit': hoverState.src !== 'stack' && hoverState.refId === item.refId,
                      'mp-var-flash': flashVarNames.has(item.name)
                    }"
                    :style="refCardStyle(item)"
                    @mouseenter="onStackEnter(item)"
                    @mouseleave="onStackLeave()"
                  >
                    <div class="mp-var-name">{{ item.name }}</div>
                    <div class="mp-var-value">
                      <span class="mp-var-ref-label" :style="{ color: item.refColor }">{{ item.refLabel }}</span>
                    </div>
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </div>

      <!-- Divider -->
      <div class="mp-divider" />

      <!-- Right: HEAP -->
      <div class="mp-heap">
        <div class="mp-section-header" @click="toggleAllHeapCards">
          <span class="mp-section-label">堆区</span>
          <svg class="mp-section-chevron" :class="{ rotated: collapsedHeapCards.size === 0 }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-if="heapObjects.length === 0" class="mp-empty">暂无对象</div>
        <div v-else class="mp-heap-scroll">
          <TransitionGroup name="mp-heap-card" tag="div">
            <div
            v-for="obj in heapObjects"
            :key="obj.refId"
            class="mp-heap-card"
            :class="{
              'mp-heap-highlight': hoverState.refId === obj.refId && hoverState.src !== 'none',
              'mp-heap-self-hover': hoverState.src === 'heap' && hoverState.refId === obj.refId
            }"
            :style="obj.colorStyle"
            @mouseenter="onHeapEnter(obj)"
            @mouseleave="onHeapLeave()"
          >
            <div class="mp-heap-header" @click.stop="toggleHeapCard(obj.refId)">
              <svg class="mp-heap-chevron" :class="{ rotated: !collapsedHeapCards.has(obj.refId) }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span class="mp-heap-tag" :style="obj.tagStyle">{{ obj.label }}</span>
              <span class="mp-heap-type">{{ obj.type }}</span>
            </div>
            <div v-show="!collapsedHeapCards.has(obj.refId)" class="mp-heap-cells">
              <!-- Array slots -->
              <template v-if="obj.slots && obj.slots.length">
                <div v-for="slot in obj.slots" :key="'s'+slot.index" class="mp-heap-cell">
                  <span class="mp-cell-idx">[{{ slot.index }}]</span>
                  <span class="mp-cell-val" :class="{ 'mp-cell-flash': isHeapCellFlashing(obj.name, slot.index) }" :style="isHeapCellFlashing(obj.name, slot.index) ? heapCellFlashStyle(obj) : {}">{{ slot.value }}</span>
                </div>
              </template>
              <!-- Object fields (linked list nodes etc.) -->
              <template v-else-if="obj.fields && Object.keys(obj.fields).length">
                <div
                  v-for="(fv, fk) in obj.fields"
                  :key="'f'+fk"
                  class="mp-heap-cell mp-heap-field"
                  :class="{ 'mp-field-ref': fv && fv.ref && idToHeapKey[fv.ref] }"
                  @mouseenter="fv && fv.ref && idToHeapKey[fv.ref] && onFieldEnter(fv.ref)"
                  @mouseleave="onStackLeave()"
                >
                  <span class="mp-cell-idx">{{ fk }}</span>
                  <template v-if="fv && fv.ref && idToHeapKey[fv.ref]">
                    <span class="mp-cell-ref-label" :style="{ color: refColorByHeapId(fv.ref).text }">
                      {{ heapLabelMap[idToHeapKey[fv.ref]]?.label || '?' }}
                    </span>
                  </template>
                  <span v-else class="mp-cell-val">{{ formatVal(fv) }}</span>
                </div>
              </template>
              <!-- Map entries: two-column layout with type headers -->
              <template v-else-if="obj.isMap && obj.mapEntries.length">
                <div class="mp-map-table">
                  <div class="mp-map-header">
                    <span>{{ obj.keyType }}</span>
                    <span class="mp-map-header-arrow">→</span>
                    <span>{{ obj.valType }}</span>
                  </div>
                  <div
                    v-for="(entry, ei) in obj.mapEntries"
                    :key="'m'+ei"
                    class="mp-map-row"
                    :class="{ 'mp-map-overflow': entry.key && String(entry.key).startsWith('...(共') }"
                  >
                    <div class="mp-map-card mp-map-key-card">{{ entry.key }}</div>
                    <span class="mp-map-arrow">→</span>
                    <div class="mp-map-card mp-map-val-card">{{ entry.value }}</div>
                  </div>
                </div>
              </template>
            </div>
          </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive, watch } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const isOpen = ref(true)

// Section & frame collapse state
const collapsedFrames = reactive(new Set())
const collapsedHeapCards = reactive(new Set())

function toggleFrame(gi) {
  if (collapsedFrames.has(gi)) {
    collapsedFrames.delete(gi)
  } else {
    collapsedFrames.add(gi)
  }
}

function toggleAllFrames() {
  if (collapsedFrames.size > 0) {
    collapsedFrames.clear()
  } else {
    stackItemGroups.value.forEach((_, i) => collapsedFrames.add(i))
  }
}

function toggleHeapCard(refId) {
  if (collapsedHeapCards.has(refId)) {
    collapsedHeapCards.delete(refId)
  } else {
    collapsedHeapCards.add(refId)
  }
}

function toggleAllHeapCards() {
  if (collapsedHeapCards.size > 0) {
    collapsedHeapCards.clear()
  } else {
    heapObjects.value.forEach(obj => collapsedHeapCards.add(obj.refId))
  }
}

// ===== 8-Color Palette =====
const PALETTE = [
  { text: '#4ade80', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', glow: 'rgba(34,197,94,0.25)' },
  { text: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', glow: 'rgba(59,130,246,0.25)' },
  { text: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)', glow: 'rgba(168,85,247,0.25)' },
  { text: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', glow: 'rgba(245,158,11,0.25)' },
  { text: '#fb7185', bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.35)',  glow: 'rgba(244,63,94,0.25)' },
  { text: '#22d3ee', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.35)',  glow: 'rgba(6,182,212,0.25)' },
  { text: '#fdba74', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)', glow: 'rgba(251,146,60,0.25)' },
  { text: '#6ee7b7', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.35)', glow: 'rgba(52,211,153,0.25)' },
]

// ===== Hover state =====
const hoverState = reactive({ src: 'none', refId: null, itemName: null })
// src: 'stack' | 'heap' | 'field' | 'none'

// ===== Value flash state =====
const flashVarNames = reactive(new Set())
const FLASH_MS = 900

// ===== Virtual heap entries for Map variables (computed, no circular deps) =====
const virtualMapEntries = computed(() => {
  const entries = {}
  const frames = store.activeStackFrames?.length
    ? [...store.activeStackFrames].reverse()
    : (store.currentStackFrame ? [store.currentStackFrame] : [])
  for (const frame of frames) {
    const locals = frame.locals || {}
    for (const [name, val] of Object.entries(locals)) {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) continue
      const vId = '__vmap__' + name
      const rawEntries = Object.entries(val)
      const total = rawEntries.length
      const max = total > 200 ? 200 : total
      const displayEntries = rawEntries.slice(0, max).map(([k, v]) => ({ key: k, value: v }))
      if (total > 200) displayEntries.push({ key: '...(共' + total + '个键值对)', value: '...' })
      const allNumKeys = displayEntries
        .filter(e => e.key !== null && String(e.key) !== 'undefined' && !String(e.key).startsWith('...(共'))
        .every(e => !isNaN(Number(e.key)) && String(Number(e.key)) === String(e.key))
      const keyType = allNumKeys && displayEntries.length > 0 && !String(displayEntries[0].key).startsWith('...(共')
        ? 'Integer' : 'String'
      const firstVal = displayEntries.find(e => e.value !== null && e.value !== undefined && !String(e.key).startsWith('...(共'))
      const valType = firstVal
        ? (typeof firstVal.value === 'number' ? 'Integer' : typeof firstVal.value === 'string' ? 'String' : typeof firstVal.value)
        : '?'
      entries[vId] = {
        id: vId, name: name, type: 'HashMap',
        _mapType: 'Map', keyType, valType, entries: displayEntries,
      }
    }
  }
  return entries
})

// ===== Heap data =====
const heapMap = computed(() => {
  const base = store.currentHeap || {}
  const vm = virtualMapEntries.value
  if (Object.keys(vm).length === 0) return base
  return { ...base, ...vm }
})

const idToHeapKey = computed(() => {
  const map = {}
  for (const key of Object.keys(heapMap.value)) {
    const obj = heapMap.value[key]
    if (obj.id) map[obj.id] = key
  }
  return map
})

const heapLabelMap = computed(() => {
  const map = {}
  const heap = heapMap.value
  const keys = Object.keys(heap).sort()
  let nodeIdx = 0
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const obj = heap[key]
    const f = obj.fields || {}
    const fieldKeys = Object.keys(f)
    const hasFields = fieldKeys.length > 0
    const hasSlots = obj.slots && obj.slots.length > 0

    let label
    if (obj._mapType === 'Map') {
      label = `[映射 ${obj.name || key}]`
    } else if (hasFields) {
      // Object type: detect common patterns (ListNode, TreeNode, etc.)
      const hasVal = f.hasOwnProperty('val')
      const isNode = hasVal && (f.hasOwnProperty('next') || f.hasOwnProperty('left') || f.hasOwnProperty('right'))
      if (isNode) {
        label = `[节点${++nodeIdx}]`
      } else {
        label = `[${obj.name || key}]`
      }
    } else if (hasSlots) {
      label = `[数组 ${obj.name || key}]`
    } else {
      label = `[${obj.name || key}]`
    }
    map[key] = { label, colorIdx: i % PALETTE.length }
  }
  return map
})

function paletteFor(key) {
  const m = heapLabelMap.value[key]
  return PALETTE[m?.colorIdx ?? 0]
}

function refColorByHeapId(hexId) {
  const key = idToHeapKey.value[hexId]
  return key ? paletteFor(key) : PALETTE[0]
}

// ===== Stack frame items =====
const stackItemGroups = computed(() => {
  const frames = store.activeStackFrames.length
    ? [...store.activeStackFrames].reverse()
    : (store.currentStackFrame ? [store.currentStackFrame] : [])
  const idMap = idToHeapKey.value
  const heap = heapMap.value
  const lm = heapLabelMap.value

  return frames.map(frame => {
    const locals = frame.locals || {}
    const items = []
    for (const name of Object.keys(locals)) {
      const val = locals[name]
      if (Array.isArray(val) && val.length === 0 && name === 'args') continue

      let isRef = false, refId = null, refLabel = null, refColor = null, refStyle = undefined

      if (typeof val === 'string' && idMap[val]) {
        isRef = true
        refId = val
        const key = idMap[val]
        const lbl = lm[key]?.label
        refLabel = lbl || key
        const c = paletteFor(key)
        refColor = c.text
        refStyle = {
          '--ref-border': c.border,
          '--ref-bg': c.bg,
          '--ref-glow': c.glow,
        }
      } else if (Array.isArray(val) && heap[name]) {
        isRef = true
        refId = heap[name].id || name
        const lbl = lm[name]?.label
        refLabel = lbl || name
        const c = paletteFor(name)
        refColor = c.text
        refStyle = { '--ref-border': c.border, '--ref-bg': c.bg, '--ref-glow': c.glow }
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        // Map data: reference virtual heap entry (computed separately, no circular deps)
        const vId = '__vmap__' + name
        if (heap[vId]) {
          isRef = true
          refId = vId
          refLabel = '[映射 ' + name + ']'
          const c = paletteFor(vId)
          refColor = c.text
          refStyle = { '--ref-border': c.border, '--ref-bg': c.bg, '--ref-glow': c.glow }
        }
      }

      items.push({
        name,
        isRef,
        refId,
        refLabel,
        refColor,
        refStyle,
        value: isRef ? null : (val === undefined || val === null ? String(val) : (typeof val === 'object' ? JSON.stringify(val) : String(val))),
      })
    }
    // Sort: primitives first, then refs, then args at the very bottom
    items.sort((a, b) => (a.isRef ? 1 : 0) - (b.isRef ? 1 : 0))
    const primitiveItems = items.filter(i => !i.isRef)
    const refItems = items.filter(i => i.isRef)
    const argsIdx = refItems.findIndex(i => i.name === 'args')
    if (argsIdx >= 0) {
      const argsItem = refItems.splice(argsIdx, 1)[0]
      refItems.push(argsItem)
    }

    // Build args display: read frame.args (parameter name → value at call time)
    const frameArgs = frame.args || {}
    const argEntries = Object.entries(frameArgs)
    const args = argEntries.map(([pName, pVal]) => {
      let isRef = false, label = '', color = '', refId = null
      if (typeof pVal === 'string' && idMap[pVal]) {
        // pVal is a heap ID string (complex objects)
        isRef = true
        refId = pVal
        const key = idMap[pVal]
        label = lm[key]?.label || key
        color = (paletteFor(key)).text
      } else if (typeof pVal === 'string' && heap[pVal]) {
        // pVal matches a heap key name (arrays/collections store the name as value)
        isRef = true
        refId = heap[pVal].id || pVal
        label = lm[pVal]?.label || pVal
        color = (paletteFor(pVal)).text
      } else if (Array.isArray(pVal) && heap[pName]) {
        // pVal is a serialized collection array; fallback match by param name
        isRef = true
        refId = heap[pName].id || pName
        label = lm[pName]?.label || pName
        color = (paletteFor(pName)).text
      }
      return {
        isRef,
        label,
        color,
        refId,
        display: isRef ? null : (pVal === null || pVal === undefined ? 'null' : String(pVal)),
      }
    })

    return { method: frame.method || 'main', primitiveItems, refItems, args }
  }).filter(g => g.primitiveItems.length + g.refItems.length > 0)
})

// ===== Heap objects =====
const heapObjects = computed(() => {
  const objs = []
  const heap = heapMap.value
  const keys = Object.keys(heap).sort()
  // Track which real keys are covered by virtual map entries
  const virtualRealNames = new Set()
  for (const k of keys) {
    if (k.startsWith('__vmap__')) {
      const realName = k.slice('__vmap__'.length)
      virtualRealNames.add(realName)
    }
  }
  for (const name of keys) {
    // Skip real heap entry if a virtual map entry covers it
    if (virtualRealNames.has(name) && !name.startsWith('__vmap__')) continue
    const obj = heap[name]
    const lm = heapLabelMap.value[name]
    const c = paletteFor(name)
    const isMap = obj._mapType === 'Map'
    objs.push({
      name: obj.name || name,
      refId: obj.id || name,
      type: isMap ? 'Map<>' : (obj.type || 'unknown'),
      slots: isMap ? [] : (obj.slots || []),
      fields: isMap ? {} : (obj.fields || {}),
      isMap,
      mapEntries: isMap ? (obj.entries || []) : [],
      keyType: obj.keyType || '?',
      valType: obj.valType || '?',
      label: lm?.label || name,
      color: c,
      tagStyle: { color: c.text, background: c.bg },
      colorStyle: { '--obj-border': c.border, '--obj-glow': c.glow },
    })
  }
  objs.sort((a, b) => {
    const aIsArgs = a.name === 'args' || a.label === '[数组 args]'
    const bIsArgs = b.name === 'args' || b.label === '[数组 args]'
    if (aIsArgs && !bIsArgs) return 1
    if (!aIsArgs && bIsArgs) return -1
    return 0
  })
  return objs
})

// ===== Hover interactions =====
function onStackEnter(item) {
  hoverState.src = 'stack'
  hoverState.refId = item.refId || null
  hoverState.itemName = item.isRef ? null : item.name
}

function onStackLeave() {
  hoverState.src = 'none'
  hoverState.refId = null
  hoverState.itemName = null
  hoverState.itemName = null
}

function onHeapEnter(obj) {
  hoverState.src = 'heap'
  hoverState.refId = obj.refId
}

function onHeapLeave() {
  hoverState.src = 'none'
  hoverState.refId = null
  hoverState.itemName = null
}

function onFieldEnter(refId) {
  hoverState.src = 'field'
  hoverState.refId = refId
}

function onFrameArgEnter(arg) {
  if (!arg.refId) return
  hoverState.src = 'frame-arg'
  hoverState.refId = arg.refId
  hoverState.itemName = null
}

// ===== Value change flash on step transition =====
const flashHeapCellKeys = reactive(new Set()) // keys: "heapKey:slotIndex"

watch(() => store.currentStep, (step) => {
  if (step <= 0) return
  const prevStep = store.steps[step - 1]
  const currStep = store.steps[step]
  if (!prevStep || !currStep) return

  const prevFrames = prevStep.stackFrames || []
  const currFrames = currStep.stackFrames || []
  const fallbackPrev = prevStep.variables || {}
  const fallbackCurr = currStep.variables || {}

  // Merge locals from all frames for comparison
  const getMergedLocals = (frames, fallback) => {
    const m = {}
    if (frames.length) {
      for (const f of frames) if (f.locals) Object.assign(m, f.locals)
    }
    return Object.keys(m).length ? m : fallback
  }

  const prevLocals = getMergedLocals(prevFrames, fallbackPrev)
  const currLocals = getMergedLocals(currFrames, fallbackCurr)

  const allNames = new Set([...Object.keys(prevLocals), ...Object.keys(currLocals)])
  allNames.forEach(name => {
    const a = JSON.stringify(prevLocals[name])
    const b = JSON.stringify(currLocals[name])
    if (a !== b) {
      flashVarNames.add(name)
      setTimeout(() => flashVarNames.delete(name), FLASH_MS)
    }
  })

  // Detect heap array slot changes
  const prevHeap = prevStep.heap || {}
  const currHeap = currStep.heap || {}
  const allHeapKeys = new Set([...Object.keys(prevHeap), ...Object.keys(currHeap)])
  allHeapKeys.forEach(key => {
    const prevSlots = prevHeap[key]?.slots || []
    const currSlots = currHeap[key]?.slots || []
    const maxLen = Math.max(prevSlots.length, currSlots.length)
    for (let i = 0; i < maxLen; i++) {
      const prevVal = prevSlots[i]?.value
      const currVal = currSlots[i]?.value
      if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
        const cellKey = `${key}:${i}`
        flashHeapCellKeys.add(cellKey)
        setTimeout(() => flashHeapCellKeys.delete(cellKey), FLASH_MS)
      }
    }
  })
})

// Reset on new run
watch(() => store.runId, () => {
  flashVarNames.clear()
  flashHeapCellKeys.clear()
  hoverState.src = 'none'
  hoverState.refId = null
  hoverState.itemName = null
})

function refCardStyle(item) {
  const base = item.refStyle || {}
  if (flashVarNames.has(item.name)) {
    return { ...base, '--flash-color': item.refColor || '#0a84ff' }
  }
  return base
}

function isHeapCellFlashing(objName, slotIndex) {
  return flashHeapCellKeys.has(`${objName}:${slotIndex}`)
}

function heapCellFlashStyle(obj) {
  return { '--flash-color': (obj.color && obj.color.text) || '#0a84ff' }
}

function formatVal(v) {
  if (v === undefined || v === null) return String(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function frameArgStyle(arg) {
  const base = { color: arg.color }
  if (hoverState.refId === arg.refId && hoverState.src !== 'none') {
    if (hoverState.src === 'frame-arg') {
      base.textShadow = `0 0 10px ${arg.color}, 0 0 20px ${arg.color}`
    } else {
      base.textShadow = `0 0 8px ${arg.color}`
    }
  }
  return base
}
</script>

<style scoped>
.memory-panel {
  background: var(--card-bg);
  overflow: hidden;
}

/* Header — DESIGN.md standard collapsible pattern */
.mp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.mp-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.8;
}
.mp-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.mp-chevron.rotated { transform: rotate(180deg) }

/* ===== Body: two-column grid ===== */
.mp-body {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0;
  margin-top: 12px;
  align-items: start;
}

.mp-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}
.mp-section-header:hover {
  color: var(--text-h);
}
.mp-section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.mp-section-header:hover .mp-section-label {
  color: var(--text-h);
}
.mp-section-chevron {
  color: var(--text-muted);
  transition: transform 0.3s cubic-bezier(.22,.9,.27,1);
  flex-shrink: 0;
}
.mp-section-chevron.rotated {
  transform: rotate(180deg);
}

.mp-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 16px 8px;
}

/* ===== STACK Column ===== */
.mp-stack {
  min-width: 0;
  padding-right: 6px;
}

.mp-frame {
  border: 1.5px dashed var(--border);
  border-radius: 12px;
  padding: 8px 10px;
  margin-bottom: 14px;
  transition: border-color 0.25s;
}
.mp-frame:last-child { margin-bottom: 0; }

.mp-frame-title {
  position: relative;
  top: -18px;
  margin-bottom: -12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  padding: 2px 10px;
  background: var(--card-bg);
  border-radius: 6px;
  border: 1px solid var(--border);
  line-height: 1.5;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1px 3px;
  max-width: 100%;
}
.mp-frame-chevron {
  color: var(--text-muted);
  transition: transform 0.3s cubic-bezier(.22,.9,.27,1);
  flex-shrink: 0;
  margin-right: 4px;
  cursor: pointer;
  opacity: 0.6;
}
.mp-frame-chevron:hover {
  opacity: 1;
  color: var(--text-h);
}
.mp-frame-chevron.rotated {
  transform: rotate(90deg);
}
.mp-frame-method { color: var(--primary); }
.mp-frame-paren-l,
.mp-frame-paren-r { color: var(--text-muted); }
.mp-frame-arg-val { color: var(--text); }
.mp-frame-arg-ref { font-weight: 700; cursor: pointer; transition: text-shadow 0.25s ease; }
.mp-frame-arg-sep { color: var(--text-muted); }
.mp-frame-arg-empty { color: var(--text-muted); }

.mp-frame-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Primitive row: two cards per row, wrapped */
.mp-primitive-row {
  margin-bottom: 2px;
}
.mp-primitive-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.mp-ref-stack {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Variable card — base */
.mp-var-card {
  background: var(--code-bg);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  transition:
    transform 0.22s cubic-bezier(.22,.9,.27,1),
    border-color 0.25s cubic-bezier(.22,.9,.27,1),
    box-shadow 0.25s cubic-bezier(.22,.9,.27,1),
    background 0.25s cubic-bezier(.22,.9,.27,1);
  position: relative;
}

/* Compact primitive card — auto-wrap with comfortable sizing */
.mp-var-card-sm {
  flex: 0 1 auto;
  min-width: 58px;
  padding: 5px 8px;
  gap: 1px;
}
.mp-var-card-sm .mp-var-name {
  font-size: 12px;
  font-weight: 600;
}
.mp-var-card-sm .mp-var-value {
  font-size: 14px;
}

/* Reference variable card — full-width, colored left border + subtle tint */
.mp-var-card.is-ref {
  border-left: 3px solid var(--ref-border, var(--border));
  background: color-mix(in srgb, var(--ref-bg, transparent) 25%, var(--code-bg));
  padding: 8px 10px;
}

.mp-var-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-h);
  line-height: 1.3;
}

.mp-var-value {
  font-size: 13px;
  font-family: var(--mono);
  font-weight: 500;
  overflow: visible;
  position: relative;
}

.mp-var-primitive {
  color: var(--text);
}

.mp-var-ref-label {
  font-weight: 600;
  transition: color 0.2s ease;
}

/* Map table inside heap cards */
.mp-map-table {
  display: flex;
  flex-direction: column;
}

.mp-map-header {
  display: grid;
  grid-template-columns: 1fr 28px 1fr;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--text-h);
  position: sticky;
  top: 0;
  background: var(--code-bg);
  text-align: center;
}

.mp-map-header-arrow {
  color: var(--accent-border);
  opacity: 0.35;
  font-size: 14px;
}

.mp-map-row {
  display: grid;
  grid-template-columns: 1fr 28px 1fr;
  gap: 6px;
  align-items: center;
  padding: 3px 8px;
  transition: background 0.1s;
}

.mp-map-row:hover {
  background: rgba(255,255,255,0.03);
}

.mp-map-row.mp-map-overflow {
  opacity: 0.4;
  font-style: italic;
}

.mp-map-card {
  padding: 4px 10px;
  border-radius: 6px;
  font-family: 'Maple Mono', ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mp-map-key-card {
  color: var(--text-muted);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
}

.mp-map-val-card {
  color: var(--text);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
}

.mp-map-arrow {
  color: var(--primary);
  opacity: 0.55;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  flex-shrink: 0;
}

/* Stack card self-hover */
.mp-stack-hovered {
  transform: translateX(3px) scale(1.015);
  border-color: var(--accent-border);
  box-shadow: 0 4px 16px rgba(10,132,255,0.12);
}

/* Stack card lit up by heap hover */
.mp-stack-lit {
  border-color: var(--ref-border, var(--accent-border)) !important;
  box-shadow: 0 0 14px var(--ref-glow, rgba(10,132,255,0.15));
  background: color-mix(in srgb, var(--ref-bg, transparent) 40%, var(--code-bg));
}

/* Full-card fluorescence flash — scale + glow pulse, color via --flash-color */
.mp-var-flash {
  --flash-color: #0a84ff;
  animation: mpFlashCard 900ms cubic-bezier(.4, 0, .2, 1);
  z-index: 1;
  position: relative;
}
@keyframes mpFlashCard {
  0%   { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
  14%  { transform: scale(1.035); filter: drop-shadow(0 0 16px var(--flash-color)); }
  42%  { transform: scale(1.035); filter: drop-shadow(0 0 16px var(--flash-color)); }
  100% { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
}

/* ===== Divider ===== */
.mp-divider {
  width: 1px;
  background: var(--border);
  margin: 0 4px;
  align-self: stretch;
}

/* ===== HEAP Column ===== */
.mp-heap {
  min-width: 0;
  padding-left: 6px;
}

.mp-heap-card {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--obj-border, var(--border));
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition:
    border-color 0.25s cubic-bezier(.22,.9,.27,1),
    box-shadow 0.25s cubic-bezier(.22,.9,.27,1),
    transform 0.25s cubic-bezier(.22,.9,.27,1);
}

/* Heap card highlighted by stack hover */
.mp-heap-highlight {
  border-color: var(--obj-border, var(--primary)) !important;
  box-shadow: 0 0 16px var(--obj-glow, rgba(10,132,255,0.2));
  transform: scale(1.02);
}

/* Heap card self-hover: stronger glow */
.mp-heap-self-hover {
  box-shadow: 0 0 20px var(--obj-glow, rgba(10,132,255,0.3));
}

.mp-heap-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
}
.mp-heap-chevron {
  color: var(--text-muted);
  transition: transform 0.3s cubic-bezier(.22,.9,.27,1);
  flex-shrink: 0;
  cursor: pointer;
  opacity: 0.5;
}
.mp-heap-chevron:hover {
  opacity: 1;
  color: var(--text-h);
}
.mp-heap-chevron.rotated {
  transform: rotate(90deg);
}

.mp-heap-tag {
  font-size: 13px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 5px;
}

.mp-heap-type {
  font-size: 12px;
  color: var(--text-muted);
}

/* Heap cells (slots / fields) */
.mp-heap-cells {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  overflow: visible;
}

.mp-heap-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 13px;
}

.mp-cell-idx {
  color: var(--text-muted);
  font-size: 12px;
}

.mp-cell-val {
  color: var(--text-h);
  font-weight: 500;
}

/* Heap cell flash — same fluorescence + scale, color via --flash-color */
.mp-cell-flash {
  display: inline-block;
  --flash-color: #0a84ff;
  animation: mpFlashCell 900ms cubic-bezier(.4, 0, .2, 1);
  z-index: 1;
  position: relative;
}
@keyframes mpFlashCell {
  0%   { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
  14%  { transform: scale(1.08); filter: drop-shadow(0 0 12px var(--flash-color)); }
  42%  { transform: scale(1.08); filter: drop-shadow(0 0 12px var(--flash-color)); }
  100% { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
}

/* Field reference — hoverable */
.mp-heap-field { cursor: pointer; }
.mp-heap-field:hover { background: rgba(255,255,255,0.07); }
.mp-field-ref { cursor: pointer; }

.mp-cell-ref-label {
  font-size: 13px;
  font-weight: 600;
  transition: color 0.2s ease;
}

/* ===== TransitionGroup animations ===== */

/* Stack card enter: slide down + fade in + subtle scale */
.mp-card-enter-active {
  transition:
    opacity 0.35s cubic-bezier(.22,.9,.27,1),
    transform 0.35s cubic-bezier(.22,.9,.27,1);
}
.mp-card-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
  position: absolute;
}
.mp-card-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}
.mp-card-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}
.mp-card-move {
  transition: transform 0.35s cubic-bezier(.22,.9,.27,1);
}

/* Heap card enter: fade in + slide up */
.mp-heap-card-enter-active {
  transition:
    opacity 0.35s cubic-bezier(.22,.9,.27,1),
    transform 0.35s cubic-bezier(.22,.9,.27,1);
}
.mp-heap-card-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  position: absolute;
}
.mp-heap-card-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}
.mp-heap-card-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
.mp-heap-card-move {
  transition: transform 0.35s cubic-bezier(.22,.9,.27,1);
}

/* Frame group enter */
.mp-frame-enter-active {
  transition:
    opacity 0.4s cubic-bezier(.22,.9,.27,1),
    transform 0.4s cubic-bezier(.22,.9,.27,1);
}
.mp-frame-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.mp-frame-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}
.mp-frame-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* ===== Responsive ===== */
@media (max-width: 640px) {
  .mp-body {
    grid-template-columns: 1fr;
  }
  .mp-divider { display: none; }
  .mp-stack { padding-right: 0; margin-bottom: 10px; }
  .mp-heap  { padding-left: 0; }
}

/* ===== Reduced motion ===== */
@media (prefers-reduced-motion: reduce) {
  .mp-var-card { transition: none; }
  .mp-heap-card { transition: none; }
  .mp-var-flash { animation: none; }
  .mp-cell-flash { animation: none; }
  .mp-chevron { transition: none; }
  .mp-card-enter-active,
  .mp-card-leave-active,
  .mp-heap-card-enter-active,
  .mp-heap-card-leave-active,
  .mp-frame-enter-active,
  .mp-frame-leave-active { transition: none; }
  .mp-section-chevron { transition: none; }
  .mp-frame-chevron { transition: none; }
  .mp-heap-chevron { transition: none; }
}
</style>
