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
        <div class="stack-frame">
          <div class="frame-title">main(String[] args)</div>
          <div class="frame-vars">
            <div v-for="item in stackItems" :key="item.name" class="stack-item" :class="{ 'is-ref': item.isRef }">
              <span class="si-name">{{ item.name }}</span>
              <span class="si-eq">=</span>
              <span v-if="item.isRef" class="si-ref">→ {{ item.refLabel }}</span>
              <span v-else class="si-value">{{ item.value }}</span>
            </div>
          </div>
          <div v-if="stackItems.length === 0" class="hs-empty">暂无局部变量</div>
        </div>
      </div>

      <!-- Divider between stack and heap -->
      <div class="hs-divider">
        <svg width="2" height="100%"><line x1="1" y1="0" x2="1" y2="100%" stroke="var(--border)" stroke-dasharray="3 3" /></svg>
      </div>

      <!-- Heap -->
      <div class="heap-area">
        <div class="hs-label">堆 Heap <span style="font-weight:400;font-size:11px">(示意图)</span></div>
        <div v-if="heapItems.length === 0" class="hs-empty">暂无对象 / 数组</div>
        <div v-for="item in heapItems" :key="item.name" class="heap-object">
          <div class="ho-header">
            <span class="ho-ref">{{ item.refLabel }}</span>
            <span class="ho-type">{{ item.typeLabel }}</span>
          </div>
          <div class="ho-cells">
            <div v-for="(v, idx) in item.data" :key="idx" class="ho-cell">
              <span class="hoc-idx">[{{ idx }}]</span>
              <span class="hoc-val">{{ formatVal(v) }}</span>
            </div>
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

const variables = computed(() => store.currentVariables || {})
const displayKeys = computed(() => Object.keys(variables.value).filter(k => k !== 'args'))

const hasData = computed(() => displayKeys.value.length > 0)

const stackItems = computed(() =>
  displayKeys.value
    .filter(k => !Array.isArray(variables.value[k]))
    .map(k => ({ name: k, value: formatVal(variables.value[k]), isRef: false }))
)

const heapItems = computed(() =>
  displayKeys.value
    .filter(k => Array.isArray(variables.value[k]))
    .map(k => {
      const arr = variables.value[k]
      const refAddr = '0x' + hashCode(k).toString(16).padStart(4, '0').toUpperCase()
      return { name: k, refLabel: refAddr, typeLabel: `int[${arr.length}]`, data: arr }
    })
)

function formatVal(v) {
  if (v === undefined || v === null) return String(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function hashCode(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h % 65536)
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
.si-value { color: var(--text); font-family: var(--mono); font-size: 12px }
.si-ref   { color: var(--primary); font-family: var(--mono); font-size: 11px }
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
  font-family: var(--mono);
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
.hoc-val { color: var(--text-h); font-family: var(--mono); font-weight: 500 }

.hs-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px;
  text-align: center;
}

@media (max-width: 640px) {
  .hs-body { flex-direction: column }
  .stack-area { flex: none }
  .hs-divider { display: none }
}
</style>
