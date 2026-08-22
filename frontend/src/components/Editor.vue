<template>
  <div ref="root" class="editor-root" style="width:100%; height:100%;">
    <!-- 隐藏的文件选择器 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".java"
      style="display: none"
      @change="onFileSelected"
    />
    <div v-if="!loadError" ref="editorContainer" class="editor-container" style="width:100%; height:100%;"></div>
    <textarea v-else v-model="fallbackCode" class="editor-textarea"></textarea>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as monaco from 'monaco-editor'

const props = defineProps({
  readOnly: { type: Boolean, default: false },
})

const root = ref(null)
const editorContainer = ref(null)
const fileInputRef = ref(null)
let editor = null
let currentDecorations = []
let ro = null
const loadError = ref(false)

/** 字体测宽校准：容器尺寸变化或字体加载完成后调用，保证光标与字符渲染对齐 */
const recalibrate = () => {
  if (!editor) return
  editor.layout()
  try { editor.remeasureFonts() } catch (_) { /* ignore */ }
}

/** 点击「导入」按钮 → 触发隐藏的文件选择器 */
const triggerImport = () => {
  fileInputRef.value?.click()
}

/** 用户选择文件后 → 读取内容并加载到编辑器 */
const onFileSelected = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  // 重置 input 以便选择同一个文件时也能再次触发 change
  event.target.value = ''
  const reader = new FileReader()
  reader.onload = (e) => {
    const code = e.target?.result
    if (typeof code !== 'string') return
    if (editor) {
      editor.setValue(code)
    } else {
      fallbackCode.value = code
    }
    // 清除旧的高亮
    clearHighlights()
  }
  reader.onerror = () => {
    console.error('读取文件失败:', file.name)
  }
  reader.readAsText(file)
}
const fallbackCode = ref(`public class UserCode {
  public static void main(String[] args) {
    int[] arr = {5, 3, 8};
    int n = arr.length;
    for (int i = 0; i < n-1; i++) {
      for (int j = 0; j < n-i-1; j++) {
        if (arr[j] > arr[j+1]) {
          int temp = arr[j];
          arr[j] = arr[j+1];
          arr[j+1] = temp;
        }
      }
    }
  }
}`)

