<script setup lang="ts">
import { computed, ref } from 'vue'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import type { Size, Point } from 'vue-advanced-cropper'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

type RatioKey = 'free' | '1:1' | '4:3' | '16:9'
const RATIOS: Record<Exclude<RatioKey, 'free'>, number> = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9 }
const ratioOptions: { value: RatioKey; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
]

// Resets to 'free' each time crop mode is (re-)entered — CropStage remounts fresh.
const ratio = ref<RatioKey>('free')
const aspectRatio = computed(() => (ratio.value === 'free' ? undefined : RATIOS[ratio.value]))

// Restore the current crop (or the whole image) when re-entering crop mode.
function defaultSize({ imageSize }: { imageSize: Size }): Size {
  const c = store.edit.crop
  return c ? { width: c.width, height: c.height } : imageSize
}
function defaultPosition(): Point {
  const c = store.edit.crop
  return { left: c?.x ?? 0, top: c?.y ?? 0 }
}

function apply() {
  const result = cropperRef.value?.getResult()
  if (!result) return
  const { left, top, width, height } = result.coordinates
  store.applyCrop({ x: left, y: top, width, height })
}

defineExpose({ apply })
</script>

<template>
  <div class="crop-stage">
    <div class="ratio-bar">
      <v-btn-toggle v-model="ratio" mandatory divided density="compact">
        <v-btn
          v-for="r in ratioOptions"
          :key="r.value"
          :value="r.value"
          :text="r.label"
          size="small"
        />
      </v-btn-toggle>
    </div>
    <Cropper
      v-if="store.source"
      ref="cropperRef"
      class="cropper"
      :src="store.source.url"
      :default-size="defaultSize"
      :default-position="defaultPosition"
      :stencil-props="{ aspectRatio }"
      background-class="cropper-bg"
    />
  </div>
</template>

<style scoped>
.crop-stage {
  position: relative;
  width: 100%;
  height: 100%;
}
.cropper {
  width: 100%;
  height: 100%;
}
:deep(.cropper-bg) {
  background: transparent;
}
.ratio-bar {
  position: absolute;
  z-index: 1;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px;
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.92);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
</style>
