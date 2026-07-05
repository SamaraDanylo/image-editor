/** Axis-aligned rectangle in source-image pixel coordinates. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type FilterMode = 'none' | 'grayscale' | 'sepia'

/** Color adjustments as shown in the UI: 100 = neutral, range 0–200. */
export interface Adjustments {
  brightness: number
  contrast: number
  saturation: number
  filter: FilterMode
}

/** The 0–200 slider adjustments, excluding the mutually-exclusive filter toggle. */
export type SliderKey = Exclude<keyof Adjustments, 'filter'>

export interface EditState {
  // Crop rect is stored in ORIGINAL image coordinates, which keeps re-cropping lossless.
  crop: Rect | null
  adjustments: Adjustments
}

/** Serializable operation — the canonical form of an edit. Pipeline order is geometry, then color. */
export type Op =
  | ({ type: 'crop' } & Rect)
  | { type: 'adjust'; brightness: number; contrast: number; saturation: number; filter: FilterMode }

export interface EditDocument {
  version: 1
  source: { filename: string; width: number; height: number }
  ops: Op[]
}
