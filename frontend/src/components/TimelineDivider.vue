<template>
  <!-- 时间线分割线：一条记录点（#N · 摘要）+「回退到此」；回退后其后对话折叠成一行提示 -->
  <div v-if="cp" class="tl-divider" :class="{ expired: cp.expired }">
    <span class="tl-rule" />
    <span class="tl-label">{{ cp.label }}</span>
    <button
      class="tl-revert"
      :disabled="cp.expired"
      :title="cp.expired ? '这条记录点的代码快照已被时间线上限丢弃' : '把编辑器代码与右侧面板回退到这次运行'"
      @click="revert"
    >{{ cp.expired ? '记录已过期' : '回退到此' }}</button>
    <span v-if="foldedCount > 0" class="tl-folded">
      以下 {{ foldedCount }} 条对话已折叠
      <button class="tl-expand" @click="store.foldFromIndex = null">展开</button>
    </span>
    <span class="tl-rule" />
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { usePlayerStore } from '../stores/player'
import { REVERT_CONFIRM } from '../utils/timeline'

const props = defineProps({
  /** 对应的记录点（`store.timeline[i]`）；超上限只丢快照、记录不删，故正常总能取到 */
  cp: { type: Object, default: null },
  /** > 0 时在分割线内渲染「以下 N 条对话已折叠 [展开]」（只在折叠起点那条上非零） */
  foldedCount: { type: Number, default: 0 },
})

const store = usePlayerStore()
// 整份代码回退通道（由 SingleFileShell / MultiFileShell provide）：
// 单文件 setCode；多文件按「-1 → 整项目替换 → 目标下标」三步（否则被文件切换 watcher 用陈旧内容覆写）
const restoreSource = inject('restoreSource', null)

async function revert() {
  if (!props.cp || props.cp.expired) return
  // 拿不到回退通道就什么也不做：只重跑而不写回代码会造成「编辑器是旧代码、右栏是新结果」的错配
  if (!restoreSource) return
  if (typeof window !== 'undefined' && typeof window.confirm === 'function'
    && !window.confirm(REVERT_CONFIRM)) return
  const ok = await restoreSource(props.cp)   // 先把代码写回编辑器/文件
  if (ok === false) return
  await store.revertToCheckpoint(props.cp)   // 折叠 + 静默重跑
}
</script>

<style scoped>
.tl-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
}
.tl-rule {
  flex: 1;
  height: 1px;
  background: var(--border);
}
.tl-label {
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}
.tl-revert,
.tl-expand {
  flex-shrink: 0;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border: 1px solid var(--border);
  background: none;
  color: var(--accent);
  cursor: pointer;
}
.tl-revert:hover:not(:disabled),
.tl-expand:hover { color: var(--text-h); background: var(--accent-bg); }
.tl-revert:disabled { color: var(--text-muted); cursor: not-allowed; border-style: dashed; }
.tl-divider.expired .tl-label { text-decoration: line-through; }
.tl-folded {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
}
.tl-expand { color: var(--accent); }
</style>
