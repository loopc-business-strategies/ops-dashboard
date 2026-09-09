// FILE: src/api/auth.js
// WHAT THIS DOES:
//   All functions that talk to the backend API.
//   Every function sends an HTTP request and returns the data.

import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/auth`
const cfg = () => ({ withCredentials: true })

// Login with name + password
const login = async (name, password, company) =>
  (await axios.post(`${BASE}/login`, { name, password, company }, cfg())).data

const setupStatus = async (company) =>
  (await axios.get(`${BASE}/setup-status`, { ...cfg(), params: company ? { company } : undefined })).data

// One-time first admin setup (name + password only)
const setup = async (name, password, company, setupToken) =>
  (await axios.post(
    `${BASE}/setup`,
    { name, password, company, ...(setupToken ? { setupToken } : {}) },
    {
      ...cfg(),
      headers: setupToken ? { 'x-setup-token': setupToken } : undefined,
    },
  )).data

// Get my own profile
const getMe = async () =>
  (await axios.get(`${BASE}/me`, cfg())).data

const logout = async () =>
  (await axios.post(`${BASE}/logout`, {}, cfg())).data

// Change own password (any authenticated user)
const changePassword = async (currentPassword, newPassword) =>
  (await axios.put(`${BASE}/change-password`, { currentPassword, newPassword }, cfg())).data

// Get all users (super_admin only)
const getUsers = async () =>
  (await axios.get(`${BASE}/users`, cfg())).data

// Create a new user (super_admin only)
const createUser = async (_token, data) =>
  (await axios.post(`${BASE}/users`, data, cfg())).data

// Update a user's role/dept/permissions (super_admin only)
const updateUserRole = async (_token, id, data) =>
  (await axios.put(`${BASE}/users/${id}/role`, data, cfg())).data

// Toggle a user active/inactive (super_admin only)
const toggleUser = async (_token, id) =>
  (await axios.put(`${BASE}/users/${id}/toggle`, {}, cfg())).data

// Deactivate and soft-delete a user (super_admin only)
const deleteUser = async (_token, id, reason = '') =>
  (await axios.delete(`${BASE}/users/${id}`, { ...cfg(), data: { reason } })).data

// Update granular module permissions for a user (super_admin only)
const updatePermissions = async (_token, id, modulePermissions) =>
  (await axios.put(`${BASE}/users/${id}/permissions`, { modulePermissions }, cfg())).data

const authAPI = { login, setup, setupStatus, getMe, logout, changePassword, getUsers, createUser, updateUserRole, toggleUser, deleteUser, updatePermissions }
export default authAPI
