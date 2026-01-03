import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useStylistBreakdown, useUpdateTransactionPaymentMethod, useUpdateStylistHiddenMonths, useUpdateStylistHiddenPeriods, useDeletePrestation, HiddenPeriod } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, List, EyeOff, Eye, X, Trash2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdminClient } from "@/lib/admin";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const DAYS_FR = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function CustomCalendar({
    startDate,
    endDate,
    onValidate,
    onClose,
    formatDateDisplay
}: {
    startDate: string;
    endDate: string;
    onValidate: (start: string, end: string) => void;
    onClose: () => void;
    formatDateDisplay: (d: string) => string;
}) {
    const now = new Date();
    const [viewMonth, setViewMonth] = useState(now.getMonth());
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [tempStart, setTempStart] = useState(startDate);
    const [tempEnd, setTempEnd] = useState(endDate);

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(viewYear - 1);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            if (viewYear < now.getFullYear()) {
                setViewMonth(0);
                setViewYear(viewYear + 1);
            }
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    const handleDayClick = (day: number) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        // Si on clique sur la date de début et pas de fin → désélectionner
        if (dateStr === tempStart && !tempEnd) {
            setTempStart("");
            return;
        }

        // Si on clique sur la date de fin → désélectionner la fin
        if (dateStr === tempEnd && tempEnd) {
            setTempEnd("");
            return;
        }

        // Si on clique sur la date de début quand il y a une fin → désélectionner tout
        if (dateStr === tempStart && tempEnd) {
            setTempStart("");
            setTempEnd("");
            return;
        }

        // Sinon, logique normale de sélection
        if (!tempStart || (tempStart && tempEnd)) {
            // Pas de début ou plage complète → nouvelle sélection de début
            setTempStart(dateStr);
            setTempEnd("");
        } else {
            // On a un début, on sélectionne la fin
            if (dateStr < tempStart) {
                // La fin est avant le début → inverser
                setTempStart(dateStr);
                setTempEnd(tempStart);
            } else {
                setTempEnd(dateStr);
            }
        }
    };

    const isInRange = (day: number) => {
        if (!tempStart || !tempEnd) return false;
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return dateStr >= tempStart && dateStr <= tempEnd;
    };

    const isStart = (day: number) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return dateStr === tempStart;
    };

    const isEnd = (day: number) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return dateStr === tempEnd;
    };

    const isToday = (day: number) => {
        return day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
    };



    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        cells.push(<div key={`empty-start-${i}`} className="h-9 w-9" />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const inRange = isInRange(day);
        const start = isStart(day);
        const end = isEnd(day);
        const todayDay = isToday(day);

        cells.push(
            <button
                key={day}
                type="button"
                onClick={() => handleDayClick(day)}
                className={cn(
                    "h-9 w-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all",
                    start || end
                        ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg"
                        : inRange
                            ? "bg-violet-500/40 text-white"
                            : "text-white hover:bg-violet-500/30",
                    todayDay && !start && !end && "ring-2 ring-fuchsia-400"
                )}
            >
                {day}
            </button>
        );
    }

    // Toujours 42 cellules (6 lignes) pour hauteur constante
    const totalCells = 42;
    const currentCells = firstDayOfWeek + daysInMonth;
    for (let i = currentCells; i < totalCells; i++) {
        cells.push(<div key={`empty-end-${i}`} className="h-9 w-9" />);
    }

    return (
        <div className="space-y-3 w-full">
            <div className="flex justify-center gap-4">
                <div className="text-center">
                    <span className="text-violet-300 font-semibold text-xs block">Début</span>
                    <div className="mt-0.5 px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/40 text-white font-bold text-sm w-[110px] text-center">
                        {tempStart ? formatDateDisplay(tempStart) : "— — —"}
                    </div>
                </div>
                <div className="text-center">
                    <span className="text-fuchsia-300 font-semibold text-xs block">Fin</span>
                    <div className="mt-0.5 px-3 py-1.5 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/40 text-white font-bold text-sm w-[110px] text-center">
                        {tempEnd ? formatDateDisplay(tempEnd) : "— — —"}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-violet-500/30 bg-slate-900/80 p-2 w-full">
                <div className="flex items-center justify-between mb-1.5 h-8">
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-violet-500/30 border border-violet-400/50 text-white hover:bg-violet-500/50 transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-bold text-white w-32 text-center">
                        {MONTHS_FR[viewMonth]} {viewYear}
                    </span>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-violet-500/30 border border-violet-400/50 text-white hover:bg-violet-500/50 transition-all"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                <div className="grid grid-cols-7 w-full">
                    {DAYS_FR.map((day) => (
                        <div key={day} className="h-6 flex items-center justify-center text-[10px] font-bold text-violet-300">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 grid-rows-6 w-full">
                    {cells}
                </div>
            </div>

            <button
                type="button"
                onClick={() => {
                    onValidate(tempStart, tempEnd);
                    onClose();
                }}
                className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg"
            >
                Valider
            </button>
        </div>
    );
}

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
            <div className="grid grid-cols-4 gap-1.5">
                <div className="flex flex-col items-center justify-center rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-1.5 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/20 mb-1">
                        <svg className="h-2.5 w-2.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
                    </span>
                    <div className="text-[9px] font-semibold uppercase text-white/80">CARTE</div>
                    <div className="text-sm font-bold text-white">{eur.format(d?.methods.card.amount || 0)}</div>
                    <div className="text-[9px] text-white/50">{d?.methods.card.count || 0} prest.</div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-1.5 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <div className="flex flex-col items-center leading-tight mb-1">
                        <span className="text-[7px] font-bold text-amber-300">Planity</span>
                        <span className="text-[7px] font-bold text-amber-300">Treatwell</span>
                    </div>
                    <div className="text-sm font-bold text-white">{eur.format(d?.methods.check.amount || 0)}</div>
                    <div className="text-[9px] text-white/50">{d?.methods.check.count || 0} prest.</div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-1.5 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20 mb-1">
                        <svg className="h-2.5 w-2.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 10v4m-1-3.5h2m-2 3h2" /></svg>
                    </span>
                    <div className="text-[9px] font-semibold uppercase text-white/80">ESPÈCES</div>
                    <div className="text-sm font-bold text-white">{eur.format(d?.methods.cash.amount || 0)}</div>
                    <div className="text-[9px] text-white/50">{d?.methods.cash.count || 0} prest.</div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-900/40 via-fuchsia-900/40 to-slate-900/80 backdrop-blur-xl px-1.5 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20 mb-1">
                        <svg className="h-2.5 w-2.5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z" /><path d="M3 10h18M10 3v18" /></svg>
                    </span>
                    <div className="text-[9px] font-semibold uppercase text-white/80">MIXTE</div>
                    <div className="text-sm font-bold text-white">{(d?.methods as any)?.mixed?.count || 0}</div>
                    <div className="text-[9px] text-white/50">paiement{((d?.methods as any)?.mixed?.count || 0) > 1 ? "s" : ""}</div>
                </div>
            </div>
        </div>
    );
}

