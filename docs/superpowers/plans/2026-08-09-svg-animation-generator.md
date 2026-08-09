# SVG 动画生成器（Task 4）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Coze 智能体实现六类算法 SVG 动画生成器（sort/search/tree/graph/dp/linked_list），使 `animate` 分支返回带 SMIL 动画的纯 SVG 文本，并让自由问答回复显式标注当前专家类别。

**Architecture:** 使用 `assets/svg_templates/*.svg.j2` 模板 + Jinja2 渲染；`src/learning/animation.py` 负责算法分类、steps 数据提取、几何布局与动画事件计算；`animate_node` 只做接线，返回 `messages=[AIMessage(content=纯SVG)]` 并写入 `svg_text`。动画只接受显式 `intent="animate"`；聊天关键词路由到 `animate_guide` 固定引导文案。

**Tech Stack:** Python 3.12、Jinja2（已依赖）、SVG SMIL、pytest、LangGraph（仅接线）。

---

## Global Constraints

- 不得修改 `.coze`、`scripts/`、`src/main.py`、`src/storage/`、`src/utils/` 中现有文件。
- 新代码只允许放在 `src/learning/`、`src/graphs/javatutor/`、`src/agents/`、`assets/svg_templates/`、`tests/`、`config/`、`docs/`。
- Python 版本 3.12；依赖管理只用 `uv`；本计划不新增第三方依赖（Jinja2 已存在）。
- 禁止 `from src.xxx import ...`；统一 `from learning.animation import ...`。
- 动画输出必须是**纯 SVG 文本**：不以 Markdown 围栏包裹，必须包含 `<svg`，sort/search 等含动画的分类必须包含 `<animate`。
- 动画只由显式 `intent="animate"` 触发；聊天中出现“动画/演示/可视化/播放”关键词时路由到 `animate_guide`。
- 自由问答（data_query/concept/debug/other）回复必须以 `【类别名】` 前缀开头，类别名分别为：数据追问、概念讲解、错误诊断、通用助手。
- 画布统一 `600x400`；每步动画间隔 `0.6s`；颜色：默认 `#4f8cff`、比较高亮 `#ffd166`、当前/交换 `#ef476f`、已访问 `#06d6a0`。
- 数据契约：`sort`/`search` 读 `variables.arr/array/nums/list`（兼容 JSON 字符串）；`tree` 读 `variables.tree=[{id,value,left,right}]`；`graph` 读 `variables.graph={nodes,edges}` 与 `variables.highlight_nodes/highlight_edges`；`dp` 读 `variables.dp`（二维数组）与 `variables.dp_current=[r,c]`；`linked_list` 读 `variables.linked_list`（值数组）与 `variables.pointer`。
- 每任务按 TDD 执行：先写失败测试，再实现，再提交。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `assets/svg_templates/sort_bars.svg.j2` | 排序柱状图 + 交换/高亮动画模板 |
| `assets/svg_templates/search_bars.svg.j2` | 搜索柱状图 + 扫描线模板 |
| `assets/svg_templates/tree_traversal.svg.j2` | 树遍历节点点亮模板 |
| `assets/svg_templates/graph_path.svg.j2` | 图算法边染色模板 |
| `assets/svg_templates/dp_table.svg.j2` | DP 表格逐格填值模板 |
| `assets/svg_templates/linked_list.svg.j2` | 链表节点 + 指针移动模板 |
| `assets/svg_templates/other.svg.j2` | 未知类别兜底模板 |
| `src/learning/__init__.py` | 包标记 |
| `src/learning/animation.py` | 分类、数据提取、布局、渲染入口 |
| `src/graphs/javatutor/state.py` | 追加 `svg_text`（修改） |
| `src/graphs/javatutor/prompts.py` | `SYSTEM_PROMPT_ANIMATE` 替换为 `ANIMATE_GUIDE_MESSAGE`（修改） |
| `src/graphs/javatutor/nodes.py` | 真实 `animate_node`、新增 `animate_guide_node`、专家回复加类别前缀（修改） |
| `src/graphs/javatutor/graph.py` | 注册 `animate_guide` 节点与边（修改） |
| `tests/fixtures/animation_data.json` | 六类动画测试数据 |
| `tests/test_animation.py` | 分类、模板渲染、六类动画、兜底测试 |
| `tests/test_route_intent.py` | 新增 animate_guide 路由测试（修改） |
| `tests/test_expert_nodes.py` | 替换 animate 占位测试、新增 guide 与类别前缀测试（修改） |
| `tests/test_graph.py` | 新增 animate 显式/guide 全流程测试（修改） |

---

### Task 4.1: 动画基础设施（常量、分类、模板加载、兜底）

**Files:**
- Create: `assets/svg_templates/other.svg.j2`
- Create: `src/learning/__init__.py`
- Create: `src/learning/animation.py`
- Test: `tests/test_animation.py`

**Interfaces:**
- Consumes: `steps: list[dict]`，其中每步含 `variables`。
- Produces: `classify_algorithm(source_code: str) -> str`、`build_animation_svg(steps: list[dict], algorithm_tag: str) -> str`；内部常量 `WIDTH/HEIGHT/MARGIN/STEP_DURATION` 与颜色常量。

- [ ] **Step 1: 创建兜底模板**

创建 `assets/svg_templates/other.svg.j2`：

```jinja2
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <text x="40" y="80" font-size="16">{{ message }}</text>
</svg>
```

- [ ] **Step 2: 写失败测试**

创建 `tests/test_animation.py`：

