<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import AdjustPanel from './components/AdjustPanel.vue'
import BottomControls from './components/BottomControls.vue'
import EditorStage from './components/EditorStage.vue'
import UploadDropzone from './components/UploadDropzone.vue'
import { useEditorStore, type ExportFormat } from './stores/editor'
import { useImagePicker } from './composables/useImagePicker'

const store = useEditorStore()
const { openImageDialog } = useImagePicker()
const { smAndDown } = useDisplay()

const exportFormats: { value: ExportFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
]

// Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z, only outside crop mode (crop has its own Enter/Esc).
function onKeydown(e: KeyboardEvent) {
  if (store.mode !== 'view') return
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
  e.preventDefault()
  if (e.shiftKey) store.redo()
  else store.undo()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <v-app>
    <v-app-bar flat border density="comfortable" class="px-2">
      <template #prepend>
        <v-icon icon="mdi-image-edit-outline" color="primary" class="ml-2" />
      </template>
      <v-app-bar-title class="text-subtitle-1 font-weight-medium flex-0-0">
        Image Editor
      </v-app-bar-title>
      <v-chip
        v-if="store.source && !smAndDown"
        size="small"
        variant="tonal"
        class="ml-4"
        prepend-icon="mdi-image-outline"
      >
        {{ store.source.filename }} · {{ store.source.width }} × {{ store.source.height }}
      </v-chip>

      <v-spacer />

      <v-btn icon="mdi-folder-open-outline" title="Open image" @click="openImageDialog" />
      <v-btn icon="mdi-tune" title="Export format & quality" :disabled="!store.hasImage">
        <v-icon icon="mdi-tune" />
        <v-menu activator="parent" :close-on-content-click="false">
          <v-card class="pa-4" min-width="240">
            <div class="text-overline text-medium-emphasis">Export format</div>
            <v-btn-toggle
              :model-value="store.exportFormat"
              mandatory
              divided
              density="compact"
              class="mt-1"
              @update:model-value="store.setExportFormat($event)"
            >
              <v-btn
                v-for="f in exportFormats"
                :key="f.value"
                :value="f.value"
                :text="f.label"
                size="small"
              />
            </v-btn-toggle>

            <template v-if="store.exportFormat !== 'png'">
              <div class="d-flex align-center justify-space-between mt-4">
                <span class="text-body-2">Quality</span>
                <span class="text-caption text-medium-emphasis">{{ store.exportQuality }}</span>
              </div>
              <v-slider
                :model-value="store.exportQuality"
                min="1"
                max="100"
                step="1"
                hide-details
                density="compact"
                @update:model-value="store.setExportQuality($event)"
              />
            </template>
          </v-card>
        </v-menu>
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        title="Export"
        :icon="smAndDown"
        :size="smAndDown ? 'small' : 'default'"
        :prepend-icon="smAndDown ? undefined : 'mdi-download'"
        :class="smAndDown ? 'mx-2' : 'mx-3'"
        :disabled="!store.hasImage || store.mode === 'crop'"
        :loading="store.exporting"
        @click="store.exportImage()"
      >
        <v-icon v-if="smAndDown" icon="mdi-download" />
        <template v-else>Export</template>
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer v-if="!smAndDown" location="right" permanent width="320">
      <div class="pa-4">
        <div class="text-overline text-medium-emphasis">Crop</div>
        <v-btn
          block
          variant="tonal"
          prepend-icon="mdi-crop"
          :text="store.edit.crop ? 'Adjust crop' : 'Crop image'"
          :disabled="!store.hasImage"
          @click="store.enterCrop()"
        />
        <v-btn
          v-if="store.edit.crop"
          block
          class="mt-2"
          variant="text"
          size="small"
          prepend-icon="mdi-crop-free"
          text="Clear crop"
          @click="store.clearCrop()"
        />

        <div class="mt-6">
          <AdjustPanel />
        </div>
      </div>
    </v-navigation-drawer>

    <v-main>
      <EditorStage />
    </v-main>

    <BottomControls v-if="smAndDown && store.hasImage && store.mode === 'view'" />

    <UploadDropzone />

    <v-snackbar
      :model-value="!!store.error"
      color="error"
      timeout="4000"
      @update:model-value="(v: boolean) => !v && store.clearError()"
    >
      {{ store.error }}
    </v-snackbar>
  </v-app>
</template>
