import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import OfflineIndicator from "@/components/OfflineIndicator";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import TimeClock from "@/pages/TimeClock";
import WorkOrders from "@/pages/WorkOrders";
import WorkOrderDetail from "@/pages/WorkOrderDetail";
import AdminReports from "@/pages/AdminReports";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-body animate-pulse-warm">Loading...</p>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/time-clock" element={<TimeClock />} />
        <Route path="/work-orders" element={<WorkOrders />} />
        <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
        <Route path="/admin" element={<AdminReports />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<ProtectedRoutes />} />
          </Routes>
          <OfflineIndicator />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
