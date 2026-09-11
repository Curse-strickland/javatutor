<template>
  <div class="algo-tab">
    <div class="algo-subtab-row">
      <button
        class="algo-subtab"
        :class="{ active: store.algoSubTab === 'knowledge' }"
        @click="store.algoSubTab = 'knowledge'"
      >算法知识</button>
      <button
        class="algo-subtab"
        :class="{ active: store.algoSubTab === 'template' }"
        @click="store.algoSubTab = 'template'"
      >算法模板</button>
    </div>
    <AlgoKnowledgeHeader v-show="store.algoSubTab === 'knowledge'" />
    <section v-show="store.algoSubTab === 'template'" class="algo-section algo-section-fill">
      <h4 class="algo-section-h">经典算法（预置）</h4>
      <ClassicCodePanel @loadCode="$emit('loadCode', $event)" />
    </section>
  </div>
</template>

<script setup>
import { usePlayerStore } from '../../stores/player'
import AlgoKnowledgeHeader from '../AlgoKnowledgeHeader.vue'
import ClassicCodePanel from '../ClassicCodePanel.vue'

defineEmits(['loadCode'])

const store = usePlayerStore()
// 子标签（算法知识/算法模板）提升到 store.algoSubTab，供视角导航 navigateTo 的 algo.subTab 精确定位
</script>

<style scoped>
.algo-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.algo-subtab-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 0;
  border-bottom: 1px solid var(--border);
}
.algo-subtab {
  background: none;
  border: none;
  padding: 5px 12px 6px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.15s, box-shadow 0.15s;
}
.algo-subtab:hover { color: var(--text-h); background: var(--accent-bg); }
.algo-subtab.active {
  color: var(--accent);
  box-shadow: inset 0 -2px 0 var(--accent);
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
