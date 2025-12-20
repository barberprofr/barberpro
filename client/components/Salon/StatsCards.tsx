import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, Euro, Scissors, Package, Users, UserRound, Delete } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDashboardSummary, useStylists, useStylistBreakdown, useConfig, apiPath, useProducts, useStylistHasSecretCode, useVerifyStylistSecretCode } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { StylistMonthly } from "@/components/Salon/StylistDailyStats";

// Composant Clavier Numérique
function NumericKeypad({ 
  value, 
  onChange, 
  onClose,
  onValidate,
  stylistName,
  error,
  isLoading
}: { 
  value: string; 
  onChange: (val: string) => void; 
  onClose: () => void;
  onValidate: () => void;
  stylistName?: string;
  error?: string;
  isLoading?: boolean;
}) {
  const handleDigit = (digit: string) => {
    onChange(value + digit);
  };

  const handleDelete = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange("");
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[300px] max-h-[90vh] overflow-auto"
      >
        {/* Écran d'affichage - bordure dorée arrondie */}
        <div 
          className="mb-3 flex h-12 items-center justify-center rounded-full px-6"
          style={{
            background: 'linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)',
            border: '2px solid #d4a537',
            boxShadow: '0 0 20px rgba(212,165,55,0.4), inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(255,255,255,0.1)'
          }}
        >
          <span className="text-2xl font-bold tracking-[0.5em] text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]">
            {value ? "•".repeat(value.length) : ""}
          </span>
        </div>

        {/* Message d'erreur */}
        {error && (
          <p className="mb-2 text-center text-xs font-semibold text-red-400 bg-red-500/20 backdrop-blur-sm rounded py-1">{error}</p>
        )}

        {/* Cadre métallique semi-transparent */}
        <div 
          className="rounded-xl p-3 backdrop-blur-md"
          style={{
            background: 'linear-gradient(180deg, rgba(107,114,128,0.7) 0%, rgba(55,65,81,0.8) 50%, rgba(17,24,39,0.9) 100%)',
            border: '2px solid #d4a537',
            boxShadow: '0 0 25px rgba(212,165,55,0.3), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4)'
          }}
        >
          {/* Grille des chiffres 1-9 */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                onClick={() => handleDigit(digit)}
                className="relative flex h-14 w-14 mx-auto items-center justify-center rounded-full text-xl font-bold text-white transition-all active:scale-95 overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #67e8f9 0%, #22d3ee 20%, #06b6d4 50%, #0891b2 80%, #0e7490 100%)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3), inset 0 -4px 8px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(103,232,249,0.6)'
                }}
              >
                {/* Reflet brillant */}
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-4 rounded-full"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 40%, transparent 70%)'
                  }}
                />
                <span className="relative z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]">{digit}</span>
              </button>
            ))}
          </div>
          {/* Dernière ligne: 0 - C - Delete */}
          <div className="grid grid-cols-3 gap-2">
            {/* Bouton 0 - bleu rond avec reflet */}
            <button
              onClick={() => handleDigit("0")}
              className="relative flex h-14 w-14 mx-auto items-center justify-center rounded-full text-xl font-bold text-white transition-all active:scale-95 overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #67e8f9 0%, #22d3ee 20%, #06b6d4 50%, #0891b2 80%, #0e7490 100%)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3), inset 0 -4px 8px rgba(0,0,0,0.4)',
                border: '1px solid rgba(103,232,249,0.6)'
              }}
            >
              {/* Reflet brillant */}
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-4 rounded-full"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 40%, transparent 70%)'
                }}
              />
              <span className="relative z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]">0</span>
            </button>
            {/* Bouton C - rouge carré */}
            <button
              onClick={handleClear}
              className="relative flex h-14 w-14 mx-auto items-center justify-center rounded-md text-lg font-bold text-white transition-all active:scale-95 overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #991b1b 0%, #7f1d1d 50%, #450a0a 100%)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.2), inset 0 -3px 6px rgba(0,0,0,0.4)',
                border: '1px solid rgba(153,27,27,0.8)'
              }}
            >
              <span className="relative z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]">C</span>
            </button>
            {/* Bouton Delete - gris carré */}
            <button
              onClick={handleDelete}
              className="relative flex h-14 w-14 mx-auto items-center justify-center rounded-md text-white transition-all active:scale-95 overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #4b5563 0%, #374151 50%, #1f2937 100%)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.4)',
                border: '1px solid rgba(75,85,99,0.8)'
              }}
            >
              <Delete className="h-5 w-5 relative z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]" />
            </button>
          </div>
        </div>

        {/* Bouton Valider - vert émeraude brillant */}
        <button
          onClick={onValidate}
          disabled={!value.trim() || isLoading}
          className="mt-3 mb-2 flex h-14 w-full items-center justify-center rounded-xl text-xl font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-110"
          style={{
            background: 'linear-gradient(180deg, #10b981 0%, #059669 50%, #047857 100%)',
            boxShadow: '0 4px 15px rgba(16,185,129,0.5), 0 0 20px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
            border: '2px solid rgba(52,211,153,0.6)'
          }}
        >
          <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            {isLoading ? "Vérification..." : "Valider"}
          </span>
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
}

