import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ChevronDown, CircleDollarSign, CreditCard, FileText, Sparkles, ArrowLeft, Scissors, Users, UserPlus, Euro, X, ClipboardList, Package, Building2, ArrowLeftRight, SprayCan } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAddClient, useAddPrestation, useAddProduct, useClients, useConfig, useStylists, useDashboardSummary } from "@/lib/api";
import ServicesPicker from "./ServicesPicker";
import ProductsPicker from "./ProductsPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


const PHONE_DIGITS_REQUIRED = 10;

const playSuccessSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1320, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch (e) {
    console.log("Audio not supported");
  }
};

const PAYMENT_OPTIONS: { value: "cash" | "check" | "card"; label: string; icon: LucideIcon; colors: { outer: string; inner: string; glow: string } }[] = [
  { value: "cash", label: "Espèces", icon: CircleDollarSign, colors: { outer: "conic-gradient(from 160deg, #CAFF58, #74FF9C, #16C772, #CAFF58)", inner: "linear-gradient(140deg, #D9FF96 0%, #7DFFAF 60%, #1FAA7C 100%)", glow: "0 8px 20px rgba(116,255,156,0.5)" } },
  { value: "card", label: "Carte", icon: CreditCard, colors: { outer: "conic-gradient(from 160deg, #9DF3FF, #52C7FF, #2B7FFF, #9DF3FF)", inner: "linear-gradient(140deg, #BFF6FF 0%, #63DAFF 60%, #318EFF 100%)", glow: "0 8px 20px rgba(82,199,255,0.5)" } },
  { value: "check", label: "Planity/Treatwell", icon: Building2, colors: { outer: "conic-gradient(from 160deg, #FFD27A, #FF8A4C, #FF5A39, #FFD27A)", inner: "linear-gradient(140deg, #FFE0A1 0%, #FF9C5C 60%, #F1472A 100%)", glow: "0 8px 20px rgba(255,138,76,0.5)" } },
];