```python
import pytest

from learning.animation import build_animation_svg, classify_algorithm


@pytest.mark.parametrize(
    ("source_code", "expected"),
    [
        ("public class BubbleSort {}", "sort"),
        ("int idx = binarySearch(arr, 7);", "search"),
        ("void dfs(TreeNode root)", "tree"),
        ("dijkstra(graph, start)", "graph"),
        ("int[][] dp = new int[n][m];", "dp"),
        ("class ListNode { int val; ListNode next; }", "linked_list"),
        ("public class Main {}", "other"),
    ],
)
def test_classify_algorithm(source_code, expected):
    assert classify_algorithm(source_code) == expected


def test_build_animation_svg_other_fallback():
    svg = build_animation_svg([], "unknown")
    assert svg.startswith("<svg")
    assert "暂不支持" in svg
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_animation.py -v`
Expected: FAIL，`ModuleNotFoundError: learning.animation`。

- [ ] **Step 4: 实现基础设施**

创建 `src/learning/__init__.py`（空文件）。

创建 `src/learning/animation.py`：

```python
"""JavaTutor SVG 动画生成器：从 TraceEngine steps 生成带 SMIL 动画的纯 SVG 文本。"""

import json
import math
from pathlib import Path
from typing import Any

from jinja2 import Template

WIDTH = 600
HEIGHT = 400
MARGIN = 40
STEP_DURATION = 0.6

COLOR_DEFAULT = "#4f8cff"
COLOR_COMPARE = "#ffd166"
COLOR_CURRENT = "#ef476f"
COLOR_VISITED = "#06d6a0"

TEMPLATE_DIR = Path(__file__).resolve().parents[2] / "assets" / "svg_templates"
SUPPORTED = ("sort", "search", "tree", "graph", "dp", "linked_list")


def classify_algorithm(source_code: str) -> str:
    code = (source_code or "").lower()
    if any(
        k in code
        for k in ("bubble", "冒泡", "selection", "选择", "insertion", "插入", "quick", "快排", "merge", "归并", "sort")
    ):
        return "sort"
    if any(k in code for k in ("binary", "二分", "linear", "线性", "search", "查找")):
        return "search"
    if any(k in code for k in ("dfs", "bfs", "tree", "树", "traversal", "遍历", "前序", "中序", "后序")):
        return "tree"
    if any(k in code for k in ("dijkstra", "prim", "graph", "图", "最短路径")):
        return "graph"
    if any(k in code for k in ("dp", "动态规划", "背包", "knapsack", "最长公共")):
        return "dp"
    if any(k in code for k in ("linkedlist", "linked list", "链表", "listnode")):
        return "linked_list"
    return "other"


def _as_list(value: Any) -> list:
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []
    return value if isinstance(value, list) else []


def _number(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _series_from_steps(steps: list[dict]) -> list[list[int]]:
    series = []
    for step in steps:
        variables = step.get("variables") or {}
        for key in ("arr", "array", "nums", "list"):
            values = _as_list(variables.get(key))
            if values:
                series.append([_number(v) for v in values])
                break
    return series


def _bar_layout(values: list[int]) -> list[dict]:
    n = max(1, len(values))
    max_value = max(values) if values else 1
    plot_w = WIDTH - 2 * MARGIN
    plot_h = HEIGHT - 2 * MARGIN
    bar_w = plot_w / n
    bars = []
    for i, value in enumerate(values):
        h = plot_h * value / max_value if max_value else 0
        x = MARGIN + i * bar_w
        y = HEIGHT - MARGIN - h
        bars.append(
            {
                "index": i,
                "value": value,
                "x": round(x, 1),
                "y": round(y, 1),
                "width": round(max(4.0, bar_w - 4), 1),
                "height": round(h, 1),
            }
        )
    return bars


def _load_template(category: str) -> str:
    name = category if category in SUPPORTED else "other"
    path = TEMPLATE_DIR / f"{name}.svg.j2"
    if not path.exists():
        return (
            "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>"
            "<text x='20' y='40'>暂无模板</text></svg>"
        )
    return path.read_text(encoding="utf-8")


def build_animation_svg(steps: list[dict], algorithm_tag: str = "sort") -> str:
    category = algorithm_tag if algorithm_tag in SUPPORTED else "other"
    if category == "sort":
        data = _render_sort(steps)
    elif category == "search":
        data = _render_search(steps)
    elif category == "tree":
        data = _render_tree(steps)
    elif category == "graph":
        data = _render_graph(steps)
    elif category == "dp":
        data = _render_dp(steps)
    elif category == "linked_list":
        data = _render_linked_list(steps)
    else:
        data = {"message": "暂不支持该算法的动画演示"}
    return Template(_load_template(category)).render(**data)


def _render_sort(steps: list[dict]) -> dict:
    series = _series_from_steps(steps)
    if not series:
        return {"bars": [], "move_groups": {}, "highlight_groups": {}, "message": "暂无执行数据"}
    bars = _bar_layout(series[0])
    move_groups = {i: [] for i in range(len(bars))}
    highlight_groups = {i: [] for i in range(len(bars))}
    bar_w = (WIDTH - 2 * MARGIN) / len(bars)
    for step_i in range(1, len(series)):
        prev, cur = series[step_i - 1], series[step_i]
        begin = round((step_i - 1) * STEP_DURATION, 2)
        for i in range(len(cur)):
            if i < len(prev) and prev[i] != cur[i]:
                highlight_groups[i].append({"begin": begin})
            if i < len(prev) and prev[i] != cur[i] and cur[i] in prev:
                j = prev.index(cur[i])
                if i != j:
                    move_groups[i].append(
                        {
                            "from_x": round(MARGIN + j * bar_w, 1),
                            "to_x": round(MARGIN + i * bar_w, 1),
                            "begin": begin,
                        }
                    )
    return {
        "bars": bars,
        "move_groups": move_groups,
        "highlight_groups": highlight_groups,
        "message": "",
    }


def _render_search(steps: list[dict]) -> dict:
    series = _series_from_steps(steps)
    bars = _bar_layout(series[0]) if series else []
    scans = []
    bar_w = (WIDTH - 2 * MARGIN) / max(1, len(bars))
    for step_i, step in enumerate(steps):
        variables = step.get("variables") or {}
        pos = None
        for key in ("mid", "index", "pos", "position"):
            raw = variables.get(key)
            if raw is not None:
                pos = _number(raw)
                break
        if pos is None and series:
            pos = step_i % max(1, len(series[0]))
        if pos is not None and 0 <= pos < len(bars):
            scans.append(
                {
                    "x": round(MARGIN + pos * bar_w, 1),
                    "begin": round(step_i * STEP_DURATION, 2),
                    "found": bool(variables.get("found")),
                }
            )
    return {"bars": bars, "scans": scans, "message": ""}


def _render_tree(steps: list[dict]) -> dict:
    variables = (steps[0].get("variables") or {}) if steps else {}
    tree = [n for n in _as_list(variables.get("tree")) if isinstance(n, dict) and "id" in n]
    if not tree:
        return {"nodes": [], "edges": [], "highlight_groups": {}, "message": "暂无树数据"}
    node_map = {str(n["id"]): n for n in tree}
    children = {}
    for nid, node in node_map.items():
        left = node.get("left")
        right = node.get("right")
        children[nid] = [str(left) if left is not None else "", str(right) if right is not None else ""]
    parent_ids = set()
    for kids in children.values():
        for kid in kids:
            if kid:
                parent_ids.add(kid)
    root_id = next((nid for nid in node_map if nid not in parent_ids), next(iter(node_map)))
    depth = {root_id: 0}
    queue = [root_id]
    while queue:
        cur = queue.pop(0)
        for kid in children.get(cur, []):
            if kid and kid in node_map and kid not in depth:
                depth[kid] = depth[cur] + 1
                queue.append(kid)
    ordered = [nid for nid in node_map if nid in depth]
    max_depth = max(depth.values()) if depth else 1
    plot_w = WIDTH - 2 * MARGIN
    plot_h = HEIGHT - 2 * MARGIN
    pos = {}
    for idx, nid in enumerate(ordered):
        x = WIDTH / 2 if len(ordered) == 1 else MARGIN + plot_w * idx / (len(ordered) - 1)
        y = MARGIN + plot_h * depth[nid] / max_depth
        pos[nid] = (x, y)
    nodes = [
        {"id": nid, "value": node_map[nid].get("value", ""), "x": round(pos[nid][0], 1), "y": round(pos[nid][1], 1)}
        for nid in ordered
    ]
    edges = []
    for nid, kids in children.items():
        if nid not in pos:
            continue
        for kid in kids:
            if kid in pos:
                edges.append(
                    {
                        "x1": round(pos[nid][0], 1),
                        "y1": round(pos[nid][1], 1),
                        "x2": round(pos[kid][0], 1),
                        "y2": round(pos[kid][1], 1),
                    }
                )
    highlight_groups = {nid: [] for nid in ordered}
    for step_i, step in enumerate(steps):
        highlight_nodes = _as_list((step.get("variables") or {}).get("highlight_nodes"))
        begin = round(step_i * STEP_DURATION, 2)
        for nid in highlight_nodes:
            key = str(nid)
            if key in highlight_groups:
                highlight_groups[key].append({"begin": begin})
    return {"nodes": nodes, "edges": edges, "highlight_groups": highlight_groups, "message": ""}


def _render_graph(steps: list[dict]) -> dict:
    variables = (steps[0].get("variables") or {}) if steps else {}
    graph = variables.get("graph") if isinstance(variables.get("graph"), dict) else {}
    nodes_in = [n for n in graph.get("nodes", []) if isinstance(n, dict) and "id" in n]
    edges_in = [e for e in graph.get("edges", []) if isinstance(e, dict) and "from" in e and "to" in e]
    if not nodes_in:
        return {
            "nodes": [],
            "edges": [],
            "node_highlights": {},
            "edge_highlights": {},
            "message": "暂无图数据",
        }
    cx, cy = WIDTH / 2, HEIGHT / 2
    radius = min(WIDTH, HEIGHT) / 2 - 60
    node_pos = {}
    for i, node in enumerate(nodes_in):
        angle = 2 * math.pi * i / len(nodes_in)
        node_pos[str(node["id"])] = (
            round(cx + radius * math.cos(angle), 1),
            round(cy + radius * math.sin(angle), 1),
        )
    nodes = [
        {"id": str(n["id"]), "value": n.get("value", ""), "x": node_pos[str(n["id"])][0], "y": node_pos[str(n["id"])][1]}
        for n in nodes_in
    ]
    edges = []
    for edge in edges_in:
        src, dst = str(edge["from"]), str(edge["to"])
        if src in node_pos and dst in node_pos:
            edges.append(
                {
                    "id": f"{src}->{dst}",
                    "x1": node_pos[src][0],
                    "y1": node_pos[src][1],
                    "x2": node_pos[dst][0],
                    "y2": node_pos[dst][1],
                }
            )
    node_highlights = {str(n["id"]): [] for n in nodes_in}
    edge_highlights = {e["id"]: [] for e in edges}
    for step_i, step in enumerate(steps):
        variables = step.get("variables") or {}
        begin = round(step_i * STEP_DURATION, 2)
        for nid in _as_list(variables.get("highlight_nodes")):
            key = str(nid)
            if key in node_highlights:
                node_highlights[key].append({"begin": begin})
        for eid in _as_list(variables.get("highlight_edges")):
            if eid in edge_highlights:
                edge_highlights[eid].append({"begin": begin})
    return {
        "nodes": nodes,
        "edges": edges,
        "node_highlights": node_highlights,
        "edge_highlights": edge_highlights,
        "message": "",
    }


def _render_dp(steps: list[dict]) -> dict:
    variables = (steps[0].get("variables") or {}) if steps else {}
    rows = [r for r in _as_list(variables.get("dp")) if isinstance(r, list)]
    if not rows:
        return {"cells": [], "highlight_groups": {}, "message": "暂无 DP 数据"}
    n_rows, n_cols = len(rows), max(len(r) for r in rows)
    plot_w = WIDTH - 2 * MARGIN
    plot_h = HEIGHT - 2 * MARGIN
    cell_w, cell_h = plot_w / n_cols, plot_h / n_rows
    cells = []
    highlight_groups = {}
    for r, row in enumerate(rows):
        for c in range(n_cols):
            key = f"{r}-{c}"
            x = MARGIN + c * cell_w
            y = MARGIN + r * cell_h
            cells.append(
                {
                    "row": r,
                    "col": c,
                    "key": key,
                    "value": row[c] if c < len(row) else "",
                    "x": round(x, 1),
                    "y": round(y, 1),
                    "width": round(cell_w, 1),
                    "height": round(cell_h, 1),
                    "cx": round(x + cell_w / 2, 1),
                    "cy": round(y + cell_h / 2, 1),
                }
            )
            highlight_groups[key] = []
    for step_i, step in enumerate(steps):
        variables = step.get("variables") or {}
        current = variables.get("dp_current")
        begin = round(step_i * STEP_DURATION, 2)
        if isinstance(current, list) and len(current) == 2:
            key = f"{_number(current[0])}-{_number(current[1])}"
            if key in highlight_groups:
                highlight_groups[key].append({"begin": begin})
    return {"cells": cells, "highlight_groups": highlight_groups, "message": ""}


def _render_linked_list(steps: list[dict]) -> dict:
    variables = (steps[0].get("variables") or {}) if steps else {}
    values = _as_list(variables.get("linked_list"))
    if not values:
        return {"nodes": [], "pointer_marks": [], "message": "暂无链表数据"}
    nodes = []
    spacing = 90
    for i, value in enumerate(values):
        x = MARGIN + i * spacing
        nodes.append({"index": i, "x": x, "cx": round(x + 30, 1), "value": value})
    pointer_marks = []
    for step_i, step in enumerate(steps):
        variables = step.get("variables") or {}
        pointer = variables.get("pointer")
        if pointer is not None:
            pointer = _number(pointer)
            if 0 <= pointer < len(nodes):
                pointer_marks.append({"x": round(nodes[pointer]["cx"], 1), "begin": round(step_i * STEP_DURATION, 2)})
    return {"nodes": nodes, "pointer_marks": pointer_marks, "message": ""}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_animation.py -v`
