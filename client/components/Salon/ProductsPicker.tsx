import { motion } from "framer-motion";
import { useProductTypes } from "@/lib/api";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ProductsPickerProps {
  onProductSelect?: (productId: string, productName: string, price: number) => void;
  onReset?: (closeFunc: () => void) => void;
}

export default function ProductsPicker({ onProductSelect, onReset }: ProductsPickerProps) {
  const { data: productTypes = [] } = useProductTypes();
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    onReset?.(() => setPopoverOpen(false));
  }, [onReset]);

  const hasProducts = productTypes.length > 0;

  const handleProductSelect = useCallback((productId: string, productName: string, price: number) => {
    onProductSelect?.(productId, productName, price);
    setPopoverOpen(false);
  }, [onProductSelect]);

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full max-w-[20rem] rounded-2xl border border-white/18 bg-[linear-gradient(135deg,rgba(12,18,45,0.95)0%,rgba(16,185,129,0.68)52%,rgba(99,102,241,0.52)100%)] px-4 py-3 text-lg font-black text-white transition-all hover:bg-[linear-gradient(135deg,rgba(12,18,45,0.95)0%,rgba(16,185,129,0.75)52%,rgba(99,102,241,0.6)100%)] shadow-[0_10px_24px_rgba(8,15,40,0.3)]",
            "flex justify-between items-center"
          )}
        >
          <span>PRODUITS</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", popoverOpen ? "rotate-180" : "")} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" className="w-[min(90vw,36rem)] rounded-2xl border border-white/15 bg-[linear-gradient(135deg,rgba(4,11,46,0.92)0%,rgba(11,77,43,0.78)55%,rgba(16,115,45,0.58)100%)] shadow-[0_40px_95px_rgba(8,15,40,0.7)] backdrop-blur-xl p-0">
        {hasProducts ? (
          <motion.div layout className="space-y-2 max-h-[60vh] overflow-y-auto p-4 elegant-scrollbar">
            {productTypes.map((product) => (
              <motion.button
                key={product.id}
                layout
                onClick={() => handleProductSelect(product.id, product.name, product.price)}
                className="group relative w-full overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(140deg,rgba(8,15,40,0.88)0%,rgba(8,51,27,0.7)55%,rgba(16,181,46,0.55)100%)] p-3 text-left shadow-[0_18px_45px_rgba(15,23,42,0.35)] backdrop-blur-xl transition hover:border-white/30 hover:bg-[linear-gradient(140deg,rgba(8,15,40,0.92)0%,rgba(8,51,27,0.78)55%,rgba(16,181,46,0.62)100%)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-3 rounded-full border border-white/35 bg-white/15 px-6 py-2.5 text-base font-bold text-white w-fit">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      {product.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-emerald-400">
                      {product.price.toFixed(2)}€
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            Aucun produit enregistré pour le moment. Allez dans les paramètres pour en ajouter.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
