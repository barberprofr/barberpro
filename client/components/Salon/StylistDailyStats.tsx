import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStylistBreakdown, useUpdateTransactionPaymentMethod } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
        <div className="rounded-3xl border border-white/25 bg-slate-800/70 p-4 shadow-inner text-sm space-y-4 backdrop-blur-sm">
            <div className="space-y-3">
                <div className="flex items-center justify-between text-slate-100">
                    <span className="text-lg font-black tracking-wide [-webkit-text-stroke:0.5px_black]">CA du jour</span>
                    <span className="text-5xl font-black tracking-wide text-fuchsia-300" style={{ WebkitTextStroke: '0.5px black' }}>{eur.format(total?.amount || 0)}</span>
                </div>
                <div className="text-xs text-white">{prestationTotal?.count || 0} prestation{(prestationTotal?.count ?? 0) > 1 ? "s" : ""}{dailyProductCount ? `, ${dailyProductCount} produit${dailyProductCount > 1 ? "s" : ""}` : ""}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/20">
                            <svg className="h-3.5 w-3.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
                        </span>
                        <div className="leading-tight">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/80">CARTE</div>
                            <div className="text-[9px] text-white/50">{d?.methods.card.count || 0} prest.</div>
                        </div>
                    </div>
                    <span className="text-sm font-bold text-white">{eur.format(d?.methods.card.amount || 0)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/20">
                            <svg className="h-3.5 w-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </span>
                        <div className="leading-tight">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/80">CHÈQUE</div>
                            <div className="text-[9px] text-white/50">{d?.methods.check.count || 0} prest.</div>
                        </div>
                    </div>
                    <span className="text-sm font-bold text-white">{eur.format(d?.methods.check.amount || 0)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20">
                            <svg className="h-3.5 w-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 10v4m-1-3.5h2m-2 3h2" /></svg>
                        </span>
                        <div className="leading-tight">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/80">ESPÈCES</div>
                            <div className="text-[9px] text-white/50">{d?.methods.cash.count || 0} prest.</div>
                        </div>
                    </div>
                    <span className="text-sm font-bold text-white">{eur.format(d?.methods.cash.amount || 0)}</span>
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
        <div className="text-sm border border-gray-700 rounded-md overflow-hidden bg-slate-900/70">
            <div className="grid grid-cols-3 bg-slate-800/80 text-gray-100 px-3 py-2 font-medium">
                <div>Heure</div>
                <div>Mode</div>
                <div>Montant</div>
            </div>
            <div className="max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {entries.length === 0 ? (
                    <div className="px-3 py-2 text-muted-foreground">Aucun encaissement pour ce jour</div>
                ) : entries.map((e: any, i: number) => (
                    <TransactionRow key={i} entry={e} fmt={fmt} onUpdate={handleUpdatePayment} />
                ))}
            </div>
        </div>
    );
}

function TransactionRow({ entry: e, fmt, onUpdate }: { entry: any, fmt: (ts: number) => string, onUpdate: (id: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="grid grid-cols-3 px-3 py-2 border-t border-gray-700 items-center">
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
                                {({ cash: "ESPÈCES", check: "CHÈQUE", card: "CARTE" } as const)[e.paymentMethod as "cash" | "check" | "card"]}
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
                                        {({ cash: "ESPÈCES", check: "CHÈQUE", card: "CARTE" } as const)[method]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <div>{eur.format(e.amount)} <span className="text-xs text-white/60">{e.name || (e.kind === "prestation" ? "prestation" : "produit")}</span></div>
        </div>
    );
}

export function StylistDailySection({ id, commissionPct }: { id: string; commissionPct: number }) {
    // Force date to today, no state setter needed for user interaction
    const date = parisDateString();
    return (
        <div className="space-y-2">
            <StylistDaily id={id} date={date} commissionPct={commissionPct} />
            <StylistEncaissements id={id} date={date} />
        </div>
    );
}

export function StylistMonthly({ id, commissionPct }: { id: string; commissionPct: number }) {
    const now = new Date();
    const defMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [month, setMonth] = useState<string>(defMonth); // YYYY-MM
    const dateStr = `${month}-01`;
    const { data } = useStylistBreakdown(id, dateStr);
    const m = data?.monthly;
    const prestationM = (data as any)?.prestationMonthly;
    const total = m?.total;
    const prestationTotal = prestationM?.total;
    const monthlyProductCount = (data as any)?.monthlyProductCount ?? 0;
    const salary = (prestationTotal?.amount || 0) * (commissionPct ?? 0) / 100;
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Mois</span>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-2 py-1 bg-gray-900 border-gray-700 text-gray-100 outline-none focus:outline-none" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 shadow-inner text-sm space-y-3">
                <div className="flex items-center justify-between text-slate-100">
                    <span className="font-semibold">CA du mois</span>
                    <span className="text-base font-bold">{eur.format(total?.amount || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-100">
                    <span className="text-xs font-semibold">Salaire ({commissionPct}%)</span>
                    <span className="text-base font-bold">{eur.format(salary)}</span>
                </div>
                <div className="text-xs text-slate-300">{prestationTotal?.count || 0} prestation{(prestationTotal?.count ?? 0) > 1 ? "s" : ""}{monthlyProductCount ? `, ${monthlyProductCount} produit${monthlyProductCount > 1 ? "s" : ""}` : ""}</div>
            </div>
            <div className="grid grid-cols-4 text-sm border rounded-md overflow-hidden">
                <div className="bg-white/12 px-3 py-2"></div>
                <div className="bg-white/12 px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-emerald-300 bg-emerald-100/30 text-emerald-100 text-xs font-semibold">Espèces</span></div>
                <div className="bg-white/12 px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-amber-300 bg-amber-100/30 text-amber-100 text-xs font-semibold">Chèque</span></div>
                <div className="bg-white/12 px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-indigo-300 bg-indigo-100/30 text-indigo-100 text-xs font-semibold">Carte</span></div>
                <div className="px-3 py-2 font-bold">Mois</div>
                <div className="px-3 py-2">{eur.format(m?.methods.cash.amount || 0)}</div>
                <div className="px-3 py-2">{eur.format(m?.methods.check.amount || 0)}</div>
                <div className="px-3 py-2">{eur.format(m?.methods.card.amount || 0)}</div>
            </div>
        </div>
    );
}