Expected: 8 passed（7 个分类参数用例 + 1 个兜底用例）。

- [ ] **Step 6: 提交**

```bash
git add assets/svg_templates/other.svg.j2 src/learning tests/test_animation.py
git commit -m "feat: add SVG animation infra, classifier and fallback"
```

---

### Task 4.2: sort 动画

**Files:**
- Create: `assets/svg_templates/sort_bars.svg.j2`
- Create: `tests/fixtures/animation_data.json`
- Modify: `tests/test_animation.py`

**Interfaces:**
- Consumes: `build_animation_svg(steps, "sort")`。
- Produces: 排序 SVG：柱状图 + `<animate attributeName="x">` 交换 + `fill` 比较高亮。

- [ ] **Step 1: 创建 sort 模板与 fixture**

创建 `assets/svg_templates/sort_bars.svg.j2`：

```jinja2
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  {% if message %}<text x="40" y="60" font-size="16">{{ message }}</text>{% endif %}
  {% for bar in bars %}
  <rect id="bar-{{ bar.index }}" x="{{ bar.x }}" y="{{ bar.y }}" width="{{ bar.width }}" height="{{ bar.height }}" fill="#4f8cff">
    <title>{{ bar.value }}</title>
    {% for move in move_groups[bar.index] %}
    <animate attributeName="x" from="{{ move.from_x }}" to="{{ move.to_x }}" dur="0.4s" begin="{{ move.begin }}s" fill="freeze"/>
    {% endfor %}
    {% for hl in highlight_groups[bar.index] %}
    <animate attributeName="fill" values="#4f8cff;#ffd166;#4f8cff" dur="0.4s" begin="{{ hl.begin }}s" repeatCount="1"/>
    {% endfor %}
  </rect>
  {% endfor %}
</svg>
```

