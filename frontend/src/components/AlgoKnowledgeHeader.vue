<template>
  <div class="algo-knowledge">
    <div class="ak-body">
      <nav class="ak-cats" aria-label="知识库类别">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="ak-cat-btn"
          :class="{ active: cat.id === activeCategoryId }"
          @click="selectCategory(cat.id)"
        >
          {{ cat.title }}
        </button>
      </nav>

      <nav
        v-if="activeCategory?.anchors?.length"
        class="ak-anchors"
        aria-label="章节锚点"
      >
        <button
          v-for="anchor in activeCategory.anchors"
          :key="anchor.id"
          type="button"
          class="ak-anchor-btn"
          @click="scrollToAnchor(anchor.id)"
        >
          {{ anchor.title }}
        </button>
      </nav>

      <div ref="contentRef" class="ak-content sm-md" v-html="renderedHtml" @click="onContentClick" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import index from '../assets/algo-knowledge/index.json'
import { renderSimpleMarkdown } from '../utils/simpleMarkdown.js'
import { usePlayerStore } from '../stores/player'

import fundamentalsMd from '../assets/algo-knowledge/fundamentals.md?raw'
import sortingMd from '../assets/algo-knowledge/sorting.md?raw'
import searchMd from '../assets/algo-knowledge/search.md?raw'
import graphMd from '../assets/algo-knowledge/graph.md?raw'
import treeMd from '../assets/algo-knowledge/tree.md?raw'
import dpMd from '../assets/algo-knowledge/dp.md?raw'
import linkedListMd from '../assets/algo-knowledge/linked-list.md?raw'

const mdByFile = {
  'fundamentals.md': fundamentalsMd,
  'sorting.md': sortingMd,
  'search.md': searchMd,
  'graph.md': graphMd,
  'tree.md': treeMd,
  'dp.md': dpMd,
  'linked-list.md': linkedListMd,
}

const categories = index.categories
const activeCategoryId = ref(categories[0]?.id ?? '')
const contentRef = ref(null)
const store = usePlayerStore()

// 教程弹窗跳转：外部通过 knowledgeNav 指定目标分类（+可选算法小节）时，展开并选中/定位
watch(() => store.knowledgeNav.nonce, async (nonce) => {
  if (!nonce) return
  if (store.knowledgeNav.categoryId) activeCategoryId.value = store.knowledgeNav.categoryId
  if (store.knowledgeNav.anchorId) {
    await nextTick()
    scrollToAnchor(store.knowledgeNav.anchorId)
  }
})

const activeCategory = computed(() =>
  categories.find(c => c.id === activeCategoryId.value) ?? null,
)

const renderedHtml = computed(() => {
  const file = activeCategory.value?.file
  if (!file) return ''
  const raw = mdByFile[file] ?? ''
  return renderSimpleMarkdown(raw)
})

function selectCategory(id) {
  activeCategoryId.value = id
}

