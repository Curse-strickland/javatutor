# 2026-08-15 JavaTutor 旧分支审查记录

> 审查对象：`JavaTutor` 仓库 `feat/improved-coze-agent`、`feat/svg-creator`

## 结论

两个分支相对 `main` 都没有代码改动，独有内容仅为 5 份文档。其中 3 份已被 `javatutor-coze` 的更新版本取代，1 份本地开发规约已迁入 `javatutor-coze` 并升级为 v1.2，1 份“前后端接入 Coze 深化能力实施计划”仍未实现、值得保留。两个分支都是 `feat/multi-file-project-run` 的祖先，删除分支不会丢失任何提交。

## 分支与差异

| 分支 | 相对 main 的独有提交 | 独有文件 |
|---|---|---|
| `feat/svg-creator` | 3 个（仅文档） | `docs/superpowers/` 下 5 份文档 |
| `feat/improved-coze-agent` | 2 个（仅文档） | 先新增再删除 `docs/coze/local-dev-convention.md`，净变化与 `feat/svg-creator` 相同 |

`feat/svg-creator` 的代码改动（前端动画入口、后端 animate 接口）已通过 PR #31/#32 合入 `main`；`origin/feat/svg-creator` 指向的 `c1869f2` 已是 `main` 的祖先。

## 已被取代的内容（可抛弃）

1. `docs/superpowers/specs/2026-08-10-coze-agent-deepening-design.md`
   - 现行版：`javatutor-coze/docs/spec/2026-08-10-coze-agent-deepening-design.md`
   - 差异：仅 BOM 去除，内容一致。
2. `docs/superpowers/specs/2026-08-10-coze-agent-interface.md`
   - 现行版：`javatutor-coze/docs/spec/2026-08-10-coze-agent-interface.md`
   - 差异：新版补充 `tool_calls`、`token_usage` 字段，是超集。
3. `docs/superpowers/plans/2026-08-10-coze-agent-deepening-plan.md`
   - 现行版：`javatutor-coze/docs/plan/2026-08-10-coze-agent-deepening-plan.md`
   - 差异：新版将 `scripts/seed_knowledge.py` 更新为 `tools/seed_knowledge.py`，是修订版。
4. `docs/coze/local-dev-convention.md`（`feat/improved-coze-agent` 内先增后删）
   - 现行版：`javatutor-coze/docs/local-dev-convention.md`（v1.2，比旧版多 154 行）
   - 旧版已被 v1.2 完全取代。

## 未实现、建议整合的内容

1. `docs/superpowers/plans/2026-08-10-javatutor-frontend-backend-plan.md`
   - 内容：前端新增 `decisionTrace.mjs`、`DecisionTracePanel.vue`，在 `AiTutorPanel.vue` / `SseChat.vue` 中展示知识库来源与 `【决策痕迹】`，后端仅回归。
   - 现状：`main` 中不存在 `decisionTrace.mjs`、`DecisionTracePanel.vue`，前端代码无任何“决策痕迹 / DecisionTrace”引用，当前痕迹 JSON 仍以纯文本混在回答里。
   - 建议：保留并作为 JavaTutor 前端待办计划整合，或迁入 `javatutor-coze/docs/plan/` 统一管理。
2. `docs/superpowers/specs/2026-08-10-multifile-uml-design.md`
   - 内容：多文件项目模式与 UML 图设计（M1 流程图/类图/结构图，M2 数据流图/用例图）。
   - 现状：`main` 已实现 `MultiFileShell.vue`、`UmlPanel.vue`，且 `UmlPanel` 支持 `flow / dataflow / structure / class / usecase` 五类图，超出原设计范围。
   - 结论：无重要独有信息，归属 `feat/multi-file-project-run` 成员负责，可随旧分支抛弃；该文件仍可从 `feat/multi-file-project-run` 分支找回。

## 删除安全性

- `feat/svg-creator` 是 `feat/improved-coze-agent` 的祖先，二者又都是 `feat/multi-file-project-run` 的祖先；独有文档均从 `feat/multi-file-project-run` 可达。
- `origin/feat/svg-creator` 已合入 `main`，远程删除无风险。
- 完成“建议整合”的文件保留后，本地可用 `git branch -D` 删除，远程可 `git push origin --delete feat/svg-creator`。

执行记录（2026-08-15）：已删除本地 `feat/improved-coze-agent`、`feat/svg-creator`；远程 `origin/feat/svg-creator` 保留未删除。
