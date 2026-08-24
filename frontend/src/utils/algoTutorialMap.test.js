import { describe, it, expect } from 'vitest'
import { detectTutorialCategory } from './algoTutorialMap.js'

describe('detectTutorialCategory', () => {
  it('识别归并排序 → 排序分类 + 归并小节', () => {
    const step = {
      heap: {},
      stackFrames: [{ method: 'mergeSort', locals: { arr: [5, 2, 8, 1] } }],
    }
    expect(detectTutorialCategory(step, null, 'void mergeSort(int[] a) {}')).toEqual({
      categoryId: 'sorting',
      title: '归并排序',
      anchorId: '归并排序',
    })
  })

  it('识别 KMP → 查找分类 + KMP 小节', () => {
    const step = {
      heap: {},
      stackFrames: [{
        method: 'kmpSearch',
        locals: { text: 'abcab', pattern: 'ab', next: [0, 0], i: 2, j: 0 },
      }],
    }
    expect(detectTutorialCategory(step, null, 'void kmpSearch(String t, String p) {}')).toEqual({
      categoryId: 'search-and-find',
      title: 'KMP',
      anchorId: 'kmpnext-数组与字符串匹配',
    })
  })

  it('识别图结构 → 图论分类（无具体小节）', () => {
    const step = {
      heap: {
        g: { id: 'g', type: 'Graph', fields: { adj: { '1': [{ to: '2' }] } } },
      },
      stackFrames: [{ args: {}, locals: { g: { ref: 'g' } } }],
    }
    expect(detectTutorialCategory(step, null, '')).toEqual({
      categoryId: 'graph',
      title: '图论',
      anchorId: null,
    })
  })

  it('识别链表 → 链表分类（无具体小节）', () => {
    const step = {
      heap: {
        n1: { id: 'n1', type: 'ListNode', fields: { val: 1, next: null } },
      },
      stackFrames: [{ args: {}, locals: { head: { ref: 'n1' } } }],
    }
    expect(detectTutorialCategory(step, null, '')).toEqual({
      categoryId: 'linked-list',
      title: '链表',
      anchorId: null,
    })
  })

  it('无匹配结构时返回 null', () => {
    const step = { heap: {}, stackFrames: [{ method: 'main', locals: { x: 1 } }] }
    expect(detectTutorialCategory(step, null, '')).toBeNull()
  })
})
