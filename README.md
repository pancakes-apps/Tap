# Tap

A simple web scraper that taps into any site and extracts the data you need. Built with [Bun](https://bun.sh) and [Puppeteer](https://pptr.dev).

## Getting Started

Clone the repo:

```bash
git clone https://github.com/pancakes-apps/tap
cd tap
```

Install dependencies:

```bash
bun install
```

Start the app:

```bash
bun run start
```

The app will be running at `http://localhost:3000`.

## How It Works

1. Enter a URL
2. Tap fetches the page and extracts its content
3. View the scraped data, clean and ready to use

## Tech Stack

- **Bun** — runtime & server
- **Puppeteer** — headless browser for scraping