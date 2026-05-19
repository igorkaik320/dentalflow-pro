import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureClinicForUser, type CloudClinic } from "@/lib/clinicCloud";

type ClinicInfo = {
  id: string | null;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string | null;
};

type ClinicContextType = {
  clinic: ClinicInfo;
  setClinic: (info: Partial<ClinicInfo>) => void;
  refreshClinic: () => Promise<void>;
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const fallbackClinic: ClinicInfo = {
  id: null,
  name: "OdontoSaaS",
  cnpj: "12.345.678/0001-90",
  phone: "(11) 3456-7890",
  email: "contato@odontosaas.com",
  address: "Av. Paulista, 1000, Sala 501 - São Paulo/SP",
  logoUrl: null,
};

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

function mapClinic(clinic: CloudClinic): ClinicInfo {
  return {
    id: clinic.id,
    name: clinic.name || fallbackClinic.name,
    cnpj: clinic.cnpj || "",
    phone: clinic.phone || "",
    email: clinic.email || "",
    address: clinic.address || "",
    logoUrl: clinic.logo_url,
  };
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinic, setClinicState] = useState<ClinicInfo>(fallbackClinic);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadClinic = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setClinicState(fallbackClinic);
      return;
    }

    const cloudClinic = await ensureClinicForUser(currentSession.user);
    setClinicState(mapClinic(cloudClinic));
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      try {
        await loadClinic(data.session);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(true);
      setTimeout(async () => {
        try {
          await loadClinic(nextSession);
        } finally {
          if (mounted) setLoading(false);
        }
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<ClinicContextType>(() => ({
    clinic,
    setClinic: (info) => setClinicState((prev) => ({ ...prev, ...info })),
    refreshClinic: async () => loadClinic(session),
    session,
    user: session?.user || null,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
      setSession(null);
      setClinicState(fallbackClinic);
    },
  }), [clinic, session, loading]);

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error("useClinic must be used within ClinicProvider");
  return ctx;
}
