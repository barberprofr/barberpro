import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ChevronDown, CircleDollarSign, CreditCard, FileText, Sparkles, ArrowLeft, Scissors, Users, UserPlus } from "lucide-react";
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

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (servicesPickerOpen || productsPickerOpen || paymentPickerOpen || dialogWasOpenRef.current) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('[data-stylist-card]') || target.closest('[data-pill-button]')) {
      return;
    }
    if (stylistId && !amount) {
      refreshStylists();
    }
  }, [stylistId, amount, refreshStylists, servicesPickerOpen, productsPickerOpen, paymentPickerOpen]);

  return (
    <Card className="border-none shadow-md bg-slate-900/40 backdrop-blur-xl" onClick={handleBackgroundClick}>
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

        {/* Pilules Client et Nouveau Client - affichées en haut de la page */}
        <div className="flex justify-center gap-8 mb-6">
          {/* Pilule Client - cyan */}
          <motion.button
            type="button"
            onClick={() => {
              setNewClientAccordionOpen(false);
              setClientAccordion("client");
              setClientPickerOpen(true);
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "flex flex-col items-center gap-2 focus:outline-none transition-all duration-300"
            )}
          >
            <div className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-300",
              clientId
                ? "border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.6),inset_0_0_15px_rgba(34,211,238,0.2)]"
                : "border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
            )}>
              <Users className={cn(
                "h-7 w-7 transition-all duration-300",
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
              "text-sm font-medium transition-all duration-300",
              clientId ? "text-cyan-400" : "text-cyan-500"
            )}>
              Client
            </span>
          </motion.button>

          {/* Pilule Nouveau Client - orange */}
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
            className={cn(
              "flex flex-col items-center gap-2 focus:outline-none transition-all duration-300"
            )}
          >
            <div className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-300",
              usingNewClient && newClientFormComplete
                ? "border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6),inset_0_0_15px_rgba(251,191,36,0.2)]"
                : "border-amber-500/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
            )}>
              <UserPlus className={cn(
                "h-7 w-7 transition-all duration-300",
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
              "text-sm font-medium transition-all duration-300",
              usingNewClient && newClientFormComplete ? "text-amber-400" : "text-amber-500"
            )}>
              Nouveau Client
            </span>
          </motion.button>
        </div>

        <div className="flex gap-4 sm:flex-row flex-col">
          <div className="space-y-2">
            <div className="relative w-full max-w-[16rem]">
              <Popover open={stylistPickerOpen} onOpenChange={setStylistPickerOpen}>
                <PopoverTrigger asChild>
                  <motion.button
                    type="button"
                    data-stylist-card
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "group relative flex flex-col items-center justify-center gap-4 w-full rounded-3xl border-2 bg-slate-950 px-8 py-8 transition-all duration-300 focus:outline-none",
                      stylistId 
                        ? "border-violet-400 shadow-[0_0_35px_rgba(167,139,250,0.7),0_0_60px_rgba(167,139,250,0.4),inset_0_0_20px_rgba(167,139,250,0.15)] scale-[1.02]" 
                        : "border-violet-500/50 shadow-[0_0_20px_rgba(167,139,250,0.35)] hover:border-violet-400/70 hover:shadow-[0_0_28px_rgba(167,139,250,0.5)]"
                    )}
                  >
                    <motion.div
                      animate={{ 
                        filter: stylistId 
                          ? ["drop-shadow(0 0 12px rgba(34,211,238,0.8))", "drop-shadow(0 0 25px rgba(34,211,238,1))", "drop-shadow(0 0 12px rgba(34,211,238,0.8))"]
                          : ["drop-shadow(0 0 8px rgba(34,211,238,0.5))", "drop-shadow(0 0 15px rgba(34,211,238,0.7))", "drop-shadow(0 0 8px rgba(34,211,238,0.5))"]
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Scissors className={cn(
                        "h-12 w-12 transition-all duration-300",
                        stylistId ? "text-cyan-400" : "text-cyan-400"
                      )} />
                    </motion.div>
                    <span className={cn(
                      "text-lg font-semibold transition-all duration-300",
                      stylistId ? "text-white" : "text-slate-300"
                    )}>
                      {selectedStylist ? selectedStylist.name : "Coiffeur"}
                    </span>
                  </motion.button>
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
            <motion.button
              type="button"
              data-pill-button
              onClick={() => setServicesPickerOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95, y: 2 }}
              className={cn(
                "rounded-full border px-6 py-2.5 font-medium transition-all duration-200 focus:outline-none",
                servicesPickerOpen
                  ? "border-violet-400 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.6)] animate-pulse"
                  : "border-violet-500/70 bg-transparent text-violet-400 hover:border-violet-400 hover:text-violet-300"
              )}
            >
              Prestations
            </motion.button>

            {/* Pilule PRODUITS - outline orange (identique à Prestations) */}
            <motion.button
              type="button"
              data-pill-button
              onClick={() => setProductsPickerOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95, y: 2 }}
              className={cn(
                "rounded-full border px-6 py-2.5 font-medium transition-all duration-200 focus:outline-none bg-transparent",
                productsPickerOpen
                  ? "border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse"
                  : "border-amber-500/70 text-amber-500 hover:border-amber-400 hover:text-amber-400"
              )}
            >
              Produits
            </motion.button>
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
          <DialogContent className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="p-5 space-y-5">
              {/* Barre de recherche */}
              <div className="relative">
                <Input
                  placeholder="Rechercher par nom ou téléphone"
                  autoFocus
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/20 bg-white/5 pl-4 pr-4 text-base text-white placeholder:text-white/50 focus:border-cyan-400/60 focus:ring-0 focus:bg-white/10"
                />
              </div>

              {/* Liste des clients */}
              <div className="max-h-[40vh] overflow-y-auto">
                {clientSearch.trim().length === 0 ? (
                  <div className="py-8 text-center text-sm text-white/60">
                    Tapez un nom ou un numéro pour afficher les clients.
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="py-8 text-center text-sm text-white/60">
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
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-cyan-400/40 hover:bg-white/10"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-white">{c.name}</span>
                          {c.phone && (
                            <span className="text-xs text-white/50">{c.phone}</span>
                          )}
                        </div>
                        <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300">
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
                className="w-full rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/20"
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
          <DialogContent className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="p-5 space-y-4">
              <h3 className="text-lg font-semibold text-white text-center">Nouveau client</h3>
              
              <Input
                value={newClientFirstName}
                onChange={(e) => {
                  const v = e.target.value.normalize("NFC").replace(/[^\p{L} \-']/gu, "");
                  setNewClientFirstName(v);
                }}
                inputMode="text"
                autoComplete="given-name"
                placeholder="Prénom"
                className="h-12 rounded-xl border border-white/20 bg-white/5 text-white placeholder:text-white/50 focus:border-amber-400/60 focus:ring-0 focus:bg-white/10"
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
                className="h-12 rounded-xl border border-white/20 bg-white/5 text-white placeholder:text-white/50 focus:border-amber-400/60 focus:ring-0 focus:bg-white/10"
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
                className="h-12 rounded-xl border border-white/20 bg-white/5 text-white placeholder:text-white/50 focus:border-amber-400/60 focus:ring-0 focus:bg-white/10"
              />
              
              {usingNewClient && sanitizedNewClientPhoneDigits.length > 0 && sanitizedNewClientPhoneDigits.length !== PHONE_DIGITS_REQUIRED && (
                <p className="text-xs text-rose-400">
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
                className="w-full rounded-xl bg-amber-500/30 border border-amber-400/40 py-3 text-sm font-medium text-white transition hover:bg-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                className="w-full rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/20"
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
