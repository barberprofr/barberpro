import { useState, useMemo } from "react";
import { useClients, useAddPoints } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { playSuccessSound } from "@/lib/sounds";

export default function PointsManager() {
    const { data: clients, isLoading: clientsLoading } = useClients();
    const addPoints = useAddPoints();
    const { toast } = useToast();

    const [open, setOpen] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [points, setPoints] = useState<string>("1");

    const selectedClient = useMemo(
        () => clients?.find((client) => client.id === selectedClientId),
        [clients, selectedClientId]
    );

    const handleAddPoints = async () => {
        if (!selectedClientId || !points) return;
        const pointsNum = parseInt(points, 10);
        if (isNaN(pointsNum) || pointsNum <= 0) {
            toast({
                title: "Erreur",
                description: "Veuillez entrer un nombre de points valide.",
                variant: "destructive",
            });
            return;
        }

        try {
            await addPoints.mutateAsync({ clientId: selectedClientId, points: pointsNum });
            playSuccessSound();
            toast({
                title: "Succès",
                description: `${pointsNum} points ajoutés à ${selectedClient?.name}.`,
            });
            setPoints("1");
            setSelectedClientId("");
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible d'ajouter les points.",
                variant: "destructive",
            });
        }
    };

    return (
        <Card className="border-white/10 bg-slate-950/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                    <Plus className="h-5 w-5 text-emerald-400" />
                    Ajout manuel de points
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium text-slate-300">Client</label>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full justify-between border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
                                >
                                    {selectedClient ? (
                                        <span className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-emerald-400" />
                                            {selectedClient.name}
                                        </span>
                                    ) : (
                                        "Sélectionner un client..."
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0 border-slate-700 bg-slate-900">
                                <Command className="bg-slate-900 text-slate-100">
                                    <CommandInput placeholder="Rechercher un client..." className="border-none focus:ring-0" />
                                    <CommandList>
                                        <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                                        <CommandGroup>
                                            {clients?.map((client) => (
                                                <CommandItem
                                                    key={client.id}
                                                    value={client.name}
                                                    onSelect={() => {
                                                        setSelectedClientId(client.id);
                                                        setOpen(false);
                                                    }}
                                                    className="text-slate-100 aria-selected:bg-slate-800 aria-selected:text-white"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span>{client.name}</span>
                                                        <span className="text-xs text-slate-400">Current: {client.points} pts</span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="w-full sm:w-32 space-y-2">
                        <label className="text-sm font-medium text-slate-300">Points</label>
                        <Input
                            type="number"
                            placeholder="Ex: 10"
                            value={points}
                            onChange={(e) => setPoints(e.target.value)}
                            className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                        />
                    </div>

                    <Button
                        onClick={handleAddPoints}
                        disabled={!selectedClientId || !points || addPoints.isPending}
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {addPoints.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        Ajouter
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
