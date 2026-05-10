// FILE: src/main.jsx
// This is the very first file React runs.
// It finds the <div id="root"> in index.html and renders the app inside it.

import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App'
import { installCsrfInterceptor } from './utils/csrfInterceptor'
import './index.css'

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/'
axios.defaults.withCredentials = true

installCsrfInterceptor(axios)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
