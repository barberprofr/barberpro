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
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 overflow-hidden">
                <div className="grid grid-cols-4 text-sm bg-white/5">
                    <div className="px-3 py-2" aria-hidden="true" />
                    <div className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-semibold">Espèces</span></div>
                    <div className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold">Chèque</span></div>
                    <div className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-indigo-300 bg-indigo-50 text-indigo-900 text-xs font-semibold">Carte</span></div>
                </div>
                <div className="grid grid-cols-4 border-t border-white/10">
                    <div className="px-3 py-3" aria-hidden="true" />
                    <div className="px-3 py-3"><span className="text-xl font-black text-cyan-300 [-webkit-text-stroke:1px_black] [text-shadow:0_0_6px_rgba(34,211,238,0.35),0_0_12px_rgba(34,211,238,0.2)]">{eur.format(d?.methods.cash.amount || 0)}</span></div>
                    <div className="px-3 py-3"><span className="text-xl font-black text-cyan-300 [-webkit-text-stroke:1px_black] [text-shadow:0_0_6px_rgba(34,211,238,0.35),0_0_12px_rgba(34,211,238,0.2)]">{eur.format(d?.methods.check.amount || 0)}</span></div>
                    <div className="px-3 py-3"><span className="text-xl font-black text-cyan-300 [-webkit-text-stroke:1px_black] [text-shadow:0_0_6px_rgba(34,211,238,0.35),0_0_12px_rgba(34,211,238,0.2)]">{eur.format(d?.methods.card.amount || 0)}</span></div>
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
                            "inline-flex items-center px-2 py-0.5 rounded-full border-2 text-xs font-semibold transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900",
                            e.paymentMethod === "cash" ? "border-emerald-300 bg-emerald-50 text-emerald-900 focus:ring-emerald-400" :
                                e.paymentMethod === "check" ? "border-amber-300 bg-amber-50 text-amber-900 focus:ring-amber-400" :
                                    "border-indigo-300 bg-indigo-50 text-indigo-900 focus:ring-indigo-400"
                        )}>
                            {({ cash: "Espèces", check: "Chèque", card: "Carte" } as const)[e.paymentMethod as "cash" | "check" | "card"]}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-1 bg-slate-900 border-slate-700">
                        <div className="grid gap-1">
                            {(["cash", "check", "card"] as const).map((method) => (
                                <button
                                    key={method}
                                    onClick={() => {
                                        onUpdate(e.id, e.kind || "prestation", method);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex items-center w-full px-2 py-1.5 text-xs font-medium rounded-md transition-colors",
                                        e.paymentMethod === method ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                    )}
                                >
                                    {({ cash: "Espèces", check: "Chèque", card: "Carte" } as const)[method]}
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
                    <span className="font-semibold">Salaire ({commissionPct}%)</span>
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
