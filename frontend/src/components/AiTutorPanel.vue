<template>
  <div class="ai-tutor-panel" :class="{ embedded }">
    <!-- Header -->
    <div class="ai-header">
      <div class="flex items-center gap-2">
        <span class="ai-dot" />
        <span class="text-sm font-semibold" style="color: var(--text-h)">智能体问答</span>
        <span class="ai-step-badge">{{ store.currentStep + 1 }} / {{ store.totalSteps }}</span>
      </div>
      <div class="flex items-center gap-3">
        <label class="auto-toggle" title="自动解说模式">
          <input type="checkbox" :checked="store.autoExplain" @change="store.toggleAutoExplain()" />
          <span class="auto-label">自动</span>
        </label>
        <button
          v-if="!embedded"
          class="ai-close"
          @click="store.toggleExplainPanel()"
          title="收起面板"
        >
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

    <!-- Tab: 解说（自由问答） -->
    <div v-if="store.activeAiTab === 'explain'" class="chat-pane">
      <div class="chat-body" ref="chatBodyRef">
        <div v-if="!store.chatMessages.length && !store.isExplaining" class="ai-hint">
          运行代码后，输入问题，AI 将结合当前步骤回答。
        </div>
        <div v-for="(m, i) in store.chatMessages" :key="i" class="chat-msg" :class="m.role">
          <div v-if="m.role === 'user'" class="chat-bubble user">{{ m.text }}</div>
          <div v-else class="chat-bubble assistant">
            <span v-if="!m.text && i === store.chatMessages.length - 1" class="chat-typing">…</span>
            <!-- 流式进行中：直接渲染正文，避免半截「决策痕迹」JSON 闪现；完成后由 DecisionTracePanel 切分 -->
            <DecisionTracePanel v-else-if="!isStreamingTail(i)" :content="m.text" />
            <span v-else v-html="renderMarkdown(m.text)"></span>
          </div>
        </div>
        <div v-if="store.explainError" class="ai-error">{{ store.explainError }}</div>
      </div>
      <!-- 快捷问题 + 输入框 -->
      <div class="chat-input-area">
        <div class="chat-quick">
          <button
            class="chat-quick-btn"
            :disabled="!store.code || store.isExplaining"
            @click="store.requestOverview()"
          >整体解说</button>
          <button
            class="chat-quick-btn"
            :disabled="!store.code || store.isExplaining || store.totalSteps === 0"
            @click="store.requestExplain()"
          >单步解说</button>
        </div>
        <div class="chat-input-row">
          <input
            v-model="chatInput"
            class="chat-input"
            placeholder="输入问题，如「为什么 arr[0] 变了？」"
            autocomplete="off"
            :disabled="!store.code || store.isExplaining"
            @keyup.enter="sendChat"
          />
          <button
            class="chat-send-btn"
            :disabled="!store.code || store.isExplaining || !chatInput.trim()"
            @click="sendChat"
          >
            <svg v-if="store.isExplaining" class="ai-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="9" stroke-dasharray="42" stroke-dashoffset="14" />
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            {{ store.isExplaining ? '生成中…' : '发送' }}
          </button>
        </div>
      </div>
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

  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player'
import { renderMarkdown } from '../utils/markdown.js'
import DecisionTracePanel from './DecisionTracePanel.vue'

defineProps({
  /** 嵌在右侧 INSPECT 分页时铺满高度，并隐藏关闭按钮 */
  embedded: { type: Boolean, default: false },
})

const store = usePlayerStore()
const chatBodyRef = ref(null)
const chatInput = ref('')
let chatResizeObserver = null

onMounted(() => {
  if (store.activeAiTab === 'animate') store.activeAiTab = 'explain'
  // Streamed markdown may grow without a new array entry — keep pinned to bottom
  if (typeof ResizeObserver !== 'undefined') {
    chatResizeObserver = new ResizeObserver(() => scrollChatToBottom())
  }
})

onBeforeUnmount(() => {
  chatResizeObserver?.disconnect()
  chatResizeObserver = null
})

function sendChat() {
  const q = chatInput.value.trim()
  if (!q || store.isExplaining) return
  chatInput.value = ''
  store.askQuestion(q)
}

