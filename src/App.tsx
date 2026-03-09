import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Auth } from "./pages/Auth";
import { AuthProvider, useAuth } from "./hooks/useAuth";

import { MemoRegister } from "./pages/MemoRegister";
import { VerifyReplies } from "./pages/VerifyReplies";
import { Reminders } from "./pages/Reminders";
import { ReportsNew } from "./pages/ReportsNew";
import { Settings } from "./pages/Settings";
import { AccountDetails } from "./pages/AccountDetails";
import { Operations } from "./pages/Operations";
import { HFTIRegister } from "./pages/HFTIRegister";
import { CustomRegisters } from "./pages/CustomRegisters";
import { CustomRegisterView } from "./pages/CustomRegisterView";
import { ResetPassword } from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { initSettings } from "./lib/supabaseDb";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

// Auth route (redirects to home if already logged in)
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (user) {
      initSettings();
    }
  }, [user]);

  return (
    <Routes>
      <Route path="/auth" element={
        <AuthRoute>
          <Auth />
        </AuthRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/operations" element={
        <ProtectedRoute>
          <Layout>
            <Operations />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/hfti-register" element={
        <ProtectedRoute>
          <Layout>
            <HFTIRegister />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/register" element={
        <ProtectedRoute>
          <Layout>
            <MemoRegister />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/verify" element={
        <ProtectedRoute>
          <Layout>
            <VerifyReplies />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/reminders" element={
        <ProtectedRoute>
          <Layout>
            <Reminders />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute>
          <Layout>
            <ReportsNew />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/accounts" element={
        <ProtectedRoute>
          <Layout>
            <AccountDetails />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/custom-registers" element={
        <ProtectedRoute>
          <Layout>
            <CustomRegisters />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/custom-register/:id" element={
        <ProtectedRoute>
          <Layout>
            <CustomRegisterView />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
