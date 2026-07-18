import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// 注意：此包是 CJS，在 ESM 下 default import 拿不到函数，必须取 .default
import _monacoEditorPlugin from 'vite-plugin-monaco-editor'
const monacoEditorPlugin = _monacoEditorPlugin.default || _monacoEditorPlugin

export default defineConfig({
  plugins: [
    vue(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService']
    })
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
})