// 当前正在流式累积的尾巴消息：保持正文直接渲染，等 isExplaining 结束后再切分痕迹
function isStreamingTail(i) {
  return store.isExplaining && i === store.chatMessages.length - 1
}

function scrollChatToBottom() {
  const el = chatBodyRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

async function pinChatToBottom() {
  await nextTick()
  scrollChatToBottom()
  // second frame: markdown layout / images may still settle
  requestAnimationFrame(() => scrollChatToBottom())
}

const tabs = [
  { id: 'explain', label: '解说' },
  { id: 'complexity', label: '复杂度' },
  { id: 'algorithm', label: '算法' },
]

// Markdown 渲染由 utils/markdown.js 统一提供（marked + XSS 防护）

// Auto-scroll：跟随流式解说贴底；观察消息内容高度变化
watch(
  () => store.chatMessages.map((m) => `${m.role}:${m.text?.length ?? 0}`).join('|'),
  async () => {
    await pinChatToBottom()
    const el = chatBodyRef.value
    if (el && chatResizeObserver) {
      chatResizeObserver.disconnect()
      for (const child of el.children) chatResizeObserver.observe(child)
    }
  },
)

watch(() => store.isExplaining, (busy) => {
  if (busy) pinChatToBottom()
})

watch(() => store.activeAiTab, (tab) => {
  if (tab === 'explain') pinChatToBottom()
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
  min-height: 0;
}
.ai-tutor-panel.embedded {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.chat-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}
.ai-tutor-panel.embedded .chat-pane,
.ai-tutor-panel.embedded .ai-body {
  flex: 1;
  min-height: 0;
}
.ai-tutor-panel.embedded .chat-body,
.ai-tutor-panel.embedded .ai-body {
  flex: 1;
  min-height: 0;
  max-height: none;
  margin-bottom: 0;
}

/* Header / tabs stay put */
.ai-header,
.ai-tabs {
  flex-shrink: 0;
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
  border-radius: 0;
  background: var(--accent);
  clip-path: polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%);
  animation: ai-dot-pulse 2s steps(2) infinite;
  flex-shrink: 0;
}
@keyframes ai-dot-pulse { 50% { opacity: 0.25; } }
.ai-step-badge {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
  background: var(--code-bg);
  border-radius: 0;
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
  padding: 3px; border-radius: 0;
  color: var(--text-muted); cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.ai-close:hover { color: var(--text-h); background: var(--accent-bg); }

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
  border-radius: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.15s;
}
.ai-tab:hover { color: var(--text); background: var(--accent-bg); }
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
  border-radius: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text);
  scroll-behavior: smooth;
}
.ai-hint { color: var(--text-muted); font-size: 14px; text-align: center; padding: 8px 0; }
.ai-loading { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted); font-size: 14px; padding: 8px 0; }
.ai-loading-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); animation: ai-blink 1.2s ease-in-out infinite; }
.ai-error { margin-top: 8px; padding: 6px 10px; font-size: 12px; color: var(--danger); background: var(--accent-bg); border-radius: 0; border-left: 2px solid var(--danger); word-break: break-all; max-height: 80px; overflow-y: auto; }

