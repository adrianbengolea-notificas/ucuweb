'use client';

import { createContext, useContext, useState } from 'react';

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
};

const SidebarCtx = createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarCtx.Provider value={{ collapsed, setCollapsed }}>{children}</SidebarCtx.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarCtx);
}
