import { QUICK_ACTIONS, Section } from './overviewShared'

export default function QuickActions({ role, onAction, isReadOnly }) {
  const actions = QUICK_ACTIONS[role] || QUICK_ACTIONS.department_user
  const visible = isReadOnly
    ? actions.filter((a) => /search|report|exception|production|messages/i.test(a))
    : actions

  return (
    <Section title="Quick Actions">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            className="btn btn-secondary h-10 justify-start text-left px-3 text-sm"
          >
            {action}
          </button>
        ))}
      </div>
    </Section>
  )
}
