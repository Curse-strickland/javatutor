<template>
  <div class="ai-tutor-panel">
    <!-- Header -->
    <div class="ai-header">
      <div class="flex items-center gap-2">
        <span class="ai-dot" />
        <span class="text-sm font-semibold" style="color: var(--text-h)">AI 解说</span>
        <span class="ai-step-badge">{{ store.currentStep + 1 }} / {{ store.totalSteps }}</span>
      </div>
      <div class="flex items-center gap-3">
        <label class="auto-toggle" title="自动解说模式">
          <input type="checkbox" :checked="store.autoExplain" @change="store.toggleAutoExplain()" />
          <span class="auto-label">自动</span>
        </label>
        <button class="ai-close" @click="store.toggleExplainPanel()" title="收起面板">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="ai-tabs">
      <button
        v-for="tab in tabs" :key="tab.id"
        class="ai-tab"
        :class="{ active: store.activeAiTab === tab.id }"
        @click="store.switchAiTab(tab.id)"
      >{{ tab.label }}</button>
    </div>

    <!-- Tab: 解说 -->
    <div v-if="store.activeAiTab === 'explain'" class="ai-body" ref="bodyRef">
      <div v-if="!store.code" class="ai-hint">请先运行代码，然后点击「解说」了解当前步骤。</div>
      <div v-else-if="store.isExplaining && !store.explainText" class="ai-loading">
        <span class="ai-loading-dot" />生成解说中…
      </div>
      <div v-else-if="store.explainText" class="ai-text" v-html="renderedHtml"></div>
      <div v-else class="ai-hint">点击下方「解说」按钮，AI 将解释当前步骤正在做什么。</div>
      <div v-if="store.explainError" class="ai-error">{{ store.explainError }}</div>
    </div>

    <!-- Tab: 复杂度分析 -->
    <div v-if="store.activeAiTab === 'complexity'" class="ai-body">
      <div v-if="store.isAnalyzing" class="ai-loading">
        <span class="ai-loading-dot" />分析中…
      </div>
      <div v-else-if="store.analysisData?.complexity" class="complexity-view">
        <div class="complexity-row">
          <div class="complexity-card">
            <div class="complexity-label">时间复杂度</div>
            <div class="complexity-value">{{ store.analysisData.complexity.time }}</div>
            <div class="complexity-desc">{{ store.analysisData.complexity.timeExplanation }}</div>
          </div>
          <div class="complexity-card">
            <div class="complexity-label">空间复杂度</div>
            <div class="complexity-value">{{ store.analysisData.complexity.space }}</div>
            <div class="complexity-desc">{{ store.analysisData.complexity.spaceExplanation }}</div>
          </div>
        </div>
      </div>
      <div v-else class="ai-hint">运行代码后自动分析。</div>
    </div>

    <!-- Tab: 算法标签 -->
    <div v-if="store.activeAiTab === 'algorithm'" class="ai-body">
      <div v-if="store.isAnalyzing" class="ai-loading">
        <span class="ai-loading-dot" />分析中…
      </div>
      <template v-else-if="store.analysisData?.algorithms || store.analysisData?.dataStructures">
        <div v-if="store.analysisData.algorithms?.length" class="tag-group">
          <div class="tag-group-label">算法</div>
          <div class="tag-row">
            <button
              v-for="algo in store.analysisData.algorithms" :key="algo.name"
              class="ai-tag" :class="tagClass(algo.category)"
              @click="explainTag(algo.name)"
              title="点击查看详细解说"
            >{{ algo.name }}</button>
          </div>
        </div>
        <div v-if="store.analysisData.dataStructures?.length" class="tag-group">
          <div class="tag-group-label">数据结构</div>
          <div class="tag-row">
            <button
              v-for="ds in store.analysisData.dataStructures" :key="ds.name"
              class="ai-tag" :class="tagClass(ds.category)"
              @click="explainTag(ds.name)"
              title="点击查看详细解说"
            >{{ ds.name }}</button>
          </div>
        </div>
      </template>
      <div v-else class="ai-hint">运行代码后自动分析。</div>
    </div>

    <!-- Footer: manual explain button (解说 tab only) -->
    <div v-if="!store.autoExplain && store.activeAiTab === 'explain'" class="ai-footer">
      <button
        class="ai-explain-btn"
        :disabled="!store.code || store.isExplaining || store.totalSteps === 0"
        @click="store.requestExplain()"
      >
        <svg v-if="store.isExplaining" class="ai-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="9" stroke-dasharray="42" stroke-dashoffset="14" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z" />
        </svg>
        {{ store.isExplaining ? '生成中…' : '解说' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const bodyRef = ref(null)

const tabs = [
  { id: 'explain', label: '解说' },
  { id: 'complexity', label: '复杂度' },
  { id: 'algorithm', label: '算法' }
]

// Lightweight Markdown renderer — avoids edge cases with third-party parsers
function renderMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Inline code (must run before bold to avoid ** inside code)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  return html
}

const renderedHtml = computed(() => {
  if (!store.explainText) return ''
  return renderMarkdown(store.explainText)
})

// Auto-scroll
watch(() => store.explainText, async () => {
  await nextTick()
  if (bodyRef.value) {
    bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  }
})

// Tag color mapping
const TAG_COLORS = {
  '排序': 'tag-blue',
  '搜索': 'tag-indigo',
  '递归': 'tag-teal',
  '动态规划': 'tag-purple',
  '贪心': 'tag-cyan',
  '分治': 'tag-orange',
  '遍历': 'tag-sky',
  '其他': 'tag-slate',
  '数组': 'tag-blue',
  '链表': 'tag-teal',
  '栈': 'tag-indigo',
  '队列': 'tag-sky',
  '树': 'tag-emerald',
  '图': 'tag-purple',
  '哈希表': 'tag-amber',
  '堆': 'tag-rose',
  '字符串': 'tag-slate',
}

function tagClass(category) {
  return TAG_COLORS[category] || 'tag-slate'
}

function explainTag(tagName) {
  store.activeAiTab = 'explain'
  store.requestExplain(tagName)
}
</script>

<style scoped>
.ai-tutor-panel {
  display: flex;
  flex-direction: column;
}

/* Header */
.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
}
.ai-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.8;
  flex-shrink: 0;
}
.ai-step-badge {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
  background: var(--code-bg);
  border-radius: 5px;
  padding: 1px 6px;
}

