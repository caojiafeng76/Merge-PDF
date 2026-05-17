import { useState, useCallback, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import PdfPreview from '../PdfPreview'
import '../App.css'
import './PdfMergePage.css'

interface PdfFile {
  id: string
  file: File
  name: string
  size: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function PdfMergePage() {
  const [files, setFiles] = useState<PdfFile[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return

    const newFiles: PdfFile[] = Array.from(selectedFiles)
      .filter(file => file.type === 'application/pdf')
      .map(file => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: formatFileSize(file.size),
      }))

    if (newFiles.length < selectedFiles.length) {
      setError('仅支持 PDF 文件')
    } else {
      setError(null)
    }

    setFiles(prev => [...prev, ...newFiles])
    setMergedBlob(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    setError(null)
    setMergedBlob(null)
  }, [])

  const moveFile = useCallback((id: string, direction: 'up' | 'down') => {
    setFiles(prev => {
      const index = prev.findIndex(f => f.id === id)
      if (index === -1) return prev
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const newFiles = [...prev]
      const temp = newFiles[index]
      newFiles[index] = newFiles[newIndex]
      newFiles[newIndex] = temp
      return newFiles
    })
    setMergedBlob(null)
  }, [])

  const mergePdfs = useCallback(async (): Promise<Blob | null> => {
    if (files.length < 2) {
      setError('请至少添加 2 个 PDF 文件')
      return null
    }

    setIsMerging(true)
    setError(null)

    try {
      const mergedPdf = await PDFDocument.create()

      for (const pdfFile of files) {
        const arrayBuffer = await pdfFile.file.arrayBuffer()
        const pdf = await PDFDocument.load(arrayBuffer)
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        copiedPages.forEach(page => mergedPdf.addPage(page))
      }

      const mergedBytes = await mergedPdf.save()
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: 'application/pdf' })
      setMergedBlob(blob)
      return blob
    } catch {
      setError('合并失败，请确保所有文件都是有效的 PDF')
      return null
    } finally {
      setIsMerging(false)
    }
  }, [files])

  const handlePreview = useCallback(async () => {
    let blob = mergedBlob
    if (!blob) {
      blob = await mergePdfs()
    }
    if (blob) {
      setShowPreview(true)
    }
  }, [mergedBlob, mergePdfs])

  const handleDownload = useCallback(() => {
    if (!mergedBlob) return
    const url = URL.createObjectURL(mergedBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'merged.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setShowPreview(false)
  }, [mergedBlob])

  return (
    <div className="container">
      <h1>PDF 合并工具</h1>
      <p className="subtitle">将多个 PDF 文件合并为一个</p>

      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          id="file-input"
          className="file-input"
        />
        <label htmlFor="file-input" className="upload-label">
          <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>点击选择 PDF 文件</span>
          <span className="upload-hint">支持多选</span>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {files.length > 0 && (
        <div className="file-list">
          <h2>已选择 {files.length} 个文件</h2>
          <ul>
            {files.map((pdfFile, index) => (
              <li key={pdfFile.id} className="file-item">
                <span className="file-index">{index + 1}</span>
                <span className="file-name">{pdfFile.name}</span>
                <span className="file-size">{pdfFile.size}</span>
                <div className="file-actions">
                  <button
                    type="button"
                    onClick={() => moveFile(pdfFile.id, 'up')}
                    disabled={index === 0}
                    className="btn-icon"
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFile(pdfFile.id, 'down')}
                    disabled={index === files.length - 1}
                    className="btn-icon"
                    title="下移"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(pdfFile.id)}
                    className="btn-icon btn-remove"
                    title="移除"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="action-buttons">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isMerging || files.length < 2}
              className="btn-preview"
            >
              {isMerging ? '处理中...' : '预览合并效果'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!mergedBlob}
              className="btn-merge"
            >
              直接下载
            </button>
          </div>
        </div>
      )}

      {showPreview && (
        <PdfPreview
          pdfBlob={mergedBlob}
          onClose={() => setShowPreview(false)}
          onDownload={handleDownload}
        />
      )}
    </div>
  )
}
