import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, type User } from '../services/auth.service';

export type { User };

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface AuthContextType extends AuthState {
    login: (user: User, token: string) => void;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: true
    });

    const refreshUser = async () => {
        try {
            const freshUser = await authService.getMe();
            localStorage.setItem('user', JSON.stringify(freshUser));
            setState(prev => ({ ...prev, user: freshUser, isAuthenticated: true }));
        } catch (err) {
            console.error('Failed to sync user session:', err);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
            try {
                const parsedUser = JSON.parse(userStr);
                setState({ user: parsedUser, token, isAuthenticated: true, isLoading: false });
                // Refresh asynchronously in background
                refreshUser();
            } catch {
                setState(prev => ({ ...prev, isLoading: false }));
            }
        } else {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, []);

    const login = (user: User, token: string) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setState({ user, token, isAuthenticated: true, isLoading: false });
    };

    const logout = async () => {
        try {
            await authService.logout();
        } catch {
            // ignore network errors on logout
        } finally {
            setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
    };

    return (
        <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
