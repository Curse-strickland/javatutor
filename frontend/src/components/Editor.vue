<template>
  <div ref="root" class="editor-root" style="width:100%; height:100%;">
    <div v-if="!loadError" ref="editorContainer" class="editor-container" style="width:100%; height:100%;"></div>
    <textarea v-else v-model="fallbackCode" class="editor-textarea"></textarea>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as monaco from 'monaco-editor'

const root = ref(null)
const editorContainer = ref(null)
let editor = null
let currentDecorations = []
let ro = null
const loadError = ref(false)
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
      // 等待字体加载完成后再初始化编辑器
      document.fonts.ready.then(() => {
        editor = monaco.editor.create(editorContainer.value, {
          value: fallbackCode.value,
          language: 'java',
          theme: 'vs-dark',
          automaticLayout: false,
          fontSize: 16,
          fontFamily: 'Maple Mono, ui-monospace, Consolas, monospace',
          fontLigatures: false,
          letterSpacing: 0.5,
          cursorBlinking: 'smooth',
          cursorStyle: 'line',
          lineHeight: 24,
          useTabStops: true,
          renderWhitespace: 'none',
          minimap: { enabled: false },
          glyphMargin: true  // 启用字形边距以显示箭头
        })

        // 强制重新计算布局以确保光标位置正确
        setTimeout(() => {
          if (editor) {
            editor.layout()
            // 触发一次内容更新以刷新光标位置
            const model = editor.getModel()
            if (model) {
              const value = model.getValue()
              model.setValue(value)
            }
          }
        }, 100)

        // 用户编辑代码时清除旧的高亮（旧步骤数据已过时）
        editor.onDidChangeModelContent(() => {
          clearHighlights()
        })

        // 监听容器尺寸变化，重新 layout
        if (window.ResizeObserver) {
          ro = new ResizeObserver(() => {
            if (editor) editor.layout()
          })
          ro.observe(root.value)
        } else {
          window.addEventListener('resize', () => editor.layout())
        }
      })
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
})

const getCode = () => {
  if (editor) return editor.getValue()
  return fallbackCode.value
}

const highlightLine = (lineNumber) => {
  if (!editor) return
  // 清除已有装饰
  if (currentDecorations.length) {
    editor.deltaDecorations(currentDecorations, [])
    currentDecorations = []
  }
  if (!lineNumber || lineNumber < 1) return
  const model = editor.getModel()
  if (!model) return
  // 越界检查：行号超出文档行数则跳过
  if (lineNumber > model.getLineCount()) return
  try {
    const maxColumn = model.getLineMaxColumn(lineNumber)
    // 空行跳过（maxColumn===1 表示只有换行符无内容）
    if (maxColumn <= 1) return
    const decorations = [{
      range: new monaco.Range(lineNumber, 1, lineNumber, maxColumn),
      options: {
        isWholeLine: true,
        className: 'highlight-line',
        glyphMarginClassName: 'exec-arrow'
      }
    }]
    currentDecorations = editor.deltaDecorations([], decorations)
    editor.revealLineInCenter(lineNumber)
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

defineExpose({ getCode, highlightLine, clearHighlights })
</script>

<style>
.editor-root {
  min-height: 0; /* allow flex children to size correctly */
  min-width: 0;
}
.editor-container {
  width: 100%;
  height: 100%;
  direction: ltr; /* 修正代码编辑区显示问题 */
  text-align: left;
  transform: none !important; /* 取消可能的镜像/翻转 */
}
.highlight-line {
  background-color: rgba(255, 255, 0, 0.25);
}
.exec-arrow::before {
  content: '▶';
  color: #fbbf24;
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
  background: var(--code-bg, #1f2028);
  color: var(--text-h, #f3f4f6);
  border: none;
  resize: none;
}
</style>
