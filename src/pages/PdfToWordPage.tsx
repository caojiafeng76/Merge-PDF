import { useState, useCallback, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Document, Paragraph, TextRun, Packer } from 'docx'
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

interface PageText {
  pageNum: number
  paragraphs: string[]
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

      const lines: string[] = []
      let currentLine = ''

      for (const item of textContent.items) {
        const textItem = item as Record<string, unknown>
        if (typeof textItem.str === 'string') {
          currentLine += textItem.str
          if (textItem.hasEOL === true) {
            const trimmed = currentLine.trim()
            if (trimmed) lines.push(trimmed)
            currentLine = ''
          }
        }
      }

      const last = currentLine.trim()
      if (last) lines.push(last)

      result.push({ pageNum: i, paragraphs: lines })
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

      const totalTextLength = pageTexts.reduce(
        (sum, p) => sum + p.paragraphs.reduce((s, t) => s + t.length, 0),
        0
      )
      if (totalTextLength === 0) {
        setError('未能从该 PDF 中提取到文本，可能是扫描件或图片 PDF')
        setIsConverting(false)
        return
      }

      setProgress('正在生成 Word 文档...')

      const paragraphs: Paragraph[] = []
      for (const page of pageTexts) {
        for (const text of page.paragraphs) {
          paragraphs.push(
            new Paragraph({ children: [new TextRun({ text })] })
          )
        }
        paragraphs.push(new Paragraph({ children: [] }))
      }

      const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }],
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
