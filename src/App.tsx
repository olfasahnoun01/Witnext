import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppCompanyProvider } from '@/contexts/AppCompanyContext';
import { AppLayout } from '@/layouts/AppLayout';
import { BossLayout } from '@/layouts/BossLayout';
import Auth from "./pages/Auth";
import Signup from "./pages/Signup";
import { TenantBootstrapGate } from '@/components/layout/TenantBootstrapGate';
import { MfaGate } from '@/components/layout/MfaGate';
import { MarketingLayout } from '@/marketing/layouts/MarketingLayout';
import { HomePage } from '@/marketing/pages/HomePage';
import { PricingPage } from '@/marketing/pages/PricingPage';
import { TrialPage } from '@/marketing/pages/TrialPage';
import { BuyLicensePage } from '@/marketing/pages/BuyLicensePage';
import { AutoUpdateNotifier } from "@/components/AutoUpdateNotifier";
import { SessionResumeHandler } from "@/components/SessionResumeHandler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isStaleChunkError, reloadOnceForStaleChunk } from "@/lib/lazyWithRetry";
import { Loader2 } from "lucide-react";

const isElectronTarget = import.meta.env.VITE_APP_TARGET === "electron";
const AppRouter = isElectronTarget ? HashRouter : BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      retry: 1, // Only retry once on failure
    },
  },
});

// Protected Route component
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/trial" element={<TrialPage />} />
        <Route path="/buy" element={<BuyLicensePage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/boss/*"
        element={
          <ProtectedRoute>
            <MfaGate>
              <AppCompanyProvider>
                <TenantBootstrapGate>
                  <BossLayout />
                </TenantBootstrapGate>
              </AppCompanyProvider>
            </MfaGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MfaGate>
              <AppCompanyProvider>
                <TenantBootstrapGate>
                  <AppLayout />
                </TenantBootstrapGate>
              </AppCompanyProvider>
            </MfaGate>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isStaleChunkError(event.reason)) {
        console.warn("Stale chunk detected, reloading...");
        event.preventDefault();
        reloadOnceForStaleChunk();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionResumeHandler />
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
        storageKey="grosafe-theme"
      >
        <TooltipProvider>
          <AutoUpdateNotifier />
          <Toaster />
          <Sonner />
          <AuthProvider>
            <ErrorBoundary title="Erreur de l'application">
              <AppRouter>
                <AppRoutes />
              </AppRouter>
            </ErrorBoundary>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
