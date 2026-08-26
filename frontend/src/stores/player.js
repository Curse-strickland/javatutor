import { defineStore } from 'pinia'
import { detectTutorialCategory } from '../utils/algoTutorialMap.js'

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
    multiRightTab: 'variables',
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
    async runCode(code) {
      this.isLoading = true
      this.error = null
      this.output = ''
      this.runId = null
      this.code = code
      this.chatMessages = []
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
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const data = await res.json()
        this.applyRunResult(data)
      } catch (e) {
        this.error = e.message || '网络请求失败'
      } finally {
        this.isLoading = false
      }
    },

    /** 多文件项目运行：把整个项目发送给后端统一编译执行 */
    async runProject() {
      const files = this.multiState.files
      if (!files.length) return
      this.isLoading = true
      this.error = null
      this.output = ''
      this.runId = null
      this.code = files[this.multiState.activeFileIndex]?.code || ''
      this.chatMessages = []
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
        const res = await fetch('/api/run/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files })
        })
        const data = await res.json()
        this.applyRunResult(data)
      } catch (e) {
        this.error = e.message || '网络请求失败'
      } finally {
        this.isLoading = false
      }
    },

    /** 统一处理运行结果（单文件 / 多文件共用） */
    applyRunResult(data) {
      if (data.code === 200 || data.success) {
        this.steps = data.data || data.steps || []
        this.runId = data.runId
        this.output = data.output || ''
        this.currentStep = 0
        this.maybeShowTutorialToast()
        if (data.methodName) this.methodName = data.methodName
        if (data.methodSignature) this.methodSignature = data.methodSignature
        this.requestAnalysis()
        this.cfViewStack = []
        this.requestControlFlow()
      } else {
        this.error = data.error || data.msg || '未知错误'
      }
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
          variables: s.variables || {},
          heap: s.heap || {},
          stackFrames: s.stackFrames || [],
          output: s.output
        }))
        const response = await fetch('/api/ai/chat', {
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
        const res = await fetch('/api/ai/analyze', {
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
        const res = await fetch('/api/ai/animate', {
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
      const allowed = ['variables', 'flow', 'datastructure', 'algorithm', 'tutor']
      if (allowed.includes(tab)) this.rightTab = tab
    },

    async requestControlFlow() {
      if (!this.code) return
      try {
        const res = await fetch('/api/controlflow', {
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

    switchMultiRightTab(tab) {
      const allowed = ['variables', 'controlflow', 'flow', 'dataflow', 'structure', 'class', 'usecase']
      if (allowed.includes(tab)) this.multiRightTab = tab
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
        const res = await fetch('/api/project/analyze', {
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
      this.knowledgeNav = { categoryId, anchorId, nonce: this.knowledgeNav.nonce + 1 }
      this.tutorialToast.visible = false
    },
  }
})
