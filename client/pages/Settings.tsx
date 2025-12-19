import SharedLayout from "@/components/SharedLayout";
import { apiPath } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import ClientsExport from "@/components/Salon/ClientsExport";
import PointsManager from "@/components/Salon/PointsManager";
import ServicesManager from "@/components/Salon/ServicesManager";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminUpdateCode, useAdminVerifyCode, useAddStylist, useConfig, useUpdateConfig, useDashboardSummary, usePointsUsageReport, useStylists, useStylistBreakdown, useRevenueByDay, useRevenueByMonth, useDeleteStylist, useSetStylistCommission, useAdminRecoverCode, useAdminRecoverCodeVerify, useServices, useAddService, useDeleteService, useGlobalBreakdown, useUpdateTransactionPaymentMethod, useSetStylistSecretCode, useStylistHasSecretCode, useVerifyStylistSecretCode, useStylistDeposits, useAddStylistDeposit, useDeleteStylistDeposit, useAllDepositsForMonth, StylistDeposit } from "@/lib/api";
import { StylistMonthly } from "@/components/Salon/StylistDailyStats";
import type { SummaryPayments, MethodKey, Stylist, PointsUsageGroup, DashboardSummary, Service } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Coins, FileText, ChevronDown, ChevronRight, ChevronLeft, CalendarDays, Sun, Scissors, UserRound, TrendingUp, Crown, Search, Check, List } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

interface PaymentSummaryMeta {
  key: MethodKey;
  label: string;
  icon: LucideIcon;
  badgeClasses: string;
  iconClasses: string;
}

const PAYMENT_METHOD_META: PaymentSummaryMeta[] = [
  {
    key: "card",
    label: "Carte",
    icon: CreditCard,
    badgeClasses: "border border-indigo-500/40 bg-indigo-500/10",
    iconClasses: "text-indigo-300",
  },
  {
    key: "check",
    label: "Planity/Treatwell",
    icon: FileText,
    badgeClasses: "border border-amber-500/40 bg-amber-500/10",
    iconClasses: "text-amber-300",
  },
  {
    key: "cash",
    label: "Espèces",
    icon: Coins,
    badgeClasses: "border border-emerald-500/40 bg-emerald-500/10",
    iconClasses: "text-emerald-300",
  },
];

const STYLIST_COMMISSION_CHOICES = [0, ...Array.from({ length: 41 }, (_, index) => 20 + index)];

type PaymentSummaryItem = PaymentSummaryMeta & { amount: number; count: number };

