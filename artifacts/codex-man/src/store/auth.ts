import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

// Check initial state from localStorage safely
const getInitialAuth = () => {
  try {
    return localStorage.getItem('codex_man_auth') === 'true';
  } catch {
    return false;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: getInitialAuth(),
  login: () => {
    localStorage.setItem('codex_man_auth', 'true');
    set({ isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('codex_man_auth');
    set({ isAuthenticated: false });
  },
}));
