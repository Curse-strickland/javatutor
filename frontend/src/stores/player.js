import { defineStore } from 'pinia'
import { detectTutorialCategory } from '../utils/algoTutorialMap.js'
import { http } from '../utils/http.js'
import { allowedPanels, algoSubTabs } from '../constants/uiPanelManifest.js'
import { buildGoalPrompt, stripLeadingToolJson } from '../utils/editSuggestion.js'
import { buildRetryPrompt, hasUsableReplace, nextRetry } from '../utils/optimization.js'
import { applyProcessEvents, extractProcessEvents } from '../utils/processEvents.js'
import { MAX_TIMELINE, buildCheckpointLabel } from '../utils/timeline.js'

export const usePlayerStore = defineStore('player', {
  state: () => ({
    steps: [],
    currentStep: 0,
    isLoading: false,
    error: null,
    output: '',
    runId: null,
    // AI explanation state — 自由问答聊天
    code: '',
    chatMessages: [],          // [{ role: 'user'|'assistant', text }]
    isExplaining: false,
    autoExplain: false,
    explainExpanded: false,
    explainError: null,
    explainStage: '',
    explainAbortController: null,
    /**
     * 生成期间的**实时进度**（来自 agent 的过程哨兵，见 `utils/processEvents.js`）。
     * `liveStage` 是**覆盖式**阶段文案（只显示最新一条），`liveTools` 是**追加式**工具列表。
     * 生成结束后清空——信息由 `DecisionTracePanel` 的【执行过程】折叠区接管。
     */
    liveStage: '',
    liveTools: [],
    /**
     * 优化卡门禁失败后的自动返修：null | `{ msgIndex, attempt, max }`。
     * 上限必须由 store 持有——卡片会因折叠/重挂载而丢失局部状态（决策见
     * javatutor-coze docs/plan/2026-09-12-coze-agent-optimization-gate-retry-plan.md §0.1）。
     */
    optRepair: null,
    /** 返修提问自己的 AbortController（用户手动提问会 abort 它 = 抢占） */
    optAbortController: null,
    /**
     * 传输失败时的「重跑门禁」通知量与闩**都按消息记**（`chatMessages[i].optRegateNonce` /
     * `.optRegate`），不设全局量：全局量会让任一卡的故障唤醒**所有**挂载中的 replace 卡一起重跑
     * 门禁（总请求数上界 O(N²)，且本卡门禁飞行中时会被并发发起第二次），见 review P3-6 / P3-3(b)。
     */
    explainHistory: {},
    /** agent 输入框草稿（提升自 AiTutorPanel 局部 ref）：报错入口/优化卡「只预填不发送」写入此字段 */
    chatDraft: '',
    /** +1 即请求 agent 输入框聚焦（跨组件一次性事件，参照 store.knowledgeNav 的先例） */
    chatFocusNonce: 0,
    /** 最近一次运行失败信息（控制台「让 agent 帮我看看」入口用）；只在下次成功运行时清 */
    lastRunError: null,
    /**
     * 对话时间线记录点（仅内存，刷新即清）。每项：
     * `{ id, seq, kind:'run'|'optimize', label, mode, chatIndex, time, code?, files?, activeFileIndex?, goalLabel?, target?, expired? }`
     * 只存**代码快照**不存运行结果（决策 T2）：回退时重跑一次，保证「编辑器代码 ↔ 右栏面板」永远同源。
     */
    timeline: [],
    timelineSeq: 0,
    /** 折叠起点：下标 **大于** 它的对话折叠（T3/T7）；null = 不折叠。分割线自身位于 chatIndex，不折叠。 */
    foldFromIndex: null,
    /** 本次运行的临时选项（`{silent}`），由 runCode/runProject 写入、applyRunResult 读取后在 finally 清掉 */
    _runOpts: null,
    // Code analysis state
    analysisData: null,
    analysisError: null,
    isAnalyzing: false,
    // SVG 动画状态（coze animate 链）
    svgText: null,
    svgError: null,
    isAnimating: false,
    controlFlowData: null,
    cfViewStack: [],
    activeAiTab: 'explain',
    // 算法库子页（knowledge=算法知识 / template=算法模板），供 navigateTo 的 algo.subTab 精确定位
    algoSubTab: 'knowledge',
    // 测试模式
    testMode: false,
    testCases: [],
    methodName: '',
    methodSignature: '',
    // File upload state
    rightTab: 'datastructure',
    // 算法教程提示弹窗（右下角）与知识库跳转目标
    tutorialToast: { visible: false, categoryId: null, anchorId: null, title: '' },
    knowledgeNav: { categoryId: null, anchorId: null, nonce: 0 },
    pendingFiles: [],
    uploadHistory: (() => {
      try { return JSON.parse(localStorage.getItem('javatutor-uploads')) || [] }
      catch { return [] }
    })(),
    // Mode state — 'single' | 'multi'
    mode: 'single',
    singleState: null,      // null = not saved yet; object = snapshot
    multiState: {
      files: [],             // [{name, code}]
      activeFileIndex: 0,
      entryFile: '',         // 主入口文件名（发送给 Coze 的 entryFile；由 refreshEntryFile 写入）
      umlCache: {},          // {kind: {svg, ts, source}}
      projectAnalysis: null, // { entry: {class, method}, flow, classDiagram, structure, errors }
      isAnalyzingProject: false,
      projectAnalysisError: null,
    },
    multiTab: 'datastructure',
  }),
  getters: {
    currentVariables: (state) => {
      // 合并所有栈帧的局部变量，使变量面板在函数调用时也显示外层变量
      const frames = state.steps[state.currentStep]?.stackFrames || []
      const merged = {}
      for (const f of frames) {
        if (f.locals) Object.assign(merged, f.locals)
      }
      return Object.keys(merged).length > 0 ? merged : (state.steps[state.currentStep]?.variables || {})
    },
    currentLine: (state) => state.steps[state.currentStep]?.line || null,
    /** 当前步骤所属文件名（多文件项目运行用，单文件为空） */
    currentStepFile: (state) => state.steps[state.currentStep]?.file || null,
    totalSteps: (state) => state.steps.length,
    currentHeap: (state) => state.steps[state.currentStep]?.heap || {},
    currentStackFrame: (state) => state.steps[state.currentStep]?.stackFrame || null,
    activeStackFrames: (state) => state.steps[state.currentStep]?.stackFrames || [],
    currentOutput: (state) => {
      let out = ''
      for (let i = 0; i <= state.currentStep && i < state.steps.length; i++) {
        const delta = state.steps[i]?.output
        if (delta) out += delta
      }
      return out.replace(/\r/g, '')
    },
  },
  actions: {
    /**
     * 运行单文件代码。
     * @param {string} code
     * @param {{silent?: boolean}} [opts] `silent` = 回退触发的重跑：不建记录点、不清折叠（T6）
     *
     * **不再清空 `chatMessages`**（对话时间线）：其余清理保留——它们描述「当前代码」的分析结果，
     * 代码变了本就该失效（决策 D3）。
     */
    async runCode(code, opts = {}) {
      this.isLoading = true
      this.error = null
      this.output = ''
      this.runId = null
      this.code = code
      this._runOpts = { silent: !!opts.silent }
      this.explainError = null
      this.explainHistory = {}
      this.analysisData = null
      this.analysisError = null
      this.svgText = null
      this.svgError = null
      this.activeAiTab = 'explain'
      if (this.explainAbortController) {
        this.explainAbortController.abort()
        this.explainAbortController = null
      }
      try {
        const body = { code }
        if (this.testMode) {
          body.mode = 'test'
          body.testCases = this.testCases
        }
        const res = await http('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const data = await res.json()
        this.applyRunResult(data)
      } catch (e) {
        this.error = e.message || '网络请求失败'
        this.lastRunError = { message: this.error }
      } finally {
        this.isLoading = false
        this._runOpts = null
      }
    },

    /**
     * 多文件项目运行：把整个项目发送给后端统一编译执行。
     * @param {{silent?: boolean}} [opts] 同 runCode；**不再清空 `chatMessages`**
     */
    async runProject(opts = {}) {
      const files = this.multiState.files
      if (!files.length) return
      this.isLoading = true
      this.error = null
      this.output = ''
      this.runId = null
      this.code = files[this.multiState.activeFileIndex]?.code || ''
      this._runOpts = { silent: !!opts.silent }
      this.explainError = null
      this.explainHistory = {}
      this.analysisData = null
      this.analysisError = null
      this.svgText = null
      this.svgError = null
      this.activeAiTab = 'explain'
      if (this.explainAbortController) {
        this.explainAbortController.abort()
        this.explainAbortController = null
      }
      try {
        const res = await http('/api/run/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files })
        })
        const data = await res.json()
        this.applyRunResult(data)
        this.refreshEntryFile()
      } catch (e) {
        this.error = e.message || '网络请求失败'
        this.lastRunError = { message: this.error }
      } finally {
        this.isLoading = false
        this._runOpts = null
      }
    },

    /** 统一处理运行结果（单文件 / 多文件共用） */
    applyRunResult(data) {
      if (data.code === 200 || data.success) {
        this.steps = data.data || data.steps || []
        this.runId = data.runId
        this.output = data.output || ''
        this.currentStep = 0
        this.lastRunError = null
        this.maybeShowTutorialToast()
        if (data.methodName) this.methodName = data.methodName
        if (data.methodSignature) this.methodSignature = data.methodSignature
        this.requestAnalysis()
        this.cfViewStack = []
        this.requestControlFlow()
        // 记录点（T1）：真实运行恢复正常线性阅读并建点；回退触发的静默重跑两者都不做（T6）。
        // 失败分支不建点、不插分割线——用户要的是「成功运行」。
        if (!this._runOpts?.silent) {
          this.foldFromIndex = null
          this.pushCheckpoint({ kind: 'run', steps: this.steps, output: this.output })
        }
      } else {
        this.error = data.error || data.msg || '未知错误'
        this.lastRunError = { message: this.error }
      }
    },

    /**
     * 用「候选代码」的运行结果刷新右侧面板（优化卡门禁通过、用户点「应用」后调用）。
     * 与 applyRunResult 的关键区别：**不重置会话状态**——chatMessages / explainHistory /
     * activeAiTab / explainError 一律不动，否则应用一次优化会清空整个聊天记录。
     * @param {object} data /api/run 或 /api/run/project 的响应
     * @param {string} [code] 覆盖后的代码（同步给 store.code，供后续提问/分析作为上下文）
     * @param {{goalLabel?: string, target?: string}} [meta] 记录点摘要用（优化方向 / 目标文件）
     * @returns {object} 本次记录的「覆盖前」右侧展示快照——**由调用方（优化卡）自持**。
     *   刻意不存 store 单槽：连续应用两张卡后再依次撤销时，单槽只剩最后一次的快照，
     *   会出现「编辑器回退到 A 前、右栏却回填 B 后」的错配（且 store.code 与编辑器不一致）。
     */
    applyCandidateRun(data, code, meta = {}) {
      const previousRun = {
        steps: this.steps,
        output: this.output,
        runId: this.runId,
        currentStep: this.currentStep,
        code: this.code,
      }
      if (typeof code === 'string') this.code = code
      this.steps = data.data || data.steps || []
      this.runId = data.runId
      this.output = data.output || ''
      this.currentStep = 0
      this.lastRunError = null
      if (data.methodName) this.methodName = data.methodName
      if (data.methodSignature) this.methodSignature = data.methodSignature
      this.cfViewStack = []
      this.requestAnalysis()
      this.requestControlFlow()
      // 应用优化会改代码但不走 /api/run（用的是门禁那次的运行结果），不建点会在时间线上
      // 留下「代码已变、无线索」的空档（决策 T1）。
      this.foldFromIndex = null
      this.pushCheckpoint({
        kind: 'optimize',
        steps: this.steps,
        output: this.output,
        goalLabel: meta.goalLabel || '',
        target: meta.target || '',
      })
      return previousRun
    },

    /**
     * 建一个时间线记录点：捕获**当前代码快照**（深拷贝——`files[i].code` 会被就地改写）
     * 与摘要，并往 `chatMessages` 追加一条 `role:'divider'`（**真实消息**，不引入「过滤后的数组」，
     * 否则优化卡的 `v-if` 依赖的真实下标会错位，见决策 D7）。
     *
     * @returns {object} 新建的记录点
     */
    pushCheckpoint({ kind = 'run', steps, output, goalLabel = '', target = '', mode = this.mode }) {
      const seq = ++this.timelineSeq
      const time = new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5)
      const cp = {
        id: `cp-${seq}`,
        seq,
        kind,
        mode,
        time,
        // 折叠起点：下标 **大于** 它的对话折叠（分割线本身即位于 chatIndex）
        chatIndex: this.chatMessages.length,
        goalLabel,
        target,
      }
      if (mode === 'multi') {
        cp.files = this.multiState.files.map((f) => ({ name: f.name, code: f.code }))
        cp.activeFileIndex = this.multiState.activeFileIndex
      } else {
        cp.code = this.code || ''
      }
      cp.label = buildCheckpointLabel({
        seq, kind, mode, time, goalLabel, target,
        methodName: this.methodName,
        entryFile: this.multiState.entryFile,
        fileCount: this.multiState.files.length,
        code: cp.code,
        steps,
        output,
      })
      // 超上限：只丢最旧的**代码快照**（内存大头），记录本身留在 timeline 里——
      // 分割线要靠 `cp.id → cp` 才能渲染出「记录已过期」并把按钮置灰；
      // 把记录整个 shift 掉的话那条分割线会找不到 cp，直接渲染不出来。
      const live = this.timeline.filter((t) => !t.expired)
      if (live.length >= MAX_TIMELINE) {
        const oldest = live[0]
        oldest.expired = true
        delete oldest.code
        delete oldest.files
      }
      this.timeline.push(cp)
      this.chatMessages.push({ role: 'divider', text: cp.label, checkpointId: cp.id })
      return cp
    },

    /**
     * 回退到某个记录点：折叠其后的对话 + **静默重跑**（T2：只存代码快照，运行结果靠重跑复现）。
     *
     * 代码本身由调用方（`TimelineDivider` 经 `restoreSource`）先写回编辑器/文件，本方法只管
     * 「折叠 + 重跑」。`cp.expired`（快照已被上限丢弃）时**不得**调用本方法——由组件置灰按钮。
     *
     * @returns {Promise<boolean>} 是否执行了回退
     */
    async revertToCheckpoint(cp) {
      if (!cp || cp.expired) return false
      this.foldFromIndex = cp.chatIndex
      // 记录点带 mode（T5）：单/多文件代码结构不同，必须在对应结构里恢复
      if (cp.mode !== this.mode) this.switchMode(cp.mode)
      // silent：回退在时间线上就是「回到第 k 点」，不是新版本（T6）；
      // 代价是 runCode 会把 currentStep 复位为 0（T2 已接受）
      if (cp.mode === 'multi') await this.runProject({ silent: true })
      else await this.runCode(cp.code, { silent: true })
      return true
    },

    /**
     * 撤销优化：把右侧展示状态回填为「覆盖前」快照。
     * @param {object} prev applyCandidateRun 的返回值（由优化卡自持，见该方法的 @returns）
     */
    restorePreviousRun(prev) {
      if (!prev) return
      this.steps = prev.steps || []
      this.output = prev.output || ''
      this.runId = prev.runId ?? null
      this.currentStep = prev.currentStep || 0
      if (typeof prev.code === 'string') this.code = prev.code
      this.cfViewStack = []
      this.requestAnalysis()
      this.requestControlFlow()
    },

    /**
     * 报错入口：预填草稿 + 切到 agent 面板 + 请求聚焦输入框（F5，均**不发送**——
     * 这是「代写提问」不是「转发」，发送权仍在用户手里）。
     */
    focusChatWithDraft(text) {
      this.chatDraft = text
      this.navigateTo('tutor')
      this.chatFocusNonce += 1
    },

    /** 手动关闭报错弹窗时一并撤下入口（再次运行失败会重新出现）。 */
    clearRunError() {
      this.lastRunError = null
    },

    /**
     * 优化卡「方案卡」提交：按所选方向（F2 白名单）+ 同一张卡的未选项（F2 黑名单）拼提问，
     * 复用既有发送入口发起新一轮对话，等价于用户自己问了那句话。
     * 之所以要显式列出未选项：请求不带对话历史（见 tests），「以 X 为优先」是软措辞，
     * 不把选择写成硬约束时 agent 会顺带做其它方向。
     * @param {Array<{goal: string, label?: string, detail?: string}>} selected 已勾选方向（≥1）
     * @param {Array<{goal: string, label?: string, detail?: string}>} excluded 同一张卡的未选项
     * @param {string} [target] 多文件模式的目标文件
     */
    async askGoalOptimization(selected, excluded = [], target = '') {
      const q = buildGoalPrompt(selected, excluded)
      if (!q) return
      const suffix = this.mode === 'multi' && target ? `（目标文件：${target}）` : ''
      await this.askQuestion(`${q}${suffix}`)
    },

    /**
     * 优化卡门禁失败上报 → 决定是否自动返修（F1–F5；上限由 store 持有，抗卡片重挂载）。
     * 只重写**最后一条 assistant 消息**的 text，不新增消息、不新增记录点：
     * 时间线记录点记的是 `chatIndex = chatMessages.length`（下标即折叠边界），
     * 重写最后一条只影响「最新记录点之后的当前段」，对时间线无副作用。
     *
     * applied / targetBlocked 由卡片如实传入——二者本可「按构造恒为 false」，但**不得**在
     * store 里写死：判定必须全部走 nextRetry，否则纯函数的守卫就成了死代码（何况 gate 在
     * `rev` 变更时会重跑）。
     */
    async requestOptimizationRetry(msgIndex, { gateError, kind, plan, goalLabel, applied, targetBlocked }) {
      const idx = Number(msgIndex)
      const msg = this.chatMessages[idx]
      const isLatest = idx === this.chatMessages.length - 1 && !!msg && msg.role === 'assistant'
      const hasCode = !!(plan && plan.code)
      const attempt = (msg && msg.optAttempt) || 0
      if (this.optRepair) return                       // 已有返修在飞 → 不重入
      const d = nextRetry({ attempt, kind, applied, targetBlocked, isLatest, hasCode })
      if (d.action === 'regate') {
        // 传输失败：让卡片**重跑一次门禁**（F4），但不烧返修次数。
        // 必须按消息加闩：重跑仍会失败（后端不通/返 500），又会回到这里；
        // 无闩则「重跑 → 失败 → 重跑」形成 fetch 风暴（早于提交的实测发现，见 devlog 偏差 #1）。
        // 门禁成功后由卡片调 notifyGateOk 解闩，使下一次链路故障仍能自动重跑一次。
        // 通知量也按消息（`msg.optRegateNonce`），只唤醒**发起卡**：全局量会连坐其它卡（见 state 注释）。
        if (msg.optRegate) return
        msg.optRegate = true
        msg.optRegateNonce = (msg.optRegateNonce || 0) + 1
        return
      }
      if (d.action === 'stop') return
      msg.optAttempt = d.attempt
      this.optRepair = { msgIndex: idx, attempt: d.attempt, max: d.max }
      try {
        let buf = ''
        await this._runChat({
          question: buildRetryPrompt({ plan, gateError, goalLabel, attempt: d.attempt, max: d.max }),
          signal: (this.optAbortController = new AbortController()).signal,
          onChunk: (t) => { buf += t },
          onStage: () => {},
          onError: (m) => { this.explainError = m },
        })
        // F5：拿不到候选 → 丢弃该次返修结果，保留失败卡片（用户还要看到错误原文）
        // 先剥哨兵：返修回答同样会带过程哨兵，不能让它进「是否有可用候选」的判定与正文。
        // 再剥开头裸工具 JSON：提案 delta 同样会被 `buf` 纯累加粘在最前面。
        const clean = stripLeadingToolJson(extractProcessEvents(buf).clean)
        if (!hasUsableReplace(clean)) return
        msg.text = clean                                // F2：原地替换卡片，不新增气泡
        msg.optRev = (msg.optRev || 0) + 1              // 通知卡片重跑门禁
      } catch (e) {
        /* 返修本身失败（含被用户提问抢占的 AbortError）：保持失败卡片，不重试 */
      } finally {
        this.optRepair = null
        this.optAbortController = null
      }
    },

    /**
     * 门禁通过 → 解除该消息的「已自动重跑门禁」闩。
     * 目的是让闩按**链路故障时段**生效而不是按消息终生生效：下一次链路故障仍可自动重跑一次。
     */
    notifyGateOk(msgIndex) {
      const msg = this.chatMessages[Number(msgIndex)]
      if (msg) msg.optRegate = false
    },
    nextStep() {
      if (this.currentStep < this.totalSteps - 1) this.currentStep++
    },
    prevStep() {
      if (this.currentStep > 0) this.currentStep--
    },
    goToFirst() {
      this.currentStep = 0
    },
    goToLast() {
      if (this.totalSteps > 0) this.currentStep = Math.max(0, this.totalSteps - 1)
    },
    goToStep(step) {
      if (this.totalSteps > 0) {
        this.currentStep = Math.max(0, Math.min(step, this.totalSteps - 1))
      }
    },

    // --- AI Explanation actions ---

    /** 发送自由问答（当前步骤上下文 + 用户问题），SSE 流式追加到 chatMessages */
    async askQuestion(question) {
      if (this.explainAbortController) {
        this.explainAbortController.abort()
      }
      // 用户手动提问**抢占**自动返修（用户优先）；被抢占的那次不退还返修次数（次数按「生成」计）
      if (this.optAbortController) {
        this.optAbortController.abort()
      }
      const q = (question || '').trim()
      if (!this.code || !q) return

      this.isExplaining = true
      this.explainError = null
      this.explainStage = ''
      this.liveStage = ''
      this.liveTools = []
      this.explainAbortController = new AbortController()

      // 先放入用户消息，再追加空 assistant 消息接收流式回复
      this.chatMessages.push({ role: 'user', text: q })
      this.chatMessages.push({ role: 'assistant', text: '' })
      const assistantIdx = this.chatMessages.length - 1

      try {
        await this._runChat({
          question: q,
          signal: this.explainAbortController.signal,
          onChunk: (t) => {
            this.chatMessages[assistantIdx].text += t
            // **增量**抽取本 chunk 内的哨兵并更新实时进度。不做「每 chunk 全量重解析」——
            // 那是 O(n²)。
            // **假定**（非保证，review 2026-09-13 P3-2）：哨兵是单条完整消息（agent 侧经
            // `AIMessage` 一次转出），**不跨 chunk 被切开**。这条依赖 Java 代理不做分片转发，
            // 超出本仓控制面。降级后果可接受：哨兵是 HTML 注释，`marked` 的 `html()` 返回空串，
            // 最坏是丢一条进度而不是漏出乱码。联调时留意——若出现「进度条莫名缺一条」，
            // 先查代理是否把一条 answer 消息拆成了多个 chunk。
            const { events } = extractProcessEvents(t)
            if (events.length) {
              const next = applyProcessEvents(this, events)
              this.liveStage = next.liveStage
              this.liveTools = next.liveTools
            }
          },
          onError: (m) => { this.explainError = m },
          onStage: (m) => { this.explainStage = m },
        })
      } catch (e) {
        if (e.name !== 'AbortError') {
          this.explainError = e.message || '自由问答请求失败'
        }
      } finally {
        this.isExplaining = false
        this.liveStage = ''
        this.liveTools = []
        this.explainAbortController = null
      }
    },

    /**
     * 组装 /api/ai/chat 的请求体（提问体上下文：执行快照 + 多文件信息）。
     * 抽出来是为了让自动返修复用同一份上下文——否则 agent 看到的是缺上下文的孤岛提问。
     */
    buildChatBody(question) {
      // 单步问答必须把执行快照传给 Coze，step_facts 才能给出当前步骤证据
      const stepSnapshots = (this.steps || []).map(s => ({
        step: s.step,
        line: s.line,
        file: s.file || '',              // 多文件项目时确定当前步归属
        variables: s.variables || {},
        heap: s.heap || {},
        stackFrames: s.stackFrames || [],
        output: s.output
      }))
      // 项目文件只在多文件模式下发送：切回单文件后 multiState 仍有残留（状态刻意不销毁，
      // 以便切回多文件能恢复上次项目），但**发送侧必须按模式裁剪**——否则 `### 项目结构`
      // 会列出与当前编辑代码无关的文件（2026-09-14 联调修复 Task 7）。
      const multi = this.mode === 'multi'
      return {
        code: this.code,
        runId: this.runId,
        step: this.currentStep,
        totalSteps: this.totalSteps,
        currentLine: this.currentLine,
        steps: stepSnapshots,
        variables: { ...this.currentVariables, _explainTopic: question },
        files: multi ? this.multiState.files.map(f => ({ name: f.name, code: f.code })) : [],
        entryFile: multi ? (this.multiState.entryFile || '') : '',
        // 运行模式事实（语义在 coze 侧知识与引导里，前端只报事实）：
        // 缺省即 `default`（不是省略），coze 侧据此区分「默认模式」与「旧客户端没带」
        mode: this.testMode ? 'test' : 'default',
        testCaseCount: this.testCases.length,
      }
    },

    /**
     * 发一次提问并消费 SSE 流，逐事件回调 `onChunk(text)` / `onStage(text)` / `onError(text)`。
     * 落点由调用方决定：`askQuestion` 追加到新建的 assistant 消息，自动返修原地重写最后一条。
     * 本函数**不写任何 store 状态**；抛出的异常（含 `AbortError`）由调用方处理。
     */
    async _runChat({ question, onChunk, onStage, onError, signal }) {
      const response = await http('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildChatBody(question)),
        signal
      })

      // 非 2xx 已在 http() 里抛可读错误，这里不再重复检查（原来的 HTTP <status> 信息更差）

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''
      // SSE 多行 data 累积：一个事件可有多个 data: 行，按标准用 \n 连接
      let eventData = []

      const flushEvent = () => {
        const text = eventData.join('\n')
        if (currentEvent === 'chunk' && eventData.length) {
          if (onChunk) onChunk(text)
        } else if (currentEvent === 'error') {
          if (onError) onError(text)
        } else if (currentEvent === 'stage' && eventData.length) {
          if (onStage) onStage(text)
        }
        currentEvent = ''
        eventData = []
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            flushEvent()
            currentEvent = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            // 保留前导空格：data:  的正文从第 5 字符起
            eventData.push(line.slice(5))
          } else if (!line.trim() && eventData.length) {
            // 空行代表事件结束（flush）
          }
        }
      }
      flushEvent()
    },

    // 兼容入口：单步解说 / 标签解说 → 转成自由问答
    async requestExplain(topic) {
      if (!this.code || this.totalSteps === 0) return
      const q = topic
        ? `请解释「${topic}」这个算法/数据结构。`
        : '请解释当前这一步在做什么。'
      await this.askQuestion(q)
    },

    // 兼容入口：整体解说 → 转成自由问答
    async requestOverview() {
      if (!this.code) return
      await this.askQuestion('请整体解说这段代码的算法思路和数据结构。')
    },

    toggleExplainPanel() {
      this.explainExpanded = !this.explainExpanded
      if (!this.explainExpanded) {
        this.explainError = null
        if (this.explainAbortController) {
          this.explainAbortController.abort()
          this.explainAbortController = null
        }
      }
    },

    toggleAutoExplain() {
      this.autoExplain = !this.autoExplain
    },

    switchAiTab(tab) {
      this.activeAiTab = tab
    },

    async requestAnalysis() {
      if (!this.code) return
      this.isAnalyzing = true
      this.analysisData = null
      this.analysisError = null
      try {
        // 复杂度/算法标签由服务器侧 Coze 智能体自助提供，无需用户 API key
        const res = await http('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: this.code })
        })
        const data = await res.json()
        if (data.error) {
          this.analysisError = data.error
        } else {
          this.analysisData = data
        }
      } catch (e) {
        this.analysisError = e.message || '分析请求失败'
      } finally {
        this.isAnalyzing = false
      }
    },

    /** 生成 SVG 动画 — 显式 intent=animate，服务器侧 Coze 动画链生成 */
    async requestAnimation() {
      if (!this.code || this.totalSteps === 0) return
      this.isAnimating = true
      this.svgError = null
      try {
        // steps 传原始运行快照（coze animate_node 依赖 variables.arr 等）
        const rawSteps = (this.steps || []).map(s => ({
          step: s.step,
          line: s.line,
          variables: s.variables || {}
        }))
        // 从已有分析结果提取算法/数据结构标签名，供 coze 动画分类使用
        const algorithmTags = [
          ...(this.analysisData?.algorithms || []).map(a => a.name),
          ...(this.analysisData?.dataStructures || []).map(d => d.name)
        ]
        const res = await http('/api/ai/animate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: this.code,
            step: this.currentStep,
            totalSteps: this.totalSteps,
            currentLine: this.currentLine,
            steps: rawSteps,
            algorithmTags
          })
        })
        const data = await res.json()
        if (data.error) {
          this.svgError = data.error
          this.svgText = null
        } else {
          this.svgText = data.svg || null
        }
      } catch (e) {
        this.svgError = e.message || '动画生成请求失败'
        this.svgText = null
      } finally {
        this.isAnimating = false
      }
    },

    // --- 测试模式 ---

    saveTestCases(cases) {
      this.testCases = [...cases]
      this.testMode = cases.length > 0
    },

    clearTestCases() {
      this.testCases = []
      this.testMode = false
      this.methodName = ''
      this.methodSignature = ''
    },

    // --- File upload actions ---

    switchRightTab(tab) {
      if (allowedPanels('single').includes(tab)) this.rightTab = tab
    },

    async requestControlFlow() {
      if (!this.code) return
      try {
        const res = await http('/api/controlflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: this.code })
        })
        const data = await res.json()
        if (!data.error) this.controlFlowData = data
      } catch (e) { console.warn('ControlFlow failed:', e.message) }
    },

    addUploadRecord(name, code) {
      // 去重：同名文件替换旧记录
      const filtered = this.uploadHistory.filter(r => r.name !== name)
      filtered.unshift({ name, code, time: Date.now() })
      // 最多保留 20 条
      this.uploadHistory = filtered.slice(0, 20)
      localStorage.setItem('javatutor-uploads', JSON.stringify(this.uploadHistory))
    },

    removeUploadRecord(name) {
      this.uploadHistory = this.uploadHistory.filter(r => r.name !== name)
      localStorage.setItem('javatutor-uploads', JSON.stringify(this.uploadHistory))
    },

    // --- Mode switching ---

    persistMode() {
      try { localStorage.setItem('jt-mode', this.mode) } catch {}
    },

    restoreMode() {
      try {
        const m = localStorage.getItem('jt-mode')
        if (m === 'multi' || m === 'single') this.mode = m
      } catch {}
    },

    captureSingleSnapshot() {
      return {
        steps: this.steps,
        currentStep: this.currentStep,
        code: this.code,
        chatMessages: this.chatMessages,
        svgText: this.svgText,
        controlFlowData: this.controlFlowData,
        uploadHistory: this.uploadHistory,
      }
    },

    restoreSingleSnapshot(snap) {
      if (!snap) return
      this.steps = snap.steps || []
      this.currentStep = snap.currentStep || 0
      this.code = snap.code || ''
      this.chatMessages = snap.chatMessages || []
      this.svgText = snap.svgText || null
      this.controlFlowData = snap.controlFlowData || null
      this.uploadHistory = snap.uploadHistory || []
    },

    switchMode(mode) {
      if (mode !== 'single' && mode !== 'multi') return
      if (mode === this.mode) return
      // Capture current mode snapshot
      if (this.mode === 'single') {
        this.singleState = this.captureSingleSnapshot()
      }
      // Switch
      this.mode = mode
      // Restore target mode snapshot (if any)
      if (mode === 'single' && this.singleState) {
        this.restoreSingleSnapshot(this.singleState)
      }
      // multiState uses existing defaults; first switch to multi does not force empty snapshot
      this.persistMode()
    },

    // --- Multi-file mode ---

    switchMultiTab(tab) {
      if (allowedPanels('multi').includes(tab)) this.multiTab = tab
    },

    /** 视角导航：agent 输出的【视角导航】卡片点击回调，切到对应面板（含算法库精确定位）。 */
    navigateTo(panel, sub, algo) {
      // sub 仅当 panel 为 tutor 时有效，且只能是 analysis/explain，避免非法值让 agent 面板两层 tab 都不命中而空白
      if (panel === 'tutor' && ['analysis', 'explain'].includes(sub)) this.activeAiTab = sub
      if (this.mode === 'multi') {
        this.switchMultiTab(panel)
      } else {
        this.switchRightTab(panel)
      }
      // 算法库精确定位：algo 仅当 panel 为 algorithm 时生效。
      // 注意：若同时带 categoryId（知识定位），openTutorial 会把 algoSubTab 重置回 knowledge；
      // 这是预期行为——categoryId 归属「算法知识」子页，「算法模板」页不带 categoryId。
      if (panel === 'algorithm' && algo && typeof algo === 'object') {
        if (algoSubTabs().includes(algo.subTab)) this.algoSubTab = algo.subTab
        if (algo.categoryId) this.openTutorial(algo.categoryId, algo.anchorId ?? null)
      }
    },

    setMultiFiles(files) {
      this.multiState.files = (files || []).map(f => ({
        name: f.name,
        code: f.code || '',
      }))
      this.multiState.activeFileIndex = 0
    },

    addMultiFile(file) {
      if (!file?.name) return
      const idx = this.multiState.files.findIndex(f => f.name === file.name)
      const entry = { name: file.name, code: file.code || '' }
      if (idx >= 0) {
        this.multiState.files[idx] = entry
      } else {
        this.multiState.files.push(entry)
      }
    },

    removeMultiFile(name) {
      const idx = this.multiState.files.findIndex(f => f.name === name)
      if (idx < 0) return
      this.multiState.files.splice(idx, 1)
      if (this.multiState.activeFileIndex >= this.multiState.files.length) {
        this.multiState.activeFileIndex = Math.max(0, this.multiState.files.length - 1)
      }
    },

    clearMultiFiles() {
      this.multiState.files = []
      this.multiState.activeFileIndex = 0
      this.multiState.entryFile = ''
    },

    /**
     * 推导并写入主入口文件名（`multiState.entryFile`），供提问体 `entryFile` 字段使用。
     *
     * 2026-09-14 联调修复 Task 6：`entryFile` 此前**只有读、没有写**，于是 `buildChatBody`
     * 里的 `entryFile` 恒为 `''`，Coze 侧永远收不到主入口，只能靠兜底猜文件。
     *
     * 两个来源，**先真后备**：
     * 1. `projectAnalysis.entry.class`——`/api/project/analyze` 的 `entry` 是
     *    `{class, method}` **对象**（不是文件名字符串），故按「去掉 .java 后等于类名」反查文件名；
     * 2. 兜底：扫含 `public static void main` 的源文件（与后端 `hasMainMethod` 同口径）。
     *    这条让入口在**用户没点开流程图面板**时也能确定——`analyzeProject` 是面板/按钮触发的，
     *    不能作为唯一来源。
     *
     * 两处都推不出时**保留原值**（`entryFile` 可能来自一次更完整的分析），只有当既没有
     * 分析结果、也没有含 main 的文件时才置空。
     */
    refreshEntryFile() {
      const files = this.multiState.files || []
      if (!files.length) {
        this.multiState.entryFile = ''
        return
      }
      const cls = this.multiState.projectAnalysis?.entry?.class
      if (cls && typeof cls === 'string') {
        const target = `${cls}.java`.toLowerCase()
        const hit = files.find((f) => {
          const base = String(f.name || '').replace(/\\/g, '/').split('/').pop() || ''
          return base.toLowerCase() === target
        })
        if (hit) {
          this.multiState.entryFile = hit.name
          return
        }
      }
      const withMain = files.find((f) => /public\s+static\s+void\s+main\s*\(/.test(f.code || ''))
      if (withMain) {
        this.multiState.entryFile = withMain.name
        return
      }
      this.multiState.entryFile = ''
    },

    setActiveMultiFile(index) {
      if (index < 0 || index >= this.multiState.files.length) return
      this.multiState.activeFileIndex = index
    },

    setUmlCache(kind, entry) {
      this.multiState.umlCache = {
        ...this.multiState.umlCache,
        [kind]: entry,
      }
    },

    /** 项目静态分析：POST /api/project/analyze 生成流程图/类图/结构图 */
    async analyzeProject() {
      const files = this.multiState.files
      if (!files.length) return
      this.multiState.isAnalyzingProject = true
      this.multiState.projectAnalysisError = null
      try {
        const res = await http('/api/project/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: files.map(f => ({ path: f.name, code: f.code })),
          }),
        })
        const data = await res.json()
        if (data.success === false) {
          this.multiState.projectAnalysisError = data.error || '分析失败'
        } else {
          this.multiState.projectAnalysis = data
          // 分析结果里的 entry.class 是比「扫 main 方法」更权威的入口来源，故覆写一次。
          this.refreshEntryFile()
        }
      } catch (e) {
        this.multiState.projectAnalysisError = e.message || '分析请求失败'
      } finally {
        this.multiState.isAnalyzingProject = false
      }
    },

    resetMultiRun() {
      this.steps = []
      this.currentStep = 0
      this.error = null
      this.output = ''
      this.runId = null
    },

    // --- 算法教程提示弹窗 ---

    /** 从当前运行的所有步骤中（从末步往前）识别一个知识库目标（分类 + 可选算法小节）。 */
    detectRunCategory() {
      for (let i = this.steps.length - 1; i >= 0; i--) {
        const target = detectTutorialCategory(this.steps[i], this.steps[i - 1] || null, this.code)
        if (target) return target
      }
      return null
    },

    /** 运行成功后调用：识别到算法就显示右下角弹窗，否则复位。 */
    maybeShowTutorialToast() {
      const target = this.detectRunCategory()
      if (target) {
        this.tutorialToast = {
          visible: true,
          categoryId: target.categoryId,
          anchorId: target.anchorId,
          title: target.title,
        }
      } else {
        this.tutorialToast = { visible: false, categoryId: null, anchorId: null, title: '' }
      }
    },

    /** × 关闭当前提示（下次运行仍会重新出现）。 */
    dismissTutorialToast() {
      this.tutorialToast.visible = false
    },

    /** 点击弹窗：切到「算法库」标签并定位到对应分类/算法小节。 */
    openTutorial(categoryId, anchorId) {
      this.switchRightTab('algorithm')
      this.algoSubTab = 'knowledge'
      this.knowledgeNav = { categoryId, anchorId, nonce: this.knowledgeNav.nonce + 1 }
      this.tutorialToast.visible = false
    },
  }
})
