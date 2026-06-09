<template>
  <div v-if="hasData" class="heap-stack-panel card p-3 mb-3">
    <div class="hs-header" @click="isOpen = !isOpen">
      <div class="flex items-center gap-2">
        <span class="hs-dot" />
        <span class="text-sm font-semibold" style="color: var(--text-h)">堆 & 栈</span>
      </div>
      <svg
        class="hs-chevron"
        :class="{ rotated: isOpen }"
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

    <div v-show="isOpen" class="hs-body">
      <!-- Stack -->
      <div class="stack-area">
        <div class="hs-label">栈 Stack</div>
        <div v-if="stackFrames.length === 0" class="hs-empty">暂无栈帧</div>
        <div v-for="(frame, fi) in stackFrames" :key="'f'+fi" class="stack-frame">
          <div class="frame-title">{{ frame.method }}(..)</div>
          <div class="frame-vars">
            <div v-for="item in getFrameItems(frame, fi)" :key="item.name" class="stack-item" :class="{ 'is-ref': item.isRef }">
              <span class="si-name">{{ item.name }}</span>
              <span class="si-eq">=</span>
              <span v-if="item.isRef" class="si-ref">→ {{ item.refLabel }}</span>
              <span v-else class="si-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Divider between stack and heap -->
      <div class="hs-divider">
        <svg width="2" height="100%"><line x1="1" y1="0" x2="1" y2="100%" stroke="var(--border)" stroke-dasharray="3 3" /></svg>
      </div>

      <!-- Heap -->
      <div class="heap-area">
        <div class="hs-label">堆 Heap</div>
        <div v-if="heapObjects.length === 0" class="hs-empty">暂无对象 / 数组</div>
        <div v-for="obj in heapObjects" :key="obj.name" class="heap-object">
          <div class="ho-header">
            <span class="ho-ref">{{ obj.id }}</span>
            <span class="ho-type">{{ obj.type }}</span>
            <span class="ho-name">({{ obj.name }})</span>
          </div>
          <div class="ho-cells">
            <template v-if="obj.slots && obj.slots.length">
              <div v-for="slot in obj.slots" :key="'s'+slot.index" class="ho-cell">
                <span class="hoc-idx">[{{ slot.index }}]</span>
                <span class="hoc-val">{{ slot.value }}</span>
              </div>
            </template>
            <template v-else-if="obj.fields && Object.keys(obj.fields).length">
              <div v-for="(fv, fk) in obj.fields" :key="'f'+fk" class="ho-cell ho-field">
                <span class="hoc-idx">{{ fk }}</span>
                <span v-if="fv && fv.ref" class="si-ref">→ {{ fv.ref }}</span>
                <span v-else class="hoc-val">{{ formatVal(fv) }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const isOpen = ref(true)

// 从后端堆快照读取真实堆对象
const heapMap = computed(() => store.currentHeap || {})

// 从后端栈帧读取真实栈帧数组
const stackFrames = computed(() => {
  const frames = store.activeStackFrames
  if (frames && frames.length) return frames
  const sf = store.currentStackFrame
  return sf ? [sf] : []
})

// 堆中的变量名集合（用于判断栈变量是否为引用）
const heapNames = computed(() => new Set(Object.keys(heapMap.value)))

const hasData = computed(() => stackFrames.value.length > 0 || Object.keys(heapMap.value).length > 0)

// 每个栈帧的局部变量
function getFrameItems(frame, frameIndex) {
  const items = []
  const locals = frame.locals || {}
  for (const name of Object.keys(locals)) {
    if (name === 'args' && Array.isArray(locals[name]) && locals[name].length === 0) continue
    const val = locals[name]
    if (heapNames.value.has(name)) {
      const heapObj = heapMap.value[name]
      items.push({ name, isRef: true, refLabel: heapObj?.id || '0x????' })
    } else {
      items.push({ name, isRef: false, value: formatVal(val) })
    }
  }
  // 最新栈帧（数组最后一项）从下往上显示
  return frameIndex === stackFrames.value.length - 1 ? items.reverse() : items
}

// 堆对象：从 heap 快照直接读取
const heapObjects = computed(() => {
  const objs = []
  const heap = heapMap.value
  for (const name of Object.keys(heap)) {
    const obj = heap[name]
    objs.push({
      name: obj.name || name,
      id: obj.id || '0x????',
      type: obj.type || 'unknown',
      slots: obj.slots || [],
      fields: obj.fields || {}
    })
  }
  return objs
})

function formatVal(v) {
  if (v === undefined || v === null) return String(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<style scoped>
.heap-stack-panel {
  background: var(--card-bg);
  overflow: hidden;
}

.hs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.hs-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.8;
}
.hs-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.hs-chevron.rotated { transform: rotate(180deg) }

.hs-body {
  display: flex;
  gap: 0;
  margin-top: 10px;
}

/* Labels */
.hs-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
}

/* Stack */
.stack-area { flex: 0 0 45%; min-width: 0 }
.stack-frame {
  background: var(--code-bg);
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
}
.frame-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.frame-vars { display: flex; flex-direction: column; gap: 4px }
.stack-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 3px 6px;
  border-radius: 5px;
}
.si-name { color: var(--text-h); font-weight: 500; min-width: 24px }
.si-eq   { color: var(--text-muted); font-size: 12px }
.si-value { color: var(--text); font-size: 12px }
.si-ref   { color: var(--primary); font-size: 11px }
.stack-item.is-ref { background: var(--accent-bg) }

/* Divider */
.hs-divider {
  flex: 0 0 20px;
  display: flex;
  justify-content: center;
  padding-top: 24px;
}
.hs-divider svg { width: 2px; height: 100% }

/* Heap */
.heap-area { flex: 1; min-width: 0 }
.heap-object {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 6px;
}
.ho-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.ho-ref {
  font-size: 11px;
  color: var(--primary);
  background: var(--accent-bg);
  padding: 1px 6px;
  border-radius: 4px;
}
.ho-type {
  font-size: 12px;
  color: var(--text-muted);
}
.ho-name {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
}
.ho-cells {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ho-cell {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 3px 7px;
  font-size: 12px;
}
.hoc-idx { color: var(--text-muted); font-size: 11px }
.hoc-val { color: var(--text-h); font-weight: 500 }

.hs-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px;
  text-align: center;
}

@media (max-width: 640px) {
  .hs-body { flex-direction: column }
  .stack-area { flex: none }
  .hs-divider { display: none }
}
</style>