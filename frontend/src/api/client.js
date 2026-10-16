import axios from 'axios'
import toast from 'react-hot-toast'

const client = axios.create({
  baseURL: '/api',
  timeout: 120_000,
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Lỗi không xác định'
    toast.error(msg)
    return Promise.reject(err)
  }
)

export default client

// ── Flow ─────────────────────────────────────────────────────────────────────
export const getSalesFlow       = (data) => client.post('/flow/sales', data)
export const getSalesItemFlow   = (data) => client.post('/flow/sales-item', data)
export const getReturnsFlow     = (data) => client.post('/flow/returns', data)
export const getReturnsItemFlow = (data) => client.post('/flow/returns-item', data)
export const checkPoGrpo        = (data) => client.post('/flow/check-po-grpo', data)
export const checkSoAr          = (data) => client.post('/flow/check-so-ar', data)
export const getFlowChain       = (po, data) => client.post(`/flow/chain/${po}`, data)

// ── Origin ───────────────────────────────────────────────────────────────────
export const queryOrigin = (data) => client.post('/origin/query', data)

// ── GRPO ─────────────────────────────────────────────────────────────────────
export const getGrpoOverPo = (data) => client.post('/grpo/over-po', data)

// ── Config ───────────────────────────────────────────────────────────────────
export const getConnections    = ()       => client.get('/config/connections')
export const createConnection  = (data)   => client.post('/config/connections', data)
export const updateConnection  = (id, d)  => client.put(`/config/connections/${id}`, d)
export const deleteConnection  = (id)     => client.delete(`/config/connections/${id}`)
export const testConnection    = (data)   => client.post('/config/connections/test', data)
