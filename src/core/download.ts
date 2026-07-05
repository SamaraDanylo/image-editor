export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// "photo.jpg" + "-edited" + "png" -> "photo-edited.png"
export function withSuffix(filename: string, suffix: string, ext: string): string {
  const base = filename.replace(/\.[^./\\]+$/, '') || 'image'
  return `${base}${suffix}.${ext}`
}
