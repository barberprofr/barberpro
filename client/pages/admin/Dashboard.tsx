import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, Search, Users, Store, DollarSign, Calendar, LogOut, ShieldCheck, CreditCard, Activity, TrendingUp } from "lucide-react";
import { createCurrencyFormatter } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Stats {
    totalSalons: number;
    paidSalons: number;
    trialSalons: number;
    estimatedRevenue: number;
}

interface Salon {
    salonId: string;
    salonName: string;
    accountEmail?: string;
    adminEmail?: string;
    salonAddress?: string;
    salonPostalCode?: string;
    salonCity?: string;
    salonPhone?: string;
    subscriptionStatus: string;
    trialEndsAt: number | null;

    trialStartedAt: number | null;
    subscriptionStartedAt: number | null;
    createdAt: string;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [salons, setSalons] = useState<Salon[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const eurFormatter = useMemo(() => createCurrencyFormatter("EUR"), []);

    // Dialog State
    const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);
    const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
    const [processingAction, setProcessingAction] = useState(false);

    const navigate = useNavigate();
    const token = localStorage.getItem("superAdminToken");

    const fetchData = async () => {
        try {
            if (!token) {
                navigate("/admin/login");
                return;
            }

            const headers = { "x-super-admin-token": token };

            const [statsRes, salonsRes] = await Promise.all([
                fetch("/api/superadmin/stats", { headers }),
                fetch("/api/superadmin/salons", { headers }),
            ]);

            if (statsRes.status === 401 || salonsRes.status === 401) {
                localStorage.removeItem("superAdminToken");
                navigate("/admin/login");
                return;
            }

            if (!statsRes.ok || !salonsRes.ok) throw new Error("Failed to fetch data");

            setStats(await statsRes.json());
            setSalons(await salonsRes.json());
        } catch (error) {
            toast.error("Error loading dashboard");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token, navigate]);

    const handleDelete = async (salonId: string) => {
        if (!confirm("Are you sure? This will delete ALL data for this salon definitively.")) return;

        try {
            const res = await fetch(`/api/superadmin/salons/${salonId}`, {
                method: "DELETE",
                headers: { "x-super-admin-token": token! },
            });

            if (!res.ok) throw new Error("Failed to delete");

            toast.success("Salon deleted");
            fetchData();
        } catch (error) {
            toast.error("Error deleting salon");
        }
    };

