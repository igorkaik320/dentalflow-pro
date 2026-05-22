import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  FileText,
  Settings,
  Activity,
  ClipboardList,
  Lock,
  Boxes,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useClinic } from "@/contexts/ClinicContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useState } from "react";
import type { PermissionModule } from "@/lib/permissions";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
  { title: "Agenda", url: "/agenda", icon: Calendar, module: "agenda" },
  { title: "Cadastros", url: "/cadastros", icon: ClipboardList, module: "registrations" },
  { title: "Patrimonio", url: "/patrimonio", icon: Boxes, module: "patrimony" },
];

const financeItems = [
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, module: "financial" },
  { title: "Parcelas", url: "/financeiro/parcelas", icon: FileText, module: "payable_installments" },
];

const systemItems = [
  { title: "Configuracoes", url: "/configuracoes", icon: Settings, module: "settings" },
  { title: "Seguranca", url: "/seguranca", icon: Lock, module: "security" },
];

function ClinicLogo({ logoUrl }: { logoUrl: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (logoUrl && logoUrl !== failedUrl) {
    return <img src={logoUrl} alt="Logo" className="h-full w-full rounded-md object-cover" onError={() => setFailedUrl(logoUrl)} />;
  }
  return <Activity className="h-4 w-4 text-sidebar-primary-foreground" />;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { clinic, can } = useClinic();
  const isActive = (path: string) =>
    path === "/" || path === "/financeiro" ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={`border-b border-sidebar-border py-3 ${collapsed ? "px-2" : "px-3"}`}>
        <div className={`flex items-center gap-2.5 overflow-hidden ${collapsed ? "justify-center" : ""}`}>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${clinic.logoUrl ? "bg-white" : "bg-sidebar-primary"}`}>
            <ClinicLogo logoUrl={clinic.logoUrl} />
          </div>
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <p className="text-sm font-bold text-sidebar-accent-foreground truncate">{clinic.name}</p>
              <p className="text-[10px] text-sidebar-muted">Gestão Estética</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const allowed = can(item.module as PermissionModule);
                return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/"} className={!allowed ? "opacity-60" : ""}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && !allowed && <Lock className="ml-auto h-3.5 w-3.5" />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider mb-1">
            Financeiro
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeItems.map((item) => {
                const allowed = can(item.module as PermissionModule);
                return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className={!allowed ? "opacity-60" : ""}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && !allowed && <Lock className="ml-auto h-3.5 w-3.5" />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider mb-1">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => {
                const allowed = can(item.module as PermissionModule);
                return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className={!allowed ? "opacity-60" : ""}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && !allowed && <Lock className="ml-auto h-3.5 w-3.5" />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="text-[10px] text-sidebar-muted text-center">© 2026 {clinic.name} v1.0</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
