import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Upload } from "./pages/Upload";
import { MemoRegister } from "./pages/MemoRegister";
import { VerifyReplies } from "./pages/VerifyReplies";
import { Reminders } from "./pages/Reminders";
import { ReportsNew } from "./pages/ReportsNew";
import { Settings } from "./pages/Settings";
import { AccountDetails } from "./pages/AccountDetails";
import { Operations } from "./pages/Operations";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { initSettings } from "./lib/db";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    initSettings();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/register" element={<MemoRegister />} />
              <Route path="/verify" element={<VerifyReplies />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/reports" element={<ReportsNew />} />
              <Route path="/accounts" element={<AccountDetails />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
