import { defineStore } from 'pinia'

export const usePlayerStore = defineStore('player', {
  state: () => ({
    steps: [],
    currentStep: 0,
    isLoading: false,
    error: null,
    output: '',
    runId: null,
    // AI explanation state
    code: '',
    explainText: '',
    isExplaining: false,
    autoExplain: false,
    explainExpanded: false,
    explainError: null,
    explainAbortController: null,
    explainHistory: {},
    // Code analysis state
    analysisData: null,
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
    userApiKey: '',
    apiProvider: 'zhipu',  // zhipu | deepseek | openai | kimi | custom
    apiUrl: '',
    apiModel: '',
    pendingFiles: [],
    // Provider presets for format validation and auto-fill
    apiProviders: {
      zhipu:  { label: '智谱', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4.7-flash', keyHint: 'xxxxxxxx.xxxxxxxx',   keyRe: /^[a-zA-Z0-9]{32}\.[a-zA-Z0-9]+$/ },
      deepseek: { label: 'DeepSeek',      url: 'https://api.deepseek.com/v1/chat/completions',              model: 'deepseek-chat',  keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', keyRe: /^sk-[a-zA-Z0-9]{32}$/ },
      openai:  { label: 'OpenAI',        url: 'https://api.openai.com/v1/chat/completions',                 model: 'gpt-4o',         keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', keyRe: /^sk-[a-zA-Z0-9]{32,}$/ },
      kimi:    { label: '月之暗面 (Kimi)', url: 'https://api.moonshot.cn/v1/chat/completions',              model: 'moonshot-v1-8k', keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', keyRe: /^sk-[a-zA-Z0-9]{32,}$/ },
      custom:  { label: '自定义',          url: '',  model: '',  keyHint: '任意 Key',                      keyRe: /^.{1,128}$/ },
    },
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
      this.explainText = ''
      this.explainError = null
      this.explainHistory = {}
      this.analysisData = null
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

    _apiBody(extra = {}) {
      const body = { code: this.code, ...extra }
      if (this.userApiKey) {
        body.apiKey = this.userApiKey
        const p = this.apiProviders[this.apiProvider]
        if (p) {
          body.apiUrl = p.url
          body.apiModel = p.model
        }
        // custom provider uses user-filled url/model
        if (this.apiProvider === 'custom') {
          body.apiUrl = this.apiUrl
          body.apiModel = this.apiModel
        }
      }
      if (this.testMode) body.mode = 'test'
      return body
    },

    async requestOverview() {
      if (this.explainAbortController) {
        this.explainAbortController.abort()
      }

      if (!this.code) return

      this.isExplaining = true
      this.explainText = ''
      this.explainError = null
      this.explainAbortController = new AbortController()

      try {
        const response = await fetch('/api/explain/overview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this._apiBody()),
          signal: this.explainAbortController.signal
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEvent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              const data = line.slice(5).trim()
              if (!data) continue
              if (currentEvent === 'error') {
                this.explainError = data
                currentEvent = ''
                return
              }
              this.explainText += data
              currentEvent = ''
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          this.explainError = e.message || '整体解说请求失败'
        }
      } finally {
        this.isExplaining = false
        this.explainAbortController = null
      }
    },

    async requestExplain(topic) {
      if (this.explainAbortController) {
        this.explainAbortController.abort()
      }

      if (!this.code || this.totalSteps === 0) return

      this.isExplaining = true
      this.explainText = ''
      this.explainError = null
      this.explainAbortController = new AbortController()

      const vars = topic
        ? { ...this.currentVariables, _explainTopic: topic }
        : this.currentVariables

      try {
        const response = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this._apiBody({
            runId: this.runId,
            step: this.currentStep,
            totalSteps: this.totalSteps,
            currentLine: this.currentLine,
            variables: vars,
          })),
          signal: this.explainAbortController.signal
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEvent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              const data = line.slice(5).trim()
              if (!data) continue
              if (currentEvent === 'error') {
                this.explainError = data
                currentEvent = ''
                return  // 出错立即结束
              }
              this.explainText += data
              currentEvent = ''
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          this.explainError = e.message || '解说请求失败'
        }
      } finally {
        this.isExplaining = false
        this.explainAbortController = null
        if (!this.explainError && this.explainText) {
          this.explainHistory[this.currentStep] = this.explainText
        }
      }
    },

    toggleExplainPanel() {
      this.explainExpanded = !this.explainExpanded
      if (!this.explainExpanded) {
        this.explainText = ''
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
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this._apiBody())
        })
        const data = await res.json()
        if (data.error) {
          console.warn('Analysis failed:', data.error)
        } else {
          this.analysisData = data
        }
      } catch (e) {
        console.warn('Analysis request failed:', e.message)
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
