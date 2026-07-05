# Image Editor

Browser-based, non-destructive image editor. Vue 3 + Vuetify 3 + Pinia + TypeScript.

## Getting started

```
npm i
npm run dev
```

Other scripts: `npm run build` (typecheck + production build), `npm run typecheck`, `npm run lint`, `npm run format`.

## Required scope (ТЗ)

- [x] Load image via upload
- [x] Crop
- [x] Live brightness / contrast / saturation sliders
- [x] Reset / view original (non-destructive)
- [x] Export by download

## Architecture — "one op model, two interpreters"

Single source of truth: a list of ops (`Op[]`, [types.ts](src/core/types.ts)) derived from the Pinia `EditState` ([stores/editor.ts](src/stores/editor.ts), [ops.ts:47](src/core/ops.ts:47)). The original `ImageBitmap` is never mutated — everything downstream is derived from it.

Two interpreters consume the same ops:
- [cssFilter.ts](src/core/cssFilter.ts) — compiles ops to a CSS `filter` string, applied to the preview `<canvas>`. GPU-evaluated, used on every slider tick.
- [pixel.ts](src/core/pixel.ts) + [render.ts](src/core/render.ts) — replays the same [CSS Filter Effects](https://drafts.fxtf.org/filter-effects/) formulas (brightness/contrast/saturate/grayscale/sepia) as per-pixel 8-bit math over `ImageData`, applied to the untouched original bitmap for export. The spec is implemented twice on purpose, so preview and export match visually.

Op order is geometry (crop) → color, always. [render.ts:14](src/core/render.ts:14) crops via `drawImage` first, then runs the color kernels over the resulting `ImageData`.

Crop rectangle is stored in **original-image pixel coordinates**, not viewport pixels — keeps re-cropping and export coordinate-consistent regardless of on-screen scale.

State ownership: `setAdjustment` / `resetAdjustment` / `setFilter` / `enterCrop` / `applyCrop` in [stores/editor.ts](src/stores/editor.ts) are the single mutation path, shared by desktop (`AdjustPanel`) and mobile (`BottomControls.vue`) — no duplicated state, just different UI shells gated on `useDisplay().smAndDown`.

## Bonuses (ТЗ, optional but scored)

- **Filter** — grayscale/sepia, modeled as ops alongside brightness/contrast/saturation.
- **JSON export of ops** — export produces an `EditDocument` (`version`, `source: { filename, width, height }`, `ops: Op[]`, see [types.ts:33](src/core/types.ts:33)) alongside the image. Replaying `ops` over the original source through `renderOps` reproduces the exported image exactly — it's the same function the export path itself calls.

## Additional / extras (beyond the ТЗ)

- **Undo/redo** — `past`/`future` snapshot stacks of `EditState`. Slider drags debounce-coalesce into one history step; discrete actions (reset, filter, crop) each push one step; reset is itself undoable.
- **Aspect ratio lock** (1:1 / 4:3 / 16:9 / free) — local UI state in [CropStage.vue](src/components/CropStage.vue), intentionally not persisted to the op-model.
- **Export format & quality** — PNG/JPEG/WebP with a quality slider, since a lossless PNG export of a compressed source is much larger than the original.
- **Keyboard shortcuts** — `Enter`/`Esc` in crop mode, `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` outside it.
- **Hold-to-compare** with the original, and a mobile-responsive layout ([BottomControls.vue](src/components/BottomControls.vue) — one slider visible at a time).

## Known limitations / possible next steps

See [BACKLOG.md](BACKLOG.md)'s "Potential improvements" section — crop-mode flicker on entering crop, an EXIF-orientation edge case, `revokeObjectURL` timing, a11y for the compare gesture, and a manual QA checklist. These are ideas for a future pass, not gaps in the required scope.
