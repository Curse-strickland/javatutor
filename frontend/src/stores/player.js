import { defineStore } from 'pinia'

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
    explainAbortController: null,
    explainHistory: {},
    // Code analysis state
    analysisData: null,
    analysisError: null,
    isAnalyzing: false,
    controlFlowData: null,
    cfViewStack: [],
    activeAiTab: 'explain',
    // 测试模式
    testMode: false,
    testCases: [],
    methodName: '',
    methodSignature: '',
    // File upload state
    rightTab: 'variables',
    pendingFiles: [],
    uploadHistory: (() => {
      try { return JSON.parse(localStorage.getItem('javatutor-uploads')) || [] }
      catch { return [] }
    })(),
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
        if (data.code === 200 || data.success) {
          this.steps = data.data || data.steps || []
          this.runId = data.runId
          this.output = data.output || ''
          this.currentStep = 0
          if (data.methodName) this.methodName = data.methodName
          if (data.methodSignature) this.methodSignature = data.methodSignature
          this.requestAnalysis()
          this.cfViewStack = []
          this.requestControlFlow()
        } else {
          this.error = data.error || data.msg || '未知错误'
        }
      } catch (e) {
        this.error = e.message || '网络请求失败'
      } finally {
        this.isLoading = false
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
      this.explainAbortController = new AbortController()

      // 先放入用户消息，再追加空 assistant 消息接收流式回复
      this.chatMessages.push({ role: 'user', text: q })
      this.chatMessages.push({ role: 'assistant', text: '' })
      const assistantIdx = this.chatMessages.length - 1

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: this.code,
            runId: this.runId,
            step: this.currentStep,
            totalSteps: this.totalSteps,
            currentLine: this.currentLine,
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
      this.rightTab = tab
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
    }
  }
})
