<template>
  <div class="decision-trace">
    <!-- 正文：与 AiTutorPanel 共用同一套 XSS 防护的 markdown 渲染 -->
    <div class="trace-body" v-html="bodyHtml"></div>

    <div v-if="trace" class="trace-meta">
      <!-- 知识库来源标签 -->
      <div v-if="sources.length" class="trace-sources">
        <span v-for="s in sources" :key="s" class="trace-chip">{{ s }}</span>
      </div>

      <!-- 可折叠决策痕迹：蓝色圆点 + 标题 + chevron（设计系统统一折叠模式） -->
      <div class="trace-toggle" @click="open = !open">
        <span class="trace-dot" />
        <span class="trace-toggle-label">决策痕迹</span>
        <svg
          class="trace-chevron"
          :class="{ rotated: open }"
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <pre v-show="open" class="trace-json">{{ traceJson }}</pre>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

import { renderMarkdown } from '../utils/markdown.js'
import { sourceLabels, splitDecisionTrace } from '../utils/decisionTrace.js'

const props = defineProps({
  /** 完整消息文本：正文 + 【决策痕迹】JSON 标记 */
  content: { type: String, default: '' },
})

const open = ref(false)

const parts = computed(() => splitDecisionTrace(props.content))
const bodyHtml = computed(() => renderMarkdown(parts.value.body || ''))
const trace = computed(() => parts.value.trace)
const sources = computed(() => sourceLabels(trace.value))
const traceJson = computed(() => JSON.stringify(trace.value, null, 2))
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
.trace-json {
  margin: 6px 0 0;
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
