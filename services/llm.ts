import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync, renameSync } from "node:fs"
import path from "node:path"
import { getLlama, LlamaChatSession, type Llama } from "node-llama-cpp"
import type { AnalysisResult, ChunkResult, DeviceMemory, Finding, PipelineProgress, QuantFit, RegistryEntry, Stage } from "./types"

export const MODELS_DIR = "./models"
export const OUTPUT_DIR = "./output"
const REGISTRY_PATH = path.join(MODELS_DIR, "registry.json")
const CHUNK_LINES = 300
const RUNTIME_OVERHEAD_BYTES = 1.5e9

let llamaInstance: Promise<Llama> | null = null
const sharedLlama = () => (llamaInstance ??= getLlama())

export async function getDeviceMemory(): Promise<DeviceMemory> {
  const llama = await sharedLlama()
  const [vram, ram] = await Promise.all([llama.getVramState(), llama.getRamState()])
  return { gpu: llama.gpu, vramFree: vram.free, ramFree: ram.free }
}

export function estimateFit(size: number | undefined, device: DeviceMemory): QuantFit {
  if (!size) return "unknown"
  const needed = size + RUNTIME_OVERHEAD_BYTES
  if (device.gpu && needed <= device.vramFree) return "gpu"
  if (needed <= device.ramFree) return "cpu"
  return "too-big"
}

const STAGE_PERCENTS: Record<Stage, number> = {
  idle: 0,
  scraping: 10,
  "checking-model": 20,
  "downloading-model": 30,
  "loading-model": 60,
  analyzing: 70,
  "writing-json": 95,
  done: 100,
  error: 0,
}

let progress: PipelineProgress = { stage: "idle", detail: "", percent: 0 }

export function getProgress(): PipelineProgress {
  return progress
}

export function setStage(stage: Stage, detail = "") {
  progress = { stage, detail, percent: STAGE_PERCENTS[stage] }
}

function cachedFileName(repoId: string, quantFile: string): string {
  const org = repoId.split("/")[0]
  return `hf_${org}_${quantFile}`
}

export function isModelCached(repoId: string, quantFile: string): boolean {
  return existsSync(path.join(MODELS_DIR, cachedFileName(repoId, quantFile)))
}

function readRegistry(): RegistryEntry[] {
  if (!existsSync(REGISTRY_PATH)) return []
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf8"))
  } catch {
    return []
  }
}

function rememberModel(repoId: string, quantFile: string) {
  const registry = readRegistry()
  const alreadyKnown = registry.some((e) => e.repoId === repoId && e.quantFile === quantFile)
  if (!alreadyKnown) {
    registry.push({ repoId, quantFile })
    writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2))
  }
}

export function listCachedModels(): string[] {
  return [...new Set(readRegistry().map((e) => e.repoId))]
}

