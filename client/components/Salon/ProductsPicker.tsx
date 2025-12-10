import { motion, AnimatePresence } from "framer-motion";
import { useProductTypes } from "@/lib/api";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SelectedProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ProductsPickerProps {
  onProductSelect?: (products: SelectedProduct[]) => void;
  onReset?: (closeFunc: () => void) => void;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export default function ProductsPicker({ onProductSelect, onReset, externalOpen, onOpenChange, disabled }: ProductsPickerProps) {
  const { data: productTypes = [] } = useProductTypes();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = typeof externalOpen !== "undefined";
  const popoverOpen = isControlled ? externalOpen : internalOpen;
  const setPopoverOpen = useCallback((open: boolean) => {
    if (disabled && open) {
      toast({
        title: "Action requise",
        description: "Veuillez sélectionner un coiffeur avant de choisir les produits.",
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

  const [selectedProducts, setSelectedProducts] = useState<Map<string, SelectedProduct>>(new Map());
  const [calculatorProductId, setCalculatorProductId] = useState<string | null>(null);

  useEffect(() => {
    onReset?.(() => {
      setPopoverOpen(false);
      setSelectedProducts(new Map());
    });
  }, [onReset]);

  const hasProducts = productTypes.length > 0;

  const toggleProduct = useCallback((productId: string, productName: string, price: number) => {
    setSelectedProducts(prev => {
      const newMap = new Map(prev);
      if (newMap.has(productId)) {
        newMap.delete(productId);
      } else {
        newMap.set(productId, { id: productId, name: productName, price, quantity: 1 });
      }
      return newMap;
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setSelectedProducts(prev => {
      const newMap = new Map(prev);
      const product = newMap.get(productId);
      if (product) {
        newMap.set(productId, { ...product, quantity });
      }
      return newMap;
    });
    setCalculatorProductId(null);
  }, []);

  const total = Array.from(selectedProducts.values()).reduce(
    (sum, p) => sum + p.price * p.quantity,
    0
  );

  const handleValidate = useCallback(() => {
    if (selectedProducts.size > 0) {
      onProductSelect?.(Array.from(selectedProducts.values()));
      setPopoverOpen(false);
    }
  }, [selectedProducts, onProductSelect]);

  return (
    <Dialog open={popoverOpen} onOpenChange={setPopoverOpen}>
      <DialogContent className="max-w-[min(90vw,36rem)] rounded-2xl border border-white/25 bg-black/15 shadow-[0_40px_95px_rgba(8,15,40,0.3)] backdrop-blur-[4px] p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-xl font-black text-white">PRODUITS</DialogTitle>
        </DialogHeader>
        {hasProducts ? (
          <div className="flex flex-col">
            {/* Total display at top */}
            <AnimatePresence>
              {selectedProducts.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-b border-white/15 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-100">Total</span>
                    <span className="text-5xl font-black text-fuchsia-300" style={{ WebkitTextStroke: '0.5px black' }}>{total.toFixed(2)}€</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div layout className="space-y-2 max-h-[50vh] overflow-y-auto p-4 elegant-scrollbar">
              {productTypes.map((product) => {
                const isSelected = selectedProducts.has(product.id);
                const selectedData = selectedProducts.get(product.id);

                return (
                  <motion.div
                    key={product.id}
                    layout
                    onClick={() => !isSelected && toggleProduct(product.id, product.name, product.price)}
                    className={cn(
                      "group relative w-full overflow-hidden rounded-2xl border p-3 shadow-[0_10px_30px_rgba(15,23,42,0.15)] backdrop-blur-[2px] transition",
                      isSelected
                        ? "border-emerald-400/50 bg-emerald-900/20"
                        : "border-white/25 bg-slate-900/25 cursor-pointer hover:border-white/40 hover:bg-slate-800/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkmark or Select Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProduct(product.id, product.name, product.price);
                        }}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all flex-shrink-0",
                          isSelected
                            ? "border-emerald-400 bg-emerald-500 text-white"
                            : "border-white/30 bg-white/10 text-white/50 hover:border-white/50 hover:bg-white/20"
                        )}
                      >
                        {isSelected && <Check className="h-5 w-5" />}
                      </button>

                      {/* Product name and price */}
                      <div className="flex-1 flex items-center justify-between gap-3">
                        <span className="text-base font-bold text-white">
                          {product.name}
                        </span>
                        <span className="text-sm font-semibold text-white/80">
                          {product.price.toFixed(2)}€
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
                                setTimeout(() => setCalculatorProductId(product.id), 150);
                              }}
                              whileTap={{ scale: 1.15, boxShadow: "0 0 20px rgba(52,211,153,0.8)" }}
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
                                toggleProduct(product.id, product.name, product.price);
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
              {calculatorProductId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                  onClick={() => setCalculatorProductId(null)}
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
                          onClick={() => setQuantity(calculatorProductId, num)}
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
              {selectedProducts.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-white/15 p-4"
                >
                  <motion.button
                    type="button"
                    onClick={handleValidate}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ 
                      scale: 1.08, 
                      y: -3,
                      boxShadow: "0 0 40px rgba(34,197,94,0.7), -15px 0 35px rgba(34,197,94,0.8), 15px 0 35px rgba(34,197,94,0.8), 0 25px 50px rgba(16,185,129,0.5)"
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-6 text-lg font-black text-white shadow-[0_15px_30px_rgba(16,185,129,0.3)] transition-all"
                  >
                    <span className="relative z-10">Valider ({selectedProducts.size} produit{selectedProducts.size > 1 ? 's' : ''})</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            Aucun produit enregistré pour le moment. Allez dans les paramètres pour en ajouter.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
