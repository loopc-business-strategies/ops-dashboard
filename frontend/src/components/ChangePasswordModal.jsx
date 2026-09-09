import React, { useState } from 'react'
import axios from '../api/client'
import authAPI from '../api/auth'

/**
 * Self-service change password modal for any logged-in user.
 */
export default function ChangePasswordModal({ onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      return setError('All fields are required.')
    }
    if (newPassword.length < 8) {
      return setError('New password must be at least 8 characters.')
    }
    if (newPassword !== confirmPassword) {
      return setError('New password and confirmation do not match.')
    }
    if (newPassword === currentPassword) {
      return setError('New password must be different from the current password.')
    }

    setSaving(true)
    try {
      const data = await authAPI.changePassword(currentPassword, newPassword)
      if (data?.csrfToken) {
        axios.defaults.headers.common['x-csrf-token'] = data.csrfToken
      }
      onSuccess?.()
      onClose?.()
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to change password.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl shadow-2xl"
        style={{ background: '#fff', border: '1px solid #E5E7EB' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <h2 id="change-password-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
            Change password
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
            Enter your current password, then choose a new one.
          </p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {error ? (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '8px 10px',
                borderRadius: 8,
                background: '#FEF2F2',
                color: '#B91C1C',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </p>
          ) : null}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={saving}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
              placeholder="Min. 8 characters"
              className="rounded-lg px-3 py-2 text-sm"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ border: '1px solid #D1D5DB', color: '#111827' }}
            />
          </label>
        </div>

        <div
          className="px-5 py-4 flex justify-end gap-2"
          style={{ borderTop: '1px solid #E5E7EB' }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onClose?.()}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  )
}
