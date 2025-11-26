import type { PropsWithChildren } from "react";
import { useEffect, useState, useRef } from "react";
import { Home, Users, Settings, Scissors, LogOut, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig, createCheckoutSession } from "@/lib/api";
import AuthGate from "./auth/AuthGate";
import { setAdminToken } from "@/lib/admin";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AnimatePresence, motion } from "framer-motion";

export default function SharedLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = location.pathname;
  const { data: config, refetch } = useConfig();
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
    // Show subscription prompt when user is admin but subscription not active AND not trialing
    // The popup must stay visible until payment is completed
    // Show subscription prompt when user is admin but subscription not active AND not trialing
    // The popup must stay visible until payment is completed
    if (config?.isAdmin && config?.subscriptionStatus !== "active" && config?.subscriptionStatus !== "trialing" && config?.subscriptionStatus !== "paid") {
      setShowSubPrompt(true);
    } else if (hasActiveSubscription) {
      setShowSubPrompt(false);
    }
  }, [config, hasActiveSubscription]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-sky-800 to-amber-700">
      {hasActiveSubscription && (
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
      {/* Subscription prompt modal - blocks access until payment is completed */}
      {showSubPrompt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 text-slate-900 shadow-2xl">
            <h3 className="text-xl font-semibold mb-2">Abonnement requis</h3>
            <p className="mt-2 text-sm text-slate-700">
              Pour accéder à l'application, vous devez activer votre abonnement à 25€ / mois.
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
                S'abonner — 25€/mois
              </button>
            </div>
          </div>
        </div>
      )}
      {hasActiveSubscription && (
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
      )}
    </div>
  );
}
