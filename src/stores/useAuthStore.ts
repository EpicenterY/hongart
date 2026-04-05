import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  isAuthenticated: boolean;
  lastLoginAt: string | null;
  login: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      lastLoginAt: null,
      login: () =>
        set({ isAuthenticated: true, lastLoginAt: new Date().toISOString() }),
      logout: () => set({ isAuthenticated: false, lastLoginAt: null }),
    }),
    {
      name: "hongart-auth",
    }
  )
);
