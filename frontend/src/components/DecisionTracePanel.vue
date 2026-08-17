<template>
  <div class="decision-trace">
    <!-- 正文：与 AiTutorPanel 共用同一套 XSS 防护的 markdown 渲染 -->
    <div class="trace-body" v-html="bodyHtml"></div>

    <div v-if="trace" class="trace-meta">
      <!-- 知识库来源标签 -->
      <div v-if="sources.length" class="trace-sources">
        <span v-for="s in sources" :key="s" class="trace-chip">{{ s }}</span>
      </div>

      <!-- 可折叠执行过程摘要：蓝色圆点 + 标题 + chevron（设计系统统一折叠模式） -->
      <div
        class="trace-toggle"
        role="button"
        tabindex="0"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="tracePanelId"
        @click="open = !open"
        @keydown.enter.prevent="open = !open"
        @keydown.space.prevent="open = !open"
      >
        <span class="trace-dot" />
        <span class="trace-toggle-label">执行过程</span>
        <svg
          class="trace-chevron"
          :class="{ rotated: open }"
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <div v-show="open" :id="tracePanelId" class="trace-panel">
        <!-- 用户可读的执行过程摘要 -->
        <div v-if="hasSummary" class="trace-summary">
          <span v-if="summary.intentLabel" class="trace-intent">{{ summary.intentLabel }}</span>
          <span v-if="summary.reviseText" class="trace-revise">{{ summary.reviseText }}</span>
          <ul v-if="summary.toolLines.length" class="trace-tools">
            <li v-for="(line, i) in summary.toolLines" :key="i">{{ line }}</li>
          </ul>
          <span v-else-if="summary.toolEmptyText" class="trace-revise">{{ summary.toolEmptyText }}</span>
          <div class="trace-metrics">
            <span v-if="summary.latencyText" class="trace-metric">{{ summary.latencyText }}</span>
            <span v-if="summary.tokenText" class="trace-metric">{{ summary.tokenText }}</span>
          </div>
        </div>
        <!-- 原始 JSON 仅开发者模式可见（?dev=1 或 localStorage jt-dev=1） -->
        <pre v-if="devMode" class="trace-json">{{ traceJson }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

import { renderMarkdown } from '../utils/markdown.js'
import { sourceLabels, splitDecisionTrace, traceSummary } from '../utils/decisionTrace.js'

const props = defineProps({
  /** 完整消息文本：正文 + 【决策痕迹】JSON 标记 */
  content: { type: String, default: '' },
})

const open = ref(true)

// 每条消息一个独立实例，折叠区 id 需唯一（aria-controls 引用）
const tracePanelId = `decision-trace-panel-${Math.random().toString(36).slice(2, 8)}`

const parts = computed(() => splitDecisionTrace(props.content))
const bodyHtml = computed(() => renderMarkdown(parts.value.body || ''))
const trace = computed(() => parts.value.trace)
const sources = computed(() => sourceLabels(trace.value))
const summary = computed(() => traceSummary(trace.value))
const hasSummary = computed(() =>
  summary.value.intentLabel !== '' || summary.value.reviseText !== '' ||
  summary.value.toolLines.length > 0 || summary.value.toolEmptyText !== '' ||
  summary.value.latencyText !== '' ||
  summary.value.tokenText !== ''
)
const traceJson = computed(() => JSON.stringify(trace.value, null, 2))

// 开发者模式：URL 带 ?dev=1 或 localStorage 标记 jt-dev=1 时展示原始 JSON
const devMode = computed(() => {
  try {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1') return true
    if (typeof localStorage !== 'undefined' && localStorage.getItem('jt-dev') === '1') return true
  } catch { /* 安全模式/SSR 忽略 */ }
  return false
})
</script>

<style scoped>
.decision-trace {
  /* 正文 markdown 样式由父级 .chat-bubble.assistant 的 :deep 规则接管 */
}
.trace-body {
  word-break: break-word;
}
.trace-meta {
  margin-top: 8px;
}
.trace-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.trace-chip {
  padding: 2px 8px;
  border-radius: 0;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--primary);
  font-size: 11px;
  font-weight: 500;
  clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
}
.trace-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  color: var(--text-muted);
}
.trace-dot {
  width: 7px;
  height: 7px;
  border-radius: 0;
  background: var(--accent);
  clip-path: polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%);
  animation: trace-pulse 2s steps(2) infinite;
  flex-shrink: 0;
}
@keyframes trace-pulse { 50% { opacity: 0.28; } }
.trace-toggle-label {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.trace-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.trace-chevron.rotated {
  transform: rotate(180deg);
}
.trace-panel {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.trace-summary {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.trace-intent {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary);
}
.trace-revise {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
}
.trace-tools {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.trace-tools li {
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}
.trace-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 2px;
}
.trace-metric {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
}
.trace-json {
  margin: 4px 0 0;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--bg-2);
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-muted);
  max-height: 160px;
  overflow-y: auto;
}
@media (prefers-reduced-motion: reduce) {
  .trace-dot { animation: none; }
  .trace-chevron { transition: none; }
}
</style>
