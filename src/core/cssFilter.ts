import type { EditState } from './types'

// Preview interpreter: edit state -> CSS `filter` string (GPU-evaluated).
// The export path implements the same spec formulas in pixels; the two must match.
export function toCssFilter(state: EditState): string {
  const parts: string[] = []
  const { brightness, contrast, saturation, filter } = state.adjustments
  if (brightness !== 100) parts.push(`brightness(${brightness / 100})`)
  if (contrast !== 100) parts.push(`contrast(${contrast / 100})`)
  if (saturation !== 100) parts.push(`saturate(${saturation / 100})`)
  if (filter === 'grayscale') parts.push('grayscale(1)')
  if (filter === 'sepia') parts.push('sepia(1)')
  return parts.length > 0 ? parts.join(' ') : 'none'
}