创建 `tests/fixtures/animation_data.json`：

```json
{
  "sort": [
    {"step": 0, "line": 3, "variables": {"arr": [5, 3, 1]}},
    {"step": 1, "line": 4, "variables": {"arr": [3, 5, 1]}},
    {"step": 2, "line": 4, "variables": {"arr": [3, 1, 5]}}
  ],
  "search": [
    {"step": 0, "line": 4, "variables": {"arr": [1, 3, 5, 7], "mid": 1, "target": 5}},
    {"step": 1, "line": 5, "variables": {"arr": [1, 3, 5, 7], "mid": 2, "target": 5, "found": true}}
  ],
  "tree": [
    {"step": 0, "line": 5, "variables": {"tree": [{"id": 1, "value": 5, "left": 2, "right": 3}, {"id": 2, "value": 3, "left": null, "right": null}, {"id": 3, "value": 8, "left": null, "right": null}], "highlight_nodes": [1]}},
    {"step": 1, "line": 6, "variables": {"tree": [{"id": 1, "value": 5, "left": 2, "right": 3}, {"id": 2, "value": 3, "left": null, "right": null}, {"id": 3, "value": 8, "left": null, "right": null}], "highlight_nodes": [2]}}
  ],
  "graph": [
    {"step": 0, "variables": {"graph": {"nodes": [{"id": "A", "value": 0}, {"id": "B", "value": 1}], "edges": [{"from": "A", "to": "B", "weight": 2}]}, "highlight_edges": ["A->B"]}}
  ],
  "dp": [
    {"step": 0, "variables": {"dp": [[0, 1], [1, 2]], "dp_current": [0, 1]}},
    {"step": 1, "variables": {"dp": [[0, 1], [1, 2]], "dp_current": [1, 1]}}
  ],
  "linked_list": [
    {"step": 0, "variables": {"linked_list": [3, 5, 7], "pointer": 0}},
    {"step": 1, "variables": {"linked_list": [3, 5, 7], "pointer": 1}}
  ]
}
```

