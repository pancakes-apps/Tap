import index from './views/index.html';
import scrapeModule from './services/scrape';
import { getModelInfo, listGgufQuants, pickMedianQuant } from './services/hf';
import { isModelCached, loadModel, analyzeMarkdown, getProgress, setStage, listCachedModels, getDeviceMemory, estimateFit } from './services/llm';

const server = Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/scrape": {
      POST: async (req) =>  {
        const { url } = await req.json()

        const siteDate = await scrapeModule(url)

        return Response.json(siteDate)
      }
    },
    "/llm/model-info": {
      GET: async (req) => {
        const name = new URL(req.url).searchParams.get("name")
        if (!name) return Response.json({ error: "missing ?name=" }, { status: 400 })

        const info = await getModelInfo(name)
        if (!info.exists) return Response.json({ exists: false })

        const device = await getDeviceMemory()
        const quants = listGgufQuants(info.siblings).map((q) => ({
          ...q,
          fit: estimateFit(q.size, device),
          cached: isModelCached(name, q.file),
        }))

        const onGpu = quants.filter((q) => q.fit === "gpu")
        const onCpu = quants.filter((q) => q.fit === "cpu")
        const recommendedQuant = pickMedianQuant(onGpu.length ? onGpu : onCpu.length ? onCpu : quants)

        return Response.json({
          exists: true,
          gated: info.gated,
          hfTokenInEnv: !!Bun.env.HF_TOKEN,
          device,
          quants,
          recommendedQuant,
        })
      }
    },
    "/llm/progress": {
      GET: async () => Response.json(getProgress())
    },
    "/llm/cached-models": {
      GET: async () => Response.json({ repoIds: listCachedModels() })
    },
    "/llm/scrape": {
      POST: async (req) => {
        const { url, modelName, quantFile, hfToken } = await req.json()

        try {
          setStage("scraping", "Scraping the page…")
          const siteData = await scrapeModule(url)

          const token = hfToken || Bun.env.HF_TOKEN
          const { session, llama, dispose } = await loadModel(modelName, quantFile, token)

          try {
            const runId = `${Date.now()}`
            const { analysisMarkdown, structured } = await analyzeMarkdown(
              siteData.site_data_as_markdown,
              session,
              llama,
              runId,
            )

            setStage("done", "Done!")

            return Response.json({
              ...siteData,
              llm_analysis_markdown: analysisMarkdown,
              structured_data: structured,
            })
          } finally {
            await dispose()
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Something went wrong"
          setStage("error", message)
          return Response.json({ error: message }, { status: 500 })
        }
      }
    }
  }
})

console.log(`Listening on ${server.url}`)
