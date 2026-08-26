# 2026-08-22 编辑器光标错位复发 · 根因与修复

分支: `visualization` · 涉及文件: `frontend/src/components/Editor.vue`

## 现象

编辑区粘贴代码 / 置入预置代码后，光标渲染位置与实际文本位置不符（很常见）。

## 根因（两层）

1. **修复丢失**：8-14/8-17 的光标修复（98f44d4 / dde51b6，先加载字体再初始化 Monaco + `loadingdone` 重测宽）只存在于 `main` 分支；`visualization` 分支从更早的提交分叉，`Editor.vue` 仍是旧版（`document.fonts.ready` 门控 + 50/300ms 两次兜底校准）。
2. **斜体字面未预载**（原修复也未覆盖）：主题把注释渲染为 italic（`fontStyle: 'italic'`），Maple Mono 的 Italic 是独立的 ~20MB TTF。粘贴/置入的代码含中文注释 → 首次出现注释 token → 浏览器开始懒加载 Italic 字面 → `font-display: swap` 先用 fallback 渲染，字体到达后重新排版 → Monaco 不重测宽 → 光标累积偏移。这正好解释了「粘贴/置入时才出现」的触发条件。

## 修复（Editor.vue onMounted）

- `recalibrate` 提升到组件顶层；`loadingdone` / `loadingerror` 全局监听 → 任何晚到字体落地后强制 `remeasureFonts()`；卸载时移除监听。
- 初始化门控从 `document.fonts.ready`（会被无关 Web Fonts 拖慢）改为显式预载编辑器实际用到的两个字面：

  ```js
  Promise.all([
    document.fonts.load("16px 'Maple Mono'").catch(() => {}),
    document.fonts.load("italic 16px 'Maple Mono'").catch(() => {}),
  ]).then(initMonaco)
  ```

  加载失败也会初始化（测宽 = 渲染 = fallback，一致，不偏）。
- 延迟兜底校准 50 / 300 / 800 / 2000ms。

## 验证

- `npm test`：147/147 通过
- `npm run build`：通过
- 真实浏览器像素级验证受环境限制未做；修复主体是 main 上已验证方案的移植（见 devlog/2026-08-14-editor-cursor-font-bug.md），斜体预载为同类机制的延伸。用户强制刷新（Ctrl+F5）后复验。