onMounted(() => {
  if (editorContainer.value) {
    try {
      const initMonaco = () => {
        // Cursor Light（本地 Cursor 主题 cursor-light-color-theme.json）
        monaco.editor.defineTheme('cursor-light', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '14141499', fontStyle: 'italic' },
            { token: 'comment.java', foreground: '14141499', fontStyle: 'italic' },
            { token: 'string', foreground: '7565CC' },
            { token: 'string.java', foreground: '7565CC' },
            { token: 'keyword', foreground: 'A30034' },
            { token: 'keyword.java', foreground: 'A30034' },
            { token: 'storage', foreground: 'A30034' },
            { token: 'number', foreground: '92156A' },
            { token: 'number.java', foreground: '92156A' },
            { token: 'number.float', foreground: '92156A' },
            { token: 'number.hex', foreground: '92156A' },
            { token: 'annotation', foreground: '007041' },
            { token: 'annotation.java', foreground: '007041' },
            { token: 'type', foreground: '005293' },
            { token: 'type.identifier', foreground: '005293' },
            { token: 'identifier', foreground: '141414' },
            { token: 'delimiter', foreground: '141414' },
            { token: '', foreground: '141414' },
          ],
          colors: {
            // 实际底色由 CSS --editor-bg 覆盖，便于跟卡片透明度联动
            'editor.background': '#00000000',
            'editor.foreground': '#141414',
            'editorGutter.background': '#00000000',
            'editor.lineHighlightBackground': '#EAEAEAB8',
            'editor.lineHighlightBorder': '#00000000',
            'editor.selectionBackground': '#14141414',
            'editor.inactiveSelectionBackground': '#14141414',
            'editor.selectionHighlightBackground': '#3B7E8424',
            'editorLineNumber.foreground': '#1414145C',
            'editorLineNumber.activeForeground': '#141414BD',
            'editorCursor.foreground': '#141414',
            'editorWhitespace.foreground': '#1414144D',
            'editorIndentGuide.background1': '#14141414',
            'editorIndentGuide.activeBackground1': '#14141433',
            'editorWidget.background': '#F3F3F3',
            'editorWidget.border': '#14141414',
            'editorStickyScroll.background': '#00000000',
            'editorStickyScrollHover.background': '#F3F3F3CC',
            'editorStickyScroll.shadow': '#14141414',
            'editorStickyScroll.border': '#14141414',
            'focusBorder': '#00000000',
            'scrollbarSlider.background': '#14141424',
            'scrollbarSlider.hoverBackground': '#14141433',
          }
        })
        monaco.editor.setTheme('cursor-light')

        editor = monaco.editor.create(editorContainer.value, {
          value: fallbackCode.value,
          language: 'java',
          theme: 'cursor-light',
          automaticLayout: false,
          readOnly: props.readOnly,
          fontSize: 16,
          fontFamily: "'Maple Mono', ui-monospace, Consolas, monospace",
          fontLigatures: false,
          letterSpacing: 0,
          cursorBlinking: 'smooth',
          cursorStyle: 'line',
          lineHeight: 24,
          useTabStops: true,
          renderWhitespace: 'none',
          minimap: { enabled: false },
          glyphMargin: true,
          lineNumbersMinChars: 3,
          lineDecorationsWidth: 10,
          renderLineHighlight: 'all',
          renderLineHighlightOnlyWhenFocus: false,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          stickyScroll: { enabled: true },
          wordWrap: 'on',
          padding: { top: 8, left: 0 }
        })

        // 延迟校准：覆盖字体在初始化后才 swap 的场景
        setTimeout(recalibrate, 50)
        setTimeout(recalibrate, 300)
        setTimeout(recalibrate, 800)
        setTimeout(recalibrate, 2000)

        // 用户编辑代码时清除旧的高亮（旧步骤数据已过时）
        if (!props.readOnly) {
          editor.onDidChangeModelContent(() => {
            clearHighlights()
          })
        }

        // 监听容器尺寸变化，重新 layout
        if (window.ResizeObserver) {
          ro = new ResizeObserver(() => {
            if (editor) editor.layout()
          })
          ro.observe(root.value)
        } else {
          window.addEventListener('resize', () => editor.layout())
        }
      }

      // 字体晚到 / swap 后强制重新测宽，保证光标与字符渲染对齐
      if (document.fonts?.addEventListener) {
        document.fonts.addEventListener('loadingdone', recalibrate)
        document.fonts.addEventListener('loadingerror', recalibrate)
      }

      // 先显式加载编辑器用到的字体再初始化。若字体未就绪，Monaco 会用 fallback
      // 字体测宽；字体加载完成后字符被重新渲染得更宽，但 Monaco 不重测宽 → 光标累积偏移。
      // 主题把注释渲染为斜体（独立的 ~20MB Italic 字面），粘贴/置入含注释的代码会触发
      // 斜体晚加载，因此 regular + italic 两个字面都要预载。
      // 不依赖 document.fonts.ready：它会被无关的 Web Fonts 拖慢/干扰时序。
      if (document.fonts?.load) {
        Promise.all([
          document.fonts.load("16px 'Maple Mono'").catch(() => {}),
          document.fonts.load("italic 16px 'Maple Mono'").catch(() => {}),
        ]).then(initMonaco)
      } else {
        initMonaco()
      }
    } catch (e) {
      // Monaco 加载或初始化失败时，回退到可编辑的 textarea
      console.error('Monaco init failed, falling back to textarea:', e)
      loadError.value = true
    }
  }
})

onBeforeUnmount(() => {
  if (editor) editor.dispose()
  if (ro && root.value) ro.unobserve(root.value)
  if (document.fonts?.removeEventListener) {
    document.fonts.removeEventListener('loadingdone', recalibrate)
    document.fonts.removeEventListener('loadingerror', recalibrate)
  }
})

const getCode = () => {
  if (editor) return editor.getValue()
  return fallbackCode.value
}

/**
 * 三色高亮：灰色（上一条）→ 黄色（当前）→ 蓝色（下一条）
 * @param {number|null} lineNumber 当前步骤行号（黄色 + ▶ 箭头）
 * @param {number|null} prevLineNumber 上一步行号（灰色 + 灰色箭头）
 * @param {number|null} nextLineNumber 下一步行号（蓝色，无箭头）
 */
