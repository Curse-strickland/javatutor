import { extractDataStructures } from './dataStructureExtract.js'
import { extractSortViz } from './sortVizExtract.js'
import { extractKmpViz } from './kmpVizExtract.js'
import index from '../assets/algo-knowledge/index.json'

const CATEGORIES = index.categories || []

const QUICK_PATTERN = /quickSort|partition/i
const BINARY_PATTERN = /binarySearch|二分/i

// 排序 mode → 弹窗标题 + 在「排序」分类里查具体小节的锚点标题
const SORT_MODE = {
  'merge-tree': { title: '归并排序', anchorTitle: '归并' },
  bars: { title: '插入排序', anchorTitle: '插入' },
  heap: { title: '堆排序', anchorTitle: '堆排' },
  array: { title: '希尔排序', anchorTitle: '希尔' },
}

function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) ?? null
}

function anchorByTitle(categoryId, title) {
  return categoryById(categoryId)?.anchors?.find((a) => a.title === title) ?? null
}

/**
 * 识别当前运行步骤对应的「算法知识库」目标（分类 + 可选具体小节锚点）。
 *
 * 与「数据结构」面板复用同一套抽取（extractKmpViz / extractSortViz /
 * extractDataStructures），保证面板显示算法标签时这里也能识别到并弹窗。
 *
 * 返回 { categoryId, title, anchorId } | null：
 * - categoryId：跳转时选中的知识库分类 id
 * - title：弹窗显示的算法名（结构类则为分类标题）
 * - anchorId：具体算法小节锚点 id（结构类为 null，只落到分类）
 */
export function detectTutorialCategory(step, prevStep, code) {
  if (!step) return null
  const heap = step.heap || {}
  const frames = step.stackFrames || []
  const codeHint = code || ''
  const methodStr = frames.map((f) => String(f?.method || '')).join(' ')
  const ctx = `${methodStr} ${codeHint}`

  // 1) 字符串匹配（KMP）——优先，避免 next[] 被误判为排序
  if (extractKmpViz(heap, frames, codeHint, prevStep?.stackFrames || null)) {
    const anchor = anchorByTitle('search-and-find', 'KMP')
    return { categoryId: 'search-and-find', title: 'KMP', anchorId: anchor?.id ?? null }
  }

  // 2) 排序——映射到具体排序算法小节
  const sortViz = extractSortViz(heap, frames, codeHint)
  if (sortViz) {
    const mapped = SORT_MODE[sortViz.mode]
    if (mapped) {
      const anchor = anchorByTitle('sorting', mapped.anchorTitle)
      return { categoryId: 'sorting', title: mapped.title, anchorId: anchor?.id ?? null }
    }
    // array-pointers：区分快排 / 二分 / 通用指针
    if (QUICK_PATTERN.test(ctx)) {
      const anchor = anchorByTitle('sorting', '快排')
      return { categoryId: 'sorting', title: '快速排序', anchorId: anchor?.id ?? null }
    }
    if (BINARY_PATTERN.test(ctx)) {
      const anchor = anchorByTitle('search-and-find', '二分')
      return { categoryId: 'search-and-find', title: '二分查找', anchorId: anchor?.id ?? null }
    }
    return { categoryId: 'sorting', title: '排序', anchorId: null }
  }

  // 3) 结构：图 / 树 / 链表 → 落到分类
  const { graphs, trees, linkedLists } = extractDataStructures(
    heap,
    frames,
    prevStep?.heap || null,
    prevStep?.stackFrames || null,
  )
  if (graphs.length) return { categoryId: 'graph', title: '图论', anchorId: null }
  if (trees.length) return { categoryId: 'tree', title: '树', anchorId: null }
  if (linkedLists.length) return { categoryId: 'linked-list', title: '链表', anchorId: null }

  return null
}
