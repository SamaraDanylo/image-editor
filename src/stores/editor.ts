import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { EditDocument, EditState, FilterMode, Rect, SliderKey } from '../core/types'
import { cloneEditState, createNeutralState, editStatesEqual, hasEdits, toOps } from '../core/ops'
import { toCssFilter } from '../core/cssFilter'
import { canvasToBlob, renderOps } from '../core/render'
import { downloadBlob, withSuffix } from '../core/download'

export type Mode = 'view' | 'crop'
export type ExportFormat = 'png' | 'jpeg' | 'webp'

const FORMAT_INFO: Record<ExportFormat, { mime: string; ext: string }> = {
  png: { mime: 'image/png', ext: 'png' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  webp: { mime: 'image/webp', ext: 'webp' },
}

export interface SourceImage {
  // Immutable decoded pixels — the source of truth for all rendering.
  bitmap: ImageBitmap
  // Object URL of the file, used as an <img> src (e.g. by the cropper).
  url: string
  filename: string
  width: number
  height: number
}

// Hard per-side canvas limit in mainstream browsers.
const MAX_SIDE = 16384

// Undo history: op-model snapshots are tiny, but cap growth anyway.
const HISTORY_LIMIT = 50
// A slider drag coalesces into one history step if ticks keep arriving within this window.
const ADJUST_DEBOUNCE_MS = 400

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const useEditorStore = defineStore('editor', () => {
  // shallowRef: an ImageBitmap must not be wrapped in a deep reactive proxy.
  const source = shallowRef<SourceImage | null>(null)

  const edit = ref<EditState>(createNeutralState())

  const past = ref<EditState[]>([])
  const future = ref<EditState[]>([])
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  // A slider drag in progress: the state captured just before the first tick of the burst.
  let pendingKey: SliderKey | null = null
  let pendingBefore: EditState | null = null
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  // True while the user holds "compare": preview shows original colors.
  const comparing = ref(false)
  const mode = ref<Mode>('view')
  const exporting = ref(false)
  const error = ref<string | null>(null)
  const exportFormat = ref<ExportFormat>('png')
  const exportQuality = ref(100)

  const hasImage = computed(() => source.value !== null)
  const isDirty = computed(() => hasEdits(edit.value))
  const ops = computed(() => toOps(edit.value))

  const cssFilter = computed(() => toCssFilter(edit.value))
  const previewCssFilter = computed(() => (comparing.value ? 'none' : cssFilter.value))

  // --- source lifecycle ---

  async function loadImage(file: File) {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      error.value = `"${file.name}" is not a supported image file`
      return
    }
    try {
      // Applies EXIF orientation on decode, so crop coords match what the user sees.
      const bitmap = await createImageBitmap(file)
      if (bitmap.width > MAX_SIDE || bitmap.height > MAX_SIDE) {
        bitmap.close()
        error.value = `Image is too large — max ${MAX_SIDE}px per side`
        return
      }
      disposeSource()
      source.value = {
        bitmap,
        url: URL.createObjectURL(file),
        filename: file.name,
        width: bitmap.width,
        height: bitmap.height,
      }
      edit.value = createNeutralState()
      mode.value = 'view'
      cancelPendingAdjust()
      past.value = []
      future.value = []
    } catch {
      error.value = `Could not decode "${file.name}" — the file may be corrupted`
    }
  }

  function disposeSource() {
    if (!source.value) return
    source.value.bitmap.close()
    URL.revokeObjectURL(source.value.url)
    source.value = null
  }

  // --- history ---

  function pushHistory(before: EditState) {
    past.value.push(before)
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    future.value = []
  }

  // Discards the in-progress slider burst, if any, without committing it to history.
  function cancelPendingAdjust() {
    if (pendingTimer !== null) clearTimeout(pendingTimer)
    pendingTimer = null
    pendingKey = null
    pendingBefore = null
  }

  // Commits (or discards, if a no-op) the in-progress slider burst, if any.
  function flushPendingAdjust() {
    const before = pendingBefore
    cancelPendingAdjust()
    if (before && !editStatesEqual(before, edit.value)) pushHistory(before)
  }

  // Wraps a discrete mutation (one click/apply, not a drag) as a single history step.
  function withHistory(mutate: () => void) {
    flushPendingAdjust()
    const before = cloneEditState(edit.value)
    mutate()
    if (!editStatesEqual(before, edit.value)) pushHistory(before)
  }

  function undo() {
    flushPendingAdjust()
    if (!past.value.length) return
    future.value.push(cloneEditState(edit.value))
    edit.value = past.value.pop()!
  }

  function redo() {
    flushPendingAdjust()
    if (!future.value.length) return
    past.value.push(cloneEditState(edit.value))
    edit.value = future.value.pop()!
  }

  // --- edits ---

  function setAdjustment(key: SliderKey, value: number) {
    if (pendingKey !== key) {
      flushPendingAdjust()
      pendingBefore = cloneEditState(edit.value)
      pendingKey = key
    }
    if (pendingTimer !== null) clearTimeout(pendingTimer)
    pendingTimer = setTimeout(flushPendingAdjust, ADJUST_DEBOUNCE_MS)

    edit.value.adjustments[key] = clamp(Math.round(value), 0, 200)
  }

  function resetAdjustment(key: SliderKey) {
    withHistory(() => {
      edit.value.adjustments[key] = 100
    })
  }

  function setFilter(mode: FilterMode) {
    withHistory(() => {
      edit.value.adjustments.filter = mode
    })
  }

  function resetAll() {
    withHistory(() => {
      edit.value = createNeutralState()
    })
  }

  function enterCrop() {
    if (hasImage.value) mode.value = 'crop'
  }

  function cancelCrop() {
    mode.value = 'view'
  }

  // rect is expected in original-image pixel coordinates.
  function applyCrop(rect: Rect) {
    const w = Math.round(source.value?.width ?? 0)
    const h = Math.round(source.value?.height ?? 0)
    const x = clamp(Math.round(rect.x), 0, w)
    const y = clamp(Math.round(rect.y), 0, h)
    const width = clamp(Math.round(rect.width), 1, w - x)
    const height = clamp(Math.round(rect.height), 1, h - y)
    withHistory(() => {
      edit.value.crop = { x, y, width, height }
    })
    mode.value = 'view'
  }

  function clearCrop() {
    withHistory(() => {
      edit.value.crop = null
    })
  }

  function setComparing(value: boolean) {
    comparing.value = value
  }

  function setExportFormat(format: ExportFormat) {
    exportFormat.value = format
  }

  function setExportQuality(value: number) {
    exportQuality.value = clamp(Math.round(value), 1, 100)
  }

  async function exportImage() {
    if (!source.value || exporting.value) return
    exporting.value = true
    try {
      const { mime, ext } = FORMAT_INFO[exportFormat.value]
      const quality = exportFormat.value === 'png' ? undefined : exportQuality.value / 100
      const canvas = renderOps(source.value.bitmap, ops.value)
      const blob = await canvasToBlob(canvas, mime, quality)
      downloadBlob(blob, withSuffix(source.value.filename, '-edited', ext))

      const doc: EditDocument = {
        version: 1,
        source: {
          filename: source.value.filename,
          width: source.value.width,
          height: source.value.height,
        },
        ops: ops.value,
      }
      const jsonBlob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
      downloadBlob(jsonBlob, withSuffix(source.value.filename, '-edited', 'json'))
    } catch {
      error.value = 'Export failed — the image may be too large for this browser'
    } finally {
      exporting.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    source,
    edit,
    comparing,
    mode,
    exporting,
    error,
    exportFormat,
    exportQuality,
    hasImage,
    isDirty,
    ops,
    cssFilter,
    previewCssFilter,
    canUndo,
    canRedo,
    loadImage,
    setAdjustment,
    resetAdjustment,
    setFilter,
    resetAll,
    enterCrop,
    cancelCrop,
    applyCrop,
    clearCrop,
    setComparing,
    setExportFormat,
    setExportQuality,
    exportImage,
    clearError,
    undo,
    redo,
  }
})
