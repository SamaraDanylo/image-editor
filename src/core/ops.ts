import type { Adjustments, EditState, Op } from './types'

export function createNeutralState(): EditState {
  return {
    crop: null,
    adjustments: { brightness: 100, contrast: 100, saturation: 100, filter: 'none' },
  }
}

export function isNeutralAdjustments(a: Adjustments): boolean {
  return a.brightness === 100 && a.contrast === 100 && a.saturation === 100 && a.filter === 'none'
}

export function hasEdits(state: EditState): boolean {
  return state.crop !== null || !isNeutralAdjustments(state.adjustments)
}

// Plain-field copy, decoupled from the reactive `edit` ref — safe to keep in a history stack.
export function cloneEditState(state: EditState): EditState {
  return {
    crop: state.crop ? { ...state.crop } : null,
    adjustments: { ...state.adjustments },
  }
}

export function editStatesEqual(a: EditState, b: EditState): boolean {
  const cropEqual =
    a.crop === b.crop ||
    (!!a.crop &&
      !!b.crop &&
      a.crop.x === b.crop.x &&
      a.crop.y === b.crop.y &&
      a.crop.width === b.crop.width &&
      a.crop.height === b.crop.height)
  return (
    cropEqual &&
    a.adjustments.brightness === b.adjustments.brightness &&
    a.adjustments.contrast === b.adjustments.contrast &&
    a.adjustments.saturation === b.adjustments.saturation &&
    a.adjustments.filter === b.adjustments.filter
  )
}

// Compiles the edit state into the canonical op list. Neutral ops are dropped and
// values are normalized to the CSS filter-function domain (1 = neutral) so the list
// replays 1:1 over the original.
export function toOps(state: EditState): Op[] {
  const ops: Op[] = []
  if (state.crop) ops.push({ type: 'crop', ...state.crop })
  if (!isNeutralAdjustments(state.adjustments)) {
    ops.push({
      type: 'adjust',
      brightness: state.adjustments.brightness / 100,
      contrast: state.adjustments.contrast / 100,
      saturation: state.adjustments.saturation / 100,
      filter: state.adjustments.filter,
    })
  }
  return ops
}