function PaymentSummaryGrid({ items }: { items: PaymentSummaryItem[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-between rounded-xl border border-white/15 bg-white/8 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${item.badgeClasses}`}>
              <item.icon className={`h-4 w-4 ${item.iconClasses}`} />
            </span>
            <div className="leading-tight">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/80">{item.label}</div>
              <div className="text-[11px] text-white/50">{item.count} prest.</div>
            </div>
          </div>
          <span className="text-sm font-bold text-white">{eur.format(item.amount)}</span>
        </div>
      ))}
    </div>
  );
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function MonthYearPicker({ 
  value, 
  onChange, 
  variant = "emerald",
  showYearNav = true
}: { 
  value: number; 
  onChange: (v: number) => void; 
  variant?: "emerald" | "violet";
  showYearNav?: boolean;
}) {
  const year = Math.floor(value / 100);
  const month = value % 100;
  
  const setYear = (newYear: number) => {
    onChange(newYear * 100 + month);
  };
  
  const setMonth = (newMonth: number) => {
    onChange(year * 100 + newMonth);
  };
  
  const borderColor = variant === "violet" ? "border-violet-400/30" : "border-emerald-400/30";
  const selectedBg = variant === "violet" 
    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500" 
    : "bg-gradient-to-r from-emerald-500 to-teal-500";
  const hoverBg = variant === "violet" ? "hover:bg-violet-500/20" : "hover:bg-emerald-500/20";
  const arrowBg = variant === "violet" ? "hover:bg-violet-500/30" : "hover:bg-emerald-500/30";
  
  return (
    <div className={`rounded-2xl border ${borderColor} bg-slate-800/50 p-4`}>
      {showYearNav && (
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setYear(year - 1)}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition ${arrowBg}`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold text-white">{year}</span>
          <button
            type="button"
            onClick={() => setYear(year + 1)}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition ${arrowBg}`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {MONTHS_FR.map((m, i) => {
          const monthNum = i + 1;
          const isSelected = month === monthNum;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMonth(monthNum)}
              className={cn(
                "h-10 rounded-xl text-sm font-semibold transition-all",
                isSelected 
                  ? `${selectedBg} text-white shadow-lg` 
                  : `bg-slate-700/50 text-white/70 ${hoverBg}`
              )}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PointsUsageScopeSectionProps {
  title: string;
  emptyLabel: string;
  groups: PointsUsageGroup[];
  variant?: "default" | "month";
}

function formatContact(value?: string | null) {
  return value && value.trim().length > 0 ? value : "Non renseigné";
}

function PointsUsageScopeSection({ title, emptyLabel, groups, variant = "default" }: PointsUsageScopeSectionProps) {
  const totalPoints = groups.reduce((sum, group) => sum + group.totalPoints, 0);
  const containerClasses = variant === "month"
    ? "rounded-3xl border border-white/20 bg-black/12 p-4 space-y-4 shadow-[0_28px_60px_rgba(15,23,42,0.3)] backdrop-blur-md"
    : "rounded-2xl border border-white/20 bg-black/12 p-3 space-y-3 backdrop-blur-md";
  const itemClasses = variant === "month"
    ? "rounded-2xl border border-white/12 bg-white/10 backdrop-blur-lg transition hover:border-white/35"
    : "rounded-xl border border-white/10 bg-slate-900/40";
  const triggerClasses = variant === "month"
    ? "px-4 py-3 text-sm font-semibold text-slate-100"
    : "px-3 py-2 text-sm font-semibold";
  const pillClasses = variant === "month"
    ? "inline-flex items-center gap-2 rounded-full border border-white/50 bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-[0_8px_16px_rgba(255,255,255,0.1),inset_0_1px_1px_rgba(255,255,255,0.3)]"
    : "inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-emerald-100 shadow-[0_8px_16px_rgba(16,185,129,0.15),inset_0_1px_1px_rgba(255,255,255,0.2)]";
  const entryClasses = variant === "month"
    ? "space-y-2 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 text-xs text-slate-100 shadow-[0_18px_45px_rgba(15,23,42,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)]"
    : "space-y-2 rounded-xl border border-white/15 bg-white/8 backdrop-blur-lg p-3 text-xs text-slate-100 shadow-[0_8px_24px_rgba(15,23,42,0.2)]";
  const pointsBadgeClasses = variant === "month"
    ? "inline-flex items-center rounded-full border border-white/40 bg-gradient-to-r from-white/15 to-white/8 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white shadow-[0_6px_12px_rgba(255,255,255,0.08),inset_0_1px_1px_rgba(255,255,255,0.2)]"
    : "inline-flex items-center rounded-full border border-emerald-400/40 bg-gradient-to-r from-emerald-500/15 to-emerald-400/5 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-emerald-200 shadow-[0_6px_12px_rgba(16,185,129,0.1),inset_0_1px_1px_rgba(255,255,255,0.15)]";
  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
        {totalPoints > 0 && <span className="text-xs font-semibold text-primary/80">{totalPoints} pts</span>}
      </div>
      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {groups.map((group) => (
            <AccordionItem key={group.stylistId} value={group.stylistId} className={itemClasses}>
              <AccordionTrigger className={triggerClasses}>
                <div className="flex w-full items-center justify-between gap-3">
                  <span className={pillClasses}>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    {group.stylistName}
                  </span>
                  <span className="text-xs text-primary/80">{group.totalPoints} pts</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="space-y-2 px-3 pb-3">
                  {group.entries.map((entry) => {
                    const firstName = entry.firstName?.trim() || entry.clientName;
                    const lastName = entry.lastName?.trim();
                    const displayLastName = lastName && lastName.length > 0 ? lastName : "�����";
                    return (
                      <div key={entry.id} className={entryClasses}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-100">{firstName}</span>
                          <span className={pointsBadgeClasses}>{entry.points} pts</span>
                        </div>
                        <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                          <span className="font-medium text-slate-200">Nom: <span className="font-normal text-slate-300">{displayLastName}</span></span>
                          <span className="font-medium text-slate-200">Téléphone: <span className="font-normal text-slate-300">{formatContact(entry.phone)}</span></span>
                          <span className="font-medium text-slate-200">Email: <span className="font-normal text-slate-300">{formatContact(entry.email)}</span></span>
                          <span className="font-medium text-slate-200">Horodatage: <span className="font-normal text-slate-300">{new Date(entry.timestamp).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</span></span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Motif: {entry.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
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

function parisDateTimeLocalString(at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const hour = (get("hour") || "00").padStart(2, "0");
  const minute = (get("minute") || "00").padStart(2, "0");
  const second = (get("second") || "00").padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${minute}:${second}`;
}

function describeParisDateTime(local: string) {
  if (!local.includes("T")) return "";
  const [date, time] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return "";
  const ref = new Date(Date.UTC(year, month - 1, day, 12, 0));
  const dateLabel = ref.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `${dateLabel} à ${String(hour).padStart(2, "0")}h${String(minute).padStart(2, "0")}`;
}

function formatParisClockTime(local: string) {
  if (!local.includes("T")) return "";
  const timePart = local.split("T")[1] ?? "";
  const [hour = "00", minute = "00", second = "00"] = timePart.split(":");
  return [hour, minute, second].map((segment) => segment.padStart(2, "0")).join(":");
}

function getParisTimeZoneLabel(at: Date = new Date()): string {
  // Create two dates with the same UTC timestamp but in different time zones
  const utcFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parisFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const utcStr = utcFormatter.format(at);
  const parisStr = parisFormatter.format(at);

  const utcTime = utcStr.split(", ")[1];
  const parisTime = parisStr.split(", ")[1];

  const [utcHour, utcMin] = utcTime.split(":").map(Number);
  const [parisHour, parisMin] = parisTime.split(":").map(Number);

  const utcTotal = utcHour * 60 + utcMin;
  const parisTotal = parisHour * 60 + parisMin;

  let offsetMinutes = parisTotal - utcTotal;
  // Handle day boundaries
  if (offsetMinutes > 12 * 60) {
    offsetMinutes -= 24 * 60;
  } else if (offsetMinutes < -12 * 60) {
    offsetMinutes += 24 * 60;
  }

  const offsetHours = offsetMinutes / 60;

  // Return the appropriate label
  // +1 = CET (Heure d'hiver)
  // +2 = CEST (Heure d'été)
  if (offsetHours === 1) {
    return "CET (UTC+1) - Heure d'hiver";
  } else if (offsetHours === 2) {
    return "CEST (UTC+2) - Heure d'été";
  }
  return `UTC${offsetHours > 0 ? "+" : ""}${offsetHours}`;
}

function formatSelectedDayLabel(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "—";
  const [year, month, dayNum] = day.split("-").map(Number);
  if ([year, month, dayNum].some((n) => Number.isNaN(n)) || month < 1 || month > 12 || dayNum < 1 || dayNum > 31) return "���";
  const ref = new Date(Date.UTC(year, month - 1, dayNum, 12, 0, 0));
  const label = ref.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatSelectedMonthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return "—";
  const [year, monthNum] = month.split("-").map(Number);
  if ([year, monthNum].some((n) => Number.isNaN(n)) || monthNum < 1 || monthNum > 12) return "—";
  const ref = new Date(Date.UTC(year, monthNum - 1, 1, 12, 0, 0));
  const label = ref.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface ParisClockState {
  iso: string;
  label: string;
  time: string;
  timeZone: string;
}

function createParisClock(): ParisClockState {
  const iso = parisDateTimeLocalString();
  return {
    iso,
    label: describeParisDateTime(iso),
    time: formatParisClockTime(iso),
    timeZone: getParisTimeZoneLabel(),
  };
}





function StylistTotals({ id, commissionPct, stylistName }: { id: string; commissionPct: number; stylistName?: string }) {
  return (
    <div className="text-sm">
      <StylistMonthly id={id} commissionPct={commissionPct} stylistName={stylistName} />
    </div>
  );
}

function GlobalTransactionRow({ entry: e, onUpdate }: { entry: any, onUpdate: (id: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => void }) {
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
                {e.paymentMethod === "check" ? <span className="flex flex-col leading-tight text-[7px]"><span>Planity</span><span>Treatwell</span></span> : ({ cash: "ESPÈCES", card: "CARTE" } as const)[e.paymentMethod as "cash" | "card"]}
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
                    {method === "check" ? <span className="flex flex-col leading-tight text-[7px]"><span>Planity</span><span>Treatwell</span></span> : ({ cash: "ESPÈCES", card: "CARTE" } as const)[method]}
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

function GlobalEncaissements({ entries, onUpdate }: { entries: any[]; onUpdate: (id: string, kind: "prestation" | "produit", method: "cash" | "check" | "card") => void }) {
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
              <GlobalTransactionRow key={i} entry={e} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalRevenueStats() {
  const now = new Date();
  const defMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = parisDateString();
  const [mode, setMode] = useState<"today" | "month" | "range">("today");
  const [month, setMonth] = useState<string>(defMonth);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [encaissementsOpen, setEncaissementsOpen] = useState(false);
  const updatePaymentMethod = useUpdateTransactionPaymentMethod();
  
  const dateStr = mode === "today" ? today : `${month}-01`;
  const effectiveEndDate = mode === "range" && startDate && !endDate ? startDate : endDate;
  const { data } = useGlobalBreakdown(
    dateStr, 
    mode === "range" ? startDate : undefined, 
    mode === "range" ? effectiveEndDate : undefined
  );
  
  const d = data?.daily;
  const m = data?.monthly;
  const r = data?.range;
  const dailyProductCount = data?.dailyProductCount ?? 0;
  const monthlyProductCount = data?.monthlyProductCount ?? 0;
  const rangeProductCount = data?.rangeProductCount ?? 0;
  const dailyPrestationCount = data?.dailyPrestationCount ?? 0;
  const monthlyPrestationCount = data?.monthlyPrestationCount ?? 0;
  const rangePrestationCount = data?.rangePrestationCount ?? 0;
  const rangeEntries = data?.rangeEntries || [];
  const dailyEntries = data?.dailyEntries || [];
  
  const useRangeData = mode === "range" && startDate && endDate && r;
  const useSingleDayRange = mode === "range" && startDate && !endDate && r;
  const useTodayData = mode === "today";
  const displayData = useTodayData ? d : (useRangeData ? r : (useSingleDayRange ? r : m));
  const displayProductCount = useTodayData ? dailyProductCount : ((useRangeData || useSingleDayRange) ? rangeProductCount : monthlyProductCount);
  const displayPrestationCount = useTodayData ? dailyPrestationCount : ((useRangeData || useSingleDayRange) ? rangePrestationCount : monthlyPrestationCount);
  const displayEntries = useTodayData ? dailyEntries : rangeEntries;
  
  const total = displayData?.total;
  
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
            Ce mois
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
        <div className="flex items-baseline justify-between text-slate-100">
          <span className="text-sm font-light text-white leading-none">
            {useTodayData 
              ? "CA du jour"
              : useSingleDayRange
                ? `CA du jour (${formatDateDisplay(startDate)})`
                : useRangeData 
                  ? `CA de la période (${formatDateDisplay(startDate)} au ${formatDateDisplay(endDate)})`
                  : "CA du mois"
            }
          </span>
          <span className="text-2xl font-black leading-none">{eur.format(total?.amount || 0)}</span>
        </div>
        <div className="text-xs text-slate-300">{displayPrestationCount} prestation{displayPrestationCount > 1 ? "s" : ""}{displayProductCount ? `, ${displayProductCount} produit${displayProductCount > 1 ? "s" : ""}` : ""}</div>
      </div>
      <div className="grid grid-cols-4 text-sm border rounded-md overflow-hidden">
        <div className="bg-white/12 px-3 py-2"></div>
        <div className="bg-white/12 px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-emerald-300 bg-emerald-100/30 text-emerald-100 text-xs font-semibold">Espèces</span></div>
        <div className="bg-white/12 px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-amber-300 bg-amber-100/30 text-amber-100 text-[8px] font-semibold"><span className="flex flex-col leading-tight text-center"><span>Planity</span><span>Treatwell</span></span></span></div>
        <div className="bg-white/12 px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full border-2 border-indigo-300 bg-indigo-100/30 text-indigo-100 text-xs font-semibold">Carte</span></div>
        <div className="px-3 py-2 font-bold">{useTodayData ? "Jour" : useRangeData ? "Période" : "Mois"}</div>
        <div className="px-3 py-2">{eur.format(displayData?.methods?.cash?.amount ?? 0)}</div>
        <div className="px-3 py-2">{eur.format(displayData?.methods?.check?.amount ?? 0)}</div>
        <div className="px-3 py-2">{eur.format(displayData?.methods?.card?.amount ?? 0)}</div>
      </div>

      {(useTodayData || useRangeData) && (
        <motion.button
          onClick={() => setEncaissementsOpen(true)}
          whileHover={{ scale: 1.03, y: -3, boxShadow: useTodayData ? "0 0 25px rgba(236,72,153,0.5)" : "0 0 25px rgba(139,92,246,0.5)" }}
          whileTap={{ scale: 1.12, y: -8, boxShadow: useTodayData ? "0 0 50px rgba(236,72,153,0.9), 0 0 80px rgba(236,72,153,0.5), inset 0 0 20px rgba(255,255,255,0.1)" : "0 0 50px rgba(139,92,246,0.9), 0 0 80px rgba(139,92,246,0.5), inset 0 0 20px rgba(255,255,255,0.1)" }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className={cn(
            "w-full flex items-center justify-between rounded-xl border backdrop-blur-xl px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all",
            useTodayData 
              ? "border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-900/40 via-slate-900/60 to-slate-900/80 hover:border-fuchsia-400/60"
              : "border-violet-500/40 bg-gradient-to-br from-violet-900/40 via-slate-900/60 to-slate-900/80 hover:border-violet-400/60"
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full border",
              useTodayData 
                ? "border-fuchsia-400/40 bg-fuchsia-500/20"
                : "border-violet-400/40 bg-violet-500/20"
            )}>
              <List className={cn("h-4 w-4", useTodayData ? "text-fuchsia-300" : "text-violet-300")} />
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/90">
                {useTodayData ? "Encaissements du jour" : "Encaissements de la période"}
              </div>
            </div>
          </div>
          <ChevronDown className={cn("h-4 w-4", useTodayData ? "text-fuchsia-300" : "text-violet-300")} />
        </motion.button>
      )}

      <AnimatePresence>
        {encaissementsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEncaissementsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "relative w-[88%] max-w-md max-h-[85vh] overflow-hidden rounded-3xl border shadow-[0_25px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl mx-auto my-auto",
                useTodayData 
                  ? "bg-gradient-to-br from-slate-900/98 via-fuchsia-900/40 to-slate-800/98 border-fuchsia-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(236,72,153,0.2)]"
                  : "bg-gradient-to-br from-slate-900/98 via-violet-900/40 to-slate-800/98 border-violet-500/30 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)]"
              )}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-full border",
                    useTodayData 
                      ? "border-fuchsia-400/40 bg-fuchsia-500/20"
                      : "border-violet-400/40 bg-violet-500/20"
                  )}>
                    <List className={cn("h-5 w-5", useTodayData ? "text-fuchsia-300" : "text-violet-300")} />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {useTodayData ? "Encaissements du jour" : "Encaissements"}
                    </h3>
                    <p className="text-xs text-white/50">
                      {useTodayData 
                        ? formatDateDisplay(today)
                        : `${formatDateDisplay(startDate)} au ${formatDateDisplay(endDate)}`
                      }
                    </p>
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
                <GlobalEncaissements entries={displayEntries} onUpdate={handleUpdatePayment} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RevenueBySingleDay({ summary }: { summary?: DashboardSummary }) {
  const todayParis = useMemo(() => parisDateString(), []);
  const [selectedDate, setSelectedDate] = useState(todayParis);
  const [open, setOpen] = useState(false);

  const targetYear = Number(selectedDate.slice(0, 4));
  const targetMonth = Number(selectedDate.slice(5, 7));
  const { data } = useRevenueByDay(targetYear, targetMonth);
  const days = data?.days ?? [];

  useEffect(() => {
    if (!days.length) return;
    if (!days.some((d) => d.date === selectedDate)) {
      const fallback = [...days].reverse().find((d) => d.amount > 0) ?? days[days.length - 1];
      if (fallback && fallback.date !== selectedDate) {
        setSelectedDate(fallback.date);
      }
    }
  }, [days, selectedDate]);

  const dayEntry = days.find((d) => d.date === selectedDate);
  const amount = dayEntry?.amount ?? 0;
  const count = dayEntry?.count ?? 0;
  const productCount = (dayEntry as any)?.productCount ?? 0;
  const salary = dayEntry?.salary ?? 0;
  const netAfterSalary = Math.max(0, amount - salary);

  const paymentSource = dayEntry?.methods
    ?? (selectedDate === todayParis && summary?.dailyPayments?.methods ? summary.dailyPayments.methods : null);
  const paymentSummary = paymentSource
    ? PAYMENT_METHOD_META.map((item) => ({
      ...item,
      amount: paymentSource[item.key]?.amount ?? 0,
      count: paymentSource[item.key]?.count ?? 0,
    }))
    : [];

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(`${selectedDate}T12:00:00`));
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="group relative flex flex-col items-center justify-center gap-2 rounded-[20px] border border-amber-500/30 bg-gradient-to-br from-amber-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-6 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] hover:border-amber-400/50 hover:shadow-[0_12px_40px_rgba(245,158,11,0.3)] active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/20">
                <svg className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Voir le détail</span>
              <span className="text-xs text-white/50">{formattedDate}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-2xl rounded-xl border border-white/14 bg-black/15 backdrop-blur-md p-3 space-y-2.5 shadow-[0_20px_50px_rgba(8,15,40,0.6)]" align="start" sideOffset={8}>
            <div className="space-y-3">
              <div className="rounded-2xl border-2 border-primary/40 bg-primary/10 px-4 py-3 text-center">
                <div className="text-xs uppercase tracking-wide text-primary">Total journée</div>
                <div className="text-4xl font-extrabold">{eur.format(amount)}</div>
                <div className="text-xs text-muted-foreground">{count} prestation{count > 1 ? "s" : ""}{productCount ? `, ${productCount} produit${productCount > 1 ? "s" : ""}` : ""}</div>
                <div className="mt-1 text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
                  Benefice net: {eur.format(netAfterSalary)}
                </div>
              </div>
              {paymentSummary.length ? (
                <PaymentSummaryGrid items={paymentSummary} />
              ) : (
                <p className="text-xs text-muted-foreground">Répartition par mode non disponible pour cette journée.</p>
              )}
              <div className="flex items-center justify-center gap-2 text-xs">
                <a className="px-2 py-1 rounded border hover:bg-accent" href={"/api" + apiPath(`/reports/by-day.csv?year=${targetYear}&month=${targetMonth}`)}>Export CSV</a>
                <a className="px-2 py-1 rounded border hover:bg-accent" href={"/api" + apiPath(`/reports/by-day.pdf?year=${targetYear}&month=${targetMonth}`)}>Export PDF</a>
              </div>
            </div>
            <div className="grid grid-cols-3 bg-white/12 px-3 py-2 font-medium text-white/80 rounded">
              <div>Date</div>
              <div>Montant</div>
              <div>Détails</div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {days.map((d) => {
                const isSelected = d.date === selectedDate;
                return (
                  <div
                    key={d.date}
                    className={cn(
                      "grid grid-cols-3 px-3 py-2 border-t transition-colors text-sm",
                      isSelected ? "bg-white/20 text-white" : "bg-transparent"
                    )}
                  >
                    <div>{d.date}</div>
                    <div>{eur.format(d.amount)}</div>
                    <div>{d.count} prest.{(d as any).productCount ? `, ${(d as any).productCount} prod.` : ""}</div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Jour</span>
          <input
            type="date"
            max={todayParis}
            className="border rounded px-2 py-1 bg-gray-900 border-gray-700 text-gray-100 outline-none focus:outline-none"
            value={selectedDate}
            onChange={(event) => {
              const value = event.target.value;
              if (value) setSelectedDate(value);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function BestDaysOfMonth() {
  const current = new Date();
  const currentYear = current.getFullYear();
  const currentMonth = current.getMonth() + 1;
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const { data } = useRevenueByDay(year, month);
  const { data: stylistsData } = useStylists();
  const days = data?.days ?? [];
  const monthLabels = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
  ];
  const endYear = 2095;
  const years = Array.from({ length: Math.max(0, endYear - currentYear + 1) }, (_, i) => currentYear + i);

  const bestStylist = stylistsData && stylistsData.length > 0
    ? stylistsData.reduce((max, stylist) => {
      const maxAmount = max.stats?.monthlyAmount ?? 0;
      const stylistAmount = stylist.stats?.monthlyAmount ?? 0;
      return stylistAmount > maxAmount ? stylist : max;
    })
    : null;

  const chartData = days.map((day) => {
    const dateObj = new Date(`${day.date}T12:00:00Z`);
    const dayName = dateObj.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "short" });
    const dayNum = day.date.split("-")[2];
    return {
      date: `${dayName} ${dayNum}`,
      CA: day.amount,
      prestations: day.count,
      productCount: (day as any).productCount ?? 0,
      fullDate: day.date,
    };
  });

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground text-sm">Mois</span>
        <select
          className="border rounded px-2 py-1 bg-gray-900 border-gray-700 text-gray-100 text-sm outline-none focus:outline-none"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {monthLabels.map((label, idx) => (
            <option key={label} value={idx + 1}>{label}</option>
          ))}
        </select>
        <span className="text-muted-foreground text-sm">Année</span>
        <select
          className="border rounded px-2 py-1 bg-gray-900 border-gray-700 text-gray-100 text-sm outline-none focus:outline-none"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {bestStylist && (bestStylist.stats?.monthlyAmount ?? 0) > 0 && (
        <motion.div
          className="rounded-2xl border border-white/20 bg-black/12 p-4 backdrop-blur-md"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/30">
              <Crown className="h-6 w-6 text-amber-300" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-200/80">Meilleur coiffeur du mois</div>
              <div className="text-lg font-bold text-amber-100">{bestStylist.name}</div>
              <div className="text-sm font-semibold text-amber-200">{eur.format(bestStylist.stats?.monthlyAmount ?? 0)}</div>
            </div>
          </div>
        </motion.div>
      )}

      {days.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-muted-foreground"
        >
          Aucune donnée disponible pour cette période
        </motion.div>
      ) : (
        <motion.div
          className="rounded-2xl border border-white/20 bg-black/12 p-4 backdrop-blur-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: "11px" }}
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
              />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                formatter={(value) => [eur.format(value as number), "CA"]}
                labelFormatter={(label) => `${label}`}
              />
              <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)" }} />
              <Bar
                dataKey="CA"
                fill="url(#colorCA)"
                radius={[8, 8, 0, 0]}
                animationDuration={1200}
              />
              <defs>
                <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.7} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </motion.div>
  );
}

function RevenueByDay({ fallbackMonthly, stylists, defaultCommissionPct }: { fallbackMonthly?: SummaryPayments; stylists?: Stylist[]; defaultCommissionPct?: number }) {
  const current = new Date();
  const currentYear = current.getFullYear();
  const currentMonth = current.getMonth() + 1; // 1-12
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const { data } = useRevenueByDay(year, month);
  const [open, setOpen] = useState(false);
  const endYear = 2095;
  const years = Array.from({ length: Math.max(0, endYear - currentYear + 1) }, (_, i) => currentYear + i);
  const monthLabels = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
  ];
  const days = data?.days ?? [];
  const monthlyTotalAmount = data?.total?.amount ?? fallbackMonthly?.total?.amount ?? days.reduce((sum, d) => sum + d.amount, 0);
  const monthlyTotalCount = data?.total?.count ?? fallbackMonthly?.total?.count ?? days.reduce((sum, d) => sum + d.count, 0);
  const monthlyProductCount = days.reduce((sum, d) => sum + ((d as any).productCount ?? 0), 0);
  const stylistsList = stylists ?? [];
  const commissionFallback = typeof defaultCommissionPct === "number" ? defaultCommissionPct : 0;
  const salaryFromStylists = stylistsList.reduce((sum, stylist) => {
    const pct = typeof stylist.commissionPct === "number" ? stylist.commissionPct : commissionFallback;
    const amount = stylist.stats?.monthlyAmount ?? 0;
    return sum + (amount * pct) / 100;
  }, 0);
  const stylistVolume = stylistsList.reduce((sum, stylist) => sum + (stylist.stats?.monthlyAmount ?? 0), 0);
  const fallbackSalary = salaryFromStylists + Math.max(0, monthlyTotalAmount - stylistVolume) * (commissionFallback / 100);
  const estimatedSalaryTotal = typeof data?.salaryTotal === "number" ? data.salaryTotal : fallbackSalary;
  const netAfterSalary = Math.max(0, monthlyTotalAmount - estimatedSalaryTotal);
  const methods = data?.methods ?? fallbackMonthly?.methods ?? null;
  const paymentSummary: PaymentSummaryItem[] = methods
    ? PAYMENT_METHOD_META.map((item) => ({
      ...item,
      amount: methods[item.key]?.amount ?? 0,
      count: methods[item.key]?.count ?? 0,
    }))
    : [];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="group relative flex flex-col items-center justify-center gap-2 rounded-[20px] border border-pink-500/30 bg-gradient-to-br from-pink-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-6 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] hover:border-pink-400/50 hover:shadow-[0_12px_40px_rgba(236,72,153,0.3)] active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-pink-400/40 bg-pink-500/20">
                <svg className="h-5 w-5 text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Voir le détail</span>
              <span className="text-xs text-white/50">Mois {monthLabels[month - 1]} {year}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-2xl rounded-xl border border-white/14 bg-black/15 backdrop-blur-md p-3 space-y-2.5 shadow-[0_20px_50px_rgba(8,15,40,0.6)]" align="start" sideOffset={8}>
            <div className="space-y-3">
              <div className="rounded-2xl border-2 border-primary/40 bg-primary/10 px-4 py-3 text-center">
                <div className="text-xs uppercase tracking-wide text-primary">Total mois — {monthLabels[month - 1]} {year}</div>
                <div className="text-4xl font-extrabold">{eur.format(monthlyTotalAmount)}</div>
                <div className="text-xs text-muted-foreground">{monthlyTotalCount} prestation{monthlyTotalCount > 1 ? "s" : ""}{monthlyProductCount ? `, ${monthlyProductCount} produit${monthlyProductCount > 1 ? "s" : ""}` : ""}</div>
                <div className="mt-1 text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
                  Benefice net: {eur.format(netAfterSalary)}
                </div>
              </div>
              <PaymentSummaryGrid items={paymentSummary} />
              <div className="flex items-center justify-center gap-2 text-xs">
                <a className="px-2 py-1 rounded border hover:bg-accent" href={"/api" + apiPath(`/reports/by-day.csv?year=${year}&month=${month}`)}>Export CSV</a>
                <a className="px-2 py-1 rounded border hover:bg-accent" href={"/api" + apiPath(`/reports/by-day.pdf?year=${year}&month=${month}`)}>Export PDF</a>
              </div>
            </div>
            <div className="grid grid-cols-3 bg-white/12 px-3 py-2 font-medium text-white/80 rounded">
              <div>Date</div>
              <div>Montant</div>
              <div>Détails</div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {days.map((d) => (
                <div key={d.date} className="grid grid-cols-3 px-3 py-2 border-t text-sm">
                  <div>{d.date}</div>
                  <div>{eur.format(d.amount)}</div>
                  <div>{d.count} prest.{(d as any).productCount ? `, ${(d as any).productCount} prod.` : ""}</div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Mois</span>
          <select
            className="border rounded px-2 py-1 bg-gray-900 border-gray-700 text-gray-100 outline-none focus:outline-none"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {monthLabels.map((label, idx) => (
              <option key={label} value={idx + 1}>{label}</option>
            ))}
          </select>
          <span className="text-muted-foreground">Année</span>
          <select
            className="border rounded px-2 py-1 bg-gray-900 border-gray-700 text-gray-100 outline-none focus:outline-none"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function RevenueByMonth() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data } = useRevenueByMonth(year);
  const [open, setOpen] = useState(false);
  const endYear = 2095;
  const years = Array.from({ length: Math.max(0, endYear - currentYear + 1) }, (_, i) => currentYear + i);
  const monthsData = data?.months ?? [];
  const reducedAmount = monthsData.reduce((sum, m) => sum + m.amount, 0);
  const reducedCount = monthsData.reduce((sum, m) => sum + m.count, 0);
  const yearlyTotalAmount = data?.total?.amount ?? reducedAmount;
  const yearlyTotalCount = data?.total?.count ?? reducedCount;
  const yearlyProductCount = (data as any)?.yearlyProductCount ?? 0;
  const methods = data?.methods ?? null;
  const paymentSummary: PaymentSummaryItem[] = methods
    ? PAYMENT_METHOD_META.map((item) => ({
      ...item,
      amount: methods[item.key]?.amount ?? 0,
      count: methods[item.key]?.count ?? 0,
    }))
    : [];
  const yearlySalaryTotal = typeof data?.salaryTotal === "number"
    ? data.salaryTotal
    : monthsData.reduce((sum, m) => sum + (m.salary ?? 0), 0);
  const netAfterSalary = Math.max(0, yearlyTotalAmount - yearlySalaryTotal);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="group relative flex flex-col items-center justify-center gap-2 rounded-[20px] border border-cyan-500/30 bg-gradient-to-br from-cyan-900/40 via-slate-900/60 to-slate-900/80 backdrop-blur-xl px-6 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] hover:border-cyan-400/50 hover:shadow-[0_12px_40px_rgba(6,182,212,0.3)] active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/20">
                <svg className="h-5 w-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Voir le détail</span>
              <span className="text-xs text-white/50">Année {year}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-2xl rounded-xl border border-white/14 bg-black/15 backdrop-blur-md p-3 space-y-2.5 shadow-[0_20px_50px_rgba(8,15,40,0.6)]" align="start" sideOffset={8}>
            <div className="space-y-3">
              <div className="rounded-2xl border-2 border-primary/40 bg-primary/10 px-4 py-3 text-center">
                <div className="text-xs uppercase tracking-wide text-primary">Total année</div>
                <div className="text-4xl font-extrabold">{eur.format(yearlyTotalAmount)}</div>
                <div className="text-xs text-muted-foreground">{yearlyTotalCount} prestation{yearlyTotalCount > 1 ? "s" : ""}{yearlyProductCount ? `, ${yearlyProductCount} produit${yearlyProductCount > 1 ? "s" : ""}` : ""}</div>
                <div className="mt-1 text-[11px] font-semibold text-emerald-300 whitespace-nowrap">Benefice net: {eur.format(netAfterSalary)}</div>
              </div>
              <PaymentSummaryGrid items={paymentSummary} />
              <div className="flex items-center justify-center gap-2 text-xs">
                <a className="px-2 py-1 rounded border hover:bg-accent" href={"/api" + apiPath(`/reports/by-month.csv?year=${year}`)}>Export CSV</a>
                <a className="px-2 py-1 rounded border hover:bg-accent" href={"/api" + apiPath(`/reports/by-month.pdf?year=${year}`)}>Export PDF</a>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Année</span>
          <select
            className="border rounded px-2 py-1 bg-gray-900 border-gray-700 text-gray-100 outline-none focus:outline-none"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const updateAdminCode = useAdminUpdateCode();
  const verifyAdminCode = useAdminVerifyCode();
  const recoverCodeHook = useAdminRecoverCode();
  const verifyRecoverCode = useAdminRecoverCodeVerify();
  const [recoverCode, setRecoverCode] = useState("");
  const [recoverNew, setRecoverNew] = useState("");
  const addStylist = useAddStylist();
  const { isSuccess: addStylistSuccess, reset: resetAddStylist } = addStylist;
  const { data: summary } = useDashboardSummary();
  const { data: stylists } = useStylists();
  const defaultParisDate = useMemo(() => parisDateString(), []);
  const [pointsDay, setPointsDay] = useState(defaultParisDate);
  const [pointsMonth, setPointsMonth] = useState(() => defaultParisDate.slice(0, 7));
  const [hasOpenedDayUsage, setHasOpenedDayUsage] = useState(false);
  const [isDayUsageVisible, setIsDayUsageVisible] = useState(false);
  const [isMonthUsageVisible, setIsMonthUsageVisible] = useState(false);
  const { data: pointsUsage, isLoading: pointsUsageLoading, isError: pointsUsageError } = usePointsUsageReport(pointsDay, pointsMonth);
  const selectedDayLabel = formatSelectedDayLabel(pointsDay);
  const selectedMonthLabel = formatSelectedMonthLabel(pointsMonth);
  const daySectionTitle = selectedDayLabel === "—" ? "Jour sélectionné" : `Points utilisés le ${selectedDayLabel}`;
  const monthSectionTitle = selectedMonthLabel === "—" ? "Mois sélectionné" : `Points utilisés en ${selectedMonthLabel}`;
  const dayEmptyLabel = selectedDayLabel === "—" ? "Sélectionnez un jour pour voir l'utilisation des points." : `Aucun point utilisé le ${selectedDayLabel}.`;
  const monthEmptyLabel = selectedMonthLabel === "—" ? "Sélectionnez un mois pour voir l'utilisation des points." : `Aucun point utilisé en ${selectedMonthLabel}.`;
  const todayParis = parisDateString();
  const currentParisMonth = todayParis.slice(0, 7);
  const delStylist = useDeleteStylist();
  const updateStylist = useSetStylistCommission();
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [emailFieldName, setEmailFieldName] = useState(() => `manual_email_${Math.random().toString(36).slice(2, 8)}`);
  const [emailFocus, setEmailFocus] = useState(false);
  const adminEmailTrimmed = (adminEmail || "").trim();
  const adminEmailRequired = !config?.adminEmail;
  const adminEmailValid = adminEmailTrimmed ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmailTrimmed) : !adminEmailRequired;
  const [stylistName, setStylistName] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [pointsRedeemDefaultStr, setPointsRedeemDefaultStr] = useState("" + (typeof config?.pointsRedeemDefault === "number" ? config.pointsRedeemDefault : 10));
  const [loginCode, setLoginCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmAdminEmail, setConfirmAdminEmail] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  useEffect(() => { if (adminUnlocked) { setAdminEmail(""); } }, [adminUnlocked]);
  const [loginError, setLoginError] = useState<string>("");
  const [commissionDefaultStr, setCommissionDefaultStr] = useState("" + (typeof config?.commissionDefault === "number" ? config.commissionDefault : 50));
  const [parisClock, setParisClock] = useState<ParisClockState>(() => createParisClock());
  const [adminSaveMsg, setAdminSaveMsg] = useState("");
  const [adminSaveErr, setAdminSaveErr] = useState("");
  useEffect(() => {
    setEmailFieldName(`manual_email_${Math.random().toString(36).slice(2, 8)}`);
  }, [adminUnlocked, adminSaveMsg]);
  useEffect(() => {
    if (typeof config?.pointsRedeemDefault === "number") {
      setPointsRedeemDefaultStr(String(config.pointsRedeemDefault));
    }
  }, [config?.pointsRedeemDefault]);
  useEffect(() => {
    setParisClock(createParisClock());
    const id = window.setInterval(() => {
      setParisClock(createParisClock());
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);
  const { hourAngle, minuteAngle, secondAngle } = useMemo(() => {
    const [h, m, s] = (parisClock.time ?? "").split(":").map((part) => Number(part));
    if ([h, m, s].some((value) => Number.isNaN(value))) {
      return { hourAngle: 0, minuteAngle: 0, secondAngle: 0 };
    }
    const hourAngleCalc = ((h % 12) + m / 60 + s / 3600) * 30;
    const minuteAngleCalc = (m + s / 60) * 6;
    const secondAngleCalc = s * 6;
    return { hourAngle: hourAngleCalc, minuteAngle: minuteAngleCalc, secondAngle: secondAngleCalc };
  }, [parisClock.time]);
  const minuteTickAngles = useMemo(() => Array.from({ length: 60 }, (_, idx) => idx * 6).filter((angle) => angle % 30 !== 0), []);
  const hourTickAngles = useMemo(() => Array.from({ length: 12 }, (_, idx) => idx * 30), []);
  const [commissionEdit, setCommissionEdit] = useState<Record<string, string>>({});
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [isAdminSectionOpen, setIsAdminSectionOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverMsg, setRecoverMsg] = useState("");
  const [recoverErr, setRecoverErr] = useState("");
  useEffect(() => {
    if (!config) return;
    if (!config.adminCodeSet || !config.adminEmail) {
      setIsAdminSectionOpen(true);
    }
  }, [config]);
  useEffect(() => {
    if (!addStylistSuccess) return;
    setAccordionValue("");
    const timeout = window.setTimeout(() => resetAddStylist(), 0);
    return () => window.clearTimeout(timeout);
  }, [addStylistSuccess, resetAddStylist]);
  useEffect(() => {
    if (!isAdminSectionOpen) {
      setRecoverOpen(false);
      setRecoverMsg("");
      setRecoverErr("");
    }
  }, [isAdminSectionOpen]);
  const [manageStylistId, setManageStylistId] = useState<string>("");
  const newAdminCode = password.trim();
  const currentAdminCode = currentPassword.trim();
  const adminCodeAlreadySet = !!config?.adminCodeSet;
  const newAdminCodeValid = newAdminCode.length >= 4 && newAdminCode.toLowerCase() !== "admin";
  const currentAdminCodeValid = !adminCodeAlreadySet || currentAdminCode.length >= 4;
  const canSaveAdminCode = newAdminCodeValid && currentAdminCodeValid && adminEmailValid;
  const handleAdminUnlock = () => {
    const code = loginCode.trim();
    if (code.length < 4 || verifyAdminCode.isPending) return;
    verifyAdminCode.mutate(
      { code },
      {
        onSuccess: () => {
          setAdminUnlocked(true);
          setLoginCode("");
          setLoginError("");
          setCurrentPassword("");
          setPassword("");
          setAdminEmail("");
          setAdminSaveMsg("");
          setAdminSaveErr("");
        },
        onError: async (err: any) => {
          try {
            const raw = typeof err?.message === "string" ? err.message : "";
            const parsed = (() => { try { return JSON.parse(raw); } catch { return null; } })();
            setLoginError(parsed?.error || raw || "Code invalide");
          } catch {
            setLoginError("Code invalide");
          }
        }
      }
    );
  };
  const [manageName, setManageName] = useState<string>("");
  const [manageSecretCode, setManageSecretCode] = useState<string>("");
  const setStylistSecretCode = useSetStylistSecretCode();
  const updateConfig = useUpdateConfig();
  const { toast } = useToast();
  const [salonNameDraft, setSalonNameDraft] = useState("");
  const [accordionValue, setAccordionValue] = useState<string>("");
  const [bestDaysAccordionValue, setBestDaysAccordionValue] = useState<string>("");
  const [servicesAccordionValue, setServicesAccordionValue] = useState<string>("");
  const [openStylistId, setOpenStylistId] = useState<string | null>(null);
  const [coiffCaPopupOpen, setCoiffCaPopupOpen] = useState(false);
  const [dailyCaPopupOpen, setDailyCaPopupOpen] = useState(false);
  const [yearCaPopupOpen, setYearCaPopupOpen] = useState(false);
  const [coiffeurPopupOpen, setCoiffeurPopupOpen] = useState(false);
  const [reglagesPopupOpen, setReglagesPopupOpen] = useState(false);
  const [statsPopupOpen, setStatsPopupOpen] = useState(false);
  const [acomptePopupOpen, setAcomptePopupOpen] = useState(false);
  const [selectedStylistForDeposit, setSelectedStylistForDeposit] = useState<Stylist | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMonth, setDepositMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() * 100 + (now.getMonth() + 1);
  });
  const [depositDetailsOpen, setDepositDetailsOpen] = useState(false);
  const addStylistDeposit = useAddStylistDeposit();
  const deleteStylistDeposit = useDeleteStylistDeposit();
  const { data: stylistDeposits, refetch: refetchDeposits } = useStylistDeposits(
    selectedStylistForDeposit?.id,
    depositMonth
  );
  const currentMonth = useMemo(() => {
    const now = new Date();
    return now.getFullYear() * 100 + (now.getMonth() + 1);
  }, []);
  const { data: allDepositsCurrentMonth } = useAllDepositsForMonth(currentMonth);
  const depositTotalsByStylist = useMemo(() => {
    const map: Record<string, number> = {};
    if (allDepositsCurrentMonth) {
      for (const d of allDepositsCurrentMonth) {
        map[d.stylistId] = (map[d.stylistId] || 0) + d.amount;
      }
    }
    return map;
  }, [allDepositsCurrentMonth]);
  const [confirmPopup, setConfirmPopup] = useState<{ open: boolean; title: string; description: string; variant: "emerald" | "violet" }>({ open: false, title: "", description: "", variant: "emerald" });

  const showConfirmPopup = (title: string, description: string, variant: "emerald" | "violet" = "emerald") => {
    setConfirmPopup({ open: true, title, description, variant });
    setTimeout(() => setConfirmPopup({ open: false, title: "", description: "", variant: "emerald" }), 2500);
  };

  const closeCoiffeurPopupAndRefresh = useCallback(() => {
    setCoiffeurPopupOpen(false);
    setManageStylistId("");
    setManageName("");
    setManageSecretCode("");
    queryClient.invalidateQueries({ queryKey: ["stylists"] });
    queryClient.invalidateQueries({ queryKey: ["config"] });
  }, [queryClient]);

  const closeReglagesPopupAndRefresh = useCallback(() => {
    setReglagesPopupOpen(false);
    queryClient.invalidateQueries({ queryKey: ["config"] });
  }, [queryClient]);

  const closeStatsPopupAndRefresh = useCallback(() => {
    setStatsPopupOpen(false);
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  }, [queryClient]);

  const closeAcomptePopupAndRefresh = useCallback(() => {
    setAcomptePopupOpen(false);
    queryClient.invalidateQueries({ queryKey: ["stylists"] });
  }, [queryClient]);

  useEffect(() => {
    if (bestDaysAccordionValue === "") {
      setTimeout(() => {
        setAccordionValue("");
      }, 50);
    }
  }, [bestDaysAccordionValue]);
  const [openDaily, setOpenDaily] = useState<Record<string, boolean>>({});
  const [openMonthly, setOpenMonthly] = useState<Record<string, boolean>>({});

  const closeAllPopups = () => {
    setAccordionValue("");
    setBestDaysAccordionValue("");
    setServicesAccordionValue("");
    setOpenStylistId(null);
    setCoiffCaPopupOpen(false);
    setDailyCaPopupOpen(false);
    setYearCaPopupOpen(false);
    setCoiffeurPopupOpen(false);
    setReglagesPopupOpen(false);
    setStatsPopupOpen(false);
    setAcomptePopupOpen(false);
    setOpenDaily({});
    setOpenMonthly({});
    setIsDayUsageVisible(false);
    setIsMonthUsageVisible(false);
  };


  const handleSalonNameSave = () => {
    const trimmed = salonNameDraft.trim();
    if (!trimmed || trimmed === (config?.salonName ?? "") || updateConfig.isPending) {
      return;
    }
    updateConfig.mutate(
      { salonName: trimmed },
      {
        onSuccess: () => {
          setSalonNameDraft(trimmed);
          toast({
            title: "Nom du salon enregistré",
            description: trimmed,
          });
        },
        onError: () => {
          toast({
            title: "Échec de la mise à jour",
            description: "Impossible d'enregistrer le nom du salon",
            variant: "destructive",
          });
        },
      }
    );
  };

  const adminShellClasses = "relative overflow-hidden rounded-2xl border border-white/20 bg-black/12 p-3 shadow-[0_22px_60px_rgba(8,15,40,0.2)] backdrop-blur-md space-y-2.5";
  const glassPanelClasses = "relative overflow-hidden rounded-2xl border border-white/20 bg-black/12 p-2.5 shadow-[0_18px_48px_rgba(8,15,40,0.2)] backdrop-blur-md";
  const pillHeadingClasses = "inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-white/15 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/80 shadow-[0_6px_18px_rgba(79,70,229,0.32)]";
  const badgeSoftClasses = "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/80 shadow-[0_8px_20px_rgba(15,23,42,0.36)]";
  const inputShellClasses = "group relative flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/10 px-2 py-1.5 shadow-[0_12px_28px_rgba(8,15,40,0.34)] backdrop-blur-xl";
  const inputFieldClasses = "h-9 rounded-xl border border-white/15 bg-white/12 text-white placeholder:text-white/60 focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-0";
  const adminInputClasses = cn(inputFieldClasses, "bg-slate-950/80 border-white/25 text-white caret-emerald-200 placeholder:text-white/65 shadow-[0_14px_36px_rgba(14,165,233,0.32)]");
  const selectTriggerClasses = "min-w-[4.5rem] rounded-xl border border-white/15 bg-white/12 text-left text-white shadow-[0_12px_28px_rgba(59,130,246,0.28)] focus-visible:ring-2 focus-visible:ring-sky-300/70";
  const gradientButtonClasses = "relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/18 bg-[linear-gradient(135deg,rgba(14,116,144,0.82)0%,rgba(16,185,129,0.6)40%,rgba(132,204,22,0.5)100%)] px-3 py-1.5 text-sm font-semibold text-white shadow-[0_16px_46px_rgba(16,185,129,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(16,185,129,0.48)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80";
  const addStylistButtonClasses = cn(
    gradientButtonClasses,
    "min-h-10 px-4 bg-[linear-gradient(135deg,#1e3a8a 0%,#1e40af 45%,#2563eb 100%)] border-white/55 shadow-[0_30px_86px_rgba(37,99,235,0.45)] text-[0.95rem] tracking-[0.22em] uppercase"
  );
  // Sync commission input with default commission from config on first load
  if (commissionPct === "" && typeof config?.commissionDefault === "number") {
    const bounded = Math.min(60, Math.max(20, config.commissionDefault));
    setCommissionPct(String(bounded));
  }
  useEffect(() => {
    if (!manageStylistId) {
      setManageName("");
      return;
    }
    if (!stylists) return;
    const stylist = stylists.find(st => st.id === manageStylistId) as any;
    if (stylist) {
      setManageName(stylist.name ?? "");
    } else {
      setManageName("");
    }
  }, [manageStylistId, stylists]);

  useEffect(() => {
    if (typeof config?.commissionDefault === "number") {
      setCommissionDefaultStr(String(config.commissionDefault));
    }
  }, [config?.commissionDefault]);

  useEffect(() => {
    if (typeof config?.salonName === "string") {
      setSalonNameDraft(config.salonName);
    }
  }, [config?.salonName]);

  if (!adminUnlocked) {
    const adminCodeNotSet = !config?.adminCodeSet;
    return (
      <SharedLayout>
        <div className="mx-auto max-w-sm space-y-3 px-3 pb-10 sm:px-0">
          <Card className="relative overflow-hidden rounded-[22px] border border-white/20 bg-black/12 shadow-[0_28px_82px_rgba(8,15,40,0.3)] backdrop-blur-md">
            <CardHeader className="relative z-10 flex flex-col space-y-2 p-4 pb-2.5 text-white">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-amber-400/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100 shadow-[0_10px_24px_rgba(217,119,6,0.25),inset_0_1px_1px_rgba(255,255,255,0.2)]">🔒 Sécurité</span>
              <CardTitle className="text-2xl font-black tracking-tight text-white drop-shadow-[0_10px_22px_rgba(15,23,42,0.5)]">{adminCodeNotSet ? "Créer votre code admin" : "Déverrouiller les paramètres"}</CardTitle>
              <p className="text-[11px] leading-relaxed text-white/65">{adminCodeNotSet ? "Créez un code administrateur pour sécuriser l'accès à vos paramètres." : "Entrez votre code administrateur ou utilisez la procédure de récupération."}</p>
            </CardHeader>
            <CardContent className="relative z-10 space-y-2.5 p-4 pt-0 text-slate-100">
              {adminCodeNotSet ? (
                <>
                  <div className="text-xs text-white/70">Créez un code admin (min 4 caractères) et confirmez vos informations.</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <PasswordInput value={password} onChange={(e) => { setPassword(e.target.value); setAdminSaveErr(""); }} placeholder="Nouveau code admin" className={cn(adminInputClasses, "h-11 px-4 text-base")} />
                    <PasswordInput value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setAdminSaveErr(""); }} placeholder="Confirmer le code admin" className={cn(adminInputClasses, "h-11 px-4 text-base")} />
                    <Input key={`admin-email-create-${adminSaveMsg ? '1' : '0'}`} type="text" inputMode="email" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Email de récupération (obligatoire)" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={cn(adminInputClasses, "h-11 px-4 text-base")} />
                    <Input type="text" inputMode="email" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Confirmer l'email" value={confirmAdminEmail} onChange={(e) => setConfirmAdminEmail(e.target.value)} className={cn(adminInputClasses, "h-11 px-4 text-base")} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button className="relative overflow-hidden rounded-xl border border-white/18 bg-[linear-gradient(135deg,rgba(37,99,235,0.85)0%,rgba(14,165,233,0.72)45%,rgba(16,185,129,0.55)100%)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_22px_58px_rgba(14,165,233,0.42)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_76px_rgba(14,165,233,0.5)] focus-visible:ring-2 focus-visible:ring-cyan-300/70" onClick={() => { if (newAdminCodeValid && adminEmailValid && password === confirmPassword && adminEmail === confirmAdminEmail) { updateAdminCode.mutate({ newCode: newAdminCode, email: adminEmailTrimmed || undefined }, { onSuccess: () => { setAdminSaveMsg("Code admin créé"); setAdminSaveErr(""); setPassword(""); setConfirmPassword(""); setAdminEmail(""); setConfirmAdminEmail(""); setAdminUnlocked(true); }, onError: async (e: any) => { try { const msg = typeof e?.message === "string" ? e.message : "Erreur"; const p = (() => { try { return JSON.parse(msg); } catch { return null; } })(); setAdminSaveErr(p?.error || msg); } catch { setAdminSaveErr("Erreur d'enregistrement"); } setAdminSaveMsg(""); } }); } }} disabled={!newAdminCodeValid || !adminEmailValid || password !== confirmPassword || adminEmail !== confirmAdminEmail || updateAdminCode.isPending}>Créer</Button>
                  </div>
                  {!newAdminCodeValid && password && <p className="text-xs text-destructive">Code admin invalide (min 4 caractères)</p>}
                  {password && confirmPassword && password !== confirmPassword && <p className="text-xs text-destructive">Les codes admin ne correspondent pas</p>}
                  {!adminEmailValid && adminEmail && <p className="text-xs text-destructive">Email invalide</p>}
                  {adminEmail && confirmAdminEmail && adminEmail !== confirmAdminEmail && <p className="text-xs text-destructive">Les emails ne correspondent pas</p>}
                  {adminSaveMsg && <span className="text-xs font-semibold text-emerald-200">{adminSaveMsg}</span>}
                  {adminSaveErr && <span className="text-xs font-semibold text-rose-200">{adminSaveErr}</span>}
                </>
              ) : (
                <>
                  <div className="text-xs text-white/70">Code admin requis pour accéder aux paramètres.</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <PasswordInput value={loginCode} onChange={(e) => { setLoginCode(e.target.value); setLoginError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdminUnlock(); } }} placeholder="Code admin" />
                    <div className="sm:col-span-2 flex items-center gap-1.5">
                      <Button className="relative overflow-hidden rounded-xl border border-white/18 bg-[linear-gradient(135deg,rgba(37,99,235,0.85)0%,rgba(14,165,233,0.72)45%,rgba(16,185,129,0.55)100%)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_22px_58px_rgba(14,165,233,0.42)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_76px_rgba(14,165,233,0.5)] focus-visible:ring-2 focus-visible:ring-cyan-300/70" onClick={handleAdminUnlock} disabled={!loginCode || loginCode.trim().length < 4 || verifyAdminCode.isPending}>Entrer</Button>
                      {loginError && (<div className="text-[11px] text-rose-200">{loginError}</div>)}
                    </div>
                  </div>
                  <div className="pt-1.5">
                    <button type="button" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75 underline decoration-white/35 underline-offset-4 transition hover:text-white" onClick={() => { setRecoverOpen(v => !v); setRecoverMsg(""); setRecoverErr(""); setRecoverEmail(""); }}>Recuperer mon code</button>
                    {recoverOpen && (
                      <div className="mt-2.5 space-y-2.5">
                        <div className="flex flex-col gap-1.5 rounded-xl border border-white/14 bg-white/10 p-2.5 shadow-[0_14px_38px_rgba(8,15,40,0.4)] backdrop-blur-xl sm:flex-row sm:items-center">
                          <Input type="email" className="flex-1 border-white/10 bg-white/10 text-white placeholder:text-white/60" placeholder="Votre email de récupération" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} />
                          <Button variant="outline" className="rounded-xl border-white/28 bg-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/22" onClick={() => recoverCodeHook.mutate((recoverEmail || "").trim(), {
                            onSuccess: (d: any) => {
                              setRecoverMsg(d?.emailed ? "Email envoyé" : "Code envoyé");
                              setRecoverErr("");
                            },
                            onError: async (e: any) => {
                              try {
                                const msg = typeof e?.message === 'string' ? e.message : 'Erreur';
                                const p = (() => { try { return JSON.parse(msg); } catch { return null; } })();
                                setRecoverErr(p?.error || msg);
                              } catch {
                                setRecoverErr('Erreur');
                              }
                              setRecoverMsg("");
                            }
                          })} disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((recoverEmail || "").trim())}>Envoyer le code</Button>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                          <Input type="text" className="rounded-xl border-white/10 bg-white/10 text-white placeholder:text-white/60" placeholder="Code reçu par email" value={recoverCode || ""} onChange={(e) => setRecoverCode(e.target.value)} />
                          <PasswordInput placeholder="Nouveau code (min 4)" value={recoverNew || ""} onChange={(e) => setRecoverNew(e.target.value)} className="rounded-xl border-white/10 bg-white/10 text-white placeholder:text-white/60" />
                          <Button className="rounded-xl border-white/18 bg-[linear-gradient(135deg,rgba(244,114,182,0.84)0%,rgba(167,139,250,0.7)50%,rgba(59,130,246,0.64)100%)] px-3 py-1.5 text-xs text-white shadow-[0_20px_50px_rgba(168,85,247,0.42)]" onClick={() => verifyRecoverCode.mutate({
                            email: (recoverEmail || "").trim(),
                            code: (recoverCode || "").trim(),
                            newAdminCode: (recoverNew || "").trim()
                          }, {
                            onSuccess: () => {
                              setRecoverMsg("Code changé, vous êtes connecté");
                              setRecoverErr("");
                              setAdminUnlocked(true);
                              setCurrentPassword("");
                              setPassword("");
                              setLoginCode("");
                            },
                            onError: async (e: any) => {
                              try {
                                const msg = typeof e?.message === 'string' ? e.message : 'Erreur';
                                const p = (() => { try { return JSON.parse(msg); } catch { return null; } })();
                                setRecoverErr(p?.error || msg);
                              } catch {
                                setRecoverErr('Erreur');
                              }
                            }
                          })} disabled={!recoverCode || !recoverNew || (recoverNew || "").trim().length < 4}>Valider</Button>
                        </div>
                      </div>
                    )}
                    {recoverMsg && <div className="mt-2 text-[11px] font-semibold text-emerald-200">{recoverMsg}</div>}
                    {recoverErr && <div className="mt-2 text-[11px] font-semibold text-rose-200">{recoverErr}</div>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </SharedLayout>
    );
  }

  const hasAnyPopupOpen = accordionValue !== "" || bestDaysAccordionValue !== "" || servicesAccordionValue !== "" || 
    openStylistId !== null || coiffCaPopupOpen || dailyCaPopupOpen || yearCaPopupOpen || 
    Object.values(openDaily).some(Boolean) || Object.values(openMonthly).some(Boolean) ||
    isDayUsageVisible || isMonthUsageVisible;

  return (
    <SharedLayout>
      {hasAnyPopupOpen && (
        <div 
          className="fixed inset-0 z-[5]" 
          onClick={closeAllPopups}
          style={{ cursor: 'default' }}
        />
      )}
      <div className="mx-auto max-w-2xl space-y-3 px-3 pb-8 lg:px-0 relative z-10">
        <Card className="relative overflow-hidden rounded-[24px] border border-white/20 bg-black/12 backdrop-blur-md shadow-[0_32px_96px_rgba(8,15,40,0.2)]">
          <CardHeader className="relative z-10 flex flex-col space-y-2 p-4 pb-2.5 text-white">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 shadow-[0_10px_24px_rgba(16,185,129,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)]">🔐 Espace administration</span>
            <CardTitle className="text-2xl font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.5)]">Paramètres du salon</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-2.5 p-4 pt-0 text-slate-100">
            <div className={cn(adminShellClasses, "space-y-2.5")}>
              <button
                type="button"
                onClick={() => {
                  setIsAdminSectionOpen((prev) => {
                    const next = !prev;
                    if (!next) {
                      setRecoverOpen(false);
                      setRecoverMsg("");
                      setRecoverErr("");
                      setRecoverEmail("");
                    }
                    return next;
                  });
                }}
                aria-expanded={isAdminSectionOpen}
                aria-controls="settings-admin-section"
                className={cn(
                  "group relative flex w-full items-center justify-between overflow-hidden rounded-xl border border-white/20 bg-gradient-to-r from-white/10 via-white/5 to-transparent backdrop-blur-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_54px_rgba(79,70,229,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_68px_rgba(79,70,229,0.35)] hover:from-white/15 hover:via-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80",
                  isAdminSectionOpen && "border-emerald-300/50 shadow-[0_26px_70px_rgba(16,185,129,0.3)] from-emerald-500/10 via-emerald-400/5"
                )}
              >
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.42),transparent_58%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative z-10 text-sm font-bold tracking-wide">Création du code admin et récupérer le code admin</span>
                <ChevronDown className={cn("relative z-10 h-4 w-4 transition-transform duration-200", isAdminSectionOpen ? "rotate-180" : "")} />
              </button>
              {isAdminSectionOpen ? (
                <div id="settings-admin-section" className="space-y-1.5">
                  {(!config?.adminEmail) && (
                    <div className="relative overflow-hidden rounded-xl border border-amber-200/45 bg-[linear-gradient(135deg,rgba(253,230,138,0.25)0%,rgba(252,211,77,0.2)45%,rgba(167,139,250,0.25)100%)] px-3 py-2 text-xs font-semibold text-amber-100 shadow-[0_14px_34px_rgba(253,230,138,0.3)]">
                      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.32),transparent_52%)] opacity-80" />
                      <span className="relative z-10">Déverrouillé avec le code par défaut. Merci de personnaliser votre code et d’indiquer un email de récupération.</span>
                    </div>
                  )}
                  <div className="sr-only" aria-hidden="true">
                    <input type="text" name="email" autoComplete="email" tabIndex={-1} />
                    <input type="password" name="password" autoComplete="new-password" tabIndex={-1} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {config?.accountEmail && (
                      <div className="col-span-full mb-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Email de connexion (Compte)</div>
                        <div className="font-mono text-sm text-white/90">{config.accountEmail}</div>
                      </div>
                    )}
                    <PasswordInput name="admin_code_current" autoComplete="off" placeholder={adminCodeAlreadySet ? "Code admin actuel" : "Définir un code admin"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={cn(adminInputClasses, "h-11 px-4 text-base")} />
                    <PasswordInput name="admin_code_new" autoComplete="off" placeholder="Nouveau code admin (min 4)" value={password} onChange={(e) => setPassword(e.target.value)} className={cn(adminInputClasses, "h-11 px-4 text-base")} />
                    <div className="space-y-0.5">
                      <Input key={`admin-email-${adminUnlocked ? '1' : '0'}-${adminSaveMsg ? '1' : '0'}`} type="text" inputMode="email" name={emailFieldName} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={adminEmailRequired ? "Email de récupération (obligatoire)" : "Email de récupération (optionnel)"} value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} readOnly={!emailFocus} onFocus={() => setEmailFocus(true)} className={cn(adminInputClasses, "h-11 px-4 text-base")} />
                      <div className="px-1 text-[10px] text-white/50">
                        {config?.adminEmail ? `Actuel : ${config.adminEmail}` : "Aucun email de récupération défini"}
                      </div>
                      {!adminEmailValid && <span className="text-xs text-destructive">Email invalide</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      className={gradientButtonClasses}
                      onClick={() => {
                        if (!canSaveAdminCode) return;
                        updateAdminCode.mutate({ newCode: newAdminCode, currentCode: currentAdminCode || undefined, email: adminEmailTrimmed || undefined }, {
                          onSuccess: () => { setAdminSaveMsg("Code admin mis à jour"); setAdminSaveErr(""); setCurrentPassword(""); setPassword(""); if (!adminEmailRequired) setAdminEmail(""); },
                          onError: async (e: any) => {
                            try {
                              const msg = typeof e?.message === "string" ? e.message : "Erreur d’enregistrement";
                              const parsed = (() => { try { return JSON.parse(msg); } catch { return null; } })();
                              setAdminSaveErr(parsed?.error || msg);
                            } catch { setAdminSaveErr("Erreur d’enregistrement"); }
                            setAdminSaveMsg("");
                          }
                        });
                      }}
                      disabled={!canSaveAdminCode || updateAdminCode.isPending}
                    >
                      Enregistrer
                    </Button>
                    {adminSaveMsg && <span className="text-xs font-semibold text-emerald-200">{adminSaveMsg}</span>}
                    {adminSaveErr && <span className="text-xs font-semibold text-rose-200">{adminSaveErr}</span>}
                    <button
                      type="button"
                      style={{ textDecoration: "none" }}
                      className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75 transition hover:bg-white/20"
                      onClick={() => { setRecoverOpen((v) => !v); setRecoverMsg(""); setRecoverErr(""); setRecoverEmail(""); }}
                    >
                      Recuperer mon code
                    </button>
                  </div>
                  {recoverOpen && (
                    <div className="space-y-1.5 rounded-xl border border-white/14 bg-white/8 p-2 shadow-[0_14px_32px_rgba(8,15,40,0.38)] backdrop-blur-xl">
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                        <Input type="email" className={cn(inputFieldClasses, "flex-1 border-white/12 bg-white/12")} placeholder="Votre email de récupération" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} />
                        <Button variant="outline" className="rounded-xl border-white/24 bg-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/22" onClick={() => recoverCodeHook.mutate((recoverEmail || "").trim(), {
                          onSuccess: (d: any) => {
                            setRecoverMsg(d?.emailed ? "Email envoyé" : "Code envoyé");
                            setRecoverErr("");
                          },
                          onError: async (e: any) => {
                            try {
                              const msg = typeof e?.message === 'string' ? e.message : 'Erreur';
                              const p = (() => { try { return JSON.parse(msg); } catch { return null; } })();
                              setRecoverErr(p?.error || msg);
                            } catch {
                              setRecoverErr('Erreur');
                            }
                            setRecoverMsg("");
                          }
                        })} disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((recoverEmail || "").trim())}>Recuperer</Button>
                      </div>
                      {recoverMsg && <span className="text-[11px] font-semibold text-emerald-200">{recoverMsg}</span>}
                      {recoverErr && <span className="text-[11px] font-semibold text-rose-200">{recoverErr}</span>}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className={cn(glassPanelClasses, "space-y-2.5 text-xs")}>
              <div className={pillHeadingClasses}>Aperçu des paramètres actuels</div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-y-1.5 gap-x-3 text-sm">

                <dt className="font-semibold text-white/80">Rémunération par défaut</dt>
                <dd className="text-right text-base font-black text-white drop-shadow-[0_10px_25px_rgba(59,130,246,0.45)]">{config?.commissionDefault ?? 50}%</dd>
                <dt className="font-semibold text-white/80">Points à déduire</dt>
                <dd className="text-right text-base font-black text-white drop-shadow-[0_10px_25px_rgba(249,115,22,0.45)]">{config?.pointsRedeemDefault ?? 0} pts</dd>
              </dl>
            </div>

            <div className={cn(glassPanelClasses, "space-y-1.5 text-xs p-2")}>
              <div className="flex items-center justify-between">
                <div className={pillHeadingClasses}>Heure</div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-white/60">{parisClock.timeZone}</div>
              </div>
              <div className="flex items-center gap-3">
                <svg
                  className="h-10 w-10 text-slate-100 drop-shadow-[0_4px_10px_rgba(15,23,42,0.45)]"
                  viewBox="0 0 64 64"
                  role="img"
                  aria-hidden="true"
                >
                  <defs>
                    <radialGradient id="parisClockGradient" cx="50%" cy="36%" r="70%">
                      <stop offset="0%" stopColor="rgba(248,250,252,0.98)" />
                      <stop offset="55%" stopColor="rgba(203,213,225,0.45)" />
                      <stop offset="100%" stopColor="rgba(15,23,42,0.85)" />
                    </radialGradient>
                  </defs>
                  <g>
                    <circle cx="32" cy="32" r="30" fill="url(#parisClockGradient)" stroke="rgba(148,163,184,0.45)" strokeWidth="1.5" />
                    <circle cx="32" cy="32" r="26" fill="rgba(15,23,42,0.3)" stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
                    {hourTickAngles.map((angle) => (
                      <line
                        key={`hour-${angle}`}
                        x1="32"
                        y1="5"
                        x2="32"
                        y2="10"
                        stroke="rgba(248,250,252,0.9)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        transform={`rotate(${angle} 32 32)`}
                      />
                    ))}
                    <line x1="32" y1="32" x2="32" y2="20" stroke="rgba(248,250,252,0.95)" strokeWidth="3" strokeLinecap="round" transform={`rotate(${hourAngle} 32 32)`} />
                    <line x1="32" y1="32" x2="32" y2="14" stroke="rgba(236,241,255,0.9)" strokeWidth="2" strokeLinecap="round" transform={`rotate(${minuteAngle} 32 32)`} />
                    <line x1="32" y1="34" x2="32" y2="9" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" transform={`rotate(${secondAngle} 32 32)`} />
                    <circle cx="32" cy="32" r="2.5" fill="#f87171" stroke="rgba(248,250,252,0.9)" strokeWidth="0.8" />
                  </g>
                </svg>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">{parisClock.time}</span>
                  <span className="text-[10px] text-white/60">{parisClock.label}</span>
                </div>
              </div>
            </div>

            {/* Bouton Réglages de paramètres */}
            <div className={cn(glassPanelClasses, "space-y-0 overflow-hidden p-2 sm:p-3")}>
              <button
                type="button"
                onClick={() => setReglagesPopupOpen(true)}
                className="flex w-full items-center justify-between rounded-xl border-2 border-emerald-400/30 bg-[linear-gradient(135deg,rgba(16,185,129,0.1)0%,rgba(79,70,229,0.08)100%)] backdrop-blur-sm px-4 py-4 text-left text-base font-bold text-emerald-50 shadow-[0_16px_42px_rgba(16,185,129,0.2)] transition-all duration-200 hover:scale-[1.02] hover:border-emerald-300/60 hover:shadow-[0_20px_50px_rgba(16,185,129,0.4)] active:scale-105 active:border-white/80 active:shadow-[0_0_20px_rgba(16,185,129,0.8),0_25px_60px_rgba(16,185,129,0.6)] active:brightness-125"
              >
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-300/30 bg-emerald-500/10 backdrop-blur-sm px-4 py-2 text-sm font-bold uppercase tracking-[0.15em] text-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                  Réglages de paramètres
                </span>
                <ChevronRight className="h-5 w-5 text-emerald-300" />
              </button>
            </div>

            {/* Popup Réglages de paramètres */}
            <AnimatePresence>
              {reglagesPopupOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                  onClick={closeReglagesPopupAndRefresh}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border-2 border-emerald-400/30 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-emerald-900/40 p-5 shadow-[0_25px_60px_rgba(16,185,129,0.3)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white">Réglages de paramètres</h3>
                      <button
                        type="button"
                        onClick={closeReglagesPopupAndRefresh}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Nom du salon */}
                      <div className={cn(inputShellClasses, "flex-col items-start gap-2 border-white/14 bg-slate-950/70")}>
                        <span className="font-semibold text-white/80">Modifier le nom du salon</span>
                        <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                          <Input
                            className={cn(inputFieldClasses, "h-10 w-full bg-slate-950/85 text-base font-semibold text-white caret-emerald-200 placeholder:text-white/65")}
                            type="text"
                            value={salonNameDraft}
                            maxLength={80}
                            onChange={(e) => setSalonNameDraft(e.target.value)}
                          />
                          <Button
                            size="sm"
                            className="h-9 rounded-lg border border-white/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.8)0%,rgba(129,140,248,0.68)50%,rgba(16,185,129,0.55)100%)] px-4 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[0_14px_36px_rgba(59,130,246,0.38)]"
                            disabled={!salonNameDraft.trim() || salonNameDraft.trim() === (config?.salonName ?? "") || updateConfig.isPending}
                            onClick={handleSalonNameSave}
                          >
                            Enregistrer
                          </Button>
                        </div>
                      </div>

                      {/* Rémunération par défaut */}
                      <div className={cn(inputShellClasses, "justify-between border-white/14 bg-slate-950/70")}>
                        <span className="font-semibold text-white/80">Rémunération par défaut (%)</span>
                        <div className="flex items-center gap-1.5">
                          <Input
                            className={cn(inputFieldClasses, "h-10 w-20 bg-slate-950/85 text-base font-semibold text-white caret-emerald-200 placeholder:text-white/65")}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={commissionDefaultStr}
                            onWheelCapture={(e) => e.preventDefault()}
                            onKeyDown={(e) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) e.preventDefault(); }}
                            onChange={(e) => setCommissionDefaultStr(e.target.value.replace(/[^0-9]/g, ""))}
                          />
                          <Button
                            size="sm"
                            className="h-9 rounded-lg border border-white/20 bg-[linear-gradient(135deg,rgba(79,70,229,0.8)0%,rgba(147,197,253,0.62)100%)] px-3 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[0_14px_36px_rgba(79,70,229,0.38)]"
                            onClick={() => {
                              const val = Math.max(0, Math.min(100, Number(commissionDefaultStr) || 0));
                              updateConfig.mutate({ commissionDefault: val }, {
                                onSuccess: () => {
                                  showConfirmPopup("Modification enregistrée", `Rémunération par défaut : ${val}%`);
                                }
                              });
                            }}
                          >
                            OK
                          </Button>
                        </div>
                      </div>

                      {/* Points à déduire */}
                      <div className={cn(inputShellClasses, "justify-between border-white/14 bg-slate-950/70")}>
                        <span className="font-semibold text-white/80">Points à déduire (pts)</span>
                        <div className="flex items-center gap-1.5">
                          <Input
                            className={cn(inputFieldClasses, "h-10 w-24 bg-slate-950/85 text-base font-semibold text-white caret-emerald-200 placeholder:text-white/65")}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={pointsRedeemDefaultStr}
                            onWheelCapture={(e) => e.preventDefault()}
                            onKeyDown={(e) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) e.preventDefault(); }}
                            onChange={(e) => setPointsRedeemDefaultStr(e.target.value.replace(/[^0-9]/g, ""))}
                          />
                          <Button
                            size="sm"
                            className="h-9 rounded-lg border border-white/20 bg-[linear-gradient(135deg,rgba(249,115,22,0.8)0%,rgba(244,114,182,0.62)100%)] px-3 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[0_14px_36px_rgba(249,115,22,0.36)]"
                            onClick={() => {
                              const parsed = Math.max(0, Math.min(1_000_000, Number(pointsRedeemDefaultStr) || 0));
                              setPointsRedeemDefaultStr(String(parsed));
                              updateConfig.mutate({ pointsRedeemDefault: parsed }, {
                                onSuccess: () => {
                                  showConfirmPopup("Modification enregistrée", `Points à déduire : ${parsed} pts`);
                                }
                              });
                            }}
                          >
                            OK
                          </Button>
                        </div>
                      </div>

                      </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bouton Statistiques meilleurs jours */}
            <div className={cn(glassPanelClasses, "space-y-0 overflow-hidden p-2 sm:p-3")}>
              <button
                type="button"
                onClick={() => setStatsPopupOpen(true)}
                className="flex w-full items-center justify-between rounded-xl border-2 border-purple-400/30 bg-[linear-gradient(135deg,rgba(168,85,247,0.1)0%,rgba(79,70,229,0.08)100%)] backdrop-blur-sm px-4 py-4 text-left text-base font-bold text-purple-50 shadow-[0_16px_42px_rgba(168,85,247,0.2)] transition-all duration-200 hover:scale-[1.02] hover:border-purple-300/60 hover:shadow-[0_20px_50px_rgba(168,85,247,0.4)] active:scale-105 active:border-white/80 active:shadow-[0_0_20px_rgba(168,85,247,0.8),0_25px_60px_rgba(168,85,247,0.6)] active:brightness-125"
              >
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-purple-300/30 bg-purple-500/10 backdrop-blur-sm px-4 py-2 text-sm font-bold uppercase tracking-[0.15em] text-purple-100">
                  <span className="h-2 w-2 rounded-full bg-purple-300 animate-pulse" />
                  <TrendingUp className="h-5 w-5" />
                  Statistiques meilleurs jours
                </span>
                <ChevronRight className="h-5 w-5 text-purple-300" />
              </button>
            </div>

            {/* Popup Statistiques meilleurs jours */}
            <AnimatePresence>
              {statsPopupOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                  onClick={closeStatsPopupAndRefresh}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border-2 border-purple-400/30 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-purple-900/40 p-5 shadow-[0_25px_60px_rgba(168,85,247,0.3)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-purple-300" />
                        Statistiques meilleurs jours du mois
                      </h3>
                      <button
                        type="button"
                        onClick={closeStatsPopupAndRefresh}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                      >
                        ✕
                      </button>
                    </div>

                    <BestDaysOfMonth />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>


            <Accordion
              type="single"
              collapsible
              value={accordionValue}
              onValueChange={(val) => {
                const next = val ?? "";
                setAccordionValue(next);
                if (next !== "points-usage") {
                  setHasOpenedDayUsage(false);
                  setIsDayUsageVisible(false);
                  setIsMonthUsageVisible(false);
                }
                if (next !== "coiff-ca") {
                  setOpenStylistId(null);
                  setOpenDaily({});
                  setOpenMonthly({});
                }
                if (next !== "add-stylist") {
                  setManageStylistId("");
                  setManageName("");
                }
              }}
              className="space-y-2.5"
            >
              <AccordionItem value="exports-marketing">
                <div className={cn(glassPanelClasses, "space-y-2.5 ")}>
                  <AccordionTrigger className="flex w-full items-center justify-between rounded-xl border-2 border-indigo-400/30 bg-indigo-500/10 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white shadow-[0_14px_32px_rgba(79,70,229,0.2)] transition-all duration-200 hover:no-underline hover:scale-[1.02] hover:border-indigo-300/60 hover:shadow-[0_20px_50px_rgba(79,70,229,0.4)] active:scale-105 active:border-white/80 active:shadow-[0_0_20px_rgba(79,70,229,0.8),0_25px_60px_rgba(79,70,229,0.6)] active:brightness-125">
                    <span>Exports fichier clients</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 text-sm text-white/80">
                    <ClientsExport />
                  </AccordionContent>
                </div>
              </AccordionItem>
              <AccordionItem value="points-manager">
                <div className={cn(glassPanelClasses, "space-y-2.5 ")}>
                  <AccordionTrigger className="flex w-full items-center justify-between rounded-xl border-2 border-emerald-400/30 bg-emerald-500/10 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white shadow-[0_14px_32px_rgba(16,185,129,0.2)] transition-all duration-200 hover:no-underline hover:scale-[1.02] hover:border-emerald-300/60 hover:shadow-[0_20px_50px_rgba(16,185,129,0.4)] active:scale-105 active:border-white/80 active:shadow-[0_0_20px_rgba(16,185,129,0.8),0_25px_60px_rgba(16,185,129,0.6)] active:brightness-125">
                    <span>Gestion des Points</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 text-sm text-white/80">
                    <PointsManager />
                    <div className="mt-4 pt-4 border-t border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                        </svg>
                        <span className="text-sm font-semibold text-emerald-400">Utilisation des Points</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-white/75">Jour</label>
                            <div className="group relative">
                              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-[#f97316]/35 via-[#fb7185]/25 to-[#6366f1]/20 opacity-60 transition duration-300 group-hover:opacity-90 group-focus-within:opacity-100" />
                              <Input
                                type="date"
                                value={pointsDay}
                                max={todayParis}
                                className="relative z-10 h-9 rounded-lg border border-transparent bg-slate-950/70 pl-9 pr-3 text-xs font-semibold tracking-wide text-slate-100 shadow-[0_12px_28px_rgba(249,115,22,0.22)] transition focus-visible:ring focus-visible:ring-[#f97316]/80 focus-visible:ring-offset-0"
                                onClick={() => {
                                  setHasOpenedDayUsage(true);
                                  setIsMonthUsageVisible(false);
                                  setIsDayUsageVisible(prev => !prev);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setHasOpenedDayUsage(true);
                                    setIsMonthUsageVisible(false);
                                    setIsDayUsageVisible(prev => !prev);
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    setIsDayUsageVisible(false);
                                  }
                                }}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value && value !== pointsDay) {
                                    setPointsDay(value);
                                    setHasOpenedDayUsage(true);
                                    setIsDayUsageVisible(true);
                                    setIsMonthUsageVisible(false);
                                  }
                                }}
                              />
                              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white drop-shadow-[0_6px_16px_rgba(255,255,255,0.6)]" />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{selectedDayLabel}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-white/75">Mois</label>
                            <div className="group relative">
                              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-[#7c6dff]/35 via-[#4f46e5]/25 to-[#06b6d4]/25 opacity-60 transition duration-300 group-hover:opacity-90 group-focus-within:opacity-100" />
                              <Input
                                type="month"
                                value={pointsMonth}
                                max={currentParisMonth}
                                className="relative z-10 h-9 rounded-lg border border-transparent bg-slate-950/70 pl-9 pr-3 text-xs font-semibold tracking-wide text-slate-100 shadow-[0_12px_28px_rgba(79,70,229,0.22)] transition outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                                onClick={() => {
                                  if (isMonthUsageVisible) {
                                    setHasOpenedDayUsage(false);
                                    setIsDayUsageVisible(false);
                                    setIsMonthUsageVisible(false);
                                  } else {
                                    setHasOpenedDayUsage(false);
                                    setIsDayUsageVisible(false);
                                    setIsMonthUsageVisible(true);
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    if (isMonthUsageVisible) {
                                      setHasOpenedDayUsage(false);
                                      setIsDayUsageVisible(false);
                                      setIsMonthUsageVisible(false);
                                    } else {
                                      setHasOpenedDayUsage(false);
                                      setIsDayUsageVisible(false);
                                      setIsMonthUsageVisible(true);
                                    }
                                  }
                                }}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value) {
                                    setPointsMonth(value);
                                    setHasOpenedDayUsage(false);
                                    setIsDayUsageVisible(false);
                                    setIsMonthUsageVisible(true);
                                  }
                                }}
                              />
                              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 text-white drop-shadow-[0_6px_16px_rgba(255,255,255,0.6)]" />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{selectedMonthLabel}</p>
                          </div>
                        </div>
                        {pointsUsageLoading && (
                          <p className="text-[10px] text-muted-foreground">Chargement des données…</p>
                        )}
                        {!pointsUsageLoading && pointsUsageError && (
                          <p className="text-[10px] text-destructive">
                            Impossible de récupérer les utilisations de points.
                          </p>
                        )}
                        {!pointsUsageLoading && !pointsUsageError && (
                          <>
                            <div
                              className={cn(
                                "overflow-hidden transition-all duration-300 ease-out",
                                hasOpenedDayUsage
                                  ? isDayUsageVisible
                                    ? "max-h-[480px] opacity-100"
                                    : "max-h-0 opacity-0"
                                  : "max-h-0 opacity-0"
                              )}
                            >
                              {hasOpenedDayUsage && (
                                <div className={cn("pt-2", !isDayUsageVisible && "pointer-events-none")}>
                                  <PointsUsageScopeSection
                                    title={daySectionTitle}
                                    emptyLabel={dayEmptyLabel}
                                    groups={pointsUsage?.daily ?? []}
                                    variant="month"
                                  />
                                </div>
                              )}
                            </div>
                            <div
                              className={cn(
                                "overflow-hidden transition-all duration-300 ease-out",
                                isMonthUsageVisible ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0"
                              )}
                            >
                              {isMonthUsageVisible && (
                                <div className="pt-2">
                                  <PointsUsageScopeSection
                                    title={monthSectionTitle}
                                    emptyLabel={monthEmptyLabel}
                                    groups={pointsUsage?.monthly ?? []}
                                    variant="month"
                                  />
                                </div>
                              )}
                            </div>
                            {pointsUsage?.generatedAt ? (
                              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                                Actualisé le {new Date(pointsUsage.generatedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </div>
              </AccordionItem>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setCoiffCaPopupOpen(true)}
                  className="group relative flex flex-col items-center justify-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl border-2 border-amber-400/60 bg-transparent px-1.5 py-2.5 sm:px-3 sm:py-4 transition-all duration-300 hover:scale-[1.05] hover:border-amber-300 hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] active:scale-[1.18] active:rotate-2 active:border-yellow-200 active:bg-amber-400/20 active:shadow-[0_0_60px_rgba(255,200,50,1),0_0_120px_rgba(255,180,30,1),0_0_180px_rgba(245,158,11,0.8),0_0_250px_rgba(245,158,11,0.6),0_0_350px_rgba(245,158,11,0.4)] active:brightness-[3]"
                >
                  <svg className="h-5 w-5 sm:h-7 sm:w-7 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <span className="text-[10px] sm:text-sm font-bold text-amber-400">CA Coiffeur</span>
                  <span className="text-[8px] sm:text-[10px] text-white/60 hidden sm:block">Chiffre d'affaires</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDailyCaPopupOpen(true)}
                  className="group relative flex flex-col items-center justify-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl border-2 border-amber-400/60 bg-transparent px-1.5 py-2.5 sm:px-3 sm:py-4 transition-all duration-300 hover:scale-[1.05] hover:border-amber-300 hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] active:scale-[1.18] active:rotate-2 active:border-yellow-200 active:bg-amber-400/20 active:shadow-[0_0_60px_rgba(255,200,50,1),0_0_120px_rgba(255,180,30,1),0_0_180px_rgba(245,158,11,0.8),0_0_250px_rgba(245,158,11,0.6),0_0_350px_rgba(245,158,11,0.4)] active:brightness-[3]"
                >
                  <svg className="h-5 w-5 sm:h-7 sm:w-7 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                  <span className="text-[10px] sm:text-sm font-bold text-amber-400">CA Salon</span>
                  <span className="text-[8px] sm:text-[10px] text-white/60 hidden sm:block">Aujourd'hui</span>
                </button>

                <button
                  type="button"
                  onClick={() => setYearCaPopupOpen(true)}
                  className="group relative flex flex-col items-center justify-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl border-2 border-amber-400/60 bg-transparent px-1.5 py-2.5 sm:px-3 sm:py-4 transition-all duration-300 hover:scale-[1.05] hover:border-amber-300 hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] active:scale-[1.18] active:rotate-2 active:border-yellow-200 active:bg-amber-400/20 active:shadow-[0_0_60px_rgba(255,200,50,1),0_0_120px_rgba(255,180,30,1),0_0_180px_rgba(245,158,11,0.8),0_0_250px_rgba(245,158,11,0.6),0_0_350px_rgba(245,158,11,0.4)] active:brightness-[3]"
                >
                  <svg className="h-5 w-5 sm:h-7 sm:w-7 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                  <span className="text-[10px] sm:text-sm font-bold text-amber-400">CA Année</span>
                  <span className="text-[8px] sm:text-[10px] text-white/60 hidden sm:block">Cette année</span>
                </button>
              </div>
              <AnimatePresence>
                {coiffCaPopupOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    onClick={() => setCoiffCaPopupOpen(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="w-[calc(100%-2rem)] max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/50 backdrop-blur-md p-4 shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center mb-4 relative">
                        <span className="text-2xl font-black uppercase tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">Chiffre d'affaires coiffeur</span>
                        <button
                          type="button"
                          onClick={() => setCoiffCaPopupOpen(false)}
                          className="absolute right-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {stylists?.map((s, idx) => {
                          const stylistCommissionPct = typeof (s as any).commissionPct === "number" ? (s as any).commissionPct : (config?.commissionDefault ?? 0);
                          const colorSchemes = [
                            { outer: "conic-gradient(from 160deg, #CAFF58, #74FF9C, #16C772, #CAFF58)", inner: "linear-gradient(140deg, #D9FF96 0%, #7DFFAF 60%, #1FAA7C 100%)", glow: "0 12px 30px rgba(116,255,156,0.45)", rgb: "116,255,156" },
                            { outer: "conic-gradient(from 160deg, #FFD27A, #FF8A4C, #FF5A39, #FFD27A)", inner: "linear-gradient(140deg, #FFE0A1 0%, #FF9C5C 60%, #F1472A 100%)", glow: "0 12px 30px rgba(255,138,76,0.45)", rgb: "255,138,76" },
                            { outer: "conic-gradient(from 160deg, #FF9BFF, #F55BC2, #C027BA, #FF9BFF)", inner: "linear-gradient(140deg, #FFB6FF 0%, #F872D7 60%, #C63CC7 100%)", glow: "0 12px 30px rgba(245,91,194,0.45)", rgb: "245,91,194" },
                            { outer: "conic-gradient(from 160deg, #9DF3FF, #52C7FF, #2B7FFF, #9DF3FF)", inner: "linear-gradient(140deg, #BFF6FF 0%, #63DAFF 60%, #318EFF 100%)", glow: "0 12px 30px rgba(82,199,255,0.45)", rgb: "82,199,255" },
                          ];
                          const colors = colorSchemes[idx % colorSchemes.length];
                          return (
                            <Popover key={s.id} open={openStylistId === s.id} onOpenChange={(open) => {
                                if (!open) {
                                  setOpenStylistId(null);
                                }
                              }}>
                              <PopoverTrigger asChild>
                                <button
                                  className="group relative flex h-24 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[16px] border border-white/25 backdrop-blur-[26px] transition-all duration-200 hover:scale-[1.03] active:scale-105 active:brightness-110"
                                  style={{ background: "linear-gradient(160deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)", boxShadow: "0 24px 45px -20px rgba(15,23,42,0.65)" }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpenStylistId(s.id);
                                  }}
                                >
                                  <div className="absolute inset-x-4 top-1 h-6 rounded-full opacity-70" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))" }} />
                                  <div
                                    className="relative flex h-[48px] w-[48px] items-center justify-center rounded-full"
                                    style={{ background: colors.outer, boxShadow: colors.glow }}
                                  >
                                    <div
                                      className="absolute inset-[3px] rounded-full"
                                      style={{ background: "radial-gradient(circle, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.78) 60%, rgba(15,23,42,0.55) 100%)", boxShadow: "inset 0 8px 20px rgba(255,255,255,0.08), inset 0 -14px 24px rgba(2,6,23,0.82)" }}
                                    />
                                    <div
                                      className="relative h-7 w-7 rounded-[8px] overflow-hidden"
                                      style={{ background: colors.inner, boxShadow: `0 8px 20px rgba(${colors.rgb},0.4), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -6px 10px rgba(15,23,42,0.55)` }}
                                    >
                                      <img src="/barber-face.jpg" alt="" className="absolute inset-0.5 h-[calc(100%-4px)] w-[calc(100%-4px)] object-contain mix-blend-multiply" />
                                      <div className="absolute inset-x-0.5 top-0.5 h-1/2 rounded-t-[6px] opacity-80" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0))" }} />
                                    </div>
                                  </div>
                                  <span className="relative z-10 text-sm font-black uppercase tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{s.name}</span>
                                  <span className="relative z-10 text-[10px] font-light text-white/90">{stylistCommissionPct}%</span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto rounded-xl border border-white/14 bg-slate-900/95 backdrop-blur-xl p-3 space-y-2.5 shadow-[0_20px_50px_rgba(8,15,40,0.6)]" align="center" sideOffset={8}>
                                <StylistTotals id={s.id} commissionPct={stylistCommissionPct} stylistName={s.name} />
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                  <a className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/12 px-2 py-0.5 font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/18" href={"/api" + apiPath(`/reports/stylists/${s.id}.csv`)}>CSV</a>
                                  <a className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/12 px-2 py-0.5 font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/18" href={"/api" + apiPath(`/reports/stylists/${s.id}.pdf`)}>PDF</a>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-white/70 pt-1">
                                  <span className="text-white/75">Rémunération:</span>
                                  <span className="text-sm font-semibold text-white">{String(stylistCommissionPct)}%</span>
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              
              <AnimatePresence>
                {dailyCaPopupOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    onClick={() => setDailyCaPopupOpen(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="w-[calc(100%-2rem)] max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/50 backdrop-blur-md p-4 shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-lg font-bold text-white">Chiffre d'affaires (jour)</span>
                        <button
                          type="button"
                          onClick={() => setDailyCaPopupOpen(false)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-white/80">
                        <GlobalRevenueStats />
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {yearCaPopupOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    onClick={() => setYearCaPopupOpen(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/50 backdrop-blur-md p-4 shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-lg font-bold text-white">Chiffre d'affaires (année)</span>
                        <button
                          type="button"
                          onClick={() => setYearCaPopupOpen(false)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-white/80">
                        <RevenueByMonth />
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <ServicesManager
                accordionValue={servicesAccordionValue}
                onAccordionChange={setServicesAccordionValue}
                onCloseParent={() => setAccordionValue("")}
                onOpenCoiffeur={() => setCoiffeurPopupOpen(true)}
                isCoiffeurOpen={coiffeurPopupOpen}
                onCloseCoiffeur={closeCoiffeurPopupAndRefresh}
                onOpenAcompte={() => setAcomptePopupOpen(true)}
                isAcompteOpen={acomptePopupOpen}
                onCloseAcompte={closeAcomptePopupAndRefresh}
              />

              {/* Popup Coiffeurs */}
              <AnimatePresence>
                {coiffeurPopupOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={closeCoiffeurPopupAndRefresh}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-violet-500/30 bg-gradient-to-br from-slate-900/98 via-violet-900/40 to-slate-800/98 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)] backdrop-blur-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white">Gestion des coiffeurs</h3>
                        <button
                          type="button"
                          onClick={closeCoiffeurPopupAndRefresh}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="space-y-5">
                        {/* Ajouter un coiffeur */}
                        <div className="space-y-3">
                          <div className="text-sm font-semibold text-violet-300">Ajouter un coiffeur</div>
                          <div className="flex flex-wrap gap-3">
                            <div className="flex-1 min-w-[10rem]">
                              <Input
                                placeholder="Nom du coiffeur"
                                value={stylistName}
                                onChange={(e) => setStylistName(e.target.value)}
                                className={cn(inputFieldClasses, "h-12 w-full bg-slate-950/70 px-4 text-base font-semibold text-white caret-emerald-200 placeholder:text-white/60")}
                              />
                            </div>
                            <Select
                              value={commissionPct || undefined}
                              onValueChange={(value) => setCommissionPct(value)}
                            >
                              <SelectTrigger className={cn(selectTriggerClasses, "h-12 max-w-[6.5rem] bg-slate-950/70 px-3.5 text-sm font-semibold text-white uppercase tracking-wide")}>
                                <SelectValue placeholder="%" />
                              </SelectTrigger>
                              <SelectContent className="w-[6.5rem] max-h-48 overflow-y-auto rounded-xl border border-emerald-300/50 bg-slate-950/95 text-slate-100">
                                {STYLIST_COMMISSION_CHOICES.map((choice) => (
                                  <SelectItem key={choice} value={String(choice)}>
                                    {choice} %
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn(addStylistButtonClasses, "h-12")}
                              disabled={!stylistName.trim() || !commissionPct}
                              aria-label="Ajouter un coiffeur"
                              onClick={() => {
                                const trimmed = stylistName.trim();
                                if (!trimmed || !commissionPct) return;
                                const pctValue = Math.max(0, Math.min(60, Number(commissionPct) || 0));
                                addStylist.mutate({ name: trimmed, commissionPct: pctValue }, {
                                  onSuccess: () => {
                                    setStylistName("");
                                    setCommissionPct("");
                                    showConfirmPopup("Coiffeur ajouté", `${trimmed} (${pctValue}%)`, "violet");
                                  },
                                });
                              }}
                            >
                              Ajouter
                            </Button>
                          </div>
                        </div>
                        
                        <div className="h-px bg-white/20" />
                        
                        {/* Gérer un coiffeur */}
                        <div className="space-y-3">
                          <div className="text-sm font-semibold text-violet-300">Gérer un coiffeur</div>
                          <div className="space-y-3">
                            <select
                              className={cn(
                                "h-12 w-full rounded-2xl border px-4 text-base font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70",
                                manageStylistId
                                  ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-100 shadow-[0_14px_34px_rgba(16,185,129,0.3)]"
                                  : "border-white/18 bg-slate-950/70 text-white",
                                "[&>option]:bg-slate-900 [&>option]:text-white"
                              )}
                              value={manageStylistId}
                              onChange={(e) => setManageStylistId(e.target.value)}
                            >
                              <option value="" className="bg-slate-900 text-white">Sélectionner un coiffeur</option>
                              {stylists?.map((s) => (
                                <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
                              ))}
                            </select>
                            
                            {manageStylistId && (
                              <>
                                <Input
                                  className={cn(inputFieldClasses, "h-12 w-full bg-slate-950/70 text-base font-semibold text-white caret-emerald-200 placeholder:text-white/60")}
                                  placeholder="Nouveau nom"
                                  value={manageName}
                                  onChange={(e) => setManageName(e.target.value)}
                                />
                                <div className="flex gap-3">
                                  <Button
                                    className={cn(gradientButtonClasses, "flex-1 h-12")}
                                    disabled={!manageName.trim()}
                                    onClick={() => {
                                      const trimmedName = manageName.trim();
                                      if (!trimmedName) return;
                                      updateStylist.mutate({ id: manageStylistId, name: trimmedName }, {
                                        onSuccess: () => {
                                          setManageStylistId("");
                                          setManageName("");
                                          showConfirmPopup("Coiffeur modifié", trimmedName, "violet");
                                        }
                                      });
                                    }}
                                  >
                                    Enregistrer
                                  </Button>
                                  <Button
                                    className="h-12 flex-1 rounded-2xl border border-white/25 bg-[linear-gradient(135deg,rgba(239,68,68,0.82)0%,rgba(250,204,21,0.62)100%)] text-sm font-semibold uppercase tracking-wide text-white shadow-[0_20px_52px_rgba(239,68,68,0.38)]"
                                    onClick={() => {
                                      const s = stylists?.find(st => st.id === manageStylistId);
                                      if (!s) return;
                                      if (!confirm(`Supprimer ${s.name} ?`)) return;
                                      if (!confirm("Confirmer la suppression ?")) return;
                                      delStylist.mutate(manageStylistId, { onSuccess: () => { setManageStylistId(""); setManageName(""); setManageSecretCode(""); } });
                                    }}
                                  >
                                    Supprimer
                                  </Button>
                                </div>
                                
                                <div className="h-px bg-white/15 my-2" />
                                
                                <div className="text-xs font-medium text-white/60 mb-2">Code d'accès</div>
                                <div className="flex gap-3">
                                  <Input
                                    className={cn(inputFieldClasses, "flex-1 h-12 bg-slate-950/70 text-base font-semibold text-white caret-emerald-200 placeholder:text-white/60")}
                                    placeholder="Code d'accès"
                                    type="password"
                                    value={manageSecretCode}
                                    onChange={(e) => setManageSecretCode(e.target.value)}
                                  />
                                  <Button
                                    className={cn(gradientButtonClasses, "h-12 px-6")}
                                    disabled={setStylistSecretCode.isPending}
                                    onClick={() => {
                                      setStylistSecretCode.mutate({ stylistId: manageStylistId, secretCode: manageSecretCode.trim() }, {
                                        onSuccess: (data) => {
                                          setManageSecretCode("");
                                          showConfirmPopup("Code mis à jour", data.hasCode ? "Code d'accès défini" : "Code d'accès supprimé", "violet");
                                        },
                                        onError: () => {
                                          toast({ title: "Erreur", description: "Impossible de modifier le code", variant: "destructive" });
                                        }
                                      });
                                    }}
                                  >
                                    {manageSecretCode.trim() ? "Définir" : "Supprimer"}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Popup Acompte Coiffeur */}
              <AnimatePresence>
                {acomptePopupOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={closeAcomptePopupAndRefresh}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900/98 via-emerald-900/40 to-slate-800/98 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(16,185,129,0.2)] backdrop-blur-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white">Acompte coiffeur</h3>
                        <button
                          type="button"
                          onClick={closeAcomptePopupAndRefresh}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {stylists && stylists.length > 0 ? (
                          stylists.map((s) => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setSelectedStylistForDeposit(s);
                                setDepositAmount("");
                              }}
                              className="rounded-2xl border border-emerald-400/30 bg-slate-800/50 p-4 transition-all hover:border-emerald-400/60 hover:bg-slate-700/50 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                                    <span className="text-lg font-bold text-white">{s.name.charAt(0).toUpperCase()}</span>
                                  </div>
                                  <span className="text-lg font-semibold text-white">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <div className="text-sm text-white/60">Commission</div>
                                    <div className="text-lg font-bold text-emerald-400">{s.commissionPct}%</div>
                                  </div>
                                  <div className="text-right min-w-[70px]">
                                    <div className="text-sm text-white/60">Acompte</div>
                                    <div className="text-lg font-bold text-violet-400">
                                      {eur.format(depositTotalsByStylist[s.id] || 0)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-white/60">
                            Aucun coiffeur disponible
                          </div>
                        )}
                      </div>
                      
                      {/* Sous-popup saisie acompte */}
                      <AnimatePresence>
                        {selectedStylistForDeposit && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                            onClick={() => setSelectedStylistForDeposit(null)}
                          >
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                              className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900/98 via-emerald-900/40 to-slate-800/98 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(16,185,129,0.2)] backdrop-blur-xl"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                                    <span className="text-xl font-bold text-white">{selectedStylistForDeposit.name.charAt(0).toUpperCase()}</span>
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-bold text-white">{selectedStylistForDeposit.name}</h3>
                                    <p className="text-sm text-white/60">Ajouter un acompte</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedStylistForDeposit(null)}
                                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                                >
                                  ✕
                                </button>
                              </div>
                              
                              {/* Affichage du mois en cours */}
                              <div className="mb-4 text-center">
                                <span className="text-lg font-bold text-emerald-400">
                                  {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase())}
                                </span>
                              </div>
                              
                              {/* Champ montant */}
                              <div className="mb-6">
                                <label className="block text-base font-semibold text-white/90 mb-3">Montant</label>
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={depositAmount}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                                      setDepositAmount(val);
                                    }}
                                    style={{ fontSize: '3.5rem', lineHeight: '1' }}
                                    className="h-28 w-full rounded-2xl border-2 border-emerald-400/40 bg-slate-800/80 pl-6 pr-20 font-black text-red-500 text-center placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/60"
                                  />
                                  <span className="absolute right-6 text-4xl font-black text-red-500">€</span>
                                </div>
                              </div>
                              
                              {/* Boutons */}
                              <div className="flex gap-3">
                                <Button
                                  onClick={() => {
                                    const amount = parseFloat(depositAmount);
                                    if (!amount || amount <= 0) {
                                      toast({ title: "Erreur", description: "Montant invalide", variant: "destructive" });
                                      return;
                                    }
                                    addStylistDeposit.mutate({
                                      stylistId: selectedStylistForDeposit.id,
                                      amount,
                                      month: depositMonth,
                                    }, {
                                      onSuccess: () => {
                                        showConfirmPopup("Acompte ajouté", `${amount.toFixed(2)} €`, "emerald");
                                        setDepositAmount("");
                                        setSelectedStylistForDeposit(null);
                                        queryClient.invalidateQueries({ queryKey: ['all-deposits-month'] });
                                      },
                                      onError: () => {
                                        toast({ title: "Erreur", description: "Impossible d'ajouter l'acompte", variant: "destructive" });
                                      }
                                    });
                                  }}
                                  disabled={addStylistDeposit.isPending || !depositAmount}
                                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-bold text-white shadow-lg hover:shadow-emerald-500/30"
                                >
                                  Enregistrer
                                </Button>
                                <Button
                                  onClick={() => setDepositDetailsOpen(true)}
                                  className="h-12 rounded-xl border border-white/20 bg-white/10 font-bold text-white hover:bg-white/20"
                                >
                                  <List className="h-5 w-5 mr-2" />
                                  Détails
                                </Button>
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {/* Sous-popup détails acomptes */}
                      <AnimatePresence>
                        {depositDetailsOpen && selectedStylistForDeposit && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                            onClick={() => setDepositDetailsOpen(false)}
                          >
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                              className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-violet-500/30 bg-gradient-to-br from-slate-900/98 via-violet-900/40 to-slate-800/98 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.2)] backdrop-blur-xl"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between mb-6">
                                <div>
                                  <h3 className="text-lg font-bold text-white">Détail acomptes</h3>
                                  <p className="text-sm text-white/60">{selectedStylistForDeposit.name}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDepositDetailsOpen(false)}
                                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                                >
                                  ✕
                                </button>
                              </div>
                              
                              {/* Filtre mois/année */}
                              <div className="mb-4">
                                <MonthYearPicker 
                                  value={depositMonth} 
                                  onChange={setDepositMonth} 
                                  variant="violet" 
                                />
                              </div>
                              
                              {/* Liste des acomptes */}
                              <div className="space-y-3">
                                {stylistDeposits && stylistDeposits.length > 0 ? (
                                  <>
                                    <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-violet-500/20 border border-violet-400/30">
                                      <span className="text-sm font-medium text-white/80">Total</span>
                                      <span className="text-lg font-bold text-violet-300">
                                        {eur.format(stylistDeposits.reduce((sum, d) => sum + d.amount, 0))}
                                      </span>
                                    </div>
                                    {stylistDeposits.map((deposit) => (
                                      <div
                                        key={deposit.id}
                                        className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-800/50 p-3"
                                      >
                                        <div>
                                          <div className="text-base font-bold text-white">{eur.format(deposit.amount)}</div>
                                          <div className="text-xs text-white/50">
                                            {new Date(deposit.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => {
                                            if (!confirm("Supprimer cet acompte ?")) return;
                                            deleteStylistDeposit.mutate(deposit.id, {
                                              onSuccess: () => {
                                                refetchDeposits();
                                                showConfirmPopup("Acompte supprimé", "", "violet");
                                              }
                                            });
                                          }}
                                          className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400/30 bg-red-500/20 text-red-300 transition hover:bg-red-500/40"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <div className="text-center py-8 text-white/60">
                                    Aucun acompte pour ce mois
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Popup de confirmation 3D centré */}
      <AnimatePresence>
        {confirmPopup.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -30 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={cn(
                "relative flex flex-col items-center gap-4 rounded-3xl border-2 px-10 py-8 backdrop-blur-xl",
                confirmPopup.variant === "violet"
                  ? "border-violet-400/50 bg-gradient-to-br from-violet-900/95 via-fuchsia-800/90 to-cyan-900/95 shadow-[0_0_80px_rgba(139,92,246,0.6),0_0_120px_rgba(236,72,153,0.4),0_40px_100px_rgba(0,0,0,0.5)]"
                  : "border-emerald-400/50 bg-gradient-to-br from-emerald-900/95 via-teal-800/90 to-cyan-900/95 shadow-[0_0_80px_rgba(16,185,129,0.6),0_0_120px_rgba(20,184,166,0.4),0_40px_100px_rgba(0,0,0,0.5)]"
              )}
            >
              {/* Reflet glass 3D */}
              <div className="absolute inset-x-4 top-2 h-[35%] rounded-t-2xl bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
              
              {/* Icône de validation 3D multi-anneaux */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                className="relative flex h-20 w-20 items-center justify-center"
              >
                {/* Anneau externe - glow */}
                <div className={cn(
                  "absolute inset-0 rounded-full",
                  confirmPopup.variant === "violet"
                    ? "bg-gradient-to-br from-violet-400 via-fuchsia-500 to-cyan-500 shadow-[0_0_40px_rgba(139,92,246,0.8)]"
                    : "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 shadow-[0_0_40px_rgba(16,185,129,0.8)]"
                )} />
                {/* Anneau du milieu */}
                <div className="absolute inset-[4px] rounded-full bg-gradient-to-br from-white/90 via-gray-100/80 to-white/70" />
                {/* Centre avec checkmark */}
                <div className={cn(
                  "absolute inset-[8px] rounded-full flex items-center justify-center shadow-[inset_0_4px_8px_rgba(255,255,255,0.4),inset_0_-4px_8px_rgba(0,0,0,0.2)]",
                  confirmPopup.variant === "violet"
                    ? "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-600"
                    : "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600"
                )}>
                  <div className="absolute inset-x-2 top-2 h-[40%] rounded-t-full bg-gradient-to-b from-white/50 to-transparent" />
                  <Check className="h-10 w-10 text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)]" />
                </div>
              </motion.div>

              {/* Titre */}
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-black uppercase tracking-wide text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
              >
                {confirmPopup.title}
              </motion.h3>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "text-lg font-semibold",
                  confirmPopup.variant === "violet" ? "text-violet-100/90" : "text-emerald-100/90"
                )}
              >
                {confirmPopup.description}
              </motion.p>

              {/* Particules sparkle */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: 1 }}
                className="absolute -top-2 -right-2 text-2xl"
              >
                ✨
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, delay: 0.3, repeat: 1 }}
                className="absolute -bottom-2 -left-2 text-2xl"
              >
                ✨
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SharedLayout>
  );
}
