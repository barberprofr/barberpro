import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStylistBreakdown, useUpdateTransactionPaymentMethod } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, List } from "lucide-react";
import { cn } from "@/lib/utils";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function parisDateString(at: Date = new Date()) {
    const parts = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(at);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}

function StylistDaily({ id, date, commissionPct }: { id: string; date?: string; commissionPct: number }) {
    const { data } = useStylistBreakdown(id, date);
    const d = data?.daily;
    const prestationD = (data as any)?.prestationDaily;
    const total = d?.total;
    const prestationTotal = prestationD?.total;
    const dailyProductCount = (data as any)?.dailyProductCount ?? 0;
    const salary = (prestationTotal?.amount || 0) * (commissionPct ?? 0) / 100;
    return (
        <div className="rounded-2xl border border-white/25 bg-slate-800/70 p-3 shadow-inner text-sm space-y-2 backdrop-blur-sm">
            <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-100">
                    <span className="text-base font-black tracking-wide [-webkit-text-stroke:0.5px_black]">CA du jour</span>
                    <span className="text-4xl font-black tracking-wide text-fuchsia-300" style={{ WebkitTextStroke: '0.5px black' }}>{eur.format(total?.amount || 0)}</span>
                </div>
                <div className="text-xs text-white">{prestationTotal?.count || 0} prestation{(prestationTotal?.count ?? 0) > 1 ? "s" : ""}{dailyProductCount ? `, ${dailyProductCount} produit${dailyProductCount > 1 ? "s" : ""}` : ""}</div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                <div className="flex flex-col items-center justify-center rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-2 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/20 mb-1">
                        <svg className="h-2.5 w-2.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
                    </span>
                    <div className="text-[10px] font-semibold uppercase text-white/80">CARTE</div>
                    <div className="text-sm font-bold text-white">{eur.format(d?.methods.card.amount || 0)}</div>
                    <div className="text-[9px] text-white/50">{d?.methods.card.count || 0} prest.</div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-2 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/20 mb-1">
                        <svg className="h-2.5 w-2.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </span>
                    <div className="text-[10px] font-semibold uppercase text-white/80">EN LIGNE</div>
                    <div className="text-sm font-bold text-white">{eur.format(d?.methods.check.amount || 0)}</div>
                    <div className="text-[9px] text-white/50">{d?.methods.check.count || 0} prest.</div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-2 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20 mb-1">
                        <svg className="h-2.5 w-2.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 10v4m-1-3.5h2m-2 3h2" /></svg>
                    </span>
                    <div className="text-[10px] font-semibold uppercase text-white/80">ESPÈCES</div>
                    <div className="text-sm font-bold text-white">{eur.format(d?.methods.cash.amount || 0)}</div>
                    <div className="text-[9px] text-white/50">{d?.methods.cash.count || 0} prest.</div>
                </div>
            </div>
        </div>
    );
}

