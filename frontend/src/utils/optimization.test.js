import { describe, it, expect } from 'vitest'
import {
  SNAPSHOT_UNDO_CONFIRM,
  buildGateRequest,
  canApply,
  pickApplyMode,
  readGateResponse,
  resolveTarget,
} from './optimization'

const FILES = [
  { name: 'Main.java', code: 'class Main {}' },
  { name: 'Solution.java', code: 'class Solution {}' },
]

describe('resolveTarget', () => {
  it('单文件模式恒为 ok（target 可省略）', () => {
    expect(resolveTarget('single', [], '')).toMatchObject({ status: 'ok', index: 0 })
    expect(resolveTarget('single', [], 'Solution.java')).toMatchObject({ status: 'ok', index: 0 })
  })

  it('多文件按文件名定位', () => {
    expect(resolveTarget('multi', FILES, 'Solution.java')).toMatchObject({ status: 'ok', index: 1 })
  })

  it('多文件 target 缺失 → missing-required（不得静默落到激活文件）', () => {
    expect(resolveTarget('multi', FILES, '').status).toBe('missing-required')
    expect(resolveTarget('multi', FILES, undefined).status).toBe('missing-required')
  })

  it('多文件 target 找不到 → not-found', () => {
    expect(resolveTarget('multi', FILES, 'Nope.java').status).toBe('not-found')
  })
})

describe('buildGateRequest', () => {
  it('单文件 → POST /api/run {code}', () => {
    expect(buildGateRequest({ mode: 'single', code: 'class A {}' })).toEqual({
      url: '/api/run',
      body: { code: 'class A {}' },
    })
  })

  it('单文件 + 测试模式 → 带 mode/testCases', () => {
    const req = buildGateRequest({ mode: 'single', code: 'x', testMode: true, testCases: [{ in: '1' }] })
    expect(req.body).toEqual({ code: 'x', mode: 'test', testCases: [{ in: '1' }] })
  })

  it('多文件 → POST /api/run/project，仅 target 被替换为候选', () => {
    const req = buildGateRequest({ mode: 'multi', files: FILES, target: 'Solution.java', code: 'class New {}' })
    expect(req.url).toBe('/api/run/project')
    expect(req.body.files).toEqual([
      { name: 'Main.java', code: 'class Main {}' },
      { name: 'Solution.java', code: 'class New {}' },
    ])
  })

  it('多文件不改动原 files（不就地变异）', () => {
    buildGateRequest({ mode: 'multi', files: FILES, target: 'Solution.java', code: 'class New {}' })
    expect(FILES[1].code).toBe('class Solution {}')
  })
})

describe('readGateResponse', () => {
  it('code=200 或 success=true → ok', () => {
    expect(readGateResponse({ code: 200 })).toEqual({ ok: true, error: '' })
    expect(readGateResponse({ success: true })).toEqual({ ok: true, error: '' })
  })

  it('失败 → 取 error/msg 原文', () => {
    expect(readGateResponse({ code: 400, error: '编译失败' })).toEqual({ ok: false, error: '编译失败' })
    expect(readGateResponse({ success: false, msg: '超时' })).toEqual({ ok: false, error: '超时' })
    expect(readGateResponse(null).ok).toBe(false)
  })
})

describe('canApply', () => {
  it('目标可覆盖 + 门禁通过 + 未应用 → 可用', () => {
    expect(canApply({ targetBlocked: false, gate: 'ok', applied: false })).toBe(true)
  })

  it('门禁未通过（running/fail/idle）→ 禁用', () => {
    for (const gate of ['idle', 'running', 'fail']) {
      expect(canApply({ targetBlocked: false, gate, applied: false })).toBe(false)
    }
  })

  it('目标被拦截（缺 target / 找不到文件）→ 即使门禁通过也禁用', () => {
    expect(canApply({ targetBlocked: true, gate: 'ok', applied: false })).toBe(false)
  })

  it('已应用 → 按钮转为「撤销」，不再是可应用态', () => {
    expect(canApply({ targetBlocked: false, gate: 'ok', applied: true })).toBe(false)
  })
})

describe('pickApplyMode', () => {
  it('单文件走 Monaco 全文覆盖（单个 undo 单元）', () => {
    expect(pickApplyMode('single')).toBe('monaco')
  })

  it('多文件走快照写入（跨文件无法保持 undo 单元）', () => {
    expect(pickApplyMode('multi')).toBe('snapshot')
  })

  it('撤销确认文案明示「将丢弃此后的编辑」', () => {
    expect(SNAPSHOT_UNDO_CONFIRM).toContain('将丢弃此后的编辑')
  })
})
