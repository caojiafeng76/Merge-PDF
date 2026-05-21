import { useState, useCallback, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Document, Paragraph, TextRun, Packer, PageBreak } from 'docx'
import type { IFontAttributesProperties } from 'docx'
import '../App.css'
import './PdfToWordPage.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfFileInfo {
  file: File
  name: string
  size: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

interface TextItemInfo {
  str: string
  x: number
  y: number
  fontSize: number
  fontName: string
  hasEOL: boolean
}

interface LineInfo {
  y: number
  items: TextItemInfo[]
}

const DEFAULT_FONT: IFontAttributesProperties = {
  ascii: 'Times New Roman',
  hAnsi: 'Times New Roman',
  eastAsia: '宋体',
  cs: 'Times New Roman',
}

function isChineseChar(ch: string): boolean {
  const code = ch.codePointAt(0)
  if (code === undefined) return false
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x2f800 && code <= 0x2fa1f)
  )
}

function containsChinese(text: string): boolean {
  for (const ch of text) {
    if (isChineseChar(ch)) return true
  }
  return false
}



function isBoldFont(fontName: string): boolean {
  const lower = fontName.toLowerCase()
  return lower.includes('bold') || lower.includes('heavy') || lower.includes('black')
}

function groupItemsByLine(items: TextItemInfo[]): LineInfo[] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => {
    const yDiff = a.y - b.y
    if (Math.abs(yDiff) > 2) return yDiff
    return a.x - b.x
  })

  const lines: LineInfo[] = []
  let currentLine: TextItemInfo[] = [sorted[0]]
  let currentY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i]
    if (Math.abs(item.y - currentY) <= 2) {
      currentLine.push(item)
    } else {
      currentLine.sort((a, b) => a.x - b.x)
      lines.push({ y: currentY, items: currentLine })
      currentLine = [item]
      currentY = item.y
    }
  }

  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x)
    lines.push({ y: currentY, items: currentLine })
  }

  return lines
}

interface PageText {
  pageNum: number
  lines: LineInfo[]
}

