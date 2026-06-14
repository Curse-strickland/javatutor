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
      <div v-else-if="store.analysisError" class="ai-error">{{ store.analysisError }}</div>
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
      <div v-else-if="store.analysisError" class="ai-error">{{ store.analysisError }}</div>
      <div v-else class="ai-hint">运行代码后自动分析。</div>
    </div>

    <!-- Tab: 算法标签 -->
    <div v-if="store.activeAiTab === 'algorithm'" class="ai-body">
      <div v-if="store.isAnalyzing" class="ai-loading">
        <span class="ai-loading-dot" />分析中…
      </div>
      <div v-else-if="store.analysisError" class="ai-error">{{ store.analysisError }}</div>
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

    <!-- 自定义 API（可折叠） -->
    <div class="api-key-section">
      <div class="api-key-header" @click="apiOpen = !apiOpen">
        <svg class="api-chevron" :class="{ rotated: apiOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span class="api-key-label">自定义 API</span>
        <span v-if="store.userApiKey" class="api-status-saved">{{ currentProviderLabel }}</span>
        <span v-else class="api-status-default">智谱</span>
      </div>
      <div v-show="apiOpen" class="api-key-body">
        <!-- 智谱免费 Key 引导（未配置 Key 时显示） -->
        <div v-if="!store.userApiKey" class="api-zhipu-guide">
          <div class="api-zhipu-guide-title">智谱 GLM-4-Flash 免费额度</div>
          <p class="api-zhipu-guide-text">
            注册智谱 AI 开放平台即可获取免费 API Key，用于 AI 解说功能。
          </p>
          <a
            class="api-zhipu-guide-link"
            href="https://open.bigmodel.cn"
            target="_blank"
            rel="noopener"
          >前往 open.bigmodel.cn 注册获取 Key</a>
        </div>
        <div class="api-provider-chips">
          <button
            v-for="(p, k) in store.apiProviders" :key="k"
            class="api-provider-chip"
            :class="{ active: selectedProvider === k }"
            @click="selectedProvider = k; onProviderChange()"
          >{{ p.label }}</button>
        </div>
        <div class="api-key-row">
          <input
            type="password"
            class="api-key-input"
            v-model="apiKeyInput"
            :placeholder="currentProviderPlaceholder"
            autocomplete="off"
            @keyup.enter="saveApiKey"
          />
          <button class="api-save-btn" @click="saveApiKey">保存</button>
        </div>
        <div v-if="selectedProvider === 'custom'" class="api-custom-fields">
          <input class="api-custom-input" v-model="customUrl" placeholder="API URL (https://.../v1/chat/completions)" />
          <input class="api-custom-input" v-model="customModel" placeholder="Model 名称" />
        </div>
        <div v-if="apiKeyError" class="api-key-error">{{ apiKeyError }}</div>
        <div v-if="store.userApiKey" class="api-key-row">
          <span class="api-key-saved-hint">已保存自定义 Key（仅本次会话）</span>
          <button class="api-clear-btn" @click="clearApiKey">清除</button>
        </div>
        <p v-else class="api-key-hint">选择平台并填入 Key 即可使用 AI 解说。</p>
      </div>
    </div>

    <!-- Footer: manual explain buttons (解说 tab only) -->
    <div v-if="!store.autoExplain && store.activeAiTab === 'explain'" class="ai-footer">
      <button
        class="ai-explain-btn"
        :disabled="!store.code || store.isExplaining"
        @click="store.requestOverview()"
        title="AI 综述整体代码的算法思路和数据结构"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        整体解说
      </button>
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
        {{ store.isExplaining ? '生成中…' : '单步解说' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const bodyRef = ref(null)
const apiOpen = ref(false)
const apiKeyInput = ref('')
const apiKeyError = ref('')
const selectedProvider = ref('zhipu')
const customUrl = ref('')
const customModel = ref('')

const currentProviderPlaceholder = computed(() => {
  const p = store.apiProviders[selectedProvider.value]
  return p ? p.keyHint : 'API Key'
})

const currentProviderLabel = computed(() => {
  const p = store.apiProviders[store.apiProvider]
  return p ? p.label : ''
})

function onProviderChange() {
  apiKeyError.value = ''
  apiKeyInput.value = ''
}

function saveApiKey() {
  const val = apiKeyInput.value.trim()
  if (!val) {
    store.userApiKey = ''
    apiKeyError.value = ''
    return
  }
  const provider = selectedProvider.value
  const p = store.apiProviders[provider]
  if (!p) { apiKeyError.value = '未知平台'; return }

  if (!p.keyRe.test(val)) {
    apiKeyError.value = 'Key 格式不匹配 ' + p.label + ' 的要求（' + p.keyHint + '）'
    return
  }
  store.apiProvider = provider
  store.userApiKey = val
  if (provider === 'custom') {
    store.apiUrl = customUrl.value.trim()
    store.apiModel = customModel.value.trim()
    if (!store.apiUrl) { apiKeyError.value = '请填写 API URL'; return }
  }
  apiKeyError.value = ''
}

function clearApiKey() {
  store.userApiKey = ''
  store.apiProvider = 'zhipu'
  selectedProvider.value = 'zhipu'
  apiKeyInput.value = ''
  customUrl.value = ''
  customModel.value = ''
  apiKeyError.value = ''
}

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
.ai-error { margin-top: 8px; padding: 6px 10px; font-size: 12px; color: #e57373; background: rgba(229,115,115,0.08); border-radius: 6px; border-left: 2px solid #e57373; word-break: break-all; max-height: 80px; overflow-y: auto; }

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
.ai-footer { display: flex; justify-content: flex-end; gap: 8px; }
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

/* --- Custom API Key --- */
.api-key-section {
  border-top: 1px solid var(--border);
  padding-top: 8px;
  margin-top: 4px;
}
.api-key-header {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.api-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.api-chevron.rotated {
  transform: rotate(90deg);
}
.api-key-label {
  font-size: 11px;
  color: var(--text-muted);
}
.api-status-saved {
  font-size: 10px;
  color: var(--primary);
  background: var(--accent-bg);
  padding: 1px 6px;
  border-radius: 4px;
}
.api-status-default {
  font-size: 10px;
  color: var(--text-muted);
}
.api-key-body {
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.api-key-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.api-provider-chips {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
}
.api-provider-chip {
  padding: 5px 11px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  outline: none;
}
.api-provider-chip:hover {
  color: var(--text);
  border-color: var(--accent-border);
}
.api-provider-chip.active {
  color: var(--primary);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}
.api-custom-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}
.api-custom-input {
  font-family: var(--mono);
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.2s;
}
.api-custom-input:focus { border-color: var(--accent-border); }
.api-custom-input::placeholder { color: var(--text-muted); opacity: 0.5; }
.api-key-input {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.2s;
}
.api-key-input:focus {
  border-color: var(--accent-border);
}
.api-key-input::placeholder {
  color: var(--text-muted);
}
.api-save-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.api-save-btn:hover {
  background: rgba(10,132,255,0.18);
}
.api-clear-btn {
  padding: 2px 8px;
  border-radius: 5px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
}
.api-clear-btn:hover {
  color: #e57373;
}
.api-key-error {
  font-size: 11px;
  color: #e57373;
  padding: 4px 8px;
  background: rgba(229,115,115,0.08);
  border-radius: 5px;
  border-left: 2px solid #e57373;
  word-break: break-all;
}
.api-key-saved-hint {
  font-size: 10px;
  color: var(--text-muted);
}
.api-key-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0;
}

/* 智谱免费 Key 引导 */
.api-zhipu-guide {
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: rgba(10,132,255,0.06);
  border: 1px solid rgba(10,132,255,0.12);
}
.api-zhipu-guide-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 4px;
}
.api-zhipu-guide-text {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 6px;
  line-height: 1.5;
}
.api-zhipu-guide-link {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  color: var(--primary);
  text-decoration: none;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  transition: background 0.15s;
}
.api-zhipu-guide-link:hover {
  background: rgba(10,132,255,0.18);
}

@media (prefers-reduced-motion: reduce) {
  .ai-loading-dot, .ai-spin { animation: none; }
  .ai-explain-btn, .ai-tag { transition: none; }
}
</style>
