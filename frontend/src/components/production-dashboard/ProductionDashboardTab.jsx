import { useMemo, useState, useEffect, useRef } from 'react'
import HeaderBar from './HeaderBar'
import KpiRow from './KpiRow'
import LiveMetalControl from './LiveMetalControl'
import DepartmentOverview from './DepartmentOverview'
import MetalMovementLedger from './MetalMovementLedger'
import OperatorPresence from './OperatorPresence'
import VaultInventory from './VaultInventory'
import AlertsReconciliation from './AlertsReconciliation'
import BatchTraceability from './BatchTraceability'
import ShopFloorTerminal from './ShopFloorTerminal'
import ActionModal from './ActionModal'
import { useProductionDashboard } from './useProductionDashboard'
import { DASHBOARD_DEPARTMENTS } from './departmentConfig'
import './ProductionDashboard.css'

function Field({ label, children }) {
  return (
    <label className="pd-field">
      <span className="pd-kpi-label">{label}</span>
      {children}
    </label>
  )
}

export default function ProductionDashboardTab() {
  const {
    loading,
    error,
    actionError,
    actionBusy,
    clearActionError,
    model,
    lastUpdated,
    connection,
    refresh,
    stockLedger,
    stockLedgerLoading,
    selectedDeptKey,
    selectedBatchId,
    batchDetail,
    deptDetail,
    actions,
  } = useProductionDashboard()

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [awaitingBatches, setAwaitingBatches] = useState([])
  const [flowFilterKey, setFlowFilterKey] = useState(null)
  const [selectedOperatorId, setSelectedOperatorId] = useState(null)
  const [selectedMovementId, setSelectedMovementId] = useState(null)
  const autoBatchRef = useRef(false)

  const permissions = model?.permissions || {}
  const selectedDept = useMemo(
    () => (model?.deptCards || []).find((c) => c.key === selectedDeptKey) || null,
    [model?.deptCards, selectedDeptKey],
  )

  useEffect(() => {
    if (!model?.hasLiveProduction) return
    if (autoBatchRef.current || selectedBatchId || !model?.batchMonitorRows?.length) return
    const first = model.batchMonitorRows[0]
    if (first?.id) {
      autoBatchRef.current = true
      actions.selectBatch(first.id)
    }
  }, [model?.hasLiveProduction, model?.batchMonitorRows, selectedBatchId, actions])

  const openModal = (type, seed = {}) => {
    clearActionError?.()
    setForm(seed)
    setModal(type)
  }

  const closeModal = () => {
    if (actionBusy) return
    setModal(null)
    setForm({})
  }

  useEffect(() => {
    if (modal !== 'issue' && modal !== 'metal-out' && modal !== 'metal-in') return undefined
    let cancelled = false
    ;(async () => {
      const list = await actions.listAwaitingBatches?.().catch(() => [])
      if (!cancelled) setAwaitingBatches(list || [])
    })()
    return () => { cancelled = true }
  }, [modal, actions])

  const deptOptions = DASHBOARD_DEPARTMENTS.map((d) => ({ value: d.key, label: d.label }))
  const batchChoices = (model?.batchOptions || []).length
    ? model.batchOptions
    : awaitingBatches.map((b) => ({
      id: b._id || b.id,
      batchNumber: b.batchNumber,
      department: b.currentDepartment,
      weight: b.currentWeight || b.initialWeight,
      status: b.status,
    }))

  async function submitModal() {
    try {
      if (modal === 'metal-out') {
        await actions.metalTransfer({
          mode: 'out',
          batchId: form.batchId,
          fromDepartment: form.fromDepartment || selectedDept?.key,
          toDepartment: form.toDepartment,
          weight: form.weight,
        })
      } else if (modal === 'metal-in') {
        if (form.passId) {
          await actions.receiveOpenPass({
            passId: form.passId,
            receivedWeight: form.weight,
          })
        } else {
          await actions.metalTransfer({
            mode: 'in',
            batchId: form.batchId,
            toDepartment: form.toDepartment || selectedDept?.key || selectedDept?.name,
            weight: form.weight,
            receiveWeight: form.weight,
          })
        }
      } else if (modal === 'operator-in' || modal === 'face-scan') {
        await actions.operatorIn({ employeeId: form.employeeId || undefined })
      } else if (modal === 'operator-out') {
        await actions.operatorOut()
      } else if (modal === 'issue') {
        let batchId = form.batchId
        if (!batchId && form.createNew) {
          const created = await actions.createBatchForIssue({
            metalType: form.metalType || form.lineMetalType || 'Gold',
            purity: form.purity || form.linePurity || '',
            targetWeight: form.weight,
            inventoryItemId: form.inventoryItemId || undefined,
          })
          batchId = created?.batch?._id || created?.batch?.id || created?._id
        }
        if (!batchId) throw new Error('Select or create a batch to issue metal')
        await actions.issueMetal({
          batchId,
          inventoryItemId: form.inventoryItemId || undefined,
          weight: form.weight,
        })
      }
      closeModal()
    } catch {
      /* actionError set in hook */
    }
  }

  return (
    <div className="pd-page">
      <HeaderBar
        header={model?.header}
        lastUpdated={lastUpdated}
        connection={connection}
        onRefresh={() => refresh()}
        loading={loading}
      />

      {loading && !model ? (
        <div className="pd-skeleton" aria-busy="true">
          <div className="pd-skel-kpis" />
          <div className="pd-skel-mid" />
          <div className="pd-skel-live" />
        </div>
      ) : null}

      {error && !model ? (
        <div className="pd-error" role="alert">
          <p>{error}</p>
          <button type="button" className="pd-btn pd-btn--primary" onClick={() => refresh()}>Retry</button>
        </div>
      ) : null}

      {error && model ? (
        <p className="pd-banner-warn" role="status">Partial data: {error}</p>
      ) : null}

      {actionError && !modal ? (
        <p className="pd-banner-warn" role="alert">{actionError}</p>
      ) : null}

      {model ? (
        <div className="pd-layout pd-layout--reference pd-layout--control-center">
          <KpiRow model={model} />

          {/* Live metal flow rail hidden from UI (logic/handlers retained). */}
          {false ? (
          <LiveMetalControl
            materialFlow={model.materialFlow}
            activeStageKey={flowFilterKey}
            onStageClick={(stage) => {
              setFlowFilterKey(stage.key)
              const map = {
                vault: 'vault_room',
                melting: 'melting',
                rolling: 'rolling',
                production: null,
                qc: null,
                finished: 'assembly',
              }
              const deptKey = map[stage.key]
              if (deptKey) actions.selectDepartment(deptKey)
            }}
          />
          ) : null}

          <DepartmentOverview
            cards={model.deptCards}
            assemblyTables={model.assemblyTables}
            selectedDeptKey={selectedDeptKey}
            onSelectDept={(key) => actions.selectDepartment(key)}
            permissions={permissions}
            onMetalInOut={() => openModal('metal-out', {
              batchId: selectedDept?.batchId || '',
              fromDepartment: selectedDept?.key || '',
              toDepartment: '',
              weight: selectedDept?.metalBalance || selectedDept?.quantity || '',
            })}
            onOperatorInOut={() => openModal('operator-in', { employeeId: '' })}
            onViewDepartment={(key) => actions.viewDepartment(key)}
            onViewAll={() => actions.clearDepartment()}
          />

          {/* Mid/bottom panels + dept drawer hidden from UI (logic/handlers retained). */}
          {false ? (
          <div className="pd-dept-drawer" role="status">
              <strong>{deptDetail.name || deptDetail.label || selectedDept?.name || 'Department'}</strong>
              <span className="pd-muted">
                {' '}
                Key: {deptDetail.key || selectedDeptKey}
                {selectedDept?.batchNumber ? ` · Batch ${selectedDept.batchNumber}` : ''}
                {selectedDept?.metalBalance != null ? ` · Balance loaded` : ''}
              </span>
              <button type="button" className="pd-btn pd-btn--ghost pd-btn--sm" onClick={() => actions.clearDepartment()}>
                Close
              </button>
            </div>
          ) : null}

          {false ? (
          <div className="pd-mid-quad">
            <MetalMovementLedger
              rows={model.metalMovementRows}
              stockLedger={model.hasLiveProduction ? stockLedger : []}
              loading={model.hasLiveProduction ? stockLedgerLoading : false}
              filterDept={selectedDeptKey || flowFilterKey}
              filterBatch={selectedBatchId}
              selectedId={selectedMovementId}
              onRowClick={(row) => {
                setSelectedMovementId(row.id)
                if (row.batchId) actions.selectBatch(row.batchId)
              }}
            />
            <OperatorPresence
              rows={model.operatorPresenceRows}
              selectedId={selectedOperatorId}
              canFloorSession={permissions.canFloorSession}
              onRowClick={(row) => setSelectedOperatorId(row.id)}
              onOperatorIn={() => openModal('operator-in', { employeeId: '' })}
              onOperatorOut={() => openModal('operator-out')}
            />
            <VaultInventory
              lines={model.vaultLines}
              canIssue={permissions.canIssue}
              onIssueMetal={() => {
                const line = model.vaultLines?.[0]
                openModal('issue', {
                  inventoryItemId: line?.inventoryItemId || '',
                  lineMetalType: line?.metalType || 'Gold',
                  linePurity: line?.purity || '',
                  weight: line?.weight || '',
                  batchId: '',
                  createNew: false,
                })
              }}
            />
            <AlertsReconciliation
              reconciliationRows={model.reconciliationRows}
              mismatchAlerts={model.mismatchAlerts}
              alerts={model.alertItems}
              canResolve={permissions.canResolveAlert}
              onAcknowledge={(id) => actions.acknowledgeAlert(id)}
              onResolve={(id) => actions.resolveAlert(id)}
            />
          </div>
          ) : null}

          {false ? (
          <div className="pd-row-bottom-split pd-row-bottom-terminal">
            <BatchTraceability
              batchRows={model.batchMonitorRows}
              selectedBatchId={selectedBatchId}
              batchDetail={batchDetail}
              metalMovements={model.metalMovementRows}
              onSelectBatch={(id) => actions.selectBatch(id)}
            />
            <ShopFloorTerminal
              department={selectedDept}
              permissions={permissions}
              onFaceScan={() => openModal('face-scan', { employeeId: '' })}
              onOperatorIn={() => openModal('operator-in', { employeeId: '' })}
              onOperatorOut={() => openModal('operator-out')}
              onMetalIn={() => openModal('metal-in', {
                batchId: selectedDept?.batchId || '',
                passId: selectedDept?.passId || '',
                toDepartment: selectedDept?.key || selectedDept?.name || '',
                weight: selectedDept?.metalIn || selectedDept?.metalBalance || '',
              })}
              onMetalOut={() => openModal('metal-out', {
                batchId: selectedDept?.batchId || '',
                fromDepartment: selectedDept?.key || '',
                toDepartment: '',
                weight: selectedDept?.metalBalance || selectedDept?.quantity || '',
              })}
            />
          </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && !model ? (
        <p className="pd-empty pd-empty--page">No production activity today</p>
      ) : null}

      <ActionModal
        open={modal === 'metal-out'}
        title="Metal OUT — Transfer"
        onClose={closeModal}
        onSubmit={submitModal}
        busy={actionBusy}
        error={actionError}
        disabled={!form.batchId || !form.toDepartment || !form.weight}
        submitLabel="Issue Transfer"
      >
        <Field label="Batch">
          <select value={form.batchId || ''} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}>
            <option value="">Select batch</option>
            {batchChoices.map((b) => (
              <option key={b.id} value={b.id}>{b.batchNumber} ({b.department || b.status})</option>
            ))}
          </select>
        </Field>
        <Field label="From department">
          <select
            value={form.fromDepartment || ''}
            onChange={(e) => setForm((f) => ({ ...f, fromDepartment: e.target.value }))}
          >
            <option value="">Auto (batch location)</option>
            {deptOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="To department">
          <select
            value={form.toDepartment || ''}
            onChange={(e) => setForm((f) => ({ ...f, toDepartment: e.target.value }))}
          >
            <option value="">Select destination</option>
            {deptOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Weight (g)">
          <input
            type="number"
            min="0"
            step="0.001"
            value={form.weight ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
          />
        </Field>
      </ActionModal>

      <ActionModal
        open={modal === 'metal-in'}
        title="Metal IN — Receive"
        onClose={closeModal}
        onSubmit={submitModal}
        busy={actionBusy}
        error={actionError}
        disabled={!form.weight || (!form.passId && !form.batchId)}
        submitLabel="Receive Metal"
        tone="primary"
      >
        {(model?.openPasses || []).length ? (
          <Field label="Open pass">
            <select value={form.passId || ''} onChange={(e) => setForm((f) => ({ ...f, passId: e.target.value }))}>
              <option value="">Select pass (or use batch)</option>
              {model.openPasses.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.passNumber} · {p.fromDepartment} → {p.toDepartment} · {p.weight}g
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Batch (fallback)">
          <select value={form.batchId || ''} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}>
            <option value="">Select batch</option>
            {batchChoices.map((b) => (
              <option key={b.id} value={b.id}>{b.batchNumber}</option>
            ))}
          </select>
        </Field>
        <Field label="Received weight (g)">
          <input
            type="number"
            min="0"
            step="0.001"
            value={form.weight ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
          />
        </Field>
      </ActionModal>

      <ActionModal
        open={modal === 'operator-in' || modal === 'face-scan'}
        title={modal === 'face-scan' ? 'FACE SCAN — Select Employee' : 'Operator IN'}
        onClose={closeModal}
        onSubmit={submitModal}
        busy={actionBusy}
        error={actionError}
        submitLabel={modal === 'face-scan' ? 'Confirm Scan / IN' : 'Operator IN'}
      >
        <p className="pd-muted">
          {modal === 'face-scan'
            ? 'Biometric camera is not configured. Select the employee to clock in.'
            : 'Start a floor session for the selected employee (or current user).'}
        </p>
        <Field label="Employee">
          <select
            value={form.employeeId || ''}
            onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
          >
            <option value="">Current user</option>
            {(model?.employeeOptions || []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}{e.code ? ` (${e.code})` : ''}{e.department ? ` — ${e.department}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </ActionModal>

      <ActionModal
        open={modal === 'operator-out'}
        title="Operator OUT"
        onClose={closeModal}
        onSubmit={submitModal}
        busy={actionBusy}
        error={actionError}
        submitLabel="End Floor Session"
        tone="danger"
      >
        <p>End the open floor session for the current user?</p>
      </ActionModal>

      <ActionModal
        open={modal === 'issue'}
        title="Issue Metal from Vault"
        onClose={closeModal}
        onSubmit={submitModal}
        busy={actionBusy}
        error={actionError}
        disabled={!form.weight || (!form.batchId && !form.createNew)}
        submitLabel="Issue Metal"
      >
        <Field label="Vault line">
          <select
            value={form.inventoryItemId || ''}
            onChange={(e) => {
              const line = (model?.vaultLines || []).find((l) => String(l.inventoryItemId) === e.target.value)
              setForm((f) => ({
                ...f,
                inventoryItemId: e.target.value,
                lineMetalType: line?.metalType || f.lineMetalType,
                linePurity: line?.purity || f.linePurity,
                weight: line?.weight || f.weight,
              }))
            }}
          >
            <option value="">Select stock line</option>
            {(model?.vaultLines || []).map((l) => (
              <option key={l.id} value={l.inventoryItemId || ''}>
                {l.label} — {l.weight}g
              </option>
            ))}
          </select>
        </Field>
        <Field label="Batch">
          <select value={form.batchId || ''} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value, createNew: false }))}>
            <option value="">Select awaiting batch</option>
            {awaitingBatches.map((b) => (
              <option key={b._id || b.id} value={b._id || b.id}>
                {b.batchNumber} ({b.status})
              </option>
            ))}
            {batchChoices.filter((b) => ['CREATED', 'AWAITING_ISSUE'].includes(String(b.status || '').toUpperCase())).map((b) => (
              <option key={b.id} value={b.id}>{b.batchNumber}</option>
            ))}
          </select>
        </Field>
        <label className="pd-field pd-field--check">
          <input
            type="checkbox"
            checked={Boolean(form.createNew)}
            onChange={(e) => setForm((f) => ({ ...f, createNew: e.target.checked, batchId: e.target.checked ? '' : f.batchId }))}
          />
          <span>Create new batch then issue</span>
        </label>
        <Field label="Weight (g)">
          <input
            type="number"
            min="0"
            step="0.001"
            value={form.weight ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
          />
        </Field>
      </ActionModal>
    </div>
  )
}
