<template>
  <div v-if="visible.length" class="nav-card">
    <div class="nav-head">前往</div>
    <div class="nav-list">
      <button v-for="v in visible" :key="v.panel + (v.sub || '')" class="nav-btn" @click="go(v)">
        {{ label(v) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'

const props = defineProps({
  views: { type: Array, default: () => [] },
})
const store = usePlayerStore()

// 按当前模式裁剪 panel，避免 agent 违规发出多文件 panel（如单文件模式下的 callgraph）时出现「点开无反应」的死按钮
const SINGLE = ['variables', 'flow', 'datastructure', 'algorithm', 'tutor']
const MULTI = ['variables', 'flow', 'datastructure', 'callgraph', 'classdiagram', 'structure', 'algorithm', 'tutor']
const visible = computed(() =>
  (props.views || []).filter((v) => (store.mode === 'multi' ? MULTI : SINGLE).includes(v.panel))
)

const PANEL_LABELS = {
  variables: '内存状态', flow: '流程', datastructure: '数据结构', algorithm: '算法库',
  tutor: 'agent', callgraph: '调用关系', classdiagram: '类图', structure: '结构',
}
function label(v) { return v.label || PANEL_LABELS[v.panel] || v.panel }
function go(v) { store.navigateTo(v.panel, v.sub) }
</script>

<style scoped>
.nav-card { margin-top: 6px; padding: 8px 10px; border: 1px solid var(--border); background: var(--code-bg); }
.nav-head { font-family: var(--mono); font-size: 11px; color: var(--text-muted); margin-bottom: 6px; }
.nav-list { display: flex; flex-wrap: wrap; gap: 6px; }
.nav-btn { padding: 4px 10px; border: 1px solid var(--accent-border); background: var(--accent-bg); color: var(--primary); font-size: 12px; cursor: pointer; }
.nav-btn:hover { box-shadow: 0 4px 12px var(--accent-bg); }
</style>
