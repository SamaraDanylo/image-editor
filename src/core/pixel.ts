import type { Op } from './types'

// Export interpreter, per-pixel half. Implements the CSS Filter Effects
// shorthands (brightness, contrast, saturate) directly on sRGB 8-bit values —
// the same space browsers evaluate the CSS `filter` preview in — so the export
// matches the preview. Each kernel clamps its own output, reproducing the
// [0,1] clamp between SVG filter primitives (this is why the ops are applied in
// sequence rather than folded into one matrix: they differ once a stage
// saturates).

export interface Pixel {
  r: number
  g: number
  b: number
}

export type ColorKernel = (px: Pixel) => void

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

// https://drafts.fxtf.org/filter-effects/#brightnessEquivalent
function brightnessKernel(amount: number): ColorKernel {
  return (px) => {
    px.r = clamp8(px.r * amount)
    px.g = clamp8(px.g * amount)
    px.b = clamp8(px.b * amount)
  }
}

// https://drafts.fxtf.org/filter-effects/#contrastEquivalent
function contrastKernel(amount: number): ColorKernel {
  const intercept = 127.5 * (1 - amount)
  return (px) => {
    px.r = clamp8(px.r * amount + intercept)
    px.g = clamp8(px.g * amount + intercept)
    px.b = clamp8(px.b * amount + intercept)
  }
}

// https://drafts.fxtf.org/filter-effects/#saturateEquivalent
function saturateKernel(s: number): ColorKernel {
  const rr = 0.213 + 0.787 * s
  const rg = 0.715 - 0.715 * s
  const rb = 0.072 - 0.072 * s
  const gr = 0.213 - 0.213 * s
  const gg = 0.715 + 0.285 * s
  const gb = 0.072 - 0.072 * s
  const br = 0.213 - 0.213 * s
  const bg = 0.715 - 0.715 * s
  const bb = 0.072 + 0.928 * s
  return (px) => {
    const { r, g, b } = px
    px.r = clamp8(rr * r + rg * g + rb * b)
    px.g = clamp8(gr * r + gg * g + gb * b)
    px.b = clamp8(br * r + bg * g + bb * b)
  }
}

// https://drafts.fxtf.org/filter-effects/#grayscaleEquivalent (amount = 1)
const grayscaleKernel: ColorKernel = (px) => {
  const luma = clamp8(0.2126 * px.r + 0.7152 * px.g + 0.0722 * px.b)
  px.r = luma
  px.g = luma
  px.b = luma
}

// https://drafts.fxtf.org/filter-effects/#sepiaEquivalent (amount = 1)
const sepiaKernel: ColorKernel = (px) => {
  const { r, g, b } = px
  px.r = clamp8(0.393 * r + 0.769 * g + 0.189 * b)
  px.g = clamp8(0.349 * r + 0.686 * g + 0.168 * b)
  px.b = clamp8(0.272 * r + 0.534 * g + 0.131 * b)
}

// Builds the ordered color pipeline from the canonical ops (geometry ops are
// handled by the caller). Values are already normalized to 1 = neutral.
export function colorKernels(ops: Op[]): ColorKernel[] {
  const kernels: ColorKernel[] = []
  for (const op of ops) {
    if (op.type === 'adjust') {
      if (op.brightness !== 1) kernels.push(brightnessKernel(op.brightness))
      if (op.contrast !== 1) kernels.push(contrastKernel(op.contrast))
      if (op.saturation !== 1) kernels.push(saturateKernel(op.saturation))
      if (op.filter === 'grayscale') kernels.push(grayscaleKernel)
      else if (op.filter === 'sepia') kernels.push(sepiaKernel)
    }
  }
  return kernels
}
