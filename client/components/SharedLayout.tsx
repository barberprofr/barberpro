import type { PropsWithChildren } from "react";
import { Home, Users, Settings, Scissors, LogOut, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/lib/api";
import AuthGate from "./auth/AuthGate";
import { setAdminToken } from "@/lib/admin";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AnimatePresence, motion } from "framer-motion";

export default function SharedLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const current = location.pathname;
  const { data: config } = useConfig();
  const qc = useQueryClient();
  const locked = !config?.isAdmin;
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-sky-800 to-amber-700">
      {!locked && (
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
          <div className="container flex items-center justify-between py-3">
            <Link to="/app" className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center shadow">
                <Scissors className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight">
                  Barber<span aria-hidden="true" className="mx-1 inline-block h-0.5 w-0.5 rounded-full bg-red-500 align-baseline" />Pro
                </h1>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-background hover:bg-accent"
                onClick={() => {
                  if (window.confirm("Se déconnecter ?")) {
                    setAdminToken(null);
                    qc.invalidateQueries({ queryKey: ["config"] });
                  }
                }}
              >
                <LogOut className="h-4 w-4" /> Se déconnecter
              </button>
            </div>
          </div>
        </header>
      )}
      <main className="container pt-4 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.985 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {locked ? <AuthGate /> : children}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav
        className="fixed bottom-0 inset-x-0 z-50 h-[90px] border-t border-amber-200 bg-gradient-to-r from-sky-100 to-amber-100 text-slate-900 shadow-[0_-8px_32px_rgba(15,23,42,0.45)]"
      >
        <div className="mx-auto flex h-full w-full max-w-md items-stretch pb-[env(safe-area-inset-bottom,0px)]">
          <Link
            to="/app"
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-colors duration-200",
              current.startsWith("/app") ? "text-primary" : "text-slate-900 hover:text-primary"
            )}
          >
            <Home className="h-5 w-5" />
            Accueil
          </Link>
          <Link
            to="/clients"
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-colors duration-200",
              current.startsWith("/clients") ? "text-primary" : "text-slate-900 hover:text-primary"
            )}
          >
            <Users className="h-5 w-5" />
            Clients
          </Link>
          <Link
            to="/settings"
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-colors duration-200",
              current.startsWith("/settings") ? "text-primary" : "text-slate-900 hover:text-primary"
            )}
          >
            <Settings className="h-5 w-5" />
            Paramètres
          </Link>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Aide Barber.Pro"
                className="flex flex-col items-center justify-center gap-2 px-3 text-sm font-semibold text-slate-900 transition-colors hover:text-primary"
              >
                <HelpCircle className="h-5 w-5" />
                Aide
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="center"
              sideOffset={10}
              className="w-[220px] rounded-2xl border border-slate-200 bg-slate-900/95 px-4 py-3 text-[11px] leading-snug text-white shadow-lg"
            >
              <p className="font-semibold">
                Assistance Barber<span aria-hidden="true" className="mx-1 inline-block h-0.5 w-0.5 rounded-full bg-red-500 align-baseline" />Pro
              </p>
              <p className="mt-1 text-white/80">
                Email : <span className="font-medium text-white">barberpro.fr@hotmail.com</span>
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </nav>
    </div>
  );
}
