import SharedLayout from "@/components/SharedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAdminLogin, useDeleteClient, useClients, useRedeemPoints, useConfig, useStylists, useUploadClientPhoto, useDeleteClientPhoto } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Search, Camera, ChevronLeft, ChevronRight, X, Trash2, Image as ImageIcon } from "lucide-react";

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
  const filtered = searchTerm === "" ? [] : (clients ?? []).filter(c => 
    c.name.toLowerCase().includes(searchTerm) || 
    (c.phone && c.phone.replace(/\D/g, "").includes(searchTerm.replace(/\D/g, "")))
  );
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

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelected("");
      setQuery("");
      setRedeemPoints(redeemDefault > 0 ? String(redeemDefault) : "");
      setRedeemStylistId("");
      setStylistAccordionOpen(false);
    }
  };

  return (
    <SharedLayout>
      <div className="min-h-full" onClick={handleBackgroundClick}>
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
        <Card className="border border-white/20 shadow-md bg-black/12 backdrop-blur-md rounded-[22px]">
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
              className="overflow-hidden rounded-3xl border border-white/20 bg-black/15 p-4 shadow-[0_26px_60px_rgba(8,15,40,0.3)] backdrop-blur-md"
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
                              </div>
              <div className="relative mt-4">
                <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/15 bg-white/10 opacity-80" />
                <Input
                  ref={searchRef}
                  className="relative z-10 h-12 rounded-2xl border border-transparent bg-slate-950/70 pl-11 pr-4 text-sm font-semibold text-slate-100 shadow-[0_18px_45px_rgba(56,189,248,0.25)] placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-300"
                  placeholder="Rechercher un client (nom, prénom, téléphone)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200" />
              </div>
            </motion.div>
            </CardContent>
        </Card>
        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered
              .filter((c) => !selected || selected === c.id)
              .map((c) => {
              return (
                <Card
                  key={c.id}
                  className="overflow-hidden rounded-2xl border border-white/20 bg-slate-900/90 shadow-[0_25px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-white/30 hover:shadow-[0_30px_70px_rgba(0,0,0,0.5)] cursor-pointer"
                  onClick={() => {
                    setSelected(c.id);
                    setQuery(c.name);
                    setRedeemPoints(redeemDefault > 0 ? String(redeemDefault) : "");
                  }}
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                        <div className="flex flex-col">
                          <span className="text-xl font-bold text-white">{c.name}</span>
                          {c.phone && (
                            <span className="text-sm font-medium text-white/60">{c.phone}</span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-4 py-2">
                        <span className="text-lg font-bold text-cyan-300">{c.points} pts</span>
                      </div>
                    </div>
                    <Button
                      size="default"
                      variant="ghost"
                      className="w-full rounded-xl border-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white transition hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 px-5 py-3 text-base font-semibold shadow-[0_4px_15px_rgba(245,158,11,0.4)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(c.id);
                        setQuery(c.name);
                        setRedeemPoints(redeemDefault > 0 ? String(redeemDefault) : "");
                      }}
                    >
                      Sélectionner
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          ) : null}
        </div>

        {/* Popup Client sélectionné */}
        <Dialog open={!!selected && !!selectedClient} onOpenChange={(open) => {
          if (!open) {
            setSelected("");
          }
        }}>
          <DialogContent className="w-[min(95vw,32rem)] max-h-[90vh] overflow-y-auto rounded-2xl border border-white/25 bg-slate-900/95 p-0 shadow-[0_25px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            {selectedClient && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                    <div className="flex flex-col">
                      <span className="text-xl font-bold text-white">{selectedClient.name}</span>
                      {selectedClient.phone && (
                        <span className="text-sm font-medium text-white/60">{selectedClient.phone}</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-4 py-2">
                    <span className="text-lg font-bold text-cyan-300">{selectedClient.points} pts</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    size="default"
                    variant="ghost"
                    className="flex-1 rounded-xl border border-white/20 bg-slate-800/80 text-white/90 transition hover:bg-slate-700 hover:text-white px-5 py-3 text-base font-semibold"
                    onClick={() => setSelected("")}
                  >
                    Fermer
                  </Button>
                  <Button
                    size="default"
                    variant="ghost"
                    className="flex-1 rounded-xl border-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white transition hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 px-5 py-3 text-base font-semibold shadow-[0_4px_15px_rgba(245,158,11,0.4)]"
                    onClick={() => {
                      const email = window.prompt("Email admin requis:") || "";
                      if (!/.+@.+\..+/.test(email)) return;
                      const pwd = window.prompt("Code admin requis:") || "";
                      if (!pwd) return;
                      adminLogin.mutate({ email, password: pwd }, {
                        onSuccess: () => delClient.mutate(selectedClient.id, {
                          onSuccess: () => setSelected("")
                        }),
                      });
                    }}
                  >
                    Supprimer
                  </Button>
                </div>

                <div className="h-px bg-white/10" />
                <h4 className="text-sm font-medium text-white/80">Utiliser des points</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex gap-2">
                      <Input
                        ref={pointsRef}
                        placeholder={redeemDefault > 0 ? String(redeemDefault) : "0"}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={redeemDefault > 0 ? String(redeemDefault) : redeemPoints}
                        readOnly={redeemDefault > 0}
                        className="bg-slate-800/80 border-white/20 text-white"
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
                      <Button disabled={!canRedeem || redeem.isPending} onClick={handleRedeem} className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white">
                        Utiliser
                      </Button>
                    </div>
                    {redeemDefault > 0 ? (
                      <p className="text-[11px] text-white/60 mt-1">
                        Montant fixe: {redeemDefault} point{redeemDefault > 1 ? "s" : ""}
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
                      className="overflow-hidden rounded-xl border border-white/20 bg-slate-800/50"
                    >
                      <AccordionTrigger className="px-4 py-3 text-sm font-semibold text-white">
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 text-sm text-white/80">
                            <Sparkles className="h-3 w-3 text-amber-300" />
                            Coiffeur
                          </span>
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${redeemStylist ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300" : "border-white/30 bg-white/10 text-white/70"}`}>
                            {redeemStylist ? redeemStylist.name : "Sélectionner"}
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
                                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium transition ${isSelectedStylist ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300" : "border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    {s.name}
                                  </span>
                                  <span className="text-xs opacity-70">
                                    {isSelectedStylist ? "Choisi" : "Choisir"}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/60">
                              Aucun coiffeur disponible
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                <div className="h-px bg-white/10" />
                <h4 className="text-sm font-medium text-white/80">Photos</h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedClient.photos?.map((photo, i) => (
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
                            deletePhoto.mutate({ clientId: selectedClient.id, photoUrl: photo });
                          }
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 bg-white/5 hover:bg-white/10 transition min-h-[100px] py-4">
                    {uploadPhoto.isPending ? (
                      <Loader2 className="h-10 w-10 animate-spin text-white/60" />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-white/60" />
                    )}
                    <span className="text-sm font-medium text-white/60">Galerie</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      disabled={uploadPhoto.isPending}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          await uploadPhoto.mutateAsync({ clientId: selectedClient.id, file: e.target.files[0] });
                        }
                      }}
                    />
                  </label>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 bg-white/5 hover:bg-white/10 transition min-h-[100px] py-4">
                    {uploadPhoto.isPending ? (
                      <Loader2 className="h-10 w-10 animate-spin text-white/60" />
                    ) : (
                      <Camera className="h-10 w-10 text-white/60" />
                    )}
                    <span className="text-sm font-medium text-white/60">Caméra</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      capture="environment"
                      disabled={uploadPhoto.isPending}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          await uploadPhoto.mutateAsync({ clientId: selectedClient.id, file: e.target.files[0] });
                        }
                      }}
                    />
                  </label>
                </div>

                <Button
                  size="default"
                  variant="ghost"
                  className="w-full rounded-xl border-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-600 text-white transition hover:from-cyan-600 hover:via-blue-600 hover:to-cyan-700 px-5 py-3 text-base font-semibold shadow-[0_4px_15px_rgba(6,182,212,0.4)]"
                  onClick={() => {
                    setSelected("");
                  }}
                >
                  Sélectionner ce client
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </SharedLayout>
  );
}
