// FILE: src/pages/Login.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { applyTenantTheme, getTenantBranding, isLocalTenantHost, resolveTenantFromHostname, resolveTenantFromSearch } from '../config/tenantBranding'
import TenantLoginShell from './TenantLoginShell'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useLanguage()

  const storedTenant = localStorage.getItem('tenantCompany') || 'loopc'
  const hostTenant = resolveTenantFromHostname(window.location.hostname, storedTenant)
  const company = resolveTenantFromSearch(window.location.search, hostTenant)
  const isPlainLocalHost = isLocalTenantHost(window.location.hostname)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [idleNotice, setIdleNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const branding = getTenantBranding(company)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'idle') {
      setIdleNotice(t('loginIdleMessage'))
    }
  }, [t])

  useEffect(() => {
    return applyTenantTheme(branding.colors)
  }, [branding])

  useEffect(() => {
    if (!isPlainLocalHost) return
    if (window.location.search.includes('company=') || window.location.search.includes('tenant=')) return

    const target = new URL(window.location.href)
    target.hostname = `${company}.localhost`
    window.location.replace(target.toString())
  }, [company, isPlainLocalHost])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!company || !name.trim() || !password) return setError(t('loginErrEmpty'))
    setLoading(true)
    setError('')
    try {
      await login(name.trim(), password, company)
      const dashboardPath = window.location.search.includes('company=') || window.location.search.includes('tenant=')
        ? `/dashboard${window.location.search}`
        : (isPlainLocalHost ? `/dashboard?company=${company}` : '/dashboard')
      navigate(dashboardPath)
    } catch (err) {
      setLoading(false)
      if (!err.response) {
        setError(t('loginErrNetwork'))
      } else if (err.response.status >= 500) {
        setError(t('loginErrServer'))
      } else {
        setError(err.response?.data?.message || t('loginErrInvalid'))
      }
    }
  }

  return (
    <TenantLoginShell
      branding={branding}
      name={name}
      setName={setName}
      password={password}
      setPassword={setPassword}
      error={error}
      idleNotice={idleNotice}
      setError={setError}
      loading={loading}
      showPass={showPass}
      setShowPass={setShowPass}
      handleSubmit={handleSubmit}
      t={t}
    />
  )
}

export default Login
