import type { Project, PdfFile } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

class ApiService {
    private token: string | null = localStorage.getItem('authToken');

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;
        const config: RequestInit = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { Authorization: `Bearer ${this.token}` }),
                ...options.headers,
            },
            ...options,
        };

        // Remove Content-Type for FormData
        if (options.body instanceof FormData) {
            delete (config.headers as any)['Content-Type'];
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Network error' }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    setToken(token: string) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    // Auth endpoints
    async login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
        const response = await this.request<{ token: string; user: { id: string; email: string } }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(response.token);
        return response;
    }

    async register(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
        const response = await this.request<{ token: string; user: { id: string; email: string } }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(response.token);
        return response;
    }

    // Project endpoints
    async getProjects(): Promise<Project[]> {
        return this.request<Project[]>('/projects');
    }

    async createProject(name: string, files: File[], data?: any): Promise<Project> {
        const formData = new FormData();
        formData.append('name', name);
        if (data) {
            formData.append('data', JSON.stringify(data));
        }
        files.forEach(file => formData.append('pdfs', file));

        return this.request<Project>('/projects', {
            method: 'POST',
            body: formData,
        });
    }

    async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
        return this.request<Project>(`/projects/${projectId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteProject(projectId: string): Promise<void> {
        await this.request(`/projects/${projectId}`, {
            method: 'DELETE',
        });
    }

    // PDF endpoints
    async getPdfData(pdfId: string): Promise<string> {
        const response = await fetch(`${API_BASE_URL}/pdfs/${pdfId}/data`, {
            headers: {
                ...(this.token && { Authorization: `Bearer ${this.token}` }),
            },
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch PDF data');
        }
        
        return response.text();
    }

    async addPdfsToProject(projectId: string, files: File[]): Promise<Project> {
        const formData = new FormData();
        files.forEach(file => formData.append('pdfs', file));

        return this.request<Project>(`/projects/${projectId}/pdfs`, {
            method: 'POST',
            body: formData,
        });
    }
}

export const apiService = new ApiService();