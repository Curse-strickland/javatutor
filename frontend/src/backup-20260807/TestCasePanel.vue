<template>
  <div class="testcase-panel">
    <div class="tc-method-info" v-if="store.methodSignature">
      <span class="tc-label">检测到方法:</span>
      <code class="tc-sig">{{ store.methodSignature }}</code>
    </div>
    <div class="tc-method-info tc-method-hint" v-else>
      <span class="tc-label">测试模式</span>
      <span class="tc-hint-text">粘贴包含 <code>class Solution</code> 的代码，输入用例后保存</span>
    </div>

    <div class="tc-inputs-section">
      <div class="tc-inputs-header">
        <span class="tc-inputs-label">测试用例参数:</span>
        <button class="tc-mode-toggle" @click.stop="toggleMode" :title="textMode ? '切换到逐行模式' : '切换到文本模式'">
          {{ textMode ? '逐行' : '文本' }}
        </button>
      </div>

      <!-- 文本模式：多行输入框 -->
      <textarea
        v-if="textMode"
        v-model="textAreaContent"
        class="tc-textarea"
        placeholder="每行一个参数，例如：&#10;[1,2,3,4]&#10;7&#10;&quot;hello&quot;"
        rows="4"
        @keyup.ctrl.enter="emitSave"
      />

      <!-- 逐行模式：独立输入框 -->
      <template v-else>
        <div v-for="(tc, index) in testCaseInputs" :key="index" class="tc-input-row">
          <span class="tc-param-label">参数 {{ index + 1 }}:</span>
          <input
            v-model="testCaseInputs[index]"
            class="tc-input"
            :placeholder="tcPlaceholder"
            @keyup.enter="emitSave"
          />
        </div>
        <button class="tc-add-btn" @click="addInput">+ 添加参数</button>
      </template>
    </div>

    <div class="tc-actions">
      <button class="tc-save-btn" @click.stop="emitSave">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        保存
      </button>
      <button v-if="store.testCases.length" class="tc-clear-btn" @click="emitClear">清除</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const emit = defineEmits(['save', 'clear'])
const tcPlaceholder = '例如: [1,2,3] 或 7 或 hello'

const textMode = ref(false)
const testCaseInputs = ref(['', ''])
const textAreaContent = ref('')

// Sync text area <-> individual inputs when switching modes
watch(textMode, (toText) => {
  if (toText) {
    textAreaContent.value = testCaseInputs.value.filter(v => v.trim()).join('\n')
  } else {
    const lines = textAreaContent.value.split('\n').map(v => v.trim()).filter(v => v)
    testCaseInputs.value = lines.length > 0 ? lines : ['', '']
  }
})

watch(() => store.testCases, (cases) => {
  if (cases && cases.length) {
    testCaseInputs.value = [...cases]
    textAreaContent.value = cases.join('\n')
  }
}, { immediate: true })

function toggleMode() {
  textMode.value = !textMode.value
}

function addInput() {
  testCaseInputs.value.push('')
}

function emitSave() {
  let inputs
  if (textMode.value) {
    inputs = textAreaContent.value.split('\n').map(v => v.trim()).filter(v => v)
    testCaseInputs.value = inputs.length > 0 ? [...inputs] : ['', '']
  } else {
    inputs = testCaseInputs.value.map(v => v.trim()).filter(v => v)
  }
  // 直接更新 store，确保测试模式一定被激活
  store.saveTestCases(inputs)
  emit('save', inputs)
}

function emitClear() {
  testCaseInputs.value = ['', '']
  textAreaContent.value = ''
  emit('clear')
}
</script>

<style scoped>
.testcase-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tc-method-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 10px;
}

.tc-method-info.tc-method-hint {
  background: transparent;
  border-color: var(--border);
}

.tc-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tc-sig {
  font-family: 'Maple Mono', ui-monospace, SFMono-Regular, monospace;
  font-size: 13px;
  color: var(--primary);
  word-break: break-all;
}

.tc-hint-text {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.tc-hint-text code {
  font-family: 'Maple Mono', ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  color: var(--text);
  background: rgba(255,255,255,0.06);
  padding: 1px 5px;
  border-radius: 4px;
}

.tc-inputs-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tc-inputs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tc-inputs-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tc-mode-toggle {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  letter-spacing: 0.03em;
}

.tc-mode-toggle:hover {
  color: var(--text);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.tc-textarea {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.04);
  color: var(--text);
  font-family: 'Maple Mono', ui-monospace, SFMono-Regular, monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.tc-textarea:focus {
  border-color: var(--accent-border);
  box-shadow: 0 0 0 2px rgba(10, 132, 255, 0.12);
}

.tc-textarea::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.tc-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tc-param-label {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 52px;
}

.tc-input {
  flex: 1;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.04);
  color: var(--text);
  font-family: 'Maple Mono', ui-monospace, SFMono-Regular, monospace;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.tc-input:focus {
  border-color: var(--accent-border);
  box-shadow: 0 0 0 2px rgba(10, 132, 255, 0.12);
}

.tc-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.tc-add-btn {
  align-self: flex-start;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.15s;
}

.tc-add-btn:hover {
  color: var(--text);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.tc-actions {
  display: flex;
  gap: 8px;
}

.tc-save-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 10px;
  border: none;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.tc-save-btn:hover {
  background: #1a8fff;
}

.tc-save-btn:active {
  transform: scale(0.96);
}

.tc-clear-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.15s;
}

.tc-clear-btn:hover {
  color: var(--text-h);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}
</style>
