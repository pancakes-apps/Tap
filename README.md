<div align="center">
  <img src="public/assets/favicon.png" alt="Tap" width="80" />
  <h1>Tap</h1>
  <p>A simple web scraper that taps into any site and extracts the data you need.</p>
  <p>Built with <a href="https://bun.sh">Bun</a> · <a href="https://pptr.dev">Puppeteer</a> · <a href="https://github.com/mixmark-io/turndown">Turndown</a></p>
</div>

---

## Getting Started

```bash
git clone https://github.com/pancakes-apps/tap
cd tap
bun install
bun run start
```

The app will be running at `http://localhost:3000`.

---

## How It Works

1. Enter a URL
2. Tap fetches the page and extracts its content
3. Get the scraped data back as **HTML** or **Markdown**

HTML is converted to clean Markdown using [Turndown](https://github.com/mixmark-io/turndown), making the output easy to read, store, or pipe into other tools.

---

## Usage

### Web App

Open `http://localhost:3000` in your browser for the visual interface.

### API

Send a `POST` request to `/scrape` with a JSON body:

```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Response:**

```json
{
  "site_data_as_html": "...",
  "site_data_as_markdown": "..."
}
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| [Bun](https://bun.sh) | Runtime & server |
| [Puppeteer](https://pptr.dev) | Headless browser for scraping |
| [Turndown](https://github.com/mixmark-io/turndown) | HTML to Markdown conversion |

---

## License

This project is licensed under the [MIT License](LICENSE).

<div align="center">
  <br />
  Made with ❤️ by Pancakes
</div>
