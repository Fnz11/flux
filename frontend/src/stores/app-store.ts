import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AppState {
  currentUser: string | null
  isManager: boolean
  activeVaultId: string | null
}

interface AppActions {
  setCurrentUser: (address: string | null) => void
  setMode: (isManager: boolean) => void
  toggleMode: () => void
  setActiveVaultId: (vaultId: string | null) => void
}

type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      currentUser: null,
      isManager: false,
      activeVaultId: null,

      setCurrentUser: (address) => set({ currentUser: address }),
      setMode: (isManager) => set({ isManager }),
      toggleMode: () => set((s) => ({ isManager: !s.isManager })),
      setActiveVaultId: (vaultId) => set({ activeVaultId: vaultId }),
    }),
    {
      name: 'fbyt-app',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ isManager: state.isManager }),
    },
  ),
)
