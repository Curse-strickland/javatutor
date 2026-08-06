# Boot Intro × 前端应用集成 — Design Spec

**Date:** 2026-08-06  
**Status:** Approved in conversation; awaiting user review of this written spec  
**Source:** `javatutor-intro.html` (design / preview source of truth for visuals)

## Goal

把仓库根目录的终端启动开场动画接入 Vue 前端：每次访问应用都播放完整 intro，同页遮罩盖住已挂载的 IDE，点击进入后幕布合拢显字，再从中间拉开露出主界面。

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| When to show | **Every visit** (including refresh); no session/localStorage skip flag |
| Integration | **Same-page overlay** Vue component; no vue-router; no `location` jump |
| Exit transition | **Full OP**: curtain close → black title → curtain open (~1.2–1.4s, not rushed) |
| Underlay media | **Load normally** (Live2D / video / audio run under the overlay) |

## Architecture

```
App.vue
├── IDE shell (always mounted: editor, panels, VideoBackground, AudioBackground, Live2DWidget, …)
└── BootIntro.vue  (v-if="showBootIntro"; fixed fullscreen; z-index ≥ 20000)
```

### Files

| File | Role |
|------|------|
| `frontend/src/components/BootIntro.vue` | Boot UI + veil + phase timing; emit `done` when finished |
| `frontend/src/App.vue` | `showBootIntro` flag; render `BootIntro`; set false on `@done` |
| `frontend/index.html` | Optionally add Google Fonts used by intro (once, not duplicated) |
| `javatutor-intro.html` (repo root) | **Keep** as design/preview source; **not** used at runtime |

Optional: extract long CSS to `frontend/src/assets/boot-intro.css` if the SFC becomes unwieldy. Default is styles colocated in the component.

### Responsibility split

- **BootIntro:** animation, skip-to-steady, op-start, curtain-open, emit `done`
- **App.vue:** mount gate only; no IDE business logic changes
- **No** vue-router; **no** `MAIN_URL` redirect

## State machine

Phases (internal to BootIntro):

| Phase | Trigger | Behavior |
|-------|---------|----------|
| `booting` | mount | 5.6s boot sequence (CRT → log → charge → logo) |
| `steady` | 5.6s elapsed **or** user skip | Idle brand frame + CTA; charge locked at 100% |
| `op-start` | click「进入学习终端」 | Ripple → veil closes → OP title (~1.9s, same as source HTML) |
| `curtain-open` | after op-start | Veil panels slide outward (~**1.2–1.4s**); OP title fades; IDE visible beneath |
| `done` | curtain-open finished | `emit('done')` → App sets `showBootIntro = false` → component unmounts |

### Skip rules (match source HTML)

- `prefers-reduced-motion: reduce` → start in `steady`
- After ~0.9s, click / any key skips to `steady` only (does **not** enter IDE)
- Only the CTA advances to `op-start`

### Timing notes

- Boot total: **5.6s** (keep from source)
- Op-start hold before open: **~1.9s** (keep from source)
- Curtain-open: **1.2–1.4s** — deliberately unhurried so the handoff does not feel rushed
- Do not unmount until curtain-open CSS transition has completed (avoid a flash)

## Visual / DOM port

- Port markup and CSS from `javatutor-intro.html` into `BootIntro.vue`
- Scope former `body.done` / `body.op-start` to a root class on the component (e.g. `.boot-intro.is-done`, `.boot-intro.is-op-start`, `.boot-intro.is-curtain-open`) so global `body` is not polluted
- Same pair of `.veil-panel` elements used for close and open (continuity)
- CTA: use `<button>` (or `@click.prevent` on `<a>`) — no navigation
- Fonts: Archivo, Noto Sans SC, JetBrains Mono — ensure loaded once via `index.html` or equivalent

## Layering & interaction

- `.boot-intro { position: fixed; inset: 0; z-index: 20000; }` — above Live2D (`#waifu` ~1), `GlobalStatus` (1000–1100), `WallpaperSelector` (up to 9999)
- While mounted: capture all pointer events
- After unmount: normal IDE interaction

## Error / reduced-motion fallbacks

- If Web Animations / heavy CSS is unreliable: land in `steady`; on CTA, short delay then `done`
- Intro must not depend on a second HTML document or hash (`#curtain` protocol retired for the Vue path)

## Out of scope

- “Show once” / “don’t show again”
- vue-router or separate intro URL
- Changing IDE features, Live2D model, or wallpaper system
- Splitting veil into a separate shared component (YAGNI)
- Deleting `javatutor-intro.html` (keep as design source)

## Success criteria

1. Visiting `frontend` (dev or build) always shows the full boot intro first
2. IDE (including media) mounts underneath and is revealed by curtain-open
3. Clicking CTA plays close → title → open without a full page navigation
4. Skip during boot jumps to steady, not into the IDE
5. After `done`, intro is gone and does not block IDE controls
6. Curtain-open pacing feels calm (not snappy)

## Test plan (manual)

1. Cold load: boot plays ~5.6s → steady → CTA works → full OP → IDE usable
2. Refresh: intro plays again from the start
3. Skip (key/click after ~0.9s): jumps to steady; CTA still required
4. `prefers-reduced-motion`: starts at steady; CTA still runs a shortened path into IDE
5. Confirm Live2D / chrome are not clickable through the overlay; after dismiss, they are
6. Narrow and wide viewports: stage remains full-bleed, no horizontal scroll
