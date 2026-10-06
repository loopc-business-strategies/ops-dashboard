// FILE: frontend/src/api/websiteEnquiries.js
// Website enquiries API client — shared by Sales and Procurement Plus

import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/enquiries`
const cfg  = ()       => ({ withCredentials: true })
const cfgP = (params) => ({ withCredentials: true, params })

export const listWebsiteEnquiries = (params)          => axios.get(BASE, cfgP(params)).then(r => r.data)
export const getEnquiryAssignees  = ()                => axios.get(`${BASE}/assignees`, cfg()).then(r => r.data)
export const updateEnquiryStatus  = (id, status, note) => axios.patch(`${BASE}/${id}/status`, { status, note }, cfg()).then(r => r.data)
export const assignEnquiry        = (id, userId)      => axios.patch(`${BASE}/${id}/assign`, { userId }, cfg()).then(r => r.data)
