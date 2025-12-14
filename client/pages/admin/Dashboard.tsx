import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, Search, Users, Store, DollarSign, Calendar, LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Stats {
    totalSalons: number;
    totalStylists: number;
    totalClients: number;
    totalPrestations: number;
    totalRevenue: number;
}

interface Salon {
    salonId: string;
    salonName: string;
    accountEmail?: string;
    adminEmail?: string;
    subscriptionStatus: string;
    trialEndsAt: number | null;
    createdAt: string;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [salons, setSalons] = useState<Salon[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

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
                fetch("/api/admin/stats", { headers }),
                fetch("/api/admin/salons", { headers }),
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
            const res = await fetch(`/api/admin/salons/${salonId}`, {
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

            const res = await fetch(`/api/admin/salons/${selectedSalon.salonId}`, {
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

    const openExtensionDialog = (salon: Salon) => {
        setSelectedSalon(salon);
        setExtensionDialogOpen(true);
    }

    if (loading) return <div className="flex justify-center items-center h-screen bg-background"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Super Admin</h1>
                    <p className="text-gray-500">Manage salons and platform overview</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => {
                    localStorage.removeItem("superAdminToken");
                    navigate("/admin/login");
                }}>
                    <LogOut className="h-4 w-4" /> Logout
                </Button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Salons</CardTitle>
                            <Store className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalSalons}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Stylists</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalStylists}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} €</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Prestations</CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalPrestations}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Salons Table */}
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Salons Management</CardTitle>
                            <CardDescription>View and manage registered salons.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by email or name..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-md border border-t-0 border-x-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                                    <TableHead>Salon Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Trial Ends</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salons.filter(salon => {
                                    const query = searchQuery.toLowerCase();
                                    const email = (salon.accountEmail || salon.adminEmail || "").toLowerCase();
                                    const name = (salon.salonName || "").toLowerCase();
                                    return email.includes(query) || name.includes(query);
                                }).map((salon) => (
                                    <TableRow key={salon.salonId}>
                                        <TableCell className="font-medium">
                                            {salon.salonName || <span className="text-muted-foreground italic">Unnamed Salon</span>}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {salon.accountEmail || salon.adminEmail || "N/A"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={salon.subscriptionStatus === 'active' ? 'default' : salon.subscriptionStatus === 'trialing' ? 'secondary' : 'outline'}>
                                                {salon.subscriptionStatus || 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {salon.trialEndsAt ? (
                                                <span className={salon.trialEndsAt < Date.now() ? "text-red-500 font-medium" : ""}>
                                                    {new Date(salon.trialEndsAt).toLocaleDateString()}
                                                </span>
                                            ) : <span className="text-muted-foreground">-</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => openExtensionDialog(salon)}>
                                                    Extend Trial
                                                </Button>
                                                <Button size="icon" variant="destructive" onClick={() => handleDelete(salon.salonId)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {salons.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No salons found.
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Extend Trial Period</DialogTitle>
                        <DialogDescription>
                            Add extra trial days for <strong>{selectedSalon?.salonName || "this salon"}</strong>.
                            This will extend the current expiration date.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-4 py-4">
                        <Button variant="outline" onClick={() => handleUpdateTrial(7)} disabled={processingAction}>
                            +7 Days
                        </Button>
                        <Button variant="outline" onClick={() => handleUpdateTrial(14)} disabled={processingAction}>
                            +14 Days
                        </Button>
                        <Button variant="outline" onClick={() => handleUpdateTrial(30)} disabled={processingAction}>
                            +30 Days
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setExtensionDialogOpen(false)}>Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
