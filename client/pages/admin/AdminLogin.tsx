import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mfaCode, setMfaCode] = useState("");
    const [step, setStep] = useState<"login" | "mfa">("login");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/superadmin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Login failed");
            }

            if (data.mfaRequired) {
                setStep("mfa");
                toast.success("Verification code sent to your email");
            } else {
                localStorage.setItem("superAdminToken", data.token);
                toast.success("Login successful");
                navigate("/bpro-w6y9r1t4v8z/control");
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyMfa = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/superadmin/verify-mfa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: mfaCode }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Verification failed");
            }

            localStorage.setItem("superAdminToken", data.token);
            toast.success("MFA verified, welcome");
            navigate("/bpro-w6y9r1t4v8z/control");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

            <Card className="w-full max-w-md bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl relative z-10">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-white text-center">
                        {step === "login" ? "Super Admin Access" : "Verification Step"}
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-center">
                        {step === "login"
                            ? "Enter your credentials to secure the system"
                            : `Checking your identity. Enter the code sent to ${email}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === "login" ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@barberpro.com"
                                    className="bg-black/20 border-white/10 text-white focus:border-cyan-500/50"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" title="Enter your password" className="text-slate-300">Master Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••••••"
                                    className="bg-black/20 border-white/10 text-white focus:border-cyan-500/50"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-11 transition-all" disabled={loading}>
                                {loading ? "Authenticating..." : "Sign In"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyMfa} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="mfaCode" className="text-slate-300">Verification Code</Label>
                                <Input
                                    id="mfaCode"
                                    type="text"
                                    placeholder="000 000"
                                    className="bg-black/20 border-white/10 text-white text-center text-2xl tracking-[0.5em] focus:border-cyan-500/50"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    maxLength={6}
                                    required
                                />
                                <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest mt-2">
                                    Check your inbox (Spam too)
                                </p>
                            </div>
                            <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-11 transition-all" disabled={loading}>
                                {loading ? "Verifying..." : "Confirm Access"}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-slate-400 hover:text-white"
                                onClick={() => {
                                    setStep("login");
                                    setMfaCode("");
                                }}
                            >
                                Back to login
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