- [ ] **Step 2: 写失败测试**

在 `tests/test_animation.py` 末尾追加：

```python
import json
from pathlib import Path

from learning.animation import build_animation_svg

FIXTURES = Path(__file__).parent / "fixtures"


def _fixture(name):
    data = json.loads((FIXTURES / "animation_data.json").read_text(encoding="utf-8"))
    return data[name]


def test_sort_svg_has_bars_animate_and_values():
    svg = build_animation_svg(_fixture("sort"), "sort")
    assert svg.startswith("<svg")
    assert "<animate" in svg
    assert "5" in svg
    assert "bar-0" in svg
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_animation.py::test_sort_svg_has_bars_animate_and_values -v`
Expected: FAIL，模板文件不存在导致渲染出“暂无模板”文本，`<animate` 缺失。

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_animation.py::test_sort_svg_has_bars_animate_and_values -v`
Expected: PASS（`_render_sort` 在 Task 4.1 已实现，模板就位后通过）。

- [ ] **Step 5: 提交**

```bash
git add assets/svg_templates/sort_bars.svg.j2 tests/fixtures/animation_data.json tests/test_animation.py
git commit -m "feat: add sort bar SVG animation template"
```

---

### Task 4.3: search 动画

**Files:**
- Create: `assets/svg_templates/search_bars.svg.j2`
- Modify: `tests/test_animation.py`

**Interfaces:**
- Consumes: `build_animation_svg(steps, "search")`。
- Produces: 搜索 SVG：柱状图 + 按步骤闪现的扫描线，命中步使用 `#06d6a0`。

- [ ] **Step 1: 创建 search 模板**

创建 `assets/svg_templates/search_bars.svg.j2`：

```jinja2
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  {% if message %}<text x="40" y="60" font-size="16">{{ message }}</text>{% endif %}
  {% for bar in bars %}
  <rect id="bar-{{ bar.index }}" x="{{ bar.x }}" y="{{ bar.y }}" width="{{ bar.width }}" height="{{ bar.height }}" fill="#4f8cff">
    <title>{{ bar.value }}</title>
  </rect>
  {% endfor %}
  {% for scan in scans %}
  <rect x="{{ scan.x }}" y="40" width="4" height="320" fill="#ef476f" opacity="0">
    <animate attributeName="opacity" values="0;1;1;0" dur="0.6s" begin="{{ scan.begin }}s" repeatCount="1"/>
    <animate attributeName="fill" values="#ef476f;{{ '#06d6a0' if scan.found else '#ef476f' }};#ef476f" dur="0.6s" begin="{{ scan.begin }}s" repeatCount="1"/>
  </rect>
  {% endfor %}
</svg>
```

- [ ] **Step 2: 写失败测试**

在 `tests/test_animation.py` 末尾追加：

```python
def test_search_svg_has_scanline_and_animate():
    svg = build_animation_svg(_fixture("search"), "search")
    assert svg.startswith("<svg")
    assert "<animate" in svg
    assert "bar-0" in svg
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_animation.py::test_search_svg_has_scanline_and_animate -v`
Expected: FAIL，模板缺失。

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_animation.py::test_search_svg_has_scanline_and_animate -v`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add assets/svg_templates/search_bars.svg.j2 tests/test_animation.py
git commit -m "feat: add search scanline SVG animation template"
```

---

### Task 4.4: tree 动画

**Files:**
- Create: `assets/svg_templates/tree_traversal.svg.j2`
- Modify: `tests/test_animation.py`

**Interfaces:**
- Consumes: `build_animation_svg(steps, "tree")`。
- Produces: 树遍历 SVG：边线 + 圆形节点按 `highlight_nodes` 点亮。

- [ ] **Step 1: 创建 tree 模板**

创建 `assets/svg_templates/tree_traversal.svg.j2`：

```jinja2
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  {% if message %}<text x="40" y="60" font-size="16">{{ message }}</text>{% endif %}
  {% for edge in edges %}
  <line x1="{{ edge.x1 }}" y1="{{ edge.y1 }}" x2="{{ edge.x2 }}" y2="{{ edge.y2 }}" stroke="#94a3b8" stroke-width="2"/>
  {% endfor %}
  {% for node in nodes %}
  <circle id="node-{{ node.id }}" cx="{{ node.x }}" cy="{{ node.y }}" r="18" fill="#4f8cff">
    <title>{{ node.value }}</title>
    {% for hl in highlight_groups[node.id] %}
    <animate attributeName="fill" values="#4f8cff;#06d6a0;#4f8cff" dur="0.6s" begin="{{ hl.begin }}s" repeatCount="1"/>
    {% endfor %}
  </circle>
  <text x="{{ node.x }}" y="{{ node.y }}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="12">{{ node.value }}</text>
  {% endfor %}
</svg>
```

- [ ] **Step 2: 写失败测试**

在 `tests/test_animation.py` 末尾追加：

