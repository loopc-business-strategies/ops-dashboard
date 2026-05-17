import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/finance`

function cfg() {
  return { withCredentials: true }
}

function crudApi(path) {
  const url = `${BASE}${path}`
  return {
    list:   ()       => axios.get(url, cfg()).then(r => r.data.data || []),
    create: (body)   => axios.post(url, body, cfg()).then(r => r.data.data),
    update: (id, body) => axios.put(`${url}/${id}`, body, cfg()).then(r => r.data.data),
    remove: (id)     => axios.delete(`${url}/${id}`, cfg()),
  }
}

const financeAPI = {
  invoices: crudApi('/invoices'),
  expenses: crudApi('/expenses'),
  payroll:  crudApi('/payroll'),
  budgets:  crudApi('/budgets'),
  taxes:    crudApi('/taxes'),
}

export default financeAPI
