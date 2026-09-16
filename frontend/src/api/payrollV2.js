import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/finance/payroll-v2`
const HR_BASE = `${API_ORIGIN}/api/hr/employees`

function cfg() {
  return { withCredentials: true }
}

const payrollV2API = {
  dashboard: () => axios.get(`${BASE}/dashboard`, cfg()).then((r) => r.data.data),

  getSalaryAssignment: (employeeId) =>
    axios.get(`${BASE}/employees/${employeeId}/salary-assignment`, cfg()).then((r) => r.data.data),

  putSalaryAssignment: (employeeId, body) =>
    axios.put(`${BASE}/employees/${employeeId}/salary-assignment`, body, cfg()).then((r) => r.data.data),

  /** HR alias */
  getHrSalaryAssignment: (employeeId) =>
    axios.get(`${HR_BASE}/${employeeId}/salary-assignment`, cfg()).then((r) => r.data.data),

  putHrSalaryAssignment: (employeeId, body) =>
    axios.put(`${HR_BASE}/${employeeId}/salary-assignment`, body, cfg()).then((r) => r.data.data),

  listRuns: (params = {}) =>
    axios.get(`${BASE}/runs`, { ...cfg(), params }).then((r) => r.data.data || []),

  getRun: (id) => axios.get(`${BASE}/runs/${id}`, cfg()).then((r) => r.data.data),

  createRun: (body) => axios.post(`${BASE}/runs`, body, cfg()).then((r) => r.data.data),

  selectEmployees: (id, employeeIds) =>
    axios.post(`${BASE}/runs/${id}/select-employees`, { employeeIds }, cfg()).then((r) => r.data.data),

  calculate: (id, body = {}) =>
    axios.post(`${BASE}/runs/${id}/calculate`, body, cfg()).then((r) => r.data.data),

  submitReview: (id) =>
    axios.post(`${BASE}/runs/${id}/submit-review`, {}, cfg()).then((r) => r.data.data),

  approve: (id) =>
    axios.post(`${BASE}/runs/${id}/approve`, {}, cfg()).then((r) => r.data.data),

  finalize: (id) =>
    axios.post(`${BASE}/runs/${id}/finalize`, {}, cfg()).then((r) => r.data.data),

  markPaid: (id) =>
    axios.post(`${BASE}/runs/${id}/mark-paid`, {}, cfg()).then((r) => r.data.data),

  listPayslips: (params = {}) =>
    axios.get(`${BASE}/payslips`, { ...cfg(), params }).then((r) => r.data.data || []),

  getPayslip: (id) => axios.get(`${BASE}/payslips/${id}`, cfg()).then((r) => r.data.data),

  generatePayslips: (runId) =>
    axios.post(`${BASE}/runs/${runId}/generate-payslips`, {}, cfg()).then((r) => r.data.data),

  reissuePayslip: (id) =>
    axios.post(`${BASE}/payslips/${id}/reissue`, {}, cfg()).then((r) => r.data.data),

  auditDownload: (id) =>
    axios.post(`${BASE}/payslips/${id}/download-audit`, {}, cfg()).then((r) => r.data),

  myPayslips: () =>
    axios.get(`${BASE}/my-payslips`, cfg()).then((r) => r.data.data || []),
}

export default payrollV2API
