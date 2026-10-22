/**
 * scroll-memory: the scroll positions of a page kept alive by <keep-alive>,
 * whose DOM is detached (and its scrollTop reset) while another page shows.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { remember, restore } from '../src/services/scroll-memory.js'

afterEach(() => {
  document.body.innerHTML = ''
})

function page() {
  const root = document.createElement('div')
  root.innerHTML = '<div class="list"></div><div class="other"></div>'
  document.body.appendChild(root)
  return { root, list: root.querySelector('.list'), other: root.querySelector('.other') }
}

describe('scroll-memory', () => {
  it('should put back the positions of the scrolled elements once the page is back', () => {
    const { root, list, other } = page()
    list.scrollTop = 300
    remember('define', root)

    root.remove()
    list.scrollTop = 0
    document.body.appendChild(root)
    restore('define')

    expect(list.scrollTop).toBe(300)
    expect(other.scrollTop).toBe(0)
  })

  it('should keep each page apart, and restore a page only once', () => {
    const define = page()
    const search = page()
    define.list.scrollTop = 120
    search.list.scrollTop = 40
    remember('define', define.root)
    remember('search', search.root)

    define.list.scrollTop = 0
    search.list.scrollTop = 0
    restore('search')
    expect(search.list.scrollTop).toBe(40)
    expect(define.list.scrollTop).toBe(0)

    search.list.scrollTop = 0
    restore('search')
    expect(search.list.scrollTop).toBe(0)
  })

  it('should skip elements that are no longer in the document', () => {
    const { root, list } = page()
    list.scrollTop = 50
    remember('split', root)
    root.remove()

    expect(() => restore('split')).not.toThrow()
  })
})
