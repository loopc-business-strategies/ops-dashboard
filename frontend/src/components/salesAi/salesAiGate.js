export function shouldShowSalesManagerAi({ branding, token }) {
  // In-dashboard widget disabled after split — Sales Manager AI is a standalone app.
  return Boolean(
    token
    && branding?.key === 'loopc'
    && branding?.featureFlags?.salesManagerAi,
  )
}
