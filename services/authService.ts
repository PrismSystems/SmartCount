import { apiService } from './apiService';

interface User {
    id: string;
    email: string;
}

class AuthService {
    private currentUser: User | null = null;

    constructor() {
        this.loadCurrentUser();
    }

    private loadCurrentUser() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            this.currentUser = null;
            return;
        }

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            // Check if token is expired
            if (payload.exp * 1000 < Date.now()) {
                this.logout();
                return;
            }
            this.currentUser = { id: payload.userId, email: payload.email };
        } catch (error) {
            console.error('Invalid token:', error);
            this.logout();
        }
    }

    async login(email: string, password: string): Promise<boolean> {
        try {
            const response = await apiService.login(email, password);
            this.currentUser = response.user;
            return true;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    }

    async register(email: string, password: string): Promise<boolean> {
        try {
            const response = await apiService.register(email, password);
            this.currentUser = response.user;
            return true;
        } catch (error) {
            console.error('Registration failed:', error);
            return false;
        }
    }

    getCurrentUser(): string | null {
        return this.currentUser?.email || null;
    }

    getCurrentUserId(): string | null {
        return this.currentUser?.id || null;
    }

    saveCurrentUser(email: string): void {
        // This method is kept for compatibility but user is now saved via token
        console.log('User saved via token:', email);
    }

    logout(): void {
        this.currentUser = null;
        apiService.clearToken();
    }

    isAuthenticated(): boolean {
        return this.currentUser !== null;
    }
}

export const authService = new AuthService();
