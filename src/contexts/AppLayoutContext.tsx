import { createContext, useContext, type ReactNode } from 'react';

export interface AppLayoutContextValue {
  sidebarOpen: boolean;
}

const AppLayoutContext = createContext<AppLayoutContextValue>({ sidebarOpen: true });

export function AppLayoutProvider({
  sidebarOpen,
  children,
}: {
  sidebarOpen: boolean;
  children: ReactNode;
}) {
  return (
    <AppLayoutContext.Provider value={{ sidebarOpen }}>{children}</AppLayoutContext.Provider>
  );
}

export function useAppLayout() {
  return useContext(AppLayoutContext);
}
