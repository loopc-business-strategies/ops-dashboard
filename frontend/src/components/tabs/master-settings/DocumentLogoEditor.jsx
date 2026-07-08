import { useRef } from 'react'
import {
  LOGO_UPLOAD_ACCEPT,
  LOGO_UPLOAD_MAX_BYTES,
  clampBrandingDimension,
  isSupportedLogoUpload,
  normalizeLogoUploadToDataUrl,
} from '../erp/ERPBrandingUtils'

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 13,
}

export default function DocumentLogoEditor({
  branding,
  onChange,
  layoutSettings = {},
  onLayoutChange,
  showTransparentToggle = true,
}) {
  const fileRef = useRef(null)

  const handleFile = async (file) => {
    if (!file) return
    if (!isSupportedLogoUpload(file)) {
      onChange({ error: 'Logo upload supports PNG, SVG, JPEG, and WebP files.' })
      return
    }
    if (Number(file.size || 0) > LOGO_UPLOAD_MAX_BYTES) {
      onChange({ error: 'Logo file is too large. Maximum size is 3 MB.' })
      return
    }
    try {
      const logoUrl = await normalizeLogoUploadToDataUrl(file)
      onChange({ logoUrl, error: '' })
    } catch {
      onChange({ error: 'Failed to process logo file.' })
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Company logo</label>
        <input
          ref={fileRef}
          type="file"
          accept={LOGO_UPLOAD_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            void handleFile(file)
            e.target.value = ''
          }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            Upload logo
          </button>
          {branding.logoUrl ? (
            <button
              type="button"
              onClick={() => onChange({ logoUrl: '', error: '' })}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}
            >
              Remove
            </button>
          ) : null}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6B7280' }}>
          PNG, SVG, JPEG, or WebP. Images are normalized for print; transparency is preserved when supported.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <label style={{ fontSize: 12, color: '#6B7280' }}>
          Width
          <input
            type="number"
            min="80"
            max="260"
            value={branding.logoWidth}
            onChange={(e) => onChange({
              logoWidth: clampBrandingDimension(e.target.value, branding.logoWidth, 80, 260),
            })}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, color: '#6B7280' }}>
          Height
          <input
            type="number"
            min="32"
            max="120"
            value={branding.logoHeight}
            onChange={(e) => onChange({
              logoHeight: clampBrandingDimension(e.target.value, branding.logoHeight, 32, 120),
            })}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, color: '#6B7280' }}>
          Fit
          <select
            value={branding.logoFit || 'contain'}
            onChange={(e) => onChange({ logoFit: e.target.value })}
            style={{ ...inputStyle, marginTop: 4 }}
          >
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="fill">Fill</option>
          </select>
        </label>
      </div>

      {showTransparentToggle && onLayoutChange ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={layoutSettings.logoTransparent !== false}
            onChange={(e) => onLayoutChange({ logoTransparent: e.target.checked })}
          />
          Transparent logo background when printing
        </label>
      ) : null}
    </div>
  )
}
