import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClinicProvider } from "@/contexts/ClinicContext";
import { AuthGate } from "@/components/AuthGate";
import DashboardPage from "./pages/DashboardPage";
import AgendaPage from "./pages/AgendaPage";
import FinancialPage from "./pages/FinancialPage";
import PayableInstallmentsPage from "./pages/PayableInstallmentsPage";
import SettingsPage from "./pages/SettingsPage";
import SecurityPage from "./pages/SecurityPage";
import RegistrationsPage from "./pages/RegistrationsPage";
import NotFound from "./pages/NotFound";

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
              <Route path="/" element={<DashboardPage />} />
              <Route path="/login" element={<DashboardPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/cadastros" element={<RegistrationsPage />} />
              <Route path="/financeiro" element={<FinancialPage />} />
              <Route path="/financeiro/parcelas" element={<PayableInstallmentsPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
              <Route path="/seguranca" element={<SecurityPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthGate>
        </BrowserRouter>
      </ClinicProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
