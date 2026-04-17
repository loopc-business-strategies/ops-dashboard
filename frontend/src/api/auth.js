// FILE: src/api/auth.js
// WHAT THIS DOES:
//   All functions that talk to the backend API.
//   Every function sends an HTTP request and returns the data.

import axios from 'axios'

const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const BASE = `${API_ROOT}/api/auth`
// Helper: build Authorization header
const h = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

// Login with name + password
const login = async (name, password) =>
  (await axios.post(`${BASE}/login`, { name, password })).data

// One-time first admin setup (name + password only)
const setup = async (name, password) =>
  (await axios.post(`${BASE}/setup`, { name, password })).data

// Get my own profile
const getMe = async (token) =>
  (await axios.get(`${BASE}/me`, h(token))).data

// Get all users (super_admin only)
const getUsers = async (token) =>
  (await axios.get(`${BASE}/users`, h(token))).data

// Create a new user (super_admin only)
const createUser = async (token, data) =>
  (await axios.post(`${BASE}/users`, data, h(token))).data

// Update a user's role/dept/permissions (super_admin only)
const updateUserRole = async (token, id, data) =>
  (await axios.put(`${BASE}/users/${id}/role`, data, h(token))).data

// Toggle a user active/inactive (super_admin only)
const toggleUser = async (token, id) =>
  (await axios.put(`${BASE}/users/${id}/toggle`, {}, h(token))).data

// Permanently delete a user (super_admin only)
const deleteUser = async (token, id) =>
  (await axios.delete(`${BASE}/users/${id}`, h(token))).data

const authAPI = { login, setup, getMe, getUsers, createUser, updateUserRole, toggleUser, deleteUser }
export default authAPI
