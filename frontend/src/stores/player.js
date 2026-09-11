import { defineStore } from 'pinia'
import { detectTutorialCategory } from '../utils/algoTutorialMap.js'
import { http } from '../utils/http.js'
import { allowedPanels, algoSubTabs } from '../constants/uiPanelManifest.js'
import { buildGoalPrompt } from '../utils/editSuggestion.js'
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
      umlCache: {},          // {kind: {svg, ts, source}}
      projectAnalysis: null, // { entry, flow, classDiagram, structure, errors }
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
      const q = (question || '').trim()
      if (!this.code || !q) return

      this.isExplaining = true
      this.explainError = null
      this.explainStage = ''
      this.explainAbortController = new AbortController()

      // 先放入用户消息，再追加空 assistant 消息接收流式回复
      this.chatMessages.push({ role: 'user', text: q })
      this.chatMessages.push({ role: 'assistant', text: '' })
      const assistantIdx = this.chatMessages.length - 1

      try {
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
        const response = await http('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: this.code,
            runId: this.runId,
            step: this.currentStep,
            totalSteps: this.totalSteps,
            currentLine: this.currentLine,
            steps: stepSnapshots,
            variables: { ...this.currentVariables, _explainTopic: q },
            files: this.multiState.files.map(f => ({ name: f.name, code: f.code })),   // 全部文件
            entryFile: this.multiState.entryFile || '',                                // 主入口（可选）
          }),
          signal: this.explainAbortController.signal
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEvent = ''
        // SSE 多行 data 累积：一个事件可有多个 data: 行，按标准用 \n 连接
        let eventData = []

        const flushEvent = () => {
          if (currentEvent === 'chunk' && eventData.length) {
            this.chatMessages[assistantIdx].text += eventData.join('\n')
          } else if (currentEvent === 'error') {
            this.explainError = eventData.join('\n')
          } else if (currentEvent === 'stage' && eventData.length) {
            this.explainStage = eventData.join('\n')
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
      } catch (e) {
        if (e.name !== 'AbortError') {
          this.explainError = e.message || '自由问答请求失败'
        }
      } finally {
        this.isExplaining = false
        this.explainAbortController = null
      }
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
