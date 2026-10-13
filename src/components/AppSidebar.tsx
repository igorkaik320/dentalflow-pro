import { useState } from "react";
import { LayoutDashboard, CircleDollarSign, ClipboardList, Lock, Boxes, ShieldCheck, ChevronLeft, ChevronRight, User, Building2, Stethoscope, Tag, Landmark, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useClinic } from "@/contexts/ClinicContext";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { PermissionModule } from "@/lib/permissions";

type MenuItem = { title: string; url: string; icon: typeof User; module: PermissionModule; adminOnly?: boolean };
const groups: { key: string; label: string; icon: typeof User; items: MenuItem[] }[] = [
  { key: "management", label: "Gestão", icon: LayoutDashboard, items: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
    { title: "Patrimônio", url: "/patrimonio", icon: Boxes, module: "patrimony" },
  ] },
  { key: "financial", label: "Financeiro", icon: CircleDollarSign, items: [
    { title: "Contas a Receber", url: "/financeiro/receber", icon: ArrowUpCircle, module: "financial" },
    { title: "Contas a Pagar", url: "/financeiro/pagar", icon: ArrowDownCircle, module: "financial" },
    { title: "Controle de Caixa", url: "/financeiro/caixa", icon: Wallet, module: "financial" },
  ] },
  { key: "registrations", label: "Cadastros", icon: ClipboardList, items: [
    { title: "Empresas", url: "/cadastros?tab=companies", icon: Building2, module: "registrations" },
    { title: "Clientes", url: "/cadastros?tab=patients", icon: User, module: "registrations" },
    { title: "Procedimentos", url: "/cadastros?tab=procedures", icon: Stethoscope, module: "registrations" },
    { title: "Credores", url: "/cadastros?tab=suppliers", icon: Building2, module: "registrations" },
    { title: "Categorias", url: "/cadastros?tab=categories", icon: Tag, module: "registrations" },
    { title: "Contas Correntes", url: "/cadastros?tab=accounts", icon: Landmark, module: "registrations" },
  ] },
  { key: "security", label: "Segurança", icon: Lock, items: [
    { title: "Usuários e permissões", url: "/seguranca", icon: Lock, module: "security" },
    { title: "Auditoria", url: "/auditoria", icon: ShieldCheck, module: "security", adminOnly: true },
  ] },
];
const roleLabels = { admin: "Administrador", reception: "Recepção", dentist: "Especialista", finance: "Financeiro" };

export function AppSidebar() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const { pathname, search } = useLocation();
  const { clinic, can, memberRole } = useClinic();
  const currentKey = pathname.startsWith("/financeiro") ? "financial" : pathname === "/cadastros" ? "registrations" : ["/seguranca", "/auditoria"].includes(pathname) ? "security" : "management";
  const [activeGroup, setActiveGroup] = useState<string | null>(currentKey);
  const group = groups.find(g => g.key === activeGroup);
  const panel = group && <div className="flex h-full min-h-0 flex-col bg-sidebar-accent text-sidebar-foreground">
    <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-3">
      <div className="min-w-0"><p className="truncate text-[10px] font-medium text-sidebar-muted">{clinic.name}</p><h2 className="mt-0.5 text-sm font-bold text-sidebar-accent-foreground">{group.label}</h2></div>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Recolher menu" onClick={() => { setActiveGroup(null); setOpenMobile(false); }}><ChevronLeft /></Button>
    </div>
    <nav aria-label={group.label} className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
      {group.items.filter(item => !item.adminOnly || memberRole === "admin").map(item => {
        const active = item.url.includes("?") ? pathname + search === item.url : pathname === item.url;
        const allowed = can(item.module, "view");
        return <Button key={item.url} asChild variant="ghost" className={`h-9 w-full justify-start gap-2 rounded-md px-3 text-[13px] hover:bg-sidebar hover:text-sidebar-foreground ${active ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "text-sidebar-foreground/90"} ${!allowed ? "opacity-50" : ""}`}>
          <NavLink to={item.url} end activeClassName="" onClick={() => setOpenMobile(false)}><item.icon className="h-4 w-4" /><span className="flex-1 truncate">{item.title}</span>{!allowed ? <Lock className="h-3 w-3" /> : active ? <ChevronRight className="h-3 w-3" /> : null}</NavLink>
        </Button>;
      })}
    </nav>
    <div className="border-t border-sidebar-border p-3"><div className="flex items-center gap-2"><User className="h-4 w-4 text-sidebar-muted" /><div className="min-w-0"><p className="truncate text-xs font-medium">{memberRole ? roleLabels[memberRole] : "Usuário"}</p><p className="truncate text-[10px] text-sidebar-muted">{clinic.name}</p></div></div></div>
  </div>;
  return <>
    <aside className={`sticky top-0 z-40 flex h-screen shrink-0 border-r border-sidebar-border ${group && !isMobile ? "w-[260px]" : "w-[60px]"}`}>
      <div className="flex w-[60px] shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-4">
        <div className="mb-6 flex h-10 items-center"><Tooltip><TooltipTrigger asChild><Button asChild variant="ghost" size="icon" className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"><NavLink to="/" aria-label="Página inicial"><LayoutDashboard /></NavLink></Button></TooltipTrigger><TooltipContent side="right">Página inicial</TooltipContent></Tooltip></div>
        <nav aria-label="Módulos" className="flex flex-col gap-1">{groups.map(g => <Tooltip key={g.key}><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={g.label} aria-expanded={activeGroup === g.key} onClick={() => { setActiveGroup(activeGroup === g.key && !isMobile ? null : g.key); if (isMobile) setOpenMobile(true); }} className={`h-10 w-10 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-foreground ${activeGroup === g.key ? "bg-sidebar-primary text-sidebar-primary-foreground" : currentKey === g.key ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-muted"}`}><g.icon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent side="right">{g.label}</TooltipContent></Tooltip>)}</nav>
      </div>
      {!isMobile && group && <div className="w-[200px] min-w-0">{panel}</div>}
    </aside>
    {isMobile && <Sheet open={openMobile} onOpenChange={setOpenMobile}><SheetContent side="left" className="w-[260px] border-sidebar-border bg-sidebar-accent p-0 [&>button]:hidden"><SheetTitle className="sr-only">Menu da clínica</SheetTitle>{panel}</SheetContent></Sheet>}
  </>;
}
