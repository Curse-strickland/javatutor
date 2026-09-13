import { describe, it, expect } from 'vitest'
import {
  MAX_OPT_RETRY,
  SNAPSHOT_UNDO_CONFIRM,
  buildGateRequest,
  buildRetryPrompt,
  canApply,
  classifyGateFailure,
  hasUsableReplace,
  nextRetry,
  pickApplyMode,
  readGateResponse,
  resolveTarget,
  retryLabel,
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

describe('classifyGateFailure', () => {
  it('fetch 抛异常 → transport', () => {
    expect(classifyGateFailure({ thrown: true })).toBe('transport')
  })

  it('HTTP ≥ 400 → transport', () => {
    expect(classifyGateFailure({ httpStatus: 500 })).toBe('transport')
    expect(classifyGateFailure({ httpStatus: 404 })).toBe('transport')
  })

  it('HTTP 200 + success:false（编译/运行失败）→ run', () => {
    expect(classifyGateFailure({ httpStatus: 200 })).toBe('run')
  })

  it('缺参默认 → run（不把未知当链路故障，否则永远不返修）', () => {
    expect(classifyGateFailure()).toBe('run')
  })
})

describe('nextRetry', () => {
  const base = {
    attempt: 0,
    kind: 'run',
    applied: false,
    targetBlocked: false,
    isLatest: true,
    hasCode: true,
  }

  it('第 1 次失败 → 发起第 1 次返修', () => {
    expect(nextRetry(base)).toEqual({ action: 'retry', attempt: 1, max: MAX_OPT_RETRY })
  })

  it('第 1 次返修后仍失败 → 发起第 2 次返修', () => {
    expect(nextRetry({ ...base, attempt: 1 })).toEqual({ action: 'retry', attempt: 2, max: MAX_OPT_RETRY })
  })

  it('已达上限 → stop（最多 3 版候选）', () => {
    expect(nextRetry({ ...base, attempt: MAX_OPT_RETRY })).toEqual({
      action: 'stop',
      attempt: MAX_OPT_RETRY,
      max: MAX_OPT_RETRY,
    })
  })

  it('已应用 / 目标被拦截 / 非最新 / 无候选代码 → stop', () => {
    for (const s of [
      { applied: true },
      { targetBlocked: true },
      { isLatest: false },
      { hasCode: false },
    ]) {
      expect(nextRetry({ ...base, ...s }).action).toBe('stop')
    }
  })

  it('传输失败 → regate 且不递增次数（不烧返修额度）', () => {
    expect(nextRetry({ ...base, kind: 'transport' })).toEqual({
      action: 'regate',
      attempt: 0,
      max: MAX_OPT_RETRY,
    })
    expect(nextRetry({ ...base, kind: 'transport', attempt: 1 }).attempt).toBe(1)
  })

  it('stop 优先于 transport（已应用 + 传输失败仍 stop）', () => {
    expect(nextRetry({ ...base, kind: 'transport', applied: true }).action).toBe('stop')
  })
})

describe('retryLabel', () => {
  it('带当前次数与上限', () => {
    expect(retryLabel(1)).toBe(`校验未通过，正在自动修正 1/${MAX_OPT_RETRY}…`)
    expect(retryLabel(2, 3)).toContain('2/3')
  })
})

describe('buildRetryPrompt', () => {
  const plan = { code: 'class A { int x() { return 1; } }', goal: '提升可读性', target: 'Solution.java' }

  it('含错误原文、候选全文、goal 与 target', () => {
    const p = buildRetryPrompt({ plan, gateError: 'error: 需要 ;', goalLabel: '提升可读性', attempt: 1 })
    expect(p).toContain('error: 需要 ;')
    expect(p).toContain(plan.code)
    expect(p).toContain('提升可读性')
    expect(p).toContain('Solution.java')
  })

  it('含与 coze 侧引导互为字面包含的关键标记', () => {
    // 这两个短语同时被 tests/test_optimization_guidance.py 断言；一端改字必须另一端红。
    const p = buildRetryPrompt({ plan, gateError: 'e', attempt: 1 })
    expect(p).toContain('上一版优化代码没有通过编译/运行校验')
    expect(p).toContain('上一版候选代码')
  })

  it('要求保持 goal/target 不变并只给一个 replace 块', () => {
    const p = buildRetryPrompt({ plan, gateError: 'e', attempt: 2 })
    expect(p).toContain('kind:"replace"')
    expect(p).toContain('goal 与 target 保持不变')
    expect(p).toContain('2/2')
  })

  it('plan.code 为空 / 参数缺失时不抛异常', () => {
    expect(() => buildRetryPrompt({})).not.toThrow()
    expect(buildRetryPrompt({ plan: { code: '' }, gateError: '' })).toContain('（当前文件）')
  })
})

describe('hasUsableReplace', () => {
  it('含 kind:"replace" 的【编辑建议】块 → true', () => {
    const raw = '修正后如下\n\n【编辑建议】\n{"kind":"replace","target":"Solution.java","goal":"performance","code":"class A {}"}'
    expect(hasUsableReplace(raw)).toBe(true)
  })

  it('无块 / 只有正文 / 空文本 → false', () => {
    expect(hasUsableReplace('只是解释了一下错误')).toBe(false)
    expect(hasUsableReplace('')).toBe(false)
    expect(hasUsableReplace(null)).toBe(false)
  })

  it('kind:"options" 或纯 patch 块 → false（返修只要 replace）', () => {
    const options = '【编辑建议】\n{"kind":"options","options":[{"goal":"performance"}]}'
    expect(hasUsableReplace(options)).toBe(false)
    const patch = '【编辑建议】\n{"edits":[{"old_string":"a","new_string":"b"}]}'
    expect(hasUsableReplace(patch)).toBe(false)
  })

  it('replace 块 code 为空 → false（与解析器同口径）', () => {
    expect(hasUsableReplace('【编辑建议】\n{"kind":"replace","code":"  "}')).toBe(false)
  })
})