export default function PrestationsForm() {
  const { data: stylists, isLoading: stylistsLoading } = useStylists();
  const qc = useQueryClient();
  const { data: clients } = useClients();
  const addPrestation = useAddPrestation();
  const addProduct = useAddProduct();
  const addClient = useAddClient();
  const { data: config } = useConfig();
  const { data: summary } = useDashboardSummary();
  const { toast } = useToast();

  const salonDisplayName = useMemo(() => (config?.salonName ?? "").trim() || "Votre salon", [config?.salonName]);
  const salonInitials = useMemo(() => {
    return salonDisplayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("") || "S";
  }, [salonDisplayName]);

  const [productsPopoverOpen, setProductsPopoverOpen] = useState(false);
  const [totalCAPopupOpen, setTotalCAPopupOpen] = useState(false);
  const [prestationsPopupOpen, setPrestationsPopupOpen] = useState(false);
  const [produitsPopupOpen, setProduitsPopupOpen] = useState(false);
  const [stylistId, setStylistId] = useState<string>("");
  const [stylistPickerOpen, setStylistPickerOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [showAmountHint, setShowAmountHint] = useState(false);
  const [payment, setPayment] = useState<string>("");
  const [paymentSelected, setPaymentSelected] = useState(false);
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [when, setWhen] = useState<string>("");
  const [isProduct, setIsProduct] = useState(false);
  const [selectedServiceName, setSelectedServiceName] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedProductName, setSelectedProductName] = useState<string>("");
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<string>("");
  const [newClientAccordionOpen, setNewClientAccordionOpen] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState<string>("");
  const [newClientName, setNewClientName] = useState<string>("");

  const [newClientPhone, setNewClientPhone] = useState<string>("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTypePickerPopup, setShowTypePickerPopup] = useState(false);
  const [lastTransactionAmount, setLastTransactionAmount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clientAccordion, setClientAccordion] = useState<string>("");
  const [servicesPickerOpen, setServicesPickerOpen] = useState(false);
  const [productsPickerOpen, setProductsPickerOpen] = useState(false);
  const successTimeoutRef = useRef<number | null>(null);
  const amountHintTimeoutRef = useRef<number | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const prevStylistPickerOpenRef = useRef(false);
  const servicesPickerCloseRef = useRef<(() => void) | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const autoSubmitTimeoutRef = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const dialogsOpenedForSessionRef = useRef(false);
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
    return Boolean(
      sanitizedNewClientFirstName ||
      sanitizedNewClientLastName ||
      sanitizedNewClientPhone
    );
  }, [clientId, sanitizedNewClientFirstName, sanitizedNewClientLastName, sanitizedNewClientPhone]);
  const newClientFormComplete = useMemo(() => {
    if (!usingNewClient) return false;
    return Boolean(
      sanitizedNewClientFirstName &&
      sanitizedNewClientLastName &&
      sanitizedNewClientPhone &&
      sanitizedNewClientPhoneDigits.length === PHONE_DIGITS_REQUIRED
    );
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
  const hasClientSelection = useMemo(() => Boolean(clientId || (usingNewClient && newClientFormComplete)), [clientId, newClientFormComplete, usingNewClient]);
  const selectionContainerClass = useMemo(() => (
    "rounded-3xl border border-white/12 bg-gradient-to-br from-slate-950/85 via-indigo-900/55 to-emerald-800/35 px-4 py-3 space-y-3 shadow-[0_22px_55px_rgba(8,15,40,0.5)] backdrop-blur-xl"
  ), []);

  // Debounce client search
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = window.setTimeout(() => {
      setDebouncedClientSearch(clientSearch);
    }, 150);
    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [clientSearch]);

  useEffect(() => {
    function handleGlobalClose() {
      setClientAccordion("");
      setClientPickerOpen(false);
      setClientSearch("");
      setNewClientAccordionOpen(false);
    }
    window.addEventListener("fusion:close-prestations-accordions", handleGlobalClose);
    return () => window.removeEventListener("fusion:close-prestations-accordions", handleGlobalClose);
  }, []);

  useEffect(() => {
    if (prevStylistPickerOpenRef.current && !stylistPickerOpen) {
      window.dispatchEvent(new CustomEvent("fusion:stylist-picker-closed"));
    }
    prevStylistPickerOpenRef.current = stylistPickerOpen;
  }, [stylistPickerOpen]);
  const clientSummary = useMemo(() => {

    if (selectedClient) {
      const contact = [selectedClient.phone].filter(Boolean).join(" - ");
      const base = `${selectedClient.name} - ${selectedClient.points} pts`;
      return contact ? `${base} - ${contact}` : base;
    }
    if (usingNewClient && newClientFormComplete) {
      const contact = [sanitizedNewClientPhone].filter(Boolean).join(" - ");
      const base = `${sanitizedNewClientName} (nouveau)`;
      return contact ? `${base} - ${contact}` : base;
    }
    return "Aucun client sélectionné";
  }, [clientId, newClientFormComplete, sanitizedNewClientName, sanitizedNewClientPhone, selectedClient, usingNewClient]);

  const clientSelectionTitle = useMemo(() => {

    if (selectedClient) {
      return [selectedClient.name, selectedClient.phone].filter(Boolean).join(" - ") || "Sélectionner un client";
    }
    if (usingNewClient && newClientFormComplete) {
      return [sanitizedNewClientName, sanitizedNewClientPhone || null].filter(Boolean).join(" - ");
    }
    return "Sélectionner un client";
  }, [clientId, newClientFormComplete, sanitizedNewClientName, sanitizedNewClientPhone, selectedClient, usingNewClient]);

  const filteredClients = useMemo(() => {
    const term = debouncedClientSearch.trim().toLowerCase();
    if (!term) return [];
    return (clients ?? []).filter((c) => {
      const haystack = [c.name, c.phone ?? ""].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [debouncedClientSearch, clients]);

  const refreshStylists = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    servicesPickerCloseRef.current?.();
    setStylistId("");
    setStylistPickerOpen(false);
    setPayment("");
    setPaymentSelected(false);
    setPaymentPickerOpen(false);
    setServicesPickerOpen(false);
    setProductsPickerOpen(false);
    setAmount("");
    setClientId("");
    setNewClientFirstName("");
    setNewClientName("");
    setNewClientPhone("");
    setNewClientAccordionOpen(false);
    setClientPickerOpen(false);
    setClientSearch("");
    setClientAccordion("");
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["summary"] }),
        qc.invalidateQueries({ queryKey: ["stylists"] }),
        qc.invalidateQueries({ queryKey: ["clients"] }),
      ]);
      await Promise.all([
        qc.refetchQueries({ queryKey: ["summary"], type: "active" }),
        qc.refetchQueries({ queryKey: ["stylists"], type: "active" }),
        qc.refetchQueries({ queryKey: ["clients"], type: "active" }),
      ]);
    } catch (error) {
      console.error("Failed to refresh coiffeur data", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, qc, setStylistId, setAmount, setStylistPickerOpen]);

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
    const y = get("year");
    const m = get("month");
    const d = get("day");
    const h = get("hour");
    const min = get("minute");
    return `${y}-${m}-${d}T${h}:${min}`;
  }, []);

  useEffect(() => {
    if (!when) setWhen(parisNowIsoLocal());
  }, [when, parisNowIsoLocal]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWhen(parisNowIsoLocal());
    }, 60_000);
    return () => clearInterval(timer);
  }, [parisNowIsoLocal]);

  const canSubmit = useMemo(() => {
    if (!(stylistId && amount && Number(amount) > 0 && paymentSelected && when)) {
      return false;
    }
    // For products, client selection is optional; for prestations it's still required
    // Client selection is optional for both products and prestations now
    return newClientFormValid;
  }, [amount, hasClientSelection, newClientFormValid, paymentSelected, stylistId, when, isProduct]);

  useEffect(() => {
    if (paymentSelected && canSubmit && !addPrestation.isPending && !addClient.isPending && !addProduct.isPending) {
      if (autoSubmitTimeoutRef.current) {
        window.clearTimeout(autoSubmitTimeoutRef.current);
      }
      autoSubmitTimeoutRef.current = window.setTimeout(() => {
        formRef.current?.requestSubmit();
        autoSubmitTimeoutRef.current = null;
      }, 300);
    }
    return () => {
      if (autoSubmitTimeoutRef.current) {
        window.clearTimeout(autoSubmitTimeoutRef.current);
      }
    };
  }, [paymentSelected, canSubmit, addPrestation.isPending, addClient.isPending, addProduct.isPending]);

  const handleStylistSelect = useCallback((id: string) => {
    setStylistId(id);
    setStylistPickerOpen(false);

    // Reset selections when stylist changes
    setAmount("");
    setPayment("");
    setPaymentSelected(false);
    setPaymentPickerOpen(false);
    setSelectedServiceName("");
    setSelectedServiceId("");
    setSelectedProductName("");
    setSelectedProductTypeId("");
    setIsProduct(false);
    delete (window as any).__selectedPrestations;
    delete (window as any).__selectedProducts;

    if (amountHintTimeoutRef.current) {
      window.clearTimeout(amountHintTimeoutRef.current);
      amountHintTimeoutRef.current = null;
    }

    // Ouvrir la popup de sélection Prestations/Produits
    setTimeout(() => {
      setShowTypePickerPopup(true);
    }, 100);
  }, [setStylistId, setStylistPickerOpen]);

  const handlePaymentSelect = useCallback((value: string) => {
    setPayment(value);
    setPaymentSelected(true);
    setPaymentPickerOpen(false);
  }, [setPayment, setPaymentSelected, setPaymentPickerOpen]);

  const handleClientAccordionChange = useCallback((next: string | null) => {
    const value = next ?? "";
    setClientAccordion(value);
    setClientPickerOpen(false);
    setClientSearch("");
    setNewClientAccordionOpen(false);
  }, []);

  /*const handleServiceSelect = useCallback((serviceId: string, serviceName: string, price: number) => {
    setAmount(price.toString());
    setPayment("");
    setPaymentSelected(false);
    setIsProduct(false);
    setSelectedServiceName(serviceName);
    setSelectedServiceId(serviceId);
    setTimeout(() => {
      setPaymentPickerOpen(true);
    }, 100);
  }, []);*/


  const handleServiceSelect = useCallback((prestations: Array<{ id: string, name: string, price: number, quantity: number }>, products?: Array<{ id: string, name: string, price: number, quantity: number }>) => {
    const prestationsTotal = prestations.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const productsTotal = (products || []).reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const totalAmount = prestationsTotal + productsTotal;
    
    setAmount(totalAmount.toString());
    setPayment("");
    setPaymentSelected(false);
    
    // Determine if this is product-only, prestation-only, or mixed
    const hasPrestations = prestations.length > 0;
    const hasProducts = (products || []).length > 0;
    
    // Set isProduct based on what's selected
    // If only products, treat as product flow
    // If prestations (with or without products), treat as prestation flow
    if (!hasPrestations && hasProducts) {
      setIsProduct(true);
      const productSummary = (products || []).map(p =>
        p.quantity > 1 ? `${p.name} (x${p.quantity})` : p.name
      ).join(", ");
      setSelectedProductName(productSummary);
      setSelectedProductTypeId((products || [])[0]?.id || "");
      setSelectedServiceName("");
      setSelectedServiceId("");
    } else if (hasPrestations) {
      setIsProduct(false);
      const summary = prestations.map(p =>
        p.quantity > 1 ? `${p.name} (x${p.quantity})` : p.name
      ).join(", ");
      setSelectedServiceName(summary);
      setSelectedServiceId(prestations[0].id);
      
      // Also store products if they exist (for combined transactions)
      if (hasProducts) {
        const productSummary = (products || []).map(p =>
          p.quantity > 1 ? `${p.name} (x${p.quantity})` : p.name
        ).join(", ");
        setSelectedProductName(productSummary);
        setSelectedProductTypeId((products || [])[0]?.id || "");
      } else {
        setSelectedProductName("");
        setSelectedProductTypeId("");
      }
    }

    (window as any).__selectedPrestations = prestations;
    (window as any).__selectedProducts = products || [];

    setTimeout(() => {
      setPaymentPickerOpen(true);
    }, 100);
  }, []);

  const handleServicesPickerReset = useCallback((closeFunc: () => void) => {
    servicesPickerCloseRef.current = closeFunc;
  }, []);

  const handleProductSelect = useCallback((products: Array<{ id: string, name: string, price: number, quantity: number }>) => {
    const totalAmount = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    setAmount(totalAmount.toString());
    setPayment("");
    setPaymentSelected(false);
    setIsProduct(true);

    if (products.length > 0) {
      const summary = products.map(p =>
        p.quantity > 1 ? `${p.name} (x${p.quantity})` : p.name
      ).join(", ");
      setSelectedProductName(summary);
      setSelectedProductTypeId(products[0].id);
    }

    (window as any).__selectedProducts = products;

    setTimeout(() => {
      setPaymentPickerOpen(true);
    }, 100);
  }, []);

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
    // Initial guess as if components were UTC
    let guess = new Date(Date.UTC(y, (m - 1), d, hh, mm));
    // Get offset for Europe/Paris at that instant
    let offsetMin = tzOffsetMinutes("Europe/Paris", guess);
    // Adjust to get the actual UTC instant corresponding to Paris local time
    let ts = guess.getTime() - offsetMin * 60 * 1000;
    // Recompute once in case offset boundary crosses
    guess = new Date(ts);
    offsetMin = tzOffsetMinutes("Europe/Paris", guess);
    ts = new Date(Date.UTC(y, (m - 1), d, hh, mm)).getTime() - offsetMin * 60 * 1000;
    return ts;
  }
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || addPrestation.isPending || addClient.isPending || addProduct.isPending || isSubmitting) return;

    setLastTransactionAmount(Number(amount));
    setIsSubmitting(true);

    let nextClientId = clientId;
    if (!nextClientId && usingNewClient) {
      if (!newClientFormComplete) {
        setClientAccordion("client");
        setNewClientAccordionOpen(true);
        toast({ title: "Informations manquantes", description: "Merci de remplir tous les champs du nouveau client." });
        return;
      }

      if (sanitizedNewClientPhoneDigits.length !== PHONE_DIGITS_REQUIRED) {
        setClientAccordion("client");
        setNewClientAccordionOpen(true);
        toast({ title: "Numéro invalide", description: `Le numéro doit contenir ${PHONE_DIGITS_REQUIRED} chiffres.` });
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
        console.error("Failed to create client before recording prestation", error);
        setClientAccordion("client");
        toast({
          title: "Création du client échouée",
          description: "Impossible d'enregistrer le client. Veuillez vérifier les informations et réessayer.",
        });
        return;
      }
    }

    const isoNow = parisNowIsoLocal();
    setWhen(isoNow);
    const ts = parisLocalToEpoch(isoNow);

    if (isProduct) {
      const storedProducts = (window as any).__selectedProducts as Array<{ id: string, name: string, price: number, quantity: number }> | undefined;

      if (storedProducts && storedProducts.length > 0) {
        const submitProduct = async (product: { id: string, name: string, price: number, quantity: number }, paymentMethodOverride?: string) => {
          for (let i = 0; i < product.quantity; i++) {
            await addProduct.mutateAsync({
              stylistId,
              clientId: nextClientId || undefined,
              amount: product.price,
              paymentMethod: (paymentMethodOverride || payment) as any,
              timestamp: ts,
              productName: product.name || undefined,
              productTypeId: product.id || undefined
            });
          }
        };

        try {
          for (const product of storedProducts) {
            await submitProduct(product);
          }
          delete (window as any).__selectedProducts;

          // Success handling (copied from below)
          servicesPickerCloseRef.current?.();
          setStylistId("");
          setStylistPickerOpen(false);
          setPayment("");
          setPaymentSelected(false);
          setPaymentPickerOpen(false);
          setServicesPickerOpen(false);
          setProductsPickerOpen(false);
          setAmount("");
          setClientId("");
          setIsProduct(false);
          setNewClientFirstName("");
          setNewClientName("");
          setNewClientPhone("");
          setNewClientAccordionOpen(false);
          setClientPickerOpen(false);
          setClientSearch("");
          setClientAccordion("");
          setWhen(parisNowIsoLocal());
          if (successTimeoutRef.current) {
            window.clearTimeout(successTimeoutRef.current);
            successTimeoutRef.current = null;
          }
          setIsSubmitting(false);
          setShowSuccess(true);
          playSuccessSound();
          dialogsOpenedForSessionRef.current = false;
          qc.invalidateQueries({ queryKey: ["summary"] });
          qc.invalidateQueries({ queryKey: ["stylists"] });
          qc.invalidateQueries({ queryKey: ["clients"] });

        } catch (error) {
          console.error("Failed to submit products", error);
          setIsSubmitting(false);
          toast({
            title: "Erreur",
            description: "Impossible d'enregistrer tous les produits. Veuillez réessayer.",
          });
        }
      } else {
        // Fallback for single product (legacy)
        addProduct.mutate(
          {
            stylistId,
            clientId: nextClientId || undefined,
            amount: Number(amount),
            paymentMethod: payment as any,
            timestamp: ts,
            productName: selectedProductName || undefined,
            productTypeId: selectedProductTypeId || undefined
          },
          {
            onSuccess: () => {
              servicesPickerCloseRef.current?.();
              setStylistId("");
              setStylistPickerOpen(false);
              setPayment("");
              setPaymentSelected(false);
              setPaymentPickerOpen(false);
              setServicesPickerOpen(false);
              setProductsPickerOpen(false);
              setAmount("");
              setClientId("");
              setIsProduct(false);
              setNewClientFirstName("");
              setNewClientName("");
              setNewClientPhone("");
              setNewClientAccordionOpen(false);
              setClientPickerOpen(false);
              setClientSearch("");
              setClientAccordion("");
              setWhen(parisNowIsoLocal());
              if (successTimeoutRef.current) {
                window.clearTimeout(successTimeoutRef.current);
                successTimeoutRef.current = null;
              }
              setIsSubmitting(false);
              setShowSuccess(true);
              playSuccessSound();
              dialogsOpenedForSessionRef.current = false;
              qc.invalidateQueries({ queryKey: ["summary"] });
              qc.invalidateQueries({ queryKey: ["stylists"] });
              qc.invalidateQueries({ queryKey: ["clients"] });
            },
            onError: () => {
              setIsSubmitting(false);
            }
          }
        );
      }
    } else {
      const storedPrestations = (window as any).__selectedPrestations as Array<{ id: string, name: string, price: number, quantity: number }> | undefined;

      if (storedPrestations && storedPrestations.length > 0) {
        // Submit multiple prestations
        const submitPrestation = async (prestation: { id: string, name: string, price: number, quantity: number }, paymentMethodOverride?: string) => {
          for (let i = 0; i < prestation.quantity; i++) {
            await addPrestation.mutateAsync({
              stylistId,
              clientId: nextClientId || undefined,
              amount: prestation.price,
              paymentMethod: (paymentMethodOverride || payment) as any,
              timestamp: ts,
              serviceName: prestation.name || undefined,
              serviceId: prestation.id || undefined
            });
          }
        };

        try {
          for (const prestation of storedPrestations) {
            await submitPrestation(prestation);
          }

          // Also submit products if they were selected alongside prestations
          const storedProducts = (window as any).__selectedProducts as Array<{ id: string, name: string, price: number, quantity: number }> | undefined;
          if (storedProducts && storedProducts.length > 0) {
            for (const product of storedProducts) {
              for (let i = 0; i < product.quantity; i++) {
                await addProduct.mutateAsync({
                  stylistId,
                  clientId: nextClientId || undefined,
                  amount: product.price,
                  paymentMethod: payment as any,
                  timestamp: ts,
                  productName: product.name || undefined,
                  productTypeId: product.id || undefined
                });
              }
            }
            delete (window as any).__selectedProducts;
          }

          delete (window as any).__selectedPrestations;

          // Reset form (copy all the reset logic from the existing onSuccess)
          servicesPickerCloseRef.current?.();
          setStylistId("");
          setStylistPickerOpen(false);
          setPayment("");
          setPaymentSelected(false);
          setPaymentPickerOpen(false);
          setServicesPickerOpen(false);
          setProductsPickerOpen(false);
          setAmount("");
          setClientId("");
          setIsProduct(false);
          setNewClientFirstName("");
          setNewClientName("");
          setNewClientPhone("");
          setNewClientAccordionOpen(false);
          setClientPickerOpen(false);
          setClientSearch("");
          setClientAccordion("");
          setWhen(parisNowIsoLocal());

          if (successTimeoutRef.current) {
            window.clearTimeout(successTimeoutRef.current);
            successTimeoutRef.current = null;
          }
          setIsSubmitting(false);
          setShowSuccess(true);
          playSuccessSound();
          dialogsOpenedForSessionRef.current = false;

          qc.invalidateQueries({ queryKey: ["summary"] });
          qc.invalidateQueries({ queryKey: ["stylists"] });
          qc.invalidateQueries({ queryKey: ["clients"] });
        } catch (error) {
          console.error("Failed to submit prestations", error);
          setIsSubmitting(false);
          toast({
            title: "Erreur",
            description: "Impossible d'enregistrer toutes les prestations. Veuillez réessayer.",
          });
        }
      } else {
        // Fallback to single prestation (keep original code here)
        addPrestation.mutate(
          {
            stylistId,
            clientId: nextClientId || undefined,
            amount: Number(amount),
            paymentMethod: payment as any,
            timestamp: ts,
            serviceName: selectedServiceName || undefined,
            serviceId: selectedServiceId || undefined
          },
          {
            onSuccess: () => {
              servicesPickerCloseRef.current?.();
              setStylistId("");
              setStylistPickerOpen(false);
              setPayment("");
              setPaymentSelected(false);
              setPaymentPickerOpen(false);
              setServicesPickerOpen(false);
              setProductsPickerOpen(false);
              setAmount("");
              setClientId("");
              setIsProduct(false);
              setNewClientFirstName("");
              setNewClientName("");
              setNewClientPhone("");
              setNewClientAccordionOpen(false);
              setClientPickerOpen(false);
              setClientSearch("");
              setClientAccordion("");
              setWhen(parisNowIsoLocal());
              if (successTimeoutRef.current) {
                window.clearTimeout(successTimeoutRef.current);
                successTimeoutRef.current = null;
              }
              setIsSubmitting(false);
              setShowSuccess(true);
              playSuccessSound();
              dialogsOpenedForSessionRef.current = false;
              qc.invalidateQueries({ queryKey: ["summary"] });
              qc.invalidateQueries({ queryKey: ["stylists"] });
              qc.invalidateQueries({ queryKey: ["clients"] });
            },
            onError: () => {
              setIsSubmitting(false);
            }
          }
        );
      }
    }
  }

  useEffect(() => () => {
    if (amountHintTimeoutRef.current) {
      window.clearTimeout(amountHintTimeoutRef.current);
    }
    if (autoSubmitTimeoutRef.current) {
      window.clearTimeout(autoSubmitTimeoutRef.current);
    }
  }, []);

  const dialogWasOpenRef = useRef(false);
  
  useEffect(() => {
    if (servicesPickerOpen || productsPickerOpen || paymentPickerOpen) {
      dialogWasOpenRef.current = true;
    }
  }, [servicesPickerOpen, productsPickerOpen, paymentPickerOpen]);

  useEffect(() => {
    if (dialogWasOpenRef.current && !servicesPickerOpen && !productsPickerOpen && !paymentPickerOpen) {
      const timer = setTimeout(() => {
        dialogWasOpenRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [servicesPickerOpen, productsPickerOpen, paymentPickerOpen]);

  useEffect(() => {
    if (showSuccess) {
      const timer = window.setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [showSuccess]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (servicesPickerOpen || productsPickerOpen || paymentPickerOpen || dialogWasOpenRef.current) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('[data-stylist-card]') || target.closest('[data-pill-button]')) {
      return;
    }
    if (stylistId) {
      refreshStylists();
    }
  }, [stylistId, amount, refreshStylists, servicesPickerOpen, productsPickerOpen, paymentPickerOpen]);

  return (
    <Card className={cn("border-none shadow-md backdrop-blur-sm transition-all duration-300", showTypePickerPopup ? "bg-transparent" : "bg-slate-900/20")} onClick={handleBackgroundClick}>
      <CardHeader>
        <div className="flex items-center justify-center">
          <span 
            className="text-base font-bold text-cyan-400 [-webkit-text-stroke:0.5px_black] [text-shadow:0_0_6px_rgba(34,211,238,0.6),0_1px_2px_rgba(0,0,0,0.8)]" 
            title={salonDisplayName}
          >
            {salonDisplayName}
          </span>
        </div>
      </CardHeader>
      <AnimatePresence>
        {(isSubmitting || showSuccess) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative sm:max-w-md w-[90%] rounded-2xl border border-white/20 bg-black/5 backdrop-blur-md shadow-[0_25px_80px_rgba(0,0,0,0.6)] p-8"
            >
              <div className="flex flex-col items-center justify-center">
                <div className="relative mb-6">
                  {/* 3D Multi-ring validation icon */}
                  <motion.div 
                    className="relative h-28 w-28"
                    animate={showSuccess ? {
                      boxShadow: ["0 0 0px rgba(20,184,166,0)", "0 0 80px rgba(20,184,166,0.9)", "0 0 50px rgba(20,184,166,0.7)"]
                    } : {}}
                    transition={{ duration: 0.6 }}
                    style={{ borderRadius: "50%" }}
                  >
                    {/* Outer ring - Turquoise/Cyan gradient */}
                    <div className={cn(
                      "absolute inset-0 rounded-full transition-all duration-500",
                      showSuccess 
                        ? "bg-gradient-to-br from-teal-400 via-cyan-500 to-emerald-500 shadow-[0_0_60px_rgba(20,184,166,0.8)]"
                        : "bg-gradient-to-br from-slate-600/50 via-slate-500/30 to-slate-600/50"
                    )} />
                    
                    {/* Middle ring - White/Silver semi-transparent */}
                    <div className={cn(
                      "absolute inset-[5px] rounded-full transition-all duration-500",
                      showSuccess
                        ? "bg-gradient-to-br from-white/80 via-gray-200/70 to-white/60 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15)]"
                        : "bg-gradient-to-br from-white/25 via-white/15 to-white/10"
                    )} />
                    
                    {/* Inner circle - Turquoise/Green gradient semi-transparent */}
                    <div className={cn(
                      "absolute inset-[10px] rounded-full transition-all duration-500 flex items-center justify-center",
                      showSuccess
                        ? "bg-gradient-to-br from-teal-400/85 via-emerald-500/80 to-cyan-600/85 shadow-[inset_0_4px_8px_rgba(255,255,255,0.5),inset_0_-4px_8px_rgba(0,0,0,0.25),0_0_40px_rgba(20,184,166,0.5)]"
                        : "bg-gradient-to-br from-slate-700/40 via-slate-600/30 to-slate-700/40 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)]"
                    )}>
                      {/* Glass reflection */}
                      <div className="absolute inset-x-2 top-2 h-[40%] rounded-t-full bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
                      
                      {showSuccess ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ duration: 0.4, ease: "backOut" }}
                          className="relative z-10"
                        >
                          <Check className="h-14 w-14 text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)]" strokeWidth={3} />
                        </motion.div>
                      ) : (
                        <div className="relative h-12 w-12">
                          {[...Array(12)].map((_, i) => (
                            <div
                              key={i}
                              className="absolute left-1/2 top-0 h-3 w-1 -translate-x-1/2 rounded-full bg-violet-400"
                              style={{
                                transform: `translateX(-50%) rotate(${i * 30}deg)`,
                                transformOrigin: '50% 24px',
                                opacity: 1 - (i * 0.07),
                                animation: `spinnerFade 1s linear infinite`,
                                animationDelay: `${-i * (1/12)}s`
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                  
                  {showSuccess && (
                    <>
                      {/* Pulsing glow rings */}
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-teal-400/40"
                        animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-cyan-300/30"
                        animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.2 }}
                      />
                      <motion.div
                        className="absolute -top-3 -right-3"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.3, ease: "backOut" }}
                      >
                        <Sparkles className="h-9 w-9 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                      </motion.div>
                      <motion.div
                        className="absolute -bottom-2 -left-4"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15, duration: 0.3, ease: "backOut" }}
                      >
                        <Sparkles className="h-7 w-7 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                      </motion.div>
                    </>
                  )}
                </div>

                <h2 className={cn(
                  "text-2xl font-bold mb-2",
                  showSuccess ? "text-emerald-400" : "text-slate-300"
                )}>
                  {showSuccess ? "Transaction validée" : "Validation..."}
                </h2>
                
                <p className="text-slate-400 text-sm mb-6">
                  {showSuccess ? "Merci !" : "Enregistrement en cours"}
                </p>

                <div className="text-5xl font-bold text-white">
                  {lastTransactionAmount.toFixed(2)} €
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTypePickerPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowTypePickerPopup(false);
              refreshStylists();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative sm:max-w-lg w-[90%] p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center justify-center">
                <div className="flex justify-center">
                  {/* Carte Prestations & Produits combinée */}
                  <motion.button
                    type="button"
                    onClick={() => {
                      setShowTypePickerPopup(false);
                      setTimeout(() => setServicesPickerOpen(true), 100);
                    }}
                    whileHover={{ scale: 1.18, y: -12, boxShadow: "0 0 60px rgba(139,92,246,0.8), 0 0 100px rgba(139,92,246,0.5), 0 0 140px rgba(139,92,246,0.3)" }}
                    whileTap={{ scale: 1.25, y: -16, boxShadow: "0 0 80px rgba(139,92,246,1), 0 0 120px rgba(139,92,246,0.7)" }}
                    className="group relative flex flex-col items-center justify-center w-44 h-44 rounded-2xl transition-all duration-300"
                  >
                    {/* Halo lumineux derrière l'icône */}
                    <div className="relative flex items-center justify-center mb-3">
                      {/* Cercle externe avec gradient */}
                      <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-purple-600/30 blur-md group-hover:from-violet-400/40 group-hover:via-fuchsia-400/30 group-hover:to-purple-500/40 transition-all duration-300" />
                      {/* Cercle intermédiaire */}
                      <div className="absolute w-20 h-20 rounded-full border-2 border-violet-400/50 group-hover:border-violet-300/70 transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.4),inset_0_0_15px_rgba(139,92,246,0.2)]" />
                      {/* Fond icône avec gradient */}
                      <div className="relative flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-purple-600 shadow-[0_4px_20px_rgba(168,85,247,0.5)] group-hover:shadow-[0_6px_25px_rgba(168,85,247,0.7)] transition-all duration-300">
                        <Scissors className="h-7 w-7 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <span className="text-base font-semibold text-violet-300 group-hover:text-violet-200 transition-colors duration-300">
                      Prestations
                    </span>
                    {/* & au milieu */}
                    <span className="text-sm font-medium text-white/60">&</span>
                    {/* Texte Produits */}
                    <span className="text-sm font-medium text-cyan-400/80">Produits</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <form 
        ref={formRef} 
        onSubmit={onSubmit} 
        className={cn("space-y-3 min-h-[50vh] transition-opacity duration-300", showTypePickerPopup && "opacity-0 pointer-events-none")}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const isButton = target.closest('button');
          const isPopover = target.closest('[data-radix-popper-content-wrapper]');
          const isDialog = target.closest('[role="dialog"]');
          const isInput = target.closest('input');
          if (!isButton && !isPopover && !isDialog && !isInput) {
            refreshStylists();
          }
        }}
      >
        {/* ServicesPicker et ProductsPicker en Dialog (invisibles, ouverts après sélection coiffeur) */}
        <ServicesPicker
          key={`services-${stylistId}`}
          onServiceSelect={handleServiceSelect}
          onReset={handleServicesPickerReset}
          externalOpen={servicesPickerOpen}
          onOpenChange={setServicesPickerOpen}
          disabled={!stylistId}
        />
        <ProductsPicker
          key={`products-${stylistId}`}
          onProductSelect={handleProductSelect}
          externalOpen={productsPickerOpen}
          onOpenChange={setProductsPickerOpen}
          disabled={!stylistId}
        />

        {/* Grande carte Coiffeur centrée en haut */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-[11rem]">
            <Popover open={stylistPickerOpen} onOpenChange={setStylistPickerOpen}>
              <PopoverTrigger asChild>
                <motion.button
                  type="button"
                  data-stylist-card
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-2 w-full rounded-[2.5rem] border-2 bg-slate-950/75 px-4 py-4 transition-all duration-300 focus:outline-none backdrop-blur-sm",
                    stylistId 
                      ? "border-cyan-400 shadow-[0_0_35px_rgba(34,211,238,0.5),0_0_60px_rgba(34,211,238,0.3),inset_0_0_20px_rgba(34,211,238,0.1)]" 
                      : "border-slate-700/70 shadow-[0_0_20px_rgba(0,0,0,0.4)] hover:border-cyan-400 hover:shadow-[0_0_50px_rgba(34,211,238,0.7),0_0_80px_rgba(34,211,238,0.5),0_0_120px_rgba(34,211,238,0.3)]"
                  )}
                >
                  <motion.div
                    animate={{ 
                      filter: stylistId 
                        ? ["drop-shadow(0 0 12px rgba(34,211,238,0.8))", "drop-shadow(0 0 25px rgba(34,211,238,1))", "drop-shadow(0 0 12px rgba(34,211,238,0.8))"]
                        : ["drop-shadow(0 0 8px rgba(34,211,238,0.5))", "drop-shadow(0 0 15px rgba(34,211,238,0.7))", "drop-shadow(0 0 8px rgba(34,211,238,0.5))"]
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-full overflow-hidden"
                  >
                    <div className="h-36 w-36 flex items-center justify-center rounded-full bg-gradient-to-br from-slate-700/20 to-slate-900/20 backdrop-blur-sm">
                      <svg className="h-20 w-20 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                  </motion.div>
                  <span className={cn(
                    "text-lg font-light transition-all duration-300",
                    stylistId ? "text-white" : "text-slate-300"
                  )}>
                    {selectedStylist ? selectedStylist.name : "Coiffeur"}
                  </span>
                </motion.button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="center" className="w-[min(95vw,38rem)] overflow-visible rounded-3xl border border-white/20 bg-slate-900/50 p-0 text-slate-50 shadow-[0_25px_60px_rgba(0,0,0,0.3)] backdrop-blur-sm">
                <div className="p-8 overflow-visible">
                  <div className="max-h-[55vh] overflow-y-auto overflow-x-visible scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {stylistsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                      </div>
                    ) : stylists && stylists.length > 0 ? (
                      <div className="grid gap-5 grid-cols-2 p-4 overflow-visible">
                        {stylists.map((s) => (
                          <motion.button
                            key={s.id}
                            type="button"
                            onClick={() => handleStylistSelect(s.id)}
                            initial={false}
                            animate={stylistId === s.id ? {
                              scale: 1.28,
                              y: -6,
                              boxShadow: [
                                "0 0 35px rgba(232,121,249,0.6), 0 0 60px rgba(255,184,0,0.4)",
                                "0 0 70px rgba(232,121,249,1), 0 0 100px rgba(255,184,0,0.7)",
                                "0 0 50px rgba(232,121,249,0.8), 0 0 80px rgba(255,184,0,0.5)"
                              ]
                            } : { scale: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            whileHover={{ scale: stylistId === s.id ? 1.32 : 1.08, y: stylistId === s.id ? -8 : -2 }}
                            whileTap={{ scale: 0.95 }}
                            className={cn(
                              "flex items-center gap-4 rounded-2xl border-2 border-white/30 bg-slate-800/40 px-6 py-5 text-left transition-colors duration-200 shadow-[0_0_20px_rgba(148,163,184,0.2)] hover:border-fuchsia-400 hover:bg-slate-700/50 hover:shadow-[0_0_35px_rgba(232,121,249,0.7),0_0_50px_rgba(255,184,0,0.4)] focus:outline-none",
                              stylistId === s.id && "border-fuchsia-400 bg-slate-700/50 shadow-[0_0_50px_rgba(232,121,249,0.8),0_0_70px_rgba(255,184,0,0.5)]"
                            )}
                          >
                            <motion.span
                              className={cn(
                                "h-3 w-3 rounded-full flex-shrink-0",
                                stylistId === s.id ? "bg-gradient-to-r from-fuchsia-300 to-amber-300" : "bg-fuchsia-400/80"
                              )}
                              animate={stylistId === s.id ? {
                                boxShadow: [
                                  "0 0 12px rgba(232,121,249,0.8), 0 0 20px rgba(255,184,0,0.5)",
                                  "0 0 28px rgba(232,121,249,1), 0 0 40px rgba(255,184,0,0.8)",
                                  "0 0 18px rgba(232,121,249,0.9), 0 0 30px rgba(255,184,0,0.6)"
                                ],
                                scale: [1, 1.3, 1]
                              } : {}}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <span className="text-lg sm:text-2xl font-bold text-white break-words" style={{ WebkitTextStroke: '0.5px black' }}>
                              {s.name}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-700/70 bg-slate-800/80 p-5 text-center text-sm text-slate-300">
                        Aucun coiffeur disponible.
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Rangée du milieu: Client et Nouveau Client */}
        <div className="flex justify-between items-center mt-6 px-8">
          {/* Bouton Client - cyan */}
          <motion.button
            type="button"
            onClick={() => {
              setNewClientAccordionOpen(false);
              setClientAccordion("client");
              setClientPickerOpen(true);
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-2 focus:outline-none transition-all duration-300"
          >
            <div className={cn(
              "relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300",
              clientId
                ? "border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.6),inset_0_0_15px_rgba(34,211,238,0.2)]"
                : "border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
            )}>
              <Users className={cn(
                "h-5 w-5 transition-all duration-300",
                clientId ? "text-cyan-400" : "text-cyan-500"
              )} />
              {clientId && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-400/50"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </div>
            <span className={cn(
              "font-bold transition-all duration-300 max-w-[120px] truncate text-center",
              clientId ? "text-lg text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.6)]" : "text-sm text-cyan-500"
            )}>
              {selectedClient ? selectedClient.name.split(' ')[0] : "Client"}
            </span>
          </motion.button>

          {/* Bouton Nouveau Client - orange */}
          <motion.button
            type="button"
            onClick={() => {
              setClientId("");
              setClientSearch("");
              setNewClientAccordionOpen(true);
              setClientAccordion("client");
              setClientPickerOpen(true);
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-2 focus:outline-none transition-all duration-300"
          >
            <div className={cn(
              "relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300",
              usingNewClient && newClientFormComplete
                ? "border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6),inset_0_0_15px_rgba(251,191,36,0.2)]"
                : "border-amber-500/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
            )}>
              <UserPlus className={cn(
                "h-5 w-5 transition-all duration-300",
                usingNewClient && newClientFormComplete ? "text-amber-400" : "text-amber-500"
              )} />
              {usingNewClient && newClientFormComplete && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-amber-400/50"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </div>
            <span className={cn(
              "text-xs font-medium transition-all duration-300 max-w-[80px] truncate text-center",
              usingNewClient && newClientFormComplete ? "text-amber-400" : "text-amber-500"
            )}>
              {usingNewClient && newClientFormComplete ? sanitizedNewClientFirstName : "Nouveau Client"}
            </span>
          </motion.button>
        </div>

        {amount ? (
          <div className="flex justify-center w-full mt-6">
            <div className="flex flex-col items-center gap-1 text-center w-full max-w-md">

              {paymentPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200">
                  <div className="w-full max-w-md rounded-3xl border border-white/20 bg-black/5 p-6 text-slate-50 shadow-[0_40px_100px_rgba(8,15,40,0.8)] backdrop-blur-md animate-in zoom-in-95 duration-200">
                    <div className="mb-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentPickerOpen(false);
                          if (isProduct) {
                            setProductsPickerOpen(true);
                          } else {
                            setServicesPickerOpen(true);
                          }
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:scale-105 active:scale-95"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <span className="text-xl font-bold text-white">Moyen de paiement</span>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-4">
                        {PAYMENT_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          const isSelected = payment === option.value;
                          return (
                            <motion.button
                              key={option.value}
                              type="button"
                              onClick={() => handlePaymentSelect(option.value)}
                              animate={isSelected ? {
                                scale: [1.15, 1.2, 1.15],
                                boxShadow: [
                                  "0 0 20px rgba(34,211,238,0.6), 0 0 40px rgba(34,211,238,0.3)",
                                  "0 0 40px rgba(34,211,238,0.8), 0 0 60px rgba(34,211,238,0.5)",
                                  "0 0 20px rgba(34,211,238,0.6), 0 0 40px rgba(34,211,238,0.3)"
                                ]
                              } : { scale: 1 }}
                              transition={isSelected ? {
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut"
                              } : { duration: 0.2 }}
                              whileHover={{ scale: isSelected ? 1.2 : 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={cn(
                                "flex w-full items-center justify-start gap-4 rounded-2xl border-2 border-white/20 bg-black/5 px-6 py-5 text-left text-lg font-bold transition-colors duration-200 hover:border-cyan-400/80 hover:bg-cyan-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 shadow-[0_8px_25px_rgba(8,15,40,0.3)] backdrop-blur-sm",
                                isSelected && "border-cyan-400 bg-gradient-to-r from-cyan-500/30 via-cyan-400/40 to-cyan-500/30 text-cyan-100 [background-size:200%_100%] animate-[shimmer_2s_ease-in-out_infinite]"
                              )}
                              style={isSelected ? {
                                background: "linear-gradient(90deg, rgba(34,211,238,0.2) 0%, rgba(34,211,238,0.5) 50%, rgba(34,211,238,0.2) 100%)",
                                backgroundSize: "200% 100%",
                                animation: "shimmer 2s ease-in-out infinite"
                              } : undefined}
                            >
                              <span
                                className="relative flex h-14 w-14 items-center justify-center rounded-full"
                                style={{ background: option.colors.outer, boxShadow: option.colors.glow }}
                              >
                                <span
                                  className="absolute inset-[3px] rounded-full"
                                  style={{ background: "radial-gradient(circle, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.78) 60%, rgba(15,23,42,0.55) 100%)", boxShadow: "inset 0 6px 16px rgba(255,255,255,0.08), inset 0 -12px 20px rgba(2,6,23,0.82)" }}
                                />
                                <span
                                  className="relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden"
                                  style={{ background: option.colors.inner, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)" }}
                                >
                                  <Icon className="h-5 w-5 text-slate-900/80" />
                                </span>
                              </span>
                              <span className={cn("text-xl font-black", isSelected && "text-cyan-300")}>
                              {option.value === "check" ? (
                                <span className="flex flex-col leading-tight">
                                  <span>Planity</span>
                                  <span>Treatwell</span>
                                </span>
                              ) : option.label}
                            </span>
                              {isSelected ? (
                                <span className="rounded-full bg-cyan-500/30 px-3 py-1 text-sm font-bold uppercase tracking-wide text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                                  Sélectionné
                                </span>
                              ) : null}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
        {/* Popup Client - design transparent avec effet glassmorphism */}
        <Dialog open={clientAccordion === "client" && !newClientAccordionOpen} onOpenChange={(open) => {
          if (open) {
            setClientAccordion("client");
            setNewClientAccordionOpen(false);
          } else {
            setClientAccordion("");
            setClientSearch("");
          }
        }}>
          <DialogContent className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-white/25 bg-black/10 p-0 shadow-[0_25px_60px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-[3px]">
            <div className="p-5 space-y-5">
              {/* Barre de recherche */}
              <motion.div 
                className="relative rounded-xl p-[2px]"
                initial={{ scale: 1 }}
                whileFocus={{ scale: 1.03 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                style={{
                  background: "linear-gradient(90deg, #e879f9 0%, #f0abfc 15%, rgba(255,255,255,0.4) 50%, #f0abfc 85%, #e879f9 100%)"
                }}
              >
                <motion.div
                  initial={{ boxShadow: "0 0 0px rgba(232, 121, 249, 0)" }}
                  whileTap={{ scale: 1.02 }}
                  animate={clientSearch ? { 
                    boxShadow: "0 0 25px rgba(232, 121, 249, 0.6), 0 0 50px rgba(240, 171, 252, 0.3)",
                    scale: 1.02
                  } : {}}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="rounded-xl"
                >
                  <Input
                    placeholder="Rechercher par nom ou téléphone"
                    autoFocus
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onFocus={(e) => {
                      const parent = e.target.parentElement?.parentElement;
                      if (parent) {
                        parent.style.transform = "scale(1.03)";
                        parent.style.boxShadow = "0 0 30px rgba(232, 121, 249, 0.7), 0 0 60px rgba(240, 171, 252, 0.4)";
                      }
                    }}
                    onBlur={(e) => {
                      const parent = e.target.parentElement?.parentElement;
                      if (parent) {
                        parent.style.transform = "scale(1)";
                        parent.style.boxShadow = "none";
                      }
                    }}
                    className="h-12 w-full rounded-[10px] border-0 bg-slate-900/80 pl-4 pr-4 text-base text-white font-medium text-center placeholder:text-white/50 placeholder:text-center focus:ring-0 focus:bg-slate-900/90 backdrop-blur-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none transition-all duration-200"
                  />
                </motion.div>
              </motion.div>

              {/* Liste des clients */}
              <div className="max-h-[40vh] overflow-y-auto">
                {clientSearch.trim().length === 0 ? (
                  <div className="py-8 text-center text-sm font-medium text-white/60">
                    Tapez un nom ou un numéro pour afficher les clients.
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="py-8 text-center text-sm font-medium text-white/60">
                    Aucun client trouvé
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setClientId(c.id);
                          setClientPickerOpen(false);
                          setClientSearch("");
                          setClientAccordion("");
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-left transition hover:border-emerald-400/50 hover:bg-black/40"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xl font-bold text-white">{c.name}</span>
                          {c.phone && (
                            <span className="text-xs font-medium text-white/60">{c.phone}</span>
                          )}
                        </div>
                        <span className="rounded-full bg-emerald-500/30 px-2 py-0.5 text-xs font-bold text-emerald-300">
                          {c.points} pts
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bouton fermer */}
              <button
                type="button"
                onClick={() => {
                  setClientAccordion("");
                  setClientSearch("");
                }}
                className="w-full rounded-xl border border-white/30 bg-white/10 py-3 text-sm font-bold text-white transition hover:bg-white/20 backdrop-blur-sm"
              >
                Fermer
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Popup Nouveau Client - design transparent avec effet glassmorphism */}
        <Dialog open={newClientAccordionOpen} onOpenChange={(open) => {
          setNewClientAccordionOpen(open);
          if (!open) {
            setClientAccordion("");
          }
        }}>
          <DialogContent className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-white/25 bg-black/10 p-0 shadow-[0_25px_60px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-[3px]">
            <div className="p-5 space-y-4">
              <h3 className="text-lg font-bold text-white text-center">Nouveau client</h3>
              
              <Input
                value={newClientFirstName}
                onChange={(e) => {
                  const v = e.target.value.normalize("NFC").replace(/[^\p{L} \-']/gu, "");
                  setNewClientFirstName(v);
                }}
                inputMode="text"
                autoComplete="given-name"
                placeholder="Prénom"
                className="h-12 rounded-xl border border-white/30 bg-white/10 text-white font-medium placeholder:text-white/50 focus:border-white/50 focus:ring-0 focus:bg-white/20 backdrop-blur-sm"
              />
              
              <Input
                value={newClientName}
                onChange={(e) => {
                  const v = e.target.value.normalize("NFC").replace(/[^\p{L} \-']/gu, "");
                  setNewClientName(v);
                }}
                inputMode="text"
                autoComplete="family-name"
                placeholder="Nom"
                className="h-12 rounded-xl border border-white/30 bg-white/10 text-white font-medium placeholder:text-white/50 focus:border-white/50 focus:ring-0 focus:bg-white/20 backdrop-blur-sm"
              />

              <Input
                type="tel"
                value={newClientPhone}
                onChange={(e) => {
                  const v = e.target.value.normalize("NFC").replace(/[^+\d().\-\s]/g, "");
                  setNewClientPhone(v);
                }}
                inputMode="tel"
                autoComplete="tel"
                placeholder="Téléphone (10 chiffres)"
                className="h-12 rounded-xl border border-white/30 bg-white/10 text-white font-medium placeholder:text-white/50 focus:border-white/50 focus:ring-0 focus:bg-white/20 backdrop-blur-sm"
              />
              
              {usingNewClient && sanitizedNewClientPhoneDigits.length > 0 && sanitizedNewClientPhoneDigits.length !== PHONE_DIGITS_REQUIRED && (
                <p className="text-xs font-medium text-rose-400">
                  Le numéro doit contenir exactement 10 chiffres.
                </p>
              )}

              <button
                type="button"
                disabled={!newClientFormComplete || addClient.isPending}
                onClick={async () => {
                  try {
                    const created = await addClient.mutateAsync({
                      name: sanitizedNewClientName,
                      phone: sanitizedNewClientPhone || undefined,
                    });
                    setClientId(created.client.id);
                    setNewClientAccordionOpen(false);
                    setNewClientFirstName("");
                    setNewClientName("");
                    setNewClientPhone("");
                    setClientAccordion("");
                  } catch (err) {
                    console.error("Erreur lors de la création du client:", err);
                  }
                }}
                className="w-full rounded-xl bg-emerald-500/30 border border-emerald-400/40 py-3 text-sm font-bold text-white transition hover:bg-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 backdrop-blur-sm"
              >
                {addClient.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Valider"
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewClientAccordionOpen(false);
                  setClientAccordion("");
                }}
                className="w-full rounded-xl border border-white/30 bg-white/10 py-3 text-sm font-bold text-white transition hover:bg-white/20 backdrop-blur-sm"
              >
                Annuler
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </form>
    </Card>
  );
}
