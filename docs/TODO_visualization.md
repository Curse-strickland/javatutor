# TODO — 可视化与近期跟进（2026-08-10）

> 对照：`docs/superpowers/specs/2026-08-10-visualization-redesign-design.md`  
> 本文件只记**未完成 / 待打磨**项；已落地的 M1–M4 骨架与本轮修 bug 不重复罗列。

---

## P0 — 建议尽快收尾

- [ ] **提交本轮未入库改动**（未要求前不要自动 commit）  
  归并动态图、数组 `arr`/`a` 新鲜度、`char[]` 类型、树 `root`/`cur`、看板娘折叠、问答贴底与发送栏抬高、知识库 CRLF 代码块等。
- [ ] **重启后端手测** TraceEngine 数组类型（`char[]` / `int[]` / `boolean[]`）显示是否正确（改的是 `RunController` 内嵌源码 + `TraceEngine.java`）。
- [ ] **手测清单（回归）**  
  - 经典预置：归并 / 二分 / 插入柱状 / 二叉树遍历 / 链表 / 二维 `char[][]`  
  - 数据结构 Tab：一维指针在格上、二维 `cur` 在格外上方  
  - 树：根红 `root`、当前黄 `cur`、高亮边黄色  
  - 问答：流式贴底；「整体/单步解说」+ 发送栏固定且不挡版权声明  
  - 算法知识库：展开后 ````java` 代码块正常渲染  

---

## P1 — 规格里标为增强 / 未做完

- [ ] **多文件真正合编译运行**  
  现状多为「运行当前文件」；`/api/run` 多文件合编仍缺（spec §8 风险项）。
- [ ] **Coze UML 稳定生成**  
  M4 静态兜底已有；AI `intent=uml` 失败率 / 缓存策略可再压一版。
- [ ] **多文件编辑器可编辑 + diff**（spec §10 v1.1）
- [ ] **跨模式共享运行状态**（spec §10；现 dual snapshot 隔离）

---

## P1 — 可视化打磨（PDF / 本轮遗留）

- [ ] **快排**：数组分区视图再对齐样图（`l/r`、pivot 区带）
- [ ] **希尔排序**：专用画法（spec 曾后置）
- [ ] **树旋转**：插入/旋转过程动画或分步示意（样图问号项）
- [ ] **红黑树特判**：节点标红/黑（spec v1 跳过，v1.1+）
- [ ] **归并可视化**：长数组 / 深递归时层数过多的折叠或「只显示路径」
- [ ] **堆排序**：数组视图与堆树视图联动高亮（同一 `i/j`）
- [ ] **图**：网络流边标注 `e=` / 容量更贴近样图；有向边权可读性
- [ ] **多条不相交链表并列**（spec §10）
- [ ] **链表流动布局 v1.1**（`docs/superpowers/specs/2026-08-09-linked-list-fluid-layout-design.md`）若尚未合入主线则跟进
- [ ] **数据结构画布导出 PNG / SVG**（spec §10）

---

## P2 — 工程与体验

- [ ] **TraceEngine 双份源码同步**  
  `compiler/TraceEngine.java`（单测）与 `RunController.TRACE_ENGINE_SOURCE`（真跑）易漂移；考虑生成/共享一处。
- [ ] **InstrumenterTest 内嵌 stub** 与正式 TraceEngine API 对齐（现已加三参 `allocArray`）
- [ ] **Docker 容器化**（已有部署建议；镜像 + compose + Secrets 注入）
- [ ] **看板娘**：折叠态持久化已有；可补「设置里总开关 / 默认折叠」
- [ ] **问答**：用户上滑阅读时可选「不强制贴底」（智能跟随）
- [ ] **算法知识库**：补全/校对各 `.md`；锚点与 Classic 预置跳转联动

---

## P2 — 文档与展示（旧 `docs/todo.md` 仍有效）

- [ ] 项目文档整理（介绍 / 分工 / 使用指南）
- [ ] 仓库整理（排除 `backup-*`、大资源版权说明）
- [ ] 展示视频
- [ ] 可执行包 / 最终部署检查表

---

## 本轮已完成（备忘，勿再开 issue）

| 项 | 备注 |
|----|------|
| 归并 PDF 风格动态分解/合并 | `sortVizExtract` + `MergeSortTreeCanvas` |
| 归并写回后图与一维数组跟新 | 深栈帧实时数组 / 去陈旧 `arr` |
| 合并过程跟 `tmp` + 源半区消耗 | i/j/k |
| 数组标题：变量名加粗在前、类型在后 | `ArrayCanvas` |
| 数组类型 `char[]` 等 | TraceEngine / RunController |
| 二维标签移到格外上方 | `MatrixCanvas` |
| 树 `root` 红 / `cur` 黄；`node`→`cur`；高亮边黄 | |
| 看板娘可折叠 + 记忆 | `waifu-badge` |
| 问答贴底 + 底栏固定；仅抬高问答发送区避版权 | |
| 知识库 MD 代码块 CRLF | `simpleMarkdown.js` |

---

## 建议下一迭代顺序

1. P0 手测 + 按需 commit  
2. 多文件合编译 **或** 快排/堆排画法对齐样图（二选一先做教学收益更高的）  
3. TraceEngine 单源维护，减少再出「类型写死」类 bug  
