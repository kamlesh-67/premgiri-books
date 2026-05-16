import { create } from 'zustand'

export type UiMode = 'simple' | 'advanced'
export type DashboardView = 'business' | 'accountant'

interface UiStore {
  uiMode: UiMode
  setUiMode: (mode: UiMode) => void
  dashboardView: DashboardView
  setDashboardView: (view: DashboardView) => void
}

export const useUiStore = create<UiStore>((set) => ({
  uiMode: 'simple',            // hydrated from session in UiModeProvider (Plan 01-02)
  setUiMode: (mode) => set({ uiMode: mode }),
  dashboardView: 'business',
  setDashboardView: (view) => set({ dashboardView: view }),
}))
