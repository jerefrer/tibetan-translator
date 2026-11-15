/**
 * Feedback: the mailto: link Send feedback opens.
 */
import { describe, it, expect } from 'vitest'

import { FEEDBACK_ADDRESS, feedbackMailto } from '../src/services/feedback'

const parts = (url) => {
  const [address, query] = url.replace('mailto:', '').split('?')
  const params = new URLSearchParams(query)
  return { address, subject: params.get('subject'), body: params.get('body') }
}

describe('feedbackMailto', () => {
  it('should address the project mailbox when building the link', () => {
    const { address } = parts(feedbackMailto({ version: '1.12.0', platform: 'macOS' }))
    expect(address).toBe(FEEDBACK_ADDRESS)
    expect(FEEDBACK_ADDRESS).toBe('feedback@tibetantoolbox.org')
  })

  it('should encode the subject when it has spaces', () => {
    const url = feedbackMailto({ version: '1.12.0', platform: 'macOS' })
    expect(url).toContain('subject=Tibetan%20Translator%20feedback')
    expect(parts(url).subject).toBe('Tibetan Translator feedback')
  })

  it('should leave room to write and sign with the version and platform when the app has a version', () => {
    const { body } = parts(feedbackMailto({ version: '1.12.0', platform: 'Windows' }))
    expect(body).toBe('\n\n\n—\nTibetan Translator 1.12.0\nPlatform: Windows')
  })

  it('should say web when there is no version', () => {
    const { body } = parts(feedbackMailto({ version: null, platform: 'Web' }))
    expect(body).toContain('Tibetan Translator (web)')
    expect(body).toContain('Platform: Web')
  })
})
