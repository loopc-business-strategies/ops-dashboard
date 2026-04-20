// FILE: frontend/src/api/crm.js
// CRM API client — all CRM endpoints

import axios from 'axios'

const BASE = 'http://localhost:5000/api/crm'
const cfg  = ()       => ({ withCredentials: true })
const cfgP = (params) => ({ withCredentials: true, params })

// Dashboard
export const getDashboard     = ()           => axios.get(`${BASE}/dashboard`, cfg()).then(r => r.data)

// Templates
export const getContactsTemplateCsv = () => axios.get(`${BASE}/templates/contacts`, { withCredentials: true, responseType: 'blob' }).then(r => r.data)
export const getCompaniesTemplateCsv = () => axios.get(`${BASE}/templates/companies`, { withCredentials: true, responseType: 'blob' }).then(r => r.data)
export const getDealsTemplateCsv = () => axios.get(`${BASE}/templates/deals`, { withCredentials: true, responseType: 'blob' }).then(r => r.data)

// Contacts
export const getContacts      = (params)     => axios.get(`${BASE}/contacts`, cfgP(params)).then(r => r.data)
export const createContact    = (data)       => axios.post(`${BASE}/contacts`, data, cfg()).then(r => r.data)
export const updateContact    = (id, data)   => axios.put(`${BASE}/contacts/${id}`, data, cfg()).then(r => r.data)
export const deleteContact    = (id)         => axios.delete(`${BASE}/contacts/${id}`, cfg()).then(r => r.data)
export const addContactNote   = (id, data)   => axios.post(`${BASE}/contacts/${id}/notes`, data, cfg()).then(r => r.data)
export const uploadContactDocument = (id, file, status = 'Pending') => {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('status', status)
	return axios.post(`${BASE}/contacts/${id}/documents`, formData, {
		withCredentials: true,
		headers: { 'Content-Type': 'multipart/form-data' },
	}).then((r) => r.data)
}
export const deleteContactDocument = (id, docId) => axios.delete(`${BASE}/contacts/${id}/documents/${docId}`, cfg()).then(r => r.data)
export const exportContactsCsv = () => axios.get(`${BASE}/contacts/export`, { withCredentials: true, responseType: 'blob' }).then(r => r.data)
export const importContactsCsv = (file) => {
	const formData = new FormData()
	formData.append('file', file)
	return axios.post(`${BASE}/contacts/import`, formData, {
		withCredentials: true,
		headers: { 'Content-Type': 'multipart/form-data' },
	}).then((r) => r.data)
}

// Companies
export const getCompanies     = ()           => axios.get(`${BASE}/companies`, cfg()).then(r => r.data)
export const createCompany    = (data)       => axios.post(`${BASE}/companies`, data, cfg()).then(r => r.data)
export const updateCompany    = (id, data)   => axios.put(`${BASE}/companies/${id}`, data, cfg()).then(r => r.data)
export const deleteCompany    = (id)         => axios.delete(`${BASE}/companies/${id}`, cfg()).then(r => r.data)
export const exportCompaniesCsv = () => axios.get(`${BASE}/companies/export`, { withCredentials: true, responseType: 'blob' }).then(r => r.data)
export const importCompaniesCsv = (file) => {
	const formData = new FormData()
	formData.append('file', file)
	return axios.post(`${BASE}/companies/import`, formData, {
		withCredentials: true,
		headers: { 'Content-Type': 'multipart/form-data' },
	}).then((r) => r.data)
}

// Leads
export const getLeads         = ()           => axios.get(`${BASE}/leads`, cfg()).then(r => r.data)
export const createLead       = (data)       => axios.post(`${BASE}/leads`, data, cfg()).then(r => r.data)
export const updateLead       = (id, data)   => axios.put(`${BASE}/leads/${id}`, data, cfg()).then(r => r.data)
export const changeLeadStage  = (id, stage, note) => axios.post(`${BASE}/leads/${id}/stage`, { stage, note }, cfg()).then(r => r.data)
export const deleteLead       = (id)         => axios.delete(`${BASE}/leads/${id}`, cfg()).then(r => r.data)

// Deals
export const getDeals         = ()           => axios.get(`${BASE}/deals`, cfg()).then(r => r.data)
export const createDeal       = (data)       => axios.post(`${BASE}/deals`, data, cfg()).then(r => r.data)
export const updateDeal       = (id, data)   => axios.put(`${BASE}/deals/${id}`, data, cfg()).then(r => r.data)
export const closeDeal        = (id, data)   => axios.post(`${BASE}/deals/${id}/close`, data, cfg()).then(r => r.data)
export const deleteDeal       = (id)         => axios.delete(`${BASE}/deals/${id}`, cfg()).then(r => r.data)
export const exportDealsCsv = () => axios.get(`${BASE}/deals/export`, { withCredentials: true, responseType: 'blob' }).then(r => r.data)
export const importDealsCsv = (file) => {
	const formData = new FormData()
	formData.append('file', file)
	return axios.post(`${BASE}/deals/import`, formData, {
		withCredentials: true,
		headers: { 'Content-Type': 'multipart/form-data' },
	}).then((r) => r.data)
}

// Activities
export const getActivities    = (params)     => axios.get(`${BASE}/activities`, cfgP(params)).then(r => r.data)
export const createActivity   = (data)       => axios.post(`${BASE}/activities`, data, cfg()).then(r => r.data)
export const updateActivity   = (id, data)   => axios.put(`${BASE}/activities/${id}`, data, cfg()).then(r => r.data)
export const deleteActivity   = (id)         => axios.delete(`${BASE}/activities/${id}`, cfg()).then(r => r.data)
export const markFollowupDone = (id)         => axios.patch(`${BASE}/activities/${id}/followup-done`, {}, cfg()).then(r => r.data)

// Follow-ups
export const getFollowups     = ()           => axios.get(`${BASE}/followups`, cfg()).then(r => r.data)
