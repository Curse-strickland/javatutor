# 多文件可视化图例与类型标识

## 背景

多文件模式的四张图（类图 / 结构图 / 调用关系图）此前箭头与成员可见性符号均无说明，接口 / 枚举也被画成统一矩形，初学者难以辨识。本次在工具栏统一补充图例，并让类图区分接口 / 枚举。

## 改动

- `frontend/src/components/ClassDiagramPanel.vue`
  - 关系图例：继承（实线空心三角）/ 实现（虚线空心三角）/ 依赖·关联（实线实心箭头），单色 `#475569`。
  - 可见性图例：`+` public / `-` private / `#` protected / `~` package，与关系图例上下两行排布，各带 `title` 通俗解释。
  - 类型标识：接口加 `«interface»`、枚举加 `«enum»` 前缀（后端已返回 `kind`，此前前端未展示）。
- `frontend/src/components/StructureDiagramPanel.vue`
  - 箭头图例：依赖（箭头指向被依赖方）。
- `frontend/src/components/FlowDiagramPanel.vue`
  - 箭头图例：调用（箭头指向被调用方法）。
- 三个面板 toolbar 均加 `flex-wrap: wrap`，窄屏下图例换行不溢出。

## 验证

- `npm test`：209 passed。
- `npm run build`：成功。

## 遗留

无。`depends_on` 后端已把关联 / 依赖统一合并，图例措辞用「依赖 / 关联」对应；聚合 / 组合未细分，不在本次范围。
