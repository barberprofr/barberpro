import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useServices, useAddService, useDeleteService, useReorderServices, useProductTypes, useAddProductType, useDeleteProductType, useReorderProductTypes, Service } from "@/lib/api";
import { Trash2, Plus, GripVertical, Check, Scissors, Package, UserRound, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { AnimatePresence, motion } from "framer-motion";

interface ServicesManagerProps {
  accordionValue?: string;
  onAccordionChange?: (value: string) => void;
  onCloseParent?: () => void;
  onOpenCoiffeur?: () => void;
  isCoiffeurOpen?: boolean;
  onCloseCoiffeur?: () => void;
  onOpenAcompte?: () => void;
  isAcompteOpen?: boolean;
  onCloseAcompte?: () => void;
}

export default function ServicesManager({ accordionValue = "", onAccordionChange, onCloseParent, onOpenCoiffeur, isCoiffeurOpen, onCloseCoiffeur, onOpenAcompte, isAcompteOpen, onCloseAcompte }: ServicesManagerProps) {
  const { data: services = [] } = useServices();
  const { data: productTypes = [] } = useProductTypes();
  const addService = useAddService();
  const deleteService = useDeleteService();
  const reorderServices = useReorderServices();
  const addProductType = useAddProductType();
  const deleteProductType = useDeleteProductType();
  const reorderProductTypes = useReorderProductTypes();

  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");

  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  
  const [showAddConfirmation, setShowAddConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<"service" | "product">("service");
  const confirmationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmationTimeoutRef.current) {
        window.clearTimeout(confirmationTimeoutRef.current);
      }
    };
  }, []);

  // Drag and drop state for services
  const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);
  const [dragOverServiceId, setDragOverServiceId] = useState<string | null>(null);
  const dragCounter = useRef(0);

  // Drag and drop state for products
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const productDragCounter = useRef(0);

  const handleDragStart = useCallback((e: React.DragEvent, serviceId: string) => {
    setDraggedServiceId(serviceId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", serviceId);
    // Add a slight delay to allow the drag image to be set
    requestAnimationFrame(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = "0.5";
    });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = "1";
    setDraggedServiceId(null);
    setDragOverServiceId(null);
    dragCounter.current = 0;
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, serviceId: string) => {
    e.preventDefault();
    dragCounter.current++;
    if (serviceId !== draggedServiceId) {
      setDragOverServiceId(serviceId);
    }
  }, [draggedServiceId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverServiceId(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetServiceId: string) => {
    e.preventDefault();
    dragCounter.current = 0;
    
    if (!draggedServiceId || draggedServiceId === targetServiceId) {
      setDraggedServiceId(null);
      setDragOverServiceId(null);
      return;
    }

    // Reorder services
    const currentOrder = services.map(s => s.id);
    const draggedIndex = currentOrder.indexOf(draggedServiceId);
    const targetIndex = currentOrder.indexOf(targetServiceId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged item and insert at new position
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedServiceId);

    // Call API to save new order
    reorderServices.mutate(newOrder);

    setDraggedServiceId(null);
    setDragOverServiceId(null);
  }, [draggedServiceId, services, reorderServices]);

  // Product drag handlers
  const handleProductDragStart = useCallback((e: React.DragEvent, productId: string) => {
    setDraggedProductId(productId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", productId);
    requestAnimationFrame(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = "0.5";
    });
  }, []);

  const handleProductDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = "1";
    setDraggedProductId(null);
    setDragOverProductId(null);
    productDragCounter.current = 0;
  }, []);

  const handleProductDragEnter = useCallback((e: React.DragEvent, productId: string) => {
    e.preventDefault();
    productDragCounter.current++;
    if (productId !== draggedProductId) {
      setDragOverProductId(productId);
    }
  }, [draggedProductId]);

  const handleProductDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    productDragCounter.current--;
    if (productDragCounter.current === 0) {
      setDragOverProductId(null);
    }
  }, []);

  const handleProductDrop = useCallback((e: React.DragEvent, targetProductId: string) => {
    e.preventDefault();
    productDragCounter.current = 0;
    
    if (!draggedProductId || draggedProductId === targetProductId) {
      setDraggedProductId(null);
      setDragOverProductId(null);
      return;
    }

    const currentOrder = productTypes.map(p => p.id);
    const draggedIndex = currentOrder.indexOf(draggedProductId);
    const targetIndex = currentOrder.indexOf(targetProductId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedProductId);

    reorderProductTypes.mutate(newOrder);

    setDraggedProductId(null);
    setDragOverProductId(null);
  }, [draggedProductId, productTypes, reorderProductTypes]);

  const handleAddService = () => {
    if (!servicePrice.trim()) return;
    const price = parseFloat(servicePrice);
    if (isNaN(price) || price < 0) return;

    const autoName = serviceDescription.trim() || `Prestation ${new Date().getTime()}`;
    addService.mutate(
      {
        name: autoName,
        price,
        description: serviceDescription.trim() || undefined,
      },
      {
        onSuccess: () => {
          setServiceName("");
          setServicePrice("");
          setServiceDescription("");
          
          setConfirmationType("service");
          setShowAddConfirmation(true);
          if (confirmationTimeoutRef.current) {
            window.clearTimeout(confirmationTimeoutRef.current);
          }
          confirmationTimeoutRef.current = window.setTimeout(() => {
            setShowAddConfirmation(false);
          }, 2000);
        },
      }
    );
  };

  const handleAddProduct = () => {
    if (!productName.trim() || !productPrice.trim()) return;
    const price = parseFloat(productPrice);
    if (isNaN(price) || price < 0) return;

    addProductType.mutate(
      {
        name: productName.trim(),
        price,
      },
      {
        onSuccess: () => {
          setProductName("");
          setProductPrice("");
          
          setConfirmationType("product");
          setShowAddConfirmation(true);
          if (confirmationTimeoutRef.current) {
            window.clearTimeout(confirmationTimeoutRef.current);
          }
          confirmationTimeoutRef.current = window.setTimeout(() => {
            setShowAddConfirmation(false);
          }, 2000);
        },
      }
    );
  };

  const glassPanelClasses = "relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-sm shadow-[0_32px_96px_rgba(8,15,40,0.25)]";
  const cardButtonClasses = "group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-orange-400/60 bg-orange-500/10 px-4 py-4 transition-all duration-300 hover:scale-[1.05] hover:border-orange-300 hover:shadow-[0_0_25px_rgba(249,115,22,0.4)] active:scale-[1.08] active:border-orange-200 active:bg-orange-400/20 active:shadow-[0_0_40px_rgba(249,115,22,0.6)]";

  return (
    <>
      <AnimatePresence>
        {showAddConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddConfirmation(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative"
            >
              <div
                className="absolute -inset-1 rounded-2xl opacity-80"
                style={{
                  background: confirmationType === "service"
                    ? "conic-gradient(from 0deg, #a855f7, #ec4899, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7)"
                    : "conic-gradient(from 0deg, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #f97316, #22c55e, #06b6d4)",
                  animation: "spin 3s linear infinite",
                }}
              />
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.4), 0 0 60px rgba(168, 85, 247, 0.2)",
                    "0 0 30px rgba(236, 72, 153, 0.6), 0 0 50px rgba(236, 72, 153, 0.4), 0 0 70px rgba(236, 72, 153, 0.2)",
                    "0 0 25px rgba(34, 197, 94, 0.6), 0 0 45px rgba(34, 197, 94, 0.4), 0 0 65px rgba(34, 197, 94, 0.2)",
                    "0 0 20px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.4), 0 0 60px rgba(168, 85, 247, 0.2)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/20 bg-slate-900/95 px-10 py-8 backdrop-blur-xl"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full",
                    confirmationType === "service"
                      ? "bg-gradient-to-br from-purple-500 to-fuchsia-600"
                      : "bg-gradient-to-br from-cyan-500 to-blue-600"
                  )}
                >
                  <Check className="h-8 w-8 text-white" strokeWidth={3} />
                </motion.div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">Ajout pris en compte</p>
                  <p className="mt-1 text-sm text-white/60">
                    {confirmationType === "service" ? "Prestation ajoutée" : "Produit ajouté"}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className={cn(glassPanelClasses, "p-6 space-y-4")}>
      <Accordion type="single" collapsible value={accordionValue} onValueChange={(val) => {
        onAccordionChange?.(val ?? "");
        if (val === "") {
          setTimeout(() => {
            onCloseParent?.();
          }, 100);
        }
      }}>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <AccordionItem value="services" className="border-0">
            <AccordionTrigger className="py-0 hover:no-underline [&>svg]:hidden w-full">
              <div className={cn(cardButtonClasses, "w-full min-h-[100px]")}>
                <Scissors className="h-6 w-6 text-orange-400/80" />
                <span className="text-xs font-bold text-orange-400">Prestations</span>
                <span className="text-[9px] text-white/60">Enregistrer</span>
              </div>
            </AccordionTrigger>
          </AccordionItem>

          <AccordionItem value="products" className="border-0">
            <AccordionTrigger className="py-0 hover:no-underline [&>svg]:hidden w-full">
              <div className={cn(cardButtonClasses, "w-full min-h-[100px]")}>
                <Package className="h-6 w-6 text-orange-400/80" />
                <span className="text-xs font-bold text-orange-400">Produits</span>
                <span className="text-[9px] text-white/60">Enregistrer</span>
              </div>
            </AccordionTrigger>
          </AccordionItem>

          <div 
            className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-amber-400/60 bg-transparent px-2 py-3 min-h-[100px] cursor-pointer transition-all duration-300 hover:scale-[1.05] hover:border-amber-300 hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] active:scale-[1.08] active:border-yellow-200 active:bg-amber-400/20 active:shadow-[0_0_40px_rgba(255,200,50,0.8)]"
            onClick={() => {
              if (isCoiffeurOpen) {
                onCloseCoiffeur?.();
              } else {
                onOpenCoiffeur?.();
              }
            }}
          >
            <UserRound className="h-6 w-6 text-amber-400/70" />
            <span className="text-xs font-bold text-amber-400">Coiffeur</span>
            <span className="text-[9px] text-white/60">Ajouter</span>
          </div>

          <div 
            className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-emerald-400/60 bg-transparent px-2 py-3 min-h-[100px] cursor-pointer transition-all duration-300 hover:scale-[1.05] hover:border-emerald-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-[1.08] active:border-emerald-200 active:bg-emerald-400/20 active:shadow-[0_0_40px_rgba(16,185,129,0.8)]"
            onClick={() => {
              if (isAcompteOpen) {
                onCloseAcompte?.();
              } else {
                onOpenAcompte?.();
              }
            }}
          >
            <Wallet className="h-6 w-6 text-emerald-400/70" />
            <span className="text-xs font-bold text-emerald-400 text-center leading-tight">Acompte coiffeur</span>
            <span className="text-[9px] text-white/60">Gérer</span>
          </div>
        </div>

        <AccordionItem value="services" className="border-0">
          <AccordionTrigger className="hidden" />
          <AccordionContent className="border-0 pb-0 pt-6">
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-base font-semibold text-gray-100">Description (optionnel)</label>
                  <Input
                    type="text"
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    placeholder="ex: Coupe + lavage"
                    className="mt-2 h-10 bg-slate-900/70 border-white/25 text-base text-gray-100 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="text-base font-semibold text-gray-100">Prix (€)</label>
                  <Input
                    type="number"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    placeholder="ex: 15.00"
                    step="0.01"
                    min="0"
                    className="mt-2 h-10 bg-slate-900/70 border-white/25 text-base text-gray-100 placeholder:text-gray-400 no-spinner"
                  />
                </div>

                <Button
                  onClick={handleAddService}
                  disabled={!servicePrice.trim() || addService.isPending}
                  className="w-full mt-4 h-11 text-base font-semibold"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Ajouter
                </Button>
              </div>

              {services.length > 0 && (
                <div className="space-y-3">
                  <div className="text-base font-bold text-gray-100">
                    Services enregistrés:
                    <span className="ml-2 text-sm font-normal text-gray-400">(glisser pour réorganiser)</span>
                  </div>
                  <div className="grid gap-3">
                    {services.map((service) => (
                      <Card 
                        key={service.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, service.id)}
                        onDragEnd={handleDragEnd}
                        onDragEnter={(e) => handleDragEnter(e, service.id)}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, service.id)}
                        className={cn(
                          "border border-white/16 bg-white/8 cursor-grab active:cursor-grabbing transition-all duration-200",
                          draggedServiceId === service.id && "opacity-50 scale-95",
                          dragOverServiceId === service.id && draggedServiceId !== service.id && "border-purple-400/60 bg-purple-500/20 scale-[1.02] shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                        )}
                      >
                        <CardContent className="px-4 py-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0 cursor-grab" />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-base text-gray-100 truncate">{service.name}</div>
                              <div className="text-sm text-gray-400 mt-1">
                                {service.price.toFixed(2)}€
                                {service.description && ` - ${service.description}`}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteService.mutate(service.id);
                            }}
                            disabled={deleteService.isPending}
                            className="text-red-400 hover:text-red-300 flex-shrink-0"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="products" className="border-0">
          <AccordionTrigger className="hidden" />
          <AccordionContent className="border-0 pb-0 pt-6">
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-base font-semibold text-gray-100">Nom du produit</label>
                  <Input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="ex: Shampoing"
                    className="mt-2 h-10 bg-slate-900/70 border-white/25 text-base text-gray-100 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="text-base font-semibold text-gray-100">Prix (€)</label>
                  <Input
                    type="number"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    placeholder="ex: 12.00"
                    step="0.01"
                    min="0"
                    className="mt-2 h-10 bg-slate-900/70 border-white/25 text-base text-gray-100 placeholder:text-gray-400 no-spinner"
                  />
                </div>

                <Button
                  onClick={handleAddProduct}
                  disabled={!productName.trim() || !productPrice.trim() || addProductType.isPending}
                  className="w-full mt-4 h-11 text-base font-semibold"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Ajouter
                </Button>
              </div>

              {productTypes.length > 0 && (
                <div className="space-y-3">
                  <div className="text-base font-bold text-gray-100">Produits enregistrés:</div>
                  <div className="grid gap-3">
                    {productTypes.map((productType) => (
                      <Card 
                        key={productType.id} 
                        className={cn(
                          "border border-white/16 bg-white/8 cursor-grab active:cursor-grabbing transition-all duration-200",
                          draggedProductId === productType.id && "opacity-50 scale-[0.98]",
                          dragOverProductId === productType.id && draggedProductId !== productType.id && "border-primary/50 bg-primary/10"
                        )}
                        draggable
                        onDragStart={(e) => handleProductDragStart(e, productType.id)}
                        onDragEnd={handleProductDragEnd}
                        onDragEnter={(e) => handleProductDragEnter(e, productType.id)}
                        onDragLeave={handleProductDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleProductDrop(e, productType.id)}
                      >
                        <CardContent className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <GripVertical className="h-5 w-5 text-gray-500 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="font-semibold text-base text-gray-100">{productType.name}</div>
                              <div className="text-sm text-gray-400 mt-1">
                                {productType.price.toFixed(2)}€
                                {productType.description && ` - ${productType.description}`}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProductType.mutate(productType.id)}
                            disabled={deleteProductType.isPending}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
    </>
  );
}
