<template>
  <div class="console-panel card p-3 mb-3">
    <div class="console-header" @click="collapsed = !collapsed">
      <div class="flex items-center gap-2">
        <span class="console-dot" />
        <span class="text-sm font-semibold" style="color: var(--text-h)">控制台输出</span>
      </div>
      <svg
        class="console-chevron"
        :class="{ rotated: !collapsed }"
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
    <!-- 报错入口：常驻（不挂 6 秒即逝的 GlobalStatus toast），折叠时也保留；只预填不发送（spec D9） -->
    <div v-if="store.lastRunError" class="console-error-bar">
      <span class="console-error-text" :title="store.lastRunError.message">运行出错：{{ shortError }}</span>
      <button class="console-error-btn" @click="prefillFix">让 agent 帮我看看</button>
    </div>
    <pre v-if="displayOutput" v-show="!collapsed" class="console-body">{{ displayOutput }}</pre>
    <div v-else v-show="!collapsed" class="console-empty">暂无输出</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const collapsed = ref(false)

const displayOutput = computed(() => store.testMode ? store.output : store.currentOutput)

const shortError = computed(() => {
  const msg = store.lastRunError?.message || ''
  return msg.length > 60 ? `${msg.slice(0, 60)}…` : msg
})

/**
 * 只把「含错误的提问」写进 agent 输入框草稿，不发送（用户可编辑后再自行发送）。
 * 必须顺带切到 agent 面板：本入口渲染在「内存状态」pane，而输入框在「agent」pane，
 * 两个 pane 由互斥的 v-show 控制、从不同时可见——不切 tab 的话点击后画面毫无变化。
 */
function prefillFix() {
  const msg = store.lastRunError?.message || ''
  store.chatDraft = `我的代码运行报错了，请帮我看看怎么修正：\n${msg}`
  store.navigateTo('tutor')
}
</script>

<style scoped>
.console-panel {
  background: var(--card-bg);
  overflow: hidden;
}
.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  font-family: var(--mono);
}
.console-dot {
  width: 7px;
  height: 7px;
  border-radius: 0;
  background: var(--accent);
  clip-path: polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%);
  animation: console-pulse 2s steps(2) infinite;
}
@keyframes console-pulse {
  50% { opacity: 0.25; }
}
.console-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.console-chevron.rotated {
  transform: rotate(180deg);
}
.console-empty {
  margin: 10px 0 0;
  padding: 10px 14px;
  font-family: var(--mono);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  text-align: center;
  background: var(--code-bg);
  border: 1px solid var(--line, var(--border));
  border-left: 2px solid var(--accent);
}
.console-error-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 10px;
  background: rgba(220, 38, 38, 0.06);
  border: 1px solid var(--line, var(--border));
  border-left: 2px solid #dc2626;
}
.console-error-text {
  font-family: var(--mono);
  font-size: 11px;
  color: #dc2626;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.console-error-btn {
  flex-shrink: 0;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 10px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--primary);
  cursor: pointer;
  transition: box-shadow 160ms;
}
.console-error-btn:hover { box-shadow: 0 4px 12px var(--accent-bg); }
.console-body {
  margin: 10px 0 0;
  padding: 10px 14px;
  font-family: var(--mono);
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--fg, var(--text-h));
  background: var(--code-bg);
  border-radius: 0;
  border: 1px solid var(--line, var(--border));
  border-left: 2px solid var(--accent);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 220px;
  overflow-y: auto;
}
</style>
