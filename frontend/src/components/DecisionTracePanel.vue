<template>
  <div class="decision-trace">
    <!-- 正文：与现有助手消息一致，走 marked + XSS 防护；样式由父级 .chat-bubble 覆盖 -->
    <div class="trace-body" v-html="bodyHtml"></div>

    <!-- 决策痕迹元信息 -->
    <div v-if="trace" class="trace-meta">
      <div v-if="sources.length" class="trace-sources">
        <span v-for="s in sources" :key="s" class="trace-chip">{{ s }}</span>
      </div>

      <!-- 可折叠痕迹（蓝色圆点 + chevron，项目统一模式） -->
      <div class="trace-collapse">
        <div class="trace-header" @click="open = !open">
          <span class="trace-dot" />
          <span class="trace-title">决策痕迹</span>
          <svg
            class="trace-chevron"
            :class="{ rotated: open }"
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <pre v-if="open" class="trace-json">{{ traceJson }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

import { sourceLabels, splitDecisionTrace } from '../utils/decisionTrace.js'
import { renderMarkdown } from '../utils/markdown.js'

const props = defineProps({
  content: { type: String, default: '' },
})

const open = ref(false)

const parts = computed(() => splitDecisionTrace(props.content))
const bodyHtml = computed(() => renderMarkdown(parts.value.body))
const trace = computed(() => parts.value.trace)
const sources = computed(() => sourceLabels(trace.value))
const traceJson = computed(() => (trace.value ? JSON.stringify(trace.value, null, 2) : ''))
</script>

<style scoped>
.decision-trace { width: 100%; }
.trace-body { white-space: normal; }
.trace-meta {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
}
.trace-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}
.trace-chip {
  padding: 1px 8px;
  font-size: 11px;
  border-radius: 0;
  background: var(--accent-bg);
  color: var(--primary);
}
.trace-header {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.trace-dot {
  width: 7px;
  height: 7px;
  border-radius: 0;
  background: var(--primary);
  opacity: 0.8;
  flex-shrink: 0;
}
.trace-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.trace-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.trace-chevron.rotated { transform: rotate(180deg); }
.trace-json {
  margin: 4px 0 0;
  padding: 6px 8px;
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-muted);
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 0;
}
</style>
