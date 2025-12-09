import { motion, AnimatePresence } from "framer-motion";
import { useProductTypes } from "@/lib/api";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  customTrigger?: React.ReactNode;
}

export default function ProductsPicker({ onProductSelect, onReset, externalOpen, onOpenChange, disabled, customTrigger }: ProductsPickerProps) {
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
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        {customTrigger || (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              if (disabled) {
                e.preventDefault();
                e.stopPropagation();
                toast({
                  title: "Action requise",
                  description: "Veuillez sélectionner un coiffeur avant de choisir les produits.",
                  variant: "destructive",
                });
              }
            }}
            className={cn(
              "w-full rounded-2xl border border-white/18 bg-[linear-gradient(135deg,rgba(12,18,45,0.95)0%,rgba(16,185,129,0.68)52%,rgba(99,102,241,0.52)100%)] px-4 py-3 text-lg font-black text-white transition-all hover:bg-[linear-gradient(135deg,rgba(12,18,45,0.95)0%,rgba(16,185,129,0.75)52%,rgba(99,102,241,0.6)100%)] shadow-[0_10px_24px_rgba(8,15,40,0.3)]",
              "flex justify-between items-center",
              disabled && "opacity-50 cursor-not-allowed grayscale"
            )}
          >
            <span>PRODUITS</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", popoverOpen ? "rotate-180" : "")} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" className="w-[min(90vw,36rem)] rounded-2xl border border-white/15 bg-[linear-gradient(135deg,rgba(4,11,46,0.92)0%,rgba(11,77,43,0.78)55%,rgba(16,115,45,0.58)100%)] shadow-[0_40px_95px_rgba(8,15,40,0.7)] backdrop-blur-xl p-0">
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
                    <span className="text-2xl font-black text-emerald-300">{total.toFixed(2)}€</span>
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
                      "group relative w-full overflow-hidden rounded-2xl border p-3 shadow-[0_18px_45px_rgba(15,23,42,0.35)] backdrop-blur-xl transition",
                      isSelected
                        ? "border-emerald-400/60 bg-[linear-gradient(140deg,rgba(16,185,129,0.25)0%,rgba(5,150,105,0.18)100%)]"
                        : "border-white/12 bg-[linear-gradient(140deg,rgba(8,15,40,0.88)0%,rgba(8,51,27,0.7)55%,rgba(16,181,46,0.55)100%)] cursor-pointer hover:border-white/30"
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
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCalculatorProductId(product.id);
                              }}
                              className="relative flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-950/40 px-3 py-1.5 hover:bg-emerald-900/50 transition cursor-pointer"
                            >
                              <span className="text-sm font-bold text-emerald-100">
                                Qté: {selectedData.quantity}
                              </span>
                            </button>

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
                  <Button
                    type="button"
                    onClick={handleValidate}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-6 text-lg font-black text-white shadow-[0_20px_40px_rgba(16,185,129,0.4)] hover:from-emerald-600 hover:to-emerald-700 transition-all hover:scale-105"
                  >
                    Valider ({selectedProducts.size} produit{selectedProducts.size > 1 ? 's' : ''})
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            Aucun produit enregistré pour le moment. Allez dans les paramètres pour en ajouter.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
