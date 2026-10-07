import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Wallet, FileText, Settings, ClipboardList, Lock, Boxes, ShieldCheck, ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useClinic } from "@/contexts/ClinicContext";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import type { PermissionModule } from "@/lib/permissions";

const groups: Array<{ label: string; items: Array<{ title: string; url: string; icon: typeof LayoutDashboard; module: PermissionModule; adminOnly?: boolean }> }> = [
  { label: "Gestão", items: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
    { title: "Cadastros", url: "/cadastros", icon: ClipboardList, module: "registrations" },
    { title: "Patrimônio", url: "/patrimonio", icon: Boxes, module: "patrimony" },
  ] },
  { label: "Financeiro", items: [
    { title: "Contas a Receber", url: "/financeiro/receber", icon: ArrowUpCircle, module: "financial" },
    { title: "Contas a Pagar", url: "/financeiro/pagar", icon: ArrowDownCircle, module: "financial" },
    { title: "Controle de Caixa", url: "/financeiro/caixa", icon: Wallet, module: "financial" },
    { title: "Parcelas", url: "/financeiro/parcelas", icon: FileText, module: "payable_installments" },
  ] },
  { label: "Administração", items: [
    { title: "Auditoria", url: "/auditoria", icon: ShieldCheck, module: "security", adminOnly: true },
    { title: "Segurança", url: "/seguranca", icon: Lock, module: "security" },
    { title: "Configurações", url: "/configuracoes", icon: Settings, module: "settings" },
  ] },
];
const roleLabels = { admin: "Administrador", reception: "Recepção", dentist: "Especialista", finance: "Financeiro" };

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { pathname } = useLocation();
  const { clinic, can, memberRole } = useClinic();
  return <Sidebar collapsible="icon" className="border-r border-sidebar-border">
    <SidebarHeader className="border-b border-sidebar-border px-5 py-6 group-data-[collapsible=icon]:px-2">
      {!collapsed && <div className="min-w-0"><p className="truncate text-lg font-semibold text-sidebar-accent-foreground">{clinic.name}</p><p className="mt-1 text-xs text-sidebar-muted">Gestão da clínica</p></div>}
    </SidebarHeader>
    <SidebarContent className="px-2 py-4 gap-4">
      {groups.map(group => <SidebarGroup key={group.label} className="py-0"><SidebarGroupLabel className="mb-2 text-xs font-medium text-sidebar-muted">{group.label}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu className="gap-1">
        {group.items.filter(item => !item.adminOnly || memberRole === "admin").map(item => {
          const active = pathname === item.url;
          const allowed = can(item.module);
          return <SidebarMenuItem key={item.url}><SidebarMenuButton asChild tooltip={item.title} isActive={active} className="h-10 px-3 data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-primary data-[active=true]:font-semibold">
            <NavLink to={item.url} end onClick={() => { if (isMobile) setOpenMobile(false); }} className={!allowed ? "opacity-50" : ""}><item.icon /><span>{item.title}</span>{!collapsed && (!allowed ? <Lock className="ml-auto h-3 w-3" /> : active ? <ChevronRight className="ml-auto h-3 w-3" /> : null)}</NavLink>
          </SidebarMenuButton></SidebarMenuItem>;
        })}
      </SidebarMenu></SidebarGroupContent></SidebarGroup>)}
    </SidebarContent>
    <SidebarFooter className="border-t border-sidebar-border p-4 group-data-[collapsible=icon]:p-2">
      {!collapsed && <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-sidebar-primary" /><div className="min-w-0"><p className="text-xs font-medium text-sidebar-accent-foreground">{memberRole ? roleLabels[memberRole] : "Usuário"}</p><p className="mt-0.5 text-[11px] text-sidebar-muted">{clinic.name} · 2026</p></div></div>}
    </SidebarFooter>
  </Sidebar>;
}
