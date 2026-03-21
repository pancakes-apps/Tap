import puppeteer from "puppeteer"
import TurndownService from "turndown"

const scrapeModule = async ( url: string ) => {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: await puppeteer.executablePath(),
        args: [`--no-sandbox`, `--headless`, `--disable-gpu`, `--disable-dev-shm-usage`, '--single-process'],
    })
    
    const page = await browser.newPage()
    
    // Enable request interception FIRST
    await page.setRequestInterception(true)
    
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'font', 'media'].includes(resourceType)) {
            req.abort()
        } else {
            req.continue()
        }
    });
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    console.log('Execute custom JavaScript on the page to manipulate DOM')
    await page.evaluate(() => {
        const tagsToRemove = ['style', 'script', 'link', 'svg', 'img', 'iframe', 'meta', 'noscript', 'head', 'video', 'source', 'image']
        tagsToRemove.forEach(tag => {
            document.querySelectorAll(tag).forEach(el => el.remove())
        })
    })
    
    const modifiedHTML = await page.content()
    
    await page.close()

    console.log('Converting modified html to markdown')
    const turndownService = new TurndownService()
    const modifiedHTMLAsMarkdown = turndownService.turndown(modifiedHTML)

    return {
        site_data_as_html: modifiedHTML,
        site_data_as_markdown: modifiedHTMLAsMarkdown,
    }
}

export default scrapeModule