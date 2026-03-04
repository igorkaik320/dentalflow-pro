import { createContext, useContext, useState, ReactNode } from "react";

interface ClinicInfo {
  name: string;
  logoUrl: string | null;
}

interface ClinicContextType {
  clinic: ClinicInfo;
  setClinic: (info: ClinicInfo) => void;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinic, setClinic] = useState<ClinicInfo>({
    name: "OdontoSaaS",
    logoUrl: null,
  });

  return (
    <ClinicContext.Provider value={{ clinic, setClinic }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error("useClinic must be used within ClinicProvider");
  return ctx;
}
