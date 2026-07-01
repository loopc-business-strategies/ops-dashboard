import React from 'react'
import { getTenantBranding } from '../config/tenantBranding'
import { useAuth } from '../context/AuthContext'

const DEFAULT_EMBED_URL = import.meta.env.VITE_SALES_MANAGER_AI_EMBED_URL
  || import.meta.env.VITE_SALES_MANAGER_AI_URL
  || 'https://sales.loopcstrategies.com/embed'

/**
 * Optional in-dashboard iframe embed for Sales Manager AI (Phase 3).
 * Opens standalone app inside LoopC when navigated to /sales-ai/embed.
 */
export default function SalesAiEmbed() {
  const { company } = useAuth()
  const branding = getTenantBranding(company)
  const embedUrl = branding?.externalNavItems?.find((i) => i.id === 'sales-manager-ai')?.embedHref
    || DEFAULT_EMBED_URL

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8f9fa' }}>
      <div style={{ padding: '0.5rem 1rem', background: '#1C2A33', color: '#fff', fontSize: '0.9rem' }}>
        Sales Manager AI
        <a href={embedUrl.replace(/\/embed$/, '')} target="_blank" rel="noopener noreferrer" style={{ color: '#13AA52', marginLeft: 12 }}>
          Open in new tab
        </a>
      </div>
      <iframe
        title="Sales Manager AI"
        src={embedUrl}
        style={{ flex: 1, border: 'none', width: '100%' }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}