type SummaryHighlightCardProps = {
  label: string;
  value: string;
  subtext?: string;
  gradient: string;
  accentClass: string;
  metaLabel?: string;
};

function SummaryHighlightCard({ label, value, subtext, gradient, accentClass, metaLabel }: SummaryHighlightCardProps) {
  return (
    <motion.div
      layout
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 280, damping: 26 }}
      className={`relative overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br ${gradient} p-2.5 text-white shadow-[0_8px_22px_rgba(8,15,35,0.4)] backdrop-blur-md`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-8 -right-9 h-16 w-16 rounded-full bg-white/12 blur-3xl" />
        <div className="absolute bottom-[-55%] left-[-12%] h-24 w-24 rounded-full bg-black/30 blur-3xl" />
        <div className="absolute inset-x-4 top-8 h-px bg-white/10" />
      </div>
      <div className="relative flex h-full flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
            <span className={`h-[3px] w-[3px] rounded-full ${accentClass}`} />
            {label}
          </span>
          {metaLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/16 bg-white/10 px-1.5 py-0.5 text-[8.5px] font-medium text-white/60">
              <span className="h-[3px] w-[3px] rounded-full bg-white/40" />
              {metaLabel}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-black tracking-tight sm:text-[24px]">{value}</span>
          {subtext ? <p className="text-[10px] leading-snug text-white/65">{subtext}</p> : null}
        </div>
      </div>
    </motion.div>
  );
}

type PaymentMethodCardProps = {
  label: string;
  amount: string;
  count: number;
  gradient: string;
  accentClass: string;
};

