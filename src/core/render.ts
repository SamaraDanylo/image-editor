import type { Op } from './types'
import { colorKernels } from './pixel'

type Source = ImageBitmap | HTMLCanvasElement

function sourceSize(source: Source) {
  return { width: source.width, height: source.height }
}

// Export interpreter: replays the canonical ops over the original source onto a
// new canvas. Geometry (crop) is a drawImage region; color ops run once over the
// resulting ImageData. Running this on the untouched source is exactly what
// "replaying the JSON reproduces the result" means.
export function renderOps(source: Source, ops: Op[]): HTMLCanvasElement {
  const { width, height } = sourceSize(source)

  const crop = ops.find((op) => op.type === 'crop')
  const region = crop
    ? { x: crop.x, y: crop.y, width: crop.width, height: crop.height }
    : { x: 0, y: 0, width, height }

  const canvas = document.createElement('canvas')
  canvas.width = region.width
  canvas.height = region.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context is unavailable')

  ctx.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height,
  )

  const kernels = colorKernels(ops)
  if (kernels.length > 0) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = image.data
    const px = { r: 0, g: 0, b: 0 }
    for (let i = 0; i < data.length; i += 4) {
      px.r = data[i]
      px.g = data[i + 1]
      px.b = data[i + 2]
      for (const kernel of kernels) kernel(px)
      data[i] = px.r
      data[i + 1] = px.g
      data[i + 2] = px.b
    }
    ctx.putImageData(image, 0, 0)
  }

  return canvas
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      type,
      quality,
    )
  })
}
