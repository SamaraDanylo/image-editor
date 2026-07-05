<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useEditorStore } from '../stores/editor'
import { useImagePicker } from '../composables/useImagePicker'
import CropStage from './CropStage.vue'

const store = useEditorStore()
const { openImageDialog } = useImagePicker()
const { smAndDown } = useDisplay()

// Matches view mode's PAD gap; bottom gets extra clearance for .crop-bar.
const cropLayerStyle = computed(() => {
  const side = smAndDown.value ? 12 : 24
  const bottom = smAndDown.value ? 72 : 88
  return { inset: `${side}px ${side}px ${bottom}px ${side}px` }
})

const stageToolbarStyle = computed(() => {
  const gap = smAndDown.value ? '8px' : '16px'
  return { top: gap, right: gap }
})

const stageRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const cropStageRef = ref<InstanceType<typeof CropStage> | null>(null)

const PAD = 24 // px gap around the fitted preview

let raf = 0
// Resize can fire in bursts — throttle to one draw per frame.
function throttledDraw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(draw)
}

// Draws the fitted image (geometry only). Color edits are a CSS filter on the
// canvas element, so slider changes never trigger a redraw.
function draw() {
  const stage = stageRef.value
  const canvas = canvasRef.value
  const src = store.source
  if (!stage || !canvas || !src) return

  // In view mode the canvas shows the cropped region; source stays untouched.
  const crop = store.edit.crop ?? { x: 0, y: 0, width: src.width, height: src.height }

  const availW = Math.max(stage.clientWidth - PAD * 2, 50)
  const availH = Math.max(stage.clientHeight - PAD * 2, 50)
  const scale = Math.min(availW / crop.width, availH / crop.height, 1) // never upscale past 100%
  const cssW = Math.max(Math.round(crop.width * scale), 1)
  const cssH = Math.max(Math.round(crop.height * scale), 1)
  // HiDPI-crisp, but never allocate more pixels than the region has.
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.min(Math.round(cssW * dpr), crop.width)
  canvas.height = Math.min(Math.round(cssH * dpr), crop.height)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    src.bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
}

// flush: 'post' draws right after the canvas is (re)mounted on a state/mode change.
watch([() => store.source, () => store.edit.crop, () => store.mode], () => draw(), {
  flush: 'post',
})

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  resizeObserver = new ResizeObserver(throttledDraw)
  if (stageRef.value) resizeObserver.observe(stageRef.value)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeydown)
})

// Enter/Esc only act while actively cropping; listener is attached/removed with mode.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    cropStageRef.value?.apply()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    store.cancelCrop()
  }
}

watch(
  () => store.mode,
  (m) => {
    if (m === 'crop') window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
  { immediate: true },
)
</script>

<template>
  <div ref="stageRef" class="stage">
    <div v-if="!store.hasImage" class="text-center">
      <v-icon icon="mdi-image-plus-outline" size="64" class="text-medium-emphasis" />
      <div class="text-h6 mt-4">No image loaded</div>
      <div class="text-body-2 text-medium-emphasis mt-1">
        Drop an image anywhere or use the button below
      </div>
      <v-btn
        class="mt-6"
        color="primary"
        prepend-icon="mdi-upload"
        text="Choose image"
        @click="openImageDialog"
      />
    </div>

    <template v-else-if="store.mode === 'crop'">
      <div class="crop-layer" :style="cropLayerStyle">
        <CropStage ref="cropStageRef" />
      </div>
      <div class="crop-bar">
        <v-btn variant="text" prepend-icon="mdi-close" text="Cancel" @click="store.cancelCrop()" />
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-check"
          text="Apply crop"
          @click="cropStageRef?.apply()"
        />
      </div>
    </template>

    <canvas v-else ref="canvasRef" class="preview" :style="{ filter: store.previewCssFilter }" />

    <div
      v-if="store.hasImage && store.mode === 'view'"
      class="stage-toolbar"
      :style="stageToolbarStyle"
    >
      <v-btn
        icon="mdi-eye-outline"
        size="small"
        variant="text"
        title="Hold to compare with original"
        :disabled="!store.isDirty"
        @pointerdown="store.setComparing(true)"
        @pointerup="store.setComparing(false)"
        @pointerleave="store.setComparing(false)"
        @pointercancel="store.setComparing(false)"
      />
      <v-btn
        icon="mdi-restore"
        size="small"
        variant="text"
        title="Reset all edits"
        :disabled="!store.isDirty"
        @click="store.resetAll()"
      />
      <v-btn
        icon="mdi-undo"
        size="small"
        variant="text"
        title="Undo"
        :disabled="!store.canUndo"
        @click="store.undo()"
      />
      <v-btn
        icon="mdi-redo"
        size="small"
        variant="text"
        title="Redo"
        :disabled="!store.canRedo"
        @click="store.redo()"
      />
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview {
  border-radius: 2px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.45);
  /* checkerboard behind transparent pixels */
  background: repeating-conic-gradient(#2e2e2e 0% 25%, #262626 0% 50%) 0 0 / 16px 16px;
}

.stage-toolbar {
  position: absolute;
  z-index: 1;
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.92);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

/* Bounds the cropper to the stage so a large image can't blow past the viewport
   and push the crop-bar off-screen. Inset value is set inline (see cropLayerStyle). */
.crop-layer {
  position: absolute;
}

.crop-bar {
  position: absolute;
  z-index: 1;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.92);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
</style>
