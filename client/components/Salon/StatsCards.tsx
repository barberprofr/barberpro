import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <SummaryHighlightCard
          label="Prestations (J)"
          value={`${summary?.dailyCount ?? 0}`}
          subtext="Prestations enregistrées aujourd'hui"
          gradient="from-indigo-500/35 via-purple-500/15 to-slate-950/80"
          accentClass="bg-indigo-200"
          metaLabel="Salon"
        />
        <SummaryHighlightCard
          label="Produits (J)"
          value={`${dailyProductCount}`}
          subtext="Produits enregistrés aujourd'hui"
          gradient="from-indigo-500/35 via-purple-500/15 to-slate-950/80"
          accentClass="bg-indigo-200"
          metaLabel="Salon"
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full rounded-2xl border border-sky-400/50 bg-[linear-gradient(135deg,rgba(15,76,173,0.35)0%,rgba(29,97,187,0.28)50%,rgba(56,189,248,0.2)100%)] px-4 py-3 text-sm font-semibold text-sky-100 transition-all hover:bg-[linear-gradient(135deg,rgba(15,76,173,0.42)0%,rgba(29,97,187,0.35)50%,rgba(56,189,248,0.27)100%)] shadow-[0_10px_24px_rgba(29,97,187,0.2)]"
          >
            <div className="flex w-full items-center justify-between">
              <span>Coiffeurs</span>
              <span className="text-xs text-sky-300/70">
                {hasStylists ? `${stylistCount} coiffeur${stylistCount > 1 ? "s" : ""}` : "Aucun coiffeur"}
              </span>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="center" className="w-[min(90vw,36rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/15 bg-[linear-gradient(135deg,rgba(4,11,46,0.92)0%,rgba(11,27,77,0.78)55%,rgba(16,45,115,0.58)100%)] p-4 shadow-[0_40px_95px_rgba(8,15,40,0.7)] backdrop-blur-xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <StylistsList stylists={stylistsList} config={config} hasStylists={hasStylists} />
        </PopoverContent>
      </Popover>
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
        <button
          onClick={() => setSelectedId(null)}
          className="group flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
        >
          <div className="rounded-full bg-white/10 p-1 group-hover:bg-white/20 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </div>
          <span className="font-medium">Retour à la liste</span>
        </button>

        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">{selectedStylist.name}</h3>
              <p className="text-xs text-white/50">Statistiques détaillées</p>
            </div>
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
      className="w-full rounded-3xl border border-white/12 bg-[linear-gradient(140deg,rgba(8,15,40,0.88)0%,rgba(27,51,122,0.7)55%,rgba(46,91,181,0.55)100%)] p-3 shadow-[0_18px_45px_rgba(15,23,42,0.35)] backdrop-blur-xl transition hover:border-white/30 hover:bg-[linear-gradient(140deg,rgba(8,15,40,0.92)0%,rgba(27,51,122,0.78)55%,rgba(46,91,181,0.62)100%)] text-left"
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-4 py-1 text-sm font-semibold text-white w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {s.name}
          </span>
          <span className="text-[11px] font-semibold text-emerald-100">
            {s.stats?.dailyCount ?? 0} prestation{(s.stats?.dailyCount ?? 0) > 1 ? "s" : ""}{(s.stats as any)?.dailyProductCount ? `, ${(s.stats as any).dailyProductCount} produit${(s.stats as any).dailyProductCount > 1 ? "s" : ""}` : ""}
          </span>
          <span className="text-[11px] font-semibold text-emerald-100">
            Salaire {salary}
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-primary transition-all duration-300">
            {eur.format(s.stats?.dailyAmount ?? 0)}
          </div>
          {dailyPointsUsed > 0 && (
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Points utilisés {pointsFmt.format(dailyPointsUsed)} pts
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}