/* --- Complexity view --- */
.complexity-view { display: flex; flex-direction: column; gap: 10px; }
.complexity-row { display: flex; gap: 10px; }
.complexity-card {
  flex: 1;
  padding: 12px;
  border-radius: 0;
  background: var(--code-bg);
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
  border-radius: 0;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.ai-tag:hover { transform: scale(1.05); box-shadow: var(--shadow); }
.ai-tag:active { transform: scale(0.97); }

/* Tag colors — rhodes light-bg compatible */
.tag-blue    { background: var(--accent-bg); color: var(--primary); }
.tag-indigo  { background: rgba(79,70,229,0.10); color: #4f46e5; }
.tag-teal    { background: rgba(13,148,136,0.10); color: #0d9488; }
.tag-purple  { background: rgba(124,58,237,0.10); color: #7c3aed; }
.tag-cyan    { background: rgba(6,148,162,0.10); color: #0694a2; }
.tag-orange  { background: rgba(194,101,0,0.10); color: #c26500; }
.tag-sky     { background: rgba(2,132,199,0.10); color: #0284c7; }
.tag-emerald { background: rgba(5,150,105,0.10); color: #059669; }
.tag-amber   { background: rgba(180,98,0,0.10); color: #b46200; }
.tag-rose    { background: rgba(190,18,60,0.10); color: #be123c; }
.tag-slate   { background: rgba(71,85,105,0.10); color: #475569; }

/* --- Loading & spin --- */
.ai-spin { animation: spin 0.8s linear infinite; }

@keyframes ai-blink { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@keyframes spin { to { transform: rotate(360deg); } }

/* --- Chat (自由问答) --- */
.chat-body {
  min-height: 48px;
  max-height: 180px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scroll-behavior: auto;
}
.chat-msg {
  display: flex;
}
.chat-msg.user {
  justify-content: flex-end;
}
.chat-msg.assistant {
  justify-content: flex-start;
}
.chat-bubble {
  max-width: 88%;
  padding: 6px 10px;
  border-radius: 0;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}
.chat-bubble.user {
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--text);
  white-space: pre-wrap;
}
.chat-bubble.assistant {
  background: var(--code-bg);
  border: 1px solid var(--border);
  color: var(--text);
  white-space: normal;
}
.chat-bubble.assistant :deep(strong) { font-weight: 600; color: var(--text-h); }
.chat-bubble.assistant :deep(code) {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--code-bg);
  padding: 1px 4px;
  border-radius: 0;
  color: var(--primary);
}
.chat-bubble.assistant :deep(pre) {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 6px 8px;
  margin: 4px 0;
  overflow-x: auto;
  white-space: pre;
  font-size: 12px;
}
.chat-bubble.assistant :deep(pre code) { background: none; padding: 0; color: var(--text); }
.chat-bubble.assistant :deep(h1),
.chat-bubble.assistant :deep(h2),
.chat-bubble.assistant :deep(h3),
.chat-bubble.assistant :deep(h4) {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  margin: 8px 0 4px;
  line-height: 1.4;
}
.chat-bubble.assistant :deep(h1:first-child),
.chat-bubble.assistant :deep(h2:first-child),
.chat-bubble.assistant :deep(h3:first-child),
.chat-bubble.assistant :deep(h4:first-child) { margin-top: 0; }
.chat-bubble.assistant :deep(p) { margin: 0 0 6px; }
.chat-bubble.assistant :deep(p:last-child) { margin-bottom: 0; }
.chat-bubble.assistant :deep(ul),
.chat-bubble.assistant :deep(ol) { margin: 4px 0; padding-left: 18px; }
.chat-bubble.assistant :deep(li) { margin-bottom: 2px; }
.chat-bubble.assistant :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 8px 0;
}
.chat-bubble.assistant :deep(em) { color: var(--text-muted); }
.chat-typing { color: var(--text-muted); }
.chat-input-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  /* 抬高发送区，避开右下角版权声明，不影响其它 Tab / 主页面 */
  padding-bottom: 72px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--card-bg, var(--bg));
}
.chat-quick {
  display: flex;
  gap: 6px;
}
.chat-quick-btn {
  padding: 4px 10px;
  border-radius: 0;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 160ms cubic-bezier(.22,.9,.27,1), box-shadow 160ms, opacity 160ms;
}
.chat-quick-btn:hover:not(:disabled) { box-shadow: 0 4px 12px var(--accent-bg); }
.chat-quick-btn:active:not(:disabled) { transform: translateY(1px) scale(0.997); }
.chat-quick-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.chat-input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.chat-input {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 0;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.2s;
}
.chat-input:focus {
  border-color: var(--accent-border);
}
.chat-input::placeholder {
  color: var(--text-muted);
}
.chat-send-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-radius: 0;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 160ms cubic-bezier(.22,.9,.27,1), box-shadow 160ms, opacity 160ms;
}
.chat-send-btn:hover:not(:disabled) { box-shadow: 0 4px 12px var(--accent-bg); }
.chat-send-btn:active:not(:disabled) { transform: translateY(1px) scale(0.997); }
.chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (prefers-reduced-motion: reduce) {
  .ai-loading-dot, .ai-spin { animation: none; }
  .ai-tag, .chat-quick-btn, .chat-send-btn { transition: none; }
}

</style>
