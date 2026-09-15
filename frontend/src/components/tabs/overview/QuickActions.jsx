import { QUICK_ACTIONS, Section } from './overviewShared'

export default function QuickActions({ role, onAction, isReadOnly }) {
  const actions = QUICK_ACTIONS[role] || QUICK_ACTIONS.department_user
  if (isReadOnly) {
    const readonlyActions = actions.filter((a) => /search|report|exception|production|messages/i.test(a))
    return (
      <Section title="Quick Actions">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {readonlyActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              className="px-3 py-2.5 text-sm text-left rounded-lg border border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-300"
            >
              {action}
            </button>
          ))}
        </div>
      </Section>
    )
  }

  return (
    <Section title="Quick Actions">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            className="px-3 py-2.5 text-sm text-left rounded-lg border border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-300"
          >
            {action}
          </button>
        ))}
      </div>
    </Section>
  )
}
