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
          <button class="close" @click="close">×</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, watch, ref, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)
const visibleError = ref(false)
let timer = null

watch(error, (val) => {
  if (val) {
    visibleError.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      visibleError.value = false
      store.error = null
      timer = null
    }, 6000)
  } else {
    visibleError.value = false
    if (timer) { clearTimeout(timer); timer = null }
  }
})

function close() {
  visibleError.value = false
  store.error = null
  if (timer) { clearTimeout(timer); timer = null }
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
  border: 3px solid rgba(0,0,0,0.12);
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
  background: rgba(255,59,48,0.06);
  border: 1px solid rgba(255,59,48,0.16);
  color: #ff3b30;
  padding: 10px 14px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  backdrop-filter: blur(6px);
}

.error-inner { display:flex; align-items:center; gap:12px }
.error-message { flex:1; white-space:pre-wrap }
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
