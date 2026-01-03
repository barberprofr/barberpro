import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, ChevronDown, CircleDollarSign, CreditCard, FileText, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAddClient, useAddProduct, useClients, useStylists } from "@/lib/api";


const PHONE_DIGITS_REQUIRED = 10;
const PAYMENT_OPTIONS: { value: "cash" | "check" | "card"; label: string; icon: LucideIcon }[] = [
  { value: "cash", label: "Espèces", icon: CircleDollarSign },
  { value: "check", label: "Planity/Treatwell", icon: FileText },
  { value: "card", label: "Carte", icon: CreditCard },
];

interface ProductFormSectionProps {
  onSuccess?: () => void;
}

export default function ProductFormSection({ onSuccess }: ProductFormSectionProps) {
  const { data: stylists, isLoading: stylistsLoading } = useStylists();
  const qc = useQueryClient();
  const { data: clients } = useClients();
  const addProduct = useAddProduct();
  const addClient = useAddClient();
  const { toast } = useToast();

  const [stylistId, setStylistId] = useState<string>("");
  const [stylistPickerOpen, setStylistPickerOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [amountConfirmed, setAmountConfirmed] = useState(false);
  const [payment, setPayment] = useState<string>("");
  const [paymentSelected, setPaymentSelected] = useState(false);
  const [paymentPopoverOpen, setPaymentPopoverOpen] = useState(false);
  const [when, setWhen] = useState<string>("");
  const [newClientAccordionOpen, setNewClientAccordionOpen] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState<string>("");
  const [newClientName, setNewClientName] = useState<string>("");

  const [newClientPhone, setNewClientPhone] = useState<string>("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clientAccordion, setClientAccordion] = useState<string>("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const autoSubmitTimeoutRef = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  const sanitizedNewClientFirstName = useMemo(() => {
    if (!newClientFirstName) return "";
    return newClientFirstName.normalize("NFC").replace(/[^\p{L} \-']/gu, "").trim();
  }, [newClientFirstName]);
  const sanitizedNewClientLastName = useMemo(() => {
    if (!newClientName) return "";
    return newClientName.normalize("NFC").replace(/[^\p{L} \-']/gu, "").trim();
  }, [newClientName]);
  const sanitizedNewClientName = useMemo(() => {
    return [sanitizedNewClientFirstName, sanitizedNewClientLastName].filter(Boolean).join(" ").trim();
  }, [sanitizedNewClientFirstName, sanitizedNewClientLastName]);

  const sanitizedNewClientPhone = useMemo(() => {
    if (!newClientPhone) return "";
    return newClientPhone.normalize("NFC").replace(/[^+\d().\-\s]/g, "").trim();
  }, [newClientPhone]);
  const sanitizedNewClientPhoneDigits = useMemo(
    () => sanitizedNewClientPhone.replace(/\D/g, ""),
    [sanitizedNewClientPhone]
  );
  const usingNewClient = useMemo(() => {
    if (clientId) return false;
    return Boolean(sanitizedNewClientFirstName || sanitizedNewClientLastName || sanitizedNewClientPhone);
  }, [clientId, sanitizedNewClientFirstName, sanitizedNewClientLastName, sanitizedNewClientPhone]);
  const newClientFormComplete = useMemo(() => {
    if (!usingNewClient) return false;
    return Boolean(sanitizedNewClientFirstName && sanitizedNewClientLastName && sanitizedNewClientPhone && sanitizedNewClientPhoneDigits.length === PHONE_DIGITS_REQUIRED);
  }, [usingNewClient, sanitizedNewClientFirstName, sanitizedNewClientLastName, sanitizedNewClientPhone, sanitizedNewClientPhoneDigits]);
  const newClientFormValid = useMemo(() => {
    if (!usingNewClient) return true;
    if (!newClientFormComplete) return false;
    if (sanitizedNewClientPhoneDigits.length !== PHONE_DIGITS_REQUIRED) return false;
    return true;
  }, [newClientFormComplete, sanitizedNewClientPhoneDigits, usingNewClient]);
  const selectedStylist = useMemo(() => stylists?.find((s) => s.id === stylistId) ?? null, [stylists, stylistId]);
  const paymentOption = useMemo(() => PAYMENT_OPTIONS.find((opt) => opt.value === payment), [payment]);
  const paymentLabel = paymentOption?.label ?? "Carte";
  const PaymentIcon = paymentOption?.icon ?? null;
  const selectedClient = useMemo(() => clients?.find(c => c.id === clientId), [clients, clientId]);
  const hasClientSelection = useMemo(() => Boolean(selectedClient || (usingNewClient && newClientFormComplete)), [newClientFormComplete, selectedClient, usingNewClient]);
  const selectionContainerClass = useMemo(() => ("rounded-3xl border border-white/12 bg-gradient-to-br from-slate-950/85 via-indigo-900/55 to-emerald-800/35 px-4 py-3 space-y-3 shadow-[0_22px_55px_rgba(8,15,40,0.5)] backdrop-blur-xl"), []);

  useEffect(() => {
    if (debounceTimeoutRef.current) window.clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = window.setTimeout(() => {
      setDebouncedClientSearch(clientSearch);
    }, 150);
    return () => {
      if (debounceTimeoutRef.current) window.clearTimeout(debounceTimeoutRef.current);
    };
  }, [clientSearch]);

  const filteredClients = useMemo(() => {
    const term = debouncedClientSearch.trim().toLowerCase();
    if (!term) return [];
    return (clients ?? []).filter((c) => {
      const haystack = [c.name, c.phone ?? ""].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [debouncedClientSearch, clients]);

  const parisNowIsoLocal = useCallback(() => {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find(p => p.type === t)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  }, []);

  useEffect(() => {
    if (!when) setWhen(parisNowIsoLocal());
  }, [when, parisNowIsoLocal]);

  const canSubmit = useMemo(() => {
    if (!(stylistId && amount && Number(amount) > 0 && paymentSelected && when)) {
      return false;
    }
    return newClientFormValid;
  }, [amount, newClientFormValid, paymentSelected, stylistId, when]);

  useEffect(() => {
    if (paymentSelected && canSubmit && !addProduct.isPending && !addClient.isPending) {
      if (autoSubmitTimeoutRef.current) window.clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = window.setTimeout(() => {
        formRef.current?.requestSubmit();
        autoSubmitTimeoutRef.current = null;
      }, 300);
    }
    return () => {
      if (autoSubmitTimeoutRef.current) window.clearTimeout(autoSubmitTimeoutRef.current);
    };
  }, [paymentSelected, canSubmit, addProduct.isPending, addClient.isPending]);

  const handleStylistSelect = useCallback((id: string) => {
    setStylistId(id);
    setStylistPickerOpen(false);
    window.requestAnimationFrame(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select?.();
    });
  }, []);

  const handlePaymentSelect = useCallback((value: string) => {
    setPayment(value);
    setPaymentSelected(true);
    setPaymentPopoverOpen(false);
    setTimeout(() => {
      formRef.current?.dispatchEvent(new Event("submit", { bubbles: true }));
    }, 100);
  }, []);

  useEffect(() => {
    if (stylistId && amountConfirmed && amount && Number(amount) > 0 && !paymentSelected) {
      setPaymentPopoverOpen(true);
    }
  }, [stylistId, amountConfirmed, amount, paymentSelected]);

  function tzOffsetMinutes(timeZone: string, at: Date) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(at);
    const name = parts.find(p => p.type === "timeZoneName")?.value || "UTC";
    const m = name.match(/([+-]\d{1,2})(?::?(\d{2}))?/);
    if (!m) return 0;
    const sign = m[1].startsWith("-") ? -1 : 1;
    const hours = Math.abs(parseInt(m[1], 10));
    const minutes = m[2] ? parseInt(m[2], 10) : 0;
    return sign * (hours * 60 + minutes);
  }

  function parisLocalToEpoch(local: string) {
    const [date, time] = local.split("T");
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    let guess = new Date(Date.UTC(y, (m - 1), d, hh, mm));
    let offsetMin = tzOffsetMinutes("Europe/Paris", guess);
    let ts = guess.getTime() - offsetMin * 60 * 1000;
    guess = new Date(ts);
    offsetMin = tzOffsetMinutes("Europe/Paris", guess);
    ts = new Date(Date.UTC(y, (m - 1), d, hh, mm)).getTime() - offsetMin * 60 * 1000;
    return ts;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || addProduct.isPending || addClient.isPending) return;

    let nextClientId = clientId;
    if (!nextClientId && usingNewClient) {
      if (!newClientFormComplete) {
        toast({ title: "Informations manquantes", description: "Merci de remplir tous les champs du nouveau client." });
        return;
      }
      try {
                                const created = await addClient.mutateAsync({
                                  name: sanitizedNewClientName,
                                  phone: sanitizedNewClientPhone || undefined,
                                });
        nextClientId = created.client.id;
        setClientId(created.client.id);
        setClientSearch("");
      } catch (error) {
        console.error("Failed to create client", error);
        toast({ title: "Création du client échouée", description: "Impossible d'enregistrer le client. Veuillez vérifier les informations et réessayer." });
        return;
      }
    }

    const isoNow = parisNowIsoLocal();
    setWhen(isoNow);
    const ts = parisLocalToEpoch(isoNow);
    addProduct.mutate(
      { stylistId, clientId: nextClientId || undefined, amount: Number(amount), paymentMethod: payment as any, timestamp: ts },
      { onSuccess: () => {
        toast({
          title: "Produit enregistré",
          description: `${amount}€ - Mode de paiement: ${payment}`,
        });
        setStylistId("");
        setStylistPickerOpen(false);
        setPayment("");
        setPaymentSelected(false);
        setPaymentPopoverOpen(false);
        setAmount("");
        setAmountConfirmed(false);
        setClientId("");
        setNewClientFirstName("");
        setNewClientName("");
        setNewClientPhone("");
        setNewClientAccordionOpen(false);
        setClientPickerOpen(false);
        setClientSearch("");
        setClientAccordion("");
        setWhen(parisNowIsoLocal());
        onSuccess?.();
      } }
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div className="flex gap-4 sm:flex-row flex-col">
        <div className="space-y-2">
          <div className={cn("group relative w-full max-w-[20rem] overflow-hidden rounded-3xl border border-white/18 bg-[linear-gradient(135deg,rgba(12,18,45,0.95)0%,rgba(99,102,241,0.68)52%,rgba(16,185,129,0.52)100%)] px-4 pb-4 shadow-[0_28px_72px_rgba(8,15,40,0.55)] backdrop-blur-2xl transition-all duration-300", stylistId ? "border-emerald-300/70 shadow-[0_36px_92px_rgba(16,185,129,0.45)]" : null)}>
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_55%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
            <Popover open={stylistPickerOpen} onOpenChange={setStylistPickerOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={cn("group relative z-10 mt-3 flex w-full items-center justify-between gap-4 overflow-hidden rounded-3xl border border-white/18 bg-white/10 px-6 py-4 text-left text-xl font-semibold text-white shadow-[0_32px_80px_rgba(8,15,40,0.58)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_40px_100px_rgba(79,70,229,0.48)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80", stylistId ? "border-emerald-300/70 bg-emerald-400/15 shadow-[0_40px_100px_rgba(16,185,129,0.48)]" : null)}>
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_55%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="relative flex flex-col text-left gap-1">
                    <span className="min-h-[2.25rem] text-2xl font-black leading-tight text-white drop-shadow-[0_2px_14px_rgba(8,15,40,0.6)]">{selectedStylist ? selectedStylist.name : ""}</span>
                  </div>
                  <span className="relative inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-[linear-gradient(135deg,rgba(16,185,129,0.45)0%,rgba(79,70,229,0.35)100%)] px-4 py-2 text-base font-semibold uppercase tracking-wide text-emerald-50 shadow-[0_12px_28px_rgba(16,185,129,0.38)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-100" />
                    Coiffeur
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="center" className="w-[min(90vw,36rem)] overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(7,12,30,0.96)0%,rgba(67,56,202,0.65)55%,rgba(16,185,129,0.45)100%)] p-0 text-slate-50 shadow-[0_40px_95px_rgba(8,15,40,0.7)] backdrop-blur-2xl">
                <div className="space-y-5 p-5">
                  <div className="space-y-1 text-left">
                    <p className="text-2xl font-bold text-slate-50">Choisir un coiffeur</p>
                  </div>
                  <div className="max-h-[45vh] overflow-y-auto pr-1">
                    {stylistsLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
                      </div>
                    ) : stylists && stylists.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {stylists.map((s) => (
                          <button key={s.id} type="button" onClick={() => handleStylistSelect(s.id)} className={cn("group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(7,12,30,0.96)0%,rgba(15,23,42,0.92)55%,rgba(2,6,23,0.88)100%)] p-5 text-left text-white shadow-[0_24px_60px_rgba(8,15,40,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_32px_78px_rgba(15,23,42,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 backdrop-blur-xl", stylistId === s.id && "border-emerald-300/70 shadow-[0_36px_88px_rgba(16,185,129,0.45)]")}>
                            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_55%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
                            <div className="relative flex flex-col gap-4">
                              <span className="flex items-center gap-2 text-3xl font-black tracking-wide text-white">
                                <span className={cn("h-2 w-2 rounded-full transition-colors", stylistId === s.id ? "bg-emerald-300" : "bg-sky-300/80")} />
                                {s.name}
                              </span>
                              {stylistId === s.id ? (
                                <span className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-300/70 bg-emerald-400/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 shadow-[0_12px_28px_rgba(16,185,129,0.35)]">Sélectionné</span>
                              ) : (
                                <span className="min-h-[1.75rem]" aria-hidden="true" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-5 text-center text-sm text-slate-300">
                        Aucun coiffeur disponible. Ajoutez les coiffeurs dans Paramètres &gt; Ajouter un coiffeur.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 rounded-b-3xl border-t border-white/10 bg-slate-950/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  {selectedStylist ? (
                    <p className="text-sm text-slate-300">Coiffeur sélectionné : {selectedStylist.name}</p>
                  ) : null}
                  <Button type="button" variant="ghost" size="sm" className="text-slate-300 hover:text-slate-50" onClick={() => setStylistPickerOpen(false)}>
                    Fermer
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-slate-950/90 via-indigo-900/65 to-emerald-800/35 p-4 shadow-[0_26px_70px_rgba(8,15,40,0.55)] backdrop-blur-2xl">
          <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(79,70,229,0.35)]">
              <Sparkles className="h-3 w-3 text-amber-200" />
              Montant (€)
            </span>
          </label>
          <div className="mt-3 rounded-3xl border border-white/18 bg-gradient-to-r from-white/40 via-white/15 to-emerald-200/20 px-3 py-2 shadow-[0_18px_45px_rgba(8,15,40,0.4)]">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/70 bg-gradient-to-r from-white/95 via-rose-100/70 to-rose-300/50 px-3 py-1 text-lg font-semibold text-rose-600 shadow-[0_8px_18px_rgba(244,63,94,0.25)]">€</span>
              <Input
                ref={amountInputRef}
                inputMode="decimal"
                type="text"
                value={amount}
                onChange={(e) => {
                  const filtered = e.target.value.replace(/[^\d.]/g, "");
                  setAmount(filtered);
                }}
                onBlur={() => {
                  if (amount && Number(amount) > 0) {
                    setAmountConfirmed(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) e.preventDefault();
                  if (e.key === "Enter" && amount && Number(amount) > 0) {
                    setAmountConfirmed(true);
                  }
                }}
                onWheelCapture={(e) => e.preventDefault()}
                className="h-12 border-0 bg-transparent text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-wider text-white placeholder:text-white/60"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-4 py-6">
            <label className="text-lg font-semibold text-white">Choisir le mode de paiement</label>
            <Popover open={paymentPopoverOpen} onOpenChange={setPaymentPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="inline-flex h-16 min-w-[12rem] items-center justify-center gap-4 rounded-3xl border-2 border-emerald-400/70 bg-emerald-500/20 px-6 text-lg font-bold text-emerald-100 transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-400/30 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 shadow-[0_8px_25px_rgba(16,185,129,0.4)]"
                >
                  <span className="flex items-center gap-3">
                    {PaymentIcon ? (
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/30 text-emerald-200">
                        <PaymentIcon className="h-6 w-6" />
                      </span>
                    ) : null}
                    <span className="text-xl font-black">{paymentLabel}</span>
                  </span>
                  <span className="text-sm text-emerald-200">▼</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="center" className="w-[min(90vw,28rem)] rounded-3xl border border-emerald-400/50 bg-gradient-to-br from-slate-950/95 via-indigo-900/70 to-emerald-800/40 p-6 text-slate-50 shadow-[0_40px_100px_rgba(8,15,40,0.8)] backdrop-blur-2xl">
                <div className="space-y-4">
                  <h3 className="text-center text-2xl font-bold text-white mb-4">Modes de paiement</h3>
                  <div className="grid gap-4 sm:grid-cols-1">
                    {PAYMENT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = payment === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handlePaymentSelect(option.value)}
                          className={cn(
                            "flex w-full items-center justify-center gap-4 rounded-2xl border-2 border-slate-700/70 bg-slate-900/90 px-6 py-5 text-center text-lg font-bold transition-all duration-200 hover:border-emerald-400/80 hover:bg-emerald-500/20 hover:scale-102 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 shadow-[0_8px_25px_rgba(8,15,40,0.3)]",
                            isSelected && "border-emerald-400 bg-emerald-500/25 text-emerald-100 shadow-[0_12px_35px_rgba(16,185,129,0.5)] scale-105"
                          )}
                        >
                          <span className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-800/80 text-slate-200 transition-all",
                            isSelected && "border-emerald-400/90 bg-emerald-500/30 text-emerald-200 shadow-[0_4px_12px_rgba(16,185,129,0.4)]"
                          )}>
                            <Icon className="h-7 w-7" />
                          </span>
                          <span className="text-xl font-black">{option.label}</span>
                          {isSelected ? (
                            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-bold uppercase tracking-wide text-emerald-200 border border-emerald-400/50">
                              Sélectionné
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <button type="submit" disabled={!canSubmit || addProduct.isPending} className="mt-4 w-full py-2 px-4 rounded-xl bg-emerald-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {addProduct.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enregistrement...
          </>
        ) : (
          "Enregistrer le produit"
        )}
      </button>
    </form>
  );
}
