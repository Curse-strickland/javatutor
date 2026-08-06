# Boot Intro Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `javatutor-intro.html` boot sequence into the Vue app as a fullscreen overlay that always plays on visit, then reveals the already-mounted IDE via a calm curtain-open handoff.

**Architecture:** `App.vue` always mounts the IDE underlay. `BootIntro.vue` sits on top (`z-index: 20000`) with phases `booting → steady → op-start → curtain-open → done`. On `done`, App unmounts the overlay. No router, no `location` redirect, no “show once” storage.

**Tech Stack:** Vue 3 (`<script setup>`), Vite, plain CSS (ported from `javatutor-intro.html`), Google Fonts (Archivo / Noto Sans SC / JetBrains Mono).

## Global Constraints

- Every visit shows intro (including refresh); **no** `sessionStorage` / `localStorage` skip flag
- Same-page overlay only; **no** vue-router; **no** `MAIN_URL` / `window.location` navigation
- Curtain-open duration **1.2–1.4s** (must not feel rushed); boot **5.6s**; op-start hold **~1.9s**
- Underlay Live2D / video / audio load normally while overlay is visible
- Scope CSS to `.boot-intro` root classes — never set classes on `document.body`
- Keep repo-root `javatutor-intro.html` as design source; do not delete it
- Frontend has **no** unit-test runner; verify with `npm run dev` + manual checklist from the spec
- Prefer minimal `App.vue` edits (import + one `v-if` + one ref)

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/index.html` | Modify | Load intro Google Fonts once |
| `frontend/src/components/BootIntro.vue` | Create | Markup + CSS + phase machine; emit `done` |
| `frontend/src/App.vue` | Modify | `showBootIntro` + `<BootIntro @done>` overlay |
| `javatutor-intro.html` | Leave | Design / preview source only |
| `docs/superpowers/specs/2026-08-06-boot-intro-integration-design.md` | Reference | Locked decisions |

---

### Task 1: Fonts + BootIntro shell (phases + emit)

**Files:**
- Modify: `frontend/index.html`
- Create: `frontend/src/components/BootIntro.vue`
- Modify: `frontend/src/App.vue` (minimal mount only)

**Interfaces:**
- Consumes: none
- Produces:
  - `BootIntro` emits `done: []` (no payload) when the intro should unmount
  - Root element class `boot-intro` plus phase modifiers: `is-done` | `is-op-start` | `is-curtain-open`
  - Constants: `DONE_AT = 5600`, `NAV_DELAY = 1900`, `CURTAIN_OPEN_MS = 1300`, `SKIP_ARM_MS = 900`

- [ ] **Step 1: Add Google Fonts to `frontend/index.html`**

Inside `<head>`, after the existing `<title>`, add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
```

Leave the dark `html { background: #2b2b32 }` flash-prevention style as-is (IDE underlay still uses it).

- [ ] **Step 2: Create `BootIntro.vue` shell with phase API**

Create `frontend/src/components/BootIntro.vue` with this structure (placeholder stage UI is fine; full visual port is Task 2):

