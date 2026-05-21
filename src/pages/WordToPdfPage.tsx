import { useState, useCallback, useRef } from 'react'
import '../App.css'
import './WordToPdfPage.css'

interface WordFileInfo {
  file: File
  name: string
  size: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function isWordFile(file: File): boolean {
  return /\.docx?$/i.test(file.name)
}

function getPdfFilename(filename: string): string {
  return filename.replace(/\.docx?$/i, '') + '.pdf'
}

function getDownloadFilename(header: string | null, fallback: string): string {
  if (!header) return fallback

  const encodedMatch = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1])
    } catch {
      return fallback
    }
  }

  const quotedMatch = header.match(/filename="([^"]+)"/i)
  return quotedMatch?.[1] ?? fallback
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string }
    return payload.error ?? '转换失败，请稍后重试'
  } catch {
    return '转换失败，请稍后重试'
  }
}

export default function WordToPdfPage() {
  const [fileInfo, setFileInfo] = useState<WordFileInfo | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [converted, setConverted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!isWordFile(selectedFile)) {
      setError('仅支持 Word 文件（.doc 或 .docx）')
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

  const convertToPdf = useCallback(async () => {
    if (!fileInfo) {
      setError('请先选择 Word 文件')
      return
    }

    setIsConverting(true)
    setError(null)
    setConverted(false)

    try {
      setProgress('正在上传 Word 文件...')
      const formData = new FormData()
      formData.append('file', fileInfo.file, fileInfo.name)

      const response = await fetch('/api/word-to-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      setProgress('正在下载 PDF...')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = getDownloadFilename(
        response.headers.get('Content-Disposition'),
        getPdfFilename(fileInfo.name)
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setConverted(true)
      setProgress('')
    } catch (err) {
      setProgress('')
      setError(err instanceof Error ? err.message : '转换失败，请确保文件是有效的 Word 文档')
    } finally {
      setIsConverting(false)
    }
  }, [fileInfo])

  return (
    <div className="container">
      <h1>Word 转 PDF</h1>
      <p className="subtitle">后端生成文本型 PDF，避免截图式转换</p>

      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.doc"
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
          <span>点击选择 Word 文件</span>
          <span className="upload-hint">支持 .doc 和 .docx 格式</span>
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
              onClick={convertToPdf}
              disabled={isConverting}
              className="btn-merge"
            >
              {isConverting ? '转换中...' : '开始转换'}
            </button>
          </div>
        </div>
      )}

      {converted && (
        <p className="success">转换完成，PDF 已自动下载</p>
      )}
    </div>
  )
}