function StylistEncaissements({ id, date }: { id: string; date?: string }) {
    const { data } = useStylistBreakdown(id, date);
    const updatePaymentMethod = useUpdateTransactionPaymentMethod();
    const entries = data?.dailyEntries || [];
    const fmt = (ts: number) => new Date(ts).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

    const handleUpdatePayment = (entryId: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => {
        updatePaymentMethod.mutate({ id: entryId, kind, paymentMethod: method });
    };

    return (
        <div className="text-sm border border-gray-700 rounded-md overflow-hidden bg-slate-900/70 w-full">
            <div className="overflow-x-auto">
                <div className="min-w-[280px]">
                    <div className="grid grid-cols-[60px_1fr_1fr] bg-slate-800/80 text-gray-100 px-2 py-2 font-medium text-xs sm:text-sm sm:px-3">
                        <div>Heure</div>
                        <div>Mode</div>
                        <div>Montant</div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {entries.length === 0 ? (
                            <div className="px-2 py-2 text-muted-foreground sm:px-3">Aucun encaissement pour ce jour</div>
                        ) : entries.map((e: any, i: number) => (
                            <TransactionRow key={i} entry={e} fmt={fmt} onUpdate={handleUpdatePayment} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function RangeTransactionRow({ entry: e, onUpdate }: { entry: any, onUpdate: (id: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => void }) {
    const [open, setOpen] = useState(false);
    const fmtDate = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" });
    };
    const fmtTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className="grid grid-cols-[70px_1fr_1fr] px-2 py-2 border-t border-gray-700 items-center text-xs sm:text-sm sm:px-3">
            <div className="flex flex-col">
                <span className="font-medium">{fmtDate(e.timestamp)}</span>
                <span className="text-[10px] text-white/50">{fmtTime(e.timestamp)}</span>
            </div>
            <div>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-all hover:scale-105 focus:outline-none",
                            e.paymentMethod === "cash" ? "border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-slate-900/80" :
                                e.paymentMethod === "check" ? "border-amber-500/30 bg-gradient-to-br from-amber-900/40 via-slate-900/60 to-slate-900/80" :
                                    "border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/80"
                        )}>
                            <span className={cn(
                                "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                                e.paymentMethod === "cash" ? "border-emerald-400/40 bg-emerald-500/20" :
                                    e.paymentMethod === "check" ? "border-amber-400/40 bg-amber-500/20" :
                                        "border-indigo-400/40 bg-indigo-500/20"
                            )}>
                                {e.paymentMethod === "card" && <svg className="h-2.5 w-2.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>}
                                {e.paymentMethod === "check" && <svg className="h-2.5 w-2.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                                {e.paymentMethod === "cash" && <svg className="h-2.5 w-2.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 10v4m-1-3.5h2m-2 3h2" /></svg>}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/80">
                                {({ cash: "ESPÈCES", check: "EN LIGNE", card: "CARTE" } as const)[e.paymentMethod as "cash" | "check" | "card"]}
                            </span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1.5 bg-slate-900/95 border-slate-700 backdrop-blur-xl">
                        <div className="grid gap-1">
                            {(["cash", "check", "card"] as const).map((method) => (
                                <button
                                    key={method}
                                    onClick={() => {
                                        onUpdate(e.id, e.kind || "prestation", method);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg transition-all",
                                        e.paymentMethod === method ? "bg-slate-800 border border-white/20" : "hover:bg-slate-800/50"
                                    )}
                                >
                                    <span className={cn(
                                        "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                                        method === "cash" ? "border-emerald-400/40 bg-emerald-500/20" :
                                            method === "check" ? "border-amber-400/40 bg-amber-500/20" :
                                                "border-indigo-400/40 bg-indigo-500/20"
                                    )}>
                                        {method === "card" && <svg className="h-2.5 w-2.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>}
                                        {method === "check" && <svg className="h-2.5 w-2.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                                        {method === "cash" && <svg className="h-2.5 w-2.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 10v4m-1-3.5h2m-2 3h2" /></svg>}
                                    </span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                                        {({ cash: "ESPÈCES", check: "EN LIGNE", card: "CARTE" } as const)[method]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="min-w-0">
                <span className="font-medium">{eur.format(e.amount)}</span>
                <span className="text-[10px] sm:text-xs text-white/60 block truncate">{e.name || (e.kind === "prestation" ? "prestation" : "produit")}</span>
            </div>
        </div>
    );
}

function StylistRangeEncaissements({ entries, onUpdate }: { entries: any[]; onUpdate: (id: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => void }) {
    return (
        <div className="text-sm border border-gray-700 rounded-md overflow-hidden bg-slate-900/70 w-full">
            <div className="overflow-x-auto">
                <div className="min-w-[300px]">
                    <div className="grid grid-cols-[70px_1fr_1fr] bg-slate-800/80 text-gray-100 px-2 py-2 font-medium text-xs sm:text-sm sm:px-3">
                        <div>Date</div>
                        <div>Mode</div>
                        <div>Montant</div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {entries.length === 0 ? (
                            <div className="px-2 py-2 text-muted-foreground sm:px-3">Aucun encaissement pour cette période</div>
                        ) : entries.map((e: any, i: number) => (
                            <RangeTransactionRow key={i} entry={e} onUpdate={onUpdate} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TransactionRow({ entry: e, fmt, onUpdate }: { entry: any, fmt: (ts: number) => string, onUpdate: (id: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="grid grid-cols-[60px_1fr_1fr] px-2 py-2 border-t border-gray-700 items-center text-xs sm:text-sm sm:px-3">
            <div>{fmt(e.timestamp)}</div>
            <div>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-all hover:scale-105 focus:outline-none",
                            e.paymentMethod === "cash" ? "border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-slate-900/80" :
                                e.paymentMethod === "check" ? "border-amber-500/30 bg-gradient-to-br from-amber-900/40 via-slate-900/60 to-slate-900/80" :
                                    "border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/80"
                        )}>
                            <span className={cn(
                                "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                                e.paymentMethod === "cash" ? "border-emerald-400/40 bg-emerald-500/20" :
                                    e.paymentMethod === "check" ? "border-amber-400/40 bg-amber-500/20" :
                                        "border-indigo-400/40 bg-indigo-500/20"
                            )}>
                                {e.paymentMethod === "card" && <svg className="h-2.5 w-2.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>}
                                {e.paymentMethod === "check" && <svg className="h-2.5 w-2.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                                {e.paymentMethod === "cash" && <svg className="h-2.5 w-2.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 10v4m-1-3.5h2m-2 3h2" /></svg>}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/80">
                                {({ cash: "ESPÈCES", check: "EN LIGNE", card: "CARTE" } as const)[e.paymentMethod as "cash" | "check" | "card"]}
                            </span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1.5 bg-slate-900/95 border-slate-700 backdrop-blur-xl">
                        <div className="grid gap-1">
                            {(["cash", "check", "card"] as const).map((method) => (
                                <button
                                    key={method}
                                    onClick={() => {
                                        onUpdate(e.id, e.kind || "prestation", method);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg transition-all",
                                        e.paymentMethod === method ? "bg-slate-800 border border-white/20" : "hover:bg-slate-800/50"
                                    )}
                                >
                                    <span className={cn(
                                        "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                                        method === "cash" ? "border-emerald-400/40 bg-emerald-500/20" :
                                            method === "check" ? "border-amber-400/40 bg-amber-500/20" :
                                                "border-indigo-400/40 bg-indigo-500/20"
                                    )}>
                                        {method === "card" && <svg className="h-2.5 w-2.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>}
                                        {method === "check" && <svg className="h-2.5 w-2.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                                        {method === "cash" && <svg className="h-2.5 w-2.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 10v4m-1-3.5h2m-2 3h2" /></svg>}
                                    </span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                                        {({ cash: "ESPÈCES", check: "EN LIGNE", card: "CARTE" } as const)[method]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="min-w-0">
                <span className="font-medium">{eur.format(e.amount)}</span>
                <span className="text-[10px] sm:text-xs text-white/60 block truncate">{e.name || (e.kind === "prestation" ? "prestation" : "produit")}</span>
            </div>
        </div>
    );
}

export function StylistDailySection({ id, commissionPct, stylistName }: { id: string; commissionPct: number; stylistName?: string }) {
    const today = parisDateString();
    const [date, setDate] = useState<string>(today);
    const [encaissementsOpen, setEncaissementsOpen] = useState(false);

    const formatDateDisplay = (dateStr: string) => {
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
                <span className="text-white/80 font-medium">Date</span>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 bg-slate-900/80 border-slate-600 text-white outline-none focus:border-cyan-400 transition-colors"
                />
                <button
                    onClick={() => setDate(today)}
                    className={cn(
                        "px-3 py-1.5 rounded-lg border font-medium transition-all",
                        date === today
                            ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
                            : "bg-slate-800/60 border-slate-600 text-white/70 hover:bg-slate-700/60 hover:text-white"
                    )}
                >
                    Aujourd'hui
                </button>
            </div>
            <StylistDaily id={id} date={date} commissionPct={commissionPct} />
            
            {/* Bouton pour ouvrir le popup des encaissements */}
            <motion.button
                onClick={() => setEncaissementsOpen(true)}
                whileHover={{ scale: 1.03, y: -3, boxShadow: "0 0 25px rgba(139,92,246,0.5)" }}
                whileTap={{ scale: 1.12, y: -8, boxShadow: "0 0 50px rgba(139,92,246,0.9), 0 0 80px rgba(139,92,246,0.5), inset 0 0 20px rgba(255,255,255,0.1)" }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="w-full flex items-center justify-between rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:border-violet-400/60"
            >
                <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20">
                        <List className="h-4 w-4 text-violet-300" />
                    </span>
                    <div className="text-left">
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/90">Encaissements du jour</div>
                    </div>
                </div>
                <ChevronDown className="h-4 w-4 text-violet-300" />
            </motion.button>

            {/* Popup des encaissements */}
            <AnimatePresence>
                {encaissementsOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setEncaissementsOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-[88%] max-w-md max-h-[70vh] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/98 via-violet-900/40 to-slate-800/98 border border-violet-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)] backdrop-blur-xl mx-auto"
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20">
                                        <List className="h-5 w-5 text-violet-300" />
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Encaissements</h3>
                                        <p className="text-xs text-white/50">{formatDateDisplay(date)}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEncaissementsOpen(false)}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                                >
                                    <ChevronDown className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="p-2 sm:p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
                                <StylistEncaissements id={id} date={date} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function StylistMonthly({ id, commissionPct, stylistName }: { id: string; commissionPct: number; stylistName?: string }) {
    const now = new Date();
    const defMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const today = parisDateString();
    const [mode, setMode] = useState<"today" | "month" | "range">("month");
    const [month, setMonth] = useState<string>(defMonth);
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [rangeEncaissementsOpen, setRangeEncaissementsOpen] = useState(false);
    const [todayEncaissementsOpen, setTodayEncaissementsOpen] = useState(false);
    const updatePaymentMethod = useUpdateTransactionPaymentMethod();
    
    const dateStr = mode === "today" ? today : `${month}-01`;
    const { data } = useStylistBreakdown(
        id, 
        dateStr, 
        mode === "range" ? startDate : undefined, 
        mode === "range" ? endDate : undefined
    );
    
    const d = data?.daily;
    const m = data?.monthly;
    const r = data?.range;
    const prestationD = (data as any)?.prestationDaily;
    const prestationM = (data as any)?.prestationMonthly;
    const prestationR = (data as any)?.prestationRange;
    const dailyProductCount = (data as any)?.dailyProductCount ?? 0;
    const monthlyProductCount = (data as any)?.monthlyProductCount ?? 0;
    const rangeProductCount = (data as any)?.rangeProductCount ?? 0;
    const rangeEntries = (data as any)?.rangeEntries || [];
    const dailyEntries = data?.dailyEntries || [];
    
    const useRangeData = mode === "range" && startDate && endDate && r;
    const useTodayData = mode === "today";
    const displayData = useTodayData ? d : (useRangeData ? r : m);
    const displayPrestationData = useTodayData ? prestationD : (useRangeData ? prestationR : prestationM);
    const displayProductCount = useTodayData ? dailyProductCount : (useRangeData ? rangeProductCount : monthlyProductCount);
    
    const total = displayData?.total;
    const prestationTotal = displayPrestationData?.total;
    const salary = (prestationTotal?.amount || 0) * (commissionPct ?? 0) / 100;
    
    const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return "";
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}/${year}`;
    };

    const handleUpdatePayment = (entryId: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => {
        updatePaymentMethod.mutate({ id: entryId, kind, paymentMethod: method });
    };
    
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                    onClick={() => setMode("today")}
                    className={cn(
                        "px-3 py-1.5 rounded-lg border font-medium transition-all text-xs",
                        mode === "today"
                            ? "bg-fuchsia-500/20 border-fuchsia-400/50 text-fuchsia-300"
                            : "bg-slate-800/60 border-slate-600 text-white/70 hover:bg-slate-700/60 hover:text-white"
                    )}
                >
                    Aujourd'hui
                </button>
                <button
                    onClick={() => setMode("month")}
                    className={cn(
                        "px-3 py-1.5 rounded-lg border font-medium transition-all text-xs",
                        mode === "month"
                            ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
                            : "bg-slate-800/60 border-slate-600 text-white/70 hover:bg-slate-700/60 hover:text-white"
                    )}
                >
                    Par mois
                </button>
                <button
                    onClick={() => setMode("range")}
                    className={cn(
                        "px-3 py-1.5 rounded-lg border font-medium transition-all text-xs",
                        mode === "range"
                            ? "bg-violet-500/20 border-violet-400/50 text-violet-300"
                            : "bg-slate-800/60 border-slate-600 text-white/70 hover:bg-slate-700/60 hover:text-white"
                    )}
                >
                    Période
                </button>
            </div>
            
            {mode === "today" ? null : mode === "month" ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-white/80 font-medium">Mois</span>
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-lg px-3 py-1.5 bg-slate-900/80 border-slate-600 text-white outline-none focus:border-cyan-400 transition-colors text-sm" />
                    <button
                        onClick={() => setMonth(defMonth)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg border font-medium transition-all text-xs",
                            month === defMonth
                                ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
                                : "bg-slate-800/60 border-slate-600 text-white/70 hover:bg-slate-700/60 hover:text-white"
                        )}
                    >
                        Ce mois{stylistName ? ` — ${stylistName}` : ""}
                    </button>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-white/80 font-medium">Du</span>
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        className="border rounded-lg px-2 py-1.5 bg-slate-900/80 border-slate-600 text-white outline-none focus:border-violet-400 transition-colors text-sm" 
                    />
                    <span className="text-white/80 font-medium">au</span>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        className="border rounded-lg px-2 py-1.5 bg-slate-900/80 border-slate-600 text-white outline-none focus:border-violet-400 transition-colors text-sm" 
                    />
                </div>
            )}
            
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 shadow-inner text-sm space-y-3">
                <div className="flex items-center justify-between text-slate-100">
                    <span className="text-sm font-medium text-white/80">
                        {useTodayData 
                            ? "CA du jour"
                            : useRangeData 
                                ? `CA du ${formatDateDisplay(startDate)} au ${formatDateDisplay(endDate)}`
                                : "CA du mois"
                        }
                    </span>
                    <span className="text-2xl font-black">{eur.format(total?.amount || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-100">
                    <span className="text-xs font-light">Salaire ({commissionPct}%)</span>
                    <span className="text-xs font-light text-white">{eur.format(salary)}</span>
                </div>
                <div className="text-xs text-slate-300">{prestationTotal?.count || 0} prestation{(prestationTotal?.count ?? 0) > 1 ? "s" : ""}{displayProductCount ? `, ${displayProductCount} produit${displayProductCount > 1 ? "s" : ""}` : ""}</div>
            </div>
            <div className="grid grid-cols-4 text-sm border rounded-md overflow-hidden">
                <div className="bg-white/12 px-3 py-2"></div>
                <div className="bg-white/12 px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-emerald-300 bg-emerald-100/30 text-emerald-100 text-xs font-semibold">Espèces</span></div>
                <div className="bg-white/12 px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-amber-300 bg-amber-100/30 text-amber-100 text-xs font-semibold">En ligne</span></div>
                <div className="bg-white/12 px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-indigo-300 bg-indigo-100/30 text-indigo-100 text-xs font-semibold">Carte</span></div>
                <div className="px-3 py-2 font-bold">{useTodayData ? "Jour" : useRangeData ? "Période" : "Mois"}</div>
                <div className="px-3 py-2">{eur.format(displayData?.methods.cash.amount || 0)}</div>
                <div className="px-3 py-2">{eur.format(displayData?.methods.check.amount || 0)}</div>
                <div className="px-3 py-2">{eur.format(displayData?.methods.card.amount || 0)}</div>
            </div>

            {useTodayData && (
                <motion.button
                    onClick={() => setTodayEncaissementsOpen(true)}
                    whileHover={{ scale: 1.03, y: -3, boxShadow: "0 0 25px rgba(236,72,153,0.5)" }}
                    whileTap={{ scale: 1.12, y: -8, boxShadow: "0 0 50px rgba(236,72,153,0.9), 0 0 80px rgba(236,72,153,0.5), inset 0 0 20px rgba(255,255,255,0.1)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="w-full flex items-center justify-between rounded-xl border border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:border-fuchsia-400/60"
                >
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-fuchsia-400/40 bg-fuchsia-500/20">
                            <List className="h-4 w-4 text-fuchsia-300" />
                        </span>
                        <div className="text-left">
                            <div className="text-xs font-semibold uppercase tracking-wide text-white/90">Encaissements du jour</div>
                        </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-fuchsia-300" />
                </motion.button>
            )}

            {useRangeData && (
                <motion.button
                    onClick={() => setRangeEncaissementsOpen(true)}
                    whileHover={{ scale: 1.03, y: -3, boxShadow: "0 0 25px rgba(139,92,246,0.5)" }}
                    whileTap={{ scale: 1.12, y: -8, boxShadow: "0 0 50px rgba(139,92,246,0.9), 0 0 80px rgba(139,92,246,0.5), inset 0 0 20px rgba(255,255,255,0.1)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="w-full flex items-center justify-between rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:border-violet-400/60"
                >
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20">
                            <List className="h-4 w-4 text-violet-300" />
                        </span>
                        <div className="text-left">
                            <div className="text-xs font-semibold uppercase tracking-wide text-white/90">Encaissements de la période</div>
                        </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-violet-300" />
                </motion.button>
            )}

            <AnimatePresence>
                {todayEncaissementsOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setTodayEncaissementsOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-[88%] max-w-md max-h-[70vh] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/98 via-fuchsia-900/40 to-slate-800/98 border border-fuchsia-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(236,72,153,0.2)] backdrop-blur-xl mx-auto"
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-400/40 bg-fuchsia-500/20">
                                        <List className="h-5 w-5 text-fuchsia-300" />
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Encaissements du jour</h3>
                                        <p className="text-xs text-white/50">{formatDateDisplay(today)}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTodayEncaissementsOpen(false)}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                                >
                                    <ChevronDown className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="p-2 sm:p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
                                <StylistRangeEncaissements entries={dailyEntries} onUpdate={handleUpdatePayment} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {rangeEncaissementsOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setRangeEncaissementsOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-[88%] max-w-md max-h-[70vh] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/98 via-violet-900/40 to-slate-800/98 border border-violet-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)] backdrop-blur-xl mx-auto"
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20">
                                        <List className="h-5 w-5 text-violet-300" />
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Encaissements</h3>
                                        <p className="text-xs text-white/50">{formatDateDisplay(startDate)} au {formatDateDisplay(endDate)}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRangeEncaissementsOpen(false)}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                                >
                                    <ChevronDown className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="p-2 sm:p-4 overflow-y-auto max-h-[calc(70vh-80px)]">
                                <StylistRangeEncaissements entries={rangeEntries} onUpdate={handleUpdatePayment} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
