/** Inline SVG icons for Production Dashboard (currentColor). */

function Svg({ children, size = 18, className = '', ...rest }) {
  return (
    <svg
      className={`pd-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

export function IconEmployees(props) {
  return (
    <Svg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

export function IconManager(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </Svg>
  )
}

export function IconShift(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  )
}

export function IconProduction(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v18" />
      <path d="M5 8h14" />
      <path d="M7 8l2 13h6l2-13" />
      <path d="M9 3h6" />
    </Svg>
  )
}

export function IconUnderProduction(props) {
  return (
    <Svg {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Svg>
  )
}

export function IconOutput(props) {
  return (
    <Svg {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </Svg>
  )
}

export function IconTrendUp(props) {
  return (
    <Svg {...props}>
      <path d="M3 17 9 11l4 4 7-7" />
      <path d="M14 8h6v6" />
    </Svg>
  )
}

export function IconWeekly(props) {
  return (
    <Svg {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 14v4" />
      <path d="M12 10v8" />
      <path d="M17 6v12" />
    </Svg>
  )
}

export function IconCalendar(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </Svg>
  )
}

export function IconMark(props) {
  return (
    <Svg {...props}>
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
    </Svg>
  )
}

export function IconVault(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M7 7V5a5 5 0 0 1 10 0v2" />
      <circle cx="12" cy="14" r="2" />
    </Svg>
  )
}

export function IconMelting(props) {
  return (
    <Svg {...props}>
      <path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z" />
      <path d="M8 20h8" />
    </Svg>
  )
}

export function IconRolling(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </Svg>
  )
}

export function IconBangle(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </Svg>
  )
}

export function IconStamping(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v10" />
      <path d="M8 7h8" />
      <path d="M5 21h14" />
      <path d="M7 13h10l1 8H6l1-8z" />
    </Svg>
  )
}

export function IconPendant(props) {
  return (
    <Svg {...props}>
      <path d="M12 2v6" />
      <path d="M9 5h6" />
      <path d="M12 8 7 14a5 5 0 0 0 10 0l-5-6z" />
    </Svg>
  )
}

export function IconWelding(props) {
  return (
    <Svg {...props}>
      <path d="M14.7 6.3 19 2l3 3-4.3 4.3" />
      <path d="M11 10 2 19l3 3 9-9" />
      <path d="M16 8l-2 2" />
    </Svg>
  )
}

export function IconAssembly(props) {
  return (
    <Svg {...props}>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </Svg>
  )
}

export function IconFlowVault(props) {
  return <IconVault {...props} />
}

export function IconFlowMelting(props) {
  return <IconMelting {...props} />
}

export function IconFlowRolling(props) {
  return <IconRolling {...props} />
}

export function IconFlowProduction(props) {
  return <IconUnderProduction {...props} />
}

export function IconFlowQc(props) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="m8 11 2 2 4-4" />
    </Svg>
  )
}

export function IconFlowFinished(props) {
  return <IconOutput {...props} />
}

export function IconAlertCritical(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </Svg>
  )
}

export function IconAlertWarning(props) {
  return (
    <Svg {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </Svg>
  )
}

export function IconAlertOk(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-5" />
    </Svg>
  )
}

export function IconAlertInfo(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </Svg>
  )
}

const DEPT_ICONS = {
  vault_room: IconVault,
  melting: IconMelting,
  rolling: IconRolling,
  bangle_area: IconBangle,
  stamping: IconStamping,
  pendent_section: IconPendant,
  welding_area: IconWelding,
  assembly: IconAssembly,
}

const FLOW_ICONS = {
  vault: IconFlowVault,
  melting: IconFlowMelting,
  rolling: IconFlowRolling,
  production: IconFlowProduction,
  qc: IconFlowQc,
  finished: IconFlowFinished,
}

export function DeptIcon({ deptKey, ...props }) {
  const Comp = DEPT_ICONS[deptKey] || IconAssembly
  return <Comp {...props} />
}

export function FlowIcon({ stageKey, ...props }) {
  const Comp = FLOW_ICONS[stageKey] || IconProduction
  return <Comp {...props} />
}

export function AlertIcon({ tone, ...props }) {
  const t = String(tone || '').toLowerCase()
  if (t.includes('critical') || t.includes('error') || t.includes('high')) return <IconAlertCritical {...props} />
  if (t.includes('warn') || t.includes('attention') || t.includes('medium')) return <IconAlertWarning {...props} />
  if (t.includes('success') || t.includes('ok')) return <IconAlertOk {...props} />
  return <IconAlertInfo {...props} />
}
