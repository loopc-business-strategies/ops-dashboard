// FILE: src/api/tasks.js
import axios from 'axios'

const BASE = '/api/tasks'
const h = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

const getTasks    = async (token)           => (await axios.get(BASE, h(token))).data
const createTask  = async (token, data)     => (await axios.post(BASE, data, h(token))).data
const updateTask  = async (token, id, data) => (await axios.put(`${BASE}/${id}`, data, h(token))).data
const deleteTask  = async (token, id)       => (await axios.delete(`${BASE}/${id}`, h(token))).data
const addComment  = async (token, id, text) => (await axios.post(`${BASE}/${id}/comments`, { text }, h(token))).data

const tasksAPI = { getTasks, createTask, updateTask, deleteTask, addComment }
export default tasksAPI
