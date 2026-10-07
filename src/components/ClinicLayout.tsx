import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/contexts/ClinicContext";

interface ClinicLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function ClinicLayout({ children, title, subtitle }: ClinicLayoutProps) {
  const { clinic, user, memberRole, signOut } = useClinic();
  const initials = (user?.email || clinic.name || "U")
    .split("@")[0]
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="min-h-20 flex items-center justify-between border-b border-border bg-card px-4 sm:px-6 py-3 gap-3 shrink-0">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="text-muted-foreground" />
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground leading-tight">{title}</h1>
                {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden lg:block text-right min-w-0 max-w-56"><p className="truncate text-xs font-medium">{user?.email}</p><p className="text-[11px] text-muted-foreground mt-1">{memberRole === "admin" ? "Administrador" : memberRole === "finance" ? "Financeiro" : memberRole === "dentist" ? "Especialista" : "Recepção"}</p></div>
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                {initials}
              </div>
              <Button variant="outline" size="sm" onClick={signOut} aria-label="Sair" title="Sair" className="gap-1.5">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
