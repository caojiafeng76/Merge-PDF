import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_CJK_FONT_URLS,
  getHtmlDocument,
  isAllowedRenderRequestUrl,
} from './docx-html-pdf.mjs'

describe('DOCX HTML PDF rendering', () => {
  it('injects an online Noto Sans SC font by default', () => {
    const html = getHtmlDocument('<p>中文测试</p>')

    assert.match(html, /font-family: 'Noto Sans SC'/)
    assert.match(html, /noto-sans-sc-chinese-simplified-400-normal\.woff2/)
    assert.match(html, /noto-sans-sc-chinese-simplified-700-normal\.woff2/)
  })

  it('allows the bundled online font URLs while blocking arbitrary network requests', () => {
    assert.equal(isAllowedRenderRequestUrl(DEFAULT_CJK_FONT_URLS.regular), true)
    assert.equal(isAllowedRenderRequestUrl(DEFAULT_CJK_FONT_URLS.bold), true)
    assert.equal(isAllowedRenderRequestUrl('data:image/png;base64,abc'), true)
    assert.equal(isAllowedRenderRequestUrl('https://example.com/tracker.js'), false)
  })
})
