// UI 面板结构：从单一事实源 manifest 读取（见 javatutor-coze docs/spec/2026-09-07-coze-agent-view-navigation.md §9）
// 改前端任何面板/标签必须先改 ui-panel-manifest.json，再由本模块派生白名单/分组，勿另写硬编码。
import manifest from './ui-panel-manifest.json'

export const PANEL_MANIFEST = manifest

/** 取某个面板定义（含 id/name/group/content/subTabs/navHints）；不存在返回 undefined。 */
export function panelById(panelId) {
  return PANEL_MANIFEST?.panels?.[panelId]
}

/** 单文件或全部面板 id（按 mode 过滤 multi-only 面板）。 */
export function allowedPanels(mode) {
  const panels = PANEL_MANIFEST?.panels || {}
  return Object.keys(panels).filter((id) => !panels[id]?.mode || mode === 'multi')
}

/** 当前 mode 可用的面板对象数组。 */
export function panelsForMode(mode) {
  return allowedPanels(mode).map((id) => ({ id, ...panelById(id) }))
}

/** 面板所属顶层组（observe/learn/ask）；未知面板回退 'observe'。 */
export function groupOfPanel(panelId) {
  return panelById(panelId)?.group || 'observe'
}

/** 某组默认面板 id（无则用该组第一个）。 */
export function defaultPanelOfGroup(group) {
  const ids = PANEL_MANIFEST?.groups?.[group] || []
  const first = ids.find((id) => panelById(id)) || ids[0]
  return first || 'datastructure'
}

/** 算法库合法子页（knowledge/template）。 */
export function algoSubTabs() {
  return PANEL_MANIFEST?.algorithmLibrary?.subTabs || ['knowledge', 'template']
}
