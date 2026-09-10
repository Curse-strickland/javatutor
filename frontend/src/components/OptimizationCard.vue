<template>
  <div class="oc-card">
    <div class="oc-header">
      <span class="oc-dot" />
      <span class="oc-title">{{ isOptions ? '优化方案' : '代码优化' }}</span>
      <span v-if="plan.target" class="oc-target">{{ plan.target }}</span>
    </div>

    <!-- 方案卡：只给目标选项，点击后由前端按模板发起新一轮对话（spec §4.1/§4.4） -->
    <template v-if="isOptions">
      <div class="oc-hint">选择一个优化目标，agent 将据此给出优化后的完整代码：</div>
      <button
        v-for="o in plan.options" :key="o.goal"
        class="oc-option"
        :disabled="store.isExplaining"
        @click="choose(o)"
      >
        <span class="oc-option-label">{{ o.label }}</span>
        <span v-if="o.detail" class="oc-option-detail">{{ o.detail }}</span>
      </button>
    </template>

    <!-- 整文件覆盖：先过门禁（真跑一次），通过才允许应用（spec §6） -->
    <template v-else>
      <div v-if="plan.goal" class="oc-goal">目标：{{ goalLabel }}</div>
      <div v-if="plan.rationale" class="oc-rationale">{{ plan.rationale }}</div>

      <div v-if="targetBlocked" class="oc-error">{{ targetBlockedText }}</div>
      <div v-else-if="gate === 'running'" class="oc-gate">校验中…</div>
      <div v-else-if="gate === 'fail'" class="oc-error">校验未通过：{{ gateError }}</div>
      <div v-else-if="gate === 'ok'" class="oc-gate">校验通过（候选代码可正常运行）</div>

      <div class="oc-actions">
        <button v-if="!applied" class="oc-btn oc-apply" :disabled="!canApply" @click="apply">应用</button>
        <template v-else>
          <span class="oc-done">已应用到编辑器</span>
          <button class="oc-btn" @click="undo">撤销</button>
        </template>
        <span v-if="undoError" class="oc-error">{{ undoError }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { GOALS } from '../utils/editSuggestion'
import {
  SNAPSHOT_UNDO_CONFIRM,
  buildGateRequest,
  canApply as canApplyPure,
  pickApplyMode,
  readGateResponse,
  resolveTarget,
} from '../utils/optimization'

const props = defineProps({
  /** parseAssistantMessage 产出的 plan：{kind:'options',...} | {kind:'replace',...} */
  plan: { type: Object, required: true },
})

const store = usePlayerStore()
// 块通道原语（由 SingleFileShell / MultiFileShell provide），与 EditSuggestionCard 共用
const applyAiEdits = inject('applyAiEdits', null)
const undoAiEdits = inject('undoAiEdits', null)
// 整文件覆盖的读写通道：编辑器内容才是权威来源（store.code 可能落后于未保存编辑）
const getCode = inject('getCode', null)
const restoreCode = inject('restoreCode', null)

const isOptions = computed(() => props.plan.kind === 'options')
const goalLabel = computed(() => GOALS[props.plan.goal] || props.plan.goal || '')

const gate = ref('idle')        // 'idle' | 'running' | 'ok' | 'fail'
const gateError = ref('')
const gateSnapshot = ref(null)  // 门禁那次运行结果（应用后用它刷新右侧，spec D7）
const snapshot = ref('')        // 覆盖前代码快照（撤销兜底）
const appliedRunSnapshot = ref(null) // applyCandidateRun 返回的「覆盖前」右侧快照（卡片自持，见 R2）
const undoToken = ref(null)     // Monaco undo 单元版本号；null = 只能走快照回退
const applied = ref(false)
const undoError = ref('')

const target = computed(() => resolveTarget(store.mode, store.multiState.files, props.plan.target))
const targetBlocked = computed(() => target.value.status !== 'ok')
const targetBlockedText = computed(() =>
  target.value.status === 'missing-required'
    ? '未指定目标文件（多文件模式必须给出 target）'
    : `目标文件不存在：${props.plan.target}`,
)
const canApply = computed(() => canApplyPure({
  targetBlocked: targetBlocked.value,
  gate: gate.value,
  applied: applied.value,
}))

function readCurrent() {
  if (!getCode) return null
  const code = store.mode === 'multi' ? getCode(props.plan.target) : getCode()
  return typeof code === 'string' ? code : null
}

/** 方案卡：按模板拼提问并复用既有发送入口，等价于用户自己问了那句话 */
function choose(o) {
  store.askGoalOptimization(o.goal, o.detail, props.plan.target)
}

/** 门禁：前端直接 fetch，绕开 runCode（后者会置全局 loading / 清空 chatMessages） */
async function runGate() {
  gate.value = 'running'
  gateError.value = ''
  try {
    const req = buildGateRequest({
      mode: store.mode,
      files: store.multiState.files,
      target: props.plan.target,
      code: props.plan.code,
      testMode: store.testMode,
      testCases: store.testCases,
    })
    const res = await fetch(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    const data = await res.json()
    const r = readGateResponse(data)
    if (r.ok) {
      gate.value = 'ok'
      gateSnapshot.value = data
    } else {
      gate.value = 'fail'
      gateError.value = r.error
    }
  } catch (e) {
    gate.value = 'fail'
    gateError.value = e.message || '校验请求失败'
  }
}

function apply() {
  if (!canApply.value) return
  const current = readCurrent()
  snapshot.value = current ?? ''
  const code = props.plan.code

  if (pickApplyMode(store.mode) === 'monaco' && current) {
    // 整文件覆盖 = 一条 old_string 为「当前全文」的 edit → 天然是单个 undo 单元（plan §0.1 B2）
    const res = applyAiEdits?.([{
      title: '代码优化',
      explanation: props.plan.rationale || '',
      old_string: current,
      new_string: code,
    }])
    if (res && res.applied > 0) {
      undoToken.value = res.undoToken
    } else {
      // 编辑器为空 / 无法定位 → 直接写入（无 undo 单元，撤销走快照）
      restoreCode?.(code, props.plan.target)
      undoToken.value = null
    }
  } else {
    restoreCode?.(code, props.plan.target)
    undoToken.value = null
  }

  // D7：用门禁那次运行结果刷新右侧（不清会话状态）；返回的快照由本卡片自持，
  // 避免多张卡依次撤销时误用别的卡片留下的快照
  appliedRunSnapshot.value = store.applyCandidateRun(gateSnapshot.value || {}, code)
  applied.value = true
  undoError.value = ''
}

function undo() {
  // 优先 Monaco undo（精确回滚，且不丢弃此后的其它编辑）
  if (undoToken.value != null && undoAiEdits?.(undoToken.value)) {
    store.restorePreviousRun(appliedRunSnapshot.value)
    applied.value = false
    undoError.value = ''
    return
  }
  if (!restoreCode) {
    undoError.value = '编辑器不可用，无法撤销'
    return
  }
  // 回退：整份快照还原，会丢弃此后的编辑 → 必须显式确认
  if (typeof window !== 'undefined' && typeof window.confirm === 'function'
    && !window.confirm(SNAPSHOT_UNDO_CONFIRM)) return
  restoreCode(snapshot.value, props.plan.target)
  store.restorePreviousRun(appliedRunSnapshot.value)
  applied.value = false
  undoError.value = ''
}

onMounted(() => {
  if (isOptions.value || targetBlocked.value) return
  // 快照在收到 replace 块时即捕获，避免应用时机与快照时机错位（spec §6.2）
  snapshot.value = readCurrent() ?? ''
  runGate()
})
</script>

<style scoped>
.oc-card {
  margin-top: 8px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  background: var(--card-bg);
  padding: 8px 10px;
}
.oc-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.oc-dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
  flex-shrink: 0;
}
.oc-title {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-h);
}
.oc-target {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
}
.oc-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.oc-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  text-align: left;
  margin-bottom: 6px;
  padding: 6px 10px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--primary);
  cursor: pointer;
  transition: box-shadow 160ms, opacity 160ms;
}
.oc-option:hover:not(:disabled) { box-shadow: 0 4px 12px var(--accent-bg); }
.oc-option:disabled { opacity: 0.4; cursor: not-allowed; }
.oc-option-label {
  font-size: 12px;
  font-weight: 600;
}
.oc-option-detail {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}
.oc-goal {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h);
}
.oc-rationale {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-top: 2px;
}
.oc-gate {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}
.oc-error {
  font-size: 11px;
  color: #dc2626;
  margin-top: 4px;
  word-break: break-all;
  max-height: 72px;
  overflow-y: auto;
}
.oc-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.oc-btn {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 12px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.oc-btn:hover:not(:disabled) { color: var(--text-h); background: var(--accent-bg); }
.oc-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.oc-apply {
  color: var(--accent);
  border-color: var(--accent);
}
.oc-done { font-size: 11px; color: #16a34a; }
</style>
