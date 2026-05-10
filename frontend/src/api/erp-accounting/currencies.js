import { BASE, axios, getAuthConfig } from './client'

const getCurrencies = async (token) => (await axios.get(`${BASE}/currencies`, getAuthConfig(token))).data
const createCurrency = async (token, payload) => (await axios.post(`${BASE}/currencies`, payload, getAuthConfig(token))).data
const updateCurrency = async (token, id, payload) => (await axios.put(`${BASE}/currencies/${id}`, payload, getAuthConfig(token))).data
const deleteCurrency = async (token, id) => (await axios.delete(`${BASE}/currencies/${id}`, getAuthConfig(token))).data
const seedDefaultCurrencies = async (token) => (await axios.post(`${BASE}/currencies/seed-defaults`, {}, getAuthConfig(token))).data
const getReportBranding = async (token, params) => (await axios.get(`${BASE}/report-branding`, getAuthConfig(token, params))).data
const updateReportBranding = async (token, payload) => (await axios.put(`${BASE}/report-branding`, payload, getAuthConfig(token))).data
const getMetalRates = async (token) => (await axios.get(`${BASE}/metal-rates`, getAuthConfig(token))).data
const updateMetalRates = async (token, payload) => (await axios.put(`${BASE}/metal-rates`, payload, getAuthConfig(token))).data

export const currenciesApi = {
  getCurrencies,
  createCurrency,
  updateCurrency,
  deleteCurrency,
  seedDefaultCurrencies,
  getReportBranding,
  updateReportBranding,
  getMetalRates,
  updateMetalRates,
}