# Rhodes Archive 主界面换皮 — Design Spec

**Date:** 2026-08-06  
**Status:** Approved  
**References:** `brand-spec.md`, `prototype-02-rhodes.html`, existing BootIntro Rhodes tokens

## Goal

在**不改动按钮种类、功能与大致布局位置**的前提下，将 Vue 主界面壳层（卡片、顶栏装饰、底栏控件、看板娘气泡）统一到 Rhodes Archive 视觉：冷灰白档案纸 + 墨黑切角 + 青蓝单点强调，并参考原型 `.wire` 动态横幅在页面加入精致点缀。壁纸 / 视频 / Live2D 继续挂载。

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Strategy | **B**：保留壁纸/视频底；IDE 壳改为浅色档案纸浮层 |
| Approach | Token 映射 + 壳层换皮 + 定点装饰（非整页重排） |
| Controls | 前进/后退/播放等**样式与图标精修**；位置与行为不变 |
| Scope out | Monaco 主题重做、可视化节点重画、侧轨占宽、搬按钮 |

## Hard constraints

- 左编辑器 / 右标签面板 / 底栏控件：**结构与大致位置不变**
- 按钮：**种类与功能不变**（运行、步进、后退、播放、导入、测试、页签、壁纸等）
- BootIntro 过场逻辑不改
- 青蓝 `#0d9ec4` 每视觉区域至多作为「当前/主操作」强调，避免满屏高亮

## Visual contract (from brand-spec)

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#e9ebef` | 壳层冷灰（卡片外缘氛围；页面底仍可透出壁纸） |
| `--surface` / paper | `#f4f5f8` / `#ffffff` | 档案纸卡片、顶栏、气泡 |
| `--fg` / ink | `#12161d` | 正文、切角画框、主 ghost 按钮底 |
| `--muted` | `#4d5665` | 次要文字 |
| `--faint` | `#8b93a1` | 元信息 |
| `--border` / line | `#c9ced8` | 细分隔 |
| `--accent` | `#0d9ec4` | 唯一强调色 |

**Form:** `clip-path` 切角 8–12px，不用大圆角玻璃卡。  
**Type:** UI 壳 `Archivo` + `Noto Sans SC`；HUD/按钮/元信息 `JetBrains Mono`。代码编辑器内部字体可保留现有方案。  
**Motifs:** 细蓝图感分隔、短警示斜纹（仅 header/横幅功能性位置）、双语 mono 元信息。

## Component design

### 1. Global tokens (`style.css`)

Remap existing aliases so components keep working with minimal churn:

- `--card-bg` → 半透明或实心档案纸（建议 `rgba(244,245,248,0.92)` 或 `#f4f5f8`，保证壁纸隐约可见）
- `--text` / `--text-h` / `--text-muted` → fg / ink / muted
- `--primary` / `--accent` → `#0d9ec4`
- `--border` → `#c9ced8` 系
- `--shadow` → 更轻的档案投影（非厚黑玻璃阴影）
- 全局 UI `font-family` 切到 Archivo / JetBrains Mono（不影响 Monaco 内部若单独设置）

`.card` / `.glass`：去 `border-radius: 12px`，改为切角 + 细边框。

### 2. Wire banner (new, above `main-area`)

Compact bar (~36–44px), inspired by prototype `.wire` but **single row** so it does not steal vertical space from the IDE:

- Left: pulsing accent square + title `RUNTIME WIRE` / 副标 `教学终端 · JT`
- Right: one marquee track of mono items (TRACE · STEP · HEAP · AI TUTOR · SANDBOX · …), duplicated for seamless loop
- Background: `--surface` / `#f4f5f8` with top/bottom hairline; optional left accent underline like prototype topbar
- Does **not** relocate any existing control buttons

### 3. Editor / right panel chrome (`App.vue`)

- Cards: cut corners, paper fill, hairline border; remove heavy glass radius
- Headers: mono label (`Nº CODE` / `Nº INSPECT` or bilingual equivalent) + short accent rule under header edge
- Tabs: inactive muted; active = accent underline or accent ink treatment (one emphasis)
- Upload / testmode header buttons: cut corner ghost; active = accent border/fill soft

### 4. Control bar — premium Rhodes controls

**Layout:** keep current order and placement (run / step / back / play / speed / AI toggle, etc.).

**Skin:**
- Default: cut-corner ghost (inset border `--line-strong`), ink icon/text
- Primary (run / play-as-main): solid `--accent` fill, white glyph
- Hover: border → accent or slight lift; no new glow stacks
- Disabled: lower opacity, no “broken gray pill” look
- Speed dropdown / menus: same cut + hairline paper panel

**Icons (redesign for craft):**
- Replace generic thick strokes with a **unified Rhodes terminal set**: consistent 1.75–2px stroke, geometric, slightly “HUD” (chamfered play triangle, stepped chevrons for next/prev, square-with-bar for stop/pause if present)
- Prefer inline SVG in the control buttons (same hit targets/sizes as today)
- One visual language across the bar — not mixed emoji / mismatched icon packs
- Optional: tiny mono caption under or beside only if it already exists; **do not** add new labels that change layout density without need

### 5. Live2D tips (`waifu.css`)

- `#waifu-tips`: paper background, ink border, **cut-path** (no 12px cream bubble)
- Highlight spans → `--accent`
- Tool icons hover → accent
- Keep position/size roughly so it still sits above the model; no layout relocation of `#waifu`

### 6. Out of scope this pass

- Monaco color theme overhaul
- Memory/heap/list canvas node restyle
- Fixed side rails that shrink the IDE
- Moving or removing control buttons
- Changing BootIntro

## Success criteria

1. First impression after BootIntro: paper archive cards + cyan accents, not dark glass iOS cards  
2. Wire banner readable, calm marquee, does not block controls  
3. Play / step / back / run feel like one crafted set (shape + icons)  
4. Waifu tip bubble matches Rhodes paper language  
5. All existing actions still work in the same places  
6. Wallpaper/video still visible behind/around the shell  

## Manual test plan

1. Cold load → intro → curtain → IDE: chrome is Rhodes paper  
2. Click through run / step / back / play / speed / AI / upload / test / tabs  
3. Resize splitter; banner and cards still coherent  
4. Waifu tip appears with new bubble style  
5. Wallpaper selector still usable; video underlay still shows  

## Files to touch

| File | Change |
|------|--------|
| `frontend/src/style.css` | Rhodes tokens + card/btn base |
| `frontend/src/App.vue` | Wire banner markup; editor/right/control styles; control SVGs |
| `frontend/public/live2d/waifu.css` | Tips + tool chrome |
| `frontend/index.html` | Fonts already present from BootIntro; verify only |

Optional small helper: `frontend/src/assets/rhodes-controls.css` if App.vue style block grows too large — prefer colocate first.
