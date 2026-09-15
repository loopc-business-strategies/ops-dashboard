import { EmptyPanel, Section, fmtDateTime } from './overviewShared'

export default function RecentActivity({ items }) {
  return (
    <Section title="Recent Activity">
      {items.length === 0 ? (
        <EmptyPanel title="No recent activity" message="Task updates will show up here." />
      ) : (
        <div className="space-y-2">
          {items.map((f) => (
            <div key={f.id} className="border border-gray-200 rounded-lg p-3 bg-white">
              <p className="text-sm text-gray-800">{f.text}</p>
              <p className="text-[11px] text-gray-500 mt-1 capitalize">
                {f.dept || 'general'} · {fmtDateTime(f.time)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
