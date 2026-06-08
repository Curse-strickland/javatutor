<template>
  <div class="heap-stack-panel" v-if="hasData">
    <div class="section-header" @click="isOpen = !isOpen">
      <span class="section-title">堆 & 栈</span>
      <span class="section-toggle">{{ isOpen ? '▾' : '▸' }}</span>
    </div>

    <div v-show="isOpen" class="hs-body">
      <!-- Stack area -->
      <div class="stack-area">
        <div class="area-label">栈 Stack</div>
        <div class="stack-frame card">
          <div class="frame-title">main(String[] args)</div>
          <div class="frame-vars">
            <div
              v-for="item in stackItems"
              :key="item.name"
              class="stack-item"
              :class="{ 'is-ref': item.isRef }"
            >
              <span class="si-name">{{ item.name }}</span>
              <span class="si-eq">=</span>
              <span v-if="item.isRef" class="si-ref">→ {{ item.refLabel }}</span>
              <span v-else class="si-value">{{ item.value }}</span>
            </div>
          </div>
          <div v-if="stackItems.length === 0" class="empty-hint">暂无局部变量</div>
        </div>
      </div>

      <!-- Connector arrow area -->
      <div class="connector-area" v-if="heapItems.length > 0">
        <svg class="connector-svg" :viewBox="'0 0 40 ' + (heapItems.length * 52 + 10)">
          <line
            v-for="(item, i) in heapItems"
            :key="'conn-' + item.name"
            x1="0" :y1="i * 52 + 26"
            x2="40" :y2="i * 52 + 26"
            stroke="var(--accent-border)"
            stroke-width="1.5"
            stroke-dasharray="4 3"
          />
        </svg>
      </div>

      <!-- Heap area -->
      <div class="heap-area">
        <div class="area-label">堆 Heap</div>
        <div v-if="heapItems.length === 0" class="empty-hint">暂无对象/数组</div>
        <div
          v-for="item in heapItems"
          :key="item.name"
          class="heap-object card"
        >
          <div class="ho-header">
            <span class="ho-ref">{{ item.refLabel }}</span>
            <span class="ho-type">{{ item.typeLabel }}</span>
          </div>
          <div class="ho-body">
            <!-- Array visualization -->
            <div class="ho-cells">
              <div
                v-for="(v, idx) in item.data"
                :key="idx"
                class="ho-cell"
              >
                <span class="hoc-idx">[{{ idx }}]</span>
                <span class="hoc-val">{{ formatVal(v) }}</span>
              </div>
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

// Separate into scalars (stack) and arrays (heap)
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
      return {
        name: k,
        refLabel: refAddr,
        typeLabel: `int[${arr.length}]`,
        data: arr
      }
    })
)

function formatVal(v) {
  if (v === undefined || v === null) return String(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function hashCode(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h % 65536)
}
</script>

<style scoped>
.heap-stack-panel {
  margin-top: 12px;
  border-top: 1px solid var(--border);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  cursor: pointer;
  user-select: none;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
}
.section-toggle {
  color: var(--text-muted);
  font-size: 14px;
}

.hs-body {
  display: flex;
  gap: 6px;
}

/* Stack */
.stack-area {
  flex: 0 0 48%;
  min-width: 0;
}
.area-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.stack-frame {
  padding: 10px 12px;
}
.frame-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.frame-vars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stack-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 3px 6px;
  border-radius: 5px;
  background: rgba(255,255,255,0.03);
}
.si-name { color: var(--text-h); font-weight: 500; min-width: 40px }
.si-eq { color: var(--text-muted); font-size: 12px }
.si-value { color: #34d399; font-family: var(--mono); font-size: 12px }
.si-ref { color: var(--accent); font-family: var(--mono); font-size: 11px }
.stack-item.is-ref { background: rgba(10,132,255,0.06) }

/* Connector */
.connector-area {
  flex: 0 0 40px;
  display: flex;
  align-items: stretch;
  padding-top: 24px;
}
.connector-svg {
  width: 100%;
}

/* Heap */
.heap-area {
  flex: 1;
  min-width: 0;
}
.heap-object {
  padding: 8px 10px;
  margin-bottom: 8px;
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
  color: var(--accent);
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

.empty-hint {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px;
  text-align: center;
}

@media (max-width: 640px) {
  .hs-body { flex-direction: column }
  .stack-area { flex: none }
  .connector-area { display: none }
}
</style>
