/**
 * What decides whether App.vue shows the first-launch screen (W1, W2) and what
 * finishing it stores (S1). Uses the real PackManager with Tauri mocked out.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const env = vi.hoisted(() => ({ modular: true }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), convertFileSrc: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('../src/config/platform', () => ({
  supportsModularPacks: () => env.modular,
  isMobile: () => false,
}))

import PackManager from '../src/services/pack-manager'
import Storage from '../src/services/storage'

beforeEach(() => {
  env.modular = true
  localStorage.clear()
})

describe('onboarding flags', () => {
  it('W1 is never shown in the web build', () => {
    env.modular = false
    expect(PackManager.shouldShowOnboarding()).toBe(false)
  })

  it('W2 is shown in the app until onboarding has been completed', () => {
    expect(PackManager.shouldShowOnboarding()).toBe(true)
    PackManager.completeOnboarding()
    expect(PackManager.shouldShowOnboarding()).toBe(false)
  })

  it('S1 completing stores onboardingComplete and onboardingVersion', () => {
    PackManager.completeOnboarding()
    expect(Storage.get('onboardingComplete')).toBe(true)
    expect(Storage.get('onboardingVersion')).toBe(1)
  })

  it('S1 resetting brings the screen back', () => {
    PackManager.completeOnboarding()
    PackManager.resetOnboarding()
    expect(PackManager.shouldShowOnboarding()).toBe(true)
  })
})
