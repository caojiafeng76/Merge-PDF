import { useState, useCallback, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import PdfPreview from '../PdfPreview'
import '../App.css'
import './ImageToPdfPage.css'

interface ImageFile {
  id: string
  file: File
  name: string
  size: string
  thumbnailUrl: string
}

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]

const ACCEPT_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.gif,.bmp'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function createThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const maxDim = 80
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve('')
    }
    img.src = url
  })
}

async function loadImageAsPng(file: File): Promise<Uint8Array> {
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    return new Uint8Array(await file.arrayBuffer())
  }

  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
  URL.revokeObjectURL(url)

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')
  ctx.drawImage(img, 0, 0)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

export default function ImageToPdfPage() {
  const [files, setFiles] = useState<ImageFile[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return

    const validFiles = Array.from(selectedFiles).filter(f => ACCEPTED_TYPES.includes(f.type))

    if (validFiles.length < selectedFiles.length) {
      setError('仅支持 JPG、PNG、WebP、GIF、BMP 图片格式')
    } else {
      setError(null)
    }

    Promise.all(
      validFiles.map(async (file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: formatFileSize(file.size),
        thumbnailUrl: await createThumbnail(file),
      }))
    ).then((newFiles) => {
      setFiles(prev => [...prev, ...newFiles])
      setPdfBlob(null)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    setError(null)
    setPdfBlob(null)
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
    setPdfBlob(null)
  }, [])

  const convertToPdf = useCallback(async (): Promise<Blob | null> => {
    if (files.length === 0) {
      setError('请至少添加 1 张图片')
      return null
    }

    setIsConverting(true)
    setError(null)

    try {
      const pdfDoc = await PDFDocument.create()

      for (const imageFile of files) {
        const pngBytes = await loadImageAsPng(imageFile.file)

        let embedded
        if (imageFile.file.type === 'image/jpeg') {
          embedded = await pdfDoc.embedJpg(pngBytes)
        } else {
          embedded = await pdfDoc.embedPng(pngBytes)
        }

        const page = pdfDoc.addPage([embedded.width, embedded.height])
        page.drawImage(embedded, {
          x: 0,
          y: 0,
          width: embedded.width,
          height: embedded.height,
        })
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
      setPdfBlob(blob)
      return blob
    } catch {
      setError('转换失败，请确保所有图片格式正确')
      return null
    } finally {
      setIsConverting(false)
    }
  }, [files])

  const handlePreview = useCallback(async () => {
    let blob = pdfBlob
    if (!blob) {
      blob = await convertToPdf()
    }
    if (blob) {
      setShowPreview(true)
    }
  }, [pdfBlob, convertToPdf])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'images.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setShowPreview(false)
  }, [pdfBlob])

  return (
    <div className="container">
      <h1>图片转 PDF</h1>
      <p className="subtitle">将图片转换为 PDF 文件，每张图片一页</p>

      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_EXTENSIONS}
          multiple
          onChange={handleFileSelect}
          id="image-input"
          className="file-input"
        />
        <label htmlFor="image-input" className="upload-label">
          <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>点击选择图片文件</span>
          <span className="upload-hint">支持 JPG、PNG、WebP、GIF、BMP，可多选</span>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {files.length > 0 && (
        <div className="file-list">
          <h2>已选择 {files.length} 张图片</h2>
          <ul>
            {files.map((imageFile, index) => (
              <li key={imageFile.id} className="file-item image-item">
                <span className="file-index">{index + 1}</span>
                {imageFile.thumbnailUrl && (
                  <img
                    src={imageFile.thumbnailUrl}
                    alt={imageFile.name}
                    className="image-thumbnail"
                  />
                )}
                <span className="file-name">{imageFile.name}</span>
                <span className="file-size">{imageFile.size}</span>
                <div className="file-actions">
                  <button
                    type="button"
                    onClick={() => moveFile(imageFile.id, 'up')}
                    disabled={index === 0}
                    className="btn-icon"
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFile(imageFile.id, 'down')}
                    disabled={index === files.length - 1}
                    className="btn-icon"
                    title="下移"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(imageFile.id)}
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
              disabled={isConverting || files.length === 0}
              className="btn-preview"
            >
              {isConverting ? '处理中...' : '预览效果'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!pdfBlob}
              className="btn-merge"
            >
              直接下载
            </button>
          </div>
        </div>
      )}

      {showPreview && (
        <PdfPreview
          pdfBlob={pdfBlob}
          onClose={() => setShowPreview(false)}
          onDownload={handleDownload}
        />
      )}
    </div>
  )
}
