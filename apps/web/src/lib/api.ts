import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    register: (email: string, password: string, name: string) =>
        api.post('/auth/register', { email, password, name }),
};

// Users API
export const usersApi = {
    getProfile: () => api.get('/users/me'),
    updateProfile: (data: { name?: string; email?: string }) =>
        api.put('/users/me', data),
    changePassword: (currentPassword: string, newPassword: string) =>
        api.put('/users/me/password', { currentPassword, newPassword }),
};

// Servers API
export const serversApi = {
    getAll: () => api.get('/servers'),
    getOne: (id: string) => api.get(`/servers/${id}`),
    create: (data: {
        name: string;
        host: string;
        port?: number;
        username: string;
        authType: 'PASSWORD' | 'KEY';
        password?: string;
        privateKey?: string;
        passphrase?: string;
        description?: string;
        tags?: string[];
    }) => api.post('/servers', data),
    update: (id: string, data: any) => api.put(`/servers/${id}`, data),
    delete: (id: string) => api.delete(`/servers/${id}`),
    testConnection: (id: string, timeout?: number) =>
        api.post(`/servers/${id}/test`, { timeout }),
};

// Executions API
export const executionsApi = {
    getAll: (serverId?: string, limit?: number) =>
        api.get('/executions', { params: { serverId, limit } }),
    getOne: (id: string) => api.get(`/executions/${id}`),
};

// Audit API
export const auditApi = {
    getMyLogs: (limit?: number) => api.get('/audit/me', { params: { limit } }),
    getAllLogs: (limit?: number) => api.get('/audit', { params: { limit } }),
};

// Chat Sessions API (History)
export const chatSessionsApi = {
    getAll: () => api.get('/chat/sessions'),
    getOne: (id: string) => api.get(`/chat/sessions/${id}`),
    create: (data: { title?: string; messages: any[]; serverId: string; serverName: string }) =>
        api.post('/chat/sessions', data),
    update: (id: string, data: { title?: string; messages?: any[] }) =>
        api.put(`/chat/sessions/${id}`, data),
    delete: (id: string) => api.delete(`/chat/sessions/${id}`),
};

// Health API (no auth required)
export const healthApi = {
    getStatus: () => api.get('/health'),
    getDatabaseStatus: () => api.get('/health/db'),
};

export default api;

