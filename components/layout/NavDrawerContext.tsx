'use client';

// Shares the mobile-nav drawer open/close state between the Topbar hamburger and the
// Sidebar drawer (siblings in the dashboard shell). Inert on desktop.
import { createContext, useContext, useState } from 'react';

const NavDrawerContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} });

export function NavDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <NavDrawerContext.Provider value={{ open, setOpen }}>{children}</NavDrawerContext.Provider>;
}

export const useNavDrawer = () => useContext(NavDrawerContext);
