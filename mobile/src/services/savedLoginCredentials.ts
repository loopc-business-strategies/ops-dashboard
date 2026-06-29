import * as SecureStore from 'expo-secure-store'

const REMEMBER_KEY = 'nexa_remember_login'
const COMPANY_KEY = 'nexa_saved_company_code'
const USERNAME_KEY = 'nexa_saved_username'
const LEGACY_PASSWORD_KEY = 'nexa_saved_password'

export type SavedLoginCredentials = {
  remember: boolean
  companyCode: string
  name: string
}

export async function loadSavedLoginCredentials(): Promise<SavedLoginCredentials> {
  const remember = (await SecureStore.getItemAsync(REMEMBER_KEY)) === '1'
  if (!remember) {
    return { remember: false, companyCode: '', name: '' }
  }
  const [companyCode, name, legacyPassword] = await Promise.all([
    SecureStore.getItemAsync(COMPANY_KEY),
    SecureStore.getItemAsync(USERNAME_KEY),
    SecureStore.getItemAsync(LEGACY_PASSWORD_KEY),
  ])
  if (legacyPassword) {
    await SecureStore.deleteItemAsync(LEGACY_PASSWORD_KEY)
  }
  return {
    remember: true,
    companyCode: companyCode || '',
    name: name || '',
  }
}

export async function saveLoginCredentials(input: {
  companyCode: string
  name: string
}): Promise<void> {
  await SecureStore.setItemAsync(REMEMBER_KEY, '1')
  await SecureStore.setItemAsync(COMPANY_KEY, input.companyCode.trim().toLowerCase())
  await SecureStore.setItemAsync(USERNAME_KEY, input.name.trim())
  await SecureStore.deleteItemAsync(LEGACY_PASSWORD_KEY)
}

export async function clearSavedLoginCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(REMEMBER_KEY),
    SecureStore.deleteItemAsync(COMPANY_KEY),
    SecureStore.deleteItemAsync(USERNAME_KEY),
    SecureStore.deleteItemAsync(LEGACY_PASSWORD_KEY),
  ])
}
