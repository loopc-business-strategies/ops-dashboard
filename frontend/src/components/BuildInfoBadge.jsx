import { useEffect, useMemo, useState } from 'react'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const HEALTH_URL = API_ORIGIN ? `${API_ORIGIN}/api/health` : '/api/health'

function formatBuildStamp(meta, fallbackVersion = '0.0.0') {
  const version = String(meta?.version || fallbackVersion)
  const sha = String(meta?.sha || 'unknown').slice(0, 7)
  return `v${version} · ${sha}`
}

function BuildInfoBadge({ tone = 'dark', className = '' }) {
  const frontendMeta = useMemo(
    () => (typeof __APP_BUILD_META__ === 'object' && __APP_BUILD_META__
      ? __APP_BUILD_META__
      : { version: '0.0.0', sha: 'unknown', builtAt: '' }),
    [],
  )

  const [backendMeta, setBackendMeta] = useState({ version: '0.0.0', sha: 'unknown', builtAt: '' })

  useEffect(() => {
    let active = true

    const loadBackendBuild = async () => {
      try {
        const response = await fetch(HEALTH_URL, { method: 'GET', credentials: 'include' })
        if (!response.ok) return
        const payload = await response.json()
        const build = payload?.build || payload?.backend || {}
        const resolvedBackendSha = String(build.sha || build.commit || payload?.commit || 'unknown')
        if (!active) return
        setBackendMeta({
          version: String(build.version || '0.0.0'),
          sha: resolvedBackendSha,
          builtAt: String(build.builtAt || ''),
        })
      } catch {
        // Keep default unknown backend build metadata when health is unreachable.
      }
    }

    loadBackendBuild()
    return () => { active = false }
  }, [])

  const frontendStamp = useMemo(() => formatBuildStamp(frontendMeta, '0.0.0'), [frontendMeta])
  const backendStamp = useMemo(() => formatBuildStamp(backendMeta, '0.0.0'), [backendMeta])

  const titleSegments = [
    `Frontend ${frontendStamp}${frontendMeta?.builtAt ? ` · ${new Date(frontendMeta.builtAt).toLocaleString('en-GB')}` : ''}`,
    `Backend ${backendStamp}${backendMeta?.builtAt ? ` · ${new Date(backendMeta.builtAt).toLocaleString('en-GB')}` : ''}`,
  ]

  const badgeStyle = tone === 'light'
    ? { background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#312E81' }
    : { background: 'rgba(15,23,42,0.3)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.88)' }

  return (
    <span
      className={className}
      title={titleSegments.join('\n')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.45rem',
        borderRadius: '0.5rem',
        padding: '0.28rem 0.55rem',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.01em',
        ...badgeStyle,
      }}
    >
      FE {frontendStamp}
      <span style={{ opacity: 0.5 }}>|</span>
      BE {backendStamp}
    </span>
  )
}

export default BuildInfoBadge