async function ensureModelDownloaded(repoId: string, quantFile: string, hfToken?: string): Promise<string> {
  setStage("checking-model", `Checking ${quantFile}…`)

  if (!existsSync(MODELS_DIR)) mkdirSync(MODELS_DIR, { recursive: true })

  const localPath = path.join(MODELS_DIR, cachedFileName(repoId, quantFile))
  if (existsSync(localPath)) {
    rememberModel(repoId, quantFile)
    return localPath
  }

  progress = { stage: "downloading-model", detail: `Downloading ${quantFile}…`, percent: 0, downloadedBytes: 0, totalBytes: 0, file: quantFile }

  const url = `https://huggingface.co/${repoId}/resolve/main/${quantFile}`
  const res = await fetch(url, {
    headers: hfToken ? { Authorization: `Bearer ${hfToken}` } : undefined,
  })

  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${quantFile} (${res.status})`)
  }

  const totalBytes = Number(res.headers.get("content-length") ?? 0)

  const tmpPath = `${localPath}.part`
  const writer = Bun.file(tmpPath).writer()
  let downloaded = 0

  for await (const chunk of res.body) {
    writer.write(chunk)
    downloaded += chunk.length
    const percent = totalBytes ? Math.round((downloaded / totalBytes) * 100) : 0
    progress = {
      stage: "downloading-model",
      detail: `Downloading ${quantFile}…`,
      percent,
      downloadedBytes: downloaded,
      totalBytes,
      file: quantFile,
    }
  }

  await writer.end()
  renameSync(tmpPath, localPath)

  rememberModel(repoId, quantFile)
  return localPath
}

export async function loadModel(repoId: string, quantFile: string, hfToken?: string) {
  const modelPath = await ensureModelDownloaded(repoId, quantFile, hfToken)

  setStage("loading-model", "Loading model into memory…")
  const llama = await sharedLlama()
  const model = await llama.loadModel({ modelPath })
  const context = await model.createContext()
  const session = new LlamaChatSession({ contextSequence: context.getSequence() })

  return {
    session,
    llama,
    dispose: async () => {
      await context.dispose()
      await model.dispose()
    },
  }
}

const chunkLines = (markdown: string): string[] => {
  const lines = markdown.split("\n")
  const chunks: string[] = []

  for (let i = 0; i < lines.length; i += CHUNK_LINES) {
    chunks.push(lines.slice(i, i + CHUNK_LINES).join("\n"))
  }

  return chunks.length > 0 ? chunks : [""]
}

const CHUNK_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    key_points: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
        },
        required: ["label", "value"],
      },
      minItems: 1,
      maxItems: 8,
    },
  },
  required: ["summary", "key_points", "findings"],
} as const

function renderChunkMarkdown(chunkIndex: number, totalChunks: number, summary: string, keyPoints: string[]): string {
  const keyPointsText = keyPoints.length
    ? keyPoints.map((point) => `- ${point}`).join("\n")
    : "_(nothing new in this section)_"

  return [`## Section ${chunkIndex} of ${totalChunks}`, summary, `**Key points:**`, keyPointsText].join("\n\n")
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ")
}

function dedupeAgainst<T>(items: T[], seen: Set<string>, keyOf: (item: T) => string): T[] {
  return items.filter((item) => {
    const key = keyOf(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function analyzeMarkdown(
  markdown: string,
  session: LlamaChatSession,
  llama: Llama,
  runId: string,
): Promise<AnalysisResult> {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
  const outputFile = path.join(OUTPUT_DIR, `${runId}.json`)
  writeFileSync(outputFile, "[\n")

  const chunks = chunkLines(markdown)
  let compactSummary = ""
  const analysisParts: string[] = []
  const structured: Finding[] = []
  const seenKeyPoints = new Set<string>()
  const seenFindings = new Set<string>()

  const grammar = await llama.createGrammarForJsonSchema(CHUNK_SCHEMA)

  for (let i = 0; i < chunks.length; i++) {
    progress = {
      stage: "analyzing",
      detail: `Analyzing section ${i + 1} of ${chunks.length}…`,
      percent: 70 + Math.round((i / chunks.length) * 25),
      chunk: i + 1,
      totalChunks: chunks.length,
    }

    const prompt = [
      compactSummary && `Summary of the page so far:\n${compactSummary}`,
      `Next section of the scraped page (chunk ${i + 1}/${chunks.length}):`,
      chunks[i],
      `Respond with JSON only, in this exact shape:
{
  "summary": "one or two plain sentences describing what this section is about",
  "key_points": ["short point about this section", "another short point"],
  "findings": [{ "label": "short name for a specific piece of data", "value": "the actual value found in the text" }]
}
Always include at least one key_point and at least one finding. If nothing looks important, pick the single most representative piece of information in the section instead of leaving a list empty.`,
    ]
      .filter(Boolean)
      .join("\n\n")

    const response = await session.prompt(prompt, { grammar })
    const parsed = JSON.parse(response) as ChunkResult

    compactSummary = parsed.summary

    const newKeyPoints = dedupeAgainst(parsed.key_points, seenKeyPoints, normalize)
    analysisParts.push(renderChunkMarkdown(i + 1, chunks.length, parsed.summary, newKeyPoints))

    const newFindings = dedupeAgainst(
      parsed.findings,
      seenFindings,
      (f) => `${normalize(f.label)}|${normalize(f.value)}`,
    )
    structured.push(...newFindings)

    const prefix = i === 0 ? "" : ",\n"
    appendFileSync(outputFile, `${prefix}${JSON.stringify({ chunk: i + 1, ...parsed }, null, 2)}`)
  }

  setStage("writing-json", "Finalizing structured JSON…")
  appendFileSync(outputFile, "\n]\n")

  return { analysisMarkdown: analysisParts.join("\n\n---\n\n"), structured }
}
