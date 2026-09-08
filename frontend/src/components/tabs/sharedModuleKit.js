/**
 * Shared presentation helpers for module kits (UI-only).
 * Prefer design-system .btn / .card classes over duplicated style objects.
 */

export const KIT_BTN = {
  pri: 'btn btn-primary',
  sec: 'btn btn-secondary',
  ghost: 'btn btn-ghost',
  succ: 'btn btn-success',
  danger: 'btn btn-danger',
  outline: 'btn btn-outline',
  warn: 'btn btn-outline',
  sm: 'btn-sm',
}

/** Merge kit button class names (e.g. kitBtnClass('pri', 'sm')). */
export function kitBtnClass(...keys) {
  return keys
    .filter(Boolean)
    .map((k) => KIT_BTN[k] || k)
    .join(' ')
    .trim()
}
