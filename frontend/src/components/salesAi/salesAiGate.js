export function shouldShowSalesManagerAi({ branding, token }) {
  return Boolean(
    token
    && branding?.key === 'loopc'
    && branding?.featureFlags?.salesManagerAi,
  )
}
