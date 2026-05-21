import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createContentDisposition,
  getPdfFilename,
  isSupportedWordFilename,
} from './word-to-pdf.mjs'

describe('word-to-pdf helpers', () => {
  it('accepts Word filenames and rejects other files', () => {
    assert.equal(isSupportedWordFilename('report.docx'), true)
    assert.equal(isSupportedWordFilename('legacy.DOC'), true)
    assert.equal(isSupportedWordFilename('report.pdf'), false)
    assert.equal(isSupportedWordFilename('report.docx.exe'), false)
  })

  it('creates a PDF filename from a Word filename', () => {
    assert.equal(getPdfFilename('合同模板.docx'), '合同模板.pdf')
    assert.equal(getPdfFilename('legacy.doc'), 'legacy.pdf')
  })

  it('encodes Chinese download filenames for content disposition', () => {
    const header = createContentDisposition('合同模板.pdf')

    assert.match(header, /^attachment;/)
    assert.match(header, /filename="download\.pdf"/)
    assert.match(header, /filename\*=UTF-8''%E5%90%88%E5%90%8C%E6%A8%A1%E6%9D%BF\.pdf/)
  })
})
