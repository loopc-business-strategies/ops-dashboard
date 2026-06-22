import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as SecureStore from 'expo-secure-store'
import {
  clearSavedLoginCredentials,
  loadSavedLoginCredentials,
  saveLoginCredentials,
} from './savedLoginCredentials'

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}))

describe('savedLoginCredentials', () => {
  beforeEach(() => {
    vi.mocked(SecureStore.getItemAsync).mockReset()
    vi.mocked(SecureStore.setItemAsync).mockReset()
    vi.mocked(SecureStore.deleteItemAsync).mockReset()
  })

  it('returns empty when remember flag is not set', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
    await expect(loadSavedLoginCredentials()).resolves.toEqual({
      remember: false,
      companyCode: '',
      name: '',
      password: '',
    })
  })

  it('loads saved credentials when remember flag is set', async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => {
      if (key === 'nexa_remember_login') return '1'
      if (key === 'nexa_saved_company_code') return 'mg'
      if (key === 'nexa_saved_username') return 'admin'
      if (key === 'nexa_saved_password') return 'secret'
      return null
    })
    await expect(loadSavedLoginCredentials()).resolves.toEqual({
      remember: true,
      companyCode: 'mg',
      name: 'admin',
      password: 'secret',
    })
  })

  it('persists credentials to secure store', async () => {
    await saveLoginCredentials({ companyCode: 'mg', name: 'user', password: 'pw' })
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('nexa_remember_login', '1')
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('nexa_saved_company_code', 'mg')
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('nexa_saved_username', 'user')
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('nexa_saved_password', 'pw')
  })

  it('clears all saved credential keys', async () => {
    await clearSavedLoginCredentials()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(4)
  })
})
