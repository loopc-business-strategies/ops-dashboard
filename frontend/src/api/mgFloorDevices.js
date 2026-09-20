import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/mg-floor`

const get = async (path, params) => (await axios.get(`${BASE}${path}`, { params })).data
const post = async (path, body) => (await axios.post(`${BASE}${path}`, body || {})).data
const patch = async (path, body) => (await axios.patch(`${BASE}${path}`, body || {})).data

/** MG Floor device registry (scales / XRF / gateways) — MG tenant session required. */
export const mgFloorDevicesApi = {
  listScales: (params) => get('/scales', params),
  createScale: (body) => post('/scales', body),
  updateScale: (scaleId, body) => patch(`/scales/${encodeURIComponent(scaleId)}`, body),
  listXrf: (params) => get('/xrf/devices', params),
  createXrf: (body) => post('/xrf/devices', body),
  updateXrf: (id, body) => patch(`/xrf/devices/${encodeURIComponent(id)}`, body),
  listGateways: (params) => get('/gateways', params),
  createGateway: (body) => post('/gateways', body),
  updateGateway: (id, body) => patch(`/gateways/${encodeURIComponent(id)}`, body),
}
