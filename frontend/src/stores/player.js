import { defineStore } from 'pinia'

/*
const mockSteps = [
  // 第3行：创建数组
  { step: 1, line: 3, variables: { arr: [5, 3, 8] } },
  
  // 第4行：n = arr.length
  { step: 2, line: 4, variables: { arr: [5, 3, 8], n: 3 } },
  
  // 第5行：外层循环 i = 0
  { step: 3, line: 5, variables: { arr: [5, 3, 8], n: 3, i: 0 } },
  
  // 第6行：内层循环 j = 0
  { step: 4, line: 6, variables: { arr: [5, 3, 8], n: 3, i: 0, j: 0 } },
  
  // 第7行：判断 arr[0] > arr[1] (5 > 3) 成立
  { step: 5, line: 7, variables: { arr: [5, 3, 8], n: 3, i: 0, j: 0 } },
  
  // 第8行：temp = arr[j]
  { step: 6, line: 8, variables: { arr: [5, 3, 8], n: 3, i: 0, j: 0, temp: 5 } },
  
  // 第9行：arr[j] = arr[j+1]
  { step: 7, line: 9, variables: { arr: [3, 3, 8], n: 3, i: 0, j: 0, temp: 5 } },
  
  // 第10行：arr[j+1] = temp
  { step: 8, line: 10, variables: { arr: [3, 5, 8], n: 3, i: 0, j: 0, temp: 5 } },
  
  // 回到内层循环条件，j++ => j=1，但 n-i-1 = 2，所以 j<2 继续
  { step: 9, line: 6, variables: { arr: [3, 5, 8], n: 3, i: 0, j: 1 } },
  
  // 第7行：判断 arr[1] > arr[2] (5 > 8) 不成立，跳过交换
  { step: 10, line: 7, variables: { arr: [3, 5, 8], n: 3, i: 0, j: 1 } },
  
  // 内层循环结束，j++ => j=2，不满足条件，退出内层，回到外层
  { step: 11, line: 5, variables: { arr: [3, 5, 8], n: 3, i: 1 } },
  
  // 外层循环再次进入内层，i=1，n-i-1 = 1，内层 j=0
  { step: 12, line: 6, variables: { arr: [3, 5, 8], n: 3, i: 1, j: 0 } },
  
  // 判断 arr[0] > arr[1] (3 > 5) 不成立
  { step: 13, line: 7, variables: { arr: [3, 5, 8], n: 3, i: 1, j: 0 } },
  
  // 内层结束，回到外层，i++ => i=2，不满足 i < n-1 (2<2 false)，循环结束
  { step: 14, line: 5, variables: { arr: [3, 5, 8], n: 3, i: 2 } }
]
*/

export const usePlayerStore = defineStore('player', {
  state: () => ({
    steps: [],
    currentStep: 0,
    isLoading: false,
    error: null,
    output: '',
    runId: null, // 核心修复：暴露出 runId 供队友的 ChatBox.vue 监听
  }),
  getters: {
    currentVariables: (state) => state.steps[state.currentStep]?.variables || {},
    currentLine: (state) => state.steps[state.currentStep]?.line || null,
    totalSteps: (state) => state.steps.length,
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
      this.runId = null // 每次运行前清空旧的 runId，防止队友组件误触发
      try {
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })
        const data = await res.json()
        // 兼容两种格式：如果后端用了标准 code 200，或者带了 success 标志
        if (data.code === 200 || data.success) {
            this.steps = data.data || data.steps || []
            this.runId = data.runId
            this.output = data.output || ''
            this.currentStep = 0
            // 简洁日志：打印 steps 长度与首个步骤变量
            console.log('runCode: steps count', (this.steps || []).length)
            console.log('runCode: currentStep', this.currentStep, 'firstStepVars', this.steps[0]?.variables)
        } else {
          this.error = data.error || data.msg || '未知错误'
        }
      } catch (e) {
        this.error = e.message || '网络请求失败'
      } finally {
        this.isLoading = false
      }
    },
    /*
    runMock() {
      this.isLoading = true
      setTimeout(() => {
        this.steps = mockSteps
        this.currentStep = 0
        this.isLoading = false
      }, 500)
    },
    async runCode(code) {
      // （已改）以后替换为真实 API
    },
    */
    nextStep() {
      if (this.currentStep < this.totalSteps - 1) this.currentStep++
    },
    prevStep() {
      if (this.currentStep > 0) this.currentStep--
    }    
    ,
    goToFirst() {
      this.currentStep = 0
    },
    goToLast() {
      if (this.totalSteps > 0) this.currentStep = Math.max(0, this.totalSteps - 1)
    }
  }
})