export default function PdfToWordPage() {
  const [fileInfo, setFileInfo] = useState<PdfFileInfo | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [converted, setConverted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (selectedFile.type !== 'application/pdf') {
      setError('仅支持 PDF 文件')
      setFileInfo(null)
      return
    }

    setError(null)
    setProgress('')
    setConverted(false)
    setFileInfo({
      file: selectedFile,
      name: selectedFile.name,
      size: formatFileSize(selectedFile.size),
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const removeFile = useCallback(() => {
    setFileInfo(null)
    setError(null)
    setProgress('')
    setConverted(false)
  }, [])

  const extractTextFromPdf = async (file: File): Promise<PageText[]> => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const totalPages = pdf.numPages
    const result: PageText[] = []

    for (let i = 1; i <= totalPages; i++) {
      setProgress(`正在提取文本：第 ${i} / ${totalPages} 页`)
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1 })

      const items: TextItemInfo[] = []

      for (const item of textContent.items) {
        const textItem = item as Record<string, unknown>
        if (typeof textItem.str !== 'string') continue

        const str: string = textItem.str
        const hasEOL: boolean = textItem.hasEOL === true
        const transform = textItem.transform as number[] | undefined
        const height = typeof textItem.height === 'number' ? textItem.height : 12

        let x = 0
        let y = 0
        let fontSize = height

        if (transform && transform.length >= 6) {
          x = transform[4]
          y = viewport.height - transform[5]
          const scaleY = Math.abs(transform[3])
          if (scaleY > 0) fontSize = scaleY
          else if (height > 0) fontSize = height
        }

        const fontName = typeof textItem.fontName === 'string' ? textItem.fontName : ''

        if (str || hasEOL) {
          items.push({ str, x, y, fontSize, fontName, hasEOL })
        }
      }

      const lines = groupItemsByLine(items)
      result.push({ pageNum: i, lines })
    }

    return result
  }

  const convertToWord = useCallback(async () => {
    if (!fileInfo) {
      setError('请先选择 PDF 文件')
      return
    }

    setIsConverting(true)
    setError(null)
    setConverted(false)

    try {
      const pageTexts = await extractTextFromPdf(fileInfo.file)

      let totalTextLength = 0
      for (const page of pageTexts) {
        for (const line of page.lines) {
          for (const item of line.items) {
            totalTextLength += item.str.length
          }
        }
      }

      if (totalTextLength === 0) {
        setError('未能从该 PDF 中提取到文本，可能是扫描件或图片 PDF')
        setIsConverting(false)
        return
      }

      setProgress('正在生成 Word 文档...')

      const paragraphs: Paragraph[] = []

      for (let pageIdx = 0; pageIdx < pageTexts.length; pageIdx++) {
        const page = pageTexts[pageIdx]

        if (pageIdx > 0) {
          paragraphs.push(
            new Paragraph({
              children: [new PageBreak()],
            })
          )
        }

        for (const line of page.lines) {
          const textRuns: TextRun[] = []
          let currentText = ''
          let currentFontSize = 0
          let currentBold = false
          let currentHasChinese = false

          const flushRun = () => {
            if (!currentText) return
            textRuns.push(
              new TextRun({
                text: currentText,
                size: currentFontSize > 0 ? currentFontSize * 2 : undefined,
                bold: currentBold || undefined,
                font: currentHasChinese
                  ? {
                      ascii: 'Times New Roman',
                      hAnsi: 'Times New Roman',
                      eastAsia: '宋体',
                      cs: 'Times New Roman',
                    }
                  : currentFontSize > 0
                    ? undefined
                    : undefined,
              })
            )
            currentText = ''
          }

          for (const item of line.items) {
            const bold = isBoldFont(item.fontName)
            const hasChinese = containsChinese(item.str)
            const fontSize = Math.round(item.fontSize)
            const sameStyle =
              bold === currentBold && fontSize === currentFontSize && hasChinese === currentHasChinese

            if (!sameStyle && currentText) {
              flushRun()
            }

            currentBold = bold
            currentFontSize = fontSize
            currentHasChinese = hasChinese
            currentText += item.str
          }

          flushRun()

          if (textRuns.length > 0) {
            paragraphs.push(new Paragraph({ children: textRuns }))
          } else {
            paragraphs.push(new Paragraph({ children: [] }))
          }
        }
      }

      const doc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: DEFAULT_FONT,
              },
            },
          },
        },
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const baseName = fileInfo.name.replace(/\.pdf$/i, '')
      link.href = url
      link.download = `${baseName}.docx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setConverted(true)
      setProgress('')
    } catch {
      setError('转换失败，请确保文件是有效的 PDF')
    } finally {
      setIsConverting(false)
    }
  }, [fileInfo])

  return (
    <div className="container">
      <h1>PDF 转 Word</h1>
      <p className="subtitle">将 PDF 文件转换为可编辑的 Word 文档</p>

      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          id="file-input"
          className="file-input"
        />
        <label htmlFor="file-input" className="upload-label">
          <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>点击选择 PDF 文件</span>
          <span className="upload-hint">每次选择一个文件</span>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {progress && <p className="progress">{progress}</p>}

      {fileInfo && (
        <div className="file-list">
          <h2>已选择文件</h2>
          <ul>
            <li className="file-item">
              <span className="file-index">1</span>
              <span className="file-name">{fileInfo.name}</span>
              <span className="file-size">{fileInfo.size}</span>
              <div className="file-actions">
                <button
                  type="button"
                  onClick={removeFile}
                  className="btn-icon btn-remove"
                  title="移除"
                  disabled={isConverting}
                >
                  ✕
                </button>
              </div>
            </li>
          </ul>

          <div className="action-buttons">
            <button
              type="button"
              onClick={convertToWord}
              disabled={isConverting}
              className="btn-merge"
            >
              {isConverting ? '转换中...' : '开始转换'}
            </button>
          </div>
        </div>
      )}

      {converted && (
        <p className="success">转换完成，文档已自动下载</p>
      )}
    </div>
  )
}