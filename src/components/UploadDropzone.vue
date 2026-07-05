<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()

const dragging = ref(false)
// dragenter/leave fire per nested element — count depth instead of a plain flag.
let depth = 0

function onDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  depth++
  dragging.value = true
}

function onDragOver(e: DragEvent) {
  if (dragging.value) e.preventDefault()
}

function onDragLeave() {
  if (dragging.value && --depth <= 0) {
    depth = 0
    dragging.value = false
  }
}

function onDrop(e: DragEvent) {
  if (!dragging.value) return
  e.preventDefault()
  depth = 0
  dragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) void store.loadImage(file)
}

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
})
</script>

<template>
  <v-overlay
    :model-value="dragging"
    persistent
    no-click-animation
    class="align-center justify-center"
  >
    <div class="drop-hint text-center pa-12">
      <v-icon icon="mdi-tray-arrow-down" size="48" color="primary" />
      <div class="text-h6 mt-3">Drop image to open</div>
    </div>
  </v-overlay>
</template>

<style scoped>
.drop-hint {
  border: 2px dashed rgba(var(--v-theme-primary), 0.8);
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.85);
  pointer-events: none;
}
</style>
