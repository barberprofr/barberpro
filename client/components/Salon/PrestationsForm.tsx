import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ChevronDown, CircleDollarSign, CreditCard, FileText, Sparkles, ArrowLeft, Scissors, Users, UserPlus, Euro, ClipboardList, Package, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAddClient, useAddPrestation, useAddProduct, useClients, useConfig, useStylists } from "@/lib/api";
import ServicesPicker from "./ServicesPicker";
import ProductsPicker from "./ProductsPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


const PHONE_DIGITS_REQUIRED = 10;
const PAYMENT_OPTIONS: { value: "cash" | "check" | "card"; label: string; icon: LucideIcon }[] = [
  { value: "cash", label: "Espèces", icon: CircleDollarSign },
  { value: "card", label: "Carte", icon: CreditCard },
  { value: "check", label: "Chèque", icon: FileText },
];

export default function PrestationsForm() {
  const { data: stylists, isLoading: stylistsLoading } = useStylists();
  const qc = useQueryClient();
  const { data: clients } = useClients();
  const addPrestation = useAddPrestation();
  const addProduct = useAddProduct();
  const addClient = useAddClient();
  const { data: config } = useConfig();
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clientAccordion, setClientAccordion] = useState<string>("");
  const [servicesPickerOpen, setServicesPickerOpen] = useState(false);
  const [productsPickerOpen, setProductsPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const successTimeoutRef = useRef<number | null>(null);
  const amountHintTimeoutRef = useRef<number | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const prevStylistPickerOpenRef = useRef(false);
  const servicesPickerCloseRef = useRef<(() => void) | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
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

    setAmount("");
    setPayment("");
    setPaymentSelected(false);
    setPaymentPickerOpen(false);
    setServicesPickerOpen(false);
    setProductsPickerOpen(false);
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
    setShowAmountHint(true);
    amountHintTimeoutRef.current = window.setTimeout(() => {
      setShowAmountHint(false);
      amountHintTimeoutRef.current = null;
    }, 3500);
    window.requestAnimationFrame(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select?.();
    });
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

  const handleServiceSelect = useCallback((prestations: Array<{ id: string, name: string, price: number, quantity: number }>) => {
    const totalAmount = prestations.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    setAmount(totalAmount.toString());
    setPayment("");
    setPaymentSelected(false);
    setIsProduct(false);

    if (prestations.length > 0) {
      const summary = prestations.map(p =>
        p.quantity > 1 ? `${p.name} (x${p.quantity})` : p.name
      ).join(", ");
      setSelectedServiceName(summary);
      setSelectedServiceId(prestations[0].id);
    }

    (window as any).__selectedPrestations = prestations;

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
    if (!canSubmit || addPrestation.isPending || addClient.isPending || addProduct.isPending) return;

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
        const submitProduct = async (product: { id: string, name: string, price: number, quantity: number }) => {
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
        };

        try {
          for (const product of storedProducts) {
            await submitProduct(product);
          }
          delete (window as any).__selectedProducts;

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
          setShowSuccess(true);
          successTimeoutRef.current = window.setTimeout(() => {
            setShowSuccess(false);
            successTimeoutRef.current = null;
          }, 2400);
          qc.invalidateQueries({ queryKey: ["summary"] });
          qc.invalidateQueries({ queryKey: ["stylists"] });
          qc.invalidateQueries({ queryKey: ["clients"] });

        } catch (error) {
          console.error("Failed to submit products", error);
          toast({
            title: "Erreur",
            description: "Impossible d'enregistrer tous les produits. Veuillez réessayer.",
          });
        }
      } else {
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
              setShowSuccess(true);
              successTimeoutRef.current = window.setTimeout(() => {
                setShowSuccess(false);
                successTimeoutRef.current = null;
              }, 2400);
              qc.invalidateQueries({ queryKey: ["summary"] });
              qc.invalidateQueries({ queryKey: ["stylists"] });
              qc.invalidateQueries({ queryKey: ["clients"] });
            }
          }
        );
      }
    } else {
      const storedPrestations = (window as any).__selectedPrestations as Array<{ id: string, name: string, price: number, quantity: number }> | undefined;

      if (storedPrestations && storedPrestations.length > 0) {
        const submitPrestation = async (prestation: { id: string, name: string, price: number, quantity: number }) => {
          for (let i = 0; i < prestation.quantity; i++) {
            await addPrestation.mutateAsync({
              stylistId,
              clientId: nextClientId || undefined,
              amount: prestation.price,
              paymentMethod: payment as any,
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

          delete (window as any).__selectedPrestations;

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
          setShowSuccess(true);
          successTimeoutRef.current = window.setTimeout(() => {
            setShowSuccess(false);
            successTimeoutRef.current = null;
          }, 2400);

          qc.invalidateQueries({ queryKey: ["summary"] });
          qc.invalidateQueries({ queryKey: ["stylists"] });
          qc.invalidateQueries({ queryKey: ["clients"] });
        } catch (error) {
          console.error("Failed to submit prestations", error);
          toast({
            title: "Erreur",
            description: "Impossible d'enregistrer toutes les prestations. Veuillez réessayer.",
          });
        }
      } else {
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
              setShowSuccess(true);
              successTimeoutRef.current = window.setTimeout(() => {
                setShowSuccess(false);
                successTimeoutRef.current = null;
              }, 2400);
              qc.invalidateQueries({ queryKey: ["summary"] });
              qc.invalidateQueries({ queryKey: ["stylists"] });
              qc.invalidateQueries({ queryKey: ["clients"] });
            }
          }
        );
      }
    }
  }

  useEffect(() => () => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
    }
    if (amountHintTimeoutRef.current) {
      window.clearTimeout(amountHintTimeoutRef.current);
    }
    if (autoSubmitTimeoutRef.current) {
      window.clearTimeout(autoSubmitTimeoutRef.current);
    }
  }, []);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {showSuccess && (
          <motion.div
            key="success-banner"
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center gap-3 rounded-2xl border border-emerald-300/80 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 px-4 py-2.5 text-base font-semibold text-white shadow-[0_20px_40px_rgba(16,185,129,0.35)]"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-emerald-900 shadow-lg">
              <Check className="h-4 w-4" />
            </span>
            Prestation enregistrée avec succès
          </motion.div>
        )}
      </AnimatePresence>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <div className="relative rounded-[2rem] bg-[#1a1f2e] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#1e2538] via-[#1a1f2e] to-[#151923] pointer-events-none" />
          <div className="absolute inset-[1px] rounded-[2rem] border border-white/[0.08] pointer-events-none" />
          
          <div className="relative flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-cyan-600/10 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                <Scissors className="h-8 w-8 text-cyan-400" />
              </div>
              
              <Popover open={stylistPickerOpen} onOpenChange={setStylistPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group relative flex items-center gap-2 rounded-2xl bg-[#0d1117] px-6 py-3 text-xl font-bold text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] transition-all hover:bg-[#161b22]"
                  >
                    <span className="text-white/90">
                      {selectedStylist ? selectedStylist.name : "Coiffeur"}
                    </span>
                    <span className="text-cyan-400">|</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center" className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1f2e] p-4 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
                  <div className="space-y-4">
                    <p className="text-lg font-bold text-white">Choisir un coiffeur</p>
                    <div className="max-h-[40vh] overflow-y-auto space-y-2">
                      {stylistsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                        </div>
                      ) : stylists && stylists.length > 0 ? (
                        stylists.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleStylistSelect(s.id)}
                            className={cn(
                              "w-full rounded-xl bg-[#0d1117] px-4 py-3 text-left text-white transition-all hover:bg-[#161b22]",
                              stylistId === s.id && "ring-2 ring-cyan-400 bg-cyan-400/10"
                            )}
                          >
                            <span className="font-semibold">{s.name}</span>
                          </button>
                        ))
                      ) : (
                        <p className="text-center text-sm text-white/50 py-4">Aucun coiffeur disponible</p>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-8">
          <Popover open={clientAccordion === "client"} onOpenChange={(open) => setClientAccordion(open ? "client" : "")}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group flex flex-col items-center gap-2"
              >
                <div className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all",
                  hasClientSelection
                    ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                    : "border-cyan-400/50 bg-transparent shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                )}>
                  <Users className="h-7 w-7 text-cyan-400" />
                </div>
                <span className="text-sm font-medium text-cyan-400">Client</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="center" className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1f2e] p-4 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
              <div className="space-y-4">
                <p className="text-lg font-bold text-white">Sélectionner un client</p>
                <Command className="rounded-xl bg-[#0d1117] border border-white/10">
                  <CommandInput
                    placeholder="Rechercher un client..."
                    value={clientSearch}
                    onValueChange={setClientSearch}
                    className="text-white"
                  />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty className="py-4 text-center text-sm text-white/50">
                      Aucun client trouvé
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredClients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.id}
                          onSelect={() => {
                            setClientId(c.id);
                            setClientAccordion("");
                            setClientSearch("");
                          }}
                          className="text-white hover:bg-white/10"
                        >
                          <span>{c.name}</span>
                          <span className="ml-2 text-xs text-white/50">{c.points} pts</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {clientId && (
                  <div className="flex items-center justify-between rounded-xl bg-cyan-400/10 px-4 py-2 border border-cyan-400/30">
                    <span className="text-sm text-cyan-100">{selectedClient?.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setClientId("");
                        setClientSearch("");
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Effacer
                    </button>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={newClientAccordionOpen} onOpenChange={setNewClientAccordionOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group flex flex-col items-center gap-2"
              >
                <div className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all",
                  usingNewClient && newClientFormComplete
                    ? "border-orange-400 bg-orange-400/10 shadow-[0_0_20px_rgba(251,146,60,0.4)]"
                    : "border-orange-400/50 bg-transparent shadow-[0_0_15px_rgba(251,146,60,0.2)]"
                )}>
                  <UserPlus className="h-7 w-7 text-orange-400" />
                </div>
                <span className="text-sm font-medium text-orange-400">Nouveau Client</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="center" className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1f2e] p-4 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
              <div className="space-y-4">
                <p className="text-lg font-bold text-white">Nouveau client</p>
                <div className="space-y-3">
                  <Input
                    placeholder="Prénom"
                    value={newClientFirstName}
                    onChange={(e) => setNewClientFirstName(e.target.value)}
                    className="rounded-xl bg-[#0d1117] border-white/10 text-white placeholder:text-white/40"
                  />
                  <Input
                    placeholder="Nom"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="rounded-xl bg-[#0d1117] border-white/10 text-white placeholder:text-white/40"
                  />
                  <Input
                    placeholder="Téléphone (10 chiffres)"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="rounded-xl bg-[#0d1117] border-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                {newClientFormComplete && (
                  <div className="rounded-xl bg-orange-400/10 px-4 py-2 border border-orange-400/30">
                    <span className="text-sm text-orange-100">{sanitizedNewClientName}</span>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex justify-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border-2 border-emerald-500/60 bg-transparent px-5 py-2.5 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/10 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
              >
                <Euro className="h-4 w-4" />
                <span>Total CA</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" className="w-48 rounded-xl border border-white/10 bg-[#1a1f2e] p-3 text-center">
              <p className="text-white/70 text-sm">Voir les statistiques dans la section ci-dessous</p>
            </PopoverContent>
          </Popover>

          <ServicesPicker
            key={`services-${stylistId}`}
            onServiceSelect={handleServiceSelect}
            onReset={handleServicesPickerReset}
            externalOpen={servicesPickerOpen}
            onOpenChange={setServicesPickerOpen}
            disabled={!stylistId}
            customTrigger={
              <button
                type="button"
                disabled={!stylistId}
                className={cn(
                  "flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-semibold transition-all",
                  stylistId
                    ? "border-purple-500/60 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                    : "border-white/20 text-white/40 cursor-not-allowed"
                )}
              >
                <ClipboardList className="h-4 w-4" />
                <span>Prestations</span>
              </button>
            }
          />

          <ProductsPicker
            key={`products-${stylistId}`}
            onProductSelect={handleProductSelect}
            externalOpen={productsPickerOpen}
            onOpenChange={setProductsPickerOpen}
            disabled={!stylistId}
            customTrigger={
              <button
                type="button"
                disabled={!stylistId}
                className={cn(
                  "flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-semibold transition-all",
                  stylistId
                    ? "border-orange-500/60 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400 shadow-[0_0_15px_rgba(251,146,60,0.15)]"
                    : "border-white/20 text-white/40 cursor-not-allowed"
                )}
              >
                <Package className="h-4 w-4" />
                <span>Produits</span>
              </button>
            }
          />
        </div>

        <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 rounded-2xl border-2 border-cyan-500/40 bg-transparent px-6 py-4 text-base font-semibold text-cyan-400 transition-all hover:bg-cyan-500/10 hover:border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)]"
            >
              <ClipboardList className="h-5 w-5" />
              <span>Détails Coiffeur</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="center" className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1f2e] p-4 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
            <div className="space-y-4">
              <p className="text-lg font-bold text-white">Détails du coiffeur</p>
              {selectedStylist ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#0d1117] p-4 border border-white/10">
                    <p className="text-sm text-white/60">Nom</p>
                    <p className="text-lg font-semibold text-white">{selectedStylist.name}</p>
                  </div>
                  <div className="rounded-xl bg-[#0d1117] p-4 border border-white/10">
                    <p className="text-sm text-white/60">Prestations aujourd'hui</p>
                    <p className="text-lg font-semibold text-white">{(selectedStylist as any).stats?.dailyCount ?? 0}</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-white/50 py-4">Sélectionnez d'abord un coiffeur</p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {amount && paymentPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-[#1a1f2e] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.7)] border border-white/10">
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
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="text-xl font-bold text-white">Moyen de paiement</span>
              </div>
              <div className="space-y-3">
                {PAYMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = payment === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handlePaymentSelect(option.value)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-xl bg-[#0d1117] px-5 py-4 text-left transition-all border-2",
                        isSelected
                          ? "border-cyan-400 bg-cyan-400/10"
                          : "border-transparent hover:bg-white/5"
                      )}
                    >
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl",
                        isSelected ? "bg-cyan-400/20 text-cyan-400" : "bg-white/10 text-white/60"
                      )}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="text-lg font-semibold text-white">{option.label}</span>
                      {isSelected && (
                        <Check className="ml-auto h-5 w-5 text-cyan-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
