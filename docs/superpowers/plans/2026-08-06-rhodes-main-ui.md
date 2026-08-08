# Rhodes Main UI Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Vue IDE shell to Rhodes Archive (paper cards, cut corners, cyan accent, wire banner, crafted control icons, waifu tip bubble) without moving controls or changing their behavior.

**Architecture:** Remap CSS tokens in `style.css` so existing `var(--card-bg)` etc. pick up Rhodes colors; skin `App.vue` chrome + add a compact wire banner above `main-area`; redesign control-bar SVGs in place; restyle `#waifu-tips` in `waifu.css`. Wallpaper/video/Live2D stay mounted.

**Tech Stack:** Vue 3 SFC, existing CSS variables, JetBrains Mono / Archivo (already in `index.html`), no new dependencies.

## Global Constraints

- Do **not** change button kinds, click handlers, or approximate layout positions
- Do **not** overhaul Monaco theme or visualization canvases this pass
- Accent `#0d9ec4` only for active/primary emphasis
- Keep wallpaper/video/Live2D; BootIntro unchanged
- Spec: `docs/superpowers/specs/2026-08-06-rhodes-main-ui-design.md`

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/style.css` | Rhodes tokens + `.card`/`.btn` base |
| `frontend/src/App.vue` | Wire banner; panel/control chrome; HUD SVGs |
| `frontend/public/live2d/waifu.css` | Tip bubble + tool hover |
| `docs/superpowers/specs/2026-08-06-rhodes-main-ui-design.md` | Mark Status Approved |

---

### Task 1: Rhodes tokens in `style.css`

**Files:**
- Modify: `frontend/src/style.css` (`:root` and `.card` / `.btn` blocks)
- Modify: spec status line → `Approved`

**Interfaces:**
- Produces aliases consumed by App: `--bg`, `--card-bg`, `--text`, `--text-h`, `--text-muted`, `--border`, `--primary`, `--accent`, `--accent-bg`, `--accent-border`, `--shadow`, `--sans`, `--mono`, `--cut`

- [ ] **Step 1: Remap `:root` tokens**

Replace the dark-glass `:root` color/font block with Rhodes values while **keeping the same variable names** App already uses:

```css
:root {
  --text: #4d5665;
  --text-h: #12161d;
  --text-muted: #8b93a1;
  --bg: #e9ebef;
  --card-bg: rgba(244, 245, 248, 0.92);
  --glass: rgba(255, 255, 255, 0.88);
  --border: #c9ced8;
  --code-bg: #ffffff;
  --primary: #0d9ec4;
  --primary-600: #0a7fa0;
  --accent: #0d9ec4;
  --accent-bg: rgba(13, 158, 196, 0.12);
  --accent-border: rgba(13, 158, 196, 0.35);
  --shadow: 0 18px 40px -28px rgba(18, 22, 29, 0.35);
  --cut: 10px;
  --ink: #12161d;
  --line-strong: #9aa2b0;
  --surface: #f4f5f8;
  --sans: 'Archivo', 'Noto Sans SC', -apple-system, system-ui, sans-serif;
  --heading: 'Archivo', 'Noto Sans SC', -apple-system, system-ui, sans-serif;
  --mono: 'JetBrains Mono', 'Noto Sans SC', Menlo, monospace;
  font: 15px/1.55 var(--sans);
  color: var(--text);
  background: var(--bg);
  /* keep font-synthesis / antialiasing flags */
}
```

Keep Maple `@font-face` rules (unused by UI is fine; Monaco or leftovers may still reference).

- [ ] **Step 2: Restyle `.card` / `.btn` bases**

```css
.card, .glass {
  background: var(--card-bg);
  border-radius: 0;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
  clip-path: polygon(
    var(--cut) 0, 100% 0,
    100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%,
    0 100%, 0 var(--cut)
  );
}

