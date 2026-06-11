<template>
  <div class="rs-canvas">
    <div v-if="stackFrames.length === 0" class="rs-empty">调用栈为空</div>

    <div v-else class="rs-frames-container">
      <div
        v-for="(frame, index) in stackFrames"
        :key="frame.method"
        class="rs-frame"
        :class="{
          'active-frame': index === activeFrameIndex,
          'returning-frame': returningFrameIndicesSet.has(index),
        }"
      >
        <div class="rs-frame-header">
          <span class="rs-frame-name">{{ frame.method }}</span>
          <span class="rs-frame-index">#{{ index }}</span>
        </div>

        <div v-if="frame.locals && Object.keys(frame.locals).length > 0" class="rs-frame-vars">
          <div v-for="(value, key) in frame.locals" :key="key" class="rs-var-item">
            <span class="rs-var-key">{{ key }}:</span>
            <span class="rs-var-value">{{ formatValue(value) }}</span>
          </div>
        </div>

        <div v-if="frame.returnValue !== undefined && frame.returnValue !== null" class="rs-frame-return">
          <span class="rs-return-label">返回:</span>
          <span class="rs-return-value">{{ formatValue(frame.returnValue) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stackFrames: {
    type: Array,
    required: true,
  },
  activeFrameIndex: {
    type: Number,
    default: 0,
  },
  returningFrameIndices: {
    type: Array,
    default: () => [],
  },
})

const returningFrameIndicesSet = computed(() => new Set(props.returningFrameIndices || []))

function formatValue(value) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<style scoped>
.rs-canvas {
  width: 100%;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  min-height: 76px;
  overflow-x: auto;
}

.rs-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 16px 0;
}

.rs-frames-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rs-frame {
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transition: background 520ms cubic-bezier(.22,.9,.27,1),
              transform 320ms cubic-bezier(.22,.9,.27,1),
              box-shadow 320ms ease,
              border-color 320ms ease,
              opacity 320ms ease;
}

.rs-frame.active-frame {
  border-color: var(--primary);
  background: var(--accent-bg);
  box-shadow: 0 6px 14px rgba(37,99,235,0.10);
  transform: scale(1.01);
}

.rs-frame.returning-frame {
  border-color: var(--primary);
  background: var(--accent-bg);
  opacity: 0.65;
}

.rs-frame-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.rs-frame-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-h);
}

.rs-frame-index {
  font-size: 11px;
  color: var(--text-muted);
}

.rs-frame-vars {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 6px;
}

.rs-var-item {
  display: flex;
  font-size: 12px;
}

.rs-var-key {
  color: var(--text-muted);
  margin-right: 6px;
  font-weight: 500;
}

.rs-var-value {
  color: var(--text);
}

.rs-frame-return {
  display: flex;
  align-items: center;
  font-size: 12px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.rs-return-label {
  color: var(--text-muted);
  margin-right: 6px;
  font-weight: 500;
}

.rs-return-value {
  color: var(--primary);
  font-weight: 600;
}

@media (max-width: 640px) {
  .rs-frame {
    padding: 8px 10px;
  }
  .rs-frame-name { font-size: 12px; }
}
</style>
