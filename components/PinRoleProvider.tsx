"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type PinRole = "admin" | "user";

type PinRoleContextValue = {
  role: PinRole;
  setRole: (role: PinRole) => void;
};

const PinRoleContext = createContext<PinRoleContextValue | null>(null);

type PinRoleProviderProps = {
  initialRole: PinRole;
  children: React.ReactNode;
};

export default function PinRoleProvider({ initialRole, children }: PinRoleProviderProps) {
  const [role, setRole] = useState<PinRole>(initialRole);

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  const value = useMemo(() => ({ role, setRole }), [role]);

  return <PinRoleContext.Provider value={value}>{children}</PinRoleContext.Provider>;
}

export function usePinRole() {
  const context = useContext(PinRoleContext);
  if (!context) {
    throw new Error("usePinRole must be used within PinRoleProvider");
  }
  return context;
}
