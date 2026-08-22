<template>
  <div class="algo-knowledge" :class="{ expanded }">
    <button
      type="button"
      class="ak-header"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="ak-title">算法知识库</span>
      <svg
        class="ak-chevron"
        :class="{ rotated: expanded }"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div v-show="expanded" class="ak-body">
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

      <div ref="contentRef" class="ak-content sm-md" v-html="renderedHtml" />

      <p class="ak-attribution">
        摘要为 JavaTutor 项目原创编写；内容来源：oi.wiki 等开源平台，遵循 CC-BY-SA 协议
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import index from '../assets/algo-knowledge/index.json'
import { renderSimpleMarkdown } from '../utils/simpleMarkdown.js'

import sortingMd from '../assets/algo-knowledge/sorting.md?raw'
import searchMd from '../assets/algo-knowledge/search.md?raw'
import graphMd from '../assets/algo-knowledge/graph.md?raw'
import treeMd from '../assets/algo-knowledge/tree.md?raw'
import dpMd from '../assets/algo-knowledge/dp.md?raw'
import linkedListMd from '../assets/algo-knowledge/linked-list.md?raw'

const mdByFile = {
  'sorting.md': sortingMd,
  'search.md': searchMd,
  'graph.md': graphMd,
  'tree.md': treeMd,
  'dp.md': dpMd,
  'linked-list.md': linkedListMd,
}

const categories = index.categories
const expanded = ref(false)
const activeCategoryId = ref(categories[0]?.id ?? '')
const contentRef = ref(null)

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

watch(expanded, (isOpen) => {
  if (isOpen && !activeCategoryId.value && categories.length) {
    activeCategoryId.value = categories[0].id
  }
})
</script>

<style scoped>
.algo-knowledge {
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ak-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  background: var(--card-bg);
  border: none;
  cursor: pointer;
  user-select: none;
  font-family: var(--mono);
  text-align: left;
}
.ak-header:hover {
  background: var(--accent-bg);
}
.ak-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-h);
}
.ak-chevron {
  color: var(--text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.ak-chevron.rotated {
  transform: rotate(180deg);
}
.ak-body {
  display: flex;
  flex-direction: column;
  max-height: min(42vh, 360px);
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
  margin: 12px 0 6px;
  scroll-margin-top: 8px;
}
.sm-md h1,
.sm-md h2,
.sm-md h3 {
  font-size: var(--ak-font-base);
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
.sm-md .sm-code {
  margin: 8px 0;
  padding: 8px 10px;
  overflow-x: auto;
  background: var(--ak-code-bg);
  border: 1px solid var(--border);
  border-left: 2px solid var(--accent);
  border-radius: var(--ak-tag-radius);
  box-shadow: var(--ak-tag-shadow);
  font-family: var(--mono);
  font-size: var(--ak-font-mono);
  line-height: 1.45;
}
.sm-md .sm-code code {
  white-space: pre;
}
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
  font-size: 11px;
}
.sm-md .sm-hr {
  border: none;
  border-top: 1px dashed var(--border);
  margin: 10px 0;
}
</style>
