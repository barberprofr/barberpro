import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ChevronDown, CircleDollarSign, CreditCard, FileText, Sparkles, ArrowLeft } from "lucide-react";
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

    // Les pilules PRESTATIONS et PRODUITS s'affichent automatiquement après sélection du coiffeur
    // L'utilisateur clique sur la pilule de son choix pour ouvrir le dialog correspondant
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
          setShowSuccess(true);
          dialogsOpenedForSessionRef.current = false;
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
              setShowSuccess(true);
              dialogsOpenedForSessionRef.current = false;
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
        // Submit multiple prestations
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
          setShowSuccess(true);
          dialogsOpenedForSessionRef.current = false;
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
              setShowSuccess(true);
              dialogsOpenedForSessionRef.current = false;
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
    <Card className="border-none shadow-md bg-card">
      <CardHeader>
        <div className="flex items-center justify-end gap-3">
          <div className="flex items-center gap-2 rounded-full bg-slate-800/80 px-4 py-1.5 text-sm text-slate-100">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-700 text-sm font-semibold uppercase">{salonInitials}</span>
            <span className="font-semibold max-w-[9rem] truncate" title={salonDisplayName}>{salonDisplayName}</span>
          </div>
        </div>
      </CardHeader>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
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
        <div className="flex gap-4 sm:flex-row flex-col">
          <div className="space-y-2">
            <div
              className={cn(
                "group relative w-full max-w-[20rem] overflow-hidden rounded-3xl border border-white/18 bg-[linear-gradient(135deg,rgba(12,18,45,0.95)0%,rgba(99,102,241,0.68)52%,rgba(16,185,129,0.52)100%)] px-4 pb-4 shadow-[0_28px_72px_rgba(8,15,40,0.55)] backdrop-blur-2xl transition-all duration-300",
                stylistId ? "border-emerald-300/70 shadow-[0_36px_92px_rgba(16,185,129,0.45)]" : null
              )}
            >
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_55%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex items-center justify-end pt-4">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={refreshStylists}
                  disabled={isRefreshing}
                  title="Rafraîchir"
                  className="inline-flex items-center gap-0.5 rounded-full border border-violet-300/60 bg-white/10 px-1.5 py-0.25 text-[8px] font-semibold uppercase tracking-wide text-white transition-all duration-200 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-wait disabled:opacity-80"
                >
                  <span>Rafraîchir</span>
                  <AnimatePresence initial={false}>
                    {isRefreshing ? (
                      <motion.span
                        key="refreshing-spinner"
                        initial={{ opacity: 0, rotate: -45 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: 45 }}
                        transition={{ duration: 0.2 }}
                        className="inline-flex"
                      >
                        <Loader2 className="h-2 w-2 animate-spin text-white" />
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </motion.button>
              </div>
              <Popover open={stylistPickerOpen} onOpenChange={setStylistPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "group relative z-10 mt-3 flex w-full items-center justify-between gap-4 overflow-hidden rounded-3xl border border-white/18 bg-white/10 px-6 py-4 text-left text-xl font-semibold text-white shadow-[0_32px_80px_rgba(8,15,40,0.58)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_40px_100px_rgba(79,70,229,0.48)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80",
                      stylistId ? "border-emerald-300/70 bg-emerald-400/15 shadow-[0_40px_100px_rgba(16,185,129,0.48)]" : null
                    )}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_55%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="relative flex flex-col text-left gap-1">
                      <span className="min-h-[2.25rem] text-2xl font-black leading-tight text-white drop-shadow-[0_2px_14px_rgba(8,15,40,0.6)]">
                        {selectedStylist ? selectedStylist.name : ""}
                      </span>
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
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleStylistSelect(s.id)}
                              className={cn(
                                "group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(7,12,30,0.96)0%,rgba(15,23,42,0.92)55%,rgba(2,6,23,0.88)100%)] p-5 text-left text-white shadow-[0_24px_60px_rgba(8,15,40,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_32px_78px_rgba(15,23,42,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 backdrop-blur-xl",
                                stylistId === s.id && "border-emerald-300/70 shadow-[0_36px_88px_rgba(16,185,129,0.45)]"
                              )}
                            >
                              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_55%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
                              <div className="relative flex flex-col gap-4">
                                <span className="flex items-center gap-2 text-3xl font-black tracking-wide text-white">
                                  <span
                                    className={cn(
                                      "h-2 w-2 rounded-full transition-colors",
                                      stylistId === s.id ? "bg-emerald-300" : "bg-sky-300/80"
                                    )}
                                  />
                                  {s.name}
                                </span>
                                {stylistId === s.id ? (
                                  <span className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-300/70 bg-emerald-400/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 shadow-[0_12px_28px_rgba(16,185,129,0.35)]">
                                    Sélectionné
                                  </span>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-slate-300 hover:text-slate-50"
                      onClick={() => setStylistPickerOpen(false)}
                    >
                      Fermer
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Pilules PRESTATIONS et PRODUITS - affichées après sélection du coiffeur */}
        {stylistId && !amount && (
          <div className="flex justify-center gap-3 mt-4">
            {/* Pilule PRESTATIONS - outline violet */}
            <button
              type="button"
              onClick={() => setServicesPickerOpen(true)}
              className="rounded-full border border-violet-500/70 bg-transparent px-6 py-2.5 text-violet-400 font-medium transition-all duration-200 hover:border-violet-400 hover:text-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
            >
              Prestations
            </button>

            {/* Pilule PRODUITS - filled avec texte orange */}
            <button
              type="button"
              onClick={() => setProductsPickerOpen(true)}
              className="rounded-full border border-slate-700 bg-slate-900/90 px-6 py-2.5 text-amber-500 font-medium transition-all duration-200 hover:border-slate-600 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
            >
              Produits
            </button>
          </div>
        )}

        {amount ? (
          <div className="flex justify-center w-full mt-6">
            <div className="flex flex-col items-center gap-1 text-center w-full max-w-md">

              {paymentPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="w-full max-w-md rounded-3xl border border-emerald-400/50 bg-gradient-to-br from-slate-950/95 via-indigo-900/70 to-emerald-800/40 p-6 text-slate-50 shadow-[0_40px_100px_rgba(8,15,40,0.8)] backdrop-blur-2xl animate-in zoom-in-95 duration-200">
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
                    <div className="space-y-4">
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
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
        <Popover open={clientAccordion === "client"} onOpenChange={(open) => {
          if (open) {
            setClientAccordion("client");
          } else {
            setClientAccordion("");
          }
        }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "group relative overflow-hidden rounded-lg border px-2 py-1.5 text-center text-slate-100 transition shadow-[0_8px_20px_rgba(8,15,40,0.25)] w-full",
                hasClientSelection
                  ? "border-emerald-300/30 bg-slate-950/60"
                  : "border-[#8c7cff]/35 bg-[linear-gradient(135deg,rgba(50,34,118,0.5)0%,rgba(58,52,182,0.36)45%,rgba(14,165,233,0.28)100%)]"
              )}
            >
              <div className="flex w-full flex-col items-center gap-0.5 text-center">
                <span className="inline-flex items-center gap-0.5 rounded-full border border-white/20 bg-white/8 px-2 py-0.5 text-xs font-semibold text-white/85 shadow-[0_3px_8px_rgba(79,70,229,0.18)] leading-tight">
                  <Sparkles className="h-1.5 w-1.5 text-amber-200" />
                  Sélectionner un client
                </span>
                {hasClientSelection ? (
                  <span className="text-xs font-medium text-emerald-100">{clientSummary}</span>
                ) : (
                  <span className="text-[7.5px] uppercase tracking-[0.24em] text-[#c1b8ff]">Choisissez un client pour continuer</span>
                )}
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="center" className="w-[min(90vw,40rem)] overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 p-4 shadow-[0_40px_95px_rgba(8,15,40,0.7)] backdrop-blur-xl">
            <div className="space-y-2">
              <div className={selectionContainerClass}>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">Sélection</label>
                  <div className="flex items-center gap-2">
                    {!hasClientSelection && <span className="text-[10px] font-semibold text-[#c3b8ff]">Requis</span>}
                    {clientId && (
                      <button
                        type="button"
                        onClick={() => {
                          setClientId("");
                          setClientPickerOpen(false);
                          setClientSearch("");
                        }}
                        className="text-[10px] font-semibold uppercase tracking-wide text-[#d0c3ff] underline underline-offset-2 hover:text-[#a99bf7]"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                </div>
                <Popover
                  open={clientPickerOpen}
                  onOpenChange={(open) => {
                    setClientPickerOpen(open);
                    if (open) {
                      setClientAccordion("client");
                    } else {
                      setClientSearch("");
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientPickerOpen}
                      className={cn(
                        "group relative mt-2 w-full justify-between overflow-hidden rounded-2xl border px-3.5 py-2.5 text-sm font-semibold transition-all",
                        hasClientSelection
                          ? "border-emerald-300/60 bg-emerald-300/20 text-emerald-100 shadow-[0_16px_40px_rgba(16,185,129,0.25)]"
                          : "border-[#8c7cff]/65 bg-[linear-gradient(135deg,rgba(60,37,115,0.78)0%,rgba(80,61,201,0.6)60%,rgba(17,94,89,0.48)100%)] text-[#f4ebff] shadow-[0_18px_45px_rgba(76,29,149,0.35)]"
                      )}
                      title={clientSelectionTitle}
                    >
                      <span className="flex flex-col items-start text-left gap-1">
                        {selectedClient ? (
                          <>
                            <span className="text-base font-bold">{selectedClient.name} - {selectedClient.points} pts</span>
                            {selectedClient.phone && (
                              <span className="text-xs text-muted-foreground">{selectedClient.phone}</span>
                            )}
                          </>
                        ) : usingNewClient && newClientFormComplete ? (
                          <>
                            <span className="text-base font-bold">{sanitizedNewClientName} - nouveau</span>
                            {sanitizedNewClientPhone && (
                              <span className="text-xs text-muted-foreground">{sanitizedNewClientPhone}</span>
                            )}
                          </>
                        ) : (
                          <span>Rechercher un client</span>
                        )}
                      </span>
                      <span className={cn("ml-2", hasClientSelection ? "text-emerald-200" : "text-[#e1d5ff]")}>▾</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 overflow-hidden rounded-3xl border border-white/15 bg-slate-950/90 p-0 shadow-[0_32px_70px_rgba(8,15,40,0.7)] backdrop-blur-2xl focus:outline-none">
                    <Command>
                      <CommandInput
                        placeholder="Rechercher par nom ou téléphone"
                        autoFocus
                        value={clientSearch}
                        onValueChange={setClientSearch}
                        className="h-11 rounded-2xl border border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.26)0%,rgba(148,163,184,0.18)45%,rgba(56,189,248,0.16)100%)] text-lg text-white placeholder:text-white/70 shadow-[0_18px_40px_rgba(8,15,40,0.32)] backdrop-blur-2xl focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-0"
                      />
                      <CommandList>


                        {clientSearch.trim().length === 0 ? (
                          <div className="py-6 text-center text-xs text-white/70">
                            Tapez un nom ou un numéro pour afficher les clients.
                          </div>
                        ) : filteredClients.length === 0 ? (
                          <CommandEmpty>Aucun client trouvé</CommandEmpty>
                        ) : (
                          <CommandGroup className="space-y-1 px-2 py-2">
                            {filteredClients.map((c) => {
                              const searchValue = [c.name, c.phone ?? ""].filter(Boolean).join(" ");
                              return (
                                <CommandItem
                                  key={c.id}
                                  value={searchValue}
                                  className="flex cursor-pointer flex-col gap-1 rounded-2xl border border-transparent bg-white/5 px-3 py-2 text-slate-100 transition hover:border-emerald-300/60 hover:bg-emerald-400/20"
                                  onSelect={() => {
                                    setClientId(c.id);
                                    setClientPickerOpen(false);
                                    setClientSearch("");
                                    setClientAccordion("");
                                  }}
                                >
                                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                    {c.name}
                                  </span>
                                  <div className="flex items-center gap-2 text-xs text-white/70">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/50 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                                      {c.points} pts
                                    </span>
                                    {c.phone && (
                                      <span className="text-[11px] text-white/70">{c.phone}</span>
                                    )}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <Popover open={newClientAccordionOpen} onOpenChange={setNewClientAccordionOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full flex-col items-center gap-1 rounded-3xl border border-white/12 bg-white/10 px-4 py-2 text-center text-sm font-semibold text-amber-200 transition-colors hover:bg-white/20 shadow-[0_18px_45px_rgba(8,15,40,0.35)] backdrop-blur-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/60 bg-amber-200/10 px-3.5 py-1 text-lg font-bold tracking-wide text-amber-200">
                      <Sparkles className="h-3 w-3 text-amber-300" />
                      Nouveau client
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-150",
                        newClientAccordionOpen ? "rotate-180" : "rotate-0"
                      )}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center" className="w-[min(90vw,32rem)] overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 p-4 shadow-[0_40px_95px_rgba(8,15,40,0.7)] backdrop-blur-xl">
                  <div className="space-y-2">
                    <Input
                      value={newClientName}
                      onChange={(e) => {
                        const v = e.target.value.normalize("NFC").replace(/[^\p{L} \-']/gu, "");
                        setNewClientName(v);
                      }}
                      inputMode="text"
                      autoComplete="family-name"
                      placeholder="Nom"
                      required={usingNewClient}
                      aria-invalid={usingNewClient && !sanitizedNewClientLastName}
                    />
                    <Input
                      value={newClientFirstName}
                      onChange={(e) => {
                        const v = e.target.value.normalize("NFC").replace(/[^\p{L} \-']/gu, "");
                        setNewClientFirstName(v);
                      }}
                      inputMode="text"
                      autoComplete="given-name"
                      placeholder="Prénom"
                      required={usingNewClient}
                      aria-invalid={usingNewClient && !sanitizedNewClientFirstName}
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
                      placeholder="Téléphone"
                      required={usingNewClient}
                      aria-invalid={usingNewClient && sanitizedNewClientPhoneDigits.length !== PHONE_DIGITS_REQUIRED}
                    />
                    {usingNewClient && sanitizedNewClientPhoneDigits.length !== PHONE_DIGITS_REQUIRED ? (
                      <p className="text-[11px] font-semibold text-rose-400">
                        Le numéro doit contenir exactement 10 chiffres.
                      </p>
                    ) : null}
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
                      className="mt-2 w-full rounded-2xl border border-amber-300/60 bg-amber-300/15 px-3 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-300/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-300/15 flex items-center justify-center gap-2"
                    >
                      {addClient.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Création en cours...
                        </>
                      ) : (
                        "Valider le nouveau client"
                      )}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </PopoverContent>
        </Popover>
      </form >
    </Card >
  );
}
