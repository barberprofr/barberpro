import type { PropsWithChildren } from "react";
import { useEffect, useState, useRef } from "react";
import { Home, Users, Settings, LogOut, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig, createCheckoutSession, useStylistsByPriority } from "@/lib/api";
import AuthGate from "./auth/AuthGate";
import { setAdminToken } from "@/lib/admin";
import { clearSalonCache } from "@/lib/salon";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AnimatePresence, motion } from "framer-motion";
import barberBg from "@/assets/barber-bg.avif";
import { useViewportSize } from "@/hooks/use-mobile";

export default function SharedLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = location.pathname;
  const { data: config, refetch } = useConfig();
  const { data: priorityData } = useStylistsByPriority();
  const viewport = useViewportSize();
  const qc = useQueryClient();
  // Lock access if not admin OR if admin but subscription not active or trialing
  const locked = !config?.isAdmin || (config?.isAdmin && config?.subscriptionStatus !== "active" && config?.subscriptionStatus !== "trialing" && config?.subscriptionStatus !== "paid");
  const hasActiveSubscription = config?.isAdmin && (config?.subscriptionStatus === "active" || config?.subscriptionStatus === "trialing" || config?.subscriptionStatus === "paid");
  const [showSubPrompt, setShowSubPrompt] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle checkout success/cancel from Stripe
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutStatus = params.get("checkout");

    if (checkoutStatus === "success") {
      // Remove the checkout parameter from URL immediately
      params.delete("checkout");
      const newSearch = params.toString();
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ""}`, { replace: true });

      // Refresh config to get updated subscription status
      // The webhook might take a few seconds, so we invalidate and refetch
      qc.invalidateQueries({ queryKey: ["config"] });
      refetch();

      // Retry a few times in case the webhook hasn't processed yet
      let attempts = 0;
      const maxAttempts = 5;
      const retryDelay = 2000; // 2 seconds

      const checkSubscription = async () => {
        attempts++;
        const result = await refetch();
        const updatedConfig = result.data;

        // If subscription is now active, stop retrying
        if (updatedConfig?.subscriptionStatus === "active") {
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
          }
          return;
        }

        // If subscription is still not active and we haven't reached max attempts, retry
        if (attempts < maxAttempts) {
          retryTimeoutRef.current = setTimeout(checkSubscription, retryDelay);
        }
      };

      // Start checking after a short delay to give the webhook time
      retryTimeoutRef.current = setTimeout(checkSubscription, 1000);
    } else if (checkoutStatus === "cancel") {
      // Just remove the cancel parameter
      params.delete("checkout");
      const newSearch = params.toString();
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ""}`, { replace: true });
    }

    // Cleanup timeout on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [location.search, location.pathname, navigate, refetch, qc]);

  useEffect(() => {
    // Show subscription prompt when user is admin but subscription not active/trialing/paid
    // Always ensure showSubPrompt is false when subscription is valid
    const hasValidSubscription = config?.subscriptionStatus === "active" || config?.subscriptionStatus === "trialing" || config?.subscriptionStatus === "paid";
    if (hasValidSubscription) {
      setShowSubPrompt(false);
    } else if (config?.isAdmin) {
      setShowSubPrompt(true);
    } else {
      // Not admin - no subscription prompt needed (show login instead)
      setShowSubPrompt(false);
    }
  }, [config]);
  return (
    <div 
      className="relative min-h-screen bg-gradient-to-br from-blue-950 via-sky-800 to-amber-700"
      data-viewport={`${viewport.width}x${viewport.height}`}
    >
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 pointer-events-none"
        style={{ backgroundImage: `url(${barberBg})` }}
      />
      {hasActiveSubscription && (
        <header className="sticky top-0 z-10 bg-black/5 border-b border-white/5">
          <div className="container flex items-center justify-between py-3">
            <Link to="/app" className="flex items-center gap-1.5">
              <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 grid place-items-center">
                <svg viewBox="0 0 60 60" className="h-8 w-8" aria-hidden>
                  <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" style={{ fontSize: '48px', fontWeight: 800, fontFamily: 'system-ui, sans-serif' }}>B</text>
                  <rect x="18" y="14" width="6" height="6" rx="1" fill="white" />
                </svg>
              </div>
              <h1 className="text-lg font-bold tracking-tight" style={{ color: '#ffffff' }}>
                BarBerpro<svg viewBox="0 0 16 16" className="inline-block h-3.5 w-3.5 ml-0.5 -mt-0.5" aria-hidden><path d="M13.5 2L6 12l-3.5-3.5" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </h1>
            </Link>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-background hover:bg-accent"
                onClick={() => {
                  if (window.confirm("Se déconnecter ?")) {
                    setAdminToken(null);
                    clearSalonCache();
                    qc.clear();
                    window.location.href = "/";
                  }
                }}
              >
                <LogOut className="h-4 w-4" /> Se déconnecter
              </button>
            </div>
          </div>
          {priorityData?.enabled && priorityData.stylists.length > 0 && (
            <div className="bg-black/20 border-b border-white/10 px-4 py-2">
              <div className="container">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-white/60">Priorité :</span>
                  {priorityData.stylists.map((s, index) => (
                    <span
                      key={s.id}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-semibold",
                        index === 0
                          ? "bg-emerald-500/20 border border-emerald-400/50 text-emerald-300"
                          : "bg-slate-700/50 border border-slate-600/50 text-white/70"
                      )}
                    >
                      {index + 1}. {s.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Trial Banner */}
          {config?.subscriptionStatus === "trialing" && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs font-medium text-amber-600 backdrop-blur-sm">
              <div className="flex items-center justify-center gap-3">
                <span>
                  Période d'essai active. Expire le {new Date(config.subscriptionCurrentPeriodEnd || 0).toLocaleDateString("fr-FR")} à {new Date(config.subscriptionCurrentPeriodEnd || 0).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}.
                </span>
                <button
                  onClick={async () => {
                    try {
                      const data = await createCheckoutSession();
                      if (data?.url) {
                        window.location.assign(data.url);
                      } else {
                        alert("Impossible de créer la session de paiement");
                      }
                    } catch (err: any) {
                      console.error(err);
                      alert(err?.message || "Erreur lors de la création du paiement");
                    }
                  }}
                  className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-amber-600 transition-colors"
                >
                  ACTIVER MAINTENANT
                </button>
              </div>
            </div>
          )}
        </header>
      )}
      <main className="relative z-10 container pt-4 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
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
      {/* Subscription prompt modal - blocks access until payment is completed */}
      {showSubPrompt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 text-slate-900 shadow-2xl">
            <h3 className="text-xl font-semibold mb-2">Abonnement requis</h3>
            <p className="mt-2 text-sm text-slate-700">
              Pour accéder à l'application, vous devez activer votre abonnement à 29€ / mois.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Le paiement est sécurisé via Stripe. Vous serez redirigé vers la page de paiement.
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                className="px-6 py-2.5 rounded-md bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
                onClick={async () => {
                  try {
                    const data = await createCheckoutSession();
                    if (data?.url) {
                      window.location.assign(data.url);
                    } else {
                      alert("Impossible de créer la session de paiement");
                    }
                  } catch (err: any) {
                    console.error(err);
                    alert(err?.message || "Erreur lors de la création du paiement");
                  }
                }}
              >
                S'abonner — 29€/mois
              </button>
            </div>
          </div>
        </div>
      )}
      {hasActiveSubscription && (
        <nav
          className="fixed bottom-0 inset-x-0 z-50 h-[90px] bg-transparent text-white"
        >
          <div className="mx-auto flex h-full w-full max-w-md items-stretch pb-[env(safe-area-inset-bottom,0px)]">
            <Link
              to="/app"
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-colors duration-200",
                current.startsWith("/app") ? "text-primary" : "text-white/80 hover:text-primary"
              )}
            >
              <Home className="h-5 w-5" />
              Accueil
            </Link>
            <Link
              to="/clients"
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-colors duration-200",
                current.startsWith("/clients") ? "text-primary" : "text-white/80 hover:text-primary"
              )}
            >
              <Users className="h-5 w-5" />
              Clients
            </Link>
            <Link
              to="/settings"
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-colors duration-200",
                current.startsWith("/settings") ? "text-primary" : "text-white/80 hover:text-primary"
              )}
            >
              <Settings className="h-5 w-5" />
              Paramètres
            </Link>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Aide BarBerpro"
                  className="flex flex-col items-center justify-center gap-2 px-3 text-sm font-semibold text-white/80 transition-colors hover:text-primary"
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
                  Assistance BarBerpro<svg viewBox="0 0 16 16" className="inline-block h-3 w-3 ml-0.5" aria-hidden><path d="M13.5 2L6 12l-3.5-3.5" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </p>
                <p className="mt-1 text-white/80">
                  Email : <span className="font-medium text-white">barberpro.fr@hotmail.com</span>
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </nav>
      )}
    </div>
  );
}
