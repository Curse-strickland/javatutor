<template>
  <div>
    <div v-if="isLoading" class="global-loading" role="status" aria-live="polite">
      <div class="loader" />
      <div class="loading-text">运行中...</div>
    </div>

    <transition name="fade">
      <div v-if="visibleError" class="global-error" role="alert" aria-live="assertive">
        <div class="error-inner">
          <div class="error-message">{{ error }}</div>
          <!-- 报错入口：只预填不发送（F4/F5）；仅运行类错误会出现 lastRunError -->
          <button v-if="store.lastRunError" class="fix-btn" @click="prefillFix">让 agent 帮我看看</button>
          <button class="close" @click="close">×</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, watch, ref, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player'
import { TRANSIENT_ERROR_MS, buildFixPrompt, shouldAutoDismiss } from '../utils/errorEntry'

const store = usePlayerStore()
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)
const visibleError = ref(false)
let timer = null

watch(error, (val) => {
  if (!val) {
    visibleError.value = false
    if (timer) { clearTimeout(timer); timer = null }
    return
  }
  visibleError.value = true
  if (timer) { clearTimeout(timer); timer = null }
  // 运行类错误常驻：直到手动关闭（close）或下次成功运行把 store.error 置空
  if (!shouldAutoDismiss(val, store.lastRunError)) return
  timer = setTimeout(() => {
    visibleError.value = false
    store.error = null
    timer = null
  }, TRANSIENT_ERROR_MS)
})

function close() {
  visibleError.value = false
  store.error = null
  // 关闭即撤下入口（再次运行失败会重新出现）
  store.clearRunError()
  if (timer) { clearTimeout(timer); timer = null }
}

/** 预填草稿 + 切到 agent 面板 + 聚焦输入框，**不发送**（用户可编辑后再自行发送）。 */
function prefillFix() {
  store.focusChatWithDraft(buildFixPrompt(store.lastRunError?.message))
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<style scoped>
.global-loading {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--card-bg);
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  color: var(--text-h);
  backdrop-filter: blur(8px);
}

.loader {
  width: 18px;
  height: 18px;
  border: 3px solid var(--line-strong);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text { font-size: 14px }

.global-error {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  max-width: 92%;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--danger);
  padding: 10px 14px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(18,22,29,0.12);
  backdrop-filter: blur(6px);
}

.error-inner { display:flex; align-items:center; gap:12px }
.error-message { flex:1; white-space:pre-wrap }
/* 报错入口：与控制台里那个按钮同观感（不新增配色体系） */
.fix-btn {
  flex-shrink: 0;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 12px;
  border: 1px solid var(--accent-border);
  background: var(--card-bg);
  color: var(--accent);
  cursor: pointer;
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
  transition: color 0.15s, background 0.15s;
}
.fix-btn:hover { color: var(--primary-600); background: var(--accent-bg); }
.close {
  background: transparent;
  border: none;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: inherit;
  padding: 2px 6px;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-6px) }

@keyframes spin { to { transform: rotate(360deg) } }
</style>
