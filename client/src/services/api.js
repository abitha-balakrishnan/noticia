import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// In-memory token storage (per spec: "stores JWT in memory (React Context, not localStorage per security best practice)")
let inMemoryToken = null;

export const setAuthToken = (token) => {
  inMemoryToken = token;
};

export const getAuthToken = () => inMemoryToken;

// Axios Request Interceptor: Attach JWT Bearer token automatically
api.interceptors.request.use((config) => {
  if (inMemoryToken) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Axios Response Interceptor: Clean error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// --- Auth Endpoints ---
export const authApi = {
  register: (data) => api.post('/api/auth/register', data).then(r => r.data),
  login: (data) => api.post('/api/auth/login', data).then(r => r.data),
  verifyOtp: (data) => api.post('/api/auth/verify-otp', data).then(r => r.data),
  logout: () => api.post('/api/auth/logout').then(r => r.data),
  getMe: () => api.get('/api/auth/me').then(r => r.data)
};

// --- Dashboard Endpoints ---
export const dashboardApi = {
  getSummary: () => api.get('/api/dashboard/summary').then(r => r.data)
};

// --- Alerts Endpoints ---
export const alertsApi = {
  getAlerts: (params) => api.get('/api/alerts', { params }).then(r => r.data),
  getAlertById: (id) => api.get(`/api/alerts/${id}`).then(r => r.data),
  updateStatus: (id, status) => api.patch(`/api/alerts/${id}/status`, { status }).then(r => r.data),
  triggerMl: () => api.post('/api/alerts/process').then(r => r.data)
};

// --- Logs Endpoints ---
export const logsApi = {
  getLogs: (params) => api.get('/api/logs', { params }).then(r => r.data),
  ingest: (data, serviceKey) => api.post('/api/logs/ingest', data, {
    headers: { 'x-service-key': serviceKey || 'noticia_internal_service_key_987654321' }
  }).then(r => r.data)
};

// --- Chat (RAG) Endpoints ---
export const chatApi = {
  sendQuery: (question) => api.post('/api/chat/query', { question }).then(r => r.data),
  getHistory: () => api.get('/api/chat/history').then(r => r.data)
};

// --- Actions Endpoints ---
export const actionsApi = {
  getBlockedIps: () => api.get('/api/actions/blocked-ips').then(r => r.data),
  blockIp: (data) => api.post('/api/actions/block-ip', data).then(r => r.data),
  unblockIp: (id) => api.delete(`/api/actions/block-ip/${id}`).then(r => r.data)
};

// --- Users (Settings) Endpoints ---
export const usersApi = {
  getUsers: () => api.get('/api/users').then(r => r.data),
  updateRole: (id, role) => api.patch(`/api/users/${id}/role`, { role }).then(r => r.data)
};

export default api;
