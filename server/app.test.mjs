import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { afterEach, describe, it } from 'node:test'
import { createApp } from './app.mjs'

const envBackup = {
  VERCEL: process.env.VERCEL,
  WORD_TO_PDF_CONVERTER_URL: process.env.WORD_TO_PDF_CONVERTER_URL,
}

afterEach(() => {
  if (envBackup.VERCEL === undefined) delete process.env.VERCEL
  else process.env.VERCEL = envBackup.VERCEL

  if (envBackup.WORD_TO_PDF_CONVERTER_URL === undefined) delete process.env.WORD_TO_PDF_CONVERTER_URL
  else process.env.WORD_TO_PDF_CONVERTER_URL = envBackup.WORD_TO_PDF_CONVERTER_URL
})

async function withTestServer(app, callback) {
  const server = createServer(app)

  await new Promise(resolve => {
    server.listen(0, '127.0.0.1', resolve)
  })

  try {
    const address = server.address()
    assert.equal(typeof address, 'object')
    await callback(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

function createWordUpload(filename = '合同模板.docx') {
  const formData = new FormData()
  formData.append('file', new Blob(['fake word content']), filename)
  return formData
}

describe('Express Word to PDF API', () => {
  it('returns a health response', async () => {
    const app = createApp()

    await withTestServer(app, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/health`)

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { ok: true })
    })
  })

  it('streams converted PDFs with a Chinese-safe filename', async () => {
    const app = createApp({
      convertWordBuffer: async (_buffer, filename) => ({
        filename: filename.replace(/\.docx?$/i, '.pdf'),
        pdfBuffer: Buffer.from('%PDF-1.7\n'),
      }),
    })

    await withTestServer(app, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/word-to-pdf`, {
        method: 'POST',
        body: createWordUpload(),
      })

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'application/pdf')
      assert.match(
        response.headers.get('content-disposition') ?? '',
        /filename\*=UTF-8''%E5%90%88%E5%90%8C%E6%A8%A1%E6%9D%BF\.pdf/
      )
      assert.equal(await response.text(), '%PDF-1.7\n')
    })
  })

  it('uses the DOCX fallback on Vercel when no conversion backend is configured', async () => {
    process.env.VERCEL = '1'
    delete process.env.WORD_TO_PDF_CONVERTER_URL

    let fallbackFilename = ''
    const app = createApp({
      convertDocxBuffer: async (_buffer, filename) => {
        fallbackFilename = filename
        return {
          filename: filename.replace(/\.docx$/i, '.pdf'),
          pdfBuffer: Buffer.from('%PDF-1.7\n'),
        }
      },
    })

    await withTestServer(app, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/word-to-pdf`, {
        method: 'POST',
        body: createWordUpload(),
      })

      assert.equal(response.status, 200)
      assert.equal(await response.text(), '%PDF-1.7\n')
      assert.equal(fallbackFilename, '合同模板.docx')
    })
  })

  it('requires a remote converter for legacy .doc files on Vercel', async () => {
    process.env.VERCEL = '1'
    delete process.env.WORD_TO_PDF_CONVERTER_URL

    const app = createApp({
      convertDocxBuffer: async () => {
        throw new Error('DOC fallback should not run for legacy DOC files')
      },
    })

    await withTestServer(app, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/word-to-pdf`, {
        method: 'POST',
        body: createWordUpload('legacy.doc'),
      })

      assert.equal(response.status, 501)
      assert.deepEqual(await response.json(), {
        error: 'Vercel 内置降级转换仅支持 .docx。.doc 或高保真转换请配置 WORD_TO_PDF_CONVERTER_URL',
        code: 'REMOTE_CONVERTER_REQUIRED',
      })
    })
  })
})