```vue
<template>
  <div
    class="boot-intro"
    :class="{
      'is-done': phase === 'steady' || phase === 'op-start' || phase === 'curtain-open',
      'is-op-start': phase === 'op-start' || phase === 'curtain-open',
      'is-curtain-open': phase === 'curtain-open',
    }"
    role="dialog"
    aria-label="JavaTutor 启动序列"
  >
    <div class="stage">
      <!-- Task 2 fills full markup; keep a visible CTA for wiring tests -->
      <button type="button" class="btn-enter" :disabled="phase !== 'steady'" @click="onEnter">
        进入学习终端
      </button>
    </div>
    <div class="veil" aria-hidden="true">
      <div class="veil-panel l"><span class="veil-rail">JAVATUTOR · <b>OP-START</b></span></div>
      <div class="veil-panel r"><span class="veil-rail">MISSION · <b>RUNTIME</b></span></div>
      <div class="op-title">
        <div class="op-kicker">OPERATION START · 行动开始</div>
        <div class="op-word">看得见的<span class="thin">运行时</span></div>
        <div class="op-sub">MISSION · <b>JAVA VISUALIZATION</b> · 拉普兰德 已就位</div>
        <div class="op-rule" aria-hidden="true"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['done'])

const DONE_AT = 5600
const NAV_DELAY = 1900
const CURTAIN_OPEN_MS = 1300
const SKIP_ARM_MS = 900

/** @type {import('vue').Ref<'booting' | 'steady' | 'op-start' | 'curtain-open'>} */
const phase = ref('booting')
let bootTimer = 0
let skipArmTimer = 0
let navTimer = 0
let openTimer = 0
let navArmed = false

function finishToSteady() {
  if (phase.value !== 'booting') return
  phase.value = 'steady'
  // Task 3: also finish CSS animations + lock charge UI
}

function onEnter() {
  if (phase.value !== 'steady' || navArmed) return
  navArmed = true
  phase.value = 'op-start'
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    emit('done')
    return
  }
  navTimer = window.setTimeout(() => {
    phase.value = 'curtain-open'
    openTimer = window.setTimeout(() => emit('done'), CURTAIN_OPEN_MS)
  }, NAV_DELAY)
}

function onSkip() {
  finishToSteady()
}

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    phase.value = 'steady'
    return
  }
  bootTimer = window.setTimeout(finishToSteady, DONE_AT)
  skipArmTimer = window.setTimeout(() => {
    window.addEventListener('pointerdown', onSkip)
    window.addEventListener('keydown', onSkip)
  }, SKIP_ARM_MS)
})

onBeforeUnmount(() => {
  clearTimeout(bootTimer)
  clearTimeout(skipArmTimer)
  clearTimeout(navTimer)
  clearTimeout(openTimer)
  window.removeEventListener('pointerdown', onSkip)
  window.removeEventListener('keydown', onSkip)
})
</script>

<style scoped>
.boot-intro {
  position: fixed;
  inset: 0;
  z-index: 20000;
  overflow: hidden;
  pointer-events: auto;
  /* Temporary shell styles — replaced/expanded in Task 2 */
  background: #e9ebef;
  color: #12161d;
  font-family: 'Archivo', 'Noto Sans SC', system-ui, sans-serif;
}
.stage { position: absolute; inset: 0; display: grid; place-items: center; }
.btn-enter {
  font-family: 'JetBrains Mono', monospace;
  padding: 16px 24px;
  background: #0d9ec4;
  color: #fff;
  border: 0;
  cursor: pointer;
}
.btn-enter:disabled { opacity: 0.4; cursor: default; }
.veil { position: absolute; inset: 0; z-index: 60; pointer-events: none; visibility: hidden; }
.boot-intro.is-op-start .veil { visibility: visible; pointer-events: auto; }
.veil-panel {
  position: absolute; top: 0; bottom: 0; width: 51%;
  background: #12161d;
  transition: transform 0.55s cubic-bezier(0.7, 0, 0.2, 1);
}
.veil-panel.l { left: 0; transform: translateX(-101%); }
.veil-panel.r { right: 0; transform: translateX(101%); }
.boot-intro.is-op-start:not(.is-curtain-open) .veil-panel { transform: translateX(0); }
.boot-intro.is-curtain-open .veil-panel {
  transition-duration: 1.3s;
  transition-timing-function: cubic-bezier(0.7, 0, 0.2, 1);
}
.boot-intro.is-curtain-open .veil-panel.l { transform: translateX(-101%); }
.boot-intro.is-curtain-open .veil-panel.r { transform: translateX(101%); }
.op-title {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  text-align: center; color: #eef1f6; opacity: 0;
}
.boot-intro.is-op-start:not(.is-curtain-open) .op-title {
  animation: op-in 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) 0.62s forwards;
}
.boot-intro.is-curtain-open .op-title {
  opacity: 0;
  transition: opacity 0.45s ease;
  animation: none;
}
@keyframes op-in {
  from { opacity: 0; transform: translate(-50%, -50%) translateY(10px); }
  to { opacity: 1; transform: translate(-50%, -50%) translateY(0); }
}
.op-word .thin { color: #9aa3b2; }
</style>
```

**Class mapping rule (use for all later CSS ports):**

| Source (`javatutor-intro.html`) | Vue |
|--------------------------------|-----|
| `body.done` | `.boot-intro.is-done` |
| `body.op-start` | `.boot-intro.is-op-start` (and use `:not(.is-curtain-open)` where close-only) |
| *(new)* | `.boot-intro.is-curtain-open` |