```python
def test_tree_svg_has_circles_and_animate():
    svg = build_animation_svg(_fixture("tree"), "tree")
    assert svg.startswith("<svg")
    assert "<circle" in svg
    assert "<animate" in svg
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_animation.py::test_tree_svg_has_circles_and_animate -v`
Expected: FAIL，模板缺失。

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_animation.py::test_tree_svg_has_circles_and_animate -v`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add assets/svg_templates/tree_traversal.svg.j2 tests/test_animation.py
git commit -m "feat: add tree traversal SVG animation template"
```

---

### Task 4.5: graph 动画

**Files:**
- Create: `assets/svg_templates/graph_path.svg.j2`
- Modify: `tests/test_animation.py`

**Interfaces:**
- Consumes: `build_animation_svg(steps, "graph")`。
- Produces: 图算法 SVG：环形布局节点 + 边按 `highlight_edges` 染色。

- [ ] **Step 1: 创建 graph 模板**

创建 `assets/svg_templates/graph_path.svg.j2`：

```jinja2
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  {% if message %}<text x="40" y="60" font-size="16">{{ message }}</text>{% endif %}
  {% for edge in edges %}
  <line id="edge-{{ edge.id }}" x1="{{ edge.x1 }}" y1="{{ edge.y1 }}" x2="{{ edge.x2 }}" y2="{{ edge.y2 }}" stroke="#94a3b8" stroke-width="2">
    {% for hl in edge_highlights[edge.id] %}
    <animate attributeName="stroke" values="#94a3b8;#06d6a0;#94a3b8" dur="0.6s" begin="{{ hl.begin }}s" repeatCount="1"/>
    {% endfor %}
  </line>
  {% endfor %}
  {% for node in nodes %}
  <circle id="node-{{ node.id }}" cx="{{ node.x }}" cy="{{ node.y }}" r="18" fill="#4f8cff">
    <title>{{ node.value }}</title>
    {% for hl in node_highlights[node.id] %}
    <animate attributeName="fill" values="#4f8cff;#ffd166;#4f8cff" dur="0.6s" begin="{{ hl.begin }}s" repeatCount="1"/>
    {% endfor %}
  </circle>
  <text x="{{ node.x }}" y="{{ node.y }}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="12">{{ node.value }}</text>
  {% endfor %}
</svg>
```

- [ ] **Step 2: 写失败测试**

在 `tests/test_animation.py` 末尾追加：

```python
def test_graph_svg_has_lines_and_animate():
    svg = build_animation_svg(_fixture("graph"), "graph")
    assert svg.startswith("<svg")
    assert "<line" in svg
    assert "<animate" in svg
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_animation.py::test_graph_svg_has_lines_and_animate -v`
Expected: FAIL，模板缺失。

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_animation.py::test_graph_svg_has_lines_and_animate -v`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add assets/svg_templates/graph_path.svg.j2 tests/test_animation.py
git commit -m "feat: add graph path SVG animation template"
```

---

### Task 4.6: dp 动画

**Files:**
- Create: `assets/svg_templates/dp_table.svg.j2`
- Modify: `tests/test_animation.py`

**Interfaces:**
- Consumes: `build_animation_svg(steps, "dp")`。
- Produces: DP 表格 SVG：逐格渲染 + 当前格高亮。

- [ ] **Step 1: 创建 dp 模板**

创建 `assets/svg_templates/dp_table.svg.j2`：

```jinja2
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  {% if message %}<text x="40" y="60" font-size="16">{{ message }}</text>{% endif %}
  {% for cell in cells %}
  <rect id="cell-{{ cell.row }}-{{ cell.col }}" x="{{ cell.x }}" y="{{ cell.y }}" width="{{ cell.width }}" height="{{ cell.height }}" fill="#e2e8f0" stroke="#64748b">
    <title>{{ cell.value }}</title>
    {% for hl in highlight_groups[cell.key] %}
    <animate attributeName="fill" values="#e2e8f0;#ffd166;#e2e8f0" dur="0.6s" begin="{{ hl.begin }}s" repeatCount="1"/>
    {% endfor %}
  </rect>
  <text x="{{ cell.cx }}" y="{{ cell.cy }}" text-anchor="middle" dominant-baseline="central" font-size="12">{{ cell.value }}</text>
  {% endfor %}
</svg>
```

- [ ] **Step 2: 写失败测试**

在 `tests/test_animation.py` 末尾追加：

```python
def test_dp_svg_has_cells_and_animate():
    svg = build_animation_svg(_fixture("dp"), "dp")
    assert svg.startswith("<svg")
    assert "cell-0-0" in svg
    assert "<animate" in svg
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_animation.py::test_dp_svg_has_cells_and_animate -v`
Expected: FAIL，模板缺失。

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_animation.py::test_dp_svg_has_cells_and_animate -v`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add assets/svg_templates/dp_table.svg.j2 tests/test_animation.py
git commit -m "feat: add DP table SVG animation template"
```

---

### Task 4.7: linked_list 动画

**Files:**
- Create: `assets/svg_templates/linked_list.svg.j2`
- Modify: `tests/test_animation.py`

**Interfaces:**
- Consumes: `build_animation_svg(steps, "linked_list")`。
- Produces: 链表 SVG：横向节点方块 + 指针箭头按 `pointer` 移动。

- [ ] **Step 1: 创建 linked_list 模板**

创建 `assets/svg_templates/linked_list.svg.j2`：

```jinja2
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  {% if message %}<text x="40" y="60" font-size="16">{{ message }}</text>{% endif %}
  {% for node in nodes %}
  <rect id="node-{{ node.index }}" x="{{ node.x }}" y="180" width="60" height="40" fill="#4f8cff">
    <title>{{ node.value }}</title>
  </rect>
  <text x="{{ node.cx }}" y="200" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="12">{{ node.value }}</text>
  {% if not loop.last %}
  <line x1="{{ node.x + 60 }}" y1="200" x2="{{ node.x + 90 }}" y2="200" stroke="#94a3b8" stroke-width="2"/>
  {% endif %}
  {% endfor %}
  {% for mark in pointer_marks %}
  <path d="M {{ mark.x }} 130 L {{ mark.x + 10 }} 146 L {{ mark.x - 10 }} 146 Z" fill="#ef476f" opacity="0">
    <animate attributeName="opacity" values="0;1;1;0" dur="0.6s" begin="{{ mark.begin }}s" repeatCount="1"/>
  </path>
  {% endfor %}
</svg>
```

