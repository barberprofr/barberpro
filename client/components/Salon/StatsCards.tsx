import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, Euro, Scissors, Package, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDashboardSummary, useStylists, useStylistBreakdown, useConfig, apiPath, useProducts } from "@/lib/api";
import { StylistDailySection, StylistMonthly } from "@/components/Salon/StylistDailyStats";

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
    { key: "check", label: "Chèque" },
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
      <Popover>
        <PopoverTrigger asChild>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="relative w-full overflow-hidden rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-slate-950 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] p-4 transition-all duration-300 hover:shadow-[0_16px_50px_rgba(16,185,129,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-4">
              <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 shadow-[0_6px_24px_rgba(16,185,129,0.5),inset_0_2px_4px_rgba(255,255,255,0.3)]">
                <div className="absolute inset-1 rounded-xl bg-gradient-to-br from-emerald-300 via-green-400 to-teal-500 shadow-[inset_0_-4px_10px_rgba(0,0,0,0.3)]" />
                <Users className="relative h-7 w-7 text-white drop-shadow-lg" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-lg font-black text-white uppercase tracking-wide">Coiffeurs</span>
                <span className="text-sm font-semibold text-emerald-300/80">
                  {hasStylists ? `${stylistCount} coiffeur${stylistCount > 1 ? "s" : ""}` : "Aucun coiffeur"}
                </span>
              </div>
            </div>
          </motion.button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="center" className="w-[min(90vw,36rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/20 bg-white/5 p-4 shadow-[0_40px_95px_rgba(8,15,40,0.3)] backdrop-blur-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <StylistsList stylists={stylistsList} config={config} hasStylists={hasStylists} />
        </PopoverContent>
      </Popover>

      {/* Boutons style glassmorphisme avec icônes 3D */}
      <div className="flex justify-center items-center gap-4 mt-6 px-4">
        <motion.button
          type="button"
          onClick={() => setTotalCAPopupOpen(true)}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex flex-col items-center justify-center w-[100px] h-[100px] rounded-2xl border border-white/20 bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-slate-950/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_40px_rgba(236,72,153,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 shadow-[0_4px_20px_rgba(236,72,153,0.5),inset_0_2px_4px_rgba(255,255,255,0.3)]">
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-pink-400 via-fuchsia-400 to-purple-500 shadow-[inset_0_-3px_8px_rgba(0,0,0,0.3)]" />
            <Euro className="relative h-6 w-6 text-white drop-shadow-lg" />
          </div>
          <span className="mt-2 text-[10px] font-semibold text-white/80 uppercase tracking-wider">Total CA</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setPrestationsPopupOpen(true)}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex flex-col items-center justify-center w-[100px] h-[100px] rounded-2xl border border-white/20 bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-slate-950/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_40px_rgba(6,182,212,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-600 shadow-[0_4px_20px_rgba(6,182,212,0.5),inset_0_2px_4px_rgba(255,255,255,0.3)]">
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-cyan-300 via-teal-400 to-emerald-500 shadow-[inset_0_-3px_8px_rgba(0,0,0,0.3)]" />
            <Scissors className="relative h-6 w-6 text-white drop-shadow-lg" />
          </div>
          <span className="mt-2 text-[10px] font-semibold text-white/80 uppercase tracking-wider">Prestations</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setProduitsPopupOpen(true)}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex flex-col items-center justify-center w-[100px] h-[100px] rounded-2xl border border-white/20 bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-slate-950/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_40px_rgba(168,85,247,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 via-purple-500 to-indigo-600 shadow-[0_4px_20px_rgba(168,85,247,0.5),inset_0_2px_4px_rgba(255,255,255,0.3)]">
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-violet-300 via-purple-400 to-indigo-500 shadow-[inset_0_-3px_8px_rgba(0,0,0,0.3)]" />
            <Package className="relative h-6 w-6 text-white drop-shadow-lg" />
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
  const selectedStylist = stylists.find(s => s.id === selectedId);

  if (selectedId && selectedStylist) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-4"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center border-b border-white/10 pb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 mb-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </span>
            <h3 className="text-3xl font-black text-white text-center">{selectedStylist.name}</h3>
          </div>
          <StylistDailySection id={selectedStylist.id} commissionPct={((selectedStylist as any).commissionPct ?? config?.commissionDefault ?? 0)} />
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
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-3"
    >
      {stylists.map((s) => (
        <StylistCard key={s.id} s={s} config={config} onClick={() => setSelectedId(s.id)} />
      ))}
    </motion.div>
  );
}

function StylistCard({ s, config, onClick }: { s: any, config: any, onClick: () => void }) {
  const salary = eur.format((((s.stats as any)?.dailyPrestationAmount ?? (s.stats?.dailyAmount ?? 0)) * ((s as any).commissionPct ?? config?.commissionDefault ?? 0) / 100));
  const dailyPointsUsed = s.stats?.dailyPointsUsed ?? 0;

  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full rounded-2xl border border-white/25 bg-white/8 p-2 shadow-[0_18px_45px_rgba(15,23,42,0.15)] backdrop-blur-sm transition hover:border-white/40 hover:bg-white/12 text-left"
    >
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-4 py-0.5 text-lg font-black text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {s.name}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-emerald-100">
              {s.stats?.dailyCount ?? 0} prestation{(s.stats?.dailyCount ?? 0) > 1 ? "s" : ""}{(s.stats as any)?.dailyProductCount ? `, ${(s.stats as any).dailyProductCount} produit${(s.stats as any).dailyProductCount > 1 ? "s" : ""}` : ""}
            </span>
            <span className="text-sm font-semibold text-emerald-100">
              Salaire {salary}
            </span>
          </div>
          <div className="flex flex-col items-end justify-center">
            <div className="text-2xl font-extrabold text-fuchsia-400 transition-all duration-300">
              {eur.format(s.stats?.dailyAmount ?? 0)}
            </div>
            {dailyPointsUsed > 0 && (
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Points utilisés {pointsFmt.format(dailyPointsUsed)} pts
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}