- [ ] **Step 3: Mount overlay from `App.vue`**

In `frontend/src/App.vue` template, immediately inside the root `.app-shell` (first child), add:

```vue
<BootIntro v-if="showBootIntro" @done="showBootIntro = false" />
```

In `<script setup>`, add import and state:

```js
import BootIntro from './components/BootIntro.vue'
const showBootIntro = ref(true)
```

Do not gate VideoBackground / Live2D / Audio on `showBootIntro` (spec: load normally underneath).

- [ ] **Step 4: Smoke-check the shell**

Run from `frontend/`:

```bash
npm run dev
```

Expected:
1. Page opens with pale overlay covering the IDE
2. After ~5.6s the CTA enables (or sooner if you skip with click/key after ~0.9s)
3. Click CTA → dark panels close → title → panels open over ~1.3s → overlay disappears and IDE is interactive
4. Refresh → overlay appears again

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/src/components/BootIntro.vue frontend/src/App.vue
git commit -m "$(cat <<'EOF'
feat: add BootIntro overlay shell with curtain handoff

Mount a phased fullscreen intro over the IDE and dismiss it after a calm curtain-open, without page navigation.
EOF
)"
```

On Windows PowerShell, if heredoc fails, use:

```powershell
git add frontend/index.html frontend/src/components/BootIntro.vue frontend/src/App.vue
git commit -m "feat: add BootIntro overlay shell with curtain handoff"
```

---

### Task 2: Port full markup + CSS from `javatutor-intro.html`

**Files:**
- Modify: `frontend/src/components/BootIntro.vue`

**Interfaces:**
- Consumes: phase class mapping from Task 1 (`is-done` / `is-op-start` / `is-curtain-open`)
- Produces: visual parity with `javatutor-intro.html` steady + boot acts; CTA still calls `onEnter`

- [ ] **Step 1: Replace `.stage` inner markup with the source stage**

Copy the body contents of `javatutor-intro.html` from the `<div class='stage' …>` through its closing `</div>` (the stage only — not the veil, already present). Adapt to Vue:

1. Change attribute quotes to double quotes.
2. Replace `id="pct"` → `ref="pctEl"` (or keep id and use `getElementById` in Task 3 — pick **refs**: `pctEl`, `fillEl`, `chargeStateEl`).
3. Replace the enter control:

```html
<!-- was: <a class="btn-enter" href="#" id="enter-btn"> -->
<button type="button" class="btn-enter" id="enter-btn" @click="onEnter">
  进入学习终端
  <svg viewBox="0 0 24 24"><path d="M5 19L19 5M19 5H8M19 5v11"/></svg>
</button>
```

4. Keep the existing `.veil` block from Task 1; align its inner copy with the source OP title text (already matching).

Full stage structure to recreate (ids/refs for Task 3):

- `.crt`, `.boot-log` rows, `.slice.s1–s3`, `.charge` (with `pctEl` / `fillEl` / `chargeStateEl`), `.flash`
- rails, ticks, `.scanline`, `.blips`
- `.lockup` (logo with `data-text="JavaTutor"`), `.cta-row` with `.btn-ripple` + button, `.skip-hint`

- [ ] **Step 2: Port CSS with mechanical rewrites**

Copy the entire `<style>` block from `javatutor-intro.html` (lines ~11–515) into the component `<style scoped>` (you may use **unscoped** if `:deep` becomes painful for pseudo-elements — prefer **unscoped** wrapped under `.boot-intro` so Live2D/IDE styles stay safe).

Apply these replacements **before** pasting:

1. Delete `html, body { height: 100%; }` and the bare `body { … }` rules. Instead put background/font/overflow on `.boot-intro`.
2. Replace every `body.done` → `.boot-intro.is-done`
3. Replace every `body.op-start` → `.boot-intro.is-op-start`
4. Prefix bare selectors that were global page chrome so they cannot leak — ensure root is `.boot-intro …` OR keep `scoped` and accept attribute selectors on elements.
5. Keep CSS variables on `.boot-intro` (move `:root { … }` tokens to `.boot-intro { … }`).
6. **Veil close/open** — replace the simple `body.op-start .veil-panel { transform: translateX(0); }` block with:

```css
.boot-intro.is-op-start:not(.is-curtain-open) .veil-panel { transform: translateX(0); }
.boot-intro.is-curtain-open .veil {
  visibility: visible;
  pointer-events: auto;
}
.boot-intro.is-curtain-open .veil-panel {
  transition-duration: 1.3s;
  transition-timing-function: cubic-bezier(0.7, 0, 0.2, 1);
}
.boot-intro.is-curtain-open .veil-panel.l { transform: translateX(-101%); }
.boot-intro.is-curtain-open .veil-panel.r { transform: translateX(101%); }
.boot-intro.is-curtain-open .op-title {
  opacity: 0;
  transition: opacity 0.45s ease;
  animation: none;
}
```

7. Update reduced-motion media query the same way (`body.done` → `.boot-intro.is-done`).
8. Ensure `.boot-intro { z-index: 20000; position: fixed; inset: 0; overflow: hidden; }`.
9. Style `.btn-enter` as a `<button>`: reset `border: 0; cursor: pointer; font: inherit;` while keeping clip-path look.

- [ ] **Step 3: Visual parity check**

Run `npm run dev`. Compare side-by-side with opening `javatutor-intro.html` directly in a browser (file or static serve).

Expected:
- Same 5.6s boot acts (CRT, log, charge frame, logo RGB split)
- Steady rails / scanline / ripple CTA
- Fonts match (Archivo / mono)
- Overlay still covers IDE; no IDE chrome peeks above z-index 20000

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/components/BootIntro.vue
git commit -m "feat: port boot intro markup and styles into BootIntro"
```

