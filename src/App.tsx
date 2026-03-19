import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Analyse from "./pages/Analyse";
import Komponenten from "./pages/Komponenten";
import Loesung from "./pages/Loesung";
import Prompts from "./pages/Prompts";
import Dokumentation from "./pages/Dokumentation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analyse" element={<Analyse />} />
            <Route path="/komponenten" element={<Komponenten />} />
            <Route path="/loesung" element={<Loesung />} />
            <Route path="/prompts" element={<Prompts />} />
            <Route path="/dokumentation" element={<Dokumentation />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