- [ ] **Step 2: 写失败测试**

在 `tests/test_animation.py` 末尾追加：

```python
def test_linked_list_svg_has_nodes_and_animate():
    svg = build_animation_svg(_fixture("linked_list"), "linked_list")
    assert svg.startswith("<svg")
    assert "node-0" in svg
    assert "<animate" in svg
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_animation.py::test_linked_list_svg_has_nodes_and_animate -v`
Expected: FAIL，模板缺失。

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_animation.py::test_linked_list_svg_has_nodes_and_animate -v`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add assets/svg_templates/linked_list.svg.j2 tests/test_animation.py
git commit -m "feat: add linked list SVG animation template"
```

---

### Task 4.8: animate_node 接线、animate_guide 与专家类别标签

**Files:**
- Modify: `src/graphs/javatutor/state.py`
- Modify: `src/graphs/javatutor/prompts.py`
- Modify: `src/graphs/javatutor/nodes.py`
- Modify: `src/graphs/javatutor/graph.py`
- Modify: `tests/test_route_intent.py`
- Modify: `tests/test_expert_nodes.py`
- Modify: `tests/test_graph.py`

**Interfaces:**
- Consumes: `build_animation_svg(steps, algorithm_tag)`、`classify_algorithm(source_code)`。
- Produces: `animate_node(state) -> dict`（messages 含 SVG、state 含 `svg_text`）、`animate_guide_node(state) -> dict`（固定引导消息）、专家回复带 `【类别名】` 前缀、路由 `animate_guide`。

- [ ] **Step 1: 给 state 增加 svg_text**

在 `src/graphs/javatutor/state.py` 的 `answer: str` 之后追加：

```python
    svg_text: str
    """动画分支生成的 SVG 文本，非动画分支为空字符串."""
```

- [ ] **Step 2: 替换 prompts 中的动画占位**

将 `src/graphs/javatutor/prompts.py` 中的：

```python
SYSTEM_PROMPT_ANIMATE = """【功能待开发】动画生成功能正在开发中，敬请期待。"""
```

替换为：

```python
ANIMATE_GUIDE_MESSAGE = "动画生成请在界面点击「生成动画」按钮，我会基于本次运行数据为你生成可视化。直接在聊天里输入暂时不会触发动画。"
```

- [ ] **Step 3: 实现 animate_node、animate_guide_node 与类别前缀**

在 `src/graphs/javatutor/nodes.py` 顶部 import 追加：

```python
from learning.animation import build_animation_svg, classify_algorithm
from graphs.javatutor.prompts import ANIMATE_GUIDE_MESSAGE
```

将 `_run_expert` 的返回改为带类别前缀（其他逻辑不变）：

```python
    answer = _normalize_md(_deduplicate_answer(answer))
    labels = {"data_query": "数据追问", "concept": "概念讲解", "debug": "错误诊断", "other": "通用助手"}
    return {"answer": f"【{labels.get(expert, '通用助手')}】{answer}"}
```

将现有 `animate_node` 整体替换为：

```python
def animate_node(state: JavaTutorState) -> dict:
    """animate 专家: 基于 steps 生成纯 SVG 动画消息."""
    steps = state.get("steps") or []
    if not steps:
        return {"messages": [AIMessage(content="请先运行代码，再点击「生成动画」按钮。")], "svg_text": ""}
    algorithm_tag = classify_algorithm(state.get("source_code", ""))
    svg_text = build_animation_svg(steps, algorithm_tag)
    return {"messages": [AIMessage(content=svg_text)], "svg_text": svg_text}


def animate_guide_node(state: JavaTutorState) -> dict:
    """聊天中请求动画时的固定引导，不调用 LLM."""
    return {"messages": [AIMessage(content=ANIMATE_GUIDE_MESSAGE)]}
```

删除 `SYSTEM_PROMPT_ANIMATE` 的 import（如仍在 import 列表中）。

- [ ] **Step 4: 更新路由**

在 `src/graphs/javatutor/nodes.py` 的 `route_intent` 中，`compile_error` 短路之后、data_query 关键词之前插入：

```python
    if any(k in question for k in ("动画", "演示", "可视化", "播放")):
        return {"intent": "animate_guide"}
```

- [ ] **Step 5: 更新 graph**

在 `src/graphs/javatutor/graph.py` 中：

1. import 增加 `animate_guide_node`：

```python
from graphs.javatutor.nodes import (
    analyze_node,
    animate_guide_node,
    animate_node,
    concept_node,
    data_query_node,
    debug_node,
    other_node,
    parse_context,
    route_intent,
)
```

2. `_route_to_expert` 返回类型与映射增加 `animate_guide`：

```python
def _route_to_expert(state: JavaTutorState) -> Literal["data_query", "concept", "debug", "animate", "animate_guide", "analyze", "other"]:
    intent: str = state.get("intent", "other")
    node_map = {
        "data_query": "data_query",
        "concept": "concept",
        "debug": "debug",
        "animate": "animate",
        "animate_guide": "animate_guide",
        "analyze": "analyze",
        "other": "other",
    }
    return node_map.get(intent, "other")
```

3. 注册节点与边：

```python
    graph.add_node("animate_guide", animate_guide_node)
```

