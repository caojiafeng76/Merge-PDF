import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const WORD_EXTENSIONS = new Set(['.doc', '.docx'])
const DEFAULT_CONVERSION_TIMEOUT_MS = 120_000

export class ConversionError extends Error {
  constructor(message, statusCode = 500, code = 'CONVERSION_ERROR', details = '') {
    super(message)
    this.name = 'ConversionError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function isSupportedWordFilename(filename) {
  return WORD_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

export function getPdfFilename(filename) {
  const extension = path.extname(filename)
  const baseName = path.basename(filename, extension).trim() || 'converted'
  return `${baseName}.pdf`
}

export function createContentDisposition(filename) {
  const encodedFilename = encodeURIComponent(filename)
    .replace(/['()]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A')

  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '')
    .trim()

  const fallback = asciiFallback.toLowerCase().endsWith('.pdf') && asciiFallback !== '.pdf'
    ? asciiFallback
    : 'download.pdf'

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodedFilename}`
}

export function getLibreOfficeCandidates(customPath = process.env.LIBREOFFICE_PATH) {
  const candidates = []

  if (customPath) {
    candidates.push(customPath)
  }

  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      'soffice.exe',
      'soffice',
      'libreoffice'
    )
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/LibreOffice.app/Contents/MacOS/soffice',
      'soffice',
      'libreoffice'
    )
  } else {
    candidates.push('soffice', 'libreoffice')
  }

  return [...new Set(candidates.filter(Boolean))]
}

async function runProcess(command, args, timeoutMs) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new ConversionError('Word 转 PDF 超时，请稍后重试或检查文档大小', 504, 'CONVERSION_TIMEOUT'))
    }, timeoutMs)

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })

    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      const output = `${stdout}\n${stderr}`.trim()
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(new ConversionError('LibreOffice 转换失败，请确认 Word 文件有效且未损坏', 500, 'CONVERSION_FAILED', output))
    })
  })
}

async function resolveLibreOfficeExecutable() {
  for (const candidate of getLibreOfficeCandidates()) {
    try {
      await runProcess(candidate, ['--version'], 5_000)
      return candidate
    } catch {
      continue
    }
  }

  throw new ConversionError(
    '未检测到 LibreOffice。请安装 LibreOffice，或通过 LIBREOFFICE_PATH 指定 soffice 可执行文件路径',
    500,
    'LIBREOFFICE_NOT_FOUND'
  )
}

export async function convertWordBufferToPdf(inputBuffer, originalFilename) {
  if (!isSupportedWordFilename(originalFilename)) {
    throw new ConversionError('仅支持 Word 文件（.doc 或 .docx）', 400, 'UNSUPPORTED_FILE_TYPE')
  }

  if (!inputBuffer || inputBuffer.length === 0) {
    throw new ConversionError('上传的 Word 文件为空', 400, 'EMPTY_FILE')
  }

  const tempRoot = await mkdtemp(path.join(tmpdir(), 'merge-pdf-word-'))

  try {
    const inputDir = path.join(tempRoot, 'input')
    const outputDir = path.join(tempRoot, 'output')
    const profileDir = path.join(tempRoot, 'profile')
    await mkdir(inputDir)
    await mkdir(outputDir)
    await mkdir(profileDir)

    const inputExtension = path.extname(originalFilename).toLowerCase()
    const inputPath = path.join(inputDir, `document${inputExtension}`)
    const outputPath = path.join(outputDir, 'document.pdf')

    await writeFile(inputPath, inputBuffer)

    const soffice = await resolveLibreOfficeExecutable()
    await runProcess(
      soffice,
      [
        '--headless',
        '--nologo',
        '--nodefault',
        '--nofirststartwizard',
        '--nolockcheck',
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--convert-to',
        'pdf',
        '--outdir',
        outputDir,
        inputPath,
      ],
      DEFAULT_CONVERSION_TIMEOUT_MS
    )

    let pdfBuffer
    try {
      pdfBuffer = await readFile(outputPath)
    } catch {
      throw new ConversionError('LibreOffice 未生成 PDF 文件，请检查文档内容或字体环境', 500, 'PDF_NOT_CREATED')
    }

    return {
      filename: getPdfFilename(originalFilename),
      pdfBuffer,
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}