function PaymentMethodCard({ label, amount, count, gradient, accentClass }: PaymentMethodCardProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br ${gradient} p-1.5 text-white shadow-[0_5px_16px_rgba(8,15,35,0.22)] backdrop-blur-lg`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-4 -right-5 h-10 w-10 rounded-full bg-white/12 blur-3xl" />
        <div className="absolute bottom-[-40%] left-[-18%] h-18 w-18 rounded-full bg-black/25 blur-3xl" />
        <div className="absolute inset-x-4 top-9 h-px bg-white/12" />
      </div>
      <div className="relative flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/12 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/75">
          <span className={`h-1.5 w-1.5 rounded-full ${accentClass}`} />
          {label}
        </span>
        <div className="space-y-0.5">
          <div className="text-[14px] font-semibold leading-tight drop-shadow-sm">{amount}</div>
          <div className="text-[8px] font-medium uppercase tracking-wide text-white/65">{count} prest.</div>
        </div>
      </div>
    </div>
  );
}

type RevenuePopoverCardProps = SummaryHighlightCardProps & {
  paymentTotalAmount: number;
  paymentMethodOrder: ReadonlyArray<{ key: keyof typeof paymentCardStyles; label: string }>;
  methodsStats?: Record<string, { amount?: number; count?: number }>;
};

function RevenuePopoverCard({
  label,
  value,
  subtext,
  gradient,
  accentClass,
  metaLabel,
  paymentTotalAmount,
  paymentMethodOrder,
  methodsStats,
}: RevenuePopoverCardProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const formattedTotal = eur.format(paymentTotalAmount);

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <motion.div
          layout
          whileHover={{ y: -1 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className={`relative overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br ${gradient} p-2.5 text-white shadow-[0_8px_22px_rgba(8,15,35,0.4)] backdrop-blur-md cursor-pointer`}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-8 -right-9 h-16 w-16 rounded-full bg-white/12 blur-3xl" />
            <div className="absolute bottom-[-55%] left-[-12%] h-24 w-24 rounded-full bg-black/30 blur-3xl" />
            <div className="absolute inset-x-4 top-8 h-px bg-white/10" />
          </div>
          <div className="relative flex flex-col gap-2.5">
            <button
              type="button"
              className="flex w-full flex-col gap-3 rounded-lg bg-transparent px-1 py-1 text-left text-white outline-none transition focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">Total CA aujourd'hui</span>
                <motion.span
                  animate={{ rotate: popoverOpen ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-slate-900/55"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-white/80" />
                </motion.span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black tracking-tight sm:text-[28px]">{value}</span>
              </div>
            </button>
          </div>
        </motion.div>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" className="w-[min(90vw,36rem)] overflow-hidden rounded-2xl border border-white/15 bg-primary/5 p-0 shadow-[0_40px_95px_rgba(8,15,40,0.7)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-primary/15 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 text-[10px]">
            <a
              href={`/api${apiPath("/reports/summary.csv")}`}
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-1.5 py-0.5 text-white/70 transition-colors hover:bg-white/10"
            >
              CSV
            </a>
            <a
              href={`/api${apiPath("/reports/summary.pdf")}`}
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-1.5 py-0.5 text-white/70 transition-colors hover:bg-white/10"
            >
              PDF
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-2 text-[13px]">
          {paymentMethodOrder.map(({ key, label: methodLabel }) => {
            const stats = methodsStats?.[key] ?? { amount: 0, count: 0 };
            const visual = paymentCardStyles[key];
            return (
              <PaymentMethodCard
                key={key}
                label={methodLabel}
                amount={eur.format(stats.amount ?? 0)}
                count={stats.count ?? 0}
                gradient={visual.gradient}
                accentClass={visual.accentClass}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const paymentCardStyles = {
  cash: {
    gradient: "from-emerald-500/35 via-emerald-400/15 to-slate-950/80",
    accentClass: "bg-emerald-200",
  },
  check: {
    gradient: "from-amber-500/35 via-orange-400/15 to-slate-950/78",
    accentClass: "bg-amber-200",
  },
  card: {
    gradient: "from-sky-500/35 via-indigo-500/20 to-slate-950/75",
    accentClass: "bg-sky-200",
  },
} as const;

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const pointsFmt = new Intl.NumberFormat("fr-FR");

export default function StatsCards() {
  const { data: summary } = useDashboardSummary();
  const { data: stylists } = useStylists();
  const { data: config } = useConfig();
  const { data: products } = useProducts();
  const stylistCount = stylists?.length ?? 0;
  const hasStylists = stylistCount > 0;
  const stylistsList = stylists ?? [];

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dailyProducts = (products ?? []).filter((p: any) => {
    const ts = p.timestamp ?? 0;
    return ts >= startOfDay.getTime() && ts < endOfDay.getTime();
  });
  const dailyProductCount = dailyProducts.length;
  const paymentMethodOrder: ReadonlyArray<{ key: keyof typeof paymentCardStyles; label: string }> = [
    { key: "cash", label: "Espèces" },
    { key: "check", label: "Planity/Treatwell" },
    { key: "card", label: "Carte" },
  ];
  const paymentTotalAmount = summary?.dailyPayments?.total?.amount ?? summary?.dailyAmount ?? 0;
  const methodsStats = summary?.dailyPayments?.methods as Record<string, { amount?: number; count?: number }> | undefined;
  const [openId, setOpenId] = useState<string>("");
  const [totalCAPopupOpen, setTotalCAPopupOpen] = useState(false);
  const [prestationsPopupOpen, setPrestationsPopupOpen] = useState(false);
  const [produitsPopupOpen, setProduitsPopupOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Boutons style glassmorphisme avec icônes 3D */}
      <div className="flex justify-center items-center gap-4 mt-6 px-4">
        <Popover>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="relative flex flex-col items-center justify-center w-[100px] h-[100px] rounded-2xl border-2 border-amber-400/60 bg-transparent backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-300 hover:border-amber-300 hover:shadow-[0_0_25px_rgba(245,158,11,0.4)]"
            >
              <div className="relative flex items-center justify-center w-14 h-14 rounded-full overflow-hidden">
                <img src="/assets/barber-logo.jpg" alt="Coiffeurs" className="h-12 w-12 object-cover rounded-full" />
              </div>
              <span className="mt-2 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Coiffeurs</span>
            </motion.button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="center" className="w-[min(95vw,42rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/20 bg-white/5 p-4 shadow-[0_40px_95px_rgba(8,15,40,0.3)] backdrop-blur-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
            <StylistsList stylists={stylistsList} config={config} hasStylists={hasStylists} />
          </PopoverContent>
        </Popover>
        <motion.button
          type="button"
          onClick={() => setTotalCAPopupOpen(true)}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex flex-col items-center justify-center w-[100px] h-[100px] rounded-2xl border border-white/20 bg-gradient-to-br from-slate-800/40 via-slate-900/40 to-slate-950/40 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_40px_rgba(236,72,153,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full border-2 border-pink-400/60 bg-transparent">
            <Euro className="relative h-6 w-6 text-pink-400 drop-shadow-lg" />
          </div>
          <span className="mt-2 text-[10px] font-semibold text-white/80 uppercase tracking-wider">Total CA</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setPrestationsPopupOpen(true)}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex flex-col items-center justify-center w-[100px] h-[100px] rounded-2xl border border-white/20 bg-gradient-to-br from-slate-800/40 via-slate-900/40 to-slate-950/40 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_40px_rgba(6,182,212,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full border-2 border-cyan-400/60 bg-transparent">
            <Scissors className="relative h-6 w-6 text-cyan-400 drop-shadow-lg" />
          </div>
          <span className="mt-2 text-[10px] font-semibold text-white/80 uppercase tracking-wider">Prestations</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setProduitsPopupOpen(true)}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex flex-col items-center justify-center w-[100px] h-[100px] rounded-2xl border border-white/20 bg-gradient-to-br from-slate-800/40 via-slate-900/40 to-slate-950/40 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_40px_rgba(168,85,247,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full border-2 border-violet-400/60 bg-transparent">
            <Package className="relative h-6 w-6 text-violet-400 drop-shadow-lg" />
          </div>
          <span className="mt-2 text-[10px] font-semibold text-white/80 uppercase tracking-wider">Produits</span>
        </motion.button>
      </div>

      {/* Popup Total CA */}
      <AnimatePresence>
        {totalCAPopupOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setTotalCAPopupOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[90%] max-w-sm rounded-3xl bg-gradient-to-br from-slate-900/98 via-cyan-900/60 to-slate-800/98 border border-cyan-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(6,182,212,0.2)] backdrop-blur-xl p-8"
            >
              <button
                type="button"
                onClick={() => setTotalCAPopupOpen(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80 mb-1">TOTAL CA</span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80 mb-6">AUJOURD'HUI</span>
                <div className="text-5xl font-bold text-white tracking-tight">
                  {(summary?.dailyAmount ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popup Prestations */}
      <AnimatePresence>
        {prestationsPopupOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setPrestationsPopupOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[90%] max-w-sm rounded-3xl bg-gradient-to-br from-slate-900/98 via-indigo-900/60 to-slate-800/98 border border-indigo-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(99,102,241,0.2)] backdrop-blur-xl p-8"
            >
              <button
                type="button"
                onClick={() => setPrestationsPopupOpen(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80 mb-1">PRESTATIONS</span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80 mb-6">AUJOURD'HUI</span>
                <div className="text-5xl font-bold text-white tracking-tight">{summary?.dailyCount ?? 0}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popup Produits */}
      <AnimatePresence>
        {produitsPopupOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setProduitsPopupOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[90%] max-w-sm rounded-3xl bg-gradient-to-br from-slate-900/98 via-violet-900/60 to-slate-800/98 border border-violet-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)] backdrop-blur-xl p-8"
            >
              <button
                type="button"
                onClick={() => setProduitsPopupOpen(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/80 mb-1">PRODUITS</span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/80 mb-6">AUJOURD'HUI</span>
                <div className="text-5xl font-bold text-white tracking-tight">{dailyProductCount}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StylistsList({ stylists, config, hasStylists }: { stylists: any[], config: any, hasStylists: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [secretCodeInput, setSecretCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  
  const selectedStylist = stylists.find(s => s.id === selectedId);
  const pendingStylist = stylists.find(s => s.id === pendingId);
  
  const { data: hasSecretCode, isLoading: checkingSecretCode } = useStylistHasSecretCode(pendingId ?? undefined);
  const verifyCode = useVerifyStylistSecretCode();

  const handleCardClick = (stylistId: string) => {
    setPendingId(stylistId);
    setSecretCodeInput("");
    setCodeError("");
  };

  const handleVerifyCode = async () => {
    if (!pendingId || !secretCodeInput.trim()) return;
    
    try {
      const result = await verifyCode.mutateAsync({ stylistId: pendingId, code: secretCodeInput });
      if (result.valid) {
        setSelectedId(pendingId);
        setPendingId(null);
        setShowCodeDialog(false);
        setSecretCodeInput("");
        setCodeError("");
      } else {
        setCodeError("Code incorrect");
      }
    } catch (e: any) {
      setCodeError("Code incorrect");
    }
  };

  useEffect(() => {
    if (pendingId && !checkingSecretCode && hasSecretCode !== undefined) {
      if (hasSecretCode.hasCode) {
        setShowCodeDialog(true);
      } else {
        setSelectedId(pendingId);
        setPendingId(null);
      }
    }
  }, [pendingId, checkingSecretCode, hasSecretCode]);

  if (selectedId && selectedStylist) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-4 max-h-[85vh] overflow-y-auto pb-8"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center border-b border-white/10 pb-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/30 via-amber-600/20 to-yellow-500/30 ring-2 ring-amber-400/50 shadow-[0_8px_32px_rgba(251,191,36,0.4),inset_0_2px_8px_rgba(255,255,255,0.1)] backdrop-blur-sm mb-2 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-amber-900/40 to-transparent" />
              <img 
                src="/assets/coiffeur-avatar.jpg" 
                alt="Coiffeur" 
                className="h-12 w-12 object-cover rounded-full opacity-85 mix-blend-luminosity"
              />
            </div>
            <h3 className="text-3xl font-black text-white text-center">{selectedStylist.name}</h3>
          </div>
          <StylistMonthly id={selectedStylist.id} commissionPct={((selectedStylist as any).commissionPct ?? config?.commissionDefault ?? 0)} stylistName={selectedStylist.name} />
        </div>
      </motion.div>
    );
  }

  if (!hasStylists) {
    return (
      <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        Aucun coiffeur enregistré pour le moment.
      </div>
    );
  }

  return (
    <>
      {/* Clavier numérique popup direct */}
      <AnimatePresence>
        {showCodeDialog && (
          <NumericKeypad
            value={secretCodeInput}
            onChange={(val) => {
              setSecretCodeInput(val);
              setCodeError("");
            }}
            onClose={() => {
              setShowCodeDialog(false);
              setPendingId(null);
              setSecretCodeInput("");
              setCodeError("");
            }}
            onValidate={handleVerifyCode}
            stylistName={pendingStylist?.name}
            error={codeError}
            isLoading={verifyCode.isPending}
          />
        )}
      </AnimatePresence>
      
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
      >
        {stylists.map((s) => (
          <StylistCard key={s.id} s={s} config={config} onClick={() => handleCardClick(s.id)} />
        ))}
      </motion.div>
    </>
  );
}

function StylistCard({ s, config, onClick }: { s: any, config: any, onClick: () => void }) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ 
        scale: 1.08,
        boxShadow: "0 0 25px rgba(251,191,36,0.8), 0 0 50px rgba(251,191,36,0.5), inset 0 0 15px rgba(251,191,36,0.3)",
        borderColor: "rgba(251,191,36,0.9)"
      }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-amber-500/50 bg-black/25 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] aspect-square transition-colors hover:border-amber-400/70 hover:bg-black/35 hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] active:border-amber-400 active:shadow-[0_0_30px_rgba(251,191,36,0.8)]"
    >
      <svg className="h-7 w-7 text-amber-400/80 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
      <div className="text-xl font-bold text-white text-center truncate w-full">{s.name}</div>
    </motion.button>
  );
}


