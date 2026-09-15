import { useEffect, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { formatTime } from '../shared'
import {
  PccEmptyState,
  PccStatusBadge,
  PccWeightDisplay,
} from '../primitives'

export default function MovementsPanel({ onToast }) {
  const pccApi = usePccApi()
  const [rows, setRows] = useState([])
  useEffect(() => {
    pccApi.listMovements({ limit: 100 })
      .then((d) => setRows(d.movements || []))
      .catch((err) => onToast?.(err?.response?.data?.message || 'Failed to load movements'))
  }, [pccApi, onToast])
  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>METAL MOVEMENTS</h2></div>
      {rows.length === 0 ? <PccEmptyState message="No metal movements" /> : (
        <div className="pcc-table-wrap">
          <table className="pcc-table">
            <thead>
              <tr><th>Movement</th><th>Batch</th><th>From</th><th>To</th><th>Weight</th><th>Status</th><th>When</th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m._id}>
                  <td>{m.movementNumber}</td>
                  <td>{m.batchNumber}</td>
                  <td>{m.fromDepartment} / {m.fromPersonName || '—'}</td>
                  <td>{m.toDepartment} / {m.toPersonName || '—'}</td>
                  <td><PccWeightDisplay grams={m.weight} /></td>
                  <td><PccStatusBadge status={m.status} /></td>
                  <td>{formatTime(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

