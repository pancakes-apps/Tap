import index from './views/index.html';
import scrapeModule from './services/scrape';

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
    } 
  }
})

console.log(`Listening on ${server.url}`)