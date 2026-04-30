// FILE: src/api/auth.js
// WHAT THIS DOES:
//   All functions that talk to the backend API.
//   Every function sends an HTTP request and returns the data.

import axios from 'axios'

const API_ORIGIN = import.meta.env.VITE_API_URL || ''
const BASE = `${API_ORIGIN}/api/auth`

// Login with name + password
const login = async (name, password, company) =>
  (await axios.post(`${BASE}/login`, { name, password, company })).data

// One-time first admin setup (name + password only)
const setup = async (name, password, company) =>
  (await axios.post(`${BASE}/setup`, { name, password, company })).data

// Get my own profile
const getMe = async () =>
  (await axios.get(`${BASE}/me`)).data

const logout = async () =>
  (await axios.post(`${BASE}/logout`)).data

// Get all users (super_admin only)
const getUsers = async () =>
  (await axios.get(`${BASE}/users`)).data

// Create a new user (super_admin only)
const createUser = async (_token, data) =>
  (await axios.post(`${BASE}/users`, data)).data

// Update a user's role/dept/permissions (super_admin only)
const updateUserRole = async (_token, id, data) =>
  (await axios.put(`${BASE}/users/${id}/role`, data)).data

// Toggle a user active/inactive (super_admin only)
const toggleUser = async (_token, id) =>
  (await axios.put(`${BASE}/users/${id}/toggle`, {})).data

// Permanently delete a user (super_admin only)
const deleteUser = async (_token, id) =>
  (await axios.delete(`${BASE}/users/${id}`)).data

// Update granular module permissions for a user (super_admin only)
const updatePermissions = async (_token, id, modulePermissions) =>
  (await axios.put(`${BASE}/users/${id}/permissions`, { modulePermissions })).data

const authAPI = { login, setup, getMe, logout, getUsers, createUser, updateUserRole, toggleUser, deleteUser, updatePermissions }
export default authAPI
