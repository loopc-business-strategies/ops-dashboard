// FILE: src/api/projects.js
// HTTP: /api/projects (Mongo collection remains `tasks` via Task model).
import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/projects`
const TEMPLATES_BASE = `${API_ORIGIN}/api/task-templates`

const getProjects = async (_token) => (await axios.get(BASE)).data
const createProject = async (_token, data) => (await axios.post(BASE, data)).data
const updateProject = async (_token, id, data) => (await axios.put(`${BASE}/${id}`, data)).data
const deleteProject = async (_token, id) => (await axios.delete(`${BASE}/${id}`)).data
const addProjectComment = async (_token, id, text) => (await axios.post(`${BASE}/${id}/comments`, { text })).data

const uploadProjectAttachment = async (_token, projectId, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return (await axios.post(`${BASE}/${projectId}/attachments`, fd)).data
}

const deleteProjectAttachment = async (_token, projectId, fileName) =>
  (await axios.delete(`${BASE}/${projectId}/attachments/${encodeURIComponent(fileName)}`)).data

const listTaskTemplates = async () => (await axios.get(TEMPLATES_BASE)).data

const createTaskTemplate = async (data) => (await axios.post(TEMPLATES_BASE, data)).data

const deleteTaskTemplate = async (id) => (await axios.delete(`${TEMPLATES_BASE}/${encodeURIComponent(id)}`)).data

const instantiateTaskTemplate = async (id, body) =>
  (await axios.post(`${TEMPLATES_BASE}/${encodeURIComponent(id)}/instantiate`, body || {})).data

const projectsAPI = {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  addProjectComment,
  uploadProjectAttachment,
  deleteProjectAttachment,
  listTaskTemplates,
  createTaskTemplate,
  deleteTaskTemplate,
  instantiateTaskTemplate,
}
export default projectsAPI
