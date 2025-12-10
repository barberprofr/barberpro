import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useServices, useAddService, useDeleteService, useProductTypes, useAddProductType, useDeleteProductType } from "@/lib/api";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

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

  const glassPanelClasses = "relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-sm shadow-[0_32px_96px_rgba(8,15,40,0.25)]";
  const pillHeadingClasses = "inline-flex items-center gap-2 rounded-full border-2 border-purple-300/30 bg-purple-500/10 backdrop-blur-sm px-4 py-2 text-sm font-bold uppercase tracking-[0.15em] text-purple-100 transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(168,85,247,0.4)] active:scale-105 active:border-white/80 active:shadow-[0_0_20px_rgba(168,85,247,0.8),0_25px_60px_rgba(168,85,247,0.6)] active:brightness-125";
  const pillHeadingProductsClasses = "inline-flex items-center gap-2 rounded-full border-2 border-cyan-300/30 bg-cyan-500/10 backdrop-blur-sm px-4 py-2 text-sm font-bold uppercase tracking-[0.15em] text-cyan-100 transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(6,182,212,0.4)] active:scale-105 active:border-white/80 active:shadow-[0_0_20px_rgba(6,182,212,0.8),0_25px_60px_rgba(6,182,212,0.6)] active:brightness-125";

  return (
    <div className={cn(glassPanelClasses, "p-6 space-y-0")}>
      <Accordion type="single" collapsible value={accordionValue} onValueChange={(val) => {
        onAccordionChange?.(val ?? "");
        if (val === "") {
          setTimeout(() => {
            onCloseParent?.();
          }, 100);
        }
      }}>
        <AccordionItem value="services" className="border-0">
          <AccordionTrigger className="flex items-center gap-2 py-0 hover:no-underline">
            <span className={pillHeadingClasses}>
              <span className="h-2.5 w-2.5 rounded-full bg-purple-300 animate-pulse" />
              Enregistrer les prestations
            </span>
          </AccordionTrigger>
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="products" className="border-0 mt-8">
          <AccordionTrigger className="flex items-center gap-2 py-0 hover:no-underline">
            <span className={pillHeadingProductsClasses}>
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 animate-pulse" />
              Enregistrer les produits
            </span>
          </AccordionTrigger>
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
