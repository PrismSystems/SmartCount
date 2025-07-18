const AUTH_STORAGE_KEY = 'smart-count-users';
const SESSION_STORAGE_KEY = 'smart-count-session';

interface UserStore {
    [email: string]: {
        password: string; // Stored in plaintext, NOT FOR PRODUCTION USE
    };
}

const getUsers = (): UserStore => {
    try {
        const usersJson = localStorage.getItem(AUTH_STORAGE_KEY);
        return usersJson ? JSON.parse(usersJson) : {};
    } catch (error) {
        console.error("Failed to load users from localStorage", error);
        return {};
    }
};

const saveUsers = (users: UserStore): void => {
    try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
    } catch (error) {
        console.error("Failed to save users to localStorage", error);
    }
};

export const authService = {
    async register(email: string, password: string): Promise<{ success: boolean; message: string }> {
        const users = getUsers();
        if (!email || !password) {
            return { success: false, message: 'Email and password cannot be empty.' };
        }
        if (users[email]) {
            return { success: false, message: 'User with this email already exists.' };
        }
        users[email] = { password };
        saveUsers(users);
        return { success: true, message: 'Registration successful. Please log in.' };
    },

    async login(email: string, password: string): Promise<{ success: boolean; message: string }> {
        const users = getUsers();
        const user = users[email];
        if (!user) {
            return { success: false, message: 'User not found.' };
        }
        if (user.password !== password) {
            return { success: false, message: 'Incorrect password.' };
        }
        this.saveCurrentUser(email);
        return { success: true, message: 'Login successful.' };
    },

    logout(): void {
        try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (error) {
            console.error("Failed to clear session storage", error);
        }
    },

    getCurrentUser(): string | null {
        try {
            return sessionStorage.getItem(SESSION_STORAGE_KEY);
        } catch (error) {
            console.error("Failed to get user from session storage", error);
            return null;
        }
    },

    saveCurrentUser(email: string): void {
        try {
            sessionStorage.setItem(SESSION_STORAGE_KEY, email);
        } catch (error) {
            console.error("Failed to save user to session storage", error);
        }
    },
};