---

### Task 3: Charge counter + skip/finish animation helpers

**Files:**
- Modify: `frontend/src/components/BootIntro.vue` (`<script setup>`)

**Interfaces:**
- Consumes: `pctEl`, `fillEl`, `chargeStateEl` template refs; phase API from Task 1
- Produces: `finishToSteady()` locks charge UI at 100% and finishes in-flight CSS animations on the intro root

- [ ] **Step 1: Add template refs on charge UI**

On the charge percentage / fill / state nodes:

```html
<span ref="pctEl">0</span>
<div class="fill" ref="fillEl"></div>
<span class="on" ref="chargeStateEl">CHARGING</span>
```

In script:

```js
const pctEl = ref(null)
const fillEl = ref(null)
const chargeStateEl = ref(null)
```

- [ ] **Step 2: Expand `finishToSteady` and boot rAF charge ticker**

Replace the shell `finishToSteady` / `onMounted` boot logic with:

```js
function lockChargeComplete() {
  if (pctEl.value) pctEl.value.textContent = '100'
  if (fillEl.value) fillEl.value.style.width = '100%'
  if (chargeStateEl.value) chargeStateEl.value.textContent = 'READY'
}

function finishToSteady() {
  if (phase.value !== 'booting') return
  phase.value = 'steady'
  lockChargeComplete()
  const root = document.querySelector('.boot-intro')
  const anims = root && root.getAnimations ? root.getAnimations({ subtree: true }) : []
  for (const a of anims) {
    try { a.finish() } catch (_) { /* ignore unsupported */ }
  }
  window.removeEventListener('pointerdown', onSkip)
  window.removeEventListener('keydown', onSkip)
}

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    phase.value = 'steady'
    lockChargeComplete()
    return
  }

  let t0 = null
  const START = 2100
  const DUR = 1560
  let raf = 0
  function tick(now) {
    if (phase.value !== 'booting') return
    if (t0 === null) t0 = now
    const elapsed = now - t0
    const p = Math.min(1, Math.max(0, (elapsed - START) / DUR))
    const v = Math.round(p * 100)
    if (pctEl.value) pctEl.value.textContent = String(v)
    if (fillEl.value) fillEl.value.style.width = v + '%'
    if (v >= 100 && chargeStateEl.value) chargeStateEl.value.textContent = 'READY'
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  bootTimer = window.setTimeout(finishToSteady, DONE_AT)
  skipArmTimer = window.setTimeout(() => {
    window.addEventListener('pointerdown', onSkip)
    window.addEventListener('keydown', onSkip)
  }, SKIP_ARM_MS)

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf)
  })
})
```

**Important:** merge the `cancelAnimationFrame` into the existing `onBeforeUnmount` from Task 1 (one hook only). Do not register two `onBeforeUnmount` callbacks that fight each other — keep a single cleanup that clears timers, listeners, and `raf`.

