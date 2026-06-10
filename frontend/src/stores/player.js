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
    activeAiTab: 'explain',
    // File upload state
    rightTab: 'variables',
    uploadHistory: (() => {
      try { return JSON.parse(localStorage.getItem('javatutor-uploads')) || [] }
      catch { return [] }
    })(),
  }),
  getters: {
    currentVariables: (state) => state.steps[state.currentStep]?.variables || {},
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
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })
        const data = await res.json()
        if (data.code === 200 || data.success) {
          this.steps = data.data || data.steps || []
          this.runId = data.runId
          this.output = data.output || ''
          this.currentStep = 0
          this.requestAnalysis()
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
          body: JSON.stringify({
            code: this.code,
            runId: this.runId,
            step: this.currentStep,
            totalSteps: this.totalSteps,
            currentLine: this.currentLine,
            variables: vars
          }),
          signal: this.explainAbortController.signal
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data) this.explainText += data
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
          body: JSON.stringify({ code: this.code })
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

    // --- File upload actions ---

    switchRightTab(tab) {
      this.rightTab = tab
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
