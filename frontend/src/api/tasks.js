// FILE: src/api/tasks.js
import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/tasks`

const getTasks    = async (_token)           => (await axios.get(BASE)).data
const createTask  = async (_token, data)     => (await axios.post(BASE, data)).data
const updateTask  = async (_token, id, data) => (await axios.put(`${BASE}/${id}`, data)).data
const deleteTask  = async (_token, id)       => (await axios.delete(`${BASE}/${id}`)).data
const addComment  = async (_token, id, text) => (await axios.post(`${BASE}/${id}/comments`, { text })).data

const tasksAPI = { getTasks, createTask, updateTask, deleteTask, addComment }
export default tasksAPI
