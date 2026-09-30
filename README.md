<div align="center">
  <img src="public/assets/favicon.png" alt="Tap" width="80" />
  <h1>Tap</h1>
  <p>A web scraper. And, if you flip the switch, a tiny local mind that reads what it scrapes. <em>Mwahaha.</em></p>
  <p>Built with <a href="https://bun.sh">Bun</a> · <a href="https://pptr.dev">Puppeteer</a> · <a href="https://github.com/mixmark-io/turndown">Turndown</a> · <a href="https://github.com/withcatai/node-llama-cpp">node-llama-cpp</a></p>
</div>

---

## From the lab of a mad (local) scientist

Behold: an AI feature with no API key, no cloud bill, and no telemetry — because the entire model lives in a `.gguf` file, in your `models/` folder, running on your own CPU or GPU. No data leaves the building. This is either deeply responsible engineering or the setup to a supervillain origin story. Possibly both.

Tap has two modes:

1. **Normal** — scrape a URL, get HTML and Markdown back. The classic.
2. **LLM Assisted** — same scrape, plus a model *you* pick, downloaded once and cached, that reads the page in chunks and hands back structured "loot": the useful bits, as JSON, alongside a running Markdown analysis.

---

## Getting Started

```bash
git clone https://github.com/pancakes-apps/tap
cd tap
bun install
bun run start
```

The app runs at `http://localhost:3000`.

Planning to use LLM Assisted mode? Copy the env template first:

```bash
cp .env.example .env
```

Most GGUF repos on Hugging Face are public — no token needed. A gated repo (Llama, Gemma, and similar) needs an `HF_TOKEN` in `.env`. The app checks this for you and only asks for a token when the model actually requires one.

---

## How It Works

### Normal mode
1. Enter a URL.
2. Tap fetches the page and strips the noise — scripts, styles, images, iframes — then converts what's left to clean Markdown with Turndown.
3. Get back HTML and Markdown.

### LLM Assisted mode
1. Flip the switch. A warning appears first, on purpose: a model is about to be downloaded and run locally on this machine.
2. Type a Hugging Face GGUF repo name — e.g. `unsloth/LFM2.5-8B-A1B-GGUF`.
3. Tap checks Hugging Face for you:
   - Does the repo exist? (if not, you get a clear error, not a cryptic one)
   - Is it gated? If so, and no `HF_TOKEN` is set, a token field appears.
   - What quants are available? Pulled live from the repo's own metadata, never hardcoded, with the median-sized quant pre-selected as a sane default. Already downloaded a quant before? It's marked with a ✓ so you're not re-downloading gigabytes for nothing.
4. The scraped Markdown is fed to the model in 300-line chunks. Each chunk is analyzed alongside a *compacted* summary of everything read so far — not the full raw history — so context stays small and bounded no matter how long the page is. Each chunk's findings are appended to a structured JSON file on disk as the run happens, not just at the end.
5. Results come back as three views: the raw scrape, the model's running analysis, and the structured JSON it extracted along the way.

---

## Usage

### Web App
Open `http://localhost:3000`, flip the switch if you want the LLM, fill in the form.

### API

**Normal scrape:**
```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Check a model before committing to a download:**
```bash
curl "http://localhost:3000/llm/model-info?name=unsloth/LFM2.5-8B-A1B-GGUF"
```
```json
{
  "exists": true,
  "gated": false,
  "hfTokenInEnv": false,
  "quants": [{ "file": "...", "quant": "Q4_K_M", "size": 5577791, "cached": false }],
  "recommendedQuant": "LFM2.5-8B-A1B-UD-Q4_K_M.gguf"
}
```

**Scrape with the local mind attached:**
```bash
curl -X POST http://localhost:3000/llm/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "modelName": "unsloth/LFM2.5-8B-A1B-GGUF",
    "quantFile": "LFM2.5-8B-A1B-UD-Q4_K_M.gguf"
  }'
```

**Response:**
```json
{
  "site_data_as_html": "...",
  "site_data_as_markdown": "...",
  "llm_analysis_markdown": "...",
  "structured_data": [{ "label": "...", "value": "...", "context": "..." }]
}
```

Every run also writes its structured findings to `output/<runId>.json` as it goes — a paper trail on your own disk, in case a request times out mid-analysis.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| [Bun](https://bun.sh) | Runtime & server |
| [Puppeteer](https://pptr.dev) | Headless browser for scraping |
| [Turndown](https://github.com/mixmark-io/turndown) | HTML to Markdown conversion |
| [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) | Local GGUF inference — no server, no cloud |

`models/` and `output/` are gitignored on purpose — they're local artifacts, not source code.

---

## License

MIT

<div align="center">
  <br />
  Made with ❤️ by Pancakes
</div>
