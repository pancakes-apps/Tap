export interface HfSibling {
  rfilename: string
  size?: number
}

export interface HfModelInfo {
  exists: boolean
  gated: false | "auto" | "manual"
  siblings: HfSibling[]
}

export interface GgufQuant {
  file: string
  quant: string
  size?: number
}

export interface Finding {
  label: string
  value: string
}

export interface ChunkResult {
  summary: string
  key_points: string[]
  findings: Finding[]
}

export interface AnalysisResult {
  analysisMarkdown: string
  structured: Finding[]
}

export type Stage =
  | "idle"
  | "scraping"
  | "checking-model"
  | "downloading-model"
  | "loading-model"
  | "analyzing"
  | "writing-json"
  | "done"
  | "error"

export interface PipelineProgress {
  stage: Stage
  detail: string
  percent: number
  downloadedBytes?: number
  totalBytes?: number
  file?: string
  chunk?: number
  totalChunks?: number
}

export interface RegistryEntry {
  repoId: string
  quantFile: string
}

export type QuantFit = "gpu" | "cpu" | "too-big" | "unknown"

export interface DeviceMemory {
  gpu: string | false
  vramFree: number
  ramFree: number
}

export interface RatedQuant extends GgufQuant {
  fit: QuantFit
  cached: boolean
}