.btn {
  border-radius: 0;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  font-family: var(--mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  /* keep padding/gap roughly */
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 14px 28px -14px rgba(13, 158, 196, 0.55);
  border: none;
}
```

Also update `html` flash color in `index.html` if still dark `#2b2b32` — change to `#e9ebef` so pre-Vue flash matches.

- [ ] **Step 3: Visual smoke**

Run `npm run dev` in `frontend/`. Expected: IDE chrome already lighter even before App.vue edits; BootIntro still works.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/style.css frontend/index.html docs/superpowers/specs/2026-08-06-rhodes-main-ui-design.md
git commit -m "style: map IDE CSS tokens to Rhodes Archive palette"
```

---

### Task 2: Wire banner + panel chrome in `App.vue`

**Files:**
- Modify: `frontend/src/App.vue` (template + scoped styles)

**Interfaces:**
- Consumes tokens from Task 1
- Produces DOM: `.runtime-wire` above `.main-area`

- [ ] **Step 1: Insert compact wire banner**

Immediately after `<BootIntro … />` (or before `.main-area` inside shell), add:

```vue
<div class="runtime-wire" aria-label="运行时数据流">
  <div class="wire-left">
    <span class="wire-mark" aria-hidden="true"><span class="wire-pulse" /></span>
    <span class="wire-title">
      <b>RUNTIME WIRE</b>
      <span>教学终端 · HEARTBEAT</span>
    </span>
  </div>
  <div class="wire-row">
    <div class="marquee-track">
      <!-- duplicate the item list twice for seamless loop -->
      <span class="wire-item" v-for="(item, i) in wireItems" :key="'a'+i">
        <span class="wire-dot">·</span>{{ item.name }}
        <span class="wire-coord">{{ item.coord }}</span>
      </span>
      <span class="wire-item" v-for="(item, i) in wireItems" :key="'b'+i">
        <span class="wire-dot">·</span>{{ item.name }}
        <span class="wire-coord">{{ item.coord }}</span>
      </span>
    </div>
  </div>
</div>
```

In script:

```js
const wireItems = [
  { name: 'TRACE', coord: 'AST' },
  { name: 'STEP', coord: 'PLAYBACK' },
  { name: 'HEAP', coord: 'VIEW' },
  { name: 'STACK', coord: 'FRAME' },
  { name: 'AI TUTOR', coord: 'COZE' },
  { name: 'SANDBOX', coord: 'JDK17' },
  { name: 'LIVE2D', coord: 'OP' },
]
```

Respect `prefers-reduced-motion`: pause marquee via CSS media query.

- [ ] **Step 2: Panel header labels + cut cards**

In editor header, keep existing controls; add a mono kicker before the title, e.g. wrap title area:

```vue
<span class="panel-kicker">Nº CODE</span>
<span class="text-sm font-semibold" style="color: var(--text-h)">你的代码</span>
```

Similarly on right card header: `Nº INSPECT` before tabs (do not reorder tabs/buttons).

Update scoped CSS:

- `.editor-card` / `.right-card`: remove `border-radius`; use `clip-path` with `--cut`; paper `var(--card-bg)`
- Headers: hairline bottom; `::after` short accent bar (left 72–120px, height 2px)
- `.upload-toggle-btn` / `.testmode-btn`: cut corners, mono uppercase small; active → accent border/bg
- `.right-tab.active`: accent underline or accent color (one emphasis)
- `.rc-dot`: accent square pulse instead of soft round if present

- [ ] **Step 3: Wire + panel CSS**

Add styles for `.runtime-wire`, `.marquee-track` (animation ~40s linear infinite), height ≤ 44px, `font-family: var(--mono)`.

- [ ] **Step 4: Verify**

Banner visible; cards look cut; import/test/tabs still clickable in same places.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/App.vue
git commit -m "feat: add Rhodes wire banner and archive panel chrome"
```

---

### Task 3: Control bar skin + crafted HUD icons

**Files:**
- Modify: `frontend/src/App.vue` (control button SVGs + `.ctrl-btn*` / progress styles)

**Interfaces:**
- Same `@click` handlers and `disabled` bindings; only markup inside buttons and CSS change

- [ ] **Step 1: Restyle floating control bar**

`.control-bar` / `.control-bar-top`: paper surface, cut path, ink border; drag handle muted mono.

`.ctrl-btn`:
- transparent → inset 1px `var(--line-strong)` ghost via `box-shadow: inset 0 0 0 1px …`
- `clip-path` 6–8px cut; `border-radius: 0`
- hover: inset border → accent; slight `translateY(-1px)`
- disabled: opacity 0.35

`.ctrl-btn.run-btn`: solid `var(--accent)`, color `#fff` (primary emphasis — not green)

`.ai-toggle-btn.active`: accent treatment consistent with tabs

Progress:
- track: `#c9ced8` / faint
- fill: solid `var(--accent)` (optional thin hazard stripe via repeating-gradient — keep subtle)
- thumb: square cut (not round purple), accent border

Speed menu: inherit `.card` cut; active option accent.

- [ ] **Step 2: Replace control SVGs with unified HUD set**

Use `fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="miter"` geometric icons (24 viewBox), same 18/22 sizes:

| Control | Icon idea |
|---------|-----------|
| First | Bar + chevron left |
| Prev | Chamfered chevron left |
| Run | Chamfered play triangle (primary) |
| Next | Chamfered chevron right |
| Last | Chevron + bar |
| Autoplay play/pause | Chamfered play / two bars |
| AI | Simplified cut speech / terminal glyph (keep hit area) |

Do not change button order or titles.

- [ ] **Step 3: Click-through QA**

Run, step, back, play, speed, AI — all still work; icons look one family.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/App.vue
git commit -m "style: Rhodes cut controls and HUD playback icons"
```

---

### Task 4: Waifu tip bubble + final QA

**Files:**
- Modify: `frontend/public/live2d/waifu.css`

- [ ] **Step 1: Restyle `#waifu-tips`**

```css
#waifu-tips {
  background-color: rgba(244, 245, 248, 0.95);
  border: 1px solid #c9ced8;
  border-radius: 0;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  box-shadow: 0 18px 40px -28px rgba(18, 22, 29, 0.35);
  color: #12161d;
  font-family: 'Archivo', 'Noto Sans SC', system-ui, sans-serif;
  /* keep width/position roughly */
}
#waifu-tips span { color: #0d9ec4; }
#waifu-tool svg:hover { fill: #0d9ec4; }
```

Optionally restyle `#waifu-toggle` to ink cut (position unchanged).

- [ ] **Step 2: Full checklist from spec**

Cold load → intro → IDE; banner; cards; controls; waifu tip; wallpaper still under.

- [ ] **Step 3: `npm run build`**

Expect success.

- [ ] **Step 4: Commit**

```powershell
git add frontend/public/live2d/waifu.css
git commit -m "style: Rhodes archive Live2D tip bubble"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Token remap | 1 |
| Wire banner | 2 |
| Panel chrome / kickers | 2 |
| Control skin + icons | 3 |
| Waifu tips | 4 |
| No layout/button move | All |
| Out of scope Monaco/canvas | Not tasked |

**Placeholder scan:** icon paths described by intent; implementer draws concrete SVG paths in Task 3 Step 2 (must be real path data, not “TODO”).
