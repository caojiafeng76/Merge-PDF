import { useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import '../App.css'
import './ExcelMergePage.css'

interface ExcelFile {
  id: string
  file: File
  name: string
  size: string
  sheetNames: string[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function sanitizeSheetName(name: string): string {
  let sanitized = name.replace(/[\\/*?[\]:]/g, '_')
  if (sanitized.length > 31) {
    sanitized = sanitized.substring(0, 31)
  }
  return sanitized
}

export default function ExcelMergePage() {
  const [files, setFiles] = useState<ExcelFile[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return

    const validExts = ['.xlsx', '.xls', '.csv', '.xlsm', '.xlsb']
    const MAX_SIZE = 50 * 1024 * 1024 // 50MB
    const newFiles: ExcelFile[] = []
    let readError: string | null = null

    for (const file of Array.from(selectedFiles)) {
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
      if (!validExts.includes(ext)) continue

      if (file.size > MAX_SIZE) {
        readError = `文件过大: ${file.name}，最大支持 50MB`
        continue
      }

      try {
        const binaryString = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsBinaryString(file)
        })
        const workbook = XLSX.read(binaryString, { type: 'binary', WTF: true })
        newFiles.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: formatFileSize(file.size),
          sheetNames: workbook.SheetNames,
        })
      } catch (err) {
        console.error('Excel read error:', err)
        readError = `无法读取文件: ${file.name}`
      }
    }

    if (newFiles.length === 0 && selectedFiles.length > 0) {
      setError(readError ?? '仅支持 Excel 文件（.xlsx, .xls, .csv）')
    } else {
      setError(readError)
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

  const mergeExcelFiles = useCallback(async (): Promise<Blob | null> => {
    if (files.length < 2) {
      setError('请至少添加 2 个 Excel 文件')
      return null
    }

    setIsMerging(true)
    setError(null)

    try {
      const mergedWorkbook = XLSX.utils.book_new()
      const usedNames = new Set<string>()

      for (const excelFile of files) {
        const arrayBuffer = await excelFile.file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const fileName = excelFile.name.replace(/\.[^.]+$/, '')

        for (const sheetName of workbook.SheetNames) {
          let targetName = sanitizeSheetName(`${fileName}_${sheetName}`)

          if (usedNames.has(targetName)) {
            let suffix = 1
            while (usedNames.has(`${targetName}_${suffix}`)) {
              suffix++
            }
            targetName = `${targetName}_${suffix}`
          }

          usedNames.add(targetName)
          const worksheet = workbook.Sheets[sheetName]
          XLSX.utils.book_append_sheet(mergedWorkbook, worksheet, targetName)
        }
      }

      const wbout = XLSX.write(mergedWorkbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      setMergedBlob(blob)
      return blob
    } catch {
      setError('合并失败，请确保所有文件都是有效的 Excel 文件')
      return null
    } finally {
      setIsMerging(false)
    }
  }, [files])

  const handleDownload = useCallback(async () => {
    let blob = mergedBlob
    if (!blob) {
      blob = await mergeExcelFiles()
    }
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'merged.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [mergedBlob, mergeExcelFiles])

  const totalSheets = files.reduce((sum, f) => sum + f.sheetNames.length, 0)

  return (
    <div className="container">
      <h1>Excel 合并工具</h1>
      <p className="subtitle">将多个 Excel 文件合并为一个，每个工作表保留为独立 Sheet</p>

      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.xlsm,.xlsb"
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
          <span>点击选择 Excel 文件</span>
          <span className="upload-hint">支持 .xlsx .xls .csv，可多选</span>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {files.length > 0 && (
        <div className="file-list">
          <h2>已选择 {files.length} 个文件（共 {totalSheets} 个工作表）</h2>
          <ul>
            {files.map((excelFile, index) => (
              <li key={excelFile.id} className="file-item">
                <span className="file-index">{index + 1}</span>
                <div className="file-info">
                  <span className="file-name">{excelFile.name}</span>
                  <span className="file-sheets">
                    工作表: {excelFile.sheetNames.join('、')}
                  </span>
                </div>
                <span className="file-size">{excelFile.size}</span>
                <div className="file-actions">
                  <button
                    type="button"
                    onClick={() => moveFile(excelFile.id, 'up')}
                    disabled={index === 0}
                    className="btn-icon"
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFile(excelFile.id, 'down')}
                    disabled={index === files.length - 1}
                    className="btn-icon"
                    title="下移"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(excelFile.id)}
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
              onClick={handleDownload}
              disabled={isMerging || files.length < 2}
              className="btn-merge"
            >
              {isMerging ? '合并中...' : '合并并下载'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}