import { motion, AnimatePresence } from "framer-motion";
import { useServices } from "@/lib/api";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SelectedPrestation {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ServicesPickerProps {
  onServiceSelect?: (prestations: SelectedPrestation[]) => void;
  onReset?: (closeFunc: () => void) => void;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export default function ServicesPicker({ onServiceSelect, onReset, externalOpen, onOpenChange, disabled }: ServicesPickerProps) {
  const { data: services = [] } = useServices();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = typeof externalOpen !== "undefined";
  const popoverOpen = isControlled ? externalOpen : internalOpen;
  const setPopoverOpen = useCallback((open: boolean) => {
    if (disabled && open) {
      toast({
        title: "Action requise",
        description: "Veuillez sélectionner un coiffeur avant de choisir les prestations.",
        variant: "destructive",
      });
      return;
    }
    if (isControlled) {
      onOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
  }, [isControlled, onOpenChange, disabled, toast]);



  const [selectedPrestations, setSelectedPrestations] = useState<Map<string, SelectedPrestation>>(new Map());
  const [calculatorServiceId, setCalculatorServiceId] = useState<string | null>(null);
  const [animatingQtyId, setAnimatingQtyId] = useState<string | null>(null);

  useEffect(() => {
    onReset?.(() => {
      setPopoverOpen(false);
      setSelectedPrestations(new Map());
    });
  }, [onReset]);

  const hasServices = services.length > 0;

  const toggleService = useCallback((serviceId: string, serviceName: string, price: number) => {
    setSelectedPrestations(prev => {
      const newMap = new Map(prev);
      if (newMap.has(serviceId)) {
        newMap.delete(serviceId);
      } else {
        newMap.set(serviceId, { id: serviceId, name: serviceName, price, quantity: 1 });
      }
      return newMap;
    });
  }, []);

  const setQuantity = useCallback((serviceId: string, quantity: number) => {
    setSelectedPrestations(prev => {
      const newMap = new Map(prev);
      const prestation = newMap.get(serviceId);
      if (prestation) {
        newMap.set(serviceId, { ...prestation, quantity });
      }
      return newMap;
    });
    setCalculatorServiceId(null);
  }, []);

  const total = Array.from(selectedPrestations.values()).reduce(
    (sum, p) => sum + p.price * p.quantity,
    0
  );

  const handleValidate = useCallback(() => {
    if (selectedPrestations.size > 0) {
      onServiceSelect?.(Array.from(selectedPrestations.values()));
      setPopoverOpen(false);
    }
  }, [selectedPrestations, onServiceSelect]);

  return (
    <Dialog open={popoverOpen} onOpenChange={setPopoverOpen}>
      <DialogContent className="max-w-[min(90vw,36rem)] rounded-2xl border border-white/25 bg-black/15 shadow-[0_40px_95px_rgba(8,15,40,0.3)] backdrop-blur-[4px] p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-xl font-black text-white">PRESTATIONS</DialogTitle>
        </DialogHeader>
        {hasServices ? (
          <div className="flex flex-col">
            {/* Total display at top */}
            <AnimatePresence>
              {selectedPrestations.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-b border-white/15 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 px-4 py-3"
                >
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-emerald-100">Total</span>
                    <span className="flex-1 text-center text-5xl font-black text-cyan-300" style={{ WebkitTextStroke: '0.5px black' }}>{total.toFixed(2)}€</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Services list */}
            <motion.div layout className="space-y-2 max-h-[60vh] overflow-y-auto p-4 elegant-scrollbar">
              {services.map((service) => {
                const isSelected = selectedPrestations.has(service.id);
                const selectedData = selectedPrestations.get(service.id);

                return (
                  <motion.div
                    key={service.id}
                    layout
                    onClick={() => !isSelected && toggleService(service.id, service.name, service.price)}
                    whileHover={!isSelected ? { scale: 1.03, y: -2, boxShadow: "0 0 20px rgba(139,92,246,0.4), 0 15px 40px rgba(15,23,42,0.25)" } : {}}
                    whileTap={!isSelected ? { scale: 1.08, y: -6, boxShadow: "0 0 35px rgba(139,92,246,0.7), 0 0 60px rgba(52,211,153,0.4), 0 20px 50px rgba(52,211,153,0.3)" } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={cn(
                      "group relative w-full overflow-hidden rounded-2xl border p-3 shadow-[0_10px_30px_rgba(15,23,42,0.15)] backdrop-blur-[2px] transition",
                      isSelected
                        ? "border-emerald-400/50 bg-emerald-900/20"
                        : "border-white/25 bg-slate-900/25 cursor-pointer hover:border-white/40 hover:bg-slate-800/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkmark or Select Button - 3D Multi-ring Style */}
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleService(service.id, service.name, service.price);
                        }}
                        animate={isSelected ? { 
                          scale: [1, 1.15, 1],
                          boxShadow: ["0 0 0px rgba(52,211,153,0)", "0 0 50px rgba(52,211,153,1)", "0 0 30px rgba(52,211,153,0.7)"]
                        } : {}}
                        transition={{ duration: 0.5 }}
                        className="relative flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0"
                      >
                        {/* Outer ring - Blue/Cyan gradient */}
                        <div className={cn(
                          "absolute inset-0 rounded-full transition-all duration-300",
                          isSelected 
                            ? "bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 shadow-[0_0_25px_rgba(6,182,212,0.6)]"
                            : "bg-gradient-to-br from-slate-600/50 via-slate-500/30 to-slate-600/50"
                        )} />
                        
                        {/* Middle ring - White/Silver */}
                        <div className={cn(
                          "absolute inset-[3px] rounded-full transition-all duration-300",
                          isSelected
                            ? "bg-gradient-to-br from-white/90 via-gray-200/80 to-white/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
                            : "bg-gradient-to-br from-white/30 via-white/20 to-white/10"
                        )} />
                        
                        {/* Inner circle - Green gradient semi-transparent */}
                        <div className={cn(
                          "absolute inset-[6px] rounded-full transition-all duration-300 flex items-center justify-center",
                          isSelected
                            ? "bg-gradient-to-br from-emerald-400/90 via-green-500/85 to-teal-600/90 shadow-[inset_0_3px_6px_rgba(255,255,255,0.4),inset_0_-3px_6px_rgba(0,0,0,0.2)]"
                            : "bg-gradient-to-br from-white/15 via-white/10 to-white/5 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)]"
                        )}>
                          {/* Glass reflection */}
                          <div className="absolute inset-x-1 top-1 h-[45%] rounded-t-full bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
                          {isSelected && <Check className="h-5 w-5 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)] relative z-10" />}
                        </div>
                      </motion.button>

                      {/* Service name and price */}
                      <div className="flex-1 flex items-center justify-between gap-3">
                        <span className="text-lg font-bold text-white">
                          {service.name}
                        </span>
                        <span className="text-lg font-semibold text-white/80">
                          {service.price.toFixed(2)}€
                        </span>
                      </div>

                      {/* Quantity controls (only if selected) */}
                      <AnimatePresence>
                        {isSelected && selectedData && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Quantity display - clickable to open calculator */}
                            <motion.button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAnimatingQtyId(service.id);
                                setTimeout(() => {
                                  setAnimatingQtyId(null);
                                  setCalculatorServiceId(service.id);
                                }, 200);
                              }}
                              animate={animatingQtyId === service.id ? { scale: 1.15, boxShadow: "0 0 20px rgba(52,211,153,0.8)" } : { scale: 1, boxShadow: "0 0 0px rgba(52,211,153,0)" }}
                              transition={{ type: "spring", stiffness: 400, damping: 15 }}
                              className="relative flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-950/40 px-3 py-1.5 hover:bg-emerald-900/50 transition cursor-pointer"
                            >
                              <span className="text-sm font-bold text-emerald-100">
                                Qté: {selectedData.quantity}
                              </span>
                            </motion.button>

                            {/* Deselect button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleService(service.id, service.name, service.price);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-600 transition flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Calculator Popup */}
            <AnimatePresence>
              {calculatorServiceId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                  onClick={() => setCalculatorServiceId(null)}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-[min(90vw,20rem)] rounded-3xl border border-emerald-400/50 bg-gradient-to-br from-slate-950/95 via-indigo-900/70 to-emerald-800/40 p-6 shadow-[0_40px_100px_rgba(8,15,40,0.8)] backdrop-blur-2xl"
                  >
                    <h3 className="mb-4 text-center text-xl font-bold text-emerald-100">
                      Sélectionner la quantité
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setQuantity(calculatorServiceId, num)}
                          className="flex h-16 w-full items-center justify-center rounded-xl border-2 border-emerald-400/50 bg-gradient-to-br from-emerald-600/30 to-emerald-700/20 text-2xl font-black text-white transition-all hover:scale-105 hover:border-emerald-300 hover:bg-gradient-to-br hover:from-emerald-500/40 hover:to-emerald-600/30 active:scale-95"
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Validate button at bottom */}
            <AnimatePresence>
              {selectedPrestations.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-white/15 p-4"
                >
                  <motion.button
                    type="button"
                    onClick={handleValidate}
                    whileHover={{ scale: 1.04, y: -4, boxShadow: "0 0 25px rgba(167,139,250,0.7), 0 0 50px rgba(139,92,246,0.5), -15px 0 30px rgba(167,139,250,0.6), 15px 0 30px rgba(167,139,250,0.6)" }}
                    whileTap={{ 
                      scale: 1.15, 
                      y: -10,
                      background: "linear-gradient(135deg, rgba(20,184,166,0.95) 0%, rgba(34,211,238,0.9) 50%, rgba(52,211,153,0.95) 100%)",
                      boxShadow: "0 0 60px rgba(20,184,166,0.9), 0 0 100px rgba(20,184,166,0.6), -20px 0 50px rgba(6,182,212,0.7), 20px 0 50px rgba(6,182,212,0.7), 0 30px 60px rgba(16,185,129,0.5)"
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 12 }}
                    className="relative w-full overflow-hidden rounded-2xl py-5 text-lg font-black text-white shadow-[0_8px_32px_rgba(20,184,166,0.4),inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all"
                    style={{
                      background: "linear-gradient(135deg, rgba(5,90,80,0.4) 0%, rgba(3,60,70,0.35) 50%, rgba(2,75,55,0.4) 100%)",
                      border: "2px solid rgba(94,234,212,0.4)",
                      backdropFilter: "blur(6px)"
                    }}
                  >
                    {/* Reflet glass 3D */}
                    <div className="absolute inset-x-2 top-1 h-[40%] rounded-t-xl bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                    <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">Valider ({selectedPrestations.size} prestation{selectedPrestations.size > 1 ? 's' : ''})</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            Aucun service enregistré pour le moment. Allez dans les paramètres pour en ajouter.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