    const handleUpdateTrial = async (days: number) => {
        if (!selectedSalon) return;
        setProcessingAction(true);

        try {
            const salon = salons.find(s => s.salonId === selectedSalon.salonId);
            if (!salon) return;

            const now = Date.now();
            const currentEnd = (salon.trialEndsAt && salon.trialEndsAt > now) ? salon.trialEndsAt : now;
            const newTrialEnd = currentEnd + (days * 24 * 60 * 60 * 1000);

            const res = await fetch(`/api/superadmin/salons/${selectedSalon.salonId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-super-admin-token": token!
                },
                body: JSON.stringify({
                    trialEndsAt: newTrialEnd,
                    subscriptionStatus: 'trialing',
                    trialStartedAt: salon.trialEndsAt && salon.trialEndsAt > now ? salon.trialEndsAt - (14 * 24 * 60 * 60 * 1000) : now
                })
            });

            if (!res.ok) throw new Error("Update failed");

            toast.success(`Trial extended by ${days} days`);
            setExtensionDialogOpen(false); // Close dialog
            await fetchData();
        } catch (error) {
            toast.error("Error updating trial");
        } finally {
            setProcessingAction(false);
        }
    };

    const handleActivate = async (salonId: string) => {
        if (!confirm("Grant permissions? This will give this salon full access ('active' status) without Stripe payment.")) return;

        try {
            const res = await fetch(`/api/superadmin/salons/${salonId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-super-admin-token": token!
                },
                body: JSON.stringify({
                    subscriptionStatus: 'active'
                })
            });

            if (!res.ok) throw new Error("Activation failed");

            toast.success("Salon activated (Free Access granted)");
            await fetchData();
        } catch (error) {
            toast.error("Error activating salon");
        }
    };

    const openExtensionDialog = (salon: Salon) => {
        setSelectedSalon(salon);
        setExtensionDialogOpen(true);
    }

    if (loading) return (
        <div className="flex justify-center items-center h-screen bg-[#020617]">
            <Loader2 className="animate-spin h-8 w-8 text-cyan-500" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] bg-gradient-to-br from-slate-950 via-[#0c1425] to-slate-950 text-slate-100 p-4 md:p-8 space-y-8 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-8 bg-cyan-500 rounded-full" />
                        <span className="text-cyan-500 font-bold tracking-widest text-xs uppercase">Platform Control</span>
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-500">
                        Super Admin
                    </h1>
                    <p className="text-slate-400 mt-1 font-medium italic">Tableau de bord de gestion globale BarBerpro</p>
                </div>
                <Button
                    variant="ghost"
                    className="gap-2 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 backdrop-blur-sm transition-all"
                    onClick={() => {
                        localStorage.removeItem("superAdminToken");
                        navigate("/admin/login");
                    }}
                >
                    <LogOut className="h-4 w-4" /> Déconnexion
                </Button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
                    {[
                        { label: "Salons Payants", value: stats.paidSalons, icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                        { label: "Essais en Cours", value: stats.trialSalons, icon: Activity, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                        { label: "Revenu Mensuel Est.", value: eurFormatter.format(stats.estimatedRevenue || 0), icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10" },
                    ].map((item, i) => (
                        <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-md shadow-2xl hover:border-white/20 transition-all group overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</CardTitle>
                                <div className={`p-2 rounded-xl ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
                                    <item.icon className="h-5 w-5" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-white group-hover:translate-x-1 transition-transform">{item.value}</div>
                            </CardContent>
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Card>
                    ))}
                </div>
            )}

            {/* Salons Table */}
            <Card className="relative z-10 bg-white/5 border-white/10 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                <CardHeader className="border-b border-white/5 pb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                                <Users className="h-5 w-5 text-cyan-400" /> Gestion des Salons
                            </CardTitle>
                            <CardDescription className="text-slate-400 font-medium">Visualisez et gérez tous les salons enregistrés sur la plateforme.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-80 group">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                            <Input
                                placeholder="Rechercher par email ou nom..."
                                className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all rounded-xl h-11"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Salon & Contact</TableHead>
                                    <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Localisation</TableHead>
                                    <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Status & Trial</TableHead>
                                    <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Dates</TableHead>
                                    <TableHead className="text-right text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salons.filter(salon => {
                                    const query = searchQuery.toLowerCase();
                                    const email = (salon.accountEmail || salon.adminEmail || "").toLowerCase();
                                    const name = (salon.salonName || "").toLowerCase();
                                    return email.includes(query) || name.includes(query);
                                }).map((salon) => (
                                    <TableRow key={salon.salonId} className="border-white/5 hover:bg-white/5 transition-colors group">
                                        <TableCell className="py-5">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-slate-100 text-base group-hover:text-cyan-400 transition-colors">
                                                    {salon.salonName || <span className="text-slate-600 italic font-normal">Sans nom</span>}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium tracking-tight">
                                                    {salon.accountEmail || salon.adminEmail || "Pas d'email"}
                                                </span>
                                                {salon.salonPhone && (
                                                    <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                                                        <div className="h-1 w-1 bg-amber-500 rounded-full" /> {salon.salonPhone}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-xs text-slate-300 gap-0.5">
                                                {salon.salonAddress ? (
                                                    <>
                                                        <span className="font-medium">{salon.salonAddress}</span>
                                                        <span className="font-black text-slate-500 uppercase text-[10px] tracking-widest">
                                                            {salon.salonPostalCode} {salon.salonCity}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-600 italic">Adresse non renseignée</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                <Badge className={`w-fit font-bold px-2 py-0.5 rounded-md text-[10px] uppercase tracking-tighter ${salon.subscriptionStatus === 'active'
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                                    : salon.subscriptionStatus === 'trialing'
                                                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20'
                                                        : 'bg-slate-800 text-slate-400 border-white/5'
                                                    }`} variant="outline">
                                                    {salon.subscriptionStatus || 'Inactive'}
                                                </Badge>
                                                {salon.trialEndsAt && (
                                                    <div className="flex items-center gap-1.5 text-[10px]">
                                                        <Calendar className="h-3 w-3 text-slate-500" />
                                                        <span className={`font-bold ${(salon.trialEndsAt < Date.now() && salon.subscriptionStatus !== 'active' && salon.subscriptionStatus !== 'paid') ? "text-rose-500" : "text-slate-400"}`}>
                                                            {new Date(salon.trialEndsAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                                                <div className="flex items-center gap-1.5" title="Date de création">
                                                    <Store className="h-3 w-3 text-slate-500" />
                                                    <span>Créé: {new Date(salon.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                {salon.subscriptionStatus === 'active' && salon.subscriptionStartedAt && (
                                                    <div className="flex items-center gap-1.5 text-emerald-400" title="Date de début d'abonnement">
                                                        <CreditCard className="h-3 w-3" />
                                                        <span>Actif: {new Date(salon.subscriptionStartedAt).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="h-8 w-8 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 transition-all rounded-lg"
                                                    onClick={() => handleActivate(salon.salonId)}
                                                    title="Accès Gratuit"
                                                >
                                                    <ShieldCheck className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-8 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all rounded-lg"
                                                    onClick={() => openExtensionDialog(salon)}
                                                >
                                                    Extension
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="secondary"
                                                            className="h-8 w-8 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 transition-all rounded-lg"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-slate-400">
                                                                Cette action est irréversible. Elle supprimera définitivement le compte du salon <strong>{salon.salonName || "Sans nom"}</strong>, ainsi que toutes les données associées (clients, rendez-vous, historique, statistiques).
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white">Annuler</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                className="bg-rose-600 hover:bg-rose-700 text-white border-none"
                                                                onClick={() => handleDelete(salon.salonId)}
                                                            >
                                                                Supprimer définitivement
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {salons.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-40 text-center text-slate-500 font-medium">
                                            Aucun salon trouvé.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Shared Dialog for Extension */}
            <Dialog open={extensionDialogOpen} onOpenChange={setExtensionDialogOpen}>
                <DialogContent className="bg-slate-900 border-white/10 text-white rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Extension Période d'Essai</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Ajoutez des jours d'essai pour le salon <strong>{selectedSalon?.salonName || "ce salon"}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-4 py-8">
                        {[
                            { d: 7, label: "+7 Jours" },
                            { d: 15, label: "+15 Jours" },
                            { d: 30, label: "+30 Jours" },
                        ].map(opt => (
                            <Button
                                key={opt.d}
                                variant="outline"
                                className="h-16 flex flex-col gap-1 bg-white/5 border-white/10 hover:bg-cyan-500 hover:border-cyan-500 group transition-all rounded-xl"
                                onClick={() => handleUpdateTrial(opt.d)}
                                disabled={processingAction}
                            >
                                <span className="text-lg font-black group-hover:scale-110 transition-transform">{opt.label}</span>
                            </Button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setExtensionDialogOpen(false)}>Annuler</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