/* Auto toggle */
.auto-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}
.auto-toggle input {
  width: 13px; height: 13px;
  accent-color: var(--primary);
  cursor: pointer;
  margin: 0;
}
.auto-label { font-size: 13px; color: var(--text-muted); transition: color 0.2s; }
.auto-toggle input:checked ~ .auto-label { color: var(--primary); }

/* Close */
.ai-close {
  display: flex; align-items: center; justify-content: center;
  background: none; border: none;
  padding: 3px; border-radius: 5px;
  color: var(--text-muted); cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.ai-close:hover { color: var(--text-h); background: rgba(255,255,255,0.06); }

/* --- Tab bar --- */
.ai-tabs {
  display: flex;
  gap: 2px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.ai-tab {
  background: none;
  border: none;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.15s;
}
.ai-tab:hover { color: var(--text); background: rgba(255,255,255,0.04); }
.ai-tab.active {
  color: var(--primary);
  background: var(--accent-bg);
}

/* --- Body --- */
.ai-body {
  min-height: 48px;
  max-height: 180px;
  overflow-y: auto;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text);
  scroll-behavior: smooth;
}
.ai-hint { color: var(--text-muted); font-size: 14px; text-align: center; padding: 8px 0; }
.ai-loading { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted); font-size: 14px; padding: 8px 0; }
.ai-loading-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); animation: ai-blink 1.2s ease-in-out infinite; }
.ai-error { margin-top: 8px; padding: 6px 10px; font-size: 13px; color: #e57373; background: rgba(229,115,115,0.08); border-radius: 6px; border-left: 2px solid #e57373; }

/* --- Complexity view --- */
.complexity-view { display: flex; flex-direction: column; gap: 10px; }
.complexity-row { display: flex; gap: 10px; }
.complexity-card {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
}
.complexity-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.complexity-value {
  font-family: var(--mono);
  font-size: 22px;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 6px;
}
.complexity-desc { font-size: 13px; color: var(--text); line-height: 1.5; }

/* --- Algorithm tags --- */
.tag-group { margin-bottom: 12px; }
.tag-group:last-child { margin-bottom: 0; }
.tag-group-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.tag-row { display: flex; flex-wrap: wrap; gap: 6px; }
.ai-tag {
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.ai-tag:hover { transform: scale(1.05); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
.ai-tag:active { transform: scale(0.97); }

/* Tag colors — subtle, low-saturation */
.tag-blue    { background: rgba(10,132,255,0.15); color: #93c5fd; }
.tag-indigo  { background: rgba(99,102,241,0.15); color: #c7d2fe; }
.tag-teal    { background: rgba(45,212,191,0.15); color: #5eead4; }
.tag-purple  { background: rgba(168,85,247,0.15); color: #d8b4fe; }
.tag-cyan    { background: rgba(34,211,238,0.15); color: #67e8f9; }
.tag-orange  { background: rgba(251,146,60,0.15); color: #fdba74; }
.tag-sky     { background: rgba(56,189,248,0.15); color: #7dd3fc; }
.tag-emerald { background: rgba(52,211,153,0.15); color: #6ee7b7; }
.tag-amber   { background: rgba(251,191,36,0.15); color: #fde68a; }
.tag-rose    { background: rgba(244,63,94,0.15); color: #fda4af; }
.tag-slate   { background: rgba(148,163,184,0.12); color: #cbd5e1; }

/* --- Footer --- */
.ai-footer { display: flex; justify-content: flex-end; }
.ai-explain-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 10px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--primary);
  font-size: 14px; font-weight: 600;
  cursor: pointer;
  transition: transform 160ms cubic-bezier(.22,.9,.27,1), box-shadow 160ms, opacity 160ms;
}
.ai-explain-btn:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(10,132,255,0.15); }
.ai-explain-btn:active:not(:disabled) { transform: translateY(1px) scale(0.997); }
.ai-explain-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ai-spin { animation: spin 0.8s linear infinite; }

/* Markdown rendered */
.ai-text { color: var(--text); white-space: pre-wrap; word-break: break-word; }
.ai-text :deep(p) { margin: 0 0 6px; }
.ai-text :deep(p:last-child) { margin-bottom: 0; }
.ai-text :deep(strong) { font-weight: 600; color: var(--text-h); }
.ai-text :deep(code) { font-family: var(--mono); font-size: 13px; background: var(--code-bg); padding: 1px 5px; border-radius: 4px; color: var(--primary); }
.ai-text :deep(pre) { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; margin: 6px 0; overflow-x: auto; white-space: pre; font-size: 13px; }
.ai-text :deep(pre code) { background: none; padding: 0; color: var(--text); }
.ai-text :deep(ul), .ai-text :deep(ol) { margin: 4px 0; padding-left: 18px; }
.ai-text :deep(li) { margin-bottom: 2px; }
.ai-text :deep(em) { color: var(--text-muted); }

@keyframes ai-blink { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .ai-loading-dot, .ai-spin { animation: none; }
  .ai-explain-btn, .ai-tag { transition: none; }
}
</style>
