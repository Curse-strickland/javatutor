import { describe, it, expect } from 'vitest'
import {
  MAX_TIMELINE,
  REVERT_CONFIRM,
  buildCheckpointLabel,
  clampActiveIndex,
  foldStartIndex,
  foldedCount,
  isFolded,
} from './timeline'

describe('timeline 纯函数（记录点摘要 / 折叠边界 / 下标收敛）', () => {
  describe('buildCheckpointLabel', () => {
    const run = {
      seq: 2, kind: 'run', mode: 'single', time: '14:05',
      methodName: 'bubbleSort', code: 'a\nb\nc\n', steps: [{}, {}], output: 'done\nx',
    }

    it('单文件：含序号/方法名/时间/行数/步数/输出', () => {
      expect(buildCheckpointLabel(run)).toBe('#2 · bubbleSort · 14:05 · 4 行 · 2 步 · 输出 "done"')
    })

    it('单文件：空值不产生空段（不得出现「· ·」）', () => {
      const label = buildCheckpointLabel({
        ...run, methodName: '', time: '', steps: undefined, output: '',
      })
      expect(label).toBe('#2 · 4 行')
      expect(label).not.toContain('· ·')
      expect(label.startsWith('·')).toBe(false)
    })

    it('多文件：含「项目 N 文件（入口 X）」', () => {
      const label = buildCheckpointLabel({
        seq: 1, kind: 'run', mode: 'multi', time: '09:30',
        fileCount: 3, entryFile: 'Main.java', steps: [{}, {}, {}], output: 'hi',
      })
      expect(label).toBe('#1 · 项目 3 文件（入口 Main.java） · 09:30 · 3 步 · 输出 "hi"')
    })

    it('多文件：无 fileCount 时退化为「项目」', () => {
      expect(buildCheckpointLabel({ seq: 1, kind: 'run', mode: 'multi', fileCount: 0 }))
        .toBe('#1 · 项目')
    })

    it('optimize：含目标方向与文件名', () => {
      const label = buildCheckpointLabel({
        seq: 4, kind: 'optimize', mode: 'single', time: '15:00',
        goalLabel: '性能', target: 'Solution.java',
      })
      expect(label).toBe('#4 · 已应用优化（性能） · Solution.java · 15:00')
    })

    it('optimize：无 goalLabel 时退化为「已应用优化」', () => {
      expect(buildCheckpointLabel({ seq: 4, kind: 'optimize', mode: 'single' }))
        .toContain('已应用优化')
    })

    it('输出超过 20 字截断并加省略号', () => {
      expect(buildCheckpointLabel({ ...run, output: 'x'.repeat(30) }))
        .toContain('输出 "xxxxxxxxxxxxxxxxxxxx…"')
    })

    it('输出取首个非空行并去空白', () => {
      expect(buildCheckpointLabel({ ...run, output: '\n\n  real  \nsecond' })).toContain('输出 "real"')
    })
  })

  describe('折叠边界', () => {
    it('未折叠（null / 负数 / 非数字）→ start 为 -1、不折叠任何一条', () => {
      for (const v of [null, undefined, -1, 'x']) {
        expect(foldStartIndex(v)).toBe(-1)
        expect(isFolded(0, v)).toBe(false)
        expect(foldedCount(5, v)).toBe(0)
      }
    })

    it('foldFromIndex = k → 折叠 k+1 之后的全部消息', () => {
      expect(foldStartIndex(3)).toBe(4)
      expect(isFolded(3, 3)).toBe(false) // 分割线自身不折叠
      expect(isFolded(4, 3)).toBe(true)
      expect(foldedCount(10, 3)).toBe(6)
    })

    it('foldFromIndex >= total → 折叠数为 0（不出现负数）', () => {
      expect(foldedCount(5, 4)).toBe(0)
      expect(foldedCount(5, 99)).toBe(0)
    })
  })

  describe('clampActiveIndex', () => {
    it('越界收敛到末尾', () => {
      expect(clampActiveIndex(9, 3)).toBe(2)
    })

    it('负数收敛到 0', () => {
      expect(clampActiveIndex(-2, 3)).toBe(0)
    })

    it('无文件 → -1', () => {
      expect(clampActiveIndex(0, 0)).toBe(-1)
    })

    it('非整数下标按 0 处理', () => {
      expect(clampActiveIndex(undefined, 3)).toBe(0)
    })
  })

  it('常量：上限 30、回退确认文案明示「覆盖编辑器 + 重跑」', () => {
    expect(MAX_TIMELINE).toBe(30)
    expect(REVERT_CONFIRM).toContain('覆盖当前编辑器内容')
    expect(REVERT_CONFIRM).toContain('刷新')
  })
})
