import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfPreviewProps {
  pdfBlob: Blob | null
  onClose: () => void
  onDownload: () => void
}

export default function PdfPreview({ pdfBlob, onClose, onDownload }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (!pdfBlob || !containerRef.current) return

    const container = containerRef.current
    container.innerHTML = ''
    pageRefs.current.clear()

    const loadPdf = async () => {
      const arrayBuffer = await pdfBlob.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      setTotalPages(pdf.numPages)

      await new Promise(resolve => requestAnimationFrame(resolve))

      const containerWidth = container.clientWidth - 40
      if (containerWidth <= 0) return

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const baseViewport = page.getViewport({ scale: 1 })
        const scale = Math.min(containerWidth / baseViewport.width, 2)
        const viewport = page.getViewport({ scale })

        const pageDiv = document.createElement('div')
        pageDiv.className = 'preview-page'
        pageDiv.setAttribute('data-page', String(i))

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        pageDiv.appendChild(canvas)
        container.appendChild(pageDiv)
        pageRefs.current.set(i, pageDiv)
      }
    }

    loadPdf()
  }, [pdfBlob])

  useEffect(() => {
    const container = containerRef.current
    if (!container || totalPages === 0) return

    const handleScroll = () => {
      let closest = 1
      let minDist = Infinity
      const midY = container.scrollTop + container.clientHeight / 2
      pageRefs.current.forEach((el, pageNum) => {
        const elMid = el.offsetTop + el.offsetHeight / 2
        const dist = Math.abs(elMid - midY)
        if (dist < minDist) {
          minDist = dist
          closest = pageNum
        }
      })
      setCurrentPage(closest)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [totalPages])

  const scrollToPage = (page: number) => {
    const container = containerRef.current
    if (!container) return
    const el = pageRefs.current.get(page)
    if (!el) return
    container.scrollTo({
      top: el.offsetTop - 20,
      behavior: 'smooth',
    })
  }

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={e => e.stopPropagation()}>
        <div className="preview-header">
          <h2>合并预览</h2>
          <div className="preview-nav">
            <span>第 {currentPage} / {totalPages} 页</span>
            <button
              type="button"
              className="btn-icon"
              onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              ↓
            </button>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="preview-content" ref={containerRef} />
        <div className="preview-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            返回修改
          </button>
          <button type="button" className="btn-merge" onClick={onDownload}>
            确认下载
          </button>
        </div>
      </div>
    </div>
  )
}