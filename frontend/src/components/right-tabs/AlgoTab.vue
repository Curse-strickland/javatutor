<template>
  <div class="algo-tab">
    <AlgoKnowledgeHeader />
    <section class="algo-section algo-section-fill">
      <h4 class="algo-section-h">经典算法（预置）</h4>
      <ClassicCodePanel @loadCode="$emit('loadCode', $event)" />
    </section>
  </div>
</template>

<script setup>
import AlgoKnowledgeHeader from '../AlgoKnowledgeHeader.vue'
import ClassicCodePanel from '../ClassicCodePanel.vue'

defineEmits(['loadCode'])
</script>

<style scoped>
.algo-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.algo-section {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}
.algo-section-fill {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-bottom: none;
}
.algo-section-h {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-h);
  margin: 0 0 8px;
}
</style>
