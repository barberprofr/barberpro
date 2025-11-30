import SharedLayout from "@/components/SharedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useAdminLogin, useDeleteClient, useClients, useRedeemPoints, useConfig, useStylists, useUploadClientPhoto, useDeleteClientPhoto } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Search, Camera, ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";

export default function Clients() {
  const { data: config, isLoading: cfgLoading } = useConfig();
  const redeemDefault = config?.pointsRedeemDefault ?? 0;
  const locked = !cfgLoading && !!config && !config.isAdmin;
  const qc = useQueryClient();
  const { data: clients } = useClients(!locked && !cfgLoading);
  const { data: stylists } = useStylists();
  const redeem = useRedeemPoints();
  const adminLogin = useAdminLogin();
  const delClient = useDeleteClient();
  const uploadPhoto = useUploadClientPhoto();
  const deletePhoto = useDeleteClientPhoto();
  const [redeemPoints, setRedeemPoints] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [redeemStylistId, setRedeemStylistId] = useState<string>("");
  const [stylistAccordionOpen, setStylistAccordionOpen] = useState(false);
  const [refreshPulse, setRefreshPulse] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const pointsRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const searchTerm = query.trim().toLowerCase();
  const filtered = searchTerm === "" ? [] : (clients ?? []).filter(c => c.name.toLowerCase().includes(searchTerm));
  const selectedClient = clients?.find(c => c.id === selected);
  const redeemStylist = stylists?.find(s => s.id === redeemStylistId) ?? null;
  const stylistsAvailable = (stylists?.length ?? 0) > 0;
  const redeemAmount = redeemDefault > 0 ? redeemDefault : Number(redeemPoints);
  const canRedeem = Boolean(
    selected &&
    redeemAmount > 0 &&
    redeemStylist &&
    stylistsAvailable &&
    (redeemDefault <= 0 || redeemAmount === redeemDefault)
  );

  useEffect(() => {
    if (redeemStylistId && !redeemStylist) {
      setRedeemStylistId("");
    }
  }, [redeemStylistId, redeemStylist]);

  const handleRefreshClick = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshPulse(true);
    try {
      setQuery("");
      setRedeemPoints(redeemDefault > 0 ? String(redeemDefault) : "");
      setSelected("");
      setRedeemStylistId("");
      setStylistAccordionOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["clients"] }),
        qc.invalidateQueries({ queryKey: ["stylists"] }),
      ]);
      searchRef.current?.focus({ preventScroll: true });
    } finally {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = window.setTimeout(() => {
        setRefreshPulse(false);
        refreshTimeoutRef.current = null;
      }, 900);
      setRefreshing(false);
    }
  };

  const handleRedeem = () => {
    if (!selected || !(redeemAmount > 0) || !redeemStylist) return;
    redeem.mutate(
      { clientId: selected, points: redeemAmount, reason: "remise", stylistId: redeemStylist.id },
      {
        onSuccess: () => {
          setRedeemPoints(redeemDefault > 0 ? String(redeemDefault) : "");
          setSelected("");
          setQuery("");
          setRedeemStylistId("");
          setStylistAccordionOpen(false);
          searchRef.current?.focus();
        },
      }
    );
  };

  useEffect(() => {
    if (redeemDefault > 0) {
      setRedeemPoints(String(redeemDefault));
    }
  }, [redeemDefault]);
  useEffect(() => { if (selected) pointsRef.current?.focus(); }, [selected]);
  useEffect(() => () => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewingPhotoIndex === null || !selectedClient?.photos) return;
      if (e.key === "Escape") setViewingPhotoIndex(null);
      if (e.key === "ArrowLeft") setViewingPhotoIndex((prev) => (prev === null ? null : (prev - 1 + selectedClient.photos.length) % selectedClient.photos.length));
      if (e.key === "ArrowRight") setViewingPhotoIndex((prev) => (prev === null ? null : (prev + 1) % selectedClient.photos.length));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingPhotoIndex, selectedClient]);

  return (
    <SharedLayout>
      <AnimatePresence>
        {viewingPhotoIndex !== null && selectedClient?.photos && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
            onClick={() => setViewingPhotoIndex(null)}
          >
            <button
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={() => setViewingPhotoIndex(null)}
            >
              <X className="h-6 w-6" />
            </button>

            <button
              className="absolute right-16 top-4 rounded-full bg-red-500/20 p-2 text-red-200 hover:bg-red-500/40"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Voulez-vous vraiment supprimer cette photo ?")) {
                  deletePhoto.mutate({ clientId: selectedClient.id, photoUrl: selectedClient.photos[viewingPhotoIndex] }, {
                    onSuccess: () => setViewingPhotoIndex(null)
                  });
                }
              }}
            >
              <Trash2 className="h-6 w-6" />
            </button>

            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                setViewingPhotoIndex((prev) => (prev === null ? null : (prev - 1 + selectedClient.photos.length) % selectedClient.photos.length));
              }}
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            <motion.img
              key={viewingPhotoIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              src={selectedClient.photos[viewingPhotoIndex]}
              alt="Client photo"
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                setViewingPhotoIndex((prev) => (prev === null ? null : (prev + 1) % selectedClient.photos.length));
              }}
            >
              <ChevronRight className="h-8 w-8" />
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1 text-sm text-white backdrop-blur-md">
              {viewingPhotoIndex + 1} / {selectedClient.photos.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mx-auto max-w-md space-y-4">
        <Card className="border-none shadow-md bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Clients & Fidélité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <motion.div
              animate={{
                scale: refreshPulse ? 1.02 : 1,
                boxShadow: refreshPulse ? "0 0 0 6px rgba(56, 189, 248, 0.28)" : "0 0 0 0 rgba(0,0,0,0)",
              }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-slate-950/85 via-indigo-900/60 to-emerald-800/35 p-4 shadow-[0_26px_60px_rgba(8,15,40,0.55)] backdrop-blur-xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRefreshClick}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/60 bg-cyan-400/20 px-4 py-1.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/80 hover:bg-cyan-300/30 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-cyan-300 disabled:hover:bg-cyan-400/20"
                  title="Rafraîchir"
                  aria-live="polite"
                >
                  {refreshing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Actualisation…
                    </>
                  ) : (
                    "Recherche client"
                  )}
                </button>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                  <Sparkles className="h-3 w-3 text-amber-200" />Actualiser
                </span>
              </div>
              <div className="relative mt-4">
                <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/15 bg-white/10 opacity-80" />
                <Input
                  ref={searchRef}
                  className="relative z-10 h-12 rounded-2xl border border-transparent bg-slate-950/70 pl-11 pr-4 text-sm font-semibold text-slate-100 shadow-[0_18px_45px_rgba(56,189,248,0.25)] placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-300"
                  placeholder="Rechercher un client (nom, prénom)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200" />
              </div>
            </motion.div>
            {selectedClient && (
              <div className="text-xs">Client sélectionné: <span className="inline-block bg-secondary text-secondary-foreground rounded px-2 py-0.5">{selectedClient.name}</span></div>
            )}
            {redeemStylist && (
              <div className="text-[11px] text-muted-foreground">Coiffeur sélectionné: <span className="font-medium text-primary">{redeemStylist.name}</span></div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Points à utiliser</label>
                <div className="mt-1 flex gap-2">
                  <Input
                    ref={pointsRef}
                    placeholder={redeemDefault > 0 ? String(redeemDefault) : "0"}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={redeemDefault > 0 ? String(redeemDefault) : redeemPoints}
                    readOnly={redeemDefault > 0}
                    onWheelCapture={(e) => e.preventDefault()}
                    onKeyDown={(e) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) e.preventDefault(); }}
                    onChange={(e) => {
                      if (redeemDefault > 0) {
                        setRedeemPoints(String(redeemDefault));
                        return;
                      }
                      setRedeemPoints(e.target.value.replace(/[^0-9]/g, ""));
                    }}
                  />
                  <Button disabled={!canRedeem || redeem.isPending} onClick={handleRedeem}>Utiliser</Button>
                </div>
                {redeemDefault > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Montant fixe: {redeemDefault} point{redeemDefault > 1 ? "s" : ""}. Modifiez-le dans Paramètres.
                  </p>
                ) : null}
              </div>
              <Accordion
                type="single"
                collapsible
                value={stylistAccordionOpen ? "stylist" : ""}
                onValueChange={(value) => {
                  const isOpen = value === "stylist";
                  setStylistAccordionOpen(isOpen);
                  if (!isOpen) {
                    setRedeemStylistId("");
                  }
                }}
              >
                <AccordionItem
                  value="stylist"
                  className="overflow-hidden rounded-3xl border border-transparent bg-[#050b18]/95 shadow-[0_26px_60px_rgba(5,11,24,0.65)] backdrop-blur-2xl transition duration-300 data-[state=open]:border-white/25"
                >
                  <AccordionTrigger className="relative px-4 py-3 text-sm font-semibold text-slate-100 before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(135deg,rgba(9,14,30,0.92)0%,rgba(24,34,85,0.78)45%,rgba(12,111,91,0.55)100%)] before:opacity-95 before:transition before:duration-300">
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/20 px-3.5 py-1 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(79,70,229,0.35)]">
                        <Sparkles className="h-3 w-3 text-amber-200" />
                        Coiffeur utilisateur des points
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-sm font-semibold tracking-wide transition ${redeemStylist ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-100 shadow-[0_8px_18px_rgba(16,185,129,0.35)]" : stylistsAvailable ? "border-white/45 bg-white/20 text-white" : "border-red-300/60 bg-red-400/25 text-red-100"}`}>
                        {redeemStylist ? redeemStylist.name : stylistsAvailable ? "Sélectionner" : "Aucun coiffeur"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0">
                    <div className="space-y-2 px-4 pb-4 pt-2">
                      {stylistsAvailable ? (
                        stylists?.map((s) => {
                          const isSelectedStylist = redeemStylistId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setRedeemStylistId(s.id);
                                setStylistAccordionOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-sm font-semibold backdrop-blur-md transition ${isSelectedStylist ? "border-emerald-300/70 bg-emerald-300/20 text-emerald-100 shadow-[0_12px_32px_rgba(16,185,129,0.25)]" : "border-white/18 bg-white/10 text-slate-100 hover:border-emerald-300/50 hover:bg-white/15"}`}
                            >
                              <span className="inline-flex items-center gap-2 text-base font-semibold text-white">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                {s.name}
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isSelectedStylist ? "border-white/40 bg-white/15 text-white" : "border-white/28 bg-white/10 text-white/80"}`}>
                                {isSelectedStylist ? "Choisi" : "Choisir"}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs text-white/85 backdrop-blur-md">
                          Aucun coiffeur disponible. Ajoutez-en depuis Paramètres.
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              {redeemStylist ? (
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {`Points imputés à ${redeemStylist.name}.`}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered.map((c) => {
              const isSelected = selected === c.id;
              return (
                <Card
                  key={c.id}
                  className={cn(
                    "overflow-hidden border border-white/12 bg-gradient-to-br from-slate-950/85 via-indigo-900/60 to-emerald-800/35 shadow-[0_20px_55px_rgba(8,15,40,0.55)] backdrop-blur-xl transition-all duration-300",
                    isSelected
                      ? "ring-2 ring-emerald-300/70"
                      : "hover:border-emerald-300/45 hover:shadow-[0_24px_60px_rgba(16,185,129,0.35)] hover:-translate-y-0.5"
                  )}
                >
                  <CardContent
                    className="flex cursor-pointer items-center justify-between gap-4 p-4"
                    onClick={() => {
                      setSelected((prev) => {
                        const next = prev === c.id ? "" : c.id;
                        if (prev !== c.id) {
                          setQuery(c.name);
                          setRedeemPoints(redeemDefault > 0 ? String(redeemDefault) : "");
                        }
                        return next;
                      });
                    }}
                  >
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-sm font-semibold text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        {c.name}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/45 bg-emerald-300/15 px-3 py-0.5 text-xs font-semibold text-emerald-100">
                        Solde <span className="text-white">{c.points} pts</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "rounded-full border border-white/30 bg-white/15 text-white/90 transition hover:border-emerald-300/60 hover:bg-emerald-400/25 hover:text-white",
                          isSelected && "border-emerald-300/70 bg-emerald-400/25 text-white"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected((prev) => {
                            const next = prev === c.id ? "" : c.id;
                            if (prev !== c.id) {
                              setQuery(c.name);
                              setRedeemPoints(redeemDefault > 0 ? String(redeemDefault) : "");
                            }
                            return next;
                          });
                        }}
                      >
                        {isSelected ? "Fermer" : "Sélectionner"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full border border-red-400/60 bg-red-400/20 text-red-100 transition hover:border-red-300 hover:bg-red-400/35"
                        onClick={(e) => {
                          e.stopPropagation();
                          const email = window.prompt("Email admin requis:") || "";
                          if (!/.+@.+\..+/.test(email)) return;
                          const pwd = window.prompt("Code admin requis:") || "";
                          if (!pwd) return;
                          adminLogin.mutate({ email, password: pwd }, {
                            onSuccess: () => delClient.mutate(c.id),
                          });
                        }}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </CardContent>
                  {isSelected && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="h-px bg-white/10" />
                      <h4 className="text-sm font-medium text-white/80">Photos</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {c.photos?.map((photo, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={photo}
                              alt={`Client photo ${i + 1}`}
                              className="aspect-square rounded-lg object-cover border border-white/10 cursor-pointer hover:opacity-80 transition w-full"
                              onClick={() => setViewingPhotoIndex(i)}
                            />
                            <button
                              className="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-500/80"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm("Supprimer cette photo ?")) {
                                  deletePhoto.mutate({ clientId: c.id, photoUrl: photo });
                                }
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/25 bg-white/5 hover:bg-white/10 transition">
                          {uploadPhoto.isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                          ) : (
                            <Camera className="h-5 w-5 text-white/60" />
                          )}
                          <span className="text-[10px] text-white/60">Ajouter</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            disabled={uploadPhoto.isPending}
                            onChange={async (e) => {
                              if (e.target.files && e.target.files[0]) {
                                await uploadPhoto.mutateAsync({ clientId: c.id, file: e.target.files[0] });
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          ) : null}
        </div>
      </div>
    </SharedLayout>
  );
}