**Skip vs CTA:** `onSkip` must ignore events whose target is the enter button once in `steady`, and must not run during `op-start` / `curtain-open`. Update:

```js
function onSkip(e) {
  if (phase.value !== 'booting') return
  // avoid treating the eventual CTA click as a skip if timing overlaps
  finishToSteady()
}
```

Also: while `booting`, the global `pointerdown` skip will fire on any click — matching source HTML. After `steady`, remove those listeners inside `finishToSteady` (already shown).

- [ ] **Step 3: Prevent double-skip racing CTA**

In `onEnter`, call `finishToSteady()` first only if still booting is impossible (CTA disabled until steady). Keep:

```js
function onEnter() {
  if (phase.value !== 'steady' || navArmed) return
  navArmed = true
  phase.value = 'op-start'
  // …
}
```

- [ ] **Step 4: Manual verify charge + skip**

Run `npm run dev`:

1. Watch charge % climb ~2.1s→3.66s to 100, state `READY`
2. Click during boot (after 0.9s) → jumps to steady, bar at 100%, CTA works
3. Key during boot → same
4. CTA → full OP path still works

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/BootIntro.vue
git commit -m "feat: restore boot charge ticker and skip-to-steady behavior"
```

---

### Task 4: App polish + reduced-motion path + final QA

**Files:**
- Modify: `frontend/src/components/BootIntro.vue` (if gaps found)
- Modify: `frontend/src/App.vue` only if mount placement needs tweak
- Modify: `docs/superpowers/specs/2026-08-06-boot-intro-integration-design.md` — set Status to `Approved`

**Interfaces:**
- Consumes: full BootIntro from Tasks 1–3
- Produces: behavior matching spec success criteria 1–6

- [ ] **Step 1: Update spec status line**

In the design doc header, change:

```md
**Status:** Approved
```

- [ ] **Step 2: Reduced-motion CTA path check**

In DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, reload:

Expected:
- Lands directly in steady (no CRT/log wait)
- CTA click immediately `emit('done')` (Task 1 already does this) — overlay gone, IDE usable
- No stuck veil

- [ ] **Step 3: Full manual checklist (from spec)**

| # | Check | Pass? |
|---|-------|-------|
| 1 | Cold load: ~5.6s boot → steady → CTA → close → title → ~1.3s open → IDE | |
| 2 | Refresh replays intro from start | |
| 3 | Skip (key/click after ~0.9s) → steady only; CTA still required | |
| 4 | Reduced motion path works | |
| 5 | During overlay, Live2D/IDE not clickable; after dismiss, they are | |
| 6 | Curtain-open feels calm (not snappy); no flash on unmount | |
| 7 | Narrow viewport: no horizontal scroll; side rails may hide per CSS | |

If curtain feels fast, raise `CURTAIN_OPEN_MS` to `1400` and CSS `transition-duration` to `1.4s` together (keep JS and CSS in sync).

- [ ] **Step 4: Build check**

```bash
cd frontend
npm run build
```

Expected: Vite build succeeds with no errors referencing `BootIntro`.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/BootIntro.vue frontend/src/App.vue docs/superpowers/specs/2026-08-06-boot-intro-integration-design.md
git commit -m "chore: finalize boot intro integration QA and spec status"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Every visit / no storage skip | Task 1 (`showBootIntro = true` always) |
| Same-page overlay, no router/redirect | Tasks 1–3 (`emit('done')` only) |
| Full OP close → title → open 1.2–1.4s | Task 1 shell + Task 2 CSS |
| Underlay media loads normally | Task 1 App mount (no gating) |
| Port visuals from HTML | Task 2 |
| Scope classes off `body` | Tasks 1–2 mapping table |
| Skip to steady only | Task 3 |
| Charge ticker | Task 3 |
| Reduced motion | Tasks 1 + 4 |
| Keep `javatutor-intro.html` | No delete task |
| z-index ≥ 20000 | Task 1 / 2 |
| Manual success criteria | Task 4 |

**Placeholder scan:** none intentional. CSS port is mechanical from the source file rather than inlined 500 lines here — implementer must copy from `javatutor-intro.html` with the listed rewrites.

**Type consistency:** `phase` union, `emit('done')`, `CURTAIN_OPEN_MS = 1300`, class names `is-done` / `is-op-start` / `is-curtain-open` used consistently across tasks.
