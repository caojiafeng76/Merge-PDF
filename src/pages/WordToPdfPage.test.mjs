import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('WordToPdfPage error state', () => {
  it('clears progress text when conversion fails', async () => {
    const source = await readFile(new URL('./WordToPdfPage.tsx', import.meta.url), 'utf8')

    assert.match(source, /catch\s*\([^)]*\)\s*\{[^}]*setProgress\(''\)/s)
  })
})
