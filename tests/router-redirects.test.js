import { describe, it, expect } from 'vitest'
import router from '../src/router.js'

describe('router', () => {
  it('should redirect the old glossary route, keeping pack and dictionary', async () => {
    await router.push('/lexicon/custom-a/2')
    expect(router.currentRoute.value.fullPath).toBe('/glossary/custom-a/2')
  })

  it('should redirect the bare old glossary route', async () => {
    await router.push('/lexicon')
    expect(router.currentRoute.value.path).toBe('/glossary')
  })

  it('should keep the query string when redirecting', async () => {
    await router.push('/lexicon/custom-a?x=1')
    expect(router.currentRoute.value.fullPath).toBe('/glossary/custom-a?x=1')
  })

  it('should resolve the dictionaries page', () => {
    expect(router.resolve('/dictionaries').matched.length).toBe(1)
  })

  it('should keep the existing page routes', () => {
    for (const path of ['/define', '/define/abc', '/search', '/search/abc', '/segment', '/settings']) {
      expect(router.resolve(path).matched.length, path).toBe(1)
    }
  })
})