function scrollToAnchor(id) {
  nextTick(() => {
    const root = contentRef.value
    if (!root) return
    const el = root.querySelector(`#${CSS.escape(id)}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// 代码块复制按钮：v-html 内容无法绑 Vue 事件，用事件委托在容器上统一处理
function onContentClick(event) {
  const btn = event.target.closest('.sm-code-copy')
  if (!btn) return
  const code = btn.closest('.sm-code')?.querySelector('.sm-code-body code')
  if (!code) return
  const text = code.textContent

  const done = () => {
    const prev = btn.textContent
    btn.textContent = '已复制'
    btn.classList.add('copied')
    window.setTimeout(() => {
      btn.textContent = prev
      btn.classList.remove('copied')
    }, 1400)
  }

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {})
  } else {
    // 非安全上下文回退
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      done()
    } catch {
      /* ignore */
    }
    document.body.removeChild(ta)
  }
}

</script>

<style scoped>
.algo-knowledge {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border);
  flex: 1 1 auto;
  min-height: 0;
}
.ak-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 0 8px 8px;
  background: var(--card-bg);
}
.ak-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--border);
  flex-shrink: 0;
}
.ak-cat-btn {
  padding: 3px 8px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--ak-tag-radius);
  cursor: pointer;
  box-shadow: var(--ak-tag-shadow);
  transition: color 0.15s, border-color 0.15s, background 0.15s,
    box-shadow 0.2s ease, transform 0.16s ease;
}
.ak-cat-btn:hover {
  color: var(--text-h);
  border-color: var(--line-strong, var(--border));
  box-shadow: var(--ak-tag-shadow-hover);
  transform: translateY(-1px);
}
.ak-cat-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
  box-shadow: var(--ak-tag-shadow-hover);
  transform: translateY(-1px);
}
.ak-anchors {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 0;
  flex-shrink: 0;
}
.ak-anchor-btn {
  padding: 2px 6px;
  font-family: var(--mono);
  font-size: 9px;
  color: var(--text-muted);
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--ak-tag-radius);
  box-shadow: var(--ak-tag-shadow);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s,
    box-shadow 0.2s ease, transform 0.16s ease;
}
.ak-anchor-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  box-shadow: var(--ak-tag-shadow-hover);
  transform: translateY(-1px);
}
.ak-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 4px;
  font-size: var(--ak-font-base);
  line-height: 1.55;
  color: var(--text-h);
}
.ak-attribution {
  flex-shrink: 0;
  margin: 6px 0 0;
  padding-top: 6px;
  border-top: 1px solid var(--border);
  font-family: var(--mono);
  font-size: 9px;
  line-height: 1.4;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
</style>

<style>
/* Markdown output — unscoped for v-html */
.sm-md h1,
.sm-md h2,
.sm-md h3 {
  font-family: var(--mono);
  color: var(--text-h);
  scroll-margin-top: 8px;
}
.sm-md h1 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 2px 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line-strong);
}
.sm-md h2 {
  font-size: 17px;
  font-weight: 700;
  color: var(--ak-heading);
  margin: 30px 0 8px;
  padding-left: 8px;
  border-left: 4px solid var(--ak-heading);
}
.sm-md h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 18px 0 6px;
}
.sm-md h4 {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-h);
  margin: 12px 0 4px;
}
.sm-md p {
  margin: 6px 0;
  color: var(--text-h);
}
.sm-md ul {
  margin: 6px 0 6px 18px;
  padding: 0;
}
.sm-md li {
  margin: 3px 0;
}
.sm-md strong {
  color: var(--accent);
  font-weight: 700;
}
.sm-md a {
  color: var(--accent);
  text-decoration: underline;
}
.sm-md .sm-code {
  position: relative;
  margin: 10px 0;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--ak-tag-radius);
  box-shadow: var(--ak-tag-shadow);
  font-family: var(--mono);
  font-size: var(--ak-font-mono);
  line-height: 1.55;
  overflow: hidden;
}
.sm-md .sm-code-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 3px 6px 3px 10px;
  background: rgba(20, 20, 20, 0.04);
  border-bottom: 1px solid var(--border);
}
.sm-md .sm-code-lang {
  margin-right: auto;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.sm-md .sm-code-copy {
  padding: 2px 8px;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.sm-md .sm-code-copy:hover {
  color: var(--text-h);
  border-color: var(--border);
  background: var(--code-bg);
}
.sm-md .sm-code-copy.copied {
  color: var(--accent);
}
.sm-md .sm-code-body {
  margin: 0;
  padding: 8px 10px;
  overflow-x: auto;
  white-space: pre;
  color: #141414;
}
/* 覆盖全局 code 样式（style.css 里 code 是 inline-flex + padding，会打乱代码块排版） */
.sm-md .sm-code-body code {
  display: block;
  padding: 0;
  background: transparent;
  border-radius: 0;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  white-space: pre;
}
/* Java token colors — mirror Monaco "cursor-light" theme (Editor.vue) */
.sm-md .tok-comment { color: rgba(20, 20, 20, 0.6); font-style: italic; }
.sm-md .tok-string { color: #7565CC; }
.sm-md .tok-keyword { color: #A30034; }
.sm-md .tok-number { color: #92156A; }
.sm-md .tok-annotation { color: #007041; }
.sm-md .tok-type { color: #005293; }
.sm-md .sm-table {
  width: 100%;
  margin: 8px 0;
  border-collapse: collapse;
  font-size: var(--ak-font-mono);
}
.sm-md .sm-table th,
.sm-md .sm-table td {
  border: 1px solid var(--border);
  padding: 4px 6px;
  text-align: left;
}
.sm-md .sm-table th {
  background: var(--code-bg);
  color: var(--text-h);
}
.sm-md .sm-quote {
  margin: 8px 0;
  padding: 6px 10px;
  border-left: 2px solid var(--accent);
  background: var(--accent-bg);
  color: var(--text-muted);
  font-size: 13px;
}
.sm-md .sm-hr {
  border: none;
  border-top: 2px solid var(--line-strong);
  margin: 16px 0;
}
</style>
