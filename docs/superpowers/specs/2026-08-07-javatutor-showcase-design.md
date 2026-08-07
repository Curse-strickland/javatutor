# JavaTutor Product Showcase — Design Spec

**Date:** 2026-08-07  
**Status:** Implemented (v3 concrete feature tour)  
**Artifact:** `javatutor-showcase.html` (repo root)

## Goal

One reading experience. Story opens; then **walk real product surfaces one by one** (playback, line highlight, stack, heap, structure canvas, control flow, console, AI, test mode, classics). Prefer concrete UI nouns over abstract capability adjectives.

## Locked decisions

| Topic | Choice |
|-------|--------|
| Delivery | Standalone static HTML at repo root |
| Language | CN/EN mix |
| Visual | Dark, sparse tokens (`bg/text/muted/line/accent` + spacing) |
| Hero | Giant `JAVA / Tutor` + one line + Scroll; Bubble Sort canvas background; no product pitch |
| Tech reveal | No AST / instrumentation language before the moat screen |
| Density | Uneven: quiet origin → contrast → story → black intro → moat → few moments → grid → close |
| CTA | One text link under closing; minimal footer |
| Media | Placeholders; real GIFs later |

## Narrative spine

```
Hero (living sort)
→ Origin (one human sentence)
→ Problem (static vs alive)
→ Story (math / physics / chemistry / Why?)
→ Introducing (black cut)
→ Real. Not Simulated. (+ one visual; moat line)
→ 3 moments (one line + one media each)
→ Algorithm grid (no copy)
→ Closing + Enter
```

Soul line: *学习程序时，我们一直在脑补程序运行。*  
Moat line: *We don't animate code. We visualize execution.*

## Explicit cuts (vs v1)

- Design-system token sprawl, LOG chrome, side rails, sticky archive bar
- Hero pipeline / Run control / early tech vocabulary
- Project Status, AI compare diagrams, Rhodes mega CTA/footer
- Uniform fade-in on every block

## Open follow-ups

- Swap placeholders for product media (esp. one long runtime take for the moat screen)
- Optional: hand-drawn Trace sketch as a quiet beat
- Point Enter link at real deploy URL
