<template>
  <div
    class="graph-node"
    :style="{ transform: `translate(${x}px, ${y}px)` }"
  >
    <div v-if="indexLabel" class="graph-node-index-label">{{ indexLabel }}</div>
    <div v-if="flowLabel" class="graph-node-flow-label">{{ flowLabel }}</div>
    <div class="graph-node-circle">
      <span class="graph-node-val">{{ formatVal(val) }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  id: { type: String, required: true },
  val: { type: [Number, String, Object, Boolean], default: null },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  flowLabel: { type: String, default: '' },
  indexLabel: { type: String, default: '' },
})

function formatVal(v) {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<style scoped>
.graph-node {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.graph-node-index-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.graph-node-flow-label {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 4px;
}

.graph-node-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.graph-node-val {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-h);
}
</style>
