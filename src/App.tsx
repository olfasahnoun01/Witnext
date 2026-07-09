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
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/boss/*"
        element={
          <ProtectedRoute>
            <AppCompanyProvider>
              <TenantBootstrapGate>
                <BossLayout />
              </TenantBootstrapGate>
            </AppCompanyProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppCompanyProvider>
              <TenantBootstrapGate>
                <AppLayout />
              </TenantBootstrapGate>
            </AppCompanyProvider>
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
