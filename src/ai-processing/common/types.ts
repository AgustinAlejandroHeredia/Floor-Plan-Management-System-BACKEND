export interface SectionCoords {
  x: number,
  y: number,
}

export interface SectionSize {
  width: number,
  height: number,
}

export type SectionType = 
  | "polygon"
  | "rectangle"
  | "circle"
  | "polyline"

export interface SectionView {
  coordsList: SectionCoords[],
  size: SectionSize,
  radius?: number,
  type: SectionType,
}