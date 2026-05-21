import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureClinicForUser, type CloudClinic } from "@/lib/clinicCloud";
import { buildRolePermissions, mergePermissionRows, type AppRole, type PermissionAction, type PermissionMap, type PermissionModule } from "@/lib/permissions";

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
  memberRole: AppRole | null;
  permissions: PermissionMap;
  can: (module: PermissionModule, action?: PermissionAction) => boolean;
  session: Session | null;
  user: User | null;
  loading: boolean;
  accessError: string | null;
  signOut: () => Promise<void>;
};

const fallbackClinic: ClinicInfo = {
  id: null,
  name: "EsteticaPro",
  cnpj: "12.345.678/0001-90",
  phone: "(11) 3456-7890",
  email: "contato@esteticapro.com",
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
  const [memberRole, setMemberRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap>(buildRolePermissions(null));
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const loadClinic = async (currentSession: Session | null) => {
    setAccessError(null);
    if (!currentSession?.user) {
      setClinicState(fallbackClinic);
      setMemberRole(null);
      setPermissions(buildRolePermissions(null));
      return;
    }

    try {
      const cloudClinic = await ensureClinicForUser(currentSession.user);
      setClinicState(mapClinic(cloudClinic));
      const { data: member } = await supabase
        .from("clinic_members")
        .select("id, role")
        .eq("clinic_id", cloudClinic.id)
        .eq("user_id", currentSession.user.id)
        .maybeSingle();
      const role = (member?.role || null) as AppRole | null;
      setMemberRole(role);

      let permissionRows: any[] = [];
      if (member?.id) {
        const { data } = await supabase
          .from("clinic_member_permissions")
          .select("module, can_view, can_create, can_update, can_delete")
          .eq("clinic_id", cloudClinic.id)
          .eq("member_id", member.id);
        permissionRows = data || [];
      }
      setPermissions(mergePermissionRows(role, permissionRows));
    } catch (error) {
      setClinicState(fallbackClinic);
      setMemberRole(null);
      setPermissions(buildRolePermissions(null));
      setAccessError((error as Error).message || "Acesso pendente de aprovacao.");
    }
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

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event === "TOKEN_REFRESHED") return;

      if (!mounted) return;
      setLoading(false);
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
    memberRole,
    permissions,
    can: (module, action = "view") => memberRole === "admin" || Boolean(permissions[module]?.[action]),
    session,
    user: session?.user || null,
    loading,
    accessError,
    signOut: async () => {
      await supabase.auth.signOut();
      setSession(null);
      setClinicState(fallbackClinic);
      setMemberRole(null);
      setPermissions(buildRolePermissions(null));
      setAccessError(null);
    },
  }), [clinic, session, loading, accessError, memberRole, permissions]);

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error("useClinic must be used within ClinicProvider");
  return ctx;
}
