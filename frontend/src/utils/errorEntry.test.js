import { describe, it, expect } from 'vitest'
import { TRANSIENT_ERROR_MS, buildFixPrompt, isRunError, shouldAutoDismiss } from './errorEntry'

describe('isRunError', () => {
  it('同文 → 运行类错误（runCode/applyRunResult 会同时写两处）', () => {
    expect(isRunError('编译失败：缺少分号', { message: '编译失败：缺少分号' })).toBe(true)
  })

  it('没写过 lastRunError → 不是运行类错误（AI 流错误等）', () => {
    expect(isRunError('解说请求失败', null)).toBe(false)
  })

  it('文本不同 → 不是运行类错误（lastRunError 还是上一次运行的旧错误）', () => {
    expect(isRunError('解说请求失败', { message: '上一次的编译错误' })).toBe(false)
  })

  it('双方为空 → 不是', () => {
    expect(isRunError(null, null)).toBe(false)
    expect(isRunError(null, { message: 'x' })).toBe(false)
    expect(isRunError('x', null)).toBe(false)
  })
})

describe('shouldAutoDismiss', () => {
  it('运行类错误不自动消失（弹窗飘走入口就没了）', () => {
    expect(shouldAutoDismiss('编译错误', { message: '编译错误' })).toBe(false)
  })

  it('其它错误 6 秒自动消失', () => {
    expect(shouldAutoDismiss('解说请求失败', null)).toBe(true)
  })

  it('时长常量与既有 toast 行为一致', () => {
    expect(TRANSIENT_ERROR_MS).toBe(6000)
  })
})

describe('buildFixPrompt', () => {
  it('把错误原文写进草稿模板', () => {
    expect(buildFixPrompt('编译失败：缺少分号')).toBe(
      '我的代码运行报错了，请帮我看看怎么修正：\n编译失败：缺少分号',
    )
  })

  it('错误原文缺失时不崩、不留 "undefined"', () => {
    expect(buildFixPrompt(undefined)).toBe('我的代码运行报错了，请帮我看看怎么修正：\n')
    expect(buildFixPrompt('')).not.toContain('undefined')
  })
})
