import express from 'express'
import multer from 'multer'
import {
  ConversionError,
  convertWordBufferToPdf,
  createContentDisposition,
  getPdfFilename,
  isSupportedWordFilename,
} from './word-to-pdf.mjs'
import { convertDocxBufferToPdf } from './docx-html-pdf.mjs'

const maxUploadBytes = Number.parseInt(process.env.MAX_WORD_UPLOAD_BYTES ?? `${50 * 1024 * 1024}`, 10)

function isDocxFilename(filename) {
  return /\.docx$/i.test(filename)
}

async function convertWithRemoteService(inputBuffer, filename, mimetype, options = {}) {
  const converterUrl = process.env.WORD_TO_PDF_CONVERTER_URL

  if (!converterUrl) {
    if (process.env.VERCEL) {
      if (isDocxFilename(filename)) {
        return await options.convertDocxBuffer(inputBuffer, filename)
      }

      throw new ConversionError(
        'Vercel 内置降级转换仅支持 .docx。.doc 或高保真转换请配置 WORD_TO_PDF_CONVERTER_URL',
        501,
        'REMOTE_CONVERTER_REQUIRED'
      )
    }

    return await convertWordBufferToPdf(inputBuffer, filename)
  }

  const formData = new FormData()
  formData.append(
    'file',
    new Blob([inputBuffer], { type: mimetype || 'application/octet-stream' }),
    filename
  )

  const headers = {}
  if (process.env.WORD_TO_PDF_CONVERTER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.WORD_TO_PDF_CONVERTER_TOKEN}`
  }

  const response = await fetch(converterUrl, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    let details = ''
    try {
      details = await response.text()
    } catch {
      details = response.statusText
    }

    throw new ConversionError(
      '远程 Word 转 PDF 服务转换失败',
      502,
      'REMOTE_CONVERTER_FAILED',
      details
    )
  }

  return {
    filename: getPdfFilename(filename),
    pdfBuffer: Buffer.from(await response.arrayBuffer()),
  }
}

function sendError(res, error) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: '上传文件过大，请选择更小的 Word 文件',
      code: 'FILE_TOO_LARGE',
    })
    return
  }

  if (error instanceof ConversionError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    })
    return
  }

  console.error(error)
  res.status(500).json({
    error: '服务器处理失败，请稍后重试',
    code: 'SERVER_ERROR',
  })
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

function normalizeUploadFilename(filename) {
  if ([...filename].some(char => (char.codePointAt(0) ?? 0) > 255)) {
    return filename
  }

  const decoded = Buffer.from(filename, 'latin1').toString('utf8')
  return decoded.includes('\uFFFD') ? filename : decoded
}

export function createApp(options = {}) {
  const app = express()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxUploadBytes,
      files: 1,
    },
  })

  const convertDocxBuffer = options.convertDocxBuffer ?? convertDocxBufferToPdf
  const convertWordBuffer = options.convertWordBuffer ?? ((inputBuffer, filename, mimetype) => (
    convertWithRemoteService(inputBuffer, filename, mimetype, { convertDocxBuffer })
  ))

  app.disable('x-powered-by')

  app.get(['/api/health', '/health', '/'], (req, res) => {
    res.json({ ok: true })
  })

  app.post(
    ['/api/word-to-pdf', '/word-to-pdf', '/'],
    upload.single('file'),
    asyncRoute(async (req, res) => {
      const file = req.file

      if (!file) {
        throw new ConversionError('请上传 Word 文件', 400, 'FILE_REQUIRED')
      }

      const originalFilename = normalizeUploadFilename(file.originalname)

      if (!isSupportedWordFilename(originalFilename)) {
        throw new ConversionError('仅支持 Word 文件（.doc 或 .docx）', 400, 'UNSUPPORTED_FILE_TYPE')
      }

      const { filename, pdfBuffer } = await convertWordBuffer(
        file.buffer,
        originalFilename,
        file.mimetype
      )

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': createContentDisposition(filename),
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      res.send(pdfBuffer)
    })
  )

  app.use((req, res) => {
    res.status(404).json({
      error: '接口不存在',
      code: 'API_NOT_FOUND',
    })
  })

  app.use((error, req, res, next) => {
    void req
    void next
    sendError(res, error)
  })

  return app
}

export default createApp()
