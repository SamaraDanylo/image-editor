import { useEditorStore } from '../stores/editor'

export function useImagePicker() {
  const store = useEditorStore()

  function openImageDialog() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) void store.loadImage(file)
    }
    input.click()
  }

  return { openImageDialog }
}