function StylistEncaissements({ id, date }: { id: string; date?: string }) {
    const { data } = useStylistBreakdown(id, date);
    const updatePaymentMethod = useUpdateTransactionPaymentMethod();
    const deletePrestation = useDeletePrestation();
    const entries = data?.dailyEntries || [];
    const fmt = (ts: number) => new Date(ts).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
    const isAdmin = isAdminClient();

    const handleUpdatePayment = (entryId: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => {
        updatePaymentMethod.mutate({ id: entryId, kind, paymentMethod: method });
    };

    const handleDelete = (entryId: string) => {
        if (confirm("Supprimer cette prestation ?")) {
            deletePrestation.mutate(entryId);
        }
    };

    return (
        <div className="text-sm border border-gray-700 rounded-md overflow-hidden bg-slate-900/70 w-full">
            <div className="overflow-x-auto">
                <div className="min-w-[380px]">
                    <div className={cn(
                        "bg-slate-800/80 text-gray-100 px-3 py-2 font-medium text-xs sm:text-sm sm:px-4",
                        isAdmin ? "grid grid-cols-[60px_minmax(100px,1fr)_minmax(80px,1fr)_40px]" : "grid grid-cols-[60px_minmax(120px,1fr)_minmax(100px,1fr)]"
                    )}>
                        <div>Heure</div>
                        <div>Mode</div>
                        <div>Montant</div>
                        {isAdmin && <div></div>}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {entries.length === 0 ? (
                            <div className="px-2 py-2 text-muted-foreground sm:px-3">Aucun encaissement pour ce jour</div>
                        ) : entries.map((e: any, i: number) => (
                            <TransactionRow key={i} entry={e} fmt={fmt} onUpdate={handleUpdatePayment} isAdmin={isAdmin} onDelete={handleDelete} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function RangeTransactionRow({ entry: e, onUpdate, isAdmin = false, onDelete }: { entry: any, onUpdate: (id: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => void, isAdmin?: boolean, onDelete?: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const fmtTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
    };

    const getPaymentStyle = (method: string) => {
        switch (method) {
            case "cash": return { border: "border-emerald-500/30", bg: "bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-slate-900/80", circle: "border-emerald-400/40 bg-emerald-500/20", iconColor: "text-emerald-300" };
            case "check": return { border: "border-amber-500/30", bg: "bg-gradient-to-br from-amber-900/40 via-slate-900/60 to-slate-900/80", circle: "border-amber-400/40 bg-amber-500/20", iconColor: "text-amber-300" };
            case "card": return { border: "border-indigo-500/30", bg: "bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/80", circle: "border-indigo-400/40 bg-indigo-500/20", iconColor: "text-indigo-300" };
            case "mixed": return { border: "border-violet-500/30", bg: "bg-gradient-to-br from-violet-900/40 via-fuchsia-900/40 to-slate-900/80", circle: "border-violet-400/40 bg-violet-500/20", iconColor: "text-violet-300" };
            default: return { border: "border-indigo-500/30", bg: "bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/80", circle: "border-indigo-400/40 bg-indigo-500/20", iconColor: "text-indigo-300" };
        }
    };
    const style = getPaymentStyle(e.paymentMethod);

    const renderIcon = (method: string) => {
        switch (method) {
            case "card": return <svg className="h-3 w-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
            case "check": return <svg className="h-3 w-3 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
            case "cash": return <svg className="h-3 w-3 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 10v4m-1-3.5h2m-2 3h2" /></svg>;
            case "mixed": return <svg className="h-3 w-3 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z" /><path d="M3 10h18M10 3v18" /></svg>;
            default: return <svg className="h-3 w-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
        }
    };

    const getLabel = (method: string) => {
        switch (method) {
            case "cash": return "ESPÈCES";
            case "card": return "CARTE";
            case "check": return <span className="flex flex-col leading-tight text-[7px]"><span>Planity</span><span>Treatwell</span></span>;
            case "mixed": return "MIXTE";
            default: return "CARTE";
        }
    };

    return (
        <div className={cn(
            "px-3 py-2 border-t border-gray-700 items-center text-xs sm:text-sm sm:px-4",
            isAdmin ? "grid grid-cols-[70px_minmax(100px,1fr)_minmax(80px,1fr)_40px]" : "grid grid-cols-[70px_minmax(120px,1fr)_minmax(100px,1fr)]"
        )}>
            <div className="flex flex-col">
                <span className="font-light text-white">{fmtTime(e.timestamp)}</span>
            </div>
            <div>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-all hover:scale-105 focus:outline-none",
                            style.border, style.bg
                        )}>
                            <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full border", style.circle)}>
                                {renderIcon(e.paymentMethod)}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/80">
                                {getLabel(e.paymentMethod)}
                            </span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1.5 bg-slate-900/95 border-slate-700 backdrop-blur-xl">
                        <div className="grid gap-1">
                            {(["cash", "check", "card"] as const).map((method) => {
                                const methodStyle = getPaymentStyle(method);
                                return (
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
                                        <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full border", methodStyle.circle)}>
                                            {renderIcon(method)}
                                        </span>
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                                            {getLabel(method)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="min-w-0">
                <span className="font-medium">{eur.format(e.amount)}</span>
                <span className="text-[10px] sm:text-xs text-white/60 block truncate">{e.name || (e.kind === "prestation" ? "prestation" : "produit")}</span>
            </div>
            {isAdmin && onDelete && e.kind === "prestation" && (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => setConfirmDeleteOpen(true)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
                        title="Supprimer"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
            {isAdmin && e.kind !== "prestation" && (
                <div></div>
            )}

            {confirmDeleteOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setConfirmDeleteOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            onClick={(ev) => ev.stopPropagation()}
                            className="w-full max-w-sm bg-gradient-to-br from-slate-900/98 via-red-900/30 to-slate-800/98 border border-red-500/30 backdrop-blur-xl p-5 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(239,68,68,0.15)]"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-400/40 bg-red-500/20 mb-4">
                                    <Trash2 className="h-7 w-7 text-red-300" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Supprimer cette prestation ?</h3>
                                <p className="text-sm text-white/60 mb-1">
                                    <span className="font-semibold text-white">{e.name || "Prestation"}</span> - {eur.format(e.amount)}
                                </p>
                                <p className="text-xs text-white/50 mb-6">
                                    Cette action est irréversible. Les points de fidélité associés seront également supprimés.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDeleteOpen(false)}
                                        className="flex-1 py-2.5 px-4 rounded-xl border border-white/20 bg-white/5 text-white font-medium transition hover:bg-white/10"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onDelete(e.id);
                                            setConfirmDeleteOpen(false);
                                        }}
                                        className="flex-1 py-2.5 px-4 rounded-xl border border-red-500/50 bg-red-500/20 text-red-300 font-medium transition hover:bg-red-500/30"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

function StylistRangeEncaissements({ entries, onUpdate, isAdmin = false, onDelete }: { entries: any[]; onUpdate: (id: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => void; isAdmin?: boolean; onDelete?: (id: string) => void }) {
    return (
        <div className="text-sm border border-gray-700 rounded-md overflow-hidden bg-slate-900/70 w-full">
            <div className="overflow-x-auto">
                <div className="min-w-0">
                    <div className={cn(
                        "bg-slate-800/80 text-gray-100 px-3 py-2 font-medium text-xs sm:text-sm sm:px-4",
                        isAdmin ? "grid grid-cols-[70px_minmax(100px,1fr)_minmax(80px,1fr)_40px]" : "grid grid-cols-[70px_minmax(120px,1fr)_minmax(100px,1fr)]"
                    )}>
                        <div>Heure</div>
                        <div>Mode</div>
                        <div>Montant</div>
                        {isAdmin && <div></div>}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {entries.length === 0 ? (
                            <div className="px-2 py-2 text-muted-foreground sm:px-3">Aucun encaissement pour cette période</div>
                        ) : entries.map((e: any, i: number) => (
                            <RangeTransactionRow key={i} entry={e} onUpdate={onUpdate} isAdmin={isAdmin} onDelete={onDelete} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TransactionRow({ entry: e, fmt, onUpdate, isAdmin = false, onDelete }: { entry: any, fmt: (ts: number) => string, onUpdate: (id: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => void, isAdmin?: boolean, onDelete?: (id: string) => void }) {
    const [open, setOpen] = useState(false);

    const getPaymentStyle = (method: string) => {
        switch (method) {
            case "cash": return { border: "border-emerald-500/30", bg: "bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-slate-900/80", circle: "border-emerald-400/40 bg-emerald-500/20" };
            case "check": return { border: "border-amber-500/30", bg: "bg-gradient-to-br from-amber-900/40 via-slate-900/60 to-slate-900/80", circle: "border-amber-400/40 bg-amber-500/20" };
            case "card": return { border: "border-indigo-500/30", bg: "bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/80", circle: "border-indigo-400/40 bg-indigo-500/20" };
            case "mixed": return { border: "border-violet-500/30", bg: "bg-gradient-to-br from-violet-900/40 via-fuchsia-900/40 to-slate-900/80", circle: "border-violet-400/40 bg-violet-500/20" };
            default: return { border: "border-indigo-500/30", bg: "bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/80", circle: "border-indigo-400/40 bg-indigo-500/20" };
        }
    };
    const style = getPaymentStyle(e.paymentMethod);

    const renderIcon = (method: string) => {
        switch (method) {
            case "card": return <svg className="h-3 w-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
            case "check": return <svg className="h-3 w-3 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
            case "cash": return <svg className="h-3 w-3 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 10v4m-1-3.5h2m-2 3h2" /></svg>;
            case "mixed": return <svg className="h-3 w-3 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z" /><path d="M3 10h18M10 3v18" /></svg>;
            default: return <svg className="h-3 w-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
        }
    };

    const getLabel = (method: string) => {
        switch (method) {
            case "cash": return "ESPÈCES";
            case "card": return "CARTE";
            case "check": return <span className="flex flex-col leading-tight text-[7px]"><span>Planity</span><span>Treatwell</span></span>;
            case "mixed": return "MIXTE";
            default: return "CARTE";
        }
    };

    return (
        <div className={cn(
            "px-3 py-2 border-t border-gray-700 items-center text-xs sm:text-sm sm:px-4",
            isAdmin ? "grid grid-cols-[60px_minmax(100px,1fr)_minmax(80px,1fr)_40px]" : "grid grid-cols-[60px_minmax(120px,1fr)_minmax(100px,1fr)]"
        )}>
            <div>{fmt(e.timestamp)}</div>
            <div>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-all hover:scale-105 focus:outline-none",
                            style.border, style.bg
                        )}>
                            <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full border", style.circle)}>
                                {renderIcon(e.paymentMethod)}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/80">
                                {getLabel(e.paymentMethod)}
                            </span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1.5 bg-slate-900/95 border-slate-700 backdrop-blur-xl">
                        <div className="grid gap-1">
                            {(["cash", "check", "card"] as const).map((method) => {
                                const methodStyle = getPaymentStyle(method);
                                return (
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
                                        <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full border", methodStyle.circle)}>
                                            {renderIcon(method)}
                                        </span>
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                                            {getLabel(method)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="min-w-0">
                <span className="font-medium">{eur.format(e.amount)}</span>
                <span className="text-[10px] sm:text-xs text-white/60 block truncate">{e.name || (e.kind === "prestation" ? "prestation" : "produit")}</span>
            </div>
            {isAdmin && onDelete && e.kind === "prestation" && (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => onDelete(e.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
                        title="Supprimer"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
            {isAdmin && e.kind !== "prestation" && (
                <div></div>
            )}
        </div>
    );
}

function SingleDateCalendar({
    selectedDate,
    onValidate,
    onClose,
    formatDateDisplay
}: {
    selectedDate: string;
    onValidate: (date: string) => void;
    onClose: () => void;
    formatDateDisplay: (d: string) => string;
}) {
    const now = new Date();
    const [viewMonth, setViewMonth] = useState(selectedDate ? parseInt(selectedDate.split("-")[1]) - 1 : now.getMonth());
    const [viewYear, setViewYear] = useState(selectedDate ? parseInt(selectedDate.split("-")[0]) : now.getFullYear());
    const [tempDate, setTempDate] = useState(selectedDate);

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(viewYear - 1);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(viewYear + 1);
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    const handleDayClick = (day: number) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        setTempDate(dateStr);
    };

    const isSelected = (day: number) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return dateStr === tempDate;
    };

    const isToday = (day: number) => {
        return day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
    };

    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        cells.push(<div key={`empty-start-${i}`} className="h-9 w-9" />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const selected = isSelected(day);
        const todayDay = isToday(day);

        cells.push(
            <button
                key={day}
                type="button"
                onClick={() => handleDayClick(day)}
                className={cn(
                    "h-9 w-9 flex items-center justify-center rounded-lg text-sm font-semibold transition-all",
                    selected
                        ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg"
                        : "text-white hover:bg-violet-500/30",
                    todayDay && !selected && "ring-2 ring-fuchsia-400"
                )}
            >
                {day}
            </button>
        );
    }

    const totalCells = 42;
    const currentCells = firstDayOfWeek + daysInMonth;
    for (let i = currentCells; i < totalCells; i++) {
        cells.push(<div key={`empty-end-${i}`} className="h-9 w-9" />);
    }

    return (
        <div className="space-y-2 w-full">
            <div className="flex justify-center">
                <div className="text-center">
                    <span className="text-violet-300 font-semibold text-xs block">Date sélectionnée</span>
                    <div className="mt-0.5 px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/40 text-white font-bold text-sm w-[140px] text-center">
                        {tempDate ? formatDateDisplay(tempDate) : "— — —"}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-violet-500/30 bg-slate-900/80 p-2 w-full">
                <div className="flex items-center justify-between mb-1.5 h-8">
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-violet-500/30 border border-violet-400/50 text-white hover:bg-violet-500/50 transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-bold text-white w-32 text-center">
                        {MONTHS_FR[viewMonth]} {viewYear}
                    </span>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-violet-500/30 border border-violet-400/50 text-white hover:bg-violet-500/50 transition-all"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                <div className="grid grid-cols-7 w-full">
                    {DAYS_FR.map((day) => (
                        <div key={day} className="h-6 flex items-center justify-center text-[10px] font-bold text-violet-300">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 grid-rows-6 w-full">
                    {cells}
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => {
                        onValidate(parisDateString());
                        onClose();
                    }}
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-700/50 text-white font-semibold text-sm hover:bg-slate-600/50 transition-all"
                >
                    Aujourd'hui
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (tempDate) {
                            onValidate(tempDate);
                        }
                        onClose();
                    }}
                    className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg"
                >
                    Valider
                </button>
            </div>
        </div>
    );
}

const MONTHS_FR_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export function StylistDailySection({ id, commissionPct, stylistName }: { id: string; commissionPct: number; stylistName?: string }) {
    const today = parisDateString();
    const now = new Date();
    const defMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [mode, setMode] = useState<"today" | "month" | "range">("today");
    const [date, setDate] = useState<string>(today);
    const [month, setMonth] = useState<string>(defMonth);
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [encaissementsOpen, setEncaissementsOpen] = useState(false);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [monthPickerOpen, setMonthPickerOpen] = useState(false);

    const formatDateDisplay = (dateStr: string) => {
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}/${year}`;
    };

    const effectiveDate = mode === "today" ? today : (mode === "range" && startDate ? startDate : `${month}-01`);

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
                    onClick={() => {
                        setMode("month");
                        setMonthPickerOpen(true);
                    }}
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
                    onClick={() => {
                        setMode("range");
                        setDatePickerOpen(true);
                    }}
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
                <>
                    <button
                        type="button"
                        onClick={() => setMonthPickerOpen(true)}
                        className="flex flex-wrap items-center gap-2 text-sm px-3 py-2 rounded-xl border border-cyan-500/40 bg-cyan-900/20 hover:bg-cyan-900/30 transition-all"
                    >
                        <span className="text-white/80 font-medium">Mois :</span>
                        <span className="text-cyan-300 font-semibold">{MONTHS_FR[parseInt(month.split("-")[1]) - 1]} {month.split("-")[0]}</span>
                    </button>

                    {monthPickerOpen && createPortal(
                        <AnimatePresence>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                                onClick={() => setMonthPickerOpen(false)}
                            >
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-[320px] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-cyan-900/30 to-slate-800 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(6,182,212,0.2)]"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-base font-bold text-white">Sélection du mois</h3>
                                        <button
                                            type="button"
                                            onClick={() => setMonthPickerOpen(false)}
                                            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 text-sm"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <button
                                                type="button"
                                                onClick={() => setMonth(`${parseInt(month.split("-")[0]) - 1}-${month.split("-")[1]}`)}
                                                className="h-8 w-8 flex items-center justify-center rounded-full bg-cyan-500/30 border border-cyan-400/50 text-white hover:bg-cyan-500/50 transition-all"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>
                                            <span className="text-lg font-bold text-white">{month.split("-")[0]}</span>
                                            <button
                                                type="button"
                                                onClick={() => setMonth(`${parseInt(month.split("-")[0]) + 1}-${month.split("-")[1]}`)}
                                                className="h-8 w-8 flex items-center justify-center rounded-full bg-cyan-500/30 border border-cyan-400/50 text-white hover:bg-cyan-500/50 transition-all"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2">
                                            {MONTHS_FR_SHORT.map((m, i) => {
                                                const monthNum = String(i + 1).padStart(2, "0");
                                                const isSelected = month.split("-")[1] === monthNum;
                                                return (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() => setMonth(`${month.split("-")[0]}-${monthNum}`)}
                                                        className={cn(
                                                            "h-10 rounded-xl text-sm font-semibold transition-all",
                                                            isSelected
                                                                ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg"
                                                                : "bg-slate-700/50 text-white/70 hover:bg-cyan-500/20"
                                                        )}
                                                    >
                                                        {m}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMonth(defMonth);
                                                    setMonthPickerOpen(false);
                                                }}
                                                className="flex-1 px-4 py-2 rounded-xl bg-slate-700/50 text-white font-semibold text-sm hover:bg-slate-600/50 transition-all"
                                            >
                                                Ce mois
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMonthPickerOpen(false)}
                                                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-semibold text-sm hover:from-cyan-500 hover:to-teal-500 transition-all shadow-lg"
                                            >
                                                Valider
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>,
                        document.body
                    )}
                </>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={() => setDatePickerOpen(true)}
                        className="flex flex-wrap items-center gap-2 text-sm px-3 py-2 rounded-xl border border-violet-500/40 bg-violet-900/20 hover:bg-violet-900/30 transition-all"
                    >
                        <span className="text-white/80 font-medium">Du</span>
                        <span className="text-violet-300 font-semibold">{startDate ? formatDateDisplay(startDate) : "jj/mm/aaaa"}</span>
                        <span className="text-white/80 font-medium">au</span>
                        <span className="text-violet-300 font-semibold">{endDate ? formatDateDisplay(endDate) : "jj/mm/aaaa"}</span>
                    </button>

                    {datePickerOpen && createPortal(
                        <AnimatePresence>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                                onClick={() => setDatePickerOpen(false)}
                            >
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-[320px] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-violet-500/30 bg-gradient-to-br from-slate-900 via-violet-900/40 to-slate-800 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)]"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-base font-bold text-white">Sélection des dates</h3>
                                        <button
                                            type="button"
                                            onClick={() => setDatePickerOpen(false)}
                                            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 text-sm"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <CustomCalendar
                                        startDate={startDate}
                                        endDate={endDate}
                                        onValidate={(start, end) => {
                                            setStartDate(start);
                                            setEndDate(end);
                                        }}
                                        onClose={() => setDatePickerOpen(false)}
                                        formatDateDisplay={formatDateDisplay}
                                    />
                                </div>
                            </motion.div>
                        </AnimatePresence>,
                        document.body
                    )}
                </>
            )}

            <StylistDaily id={id} date={mode === "today" ? today : (mode === "range" && startDate ? startDate : `${month}-01`)} commissionPct={commissionPct} />

            {/* Bouton pour ouvrir le popup des encaissements */}
            <motion.button
                onClick={() => setEncaissementsOpen(true)}
                whileHover={{ scale: 1.03, y: -3, boxShadow: "0 0 25px rgba(139,92,246,0.5)" }}
                whileTap={{ scale: 1.12, y: -8, boxShadow: "0 0 50px rgba(139,92,246,0.9), 0 0 80px rgba(139,92,246,0.5), inset 0 0 20px rgba(255,255,255,0.1)" }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="w-full flex items-center justify-between rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:border-violet-400/60"
            >
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20">
                        <List className="h-5 w-5 text-violet-300" />
                    </span>
                    <div className="text-left">
                        <div className="text-lg font-bold uppercase tracking-wide text-white">Encaissements du jour</div>
                    </div>
                </div>
                <ChevronDown className="h-5 w-5 text-violet-300" />
            </motion.button>

            {/* Popup des encaissements */}
            <AnimatePresence>
                {encaissementsOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
                        onClick={() => setEncaissementsOpen(false)}
                    >
                        <div className="min-h-full flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                onClick={(e) => e.stopPropagation()}
                                className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/98 via-violet-900/40 to-slate-800/98 border border-violet-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)] backdrop-blur-xl"
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
                                <div className="p-2 sm:p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
                                    <StylistEncaissements id={id} date={date} />
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function StylistMonthly({ id, commissionPct, stylistName, isSettingsView = false, hiddenMonths = [], hiddenPeriods = [] }: { id: string; commissionPct: number; stylistName?: string; isSettingsView?: boolean; hiddenMonths?: number[]; hiddenPeriods?: HiddenPeriod[] }) {
    const now = new Date();
    const defMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const today = parisDateString();
    const [mode, setMode] = useState<"today" | "month" | "range">("today");
    const [month, setMonth] = useState<string>(defMonth);
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [rangeEncaissementsOpen, setRangeEncaissementsOpen] = useState(false);
    const [todayEncaissementsOpen, setTodayEncaissementsOpen] = useState(false);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [monthPickerOpen, setMonthPickerOpen] = useState(false);
    const updatePaymentMethod = useUpdateTransactionPaymentMethod();
    const deletePrestation = useDeletePrestation();
    const updateHiddenMonths = useUpdateStylistHiddenMonths();
    const updateHiddenPeriods = useUpdateStylistHiddenPeriods();
    const isAdmin = isAdminClient();
    const [periodEditingMonth, setPeriodEditingMonth] = useState<number | null>(null);
    const [periodStartDay, setPeriodStartDay] = useState<number>(1);
    const [periodEndDay, setPeriodEndDay] = useState<number>(31);
    const [displayYear, setDisplayYear] = useState(now.getFullYear());

    useEffect(() => {
        if (monthPickerOpen) {
            setDisplayYear(parseInt(month.split("-")[0]));
        }
    }, [monthPickerOpen, month]);

    const getMonthIntFromDate = (dateStr: string) => {
        const [y, m] = dateStr.split("-").map(Number);
        return y * 100 + m;
    };

    const getActiveMonths = (): number[] => {
        if (mode === "today") {
            return [getMonthIntFromDate(today)];
        } else if (mode === "month") {
            return [getMonthIntFromDate(month + "-01")];
        } else if (mode === "range" && startDate) {
            const effectiveEnd = endDate || startDate;
            const [startY, startM] = startDate.split("-").map(Number);
            const [endY, endM] = effectiveEnd.split("-").map(Number);
            const months: number[] = [];
            let currentY = startY;
            let currentM = startM;
            const endMonthInt = endY * 100 + endM;
            while (currentY * 100 + currentM <= endMonthInt) {
                months.push(currentY * 100 + currentM);
                currentM++;
                if (currentM > 12) {
                    currentM = 1;
                    currentY++;
                }
            }
            return months;
        }
        return [];
    };

    const activeMonths = getActiveMonths();

    const shouldHideData = false;

    const [maskDialogOpen, setMaskDialogOpen] = useState(false);

    useEffect(() => {
        setRangeEncaissementsOpen(false);
        setTodayEncaissementsOpen(false);
        setDatePickerOpen(false);
        setMonthPickerOpen(false);
        setMaskDialogOpen(false);
        setMode("today");
        setMonth(defMonth);
        setStartDate("");
        setEndDate("");
    }, [id]);

    const handleRemoveHiddenMonth = (monthInt: number) => {
        updateHiddenMonths.mutate({ stylistId: id, hiddenMonths: hiddenMonths.filter(m => m !== monthInt) });
    };

    const dateStr = mode === "today" ? today : `${month}-01`;
    // Si startDate est rempli mais pas endDate, on utilise startDate comme endDate aussi (pour afficher une seule journée)
    const effectiveEndDate = mode === "range" && startDate && !endDate ? startDate : endDate;
    const { data } = useStylistBreakdown(
        id,
        dateStr,
        mode === "range" ? startDate : undefined,
        mode === "range" ? effectiveEndDate : undefined
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

    // useRangeData: deux dates sélectionnées (période complète)
    const useRangeData = mode === "range" && startDate && endDate && r;
    // useSingleDayRange: une seule date "Du" sélectionnée (afficher CA du jour pour cette date)
    const useSingleDayRange = mode === "range" && startDate && !endDate && r;
    const useTodayData = mode === "today";
    const displayData = useTodayData ? d : (useRangeData ? r : (useSingleDayRange ? r : m));
    const displayPrestationData = useTodayData ? prestationD : (useRangeData ? prestationR : (useSingleDayRange ? prestationR : prestationM));
    const displayProductCount = useTodayData ? dailyProductCount : ((useRangeData || useSingleDayRange) ? rangeProductCount : monthlyProductCount);

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

    const handleDelete = (entryId: string) => {
        if (confirm("Supprimer cette prestation ?")) {
            deletePrestation.mutate(entryId);
        }
    };

    return (
        <div className="space-y-2 pb-4 w-full">
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
                    onClick={() => {
                        setMode("month");
                        setMonthPickerOpen(true);
                    }}
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
                    onClick={() => {
                        setMode("range");
                        setDatePickerOpen(true);
                    }}
                    className={cn(
                        "px-3 py-1.5 rounded-lg border font-medium transition-all text-xs",
                        mode === "range"
                            ? "bg-violet-500/20 border-violet-400/50 text-violet-300"
                            : "bg-slate-800/60 border-slate-600 text-white/70 hover:bg-slate-700/60 hover:text-white"
                    )}
                >
                    Période
                </button>
                {isSettingsView && (
                    <button
                        onClick={() => setMaskDialogOpen(true)}
                        onTouchEnd={(e) => { e.preventDefault(); setMaskDialogOpen(true); }}
                        className="ml-auto px-3 py-1.5 rounded-lg border font-medium transition-all text-xs flex items-center gap-1.5 bg-rose-500/20 border-rose-400/50 text-rose-300 hover:bg-rose-500/30"
                    >
                        {hiddenMonths.length > 0 ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        Masquer
                    </button>
                )}
            </div>

            {mode === "today" ? null : mode === "month" ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                        type="button"
                        onClick={() => setMonthPickerOpen(true)}
                        onTouchEnd={(e) => { e.preventDefault(); setMonthPickerOpen(true); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/40 bg-cyan-900/20 hover:bg-cyan-900/30 transition-all"
                    >
                        <span className="text-white/80 font-medium">Mois</span>
                        <span className="text-cyan-300 font-semibold">{MONTHS_FR[parseInt(month.split("-")[1]) - 1]} {month.split("-")[0]}</span>
                    </button>
                    <button
                        onClick={() => setMonth(defMonth)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg border font-medium transition-all text-xs",
                            month === defMonth
                                ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
                                : "bg-slate-800/60 border-slate-600 text-white/70 hover:bg-slate-700/60 hover:text-white"
                        )}
                    >
                        Ce mois
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setDatePickerOpen(true)}
                    onTouchEnd={(e) => { e.preventDefault(); setDatePickerOpen(true); }}
                    className="flex flex-wrap items-center gap-2 text-sm px-3 py-2 rounded-xl border border-violet-500/40 bg-violet-900/20 hover:bg-violet-900/30 transition-all"
                >
                    <span className="text-white/80 font-medium">Du</span>
                    <span className="text-violet-300 font-semibold">{startDate ? formatDateDisplay(startDate) : "jj/mm/aaaa"}</span>
                    <span className="text-white/80 font-medium">au</span>
                    <span className="text-violet-300 font-semibold">{endDate ? formatDateDisplay(endDate) : "jj/mm/aaaa"}</span>
                </button>
            )}

            {/* Popup sélection dates */}
            {datePickerOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setDatePickerOpen(false)}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="w-[320px] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-violet-500/30 bg-gradient-to-br from-slate-900 via-violet-900/40 to-slate-800 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)]"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-base font-bold text-white">Sélection des dates</h3>
                                <button
                                    type="button"
                                    onClick={() => setDatePickerOpen(false)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 text-sm"
                                >
                                    ✕
                                </button>
                            </div>

                            <CustomCalendar
                                startDate={startDate}
                                endDate={endDate}
                                onValidate={(start, end) => {
                                    setStartDate(start);
                                    setEndDate(end);
                                }}
                                onClose={() => setDatePickerOpen(false)}
                                formatDateDisplay={formatDateDisplay}
                            />
                        </div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}

            {/* Popup sélection mois */}
            {monthPickerOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setMonthPickerOpen(false)}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="w-[280px] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-cyan-900/40 to-slate-800 p-3 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(6,182,212,0.2)]"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold text-white">Sélection du mois</h3>
                                <button
                                    type="button"
                                    onClick={() => setMonthPickerOpen(false)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 text-xs"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="flex items-center justify-between mb-2">
                                <button
                                    type="button"
                                    onClick={() => setDisplayYear(displayYear - 1)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/30 border border-cyan-400/50 text-white hover:bg-cyan-500/50 transition-all"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-base font-bold text-cyan-300">{displayYear}</span>
                                <button
                                    type="button"
                                    onClick={() => setDisplayYear(displayYear + 1)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/30 border border-cyan-400/50 text-white hover:bg-cyan-500/50 transition-all"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 mb-2">
                                {MONTHS_FR.map((m, idx) => {
                                    const monthValue = `${displayYear}-${String(idx + 1).padStart(2, "0")}`;
                                    const isSelected = month === monthValue;
                                    const isCurrent = idx === now.getMonth() && displayYear === now.getFullYear();
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => {
                                                setMonth(monthValue);
                                                setMonthPickerOpen(false);
                                            }}
                                            className={cn(
                                                "py-2.5 px-1.5 rounded-lg text-xs font-semibold transition-all",
                                                isSelected
                                                    ? "bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-lg"
                                                    : "text-white hover:bg-cyan-500/30",
                                                isCurrent && !isSelected && "ring-2 ring-cyan-400"
                                            )}
                                        >
                                            {m.slice(0, 4)}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={() => setMonthPickerOpen(false)}
                                className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-semibold text-xs hover:from-cyan-500 hover:to-teal-500 transition-all shadow-lg"
                            >
                                Fermer
                            </button>
                        </div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}

            {shouldHideData ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-4 shadow-inner text-sm text-center">
                    <div className="flex items-center justify-center gap-2 text-rose-300">
                        <EyeOff className="h-5 w-5" />
                        <span className="text-base font-medium">Données masquées</span>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 shadow-inner text-sm space-y-1">
                    <div className="flex items-baseline justify-between text-slate-100">
                        <span className="text-sm font-light text-white leading-none">
                            {useTodayData
                                ? "CA du jour"
                                : useSingleDayRange
                                    ? `CA du jour (${formatDateDisplay(startDate)})`
                                    : useRangeData
                                        ? `CA du ${formatDateDisplay(startDate)} au ${formatDateDisplay(endDate)}`
                                        : "CA du mois"
                            }
                        </span>
                        <span className="text-2xl font-black leading-none">{eur.format(total?.amount || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-100">
                        <span className="text-xs font-light">Salaire ({commissionPct}%)</span>
                        <span className="text-xs font-light text-white">{eur.format(salary)}</span>
                    </div>
                    <div className="text-xs text-slate-300">{prestationTotal?.count || 0} prestation{(prestationTotal?.count ?? 0) > 1 ? "s" : ""}{displayProductCount ? `, ${displayProductCount} produit${displayProductCount > 1 ? "s" : ""}` : ""}</div>
                </div>
            )}
            {!shouldHideData && (
                <div className="grid grid-cols-4 text-sm border rounded-md overflow-hidden">
                    <div className="bg-white/12 px-2 py-1"></div>
                    <div className="bg-white/12 px-2 py-1"><span className="inline-flex items-center px-1.5 py-0.5 rounded-full border-2 border-emerald-300 bg-emerald-100/30 text-emerald-100 text-[10px] font-semibold">Espèces</span></div>
                    <div className="bg-white/12 px-2 py-1"><span className="inline-flex items-center px-1.5 py-0.5 rounded-full border-2 border-amber-300 bg-amber-100/30 text-amber-100 text-[8px] font-semibold"><span className="flex flex-col leading-tight text-center"><span>Planity</span><span>Treatwell</span></span></span></div>
                    <div className="bg-white/12 px-2 py-1"><span className="inline-flex items-center px-1.5 py-0.5 rounded-full border-2 border-indigo-300 bg-indigo-100/30 text-indigo-100 text-[10px] font-semibold">Carte</span></div>
                    <div className="px-2 py-1 font-bold text-xs">{useTodayData ? "Jour" : useSingleDayRange ? "Jour" : useRangeData ? "Période" : "Mois"}</div>
                    <div className="px-2 py-1 text-xs">{eur.format(displayData?.methods.cash.amount || 0)}</div>
                    <div className="px-2 py-1 text-xs">{eur.format(displayData?.methods.check.amount || 0)}</div>
                    <div className="px-2 py-1 text-xs">{eur.format(displayData?.methods.card.amount || 0)}</div>
                </div>
            )}

            {!shouldHideData && (useTodayData || useSingleDayRange) && (
                <motion.button
                    onClick={() => setTodayEncaissementsOpen(true)}
                    whileHover={{ scale: 1.03, y: -3, boxShadow: "0 0 25px rgba(236,72,153,0.5)" }}
                    whileTap={{ scale: 1.12, y: -8, boxShadow: "0 0 50px rgba(236,72,153,0.9), 0 0 80px rgba(236,72,153,0.5), inset 0 0 20px rgba(255,255,255,0.1)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="w-full flex items-center justify-between rounded-xl border border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:border-fuchsia-400/60"
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-fuchsia-400/40 bg-fuchsia-500/20">
                            <List className="h-5 w-5 text-fuchsia-300" />
                        </span>
                        <div className="text-left min-w-0">
                            <div className="text-lg font-bold uppercase tracking-wide text-white">Encaissements du jour</div>
                        </div>
                    </div>
                    <ChevronDown className="h-5 w-5 text-fuchsia-300" />
                </motion.button>
            )}

            {!shouldHideData && useRangeData && (
                <motion.button
                    onClick={() => setRangeEncaissementsOpen(true)}
                    whileHover={{ scale: 1.03, y: -3, boxShadow: "0 0 25px rgba(139,92,246,0.5)" }}
                    whileTap={{ scale: 1.12, y: -8, boxShadow: "0 0 50px rgba(139,92,246,0.9), 0 0 80px rgba(139,92,246,0.5), inset 0 0 20px rgba(255,255,255,0.1)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="w-full flex items-center justify-between rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:border-violet-400/60"
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20">
                            <List className="h-5 w-5 text-violet-300" />
                        </span>
                        <div className="text-left min-w-0">
                            <div className="text-lg font-bold uppercase tracking-wide text-white">Encaissements de la période</div>
                        </div>
                    </div>
                    <ChevronDown className="h-5 w-5 text-violet-300" />
                </motion.button>
            )}

            {todayEncaissementsOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setTodayEncaissementsOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/98 via-fuchsia-900/40 to-slate-800/98 border border-fuchsia-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(236,72,153,0.2)] backdrop-blur-xl"
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-fuchsia-400/40 bg-fuchsia-500/20">
                                        <List className="h-5 w-5 text-fuchsia-300" />
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-base sm:text-lg font-bold text-white truncate">Encaissements du jour</h3>
                                        <p className="text-xs text-white/50">{useSingleDayRange ? formatDateDisplay(startDate) : formatDateDisplay(today)}</p>
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
                            <div className="p-2 sm:p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
                                <StylistRangeEncaissements entries={useSingleDayRange ? rangeEntries : dailyEntries} onUpdate={handleUpdatePayment} isAdmin={isAdmin && isSettingsView} onDelete={handleDelete} />
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}

            {rangeEncaissementsOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setRangeEncaissementsOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/98 via-violet-900/40 to-slate-800/98 border border-violet-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)] backdrop-blur-xl"
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20">
                                        <List className="h-5 w-5 text-violet-300" />
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-base sm:text-lg font-bold text-white truncate">Encaissements</h3>
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
                            <div className="p-2 sm:p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
                                <StylistRangeEncaissements entries={rangeEntries} onUpdate={handleUpdatePayment} isAdmin={isAdmin && isSettingsView} onDelete={handleDelete} />
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}

            {maskDialogOpen && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => { setMaskDialogOpen(false); setPeriodEditingMonth(null); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-md max-h-[calc(100vh-32px)] overflow-y-auto bg-gradient-to-br from-slate-900/98 via-rose-900/30 to-slate-800/98 border border-rose-500/30 backdrop-blur-xl p-5 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(244,63,94,0.15)] relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3 text-rose-300 text-lg">
                                    <EyeOff className="h-5 w-5" />
                                    <span className="font-semibold">Masquer le CA - 2025</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setMaskDialogOpen(false); setPeriodEditingMonth(null); }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-colors"
                                    aria-label="Fermer"
                                >
                                    ✕
                                </button>
                            </div>

                            {periodEditingMonth === null ? (
                                <div>
                                    <p className="text-sm text-white/60 mb-3">Cliquez sur un mois pour définir la période à masquer</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: 'Jan', value: 202501, days: 31 },
                                            { label: 'Fév', value: 202502, days: 28 },
                                            { label: 'Mar', value: 202503, days: 31 },
                                            { label: 'Avr', value: 202504, days: 30 },
                                            { label: 'Mai', value: 202505, days: 31 },
                                            { label: 'Juin', value: 202506, days: 30 },
                                            { label: 'Juil', value: 202507, days: 31 },
                                            { label: 'Août', value: 202508, days: 31 },
                                            { label: 'Sep', value: 202509, days: 30 },
                                            { label: 'Oct', value: 202510, days: 31 },
                                            { label: 'Nov', value: 202511, days: 30 },
                                            { label: 'Déc', value: 202512, days: 31 },
                                        ].map((monthData) => {
                                            const period = hiddenPeriods.find(p => p.month === monthData.value);
                                            const hasPeriod = !!period;
                                            return (
                                                <button
                                                    key={monthData.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setPeriodEditingMonth(monthData.value);
                                                        if (period) {
                                                            setPeriodStartDay(period.startDay);
                                                            setPeriodEndDay(period.endDay);
                                                        } else {
                                                            setPeriodStartDay(1);
                                                            setPeriodEndDay(monthData.days);
                                                        }
                                                    }}
                                                    className={`
                                                        relative flex flex-col items-center justify-center py-3 px-2 rounded-xl
                                                        font-medium text-sm transition-all touch-manipulation
                                                        ${hasPeriod
                                                            ? 'bg-rose-500/30 border-2 border-rose-400/60 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                                                            : 'bg-slate-800/60 border border-slate-600/50 text-white/70 hover:bg-slate-700/60 hover:border-slate-500'
                                                        }
                                                    `}
                                                >
                                                    <span>{monthData.label}</span>
                                                    {hasPeriod && (
                                                        <span className="text-[10px] mt-0.5 text-rose-300">{period.startDay}-{period.endDay}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-white/40 mt-3 text-center">
                                        {hiddenPeriods.length === 0
                                            ? 'Aucune période masquée'
                                            : `${hiddenPeriods.length} période${hiddenPeriods.length > 1 ? 's' : ''} masquée${hiddenPeriods.length > 1 ? 's' : ''}`
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <button
                                        type="button"
                                        onClick={() => setPeriodEditingMonth(null)}
                                        className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Retour aux mois
                                    </button>

                                    <div className="text-center">
                                        <h4 className="text-lg font-semibold text-white mb-1">
                                            {MONTHS_FR[(periodEditingMonth % 100) - 1]} {Math.floor(periodEditingMonth / 100)}
                                        </h4>
                                        <p className="text-sm text-white/60">Définir la période à masquer</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-white/60 mb-1">Du jour</label>
                                            <select
                                                value={periodStartDay}
                                                onChange={(e) => setPeriodStartDay(Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-white/20 text-white text-center"
                                            >
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                    <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-white/60 mb-1">Au jour</label>
                                            <select
                                                value={periodEndDay}
                                                onChange={(e) => setPeriodEndDay(Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-white/20 text-white text-center"
                                            >
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                    <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="text-center py-2">
                                        <span className="text-sm text-rose-300">
                                            Du {String(periodStartDay).padStart(2, '0')}/{String(periodEditingMonth % 100).padStart(2, '0')} au {String(periodEndDay).padStart(2, '0')}/{String(periodEditingMonth % 100).padStart(2, '0')}
                                        </span>
                                    </div>

                                    <div className="flex gap-2">
                                        {hiddenPeriods.find(p => p.month === periodEditingMonth) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newPeriods = hiddenPeriods.filter(p => p.month !== periodEditingMonth);
                                                    updateHiddenPeriods.mutate({ stylistId: id, hiddenPeriods: newPeriods });
                                                    setPeriodEditingMonth(null);
                                                }}
                                                disabled={updateHiddenPeriods.isPending}
                                                className="flex-1 py-3 rounded-xl border border-red-500/50 bg-red-500/20 text-red-300 font-medium transition hover:bg-red-500/30 disabled:opacity-50"
                                            >
                                                Supprimer
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newPeriod = { month: periodEditingMonth, startDay: periodStartDay, endDay: periodEndDay };
                                                const otherPeriods = hiddenPeriods.filter(p => p.month !== periodEditingMonth);
                                                const newPeriods = [...otherPeriods, newPeriod];
                                                updateHiddenPeriods.mutate({ stylistId: id, hiddenPeriods: newPeriods });
                                                setPeriodEditingMonth(null);
                                            }}
                                            disabled={updateHiddenPeriods.isPending || periodStartDay > periodEndDay}
                                            className="flex-1 py-3 rounded-xl border-0 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold transition hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 shadow-[0_4px_15px_rgba(244,63,94,0.4)]"
                                        >
                                            Valider
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
