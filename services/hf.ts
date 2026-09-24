import type { GgufQuant, HfModelInfo, HfSibling } from "./types"

const QUANT_RE = /[-_](IQ\d[A-Z0-9_]*|Q\d[A-Z0-9_]*|BF16|F16|F32)\.gguf$/i

export async function getModelInfo(repoId: string): Promise<HfModelInfo> {
  const res = await fetch(`https://huggingface.co/api/models/${repoId}?blobs=true`)

  if (res.status === 404) {
    return { exists: false, gated: false, siblings: [] }
  }

  if (!res.ok) {
    throw new Error(`Hugging Face API error (${res.status}) for ${repoId}`)
  }

  const data = await res.json()

  return {
    exists: true,
    gated: data.gated ?? false,
    siblings: data.siblings ?? [],
  }
}

export function listGgufQuants(siblings: HfSibling[]): GgufQuant[] {
  return siblings
    .filter((f) => f.rfilename.endsWith(".gguf"))
    .map((f) => ({
      file: f.rfilename,
      quant: f.rfilename.match(QUANT_RE)?.[1]?.toUpperCase() ?? "UNKNOWN",
      size: f.size,
    }))
}

export function pickMedianQuant(quants: GgufQuant[]): string | null {
  if (quants.length === 0) return null

  const sorted = [...quants].sort((a, b) => (a.size ?? 0) - (b.size ?? 0))
  const medianIndex = Math.floor((sorted.length - 1) / 2)

  return sorted[medianIndex]!.file
}
