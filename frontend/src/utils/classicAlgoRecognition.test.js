import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  classicVizCases,
  extractPresetCodeFromPanel,
  recognizePresetStep,
  assertRecognition,
} from './classicAlgoVizHarness.js'

const panelPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../components/ClassicCodePanel.vue',
)
const panelSrc = readFileSync(panelPath, 'utf8')

describe('classic preset sync', () => {
  it('every harness case still exists in ClassicCodePanel with fingerprint', () => {
    for (const c of classicVizCases) {
      const code = extractPresetCodeFromPanel(panelSrc, c.name)
      expect(code, `missing preset: ${c.name}`).toBeTruthy()
      expect(code, `fingerprint drift: ${c.name}`).toContain(c.fingerprint)
    }
  })
})

describe('classic preset recognition + visualization', () => {
  for (const c of classicVizCases) {
    it(`${c.name}: identifies structure and viz mode`, () => {
      const code = extractPresetCodeFromPanel(panelSrc, c.name)
      expect(code).toBeTruthy()

      const step = c.build({ code })
      const result = recognizePresetStep(step.heap, step.stackFrames, code)

      try {
        assertRecognition(result, c.expect)
      } catch (err) {
        // Surface richer context for failures
        expect.fail(
          `${c.name}: ${err.message}\n`
          + `badges=${JSON.stringify(result.badges)} sortMode=${result.sortViz?.mode ?? null}`,
        )
      }

      // Soft invariants shared by all cases
      const any =
        result.badges.arrays
        + result.badges.linkedLists
        + result.badges.trees
        + result.badges.graphs
        + result.badges.sort
      expect(any, `${c.name} should detect something`).toBeGreaterThan(0)
    })
  }
})

describe('classic preset coverage summary', () => {
  it('covers sort / array-pointer / matrix / list / tree families', () => {
    const modes = new Set()
    const kinds = new Set()

    for (const c of classicVizCases) {
      const code = extractPresetCodeFromPanel(panelSrc, c.name)
      const step = c.build({ code })
      const result = recognizePresetStep(step.heap, step.stackFrames, code)
      if (result.sortViz) modes.add(result.sortViz.mode)
      if (result.badges.arrays) {
        kinds.add(result.arrays[0]?.dims === 2 ? 'matrix' : 'array')
      }
      if (result.badges.linkedLists) kinds.add('list')
      if (result.badges.trees) kinds.add('tree')
    }

    expect(modes.has('merge-tree')).toBe(true)
    expect(modes.has('bars')).toBe(true)
    expect(modes.has('array-pointers')).toBe(true)
    expect(kinds.has('matrix')).toBe(true)
    expect(kinds.has('list')).toBe(true)
    expect(kinds.has('tree')).toBe(true)
  })
})
