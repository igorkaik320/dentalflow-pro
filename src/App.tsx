import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClinicProvider } from "@/contexts/ClinicContext";
import { ClinicLayout } from "@/components/ClinicLayout";
import { AuthGate } from "@/components/AuthGate";
import { useClinic } from "@/contexts/ClinicContext";
import type { PermissionModule } from "@/lib/permissions";
import DashboardPage from "./pages/DashboardPage";
import AgendaPage from "./pages/AgendaPage";
import FinancialPage from "./pages/FinancialPage";
import PayableInstallmentsPage from "./pages/PayableInstallmentsPage";
import PatrimonyPage from "./pages/PatrimonyPage";
import SettingsPage from "./pages/SettingsPage";
import SecurityPage from "./pages/SecurityPage";
import RegistrationsPage from "./pages/RegistrationsPage";
import NotFound from "./pages/NotFound";

function AccessGuard({ module, children }: { module: PermissionModule; children: JSX.Element }) {
  const { can } = useClinic();
  if (!can(module, "view")) {
    return (
      <ClinicLayout title="Acesso restrito" subtitle="Seu usuario nao tem permissao para consultar esta area">
        <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          Solicite a um administrador a liberacao deste modulo em Seguranca.
        </div>
      </ClinicLayout>
    );
  }
  return children;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ClinicProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthGate>
            <Routes>
              <Route path="/" element={<AccessGuard module="dashboard"><DashboardPage /></AccessGuard>} />
              <Route path="/login" element={<AccessGuard module="dashboard"><DashboardPage /></AccessGuard>} />
              <Route path="/agenda" element={<AccessGuard module="agenda"><AgendaPage /></AccessGuard>} />
              <Route path="/cadastros" element={<AccessGuard module="registrations"><RegistrationsPage /></AccessGuard>} />
              <Route path="/financeiro" element={<AccessGuard module="financial"><FinancialPage /></AccessGuard>} />
              <Route path="/financeiro/parcelas" element={<AccessGuard module="payable_installments"><PayableInstallmentsPage /></AccessGuard>} />
              <Route path="/patrimonio" element={<AccessGuard module="patrimony"><PatrimonyPage /></AccessGuard>} />
              <Route path="/configuracoes" element={<AccessGuard module="settings"><SettingsPage /></AccessGuard>} />
              <Route path="/seguranca" element={<AccessGuard module="security"><SecurityPage /></AccessGuard>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthGate>
        </BrowserRouter>
      </ClinicProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
