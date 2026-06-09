<template>
  <div class="sse-chat" :class="{ open: open }">
    <button class="toggle-btn" @click="open = !open">{{ open ? '关闭' : 'SSE 聊天' }}</button>
    <div v-if="open" class="panel">
      <div class="header">SSE 对话组件</div>
      <div ref="messagesRef" class="messages">
        <div v-for="(m, idx) in messages" :key="idx" :class="['message', m.role]">
          <div class="role">{{ m.role === 'user' ? '你' : '助手' }}</div>
          <div class="content" v-html="m.content"></div>
        </div>
      </div>
      <form @submit.prevent="send" class="input-row">
        <input v-model="input" placeholder="输入消息..." />
        <button type="submit">发送</button>
      </form>
      <div class="status">状态：{{ status }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const SERVER = import.meta.env.VITE_SSE_SERVER || 'http://localhost:3000'

const open = ref(false)
const messages = ref([])
const input = ref('')
const status = ref('未连接')
const es = ref(null)
const messagesRef = ref(null)
let streaming = false

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]))
}

function scrollBottom() {
  nextTick(() => {
    const el = messagesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function updateLastAssistant(text) {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'assistant') {
      messages.value[i].content += escapeHtml(text)
      break
    }
  }
  scrollBottom()
}

function connect() {
  es.value = new EventSource(`${SERVER}/stream`)
  es.value.onopen = () => { status.value = '已连接' }
  es.value.onerror = () => { status.value = '连接错误，正在重试' }
  es.value.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data)
      if (d.type === 'message') {
        if (d.partial) {
          if (!streaming) {
            messages.value.push({ role: 'assistant', content: '' })
            streaming = true
          }
          updateLastAssistant(d.content || '')
        } else if (d.done) {
          streaming = false
        }
      }
    } catch (err) {
      console.warn('SSE parse error', err, e.data)
    }
  }
}

function send() {
  const text = input.value && input.value.trim()
  if (!text) return
  messages.value.push({ role: 'user', content: escapeHtml(text) })
  input.value = ''
  fetch(`${SERVER}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'user', message: text })
  }).catch(err => console.error(err))
  scrollBottom()
}

onMounted(() => {
  connect()
})

onBeforeUnmount(() => {
  if (es.value) es.value.close()
})
</script>

<style scoped>
.sse-chat { position: fixed; right: 12px; bottom: 12px; z-index: 80; font-family: 'Maple Mono', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial }
.toggle-btn { background:#2563eb; color:white; padding:8px 10px; border-radius:8px; cursor:pointer }
.panel { width:340px; max-height:480px; background:white; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.12); overflow:hidden; display:flex; flex-direction:column; margin-top:8px }
.header { padding:8px 12px; border-bottom:1px solid #eee; font-weight:600 }
.messages { padding:12px; flex:1; overflow:auto; background: #fff }
.message { margin-bottom:10px }
.message .role { font-size:12px; color:#6b7280; margin-bottom:4px }
.message.user .content { background:#e6f4ff; color:#0b4f9b; padding:8px; border-radius:8px; display:inline-block }
.message.assistant .content { background:#f3f4f6; color:#111827; padding:8px; border-radius:8px; display:inline-block }
.input-row { display:flex; gap:8px; padding:8px; border-top:1px solid #eee; background:#fafafa }
.input-row input { flex:1; padding:8px; border:1px solid #ddd; border-radius:6px }
.input-row button { padding:8px 12px; background:#10b981; border-radius:6px; color:white; border:none; cursor:pointer }
.status { padding:8px 12px; font-size:12px; color:#6b7280 }
</style>