const highlightLine = (lineNumber, prevLineNumber, nextLineNumber) => {
  if (!editor) return
  // 清除已有装饰
  if (currentDecorations.length) {
    editor.deltaDecorations(currentDecorations, [])
    currentDecorations = []
  }
  const model = editor.getModel()
  if (!model) return

  const makeDeco = (line, className, glyphMarginClassName) => {
    if (!line || line < 1) return null
    if (line > model.getLineCount()) return null
    const maxColumn = model.getLineMaxColumn(line)
    if (maxColumn <= 1) return null  // 空行跳过
    const opts = { isWholeLine: true, className }
    if (glyphMarginClassName) opts.glyphMarginClassName = glyphMarginClassName
    return { range: new monaco.Range(line, 1, line, maxColumn), options: opts }
  }

  try {
    const decorations = []
    // 灰色：上一条执行语句 + 灰色箭头
    const prevDeco = makeDeco(prevLineNumber, 'highlight-prev-line', 'exec-prev-arrow')
    if (prevDeco) decorations.push(prevDeco)
    // 蓝色：下一条即将执行的语句 + 蓝色箭头
    const nextDeco = makeDeco(nextLineNumber, 'highlight-next-line', 'exec-next-arrow')
    if (nextDeco) decorations.push(nextDeco)
    // 黄色：当前执行语句 + ▶ 箭头
    const currDeco = makeDeco(lineNumber, 'highlight-line', 'exec-arrow')
    if (currDeco) decorations.push(currDeco)

    if (decorations.length) {
      currentDecorations = editor.deltaDecorations([], decorations)
    }
    // 仅在视口外时滚动，避免每次运行/步进都强制居中造成抖动
    if (lineNumber) {
      try {
        editor.revealLineInCenterIfOutsideViewport(lineNumber)
      } catch (_) {
        editor.revealLine(lineNumber)
      }
    }
  } catch (_) {
    // Monaco 内部错误（如行号越界）→ 静默忽略
  }
}

const clearHighlights = () => {
  if (!editor) return
  if (currentDecorations.length) {
    editor.deltaDecorations(currentDecorations, [])
    currentDecorations = []
  }
}

const setCode = (code) => {
  if (editor) { editor.setValue(code) }
  else { fallbackCode.value = code }
  clearHighlights()
}

watch(() => props.readOnly, (val) => {
  if (editor) editor.updateOptions({ readOnly: val })
})

defineExpose({ getCode, highlightLine, clearHighlights, triggerImport, setCode })
</script>

<style>
.editor-root {
  min-height: 0; /* allow flex children to size correctly */
  min-width: 0;
}
.editor-container {
  width: 100%;
  height: 100%;
  direction: ltr;
  text-align: left;
  transform: none !important;
  background: var(--editor-bg) !important;
}

.editor-container .monaco-editor,
.editor-container .monaco-editor-background,
.editor-container .margin,
.editor-container .monaco-editor .inputarea.ime-input {
  background: var(--editor-bg) !important;
}

.editor-container .monaco-editor,
.editor-container .monaco-editor .overflow-guard,
.editor-container .monaco-editor textarea.inputarea {
  outline: none !important;
  box-shadow: none !important;
}

/* 当前行浅色高亮 + 行号与代码间竖杠 */
.editor-container .monaco-editor .view-overlays .current-line {
  border: none !important;
  background: rgba(234, 234, 234, 0.72) !important;
}
.editor-container .monaco-editor .margin-view-overlays .current-line,
.editor-container .monaco-editor .margin-view-overlays .current-line-margin,
.editor-container .monaco-editor .margin-view-overlays .current-line-margin-both {
  border: none !important;
  background: transparent !important;
  border-right: 2px solid #2778C1 !important;
}

/* sticky 用不透明叠层盖住滚动内容，颜色与卡片一致 */
.editor-container .monaco-editor .sticky-widget {
  background-color: var(--card-bg) !important;
  box-shadow: 0 1px 0 #14141414 !important;
  border-bottom: 1px solid #14141414 !important;
}
.editor-container .monaco-editor .sticky-widget .sticky-line-content,
.editor-container .monaco-editor .sticky-widget .sticky-line-number {
  background-color: var(--card-bg) !important;
  color: #141414 !important;
}
.editor-container .monaco-editor .sticky-widget .sticky-line-number {
  color: #1414145C !important;
}

.highlight-line {
  background-color: rgba(251, 191, 36, 0.22);
}
.highlight-prev-line {
  background-color: rgba(128, 128, 128, 0.14);
}
.highlight-next-line {
  background-color: rgba(39, 120, 193, 0.12);
}
.exec-arrow::before {
  content: '▶';
  color: #fbbf24;
  font-size: 12px;
  position: absolute;
  left: 2px;
}
.exec-prev-arrow::before {
  content: '▶';
  color: rgba(128, 128, 128, 0.50);
  font-size: 12px;
  position: absolute;
  left: 2px;
}
.exec-next-arrow::before {
  content: '▶';
  color: rgba(39, 120, 193, 0.65);
  font-size: 12px;
  position: absolute;
  left: 2px;
}
.editor-textarea {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 12px;
  font-family: 'Maple Mono', ui-monospace, Consolas, monospace;
  font-size: 13px;
  background: var(--editor-bg);
  color: #141414;
  border: none;
  resize: none;
}
</style>
