import { create } from "zustand";

interface UIState {
  isSidebarOpen: boolean;
  selectedDate: string;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedDate: (date: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isSidebarOpen: true,
  selectedDate: new Date().toISOString().split("T")[0],
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
