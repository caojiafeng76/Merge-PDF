import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'

const pageCss = `
  @page {
    size: A4;
    margin: 18mm 16mm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    color: #111827;
    font-family: "Noto Sans CJK SC", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", "SimSun", Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.65;
    margin: 0;
    word-break: break-word;
  }

  p {
    margin: 0 0 10pt;
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: 700;
    line-height: 1.35;
    margin: 16pt 0 8pt;
  }

  h1 { font-size: 20pt; }
  h2 { font-size: 17pt; }
  h3 { font-size: 15pt; }

  table {
    border-collapse: collapse;
    margin: 0 0 12pt;
    width: 100%;
  }

  th, td {
    border: 1px solid #d1d5db;
    padding: 5pt 7pt;
    vertical-align: top;
  }

  img {
    height: auto;
    max-width: 100%;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
`

function getHtmlDocument(bodyHtml) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <style>${pageCss}</style>
  </head>
  <body>${bodyHtml}</body>
</html>`
}

async function loadChromiumFont(chromium) {
  const fontUrl = process.env.WORD_TO_PDF_FONT_URL
  if (!fontUrl || typeof chromium.font !== 'function') return

  await chromium.font(fontUrl)
}

async function launchBrowser() {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import('@sparticuz/chromium'),
    import('puppeteer-core'),
  ])

  await loadChromiumFont(chromium)

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath()
  const headless = process.env.PUPPETEER_HEADLESS === 'false' ? false : 'shell'

  return await puppeteer.launch({
    args: [
      ...chromium.args,
      '--disable-web-security',
    ],
    defaultViewport: {
      width: 1280,
      height: 1800,
      deviceScaleFactor: 1,
    },
    executablePath,
    headless,
    userDataDir: path.join(tmpdir(), `merge-pdf-${randomUUID()}`),
  })
}

export async function convertDocxBufferToPdf(inputBuffer, filename) {
  const { default: mammoth } = await import('mammoth')
  const result = await mammoth.convertToHtml(
    { buffer: inputBuffer },
    {
      externalFileAccess: false,
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
      ],
    }
  )

  if (!result.value || result.value.trim().length === 0) {
    throw new Error('未能从该 Word 文档中提取到可转换内容')
  }

  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', request => {
      const url = request.url()
      if (url === 'about:blank' || url.startsWith('data:')) {
        request.continue()
        return
      }

      request.abort()
    })

    await page.setContent(getHtmlDocument(result.value), {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })

    return {
      filename: filename.replace(/\.docx$/i, '.pdf'),
      pdfBuffer: Buffer.from(pdfBuffer),
    }
  } finally {
    await browser.close()
  }
}
