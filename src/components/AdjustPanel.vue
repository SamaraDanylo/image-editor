<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import type { FilterMode, SliderKey } from '../core/types'

const store = useEditorStore()

// Adjustments don't preview while cropping (the cropper shows the raw image,
// not the CSS-filtered canvas), so disable them to avoid a dead-looking UI.
const disabled = computed(() => !store.hasImage || store.mode === 'crop')

const controls: { key: SliderKey; label: string }[] = [
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'saturation', label: 'Saturation' },
]

const filters: { value: FilterMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'sepia', label: 'Sepia' },
]
</script>

<template>
  <div>
    <div class="text-overline text-medium-emphasis">Adjust</div>
    <template v-for="control in controls" :key="control.key">
      <div class="d-flex align-center justify-space-between mt-1">
        <span class="text-body-2">{{ control.label }}</span>
        <div class="d-flex align-center ga-1">
          <span class="text-caption text-medium-emphasis value-label">
            {{ store.edit.adjustments[control.key] }}
          </span>
          <v-btn
            icon="mdi-restore"
            size="x-small"
            variant="text"
            density="compact"
            :disabled="disabled"
            :title="`Reset ${control.label.toLowerCase()}`"
            :style="{
              visibility: store.edit.adjustments[control.key] !== 100 ? 'visible' : 'hidden',
            }"
            @click="store.resetAdjustment(control.key)"
          />
        </div>
      </div>
      <v-slider
        :model-value="store.edit.adjustments[control.key]"
        :disabled="disabled"
        min="0"
        max="200"
        step="1"
        hide-details
        density="compact"
        @update:model-value="store.setAdjustment(control.key, $event)"
      />
    </template>

    <div class="text-overline text-medium-emphasis mt-4">Filter</div>
    <v-btn-toggle
      :model-value="store.edit.adjustments.filter"
      :disabled="disabled"
      mandatory
      divided
      density="compact"
      class="mt-1"
      @update:model-value="store.setFilter($event)"
    >
      <v-btn v-for="f in filters" :key="f.value" :value="f.value" :text="f.label" size="small" />
    </v-btn-toggle>
  </div>
</template>

<style scoped>
/* fixed width so the value doesn't shift the layout while dragging */
.value-label {
  min-width: 28px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
