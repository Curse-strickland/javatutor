<template>
  <div class="array-node" :class="{ head: isHead, tail: isTail, highlighted: isHighlighted }">
    <div class="array-node-val">{{ value == null ? '∅' : value }}</div>
    <div class="array-node-idx">{{ index }}</div>
  </div>
</template>

<script setup>
defineProps({
  value: { type: [Number, String, Object, Boolean], default: null },
  index: { type: Number, required: true },
  isHead: { type: Boolean, default: false },
  isTail: { type: Boolean, default: false },
  isHighlighted: { type: Boolean, default: false },
})
</script>

<style scoped>
.array-node {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  min-width: 56px;
  margin: 0 2px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-h);
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: background 0.15s, border-color 0.15s;
}
.array-node-val { padding: 6px 10px; min-width: 44px; text-align: center; }
.array-node-idx { padding: 2px 6px; font-size: 10px; color: var(--text-muted); border-top: 1px dashed var(--border); width: 100%; box-sizing: border-box; }
.array-node.head { border-color: var(--accent); }
.array-node.tail { border-color: var(--accent); }
.array-node.head .array-node-val::before { content: 'head ▲ '; font-size: 9px; color: var(--accent); }
.array-node.tail .array-node-val::after { content: ' ▲tail'; font-size: 9px; color: var(--accent); }
.array-node.highlighted { background: rgba(239, 71, 111, 0.15); border-color: #ef476f; }
</style>
