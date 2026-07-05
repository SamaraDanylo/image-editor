<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../stores/editor'
import type { FilterMode, SliderKey } from '../core/types'

const store = useEditorStore()

const tools: { key: SliderKey; label: string; icon: string }[] = [
  { key: 'brightness', label: 'Brightness', icon: 'mdi-brightness-6' },
  { key: 'contrast', label: 'Contrast', icon: 'mdi-contrast-circle' },
  { key: 'saturation', label: 'Saturation', icon: 'mdi-water-outline' },
]

const filters: { value: FilterMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'sepia', label: 'Sepia' },
]

// One parameter is tuned at a time. null = only the tool row shows.
const selected = ref<SliderKey | 'filter' | null>(null)

const selectedLabel = computed(
  () =>
    tools.find((t) => t.key === selected.value)?.label ??
    (selected.value === 'filter' ? 'Filter' : ''),
)

// Bridges the active tool's slider to the same store action the desktop panel uses.
const value = computed({
  get: () => (isSliderKey(selected.value) ? store.edit.adjustments[selected.value] : 100),
  set: (v: number) => {
    if (isSliderKey(selected.value)) store.setAdjustment(selected.value, v)
  },
})

function isSliderKey(key: typeof selected.value): key is SliderKey {
  return key !== null && key !== 'filter'
}

function toggle(key: SliderKey | 'filter') {
  selected.value = selected.value === key ? null : key
}
</script>

<template>
  <!-- app: registers in the Vuetify layout so v-main shrinks to fit and the preview never hides behind it. -->
  <v-footer app color="surface" class="bottom-controls pa-0">
    <div class="w-100">
      <div v-if="isSliderKey(selected)" class="d-flex align-center ga-2 px-4 py-2">
        <span class="text-caption text-medium-emphasis strip-label">{{ selectedLabel }}</span>
        <v-slider
          v-model="value"
          min="0"
          max="200"
          step="1"
          hide-details
          density="compact"
          class="flex-grow-1"
        />
        <span class="text-caption text-medium-emphasis strip-value">{{ value }}</span>
        <v-btn
          icon="mdi-restore"
          size="small"
          variant="text"
          density="comfortable"
          :disabled="value === 100"
          @click="selected && isSliderKey(selected) && store.resetAdjustment(selected)"
        />
      </div>

      <div v-else-if="selected === 'filter'" class="d-flex align-center px-4 py-2">
        <v-btn-toggle
          :model-value="store.edit.adjustments.filter"
          mandatory
          divided
          density="compact"
          class="flex-grow-1"
          @update:model-value="store.setFilter($event)"
        >
          <v-btn
            v-for="f in filters"
            :key="f.value"
            :value="f.value"
            :text="f.label"
            size="small"
            class="flex-grow-1"
          />
        </v-btn-toggle>
      </div>

      <div class="tool-row d-flex align-center py-1">
        <v-btn
          stacked
          variant="text"
          size="small"
          prepend-icon="mdi-crop"
          :text="store.edit.crop ? 'Recrop' : 'Crop'"
          :active="!!store.edit.crop"
          @click="store.enterCrop()"
        />
        <v-btn
          v-for="tool in tools"
          :key="tool.key"
          stacked
          variant="text"
          size="small"
          :prepend-icon="tool.icon"
          :text="tool.label"
          :active="selected === tool.key"
          @click="toggle(tool.key)"
        />
        <v-btn
          stacked
          variant="text"
          size="small"
          prepend-icon="mdi-contrast-box"
          text="Filter"
          :active="selected === 'filter'"
          @click="toggle('filter')"
        />
      </div>
    </div>
  </v-footer>
</template>

<style scoped>
.bottom-controls {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.strip-label {
  width: 72px;
}
/* Equal-width tiles that always fit the row — no horizontal overflow on narrow phones. */
.tool-row :deep(.v-btn) {
  flex: 1 1 0;
  min-width: 0;
  padding-inline: 2px;
}
.tool-row :deep(.v-btn__content) {
  font-size: 0.625rem;
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* fixed width so the value doesn't shift the slider while dragging */
.strip-value {
  width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