```python
    graph.add_conditional_edges(
        source="route_intent",
        path=_route_to_expert,
        path_map={
            "data_query": "data_query",
            "concept": "concept",
            "debug": "debug",
            "animate": "animate",
            "animate_guide": "animate_guide",
            "analyze": "analyze",
            "other": "other",
        },
    )
```

```python
    for node in ["data_query", "concept", "debug", "animate", "animate_guide", "analyze", "other"]:
        graph.add_edge(node, END)
```

- [ ] **Step 6: 更新路由测试**

在 `tests/test_route_intent.py` 的测试类中追加：

```python
    def test_animate_keyword_guides_button(self):
        state = {"user_question": "帮我生成一个排序动画", "compile_error": "", "has_steps": True}
        assert route_intent(state)["intent"] == "animate_guide"
```

在文件顶部确认已有 `from graphs.javatutor.nodes import route_intent`；如无，追加。

- [ ] **Step 7: 更新专家节点测试**

将 `tests/test_expert_nodes.py` 中的 `test_animate_placeholder` 整体替换为：

```python
    def test_animate_node_returns_svg_message(self):
        state = {
            **BASE_STATE,
            "steps": [{"step": 0, "variables": {"arr": [5, 3, 1]}}, {"step": 1, "variables": {"arr": [3, 5, 1]}}],
            "steps_json": json.dumps([{"step": 0, "variables": {"arr": [5, 3, 1]}}, {"step": 1, "variables": {"arr": [3, 5, 1]}}], ensure_ascii=False),
            "steps_count": 2,
            "has_steps": True,
        }
        result = animate_node(state)
        assert "messages" in result
        assert result["messages"][0].content.startswith("<svg")
        assert "<animate" in result["messages"][0].content
        assert result.get("svg_text", "").startswith("<svg")

    def test_animate_node_empty_steps_guides_run_first(self):
        state = {**BASE_STATE, "steps": [], "steps_count": 0, "has_steps": False}
        result = animate_node(state)
        assert result["messages"][0].content == "请先运行代码，再点击「生成动画」按钮。"
        assert result.get("svg_text", "") == ""

    def test_animate_guide_node_returns_fixed_message(self):
        from graphs.javatutor.nodes import animate_guide_node
        from graphs.javatutor.prompts import ANIMATE_GUIDE_MESSAGE

        result = animate_guide_node({})
        assert result["messages"][0].content == ANIMATE_GUIDE_MESSAGE

    def test_expert_answer_has_category_prefix(self):
        state = {**BASE_STATE, "user_question": "为什么 x 是 1？"}
        result = data_query_node(state, model=_build_fake_model("data_query"))
        assert result["answer"].startswith("【数据追问】")
```

确认文件顶部已 import `animate_node`；如需 import `data_query_node`，追加。

- [ ] **Step 8: 更新全流程测试**

在 `tests/test_graph.py` 测试类中追加：

```python
    def test_full_flow_animate_explicit(self):
        payload = {
            "source_code": "public class BubbleSort {}",
            "steps": [{"step": 0, "variables": {"arr": [5, 3, 1]}}, {"step": 1, "variables": {"arr": [3, 5, 1]}}],
            "current_step_index": 1,
            "user_question": "",
            "compile_error": "",
            "intent": "animate",
        }
        initial = {"messages": [HumanMessage(content=json.dumps(payload))]}
        compiled = build_agent().builder.compile()
        result = compiled.invoke(initial)
        ai_msgs = [m for m in result.get("messages", []) if hasattr(m, "type") and m.type == "ai"]
        assert ai_msgs
        assert ai_msgs[-1].content.startswith("<svg")

    def test_full_flow_animate_guide(self):
        payload = {
            "source_code": "public class BubbleSort {}",
            "steps": [{"step": 0, "variables": {"arr": [5, 3, 1]}}],
            "current_step_index": 0,
            "user_question": "帮我生成一个动画",
            "compile_error": "",
        }
        initial = {"messages": [HumanMessage(content=json.dumps(payload))]}
        compiled = build_agent().builder.compile()
        result = compiled.invoke(initial)
        assert result.get("intent") == "animate_guide"
        ai_msgs = [m for m in result.get("messages", []) if hasattr(m, "type") and m.type == "ai"]
        assert ai_msgs and "生成动画" in ai_msgs[-1].content
```

- [ ] **Step 9: 运行全部测试**

Run: `uv run pytest tests/ -v`
Expected: 全部通过；`test_animate_placeholder` 已被新测试取代。

- [ ] **Step 10: 提交**

```bash
git add src/graphs/javatutor tests
git commit -m "feat: wire animate node, add animate_guide and expert category labels"
```

---

## Self-Review

### Spec Coverage

| 需求 | 对应任务 |
|---|---|
| 六类动画 | Task 4.2-4.7 |
| other 兜底 | Task 4.1 |
| 纯 SVG 输出契约 | Task 4.1 + Task 4.8 |
| 显式 intent 才触发动画 | Task 4.8（route_intent） |
| 聊天动画关键词 → animate_guide | Task 4.8 |
| 自由问答回复带专家类别 | Task 4.8（`_run_expert` 前缀） |
| 模板文件 + Jinja2 方案 | Task 4.1-4.7 |

### Placeholder Scan

计划无 `TBD`、`TODO`、`implement later`；所有代码块为完整实现。

### Type Consistency

- `classify_algorithm(source_code) -> str`：Task 4.1 定义，Task 4.8 使用。
- `build_animation_svg(steps, algorithm_tag) -> str`：Task 4.1 定义，Task 4.2-4.8 使用。
- `animate_node(state) -> dict`：Task 4.8 定义并测试。
- `animate_guide_node(state) -> dict`：Task 4.8 定义并注册。
- `ANIMATE_GUIDE_MESSAGE`：Task 4.8 定义并测试。
- `svg_text`：Task 4.8 加入 state 并断言。
