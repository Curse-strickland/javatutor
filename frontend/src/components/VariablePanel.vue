<template>
  <div class="variable-panel">
    <div class="mb-3">
      <h4 class="text-lg font-semibold">变量卡片</h4>
      <p class="text-sm text-gray-500">只读展示当前步骤变量，值变化会短暂高亮。</p>
    </div>

    <div v-if="keys.length === 0" class="text-sm text-gray-500">暂无变量</div>

    <div v-else class="grid gap-2">
      <div
        v-for="key in keys"
        :key="key"
        :data-key="key"
        class="card p-3 rounded border flex items-center justify-between bg-white dark:bg-gray-800 gap-4"
        :class="{ flash: flashKeys[key] }"
      >
        <div class="name-col w-28 flex-shrink-0">
          <div class="font-medium text-sm text-gray-800 dark:text-gray-100">{{ key }}</div>
        </div>

        <div class="value-col flex-1 min-w-0">
          <pre
            :class="{ 'value-flash': valueFlashKeys[key] }"
            class="text-xs whitespace-pre-wrap break-words text-gray-600 dark:text-gray-300 m-0"
          >{{ pretty(variables[key]) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, watch, nextTick } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const variables = computed(() => store.currentVariables || {})
const keys = computed(() => Object.keys(variables.value))

const flashKeys = reactive({})
const valueFlashKeys = reactive({})

watch(
  variables,
  (newVal, oldVal) => {
    const newObj = newVal || {}
    const oldObj = oldVal || {}
    const all = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
    const isInitial = oldVal === undefined
    all.forEach((k) => {
      const a = JSON.stringify(oldObj[k])
      const b = JSON.stringify(newObj[k])
      if (!isInitial && a !== b) {
        // 卡片整体特效 + 值局部高亮
        flashKeys[k] = true
        valueFlashKeys[k] = true
        setTimeout(() => { flashKeys[k] = false }, 700)
        setTimeout(() => { valueFlashKeys[k] = false }, 700)
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
</script>

<style scoped>
.variable-panel pre { background: transparent; margin: 0; }
.card { position: relative; overflow: visible; transition: transform .18s ease, box-shadow .22s ease; }
.card .value-wrap pre { margin: 0; background: transparent; }
.card.flash {
  transform: translateY(-4px);
  box-shadow: 0 10px 24px rgba(14,165,233,0.08);
  background-color: rgba(99,102,241,0.08); /* 柔和靛蓝底 */
  border-color: rgba(99,102,241,0.18);
  z-index: 2;
}
.card.flash::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 6px;
  background: linear-gradient(180deg,#60a5fa,#2563eb);
  border-radius: 4px 0 0 4px;
  box-shadow: 0 6px 18px rgba(37,99,235,0.08);
}

.value-flash {
  background: rgba(99,102,241,0.12);
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
  color: inherit;
}

@keyframes slideBar {
  from { transform: translateX(-6px); opacity: 0 }
  to { transform: translateX(0); opacity: 1 }
}
</style>
