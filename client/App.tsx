import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import { registerServiceWorker } from "@/lib/pwa";
import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

const queryClient = new QueryClient();

// Enregistrer le Service Worker pour la PWA


const App = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    registerServiceWorker(() => setUpdateAvailable(true));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<Index />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>

        {updateAvailable && (
          <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-950/90 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <RefreshCw className="h-5 w-5 animate-spin-slow" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Mise à jour disponible</h4>
                  <p className="text-xs text-emerald-200/80">Une nouvelle version est prête.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  // Envoyer un message au SW pour qu'il prenne le contrôle (skipWaiting)
                  // Note: Dans pwa.ts on a déjà un listener sur controllerchange qui reload
                  if (navigator.serviceWorker.controller) {
                    // Si on a déjà un controller, on peut juste recharger, 
                    // mais l'idéal est de dire au nouveau SW de prendre la main.
                    // Comme on n'a pas gardé la ref du registration ici, on fait un reload simple
                    // qui devrait suffire avec la stratégie NetworkFirst, 
                    // ou alors on compte sur le fait que le SW a skipWaiting() dans install.
                    window.location.reload();
                  }
                }}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-400 active:scale-95"
              >
                Mettre à jour
              </button>
            </div>
          </div>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
