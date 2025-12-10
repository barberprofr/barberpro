import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useServices, useAddService, useDeleteService, useProductTypes, useAddProductType, useDeleteProductType } from "@/lib/api";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ServicesManagerProps {
  accordionValue?: string;
  onAccordionChange?: (value: string) => void;
  onCloseParent?: () => void;
}

export default function ServicesManager({ accordionValue = "", onAccordionChange, onCloseParent }: ServicesManagerProps) {
  const { data: services = [] } = useServices();
  const { data: productTypes = [] } = useProductTypes();
  const addService = useAddService();
  const deleteService = useDeleteService();
  const addProductType = useAddProductType();
  const deleteProductType = useDeleteProductType();

  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");

  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");

  const [servicesPopupOpen, setServicesPopupOpen] = useState(false);
  const [productsPopupOpen, setProductsPopupOpen] = useState(false);

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
        },
      }
    );
  };

  const glassPanelClasses = "relative rounded-3xl border border-white/16 bg-gradient-to-br from-white/12 via-white/6 to-transparent backdrop-blur-3xl shadow-[0_32px_96px_rgba(8,15,40,0.52)]";
  const pillHeadingClasses = "inline-flex items-center gap-2 rounded-full border border-purple-300/70 bg-purple-500/20 px-4 py-2 text-sm font-bold uppercase tracking-[0.15em] text-purple-100";
  const pillHeadingProductsClasses = "inline-flex items-center gap-2 rounded-full border border-cyan-300/70 bg-cyan-500/20 px-4 py-2 text-sm font-bold uppercase tracking-[0.15em] text-cyan-100";

  return (
    <div className={cn(glassPanelClasses, "p-6 space-y-4")}>
      <button
        type="button"
        onClick={() => setServicesPopupOpen(true)}
        className="flex items-center gap-2 py-2 hover:opacity-80 transition"
      >
        <span className={pillHeadingClasses}>
          <span className="h-2.5 w-2.5 rounded-full bg-purple-300 animate-pulse" />
          Enregistrer les prestations
        </span>
      </button>

      <button
        type="button"
        onClick={() => setProductsPopupOpen(true)}
        className="flex items-center gap-2 py-2 hover:opacity-80 transition"
      >
        <span className={pillHeadingProductsClasses}>
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 animate-pulse" />
          Enregistrer les produits
        </span>
      </button>

      <AnimatePresence>
        {servicesPopupOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setServicesPopupOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-white/20 bg-black/5 backdrop-blur-md p-4 shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold text-white">Enregistrer les prestations</span>
                <button
                  type="button"
                  onClick={() => setServicesPopupOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                >
                  ✕
                </button>
              </div>
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
                    <div className="text-base font-bold text-gray-100">Services enregistrés:</div>
                    <div className="grid gap-3">
                      {services.map((service) => (
                        <Card key={service.id} className="border border-white/16 bg-white/8">
                          <CardContent className="px-4 py-3 flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-base text-gray-100">{service.name}</div>
                              <div className="text-sm text-gray-400 mt-1">
                                {service.price.toFixed(2)}€
                                {service.description && ` - ${service.description}`}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteService.mutate(service.id)}
                              disabled={deleteService.isPending}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {productsPopupOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setProductsPopupOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-white/20 bg-black/5 backdrop-blur-md p-4 shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold text-white">Enregistrer les produits</span>
                <button
                  type="button"
                  onClick={() => setProductsPopupOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                >
                  ✕
                </button>
              </div>
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
                        <Card key={productType.id} className="border border-white/16 bg-white/8">
                          <CardContent className="px-4 py-3 flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-base text-gray-100">{productType.name}</div>
                              <div className="text-sm text-gray-400 mt-1">
                                {productType.price.toFixed(2)}€
                                {productType.description && ` - ${productType.description}`}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
