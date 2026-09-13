import { describe, it, expect } from 'vitest'
import {
  TRANSIENT_ERROR_MS,
  buildFixPrompt,
  isRunError,
  runEnvLines,
  shouldAutoDismiss,
} from './errorEntry'

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
  it('旧签名：仍含首行 + [错误原文]，且不含 [运行环境]（向后兼容）', () => {
    const p = buildFixPrompt('编译失败：缺少分号')
    expect(p).toContain('我的代码运行报错了，请帮我看看怎么修正：')
    expect(p).toContain('[错误原文]')
    expect(p).toContain('编译失败：缺少分号')
    expect(p).not.toContain('[运行环境]')
  })

  it('错误原文缺失时不崩、不留 "undefined"', () => {
    const p = buildFixPrompt(undefined)
    expect(p).toContain('[错误原文]')
    expect(p).not.toContain('undefined')
    expect(buildFixPrompt('')).not.toContain('undefined')
  })

  it('单文件 + 默认模式：写明「测试模式未激活」与用例数', () => {
    const p = buildFixPrompt('找不到 main', { mode: 'single', testMode: false, testCaseCount: 0 })
    expect(p).toContain('[运行环境]')
    expect(p).toContain('文件模式：单文件')
    expect(p).toContain('默认模式')
    expect(p).toContain('测试模式未激活')
    expect(p).toContain('已保存用例 0 条')
  })

  it('多文件 + 测试模式：写明文件数/主入口与用例数', () => {
    const p = buildFixPrompt('boom', {
      mode: 'multi', fileCount: 3, entryFile: 'Main.java', testMode: true, testCaseCount: 2,
    })
    expect(p).toContain('多文件（3 个文件，主入口 Main.java）')
    expect(p).toContain('测试模式（已保存用例 2 条）')
  })

  it('事实块只陈述事实，不写 JavaTutor 运行语义（语义在 coze 侧）', () => {
    const p = buildFixPrompt('x', { mode: 'single', testMode: false, testCaseCount: 0 })
    for (const word of ['Launcher', '注释', '抽取', 'main 方法']) {
      expect(p).not.toContain(word)
    }
  })
})

describe('runEnvLines', () => {
  it('ctx 缺失 / 空 → 不产出任何行', () => {
    expect(runEnvLines()).toEqual([])
    expect(runEnvLines(null)).toEqual([])
    expect(runEnvLines({})).toEqual([])
  })

  it('字段部分缺失 → 只出已有行，不抛异常', () => {
    expect(runEnvLines({ testMode: true })).toEqual(['- 运行模式：测试模式（已保存用例 0 条）'])
    expect(runEnvLines({ mode: 'multi' })).toEqual(['- 文件模式：多文件（0 个文件，主入口 未指定）'])
  })

  it('testMode 非布尔（缺失）→ 不出运行模式行（不臆测模式）', () => {
    expect(runEnvLines({ mode: 'single' })).toEqual(['- 文件模式：单文件'])
  })
})
