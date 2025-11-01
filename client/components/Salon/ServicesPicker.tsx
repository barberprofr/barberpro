import { motion } from "framer-motion";
import { useServices } from "@/lib/api";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ServicesPickerProps {
  onServiceSelect?: (serviceId: string, serviceName: string, price: number) => void;
  onReset?: (closeFunc: () => void) => void;
}

export default function ServicesPicker({ onServiceSelect, onReset }: ServicesPickerProps) {
  const { data: services = [] } = useServices();
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    onReset?.(() => setPopoverOpen(false));
  }, [onReset]);

  const hasServices = services.length > 0;

  const handleServiceSelect = useCallback((serviceId: string, serviceName: string, price: number) => {
    onServiceSelect?.(serviceId, serviceName, price);
    setPopoverOpen(false);
  }, [onServiceSelect]);

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full rounded-2xl border border-white/18 bg-[linear-gradient(135deg,rgba(12,18,45,0.95)0%,rgba(99,102,241,0.68)52%,rgba(16,185,129,0.52)100%)] px-4 py-3 text-lg font-black text-white transition-all hover:bg-[linear-gradient(135deg,rgba(12,18,45,0.95)0%,rgba(99,102,241,0.75)52%,rgba(16,185,129,0.6)100%)] shadow-[0_10px_24px_rgba(8,15,40,0.3)]",
            "flex justify-between items-center"
          )}
        >
          <span>PRESTATIONS</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", popoverOpen ? "rotate-180" : "")} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" className="w-[min(90vw,36rem)] rounded-2xl border border-white/15 bg-[linear-gradient(135deg,rgba(4,11,46,0.92)0%,rgba(11,27,77,0.78)55%,rgba(16,45,115,0.58)100%)] shadow-[0_40px_95px_rgba(8,15,40,0.7)] backdrop-blur-xl p-0">
        {hasServices ? (
          <motion.div layout className="space-y-2 max-h-[60vh] overflow-y-auto p-4 elegant-scrollbar">
            {services.map((service) => (
              <motion.button
                key={service.id}
                layout
                onClick={() => handleServiceSelect(service.id, service.name, service.price)}
                className="group relative w-full overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(140deg,rgba(8,15,40,0.88)0%,rgba(27,51,122,0.7)55%,rgba(46,91,181,0.55)100%)] p-3 text-left shadow-[0_18px_45px_rgba(15,23,42,0.35)] backdrop-blur-xl transition hover:border-white/30 hover:bg-[linear-gradient(140deg,rgba(8,15,40,0.92)0%,rgba(27,51,122,0.78)55%,rgba(46,91,181,0.62)100%)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-3 rounded-full border border-white/35 bg-white/15 px-6 py-2.5 text-base font-bold text-white w-fit">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                      {service.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-primary">
                      {service.price.toFixed(2)}€
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            Aucun service enregistré pour le moment. Allez dans les paramètres pour en ajouter.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
