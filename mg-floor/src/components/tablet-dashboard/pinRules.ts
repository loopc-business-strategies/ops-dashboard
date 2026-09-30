function isSequential(pin: string) {
  let up = true
  let down = true
  for (let i = 1; i < pin.length; i += 1) {
    const diff = Number(pin[i]) - Number(pin[i - 1])
    if (diff !== 1) up = false
    if (diff !== -1) down = false
  }
  return up || down
}

/** Same rules as the server (backend/services/mgFloorPin.js); returns a message, or null when the PIN is fine. */
export function pinProblem(pin: string, confirm?: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return 'PIN must be 4 to 6 digits.'
  if (/^(\d)\1+$/.test(pin)) return 'PIN cannot be the same digit repeated.'
  if (isSequential(pin)) return 'PIN cannot be a simple sequence like 1234.'
  if (confirm !== undefined && confirm !== pin) return 'The two PINs do not match.'
  return null
}
