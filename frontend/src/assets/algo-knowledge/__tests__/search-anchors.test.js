import { describe, it, expect } from 'vitest'
import index from '../index.json'
import searchMd from '../search.md?raw'
import { slugifyHeading } from '../../../utils/simpleMarkdown.js'

const cat = index.categories.find(c => c.id === 'search-and-find')

describe('search-and-find category anchors', () => {
  it('exists with expected anchors', () => {
    expect(cat).toBeTruthy()
    expect(cat.title).toBe('查找')
    expect(cat.anchors).toHaveLength(5)
  })

  it('every anchor id matches the slug of a ## heading in search.md', () => {
    const headings = searchMd
      .split('\n')
      .filter(line => line.startsWith('## '))
      .map(line => line.replace(/^##\s+/, '').trim())
    for (const a of cat.anchors) {
      expect(headings.some(h => slugifyHeading(h) === a.id)).toBe(true)
    }
  })
})
